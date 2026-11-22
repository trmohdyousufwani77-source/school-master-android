import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  Camera,
  CameraOff,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  RefreshCw,
  ScanLine,
  ShieldAlert,
  UserCheck,
  Repeat,
  PauseCircle,
  Play,
  ListChecks,
  History,
  Cloud,
  CloudOff,
  SlidersHorizontal,
  Database,
  Download,
  Search,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { AttendanceRecord, Student } from '../types';
import { extractAdmissionOrIdFromQrText } from '../utils/calculations';
import {
  PersistentScanLogEntry,
  ScanLogSource,
  appendPersistentScanLog,
  clearPersistentScanLogs,
  filterPersistentScanLogs,
  hydrateScanLogsFromIdb,
  loadPersistentScanLogs,
  markScanLogsSynced,
  mergeScanLogs,
  seedScanLogsFromAttendanceRecords,
} from '../utils/scanLogsStore';

export interface CameraPermissionResult {
  granted: boolean;
  status: 'granted' | 'denied' | 'unavailable';
  cameras: Array<{ id: string; label: string }>;
  errorMessage?: string;
}

export interface QrParseResult {
  matchedStudent: Student | null;
  extractedKey: string;
  reason?: string;
}

export interface ScanDispatchResult {
  ok: boolean;
  duplicate: boolean;
  shouldPauseCamera: boolean;
  dispatchedStatus?: 'Present';
  student?: Student;
  extractedKey: string;
  reason?: string;
}

export interface ScannerEventLog {
  id: string;
  timestamp: string;
  rawText: string;
  studentName?: string;
  classLabel?: string;
  status: 'success' | 'duplicate' | 'error';
  message: string;
}

/**
 * Pure helper to parse scanned QR payload (7-field ID text, JSON object, admissionNumber, ID, or rollNumber)
 * and resolve the matching active Student record.
 */
export function parseScannedStudentQr(
  rawText: string,
  students: Student[],
  selectedClass?: string,
  selectedSection?: string
): QrParseResult {
  const cleaned = (rawText || '').trim();
  if (!cleaned) {
    return {
      matchedStudent: null,
      extractedKey: '',
      reason: 'Empty QR code payload',
    };
  }

  const extracted = extractAdmissionOrIdFromQrText(cleaned);
  const normExtracted = extracted.toLowerCase();
  const normRaw = cleaned.toLowerCase();

  // Optional JSON metadata (e.g. rollNumber if JSON)
  let jsonRollNumber: number | null = null;
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === 'object' && parsed.rollNumber) {
      jsonRollNumber = Number(parsed.rollNumber);
    }
  } catch {
    // Plain text or 7-line QR text
  }

  // Prefer active students matching current class/section if specified, else search all active students
  const activePool = students.filter((s) => s.status === 'Active');
  const classPool =
    selectedClass && selectedSection
      ? activePool.filter((s) => s.classNumber === selectedClass && s.section === selectedSection)
      : selectedClass
      ? activePool.filter((s) => s.classNumber === selectedClass)
      : activePool;

  const findInPool = (pool: Student[]): Student | null => {
    return (
      pool.find(
        (s) =>
          (normExtracted &&
            (s.admissionNumber.toLowerCase() === normExtracted ||
              s.id.toLowerCase() === normExtracted)) ||
          s.admissionNumber.toLowerCase() === normRaw ||
          s.id.toLowerCase() === normRaw ||
          (jsonRollNumber !== null && s.rollNumber === jsonRollNumber)
      ) || null
    );
  };

  let matched = findInPool(classPool);
  if (!matched) {
    matched = findInPool(activePool);
  }

  // Allow numeric roll number lookup inside the selected class roster
  if (!matched && /^\d+$/.test(normRaw) && classPool.length > 0) {
    const roll = parseInt(normRaw, 10);
    matched = classPool.find((s) => s.rollNumber === roll) || null;
  }

  if (!matched) {
    return {
      matchedStudent: null,
      extractedKey: extracted || cleaned,
      reason: `Unrecognized student QR payload: "${extracted || cleaned.slice(0, 32)}"`,
    };
  }

  return {
    matchedStudent: matched,
    extractedKey: extracted || matched.admissionNumber,
  };
}

/**
 * Evaluates a detected QR payload, checks duplicate-scan cooldown, dispatches the attendance
 * mark callback (`Present`), and determines whether camera scanning should stay active or pause.
 */
export function evaluateScanDispatch(
  rawText: string,
  students: Student[],
  options: {
    selectedClass?: string;
    selectedSection?: string;
    continuousScanning: boolean;
    duplicateWindowMs?: number;
    lastScanMap?: Map<string, number>;
    now?: number;
    onMarkPresent?: (student: Student, rawText: string) => void;
  }
): ScanDispatchResult {
  const {
    selectedClass,
    selectedSection,
    continuousScanning,
    duplicateWindowMs = 4500,
    lastScanMap,
    now = Date.now(),
    onMarkPresent,
  } = options;

  const parsed = parseScannedStudentQr(rawText, students, selectedClass, selectedSection);
  if (!parsed.matchedStudent) {
    return {
      ok: false,
      duplicate: false,
      shouldPauseCamera: false,
      extractedKey: parsed.extractedKey,
      reason: parsed.reason,
    };
  }

  const student = parsed.matchedStudent;
  if (lastScanMap) {
    const prevTimestamp = lastScanMap.get(student.id);
    if (prevTimestamp !== undefined && now - prevTimestamp < duplicateWindowMs) {
      return {
        ok: false,
        duplicate: true,
        shouldPauseCamera: false,
        student,
        extractedKey: parsed.extractedKey,
        reason: `Duplicate scan within ${Math.round(duplicateWindowMs / 1000)}s cooldown window`,
      };
    }
    lastScanMap.set(student.id, now);
  }

  if (onMarkPresent) {
    onMarkPresent(student, rawText);
  }

  return {
    ok: true,
    duplicate: false,
    shouldPauseCamera: !continuousScanning,
    dispatchedStatus: 'Present',
    student,
    extractedKey: parsed.extractedKey,
  };
}

/**
 * Verifies camera permission & available video devices safely with explicit fallback states.
 */
export async function requestCameraScannerPermission(
  getCamerasFn: () => Promise<Array<{ id: string; label: string }>> = () => Html5Qrcode.getCameras()
): Promise<CameraPermissionResult> {
  if (typeof navigator === 'undefined') {
    return {
      granted: false,
      status: 'unavailable',
      cameras: [],
      errorMessage: 'Camera API unavailable in non-browser environment.',
    };
  }

  try {
    const cameras = await getCamerasFn();
    if (!cameras || cameras.length === 0) {
      return {
        granted: false,
        status: 'unavailable',
        cameras: [],
        errorMessage: 'No camera hardware detected on this device.',
      };
    }
    return {
      granted: true,
      status: 'granted',
      cameras,
    };
  } catch (err: any) {
    const name = String(err?.name || '');
    const msg = String(err?.message || '');
    const isDenied =
      name === 'NotAllowedError' ||
      name === 'PermissionDeniedError' ||
      /permission|denied|notallowed/i.test(msg);

    return {
      granted: false,
      status: isDenied ? 'denied' : 'unavailable',
      cameras: [],
      errorMessage: isDenied
        ? 'Camera permission denied. Allow camera access in browser settings or use Quick Check-In below.'
        : msg || 'Unable to access device camera.',
    };
  }
}

export interface RecentScannedStudent {
  id: string;
  studentId: string;
  fullName: string;
  rollNumber: number;
  classLabel: string;
  timestamp: string;
}

export interface QueuedAutoSyncScan {
  id: string;
  studentId: string;
  studentName: string;
  classNumber: string;
  section: string;
  date: string;
  markedAt: string;
}

