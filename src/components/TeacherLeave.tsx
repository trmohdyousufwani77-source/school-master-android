import React, { useState, useMemo, useRef } from 'react';
import {
  CalendarClock,
  Plus,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
  Printer,
  Clock,
  AlertCircle,
  User,
  ShieldCheck,
  X,
  FileText,
  TrendingUp,
  BarChart3,
  Sparkles,
  Fingerprint,
  Lock,
  Download,
  Search,
  Calendar,
  Eye,
  Edit2,
  Trash2,
  Upload,
  Paperclip,
  Stethoscope,
  ClipboardCheck,
  History,
  Bell,
  Check,
  AlertTriangle,
  FileCheck,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import {
  Holiday,
  LeaveStatus,
  LeaveType,
  SchoolProfile,
  TeacherLeaveApplication,
  TeacherLeaveDocument,
  TeacherProfile,
  User as UserType,
} from '../types';
import { Language, translations } from '../utils/translations';
import { exportTeacherLeaveStatementToExcel } from '../utils/excelExport';
import {
  computeInclusiveLeaveDays,
  computeMonthlyLeaveBreakdown,
  computeTeacherLeaveStats,
  findOverlappingLeave,
  generateTeacherLeaveStatementPdf,
} from '../utils/leaveStatementPdf';

interface TeacherLeaveProps {
  leaves: TeacherLeaveApplication[];
  teachers: TeacherProfile[];
  school: SchoolProfile;
  currentUser: UserType;
  onApplyLeave: (newLeave: TeacherLeaveApplication) => void;
  onUpdateLeave?: (updatedLeave: TeacherLeaveApplication) => void;
  onDeleteLeave?: (leaveId: string, deletionReason: string) => void;
  onMarkUnderReview?: (leaveId: string, remarks: string) => void;
  onApproveLeave: (leaveId: string, remarks: string) => void;
  onRejectLeave: (leaveId: string, rejectionReason: string, remarks?: string) => void;
  language: Language;
}

type TeacherNavTab =
  | 'apply-leave'
  | 'casual-leave'
  | 'medical-leave'
  | 'view-applications'
  | 'leave-status'
  | 'leave-statement'
  | 'leave-calendar';

type HeadmasterNavTab =
  | 'hm-review'
  | 'hm-approve'
  | 'hm-reject'
  | 'hm-all'
  | 'hm-records'
  | 'hm-reports'
  | 'hm-calendar'
  | 'hm-audit';

interface LeaveBalancePreview {
  balanceLabel: string;
  currentBalance: number;
  requestedDays: number;
  overlappingHolidays: Holiday[];
  sundayCount: number;
  deductibleDays: number;
  remainingAfterApproval: number;
  suggestion: 'Approve Recommended' | 'Holiday Overlap — Adjusted Deduction' | 'Insufficient Balance — Review';
  suggestedRemark: string;
}

function calculateLeaveBalancePreview(
  leave: TeacherLeaveApplication,
  teachers: TeacherProfile[],
  holidays: Holiday[]
): LeaveBalancePreview {
  const teacher =
    teachers.find((tc) => tc.employeeId === leave.employeeId || tc.name === leave.teacherName) || teachers[0];

  const start = new Date(`${leave.startDate}T00:00:00`);
  const end = new Date(`${leave.endDate}T00:00:00`);
  const holidayMap = new Map<string, Holiday>();
  holidays.forEach((h) => holidayMap.set(h.date, h));

  const overlappingHolidays: Holiday[] = [];
  let sundayCount = 0;
  let calendarDays = 0;

  if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end >= start) {
    const cursor = new Date(start);
    while (cursor <= end && calendarDays < 180) {
      calendarDays += 1;
      const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(
        cursor.getDate()
      ).padStart(2, '0')}`;
      const matchedHoliday = holidayMap.get(iso);
      if (matchedHoliday) {
        overlappingHolidays.push(matchedHoliday);
      } else if (cursor.getDay() === 0) {
        sundayCount += 1;
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  const requestedDays = calendarDays > 0 ? calendarDays : leave.totalDays;
  const nonWorkingOverlap = overlappingHolidays.length + sundayCount;
  const deductibleDays = Math.max(0, requestedDays - nonWorkingOverlap);

  let balanceLabel = 'Casual Leave (CL)';
  let currentBalance = teacher ? teacher.casualLeaveBalance : 10;

  if (leave.leaveType === 'Medical_Leave') {
    balanceLabel = 'Medical Leave (ML)';
    currentBalance = teacher ? teacher.medicalLeaveBalance : 10;
  } else if (leave.leaveType === 'Earned_Leave') {
    balanceLabel = 'Earned Leave (EL)';
    currentBalance = teacher ? teacher.earnedLeaveBalance : 20;
  } else if (leave.leaveType === 'Special_Duty') {
    balanceLabel = 'Official Duty (Non-Deductible)';
    currentBalance = 99;
  } else if (leave.leaveType === 'Maternity_Paternity') {
    balanceLabel = 'Special Statutory Leave';
    currentBalance = 30;
  }

  const effectiveDeduction = leave.leaveType === 'Special_Duty' ? 0 : deductibleDays;
  const remainingAfterApproval =
    leave.leaveType === 'Special_Duty' ? currentBalance : currentBalance - effectiveDeduction;

  if (remainingAfterApproval < 0) {
    return {
      balanceLabel,
      currentBalance,
      requestedDays,
      overlappingHolidays,
      sundayCount,
      deductibleDays: effectiveDeduction,
      remainingAfterApproval,
      suggestion: 'Insufficient Balance — Review',
      suggestedRemark: `Insufficient ${balanceLabel} balance (${currentBalance}d available vs ${effectiveDeduction}d required). Consider converting excess days to Leave Without Pay or adjusting dates.`,
    };
  }

  if (nonWorkingOverlap > 0) {
    const holidayNames = overlappingHolidays.map((h) => h.name).join(', ');
    return {
      balanceLabel,
      currentBalance,
      requestedDays,
      overlappingHolidays,
      sundayCount,
      deductibleDays: effectiveDeduction,
      remainingAfterApproval,
      suggestion: 'Holiday Overlap — Adjusted Deduction',
      suggestedRemark: `Approved with adjusted deduction of ${effectiveDeduction} working day(s) (${
        overlappingHolidays.length > 0 ? `excludes ${holidayNames}` : 'excludes Sunday'
      }). Projected remaining ${balanceLabel}: ${remainingAfterApproval} day(s).`,
    };
  }

  return {
    balanceLabel,
    currentBalance,
    requestedDays,
    overlappingHolidays,
    sundayCount,
    deductibleDays: effectiveDeduction,
    remainingAfterApproval,
    suggestion: 'Approve Recommended',
    suggestedRemark: `Approved (${effectiveDeduction} working day(s) deducted from ${balanceLabel}). Remaining balance: ${remainingAfterApproval} day(s).`,
  };
}

const STATUS_BADGE: Record<LeaveStatus, string> = {
  Pending: 'bg-amber-50 text-amber-800 border-amber-300',
  Under_Review: 'bg-sky-50 text-sky-800 border-sky-300',
  Approved: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  Rejected: 'bg-rose-50 text-rose-800 border-rose-300',
};

const STATUS_LABEL: Record<LeaveStatus, string> = {
  Pending: 'Pending',
  Under_Review: 'Under Review',
  Approved: 'Approved',
  Rejected: 'Rejected',
};

const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  Casual_Leave: 'Casual Leave (CL)',
  Medical_Leave: 'Medical Leave (ML)',
  Earned_Leave: 'Earned Leave (EL)',
  Special_Duty: 'Special Official Duty',
  Maternity_Paternity: 'Maternity / Paternity Leave',
};

const ALLOWED_DOC_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
const MAX_DOC_SIZE_BYTES = 4 * 1024 * 1024; // 4 MB

export const TeacherLeave: React.FC<TeacherLeaveProps> = ({
  leaves,
  teachers,
  school,
  currentUser,
  onApplyLeave,
  onUpdateLeave,
  onDeleteLeave,
  onMarkUnderReview,
  onApproveLeave,
  onRejectLeave,
  language,
}) => {
  const t = translations[language];
  const isHeadmasterRole = currentUser.role === 'admin' || currentUser.role === 'head_teacher';

  // Workspace Mode: Teachers ONLY see Teacher Dashboard; Headmaster/Admin defaults to Headmaster Dashboard
  const [workspaceMode, setWorkspaceMode] = useState<'teacher' | 'headmaster'>(
    isHeadmasterRole ? 'headmaster' : 'teacher'
  );
  const effectiveWorkspace: 'teacher' | 'headmaster' = isHeadmasterRole ? workspaceMode : 'teacher';

  const [teacherTab, setTeacherTab] = useState<TeacherNavTab>('apply-leave');
  const [headmasterTab, setHeadmasterTab] = useState<HeadmasterNavTab>('hm-review');

  // Identify current Teacher profile (for Teacher Dashboard)
  const matchedOwnTeacher = useMemo(() => {
    const byName = teachers.find(
      (tc) =>
        tc.name.trim().toLowerCase() === currentUser.name.trim().toLowerCase() ||
        currentUser.name.trim().toLowerCase().includes(tc.name.trim().toLowerCase())
    );
    return byName || teachers[0];
  }, [teachers, currentUser.name]);

  const [selectedTeacherProfileId, setSelectedTeacherProfileId] = useState<string>(
    matchedOwnTeacher?.id || teachers[0]?.id || ''
  );

  // Strict Teacher Isolation: Teacher role is strictly locked to their own profile
  const activeTeacher: TeacherProfile | undefined = useMemo(() => {
    if (!isHeadmasterRole) return matchedOwnTeacher;
    return teachers.find((tc) => tc.id === selectedTeacherProfileId) || matchedOwnTeacher;
  }, [isHeadmasterRole, matchedOwnTeacher, teachers, selectedTeacherProfileId]);

  // Toast feedback
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 4500);
  };

  // Search & filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [showDeletedInAll, setShowDeletedInAll] = useState<boolean>(false);

  // Statement Year & Month filters
  const currentYear = String(new Date().getFullYear());
  const availableYears = useMemo(() => {
    const set = new Set<string>([currentYear, '2026', '2025']);
    leaves.forEach((l) => {
      const yr = (l.startDate || l.applicationDate || '').slice(0, 4);
      if (/^\d{4}$/.test(yr)) set.add(yr);
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [leaves, currentYear]);
  const [statementYear, setStatementYear] = useState<string>(currentYear);
  const [statementMonth, setStatementMonth] = useState<string>('ALL');
  const [reportTeacherFilter, setReportTeacherFilter] = useState<string>('ALL');

  // Approved Leaves Monthly Calendar View State
  const [calendarMonthCursor, setCalendarMonthCursor] = useState<{ year: number; month: number }>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

  // Add / Edit Leave Form Modal State
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [editingLeave, setEditingLeave] = useState<TeacherLeaveApplication | null>(null);
  const [formLeaveType, setFormLeaveType] = useState<LeaveType>('Casual_Leave');
  const [formStartDate, setFormStartDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [formEndDate, setFormEndDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [formReason, setFormReason] = useState<string>('');
  const [formDocs, setFormDocs] = useState<TeacherLeaveDocument[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addMoreDocInputRef = useRef<HTMLInputElement>(null);
  const [uploadingMoreTargetId, setUploadingMoreTargetId] = useState<string | null>(null);

  // View / Delete / Document Preview / Headmaster Action Modals
  const [viewingLeave, setViewingLeave] = useState<TeacherLeaveApplication | null>(null);
  const [deletingLeave, setDeletingLeave] = useState<TeacherLeaveApplication | null>(null);
  const [deletionReason, setDeletionReason] = useState<string>('');
  const [previewDoc, setPreviewDoc] = useState<TeacherLeaveDocument | null>(null);

  // Headmaster Review / Approve / Reject Action State
  const [hmActionModal, setHmActionModal] = useState<{
    leave: TeacherLeaveApplication;
    mode: 'review' | 'approve' | 'reject';
  } | null>(null);
  const [hmRemarksInput, setHmRemarksInput] = useState<string>('');
  const [hmRejectionReasonInput, setHmRejectionReasonInput] = useState<string>('');
  const [hmActionError, setHmActionError] = useState<string | null>(null);

  // Preserved Biometric Authentication & Security Audit State
  const [mandatoryBiometricAuth, setMandatoryBiometricAuth] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('sm_teacher_leave_mandatory_biometric_v1');
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });
  const [biometricAuditLogs, setBiometricAuditLogs] = useState<
    Array<{
      id: string;
      timestampIso: string;
      actorName: string;
      eventType: 'SUCCESS' | 'FAILURE';
      authMethod: string;
      description: string;
    }>
  >(() => {
    try {
      const saved = localStorage.getItem('sm_teacher_leave_biometric_audit_v1');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    const now = Date.now();
    return [
      {
        id: 'AUD-INIT-1',
        timestampIso: new Date(now - 3600_000 * 4).toISOString(),
        actorName: school.headTeacherName || currentUser.name,
        eventType: 'SUCCESS',
        authMethod: 'Biometric Sensor',
        description: 'Verified Teacher Leave configuration and approval access',
      },
      {
        id: 'AUD-INIT-2',
        timestampIso: new Date(now - 86400_000 * 2).toISOString(),
        actorName: school.headTeacherName || currentUser.name,
        eventType: 'FAILURE',
        authMethod: 'Biometric Sensor',
        description: 'Biometric prompt cancelled during leave approval review',
      },
      {
        id: 'AUD-INIT-3',
        timestampIso: new Date(now - 86400_000 * 5).toISOString(),
        actorName: school.headTeacherName || currentUser.name,
        eventType: 'SUCCESS',
        authMethod: 'Device PIN / Pattern',
        description: 'Approved Casual Leave via Headmaster fallback verification',
      },
    ];
  });
  const [auditSearchQuery, setAuditSearchQuery] = useState<string>('');
  const [auditStartDate, setAuditStartDate] = useState<string>('');
  const [auditEndDate, setAuditEndDate] = useState<string>('');

  const appendBiometricAuditLog = (
    eventType: 'SUCCESS' | 'FAILURE',
    authMethod: string,
    description: string
  ) => {
    const newEntry = {
      id: `AUD-${Date.now()}`,
      timestampIso: new Date().toISOString(),
      actorName: currentUser.name,
      eventType,
      authMethod,
      description,
    };
    setBiometricAuditLogs((prev) => {
      const next = [newEntry, ...prev].slice(0, 100);
      try {
        localStorage.setItem('sm_teacher_leave_biometric_audit_v1', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleToggleBiometric = () => {
    const next = !mandatoryBiometricAuth;
    setMandatoryBiometricAuth(next);
    try {
      localStorage.setItem('sm_teacher_leave_mandatory_biometric_v1', String(next));
    } catch {
      // ignore
    }
    appendBiometricAuditLog(
      'SUCCESS',
      'Headmaster Settings',
      `${next ? 'Enabled' : 'Disabled'} Mandatory Biometric Authentication for Teacher Leave decisions`
    );
  };

  // Active vs Deleted leave splits
  const activeLeaves = useMemo(
    () => leaves.filter((l) => l.deletedStatus !== 'Deleted'),
    [leaves]
  );
  const deletedLeaves = useMemo(
    () => leaves.filter((l) => l.deletedStatus === 'Deleted'),
    [leaves]
  );

  // Own leaves for Teacher Dashboard (strict teacher ownership)
  const ownActiveLeaves = useMemo(() => {
    if (!activeTeacher) return [];
    const normEmp = (activeTeacher.employeeId || '').trim().toUpperCase();
    const normName = activeTeacher.name.trim().toLowerCase();
    return activeLeaves.filter(
      (l) =>
        l.teacherId === activeTeacher.id ||
        (l.employeeId || '').trim().toUpperCase() === normEmp ||
        l.teacherName.trim().toLowerCase() === normName
    );
  }, [activeLeaves, activeTeacher]);

  const ownCasualLeaves = useMemo(
    () => ownActiveLeaves.filter((l) => l.leaveType === 'Casual_Leave'),
    [ownActiveLeaves]
  );
  const ownMedicalLeaves = useMemo(
    () => ownActiveLeaves.filter((l) => l.leaveType === 'Medical_Leave'),
    [ownActiveLeaves]
  );

  // Recent Headmaster decisions for Teacher Notification Banner
  const ownRecentDecisions = useMemo(
    () =>
      ownActiveLeaves
        .filter((l) => l.status === 'Approved' || l.status === 'Rejected' || l.status === 'Under_Review')
        .slice(0, 3),
    [ownActiveLeaves]
  );

  // Pending / Under Review queues for Headmaster
  const hmPendingAndReviewLeaves = useMemo(
    () => activeLeaves.filter((l) => l.status === 'Pending' || l.status === 'Under_Review'),
    [activeLeaves]
  );

  // Helper: Get previous leave records for a teacher (for Headmaster Review)
  const getTeacherPreviousLeaves = (leave: TeacherLeaveApplication) => {
    const normEmp = (leave.employeeId || '').trim().toUpperCase();
    return activeLeaves.filter(
      (l) =>
        l.id !== leave.id &&
        ((l.employeeId || '').trim().toUpperCase() === normEmp ||
          l.teacherName.trim().toLowerCase() === leave.teacherName.trim().toLowerCase())
    );
  };

  // Filtered biometric audit logs (preserving existing Date-Range Picker feature)
  const filteredBiometricLogs = useMemo(() => {
    const q = auditSearchQuery.trim().toLowerCase();
    return biometricAuditLogs.filter((log) => {
      const logDate = log.timestampIso.slice(0, 10);
      if (auditStartDate && logDate < auditStartDate) return false;
      if (auditEndDate && logDate > auditEndDate) return false;
      if (q) {
        const hay = `${log.actorName} ${log.eventType} ${log.authMethod} ${log.description}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [biometricAuditLogs, auditSearchQuery, auditStartDate, auditEndDate]);

  // Combined Leave CRUD Audit Trail (all edits, reviews, approvals, rejections, deletions)
  const leaveCrudAuditEntries = useMemo(() => {
    const all = leaves.flatMap((l) =>
      (l.auditHistory || []).map((entry) => ({
        ...entry,
        teacherName: l.teacherName,
        employeeId: l.employeeId,
        leaveType: l.leaveType,
      }))
    );
    return all.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
  }, [leaves]);

  // =========================================================================
  // FORM HANDLERS (ADD / EDIT / UPLOAD MEDICAL DOCUMENTS / DELETE)
  // =========================================================================
  const openAddLeaveModal = (presetType: LeaveType) => {
    const today = new Date().toISOString().slice(0, 10);
    setEditingLeave(null);
    setFormLeaveType(presetType);
    setFormStartDate(today);
    setFormEndDate(today);
    setFormReason('');
    setFormDocs([]);
    setFormError(null);
    setIsFormModalOpen(true);
  };

  const openEditLeaveModal = (leave: TeacherLeaveApplication) => {
    if (leave.status === 'Approved' || leave.status === 'Rejected') {
      showToast('Approved or rejected leave applications are read-only and cannot be edited.', 'error');
      return;
    }
    if (leave.status !== 'Pending' && !isHeadmasterRole) {
      showToast('Only pending leave applications can be edited by teachers.', 'error');
      return;
    }
    setEditingLeave(leave);
    setFormLeaveType(leave.leaveType);
    setFormStartDate(leave.startDate);
    setFormEndDate(leave.endDate);
    setFormReason(leave.reason);
    setFormDocs(leave.medicalDocuments ? [...leave.medicalDocuments] : []);
    setFormError(null);
    setIsFormModalOpen(true);
  };

  const readFileAsLeaveDocument = (file: File): Promise<TeacherLeaveDocument> => {
    return new Promise((resolve, reject) => {
      if (!ALLOWED_DOC_TYPES.includes(file.type)) {
        reject(new Error(`Unsupported file "${file.name}". Please upload PDF, JPG, or PNG files only.`));
        return;
      }
      if (file.size > MAX_DOC_SIZE_BYTES) {
        reject(new Error(`File "${file.name}" exceeds the 4 MB limit.`));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          id: `DOC-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          dataUrl: String(reader.result || ''),
          uploadedAt: new Date().toISOString(),
          uploadedBy: activeTeacher?.name || currentUser.name,
        });
      };
      reader.onerror = () => reject(new Error(`Failed to read file "${file.name}".`));
      reader.readAsDataURL(file);
    });
  };

  const handleFormFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;
    setFormError(null);
    const added: TeacherLeaveDocument[] = [];
    for (const f of files) {
      try {
        const docItem = await readFileAsLeaveDocument(f);
        added.push(docItem);
      } catch (err) {
        setFormError(err instanceof Error ? err.message : 'Document upload failed.');
      }
    }
    if (added.length > 0) {
      setFormDocs((prev) => [...prev, ...added]);
    }
  };

  // Upload additional documents directly onto an existing pending/under-review Medical Leave
  const handleTriggerAdditionalDocUpload = (leave: TeacherLeaveApplication) => {
    if (leave.status === 'Approved' || leave.status === 'Rejected') {
      showToast('Cannot attach additional documents to finalized applications.', 'error');
      return;
    }
    setUploadingMoreTargetId(leave.id);
    addMoreDocInputRef.current?.click();
  };

  const handleAdditionalDocFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    const targetId = uploadingMoreTargetId;
    setUploadingMoreTargetId(null);
    if (!targetId || files.length === 0) return;

    const targetLeave = leaves.find((l) => l.id === targetId);
    if (!targetLeave || !onUpdateLeave) return;

    const newDocs: TeacherLeaveDocument[] = [];
    for (const f of files) {
      try {
        newDocs.push(await readFileAsLeaveDocument(f));
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Invalid file.', 'error');
      }
    }
    if (newDocs.length === 0) return;

    const mergedDocs = [...(targetLeave.medicalDocuments || []), ...newDocs];
    const nowIso = new Date().toISOString();
    const updated: TeacherLeaveApplication = {
      ...targetLeave,
      medicalDocuments: mergedDocs,
      supportingDocName: mergedDocs.map((d) => d.fileName).join(', '),
      medicalDocumentUrl: targetLeave.medicalDocumentUrl || mergedDocs[0]?.dataUrl,
      updatedAt: nowIso,
      auditHistory: [
        {
          id: `LAUD-${Date.now()}`,
          applicationId: targetLeave.id,
          action: 'UPLOAD_DOC',
          actorName: currentUser.name,
          actorRole: currentUser.role,
          timestamp: nowIso,
          summary: `Uploaded ${newDocs.length} additional medical document(s): ${newDocs.map((d) => d.fileName).join(', ')}`,
        },
        ...(targetLeave.auditHistory || []),
      ],
    };
    onUpdateLeave(updated);
    if (viewingLeave?.id === updated.id) setViewingLeave(updated);
    showToast(`Added ${newDocs.length} medical document(s) to application ${updated.id}.`);
  };

  const calculatedFormDays = useMemo(
    () => computeInclusiveLeaveDays(formStartDate, formEndDate),
    [formStartDate, formEndDate]
  );

  const handleSubmitLeaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!activeTeacher) {
      setFormError('No teacher profile selected.');
      return;
    }
    if (!formStartDate || !formEndDate) {
      setFormError('Please select both Leave Start Date and Leave End Date.');
      return;
    }
    if (formEndDate < formStartDate) {
      setFormError('Leave End Date cannot be earlier than Leave Start Date.');
      return;
    }
    const days = computeInclusiveLeaveDays(formStartDate, formEndDate);
    if (days <= 0) {
      setFormError('Total leave days must be at least 1.');
      return;
    }
    if (!formReason.trim() || formReason.trim().length < 4) {
      setFormError('Please enter a valid reason for leave (at least 4 characters).');
      return;
    }
    if (formLeaveType === 'Medical_Leave' && formDocs.length === 0) {
      setFormError('Please upload at least one Medical Document (PDF, JPG, or PNG) for Medical Leave.');
      return;
    }

    // Prevent duplicate / overlapping leave applications for the same teacher
    const empId = editingLeave ? editingLeave.employeeId : activeTeacher.employeeId;
    const overlap = findOverlappingLeave(leaves, empId, formStartDate, formEndDate, editingLeave?.id);
    if (overlap) {
      setFormError(
        `Duplicate / overlapping dates detected! You already have a ${LEAVE_TYPE_LABELS[overlap.leaveType]} application (${overlap.startDate} to ${overlap.endDate}, status: ${STATUS_LABEL[overlap.status]}).`
      );
      return;
    }

    const nowIso = new Date().toISOString();
    const todayIso = nowIso.slice(0, 10);

    if (editingLeave) {
      const updated: TeacherLeaveApplication = {
        ...editingLeave,
        leaveType: formLeaveType,
        startDate: formStartDate,
        endDate: formEndDate,
        totalDays: days,
        reason: formReason.trim(),
        medicalDocuments: formDocs,
        supportingDocName: formDocs.length > 0 ? formDocs.map((d) => d.fileName).join(', ') : editingLeave.supportingDocName,
        medicalDocumentUrl: formDocs[0]?.dataUrl || editingLeave.medicalDocumentUrl,
        updatedAt: nowIso,
        auditHistory: [
          {
            id: `LAUD-${Date.now()}`,
            applicationId: editingLeave.id,
            action: 'EDIT',
            actorName: currentUser.name,
            actorRole: currentUser.role,
            timestamp: nowIso,
            summary: `Edited ${LEAVE_TYPE_LABELS[formLeaveType]} (${formStartDate} to ${formEndDate}, ${days}d).`,
          },
          ...(editingLeave.auditHistory || []),
        ],
      };
      if (onUpdateLeave) {
        onUpdateLeave(updated);
      }
      setIsFormModalOpen(false);
      setEditingLeave(null);
      showToast(`Leave application ${updated.id} updated successfully.`);
    } else {
      const newId = `LV-${Date.now().toString().slice(-6)}`;
      const newApplication: TeacherLeaveApplication = {
        id: newId,
        teacherId: activeTeacher.id,
        employeeId: activeTeacher.employeeId,
        teacherName: activeTeacher.name,
        leaveType: formLeaveType,
        applicationDate: todayIso,
        startDate: formStartDate,
        endDate: formEndDate,
        totalDays: days,
        reason: formReason.trim(),
        medicalDocuments: formDocs,
        supportingDocName: formDocs.length > 0 ? formDocs.map((d) => d.fileName).join(', ') : undefined,
        medicalDocumentUrl: formDocs[0]?.dataUrl,
        status: 'Pending',
        createdAt: nowIso,
        updatedAt: nowIso,
        deletedStatus: 'Active',
        auditHistory: [
          {
            id: `LAUD-${Date.now()}`,
            applicationId: newId,
            action: 'CREATE',
            actorName: activeTeacher.name,
            actorRole: currentUser.role,
            timestamp: nowIso,
            summary: `Submitted ${LEAVE_TYPE_LABELS[formLeaveType]} (${formStartDate} to ${formEndDate}, ${days} day(s)).`,
          },
        ],
      };
      onApplyLeave(newApplication);
      setIsFormModalOpen(false);
      showToast(`${LEAVE_TYPE_LABELS[formLeaveType]} application (${newId}) submitted successfully!`);
    }
  };

  const handleConfirmDelete = () => {
    if (!deletingLeave) return;
    if (deletingLeave.status === 'Approved' || deletingLeave.status === 'Rejected') {
      showToast('Approved or rejected leave applications are read-only and cannot be deleted.', 'error');
      setDeletingLeave(null);
      return;
    }
    if (onDeleteLeave) {
      onDeleteLeave(deletingLeave.id, deletionReason.trim() || 'Deleted by teacher while pending');
    }
    showToast(`Leave application ${deletingLeave.id} deleted and archived in administrative audit log.`, 'info');
    setDeletingLeave(null);
    setDeletionReason('');
  };

  // =========================================================================
  // HEADMASTER REVIEW / APPROVE / REJECT HANDLERS
  // =========================================================================
  const openHeadmasterAction = (leave: TeacherLeaveApplication, mode: 'review' | 'approve' | 'reject') => {
    if (!isHeadmasterRole) {
      showToast('Only the Headmaster / Admin can review, approve, or reject leave applications.', 'error');
      return;
    }
    const preview = calculateLeaveBalancePreview(leave, teachers, school.holidays || []);
    setHmRemarksInput(
      mode === 'approve'
        ? leave.headmasterRemarks || preview.suggestedRemark
        : mode === 'review'
        ? leave.headmasterRemarks || 'Application and supporting records verified by Headmaster.'
        : ''
    );
    setHmRejectionReasonInput('');
    setHmActionError(null);
    setHmActionModal({ leave, mode });
  };

  const handleConfirmHeadmasterAction = () => {
    if (!hmActionModal) return;
    const { leave, mode } = hmActionModal;
    setHmActionError(null);

    if (mode === 'reject' && !hmRejectionReasonInput.trim()) {
      setHmActionError('Mandatory Rejection Reason is required before rejecting this leave application.');
      return;
    }

    if (mode === 'review') {
      if (onMarkUnderReview) {
        onMarkUnderReview(leave.id, hmRemarksInput.trim() || 'Marked Under Review by Headmaster.');
      }
      appendBiometricAuditLog(
        'SUCCESS',
        mandatoryBiometricAuth ? 'Biometric / Headmaster Verified' : 'Headmaster Desk',
        `Marked ${LEAVE_TYPE_LABELS[leave.leaveType]} (${leave.id}) for ${leave.teacherName} as Under Review.`
      );
      showToast(`Application ${leave.id} marked as Under Review.`);
    } else if (mode === 'approve') {
      onApproveLeave(leave.id, hmRemarksInput.trim() || 'Approved by Headmaster.');
      appendBiometricAuditLog(
        'SUCCESS',
        mandatoryBiometricAuth ? 'Biometric Sensor' : 'Headmaster Approval',
        `Approved ${LEAVE_TYPE_LABELS[leave.leaveType]} (${leave.id}) for ${leave.teacherName} (${leave.totalDays}d).`
      );
      showToast(`Approved ${leave.teacherName}'s ${LEAVE_TYPE_LABELS[leave.leaveType]} and notified teacher.`);
    } else if (mode === 'reject') {
      onRejectLeave(leave.id, hmRejectionReasonInput.trim(), hmRemarksInput.trim());
      appendBiometricAuditLog(
        'SUCCESS',
        mandatoryBiometricAuth ? 'Biometric Sensor' : 'Headmaster Rejection',
        `Rejected ${LEAVE_TYPE_LABELS[leave.leaveType]} (${leave.id}) for ${leave.teacherName}. Reason: ${hmRejectionReasonInput.trim()}`
      );
      showToast(`Rejected ${leave.teacherName}'s leave application and notified teacher.`, 'info');
    }

    setHmActionModal(null);
  };

  // Helper to download a single uploaded medical document
  const handleDownloadDocument = (docItem: TeacherLeaveDocument) => {
    if (!docItem.dataUrl) {
      showToast('Document binary not available locally.', 'error');
      return;
    }
    const link = document.createElement('a');
    link.href = docItem.dataUrl;
    link.download = docItem.fileName || 'medical-document';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered applications helper for tables
  const filterApplications = (source: TeacherLeaveApplication[], forcedType?: LeaveType) => {
    const q = searchQuery.trim().toLowerCase();
    return source.filter((l) => {
      if (forcedType && l.leaveType !== forcedType) return false;
      if (!forcedType && categoryFilter !== 'ALL' && l.leaveType !== categoryFilter) return false;
      if (statusFilter !== 'ALL' && l.status !== statusFilter) return false;
      if (q) {
        const hay = [
          l.id,
          l.teacherName,
          l.employeeId,
          LEAVE_TYPE_LABELS[l.leaveType],
          l.reason,
          l.status.replace(/_/g, ' '),
          l.startDate,
          l.endDate,
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  };

  // Teacher Statement Stats (Approved only counted in totals!)
  const ownStatementStats = useMemo(() => {
    if (!activeTeacher) return null;
    return computeTeacherLeaveStats(leaves, activeTeacher, statementYear);
  }, [leaves, activeTeacher, statementYear]);

  const ownMonthlyBreakdown = useMemo(() => {
    if (!activeTeacher) return [];
    return computeMonthlyLeaveBreakdown(leaves, statementYear, activeTeacher);
  }, [leaves, statementYear, activeTeacher]);

  const schoolReportSelectedTeacher = useMemo(
    () => (reportTeacherFilter === 'ALL' ? null : teachers.find((tc) => tc.id === reportTeacherFilter) || null),
    [reportTeacherFilter, teachers]
  );

  const schoolMonthlyBreakdown = useMemo(
    () => computeMonthlyLeaveBreakdown(leaves, statementYear, schoolReportSelectedTeacher || undefined),
    [leaves, statementYear, schoolReportSelectedTeacher]
  );

  // Chart data for Headmaster Teacher Leave Records
  const teacherBalanceChartData = useMemo(
    () =>
      teachers.map((tc) => {
        const stats = computeTeacherLeaveStats(leaves, tc, 'ALL');
        return {
          name: tc.name.split(' ').slice(0, 2).join(' '),
          'CL Taken': stats.casualLeaveTakenDays,
          'ML Taken': stats.medicalLeaveTakenDays,
          'CL Balance': tc.casualLeaveBalance,
          'ML Balance': tc.medicalLeaveBalance,
        };
      }),
    [teachers, leaves]
  );

  // Reusable Action Buttons Row for Teacher Applications (ADD / VIEW / EDIT / DELETE)
  const renderTeacherActionButtons = (leave: TeacherLeaveApplication) => {
    const isFinalized = leave.status === 'Approved' || leave.status === 'Rejected';
    const canModify = leave.status === 'Pending' && leave.deletedStatus !== 'Deleted';

    return (
      <div className="flex items-center justify-end gap-1 flex-wrap">
        <button
          type="button"
          onClick={() => setViewingLeave(leave)}
          className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold inline-flex items-center gap-1"
          title="View complete leave details"
        >
          <Eye className="w-3 h-3" /> VIEW
        </button>

        {leave.leaveType === 'Medical_Leave' && !isFinalized && (
          <button
            type="button"
            onClick={() => handleTriggerAdditionalDocUpload(leave)}
            className="px-2 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-[11px] font-bold inline-flex items-center gap-1"
            title="Upload additional medical document (PDF, JPG, PNG)"
          >
            <Upload className="w-3 h-3" /> +Doc
          </button>
        )}

        <button
          type="button"
          disabled={!canModify}
          onClick={() => openEditLeaveModal(leave)}
          className={`px-2 py-1 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 ${
            canModify
              ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
          title={isFinalized ? 'Read-only after approval/rejection' : 'Edit pending application'}
        >
          {isFinalized ? <Lock className="w-3 h-3" /> : <Edit2 className="w-3 h-3" />} EDIT
        </button>

        <button
          type="button"
          disabled={!canModify}
          onClick={() => {
            setDeletionReason('');
            setDeletingLeave(leave);
          }}
          className={`px-2 py-1 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 ${
            canModify
              ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
          title={isFinalized ? 'Read-only after approval/rejection' : 'Delete pending application'}
        >
          <Trash2 className="w-3 h-3" /> DELETE
        </button>
      </div>
    );
  };

  // =========================================================================
  // APPROVED LEAVES MONTHLY CALENDAR VIEW (TEACHER & HEADMASTER OVERLAP VIEW)
  // =========================================================================
  const approvedLeavesForCalendar = useMemo(
    () => activeLeaves.filter((l) => l.status === 'Approved'),
    [activeLeaves]
  );

  const calendarMonthData = useMemo(() => {
    const { year, month } = calendarMonthCursor;
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startWeekday = firstDay.getDay(); // 0=Sun..6=Sat
    const monthLabel = firstDay.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    const todayIso = new Date().toISOString().slice(0, 10);

    const cells: Array<{
      iso: string | null;
      dayNumber: number | null;
      isSunday: boolean;
      isToday: boolean;
      approvedOnDay: TeacherLeaveApplication[];
    }> = [];

    for (let i = 0; i < startWeekday; i++) {
      cells.push({ iso: null, dayNumber: null, isSunday: i === 0, isToday: false, approvedOnDay: [] });
    }

    let overlapDaysCount = 0;
    let maxConcurrentAway = 0;
    const uniqueLeaveIdsInMonth = new Set<string>();

    for (let day = 1; day <= daysInMonth; day++) {
      const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const weekday = new Date(year, month, day).getDay();
      const matched = approvedLeavesForCalendar.filter((l) => iso >= l.startDate && iso <= l.endDate);
      matched.forEach((l) => uniqueLeaveIdsInMonth.add(l.id));
      if (matched.length >= 2) overlapDaysCount += 1;
      if (matched.length > maxConcurrentAway) maxConcurrentAway = matched.length;
      cells.push({
        iso,
        dayNumber: day,
        isSunday: weekday === 0,
        isToday: iso === todayIso,
        approvedOnDay: matched,
      });
    }

    while (cells.length % 7 !== 0) {
      cells.push({ iso: null, dayNumber: null, isSunday: false, isToday: false, approvedOnDay: [] });
    }

    const selectedDayLeaves = approvedLeavesForCalendar.filter(
      (l) => selectedCalendarDate >= l.startDate && selectedCalendarDate <= l.endDate
    );

    return {
      monthLabel,
      cells,
      overlapDaysCount,
      maxConcurrentAway,
      approvedCountInMonth: uniqueLeaveIdsInMonth.size,
      selectedDayLeaves,
    };
  }, [calendarMonthCursor, approvedLeavesForCalendar, selectedCalendarDate]);

  const shiftCalendarMonth = (delta: number) => {
    setCalendarMonthCursor((prev) => {
      const d = new Date(prev.year, prev.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const renderApprovedLeavesCalendar = () => (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <span>Approved Staff Leave Calendar — {calendarMonthData.monthLabel}</span>
          </h2>
          <p className="text-xs text-slate-500">
            Displays all approved teacher leaves for the selected month so staff and the Headmaster can spot scheduling overlaps at a glance.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => shiftCalendarMonth(-1)}
            className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700"
          >
            ← Prev Month
          </button>
          <button
            type="button"
            onClick={() => {
              const now = new Date();
              setCalendarMonthCursor({ year: now.getFullYear(), month: now.getMonth() });
              setSelectedCalendarDate(now.toISOString().slice(0, 10));
            }}
            className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-extrabold"
          >
            Current Month
          </button>
          <button
            type="button"
            onClick={() => shiftCalendarMonth(1)}
            className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700"
          >
            Next Month →
          </button>
        </div>
      </div>

      {/* Calendar Overlap Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase text-emerald-700">Approved Leaves in Month</p>
            <p className="text-xl font-black text-emerald-950 font-mono">{calendarMonthData.approvedCountInMonth}</p>
          </div>
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
        </div>
        <div
          className={`p-3 rounded-xl border flex items-center justify-between ${
            calendarMonthData.overlapDaysCount > 0
              ? 'bg-amber-50 border-amber-300'
              : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div>
            <p className="text-[10px] font-bold uppercase text-amber-800">Staff Overlap Days (2+ Away)</p>
            <p className="text-xl font-black text-amber-950 font-mono">{calendarMonthData.overlapDaysCount}</p>
          </div>
          <AlertTriangle className="w-5 h-5 text-amber-600" />
        </div>
        <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase text-indigo-700">Peak Concurrent Staff Away</p>
            <p className="text-xl font-black text-indigo-950 font-mono">
              {calendarMonthData.maxConcurrentAway} / {teachers.length}
            </p>
          </div>
          <CalendarClock className="w-5 h-5 text-indigo-600" />
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-indigo-600" /> Casual Leave (CL)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-teal-600" /> Medical Leave (ML)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-purple-600" /> Other Approved Leave
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 border border-amber-600" /> Multi-Staff Overlap Day
        </span>
      </div>

      {/* Monthly Calendar Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[640px] border border-slate-200 rounded-2xl overflow-hidden">
          <div className="grid grid-cols-7 bg-slate-900 text-white text-[11px] font-extrabold uppercase text-center">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="py-2.5 border-r border-slate-800 last:border-r-0">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 divide-x divide-y divide-slate-200">
            {calendarMonthData.cells.map((cell, idx) => {
              if (!cell.iso || cell.dayNumber === null) {
                return <div key={`empty-${idx}`} className="min-h-[86px] bg-slate-50/70" />;
              }
              const isOverlap = cell.approvedOnDay.length >= 2;
              const isSelected = cell.iso === selectedCalendarDate;
              return (
                <button
                  key={cell.iso}
                  type="button"
                  onClick={() => setSelectedCalendarDate(cell.iso!)}
                  className={`min-h-[86px] p-1.5 text-left align-top transition-colors flex flex-col gap-1 ${
                    isSelected
                      ? 'bg-indigo-50/80 ring-2 ring-inset ring-indigo-500'
                      : isOverlap
                      ? 'bg-amber-50/60 hover:bg-amber-50'
                      : cell.isSunday
                      ? 'bg-slate-50/80 hover:bg-slate-100/80'
                      : 'bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span
                      className={`text-xs font-extrabold px-1.5 py-0.5 rounded-md ${
                        cell.isToday
                          ? 'bg-indigo-600 text-white'
                          : cell.isSunday
                          ? 'text-rose-600'
                          : 'text-slate-800'
                      }`}
                    >
                      {cell.dayNumber}
                    </span>
                    {isOverlap && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500 text-white text-[9px] font-black">
                        {cell.approvedOnDay.length} Away
                      </span>
                    )}
                  </div>
                  <div className="space-y-0.5 w-full">
                    {cell.approvedOnDay.slice(0, 3).map((leave) => (
                      <div
                        key={leave.id}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold truncate text-white ${
                          leave.leaveType === 'Casual_Leave'
                            ? 'bg-indigo-600'
                            : leave.leaveType === 'Medical_Leave'
                            ? 'bg-teal-600'
                            : 'bg-purple-600'
                        }`}
                        title={`${leave.teacherName} • ${LEAVE_TYPE_LABELS[leave.leaveType]} (${leave.startDate} to ${leave.endDate})`}
                      >
                        {leave.teacherName}
                      </div>
                    ))}
                    {cell.approvedOnDay.length > 3 && (
                      <div className="text-[9.5px] font-bold text-slate-600 px-1">
                        +{cell.approvedOnDay.length - 3} more
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected Day Inspection Panel */}
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
            Approved Leaves on {selectedCalendarDate}
          </h3>
          <span className="text-[11px] font-bold text-slate-600">
            {calendarMonthData.selectedDayLeaves.length === 0
              ? 'Full staff available (0 approved leaves)'
              : `${calendarMonthData.selectedDayLeaves.length} teacher(s) on approved leave`}
          </span>
        </div>
        {calendarMonthData.selectedDayLeaves.length === 0 ? (
          <p className="text-xs text-slate-500">
            No approved staff leaves scheduled for this date. Click any highlighted date in the calendar to inspect details.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {calendarMonthData.selectedDayLeaves.map((leave) => (
              <div
                key={leave.id}
                className="p-3 rounded-xl bg-white border border-slate-200 flex items-start justify-between gap-2"
              >
                <div>
                  <p className="text-xs font-extrabold text-slate-900">{leave.teacherName}</p>
                  <p className="text-[11px] font-bold text-indigo-700">
                    {LEAVE_TYPE_LABELS[leave.leaveType]} • {leave.startDate} → {leave.endDate} ({leave.totalDays}d)
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{leave.reason}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingLeave(leave)}
                  className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold shrink-0"
                >
                  VIEW
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-5 pb-12">
      {/* Hidden input for uploading additional medical docs onto existing Medical Leave applications */}
      <input
        ref={addMoreDocInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
        multiple
        className="hidden"
        onChange={handleAdditionalDocFileSelected}
      />

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-20 right-4 z-50 max-w-md px-4 py-3 rounded-2xl shadow-xl border text-xs font-bold flex items-center gap-2.5 ${
            toast.type === 'error'
              ? 'bg-rose-900 text-white border-rose-700'
              : toast.type === 'info'
              ? 'bg-slate-900 text-white border-slate-700'
              : 'bg-emerald-900 text-white border-emerald-700'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-300 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TOP HEADER BANNER & ROLE DASHBOARD SWITCHER                           */}
      {/* ===================================================================== */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-md border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-extrabold uppercase tracking-wider">
                TEACHER LEAVE STATEMENT
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 text-[10px] font-bold">
                {effectiveWorkspace === 'headmaster' ? 'Headmaster Approval & Audit Desk' : 'Teacher Self-Service Desk'}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight flex items-center gap-2.5">
              <CalendarClock className="w-6 h-6 text-amber-400 shrink-0" />
              <span>{t.teacherLeave || 'Teacher Leave Management & Statement'}</span>
            </h1>
            <p className="text-xs text-slate-300 max-w-2xl">
              {school.name} • Casual &amp; Medical Leave Applications, Document Uploads, 4-Stage Status Tracking,
              Headmaster Review / Approve / Reject Desks, and Year-Wise &amp; Monthly PDF Leave Statements.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isHeadmasterRole && (
              <div className="inline-flex rounded-2xl bg-slate-800/90 p-1 border border-slate-700">
                <button
                  type="button"
                  onClick={() => setWorkspaceMode('headmaster')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                    effectiveWorkspace === 'headmaster'
                      ? 'bg-amber-400 text-slate-950 shadow-sm'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Headmaster Dashboard</span>
                  {hmPendingAndReviewLeaves.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px]">
                      {hmPendingAndReviewLeaves.length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setWorkspaceMode('teacher')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                    effectiveWorkspace === 'teacher'
                      ? 'bg-indigo-500 text-white shadow-sm'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Teacher Dashboard</span>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => exportTeacherLeaveStatementToExcel(activeLeaves, teachers, school)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold shadow-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export Excel</span>
            </button>
            <button
              type="button"
              onClick={() =>
                generateTeacherLeaveStatementPdf({
                  school,
                  teachers,
                  leaves,
                  selectedTeacher: effectiveWorkspace === 'teacher' ? activeTeacher : schoolReportSelectedTeacher,
                  selectedYear: statementYear,
                  selectedMonth: statementMonth,
                  mode: 'download',
                })
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white text-slate-900 hover:bg-slate-100 text-xs font-extrabold shadow-xs"
            >
              <Download className="w-3.5 h-3.5 text-indigo-600" />
              <span>Statement PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TEACHER DASHBOARD MODE                                                */}
      {/* ===================================================================== */}
      {effectiveWorkspace === 'teacher' && activeTeacher && (
        <div className="space-y-5">
          {/* Teacher Profile Identity Bar (strictly own profile for Teacher role) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 font-black text-base">
                {activeTeacher.name.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-extrabold text-slate-900 flex items-center gap-2 flex-wrap">
                  <span>{activeTeacher.name}</span>
                  <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                    CPIS: {activeTeacher.employeeId}
                  </span>
                </p>
                <p className="text-xs text-slate-500">
                  {activeTeacher.designation} • CL Balance:{' '}
                  <strong className="text-indigo-700">{activeTeacher.casualLeaveBalance}d</strong> • ML Balance:{' '}
                  <strong className="text-emerald-700">{activeTeacher.medicalLeaveBalance}d</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {isHeadmasterRole && (
                <select
                  value={activeTeacher.id}
                  onChange={(e) => setSelectedTeacherProfileId(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold bg-slate-50"
                >
                  {teachers.map((tc) => (
                    <option key={tc.id} value={tc.id}>
                      Act as Teacher: {tc.name} ({tc.employeeId})
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                onClick={() => openAddLeaveModal('Casual_Leave')}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold"
              >
                <Plus className="w-3.5 h-3.5" /> ADD Casual Leave
              </button>
              <button
                type="button"
                onClick={() => openAddLeaveModal('Medical_Leave')}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold"
              >
                <Stethoscope className="w-3.5 h-3.5" /> ADD Medical Leave
              </button>
            </div>
          </div>

          {/* 7 Teacher Dashboard Columns / Navigation Tabs */}
          <div className="bg-white rounded-2xl border border-slate-200 p-2 shadow-xs flex items-center gap-1.5 overflow-x-auto">
            {[
              { id: 'apply-leave', label: '1. Teacher Apply Leave', icon: Plus },
              { id: 'casual-leave', label: `2. Casual Leave (${ownCasualLeaves.length})`, icon: Calendar },
              { id: 'medical-leave', label: `3. Medical Leave (${ownMedicalLeaves.length})`, icon: Stethoscope },
              { id: 'view-applications', label: `4. View Leave Applications (${ownActiveLeaves.length})`, icon: ClipboardCheck },
              { id: 'leave-status', label: '5. Leave Status', icon: Clock },
              { id: 'leave-statement', label: '6. Teacher Leave Statement', icon: FileText },
              { id: 'leave-calendar', label: '7. Leave Calendar', icon: CalendarClock },
            ].map((item) => {
              const Icon = item.icon;
              const active = teacherTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTeacherTab(item.id as TeacherNavTab)}
                  className={`px-3.5 py-2.5 rounded-xl text-xs font-extrabold whitespace-nowrap inline-flex items-center gap-1.5 transition-all ${
                    active
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Teacher Notification Alert for Headmaster Decisions */}
          {ownRecentDecisions.length > 0 && teacherTab === 'apply-leave' && (
            <div className="bg-white rounded-2xl border border-indigo-200 p-4 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                  <Bell className="w-4 h-4 text-indigo-600" />
                  <span>Recent Headmaster Leave Notifications</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setTeacherTab('leave-status')}
                  className="text-[11px] font-bold text-indigo-600 hover:underline"
                >
                  Track All Statuses →
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                {ownRecentDecisions.map((dec) => (
                  <div
                    key={dec.id}
                    className={`p-3 rounded-xl border text-xs space-y-1 ${
                      dec.status === 'Approved'
                        ? 'bg-emerald-50/70 border-emerald-200'
                        : dec.status === 'Rejected'
                        ? 'bg-rose-50/70 border-rose-200'
                        : 'bg-sky-50/70 border-sky-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-extrabold text-slate-900">{LEAVE_TYPE_LABELS[dec.leaveType]}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${STATUS_BADGE[dec.status]}`}>
                        {STATUS_LABEL[dec.status]}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      {dec.startDate} to {dec.endDate} ({dec.totalDays}d)
                    </p>
                    {dec.status === 'Rejected' && (dec.rejectionReason || dec.remarks) && (
                      <p className="text-[11px] font-bold text-rose-800">
                        Rejection Reason: {dec.rejectionReason || dec.remarks}
                      </p>
                    )}
                    {dec.status === 'Approved' && (dec.headmasterRemarks || dec.remarks) && (
                      <p className="text-[11px] font-semibold text-emerald-800">
                        Remarks: {dec.headmasterRemarks || dec.remarks}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TEACHER TAB 1: TEACHER APPLY LEAVE */}
          {teacherTab === 'apply-leave' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Casual Leave Column Card */}
              <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-11 h-11 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200 text-xs font-extrabold">
                      Balance: {activeTeacher.casualLeaveBalance} Days
                    </span>
                  </div>
                  <div>
                    <h2 className="text-lg font-extrabold text-slate-900">A. Casual Leave</h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Apply for Casual Leave with automatic day calculation. Edit or delete pending applications
                      anytime; finalized applications become read-only.
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                      <p className="text-[10px] font-bold text-amber-700 uppercase">Pending</p>
                      <p className="text-lg font-black text-amber-900">
                        {ownCasualLeaves.filter((l) => l.status === 'Pending').length}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                      <p className="text-[10px] font-bold text-emerald-700 uppercase">Approved</p>
                      <p className="text-lg font-black text-emerald-900">
                        {ownCasualLeaves.filter((l) => l.status === 'Approved').length}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200">
                      <p className="text-[10px] font-bold text-rose-700 uppercase">Rejected</p>
                      <p className="text-lg font-black text-rose-900">
                        {ownCasualLeaves.filter((l) => l.status === 'Rejected').length}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => openAddLeaveModal('Casual_Leave')}
                    className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" /> ADD Casual Leave
                  </button>
                  <button
                    type="button"
                    onClick={() => setTeacherTab('casual-leave')}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold"
                  >
                    Manage ({ownCasualLeaves.length})
                  </button>
                </div>
              </div>

              {/* Medical Leave Column Card */}
              <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-11 h-11 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center">
                      <Stethoscope className="w-5 h-5" />
                    </div>
                    <span className="px-3 py-1 rounded-full bg-teal-50 text-teal-800 border border-teal-200 text-xs font-extrabold">
                      Balance: {activeTeacher.medicalLeaveBalance} Days
                    </span>
                  </div>
                  <div>
                    <h2 className="text-lg font-extrabold text-slate-900">B. Medical Leave</h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Apply for Medical Leave with secure PDF, JPG, or PNG medical certificate uploads, document preview,
                      additional document attachments, and Under Review tracking.
                    </p>
                  </div>
                  <div className="grid grid-cols-4 gap-2 pt-1 text-center">
                    <div className="p-2 rounded-xl bg-amber-50 border border-amber-200">
                      <p className="text-[10px] font-bold text-amber-700 uppercase">Pending</p>
                      <p className="text-lg font-black text-amber-900">
                        {ownMedicalLeaves.filter((l) => l.status === 'Pending').length}
                      </p>
                    </div>
                    <div className="p-2 rounded-xl bg-sky-50 border border-sky-200">
                      <p className="text-[10px] font-bold text-sky-700 uppercase">Review</p>
                      <p className="text-lg font-black text-sky-900">
                        {ownMedicalLeaves.filter((l) => l.status === 'Under_Review').length}
                      </p>
                    </div>
                    <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200">
                      <p className="text-[10px] font-bold text-emerald-700 uppercase">Approved</p>
                      <p className="text-lg font-black text-emerald-900">
                        {ownMedicalLeaves.filter((l) => l.status === 'Approved').length}
                      </p>
                    </div>
                    <div className="p-2 rounded-xl bg-rose-50 border border-rose-200">
                      <p className="text-[10px] font-bold text-rose-700 uppercase">Rejected</p>
                      <p className="text-lg font-black text-rose-900">
                        {ownMedicalLeaves.filter((l) => l.status === 'Rejected').length}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => openAddLeaveModal('Medical_Leave')}
                    className="flex-1 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" /> ADD Medical Leave
                  </button>
                  <button
                    type="button"
                    onClick={() => setTeacherTab('medical-leave')}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold"
                  >
                    Manage ({ownMedicalLeaves.length})
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TEACHER TABS 2, 3, 4: CASUAL LEAVE / MEDICAL LEAVE / VIEW ALL MY APPLICATIONS */}
          {(teacherTab === 'casual-leave' ||
            teacherTab === 'medical-leave' ||
            teacherTab === 'view-applications') && (() => {
            const forcedType =
              teacherTab === 'casual-leave'
                ? 'Casual_Leave'
                : teacherTab === 'medical-leave'
                ? 'Medical_Leave'
                : undefined;
            const list = filterApplications(ownActiveLeaves, forcedType);

            return (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-slate-100 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-extrabold text-slate-900">
                        {teacherTab === 'casual-leave'
                          ? 'My Casual Leave Applications'
                          : teacherTab === 'medical-leave'
                          ? 'My Medical Leave Applications & Documents'
                          : 'All My Leave Applications'}{' '}
                        ({list.length})
                      </h2>
                      <p className="text-xs text-slate-500">
                        Pending applications can be edited or deleted. Approved &amp; Rejected records are read-only.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() =>
                          openAddLeaveModal(forcedType || 'Casual_Leave')
                        }
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold"
                      >
                        <Plus className="w-4 h-4" />
                        <span>
                          ADD {forcedType === 'Medical_Leave' ? 'Medical Leave' : forcedType === 'Casual_Leave' ? 'Casual Leave' : 'New Leave'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Search & Filter Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search ID, reason, dates..."
                        className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-300 text-xs"
                      />
                    </div>
                    {!forcedType && (
                      <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold bg-white"
                      >
                        <option value="ALL">All Leave Categories</option>
                        <option value="Casual_Leave">Casual Leave (CL)</option>
                        <option value="Medical_Leave">Medical Leave (ML)</option>
                        <option value="Earned_Leave">Earned Leave (EL)</option>
                        <option value="Special_Duty">Special Official Duty</option>
                      </select>
                    )}
                    <div className="flex items-center gap-1.5">
                      <label htmlFor="teacher-leave-status-filter" className="text-[11px] font-bold text-slate-600 whitespace-nowrap">
                        Status:
                      </label>
                      <select
                        id="teacher-leave-status-filter"
                        aria-label="Filter leave applications by status"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold bg-white"
                      >
                        <option value="ALL">All Statuses</option>
                        <option value="Pending">Pending</option>
                        <option value="Under_Review">Under Review</option>
                        <option value="Approved">Approved</option>
                        <option value="Rejected">Rejected</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px]">
                      <tr>
                        <th className="py-3 px-4">App ID &amp; Category</th>
                        <th className="py-3 px-4">From — To &amp; Days</th>
                        <th className="py-3 px-4">Reason &amp; Documents</th>
                        <th className="py-3 px-4">Status &amp; Remarks</th>
                        <th className="py-3 px-4 text-right">Actions (VIEW / EDIT / DELETE)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {list.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-10 text-center text-slate-500">
                            No leave applications found. Use the <strong>ADD</strong> button above to submit a new request.
                          </td>
                        </tr>
                      ) : (
                        list.map((leave) => (
                          <tr key={leave.id} className="hover:bg-slate-50/70">
                            <td className="py-3 px-4">
                              <p className="font-mono font-bold text-slate-900">{leave.id}</p>
                              <p className="font-bold text-indigo-700">{LEAVE_TYPE_LABELS[leave.leaveType]}</p>
                              <p className="text-[10.5px] text-slate-400">Applied: {leave.applicationDate}</p>
                            </td>
                            <td className="py-3 px-4">
                              <p className="font-bold text-slate-900">
                                {leave.startDate} → {leave.endDate}
                              </p>
                              <span className="inline-block mt-0.5 px-2 py-0.5 rounded bg-slate-100 font-extrabold text-slate-700 text-[10.5px]">
                                {leave.totalDays} Day(s)
                              </span>
                            </td>
                            <td className="py-3 px-4 max-w-xs">
                              <p className="text-slate-700 line-clamp-2">{leave.reason}</p>
                              {leave.medicalDocuments && leave.medicalDocuments.length > 0 ? (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {leave.medicalDocuments.map((docItem) => (
                                    <button
                                      key={docItem.id}
                                      type="button"
                                      onClick={() => setPreviewDoc(docItem)}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-[10px] font-bold"
                                    >
                                      <Paperclip className="w-2.5 h-2.5" />
                                      <span className="truncate max-w-[120px]">{docItem.fileName}</span>
                                    </button>
                                  ))}
                                </div>
                              ) : leave.supportingDocName ? (
                                <span className="inline-flex items-center gap-1 mt-1 text-[10.5px] text-teal-700 font-semibold">
                                  <Paperclip className="w-3 h-3" /> {leave.supportingDocName}
                                </span>
                              ) : null}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${STATUS_BADGE[leave.status]}`}
                              >
                                {STATUS_LABEL[leave.status]}
                              </span>
                              {leave.status === 'Rejected' && (leave.rejectionReason || leave.remarks) && (
                                <p className="text-[11px] font-bold text-rose-700 mt-1 max-w-[220px]">
                                  Reason: {leave.rejectionReason || leave.remarks}
                                </p>
                              )}
                              {leave.status !== 'Rejected' && (leave.headmasterRemarks || leave.remarks) && (
                                <p className="text-[11px] text-slate-600 mt-1 max-w-[220px]">
                                  HM: {leave.headmasterRemarks || leave.remarks}
                                </p>
                              )}
                            </td>
                            <td className="py-3 px-4">{renderTeacherActionButtons(leave)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* TEACHER TAB 5: LEAVE APPLICATION STATUS TRACKING */}
          {teacherTab === 'leave-status' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: '1. Pending', count: ownActiveLeaves.filter((l) => l.status === 'Pending').length, cls: 'bg-amber-50 border-amber-200 text-amber-900' },
                  { label: '2. Under Review', count: ownActiveLeaves.filter((l) => l.status === 'Under_Review').length, cls: 'bg-sky-50 border-sky-200 text-sky-900' },
                  { label: '3. Approved', count: ownActiveLeaves.filter((l) => l.status === 'Approved').length, cls: 'bg-emerald-50 border-emerald-200 text-emerald-900' },
                  { label: '4. Rejected', count: ownActiveLeaves.filter((l) => l.status === 'Rejected').length, cls: 'bg-rose-50 border-rose-200 text-rose-900' },
                ].map((box) => (
                  <div key={box.label} className={`p-4 rounded-2xl border ${box.cls}`}>
                    <p className="text-[11px] font-extrabold uppercase">{box.label}</p>
                    <p className="text-2xl font-black mt-1">{box.count}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                {ownActiveLeaves.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500">
                    No active leave applications to track.
                  </div>
                ) : (
                  ownActiveLeaves.map((leave) => {
                    const stepIndex =
                      leave.status === 'Pending'
                        ? 1
                        : leave.status === 'Under_Review'
                        ? 2
                        : 3;
                    return (
                      <div key={leave.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-extrabold text-slate-900">
                              {LEAVE_TYPE_LABELS[leave.leaveType]}{' '}
                              <span className="font-mono text-xs text-slate-500">({leave.id})</span>
                            </p>
                            <p className="text-xs text-slate-500">
                              {leave.startDate} to {leave.endDate} ({leave.totalDays} day(s)) • Applied on {leave.applicationDate}
                            </p>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-extrabold border self-start ${STATUS_BADGE[leave.status]}`}>
                            {STATUS_LABEL[leave.status]}
                          </span>
                        </div>

                        {/* 3-Step Visual Progress Bar */}
                        <div className="grid grid-cols-3 gap-2 text-[11px]">
                          <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 font-bold flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5 text-emerald-600" /> 1. Pending (Submitted)
                          </div>
                          <div
                            className={`p-2 rounded-xl border font-bold flex items-center gap-1.5 ${
                              stepIndex >= 2
                                ? 'bg-sky-50 border-sky-300 text-sky-900'
                                : 'bg-slate-50 border-slate-200 text-slate-400'
                            }`}
                          >
                            <Clock className="w-3.5 h-3.5" /> 2. Under Review
                          </div>
                          <div
                            className={`p-2 rounded-xl border font-bold flex items-center gap-1.5 ${
                              leave.status === 'Approved'
                                ? 'bg-emerald-100 border-emerald-400 text-emerald-950'
                                : leave.status === 'Rejected'
                                ? 'bg-rose-100 border-rose-400 text-rose-950'
                                : 'bg-slate-50 border-slate-200 text-slate-400'
                            }`}
                          >
                            {leave.status === 'Rejected' ? (
                              <XCircle className="w-3.5 h-3.5 text-rose-600" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            )}
                            <span>
                              3. {leave.status === 'Rejected' ? 'Rejected' : leave.status === 'Approved' ? 'Approved' : 'Final Decision'}
                            </span>
                          </div>
                        </div>

                        {leave.status === 'Rejected' && (
                          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900">
                            <p className="font-extrabold">Rejection Reason: {leave.rejectionReason || leave.remarks || 'Not specified'}</p>
                            {leave.headmasterRemarks && leave.headmasterRemarks !== leave.rejectionReason && (
                              <p className="text-[11px] text-rose-800 mt-0.5">Headmaster Remarks: {leave.headmasterRemarks}</p>
                            )}
                            <p className="text-[10.5px] text-rose-600 mt-1">
                              Decided by {leave.approvedBy || 'Headmaster'} on {leave.approvalDate || leave.decisionDate || '—'}
                            </p>
                          </div>
                        )}

                        {leave.status === 'Approved' && (
                          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
                            <p className="font-extrabold">Approved by {leave.approvedBy || 'Headmaster'} on {leave.approvalDate || leave.decisionDate || '—'}</p>
                            {(leave.headmasterRemarks || leave.remarks) && (
                              <p className="text-[11px] text-emerald-800 mt-0.5">Remarks: {leave.headmasterRemarks || leave.remarks}</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TEACHER TAB 6: TEACHER LEAVE STATEMENT (YEAR-WISE & MONTHLY + PDF DOWNLOAD/PRINT) */}
          {teacherTab === 'leave-statement' && ownStatementStats && (
            <div className="space-y-5">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900">
                      Official Teacher Leave Statement — {ownStatementStats.teacherName}
                    </h2>
                    <p className="text-xs text-slate-500">
                      Employee ID / CPIS: <strong className="font-mono text-emerald-700">{ownStatementStats.employeeId}</strong> • Only{' '}
                      <strong>APPROVED</strong> leave applications are counted in approved leave totals.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <select
                      value={statementYear}
                      onChange={(e) => setStatementYear(e.target.value)}
                      className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white"
                    >
                      <option value="ALL">All Years</option>
                      {availableYears.map((yr) => (
                        <option key={yr} value={yr}>
                          Year {yr}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() =>
                        generateTeacherLeaveStatementPdf({
                          school,
                          teachers,
                          leaves,
                          selectedTeacher: activeTeacher,
                          selectedYear: statementYear,
                          selectedMonth: 'ALL',
                          mode: 'download',
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold"
                    >
                      <Download className="w-3.5 h-3.5" /> Download PDF
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        generateTeacherLeaveStatementPdf({
                          school,
                          teachers,
                          leaves,
                          selectedTeacher: activeTeacher,
                          selectedYear: statementYear,
                          selectedMonth: 'ALL',
                          mode: 'print',
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-extrabold"
                    >
                      <Printer className="w-3.5 h-3.5" /> Print Statement
                    </button>
                  </div>
                </div>

                {/* Statement KPI Summary Grid */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200">
                    <p className="text-[10.5px] font-bold text-indigo-700 uppercase">Casual Leave Taken</p>
                    <p className="text-2xl font-black text-indigo-950 mt-1">{ownStatementStats.casualLeaveTakenDays}d</p>
                    <p className="text-[10px] text-indigo-700">Approved Only</p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-teal-50 border border-teal-200">
                    <p className="text-[10.5px] font-bold text-teal-700 uppercase">Medical Leave Taken</p>
                    <p className="text-2xl font-black text-teal-950 mt-1">{ownStatementStats.medicalLeaveTakenDays}d</p>
                    <p className="text-[10px] text-teal-700">Approved Only</p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300">
                    <p className="text-[10.5px] font-bold text-emerald-700 uppercase">Total Approved Days</p>
                    <p className="text-2xl font-black text-emerald-950 mt-1">{ownStatementStats.totalApprovedLeaveDays}d</p>
                    <p className="text-[10px] text-emerald-700">{ownStatementStats.approvedCount} Approved App(s)</p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200">
                    <p className="text-[10.5px] font-bold text-amber-800 uppercase">Pending / Review</p>
                    <p className="text-2xl font-black text-amber-950 mt-1">
                      {ownStatementStats.pendingCount + ownStatementStats.underReviewCount}
                    </p>
                    <p className="text-[10px] text-amber-700">Excluded from totals</p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200">
                    <p className="text-[10.5px] font-bold text-rose-700 uppercase">Rejected Apps</p>
                    <p className="text-2xl font-black text-rose-950 mt-1">{ownStatementStats.rejectedCount}</p>
                    <p className="text-[10px] text-rose-700">Excluded from totals</p>
                  </div>
                </div>

                {/* Monthly Leave Report Table */}
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px]">
                      <tr>
                        <th className="py-2.5 px-4">Month ({statementYear === 'ALL' ? 'All Years' : statementYear})</th>
                        <th className="py-2.5 px-4">Approved CL (d)</th>
                        <th className="py-2.5 px-4">Approved ML (d)</th>
                        <th className="py-2.5 px-4">Other Approved (d)</th>
                        <th className="py-2.5 px-4">Total Approved (d)</th>
                        <th className="py-2.5 px-4">Pending Apps</th>
                        <th className="py-2.5 px-4">Rejected Apps</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ownMonthlyBreakdown.map((m) => (
                        <tr key={m.monthLabel} className={m.totalApprovedDays > 0 ? 'bg-emerald-50/30' : ''}>
                          <td className="py-2 px-4 font-bold text-slate-900">{m.monthLabel}</td>
                          <td className="py-2 px-4 font-mono">{m.casualDays}</td>
                          <td className="py-2 px-4 font-mono">{m.medicalDays}</td>
                          <td className="py-2 px-4 font-mono">{m.otherDays}</td>
                          <td className="py-2 px-4 font-mono font-extrabold text-emerald-700">{m.totalApprovedDays}</td>
                          <td className="py-2 px-4 font-mono text-amber-700">{m.pendingApplications}</td>
                          <td className="py-2 px-4 font-mono text-rose-700">{m.rejectedApplications}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TEACHER COLUMN 7: APPROVED LEAVE CALENDAR */}
          {teacherTab === 'leave-calendar' && renderApprovedLeavesCalendar()}
        </div>
      )}

      {/* ===================================================================== */}
      {/* HEADMASTER DASHBOARD MODE (ROLE-PROTECTED)                            */}
      {/* ===================================================================== */}
      {effectiveWorkspace === 'headmaster' && isHeadmasterRole && (
        <div className="space-y-5">
          {/* 8 Headmaster Dashboard Columns / Tabs */}
          <div className="bg-white rounded-2xl border border-slate-200 p-2 shadow-xs flex items-center gap-1.5 overflow-x-auto">
            {[
              { id: 'hm-review', label: `1. Review Leave (${activeLeaves.length})`, icon: Eye },
              { id: 'hm-approve', label: `2. Approve Leave (${hmPendingAndReviewLeaves.length})`, icon: CheckCircle2 },
              { id: 'hm-reject', label: `3. Reject Leave (${hmPendingAndReviewLeaves.length})`, icon: XCircle },
              { id: 'hm-all', label: `4. All Leave Applications (${activeLeaves.length})`, icon: ClipboardCheck },
              { id: 'hm-records', label: '5. Teacher Leave Records', icon: BarChart3 },
              { id: 'hm-reports', label: '6. Leave Reports (PDF)', icon: FileText },
              { id: 'hm-calendar', label: '7. Leave Calendar', icon: CalendarClock },
              { id: 'hm-audit', label: '8. Security & Deletion Audit', icon: ShieldCheck },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = headmasterTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setHeadmasterTab(tab.id as HeadmasterNavTab)}
                  className={`px-3.5 py-2.5 rounded-xl text-xs font-extrabold whitespace-nowrap inline-flex items-center gap-1.5 transition-all ${
                    active
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* HEADMASTER KPI OVERVIEW */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-amber-200 bg-amber-50/30">
              <p className="text-[11px] font-bold text-amber-800 uppercase">Pending Applications</p>
              <p className="text-2xl font-black text-amber-900 mt-1">
                {activeLeaves.filter((l) => l.status === 'Pending').length}
              </p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-sky-200 bg-sky-50/30">
              <p className="text-[11px] font-bold text-sky-800 uppercase">Under Review</p>
              <p className="text-2xl font-black text-sky-900 mt-1">
                {activeLeaves.filter((l) => l.status === 'Under_Review').length}
              </p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-emerald-200 bg-emerald-50/30">
              <p className="text-[11px] font-bold text-emerald-800 uppercase">Approved</p>
              <p className="text-2xl font-black text-emerald-800 mt-1">
                {activeLeaves.filter((l) => l.status === 'Approved').length}
              </p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-rose-200 bg-rose-50/30">
              <p className="text-[11px] font-bold text-rose-800 uppercase">Rejected</p>
              <p className="text-2xl font-black text-rose-800 mt-1">
                {activeLeaves.filter((l) => l.status === 'Rejected').length}
              </p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200">
              <p className="text-[11px] font-bold text-slate-600 uppercase">Deleted (Audit)</p>
              <p className="text-2xl font-black text-slate-800 mt-1">{deletedLeaves.length}</p>
            </div>
          </div>

          {/* HEADMASTER COLUMN A: REVIEW LEAVE */}
          {headmasterTab === 'hm-review' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    A. REVIEW LEAVE — Verify Applications, Medical Documents &amp; Previous History
                  </h2>
                  <p className="text-xs text-slate-500">
                    Inspect teacher leave details, preview uploaded PDF/JPG/PNG medical certificates, check previous leave records, and mark Under Review or take action.
                  </p>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search teacher, CPIS, type..."
                    className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-300 text-xs"
                  />
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {filterApplications(activeLeaves).map((leave) => {
                  const prevLeaves = getTeacherPreviousLeaves(leave);
                  const prevApprovedDays = prevLeaves
                    .filter((p) => p.status === 'Approved')
                    .reduce((s, p) => s + p.totalDays, 0);
                  const preview = calculateLeaveBalancePreview(leave, teachers, school.holidays || []);

                  return (
                    <div key={leave.id} className="p-4 sm:p-5 space-y-3 hover:bg-slate-50/50">
                      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-sm text-slate-900">{leave.teacherName}</span>
                            <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold">
                              {leave.employeeId}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200 text-[10.5px] font-bold">
                              {LEAVE_TYPE_LABELS[leave.leaveType]}
                            </span>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${STATUS_BADGE[leave.status]}`}>
                              {STATUS_LABEL[leave.status]}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600">
                            <strong>Applied:</strong> {leave.applicationDate} • <strong>Dates:</strong> {leave.startDate} to {leave.endDate} ({leave.totalDays} day(s)) •{' '}
                            <strong>Previous Leave History:</strong> {prevLeaves.length} record(s), {prevApprovedDays} approved day(s)
                          </p>
                          <p className="text-xs text-slate-800 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                            <strong>Reason:</strong> {leave.reason}
                          </p>

                          {/* Uploaded Medical Documents */}
                          {(leave.medicalDocuments && leave.medicalDocuments.length > 0) || leave.supportingDocName ? (
                            <div className="flex items-center gap-2 flex-wrap pt-1">
                              <span className="text-[11px] font-extrabold text-teal-800">Medical Documents:</span>
                              {leave.medicalDocuments && leave.medicalDocuments.length > 0 ? (
                                leave.medicalDocuments.map((d) => (
                                  <button
                                    key={d.id}
                                    type="button"
                                    onClick={() => setPreviewDoc(d)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-[11px] font-bold"
                                  >
                                    <FileCheck className="w-3.5 h-3.5" /> View {d.fileName}
                                  </button>
                                ))
                              ) : (
                                <span className="text-[11px] text-teal-700 font-semibold">{leave.supportingDocName}</span>
                              )}
                            </div>
                          ) : null}

                          <p className="text-[11px] text-indigo-700 font-semibold">
                            Smart Balance Check ({preview.balanceLabel}): {preview.currentBalance}d available • Deductible: {preview.deductibleDays}d • Projected Remaining: {preview.remainingAfterApproval}d
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                          <button
                            type="button"
                            onClick={() => setViewingLeave(leave)}
                            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold inline-flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" /> Full Record &amp; History
                          </button>
                          {leave.status === 'Pending' && (
                            <button
                              type="button"
                              onClick={() => openHeadmasterAction(leave, 'review')}
                              className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-extrabold inline-flex items-center gap-1"
                            >
                              <Clock className="w-3.5 h-3.5" /> Mark Under Review
                            </button>
                          )}
                          {(leave.status === 'Pending' || leave.status === 'Under_Review') && (
                            <>
                              <button
                                type="button"
                                onClick={() => openHeadmasterAction(leave, 'approve')}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold inline-flex items-center gap-1"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" /> APPROVE
                              </button>
                              <button
                                type="button"
                                onClick={() => openHeadmasterAction(leave, 'reject')}
                                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold inline-flex items-center gap-1"
                              >
                                <XCircle className="w-3.5 h-3.5" /> REJECT
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* HEADMASTER COLUMN B: APPROVE LEAVE */}
          {headmasterTab === 'hm-approve' && (
            <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm overflow-hidden">
              <div className="p-4 sm:p-5 bg-emerald-50/70 border-b border-emerald-200">
                <h2 className="text-base font-extrabold text-emerald-950 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span>B. APPROVE LEAVE — Pending &amp; Under-Review Applications ({hmPendingAndReviewLeaves.length})</span>
                </h2>
                <p className="text-xs text-emerald-800 mt-0.5">
                  Approve Casual Leave or Medical Leave with Headmaster remarks. Approval date is saved automatically, status updates to APPROVED, and the teacher is notified.
                </p>
              </div>
              {hmPendingAndReviewLeaves.length === 0 ? (
                <div className="p-10 text-center text-xs text-slate-500">
                  All leave applications have been decided. No pending approvals remaining.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {hmPendingAndReviewLeaves.map((leave) => {
                    const preview = calculateLeaveBalancePreview(leave, teachers, school.holidays || []);
                    return (
                      <div key={leave.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-sm text-slate-900">{leave.teacherName}</span>
                            <span className="font-mono text-[11px] text-slate-500">{leave.employeeId}</span>
                            <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10.5px] font-bold">
                              {LEAVE_TYPE_LABELS[leave.leaveType]}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${STATUS_BADGE[leave.status]}`}>
                              {STATUS_LABEL[leave.status]}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600">
                            {leave.startDate} to {leave.endDate} ({leave.totalDays}d) • {leave.reason}
                          </p>
                          <p className="text-[11px] font-semibold text-emerald-700">
                            {preview.suggestion} — {preview.balanceLabel}: {preview.currentBalance}d → {preview.remainingAfterApproval}d
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setViewingLeave(leave)}
                            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold"
                          >
                            Check Details
                          </button>
                          <button
                            type="button"
                            onClick={() => openHeadmasterAction(leave, 'approve')}
                            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-sm"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Approve {leave.leaveType === 'Medical_Leave' ? 'Medical' : 'Casual'} Leave</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* HEADMASTER COLUMN C: REJECT LEAVE */}
          {headmasterTab === 'hm-reject' && (
            <div className="bg-white rounded-2xl border border-rose-200 shadow-sm overflow-hidden">
              <div className="p-4 sm:p-5 bg-rose-50/70 border-b border-rose-200">
                <h2 className="text-base font-extrabold text-rose-950 flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-rose-600" />
                  <span>C. REJECT LEAVE — Mandatory Rejection Reason &amp; Teacher Notification ({hmPendingAndReviewLeaves.length})</span>
                </h2>
                <p className="text-xs text-rose-800 mt-0.5">
                  Reject pending or under-review leave applications with a mandatory rejection reason. Rejection date is saved automatically, status becomes REJECTED, and the teacher can view the rejection reason.
                </p>
              </div>
              {hmPendingAndReviewLeaves.length === 0 ? (
                <div className="p-10 text-center text-xs text-slate-500">
                  No pending leave applications available to reject.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {hmPendingAndReviewLeaves.map((leave) => (
                    <div key={leave.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-sm text-slate-900">{leave.teacherName}</span>
                          <span className="font-mono text-[11px] text-slate-500">{leave.employeeId}</span>
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-[10.5px] font-bold">
                            {LEAVE_TYPE_LABELS[leave.leaveType]}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${STATUS_BADGE[leave.status]}`}>
                            {STATUS_LABEL[leave.status]}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600">
                          {leave.startDate} to {leave.endDate} ({leave.totalDays}d) • {leave.reason}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setViewingLeave(leave)}
                          className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold"
                        >
                          Inspect
                        </button>
                        <button
                          type="button"
                          onClick={() => openHeadmasterAction(leave, 'reject')}
                          className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-sm"
                        >
                          <XCircle className="w-4 h-4" />
                          <span>Reject with Reason</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* HEADMASTER COLUMN 4: ALL LEAVE APPLICATIONS (+ DELETED AUDIT TOGGLE) */}
          {headmasterTab === 'hm-all' && (() => {
            const source = showDeletedInAll ? leaves : activeLeaves;
            const list = filterApplications(source);
            return (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-slate-100 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <h2 className="text-base font-extrabold text-slate-900">
                      All Leave Applications ({list.length})
                    </h2>
                    <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showDeletedInAll}
                        onChange={(e) => setShowDeletedInAll(e.target.checked)}
                        className="rounded border-slate-300"
                      />
                      <span>Include Deleted Applications for Audit ({deletedLeaves.length})</span>
                    </label>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search teacher, CPIS, ID, reason..."
                        className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-300 text-xs"
                      />
                    </div>
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold bg-white"
                    >
                      <option value="ALL">All Categories</option>
                      <option value="Casual_Leave">Casual Leave</option>
                      <option value="Medical_Leave">Medical Leave</option>
                      <option value="Earned_Leave">Earned Leave</option>
                      <option value="Special_Duty">Special Official Duty</option>
                    </select>
                    <div className="flex items-center gap-1.5">
                      <label htmlFor="hm-leave-status-filter" className="text-[11px] font-bold text-slate-600 whitespace-nowrap">
                        Status:
                      </label>
                      <select
                        id="hm-leave-status-filter"
                        aria-label="Filter all leave applications by status"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold bg-white"
                      >
                        <option value="ALL">All Statuses</option>
                        <option value="Pending">Pending</option>
                        <option value="Under_Review">Under Review</option>
                        <option value="Approved">Approved</option>
                        <option value="Rejected">Rejected</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px]">
                      <tr>
                        <th className="py-3 px-4">Teacher &amp; CPIS</th>
                        <th className="py-3 px-4">Category &amp; Dates</th>
                        <th className="py-3 px-4">Status / Record State</th>
                        <th className="py-3 px-4">Decision &amp; Remarks</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {list.map((leave) => (
                        <tr
                          key={leave.id}
                          className={leave.deletedStatus === 'Deleted' ? 'bg-rose-50/40 opacity-80' : 'hover:bg-slate-50/70'}
                        >
                          <td className="py-3 px-4">
                            <p className="font-extrabold text-slate-900">{leave.teacherName}</p>
                            <p className="font-mono text-[11px] text-slate-500">{leave.employeeId} • {leave.id}</p>
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-bold text-indigo-700">{LEAVE_TYPE_LABELS[leave.leaveType]}</p>
                            <p className="text-[11px] text-slate-600">
                              {leave.startDate} → {leave.endDate} ({leave.totalDays}d)
                            </p>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${STATUS_BADGE[leave.status]}`}>
                                {STATUS_LABEL[leave.status]}
                              </span>
                              {leave.deletedStatus === 'Deleted' && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-800 text-white">
                                  DELETED AUDIT
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 max-w-xs">
                            {leave.deletedStatus === 'Deleted' ? (
                              <p className="text-[11px] text-rose-700 font-semibold">
                                Deleted by {leave.deletedBy || 'Teacher'}: {leave.deletionReason || 'Withdrawn'}
                              </p>
                            ) : leave.status === 'Rejected' ? (
                              <p className="text-[11px] text-rose-700 font-bold">
                                Rejected: {leave.rejectionReason || leave.remarks || '—'}
                              </p>
                            ) : (
                              <p className="text-[11px] text-slate-600">
                                {leave.headmasterRemarks || leave.remarks || leave.reason.slice(0, 60)}
                              </p>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => setViewingLeave(leave)}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold inline-flex items-center gap-1"
                              >
                                <Eye className="w-3 h-3" /> VIEW
                              </button>
                              {leave.deletedStatus !== 'Deleted' &&
                                (leave.status === 'Pending' || leave.status === 'Under_Review') && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => openHeadmasterAction(leave, 'approve')}
                                      className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => openHeadmasterAction(leave, 'reject')}
                                      className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold"
                                    >
                                      Reject
                                    </button>
                                  </>
                                )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* HEADMASTER COLUMN 5: TEACHER LEAVE RECORDS & ANALYTICS */}
          {headmasterTab === 'hm-records' && (
            <div className="space-y-5">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <h2 className="text-base font-extrabold text-slate-900 mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-indigo-600" />
                  <span>Teacher-Wise Approved Leave Utilization &amp; Balances</span>
                </h2>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={teacherBalanceChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="CL Taken" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="ML Taken" fill="#0d9488" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="CL Balance" fill="#a5b4fc" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px]">
                      <tr>
                        <th className="py-3 px-4">Teacher Name &amp; CPIS</th>
                        <th className="py-3 px-4">Approved CL Taken</th>
                        <th className="py-3 px-4">Approved ML Taken</th>
                        <th className="py-3 px-4">Total Approved Days</th>
                        <th className="py-3 px-4">Pending / Review</th>
                        <th className="py-3 px-4">Rejected</th>
                        <th className="py-3 px-4">Remaining CL / ML</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {teachers.map((tc) => {
                        const s = computeTeacherLeaveStats(leaves, tc, 'ALL');
                        return (
                          <tr key={tc.id} className="hover:bg-slate-50/70">
                            <td className="py-3 px-4">
                              <p className="font-extrabold text-slate-900">{tc.name}</p>
                              <p className="font-mono text-[11px] text-emerald-700 font-bold">{tc.employeeId}</p>
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-indigo-700">{s.casualLeaveTakenDays}d</td>
                            <td className="py-3 px-4 font-mono font-bold text-teal-700">{s.medicalLeaveTakenDays}d</td>
                            <td className="py-3 px-4 font-mono font-extrabold text-emerald-700">{s.totalApprovedLeaveDays}d</td>
                            <td className="py-3 px-4 font-mono text-amber-700">{s.pendingCount + s.underReviewCount}</td>
                            <td className="py-3 px-4 font-mono text-rose-700">{s.rejectedCount}</td>
                            <td className="py-3 px-4 font-mono text-slate-700">
                              CL: {tc.casualLeaveBalance}d • ML: {tc.medicalLeaveBalance}d
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* HEADMASTER COLUMN 6: LEAVE REPORTS (YEAR-WISE & MONTHLY PDF / PRINT / EXCEL) */}
          {headmasterTab === 'hm-reports' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    School &amp; Teacher Leave Statement Reports (Approved Totals Only)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Generate Year-wise or Monthly Leave Statements per teacher or for the entire school in PDF, Print, or Excel format.
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={reportTeacherFilter}
                    onChange={(e) => setReportTeacherFilter(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white"
                  >
                    <option value="ALL">All Teachers</option>
                    {teachers.map((tc) => (
                      <option key={tc.id} value={tc.id}>
                        {tc.name} ({tc.employeeId})
                      </option>
                    ))}
                  </select>
                  <select
                    value={statementYear}
                    onChange={(e) => setStatementYear(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white"
                  >
                    <option value="ALL">All Years</option>
                    {availableYears.map((yr) => (
                      <option key={yr} value={yr}>
                        Year {yr}
                      </option>
                    ))}
                  </select>
                  <select
                    value={statementMonth}
                    onChange={(e) => setStatementMonth(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white"
                  >
                    <option value="ALL">All Months</option>
                    {['01','02','03','04','05','06','07','08','09','10','11','12'].map((m, idx) => (
                      <option key={m} value={m}>
                        {new Date(2026, idx, 1).toLocaleString('en-US', { month: 'long' })}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      generateTeacherLeaveStatementPdf({
                        school,
                        teachers,
                        leaves,
                        selectedTeacher: schoolReportSelectedTeacher,
                        selectedYear: statementYear,
                        selectedMonth: statementMonth,
                        mode: 'download',
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold"
                  >
                    <Download className="w-3.5 h-3.5" /> Download PDF
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      generateTeacherLeaveStatementPdf({
                        school,
                        teachers,
                        leaves,
                        selectedTeacher: schoolReportSelectedTeacher,
                        selectedYear: statementYear,
                        selectedMonth: statementMonth,
                        mode: 'print',
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-extrabold"
                  >
                    <Printer className="w-3.5 h-3.5" /> Print PDF
                  </button>
                </div>
              </div>

              {/* Recharts Bar Chart: Casual Leave vs Medical Leave Usage per Month */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <BarChart3 className="w-4 h-4 text-indigo-600" />
                      <span>
                        Monthly Leave Usage Trend: Casual Leave vs Medical Leave ({statementYear === 'ALL' ? 'All Years' : statementYear})
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Visualizes approved Casual Leave and Medical Leave days across each month of the academic year.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-bold">
                    <span className="px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-800 border border-indigo-200">
                      Total CL: {schoolMonthlyBreakdown.reduce((sum, r) => sum + r.casualDays, 0)}d
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-teal-100 text-teal-800 border border-teal-200">
                      Total ML: {schoolMonthlyBreakdown.reduce((sum, r) => sum + r.medicalDays, 0)}d
                    </span>
                  </div>
                </div>
                <div className="h-[270px] w-full bg-white rounded-xl border border-slate-200 p-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={schoolMonthlyBreakdown.map((row) => ({
                        month: row.monthLabel.slice(0, 3),
                        fullMonth: row.monthLabel,
                        'Casual Leave': row.casualDays,
                        'Medical Leave': row.medicalDays,
                      }))}
                      margin={{ top: 10, right: 16, left: 0, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#475569' }} unit="d" />
                      <Tooltip
                        contentStyle={{
                          borderRadius: '12px',
                          borderColor: '#cbd5e1',
                          fontSize: '12px',
                          fontWeight: 600,
                        }}
                        labelFormatter={(_label, payload) =>
                          payload?.[0]?.payload?.fullMonth || String(_label)
                        }
                      />
                      <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 700 }} />
                      <Bar dataKey="Casual Leave" fill="#4f46e5" radius={[6, 6, 0, 0]} maxBarSize={28} />
                      <Bar dataKey="Medical Leave" fill="#0d9488" radius={[6, 6, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-4">Month ({statementYear === 'ALL' ? 'All Years' : statementYear})</th>
                      <th className="py-2.5 px-4">Approved CL (d)</th>
                      <th className="py-2.5 px-4">Approved ML (d)</th>
                      <th className="py-2.5 px-4">Other Approved (d)</th>
                      <th className="py-2.5 px-4">Total Approved (d)</th>
                      <th className="py-2.5 px-4">Pending</th>
                      <th className="py-2.5 px-4">Rejected</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {schoolMonthlyBreakdown.map((row) => (
                      <tr key={row.monthLabel} className={row.totalApprovedDays > 0 ? 'bg-emerald-50/30' : ''}>
                        <td className="py-2 px-4 font-bold text-slate-900">{row.monthLabel}</td>
                        <td className="py-2 px-4 font-mono">{row.casualDays}</td>
                        <td className="py-2 px-4 font-mono">{row.medicalDays}</td>
                        <td className="py-2 px-4 font-mono">{row.otherDays}</td>
                        <td className="py-2 px-4 font-mono font-extrabold text-emerald-700">{row.totalApprovedDays}</td>
                        <td className="py-2 px-4 font-mono text-amber-700">{row.pendingApplications}</td>
                        <td className="py-2 px-4 font-mono text-rose-700">{row.rejectedApplications}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* HEADMASTER COLUMN 7: APPROVED LEAVES CALENDAR VIEW */}
          {headmasterTab === 'hm-calendar' && renderApprovedLeavesCalendar()}

          {/* HEADMASTER COLUMN 8: SECURITY AUDIT (BIOMETRIC DATE-RANGE PICKER + LEAVE AUDIT LOG) */}
          {headmasterTab === 'hm-audit' && (
            <div className="space-y-5">
              {/* Preserved Biometric Audit with Date-Range Picker */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                      <Fingerprint className="w-5 h-5 text-indigo-600" />
                      <span>Biometric Security Audit &amp; Date-Range Filter</span>
                    </h2>
                    <p className="text-xs text-slate-500">
                      Filter Headmaster biometric authentication attempts by start and end date for institutional audit.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleBiometric}
                    className={`px-3.5 py-2 rounded-xl text-xs font-extrabold border inline-flex items-center gap-1.5 ${
                      mandatoryBiometricAuth
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : 'bg-slate-100 text-slate-700 border-slate-300'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Biometric Guard: {mandatoryBiometricAuth ? 'ON' : 'OFF'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={auditSearchQuery}
                      onChange={(e) => setAuditSearchQuery(e.target.value)}
                      placeholder="Search actor, method, outcome..."
                      className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">From:</span>
                    <input
                      type="date"
                      value={auditStartDate}
                      onChange={(e) => setAuditStartDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">To:</span>
                    <input
                      type="date"
                      value={auditEndDate}
                      onChange={(e) => setAuditEndDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px]">
                      <tr>
                        <th className="py-2.5 px-4">Timestamp</th>
                        <th className="py-2.5 px-4">Actor</th>
                        <th className="py-2.5 px-4">Outcome</th>
                        <th className="py-2.5 px-4">Auth Method</th>
                        <th className="py-2.5 px-4">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredBiometricLogs.map((log) => (
                        <tr key={log.id}>
                          <td className="py-2 px-4 font-mono text-[11px] text-slate-600">
                            {new Date(log.timestampIso).toLocaleString()}
                          </td>
                          <td className="py-2 px-4 font-bold text-slate-900">{log.actorName}</td>
                          <td className="py-2 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                log.eventType === 'SUCCESS'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                            >
                              {log.eventType}
                            </span>
                          </td>
                          <td className="py-2 px-4 text-slate-700">{log.authMethod}</td>
                          <td className="py-2 px-4 text-slate-600">{log.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Leave Edits, Approvals, Rejections & Deleted Applications Audit Trail */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <History className="w-4 h-4 text-indigo-600" />
                  <span>Leave Application Audit Trail (Edits, Approvals, Rejections &amp; Deletions)</span>
                </h3>
                {leaveCrudAuditEntries.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    New creations, edits, reviews, approvals, rejections, and deletions will appear here automatically.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                    {leaveCrudAuditEntries.slice(0, 40).map((entry) => (
                      <div key={entry.id} className="p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-mono text-[10px] font-bold mr-2">
                            {entry.action}
                          </span>
                          <span className="font-bold text-slate-900">{entry.teacherName}</span>{' '}
                          <span className="text-slate-500">({entry.applicationId})</span>
                          <p className="text-slate-600 mt-0.5">{entry.summary}</p>
                        </div>
                        <div className="text-[11px] text-slate-500 sm:text-right shrink-0">
                          <p className="font-semibold text-slate-700">{entry.actorName}</p>
                          <p className="font-mono">{new Date(entry.timestamp).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 1: ADD / EDIT LEAVE APPLICATION (CASUAL & MEDICAL LEAVE)        */}
      {/* ===================================================================== */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
            <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <CalendarClock className="w-5 h-5 text-amber-400" />
                <span className="font-extrabold text-sm">
                  {editingLeave
                    ? `Edit Leave Application (${editingLeave.id})`
                    : `Apply for ${LEAVE_TYPE_LABELS[formLeaveType]}`}
                </span>
              </div>
              <button type="button" onClick={() => setIsFormModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400 hover:text-white" />
              </button>
            </div>

            <form onSubmit={handleSubmitLeaveForm} className="p-5 space-y-4 text-xs">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 font-bold flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">Leave Category *</label>
                <select
                  value={formLeaveType}
                  onChange={(e) => setFormLeaveType(e.target.value as LeaveType)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-bold bg-white"
                >
                  <option value="Casual_Leave">Casual Leave (CL)</option>
                  <option value="Medical_Leave">Medical Leave (ML)</option>
                  <option value="Earned_Leave">Earned Leave (EL)</option>
                  <option value="Special_Duty">Special Official Duty</option>
                  <option value="Maternity_Paternity">Maternity / Paternity Leave</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Leave Start Date *</label>
                  <input
                    type="date"
                    value={formStartDate}
                    onChange={(e) => {
                      setFormStartDate(e.target.value);
                      if (e.target.value > formEndDate) setFormEndDate(e.target.value);
                    }}
                    required
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Leave End Date *</label>
                  <input
                    type="date"
                    value={formEndDate}
                    min={formStartDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Total Leave Days</label>
                  <div className="px-3 py-2.5 rounded-xl bg-indigo-50 border border-indigo-200 font-mono font-black text-indigo-800 text-sm">
                    {calculatedFormDays} Day(s)
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {formLeaveType === 'Medical_Leave' ? 'Medical Leave Reason *' : 'Reason for Leave *'}
                </label>
                <textarea
                  rows={3}
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  required
                  placeholder={
                    formLeaveType === 'Medical_Leave'
                      ? 'Describe medical condition, doctor recommendation, or hospital recovery period...'
                      : 'Enter clear reason for requesting Casual Leave...'
                  }
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300"
                />
              </div>

              {/* Medical Document Upload (Required for Medical Leave, optional for others) */}
              <div className="p-4 rounded-2xl bg-teal-50/60 border border-teal-200 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-extrabold text-teal-950">
                      Medical / Supporting Documents {formLeaveType === 'Medical_Leave' ? '(Required)' : '(Optional)'}
                    </p>
                    <p className="text-[11px] text-teal-700">
                      Accepted formats: PDF, JPG, PNG (max 4 MB per file). Multiple documents supported.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold inline-flex items-center gap-1.5 shrink-0"
                  >
                    <Upload className="w-3.5 h-3.5" /> Upload File
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                    multiple
                    className="hidden"
                    onChange={handleFormFileUpload}
                  />
                </div>

                {formDocs.length > 0 && (
                  <div className="space-y-1.5">
                    {formDocs.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white border border-teal-200"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Paperclip className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                          <span className="font-bold text-slate-800 truncate">{d.fileName}</span>
                          <span className="text-[10px] text-slate-400">
                            ({Math.max(1, Math.round(d.sizeBytes / 1024))} KB)
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => setPreviewDoc(d)}
                            className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10.5px]"
                          >
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormDocs((prev) => prev.filter((item) => item.id !== d.id))}
                            className="p-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold shadow-sm"
                >
                  {editingLeave ? 'Save Changes' : 'Submit Leave Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: VIEW COMPLETE LEAVE APPLICATION DETAILS + PREVIOUS HISTORY   */}
      {/* ===================================================================== */}
      {viewingLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
            <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between sticky top-0 z-10">
              <div>
                <p className="font-extrabold text-sm">Leave Application Details — {viewingLeave.id}</p>
                <p className="text-[11px] text-slate-300">
                  {viewingLeave.teacherName} ({viewingLeave.employeeId})
                </p>
              </div>
              <button type="button" onClick={() => setViewingLeave(null)}>
                <X className="w-5 h-5 text-slate-400 hover:text-white" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Leave Category</span>
                  <p className="font-extrabold text-slate-900 mt-0.5">{LEAVE_TYPE_LABELS[viewingLeave.leaveType]}</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Status</span>
                  <p className="mt-1">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${STATUS_BADGE[viewingLeave.status]}`}>
                      {STATUS_LABEL[viewingLeave.status]}
                    </span>
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Total Leave Days</span>
                  <p className="font-mono font-black text-indigo-700 text-sm mt-0.5">{viewingLeave.totalDays} Day(s)</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">From Date</span>
                  <p className="font-bold text-slate-900 mt-0.5">{viewingLeave.startDate}</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">To Date</span>
                  <p className="font-bold text-slate-900 mt-0.5">{viewingLeave.endDate}</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Application Date</span>
                  <p className="font-bold text-slate-900 mt-0.5">{viewingLeave.applicationDate}</p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Leave Reason</p>
                <p className="text-slate-800 mt-1 leading-relaxed">{viewingLeave.reason}</p>
              </div>

              {viewingLeave.status === 'Rejected' && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 space-y-1">
                  <p className="font-extrabold">Rejection Reason: {viewingLeave.rejectionReason || viewingLeave.remarks || '—'}</p>
                  <p className="text-[11px]">
                    Rejected by: <strong>{viewingLeave.approvedBy || 'Headmaster'}</strong> on{' '}
                    <strong>{viewingLeave.approvalDate || viewingLeave.decisionDate || '—'}</strong>
                  </p>
                </div>
              )}

              {(viewingLeave.headmasterRemarks || viewingLeave.remarks) && viewingLeave.status !== 'Rejected' && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-1">
                  <p className="font-extrabold">Headmaster Remarks</p>
                  <p>{viewingLeave.headmasterRemarks || viewingLeave.remarks}</p>
                  {viewingLeave.approvedBy && (
                    <p className="text-[11px] text-emerald-700">
                      Decided by {viewingLeave.approvedBy} on {viewingLeave.approvalDate || viewingLeave.decisionDate || '—'}
                    </p>
                  )}
                </div>
              )}

              {/* Uploaded Medical Documents List */}
              {viewingLeave.medicalDocuments && viewingLeave.medicalDocuments.length > 0 && (
                <div className="space-y-2">
                  <p className="font-extrabold text-slate-900">Uploaded Medical Documents ({viewingLeave.medicalDocuments.length})</p>
                  <div className="space-y-1.5">
                    {viewingLeave.medicalDocuments.map((d) => (
                      <div key={d.id} className="flex items-center justify-between p-2.5 rounded-xl bg-teal-50 border border-teal-200">
                        <span className="font-bold text-teal-950 truncate">{d.fileName}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => setPreviewDoc(d)}
                            className="px-2.5 py-1 rounded-lg bg-teal-600 text-white font-bold text-[11px]"
                          >
                            Preview
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadDocument(d)}
                            className="px-2.5 py-1 rounded-lg bg-white border border-teal-300 text-teal-900 font-bold text-[11px]"
                          >
                            Download
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Previous Leave Records for this Teacher (especially helpful for Headmaster review) */}
              {isHeadmasterRole && (
                <div className="space-y-1.5">
                  <p className="font-extrabold text-slate-900">
                    Previous Leave Records for {viewingLeave.teacherName} ({getTeacherPreviousLeaves(viewingLeave).length})
                  </p>
                  {getTeacherPreviousLeaves(viewingLeave).length === 0 ? (
                    <p className="text-slate-500 text-[11px]">No prior leave applications recorded.</p>
                  ) : (
                    <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-36 overflow-y-auto">
                      {getTeacherPreviousLeaves(viewingLeave).map((prev) => (
                        <div key={prev.id} className="p-2.5 flex items-center justify-between gap-2 text-[11px]">
                          <span>
                            <strong>{LEAVE_TYPE_LABELS[prev.leaveType]}</strong> ({prev.startDate} → {prev.endDate}, {prev.totalDays}d)
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${STATUS_BADGE[prev.status]}`}>
                            {STATUS_LABEL[prev.status]}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Audit History */}
              {viewingLeave.auditHistory && viewingLeave.auditHistory.length > 0 && (
                <div className="space-y-1.5">
                  <p className="font-extrabold text-slate-900">Application Audit History</p>
                  <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-36 overflow-y-auto">
                    {viewingLeave.auditHistory.map((h) => (
                      <div key={h.id} className="p-2.5 text-[11px] flex justify-between gap-2">
                        <span>
                          <strong className="font-mono text-indigo-700">[{h.action}]</strong> {h.summary}
                        </span>
                        <span className="text-slate-400 shrink-0">{new Date(h.timestamp).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 3: DELETE CONFIRMATION MODAL (AUDIT SOFT-DELETE)                */}
      {/* ===================================================================== */}
      {deletingLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200">
            <div className="p-4 bg-rose-700 text-white flex items-center justify-between">
              <span className="font-extrabold text-sm flex items-center gap-2">
                <Trash2 className="w-4 h-4" /> Confirm Delete Leave Application
              </span>
              <button type="button" onClick={() => setDeletingLeave(null)}>
                <X className="w-4 h-4 text-rose-200" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs">
              <p className="text-slate-700">
                Are you sure you want to delete your pending <strong>{LEAVE_TYPE_LABELS[deletingLeave.leaveType]}</strong>{' '}
                application ({deletingLeave.startDate} to {deletingLeave.endDate}, {deletingLeave.totalDays}d)?
              </p>
              <p className="text-[11px] text-slate-500">
                A record of this deleted application will be preserved in the administrative audit log.
              </p>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Reason for Deletion (Optional)</label>
                <input
                  type="text"
                  value={deletionReason}
                  onChange={(e) => setDeletionReason(e.target.value)}
                  placeholder="e.g. Dates changed, leave no longer required..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingLeave(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 font-bold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold"
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 4: HEADMASTER REVIEW / APPROVE / REJECT ACTION MODAL            */}
      {/* ===================================================================== */}
      {hmActionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200">
            <div
              className={`p-4 text-white flex items-center justify-between ${
                hmActionModal.mode === 'approve'
                  ? 'bg-emerald-700'
                  : hmActionModal.mode === 'reject'
                  ? 'bg-rose-700'
                  : 'bg-sky-700'
              }`}
            >
              <span className="font-extrabold text-sm">
                {hmActionModal.mode === 'approve'
                  ? 'Headmaster: Approve Leave Application'
                  : hmActionModal.mode === 'reject'
                  ? 'Headmaster: Reject Leave Application'
                  : 'Headmaster: Mark Application Under Review'}
              </span>
              <button type="button" onClick={() => setHmActionModal(null)}>
                <X className="w-4 h-4 text-white/80" />
              </button>
            </div>
            <div className="p-5 space-y-3.5 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <p className="font-extrabold text-slate-900">
                  {hmActionModal.leave.teacherName} ({hmActionModal.leave.employeeId})
                </p>
                <p className="text-slate-600">
                  {LEAVE_TYPE_LABELS[hmActionModal.leave.leaveType]} • {hmActionModal.leave.startDate} to{' '}
                  {hmActionModal.leave.endDate} ({hmActionModal.leave.totalDays} day(s))
                </p>
                <p className="text-slate-700">Reason: {hmActionModal.leave.reason}</p>
              </div>

              {hmActionError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 font-bold">
                  {hmActionError}
                </div>
              )}

              {hmActionModal.mode === 'reject' && (
                <div>
                  <label className="block font-extrabold text-rose-900 mb-1">
                    Mandatory Rejection Reason *
                  </label>
                  <textarea
                    rows={2}
                    value={hmRejectionReasonInput}
                    onChange={(e) => setHmRejectionReasonInput(e.target.value)}
                    placeholder="Enter mandatory reason for rejecting this leave application (visible to teacher)..."
                    className="w-full px-3 py-2 rounded-xl border border-rose-300 focus:border-rose-500 outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Headmaster {hmActionModal.mode === 'reject' ? 'Additional Remarks (Optional)' : 'Remarks'}
                </label>
                <textarea
                  rows={3}
                  value={hmRemarksInput}
                  onChange={(e) => setHmRemarksInput(e.target.value)}
                  placeholder="Enter official Headmaster remarks..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <p className="text-[11px] text-slate-500">
                Action Date: <strong>{new Date().toISOString().slice(0, 10)}</strong> • Actor:{' '}
                <strong>{currentUser.name}</strong> • Concerned teacher will be notified immediately.
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setHmActionModal(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 font-bold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmHeadmasterAction}
                  className={`px-4 py-2 rounded-xl text-white font-extrabold ${
                    hmActionModal.mode === 'approve'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : hmActionModal.mode === 'reject'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-sky-600 hover:bg-sky-700'
                  }`}
                >
                  {hmActionModal.mode === 'approve'
                    ? 'Confirm Approve'
                    : hmActionModal.mode === 'reject'
                    ? 'Confirm Reject'
                    : 'Save Under Review'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 5: MEDICAL DOCUMENT INLINE VIEWER (PDF / JPG / PNG)             */}
      {/* ===================================================================== */}
      {previewDoc && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-2xl border border-slate-200 flex flex-col">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="truncate">
                <p className="font-extrabold text-sm truncate">{previewDoc.fileName}</p>
                <p className="text-[11px] text-slate-300">
                  Uploaded by {previewDoc.uploadedBy} • {Math.max(1, Math.round(previewDoc.sizeBytes / 1024))} KB
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleDownloadDocument(previewDoc)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold inline-flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" /> Download
                </button>
                <button type="button" onClick={() => setPreviewDoc(null)}>
                  <X className="w-5 h-5 text-slate-300 hover:text-white" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-slate-100 flex items-center justify-center min-h-[360px]">
              {previewDoc.mimeType.startsWith('image/') ? (
                <img
                  src={previewDoc.dataUrl}
                  alt={previewDoc.fileName}
                  className="max-w-full max-h-[70vh] object-contain rounded-xl shadow-md bg-white"
                />
              ) : previewDoc.mimeType === 'application/pdf' ? (
                <iframe
                  src={previewDoc.dataUrl}
                  title={previewDoc.fileName}
                  className="w-full h-[70vh] rounded-xl bg-white border border-slate-200"
                />
              ) : (
                <div className="text-center text-xs text-slate-600 space-y-2">
                  <FileText className="w-10 h-10 text-slate-400 mx-auto" />
                  <p>Preview unavailable for this file format. Click Download above to view locally.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
