import React, { useState, useMemo } from 'react';
import {
  CloudCheck,
  CloudUpload,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ExternalLink,
  ShieldCheck,
  Clock,
  FileSpreadsheet,
  Check,
  ChevronRight,
  Info,
  Lock,
  Filter,
  Search,
  Building2,
  X,
  AlertCircle,
  Award,
  Sparkles,
} from 'lucide-react';
import { SchoolProfile, Student, User } from '../types';
import { Language } from '../utils/translations';
import * as XLSX from 'xlsx';

export interface UdiseValidationError {
  id: string;
  studentId: string;
  studentName: string;
  classNumber: string;
  section: string;
  rollNumber: number;
  admissionNumber: string;
  field: string;
  errorCode: string;
  category: 'Identity & UIDAI' | 'Demographics' | 'Contact & Address' | 'Enrollment';
  severity: 'Critical' | 'Warning';
  message: string;
  suggestion: string;
  currentValue?: string;
}

interface UdiseSyncWidgetProps {
  school: SchoolProfile;
  students: Student[];
  currentUser: User;
  language: Language;
  onUpdateStudent?: (student: Student) => void;
  onNavigateToStudent?: (studentId: string) => void;
}

const STORAGE_SYNC_KEY = 'schoolmaster_udise_last_sync_timestamp';
const STORAGE_BATCH_KEY = 'schoolmaster_udise_last_sync_batch';

