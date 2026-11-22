import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Award,
  FileText,
  Plus,
  Edit2,
  Trash2,
  Eye,
  Download,
  Printer,
  Share2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Search,
  Building2,
  UserCheck,
  BookOpen,
  Calendar,
  Upload,
  History,
  Send,
  Save,
  RotateCcw,
  FileSpreadsheet,
  HelpCircle,
  Lock,
  KeyRound,
  X,
  ClipboardList,
  RefreshCw,
  Check,
  ArrowRight,
  Paperclip,
  Briefcase,
  LayoutDashboard,
} from 'lucide-react';
import {
  CpisCodeMigrationRecord,
  JkepmAppraisalStatus,
  JkepmAssignmentCategory,
  JkepmAttendanceLeaveSummary,
  JkepmAuditLogEntry,
  JkepmClassTeachingDetail,
  JkepmLeaveCategory,
  JkepmLeaveEntry,
  JkepmQuarter,
  JkepmQuarterlyAppraisalReport,
  JkepmSchoolAssignment,
  JkepmSupportingDocument,
  SchoolProfile,
  TeacherProfile,
  User,
} from '../types';
import { Language } from '../utils/translations';
import { formatSchoolAddressOnce } from '../utils/calculations';
import {
  buildInitialCpisMigrations,
  buildInitialJkepmAuditLogs,
  buildInitialJkepmReports,
  exportJkepmConsolidatedExcel,
  exportTeacherJkepmExcel,
  generateConsolidatedJkepmPdf,
  generateJkepmAppraisalPdf,
  JKEPM_QUARTERS,
  NEW_CPIS_CODE_OFFICIAL,
  normalizeCpisCode,
  OLD_CPIS_CODE_LEGACY,
  QUARTER_REPORTING_PERIODS,
  recalculateAttendanceLeaveSummary,
  validateJkepmAttendanceAndLeave,
} from '../utils/jkepmReportExport';
import {
  deleteJkepmSubmissionFromFirestore,
  syncCpisMigrationToFirestore,
  syncJkepmSubmissionToFirestore,
} from '../firebase';

const STORAGE_REPORTS_KEY = 'sm_jkepm_appraisal_reports_v2';
const STORAGE_CPIS_KEY = 'sm_jkepm_cpis_migrations_v2';
const STORAGE_AUDIT_KEY = 'sm_jkepm_audit_logs_v2';
const STORAGE_FORM_AUTOSAVE_KEY = 'sm_jkepm_form_autosave_v1';

const ASSIGNMENT_CATEGORIES: JkepmAssignmentCategory[] = [
  'School Timetable & Teaching Schedule',
  'Morning Assembly Duties',
  'Examination Duties',
  'Evaluation & Answer Script Checking',
  'Mid-Day Meal (MDM) Duties',
  'School Administrative Assignments',
  'Co-Curricular Activities',
  'Sports & Cultural Activities',
  'Election / Official Government Duties',
  'Additional Responsibility (HOI Assigned)',
];

const CLASS_OPTIONS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

type PortalSection =
  | 'home'
  | 'profile-cpis'
  | 'assessment-form'
  | 'submitted-reports'
  | 'hoi-dashboard'
  | 'district-dashboard'
  | 'help';

type FormStepTab = 'teacher-info' | 'part-a-teaching' | 'part-b-assignments' | 'part-c-attendance';

interface JkepmAppraisalPortalProps {
  school: SchoolProfile;
  teachers: TeacherProfile[];
  currentUser: User;
  effectiveRole: string;
  language: Language;
  onUpdateTeacher: (updated: TeacherProfile) => void;
}

const createEmptyAttendanceLeave = (): JkepmAttendanceLeaveSummary => ({
  totalWorkingDays: 72,
  totalDaysAttended: 70,
  casualLeaves: 2,
  medicalLeaves: 0,
  earnedLeaves: 0,
  otherLeaves: 0,
  totalLeaveDays: 2,
  attendancePercentage: 97.2,
  leavePeriodFrom: '',
  leavePeriodTo: '',
  medicalSanctionOrderNumber: '',
  medicalSanctionOrderDate: '',
  casualSanctionOrderNumber: '',
  remarks: '',
  leaveRecords: [],
  supportingDocuments: [],
});

const statusBadgeStyles: Record<JkepmAppraisalStatus, string> = {
  Draft: 'bg-slate-100 text-slate-700 border-slate-300',
  Submitted: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  Returned_For_Correction: 'bg-amber-50 text-amber-800 border-amber-300',
  Recommended_By_HOI: 'bg-sky-50 text-sky-800 border-sky-300',
  Approved: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  Rejected: 'bg-rose-50 text-rose-800 border-rose-300',
};