const AUTO_SYNC_QUEUE_STORAGE_KEY = 'school_master_scanner_auto_sync_queue';
const EMPTY_STUDENTS: Student[] = [];
const EMPTY_ATTENDANCE_RECORDS: AttendanceRecord[] = [];
const EMPTY_DRAFT_STATUS: Record<string, string> = {};

interface AttendanceScannerProps {
  students: Student[];
  classStudents?: Student[];
  attendanceRecords?: AttendanceRecord[];
  selectedDate?: string;
  selectedClass?: string;
  selectedSection?: string;
  draftStatus?: Record<string, string>;
  continuousScanning?: boolean;
  defaultContinuousScanning?: boolean;
  onToggleContinuousScanning?: (next: boolean) => void;
  autoSync?: boolean;
  defaultAutoSync?: boolean;
  onToggleAutoSync?: (next: boolean) => void;
  isOffline?: boolean;
  onTriggerBackgroundSync?: (queuedScans: QueuedAutoSyncScan[]) => Promise<void> | void;
  onScanSuccess: (student: Student, rawQrText: string) => void;
  onScanFailure?: (rawText: string, reason: string) => void;
  onPromptSelectClass?: () => void;
  cameraFacing?: 'environment' | 'user';
  language?: 'en' | 'ur';
  soundEnabled?: boolean;
  onToggleSound?: (next: boolean) => void;
  autoClearMs?: number;
}

/**
 * Plays a subtle, crisp Web Audio API 'ping' tone for touchless QR check-in confirmation.
 */
export function playQrSuccessPing(): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;

    // Subtle bell-like ping: fundamental C6 (1046.5 Hz) + soft G6 (1568 Hz) overtone
    const oscPrimary = ctx.createOscillator();
    const oscHarmonic = ctx.createOscillator();
    const gainPrimary = ctx.createGain();
    const gainHarmonic = ctx.createGain();

    oscPrimary.type = 'sine';
    oscPrimary.frequency.setValueAtTime(1046.5, now);

    oscHarmonic.type = 'sine';
    oscHarmonic.frequency.setValueAtTime(1567.98, now);

    gainPrimary.gain.setValueAtTime(0.001, now);
    gainPrimary.gain.linearRampToValueAtTime(0.085, now + 0.012);
    gainPrimary.gain.exponentialRampToValueAtTime(0.0008, now + 0.24);

    gainHarmonic.gain.setValueAtTime(0.001, now);
    gainHarmonic.gain.linearRampToValueAtTime(0.032, now + 0.015);
    gainHarmonic.gain.exponentialRampToValueAtTime(0.0008, now + 0.18);

    oscPrimary.connect(gainPrimary);
    oscHarmonic.connect(gainHarmonic);
    gainPrimary.connect(ctx.destination);
    gainHarmonic.connect(ctx.destination);

    oscPrimary.start(now);
    oscPrimary.stop(now + 0.25);
    oscHarmonic.start(now);
    oscHarmonic.stop(now + 0.2);

    window.setTimeout(() => {
      ctx.close().catch(() => {});
    }, 320);
  } catch {
    // Ignore restricted audio environments
  }
}