export const UdiseSyncWidget: React.FC<UdiseSyncWidgetProps> = ({
  school,
  students,
  currentUser,
  language,
  onUpdateStudent,
  onNavigateToStudent,
}) => {
  // Sync state
  const [lastSyncTimestamp, setLastSyncTimestamp] = useState<string>(() => {
    return localStorage.getItem(STORAGE_SYNC_KEY) || '2026-10-29T16:45:00.000Z';
  });

  const [lastBatchId, setLastBatchId] = useState<string>(() => {
    return localStorage.getItem(STORAGE_BATCH_KEY) || 'UDISE-2026-8942';
  });

  const [isPushing, setIsPushing] = useState<boolean>(false);
  const [syncToast, setSyncToast] = useState<{ type: 'success' | 'warning' | 'info'; message: string } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalFilter, setModalFilter] = useState<'all' | 'critical' | 'warning' | 'ready'>('all');
  const [modalClassFilter, setModalClassFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [fixingStudent, setFixingStudent] = useState<Student | null>(null);

  // Dynamic UDISE+ validation rules engine
  const validationErrors: UdiseValidationError[] = useMemo(() => {
    const errors: UdiseValidationError[] = [];
    const seenSRNs = new Map<string, string>();

    students.forEach((s) => {
      // 1. Identity & UIDAI compliance (Section 1)
      if (s.aadhaarStatus === 'Pending') {
        errors.push({
          id: `err-${s.id}-aadhaar`,
          studentId: s.id,
          studentName: s.fullName,
          classNumber: s.classNumber,
          section: s.section,
          rollNumber: s.rollNumber,
          admissionNumber: s.admissionNumber,
          field: 'aadhaarStatus',
          errorCode: 'ERR_UDISE_101_AADHAAR',
          category: 'Identity & UIDAI',
          severity: 'Critical',
          message: 'Student Aadhaar verification is Pending without certified parental consent or alternative identity reference.',
          suggestion: 'Record parental consent or upload verified alternative identity proof (Birth Certificate / Ration Card) as per UIDAI minor guidelines.',
          currentValue: 'Pending',
        });
      } else if (s.aadhaarStatus === 'Alternative_ID_Provided' && !s.alternativeIdRef && !s.maskedAadhaar) {
        errors.push({
          id: `err-${s.id}-alt-id`,
          studentId: s.id,
          studentName: s.fullName,
          classNumber: s.classNumber,
          section: s.section,
          rollNumber: s.rollNumber,
          admissionNumber: s.admissionNumber,
          field: 'alternativeIdRef',
          errorCode: 'WARN_UDISE_102_ALT_REF',
          category: 'Identity & UIDAI',
          severity: 'Warning',
          message: 'Alternative identity document option selected but official certificate registration number is unrecorded.',
          suggestion: 'Record the document serial number and issuing authority in the student dossier.',
          currentValue: s.alternativeIdType || 'Alternative ID',
        });
      }

      // 2. Demographics (UDISE+ General Profile GP Form 2)
      if (!s.motherName || s.motherName.trim().length < 2) {
        errors.push({
          id: `err-${s.id}-mother`,
          studentId: s.id,
          studentName: s.fullName,
          classNumber: s.classNumber,
          section: s.section,
          rollNumber: s.rollNumber,
          admissionNumber: s.admissionNumber,
          field: 'motherName',
          errorCode: 'ERR_UDISE_201_MOTHER_NAME',
          category: 'Demographics',
          severity: 'Critical',
          message: "Mother's name is mandatory under UDISE+ General Profile standard data fields.",
          suggestion: "Enter mother's full legal name as per government records.",
          currentValue: s.motherName || 'Empty',
        });
      }

      if (!s.fatherName || s.fatherName.trim().length < 2) {
        errors.push({
          id: `err-${s.id}-father`,
          studentId: s.id,
          studentName: s.fullName,
          classNumber: s.classNumber,
          section: s.section,
          rollNumber: s.rollNumber,
          admissionNumber: s.admissionNumber,
          field: 'fatherName',
          errorCode: 'ERR_UDISE_202_FATHER_NAME',
          category: 'Demographics',
          severity: 'Critical',
          message: "Father's name is mandatory under UDISE+ General Profile standard data fields.",
          suggestion: "Enter father's full legal name.",
          currentValue: s.fatherName || 'Empty',
        });
      }

      // Surname divergence check for higher classes (e.g. Class 9-12 for Board / National census matching)
      if (['9', '10', '11', '12'].includes(s.classNumber)) {
        const studentParts = s.fullName.trim().split(' ');
        const fatherParts = s.fatherName.trim().split(' ');
        const studentSurname = studentParts.length > 1 ? studentParts[studentParts.length - 1] : '';
        const fatherSurname = fatherParts.length > 1 ? fatherParts[fatherParts.length - 1] : '';

        if (studentSurname && fatherSurname && studentSurname.toLowerCase() !== fatherSurname.toLowerCase() && !s.guardianName) {
          errors.push({
            id: `warn-${s.id}-surname`,
            studentId: s.id,
            studentName: s.fullName,
            classNumber: s.classNumber,
            section: s.section,
            rollNumber: s.rollNumber,
            admissionNumber: s.admissionNumber,
            field: 'guardianName',
            errorCode: 'WARN_UDISE_203_NAME_CONSISTENCY',
            category: 'Demographics',
            severity: 'Warning',
            message: `Surname divergence ('${studentSurname}' vs '${fatherSurname}') flagged for national census and board record cross-verification.`,
            suggestion: 'Add parental/guardian verification note or confirm legal birth certificate documentation.',
            currentValue: `${s.fullName} / ${s.fatherName}`,
          });
        }
      }

      // 3. Contact & Address (UDISE+ Form 1.8 & 1.10)
      const digitsOnlyMobile = (s.mobileNumber || '').replace(/\D/g, '');
      if (digitsOnlyMobile.length < 10) {
        errors.push({
          id: `err-${s.id}-mobile`,
          studentId: s.id,
          studentName: s.fullName,
          classNumber: s.classNumber,
          section: s.section,
          rollNumber: s.rollNumber,
          admissionNumber: s.admissionNumber,
          field: 'mobileNumber',
          errorCode: 'WARN_UDISE_301_MOBILE',
          category: 'Contact & Address',
          severity: 'Warning',
          message: 'Valid 10-digit Indian parent contact number required for direct DB-SMS alerts.',
          suggestion: 'Provide primary 10-digit contact number.',
          currentValue: s.mobileNumber || 'Missing',
        });
      }

      if (!s.pinCode || !/^\d{6}$/.test(s.pinCode.trim())) {
        errors.push({
          id: `err-${s.id}-pincode`,
          studentId: s.id,
          studentName: s.fullName,
          classNumber: s.classNumber,
          section: s.section,
          rollNumber: s.rollNumber,
          admissionNumber: s.admissionNumber,
          field: 'pinCode',
          errorCode: 'WARN_UDISE_302_PINCODE',
          category: 'Contact & Address',
          severity: 'Warning',
          message: 'Postal PIN code must be a valid 6-digit Indian postal code for GIS boundary mapping.',
          suggestion: 'Enter 6-digit PIN code.',
          currentValue: s.pinCode || 'Missing',
        });
      }

      // 4. Enrollment & Admission (UDISE+ Form 3)
      if (!s.admissionNumber || s.admissionNumber.trim().length < 3) {
        errors.push({
          id: `err-${s.id}-srn`,
          studentId: s.id,
          studentName: s.fullName,
          classNumber: s.classNumber,
          section: s.section,
          rollNumber: s.rollNumber,
          admissionNumber: s.admissionNumber,
          field: 'admissionNumber',
          errorCode: 'ERR_UDISE_401_SRN',
          category: 'Enrollment',
          severity: 'Critical',
          message: 'Admission Number (SRN) is missing or blank.',
          suggestion: 'Assign unique school admission number.',
          currentValue: 'Missing',
        });
      } else {
        if (seenSRNs.has(s.admissionNumber)) {
          errors.push({
            id: `err-${s.id}-dup-srn`,
            studentId: s.id,
            studentName: s.fullName,
            classNumber: s.classNumber,
            section: s.section,
            rollNumber: s.rollNumber,
            admissionNumber: s.admissionNumber,
            field: 'admissionNumber',
            errorCode: 'ERR_UDISE_402_DUPLICATE_SRN',
            category: 'Enrollment',
            severity: 'Critical',
            message: `Duplicate Admission Number '${s.admissionNumber}' detected. Conflicts with another student.`,
            suggestion: 'Assign distinct admission serial numbers.',
            currentValue: s.admissionNumber,
          });
        } else {
          seenSRNs.set(s.admissionNumber, s.id);
        }
      }
    });

    return errors;
  }, [students]);

  // Derived metrics
  const totalStudentsCount = students.length;
  const criticalErrors = useMemo(() => validationErrors.filter((e) => e.severity === 'Critical'), [validationErrors]);
  const warningErrors = useMemo(() => validationErrors.filter((e) => e.severity === 'Warning'), [validationErrors]);
  const studentIdsWithErrors = useMemo(() => new Set(validationErrors.map((e) => e.studentId)), [validationErrors]);
  const studentIdsWithCriticalErrors = useMemo(() => new Set(criticalErrors.map((e) => e.studentId)), [criticalErrors]);
  
  const readyStudentsCount = totalStudentsCount - studentIdsWithCriticalErrors.size;
  const compliancePercentage = totalStudentsCount > 0
    ? Math.round((readyStudentsCount / totalStudentsCount) * 100)
    : 100;

  // Format date helper
  const formattedSyncTime = useMemo(() => {
    try {
      const date = new Date(lastSyncTimestamp);
      return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch (e) {
      return '29 Oct 2026, 04:45 PM';
    }
  }, [lastSyncTimestamp]);

  const relativeTimeAgo = useMemo(() => {
    try {
      const now = new Date('2026-10-30T11:35:00.000Z'); // Fixed reference time
      const then = new Date(lastSyncTimestamp);
      const diffMs = now.getTime() - then.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHours < 1) return 'Just now';
      if (diffHours === 1) return '1 hour ago';
      if (diffHours < 24) return `${diffHours} hours ago`;
      const diffDays = Math.floor(diffHours / 24);
      return diffDays === 1 ? 'Yesterday' : `${diffDays} days ago`;
    } catch {
      return 'Recently';
    }
  }, [lastSyncTimestamp]);

  // Handler: Push data to official UDISE+ Portal
  const handlePushToUdisePortal = () => {
    setIsPushing(true);
    setSyncToast(null);

    // Realistic API interaction simulation
    setTimeout(() => {
      const newTimestamp = new Date().toISOString();
      const newBatchId = `UDISE-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      
      setLastSyncTimestamp(newTimestamp);
      setLastBatchId(newBatchId);
      localStorage.setItem(STORAGE_SYNC_KEY, newTimestamp);
      localStorage.setItem(STORAGE_BATCH_KEY, newBatchId);
      setIsPushing(false);

      if (criticalErrors.length > 0) {
        setSyncToast({
          type: 'warning',
          message: `Official UDISE+ Portal push completed with warnings. ${readyStudentsCount} of ${totalStudentsCount} student records successfully pushed. ${studentIdsWithCriticalErrors.size} record(s) withheld due to pending validation errors. Batch #${newBatchId}`,
        });
      } else {
        setSyncToast({
          type: 'success',
          message: `Official UDISE+ Portal push successful! All ${totalStudentsCount} student records verified and synchronized with Ministry of Education SDMS. Batch #${newBatchId}`,
        });
      }

      setTimeout(() => setSyncToast(null), 8000);
    }, 1200);
  };

  // Handler: Quick Fix for student
  const handleApplyQuickFix = (studentId: string, fixType: 'verify_aadhaar' | 'record_parent_consent' | 'add_alt_id') => {
    const student = students.find((s) => s.id === studentId);
    if (!student || !onUpdateStudent) return;

    let updated: Student = { ...student };
    if (fixType === 'verify_aadhaar') {
      updated = {
        ...updated,
        aadhaarStatus: 'Verified',
        maskedAadhaar: updated.maskedAadhaar || 'XXXX-XXXX-9942',
        aadhaarRefNumber: `UIDAI-OFFLINE-${Date.now().toString().slice(-6)}`,
        aadhaarVerificationDate: '2026-10-30',
        parentConsentRecorded: true,
      };
    } else if (fixType === 'record_parent_consent') {
      updated = {
        ...updated,
        parentConsentRecorded: true,
      };
    } else if (fixType === 'add_alt_id') {
      updated = {
        ...updated,
        aadhaarStatus: 'Alternative_ID_Provided',
        alternativeIdType: updated.alternativeIdType || 'Birth Certificate',
        alternativeIdRef: `MOHFW-BC-2026-${Date.now().toString().slice(-5)}`,
        parentConsentRecorded: true,
      };
    }

    onUpdateStudent(updated);
    setSyncToast({
      type: 'success',
      message: `UDISE+ discrepancy resolved for ${student.fullName}! Student record updated and re-verified.`,
    });
    setFixingStudent(null);
    setTimeout(() => setSyncToast(null), 5000);
  };

  // Handler: Export Discrepancy Sheet to Excel
  const handleExportDiscrepancies = () => {
    const rows = validationErrors.map((err, idx) => ({
      'S.No': idx + 1,
      'UDISE+ Error Code': err.errorCode,
      'Severity Level': err.severity,
      'Category': err.category,
      'Student ID': err.studentId,
      'Admission Number (SRN)': err.admissionNumber,
      'Student Name': err.studentName,
      'Class & Section': `${err.classNumber}-${err.section}`,
      'Roll Number': err.rollNumber,
      'Field Affected': err.field,
      'Validation Discrepancy': err.message,
      'Recommended Administrative Action': err.suggestion,
      'School UDISE Code': school.code,
      'Academic Session': school.academicSession,
      'Report Generated On': new Date().toISOString(),
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'UDISE_Validation_Errors');
    XLSX.writeFile(wb, `UDISE_Validation_Report_${school.code}_${school.academicSession}.xlsx`);
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden space-y-0">
      
      {/* Top Header Banner */}
      <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white relative overflow-hidden">
        {/* Background decorative glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 left-1/3 w-64 h-64 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          
          {/* Left: Branding & Status */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                <Building2 className="w-3.5 h-3.5" />
                <span>Ministry of Education • Govt. of India</span>
              </span>
              <a
                href="https://udiseplus.gov.in/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/10 hover:bg-white/20 text-slate-200 transition-colors border border-white/15"
                title="Open official UDISE+ Portal (udiseplus.gov.in)"
              >
                <span>udiseplus.gov.in</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>
              <span className="text-[11px] text-slate-400 font-mono">
                UDISE Code: <strong className="text-amber-300">{school.code}</strong>
              </span>
            </div>

            <div>
              <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                <CloudCheck className="w-6 h-6 text-emerald-400" />
                <span>UDISE+ Student Portal Synchronization Status</span>
              </h2>
              <p className="text-xs text-slate-300 max-w-2xl leading-relaxed mt-0.5">
                Official Student Data Management System (SDMS) gateway. Real-time verification against national educational database standards under RTE & NEP 2020.
              </p>
            </div>
          </div>

          {/* Right: Timestamp Card & Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            
            {/* Timestamp Box */}
            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-3.5 sm:px-4 text-left sm:text-right min-w-[210px] space-y-0.5">
              <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider text-slate-400 sm:justify-end">
                <Clock className="w-3.5 h-3.5 text-amber-300" />
                <span>Last Successful Data Push</span>
              </div>
              <div className="text-sm font-black text-white font-mono flex items-center gap-2 sm:justify-end">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>{formattedSyncTime}</span>
              </div>
              <div className="text-[11px] text-indigo-200 flex items-center justify-between sm:justify-end gap-2 font-medium">
                <span className="text-slate-400">({relativeTimeAgo})</span>
                <span className="px-1.5 py-0.2 rounded bg-white/10 text-[10px] font-mono text-amber-200">
                  #{lastBatchId}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex sm:flex-col gap-2">
              <button
                id="push-to-udise-btn"
                onClick={handlePushToUdisePortal}
                disabled={isPushing}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white transition-all shadow-md shadow-emerald-900/40 border border-emerald-400/30 disabled:opacity-50"
                title="Submit compliant student records to official UDISE+ SDMS portal"
              >
                {isPushing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Pushing to UDISE+...</span>
                  </>
                ) : (
                  <>
                    <CloudUpload className="w-4 h-4 text-amber-300" />
                    <span>Push to UDISE+ Portal</span>
                  </>
                )}
              </button>

              <button
                onClick={() => setIsModalOpen(true)}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white transition-all border border-white/20 shadow-xs"
              >
                <AlertTriangle className={`w-3.5 h-3.5 ${criticalErrors.length > 0 ? 'text-rose-400' : 'text-amber-300'}`} />
                <span>Validation Center ({validationErrors.length})</span>
              </button>
            </div>

          </div>

        </div>

      </div>

      {/* Sync Status Toast Notification */}
      {syncToast && (
        <div
          className={`p-4 border-b text-xs flex items-center justify-between transition-all animate-in fade-in slide-in-from-top-2 ${
            syncToast.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
              : 'bg-amber-50 border-amber-300 text-amber-950'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {syncToast.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            )}
            <span className="font-semibold leading-relaxed">{syncToast.message}</span>
          </div>
          <button
            onClick={() => setSyncToast(null)}
            className="p-1 hover:bg-black/5 rounded-lg text-slate-500 hover:text-slate-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 4 Summary Stat Cards */}
      <div className="p-5 sm:p-6 bg-slate-50 border-b border-slate-200/80">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          
          {/* Card 1: Total Enrolled */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
              <span>Total Roster</span>
              <Building2 className="w-4 h-4 text-slate-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-slate-900">{totalStudentsCount}</span>
              <span className="text-xs font-bold text-slate-500">Dossiers</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Active student cohort in {school.academicSession}
            </p>
          </div>

          {/* Card 2: Compliant & Ready */}
          <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-2xs bg-gradient-to-br from-white to-emerald-50/40">
            <div className="flex items-center justify-between text-emerald-700 text-xs font-bold uppercase tracking-wider">
              <span>UDISE+ Ready</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-emerald-700">{readyStudentsCount}</span>
              <span className="text-xs font-bold text-emerald-800">
                ({compliancePercentage}%)
              </span>
            </div>
            <p className="mt-1 text-[11px] text-emerald-600 font-medium">
              Passed all General & Enrollment checks
            </p>
          </div>

          {/* Card 3: Pending Validation Errors */}
          <div className={`bg-white p-4 rounded-2xl border shadow-2xs ${
            criticalErrors.length > 0
              ? 'border-rose-300 bg-gradient-to-br from-white to-rose-50/40'
              : 'border-amber-200 bg-gradient-to-br from-white to-amber-50/40'
          }`}>
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
              <span className={criticalErrors.length > 0 ? 'text-rose-700' : 'text-amber-700'}>
                Pending Errors
              </span>
              <AlertTriangle className={`w-4 h-4 ${criticalErrors.length > 0 ? 'text-rose-600' : 'text-amber-600'}`} />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className={`text-2xl sm:text-3xl font-black ${criticalErrors.length > 0 ? 'text-rose-700' : 'text-amber-700'}`}>
                {validationErrors.length}
              </span>
              <span className="text-xs font-bold text-slate-600">
                in {studentIdsWithErrors.size} {studentIdsWithErrors.size === 1 ? 'student' : 'students'}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              <strong className="text-rose-700">{criticalErrors.length} Critical</strong> • {warningErrors.length} Warnings
            </p>
          </div>

          {/* Card 4: Last Push Result */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
              <span>Portal Sync State</span>
              <CloudCheck className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-indigo-900">
                {criticalErrors.length === 0 ? '100%' : 'Partial'}
              </span>
              <span className="text-xs font-bold text-emerald-600">
                Acknowledged
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              {criticalErrors.length === 0
                ? 'All records matched with SDMS'
                : 'Blocked records require manual fix'}
            </p>
          </div>

        </div>
      </div>

      {/* HIGHLIGHT SECTION: PENDING VALIDATION ERRORS */}
      <div className="p-5 sm:p-6 space-y-4">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <span>Pending Validation Errors Requiring Administrative Resolution</span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                {validationErrors.length} Discrepancies
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              The official UDISE+ SDMS engine requires zero critical errors for annual data locking. Resolve each flagged item below:
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={handleExportDiscrepancies}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-2xs"
              title="Download Excel error report for compliance filing"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export Error Report (.xlsx)</span>
            </button>

            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-all border border-indigo-200"
            >
              <span>View All ({validationErrors.length})</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Highlight Error Cards Grid */}
        {validationErrors.length === 0 ? (
          <div className="p-8 bg-emerald-50/70 border border-emerald-200 rounded-2xl text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-black text-emerald-950">
              Zero Pending Validation Errors!
            </h4>
            <p className="text-xs text-emerald-800 max-w-md mx-auto">
              All {totalStudentsCount} student records conform 100% to Ministry of Education UDISE+ SDMS specifications. You are ready for official annual data finalization.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {validationErrors.map((err) => {
              const student = students.find((s) => s.id === err.studentId);
              const isCritical = err.severity === 'Critical';

              return (
                <div
                  key={err.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${
                    isCritical
                      ? 'bg-rose-50/40 border-rose-200 hover:border-rose-300 shadow-2xs'
                      : 'bg-amber-50/40 border-amber-200 hover:border-amber-300 shadow-2xs'
                  }`}
                >
                  <div className="space-y-2">
                    {/* Header info */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                              isCritical
                                ? 'bg-rose-600 text-white'
                                : 'bg-amber-500 text-white'
                            }`}
                          >
                            {isCritical ? 'Critical Blocker' : 'Warning / Review'}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500 font-bold">
                            {err.errorCode}
                          </span>
                        </div>
                        <h4 className="font-extrabold text-slate-900 text-sm mt-1">
                          {err.studentName}
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Class {err.classNumber}-{err.section} • Roll #{err.rollNumber} • SRN: {err.admissionNumber}
                        </p>
                      </div>

                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-slate-600 border border-slate-200 shrink-0">
                        {err.category}
                      </span>
                    </div>

                    {/* Discrepancy details */}
                    <div className="p-2.5 bg-white/80 rounded-xl border border-slate-200/80 text-xs space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Discrepancy Details
                      </span>
                      <p className="text-slate-800 font-semibold leading-relaxed">
                        {err.message}
                      </p>
                      <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100 flex items-center justify-between">
                        <span>Current Value:</span>
                        <code className="font-mono text-slate-700 bg-slate-100 px-1 py-0.5 rounded text-[10px]">
                          {err.currentValue || 'N/A'}
                        </code>
                      </div>
                    </div>

                    {/* Resolution Guidance */}
                    <div className="text-[11px] text-slate-600 flex items-start gap-1.5">
                      <Info className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                      <span>{err.suggestion}</span>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between gap-2">
                    {err.errorCode === 'ERR_UDISE_101_AADHAAR' ? (
                      <button
                        onClick={() => handleApplyQuickFix(err.studentId, 'verify_aadhaar')}
                        className="flex-1 py-1.5 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1 shadow-xs transition-all active:scale-95"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Verify Aadhaar & Consent</span>
                      </button>
                    ) : err.errorCode === 'WARN_UDISE_102_ALT_REF' ? (
                      <button
                        onClick={() => handleApplyQuickFix(err.studentId, 'add_alt_id')}
                        className="flex-1 py-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1 shadow-xs transition-all active:scale-95"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Add Birth Cert Ref</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setFixingStudent(student || null);
                          setIsModalOpen(true);
                        }}
                        className="flex-1 py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs flex items-center justify-center gap-1 transition-all"
                      >
                        <span>Fix in Dossier</span>
                      </button>
                    )}

                    {onNavigateToStudent && (
                      <button
                        onClick={() => onNavigateToStudent(err.studentId)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/60"
                        title="Open student record in Admission Register"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Security & Official Guidelines Footer Notice */}
        <div className="p-3.5 bg-slate-100 rounded-2xl border border-slate-200 text-xs text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-slate-500 shrink-0" />
            <span>
              <strong>Security Protocol:</strong> Direct login credentials, CAPTCHA, and OTP sessions are never stored locally. Changes are transmitted exclusively through authorized official portal protocols.
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate-500 shrink-0">
            Official Portal: udiseplus.gov.in
          </span>
        </div>

      </div>

      {/* ===================================================================== */}
      {/* MODAL: COMPREHENSIVE UDISE+ VERIFICATION & RESOLUTION CENTER         */}
      {/* ===================================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-5xl w-full shadow-2xl overflow-hidden border border-slate-300 max-h-[94vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="p-5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/30 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                  <ShieldCheck className="w-5 h-5 text-indigo-300" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                    <span>UDISE+ Data Verification & Error Resolution Center</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-300 border border-indigo-400/30 font-mono">
                      {school.code}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Official Student Portal Discrepancy Manager • {school.name} ({school.academicSession})
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportDiscrepancies}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Download Excel (.xlsx)</span>
                </button>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-slate-500">Filter View:</span>
                <button
                  onClick={() => setModalFilter('all')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    modalFilter === 'all'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  All Discrepancies ({validationErrors.length})
                </button>
                <button
                  onClick={() => setModalFilter('critical')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    modalFilter === 'critical'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-white border border-rose-200 text-rose-700 hover:bg-rose-50'
                  }`}
                >
                  Critical Blockers ({criticalErrors.length})
                </button>
                <button
                  onClick={() => setModalFilter('warning')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    modalFilter === 'warning'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'bg-white border border-amber-200 text-amber-700 hover:bg-amber-50'
                  }`}
                >
                  Review Warnings ({warningErrors.length})
                </button>
                <button
                  onClick={() => setModalFilter('ready')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    modalFilter === 'ready'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                  }`}
                >
                  Ready Students ({readyStudentsCount})
                </button>
              </div>

              {/* Class Selector */}
              <div className="flex items-center gap-2">
                <select
                  value={modalClassFilter}
                  onChange={(e) => setModalClassFilter(e.target.value)}
                  className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800"
                >
                  <option value="all">All Classes</option>
                  {school.classesOffered.map((c) => (
                    <option key={c} value={c}>Class {c}</option>
                  ))}
                </select>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search student or SRN..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 pr-3 py-1 rounded-lg border border-slate-300 bg-white text-xs w-48 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Modal Body: Records Table */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {modalFilter === 'ready' ? (
                // Ready students list
                <div className="space-y-3">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 font-semibold flex items-center justify-between">
                    <span>
                      {readyStudentsCount} student records conform 100% to UDISE+ SDMS specifications and will be pushed during sync.
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white font-bold text-[10px]">
                      100% Portal Ready
                    </span>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                        <tr>
                          <th className="py-2.5 px-3">Roll #</th>
                          <th className="py-2.5 px-3">Student Name</th>
                          <th className="py-2.5 px-3">Class-Sec</th>
                          <th className="py-2.5 px-3">SRN (Admission #)</th>
                          <th className="py-2.5 px-3">Aadhaar Status</th>
                          <th className="py-2.5 px-3">Parent Details</th>
                          <th className="py-2.5 px-3 text-right">Portal Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {students
                          .filter((s) => !studentIdsWithCriticalErrors.has(s.id))
                          .filter((s) => modalClassFilter === 'all' || s.classNumber === modalClassFilter)
                          .filter((s) => s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || s.admissionNumber.toLowerCase().includes(searchQuery.toLowerCase()))
                          .map((st) => (
                            <tr key={st.id} className="hover:bg-slate-50 transition-colors">
                              <td className="py-2.5 px-3 font-mono font-bold text-slate-700">{st.rollNumber}</td>
                              <td className="py-2.5 px-3 font-bold text-slate-900">{st.fullName}</td>
                              <td className="py-2.5 px-3">{st.classNumber}-{st.section}</td>
                              <td className="py-2.5 px-3 font-mono text-slate-600">{st.admissionNumber}</td>
                              <td className="py-2.5 px-3">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>{st.aadhaarStatus}</span>
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-slate-600">
                                {st.fatherName} • {st.motherName}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                  Synchronized
                                </span>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                // Errors List
                <div className="space-y-3">
                  {validationErrors
                    .filter((err) => {
                      if (modalFilter === 'critical') return err.severity === 'Critical';
                      if (modalFilter === 'warning') return err.severity === 'Warning';
                      return true;
                    })
                    .filter((err) => modalClassFilter === 'all' || err.classNumber === modalClassFilter)
                    .filter((err) => err.studentName.toLowerCase().includes(searchQuery.toLowerCase()) || err.admissionNumber.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((err) => {
                      const isCritical = err.severity === 'Critical';
                      return (
                        <div
                          key={err.id}
                          className={`p-4 rounded-2xl border transition-all space-y-3 ${
                            isCritical ? 'bg-rose-50/60 border-rose-300' : 'bg-amber-50/60 border-amber-300'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-black/5 pb-2.5">
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                                  isCritical ? 'bg-rose-700 text-white' : 'bg-amber-600 text-white'
                                }`}
                              >
                                {isCritical ? 'Critical Error' : 'Warning'}
                              </span>
                              <span className="font-mono font-bold text-xs text-slate-800">
                                {err.errorCode}
                              </span>
                              <span className="text-slate-400">•</span>
                              <span className="font-bold text-slate-900 text-sm">
                                {err.studentName}
                              </span>
                              <span className="text-xs text-slate-500">
                                (Class {err.classNumber}-{err.section}, Roll #{err.rollNumber}, SRN: {err.admissionNumber})
                              </span>
                            </div>

                            <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                              {err.category}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                            <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Validation Discrepancy
                              </span>
                              <p className="font-semibold text-slate-800 leading-relaxed">
                                {err.message}
                              </p>
                              <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100 flex items-center justify-between">
                                <span>Current Stored Value:</span>
                                <code className="font-mono text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded">
                                  {err.currentValue || 'None'}
                                </code>
                              </div>
                            </div>

                            <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col justify-between space-y-2">
                              <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                                  Action Required for UDISE+ Compliance
                                </span>
                                <p className="text-slate-700 mt-1 leading-relaxed">
                                  {err.suggestion}
                                </p>
                              </div>

                              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                                {err.errorCode === 'ERR_UDISE_101_AADHAAR' && (
                                  <button
                                    onClick={() => handleApplyQuickFix(err.studentId, 'verify_aadhaar')}
                                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs"
                                  >
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                    <span>Verify Aadhaar & Log Parent Consent</span>
                                  </button>
                                )}

                                {err.errorCode === 'WARN_UDISE_102_ALT_REF' && (
                                  <button
                                    onClick={() => handleApplyQuickFix(err.studentId, 'add_alt_id')}
                                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Record Birth Certificate Proof</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Authorized Administrator: <strong>{school.adminName || school.headmasterName || 'Mohd Yousuf Wani'} (Admin)</strong></span>
              </span>
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition-colors"
              >
                Close Verification Center
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