export const JkepmAppraisalPortal: React.FC<JkepmAppraisalPortalProps> = ({
  school,
  teachers,
  currentUser,
  effectiveRole,
  language,
  onUpdateTeacher,
}) => {
  const isAdminUser = effectiveRole === 'admin' || currentUser.role === 'admin';
  const isHoiUser = effectiveRole === 'head_teacher' || currentUser.role === 'head_teacher' || isAdminUser;

  // Match active teacher profile for teacher dashboard
  const matchedTeacher = useMemo(() => {
    const byName = teachers.find(
      (t) =>
        t.name.toLowerCase() === currentUser.name.toLowerCase() ||
        currentUser.name.toLowerCase().includes(t.name.toLowerCase())
    );
    return (
      byName ||
      teachers.find((t) => normalizeCpisCode(t.employeeId) === normalizeCpisCode(NEW_CPIS_CODE_OFFICIAL)) ||
      teachers[0]
    );
  }, [teachers, currentUser]);

  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(matchedTeacher?.id || teachers[0]?.id || 'tch-2');
  const activeTeacher = useMemo(
    () => teachers.find((t) => t.id === selectedTeacherId) || matchedTeacher || teachers[0],
    [teachers, selectedTeacherId, matchedTeacher]
  );

  // Navigation State
  const [activeSection, setActiveSection] = useState<PortalSection>('home');
  const [formStepTab, setFormStepTab] = useState<FormStepTab>('teacher-info');

  // Persistent State: Reports, CPIS Migrations, Audit Trail
  const [reports, setReports] = useState<JkepmQuarterlyAppraisalReport[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_REPORTS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as JkepmQuarterlyAppraisalReport[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Ensure any legacy JK-EDU-1985-0451 code in stored reports is linked to KHYEDU 00220000
          return parsed.map((r) =>
            normalizeCpisCode(r.cpisCode) === normalizeCpisCode(OLD_CPIS_CODE_LEGACY)
              ? {
                  ...r,
                  cpisCode: NEW_CPIS_CODE_OFFICIAL,
                  employeeId: NEW_CPIS_CODE_OFFICIAL,
                  previousCpisCode: OLD_CPIS_CODE_LEGACY,
                }
              : r
          );
        }
      }
    } catch {
      // use seed
    }
    return buildInitialJkepmReports(teachers, school);
  });

  const [cpisMigrations, setCpisMigrations] = useState<CpisCodeMigrationRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_CPIS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // use seed
    }
    return buildInitialCpisMigrations(teachers, school);
  });

  const [auditLogs, setAuditLogs] = useState<JkepmAuditLogEntry[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_AUDIT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // use seed
    }
    return buildInitialJkepmAuditLogs();
  });

  // Persist to localStorage automatically
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_REPORTS_KEY, JSON.stringify(reports));
    } catch {
      // ignore
    }
  }, [reports]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_CPIS_KEY, JSON.stringify(cpisMigrations));
    } catch {
      // ignore
    }
  }, [cpisMigrations]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_AUDIT_KEY, JSON.stringify(auditLogs));
    } catch {
      // ignore
    }
  }, [auditLogs]);

  // Hydrate / sync with Express backend API on mount
  const [backendSyncedAt, setBackendSyncedAt] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    fetch('/api/jkepm/state')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data) return;
        if (Array.isArray(data.reports) && data.reports.length > 0) {
          setReports((prev) => {
            const byId = new Map<string, JkepmQuarterlyAppraisalReport>();
            prev.forEach((r) => byId.set(r.id, r));
            data.reports.forEach((r: JkepmQuarterlyAppraisalReport) => {
              const existing = byId.get(r.id);
              if (!existing || (r.updatedAt && r.updatedAt > existing.updatedAt)) {
                byId.set(r.id, r);
              }
            });
            return Array.from(byId.values()).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
          });
        }
        setBackendSyncedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Toast feedback
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4500);
  };

  // Audit logger helper
  const recordAudit = (
    action: JkepmAuditLogEntry['action'],
    entityId: string,
    summary: string,
    previousValue?: string,
    newValue?: string
  ) => {
    const entry: JkepmAuditLogEntry = {
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: effectiveRole,
      action,
      entityId,
      summary,
      previousValue,
      newValue,
    };
    setAuditLogs((prev) => [entry, ...prev].slice(0, 300));
    fetch('/api/jkepm/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    }).catch(() => {});
  };

  // =========================================================================
  // REPORT FORM BUILDER STATE (Full CRUD: Add / Edit / Draft / Submit)
  // =========================================================================
  const buildBlankReport = (teacher: TeacherProfile, quarter: JkepmQuarter = 'Q3 (Oct - Dec)'): JkepmQuarterlyAppraisalReport => ({
    id: `jkepm-app-${Date.now()}`,
    teacherId: teacher.id,
    teacherName: teacher.name,
    employeeId: teacher.employeeId,
    designation: teacher.designation,
    schoolName: teacher.schoolName || school.name,
    schoolUdiseCode: teacher.schoolId || school.code,
    cpisCode: teacher.employeeId,
    previousCpisCode: teacher.previousCpisCode,
    academicSession: school.academicSession || '2026-2027',
    quarter,
    reportingPeriod: QUARTER_REPORTING_PERIODS[quarter],
    dateOfJoining: teacher.dateOfJoining || '2012-08-12',
    classTeachingDetails: (teacher.assignedClasses || []).slice(0, 2).map((ac, idx) => ({
      id: `cls-init-${Date.now()}-${idx}`,
      classNumber: ac.classNumber || '5',
      section: ac.section || 'A',
      subject: ac.subject || 'Mathematics',
      periodsAllotted: 60,
      periodsConducted: 58,
      classTimetable: `Mon–Sat • Period ${idx + 2}`,
      teachingActivitiesCompleted: '',
      syllabusCoveredPct: 85,
      syllabusDetails: '',
      learningOutcomesAchieved: '',
      studentAssessmentDetails: '',
      remedialTeachingActivities: '',
    })),
    schoolAssignments: [],
    attendanceAndLeave: createEmptyAttendanceLeave(),
    selfAssessmentScore: 9.0,
    teacherDeclarationAccepted: false,
    status: 'Draft',
    createdByUserId: currentUser.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const [editingReport, setEditingReport] = useState<JkepmQuarterlyAppraisalReport | null>(null);
  const [formValidationErrors, setFormValidationErrors] = useState<string[]>([]);
  const [viewingReport, setViewingReport] = useState<JkepmQuarterlyAppraisalReport | null>(null);
  const [deletingReport, setDeletingReport] = useState<JkepmQuarterlyAppraisalReport | null>(null);

  // Teacher Appraisal Dashboard Search & Filter controls (Quarter, Session, Status)
  const [teacherSearchQuery, setTeacherSearchQuery] = useState<string>('');
  const [teacherQuarterFilter, setTeacherQuarterFilter] = useState<string>('ALL');
  const [teacherSessionFilter, setTeacherSessionFilter] = useState<string>('ALL');
  const [teacherStatusFilter, setTeacherStatusFilter] = useState<string>('ALL');

  // 30-second Auto-Save state & recovery draft for Quarterly Appraisal Form
  const editingReportRef = useRef<JkepmQuarterlyAppraisalReport | null>(null);
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState<string | null>(null);
  const [recoveredAutoSave, setRecoveredAutoSave] = useState<{
    report: JkepmQuarterlyAppraisalReport;
    savedAt: string;
  } | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_FORM_AUTOSAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.report?.id && parsed?.savedAt) return parsed;
      }
    } catch {
      // ignore corrupted autosave
    }
    return null;
  });

  useEffect(() => {
    editingReportRef.current = editingReport;
  }, [editingReport]);

  useEffect(() => {
    if (activeSection !== 'assessment-form' || !editingReport) return;

    const persistAutoSaveSnapshot = () => {
      const current = editingReportRef.current;
      if (!current) return;
      try {
        const savedAt = new Date().toISOString();
        localStorage.setItem(
          STORAGE_FORM_AUTOSAVE_KEY,
          JSON.stringify({ report: current, savedAt })
        );
        setLastAutoSavedAt(
          new Date(savedAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
        );
      } catch {
        // ignore quota errors
      }
    };

    const intervalId = window.setInterval(persistAutoSaveSnapshot, 30_000);
    return () => window.clearInterval(intervalId);
  }, [activeSection, editingReport?.id]);

  // Sub-editors for Part A (Class Teaching), Part B (Assignments), Part C (Leave Records)
  const [editingClassItem, setEditingClassItem] = useState<JkepmClassTeachingDetail | null>(null);
  const [editingAssignmentItem, setEditingAssignmentItem] = useState<JkepmSchoolAssignment | null>(null);
  const [editingLeaveItem, setEditingLeaveItem] = useState<JkepmLeaveEntry | null>(null);
  const [docUploadType, setDocUploadType] = useState<JkepmSupportingDocument['docType']>('Medical Certificate');
  const docFileInputRef = useRef<HTMLInputElement>(null);

  // Security Verification Modal (Employee ID + OTP / Password check for Final Submit / Admin Delete / CPIS Approval)
  const [securityGate, setSecurityGate] = useState<{
    title: string;
    description: string;
    expectedCode: string;
    generatedOtp: string;
    onVerified: () => void;
  } | null>(null);
  const [gateEmpInput, setGateEmpInput] = useState<string>('');
  const [gateOtpInput, setGateOtpInput] = useState<string>('');
  const [gateError, setGateError] = useState<string | null>(null);

  const openSecurityGate = (title: string, description: string, onVerified: () => void) => {
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    setGateEmpInput(activeTeacher?.employeeId || NEW_CPIS_CODE_OFFICIAL);
    setGateOtpInput(otp);
    setGateError(null);
    setSecurityGate({
      title,
      description,
      expectedCode: activeTeacher?.employeeId || NEW_CPIS_CODE_OFFICIAL,
      generatedOtp: otp,
      onVerified,
    });
  };

  const handleConfirmSecurityGate = () => {
    if (!securityGate) return;
    if (!gateEmpInput.trim()) {
      setGateError('Please enter your Employee ID / CPIS Code.');
      return;
    }
    if (gateOtpInput.trim() !== securityGate.generatedOtp) {
      setGateError(`Invalid OTP. Enter the 6-digit verification code (${securityGate.generatedOtp}).`);
      return;
    }
    const callback = securityGate.onVerified;
    setSecurityGate(null);
    callback();
  };

  // Start New Report
  const handleStartNewReport = () => {
    if (!activeTeacher) return;
    setEditingReport(buildBlankReport(activeTeacher));
    setFormStepTab('teacher-info');
    setFormValidationErrors([]);
    setActiveSection('assessment-form');
  };

  // Edit Existing Report
  const handleEditReport = (rep: JkepmQuarterlyAppraisalReport) => {
    if (rep.status === 'Approved' && !isAdminUser) {
      showToast('Approved reports are locked against modification. Contact an administrator for amendments.', 'error');
      return;
    }
    setEditingReport(JSON.parse(JSON.stringify(rep)));
    setFormStepTab('teacher-info');
    setFormValidationErrors([]);
    setActiveSection('assessment-form');
  };

  // Save Report (Draft or Final Submit)
  const persistReport = (reportToSave: JkepmQuarterlyAppraisalReport, isSubmit: boolean) => {
    const calcAtt = recalculateAttendanceLeaveSummary(reportToSave.attendanceAndLeave);
    const errors: string[] = [];

    if (!reportToSave.teacherName.trim()) errors.push('Teacher Name is required.');
    if (!reportToSave.cpisCode.trim()) errors.push('Updated CPIS Code is required.');
    if (!reportToSave.schoolUdiseCode.trim()) errors.push('School U-DISE Code is required.');

    if (isSubmit) {
      errors.push(...validateJkepmAttendanceAndLeave(calcAtt));
      if (reportToSave.classTeachingDetails.length === 0) {
        errors.push('Add at least one Class-Wise Teaching entry before final submission.');
      }
      if (!reportToSave.teacherDeclarationAccepted) {
        errors.push('Please accept the Teacher Declaration before final submission.');
      }
    }

    if (errors.length > 0) {
      setFormValidationErrors(errors);
      showToast(errors[0], 'error');
      return;
    }

    setFormValidationErrors([]);
    const nowIso = new Date().toISOString();
    const isExisting = reports.some((r) => r.id === reportToSave.id);

    const finalized: JkepmQuarterlyAppraisalReport = {
      ...reportToSave,
      attendanceAndLeave: calcAtt,
      status: isSubmit ? 'Submitted' : reportToSave.status === 'Returned_For_Correction' ? 'Draft' : 'Draft',
      submittedAt: isSubmit ? nowIso : reportToSave.submittedAt,
      teacherDeclarationDate: isSubmit ? nowIso.slice(0, 10) : reportToSave.teacherDeclarationDate,
      updatedAt: nowIso,
    };

    const doPersist = () => {
      setReports((prev) => {
        if (prev.some((r) => r.id === finalized.id)) {
          return prev.map((r) => (r.id === finalized.id ? finalized : r));
        }
        return [finalized, ...prev];
      });

      // Sync to Express REST API
      fetch(isExisting ? `/api/jkepm/submissions/${encodeURIComponent(finalized.id)}` : '/api/jkepm/submissions', {
        method: isExisting ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalized),
      })
        .then(() => setBackendSyncedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })))
        .catch(() => {});

      // Sync to Firestore when authenticated
      syncJkepmSubmissionToFirestore(finalized, !isExisting).catch(() => {});

      recordAudit(
        isSubmit ? 'REPORT_SUBMITTED' : isExisting ? 'REPORT_EDITED' : 'REPORT_DRAFT_SAVED',
        finalized.id,
        `${isSubmit ? 'Final submitted' : 'Saved draft'} ${finalized.quarter} JKEPM Appraisal for ${finalized.teacherName} (CPIS: ${finalized.cpisCode}).`
      );

      try {
        localStorage.removeItem(STORAGE_FORM_AUTOSAVE_KEY);
      } catch {
        // ignore
      }
      setRecoveredAutoSave(null);
      setLastAutoSavedAt(null);
      setEditingReport(null);
      setActiveSection('submitted-reports');
      showToast(
        isSubmit
          ? `Quarterly Self-Assessment (${finalized.quarter}) submitted successfully to HOI for verification!`
          : `Draft saved successfully for ${finalized.quarter}. You can resume editing anytime.`
      );
    };

    if (isSubmit) {
      openSecurityGate(
        'Confirm Final JKEPM Submission',
        `Verify your Employee ID / CPIS Code (${finalized.cpisCode}) and 6-digit OTP to submit ${finalized.quarter} appraisal to Head of Institution.`,
        doPersist
      );
    } else {
      doPersist();
    }
  };

  // Delete Report (Drafts deletable with confirmation; Submitted reports require Admin Auth + Soft Archive preservation)
  const handleConfirmDeleteReport = () => {
    if (!deletingReport) return;
    const target = deletingReport;

    const executeDelete = () => {
      if (target.status === 'Draft') {
        setReports((prev) => prev.filter((r) => r.id !== target.id));
        deleteJkepmSubmissionFromFirestore(target.id).catch(() => {});
      } else {
        // Preserve historical record while hiding from active list
        setReports((prev) =>
          prev.map((r) =>
            r.id === target.id ? { ...r, isArchivedDeleted: true, updatedAt: new Date().toISOString() } : r
          )
        );
      }

      fetch(`/api/jkepm/submissions/${encodeURIComponent(target.id)}?authorizedAdmin=${isAdminUser ? 'true' : 'false'}`, {
        method: 'DELETE',
      }).catch(() => {});

      recordAudit(
        'REPORT_DELETED',
        target.id,
        `${target.status === 'Draft' ? 'Deleted draft' : 'Archived submitted'} JKEPM report (${target.quarter}) for ${target.teacherName}.`,
        target.status,
        target.status === 'Draft' ? 'Deleted' : 'Archived_Historical'
      );

      setDeletingReport(null);
      showToast(
        target.status === 'Draft'
          ? 'Draft report deleted.'
          : 'Submitted report archived with administrative authorization (historical audit record preserved).'
      );
    };

    if (target.status !== 'Draft') {
      if (!isAdminUser) {
        showToast('Submitted reports cannot be deleted without Administrator authorization.', 'error');
        setDeletingReport(null);
        return;
      }
      setDeletingReport(null);
      openSecurityGate(
        'Administrative Authorization Required',
        `Deleting submitted report (${target.quarter} • ${target.teacherName}) requires Admin OTP confirmation. Historical record will remain in audit storage.`,
        executeDelete
      );
    } else {
      executeDelete();
    }
  };

  // =========================================================================
  // PART A: CLASS-WISE TEACHING ADD / EDIT / DELETE
  // =========================================================================
  const handleSaveClassTeaching = () => {
    if (!editingReport || !editingClassItem) return;
    if (!editingClassItem.subject.trim()) {
      showToast('Please enter Subject Taught.', 'error');
      return;
    }
    const exists = editingReport.classTeachingDetails.some((c) => c.id === editingClassItem.id);
    const updatedList = exists
      ? editingReport.classTeachingDetails.map((c) => (c.id === editingClassItem.id ? editingClassItem : c))
      : [...editingReport.classTeachingDetails, editingClassItem];
    setEditingReport({ ...editingReport, classTeachingDetails: updatedList });
    setEditingClassItem(null);
    showToast(exists ? 'Class teaching entry updated.' : 'Class teaching entry added.');
  };

  const handleDeleteClassTeaching = (id: string) => {
    if (!editingReport) return;
    setEditingReport({
      ...editingReport,
      classTeachingDetails: editingReport.classTeachingDetails.filter((c) => c.id !== id),
    });
    showToast('Class teaching entry removed.', 'info');
  };

  // =========================================================================
  // PART B: SCHOOL ASSIGNMENTS ADD / EDIT / DELETE
  // =========================================================================
  const handleSaveAssignment = () => {
    if (!editingReport || !editingAssignmentItem) return;
    if (!editingAssignmentItem.title.trim()) {
      showToast('Please enter an Assignment Title.', 'error');
      return;
    }
    const exists = editingReport.schoolAssignments.some((a) => a.id === editingAssignmentItem.id);
    const updatedList = exists
      ? editingReport.schoolAssignments.map((a) => (a.id === editingAssignmentItem.id ? editingAssignmentItem : a))
      : [...editingReport.schoolAssignments, editingAssignmentItem];
    setEditingReport({ ...editingReport, schoolAssignments: updatedList });
    setEditingAssignmentItem(null);
    showToast(exists ? 'School assignment updated.' : 'School assignment added.');
  };

  const handleDeleteAssignment = (id: string) => {
    if (!editingReport) return;
    setEditingReport({
      ...editingReport,
      schoolAssignments: editingReport.schoolAssignments.filter((a) => a.id !== id),
    });
    showToast('School assignment removed.', 'info');
  };

  // =========================================================================
  // PART C: LEAVE RECORDS ADD / EDIT / DELETE + SUPPORTING DOC UPLOAD
  // =========================================================================
  const syncLeaveRecordsToSummary = (
    att: JkepmAttendanceLeaveSummary,
    nextRecords: JkepmLeaveEntry[]
  ): JkepmAttendanceLeaveSummary => {
    const cl = nextRecords.filter((l) => l.leaveType === 'Casual_Leave').reduce((s, l) => s + (Number(l.days) || 0), 0);
    const ml = nextRecords.filter((l) => l.leaveType === 'Medical_Leave').reduce((s, l) => s + (Number(l.days) || 0), 0);
    const el = nextRecords.filter((l) => l.leaveType === 'Earned_Leave').reduce((s, l) => s + (Number(l.days) || 0), 0);
    const other = nextRecords.filter((l) => l.leaveType === 'Other_Leave').reduce((s, l) => s + (Number(l.days) || 0), 0);

    const latestMed = nextRecords.find((l) => l.leaveType === 'Medical_Leave' && l.medicalSanctionOrderNo);
    const latestCl = nextRecords.find((l) => l.leaveType === 'Casual_Leave' && l.casualSanctionOrderNo);
    const firstFrom = nextRecords.map((l) => l.fromDate).filter(Boolean).sort()[0] || att.leavePeriodFrom;
    const lastTo = nextRecords.map((l) => l.toDate).filter(Boolean).sort().slice(-1)[0] || att.leavePeriodTo;

    return recalculateAttendanceLeaveSummary({
      ...att,
      casualLeaves: cl,
      medicalLeaves: ml,
      earnedLeaves: el,
      otherLeaves: other,
      leavePeriodFrom: firstFrom,
      leavePeriodTo: lastTo,
      medicalSanctionOrderNumber: latestMed?.medicalSanctionOrderNo || att.medicalSanctionOrderNumber,
      medicalSanctionOrderDate: latestMed?.medicalSanctionOrderDate || att.medicalSanctionOrderDate,
      casualSanctionOrderNumber: latestCl?.casualSanctionOrderNo || att.casualSanctionOrderNumber,
      leaveRecords: nextRecords,
    });
  };

  const handleSaveLeaveEntry = () => {
    if (!editingReport || !editingLeaveItem) return;
    if (editingLeaveItem.days <= 0) {
      showToast('Leave days must be at least 1.', 'error');
      return;
    }
    if (editingLeaveItem.leaveType === 'Medical_Leave' && !editingLeaveItem.medicalSanctionOrderNo?.trim()) {
      showToast('Medical Leave Sanction Order Number is required for Medical Leave.', 'error');
      return;
    }
    const existingList = editingReport.attendanceAndLeave.leaveRecords || [];
    const exists = existingList.some((l) => l.id === editingLeaveItem.id);
    const nextList = exists
      ? existingList.map((l) => (l.id === editingLeaveItem.id ? editingLeaveItem : l))
      : [...existingList, editingLeaveItem];

    setEditingReport({
      ...editingReport,
      attendanceAndLeave: syncLeaveRecordsToSummary(editingReport.attendanceAndLeave, nextList),
    });
    setEditingLeaveItem(null);
    showToast(exists ? 'Leave record updated & attendance recalculated.' : 'Leave record added & attendance recalculated.');
  };

  const handleDeleteLeaveEntry = (id: string) => {
    if (!editingReport) return;
    const nextList = (editingReport.attendanceAndLeave.leaveRecords || []).filter((l) => l.id !== id);
    setEditingReport({
      ...editingReport,
      attendanceAndLeave: syncLeaveRecordsToSummary(editingReport.attendanceAndLeave, nextList),
    });
    showToast('Leave record removed.', 'info');
  };

  const handleSupportingDocUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingReport) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('File exceeds 5MB limit. Please upload a smaller PDF or image.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const newDoc: JkepmSupportingDocument = {
        id: `doc-${Date.now()}`,
        name: file.name,
        docType: docUploadType,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
        uploadedAt: new Date().toISOString(),
        dataUrl: typeof reader.result === 'string' && file.size <= 500_000 ? reader.result : undefined,
      };
      setEditingReport((prev) =>
        prev
          ? {
              ...prev,
              attendanceAndLeave: {
                ...prev.attendanceAndLeave,
                supportingDocuments: [...prev.attendanceAndLeave.supportingDocuments, newDoc],
              },
            }
          : prev
      );
      recordAudit('DOCUMENT_UPLOADED', editingReport.id, `Uploaded ${docUploadType}: ${file.name}`);
      showToast(`${docUploadType} "${file.name}" attached successfully.`);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemoveSupportingDoc = (docId: string) => {
    if (!editingReport) return;
    setEditingReport({
      ...editingReport,
      attendanceAndLeave: {
        ...editingReport.attendanceAndLeave,
        supportingDocuments: editingReport.attendanceAndLeave.supportingDocuments.filter((d) => d.id !== docId),
      },
    });
  };

  // =========================================================================
  // CPIS CODE CHANGE & AUTHORIZED MIGRATION ENGINE
  // =========================================================================
  const [cpisTeacherId, setCpisTeacherId] = useState<string>(activeTeacher?.id || teachers[0]?.id || 'tch-2');
  const [cpisNewCodeInput, setCpisNewCodeInput] = useState<string>(NEW_CPIS_CODE_OFFICIAL);
  const [cpisRemarksInput, setCpisRemarksInput] = useState<string>(
    'Official CPIS code update verified against DSEK / JKHRMS portal record.'
  );

  const selectedCpisTeacher = useMemo(
    () => teachers.find((t) => t.id === cpisTeacherId) || teachers[0],
    [teachers, cpisTeacherId]
  );

  const handleRequestOrApplyCpisMigration = () => {
    if (!selectedCpisTeacher) return;
    const oldCode = selectedCpisTeacher.employeeId;
    const cleanNew = normalizeCpisCode(cpisNewCodeInput);

    if (cleanNew.length < 4) {
      showToast('Enter a valid New CPIS Code (minimum 4 characters).', 'error');
      return;
    }
    if (normalizeCpisCode(oldCode) === cleanNew) {
      showToast(`Teacher ${selectedCpisTeacher.name} already uses CPIS Code "${cleanNew}".`, 'info');
      return;
    }

    // Prevent duplicate CPIS Code entries across all teachers
    const duplicateTeacher = teachers.find(
      (t) => t.id !== selectedCpisTeacher.id && normalizeCpisCode(t.employeeId) === cleanNew
    );
    if (duplicateTeacher) {
      showToast(
        `Duplicate CPIS Code blocked: "${cleanNew}" is already assigned to ${duplicateTeacher.name}.`,
        'error'
      );
      return;
    }

    const migration: CpisCodeMigrationRecord = {
      id: `cpis-mig-${Date.now()}`,
      teacherId: selectedCpisTeacher.id,
      teacherName: selectedCpisTeacher.name,
      designation: selectedCpisTeacher.designation,
      schoolName: selectedCpisTeacher.schoolName || school.name,
      schoolUdiseCode: selectedCpisTeacher.schoolId || school.code,
      oldCpisCode: oldCode,
      newCpisCode: cleanNew,
      status: isAdminUser ? 'Approved' : 'Pending_Verification',
      requestedByUserId: currentUser.id,
      requestedByName: currentUser.name,
      requestedAt: new Date().toISOString(),
      verifiedByUserId: isAdminUser ? currentUser.id : undefined,
      verifiedByName: isAdminUser ? `${currentUser.name} (Authorized Admin)` : undefined,
      verifiedAt: isAdminUser ? new Date().toISOString() : undefined,
      remarks: cpisRemarksInput.trim() || 'Authorized CPIS code migration.',
    };

    const commitMigration = () => {
      setCpisMigrations((prev) => [migration, ...prev]);
      fetch('/api/jkepm/cpis-migrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(migration),
      }).catch(() => {});
      syncCpisMigrationToFirestore(migration, true).catch(() => {});

      if (migration.status === 'Approved') {
        applyApprovedCpisToRecords(migration);
      }

      recordAudit(
        migration.status === 'Approved' ? 'CPIS_CODE_APPROVED' : 'CPIS_CODE_MIGRATED',
        migration.id,
        `${migration.status === 'Approved' ? 'Approved & applied' : 'Requested'} CPIS change for ${migration.teacherName}: ${oldCode} -> ${cleanNew}.`,
        oldCode,
        cleanNew
      );

      showToast(
        migration.status === 'Approved'
          ? `CPIS Code updated to "${cleanNew}" across teacher profile, school records & JKEPM appraisals!`
          : `CPIS Code change request submitted for Admin verification.`
      );
    };

    if (isAdminUser) {
      openSecurityGate(
        'Authorize CPIS Code Migration',
        `Approve controlled migration for ${selectedCpisTeacher.name}: "${oldCode}" → "${cleanNew}". Legacy CPIS will be preserved in audit history.`,
        commitMigration
      );
    } else {
      commitMigration();
    }
  };

  const applyApprovedCpisToRecords = (mig: CpisCodeMigrationRecord) => {
    const teacher = teachers.find((t) => t.id === mig.teacherId);
    if (teacher) {
      onUpdateTeacher({
        ...teacher,
        employeeId: mig.newCpisCode,
        previousCpisCode: mig.oldCpisCode,
        updatedAt: new Date().toISOString(),
      });
    }
    setReports((prev) =>
      prev.map((r) =>
        r.teacherId === mig.teacherId
          ? {
              ...r,
              cpisCode: mig.newCpisCode,
              employeeId: mig.newCpisCode,
              previousCpisCode: r.previousCpisCode || mig.oldCpisCode,
              updatedAt: new Date().toISOString(),
            }
          : r
      )
    );
  };

  const handleReviewCpisMigration = (mig: CpisCodeMigrationRecord, decision: 'Approved' | 'Rejected') => {
    if (!isAdminUser) {
      showToast('Only authorized administrators can verify and approve CPIS Code changes.', 'error');
      return;
    }
    if (decision === 'Approved') {
      const dup = teachers.find(
        (t) => t.id !== mig.teacherId && normalizeCpisCode(t.employeeId) === normalizeCpisCode(mig.newCpisCode)
      );
      if (dup) {
        showToast(`Cannot approve: CPIS "${mig.newCpisCode}" is already used by ${dup.name}.`, 'error');
        return;
      }
    }

    const updatedMig: CpisCodeMigrationRecord = {
      ...mig,
      status: decision,
      verifiedByUserId: currentUser.id,
      verifiedByName: currentUser.name,
      verifiedAt: new Date().toISOString(),
    };
    setCpisMigrations((prev) => prev.map((m) => (m.id === mig.id ? updatedMig : m)));
    syncCpisMigrationToFirestore(updatedMig, false).catch(() => {});
    fetch('/api/jkepm/cpis-migrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedMig),
    }).catch(() => {});

    if (decision === 'Approved') {
      applyApprovedCpisToRecords(updatedMig);
    }

    recordAudit(
      decision === 'Approved' ? 'CPIS_CODE_APPROVED' : 'CPIS_CODE_REJECTED',
      mig.id,
      `${decision} CPIS Code update for ${mig.teacherName} (${mig.oldCpisCode} -> ${mig.newCpisCode}).`,
      mig.oldCpisCode,
      mig.newCpisCode
    );
    showToast(`CPIS migration ${decision.toLowerCase()} for ${mig.teacherName}.`);
  };

  // =========================================================================
  // HOI / PRINCIPAL & DISTRICT WORKFLOW ACTIONS
  // =========================================================================
  const [reviewingReport, setReviewingReport] = useState<JkepmQuarterlyAppraisalReport | null>(null);
  const [reviewRemarksInput, setReviewRemarksInput] = useState<string>('');

  const handleWorkflowTransition = (
    rep: JkepmQuarterlyAppraisalReport,
    nextStatus: 'Returned_For_Correction' | 'Recommended_By_HOI' | 'Approved' | 'Rejected',
    remarks: string,
    level: 'hoi' | 'district'
  ) => {
    const nowIso = new Date().toISOString();
    const updated: JkepmQuarterlyAppraisalReport = {
      ...rep,
      status: nextStatus,
      ...(level === 'hoi'
        ? {
            hoiRemarks: remarks.trim() || rep.hoiRemarks || `Marked ${nextStatus.replace(/_/g, ' ')} by HOI.`,
            hoiReviewerName: currentUser.name,
            hoiReviewedAt: nowIso,
          }
        : {
            districtRemarks: remarks.trim() || rep.districtRemarks || `Verified by District Officer.`,
            districtOfficerName: currentUser.name,
            districtApprovedAt: nowIso,
          }),
      updatedAt: nowIso,
    };

    setReports((prev) => prev.map((r) => (r.id === rep.id ? updated : r)));
    fetch(`/api/jkepm/submissions/${encodeURIComponent(updated.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    }).catch(() => {});
    syncJkepmSubmissionToFirestore(updated, false).catch(() => {});

    const actionMap: Record<typeof nextStatus, JkepmAuditLogEntry['action']> = {
      Returned_For_Correction: 'REPORT_RETURNED',
      Recommended_By_HOI: 'REPORT_RECOMMENDED',
      Approved: 'REPORT_APPROVED',
      Rejected: 'REPORT_REJECTED',
    };
    recordAudit(
      actionMap[nextStatus],
      rep.id,
      `${nextStatus.replace(/_/g, ' ')} report (${rep.quarter}) for ${rep.teacherName} (${rep.cpisCode}). Remarks: ${remarks || 'N/A'}`,
      rep.status,
      nextStatus
    );

    setReviewingReport(null);
    setReviewRemarksInput('');
    showToast(`Report updated to "${nextStatus.replace(/_/g, ' ')}" successfully.`);
  };

  // Share PDF via Web Share API or fallback download
  const handleShareReportPdf = async (rep: JkepmQuarterlyAppraisalReport) => {
    const blob = generateJkepmAppraisalPdf(rep, school, 'blob');
    if (blob && typeof navigator !== 'undefined' && navigator.share) {
      try {
        const file = new File(
          [blob],
          `JKEPM_${rep.teacherName.replace(/\s+/g, '_')}_${rep.cpisCode.replace(/\s+/g, '_')}.pdf`,
          { type: 'application/pdf' }
        );
        await navigator.share({
          title: `JKEPM Appraisal - ${rep.teacherName} (${rep.quarter})`,
          text: `Quarterly Self-Assessment Report for ${rep.teacherName} | CPIS: ${rep.cpisCode} | U-DISE: ${rep.schoolUdiseCode}`,
          files: [file],
        });
        showToast('Quarterly appraisal PDF shared.');
        return;
      } catch {
        // User cancelled or file share unsupported -> download fallback
      }
    }
    generateJkepmAppraisalPdf(rep, school, 'download');
    showToast('Quarterly appraisal PDF downloaded for sharing.');
  };

  // Backup & Recovery JSON Export / Import
  const backupFileInputRef = useRef<HTMLInputElement>(null);
  const handleDownloadJsonBackup = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      schoolUdise: school.code,
      reports,
      cpisMigrations,
      auditLogs,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `JKEPM_CPIS_Backup_${school.code}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('JKEPM & CPIS JSON Backup downloaded.');
  };

  const handleRestoreJsonBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        if (Array.isArray(parsed.reports)) setReports(parsed.reports);
        if (Array.isArray(parsed.cpisMigrations)) setCpisMigrations(parsed.cpisMigrations);
        if (Array.isArray(parsed.auditLogs)) setAuditLogs(parsed.auditLogs);
        showToast('Backup restored successfully!');
      } catch {
        showToast('Invalid JSON backup file.', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // =========================================================================
  // FILTERED VIEWS & METRICS
  // =========================================================================
  const activeReports = useMemo(() => reports.filter((r) => !r.isArchivedDeleted), [reports]);

  const teacherReports = useMemo(
    () => activeReports.filter((r) => !activeTeacher || r.teacherId === activeTeacher.id),
    [activeReports, activeTeacher]
  );

  // District / Admin search filters
  const [districtSearchQuery, setDistrictSearchQuery] = useState<string>('');
  const [districtUdiseFilter, setDistrictUdiseFilter] = useState<string>('');
  const [districtQuarterFilter, setDistrictQuarterFilter] = useState<JkepmQuarter | 'ALL'>('ALL');
  const [districtStatusFilter, setDistrictStatusFilter] = useState<JkepmAppraisalStatus | 'ALL'>('ALL');

  const filteredDistrictReports = useMemo(() => {
    const q = districtSearchQuery.trim().toLowerCase();
    const u = districtUdiseFilter.trim().toLowerCase();
    return activeReports.filter((r) => {
      if (districtQuarterFilter !== 'ALL' && r.quarter !== districtQuarterFilter) return false;
      if (districtStatusFilter !== 'ALL' && r.status !== districtStatusFilter) return false;
      if (u && !(r.schoolUdiseCode || '').toLowerCase().includes(u)) return false;
      if (q) {
        const match =
          r.teacherName.toLowerCase().includes(q) ||
          r.employeeId.toLowerCase().includes(q) ||
          r.cpisCode.toLowerCase().includes(q) ||
          (r.previousCpisCode || '').toLowerCase().includes(q) ||
          r.schoolName.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [activeReports, districtSearchQuery, districtUdiseFilter, districtQuarterFilter, districtStatusFilter]);

  const monitoringQuarter: JkepmQuarter =
    districtQuarterFilter === 'ALL' ? 'Q3 (Oct - Dec)' : districtQuarterFilter;

  const pendingSubmissionTeachers = useMemo(() => {
    const submittedIds = new Set(
      activeReports
        .filter((r) => r.quarter === monitoringQuarter && r.status !== 'Draft')
        .map((r) => r.teacherId)
    );
    return teachers.filter((t) => !submittedIds.has(t.id));
  }, [activeReports, teachers, monitoringQuarter]);

  const stats = useMemo(() => {
    const list = activeSection === 'home' ? teacherReports : activeReports;
    return {
      total: list.length,
      drafts: list.filter((r) => r.status === 'Draft').length,
      submitted: list.filter((r) => r.status === 'Submitted').length,
      recommended: list.filter((r) => r.status === 'Recommended_By_HOI').length,
      approved: list.filter((r) => r.status === 'Approved').length,
      returnedOrRejected: list.filter(
        (r) => r.status === 'Returned_For_Correction' || r.status === 'Rejected'
      ).length,
    };
  }, [activeSection, teacherReports, activeReports]);

  return (
    <div className="space-y-5 pb-10">
      {/* Toast Notification Banner */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-[90] max-w-md rounded-2xl px-4 py-3 shadow-2xl border flex items-center gap-3 text-xs font-bold animate-in fade-in slide-in-from-bottom-2 duration-150 ${
            toast.type === 'error'
              ? 'bg-rose-950 text-rose-100 border-rose-500/60'
              : toast.type === 'info'
              ? 'bg-slate-900 text-indigo-100 border-indigo-500/60'
              : 'bg-emerald-950 text-emerald-100 border-emerald-500/60'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <span className="flex-1">{toast.message}</span>
          <button type="button" onClick={() => setToast(null)} className="opacity-70 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Portal Hero Banner with Verified CPIS Code Migration Highlight */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-5 sm:p-6 border border-indigo-500/30 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[10px] font-extrabold uppercase tracking-wider">
                <Award className="w-3.5 h-3.5" />
                <span>J&amp;K School Education • JKEPM Portal</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-[10px] font-bold">
                <ShieldCheck className="w-3 h-3" />
                <span>CPIS Updated: {NEW_CPIS_CODE_OFFICIAL}</span>
              </span>
              {backendSyncedAt && (
                <span className="text-[10px] text-slate-400 font-mono">
                  API Synced {backendSyncedAt}
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
              {language === 'ur'
                ? 'سی پی آئی ایس کوڈ اپڈیٹ اور جے کے ای پی ایم سہ ماہی کارکردگی پورٹل'
                : 'JKEPM Quarterly Self-Assessment & Appraisal Submissions'}
            </h1>
            <p className="text-xs text-slate-300 max-w-3xl">
              Controlled CPIS Code migration (<span className="line-through text-rose-300 font-mono">{OLD_CPIS_CODE_LEGACY}</span>{' '}
              → <span className="text-emerald-300 font-mono font-bold">{NEW_CPIS_CODE_OFFICIAL}</span>), class-wise teaching reports,
              school assignments, leave sanction orders, HOI verification, and District PDF/Excel analytics.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <select
              value={activeTeacher?.id || ''}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
              title="Select Active Teacher Profile"
              className="px-3 py-2 rounded-xl bg-slate-800/90 border border-slate-700 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              {teachers.map((tc) => (
                <option key={tc.id} value={tc.id}>
                  {tc.name} ({tc.employeeId})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleStartNewReport}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold shadow-lg transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Quarterly Report</span>
            </button>
          </div>
        </div>

        {/* Clean 7-Tab Android/Web Quick Navigation Strip */}
        <div className="mt-5 pt-4 border-t border-white/10 flex items-center gap-1.5 overflow-x-auto pb-1">
          {[
            { id: 'home', label: '1. Teacher Dashboard', icon: LayoutDashboard },
            { id: 'profile-cpis', label: '2. Profile & CPIS Code', icon: KeyRound },
            { id: 'assessment-form', label: '3. Quarterly Assessment Form', icon: ClipboardList },
            { id: 'submitted-reports', label: `4. Submitted Reports (${activeReports.length})`, icon: FileText },
            { id: 'hoi-dashboard', label: '5. HOI / Principal Desk', icon: UserCheck },
            { id: 'district-dashboard', label: '6. District / Admin Portal', icon: Building2 },
            { id: 'help', label: '7. Help & Support', icon: HelpCircle },
          ].map((nav) => {
            const Icon = nav.icon;
            const active = activeSection === nav.id;
            return (
              <button
                key={nav.id}
                type="button"
                onClick={() => {
                  if (nav.id === 'assessment-form' && !editingReport && activeTeacher) {
                    setEditingReport(buildBlankReport(activeTeacher));
                  }
                  setActiveSection(nav.id as PortalSection);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  active
                    ? 'bg-white text-slate-950 shadow-md'
                    : 'bg-white/10 text-slate-200 hover:bg-white/20'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{nav.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* SECTION 1: PERSONALIZED TEACHER DASHBOARD                             */}
      {/* ===================================================================== */}
      {activeSection === 'home' && activeTeacher && (
        <div className="space-y-5">
          {/* KPI Summary Row */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Updated CPIS Code</span>
              <p className="text-sm sm:text-base font-mono font-extrabold text-emerald-700 mt-1">
                {activeTeacher.employeeId}
              </p>
              {activeTeacher.previousCpisCode && (
                <span className="text-[10px] text-slate-400 font-mono">
                  Old: {activeTeacher.previousCpisCode}
                </span>
              )}
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Draft Reports</span>
              <p className="text-2xl font-extrabold text-slate-800 mt-1">{stats.drafts}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-indigo-200 bg-indigo-50/30 shadow-xs">
              <span className="text-[11px] font-bold text-indigo-700 uppercase">Submitted</span>
              <p className="text-2xl font-extrabold text-indigo-800 mt-1">{stats.submitted + stats.recommended}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-emerald-200 bg-emerald-50/30 shadow-xs">
              <span className="text-[11px] font-bold text-emerald-700 uppercase">Approved</span>
              <p className="text-2xl font-extrabold text-emerald-700 mt-1">{stats.approved}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-amber-200 bg-amber-50/30 shadow-xs">
              <span className="text-[11px] font-bold text-amber-800 uppercase">Returned / Action</span>
              <p className="text-2xl font-extrabold text-amber-800 mt-1">{stats.returnedOrRejected}</p>
            </div>
          </div>

          {/* Teacher Profile Card + Quick 10-Module Android Launcher Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-indigo-600" />
                  <span>Teacher Profile &amp; School Link</span>
                </h2>
                <button
                  type="button"
                  onClick={() => setActiveSection('profile-cpis')}
                  className="text-[11px] font-bold text-indigo-600 hover:underline"
                >
                  CPIS Details →
                </button>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
                <p className="font-extrabold text-slate-900 text-sm">{activeTeacher.name}</p>
                <p className="text-slate-600 font-semibold">{activeTeacher.designation}</p>
                <div className="pt-2 border-t border-slate-200 space-y-1 text-[11px]">
                  <p className="flex justify-between">
                    <span className="text-slate-500">Current CPIS Code:</span>
                    <strong className="font-mono text-emerald-700">{activeTeacher.employeeId}</strong>
                  </p>
                  {activeTeacher.previousCpisCode && (
                    <p className="flex justify-between">
                      <span className="text-slate-500">Legacy CPIS (Audit):</span>
                      <span className="font-mono text-slate-500 line-through">{activeTeacher.previousCpisCode}</span>
                    </p>
                  )}
                  <p className="flex justify-between">
                    <span className="text-slate-500">School:</span>
                    <strong className="text-slate-800 truncate max-w-[175px]">{school.name}</strong>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-slate-500">School U-DISE:</span>
                    <strong className="font-mono text-indigo-700">{school.code}</strong>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-slate-500">Date of Joining:</span>
                    <strong className="text-slate-800">{activeTeacher.dateOfJoining}</strong>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-slate-500">Session:</span>
                    <strong className="text-slate-800">{school.academicSession}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleStartNewReport}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Start New Quarterly Appraisal</span>
              </button>
            </div>

            {/* Android Quick Action Cards */}
            <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-extrabold text-slate-900">
                  Quick Actions — JKEPM &amp; CPIS Modules
                </h2>
                <span className="text-[11px] font-semibold text-slate-500">
                  Mobile-ready teacher workflow
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {[
                  {
                    title: 'CPIS Code Details',
                    desc: `${activeTeacher.employeeId} verified`,
                    icon: KeyRound,
                    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                    onClick: () => setActiveSection('profile-cpis'),
                  },
                  {
                    title: 'Class-Wise Teaching',
                    desc: 'Add classes, periods & outcomes',
                    icon: BookOpen,
                    color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
                    onClick: () => {
                      if (!editingReport) setEditingReport(buildBlankReport(activeTeacher));
                      setFormStepTab('part-a-teaching');
                      setActiveSection('assessment-form');
                    },
                  },
                  {
                    title: 'School Assignments',
                    desc: 'Assembly, MDM, Exams & HOI duties',
                    icon: Briefcase,
                    color: 'bg-amber-50 text-amber-800 border-amber-200',
                    onClick: () => {
                      if (!editingReport) setEditingReport(buildBlankReport(activeTeacher));
                      setFormStepTab('part-b-assignments');
                      setActiveSection('assessment-form');
                    },
                  },
                  {
                    title: 'Attendance & Leaves',
                    desc: 'CL/ML orders, auto % & doc upload',
                    icon: Calendar,
                    color: 'bg-sky-50 text-sky-800 border-sky-200',
                    onClick: () => {
                      if (!editingReport) setEditingReport(buildBlankReport(activeTeacher));
                      setFormStepTab('part-c-attendance');
                      setActiveSection('assessment-form');
                    },
                  },
                  {
                    title: 'Submitted Reports',
                    desc: `${teacherReports.length} report(s) & status`,
                    icon: FileText,
                    color: 'bg-violet-50 text-violet-800 border-violet-200',
                    onClick: () => setActiveSection('submitted-reports'),
                  },
                  {
                    title: 'Download Latest PDF',
                    desc: 'Print or share appraisal PDF',
                    icon: Download,
                    color: 'bg-rose-50 text-rose-700 border-rose-200',
                    onClick: () => {
                      const target = teacherReports[0] || activeReports[0];
                      if (target) {
                        generateJkepmAppraisalPdf(target, school, 'download');
                        showToast(`Downloaded PDF for ${target.teacherName} (${target.quarter}).`);
                      } else {
                        showToast('Create a quarterly report first to download PDF.', 'info');
                      }
                    },
                  },
                  {
                    title: 'Export to Excel',
                    desc: 'Download .xlsx appraisal workbook',
                    icon: FileSpreadsheet,
                    color: 'bg-teal-50 text-teal-800 border-teal-200',
                    onClick: () => {
                      if (teacherReports.length === 0) {
                        showToast('No quarterly appraisal reports found to export.', 'info');
                        return;
                      }
                      exportTeacherJkepmExcel({
                        reports: teacherReports,
                        teacherName: activeTeacher.name,
                        cpisCode: activeTeacher.employeeId,
                        school,
                      });
                      showToast(`Exported ${teacherReports.length} quarterly report(s) to Excel (.xlsx).`);
                    },
                  },
                ].map((tile) => {
                  const Icon = tile.icon;
                  return (
                    <button
                      key={tile.title}
                      type="button"
                      onClick={tile.onClick}
                      className={`p-3.5 rounded-2xl border text-left transition-all hover:shadow-md active:scale-[0.98] ${tile.color}`}
                    >
                      <Icon className="w-5 h-5 mb-2" />
                      <p className="text-xs font-extrabold">{tile.title}</p>
                      <p className="text-[10.5px] opacity-80 mt-0.5 leading-snug">{tile.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Recovered Auto-Save Draft Banner (if available) */}
          {recoveredAutoSave && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5 text-xs text-amber-950">
                <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-extrabold">Unsaved Quarterly Appraisal Auto-Save Detected</p>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    Draft for <strong>{recoveredAutoSave.report.quarter}</strong> ({recoveredAutoSave.report.academicSession}) auto-saved on{' '}
                    {new Date(recoveredAutoSave.savedAt).toLocaleString()}.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setEditingReport(recoveredAutoSave.report);
                    setFormStepTab('teacher-info');
                    setActiveSection('assessment-form');
                    setRecoveredAutoSave(null);
                    showToast('Restored auto-saved quarterly appraisal draft.', 'info');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold"
                >
                  Resume Draft
                </button>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      localStorage.removeItem(STORAGE_FORM_AUTOSAVE_KEY);
                    } catch {
                      // ignore
                    }
                    setRecoveredAutoSave(null);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white border border-amber-300 text-amber-900 text-xs font-bold"
                >
                  Discard
                </button>
              </div>
            </div>
          )}

          {/* Teacher's Recent Quarterly Appraisals with Search & Filters + Export to Excel */}
          {(() => {
            const availableSessions = Array.from(
              new Set(teacherReports.map((r) => r.academicSession).filter(Boolean))
            );
            const q = teacherSearchQuery.trim().toLowerCase();
            const filteredTeacherReports = teacherReports.filter((rep) => {
              if (teacherQuarterFilter !== 'ALL' && rep.quarter !== teacherQuarterFilter) return false;
              if (teacherSessionFilter !== 'ALL' && rep.academicSession !== teacherSessionFilter) return false;
              if (teacherStatusFilter !== 'ALL' && rep.status !== teacherStatusFilter) return false;
              if (q) {
                const hay = [
                  rep.quarter,
                  rep.academicSession,
                  rep.status.replace(/_/g, ' '),
                  rep.reportingPeriod,
                  rep.cpisCode,
                  rep.teacherName,
                ]
                  .join(' ')
                  .toLowerCase();
                if (!hay.includes(q)) return false;
              }
              return true;
            });

            return (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <h3 className="text-sm font-extrabold text-slate-900">
                      My Quarterly Self-Assessment Reports ({filteredTeacherReports.length} of {teacherReports.length})
                    </h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          if (filteredTeacherReports.length === 0) {
                            showToast('No matching reports to export to Excel.', 'info');
                            return;
                          }
                          exportTeacherJkepmExcel({
                            reports: filteredTeacherReports,
                            teacherName: activeTeacher.name,
                            cpisCode: activeTeacher.employeeId,
                            school,
                          });
                          showToast(`Exported ${filteredTeacherReports.length} report(s) to Excel.`);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-xs"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        <span>Export to Excel</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveSection('submitted-reports')}
                        className="text-xs font-bold text-indigo-600 hover:underline px-1"
                      >
                        View All Submissions →
                      </button>
                    </div>
                  </div>

                  {/* Search Bar & Quarter / Session / Status Filters */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={teacherSearchQuery}
                        onChange={(e) => setTeacherSearchQuery(e.target.value)}
                        placeholder="Search quarter, session, status..."
                        className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <select
                      value={teacherQuarterFilter}
                      onChange={(e) => setTeacherQuarterFilter(e.target.value)}
                      className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold bg-white"
                    >
                      <option value="ALL">All Quarters (Q1–Q4)</option>
                      {JKEPM_QUARTERS.map((qOpt) => (
                        <option key={qOpt} value={qOpt}>
                          {qOpt}
                        </option>
                      ))}
                    </select>
                    <select
                      value={teacherSessionFilter}
                      onChange={(e) => setTeacherSessionFilter(e.target.value)}
                      className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold bg-white"
                    >
                      <option value="ALL">All Academic Sessions</option>
                      {availableSessions.map((sess) => (
                        <option key={sess} value={sess}>
                          {sess}
                        </option>
                      ))}
                    </select>
                    <select
                      value={teacherStatusFilter}
                      onChange={(e) => setTeacherStatusFilter(e.target.value)}
                      className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold bg-white"
                    >
                      <option value="ALL">All Submission Statuses</option>
                      <option value="Draft">Draft</option>
                      <option value="Submitted">Submitted</option>
                      <option value="Returned_For_Correction">Returned For Correction</option>
                      <option value="Recommended_By_HOI">Recommended By HOI</option>
                      <option value="Approved">Approved</option>
                      <option value="Rejected">Rejected</option>
                    </select>
                  </div>
                </div>

                {filteredTeacherReports.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    {teacherReports.length === 0
                      ? `No quarterly appraisal reports created for ${activeTeacher.name} yet. Click "Add New Quarterly Report" to begin.`
                      : 'No reports match your current search or filter criteria.'}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {filteredTeacherReports.map((rep) => (
                      <div key={rep.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-sm text-slate-900">{rep.quarter}</span>
                            <span className="text-[11px] font-bold text-slate-600 px-2 py-0.5 rounded bg-slate-100">
                              {rep.academicSession}
                            </span>
                            <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                              CPIS: {rep.cpisCode}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${statusBadgeStyles[rep.status]}`}>
                              {rep.status.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500">
                            {rep.reportingPeriod} • {rep.classTeachingDetails.length} Class(es) • {rep.schoolAssignments.length} Assignment(s) • Attendance:{' '}
                            <strong className="text-slate-800">{rep.attendanceAndLeave.attendancePercentage}%</strong> (CL: {rep.attendanceAndLeave.casualLeaves}, ML: {rep.attendanceAndLeave.medicalLeaves})
                          </p>
                          {rep.hoiRemarks && (
                            <p className="text-[11px] text-indigo-700 font-medium">
                              HOI Remarks: {rep.hoiRemarks}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                          <button
                            type="button"
                            onClick={() => setViewingReport(rep)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold inline-flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" /> View
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEditReport(rep)}
                            className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold inline-flex items-center gap-1"
                          >
                            <Edit2 className="w-3.5 h-3.5" /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => generateJkepmAppraisalPdf(rep, school, 'download')}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold inline-flex items-center gap-1"
                          >
                            <Download className="w-3.5 h-3.5" /> PDF
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              exportTeacherJkepmExcel({
                                reports: [rep],
                                teacherName: rep.teacherName,
                                cpisCode: rep.cpisCode,
                                school,
                                singleReport: rep,
                              });
                              showToast(`Exported ${rep.quarter} report to Excel.`);
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold inline-flex items-center gap-1"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingReport(rep)}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600"
                            title="Delete Report"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* ===================================================================== */}
      {/* SECTION 2: CPIS CODE CHANGE & CONTROLLED MIGRATION PORTAL             */}
      {/* ===================================================================== */}
      {activeSection === 'profile-cpis' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Left: CPIS Update Form */}
          <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-slate-900">Controlled CPIS Code Migration</h2>
                <p className="text-[11px] text-slate-500">
                  Prevents duplicate CPIS entries &amp; preserves old code in immutable audit history
                </p>
              </div>
            </div>

            {/* Official Correction Banner */}
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs space-y-1">
              <p className="font-extrabold text-emerald-900 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Official CPIS Correction Applied</span>
              </p>
              <div className="flex items-center gap-2 font-mono text-[11px] pt-1">
                <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 line-through">
                  {OLD_CPIS_CODE_LEGACY}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-emerald-700" />
                <span className="px-2 py-0.5 rounded bg-emerald-600 text-white font-bold">
                  {NEW_CPIS_CODE_OFFICIAL}
                </span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Teacher</label>
                <select
                  value={cpisTeacherId}
                  onChange={(e) => setCpisTeacherId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold text-slate-800"
                >
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} — Current CPIS: {t.employeeId}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Existing CPIS Code</label>
                  <input
                    type="text"
                    readOnly
                    value={selectedCpisTeacher?.employeeId || ''}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-100 font-mono font-bold text-slate-700"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">New CPIS Code *</label>
                  <input
                    type="text"
                    value={cpisNewCodeInput}
                    onChange={(e) => setCpisNewCodeInput(e.target.value.toUpperCase())}
                    placeholder="e.g. KHYEDU 00220000"
                    className="w-full px-3 py-2 rounded-xl border border-indigo-300 bg-white font-mono font-bold text-indigo-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Verification / Migration Remarks</label>
                <textarea
                  rows={2}
                  value={cpisRemarksInput}
                  onChange={(e) => setCpisRemarksInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                />
              </div>

              <button
                type="button"
                onClick={handleRequestOrApplyCpisMigration}
                className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>
                  {isAdminUser ? 'Verify & Apply CPIS Code Update' : 'Submit CPIS Change for Admin Approval'}
                </span>
              </button>
            </div>
          </div>

          {/* Right: CPIS Migration Audit History */}
          <div className="lg:col-span-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <History className="w-4 h-4 text-indigo-600" />
                  <span>CPIS Code Migration &amp; Verification Registry ({cpisMigrations.length})</span>
                </h2>
                <p className="text-[11px] text-slate-500">
                  Legacy CPIS codes are permanently preserved for departmental audit compliance
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              {cpisMigrations.map((mig) => (
                <div key={mig.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-2 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-extrabold text-slate-900">{mig.teacherName}</span>
                      <span className="ml-2 text-[11px] text-slate-500">{mig.designation}</span>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                        mig.status === 'Approved'
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : mig.status === 'Rejected'
                          ? 'bg-rose-100 text-rose-800 border-rose-300'
                          : 'bg-amber-100 text-amber-800 border-amber-300'
                      }`}
                    >
                      {mig.status.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap font-mono text-[11px]">
                    <span className="px-2 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200">
                      Old CPIS: <strong>{mig.oldCpisCode}</strong>
                    </span>
                    <ArrowRight className="w-4 h-4 text-slate-400" />
                    <span className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                      New CPIS: <strong>{mig.newCpisCode}</strong>
                    </span>
                    <span className="px-2 py-1 rounded-lg bg-white text-slate-600 border border-slate-200">
                      U-DISE: {mig.schoolUdiseCode}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-600">{mig.remarks}</p>
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[10.5px] text-slate-500">
                    <span>
                      Requested by <strong>{mig.requestedByName}</strong> ({new Date(mig.requestedAt).toLocaleDateString()})
                      {mig.verifiedByName ? ` • Verified by ${mig.verifiedByName}` : ''}
                    </span>

                    {mig.status === 'Pending_Verification' && isAdminUser && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleReviewCpisMigration(mig, 'Approved')}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                        >
                          Approve &amp; Propagate
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReviewCpisMigration(mig, 'Rejected')}
                          className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SECTION 3: QUARTERLY SELF-ASSESSMENT & APPRAISAL FORM (4-PART CRUD)   */}
      {/* ===================================================================== */}
      {activeSection === 'assessment-form' && editingReport && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Form Header */}
          <div className="p-4 sm:p-5 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-amber-400" />
                <span>
                  {reports.some((r) => r.id === editingReport.id)
                    ? `Edit Quarterly Appraisal — ${editingReport.quarter}`
                    : `New JKEPM Quarterly Self-Assessment — ${editingReport.quarter}`}
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {editingReport.teacherName} • Updated CPIS:{' '}
                <strong className="text-emerald-300 font-mono">{editingReport.cpisCode}</strong> • U-DISE:{' '}
                <span className="font-mono">{editingReport.schoolUdiseCode}</span>
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-[11px] font-semibold text-slate-300">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                <span>{lastAutoSavedAt ? `Auto-saved at ${lastAutoSavedAt}` : 'Auto-save active (every 30s)'}</span>
              </span>
              <button
                type="button"
                onClick={() => persistReport(editingReport, false)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-white"
              >
                <Save className="w-3.5 h-3.5 text-amber-300" />
                <span>Save as Draft</span>
              </button>
              <button
                type="button"
                onClick={() => persistReport(editingReport, true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-extrabold text-white shadow-sm"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Final Submit</span>
              </button>
            </div>
          </div>

          {/* Step Tabs */}
          <div className="px-5 pt-4 border-b border-slate-200 flex items-center gap-2 overflow-x-auto bg-slate-50">
            {[
              { id: 'teacher-info', label: '1. Teacher Particulars (10 Fields)' },
              {
                id: 'part-a-teaching',
                label: `2. Part A: Class-Wise Teaching (${editingReport.classTeachingDetails.length})`,
              },
              {
                id: 'part-b-assignments',
                label: `3. Part B: Timetable & Assignments (${editingReport.schoolAssignments.length})`,
              },
              {
                id: 'part-c-attendance',
                label: `4. Part C: Attendance & Leaves (${editingReport.attendanceAndLeave.attendancePercentage}%)`,
              },
            ].map((step) => (
              <button
                key={step.id}
                type="button"
                onClick={() => setFormStepTab(step.id as FormStepTab)}
                className={`px-3.5 py-2.5 text-xs font-extrabold border-b-2 whitespace-nowrap transition-colors ${
                  formStepTab === step.id
                    ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-xl'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {step.label}
              </button>
            ))}
          </div>

          {/* Validation Errors Banner */}
          {formValidationErrors.length > 0 && (
            <div className="mx-5 mt-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-300 text-xs text-rose-900 space-y-1">
              <p className="font-extrabold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>Please resolve validation issues before submission:</span>
              </p>
              <ul className="list-disc pl-5 space-y-0.5 text-[11px]">
                {formValidationErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="p-5 space-y-5">
            {/* TAB 1: 10 MANDATORY TEACHER PARTICULARS */}
            {formStepTab === 'teacher-info' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">1. Teacher Name *</label>
                    <input
                      type="text"
                      value={editingReport.teacherName}
                      onChange={(e) => setEditingReport({ ...editingReport, teacherName: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">2. Employee ID *</label>
                    <input
                      type="text"
                      value={editingReport.employeeId}
                      onChange={(e) => setEditingReport({ ...editingReport, employeeId: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">3. Designation *</label>
                    <input
                      type="text"
                      value={editingReport.designation}
                      onChange={(e) => setEditingReport({ ...editingReport, designation: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">4. School Name *</label>
                    <input
                      type="text"
                      value={editingReport.schoolName}
                      onChange={(e) => setEditingReport({ ...editingReport, schoolName: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">5. School DISE / U-DISE Code *</label>
                    <input
                      type="text"
                      value={editingReport.schoolUdiseCode}
                      onChange={(e) => setEditingReport({ ...editingReport, schoolUdiseCode: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-emerald-800 mb-1">
                      6. CPIS Code (Updated) *
                    </label>
                    <input
                      type="text"
                      value={editingReport.cpisCode}
                      onChange={(e) =>
                        setEditingReport({ ...editingReport, cpisCode: e.target.value.toUpperCase() })
                      }
                      className="w-full px-3 py-2 rounded-xl border-2 border-emerald-400 bg-emerald-50/40 font-mono font-extrabold text-emerald-900"
                    />
                    {editingReport.previousCpisCode && (
                      <span className="text-[10px] text-slate-500 font-mono">
                        Legacy Ref: {editingReport.previousCpisCode}
                      </span>
                    )}
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">7. Academic Session *</label>
                    <input
                      type="text"
                      value={editingReport.academicSession}
                      onChange={(e) => setEditingReport({ ...editingReport, academicSession: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">8. Quarter (1st – 4th) *</label>
                    <select
                      value={editingReport.quarter}
                      onChange={(e) => {
                        const q = e.target.value as JkepmQuarter;
                        setEditingReport({
                          ...editingReport,
                          quarter: q,
                          reportingPeriod: QUARTER_REPORTING_PERIODS[q],
                        });
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold"
                    >
                      {JKEPM_QUARTERS.map((q) => (
                        <option key={q} value={q}>
                          {q}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">9. Reporting Period *</label>
                    <input
                      type="text"
                      value={editingReport.reportingPeriod}
                      onChange={(e) => setEditingReport({ ...editingReport, reportingPeriod: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">10. Date of Joining *</label>
                    <input
                      type="date"
                      value={editingReport.dateOfJoining}
                      onChange={(e) => setEditingReport({ ...editingReport, dateOfJoining: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Self-Assessment Score (Out of 10)</label>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      step={0.1}
                      value={editingReport.selfAssessmentScore}
                      onChange={(e) =>
                        setEditingReport({
                          ...editingReport,
                          selfAssessmentScore: Math.min(10, Math.max(0, Number(e.target.value) || 0)),
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setFormStepTab('part-a-teaching')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold"
                  >
                    <span>Next: Part A — Class-Wise Teaching</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: PART A — CLASS-WISE TEACHING DETAILS (ADD MORE / EDIT / DELETE) */}
            {formStepTab === 'part-a-teaching' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">
                      Part A: Class-Wise Teaching Performance &amp; Timetable (Class 1 to Class 12)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Add multiple classes and subjects with periods allotted/conducted, syllabus, outcomes, evaluation &amp; remedial work.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setEditingClassItem({
                        id: `cls-${Date.now()}`,
                        classNumber: '5',
                        section: 'A',
                        subject: '',
                        periodsAllotted: 60,
                        periodsConducted: 58,
                        classTimetable: 'Mon–Sat • Period 2',
                        teachingActivitiesCompleted: '',
                        syllabusCoveredPct: 90,
                        syllabusDetails: '',
                        learningOutcomesAchieved: '',
                        studentAssessmentDetails: '',
                        remedialTeachingActivities: '',
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add More Class / Subject</span>
                  </button>
                </div>

                {/* Inline Add/Edit Class Teaching Drawer */}
                {editingClassItem && (
                  <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-indigo-900">
                        {editingReport.classTeachingDetails.some((c) => c.id === editingClassItem.id)
                          ? 'Edit Class Teaching Entry'
                          : 'Add Class-Wise Teaching Entry'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setEditingClassItem(null)}
                        className="text-slate-500 hover:text-slate-800"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Class Taught (1–12)</label>
                        <select
                          value={editingClassItem.classNumber}
                          onChange={(e) => setEditingClassItem({ ...editingClassItem, classNumber: e.target.value })}
                          className="w-full px-2.5 py-2 rounded-xl border border-slate-300 bg-white"
                        >
                          {CLASS_OPTIONS.map((c) => (
                            <option key={c} value={c}>Class {c}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Section</label>
                        <input
                          type="text"
                          value={editingClassItem.section}
                          onChange={(e) => setEditingClassItem({ ...editingClassItem, section: e.target.value.toUpperCase() })}
                          className="w-full px-2.5 py-2 rounded-xl border border-slate-300 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Subject Taught *</label>
                        <input
                          type="text"
                          value={editingClassItem.subject}
                          onChange={(e) => setEditingClassItem({ ...editingClassItem, subject: e.target.value })}
                          placeholder="e.g. Mathematics, English, Science"
                          className="w-full px-2.5 py-2 rounded-xl border border-slate-300 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Syllabus Covered (%)</label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={editingClassItem.syllabusCoveredPct}
                          onChange={(e) =>
                            setEditingClassItem({
                              ...editingClassItem,
                              syllabusCoveredPct: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                            })
                          }
                          className="w-full px-2.5 py-2 rounded-xl border border-slate-300 bg-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Periods Allotted</label>
                        <input
                          type="number"
                          min={0}
                          value={editingClassItem.periodsAllotted}
                          onChange={(e) =>
                            setEditingClassItem({ ...editingClassItem, periodsAllotted: Math.max(0, Number(e.target.value) || 0) })
                          }
                          className="w-full px-2.5 py-2 rounded-xl border border-slate-300 bg-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Periods Conducted</label>
                        <input
                          type="number"
                          min={0}
                          value={editingClassItem.periodsConducted}
                          onChange={(e) =>
                            setEditingClassItem({ ...editingClassItem, periodsConducted: Math.max(0, Number(e.target.value) || 0) })
                          }
                          className="w-full px-2.5 py-2 rounded-xl border border-slate-300 bg-white font-mono"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block font-bold text-slate-700 mb-1">Class-Wise Timetable Slot</label>
                        <input
                          type="text"
                          value={editingClassItem.classTimetable}
                          onChange={(e) => setEditingClassItem({ ...editingClassItem, classTimetable: e.target.value })}
                          placeholder="e.g. Mon–Sat • Period 2 (09:45 AM – 10:30 AM)"
                          className="w-full px-2.5 py-2 rounded-xl border border-slate-300 bg-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Teaching Activities Completed</label>
                        <textarea
                          rows={2}
                          value={editingClassItem.teachingActivitiesCompleted}
                          onChange={(e) =>
                            setEditingClassItem({ ...editingClassItem, teachingActivitiesCompleted: e.target.value })
                          }
                          className="w-full px-2.5 py-2 rounded-xl border border-slate-300 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Syllabus Units Covered</label>
                        <textarea
                          rows={2}
                          value={editingClassItem.syllabusDetails}
                          onChange={(e) => setEditingClassItem({ ...editingClassItem, syllabusDetails: e.target.value })}
                          className="w-full px-2.5 py-2 rounded-xl border border-slate-300 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Learning Outcomes Achieved</label>
                        <textarea
                          rows={2}
                          value={editingClassItem.learningOutcomesAchieved}
                          onChange={(e) =>
                            setEditingClassItem({ ...editingClassItem, learningOutcomesAchieved: e.target.value })
                          }
                          className="w-full px-2.5 py-2 rounded-xl border border-slate-300 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Student Assessment &amp; Evaluation</label>
                        <textarea
                          rows={2}
                          value={editingClassItem.studentAssessmentDetails}
                          onChange={(e) =>
                            setEditingClassItem({ ...editingClassItem, studentAssessmentDetails: e.target.value })
                          }
                          className="w-full px-2.5 py-2 rounded-xl border border-slate-300 bg-white"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block font-bold text-slate-700 mb-1">Remedial Teaching Activities</label>
                        <input
                          type="text"
                          value={editingClassItem.remedialTeachingActivities}
                          onChange={(e) =>
                            setEditingClassItem({ ...editingClassItem, remedialTeachingActivities: e.target.value })
                          }
                          placeholder="Detail extra sessions held for slow learners / foundational gaps"
                          className="w-full px-2.5 py-2 rounded-xl border border-slate-300 bg-white"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingClassItem(null)}
                        className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-300 font-bold text-slate-700"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveClassTeaching}
                        className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold"
                      >
                        Save Class Entry
                      </button>
                    </div>
                  </div>
                )}

                {/* Existing Class Teaching Cards */}
                <div className="space-y-2.5">
                  {editingReport.classTeachingDetails.map((cls) => (
                    <div key={cls.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 flex flex-col md:flex-row md:items-start justify-between gap-3 text-xs">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded-lg bg-indigo-600 text-white font-extrabold">
                            Class {cls.classNumber}-{cls.section}
                          </span>
                          <span className="font-extrabold text-slate-900 text-sm">{cls.subject}</span>
                          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono font-bold text-[11px]">
                            Periods: {cls.periodsConducted}/{cls.periodsAllotted}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-mono font-bold text-[11px]">
                            Syllabus: {cls.syllabusCoveredPct}%
                          </span>
                        </div>
                        <p className="text-slate-600">
                          <strong>Timetable:</strong> {cls.classTimetable || '—'}
                        </p>
                        {cls.teachingActivitiesCompleted && (
                          <p className="text-slate-600">
                            <strong>Activities:</strong> {cls.teachingActivitiesCompleted}
                          </p>
                        )}
                        {cls.learningOutcomesAchieved && (
                          <p className="text-slate-600">
                            <strong>Outcomes:</strong> {cls.learningOutcomesAchieved}
                          </p>
                        )}
                        {cls.remedialTeachingActivities && (
                          <p className="text-indigo-700">
                            <strong>Remedial:</strong> {cls.remedialTeachingActivities}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setEditingClassItem({ ...cls })}
                          className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-indigo-50 text-indigo-700 font-bold inline-flex items-center gap-1"
                        >
                          <Edit2 className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteClassTeaching(cls.id)}
                          className="p-1.5 rounded-lg bg-white border border-rose-200 hover:bg-rose-50 text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setFormStepTab('teacher-info')}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormStepTab('part-b-assignments')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold"
                  >
                    <span>Next: Part B — School Assignments</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* TAB 3: PART B — SCHOOL TIMETABLE & OTHER ASSIGNMENTS (ADD / EDIT / DELETE) */}
            {formStepTab === 'part-b-assignments' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">
                      Part B: School Timetable, Assembly, Exam, MDM, Co-Curricular &amp; Official Assignments
                    </h3>
                    <p className="text-xs text-slate-500">
                      Add, edit, or delete every timetable duty and additional responsibility assigned by the Head of Institution.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setEditingAssignmentItem({
                        id: `asg-${Date.now()}`,
                        category: 'Morning Assembly Duties',
                        title: '',
                        scheduleOrPeriod: '',
                        description: '',
                        assignedBy: school.headTeacherName || 'Head of Institution',
                        completionStatus: 'Ongoing',
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Assignment / Duty</span>
                  </button>
                </div>

                {editingAssignmentItem && (
                  <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-amber-900">Assignment / Duty Details</span>
                      <button type="button" onClick={() => setEditingAssignmentItem(null)}>
                        <X className="w-4 h-4 text-slate-500" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Duty Category *</label>
                        <select
                          value={editingAssignmentItem.category}
                          onChange={(e) =>
                            setEditingAssignmentItem({
                              ...editingAssignmentItem,
                              category: e.target.value as JkepmAssignmentCategory,
                            })
                          }
                          className="w-full px-2.5 py-2 rounded-xl border border-slate-300 bg-white"
                        >
                          {ASSIGNMENT_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Assignment Title *</label>
                        <input
                          type="text"
                          value={editingAssignmentItem.title}
                          onChange={(e) => setEditingAssignmentItem({ ...editingAssignmentItem, title: e.target.value })}
                          placeholder="e.g. Exam Invigilation & Script Checking"
                          className="w-full px-2.5 py-2 rounded-xl border border-slate-300 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Schedule / Period</label>
                        <input
                          type="text"
                          value={editingAssignmentItem.scheduleOrPeriod}
                          onChange={(e) =>
                            setEditingAssignmentItem({ ...editingAssignmentItem, scheduleOrPeriod: e.target.value })
                          }
                          placeholder="e.g. Mon–Sat 08:45 AM / Oct 12–18"
                          className="w-full px-2.5 py-2 rounded-xl border border-slate-300 bg-white"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Assigned By</label>
                          <input
                            type="text"
                            value={editingAssignmentItem.assignedBy}
                            onChange={(e) =>
                              setEditingAssignmentItem({ ...editingAssignmentItem, assignedBy: e.target.value })
                            }
                            className="w-full px-2.5 py-2 rounded-xl border border-slate-300 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Status</label>
                          <select
                            value={editingAssignmentItem.completionStatus}
                            onChange={(e) =>
                              setEditingAssignmentItem({
                                ...editingAssignmentItem,
                                completionStatus: e.target.value as 'Ongoing' | 'Completed' | 'Scheduled',
                              })
                            }
                            className="w-full px-2.5 py-2 rounded-xl border border-slate-300 bg-white"
                          >
                            <option value="Ongoing">Ongoing</option>
                            <option value="Completed">Completed</option>
                            <option value="Scheduled">Scheduled</option>
                          </select>
                        </div>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block font-bold text-slate-700 mb-1">Work Accomplished / Description</label>
                        <textarea
                          rows={2}
                          value={editingAssignmentItem.description}
                          onChange={(e) =>
                            setEditingAssignmentItem({ ...editingAssignmentItem, description: e.target.value })
                          }
                          className="w-full px-2.5 py-2 rounded-xl border border-slate-300 bg-white"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingAssignmentItem(null)}
                        className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-300 font-bold text-slate-700"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveAssignment}
                        className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold"
                      >
                        Save Assignment
                      </button>
                    </div>
                  </div>
                )}

                {editingReport.schoolAssignments.length === 0 ? (
                  <div className="p-6 text-center rounded-2xl border border-dashed border-slate-300 text-xs text-slate-500">
                    No school assignments added yet. Click &ldquo;Add Assignment / Duty&rdquo; to record assembly, examination, MDM, sports, or election duties.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {editingReport.schoolAssignments.map((asg) => (
                      <div key={asg.id} className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-xs">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[10px]">
                              {asg.category}
                            </span>
                            <span className="font-extrabold text-slate-900">{asg.title}</span>
                            <span className="px-2 py-0.5 rounded-full bg-white border border-slate-300 text-[10px] font-bold text-slate-600">
                              {asg.completionStatus}
                            </span>
                          </div>
                          <p className="text-slate-600">
                            {asg.scheduleOrPeriod ? `Schedule: ${asg.scheduleOrPeriod} • ` : ''}Assigned by: {asg.assignedBy}
                          </p>
                          {asg.description && <p className="text-slate-600">{asg.description}</p>}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => setEditingAssignmentItem({ ...asg })}
                            className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-indigo-700 font-bold inline-flex items-center gap-1"
                          >
                            <Edit2 className="w-3.5 h-3.5" /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteAssignment(asg.id)}
                            className="p-1.5 rounded-lg bg-white border border-rose-200 text-rose-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setFormStepTab('part-a-teaching')}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormStepTab('part-c-attendance')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold"
                  >
                    <span>Next: Part C — Attendance &amp; Leaves</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* TAB 4: PART C — ATTENDANCE, LEAVE SANCTION ORDERS & SUPPORTING DOCUMENTS */}
            {formStepTab === 'part-c-attendance' && (() => {
              const att = recalculateAttendanceLeaveSummary(editingReport.attendanceAndLeave);
              const updateAtt = (patch: Partial<JkepmAttendanceLeaveSummary>) => {
                setEditingReport({
                  ...editingReport,
                  attendanceAndLeave: recalculateAttendanceLeaveSummary({
                    ...editingReport.attendanceAndLeave,
                    ...patch,
                  }),
                });
              };
              const liveErrors = validateJkepmAttendanceAndLeave(att);

              return (
                <div className="space-y-5 text-xs">
                  {/* Auto-Calculated KPI Strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Working Days</span>
                      <p className="text-xl font-extrabold text-slate-900 mt-0.5">{att.totalWorkingDays}</p>
                    </div>
                    <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200">
                      <span className="text-[10px] font-bold text-emerald-700 uppercase">Days Attended</span>
                      <p className="text-xl font-extrabold text-emerald-800 mt-0.5">{att.totalDaysAttended}</p>
                    </div>
                    <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200">
                      <span className="text-[10px] font-bold text-amber-800 uppercase">Total Leave Days (Auto)</span>
                      <p className="text-xl font-extrabold text-amber-900 mt-0.5">{att.totalLeaveDays}</p>
                    </div>
                    <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-200">
                      <span className="text-[10px] font-bold text-indigo-700 uppercase">Attendance % (Auto)</span>
                      <p className="text-xl font-extrabold text-indigo-800 mt-0.5">{att.attendancePercentage}%</p>
                    </div>
                  </div>

                  {liveErrors.length > 0 && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-semibold space-y-0.5">
                      {liveErrors.map((e, i) => (
                        <p key={i}>• {e}</p>
                      ))}
                    </div>
                  )}

                  {/* All 11 Mandatory Attendance & Leave Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">1. Total Working Days *</label>
                      <input
                        type="number"
                        min={1}
                        max={366}
                        value={att.totalWorkingDays}
                        onChange={(e) => updateAtt({ totalWorkingDays: Number(e.target.value) || 0 })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">2. Total Days School Attended *</label>
                      <input
                        type="number"
                        min={0}
                        max={366}
                        value={att.totalDaysAttended}
                        onChange={(e) => updateAtt({ totalDaysAttended: Number(e.target.value) || 0 })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">3. Casual Leaves (CL)</label>
                      <input
                        type="number"
                        min={0}
                        value={att.casualLeaves}
                        onChange={(e) => updateAtt({ casualLeaves: Number(e.target.value) || 0 })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">4. Medical Leaves (ML)</label>
                      <input
                        type="number"
                        min={0}
                        value={att.medicalLeaves}
                        onChange={(e) => updateAtt({ medicalLeaves: Number(e.target.value) || 0 })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">5. Earned Leave (EL)</label>
                      <input
                        type="number"
                        min={0}
                        value={att.earnedLeaves}
                        onChange={(e) => updateAtt({ earnedLeaves: Number(e.target.value) || 0 })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">6. Other Types of Leave</label>
                      <input
                        type="number"
                        min={0}
                        value={att.otherLeaves}
                        onChange={(e) => updateAtt({ otherLeaves: Number(e.target.value) || 0 })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">7a. Leave Period From</label>
                      <input
                        type="date"
                        value={att.leavePeriodFrom}
                        onChange={(e) => updateAtt({ leavePeriodFrom: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">7b. Leave Period To</label>
                      <input
                        type="date"
                        value={att.leavePeriodTo}
                        onChange={(e) => updateAtt({ leavePeriodTo: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">8. Medical Leave Sanction Order No.</label>
                      <input
                        type="text"
                        value={att.medicalSanctionOrderNumber}
                        onChange={(e) => updateAtt({ medicalSanctionOrderNumber: e.target.value })}
                        placeholder="e.g. HOI/GMS-PC/ML/2026/114"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">9. Medical Leave Sanction Order Date</label>
                      <input
                        type="date"
                        value={att.medicalSanctionOrderDate}
                        onChange={(e) => updateAtt({ medicalSanctionOrderDate: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">10. Casual Leave Sanction Order No.</label>
                      <input
                        type="text"
                        value={att.casualSanctionOrderNumber}
                        onChange={(e) => updateAtt({ casualSanctionOrderNumber: e.target.value })}
                        placeholder="e.g. HOI/GMS-PC/CL/2026/089"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">11. Remarks</label>
                      <input
                        type="text"
                        value={att.remarks}
                        onChange={(e) => updateAtt({ remarks: e.target.value })}
                        placeholder="Medical fitness or substitution remarks"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300"
                      />
                    </div>
                  </div>

                  {/* Itemized Leave Records CRUD */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-extrabold text-slate-900">
                        Itemized Leave Records ({att.leaveRecords.length}) — Add / Edit / Delete
                      </h4>
                      <button
                        type="button"
                        onClick={() =>
                          setEditingLeaveItem({
                            id: `lv-${Date.now()}`,
                            leaveType: 'Casual_Leave',
                            days: 1,
                            fromDate: new Date().toISOString().slice(0, 10),
                            toDate: new Date().toISOString().slice(0, 10),
                            medicalSanctionOrderNo: '',
                            medicalSanctionOrderDate: '',
                            casualSanctionOrderNo: '',
                            remarks: '',
                            supportingDocuments: [],
                          })
                        }
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-600 text-white font-bold"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Leave Record
                      </button>
                    </div>

                    {editingLeaveItem && (
                      <div className="p-3.5 rounded-xl bg-white border border-indigo-200 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                          <div>
                            <label className="block font-bold text-slate-700 mb-1">Leave Type</label>
                            <select
                              value={editingLeaveItem.leaveType}
                              onChange={(e) =>
                                setEditingLeaveItem({
                                  ...editingLeaveItem,
                                  leaveType: e.target.value as JkepmLeaveCategory,
                                })
                              }
                              className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white"
                            >
                              <option value="Casual_Leave">Casual Leave (CL)</option>
                              <option value="Medical_Leave">Medical Leave (ML)</option>
                              <option value="Earned_Leave">Earned Leave (EL)</option>
                              <option value="Other_Leave">Other Leave</option>
                            </select>
                          </div>
                          <div>
                            <label className="block font-bold text-slate-700 mb-1">Days</label>
                            <input
                              type="number"
                              min={1}
                              value={editingLeaveItem.days}
                              onChange={(e) =>
                                setEditingLeaveItem({ ...editingLeaveItem, days: Math.max(1, Number(e.target.value) || 1) })
                              }
                              className="w-full px-2 py-1.5 rounded-lg border border-slate-300 font-mono"
                            />
                          </div>
                          <div>
                            <label className="block font-bold text-slate-700 mb-1">From Date</label>
                            <input
                              type="date"
                              value={editingLeaveItem.fromDate}
                              onChange={(e) => setEditingLeaveItem({ ...editingLeaveItem, fromDate: e.target.value })}
                              className="w-full px-2 py-1.5 rounded-lg border border-slate-300"
                            />
                          </div>
                          <div>
                            <label className="block font-bold text-slate-700 mb-1">To Date</label>
                            <input
                              type="date"
                              value={editingLeaveItem.toDate}
                              onChange={(e) => setEditingLeaveItem({ ...editingLeaveItem, toDate: e.target.value })}
                              className="w-full px-2 py-1.5 rounded-lg border border-slate-300"
                            />
                          </div>
                          {editingLeaveItem.leaveType === 'Medical_Leave' ? (
                            <>
                              <div className="sm:col-span-2">
                                <label className="block font-bold text-slate-700 mb-1">Medical Sanction Order No. *</label>
                                <input
                                  type="text"
                                  value={editingLeaveItem.medicalSanctionOrderNo || ''}
                                  onChange={(e) =>
                                    setEditingLeaveItem({ ...editingLeaveItem, medicalSanctionOrderNo: e.target.value })
                                  }
                                  className="w-full px-2 py-1.5 rounded-lg border border-slate-300 font-mono"
                                />
                              </div>
                              <div className="sm:col-span-2">
                                <label className="block font-bold text-slate-700 mb-1">Medical Order Date</label>
                                <input
                                  type="date"
                                  value={editingLeaveItem.medicalSanctionOrderDate || ''}
                                  onChange={(e) =>
                                    setEditingLeaveItem({ ...editingLeaveItem, medicalSanctionOrderDate: e.target.value })
                                  }
                                  className="w-full px-2 py-1.5 rounded-lg border border-slate-300"
                                />
                              </div>
                            </>
                          ) : (
                            <div className="sm:col-span-2">
                              <label className="block font-bold text-slate-700 mb-1">Sanction Order No. (Optional)</label>
                              <input
                                type="text"
                                value={editingLeaveItem.casualSanctionOrderNo || ''}
                                onChange={(e) =>
                                  setEditingLeaveItem({ ...editingLeaveItem, casualSanctionOrderNo: e.target.value })
                                }
                                className="w-full px-2 py-1.5 rounded-lg border border-slate-300 font-mono"
                              />
                            </div>
                          )}
                          <div className="sm:col-span-2">
                            <label className="block font-bold text-slate-700 mb-1">Remarks</label>
                            <input
                              type="text"
                              value={editingLeaveItem.remarks}
                              onChange={(e) => setEditingLeaveItem({ ...editingLeaveItem, remarks: e.target.value })}
                              className="w-full px-2 py-1.5 rounded-lg border border-slate-300"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingLeaveItem(null)}
                            className="px-3 py-1 rounded-lg bg-slate-100 font-bold text-slate-600"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveLeaveEntry}
                            className="px-3.5 py-1 rounded-lg bg-indigo-600 text-white font-bold"
                          >
                            Save Leave Entry
                          </button>
                        </div>
                      </div>
                    )}

                    {att.leaveRecords.length > 0 && (
                      <div className="space-y-1.5">
                        {att.leaveRecords.map((lv) => (
                          <div key={lv.id} className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-2">
                            <div>
                              <span className="font-extrabold text-slate-900">
                                {lv.leaveType.replace(/_/g, ' ')} ({lv.days} day{lv.days === 1 ? '' : 's'})
                              </span>
                              <span className="ml-2 font-mono text-[11px] text-slate-500">
                                {lv.fromDate} → {lv.toDate}
                              </span>
                              {(lv.medicalSanctionOrderNo || lv.casualSanctionOrderNo) && (
                                <span className="ml-2 px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-mono text-[10px]">
                                  Order: {lv.medicalSanctionOrderNo || lv.casualSanctionOrderNo}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setEditingLeaveItem({ ...lv })}
                                className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-600"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteLeaveEntry(lv.id)}
                                className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-600"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Supporting Document Upload */}
                  <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-200 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h4 className="font-extrabold text-indigo-950 flex items-center gap-1.5">
                          <Paperclip className="w-4 h-4 text-indigo-600" />
                          <span>Supporting Documents ({att.supportingDocuments.length})</span>
                        </h4>
                        <p className="text-[11px] text-slate-600">
                          Upload Medical Certificates, Leave Sanction Orders, or Official Permission Letters (PDF/JPG/PNG, max 5MB).
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={docUploadType}
                          onChange={(e) => setDocUploadType(e.target.value as JkepmSupportingDocument['docType'])}
                          className="px-2.5 py-1.5 rounded-xl border border-indigo-200 bg-white text-xs font-semibold"
                        >
                          <option value="Medical Certificate">Medical Certificate</option>
                          <option value="Leave Sanction Order">Leave Sanction Order</option>
                          <option value="Official Permission Letter">Official Permission Letter</option>
                          <option value="Other">Other Supporting Document</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => docFileInputRef.current?.click()}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                        >
                          <Upload className="w-3.5 h-3.5" /> Upload
                        </button>
                        <input
                          ref={docFileInputRef}
                          type="file"
                          accept=".pdf,image/*"
                          onChange={handleSupportingDocUpload}
                          className="hidden"
                        />
                      </div>
                    </div>

                    {att.supportingDocuments.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {att.supportingDocuments.map((doc) => (
                          <div
                            key={doc.id}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-indigo-200 text-[11px]"
                          >
                            <FileText className="w-3.5 h-3.5 text-indigo-600" />
                            <span className="font-bold text-slate-800">{doc.docType}:</span>
                            <span className="text-slate-600">{doc.name}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveSupportingDoc(doc.id)}
                              className="text-rose-500 hover:text-rose-700"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Teacher Declaration & Final Submit */}
                  <label className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingReport.teacherDeclarationAccepted}
                      onChange={(e) =>
                        setEditingReport({ ...editingReport, teacherDeclarationAccepted: e.target.checked })
                      }
                      className="mt-0.5 w-4 h-4 accent-emerald-600"
                    />
                    <span className="text-xs text-emerald-950 leading-relaxed">
                      <strong>Teacher Declaration:</strong> I solemnly certify that the class-wise teaching records, timetable,
                      school assignments, working days ({att.totalWorkingDays}), attendance ({att.attendancePercentage}%), and leave
                      sanction order details entered under updated CPIS Code <strong className="font-mono">{editingReport.cpisCode}</strong>{' '}
                      are accurate and verifiable from school records.
                    </span>
                  </label>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setFormStepTab('part-b-assignments')}
                      className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                    >
                      ← Back
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => persistReport(editingReport, false)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold"
                      >
                        <Save className="w-4 h-4 text-amber-300" />
                        <span>Save as Draft</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => persistReport(editingReport, true)}
                        className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold shadow-md"
                      >
                        <Send className="w-4 h-4" />
                        <span>Final Submit Report</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SECTION 4: SUBMITTED REPORTS, STATUS, PRINT, DOWNLOAD & SHARE         */}
      {/* ===================================================================== */}
      {activeSection === 'submitted-reports' && (() => {
        const allSessions = Array.from(new Set(activeReports.map((r) => r.academicSession).filter(Boolean)));
        const q = teacherSearchQuery.trim().toLowerCase();
        const filteredAllReports = activeReports.filter((rep) => {
          if (teacherQuarterFilter !== 'ALL' && rep.quarter !== teacherQuarterFilter) return false;
          if (teacherSessionFilter !== 'ALL' && rep.academicSession !== teacherSessionFilter) return false;
          if (teacherStatusFilter !== 'ALL' && rep.status !== teacherStatusFilter) return false;
          if (q) {
            const hay = [
              rep.teacherName,
              rep.cpisCode,
              rep.quarter,
              rep.academicSession,
              rep.status.replace(/_/g, ' '),
              rep.reportingPeriod,
            ]
              .join(' ')
              .toLowerCase();
            if (!hay.includes(q)) return false;
          }
          return true;
        });

        return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  All Quarterly Self-Assessment &amp; Appraisal Reports ({filteredAllReports.length} of {activeReports.length})
                </h2>
                <p className="text-xs text-slate-500">
                  Search &amp; filter by quarter, session, or status • View, Edit, Export Excel/PDF, Print, or Share.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    if (filteredAllReports.length === 0) {
                      showToast('No matching reports to export to Excel.', 'info');
                      return;
                    }
                    exportTeacherJkepmExcel({
                      reports: filteredAllReports,
                      teacherName: activeTeacher?.name || currentUser.name,
                      cpisCode: activeTeacher?.employeeId || NEW_CPIS_CODE_OFFICIAL,
                      school,
                    });
                    showToast(`Exported ${filteredAllReports.length} quarterly appraisal report(s) to Excel (.xlsx).`);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold"
                >
                  <FileSpreadsheet className="w-4 h-4" /> Export to Excel
                </button>
                <button
                  type="button"
                  onClick={handleStartNewReport}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold"
                >
                  <Plus className="w-4 h-4" /> New Quarterly Report
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={teacherSearchQuery}
                  onChange={(e) => setTeacherSearchQuery(e.target.value)}
                  placeholder="Search teacher, CPIS, quarter, status..."
                  className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none"
                />
              </div>
              <select
                value={teacherQuarterFilter}
                onChange={(e) => setTeacherQuarterFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold bg-white"
              >
                <option value="ALL">All Quarters (Q1–Q4)</option>
                {JKEPM_QUARTERS.map((qOpt) => (
                  <option key={qOpt} value={qOpt}>
                    {qOpt}
                  </option>
                ))}
              </select>
              <select
                value={teacherSessionFilter}
                onChange={(e) => setTeacherSessionFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold bg-white"
              >
                <option value="ALL">All Academic Sessions</option>
                {allSessions.map((sess) => (
                  <option key={sess} value={sess}>
                    {sess}
                  </option>
                ))}
              </select>
              <select
                value={teacherStatusFilter}
                onChange={(e) => setTeacherStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold bg-white"
              >
                <option value="ALL">All Statuses</option>
                <option value="Draft">Draft</option>
                <option value="Submitted">Submitted</option>
                <option value="Returned_For_Correction">Returned For Correction</option>
                <option value="Recommended_By_HOI">Recommended By HOI</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Teacher &amp; Updated CPIS</th>
                  <th className="py-3 px-4">Quarter &amp; Session</th>
                  <th className="py-3 px-4">Teaching / Duties</th>
                  <th className="py-3 px-4">Attendance &amp; Leaves</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions (View / Edit / PDF / Excel / Delete)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAllReports.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      No quarterly appraisal reports match your search filters.
                    </td>
                  </tr>
                ) : filteredAllReports.map((rep) => (
                  <tr key={rep.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4">
                      <p className="font-extrabold text-slate-900">{rep.teacherName}</p>
                      <p className="font-mono text-[11px] text-emerald-700 font-bold">{rep.cpisCode}</p>
                      {rep.previousCpisCode && (
                        <p className="font-mono text-[10px] text-slate-400">Old: {rep.previousCpisCode}</p>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-800">{rep.quarter}</p>
                      <p className="text-[11px] text-slate-500">{rep.academicSession}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-800">{rep.classTeachingDetails.length} Class(es)</p>
                      <p className="text-[11px] text-slate-500">{rep.schoolAssignments.length} Assignment(s)</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-mono font-bold text-indigo-700">
                        {rep.attendanceAndLeave.attendancePercentage}% ({rep.attendanceAndLeave.totalDaysAttended}/{rep.attendanceAndLeave.totalWorkingDays})
                      </p>
                      <p className="text-[11px] text-slate-500">
                        CL: {rep.attendanceAndLeave.casualLeaves} • ML: {rep.attendanceAndLeave.medicalLeaves}
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${statusBadgeStyles[rep.status]}`}>
                        {rep.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setViewingReport(rep)}
                          title="View Full Appraisal"
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEditReport(rep)}
                          title="Edit Report"
                          className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => generateJkepmAppraisalPdf(rep, school, 'download')}
                          title="Download Quarterly PDF"
                          className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            exportTeacherJkepmExcel({
                              reports: [rep],
                              teacherName: rep.teacherName,
                              cpisCode: rep.cpisCode,
                              school,
                              singleReport: rep,
                            });
                            showToast(`Exported ${rep.quarter} appraisal to Excel (.xlsx).`);
                          }}
                          title="Export Quarterly Report to Excel"
                          className="p-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => generateJkepmAppraisalPdf(rep, school, 'print')}
                          title="Print Quarterly PDF"
                          className="p-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleShareReportPdf(rep)}
                          title="Share PDF"
                          className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingReport(rep)}
                          title="Delete Report (Confirmation Required)"
                          className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
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

      {/* ===================================================================== */}
      {/* SECTION 5: HEAD OF INSTITUTION / PRINCIPAL VERIFICATION DASHBOARD     */}
      {/* ===================================================================== */}
      {activeSection === 'hoi-dashboard' && (
        <div className="space-y-5">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-indigo-600" />
                <span>Head of Institution / Principal Verification Dashboard</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Verify class-wise teaching, check CL/ML sanction orders, add HOI remarks, return for correction, recommend, or approve.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() =>
                  generateConsolidatedJkepmPdf(activeReports, school, `${school.name} — HOI Consolidated JKEPM Register`)
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold"
              >
                <Download className="w-3.5 h-3.5 text-amber-300" />
                <span>Consolidated School PDF</span>
              </button>
            </div>
          </div>

          {!isHoiUser && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                You are currently signed in as <strong>Teacher</strong>. Switch to <strong>Principal / Headmaster</strong> or{' '}
                <strong>Administrator</strong> role in the top header to approve, recommend, or return submissions.
              </span>
            </div>
          )}

          <div className="space-y-3">
            {activeReports.map((rep) => (
              <div key={rep.id} className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3 text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-sm text-slate-900">{rep.teacherName}</span>
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono font-bold text-[11px]">
                        CPIS: {rep.cpisCode}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[11px]">
                        {rep.quarter}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${statusBadgeStyles[rep.status]}`}>
                        {rep.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {rep.designation} • Classes: {rep.classTeachingDetails.map((c) => `Cl ${c.classNumber}-${c.section} (${c.subject})`).join(', ') || 'None'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setViewingReport(rep)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold inline-flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" /> Inspect
                    </button>
                    <button
                      type="button"
                      onClick={() => generateJkepmAppraisalPdf(rep, school, 'download')}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold inline-flex items-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5" /> PDF
                    </button>
                    {isHoiUser && (
                      <button
                        type="button"
                        onClick={() => {
                          setReviewingReport(rep);
                          setReviewRemarksInput(rep.hoiRemarks || '');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold inline-flex items-center gap-1"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" /> Verify / Decide
                      </button>
                    )}
                  </div>
                </div>

                {/* Attendance & Leave Order Verification Strip */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px]">
                  <div>
                    <span className="text-slate-500">Attendance:</span>{' '}
                    <strong className="text-indigo-800">
                      {rep.attendanceAndLeave.totalDaysAttended}/{rep.attendanceAndLeave.totalWorkingDays} ({rep.attendanceAndLeave.attendancePercentage}%)
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500">CL / ML Sanction Orders:</span>{' '}
                    <strong className="font-mono text-slate-800">
                      {rep.attendanceAndLeave.casualSanctionOrderNumber || 'N/A'} | {rep.attendanceAndLeave.medicalSanctionOrderNumber || 'N/A'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Documents Attached:</span>{' '}
                    <strong className="text-emerald-700">{rep.attendanceAndLeave.supportingDocuments.length} file(s)</strong>
                  </div>
                </div>

                {rep.hoiRemarks && (
                  <p className="text-[11px] text-slate-700 bg-indigo-50/50 px-3 py-2 rounded-xl border border-indigo-100">
                    <strong>HOI Observation ({rep.hoiReviewerName || 'Principal'}):</strong> {rep.hoiRemarks}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SECTION 6: DISTRICT / ADMINISTRATIVE MONITORING DASHBOARD             */}
      {/* ===================================================================== */}
      {activeSection === 'district-dashboard' && (
        <div className="space-y-5">
          {/* District Action Bar */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-indigo-600" />
                  <span>District / Administrative Monitoring &amp; Audit Dashboard</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Search by Name, Employee ID, CPIS Code, or School U-DISE • Track Pending Submissions • Export PDF/Excel • Backup &amp; Audit Log
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    exportJkepmConsolidatedExcel({
                      reports: filteredDistrictReports,
                      teachers,
                      cpisMigrations,
                      auditLogs,
                      school,
                      activeQuarter: monitoringQuarter,
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-sm"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Export District Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    generateConsolidatedJkepmPdf(
                      filteredDistrictReports,
                      school,
                      'District / ZEO Consolidated JKEPM Appraisal Summary'
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>Export District PDF</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadJsonBackup}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-300"
                >
                  <Download className="w-3.5 h-3.5" /> Backup JSON
                </button>
                <button
                  type="button"
                  onClick={() => backupFileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-300"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Restore
                </button>
                <input
                  ref={backupFileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleRestoreJsonBackup}
                  className="hidden"
                />
              </div>
            </div>

            {/* Search Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={districtSearchQuery}
                  onChange={(e) => setDistrictSearchQuery(e.target.value)}
                  placeholder="Search Name, Employee ID or CPIS..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300"
                />
              </div>
              <input
                type="text"
                value={districtUdiseFilter}
                onChange={(e) => setDistrictUdiseFilter(e.target.value)}
                placeholder={`Filter by School U-DISE (e.g. ${school.code})`}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
              />
              <select
                value={districtQuarterFilter}
                onChange={(e) => setDistrictQuarterFilter(e.target.value as JkepmQuarter | 'ALL')}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold"
              >
                <option value="ALL">All Quarters (Q1–Q4)</option>
                {JKEPM_QUARTERS.map((q) => (
                  <option key={q} value={q}>{q}</option>
                ))}
              </select>
              <select
                value={districtStatusFilter}
                onChange={(e) => setDistrictStatusFilter(e.target.value as JkepmAppraisalStatus | 'ALL')}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold"
              >
                <option value="ALL">All Submission Statuses</option>
                <option value="Draft">Draft</option>
                <option value="Submitted">Submitted</option>
                <option value="Returned_For_Correction">Returned For Correction</option>
                <option value="Recommended_By_HOI">Recommended By HOI</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
          </div>

          {/* Pending Submissions & Attendance Summary Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-slate-900">
                  Pending Submissions — {monitoringQuarter} ({pendingSubmissionTeachers.length})
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold">
                  {teachers.length - pendingSubmissionTeachers.length}/{teachers.length} Submitted
                </span>
              </div>
              {pendingSubmissionTeachers.length === 0 ? (
                <p className="text-xs text-emerald-700 font-bold bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                  All school teachers have submitted their {monitoringQuarter} JKEPM self-assessment.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 text-xs">
                  {pendingSubmissionTeachers.map((tc) => (
                    <div key={tc.id} className="py-2.5 flex items-center justify-between gap-2">
                      <div>
                        <p className="font-bold text-slate-900">{tc.name}</p>
                        <p className="text-[11px] text-slate-500 font-mono">
                          CPIS: {tc.employeeId} • {tc.designation}
                        </p>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                        Pending
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Complete System Audit Log */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-600" />
                <span>Immutable Audit Trail ({auditLogs.length} Events)</span>
              </h3>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1 text-xs">
                {auditLogs.slice(0, 20).map((log) => (
                  <div key={log.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 font-mono text-[10px] font-bold">
                        {log.action}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-800 font-medium">{log.summary}</p>
                    <p className="text-[10px] text-slate-500">
                      User: {log.userName} ({log.userId} • {log.userRole})
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Filtered District Results Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900">
                Matching School &amp; District Appraisal Records ({filteredDistrictReports.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase text-slate-600">
                  <tr>
                    <th className="py-3 px-4">Teacher / CPIS</th>
                    <th className="py-3 px-4">School &amp; U-DISE</th>
                    <th className="py-3 px-4">Quarter</th>
                    <th className="py-3 px-4">Attendance %</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">District Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDistrictReports.map((rep) => (
                    <tr key={rep.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4">
                        <p className="font-bold text-slate-900">{rep.teacherName}</p>
                        <p className="font-mono text-[11px] text-emerald-700 font-bold">{rep.cpisCode}</p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-800">{rep.schoolName}</p>
                        <p className="font-mono text-[11px] text-slate-500">{rep.schoolUdiseCode}</p>
                      </td>
                      <td className="py-3 px-4 font-semibold">{rep.quarter}</td>
                      <td className="py-3 px-4 font-mono font-bold text-indigo-700">
                        {rep.attendanceAndLeave.attendancePercentage}%
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${statusBadgeStyles[rep.status]}`}>
                          {rep.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setViewingReport(rep)}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold"
                          >
                            View
                          </button>
                          {isAdminUser && rep.status !== 'Approved' && (
                            <button
                              type="button"
                              onClick={() =>
                                handleWorkflowTransition(
                                  rep,
                                  'Approved',
                                  'Verified and finally approved at District / ZEO administrative desk.',
                                  'district'
                                )
                              }
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                            >
                              Final Approve
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SECTION 7: HELP & SUPPORT FOR TEACHERS                                */}
      {/* ===================================================================== */}
      {activeSection === 'help' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 text-xs">
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-indigo-600" />
            <span>Teacher Quick Guide — CPIS Code Updation &amp; JKEPM Quarterly Reporting</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
              <h3 className="font-extrabold text-slate-900">1. CPIS Code Change Verification</h3>
              <p className="text-slate-600 leading-relaxed">
                Legacy CPIS Code <span className="font-mono font-bold text-rose-700">{OLD_CPIS_CODE_LEGACY}</span> has been
                officially migrated to <span className="font-mono font-bold text-emerald-700">{NEW_CPIS_CODE_OFFICIAL}</span>.
                All teacher profiles, leave applications, and quarterly appraisal submissions automatically reflect the new CPIS Code
                while preserving the old code in the immutable audit trail.
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
              <h3 className="font-extrabold text-slate-900">2. Submitting Your Quarterly Appraisal</h3>
              <p className="text-slate-600 leading-relaxed">
                Click <strong>Add New Quarterly Report</strong>, verify your 10 teacher particulars, add each class/subject taught
                in <strong>Part A</strong>, log timetable/assembly/MDM/exam duties in <strong>Part B</strong>, enter working days
                &amp; CL/ML sanction order numbers with supporting PDFs/photos in <strong>Part C</strong>, save as draft anytime,
                or complete OTP verification for <strong>Final Submit</strong>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: VIEW FULL APPRAISAL REPORT                                     */}
      {/* ===================================================================== */}
      {viewingReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold">
                  JKEPM Quarterly Appraisal — {viewingReport.teacherName} ({viewingReport.quarter})
                </h3>
                <p className="text-[11px] text-emerald-300 font-mono">
                  Updated CPIS: {viewingReport.cpisCode}
                  {viewingReport.previousCpisCode ? ` (Legacy: ${viewingReport.previousCpisCode})` : ''}
                </p>
              </div>
              <button type="button" onClick={() => setViewingReport(null)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <div><span className="text-slate-500 block">School</span><strong>{viewingReport.schoolName}</strong></div>
                <div><span className="text-slate-500 block">U-DISE Code</span><strong className="font-mono">{viewingReport.schoolUdiseCode}</strong></div>
                <div><span className="text-slate-500 block">Reporting Period</span><strong>{viewingReport.reportingPeriod}</strong></div>
                <div><span className="text-slate-500 block">Designation</span><strong>{viewingReport.designation}</strong></div>
                <div><span className="text-slate-500 block">Date of Joining</span><strong>{viewingReport.dateOfJoining}</strong></div>
                <div><span className="text-slate-500 block">Status &amp; Score</span><strong>{viewingReport.status.replace(/_/g, ' ')} ({viewingReport.selfAssessmentScore}/10)</strong></div>
              </div>

              <div>
                <h4 className="font-extrabold text-slate-900 mb-2">Part A: Class-Wise Teaching ({viewingReport.classTeachingDetails.length})</h4>
                <div className="space-y-2">
                  {viewingReport.classTeachingDetails.map((c) => (
                    <div key={c.id} className="p-3 rounded-xl border border-slate-200 bg-white space-y-1">
                      <p className="font-extrabold text-indigo-900">
                        Class {c.classNumber}-{c.section} • {c.subject} ({c.periodsConducted}/{c.periodsAllotted} periods • {c.syllabusCoveredPct}% syllabus)
                      </p>
                      <p className="text-slate-600">Timetable: {c.classTimetable}</p>
                      <p className="text-slate-600">Activities: {c.teachingActivitiesCompleted || '—'}</p>
                      <p className="text-slate-600">Outcomes: {c.learningOutcomesAchieved || '—'}</p>
                      <p className="text-slate-600">Remedial: {c.remedialTeachingActivities || '—'}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-extrabold text-slate-900 mb-2">Part B: School Assignments ({viewingReport.schoolAssignments.length})</h4>
                <div className="space-y-1.5">
                  {viewingReport.schoolAssignments.map((a) => (
                    <div key={a.id} className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                      <p className="font-bold text-slate-900">[{a.category}] {a.title}</p>
                      <p className="text-slate-600">{a.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-200 space-y-1">
                <h4 className="font-extrabold text-indigo-950">Part C: Attendance &amp; Leave Summary</h4>
                <p>
                  Working Days: <strong>{viewingReport.attendanceAndLeave.totalWorkingDays}</strong> • Attended:{' '}
                  <strong>{viewingReport.attendanceAndLeave.totalDaysAttended}</strong> (
                  <strong>{viewingReport.attendanceAndLeave.attendancePercentage}%</strong>) • Total Leave:{' '}
                  <strong>{viewingReport.attendanceAndLeave.totalLeaveDays}</strong> (CL: {viewingReport.attendanceAndLeave.casualLeaves}, ML: {viewingReport.attendanceAndLeave.medicalLeaves}, EL: {viewingReport.attendanceAndLeave.earnedLeaves})
                </p>
                <p className="font-mono text-[11px] text-slate-700">
                  ML Order: {viewingReport.attendanceAndLeave.medicalSanctionOrderNumber || 'N/A'} ({viewingReport.attendanceAndLeave.medicalSanctionOrderDate || '—'}) • CL Order:{' '}
                  {viewingReport.attendanceAndLeave.casualSanctionOrderNumber || 'N/A'}
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => generateJkepmAppraisalPdf(viewingReport, school, 'download')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold"
              >
                <Download className="w-3.5 h-3.5" /> Download PDF
              </button>
              <button
                type="button"
                onClick={() => generateJkepmAppraisalPdf(viewingReport, school, 'print')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold"
              >
                <Printer className="w-3.5 h-3.5" /> Print
              </button>
              <button
                type="button"
                onClick={() => handleShareReportPdf(viewingReport)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-extrabold"
              >
                <Share2 className="w-3.5 h-3.5" /> Share
              </button>
              <button
                type="button"
                onClick={() => setViewingReport(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 text-slate-800 text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: HOI VERIFICATION / RETURN / RECOMMEND / APPROVE                */}
      {/* ===================================================================== */}
      {reviewingReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="text-sm font-extrabold">HOI Verification — {reviewingReport.teacherName}</h3>
              <button type="button" onClick={() => setReviewingReport(null)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs">
              <p className="text-slate-600">
                Quarter: <strong>{reviewingReport.quarter}</strong> • CPIS:{' '}
                <strong className="font-mono text-emerald-700">{reviewingReport.cpisCode}</strong> • Attendance:{' '}
                <strong>{reviewingReport.attendanceAndLeave.attendancePercentage}%</strong>
              </p>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Head of Institution Observations &amp; Remarks *
                </label>
                <textarea
                  rows={3}
                  value={reviewRemarksInput}
                  onChange={(e) => setReviewRemarksInput(e.target.value)}
                  placeholder="Enter verification remarks on class teaching, leave orders, or required corrections..."
                  className="w-full p-3 rounded-xl border border-slate-300"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() =>
                    handleWorkflowTransition(reviewingReport, 'Returned_For_Correction', reviewRemarksInput, 'hoi')
                  }
                  className="px-3 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 font-extrabold inline-flex items-center justify-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Return
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleWorkflowTransition(reviewingReport, 'Recommended_By_HOI', reviewRemarksInput, 'hoi')
                  }
                  className="px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-extrabold inline-flex items-center justify-center gap-1"
                >
                  <Send className="w-3.5 h-3.5" /> Recommend
                </button>
                <button
                  type="button"
                  onClick={() => handleWorkflowTransition(reviewingReport, 'Approved', reviewRemarksInput, 'hoi')}
                  className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold inline-flex items-center justify-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" /> Approve
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: DELETE CONFIRMATION (PROTECTS SUBMITTED REPORTS)               */}
      {/* ===================================================================== */}
      {deletingReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200">
            <div className="p-4 bg-rose-600 text-white flex items-center justify-between">
              <span className="font-extrabold text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-300" />
                Confirm Report Deletion
              </span>
              <button type="button" onClick={() => setDeletingReport(null)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs text-slate-700">
              <p>
                Are you sure you want to remove <strong>{deletingReport.quarter}</strong> appraisal for{' '}
                <strong>{deletingReport.teacherName}</strong> ({deletingReport.cpisCode})?
              </p>
              {deletingReport.status !== 'Draft' && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 font-semibold">
                  This report is already <strong>{deletingReport.status.replace(/_/g, ' ')}</strong>. Only an authorized
                  administrator can archive it, and historical audit records will remain intact.
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingReport(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 font-bold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteReport}
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
      {/* MODAL: EMPLOYEE ID & OTP SECURITY VERIFICATION GATE                   */}
      {/* ===================================================================== */}
      {securityGate && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <span className="font-extrabold text-sm flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-400" />
                {securityGate.title}
              </span>
              <button type="button" onClick={() => setSecurityGate(null)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <div className="p-5 space-y-3.5 text-xs">
              <p className="text-slate-600 leading-relaxed">{securityGate.description}</p>
              <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-between">
                <span className="text-indigo-900 font-semibold">One-Time Verification Code (OTP):</span>
                <span className="font-mono font-extrabold text-base text-indigo-700 tracking-widest">
                  {securityGate.generatedOtp}
                </span>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Employee ID / CPIS Code</label>
                <input
                  type="text"
                  value={gateEmpInput}
                  onChange={(e) => setGateEmpInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Enter 6-Digit OTP</label>
                <input
                  type="text"
                  value={gateOtpInput}
                  onChange={(e) => setGateOtpInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold tracking-widest"
                />
              </div>
              {gateError && <p className="text-rose-600 font-bold">{gateError}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSecurityGate(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 font-bold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSecurityGate}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold"
                >
                  Verify &amp; Proceed
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
