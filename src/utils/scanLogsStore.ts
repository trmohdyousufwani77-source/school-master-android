import { AttendanceRecord, Student } from '../types';

export type ScanLogStatus = 'Present' | 'Duplicate' | 'Unrecognized';
export type ScanLogSource = 'QR Camera' | 'Manual Entry' | 'Quick Tap' | 'Imported Record';

export interface PersistentScanLogEntry {
  id: string;
  date: string; // YYYY-MM-DD
  timestamp: string; // Human-readable local time
  isoTimestamp: string; // ISO-8601 sort key
  studentId: string;
  admissionNumber: string;
  studentName: string;
  rollNumber: number;
  classNumber: string;
  section: string;
  status: ScanLogStatus;
  source: ScanLogSource;
  rawPayload: string;
  syncState: 'synced' | 'queued';
}

export interface ScanLogFilterOptions {
  searchQuery?: string;
  classFilter?: string; // 'all' or classNumber like '5'
  sectionFilter?: string; // 'all' or 'A'
  dateFrom?: string;
  dateTo?: string;
  statusFilter?: 'all' | ScanLogStatus;
}

const STORAGE_KEY = 'sm_persistent_scan_logs_v1';
const IDB_NAME = 'school_master_scan_logs_db';
const IDB_STORE = 'scan_logs';
const MAX_STORED_LOGS = 2000;

function openScanLogsIdb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function writeLogsToIdb(entries: PersistentScanLogEntry[]): Promise<void> {
  const db = await openScanLogsIdb();
  if (!db) return;
  try {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    entries.forEach((entry) => {
      store.put(entry);
    });
  } catch {
    // Fallback to localStorage already persisted synchronously
  }
}

export async function hydrateScanLogsFromIdb(): Promise<PersistentScanLogEntry[]> {
  const local = loadPersistentScanLogs();
  const db = await openScanLogsIdb();
  if (!db) return local;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const idbLogs = Array.isArray(req.result) ? (req.result as PersistentScanLogEntry[]) : [];
        if (idbLogs.length === 0) {
          resolve(local);
          return;
        }
        const merged = mergeScanLogs(local, idbLogs);
        saveScanLogsToStorage(merged);
        resolve(merged);
      };
      req.onerror = () => resolve(local);
    } catch {
      resolve(local);
    }
  });
}

function saveScanLogsToStorage(logs: PersistentScanLogEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(logs.slice(0, MAX_STORED_LOGS)));
  } catch {
    // Ignore quota failures
  }
}

export function mergeScanLogs(
  primary: PersistentScanLogEntry[],
  secondary: PersistentScanLogEntry[]
): PersistentScanLogEntry[] {
  const byId = new Map<string, PersistentScanLogEntry>();
  [...secondary, ...primary].forEach((item) => {
    if (item && item.id) {
      byId.set(item.id, item);
    }
  });
  return Array.from(byId.values())
    .sort((a, b) => (b.isoTimestamp || b.date).localeCompare(a.isoTimestamp || a.date))
    .slice(0, MAX_STORED_LOGS);
}

export function loadPersistentScanLogs(): PersistentScanLogEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PersistentScanLogEntry[]) : [];
  } catch {
    return [];
  }
}

export function appendPersistentScanLog(
  entry: PersistentScanLogEntry
): PersistentScanLogEntry[] {
  const existing = loadPersistentScanLogs();
  const next = mergeScanLogs([entry], existing);
  saveScanLogsToStorage(next);
  void writeLogsToIdb([entry]);
  return next;
}

export function markScanLogsSynced(studentDatePairs: Array<{ studentId: string; date: string }>): PersistentScanLogEntry[] {
  const existing = loadPersistentScanLogs();
  const keySet = new Set(studentDatePairs.map((p) => `${p.studentId}::${p.date}`));
  const updated = existing.map((log) =>
    keySet.has(`${log.studentId}::${log.date}`) ? { ...log, syncState: 'synced' as const } : log
  );
  saveScanLogsToStorage(updated);
  void writeLogsToIdb(updated.filter((log) => keySet.has(`${log.studentId}::${log.date}`)));
  return updated;
}

export function seedScanLogsFromAttendanceRecords(
  records: AttendanceRecord[],
  students: Student[]
): PersistentScanLogEntry[] {
  const existing = loadPersistentScanLogs();
  if (records.length === 0) return existing;

  const studentById = new Map<string, Student>();
  students.forEach((s) => studentById.set(s.id, s));

  const seeded: PersistentScanLogEntry[] = records
    .filter((r) => r.status === 'Present' || r.status === 'Late')
    .map((r) => {
      const stu = studentById.get(r.studentId);
      const isoTs = r.markedAt || `${r.date}T09:15:00.000Z`;
      const dt = new Date(isoTs);
      const timeLabel = !Number.isNaN(dt.getTime())
        ? dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '09:15 AM';
      return {
        id: `hist-att-${r.id}`,
        date: r.date,
        timestamp: timeLabel,
        isoTimestamp: isoTs,
        studentId: r.studentId,
        admissionNumber: stu?.admissionNumber || r.studentId,
        studentName: stu?.fullName || r.studentId,
        rollNumber: stu?.rollNumber ?? 0,
        classNumber: r.classNumber,
        section: r.section,
        status: 'Present' as const,
        source: 'Imported Record' as const,
        rawPayload: stu?.admissionNumber || r.studentId,
        syncState: r.isOfflineSynced === false ? ('synced' as const) : ('synced' as const),
      };
    });

  // Preserve any user-recorded logs with priority while backfilling unrecorded historical attendance
  const existingIds = new Set(existing.map((l) => l.id));
  const missingSeeded = seeded.filter((s) => !existingIds.has(s.id));
  if (missingSeeded.length === 0) return existing;

  const merged = mergeScanLogs(existing, missingSeeded);
  saveScanLogsToStorage(merged);
  return merged;
}

export function clearPersistentScanLogs(): PersistentScanLogEntry[] {
  saveScanLogsToStorage([]);
  void openScanLogsIdb().then((db) => {
    if (!db) return;
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).clear();
    } catch {
      // ignore
    }
  });
  return [];
}

export function filterPersistentScanLogs(
  logs: PersistentScanLogEntry[],
  options: ScanLogFilterOptions
): PersistentScanLogEntry[] {
  const q = (options.searchQuery || '').trim().toLowerCase();
  const cls = options.classFilter || 'all';
  const sec = options.sectionFilter || 'all';
  const from = options.dateFrom || '';
  const to = options.dateTo || '';
  const status = options.statusFilter || 'all';

  return logs.filter((log) => {
    if (cls !== 'all' && log.classNumber !== cls) return false;
    if (sec !== 'all' && log.section !== sec) return false;
    if (status !== 'all' && log.status !== status) return false;
    if (from && log.date < from) return false;
    if (to && log.date > to) return false;
    if (q) {
      const hay = `${log.studentName} ${log.admissionNumber} ${log.studentId} ${log.rawPayload} class ${log.classNumber}-${log.section}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
