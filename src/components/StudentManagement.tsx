import React, { useState, useRef, useMemo } from 'react';
import {
  Users,
  Search,
  Filter,
  Plus,
  FileSpreadsheet,
  Printer,
  ShieldCheck,
  Edit2,
  Eye,
  Download,
  Upload,
  CheckCircle,
  Clock,
  FileText,
  UserCheck,
  ChevronDown,
  X,
  Calendar,
  Phone,
  MapPin,
  School,
  AlertCircle,
  Trash2,
  Check,
  AlertTriangle,
  QrCode,
  ArrowRightLeft,
  History,
  GraduationCap,
  Camera,
  Image as ImageIcon,
  Bell,
  Send,
  MessageSquare,
  Smartphone,
  CheckCircle2,
  Zap,
} from 'lucide-react';
import {
  AadhaarStatus,
  AttendanceRecord,
  SchoolProfile,
  Student,
  StudentHistoryEvent,
  StudentStatus,
  User,
} from '../types';
import { Language, translations } from '../utils/translations';
import { downloadStudentImportTemplate, exportStudentRegisterToExcel } from '../utils/excelExport';
import { AadhaarVerificationModal } from './AadhaarVerificationModal';
import { UpcomingBirthdaysCard } from './UpcomingBirthdaysCard';
import { StudentQrPassModal } from './StudentQrPassModal';
import { BulkPhotoImportModal } from './BulkPhotoImportModal';
import { STANDARDIZED_ADDRESS } from '../utils/sampleData';
import {
  buildStudentQrPayload,
  deduplicateStudentsByAdmissionNumber,
  formatSchoolAddressOnce,
} from '../utils/calculations';
import {
  ConsecutiveAbsenceAlert,
  ConsecutiveAbsenceDispatchLog,
  dispatchBulkConsecutiveAbsenceNotifications,
  findStudentsWithConsecutiveAbsences,
  loadConsecutiveAbsenceDispatchLogs,
  loadPushPreferences,
  savePushPreferences,
} from '../utils/pushNotifications';
import QRCode from 'qrcode';
import * as XLSX from 'xlsx';

function suggestNextGradeLevel(currentClass: string, classesOffered: string[]): string {
  const normalized = currentClass.trim();
  if (/^nursery$/i.test(normalized)) return 'KG';
  if (/^kg$/i.test(normalized)) return '1';
  const num = parseInt(normalized, 10);
  if (!isNaN(num)) {
    const nextStr = String(num + 1);
    if (classesOffered.includes(nextStr)) return nextStr;
    if (num < 12) return nextStr;
  }
  return 'GRADUATED';
}

interface StudentManagementProps {
  students: Student[];
  attendanceRecords?: AttendanceRecord[];
  school: SchoolProfile;
  currentUser: User;
  onAddStudent: (newStudent: Student) => void;
  onUpdateStudent: (updatedStudent: Student) => void;
  onDeleteStudent?: (studentId: string) => void;
  onBulkDeleteStudents?: (studentIds: string[]) => void;
  onBulkPromoteStudents?: (
    studentIds: string[],
    targetClass: string,
    targetSection: string,
    targetSession: string,
    isGraduated?: boolean
  ) => void;
  language: Language;
  initialSelectedStudentId?: string | null;
  onClearInitialSelectedStudent?: () => void;
}