export const AttendanceScanner: React.FC<AttendanceScannerProps> = ({
  students,
  classStudents = EMPTY_STUDENTS,
  attendanceRecords = EMPTY_ATTENDANCE_RECORDS,
  selectedDate,
  selectedClass = '',
  selectedSection = '',
  draftStatus = EMPTY_DRAFT_STATUS,
  continuousScanning: controlledContinuous,
  defaultContinuousScanning = true,
  onToggleContinuousScanning,
  autoSync: controlledAutoSync,
  defaultAutoSync = false,
  onToggleAutoSync,
  isOffline = false,
  onTriggerBackgroundSync,
  onScanSuccess,
  onScanFailure,
  onPromptSelectClass,
  cameraFacing = 'environment',
  language = 'en',
  soundEnabled: controlledSoundEnabled,
  onToggleSound,
  autoClearMs = 3000,
}) => {
  const reactId = useId().replace(/:/g, '');
  const scannerRegionId = `html5qr-reader-${reactId}`;
  const effectiveDate = useMemo(
    () => selectedDate || new Date().toISOString().slice(0, 10),
    [selectedDate]
  );

  const [internalContinuous, setInternalContinuous] = useState<boolean>(defaultContinuousScanning);
  const continuousScanning =
    controlledContinuous !== undefined ? controlledContinuous : internalContinuous;

  const [internalSoundEnabled, setInternalSoundEnabled] = useState<boolean>(true);
  const isSoundEnabled =
    controlledSoundEnabled !== undefined ? controlledSoundEnabled : internalSoundEnabled;

  const [internalAutoSync, setInternalAutoSync] = useState<boolean>(defaultAutoSync);
  const autoSyncEnabled =
    controlledAutoSync !== undefined ? controlledAutoSync : internalAutoSync;

  const [isBrowserOnline, setIsBrowserOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine !== false
  );
  const isNetworkAvailable = !isOffline && isBrowserOnline;

  const [pendingSyncScans, setPendingSyncScans] = useState<QueuedAutoSyncScan[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(AUTO_SYNC_QUEUE_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as QueuedAutoSyncScan[]) : [];
    } catch {
      return [];
    }
  });
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'synced'>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const [permissionStatus, setPermissionStatus] = useState<'checking' | 'granted' | 'denied' | 'unavailable'>('checking');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanningActive, setIsScanningActive] = useState<boolean>(false);
  const [isPausedSingleShot, setIsPausedSingleShot] = useState<boolean>(false);
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [manualInput, setManualInput] = useState<string>('');
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'error' | 'duplicate';
    title: string;
    detail: string;
  } | null>(null);
  const [continuousToast, setContinuousToast] = useState<{
    id: string;
    studentName: string;
    detail: string;
  } | null>(null);
  const [recentScans, setRecentScans] = useState<RecentScannedStudent[]>([]);
  const [sessionScannedIds, setSessionScannedIds] = useState<string[]>([]);
  const [recentTab, setRecentTab] = useState<'recent' | 'history' | 'logs'>('recent');
  const [historyDateFilter, setHistoryDateFilter] = useState<string>('all');
  const [persistentLogs, setPersistentLogs] = useState<PersistentScanLogEntry[]>(() =>
    loadPersistentScanLogs()
  );
  const [scanLogSearch, setScanLogSearch] = useState<string>('');
  const [scanLogClassFilter, setScanLogClassFilter] = useState<string>('all');
  const [scanLogDateFrom, setScanLogDateFrom] = useState<string>('');
  const [scanLogDateTo, setScanLogDateTo] = useState<string>('');
  const [eventLog, setEventLog] = useState<ScannerEventLog[]>([]);
  const [autoClearRemainingMs, setAutoClearRemainingMs] = useState<number | null>(null);
  const [isSuccessFlashActive, setIsSuccessFlashActive] = useState<boolean>(false);

  const qrInstanceRef = useRef<Html5Qrcode | null>(null);
  const recentScanMapRef = useRef<Map<string, number>>(new Map());
  const continuousRef = useRef<boolean>(continuousScanning);
  const soundEnabledRef = useRef<boolean>(isSoundEnabled);
  const autoSyncRef = useRef<boolean>(autoSyncEnabled);
  const autoClearTimeoutRef = useRef<number | null>(null);
  const autoClearIntervalRef = useRef<number | null>(null);
  const successFlashTimeoutRef = useRef<number | null>(null);
  const startScannerRef = useRef<((explicitCameraId?: string) => Promise<void>) | null>(null);
  const isSyncingRef = useRef<boolean>(false);
  const studentsRef = useRef<Student[]>(students);
  const classRef = useRef<{ cls: string; sec: string }>({ cls: selectedClass, sec: selectedSection });
  const effectiveDateRef = useRef<string>(effectiveDate);

  useEffect(() => {
    continuousRef.current = continuousScanning;
  }, [continuousScanning]);

  useEffect(() => {
    soundEnabledRef.current = isSoundEnabled;
  }, [isSoundEnabled]);

  useEffect(() => {
    autoSyncRef.current = autoSyncEnabled;
  }, [autoSyncEnabled]);

  useEffect(() => {
    studentsRef.current = students;
  }, [students]);

  useEffect(() => {
    classRef.current = { cls: selectedClass, sec: selectedSection };
  }, [selectedClass, selectedSection]);

  useEffect(() => {
    effectiveDateRef.current = effectiveDate;
  }, [effectiveDate]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(AUTO_SYNC_QUEUE_STORAGE_KEY, JSON.stringify(pendingSyncScans));
    } catch {
      // Ignore storage quota errors in restricted environments
    }
  }, [pendingSyncScans]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleOnline = () => setIsBrowserOnline(true);
    const handleOffline = () => setIsBrowserOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Hydrate persistent scan logs from IndexedDB and backfill existing AttendanceRecords
  useEffect(() => {
    let active = true;
    const seeded = seedScanLogsFromAttendanceRecords(attendanceRecords, students);
    setPersistentLogs((prev) => {
      if (
        prev.length === seeded.length &&
        prev.every((p, idx) => p.id === seeded[idx]?.id && p.syncState === seeded[idx]?.syncState)
      ) {
        return prev;
      }
      return seeded;
    });

    void hydrateScanLogsFromIdb().then((idbLogs) => {
      if (!active || idbLogs.length === 0) return;
      setPersistentLogs((prev) => {
        const merged = mergeScanLogs(idbLogs, prev);
        if (
          prev.length === merged.length &&
          prev.every((p, idx) => p.id === merged[idx]?.id && p.syncState === merged[idx]?.syncState)
        ) {
          return prev;
        }
        return merged;
      });
    });

    return () => {
      active = false;
    };
  }, [attendanceRecords, students]);

  const clearAutoClearTimers = useCallback(() => {
    if (autoClearTimeoutRef.current !== null) {
      window.clearTimeout(autoClearTimeoutRef.current);
      autoClearTimeoutRef.current = null;
    }
    if (autoClearIntervalRef.current !== null) {
      window.clearInterval(autoClearIntervalRef.current);
      autoClearIntervalRef.current = null;
    }
  }, []);

  // Auto-clear scanner state 3 seconds after a successful QR read so camera is ready for next student
  const scheduleAutoClear = useCallback(
    (resumeCameraOnClear: boolean) => {
      clearAutoClearTimers();
      const duration = Math.max(500, autoClearMs);
      const startedAt = Date.now();
      setAutoClearRemainingMs(duration);

      autoClearIntervalRef.current = window.setInterval(() => {
        const elapsed = Date.now() - startedAt;
        const left = Math.max(0, duration - elapsed);
        setAutoClearRemainingMs(left);
        if (left <= 0 && autoClearIntervalRef.current !== null) {
          window.clearInterval(autoClearIntervalRef.current);
          autoClearIntervalRef.current = null;
        }
      }, 100);

      autoClearTimeoutRef.current = window.setTimeout(() => {
        clearAutoClearTimers();
        setFeedbackBanner(null);
        setContinuousToast(null);
        setAutoClearRemainingMs(null);
        setManualInput('');
        if (resumeCameraOnClear) {
          setIsPausedSingleShot(false);
          if (startScannerRef.current) {
            void startScannerRef.current();
          }
        }
      }, duration);
    },
    [autoClearMs, clearAutoClearTimers]
  );

  const triggerSuccessVisualFlash = useCallback(() => {
    if (successFlashTimeoutRef.current !== null) {
      window.clearTimeout(successFlashTimeoutRef.current);
      successFlashTimeoutRef.current = null;
    }
    setIsSuccessFlashActive(true);
    successFlashTimeoutRef.current = window.setTimeout(() => {
      setIsSuccessFlashActive(false);
      successFlashTimeoutRef.current = null;
    }, 900);
  }, []);

  useEffect(() => {
    return () => {
      clearAutoClearTimers();
      if (successFlashTimeoutRef.current !== null) {
        window.clearTimeout(successFlashTimeoutRef.current);
        successFlashTimeoutRef.current = null;
      }
    };
  }, [clearAutoClearTimers]);

  const handleToggleSound = useCallback(
    (next: boolean) => {
      if (controlledSoundEnabled === undefined) {
        setInternalSoundEnabled(next);
      }
      onToggleSound?.(next);
    },
    [controlledSoundEnabled, onToggleSound]
  );

  const handleToggleContinuous = useCallback(
    (next: boolean) => {
      if (controlledContinuous === undefined) {
        setInternalContinuous(next);
      }
      onToggleContinuousScanning?.(next);
    },
    [controlledContinuous, onToggleContinuousScanning]
  );

  const handleToggleAutoSync = useCallback(
    (next: boolean) => {
      if (controlledAutoSync === undefined) {
        setInternalAutoSync(next);
      }
      onToggleAutoSync?.(next);
    },
    [controlledAutoSync, onToggleAutoSync]
  );

  const executeBackgroundSync = useCallback(
    async (itemsToSync: QueuedAutoSyncScan[]) => {
      if (isSyncingRef.current || itemsToSync.length === 0) return;
      isSyncingRef.current = true;
      setSyncState('syncing');
      try {
        await onTriggerBackgroundSync?.(itemsToSync);
        setPendingSyncScans((prev) => {
          const syncedIds = new Set(itemsToSync.map((i) => i.id));
          return prev.filter((item) => !syncedIds.has(item.id));
        });
        setPersistentLogs(
          markScanLogsSynced(
            itemsToSync.map((i) => ({ studentId: i.studentId, date: i.date }))
          )
        );
        setSyncState('synced');
        setLastSyncedAt(
          new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
        );
      } catch {
        setSyncState('idle');
      } finally {
        isSyncingRef.current = false;
      }
    },
    [onTriggerBackgroundSync]
  );

  // Automatically trigger background sync whenever Auto-Sync is active, network is available, and scans are queued
  useEffect(() => {
    if (!autoSyncEnabled || !isNetworkAvailable || pendingSyncScans.length === 0) {
      return;
    }
    void executeBackgroundSync(pendingSyncScans);
  }, [autoSyncEnabled, isNetworkAvailable, pendingSyncScans, executeBackgroundSync]);

  // Active class roster + real-time session summary metrics
  const activeRoster = useMemo(() => {
    if (classStudents.length > 0) return classStudents;
    const active = students.filter((s) => s.status === 'Active');
    if (!selectedClass) return active;
    return active.filter(
      (s) => s.classNumber === selectedClass && (!selectedSection || s.section === selectedSection)
    );
  }, [classStudents, students, selectedClass, selectedSection]);

  const sessionStats = useMemo(() => {
    const totalStudents = activeRoster.length;
    const scannedSet = new Set(sessionScannedIds);
    const studentsScanned = activeRoster.filter((st) => scannedSet.has(st.id)).length;
    const remainingToScan = Math.max(0, totalStudents - studentsScanned);

    let presentTodayCount = 0;
    activeRoster.forEach((st) => {
      if (scannedSet.has(st.id)) {
        presentTodayCount += 1;
        return;
      }
      const draft = draftStatus[st.id];
      if (draft) {
        if (draft === 'Present' || draft === 'Late') presentTodayCount += 1;
        return;
      }
      const existingToday = attendanceRecords.find(
        (r) => r.studentId === st.id && r.date === effectiveDate
      );
      if (existingToday && (existingToday.status === 'Present' || existingToday.status === 'Late')) {
        presentTodayCount += 1;
      }
    });

    const attendancePercentageToday =
      totalStudents > 0 ? Math.round((presentTodayCount / totalStudents) * 100) : 0;

    return {
      totalStudents,
      studentsScanned,
      remainingToScan,
      attendancePercentageToday,
      presentTodayCount,
    };
  }, [activeRoster, sessionScannedIds, draftStatus, attendanceRecords, effectiveDate]);

  // Historical previous-day logs derived from existing attendanceRecords
  const previousDayHistory = useMemo(() => {
    const studentMap = new Map<string, Student>();
    students.forEach((s) => studentMap.set(s.id, s));

    return attendanceRecords
      .filter((r) => {
        if (r.date >= effectiveDate) return false;
        if (selectedClass && r.classNumber !== selectedClass) return false;
        if (selectedClass && selectedSection && r.section !== selectedSection) return false;
        return true;
      })
      .map((r) => {
        const stu = studentMap.get(r.studentId);
        const markedDate = r.markedAt ? new Date(r.markedAt) : null;
        const formattedTime =
          markedDate && !Number.isNaN(markedDate.getTime())
            ? markedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : 'Recorded';
        return {
          id: r.id,
          studentId: r.studentId,
          studentName: stu?.fullName || r.studentId,
          rollNumber: stu?.rollNumber ?? 0,
          classLabel: `${r.classNumber}-${r.section}`,
          date: r.date,
          time: formattedTime,
          status: r.status,
          isOfflineSynced: Boolean(r.isOfflineSynced),
        };
      })
      .sort((a, b) => {
        const dateCmp = b.date.localeCompare(a.date);
        if (dateCmp !== 0) return dateCmp;
        return a.rollNumber - b.rollNumber;
      });
  }, [attendanceRecords, effectiveDate, selectedClass, selectedSection, students]);

  const availableHistoryDates = useMemo(() => {
    const seen = new Set<string>();
    previousDayHistory.forEach((h) => seen.add(h.date));
    return Array.from(seen).sort((a, b) => b.localeCompare(a));
  }, [previousDayHistory]);

  const filteredHistoryRows = useMemo(() => {
    if (historyDateFilter === 'all') return previousDayHistory;
    return previousDayHistory.filter((item) => item.date === historyDateFilter);
  }, [previousDayHistory, historyDateFilter]);

  const availableScanLogClasses = useMemo(() => {
    const classSet = new Set<string>();
    students.forEach((s) => {
      if (s.classNumber) classSet.add(s.classNumber);
    });
    persistentLogs.forEach((l) => {
      if (l.classNumber) classSet.add(l.classNumber);
    });
    return Array.from(classSet).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [students, persistentLogs]);

  const filteredScanLogs = useMemo(
    () =>
      filterPersistentScanLogs(persistentLogs, {
        searchQuery: scanLogSearch,
        classFilter: scanLogClassFilter,
        dateFrom: scanLogDateFrom,
        dateTo: scanLogDateTo,
      }),
    [persistentLogs, scanLogSearch, scanLogClassFilter, scanLogDateFrom, scanLogDateTo]
  );

  const handleExportScannerHistoryCsv = useCallback(() => {
    const rowsToExport = filteredScanLogs.length > 0 ? filteredScanLogs : persistentLogs;
    if (rowsToExport.length === 0) return;
    const esc = (val: string | number) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const header = 'ID,Date,Timestamp,Student Name,Admission Number,Class & Section,Status,Source,Sync Status';
    const csvLines = [
      header,
      ...rowsToExport.map((log) =>
        [
          esc(log.id),
          esc(log.date),
          esc(log.timestamp),
          esc(log.studentName),
          esc(log.admissionNumber),
          esc(`Class ${log.classNumber}-${log.section}`),
          esc(log.status),
          esc(log.source),
          esc(log.syncState === 'synced' ? 'SYNCED' : 'PENDING'),
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvLines], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SchoolMaster_ScannerHistory_${effectiveDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [effectiveDate, filteredScanLogs, persistentLogs]);

  const appendEvent = useCallback((entry: Omit<ScannerEventLog, 'id' | 'timestamp'>) => {
    const nowTime = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    setEventLog((prev) => [
      {
        ...entry,
        id: `scanlog-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: nowTime,
      },
      ...prev.slice(0, 24),
    ]);
  }, []);

  const stopCameraSafely = useCallback(async () => {
    const inst = qrInstanceRef.current;
    if (inst) {
      try {
        if (inst.isScanning) {
          await inst.stop();
        }
      } catch {
        // Ignore stop errors if already idle
      }
      try {
        inst.clear();
      } catch {
        // Ignore clear errors on unmount
      }
    }
    setIsScanningActive(false);
  }, []);

  const handleDecodedPayload = useCallback(
    (decodedText: string, source: ScanLogSource = 'QR Camera') => {
      const result = evaluateScanDispatch(decodedText, studentsRef.current, {
        selectedClass: classRef.current.cls,
        selectedSection: classRef.current.sec,
        continuousScanning: continuousRef.current,
        duplicateWindowMs: 4500,
        lastScanMap: recentScanMapRef.current,
        onMarkPresent: (matchedStudent, rawText) => {
          onScanSuccess(matchedStudent, rawText);
        },
      });

      const onlineNow =
        !isOffline && (typeof navigator === 'undefined' || navigator.onLine !== false);
      const nowIso = new Date().toISOString();

      if (result.ok && result.student) {
        const matched = result.student;

        // Visual green border flash on scanner overlay to complement auditory feedback
        triggerSuccessVisualFlash();

        // Play subtle auditory 'ping' feedback for immediate touchless confidence
        if (soundEnabledRef.current) {
          playQrSuccessPing();
        }

        const scanTime = new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });

        setSessionScannedIds((prev) => (prev.includes(matched.id) ? prev : [...prev, matched.id]));

        // Queue scanned attendance record for Auto-Sync background dispatch
        const queuedEntry: QueuedAutoSyncScan = {
          id: `qsync-${Date.now()}-${matched.id}`,
          studentId: matched.id,
          studentName: matched.fullName,
          classNumber: matched.classNumber,
          section: matched.section,
          date: effectiveDateRef.current,
          markedAt: nowIso,
        };
        setPendingSyncScans((prev) => [
          ...prev.filter((item) => !(item.studentId === matched.id && item.date === queuedEntry.date)),
          queuedEntry,
        ]);

        // Persist in Scan Logs database (IndexedDB + localStorage)
        setPersistentLogs(
          appendPersistentScanLog({
            id: `scanlog-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            date: effectiveDateRef.current,
            timestamp: scanTime,
            isoTimestamp: nowIso,
            studentId: matched.id,
            admissionNumber: matched.admissionNumber,
            studentName: matched.fullName,
            rollNumber: matched.rollNumber,
            classNumber: matched.classNumber,
            section: matched.section,
            status: 'Present',
            source,
            rawPayload: decodedText,
            syncState: autoSyncRef.current && onlineNow ? 'synced' : 'queued',
          })
        );

        // Update Recent Scans list (retain last 5 successfully scanned students in session)
        setRecentScans((prev) => [
          {
            id: `recent-${Date.now()}-${matched.id}`,
            studentId: matched.id,
            fullName: matched.fullName,
            rollNumber: matched.rollNumber,
            classLabel: `${matched.classNumber}-${matched.section}`,
            timestamp: scanTime,
          },
          ...prev,
        ].slice(0, 5));

        setFeedbackBanner({
          type: 'success',
          title: `Marked Present: ${matched.fullName}`,
          detail: `Class ${matched.classNumber}-${matched.section} • Roll #${matched.rollNumber} (${matched.admissionNumber})`,
        });

        appendEvent({
          rawText: decodedText,
          studentName: matched.fullName,
          classLabel: `${matched.classNumber}-${matched.section}`,
          status: 'success',
          message: 'Marked Present via QR Scan',
        });

        if (result.shouldPauseCamera) {
          setContinuousToast(null);
          setIsPausedSingleShot(true);
          void stopCameraSafely();
        } else {
          // Continuous Scanning mode: keep camera active & show viewfinder success overlay
          setContinuousToast({
            id: `toast-${Date.now()}-${matched.id}`,
            studentName: matched.fullName,
            detail: `Class ${matched.classNumber}-${matched.section} · Roll #${matched.rollNumber} · Ready for next student`,
          });
        }

        // Auto-clear after 3 seconds so camera & viewfinder are ready for the next student automatically
        scheduleAutoClear(result.shouldPauseCamera);
      } else if (result.duplicate && result.student) {
        const dupTime = new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
        setPersistentLogs(
          appendPersistentScanLog({
            id: `scanlog-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            date: effectiveDateRef.current,
            timestamp: dupTime,
            isoTimestamp: nowIso,
            studentId: result.student.id,
            admissionNumber: result.student.admissionNumber,
            studentName: result.student.fullName,
            rollNumber: result.student.rollNumber,
            classNumber: result.student.classNumber,
            section: result.student.section,
            status: 'Duplicate',
            source,
            rawPayload: decodedText,
            syncState: 'synced',
          })
        );
        setFeedbackBanner({
          type: 'duplicate',
          title: `Already Scanned: ${result.student.fullName}`,
          detail: result.reason || 'Duplicate cooldown active',
        });
        appendEvent({
          rawText: decodedText,
          studentName: result.student.fullName,
          classLabel: `${result.student.classNumber}-${result.student.section}`,
          status: 'duplicate',
          message: result.reason || 'Duplicate suppressed',
        });
        onScanFailure?.(decodedText, result.reason || 'Duplicate scan');
      } else {
        const errTime = new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
        setPersistentLogs(
          appendPersistentScanLog({
            id: `scanlog-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            date: effectiveDateRef.current,
            timestamp: errTime,
            isoTimestamp: nowIso,
            studentId: 'UNRECOGNIZED',
            admissionNumber: result.extractedKey || 'Unknown',
            studentName: 'Unrecognized QR Payload',
            rollNumber: 0,
            classNumber: classRef.current.cls || '—',
            section: classRef.current.sec || '—',
            status: 'Unrecognized',
            source,
            rawPayload: decodedText,
            syncState: 'synced',
          })
        );
        setFeedbackBanner({
          type: 'error',
          title: 'Unrecognized QR Code',
          detail: result.reason || 'Student ID not matched in roster',
        });
        appendEvent({
          rawText: decodedText,
          status: 'error',
          message: result.reason || 'Student ID not found',
        });
        onScanFailure?.(decodedText, result.reason || 'Unrecognized QR');
      }
    },
    [
      appendEvent,
      isOffline,
      onScanFailure,
      onScanSuccess,
      scheduleAutoClear,
      stopCameraSafely,
      triggerSuccessVisualFlash,
    ]
  );

  const startScanner = useCallback(
    async (explicitCameraId?: string) => {
      setPermissionStatus('checking');
      setCameraError(null);
      setIsPausedSingleShot(false);

      const perm = await requestCameraScannerPermission();
      setCameras(perm.cameras);

      if (!perm.granted) {
        setPermissionStatus(perm.status);
        setCameraError(perm.errorMessage || 'Camera unavailable');
        setIsScanningActive(false);
        return;
      }

      setPermissionStatus('granted');
      const targetCamId =
        explicitCameraId ||
        selectedCameraId ||
        perm.cameras.find((c) => /back|rear|environment/i.test(c.label))?.id ||
        perm.cameras[0].id;

      if (targetCamId && targetCamId !== selectedCameraId) {
        setSelectedCameraId(targetCamId);
      }

      await stopCameraSafely();

      try {
        const containerEl = document.getElementById(scannerRegionId);
        if (!containerEl) return;

        const html5Qr = new Html5Qrcode(scannerRegionId, { verbose: false });
        qrInstanceRef.current = html5Qr;

        const cameraConfig = targetCamId
          ? { deviceId: { exact: targetCamId } }
          : { facingMode: cameraFacing };

        await html5Qr.start(
          cameraConfig,
          {
            fps: 10,
            qrbox: { width: 220, height: 220 },
            aspectRatio: 1.333,
          },
          (decodedText) => {
            handleDecodedPayload(decodedText);
          },
          () => {
            // Frame had no QR code; intentionally silent
          }
        );

        setIsScanningActive(true);
      } catch (err: any) {
        const msg = String(err?.message || 'Unable to start camera viewfinder.');
        const isDenied = /permission|denied|notallowed/i.test(msg);
        setPermissionStatus(isDenied ? 'denied' : 'unavailable');
        setCameraError(msg);
        setIsScanningActive(false);
      }
    },
    [cameraFacing, handleDecodedPayload, scannerRegionId, selectedCameraId, stopCameraSafely]
  );

  useEffect(() => {
    startScannerRef.current = startScanner;
  }, [startScanner]);

  useEffect(() => {
    void startScanner();
    return () => {
      void stopCameraSafely();
    };
    // Run on mount / cameraFacing change only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraFacing]);

  const qrFileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDecodingFile, setIsDecodingFile] = useState<boolean>(false);

  const handleScanQrImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setIsDecodingFile(true);
    try {
      await stopCameraSafely();
      const tempId = `${scannerRegionId}-file`;
      let tempEl = document.getElementById(tempId);
      if (!tempEl) {
        tempEl = document.createElement('div');
        tempEl.id = tempId;
        tempEl.style.display = 'none';
        document.body.appendChild(tempEl);
      }
      const fileScanner = new Html5Qrcode(tempId, { verbose: false });
      try {
        const decodedText = await fileScanner.scanFile(file, false);
        handleDecodedPayload(decodedText, 'QR Camera');
      } finally {
        try {
          fileScanner.clear();
        } catch {
          // ignore
        }
        tempEl.remove();
      }
    } catch {
      setFeedbackBanner({
        type: 'error',
        title: 'No QR Code Detected in Image',
        detail: 'Please upload a clear photo or downloaded JPEG/PNG of the student ID card QR code.',
      });
    } finally {
      setIsDecodingFile(false);
    }
  };

  const handleManualSubmit = () => {
    const trimmed = manualInput.trim();
    if (!trimmed) return;
    handleDecodedPayload(trimmed, 'Manual Entry');
    setManualInput('');
  };

  return (
    <div className="space-y-4">
      {/* Real-Time Session Statistics Summary Card */}
      <section
        aria-label="Current Session Statistics"
        data-testid="scanner-stats-summary"
        className="rounded-2xl bg-slate-950/90 border border-slate-800 p-4 space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <h4 className="font-bold text-slate-100">
            Session Statistics
          </h4>
          <span className="text-[11px] text-slate-400 font-mono tabular-nums">
            {selectedClass ? `Class ${selectedClass}-${selectedSection || 'A'}` : 'All Classes'}
            <span className="mx-1.5" aria-hidden="true">·</span>
            {effectiveDate}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-800">
          <div className="pb-2.5 sm:pb-0 sm:pr-4">
            <p className="text-[11px] text-slate-400">Students Scanned</p>
            <p className="text-xl font-extrabold text-emerald-400 font-mono tabular-nums mt-0.5">
              {sessionStats.studentsScanned}
              <span className="text-xs font-normal text-slate-500 ml-1">
                / {sessionStats.totalStudents}
              </span>
            </p>
          </div>

          <div className="py-2.5 sm:py-0 sm:px-4">
            <p className="text-[11px] text-slate-400">Attendance Percentage Today</p>
            <p className="text-xl font-extrabold text-indigo-300 font-mono tabular-nums mt-0.5">
              {sessionStats.attendancePercentageToday}%
              <span className="text-xs font-normal text-slate-500 ml-1.5">
                ({sessionStats.presentTodayCount} present)
              </span>
            </p>
          </div>

          <div className="pt-2.5 sm:pt-0 sm:pl-4">
            <p className="text-[11px] text-slate-400">Remaining to Scan</p>
            <p className="text-xl font-extrabold text-amber-300 font-mono tabular-nums mt-0.5">
              {sessionStats.remainingToScan}
              <span className="text-xs font-normal text-slate-500 ml-1.5">
                pending
              </span>
            </p>
          </div>
        </div>
      </section>

      {/* Scanner Settings & Mode Toolbar: Class Context + Continuous Scanning + Auto-Sync */}
      <div
        aria-label="Scanner Settings"
        className="bg-slate-950/90 p-3.5 rounded-2xl border border-slate-800 text-xs space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 font-semibold flex items-center gap-1.5">
              <QrCode className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {selectedClass
                  ? `Active Class ${selectedClass}-${selectedSection || 'A'}`
                  : 'No Class Selected'}
              </span>
            </div>

            {onPromptSelectClass && (
              <button
                type="button"
                onClick={onPromptSelectClass}
                className="px-2.5 py-1 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/35 text-indigo-300 border border-indigo-500/40 font-bold transition-colors whitespace-nowrap shrink-0"
              >
                {selectedClass ? 'Switch Class' : 'Select Class'}
              </button>
            )}

            {cameras.length > 1 && (
              <select
                value={selectedCameraId}
                onChange={(e) => {
                  setSelectedCameraId(e.target.value);
                  void startScanner(e.target.value);
                }}
                className="px-2 py-1 rounded-xl bg-slate-900 border border-slate-700 text-[11px] text-slate-200 max-w-[160px]"
                aria-label="Select camera device"
              >
                {cameras.map((cam, idx) => (
                  <option key={cam.id} value={cam.id}>
                    {cam.label || `Camera ${idx + 1}`}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {/* Continuous Scanning Toggle Switch */}
            <div className="flex items-center gap-2">
              <Repeat className={`w-3.5 h-3.5 ${continuousScanning ? 'text-emerald-400' : 'text-slate-400'}`} />
              <span className="font-bold text-slate-200 whitespace-nowrap">
                {language === 'ur' ? 'مسلسل اسکیننگ' : 'Continuous Scanning'}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={continuousScanning}
                aria-label="Continuous Scanning"
                onClick={() => {
                  const next = !continuousScanning;
                  continuousRef.current = next;
                  handleToggleContinuous(next);
                  if (next && isPausedSingleShot) {
                    void startScanner();
                  }
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  continuousScanning ? 'bg-emerald-500' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
                    continuousScanning ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className={`text-[11px] font-mono font-bold ${continuousScanning ? 'text-emerald-400' : 'text-slate-400'}`}>
                {continuousScanning ? 'ON' : 'OFF'}
              </span>
            </div>

            {/* Auto-Sync Background Toggle Switch */}
            <div className="flex items-center gap-2">
              {isNetworkAvailable ? (
                <Cloud className={`w-3.5 h-3.5 ${autoSyncEnabled ? 'text-indigo-400' : 'text-slate-400'}`} />
              ) : (
                <CloudOff className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span className="font-bold text-slate-200 whitespace-nowrap">
                {language === 'ur' ? 'خودکار سنک' : 'Auto-Sync'}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={autoSyncEnabled}
                aria-label="Auto-Sync"
                onClick={() => {
                  const next = !autoSyncEnabled;
                  autoSyncRef.current = next;
                  handleToggleAutoSync(next);
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  autoSyncEnabled ? 'bg-indigo-500' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
                    autoSyncEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className={`text-[11px] font-mono font-bold ${autoSyncEnabled ? 'text-indigo-300' : 'text-slate-400'}`}>
                {autoSyncEnabled ? 'ON' : 'OFF'}
              </span>
            </div>

            {/* Subtle Ping Sound Feedback Toggle */}
            <button
              type="button"
              onClick={() => {
                const next = !isSoundEnabled;
                soundEnabledRef.current = next;
                handleToggleSound(next);
                if (next) playQrSuccessPing();
              }}
              aria-label={isSoundEnabled ? 'Mute QR scan ping sound' : 'Unmute QR scan ping sound'}
              title={isSoundEnabled ? 'Ping sound active on scan (click to mute)' : 'Ping sound muted (click to enable)'}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[11px] font-bold transition-colors ${
                isSoundEnabled
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              {isSoundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span>{isSoundEnabled ? 'Ping Sound ON' : 'Muted'}</span>
            </button>
          </div>
        </div>

        {/* Scanner Sync Status Strip */}
        <div
          data-testid="scanner-sync-status"
          className="pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400"
        >
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>
              {syncState === 'syncing'
                ? 'Background sync in progress...'
                : !isNetworkAvailable
                ? `Offline · ${pendingSyncScans.length} queued for sync when online`
                : autoSyncEnabled
                ? pendingSyncScans.length > 0
                  ? `Auto-Sync active · syncing ${pendingSyncScans.length} scanned record(s)`
                  : lastSyncedAt
                  ? `Auto-Sync active · last synced at ${lastSyncedAt}`
                  : 'Auto-Sync active · scans sync automatically while online'
                : pendingSyncScans.length > 0
                ? `${pendingSyncScans.length} scanned record(s) awaiting manual sync`
                : 'Auto-Sync paused · manual save or sync required'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-emerald-300/90 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-md">
              Auto-clear: {(autoClearMs / 1000).toFixed(0)}s
            </span>
            {pendingSyncScans.length > 0 && isNetworkAvailable && syncState !== 'syncing' && (
              <button
                type="button"
                onClick={() => void executeBackgroundSync(pendingSyncScans)}
                className="px-2.5 py-1 rounded-lg bg-indigo-600/25 hover:bg-indigo-600/40 text-indigo-200 font-semibold transition-colors whitespace-nowrap shrink-0"
              >
                Sync {pendingSyncScans.length} Now
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Feedback Banner (Success / Duplicate / Failure) with 3-second Auto-Clear Countdown */}
      {feedbackBanner && (
        <div
          className={`p-3 rounded-2xl border text-xs space-y-2 ${
            feedbackBanner.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
              : feedbackBanner.type === 'duplicate'
              ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
              : 'bg-rose-500/15 border-rose-500/40 text-rose-200'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              {feedbackBanner.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : feedbackBanner.type === 'duplicate' ? (
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              ) : (
                <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="font-extrabold truncate">{feedbackBanner.title}</p>
                <p className="text-[11px] opacity-85 truncate">{feedbackBanner.detail}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {feedbackBanner.type === 'success' && autoClearRemainingMs !== null && (
                <span
                  data-testid="auto-clear-countdown"
                  className="px-2 py-1 rounded-lg bg-emerald-950/80 border border-emerald-400/40 text-emerald-200 font-mono text-[10px] font-bold"
                >
                  Ready in {Math.max(0.1, autoClearRemainingMs / 1000).toFixed(1)}s
                </span>
              )}
              {isPausedSingleShot && !continuousScanning && (
                <button
                  type="button"
                  onClick={() => {
                    clearAutoClearTimers();
                    setAutoClearRemainingMs(null);
                    setFeedbackBanner(null);
                    void startScanner();
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shrink-0 transition-colors"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Scan Next</span>
                </button>
              )}
            </div>
          </div>

          {feedbackBanner.type === 'success' && autoClearRemainingMs !== null && (
            <div className="w-full h-1 rounded-full bg-emerald-950/70 overflow-hidden">
              <div
                className="h-full bg-emerald-400 transition-all duration-100 ease-linear"
                style={{ width: `${Math.max(0, Math.min(100, (autoClearRemainingMs / autoClearMs) * 100))}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* html5-qrcode Camera Viewfinder Box */}
      <div
        data-testid="scanner-viewfinder-container"
        className={`relative rounded-2xl bg-black border-2 overflow-hidden min-h-[240px] flex flex-col items-center justify-center transition-all duration-200 ${
          isSuccessFlashActive
            ? 'border-emerald-400 ring-4 ring-emerald-400/70 shadow-[0_0_32px_rgba(16,185,129,0.55)]'
            : feedbackBanner?.type === 'success'
            ? 'border-emerald-500/80 ring-2 ring-emerald-500/35'
            : 'border-slate-800'
        }`}
      >
        <div id={scannerRegionId} className="w-full" />

        {/* Visual 'Success' State Overlay (Green Border Flash + Glowing Corner Brackets) */}
        {isSuccessFlashActive && (
          <div
            aria-hidden="true"
            data-testid="scanner-success-flash"
            className="pointer-events-none absolute inset-0 z-40 rounded-2xl border-[5px] border-emerald-400 bg-emerald-400/20 shadow-[inset_0_0_36px_rgba(16,185,129,0.65)] animate-pulse"
          >
            <span className="absolute top-2.5 left-2.5 w-6 h-6 border-t-4 border-l-4 border-emerald-300 rounded-tl-lg" />
            <span className="absolute top-2.5 right-2.5 w-6 h-6 border-t-4 border-r-4 border-emerald-300 rounded-tr-lg" />
            <span className="absolute bottom-2.5 left-2.5 w-6 h-6 border-b-4 border-l-4 border-emerald-300 rounded-bl-lg" />
            <span className="absolute bottom-2.5 right-2.5 w-6 h-6 border-b-4 border-r-4 border-emerald-300 rounded-br-lg" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-600/95 border border-emerald-300 text-white text-xs font-extrabold shadow-lg">
                <CheckCircle2 className="w-4 h-4 text-emerald-100" />
                <span>QR Processed</span>
              </div>
            </div>
          </div>
        )}

        {/* Brief Continuous Scanning Success Toast Overlay (keeps viewfinder active) */}
        {continuousToast && continuousScanning && (
          <div
            role="status"
            data-testid="continuous-scan-toast"
            className="pointer-events-none absolute top-3 inset-x-3 z-30 flex items-center justify-center"
          >
            <div className="bg-emerald-950/95 border border-emerald-400/60 text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2.5 max-w-full">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="min-w-0 text-xs">
                <span className="font-bold block truncate">
                  Present: {continuousToast.studentName}
                </span>
                <span className="text-[11px] text-emerald-200 block truncate">
                  {continuousToast.detail}
                </span>
              </div>
            </div>
          </div>
        )}

        {isPausedSingleShot && !isScanningActive && (
          <div className="absolute inset-0 bg-slate-950/85 flex flex-col items-center justify-center p-6 text-center space-y-3 z-20">
            <PauseCircle className="w-10 h-10 text-emerald-400" />
            <div>
              <p className="text-sm font-bold text-white">Single-Shot Scan Complete</p>
              <p className="text-xs text-slate-400 mt-1">
                Camera paused after detection. Turn on Continuous Scanning for rapid-fire scanning.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void startScanner()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors"
            >
              <Play className="w-4 h-4" />
              <span>Resume Camera Scanner</span>
            </button>
          </div>
        )}

        {!isScanningActive && !isPausedSingleShot && (
          <div className="p-6 text-center space-y-3">
            {permissionStatus === 'checking' ? (
              <>
                <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
                <p className="text-xs text-slate-300 font-medium">
                  Requesting camera access for QR scanning...
                </p>
              </>
            ) : (
              <>
                <CameraOff className="w-9 h-9 text-slate-500 mx-auto" />
                <div className="max-w-sm space-y-1">
                  <p className="text-xs font-bold text-slate-200">
                    {permissionStatus === 'denied' ? 'Camera Permission Required' : 'Camera Preview Unavailable'}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {cameraError || 'Allow camera permission or use Student ID entry / Quick Tap below.'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => void startScanner()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-colors"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Retry Camera</span>
                  </button>
                  <button
                    type="button"
                    disabled={isDecodingFile}
                    onClick={() => qrFileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isDecodingFile ? 'Scanning ID Card...' : 'Scan ID Card QR Photo'}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        <input
          ref={qrFileInputRef}
          type="file"
          accept="image/*"
          onChange={handleScanQrImageFile}
          className="hidden"
          aria-label="Upload student ID card QR image"
        />

        {isScanningActive && (
          <div className="absolute bottom-2.5 inset-x-3 z-20 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/85 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold">
              <ScanLine className="w-3.5 h-3.5 animate-pulse" />
              <span>Touchless ID Card QR Active • Hold Student QR inside frame</span>
            </span>
            <button
              type="button"
              disabled={isDecodingFile}
              onClick={() => qrFileInputRef.current?.click()}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-950/85 hover:bg-slate-800 border border-slate-700 text-slate-200 text-[10px] font-bold transition-colors"
            >
              <Upload className="w-3 h-3 text-amber-300" />
              <span>Scan QR Photo</span>
            </button>
          </div>
        )}
      </div>

      {/* Recent Scans & Previous Days View History */}
      <section
        aria-label="Recent Scans"
        data-testid="recent-scans-list"
        className="rounded-2xl bg-slate-950/75 border border-slate-800 p-3.5 space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900 border border-slate-800" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={recentTab === 'recent'}
              onClick={() => setRecentTab('recent')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-colors whitespace-nowrap shrink-0 ${
                recentTab === 'recent'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>{language === 'ur' ? 'حالیہ اسکین' : 'Recent Scans'}</span>
              <span className="font-mono tabular-nums text-[10px] opacity-80">
                ({recentScans.length}/5)
              </span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={recentTab === 'history'}
              onClick={() => setRecentTab('history')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-colors whitespace-nowrap shrink-0 ${
                recentTab === 'history'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>{language === 'ur' ? 'سابقہ تاریخ' : 'View History'}</span>
              <span className="font-mono tabular-nums text-[10px] opacity-80">
                ({previousDayHistory.length})
              </span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={recentTab === 'logs'}
              onClick={() => setRecentTab('logs')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-colors whitespace-nowrap shrink-0 ${
                recentTab === 'logs'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>{language === 'ur' ? 'اسکین لاگس' : 'Scan Logs'}</span>
              <span className="font-mono tabular-nums text-[10px] opacity-80">
                ({persistentLogs.length})
              </span>
            </button>
          </div>

          {recentTab === 'history' && availableHistoryDates.length > 0 && (
            <select
              value={historyDateFilter}
              onChange={(e) => setHistoryDateFilter(e.target.value)}
              aria-label="Filter scan history by date"
              className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-[11px] font-medium text-slate-200 font-mono tabular-nums"
            >
              <option value="all">All Previous Days ({availableHistoryDates.length})</option>
              {availableHistoryDates.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          )}
        </div>

        {recentTab === 'recent' ? (
          recentScans.length === 0 ? (
            <p className="text-[11px] text-slate-400 py-1">
              No students scanned yet in this session.
            </p>
          ) : (
            <ul className="divide-y divide-slate-800/80 text-xs">
              {recentScans.map((entry) => (
                <li
                  key={entry.id}
                  className="py-2 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="font-semibold text-white truncate">
                      {entry.fullName}
                    </span>
                    <span className="text-[11px] text-slate-400 whitespace-nowrap shrink-0">
                      Class {entry.classLabel} · Roll #{entry.rollNumber}
                    </span>
                  </div>
                  <span className="text-[11px] text-emerald-400 font-mono tabular-nums whitespace-nowrap shrink-0">
                    {entry.timestamp}
                  </span>
                </li>
              ))}
            </ul>
          )
        ) : recentTab === 'history' ? (
          filteredHistoryRows.length === 0 ? (
            <p className="text-[11px] text-slate-400 py-2">
              No previous-day attendance records available for this class.
            </p>
          ) : (
            <div
              data-testid="previous-scans-history"
              className="max-h-52 overflow-y-auto pr-1"
            >
              <ul className="divide-y divide-slate-800/80 text-xs">
                {filteredHistoryRows.map((row) => (
                  <li
                    key={row.id}
                    className="py-2 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-white truncate">
                        {row.studentName}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                        Class {row.classLabel}
                        {row.rollNumber > 0 ? ` · Roll #${row.rollNumber}` : ''}
                        {' · '}
                        {row.date} ({row.time})
                      </div>
                    </div>
                    <span
                      className={`text-[11px] font-semibold whitespace-nowrap shrink-0 ${
                        row.status === 'Present'
                          ? 'text-emerald-400'
                          : row.status === 'Late'
                          ? 'text-amber-300'
                          : row.status === 'Approved_Leave'
                          ? 'text-blue-300'
                          : 'text-rose-400'
                      }`}
                    >
                      {row.status === 'Approved_Leave' ? 'Leave' : row.status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )
        ) : (
          <div data-testid="scan-logs-database" className="space-y-3">
            {/* Search & Filter Toolbar */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
              <div className="relative sm:col-span-5">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={scanLogSearch}
                  onChange={(e) => setScanLogSearch(e.target.value)}
                  aria-label="Search scan logs by student"
                  placeholder="Search student name, admission #, or ID..."
                  className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="sm:col-span-2">
                <select
                  value={scanLogClassFilter}
                  onChange={(e) => setScanLogClassFilter(e.target.value)}
                  aria-label="Filter scan logs by class"
                  className="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">All Classes</option>
                  {availableScanLogClasses.map((cls) => (
                    <option key={cls} value={cls}>
                      Class {cls}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <input
                  type="date"
                  value={scanLogDateFrom}
                  onChange={(e) => setScanLogDateFrom(e.target.value)}
                  aria-label="Filter scan logs from date"
                  title="From date"
                  className="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="sm:col-span-2">
                <input
                  type="date"
                  value={scanLogDateTo}
                  onChange={(e) => setScanLogDateTo(e.target.value)}
                  aria-label="Filter scan logs to date"
                  title="To date"
                  className="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="sm:col-span-1 flex items-center justify-end gap-1">
                {(scanLogSearch || scanLogClassFilter !== 'all' || scanLogDateFrom || scanLogDateTo) && (
                  <button
                    type="button"
                    onClick={() => {
                      setScanLogSearch('');
                      setScanLogClassFilter('all');
                      setScanLogDateFrom('');
                      setScanLogDateTo('');
                    }}
                    className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold whitespace-nowrap shrink-0"
                    title="Reset filters"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
              <span className="font-mono tabular-nums">
                Showing {filteredScanLogs.length} of {persistentLogs.length} persistent scan record(s)
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={persistentLogs.length === 0}
                  onClick={handleExportScannerHistoryCsv}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold whitespace-nowrap shrink-0 transition-colors"
                >
                  <Download className="w-3 h-3" />
                  <span>Export CSV</span>
                </button>
                {persistentLogs.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setPersistentLogs(clearPersistentScanLogs())}
                    className="inline-flex items-center gap-1 text-slate-400 hover:text-rose-400 font-semibold whitespace-nowrap shrink-0"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear Database</span>
                  </button>
                )}
              </div>
            </div>

            {filteredScanLogs.length === 0 ? (
              <p className="text-[11px] text-slate-400 py-3 text-center">
                No scan log records match the active student, class, or date range filters.
              </p>
            ) : (
              <div className="max-h-60 overflow-y-auto pr-1">
                <ul className="divide-y divide-slate-800/80 text-xs">
                  {filteredScanLogs.map((log) => (
                    <li
                      key={log.id}
                      className="py-2 flex flex-wrap items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white truncate">
                            {log.studentName}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono tabular-nums shrink-0">
                            {log.admissionNumber}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                          Class {log.classNumber}-{log.section}
                          {log.rollNumber > 0 ? ` · Roll #${log.rollNumber}` : ''}
                          {' · '}
                          {log.date} · {log.timestamp} · {log.source}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 text-[11px]">
                        <span
                          className={`font-bold ${
                            log.status === 'Present'
                              ? 'text-emerald-400'
                              : log.status === 'Duplicate'
                              ? 'text-amber-300'
                              : 'text-rose-400'
                          }`}
                        >
                          {log.status}
                        </span>
                        <span className="text-slate-600" aria-hidden="true">·</span>
                        <span
                          className={`font-mono ${
                            log.syncState === 'synced' ? 'text-indigo-300' : 'text-amber-300'
                          }`}
                        >
                          {log.syncState === 'synced' ? 'Synced' : 'Queued'}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Manual QR Payload / Admission Number Input */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <ScanLine className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleManualSubmit();
              }
            }}
            placeholder="Scan or enter Student ID, SRN, Roll #, or QR payload..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <button
          type="button"
          onClick={handleManualSubmit}
          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors shrink-0"
        >
          Scan In
        </button>
      </div>

      {/* Quick Tap Roster for Selected Class */}
      {classStudents.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-300 flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-emerald-400" />
              <span>Quick ID Check-In ({classStudents.length} Students)</span>
            </span>
            <span className="text-[11px] text-slate-400">
              {continuousScanning ? 'Continuous mode active' : 'Single-scan pause mode'}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
            {classStudents.map((st) => {
              const isPresent = draftStatus[st.id] === 'Present';
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => handleDecodedPayload(st.admissionNumber || st.id, 'Quick Tap')}
                  className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-colors ${
                    isPresent
                      ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
                      : 'bg-slate-800/80 border-slate-700 hover:border-indigo-400 text-white'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="font-bold text-xs truncate">{st.fullName}</div>
                    <div className="text-[10px] text-slate-400 font-mono tabular-nums">
                      Roll #{st.rollNumber} · {st.admissionNumber}
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${
                      isPresent ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    {isPresent ? 'Present' : 'Scan'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Session Scan Event Log */}
      {eventLog.length > 0 && (
        <div className="rounded-2xl bg-slate-950/70 border border-slate-800 p-3 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
            <span className="flex items-center gap-1.5">
              <ListChecks className="w-3.5 h-3.5 text-indigo-400" />
              <span>Scanner Event Log ({eventLog.length})</span>
            </span>
            <button
              type="button"
              onClick={() => setEventLog([])}
              className="text-slate-400 hover:text-white font-semibold"
            >
              Clear
            </button>
          </div>
          <div className="max-h-28 overflow-y-auto divide-y divide-slate-800/70 text-[11px]">
            {eventLog.map((ev) => (
              <div key={ev.id} className="py-1.5 flex items-center justify-between gap-2">
                <div className="min-w-0 truncate">
                  <span
                    className={`font-bold ${
                      ev.status === 'success'
                        ? 'text-emerald-300'
                        : ev.status === 'duplicate'
                        ? 'text-amber-300'
                        : 'text-rose-300'
                    }`}
                  >
                    {ev.studentName || ev.rawText.slice(0, 24)}
                  </span>
                  <span className="text-slate-400 ml-1.5">· {ev.message}</span>
                </div>
                <span className="text-slate-500 font-mono tabular-nums shrink-0">{ev.timestamp}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