export const StudentManagement: React.FC<StudentManagementProps> = ({
  students,
  attendanceRecords = [],
  school,
  currentUser,
  onAddStudent,
  onUpdateStudent,
  onDeleteStudent,
  onBulkDeleteStudents,
  onBulkPromoteStudents,
  language,
  initialSelectedStudentId,
  onClearInitialSelectedStudent,
}) => {
  const t = translations[language];

  // View Mode: Student Register vs Promote Students
  const [activeMode, setActiveMode] = useState<'register' | 'promote'>('register');

  // Promote Students workflow state
  const defaultPromoteClass = school.classesOffered?.[0] || '5';
  const [promoteSourceClass, setPromoteSourceClass] = useState<string>('5');
  const [promoteSourceSection, setPromoteSourceSection] = useState<string>('all');
  const [promoteTargetClass, setPromoteTargetClass] = useState<string>(() =>
    suggestNextGradeLevel('5', school.classesOffered || ['1', '2', '3', '4', '5', '6', '7', '8'])
  );
  const [promoteTargetSection, setPromoteTargetSection] = useState<string>('KEEP');
  const [promoteTargetSession, setPromoteTargetSession] = useState<string>('2027-2028');
  const [promoteSelectedIds, setPromoteSelectedIds] = useState<string[]>([]);

  // Multi-student selection & bulk actions
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState<boolean>(false);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedSection, setSelectedSection] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('Active');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [viewingProfile, setViewingProfile] = useState<Student | null>(null);
  const [profileQrDataUrl, setProfileQrDataUrl] = useState<string>('');
  const [verifyingStudent, setVerifyingStudent] = useState<Student | null>(null);
  const [selectedStudentForQr, setSelectedStudentForQr] = useState<Student | null>(null);
  const [isBulkPhotoModalOpen, setIsBulkPhotoModalOpen] = useState<boolean>(false);

  // Delete Confirmation Modal State
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState<boolean>(false);

  // Edit Student Name Quick Modal State
  const [nameEditingStudent, setNameEditingStudent] = useState<Student | null>(null);
  const [editedStudentNameValue, setEditedStudentNameValue] = useState<string>('');
  const [nameEditError, setNameEditError] = useState<string | null>(null);

  // Transfer Student & Student History Modals
  const [transferringStudent, setTransferringStudent] = useState<Student | null>(null);
  const [transferSchoolInput, setTransferSchoolInput] = useState<string>('');
  const [transferDateInput, setTransferDateInput] = useState<string>(new Date().toISOString().slice(0, 10));
  const [transferReasonInput, setTransferReasonInput] = useState<string>('Family relocation');
  const [historyStudent, setHistoryStudent] = useState<Student | null>(null);

  // Batch Academic Session Editor
  const [batchSessionInput, setBatchSessionInput] = useState<string>(school.academicSession || '2026-2027');

  // Toast notifications
  const [toastNotice, setToastNotice] = useState<string | null>(null);

  // Automated 3+ Consecutive Absent Days Bulk SMS/Push Notification Trigger State
  const [autoAbsenceTriggerEnabled, setAutoAbsenceTriggerEnabled] = useState<boolean>(
    () => loadPushPreferences().consecutiveAbsenceAutoAlert !== false
  );
  const [isAbsenceNotifyModalOpen, setIsAbsenceNotifyModalOpen] = useState<boolean>(false);
  const [absenceNotifyChannel, setAbsenceNotifyChannel] = useState<'SMS + Push' | 'Push Only' | 'SMS Only'>('SMS + Push');
  const [selectedAbsenceStudentIds, setSelectedAbsenceStudentIds] = useState<string[]>([]);
  const [absenceMessageTemplate, setAbsenceMessageTemplate] = useState<string>(
    'Dear Parent, your ward {studentName} (Adm No: {admissionNumber}, Class {classSection}) has been absent for {days} consecutive school days ({dates}). Please contact {schoolName} office immediately.'
  );
  const [absenceDispatchLogs, setAbsenceDispatchLogs] = useState<ConsecutiveAbsenceDispatchLog[]>(
    () => loadConsecutiveAbsenceDispatchLogs()
  );
  const [lastBulkDispatchReceipt, setLastBulkDispatchReceipt] = useState<ConsecutiveAbsenceDispatchLog | null>(null);

  const canManageAbsenceAlerts =
    currentUser.role === 'admin' || currentUser.role === 'head_teacher';

  const showNotification = (msg: string) => {
    setToastNotice(msg);
    setTimeout(() => setToastNotice(null), 4000);
  };

  // Promote Students derived list & handlers
  const promoteEligibleStudents = React.useMemo(() => {
    const classToUse = promoteSourceClass || defaultPromoteClass;
    return deduplicateStudentsByAdmissionNumber(students)
      .filter(
        (s) =>
          s.status === 'Active' &&
          s.classNumber === classToUse &&
          (promoteSourceSection === 'all' || s.section === promoteSourceSection)
      )
      .sort((a, b) => a.section.localeCompare(b.section) || a.rollNumber - b.rollNumber);
  }, [students, promoteSourceClass, promoteSourceSection, defaultPromoteClass]);

  const isAllPromoteSelected =
    promoteEligibleStudents.length > 0 &&
    promoteEligibleStudents.every((s) => promoteSelectedIds.includes(s.id));

  const handleSelectPromoteSourceClass = (nextSource: string) => {
    setPromoteSourceClass(nextSource);
    setPromoteSelectedIds([]);
    setPromoteTargetClass(suggestNextGradeLevel(nextSource, school.classesOffered || []));
  };

  const handleTogglePromoteAll = () => {
    if (isAllPromoteSelected) {
      setPromoteSelectedIds([]);
    } else {
      setPromoteSelectedIds(promoteEligibleStudents.map((s) => s.id));
    }
  };

  const handleExecutePromotion = () => {
    if (promoteSelectedIds.length === 0) {
      showNotification('Select at least one student to promote.');
      return;
    }
    const isGraduated = promoteTargetClass === 'GRADUATED';
    const sessionClean = promoteTargetSession.trim() || school.academicSession || '2027-2028';

    if (onBulkPromoteStudents) {
      onBulkPromoteStudents(
        promoteSelectedIds,
        promoteTargetClass,
        promoteTargetSection,
        sessionClean,
        isGraduated
      );
    } else {
      const selectedSet = new Set(promoteSelectedIds);
      const nowIso = new Date().toISOString();
      students.forEach((st) => {
        if (!selectedSet.has(st.id)) return;
        const nextSection = promoteTargetSection === 'KEEP' ? st.section : promoteTargetSection;
        const nextClass = isGraduated ? st.classNumber : promoteTargetClass;
        const nextStatus: StudentStatus = isGraduated ? 'Graduated' : st.status;
        const histEvent: StudentHistoryEvent = {
          id: `hist-${Date.now()}-${st.id.slice(-4)}`,
          date: nowIso,
          type: 'CLASS_CHANGE',
          title: isGraduated ? 'Completed & Graduated' : `Promoted to Class ${nextClass}`,
          details: isGraduated
            ? `Promoted from Class ${st.classNumber}-${st.section} to Alumni / Graduated Archive (Session ${sessionClean})`
            : `Promoted from Class ${st.classNumber}-${st.section} (${st.academicSession}) to Class ${nextClass}-${nextSection} (${sessionClean})`,
          actorName: currentUser.name,
        };
        onUpdateStudent({
          ...st,
          classNumber: nextClass,
          section: nextSection,
          academicSession: sessionClean,
          status: nextStatus,
          history: [histEvent, ...(st.history || [])],
        });
      });
    }

    const count = promoteSelectedIds.length;
    setPromoteSelectedIds([]);
    showNotification(
      isGraduated
        ? `Graduated & archived ${count} student(s) with class history updated.`
        : `Promoted ${count} student(s) from Class ${promoteSourceClass} to Class ${promoteTargetClass} (${sessionClean}) and updated class history!`
    );
  };

  const handleOpenTransferModal = (s: Student) => {
    setTransferringStudent(s);
    setTransferSchoolInput(s.transferSchool || '');
    setTransferDateInput(s.transferDate || new Date().toISOString().slice(0, 10));
    setTransferReasonInput(s.transferReason || 'Family relocation');
  };

  const handleConfirmTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferringStudent) return;
    onUpdateStudent({
      ...transferringStudent,
      status: 'Transferred',
      transferSchool: transferSchoolInput.trim() || 'External Institution',
      transferDate: transferDateInput,
      transferReason: transferReasonInput.trim() || 'Parent Request',
    });
    showNotification(`Student "${transferringStudent.fullName}" marked as Transferred.`);
    setTransferringStudent(null);
  };

  const handleBatchUpdateAcademicSession = () => {
    const trimmed = batchSessionInput.trim();
    if (!trimmed || selectedStudentIds.length === 0) return;
    const selectedSet = new Set(selectedStudentIds);
    students.forEach((st) => {
      if (selectedSet.has(st.id)) {
        onUpdateStudent({ ...st, academicSession: trimmed });
      }
    });
    showNotification(`Updated Academic Session to "${trimmed}" for ${selectedStudentIds.length} student(s).`);
    setSelectedStudentIds([]);
  };

  const handleInitiateDelete = (s: Student) => {
    setStudentToDelete(s);
    setShowDeleteConfirmModal(true);
  };

  const handleConfirmDelete = () => {
    if (!studentToDelete) return;
    if (onDeleteStudent) {
      onDeleteStudent(studentToDelete.id);
    }
    showNotification(`Student "${studentToDelete.fullName}" was removed from the database.`);
    setShowDeleteConfirmModal(false);
    setStudentToDelete(null);
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirmModal(false);
    setStudentToDelete(null);
  };

  const handleOpenEditNameModal = (s: Student) => {
    setNameEditingStudent(s);
    setEditedStudentNameValue(s.fullName);
    setNameEditError(null);
  };

  const handleSaveStudentName = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!nameEditingStudent) return;
    const trimmed = editedStudentNameValue.trim();
    if (!trimmed) {
      setNameEditError('Student name cannot be empty.');
      return;
    }

    const updated = { ...nameEditingStudent, fullName: trimmed };
    onUpdateStudent(updated);
    showNotification(`Student name successfully updated to "${trimmed}".`);
    setNameEditingStudent(null);
    setEditedStudentNameValue('');
    setNameEditError(null);
  };

  const handleCancelEditName = () => {
    setNameEditingStudent(null);
    setEditedStudentNameValue('');
    setNameEditError(null);
  };

  // Edit Student Address Quick Modal / Inline State
  const [addressEditingStudent, setAddressEditingStudent] = useState<Student | null>(null);
  const [editedAddressValue, setEditedAddressValue] = useState<string>('');
  const [editedVillageTown, setEditedVillageTown] = useState<string>(school.villageTown || 'Palpora');
  const [editedBlockTehsil, setEditedBlockTehsil] = useState<string>(school.blockTehsil || 'Iddgah');
  const [editedDistrict, setEditedDistrict] = useState<string>(school.district || 'Srinagar');
  const [editedState, setEditedState] = useState<string>(school.state || 'Jammu and Kashmir');
  const [editedPinCode, setEditedPinCode] = useState<string>(school.pinCode || '190017');
  const [addressEditError, setAddressEditError] = useState<string | null>(null);

  const handleOpenEditAddress = (s: Student) => {
    setAddressEditingStudent(s);
    setEditedAddressValue(s.address || formatSchoolAddressOnce(school) || STANDARDIZED_ADDRESS);
    setEditedVillageTown(s.villageTown || school.villageTown || 'Palpora');
    setEditedBlockTehsil(s.blockTehsil || school.blockTehsil || 'Iddgah');
    setEditedDistrict(s.district || school.district || 'Srinagar');
    setEditedState(s.state || school.state || 'Jammu and Kashmir');
    setEditedPinCode(s.pinCode || school.pinCode || '190017');
    setAddressEditError(null);
  };

  const handleApplyStandardAddress = () => {
    setEditedAddressValue(formatSchoolAddressOnce(school) || STANDARDIZED_ADDRESS);
    setEditedVillageTown(school.villageTown || 'Palpora');
    setEditedBlockTehsil(school.blockTehsil || 'Iddgah');
    setEditedDistrict(school.district || 'Srinagar');
    setEditedState(school.state || 'Jammu and Kashmir');
    setEditedPinCode(school.pinCode || '190017');
    setAddressEditError(null);
  };

  const handleSaveStudentAddress = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!addressEditingStudent) return;
    const trimmedAddress = editedAddressValue.trim();
    if (!trimmedAddress || trimmedAddress.length < 5) {
      setAddressEditError('Please enter a valid residential address (minimum 5 characters).');
      return;
    }

    const updated: Student = {
      ...addressEditingStudent,
      address: trimmedAddress,
      villageTown: editedVillageTown.trim() || 'Palpora',
      blockTehsil: editedBlockTehsil.trim() || 'Iddgah',
      district: editedDistrict.trim() || 'Srinagar',
      state: editedState.trim() || 'Jammu and Kashmir',
      pinCode: editedPinCode.trim() || '190017',
    };

    onUpdateStudent(updated);
    if (viewingProfile && viewingProfile.id === updated.id) {
      setViewingProfile(updated);
    }
    showNotification(`✓ Address successfully updated & saved for student "${updated.fullName}"!`);
    setAddressEditingStudent(null);
    setAddressEditError(null);
  };

  const handleCancelEditAddress = () => {
    setAddressEditingStudent(null);
    setAddressEditError(null);
  };

  const handleAutoAssignAttendanceMarks = () => {
    let count = 0;
    filteredStudents.forEach((st) => {
      const targetMarks = st.attendanceMarks ?? 9;
      onUpdateStudent({ ...st, attendanceMarks: targetMarks });
      count++;
    });
    showNotification(`Assigned continuous attendance evaluation marks to ${count} students.`);
  };

  // File input ref for Excel import
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Strictly deduplicate students by Admission Number primary key before filtering/displaying
  const uniqueStudents = React.useMemo(
    () => deduplicateStudentsByAdmissionNumber(students),
    [students]
  );

  // Sync open viewingProfile automatically when student or school data updates
  React.useEffect(() => {
    if (!viewingProfile) {
      setProfileQrDataUrl('');
      return;
    }
    const latest =
      uniqueStudents.find(
        (s) =>
          s.admissionNumber.toLowerCase() === viewingProfile.admissionNumber.toLowerCase() ||
          s.id === viewingProfile.id
      ) || viewingProfile;
    const payload = buildStudentQrPayload(latest, school);
    QRCode.toDataURL(payload, {
      width: 280,
      margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
      .then(setProfileQrDataUrl)
      .catch(() => setProfileQrDataUrl(''));
  }, [viewingProfile, uniqueStudents, school]);

  // Open student profile immediately when navigated via Global Header Search Bar
  React.useEffect(() => {
    if (!initialSelectedStudentId) return;
    const match = uniqueStudents.find(
      (s) =>
        s.id === initialSelectedStudentId ||
        s.admissionNumber.toLowerCase() === initialSelectedStudentId.toLowerCase()
    );
    if (match) {
      setActiveMode('register');
      if (match.status !== 'Active') {
        setSelectedStatus('all');
      }
      setViewingProfile(match);
    }
    if (onClearInitialSelectedStudent) {
      onClearInitialSelectedStudent();
    }
  }, [initialSelectedStudentId, uniqueStudents, onClearInitialSelectedStudent]);

  // Identify students absent for 3 or more consecutive school days
  const consecutiveAbsenceAlerts = React.useMemo(
    () => findStudentsWithConsecutiveAbsences(attendanceRecords, uniqueStudents, 3),
    [attendanceRecords, uniqueStudents]
  );

  const consecutiveAbsenceMap = React.useMemo(() => {
    const map = new Map<string, ConsecutiveAbsenceAlert>();
    consecutiveAbsenceAlerts.forEach((a) => map.set(a.student.id, a));
    return map;
  }, [consecutiveAbsenceAlerts]);

  // Keep selected recipients in sync when opening modal or when flagged list changes
  React.useEffect(() => {
    setSelectedAbsenceStudentIds(consecutiveAbsenceAlerts.map((a) => a.student.id));
  }, [consecutiveAbsenceAlerts]);

  // Automated Trigger: when enabled for admins, automatically dispatch once per day for new 3+ day consecutive absences
  React.useEffect(() => {
    if (!autoAbsenceTriggerEnabled || !canManageAbsenceAlerts || consecutiveAbsenceAlerts.length === 0) {
      return;
    }
    const todayKey = new Date().toISOString().slice(0, 10);
    const sig = `${todayKey}_${consecutiveAbsenceAlerts
      .map((a) => `${a.student.id}:${a.consecutiveDays}`)
      .join(',')}`;
    const cacheKey = 'sm_auto_3day_absence_trigger_sig';
    if (sessionStorage.getItem(cacheKey) === sig) return;
    sessionStorage.setItem(cacheKey, sig);

    const { logEntry } = dispatchBulkConsecutiveAbsenceNotifications({
      alerts: consecutiveAbsenceAlerts,
      channel: 'SMS + Push',
      messageTemplate: absenceMessageTemplate,
      schoolName: school.name,
      triggeredBy: `${currentUser.name} (Auto-Trigger)`,
      triggerType: 'automated_trigger',
    });
    setAbsenceDispatchLogs((prev) => [logEntry, ...prev].slice(0, 25));
  }, [
    autoAbsenceTriggerEnabled,
    canManageAbsenceAlerts,
    consecutiveAbsenceAlerts,
    absenceMessageTemplate,
    school.name,
    currentUser.name,
  ]);

  const handleToggleAutoAbsenceTrigger = () => {
    setAutoAbsenceTriggerEnabled((prev) => {
      const next = !prev;
      const prefs = loadPushPreferences();
      savePushPreferences({ ...prefs, consecutiveAbsenceAutoAlert: next });
      showNotification(
        next
          ? 'Automated 3+ Day Consecutive Absence Trigger enabled (SMS + Push).'
          : 'Automated 3+ Day Consecutive Absence Trigger paused. You can still dispatch bulk alerts manually.'
      );
      return next;
    });
  };

  const handleToggleAbsenceRecipient = (studentId: string) => {
    setSelectedAbsenceStudentIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  };

  const handleExecuteBulkAbsenceNotification = (overrideAlerts?: ConsecutiveAbsenceAlert[]) => {
    const targetAlerts =
      overrideAlerts ||
      consecutiveAbsenceAlerts.filter((a) => selectedAbsenceStudentIds.includes(a.student.id));

    if (targetAlerts.length === 0) {
      showNotification('Select at least one student to notify parents.');
      return;
    }

    const { logEntry } = dispatchBulkConsecutiveAbsenceNotifications({
      alerts: targetAlerts,
      channel: absenceNotifyChannel,
      messageTemplate: absenceMessageTemplate,
      schoolName: school.name,
      triggeredBy: currentUser.name,
      triggerType: 'manual_bulk',
    });

    setAbsenceDispatchLogs((prev) => [logEntry, ...prev].slice(0, 25));
    setLastBulkDispatchReceipt(logEntry);
    showNotification(
      `Dispatched ${absenceNotifyChannel} notifications to parents of ${targetAlerts.length} student${
        targetAlerts.length === 1 ? '' : 's'
      } absent 3+ consecutive days!`
    );
  };

  const handleExportProfileQrAsImage = (studentToExport: Student) => {
    if (!profileQrDataUrl) return;
    const canvas = document.createElement('canvas');
    canvas.width = 760;
    canvas.height = 960;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#1e1b4b';
    ctx.lineWidth = 8;
    ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);

    ctx.fillStyle = '#1e1b4b';
    ctx.fillRect(16, 16, canvas.width - 32, 130);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(school.name.toUpperCase(), canvas.width / 2, 72);
    ctx.fillStyle = '#fcd34d';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(`STUDENT VERIFIED QR PROFILE • U-DISE: ${school.code}`, canvas.width / 2, 112);

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, (canvas.width - 320) / 2, 170, 320, 320);
      const addrOnce = formatSchoolAddressOnce(school);
      const details = [
        ['Student Name:', studentToExport.fullName || 'N/A'],
        ["Father's Name:", studentToExport.fatherName || 'N/A'],
        ['Date of Birth:', studentToExport.dob || 'N/A'],
        ['Admission No:', studentToExport.admissionNumber || studentToExport.id],
        ['Mobile Number:', studentToExport.mobileNumber || 'N/A'],
        ['School Name:', school.name || 'N/A'],
        ['School Address:', addrOnce || 'N/A'],
      ];
      ctx.textAlign = 'left';
      let y = 540;
      details.forEach(([k, v]) => {
        ctx.fillStyle = '#475569';
        ctx.font = 'bold 17px sans-serif';
        ctx.fillText(k, 52, y);
        ctx.fillStyle = '#0f172a';
        ctx.font = '17px sans-serif';
        ctx.fillText(String(v).slice(0, 48), 230, y);
        y += 46;
      });
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `Student_Profile_QR_${studentToExport.admissionNumber}.png`;
      link.click();
    };
    img.src = profileQrDataUrl;
  };

  const isStudentGraduated = (s: Student): boolean =>
    s.status === 'Graduated' ||
    (s.status === 'Archived' &&
      (s.history || []).some((h) => /graduated|alumni/i.test(`${h.title} ${h.details}`)));

  const availableClassOptions = useMemo(() => {
    const set = new Set<string>(school.classesOffered);
    uniqueStudents.forEach((s) => {
      if (s.classNumber) set.add(s.classNumber);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [school.classesOffered, uniqueStudents]);

  const availableSectionOptions = useMemo(() => {
    const set = new Set<string>(['A', 'B', 'C']);
    uniqueStudents.forEach((s) => {
      if (s.section) set.add(s.section);
    });
    return Array.from(set).sort();
  }, [uniqueStudents]);

  const statusCounts = useMemo(() => {
    const active = uniqueStudents.filter((s) => s.status === 'Active').length;
    const transferred = uniqueStudents.filter((s) => s.status === 'Transferred').length;
    const graduated = uniqueStudents.filter((s) => isStudentGraduated(s)).length;
    const archived = uniqueStudents.filter((s) => s.status === 'Archived').length;
    return { active, transferred, graduated, archived, all: uniqueStudents.length };
  }, [uniqueStudents]);

  const hasActiveAdvancedFilters =
    searchTerm.trim().length > 0 ||
    selectedClass !== 'all' ||
    selectedSection !== 'all' ||
    selectedStatus !== 'Active';

  // Filtered Students list (supports Class, Section, Status: Active / Transferred / Graduated / Archived / All, plus free-text search)
  const filteredStudents = uniqueStudents.filter((s) => {
    const q = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !q ||
      s.fullName.toLowerCase().includes(q) ||
      s.admissionNumber.toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q) ||
      s.fatherName.toLowerCase().includes(q) ||
      (s.motherName || '').toLowerCase().includes(q) ||
      s.rollNumber.toString().includes(q) ||
      `class ${s.classNumber}`.includes(q) ||
      `${s.classNumber}-${s.section}`.toLowerCase().includes(q) ||
      s.status.toLowerCase().includes(q);

    const matchesClass = selectedClass === 'all' || s.classNumber === selectedClass;
    const matchesSection = selectedSection === 'all' || s.section === selectedSection;
    const matchesStatus =
      selectedStatus === 'all'
        ? true
        : selectedStatus === 'Graduated'
        ? isStudentGraduated(s)
        : s.status === selectedStatus;

    return matchesSearch && matchesClass && matchesSection && matchesStatus;
  });

  // Multi-selection methods
  const isAllFilteredSelected =
    filteredStudents.length > 0 &&
    filteredStudents.every((s) => selectedStudentIds.includes(s.id));

  const handleToggleSelectAll = () => {
    if (isAllFilteredSelected) {
      const filteredIdSet = new Set(filteredStudents.map((s) => s.id));
      setSelectedStudentIds((prev) => prev.filter((id) => !filteredIdSet.has(id)));
    } else {
      const newIds = filteredStudents.map((s) => s.id);
      setSelectedStudentIds((prev) => Array.from(new Set([...prev, ...newIds])));
    }
  };

  const handleToggleSelectStudent = (id: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((sId) => sId !== id) : [...prev, id]
    );
  };

  const handleConfirmBulkDelete = () => {
    if (selectedStudentIds.length === 0) return;
    const count = selectedStudentIds.length;
    if (onBulkDeleteStudents) {
      onBulkDeleteStudents(selectedStudentIds);
    } else if (onDeleteStudent) {
      selectedStudentIds.forEach((id) => onDeleteStudent(id));
    }
    showNotification(`Successfully deleted ${count} selected student records.`);
    setSelectedStudentIds([]);
    setShowBulkDeleteModal(false);
  };

  // Handle Excel Import
  const handleExcelFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<any>(ws);

        let addedCount = 0;
        data.forEach((row, idx) => {
          if (row.Full_Name || row['Student Name']) {
            const nextIdNum = students.length + addedCount + 1;
            const newId = `SM-2026-${String(nextIdNum).padStart(3, '0')}`;
            const studentObj: Student = {
              id: newId,
              admissionNumber: row.Admission_Number || row['Admission No'] || `SRN-2026-${nextIdNum + 100}`,
              fullName: row.Full_Name || row['Student Name'] || 'Student',
              fatherName: row.Father_Name || row["Father's Name"] || 'Guardian',
              motherName: row.Mother_Name || row["Mother's Name"] || 'Mother',
              gender: row.Gender === 'Female' ? 'Female' : 'Male',
              dob: row.Date_of_Birth_YYYY_MM_DD || '2015-05-10',
              classNumber: String(row.Class || '5'),
              section: String(row.Section || 'A').toUpperCase(),
              rollNumber: Number(row.Roll_Number) || nextIdNum,
              academicSession: school.academicSession,
              address: row.Village_Town
                ? `${row.Village_Town}, ${school.district || 'Srinagar'}`
                : formatSchoolAddressOnce(school) || STANDARDIZED_ADDRESS,
              villageTown: row.Village_Town || school.villageTown || 'Pamposh Colony, Palpora',
              blockTehsil: school.blockTehsil || 'Iddgah',
              district: row.District || school.district || 'Srinagar',
              state: row.State || school.state || 'Jammu and Kashmir',
              pinCode: String(row.PIN_Code || school.pinCode || '190017'),
              mobileNumber: String(row.Parent_Mobile || '+91 98000 00000'),
              parentWhatsAppNumber: String(row.WhatsApp_Number || row['WhatsApp No'] || row.Parent_Mobile || '+91 98000 00000'),
              admissionDate: new Date().toISOString().slice(0, 10),
              status: 'Active',
              aadhaarStatus: 'Pending',
              parentConsentRecorded: false,
            };
            onAddStudent(studentObj);
            addedCount++;
          }
        });

        showNotification(`Successfully imported ${addedCount} students from Excel!`);
      } catch (err) {
        showNotification('Failed to parse Excel file. Please use the standard template.');
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastNotice && (
        <div className="bg-emerald-600 text-white p-3.5 rounded-2xl shadow-lg flex items-center justify-between text-xs font-bold animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>{toastNotice}</span>
          </div>
          <button
            onClick={() => setToastNotice(null)}
            className="p-1 hover:bg-emerald-700 rounded transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-600" />
            <span>{t.studentRegister}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {language === 'ur'
              ? 'جماعت 1 تا 8 کے تمام زیر تعلیم طلباء کی مکمل معلومات، داخلہ نمبر اور تصدیق کی حیثیت۔'
              : 'Official Student Register under RTE Act. Manage enrollments, records, and UIDAI compliance.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Export to Excel */}
          <button
            onClick={() => exportStudentRegisterToExcel(students, school, selectedClass)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100 transition-colors shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>{t.exportExcel}</span>
          </button>

          {/* Import from Excel */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300 transition-colors"
          >
            <Upload className="w-4 h-4 text-slate-600" />
            <span>{t.importExcel}</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleExcelFileUpload}
            accept=".xlsx, .xls"
            className="hidden"
          />

          {/* Download Template */}
          <button
            onClick={downloadStudentImportTemplate}
            title="Download blank Excel template for bulk student upload"
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 transition-colors"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Bulk Student Photo Match (Excel / Admission Number) */}
          {(currentUser.role === 'admin' || currentUser.role === 'head_teacher') && (
            <button
              onClick={() => setIsBulkPhotoModalOpen(true)}
              title="Upload multiple student photographs named by Admission Number or Student ID to match automatically"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors"
            >
              <Camera className="w-4 h-4 text-indigo-600" />
              <span>Bulk Photo Match</span>
            </button>
          )}

          {/* Auto-Calculate Attendance Marks button */}
          {(currentUser.role === 'admin' || currentUser.role === 'head_teacher') && (
            <button
              onClick={handleAutoAssignAttendanceMarks}
              title="Automatically calculate and assign continuous attendance evaluation marks (1-10) based on student attendance percentages"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300 transition-colors shadow-2xs"
            >
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span>Auto Attendance Marks</span>
            </button>
          )}

          {/* Student QR Passes Button */}
          <button
            onClick={() => {
              const target = filteredStudents[0] || students[0];
              if (target) setSelectedStudentForQr(target);
            }}
            title="Generate and print unique student QR passes representing admission numbers for instant attendance scanning"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 transition-colors shadow-2xs"
          >
            <QrCode className="w-4 h-4 text-indigo-600" />
            <span>Print QR Passes</span>
          </button>

          {/* Add New Student Button */}
          {(currentUser.role === 'admin' || currentUser.role === 'head_teacher') && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-600/30"
            >
              <Plus className="w-4 h-4" />
              <span>{t.registerStudent}</span>
            </button>
          )}
        </div>
      </div>

      {/* View Switcher: Student Register vs Promote Students */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200/80 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveMode('register')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg transition-all whitespace-nowrap ${
              activeMode === 'register'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>{language === 'ur' ? 'طلباء رجسٹر' : 'Student Register'}</span>
          </button>
          {(currentUser.role === 'admin' || currentUser.role === 'head_teacher') && (
            <button
              type="button"
              onClick={() => setActiveMode('promote')}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg transition-all whitespace-nowrap ${
                activeMode === 'promote'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              <span>{language === 'ur' ? 'طلباء کی ترقی (اگلی جماعت)' : 'Promote Students'}</span>
            </button>
          )}
        </div>

        <p className="text-[11px] text-slate-500 px-2">
          {activeMode === 'promote'
            ? 'Multi-select students from any class and promote them in one click while keeping marks, attendance, and class history.'
            : 'Manage student profiles, unique attendance QR passes, UIDAI Aadhaar verification, and transfer certificates.'}
        </p>
      </div>

      {activeMode === 'promote' ? (
        <div className="space-y-5">
          {/* Promotion Controls & Target Configuration Bar */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-indigo-600" />
                  <span>Promote Students to Next Grade Level</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Automatically appends promotion records to each student&apos;s Class History log.
                </p>
              </div>

              <button
                type="button"
                onClick={handleExecutePromotion}
                disabled={promoteSelectedIds.length === 0}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-500 text-white text-xs font-extrabold shadow-sm transition-colors whitespace-nowrap shrink-0"
              >
                <GraduationCap className="w-4 h-4" />
                <span>
                  {promoteTargetClass === 'GRADUATED'
                    ? `Graduate Selected (${promoteSelectedIds.length})`
                    : `Promote ${promoteSelectedIds.length} Student${promoteSelectedIds.length === 1 ? '' : 's'} to Class ${promoteTargetClass}`}
                </span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Source Class *
                </label>
                <select
                  value={promoteSourceClass}
                  onChange={(e) => handleSelectPromoteSourceClass(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-slate-50 font-bold text-slate-900"
                >
                  {(school.classesOffered || ['1', '2', '3', '4', '5', '6', '7', '8']).map((c) => (
                    <option key={c} value={c}>Class {c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Source Section
                </label>
                <select
                  value={promoteSourceSection}
                  onChange={(e) => {
                    setPromoteSourceSection(e.target.value);
                    setPromoteSelectedIds([]);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-slate-50 font-semibold text-slate-800"
                >
                  <option value="all">All Sections</option>
                  <option value="A">Section A</option>
                  <option value="B">Section B</option>
                  <option value="C">Section C</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-indigo-700 uppercase tracking-wider mb-1">
                  Target Next Grade *
                </label>
                <select
                  value={promoteTargetClass}
                  onChange={(e) => setPromoteTargetClass(e.target.value)}
                  className="w-full px-3 py-2 border border-indigo-300 rounded-xl bg-indigo-50/70 font-extrabold text-indigo-900"
                >
                  {(school.classesOffered || ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']).map((c) => (
                    <option key={c} value={c}>Class {c}</option>
                  ))}
                  <option value="GRADUATED">Graduated / Alumni (Archive)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Target Section
                </label>
                <select
                  value={promoteTargetSection}
                  onChange={(e) => setPromoteTargetSection(e.target.value)}
                  disabled={promoteTargetClass === 'GRADUATED'}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-semibold text-slate-800 disabled:opacity-50"
                >
                  <option value="KEEP">Keep Current Section</option>
                  <option value="A">Move All to Section A</option>
                  <option value="B">Move All to Section B</option>
                  <option value="C">Move All to Section C</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  New Academic Session
                </label>
                <input
                  type="text"
                  value={promoteTargetSession}
                  onChange={(e) => setPromoteTargetSession(e.target.value)}
                  placeholder="2027-2028"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold text-slate-900"
                />
              </div>
            </div>
          </div>

          {/* Promotion Roster Multi-Select Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900">
                  Class {promoteSourceClass} Active Students ({promoteEligibleStudents.length})
                </span>
                <span className="text-slate-500 font-mono tabular-nums">
                  • {promoteSelectedIds.length} selected
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTogglePromoteAll}
                  disabled={promoteEligibleStudents.length === 0}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 font-bold text-xs disabled:opacity-40"
                >
                  {isAllPromoteSelected ? 'Clear Selection' : 'Select All Class Students'}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={isAllPromoteSelected}
                        onChange={handleTogglePromoteAll}
                        aria-label="Select all students for promotion"
                        className="w-4 h-4 rounded text-indigo-600 border-slate-300 cursor-pointer"
                      />
                    </th>
                    <th className="py-3 px-3 w-16">Roll</th>
                    <th className="py-3 px-3">Student Name</th>
                    <th className="py-3 px-3">Admission No</th>
                    <th className="py-3 px-3">Current Class &amp; Session</th>
                    <th className="py-3 px-3">Target Promotion</th>
                    <th className="py-3 px-3 text-right">History</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {promoteEligibleStudents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        No active students found in Class {promoteSourceClass}
                        {promoteSourceSection !== 'all' ? ` Section ${promoteSourceSection}` : ''}.
                      </td>
                    </tr>
                  ) : (
                    promoteEligibleStudents.map((st) => {
                      const isChecked = promoteSelectedIds.includes(st.id);
                      const nextSec = promoteTargetSection === 'KEEP' ? st.section : promoteTargetSection;
                      return (
                        <tr
                          key={st.id}
                          onClick={() =>
                            setPromoteSelectedIds((prev) =>
                              prev.includes(st.id) ? prev.filter((id) => id !== st.id) : [...prev, st.id]
                            )
                          }
                          className={`cursor-pointer transition-colors ${
                            isChecked ? 'bg-indigo-50/60' : 'hover:bg-slate-50/70'
                          }`}
                        >
                          <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() =>
                                setPromoteSelectedIds((prev) =>
                                  prev.includes(st.id) ? prev.filter((id) => id !== st.id) : [...prev, st.id]
                                )
                              }
                              aria-label={`Select ${st.fullName} for promotion`}
                              className="w-4 h-4 rounded text-indigo-600 border-slate-300 cursor-pointer"
                            />
                          </td>
                          <td className="py-3 px-3 font-mono tabular-nums font-bold text-slate-800">
                            #{st.rollNumber}
                          </td>
                          <td className="py-3 px-3">
                            <p className="font-bold text-slate-900">{st.fullName}</p>
                            <p className="text-[11px] text-slate-500">Father: {st.fatherName}</p>
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-700 font-semibold">
                            {st.admissionNumber}
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-bold text-slate-800">
                              Class {st.classNumber}-{st.section}
                            </span>
                            <span className="block text-[10px] font-mono text-slate-500">
                              Session {st.academicSession}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded font-bold text-[11px] ${
                                promoteTargetClass === 'GRADUATED'
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              {promoteTargetClass === 'GRADUATED'
                                ? 'Alumni / Archived'
                                : `Class ${promoteTargetClass}-${nextSec} (${promoteTargetSession})`}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => setHistoryStudent(st)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 font-semibold text-[11px]"
                            >
                              <History className="w-3.5 h-3.5" />
                              <span>{st.history?.length || 0} Log(s)</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Upcoming Birthdays Card */}
          <UpcomingBirthdaysCard
            students={students}
            school={school}
            currentUser={currentUser}
            language={language}
            onViewStudent={(st) => setViewingProfile(st)}
          />

          {/* Automated Consecutive Absence Notification Trigger (3+ Consecutive Days) */}
          {canManageAbsenceAlerts && (
            <div className="bg-gradient-to-r from-rose-50 via-amber-50/70 to-white border border-rose-200/90 rounded-2xl p-4 sm:p-5 shadow-sm">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border shadow-xs ${
                    consecutiveAbsenceAlerts.length > 0
                      ? 'bg-rose-600 text-white border-rose-500'
                      : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                  }`}>
                    <Bell className={`w-5 h-5 ${consecutiveAbsenceAlerts.length > 0 ? 'animate-pulse' : ''}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                        {language === 'ur'
                          ? 'مسلسل غیر حاضری خودکار اطلاع (3 یا زیادہ دن)'
                          : 'Automated Consecutive Absence Alert Trigger (3+ Days)'}
                      </h2>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold border ${
                          consecutiveAbsenceAlerts.length > 0
                            ? 'bg-rose-100 text-rose-800 border-rose-300'
                            : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        }`}
                      >
                        {consecutiveAbsenceAlerts.length} Student{consecutiveAbsenceAlerts.length === 1 ? '' : 's'} Flagged
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                        <Zap className="w-3 h-3" />
                        <span>{autoAbsenceTriggerEnabled ? 'Auto-Trigger ON' : 'Auto-Trigger OFF'}</span>
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      {consecutiveAbsenceAlerts.length > 0
                        ? `Detected ${consecutiveAbsenceAlerts.length} active student${
                            consecutiveAbsenceAlerts.length === 1 ? '' : 's'
                          } absent for 3 or more consecutive school days. Send bulk SMS & Push alerts to parents immediately.`
                        : 'All active students currently have fewer than 3 consecutive absent days. Auto-trigger continues monitoring daily attendance records.'}
                    </p>

                    {consecutiveAbsenceAlerts.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        {consecutiveAbsenceAlerts.slice(0, 5).map((alert) => (
                          <button
                            key={alert.student.id}
                            type="button"
                            onClick={() => setViewingProfile(alert.student)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white hover:bg-rose-50 border border-rose-200 text-[11px] font-bold text-slate-800 transition-colors shadow-2xs"
                          >
                            <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                            <span>{alert.student.fullName}</span>
                            <span className="font-mono text-[10px] text-slate-500">
                              (Cl {alert.student.classNumber}-{alert.student.section})
                            </span>
                            <span className="px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 text-[10px] font-extrabold">
                              {alert.consecutiveDays}d
                            </span>
                          </button>
                        ))}
                        {consecutiveAbsenceAlerts.length > 5 && (
                          <span className="text-[11px] font-bold text-rose-700 px-2">
                            +{consecutiveAbsenceAlerts.length - 5} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Controls */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleToggleAutoAbsenceTrigger}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                      autoAbsenceTriggerEnabled
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                        : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>{autoAbsenceTriggerEnabled ? 'Auto-Trigger Active' : 'Enable Auto-Trigger'}</span>
                  </button>

                  {consecutiveAbsenceAlerts.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleExecuteBulkAbsenceNotification(consecutiveAbsenceAlerts)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-600/30 transition-all active:scale-95"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Bulk SMS/Push ({consecutiveAbsenceAlerts.length})</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setLastBulkDispatchReceipt(null);
                      setIsAbsenceNotifyModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition-all active:scale-95"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-amber-300" />
                    <span>Configure &amp; Review ({absenceDispatchLogs.length} Sent)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

      {/* Bulk Delete Bar */}
      {selectedStudentIds.length > 0 && (currentUser.role === 'admin' || currentUser.role === 'head_teacher') && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-in fade-in duration-150">
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-xl bg-rose-600 text-white flex items-center justify-center font-extrabold text-xs">
              {selectedStudentIds.length}
            </span>
            <div>
              <p className="font-extrabold text-rose-900">
                {selectedStudentIds.length} {selectedStudentIds.length === 1 ? 'Student' : 'Students'} Selected
              </p>
              <p className="text-[11px] text-rose-700/90">
                Select multiple students to perform bulk operations or remove records at once.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-white border border-rose-200 rounded-xl px-2 py-1">
              <input
                type="text"
                value={batchSessionInput}
                onChange={(e) => setBatchSessionInput(e.target.value)}
                placeholder="2026-2027"
                className="w-24 text-xs font-mono font-bold text-slate-800 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleBatchUpdateAcademicSession}
                className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px]"
              >
                Set Session
              </button>
            </div>
            <button
              type="button"
              onClick={() => setSelectedStudentIds([])}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-bold border border-slate-200 transition-colors"
            >
              Deselect All
            </button>
            <button
              type="button"
              onClick={() => setShowBulkDeleteModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold shadow-sm shadow-rose-600/30 transition-all active:scale-95"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Bulk Delete ({selectedStudentIds.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* Advanced Search & Filter Bar (Class, Section & Status: Active / Transferred / Graduated) */}
      <div
        data-testid="student-advanced-filter-bar"
        className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3"
      >
        <div className="flex flex-col lg:flex-row gap-3">
          {/* Free-text Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={
                language === 'ur'
                  ? 'نام، رول نمبر، داخلہ نمبر، کلاس یا حیثیت سے تلاش کریں...'
                  : 'Search by name, admission no, roll no, parent, class-section, or status...'
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search students"
              className="w-full pl-10 pr-8 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                aria-label="Clear search term"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Structured Advanced Filters: Assigned Class, Section, and Enrollment Status */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              aria-label="Filter by assigned class"
              className="px-3 py-2 border border-slate-200 rounded-xl bg-slate-50/50 font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">{language === 'ur' ? 'تمام جماعتیں' : 'All Classes'}</option>
              {availableClassOptions.map((c) => (
                <option key={c} value={c}>
                  Class {c}
                </option>
              ))}
            </select>

            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              aria-label="Filter by assigned section"
              className="px-3 py-2 border border-slate-200 rounded-xl bg-slate-50/50 font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">{language === 'ur' ? 'تمام شعبہ جات' : 'All Sections'}</option>
              {availableSectionOptions.map((sec) => (
                <option key={sec} value={sec}>
                  Section {sec}
                </option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              aria-label="Filter by student status"
              className="px-3 py-2 border border-slate-200 rounded-xl bg-slate-50/50 font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="Active">Active ({statusCounts.active})</option>
              <option value="Transferred">Transferred ({statusCounts.transferred})</option>
              <option value="Graduated">Graduated ({statusCounts.graduated})</option>
              <option value="Archived">Archived ({statusCounts.archived})</option>
              <option value="all">All Statuses ({statusCounts.all})</option>
            </select>

            {hasActiveAdvancedFilters && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedClass('all');
                  setSelectedSection('all');
                  setSelectedStatus('Active');
                }}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Status Filter Tabs & Active Filter Summary */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-[11px]">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">
              Status Filter:
            </span>
            {[
              { id: 'Active', label: 'Active', count: statusCounts.active, activeCls: 'bg-emerald-600 text-white border-emerald-600' },
              { id: 'Transferred', label: 'Transferred', count: statusCounts.transferred, activeCls: 'bg-amber-600 text-white border-amber-600' },
              { id: 'Graduated', label: 'Graduated', count: statusCounts.graduated, activeCls: 'bg-indigo-600 text-white border-indigo-600' },
              { id: 'all', label: 'All Students', count: statusCounts.all, activeCls: 'bg-slate-900 text-white border-slate-900' },
            ].map((chip) => {
              const isSelected = selectedStatus === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setSelectedStatus(chip.id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-bold transition-colors ${
                    isSelected
                      ? chip.activeCls
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span>{chip.label}</span>
                  <span className={`font-mono text-[10px] ${isSelected ? 'opacity-90' : 'text-slate-400'}`}>
                    {chip.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
            {selectedClass !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold">
                Class {selectedClass}
                <button type="button" onClick={() => setSelectedClass('all')} aria-label="Remove class filter">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedSection !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold">
                Sec {selectedSection}
                <button type="button" onClick={() => setSelectedSection('all')} aria-label="Remove section filter">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Students Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>
            {language === 'ur' ? 'موجودہ طلباء:' : 'Showing Students:'}{' '}
            <strong className="text-slate-900 font-bold">{filteredStudents.length}</strong>
          </span>
          <span className="text-[11px] text-slate-400">
            {language === 'ur' ? 'تصدیق کی حیثیت دیکھنے کے لیے کلک کریں' : 'Click Aadhaar badge to verify UIDAI status'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                {(currentUser.role === 'admin' || currentUser.role === 'head_teacher') && (
                  <th className="py-3 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={isAllFilteredSelected}
                      onChange={handleToggleSelectAll}
                      title="Select all displayed students"
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                    />
                  </th>
                )}
                <th className="py-3 px-3 w-16">Roll</th>
                <th className="py-3 px-3">Student Name</th>
                <th className="py-3 px-3">Student ID / SRN</th>
                <th className="py-3 px-3">Class-Sec</th>
                <th className="py-3 px-3">Father / Mother</th>
                <th className="py-3 px-3">Mobile</th>
                <th className="py-3 px-3">Aadhaar Status</th>
                <th className="py-3 px-3 text-center min-w-[130px]">Attendance Marks</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={currentUser.role === 'admin' || currentUser.role === 'head_teacher' ? 10 : 9} className="py-12 text-center text-slate-400 text-xs">
                    {language === 'ur' ? 'کوئی طالب علم ریکارڈ نہیں ملا' : 'No student records match the selected filters.'}
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s) => (
                  <tr key={s.id} className={`hover:bg-slate-50/70 transition-colors ${selectedStudentIds.includes(s.id) ? 'bg-indigo-50/50' : ''}`}>
                    {(currentUser.role === 'admin' || currentUser.role === 'head_teacher') && (
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedStudentIds.includes(s.id)}
                          onChange={() => handleToggleSelectStudent(s.id)}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                        />
                      </td>
                    )}
                    <td className="py-3 px-3 font-mono font-bold text-slate-800">
                      #{s.rollNumber}
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-900">
                      <div className="flex items-start gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-indigo-700 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-sm mt-0.5 overflow-hidden border border-indigo-200/70">
                          {s.photoDataUrl ? (
                            <img src={s.photoDataUrl} alt={s.fullName} className="w-full h-full object-cover" />
                          ) : (
                            s.fullName.slice(0, 1)
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-extrabold text-slate-900 text-sm hover:text-indigo-600 transition-colors">
                              {s.fullName}
                            </span>
                            {consecutiveAbsenceMap.has(s.id) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setLastBulkDispatchReceipt(null);
                                  setIsAbsenceNotifyModalOpen(true);
                                }}
                                title={`Absent for ${consecutiveAbsenceMap.get(s.id)!.consecutiveDays} consecutive school days — Click to notify parent via SMS/Push`}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 text-[10px] font-extrabold transition-colors"
                              >
                                <Bell className="w-2.5 h-2.5" />
                                <span>{consecutiveAbsenceMap.get(s.id)!.consecutiveDays}d Absent</span>
                              </button>
                            )}
                            {(currentUser.role === 'admin' || currentUser.role === 'head_teacher') && (
                              <button
                                onClick={() => handleOpenEditNameModal(s)}
                                title="Edit Student Name"
                                className="p-0.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 font-normal mt-0.5">
                            DOB: {s.dob} • {s.gender}
                          </p>

                          {/* Action Options Directly Below Student Name and Details */}
                          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                            <button
                              onClick={() => setSelectedStudentForQr(s)}
                              title="Generate & Print Student QR Code Pass"
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-800 hover:text-slate-950 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-lg border border-slate-300 transition-all shadow-2xs active:scale-95"
                            >
                              <QrCode className="w-3 h-3 text-indigo-600" />
                              <span>QR Pass</span>
                            </button>
                            {(currentUser.role === 'admin' || currentUser.role === 'head_teacher') && (
                              <>
                                <button
                                  onClick={() => handleOpenEditAddress(s)}
                                  title="Edit Student Address"
                                  className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-lg border border-emerald-200 transition-all shadow-xs active:scale-95"
                                >
                                  <MapPin className="w-3 h-3 text-emerald-600" />
                                  <span>Edit Address</span>
                                </button>
                                <button
                                  onClick={() => setEditingStudent(s)}
                                  title="Edit Student Information, Class, Admission No & Session"
                                  className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-lg border border-indigo-200 transition-all shadow-xs active:scale-95"
                                >
                                  <Edit2 className="w-3 h-3 text-indigo-600" />
                                  <span>Edit Student</span>
                                </button>
                                <button
                                  onClick={() => handleOpenTransferModal(s)}
                                  title="Transfer Student to Another School"
                                  className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 hover:text-amber-950 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded-lg border border-amber-200 transition-all shadow-xs active:scale-95"
                                >
                                  <ArrowRightLeft className="w-3 h-3 text-amber-600" />
                                  <span>Transfer</span>
                                </button>
                                <button
                                  onClick={() => setHistoryStudent(s)}
                                  title="View Student Academic & Transfer History"
                                  className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 px-2 py-0.5 rounded-lg border border-purple-200 transition-all shadow-xs active:scale-95"
                                >
                                  <History className="w-3 h-3 text-purple-600" />
                                  <span>History</span>
                                </button>
                                <button
                                  onClick={() => handleInitiateDelete(s)}
                                  title="Delete this student"
                                  className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 px-2 py-0.5 rounded-lg border border-rose-200 transition-all shadow-xs active:scale-95"
                                >
                                  <Trash2 className="w-3 h-3 text-rose-600" />
                                  <span>Delete</span>
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-600">
                      <div>{s.id}</div>
                      <div className="text-[10px] text-indigo-700 font-bold">{s.admissionNumber}</div>
                      <div className="text-[10px] text-slate-400">Session: {s.academicSession}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded font-bold bg-slate-100 text-slate-800 text-[11px]">
                        Class {s.classNumber}-{s.section}
                      </span>
                      {s.status === 'Transferred' && (
                        <div className="mt-1 text-[10px] font-bold text-amber-700">
                          Transferred {s.transferDate ? `(${s.transferDate})` : ''}
                        </div>
                      )}
                      {isStudentGraduated(s) && (
                        <div className="mt-1 inline-flex items-center px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold">
                          Graduated
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      <div>{s.fatherName}</div>
                      <div className="text-[10px] text-slate-400">{s.motherName}</div>
                    </td>
                    <td className="py-3 px-3 text-slate-600 font-mono">
                      <div>{s.mobileNumber}</div>
                      {s.parentWhatsAppNumber && (
                        <div className="text-[10px] text-emerald-600 font-sans flex items-center gap-1 mt-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                          <span>WA: {s.parentWhatsAppNumber}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <button
                        onClick={() => setVerifyingStudent(s)}
                        title="Click to view or verify Aadhaar details"
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all hover:scale-105 ${
                          s.aadhaarStatus === 'Verified'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                            : s.aadhaarStatus === 'Alternative_ID_Provided'
                            ? 'bg-blue-50 text-blue-700 border border-blue-300'
                            : 'bg-amber-50 text-amber-700 border border-amber-300 animate-pulse'
                        }`}
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>
                          {s.aadhaarStatus === 'Verified'
                            ? s.maskedAadhaar || 'Verified'
                            : s.aadhaarStatus === 'Alternative_ID_Provided'
                            ? 'Alt ID'
                            : 'Pending'}
                        </span>
                      </button>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="flex flex-col items-center justify-center gap-1">
                        <div className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded-lg shadow-2xs">
                          <input
                            type="number"
                            min="0"
                            max="10"
                            value={s.attendanceMarks ?? 9}
                            onChange={(e) => {
                              const val = Math.max(0, Math.min(10, parseInt(e.target.value, 10) || 0));
                              onUpdateStudent({ ...s, attendanceMarks: val });
                              showNotification(`Updated attendance marks for ${s.fullName} to ${val}/10.`);
                            }}
                            title="Attendance continuous evaluation marks (0-10) directly editable"
                            className="w-10 text-center py-0.5 text-xs font-mono font-bold text-indigo-900 bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500"
                          />
                          <span className="text-[10px] font-bold text-slate-500">/ 10</span>
                        </div>
                        <span className="text-[9.5px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded-full border border-emerald-200/60">
                          92.4% Turnout
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => setSelectedStudentForQr(s)}
                          title="Generate & Print Student QR Code Pass"
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                          <QrCode className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setViewingProfile(s)}
                          title="Print / View Student Profile Card"
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {(currentUser.role === 'admin' || currentUser.role === 'head_teacher') && (
                          <>
                            <button
                              onClick={() => setEditingStudent(s)}
                              title="Edit Student Info"
                              className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleInitiateDelete(s)}
                              title="Delete Student"
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
        </>
      )}

      {/* Aadhaar Verification Modal */}
      {verifyingStudent && (
        <AadhaarVerificationModal
          student={verifyingStudent}
          isOpen={!!verifyingStudent}
          onClose={() => setVerifyingStudent(null)}
          onSaveVerification={(updates) => {
            const updated = { ...verifyingStudent, ...updates };
            onUpdateStudent(updated);
            setVerifyingStudent(null);
          }}
          language={language}
        />
      )}

      {/* Student Profile Card Print Modal */}
      {viewingProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm no-print">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <span className="text-sm font-bold flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-400" />
                {t.profileCard} - {viewingProfile.fullName}
              </span>
              <button
                onClick={() => setViewingProfile(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Printable Document Area */}
            <div className="p-6 overflow-y-auto space-y-6 printable-card">
              {/* Official School Header */}
              <div className="text-center border-b pb-4 border-slate-300">
                <h2 className="text-lg font-extrabold text-slate-900 uppercase">
                  {school.name}
                </h2>
                <p className="text-xs text-slate-600 font-medium">
                  {formatSchoolAddressOnce(school)}
                </p>
                <p className="text-xs text-indigo-700 font-bold mt-1">
                  U-DISE Code: {school.code} • Academic Session: {school.academicSession}
                </p>
                <h3 className="mt-2 text-sm font-bold bg-slate-100 py-1 text-slate-800 uppercase tracking-wider rounded">
                  STUDENT PERMANENT ADMISSION RECORD CARD (छात्र स्थायी अभिलेख)
                </h3>
              </div>

              {/* Student Details Grid + Embedded Verified 7-Field QR Code */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs items-start">
                <div className="space-y-2">
                  <p><span className="text-slate-500">Admission No (Primary Key):</span> <strong className="font-mono text-indigo-900">{viewingProfile.admissionNumber}</strong></p>
                  <p><span className="text-slate-500">Student ID:</span> <strong className="font-mono text-slate-900">{viewingProfile.id}</strong></p>
                  <p><span className="text-slate-500">Full Name:</span> <strong className="text-slate-900">{viewingProfile.fullName}</strong></p>
                  <p><span className="text-slate-500">Father's Name:</span> <strong className="text-slate-900">{viewingProfile.fatherName}</strong></p>
                  <p><span className="text-slate-500">Mother's Name:</span> <strong className="text-slate-900">{viewingProfile.motherName}</strong></p>
                  <p><span className="text-slate-500">Gender:</span> <strong>{viewingProfile.gender}</strong></p>
                </div>

                <div className="space-y-2">
                  <p><span className="text-slate-500">Class & Section:</span> <strong>Class {viewingProfile.classNumber} - {viewingProfile.section} (Roll #{viewingProfile.rollNumber})</strong></p>
                  <p><span className="text-slate-500">Date of Birth:</span> <strong>{viewingProfile.dob}</strong></p>
                  <p><span className="text-slate-500">Parent Mobile:</span> <strong className="font-mono">{viewingProfile.mobileNumber}</strong></p>
                  <p><span className="text-slate-500">WhatsApp No:</span> <strong className="font-mono text-emerald-700">{viewingProfile.parentWhatsAppNumber || viewingProfile.mobileNumber}</strong></p>
                  <p><span className="text-slate-500">Admission Date:</span> <strong>{viewingProfile.admissionDate}</strong></p>
                  <p><span className="text-slate-500">Status:</span> <span className="font-bold text-emerald-600">{viewingProfile.status}</span></p>
                  <p>
                    <span className="text-slate-500">Aadhaar Status:</span>{' '}
                    <strong className="text-indigo-700">
                      {viewingProfile.aadhaarStatus} ({viewingProfile.maskedAadhaar || viewingProfile.alternativeIdType || 'Pending'})
                    </strong>
                  </p>
                </div>

                <div className="flex flex-col items-center p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  {profileQrDataUrl ? (
                    <img
                      src={profileQrDataUrl}
                      alt={`Student QR for ${viewingProfile.admissionNumber}`}
                      className="w-28 h-28 object-contain rounded-lg border border-slate-200 bg-white p-1"
                    />
                  ) : (
                    <div className="w-28 h-28 flex items-center justify-center text-[10px] text-slate-400">
                      Generating QR...
                    </div>
                  )}
                  <span className="text-[10px] font-mono font-bold text-slate-700">
                    {viewingProfile.admissionNumber}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleExportProfileQrAsImage(viewingProfile)}
                    className="w-full py-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center justify-center gap-1 transition-colors no-print"
                  >
                    <Download className="w-3 h-3" />
                    <span>Export as Image</span>
                  </button>
                </div>
              </div>

              {/* Address with Edit & Save Options */}
              <div className="p-3.5 bg-slate-50 rounded-2xl text-xs space-y-2 border border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                    <MapPin className="w-4 h-4 text-rose-500" />
                    <span>Full Residential Address</span>
                  </div>
                  {(currentUser.role === 'admin' || currentUser.role === 'head_teacher') && (
                    <button
                      onClick={() => handleOpenEditAddress(viewingProfile)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors shadow-2xs"
                      title="Edit Student Address"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Edit Address</span>
                    </button>
                  )}
                </div>
                <p className="text-slate-800 font-semibold leading-relaxed bg-white p-2.5 rounded-xl border border-slate-200">
                  {viewingProfile.address}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-[10.5px] text-slate-500 font-mono">
                  <span>Village/Town: <strong className="text-slate-700">{viewingProfile.villageTown}</strong></span>
                  <span>•</span>
                  <span>Tehsil: <strong className="text-slate-700">{viewingProfile.blockTehsil}</strong></span>
                  <span>•</span>
                  <span>Dist: <strong className="text-slate-700">{viewingProfile.district}</strong></span>
                  <span>•</span>
                  <span>PIN: <strong className="text-slate-700">{viewingProfile.pinCode}</strong></span>
                </div>
              </div>

              {/* Signatures */}
              <div className="pt-8 grid grid-cols-3 text-center text-xs text-slate-700 border-t border-slate-200">
                <div>
                  <div className="h-10"></div>
                  <p className="font-bold border-t border-slate-400 pt-1">Class Teacher</p>
                </div>
                <div>
                  <div className="h-10"></div>
                  <p className="font-bold border-t border-slate-400 pt-1">Dealing Assistant</p>
                </div>
                <div>
                  <div className="h-10"></div>
                  <p className="font-bold border-t border-slate-400 pt-1">Head Teacher / Principal</p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">RTE Act Standard Format</span>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <Printer className="w-4 h-4" />
                  <span>{t.exportPdf}</span>
                </button>
                <button
                  onClick={() => setViewingProfile(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  {t.close}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Add / Edit Student Modal */}
      {(isAddModalOpen || editingStudent) && (
        <StudentFormModal
          isOpen={isAddModalOpen || !!editingStudent}
          onClose={() => {
            setIsAddModalOpen(false);
            setEditingStudent(null);
          }}
          initialData={editingStudent}
          onSave={(data) => {
            if (editingStudent) {
              const updatedRecord = { ...editingStudent, ...data };
              onUpdateStudent(updatedRecord);
              if (viewingProfile && viewingProfile.id === updatedRecord.id) {
                setViewingProfile(updatedRecord);
              }
            } else {
              const normalizedAdm = (data.admissionNumber || '').trim().toUpperCase();
              const existingByAdm = uniqueStudents.find(
                (s) => (s.admissionNumber || '').trim().toUpperCase() === normalizedAdm
              );
              if (existingByAdm) {
                onUpdateStudent({ ...existingByAdm, ...data, id: existingByAdm.id });
                showNotification(
                  `Updated existing student record for Admission No "${data.admissionNumber}" (primary key enforced).`
                );
              } else {
                const maxNumericSuffix = uniqueStudents.reduce((max, s) => {
                  const m = (s.id || '').match(/(\d+)$/);
                  const num = m ? parseInt(m[1], 10) : 0;
                  return num > max ? num : max;
                }, 0);
                const newId = `SM-2026-${String(maxNumericSuffix + 1).padStart(3, '0')}`;
                onAddStudent({
                  ...data,
                  id: newId,
                  status: 'Active',
                  aadhaarStatus: 'Pending',
                  academicSession: school.academicSession,
                } as Student);
              }
            }
            setIsAddModalOpen(false);
            setEditingStudent(null);
          }}
          school={school}
          language={language}
        />
      )}

      {/* Bulk Photo Matching Modal (Excel / Admission Number) */}
      <BulkPhotoImportModal
        isOpen={isBulkPhotoModalOpen}
        onClose={() => setIsBulkPhotoModalOpen(false)}
        students={uniqueStudents}
        onApplyMatchedPhotos={(updates) => {
          updates.forEach(({ student, photoDataUrl }) => {
            onUpdateStudent({ ...student, photoDataUrl });
          });
          showNotification(
            `Updated photographs for ${updates.length} student${updates.length === 1 ? '' : 's'} matched by Admission Number / ID.`
          );
        }}
      />

      {/* Bulk SMS / Push Notification Modal for 3+ Consecutive Absent Students */}
      {isAbsenceNotifyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-sm no-print">
          <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-400/40 flex items-center justify-center shrink-0">
                  <Bell className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-base font-extrabold truncate">
                    Bulk SMS &amp; Push Notification Trigger (3+ Consecutive Absent Days)
                  </h2>
                  <p className="text-[11px] text-slate-400 truncate">
                    Notify parents of chronically absent students &amp; manage automated trigger rules
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAbsenceNotifyModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-5 text-xs">
              {/* Auto-Trigger & Delivery Channel Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-extrabold text-slate-900 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-500" />
                      <span>Automated Daily Trigger</span>
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Automatically alert parents whenever a student hits 3+ consecutive absent school days.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleAutoAbsenceTrigger}
                    className={`px-3 py-1.5 rounded-xl font-extrabold text-[11px] shrink-0 transition-colors ${
                      autoAbsenceTriggerEnabled
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {autoAbsenceTriggerEnabled ? 'ENABLED' : 'PAUSED'}
                  </button>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <p className="font-extrabold text-slate-900 flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Delivery Channel</span>
                  </p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['SMS + Push', 'Push Only', 'SMS Only'] as const).map((ch) => (
                      <button
                        key={ch}
                        type="button"
                        onClick={() => setAbsenceNotifyChannel(ch)}
                        className={`px-2 py-1.5 rounded-lg font-bold text-[11px] border transition-all ${
                          absenceNotifyChannel === ch
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {ch}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Delivery Confirmation Receipt Banner */}
              {lastBulkDispatchReceipt && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 flex items-start gap-2.5 text-emerald-900">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold">
                      Bulk {lastBulkDispatchReceipt.channel} Dispatched to {lastBulkDispatchReceipt.recipientCount} Parent
                      {lastBulkDispatchReceipt.recipientCount === 1 ? '' : 's'}!
                    </p>
                    <p className="text-[11px] text-emerald-800 mt-0.5">
                      Sample message: &ldquo;{lastBulkDispatchReceipt.messagePreview}&rdquo;
                    </p>
                  </div>
                </div>
              )}

              {/* Flagged Students Recipient Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-slate-900">
                    Students Absent 3+ Consecutive Days ({consecutiveAbsenceAlerts.length})
                  </h3>
                  {consecutiveAbsenceAlerts.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedAbsenceStudentIds.length === consecutiveAbsenceAlerts.length) {
                          setSelectedAbsenceStudentIds([]);
                        } else {
                          setSelectedAbsenceStudentIds(consecutiveAbsenceAlerts.map((a) => a.student.id));
                        }
                      }}
                      className="text-[11px] font-bold text-indigo-600 hover:underline"
                    >
                      {selectedAbsenceStudentIds.length === consecutiveAbsenceAlerts.length
                        ? 'Deselect All'
                        : 'Select All'}
                    </button>
                  )}
                </div>

                {consecutiveAbsenceAlerts.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-center space-y-1.5">
                    <CheckCircle2 className="w-7 h-7 text-emerald-600 mx-auto" />
                    <p className="font-bold text-emerald-900">No students currently absent for 3+ consecutive days.</p>
                    <p className="text-[11px] text-emerald-700">
                      Mark consecutive absences in Daily Attendance to trigger parent notifications here automatically.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-100 max-h-56 overflow-y-auto">
                    {consecutiveAbsenceAlerts.map((alert) => {
                      const isChecked = selectedAbsenceStudentIds.includes(alert.student.id);
                      return (
                        <label
                          key={alert.student.id}
                          className={`p-3 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                            isChecked ? 'bg-rose-50/50' : 'bg-white hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleAbsenceRecipient(alert.student.id)}
                              className="w-4 h-4 rounded accent-rose-600 shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-extrabold text-slate-900">{alert.student.fullName}</span>
                                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                  {alert.student.admissionNumber}
                                </span>
                                <span className="text-[11px] font-semibold text-indigo-700">
                                  Class {alert.student.classNumber}-{alert.student.section}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                                Parent: <strong className="font-mono text-slate-700">{alert.parentContact}</strong> • Absent Dates:{' '}
                                <span className="font-mono text-rose-700">{alert.absentDates.join(', ')}</span>
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end shrink-0 gap-1">
                            <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 font-extrabold text-[11px]">
                              {alert.consecutiveDays} Days Absent
                            </span>
                            {alert.isOngoing && (
                              <span className="text-[10px] font-bold text-rose-600">Ongoing Streak</span>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Editable SMS/Push Message Template */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-extrabold text-slate-900">
                    Parent Notification Message Template (SMS &amp; Push)
                  </label>
                  <span className="text-[10px] font-mono text-slate-500">
                    Tokens: {'{studentName}'}, {'{days}'}, {'{dates}'}, {'{schoolName}'}
                  </span>
                </div>
                <textarea
                  rows={3}
                  value={absenceMessageTemplate}
                  onChange={(e) => setAbsenceMessageTemplate(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Dispatch Audit History */}
              {absenceDispatchLogs.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <h3 className="font-extrabold text-slate-800 flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-slate-500" />
                    <span>Recent Bulk Dispatch Audit Log ({absenceDispatchLogs.length})</span>
                  </h3>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {absenceDispatchLogs.slice(0, 6).map((log) => (
                      <div
                        key={log.id}
                        className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2 text-[11px]"
                      >
                        <div className="min-w-0">
                          <span className="font-bold text-slate-900">
                            {log.channel} • {log.recipientCount} parent{log.recipientCount === 1 ? '' : 's'}
                          </span>
                          <span className="ml-2 px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold text-[10px]">
                            {log.triggerType === 'automated_trigger' ? 'Auto-Triggered' : 'Manual Bulk'}
                          </span>
                          <p className="text-[10px] text-slate-500 truncate mt-0.5">
                            By {log.triggeredBy} • {log.recipients.map((r) => r.studentName).join(', ')}
                          </p>
                        </div>
                        <span className="font-mono text-[10px] text-slate-400 shrink-0">
                          {new Date(log.dispatchedAt).toLocaleString([], {
                            month: 'short',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
              <span className="text-[11px] font-semibold text-slate-600">
                Selected recipients: <strong className="text-rose-700">{selectedAbsenceStudentIds.length}</strong> /{' '}
                {consecutiveAbsenceAlerts.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAbsenceNotifyModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled={selectedAbsenceStudentIds.length === 0}
                  onClick={() => handleExecuteBulkAbsenceNotification()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold bg-rose-600 hover:bg-rose-700 text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    Send Bulk {absenceNotifyChannel} ({selectedAbsenceStudentIds.length})
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Student Confirmation Dialog Modal */}
      {showDeleteConfirmModal && studentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-4 bg-rose-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-300" />
                <h2 className="text-base font-extrabold">Delete Student?</h2>
              </div>
              <button
                type="button"
                onClick={handleCancelDelete}
                className="p-1 rounded-lg text-rose-200 hover:text-white hover:bg-rose-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <p className="text-sm font-semibold text-slate-800">
                Are you sure you want to delete this student?
              </p>

              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Student Name:</span>
                  <span className="font-extrabold text-slate-900">{studentToDelete.fullName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Student ID / SRN:</span>
                  <span className="font-mono font-bold text-slate-700">{studentToDelete.id} ({studentToDelete.admissionNumber})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Class & Section:</span>
                  <span className="font-bold text-indigo-700">Class {studentToDelete.classNumber}-{studentToDelete.section} (Roll #{studentToDelete.rollNumber})</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <p>
                  This will remove the student record from the persistent database and refresh the active student register.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCancelDelete}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/30 flex items-center gap-1.5 transition-all active:scale-95"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Dialog Modal */}
      {showBulkDeleteModal && selectedStudentIds.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-4 bg-rose-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-300" />
                <h2 className="text-base font-extrabold">Bulk Delete Students?</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkDeleteModal(false)}
                className="p-1 rounded-lg text-rose-200 hover:text-white hover:bg-rose-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <p className="text-sm font-semibold text-slate-800">
                Are you sure you want to permanently delete all <strong className="text-rose-600 font-extrabold">{selectedStudentIds.length}</strong> selected students?
              </p>

              {/* Selected students list preview */}
              <div className="max-h-40 overflow-y-auto p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1 text-xs">
                {students
                  .filter((s) => selectedStudentIds.includes(s.id))
                  .map((s) => (
                    <div key={s.id} className="flex items-center justify-between py-1 border-b border-slate-100 last:border-0">
                      <span className="font-bold text-slate-900 truncate">{s.fullName}</span>
                      <span className="font-mono text-[10px] text-slate-500 shrink-0 ml-2">Class {s.classNumber}-{s.section} (#{s.rollNumber})</span>
                    </div>
                  ))}
              </div>

              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <p>
                  This operation cannot be undone. All selected student records and profiles will be permanently removed from the database.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowBulkDeleteModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBulkDelete}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/30 flex items-center gap-1.5 transition-all active:scale-95"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete {selectedStudentIds.length} Students</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Edit Student Name Modal */}
      {nameEditingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-extrabold">Edit Student Name</h2>
              </div>
              <button
                type="button"
                onClick={handleCancelEditName}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveStudentName} className="p-5 space-y-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Student Record ID: {nameEditingStudent.id}
                </span>
                <p className="text-xs text-slate-500 mt-0.5">
                  Class {nameEditingStudent.classNumber}-{nameEditingStudent.section} • Roll #{nameEditingStudent.rollNumber}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Student Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={editedStudentNameValue}
                  onChange={(e) => {
                    setEditedStudentNameValue(e.target.value);
                    setNameEditError(null);
                  }}
                  placeholder="Enter full student name"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  The updated name will be saved immediately to the database and will appear everywhere the student is displayed across the app.
                </p>
              </div>

              {nameEditError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{nameEditError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCancelEditName}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center gap-1.5 transition-all active:scale-95"
                >
                  <Check className="w-4 h-4" />
                  <span>Save</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Edit Student Address Modal */}
      {addressEditingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-emerald-800 to-teal-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-300" />
                <h2 className="text-sm font-extrabold">Edit Student Address</h2>
              </div>
              <button
                type="button"
                onClick={handleCancelEditAddress}
                className="p-1 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveStudentAddress} className="p-5 space-y-4">
              {/* Student identification badge */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Student ID: {addressEditingStudent.id}
                  </span>
                  <span className="text-sm font-black text-slate-900">
                    {addressEditingStudent.fullName}
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Class {addressEditingStudent.classNumber}-{addressEditingStudent.section} • Roll #{addressEditingStudent.rollNumber}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleApplyStandardAddress}
                  className="px-2.5 py-1.5 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 text-[11px] font-extrabold shadow-2xs transition-all active:scale-95 flex items-center gap-1"
                  title="Auto-fill with official standardized address for Pamposh Colony"
                >
                  <span>⚡ Use Standard Address</span>
                </button>
              </div>

              {/* Full Address Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Residential Address <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  required
                  autoFocus
                  value={editedAddressValue}
                  onChange={(e) => {
                    setEditedAddressValue(e.target.value);
                    setAddressEditError(null);
                  }}
                  placeholder="Pamposh Colony, Palapora Zone, Iddgah"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 leading-relaxed"
                />
                <p className="text-[10.5px] text-slate-500 mt-1">
                  Standard format: <span className="font-semibold text-slate-700">Pamposh Colony, Palapora Zone, Iddgah</span>
                </p>
              </div>

              {/* Sub-fields */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Village / Town</label>
                  <input
                    type="text"
                    value={editedVillageTown}
                    onChange={(e) => setEditedVillageTown(e.target.value)}
                    placeholder="Pamposh Colony"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-xl font-medium text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Zone / Block</label>
                  <input
                    type="text"
                    value={editedBlockTehsil}
                    onChange={(e) => setEditedBlockTehsil(e.target.value)}
                    placeholder="Palapora Zone, Iddgah"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-xl font-medium text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1">District</label>
                  <input
                    type="text"
                    value={editedDistrict}
                    onChange={(e) => setEditedDistrict(e.target.value)}
                    placeholder="Srinagar"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-xl font-medium text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1">PIN Code</label>
                  <input
                    type="text"
                    value={editedPinCode}
                    onChange={(e) => setEditedPinCode(e.target.value)}
                    placeholder="190017"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-xl font-mono font-bold text-slate-800"
                  />
                </div>
              </div>

              {addressEditError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{addressEditError}</span>
                </div>
              )}

              {/* Footer buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCancelEditAddress}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-md shadow-emerald-700/20 flex items-center gap-1.5 transition-all active:scale-95"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Save Address</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Student QR Code Pass Modal */}
      {selectedStudentForQr && (
        <StudentQrPassModal
          isOpen={!!selectedStudentForQr}
          onClose={() => setSelectedStudentForQr(null)}
          student={selectedStudentForQr}
          classStudents={filteredStudents}
          school={school}
          language={language}
        />
      )}

      {/* Transfer Student Modal */}
      {transferringStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm no-print">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-amber-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4" />
                <h2 className="text-sm font-extrabold">Transfer Student (TC Issuance)</h2>
              </div>
              <button
                type="button"
                onClick={() => setTransferringStudent(null)}
                className="p-1 text-amber-100 hover:text-white rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleConfirmTransfer} className="p-5 space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                <p className="font-black text-slate-900 text-sm">{transferringStudent.fullName}</p>
                <p className="text-[11px] text-amber-900 font-mono mt-0.5">
                  Admission No: {transferringStudent.admissionNumber} • Class {transferringStudent.classNumber}-{transferringStudent.section}
                </p>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Transfer Date *</label>
                <input
                  type="date"
                  required
                  value={transferDateInput}
                  onChange={(e) => setTransferDateInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Destination School / Institution *</label>
                <input
                  type="text"
                  required
                  value={transferSchoolInput}
                  onChange={(e) => setTransferSchoolInput(e.target.value)}
                  placeholder="e.g. Govt High School, Noorbagh"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Reason for Transfer</label>
                <input
                  type="text"
                  value={transferReasonInput}
                  onChange={(e) => setTransferReasonInput(e.target.value)}
                  placeholder="e.g. Family relocation / Promotion to High School"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setTransferringStudent(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold"
                >
                  Confirm Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Student History Timeline Modal */}
      {historyStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm no-print">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden max-h-[85vh] flex flex-col">
            <div className="p-4 bg-purple-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-amber-300" />
                <div>
                  <h2 className="text-sm font-extrabold">Student Academic &amp; Lifecycle History</h2>
                  <p className="text-[11px] text-purple-200">
                    {historyStudent.fullName} • Adm No: {historyStudent.admissionNumber}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHistoryStudent(null)}
                className="p-1 text-purple-200 hover:text-white rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Current Class</span>
                  <strong className="text-indigo-900">Class {historyStudent.classNumber}-{historyStudent.section}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Session</span>
                  <strong className="font-mono text-slate-900">{historyStudent.academicSession}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Status</span>
                  <strong className={historyStudent.status === 'Active' ? 'text-emerald-700' : 'text-amber-700'}>
                    {historyStudent.status}
                  </strong>
                </div>
              </div>

              {(() => {
                const events: StudentHistoryEvent[] =
                  historyStudent.history && historyStudent.history.length > 0
                    ? historyStudent.history
                    : [
                        {
                          id: 'init-adm',
                          date: historyStudent.admissionDate || new Date().toISOString().slice(0, 10),
                          type: 'ADMISSION',
                          title: 'Initial Admission Record',
                          details: `Enrolled in Class ${historyStudent.classNumber}-${historyStudent.section} • Admission No: ${historyStudent.admissionNumber} • Session ${historyStudent.academicSession}`,
                          actorName: 'School Administration',
                        },
                      ];
                return (
                  <div className="space-y-2.5">
                    {events.map((ev) => (
                      <div key={ev.id} className="p-3 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-slate-900">{ev.title}</span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {new Date(ev.date).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-slate-600">{ev.details}</p>
                        <p className="text-[10px] text-indigo-600 font-semibold">Updated by: {ev.actorName}</p>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
            <div className="p-4 border-t border-slate-100 flex justify-end bg-slate-50">
              <button
                type="button"
                onClick={() => setHistoryStudent(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

interface StudentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData: Student | null;
  onSave: (data: Partial<Student>) => void;
  school: SchoolProfile;
  language: Language;
}

const StudentFormModal: React.FC<StudentFormModalProps> = ({
  isOpen,
  onClose,
  initialData,
  onSave,
  school,
  language,
}) => {
  const t = translations[language];

  const [fullName, setFullName] = useState(initialData?.fullName || '');
  const [admissionNumber, setAdmissionNumber] = useState(initialData?.admissionNumber || `SRN-2026-${Math.floor(500 + Math.random() * 400)}`);
  const [fatherName, setFatherName] = useState(initialData?.fatherName || '');
  const [motherName, setMotherName] = useState(initialData?.motherName || '');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>(initialData?.gender || 'Male');
  const [dob, setDob] = useState(initialData?.dob || '2015-05-15');
  const [classNumber, setClassNumber] = useState(initialData?.classNumber || '5');
  const [section, setSection] = useState(initialData?.section || 'A');
  const [rollNumber, setRollNumber] = useState(initialData?.rollNumber || 1);
  const [academicSession, setAcademicSession] = useState(initialData?.academicSession || school.academicSession || '2026-2027');
  const [status, setStatus] = useState<StudentStatus>(initialData?.status || 'Active');
  const [formError, setFormError] = useState<string | null>(null);
  const [mobileNumber, setMobileNumber] = useState(initialData?.mobileNumber || '+91 ');
  const [parentWhatsAppNumber, setParentWhatsAppNumber] = useState(initialData?.parentWhatsAppNumber || initialData?.mobileNumber || '+91 ');
  const [address, setAddress] = useState(initialData?.address || formatSchoolAddressOnce(school) || STANDARDIZED_ADDRESS);
  const [villageTown, setVillageTown] = useState(initialData?.villageTown || school.villageTown || 'Palpora');
  const [blockTehsil, setBlockTehsil] = useState(initialData?.blockTehsil || school.blockTehsil || 'Iddgah');
  const [district, setDistrict] = useState(initialData?.district || school.district || 'Srinagar');
  const [state, setState] = useState(initialData?.state || school.state || 'Jammu and Kashmir');
  const [pinCode, setPinCode] = useState(initialData?.pinCode || school.pinCode || '190017');
  const [admissionDate, setAdmissionDate] = useState(initialData?.admissionDate || new Date().toISOString().slice(0, 10));
  const [previousSchool, setPreviousSchool] = useState(initialData?.previousSchool || '');
  const [photoUrl, setPhotoUrl] = useState<string>(initialData?.photoDataUrl || '');
  const [confirmRemovePhoto, setConfirmRemovePhoto] = useState<boolean>(false);

  if (!isOpen) return null;

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const rawUrl = String(reader.result || '');
      const img = new Image();
      img.onload = () => {
        const maxDim = 480;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height, 1));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          setPhotoUrl(canvas.toDataURL('image/jpeg', 0.86));
        } else {
          setPhotoUrl(rawUrl);
        }
        setConfirmRemovePhoto(false);
      };
      img.onerror = () => {
        setPhotoUrl(rawUrl);
        setConfirmRemovePhoto(false);
      };
      img.src = rawUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !fatherName.trim()) {
      setFormError('Please fill student full name and father name.');
      return;
    }
    setFormError(null);

    onSave({
      fullName: fullName.trim(),
      admissionNumber: admissionNumber.trim(),
      fatherName: fatherName.trim(),
      motherName: motherName.trim(),
      gender,
      dob,
      classNumber,
      section,
      rollNumber: Number(rollNumber),
      academicSession: academicSession.trim() || school.academicSession,
      status,
      mobileNumber: mobileNumber.trim(),
      parentWhatsAppNumber: parentWhatsAppNumber.trim() || mobileNumber.trim(),
      address: address.trim(),
      villageTown: villageTown.trim(),
      blockTehsil: blockTehsil.trim(),
      district: district.trim(),
      state: state.trim(),
      pinCode: pinCode.trim(),
      admissionDate,
      previousSchool: previousSchool.trim(),
      photoDataUrl: photoUrl || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm no-print">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-400" />
            <span>{initialData ? `${t.edit} Student Record` : t.registerStudent}</span>
          </h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto text-xs">
          {formError && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-bold">
              {formError}
            </div>
          )}

          {/* Student Photograph Management (Camera Capture + Gallery Upload + Delete Confirmation) */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-16 h-20 rounded-xl bg-white border border-slate-300 flex items-center justify-center overflow-hidden shadow-2xs shrink-0">
                {photoUrl ? (
                  <img src={photoUrl} alt="Student Passport" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center text-slate-400">
                    <ImageIcon className="w-6 h-6" />
                    <span className="text-[9px] font-bold mt-0.5">No Photo</span>
                  </div>
                )}
              </div>
              <div>
                <p className="font-extrabold text-slate-900 text-xs">Student Photograph</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Shown on Admission Register, Student Profile, QR Pass, and Holistic Progress Cards (JPG/PNG).
                </p>
                {confirmRemovePhoto && (
                  <div className="mt-2 flex items-center gap-2 text-[11px]">
                    <span className="font-bold text-rose-700">Delete student photo?</span>
                    <button
                      type="button"
                      onClick={() => {
                        setPhotoUrl('');
                        setConfirmRemovePhoto(false);
                      }}
                      className="px-2 py-0.5 rounded-lg bg-rose-600 text-white font-bold"
                    >
                      Confirm Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmRemovePhoto(false)}
                      className="px-2 py-0.5 rounded-lg bg-slate-200 text-slate-700 font-bold"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-2xs transition-colors">
                <Camera className="w-3.5 h-3.5" />
                <span>Camera</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="user"
                  className="hidden"
                  onChange={handlePhotoFileChange}
                />
              </label>

              <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-bold text-xs transition-colors">
                <Upload className="w-3.5 h-3.5 text-indigo-600" />
                <span>{photoUrl ? 'Replace' : 'Gallery'}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  className="hidden"
                  onChange={handlePhotoFileChange}
                />
              </label>

              {photoUrl && !confirmRemovePhoto && (
                <button
                  type="button"
                  onClick={() => setConfirmRemovePhoto(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs"
                  title="Remove Student Photograph"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">{t.fullName} *</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Aarav Kumar"
                className="w-full px-3 py-2 border rounded-xl"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">{t.admissionNo} *</label>
              <input
                type="text"
                required
                value={admissionNumber}
                onChange={(e) => setAdmissionNumber(e.target.value)}
                placeholder="SRN-2026-001"
                className="w-full px-3 py-2 border rounded-xl font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">{t.fatherName} *</label>
              <input
                type="text"
                required
                value={fatherName}
                onChange={(e) => setFatherName(e.target.value)}
                placeholder="e.g. Ramkishore Kumar"
                className="w-full px-3 py-2 border rounded-xl"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">{t.motherName}</label>
              <input
                type="text"
                value={motherName}
                onChange={(e) => setMotherName(e.target.value)}
                placeholder="e.g. Shanti Devi"
                className="w-full px-3 py-2 border rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">{t.gender}</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as any)}
                className="w-full px-3 py-2 border rounded-xl bg-white"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">{t.dob}</label>
              <input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">{t.mobileNo}</label>
              <input
                type="text"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                placeholder="+91 98000 00000"
                className="w-full px-3 py-2 border rounded-xl font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1 text-emerald-800">
                {language === 'ur' ? 'واٹس ایپ نمبر' : 'WhatsApp No'}
              </label>
              <input
                type="text"
                value={parentWhatsAppNumber}
                onChange={(e) => setParentWhatsAppNumber(e.target.value)}
                placeholder="+91 98000 00000"
                className="w-full px-3 py-2 border border-emerald-300 rounded-xl font-mono bg-emerald-50/30 text-emerald-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-indigo-50/50 p-3 rounded-2xl border border-indigo-100">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">{t.class}</label>
              <select
                value={classNumber}
                onChange={(e) => setClassNumber(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl bg-white font-bold"
              >
                {school.classesOffered.map((c) => (
                  <option key={c} value={c}>Class {c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">{t.section}</label>
              <select
                value={section}
                onChange={(e) => setSection(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl bg-white font-bold"
              >
                <option value="A">Section A</option>
                <option value="B">Section B</option>
                <option value="C">Section C</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">{t.rollNo}</label>
              <input
                type="number"
                min={1}
                value={rollNumber}
                onChange={(e) => setRollNumber(Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-xl font-mono bg-white font-bold"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Academic Session</label>
              <input
                type="text"
                value={academicSession}
                onChange={(e) => setAcademicSession(e.target.value)}
                placeholder="2026-2027"
                className="w-full px-3 py-2 border rounded-xl font-mono bg-white font-bold"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Enrollment Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as StudentStatus)}
                className="w-full px-3 py-2 border rounded-xl bg-white font-bold"
              >
                <option value="Active">Active</option>
                <option value="Transferred">Transferred</option>
                <option value="Graduated">Graduated</option>
                <option value="Archived">Archived</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">{t.address}</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Ward No. 4, Station Road"
              className="w-full px-3 py-2 border rounded-xl"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">{t.villageTown}</label>
              <input
                type="text"
                value={villageTown}
                onChange={(e) => setVillageTown(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">{t.district}</label>
              <input
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">{t.pinCode}</label>
              <input
                type="text"
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl font-mono"
              />
            </div>
          </div>

          {/* Modal Footer buttons */}
          <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700"
            >
              {t.save}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
