import React, { useMemo, useState } from 'react';
import {
  IdCard,
  UserPlus,
  Briefcase,
  Users,
  GraduationCap,
  QrCode,
  Palette,
  Building2,
  Layers,
  Printer,
  Settings,
  Search,
  Download,
  Copy,
  Trash2,
  Edit3,
  Camera,
  Upload,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Shield,
  FileJson,
  RefreshCw,
  Check,
  X,
} from 'lucide-react';
import {
  AdminRoleType,
  IdCardCategory,
  IdCardDesignConfig,
  IdCardFontSize,
  IdCardFontStyle,
  IdCardQrPrivacySettings,
  IdCardStatus,
  IdCardTemplateId,
  SchoolIdCardRecord,
  SchoolProfile,
  Student,
  TeacherProfile,
} from '../types';
import {
  downloadIdCardAsImage,
  evaluateCardStatus,
  exportIdCardsToPdf,
  ID_CARD_TEMPLATES,
  studentToIdCardRecord,
  teacherToIdCardRecord,
} from '../utils/idCardRenderer';
import { formatSchoolAddressOnce } from '../utils/calculations';
import { IdCardPreview } from './IdCardPreview';
import { PhotoCropModal } from './PhotoCropModal';
import { QrIdVerifier } from './QrIdVerifier';

export type IdMakerView =
  | 'dashboard'
  | 'individual-student-id'
  | 'create-student'
  | 'create-teacher'
  | 'students-list'
  | 'teachers-list'
  | 'qr-scanner'
  | 'templates'
  | 'school-info'
  | 'bulk-generator'
  | 'pdf-print'
  | 'settings-backup';

interface SmartIdCardMakerProps {
  school: SchoolProfile;
  onUpdateSchool: (updated: SchoolProfile) => void;
  students: Student[];
  teachers: TeacherProfile[];
  effectiveRole: AdminRoleType;
  records: SchoolIdCardRecord[];
  onSaveRecord: (record: SchoolIdCardRecord) => void;
  onSaveBulkRecords: (records: SchoolIdCardRecord[]) => void;
  onDeleteRecord: (cardId: string) => void;
  designConfig: IdCardDesignConfig;
  onUpdateDesignConfig: (config: IdCardDesignConfig) => void;
  qrPrivacy: IdCardQrPrivacySettings;
  onUpdateQrPrivacy: (privacy: IdCardQrPrivacySettings) => void;
}

const BLOOD_GROUPS = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export const SmartIdCardMaker: React.FC<SmartIdCardMakerProps> = ({
  school,
  onUpdateSchool,
  students,
  teachers,
  effectiveRole,
  records,
  onSaveRecord,
  onSaveBulkRecords,
  onDeleteRecord,
  designConfig,
  onUpdateDesignConfig,
  qrPrivacy,
  onUpdateQrPrivacy,
}) => {
  const [activeView, setActiveView] = useState<IdMakerView>('dashboard');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Filters & Selection
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [classFilter, setClassFilter] = useState<string>('ALL');
  const [schoolFilter, setSchoolFilter] = useState<string>('ALL');
  const [selectedPrintIds, setSelectedPrintIds] = useState<string[]>(() =>
    records.slice(0, 6).map((r) => r.id)
  );

  // Form state for Create/Edit Student or Teacher Card
  const [editingCard, setEditingCard] = useState<SchoolIdCardRecord>(() =>
    createBlankForm('student', school, designConfig)
  );
  const [formErrors, setFormErrors] = useState<string | null>(null);

  // Photo Cropper Modal
  const [photoModalOpen, setPhotoModalOpen] = useState<boolean>(false);

  // Delete confirmation modal
  const [confirmDeleteCard, setConfirmDeleteCard] = useState<SchoolIdCardRecord | null>(null);

  // Bulk generator filters
  const [bulkCategory, setBulkCategory] = useState<IdCardCategory>('student');
  const [bulkClassFilter, setBulkClassFilter] = useState<string>('ALL');
  const [bulkOverwriteExisting, setBulkOverwriteExisting] = useState<boolean>(false);

  // Preview modal for quick inspection
  const [inspectedCard, setInspectedCard] = useState<SchoolIdCardRecord | null>(null);

  // Student-Wise Individual ID Card state (PDF & JPEG export)
  const activeStudentsList = useMemo(
    () => students.filter((s) => s.status === 'Active'),
    [students]
  );
  const [individualClassFilter, setIndividualClassFilter] = useState<string>('ALL');
  const [individualSearch, setIndividualSearch] = useState<string>('');
  const [selectedIndividualStudentId, setSelectedIndividualStudentId] = useState<string>(
    () => activeStudentsList[0]?.id || ''
  );
  const [individualExportBusy, setIndividualExportBusy] = useState<'pdf' | 'jpeg' | null>(null);
  const [editingExportBusy, setEditingExportBusy] = useState<'pdf' | 'jpeg' | null>(null);
  const [isPrintingAllActive, setIsPrintingAllActive] = useState<boolean>(false);

  // Always keep ID card design synced with the centralized Official School Logo & signatures in SchoolProfile
  const effectiveDesignConfig = useMemo<IdCardDesignConfig>(
    () => ({
      ...designConfig,
      schoolLogoDataUrl: school.logoDataUrl || undefined,
      principalSignatureDataUrl:
        school.headmasterSignatureDataUrl || designConfig.principalSignatureDataUrl,
      schoolStampDataUrl: school.officialStampDataUrl || designConfig.schoolStampDataUrl,
    }),
    [
      designConfig,
      school.logoDataUrl,
      school.headmasterSignatureDataUrl,
      school.officialStampDataUrl,
    ]
  );

  const syncedEditingCard = useMemo<SchoolIdCardRecord>(
    () => ({
      ...editingCard,
      schoolName: editingCard.schoolName || school.name,
      schoolLogoDataUrl: school.logoDataUrl || undefined,
      principalSignatureDataUrl:
        school.headmasterSignatureDataUrl || editingCard.principalSignatureDataUrl,
      schoolStampDataUrl: school.officialStampDataUrl || editingCard.schoolStampDataUrl,
    }),
    [editingCard, school]
  );

  const handleExportSingleCard = async (
    card: SchoolIdCardRecord,
    format: 'pdf' | 'jpeg'
  ) => {
    setEditingExportBusy(format);
    try {
      const brandedCard: SchoolIdCardRecord = {
        ...card,
        schoolName: card.schoolName || school.name,
        schoolLogoDataUrl: school.logoDataUrl || undefined,
        principalSignatureDataUrl:
          school.headmasterSignatureDataUrl || card.principalSignatureDataUrl,
        schoolStampDataUrl: school.officialStampDataUrl || card.schoolStampDataUrl,
      };
      const safeName = (brandedCard.fullName || 'Student')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
      const idTag = brandedCard.admissionNumber || brandedCard.uniqueIdNumber || 'ID';

      if (format === 'pdf') {
        await exportIdCardsToPdf(
          [brandedCard],
          effectiveDesignConfig,
          qrPrivacy,
          `Smart_ID_${safeName}_${idTag}.pdf`
        );
        showToast(`Downloaded printable PDF Smart ID for ${brandedCard.fullName || 'Student'}.`);
      } else {
        await downloadIdCardAsImage(brandedCard, effectiveDesignConfig, qrPrivacy, 'jpeg');
        showToast(`Downloaded high-resolution JPEG Smart ID for ${brandedCard.fullName || 'Student'}.`);
      }
    } finally {
      setEditingExportBusy(null);
    }
  };

  // Generate a single printable multi-card PDF containing QR ID cards for ALL active students school-wide
  const handlePrintAllActiveStudentsPdf = async () => {
    if (activeStudentsList.length === 0) {
      showToast('No active students found to include in the printable QR ID card PDF.');
      return;
    }
    setIsPrintingAllActive(true);
    try {
      const sortedActive = [...activeStudentsList].sort((a, b) => {
        const clsCmp = a.classNumber.localeCompare(b.classNumber, undefined, { numeric: true });
        if (clsCmp !== 0) return clsCmp;
        const secCmp = (a.section || '').localeCompare(b.section || '');
        if (secCmp !== 0) return secCmp;
        return (a.rollNumber || 0) - (b.rollNumber || 0);
      });

      const allActiveCards: SchoolIdCardRecord[] = sortedActive.map((st) => {
        const existing = records.find(
          (r) =>
            r.category === 'student' &&
            (r.linkedStudentId === st.id || r.admissionNumber === st.admissionNumber)
        );
        const generated = studentToIdCardRecord(st, school, effectiveDesignConfig, existing);
        return {
          ...generated,
          schoolName: generated.schoolName || school.name,
          schoolLogoDataUrl: school.logoDataUrl || generated.schoolLogoDataUrl,
          principalSignatureDataUrl:
            school.headmasterSignatureDataUrl || generated.principalSignatureDataUrl,
          schoolStampDataUrl: school.officialStampDataUrl || generated.schoolStampDataUrl,
        };
      });

      const sessionTag = (school.academicSession || '2026-2027').replace(/[^a-zA-Z0-9_-]+/g, '_');
      await exportIdCardsToPdf(
        allActiveCards,
        effectiveDesignConfig,
        qrPrivacy,
        `All_Active_Students_QR_ID_Cards_${sessionTag}.pdf`
      );
      showToast(
        `Generated single printable PDF with QR ID cards for all ${allActiveCards.length} active students.`
      );
    } finally {
      setIsPrintingAllActive(false);
    }
  };

  const filteredIndividualStudents = useMemo(() => {
    const q = individualSearch.trim().toLowerCase();
    return activeStudentsList.filter((s) => {
      if (individualClassFilter !== 'ALL' && s.classNumber !== individualClassFilter) return false;
      if (!q) return true;
      return (
        s.fullName.toLowerCase().includes(q) ||
        s.admissionNumber.toLowerCase().includes(q) ||
        String(s.rollNumber).toLowerCase().includes(q) ||
        `${s.classNumber}-${s.section}`.toLowerCase().includes(q)
      );
    });
  }, [activeStudentsList, individualClassFilter, individualSearch]);

  const selectedIndividualStudent = useMemo(
    () =>
      filteredIndividualStudents.find((s) => s.id === selectedIndividualStudentId) ||
      activeStudentsList.find((s) => s.id === selectedIndividualStudentId) ||
      filteredIndividualStudents[0] ||
      activeStudentsList[0] ||
      null,
    [filteredIndividualStudents, activeStudentsList, selectedIndividualStudentId]
  );

  const individualStudentCard = useMemo<SchoolIdCardRecord | null>(() => {
    if (!selectedIndividualStudent) return null;
    const existing = records.find(
      (r) =>
        r.category === 'student' &&
        (r.linkedStudentId === selectedIndividualStudent.id ||
          r.admissionNumber === selectedIndividualStudent.admissionNumber)
    );
    const syncedDesign: IdCardDesignConfig = {
      ...designConfig,
      schoolLogoDataUrl: school.logoDataUrl || designConfig.schoolLogoDataUrl,
    };
    const generated = studentToIdCardRecord(
      selectedIndividualStudent,
      school,
      syncedDesign,
      existing
    );
    return {
      ...generated,
      schoolLogoDataUrl: school.logoDataUrl || generated.schoolLogoDataUrl,
    };
  }, [selectedIndividualStudent, records, school, designConfig]);

  const handleDownloadIndividualStudentId = async (format: 'pdf' | 'jpeg') => {
    if (!individualStudentCard || !selectedIndividualStudent) return;
    setIndividualExportBusy(format);
    try {
      const syncedDesign: IdCardDesignConfig = {
        ...designConfig,
        schoolLogoDataUrl: school.logoDataUrl || designConfig.schoolLogoDataUrl,
      };
      const safeName = selectedIndividualStudent.fullName.replace(/[^a-zA-Z0-9]+/g, '_');
      if (format === 'pdf') {
        await exportIdCardsToPdf(
          [individualStudentCard],
          syncedDesign,
          qrPrivacy,
          `Smart_ID_${safeName}_${selectedIndividualStudent.admissionNumber}.pdf`
        );
        showToast(`Downloaded printable PDF Smart ID for ${selectedIndividualStudent.fullName}.`);
      } else {
        await downloadIdCardAsImage(individualStudentCard, syncedDesign, qrPrivacy, 'jpeg');
        showToast(`Downloaded high-resolution JPEG Smart ID for ${selectedIndividualStudent.fullName}.`);
      }
    } catch {
      showToast(`Unable to export ${format.toUpperCase()} Smart ID. Please try again.`);
    } finally {
      setIndividualExportBusy(null);
    }
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  function createBlankForm(
    category: IdCardCategory,
    sch: SchoolProfile,
    design: IdCardDesignConfig
  ): SchoolIdCardRecord {
    const nowIso = new Date().toISOString();
    const formattedAddress = formatSchoolAddressOnce(sch);
    const randSuffix = String(Math.floor(1000 + Math.random() * 9000));
    if (category === 'student') {
      return {
        id: `idcard-stu-${Date.now()}`,
        uniqueIdNumber: `GMS-STU-${randSuffix}`,
        category: 'student',
        fullName: '',
        fatherName: '',
        motherName: '',
        classNumber: sch.classesOffered?.[0] || '5',
        section: 'A',
        rollNumber: '',
        admissionNumber: '',
        dob: '',
        bloodGroup: '',
        schoolName: sch.name,
        schoolAddress: formattedAddress,
        residentialAddress: '',
        contactNumber: '',
        parentContactNumber: '',
        academicSession: sch.academicSession || '2026-2027',
        photoDataUrl: undefined,
        principalSignatureDataUrl: design.principalSignatureDataUrl || sch.headmasterSignatureDataUrl,
        schoolLogoDataUrl: design.schoolLogoDataUrl || sch.logoDataUrl,
        schoolStampDataUrl: design.schoolStampDataUrl || sch.officialStampDataUrl,
        templateId: design.templateId === 'teacher_executive' ? 'student_classic' : design.templateId,
        backgroundColor: design.backgroundColor,
        accentColor: design.accentColor,
        motto: design.motto,
        emergencyContact: design.emergencyContact || sch.contactNumber,
        issueDate: nowIso.slice(0, 10),
        expiryDate: design.defaultValidityDate,
        status: 'Valid',
        isDuplicate: false,
        duplicateCount: 0,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
    }

    return {
      id: `idcard-tch-${Date.now()}`,
      uniqueIdNumber: `GMS-TCH-${randSuffix}`,
      category: 'teacher',
      fullName: '',
      fatherName: '',
      designation: 'Teacher',
      employeeId: '',
      qualification: '',
      subject: '',
      dateOfJoining: nowIso.slice(0, 10),
      dob: '',
      bloodGroup: '',
      schoolName: sch.name,
      schoolAddress: formattedAddress,
      residentialAddress: '',
      contactNumber: '',
      photoDataUrl: undefined,
      principalSignatureDataUrl: design.principalSignatureDataUrl || sch.headmasterSignatureDataUrl,
      schoolLogoDataUrl: design.schoolLogoDataUrl || sch.logoDataUrl,
      schoolStampDataUrl: design.schoolStampDataUrl || sch.officialStampDataUrl,
      templateId: design.templateId === 'student_classic' ? 'teacher_executive' : design.templateId,
      backgroundColor: design.backgroundColor,
      accentColor: design.accentColor,
      motto: design.motto,
      emergencyContact: design.emergencyContact || sch.contactNumber,
      issueDate: nowIso.slice(0, 10),
      expiryDate: design.defaultValidityDate,
      status: 'Valid',
      isDuplicate: false,
      duplicateCount: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  }

  const openCreateStudent = () => {
    setFormErrors(null);
    setEditingCard(createBlankForm('student', school, designConfig));
    setActiveView('create-student');
  };

  const openCreateTeacher = () => {
    setFormErrors(null);
    setEditingCard(createBlankForm('teacher', school, designConfig));
    setActiveView('create-teacher');
  };

  const openEditCard = (card: SchoolIdCardRecord) => {
    setFormErrors(null);
    setEditingCard({ ...card });
    setActiveView(card.category === 'student' ? 'create-student' : 'create-teacher');
  };

  const handleImportStudentToForm = (studentId: string) => {
    const found = students.find((s) => s.id === studentId);
    if (!found) return;
    const existing = records.find((r) => r.linkedStudentId === found.id);
    const converted = studentToIdCardRecord(found, school, designConfig, existing);
    setEditingCard(converted);
    setFormErrors(null);
  };

  const handleImportTeacherToForm = (teacherId: string) => {
    const found = teachers.find((t) => t.id === teacherId);
    if (!found) return;
    const existing = records.find((r) => r.linkedTeacherId === found.id);
    const converted = teacherToIdCardRecord(found, school, designConfig, existing);
    setEditingCard(converted);
    setFormErrors(null);
  };

  const handleSaveCardForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCard.fullName.trim()) {
      setFormErrors('Full Name is required.');
      return;
    }
    if (!editingCard.fatherName.trim()) {
      setFormErrors("Father's Name is required.");
      return;
    }
    if (editingCard.category === 'student') {
      if (!editingCard.classNumber?.trim() || !editingCard.rollNumber?.trim() || !editingCard.admissionNumber?.trim()) {
        setFormErrors('Class, Roll Number, and Admission Number are required for Student ID cards.');
        return;
      }
    } else {
      if (!editingCard.designation?.trim() || !editingCard.employeeId?.trim()) {
        setFormErrors('Designation and Employee ID are required for Teacher ID cards.');
        return;
      }
    }

    const updated: SchoolIdCardRecord = {
      ...editingCard,
      updatedAt: new Date().toISOString(),
    };
    onSaveRecord(updated);
    setFormErrors(null);
    showToast(`Saved ${updated.category === 'student' ? 'Student' : 'Teacher'} ID Card (${updated.uniqueIdNumber}).`);
    setActiveView(updated.category === 'student' ? 'students-list' : 'teachers-list');
  };

  const handleGenerateDuplicate = (card: SchoolIdCardRecord) => {
    const nowIso = new Date().toISOString();
    const nextCount = (card.duplicateCount || 0) + 1;
    const dupCard: SchoolIdCardRecord = {
      ...card,
      isDuplicate: true,
      duplicateCount: nextCount,
      issueDate: nowIso.slice(0, 10),
      updatedAt: nowIso,
    };
    onSaveRecord(dupCard);
    showToast(`Generated Duplicate ID Card #${nextCount} for ${card.fullName}.`);
  };

  const handleAssetUpload = (
    file: File,
    onLoaded: (dataUrl: string) => void
  ) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onLoaded(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Derived lists & counts
  const studentCards = useMemo(() => records.filter((r) => r.category === 'student'), [records]);
  const teacherCards = useMemo(() => records.filter((r) => r.category === 'teacher'), [records]);
  const duplicateCountTotal = useMemo(() => records.filter((r) => r.isDuplicate).length, [records]);

  const distinctClasses = useMemo(() => {
    const set = new Set(studentCards.map((c) => c.classNumber).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [studentCards]);

  const distinctSchools = useMemo(() => {
    const set = new Set(records.map((c) => c.schoolName).filter(Boolean));
    return Array.from(set);
  }, [records]);

  const filteredStudentCards = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return studentCards.filter((c) => {
      if (classFilter !== 'ALL' && c.classNumber !== classFilter) return false;
      if (schoolFilter !== 'ALL' && c.schoolName !== schoolFilter) return false;
      if (!q) return true;
      return (
        c.fullName.toLowerCase().includes(q) ||
        c.uniqueIdNumber.toLowerCase().includes(q) ||
        (c.admissionNumber || '').toLowerCase().includes(q) ||
        (c.rollNumber || '').toLowerCase().includes(q)
      );
    });
  }, [studentCards, searchQuery, classFilter, schoolFilter]);

  const filteredTeacherCards = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return teacherCards.filter((c) => {
      if (schoolFilter !== 'ALL' && c.schoolName !== schoolFilter) return false;
      if (!q) return true;
      return (
        c.fullName.toLowerCase().includes(q) ||
        c.uniqueIdNumber.toLowerCase().includes(q) ||
        (c.employeeId || '').toLowerCase().includes(q) ||
        (c.designation || '').toLowerCase().includes(q)
      );
    });
  }, [teacherCards, searchQuery, schoolFilter]);

  const handleRunBulkGenerate = () => {
    const generated: SchoolIdCardRecord[] = [];
    if (bulkCategory === 'student') {
      const targetStudents = students.filter(
        (s) => s.status === 'Active' && (bulkClassFilter === 'ALL' || s.classNumber === bulkClassFilter)
      );
      targetStudents.forEach((st) => {
        const existing = records.find((r) => r.linkedStudentId === st.id);
        if (existing && !bulkOverwriteExisting) return;
        generated.push(studentToIdCardRecord(st, school, designConfig, existing));
      });
    } else {
      teachers.forEach((tc) => {
        const existing = records.find((r) => r.linkedTeacherId === tc.id);
        if (existing && !bulkOverwriteExisting) return;
        generated.push(teacherToIdCardRecord(tc, school, designConfig, existing));
      });
    }

    if (generated.length === 0) {
      showToast('All eligible records already have generated ID cards.');
      return;
    }
    onSaveBulkRecords(generated);
    setSelectedPrintIds(generated.map((g) => g.id));
    showToast(`Generated ${generated.length} ${bulkCategory} ID card(s) cleanly.`);
  };

  const handleApplyDesignToAll = () => {
    const updated = records.map((r) => ({
      ...r,
      templateId: designConfig.templateId,
      backgroundColor: designConfig.backgroundColor,
      accentColor: designConfig.accentColor,
      motto: designConfig.motto,
      emergencyContact: designConfig.emergencyContact,
      schoolLogoDataUrl: designConfig.schoolLogoDataUrl || school.logoDataUrl,
      schoolStampDataUrl: designConfig.schoolStampDataUrl || school.officialStampDataUrl,
      principalSignatureDataUrl:
        designConfig.principalSignatureDataUrl || school.headmasterSignatureDataUrl,
      updatedAt: new Date().toISOString(),
    }));
    onSaveBulkRecords(updated);
    showToast(`Applied template & branding to ${updated.length} ID card(s).`);
  };

  const handleSyncSchoolInfoToCards = () => {
    const formattedAddress = formatSchoolAddressOnce(school);
    const updated = records.map((r) => ({
      ...r,
      schoolName: school.name,
      schoolAddress: formattedAddress,
      schoolLogoDataUrl: school.logoDataUrl || r.schoolLogoDataUrl,
      schoolStampDataUrl: school.officialStampDataUrl || r.schoolStampDataUrl,
      principalSignatureDataUrl: school.headmasterSignatureDataUrl || r.principalSignatureDataUrl,
      motto: school.motto || r.motto,
      emergencyContact: school.emergencyContact || school.contactNumber || r.emergencyContact,
      updatedAt: new Date().toISOString(),
    }));
    onSaveBulkRecords(updated);
    showToast('Updated all ID cards with current School Information.');
  };

  const handleExportIdBackupJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      schoolName: school.name,
      designConfig,
      qrPrivacy,
      records,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SmartSchool_IDCards_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('ID Card Maker JSON backup downloaded.');
  };

  const handleImportIdBackupJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (Array.isArray(parsed.records)) {
          onSaveBulkRecords(parsed.records);
        }
        if (parsed.designConfig) {
          onUpdateDesignConfig(parsed.designConfig);
        }
        if (parsed.qrPrivacy) {
          onUpdateQrPrivacy(parsed.qrPrivacy);
        }
        showToast('ID Card Maker backup restored successfully.');
      } catch {
        showToast('Invalid JSON backup file.');
      }
    };
    reader.readAsText(file);
  };

  const DASHBOARD_TILES: {
    id: IdMakerView;
    title: string;
    subtitle: string;
    icon: React.FC<{ className?: string }>;
    accent: string;
    metric?: string | number;
  }[] = [
    {
      id: 'individual-student-id',
      title: 'Student-Wise Individual ID',
      subtitle: 'Select any student & download official PDF or JPEG ID card',
      icon: IdCard,
      accent: 'text-indigo-700 bg-indigo-50 border-indigo-300',
      metric: activeStudentsList.length,
    },
    {
      id: 'create-student',
      title: '1. Create Student ID',
      subtitle: '17-field student form, camera photo & QR code',
      icon: UserPlus,
      accent: 'text-indigo-600 bg-indigo-50 border-indigo-200',
    },
    {
      id: 'create-teacher',
      title: '2. Create Teacher ID',
      subtitle: '15-field faculty & staff ID with Employee ID',
      icon: Briefcase,
      accent: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    },
    {
      id: 'students-list',
      title: '3. View All Students',
      subtitle: 'Search, edit, duplicate & export student cards',
      icon: Users,
      accent: 'text-sky-600 bg-sky-50 border-sky-200',
      metric: studentCards.length,
    },
    {
      id: 'teachers-list',
      title: '4. View All Teachers',
      subtitle: 'Manage staff IDs, designations & status',
      icon: GraduationCap,
      accent: 'text-teal-600 bg-teal-50 border-teal-200',
      metric: teacherCards.length,
    },
    {
      id: 'qr-scanner',
      title: '5. QR Code Scanner',
      subtitle: 'Verify Valid / Expired / Invalid & protected fields',
      icon: QrCode,
      accent: 'text-violet-600 bg-violet-50 border-violet-200',
    },
    {
      id: 'templates',
      title: '6. ID Card Templates',
      subtitle: '6 templates, colors, fonts, logo, stamp & sign',
      icon: Palette,
      accent: 'text-amber-600 bg-amber-50 border-amber-200',
      metric: '6',
    },
    {
      id: 'school-info',
      title: '7. School Information',
      subtitle: 'Logo, address, motto, emergency contact sync',
      icon: Building2,
      accent: 'text-blue-600 bg-blue-50 border-blue-200',
    },
    {
      id: 'bulk-generator',
      title: '8. Bulk ID Card Generator',
      subtitle: 'Batch generate cards class-wise or staff-wise',
      icon: Layers,
      accent: 'text-rose-600 bg-rose-50 border-rose-200',
    },
    {
      id: 'pdf-print',
      title: '9. PDF Export & Printing',
      subtitle: 'CR80 A4 multi-card PDF sheet & direct print',
      icon: Printer,
      accent: 'text-slate-700 bg-slate-100 border-slate-300',
    },
    {
      id: 'settings-backup',
      title: '10. Settings & Backup',
      subtitle: 'QR privacy locks, confidential controls & JSON',
      icon: Settings,
      accent: 'text-slate-700 bg-slate-100 border-slate-300',
    },
  ];

  const renderCardList = (list: SchoolIdCardRecord[], category: IdCardCategory) => (
    <div className="space-y-4">
      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[240px]">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${category} name, ID, ${category === 'student' ? 'roll / admission no' : 'employee ID'}...`}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {category === 'student' && (
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
            >
              <option value="ALL">All Classes</option>
              {distinctClasses.map((cls) => (
                <option key={cls} value={cls}>
                  Class {cls}
                </option>
              ))}
            </select>
          )}

          {distinctSchools.length > 1 && (
            <select
              value={schoolFilter}
              onChange={(e) => setSchoolFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 bg-white max-w-[200px]"
            >
              <option value="ALL">All Schools</option>
              {distinctSchools.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              exportIdCardsToPdf(
                list,
                designConfig,
                qrPrivacy,
                `${category === 'student' ? 'Student' : 'Teacher'}_ID_Cards.pdf`
              )
            }
            disabled={list.length === 0}
            className="px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Filtered PDF ({list.length})</span>
          </button>
          <button
            type="button"
            onClick={category === 'student' ? openCreateStudent : openCreateTeacher}
            className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>New {category === 'student' ? 'Student' : 'Teacher'} ID</span>
          </button>
        </div>
      </div>

      {/* Cards Grid / Empty State */}
      {list.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-3">
          <IdCard className="w-10 h-10 text-slate-300 mx-auto" />
          <h4 className="text-sm font-bold text-slate-800">
            No {category === 'student' ? 'Student' : 'Teacher'} ID Cards Found
          </h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Create an individual card or use the Bulk ID Card Generator to populate cards from your school roster.
          </p>
          <div className="flex items-center justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={category === 'student' ? openCreateStudent : openCreateTeacher}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold"
            >
              Create First {category === 'student' ? 'Student' : 'Teacher'} ID
            </button>
            <button
              type="button"
              onClick={() => setActiveView('bulk-generator')}
              className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700"
            >
              Open Bulk Generator
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {list.map((card) => {
            const effStatus = evaluateCardStatus(card);
            return (
              <div
                key={card.id}
                className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <div className="w-14 h-16 rounded-xl border border-slate-200 bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                    {card.photoDataUrl ? (
                      <img
                        src={card.photoDataUrl}
                        alt={card.fullName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-sm font-black text-slate-400">
                        {card.fullName.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] font-mono font-bold text-slate-500 truncate">
                        {card.uniqueIdNumber}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                          effStatus === 'Valid'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : effStatus === 'Expired'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {effStatus}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 truncate mt-0.5">
                      {card.fullName}
                    </h4>
                    <p className="text-xs text-slate-600 truncate">
                      {card.category === 'student'
                        ? `Class ${card.classNumber}-${card.section} • Roll #${card.rollNumber} • Adm: ${card.admissionNumber}`
                        : `${card.designation} • ID: ${card.employeeId}`}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      Father: {card.fatherName || '—'}
                      {card.isDuplicate && (
                        <span className="ml-2 text-rose-600 font-mono font-bold">
                          [DUPLICATE #{Math.max(1, card.duplicateCount)}]
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Action Row */}
                <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setInspectedCard(card)}
                      className="px-2 py-1 rounded-md border border-slate-200 hover:bg-slate-50 font-semibold text-slate-700"
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditCard(card)}
                      className="px-2 py-1 rounded-md border border-slate-200 hover:bg-indigo-50 hover:border-indigo-200 font-semibold text-indigo-700 flex items-center gap-1"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleGenerateDuplicate(card)}
                      className="px-2 py-1 rounded-md border border-slate-200 hover:bg-amber-50 hover:border-amber-200 font-semibold text-amber-800 flex items-center gap-1"
                      title="Generate Duplicate ID Card"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Duplicate</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => downloadIdCardAsImage(card, designConfig, qrPrivacy, 'png')}
                      className="px-1.5 py-1 rounded border border-slate-200 hover:bg-slate-50 font-mono font-semibold text-slate-700"
                      title="Download PNG"
                    >
                      PNG
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExportSingleCard(card, 'jpeg')}
                      className="px-1.5 py-1 rounded border border-amber-200 bg-amber-50 hover:bg-amber-100 font-mono font-semibold text-amber-800"
                      title="Download JPEG"
                    >
                      JPEG
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExportSingleCard(card, 'pdf')}
                      className="px-1.5 py-1 rounded border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 font-mono font-semibold text-indigo-700"
                      title="Download PDF"
                    >
                      PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteCard(card)}
                      className="p-1 rounded border border-slate-200 hover:bg-rose-50 hover:border-rose-200 text-rose-600"
                      title="Delete Card"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Top Workspace Header & Breadcrumb */}
      <div className="bg-white rounded-2xl border border-slate-200 px-5 py-4 flex flex-wrap items-center justify-between gap-3 no-print">
        <div className="flex items-center gap-3">
          {activeView !== 'dashboard' && (
            <button
              type="button"
              onClick={() => setActiveView('dashboard')}
              className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700"
              title="Back to ID Card Maker Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
              <button
                type="button"
                onClick={() => setActiveView('dashboard')}
                className="hover:text-indigo-600"
              >
                Smart School ID Card Maker
              </button>
              {activeView !== 'dashboard' && (
                <>
                  <span>/</span>
                  <span className="text-slate-900 capitalize">
                    {activeView.replace(/-/g, ' ')}
                  </span>
                </>
              )}
            </div>
            <h1 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <IdCard className="w-5 h-5 text-indigo-600" />
              <span>Smart School Identity Card Studio</span>
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 whitespace-nowrap shrink-0">
          <button
            type="button"
            data-testid="print-all-active-students-btn"
            disabled={isPrintingAllActive || activeStudentsList.length === 0}
            onClick={() => void handlePrintAllActiveStudentsPdf()}
            title={`Generate a single printable A4 PDF containing QR ID cards for all ${activeStudentsList.length} active students`}
            className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Printer className="w-3.5 h-3.5 text-amber-300" />
            <span>
              {isPrintingAllActive
                ? `Generating PDF (${activeStudentsList.length})...`
                : `Print All Active Students (${activeStudentsList.length})`}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveView('individual-student-id')}
            className={`px-3 py-2 rounded-lg border text-xs font-bold flex items-center gap-1.5 ${
              activeView === 'individual-student-id'
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Student-Wise ID (PDF / JPEG)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveView('qr-scanner')}
            className={`px-3 py-2 rounded-lg border text-xs font-bold flex items-center gap-1.5 ${
              activeView === 'qr-scanner'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>QR Verifier</span>
          </button>
          <button
            type="button"
            onClick={openCreateStudent}
            className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Create ID Card</span>
          </button>
        </div>
      </div>

      {/* Inline Toast Feedback */}
      {toastMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{toastMsg}</span>
          </div>
          <button type="button" onClick={() => setToastMsg(null)}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 1. DASHBOARD VIEW (10-OPTION SMART SCHOOL ID CARD MAKER DASHBOARD)    */}
      {/* ===================================================================== */}
      {activeView === 'dashboard' && (
        <div className="space-y-5">
          {/* Summary Stats Bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Total Issued IDs
              </p>
              <p className="text-2xl font-black text-slate-900 font-mono tabular-nums mt-1">
                {records.length}
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Student ID Cards
              </p>
              <p className="text-2xl font-black text-indigo-700 font-mono tabular-nums mt-1">
                {studentCards.length}
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Teacher / Staff IDs
              </p>
              <p className="text-2xl font-black text-emerald-700 font-mono tabular-nums mt-1">
                {teacherCards.length}
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Duplicate Re-Issues
              </p>
              <p className="text-2xl font-black text-amber-600 font-mono tabular-nums mt-1">
                {duplicateCountTotal}
              </p>
            </div>
          </div>

          {/* 10 Dashboard Feature Tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {DASHBOARD_TILES.map((tile) => {
              const Icon = tile.icon;
              return (
                <button
                  key={tile.id}
                  type="button"
                  onClick={() => {
                    if (tile.id === 'create-student') openCreateStudent();
                    else if (tile.id === 'create-teacher') openCreateTeacher();
                    else setActiveView(tile.id);
                  }}
                  className="text-left bg-white hover:bg-slate-50/80 rounded-2xl border border-slate-200 hover:border-indigo-300 p-4 transition-colors flex flex-col justify-between gap-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${tile.accent}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    {tile.metric !== undefined && (
                      <span className="text-xs font-mono font-extrabold text-slate-600 tabular-nums">
                        {tile.metric}
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-xs font-extrabold text-slate-900">{tile.title}</h3>
                    <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                      {tile.subtitle}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Quick Live Preview Strip of Latest Card */}
          {records[0] && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
              <div className="lg:col-span-5 space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
                  Active School Template &bull; Auto-Synced
                </p>
                <h2 className="text-base font-black text-slate-900">{school.name}</h2>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {formatSchoolAddressOnce(school)}
                </p>
                <div className="text-xs text-slate-700 space-y-1 pt-1">
                  <p>
                    <span className="text-slate-500">Academic Session: </span>
                    <span className="font-mono font-bold">{school.academicSession}</span>
                  </p>
                  <p>
                    <span className="text-slate-500">School Motto: </span>
                    <span className="font-semibold">{designConfig.motto}</span>
                  </p>
                  <p>
                    <span className="text-slate-500">QR Privacy Mode: </span>
                    <span className="font-semibold">
                      {qrPrivacy.requireAdminForConfidential
                        ? 'Admin-Locked Confidential Fields'
                        : 'Public Full QR Payload'}
                    </span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveView('templates')}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700"
                  >
                    Customize Templates
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveView('pdf-print')}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold"
                  >
                    Open Print &amp; PDF Center
                  </button>
                </div>
              </div>

              <div className="lg:col-span-7 flex justify-center bg-slate-50 rounded-xl p-4 border border-slate-200/80">
                <IdCardPreview card={records[0]} design={designConfig} privacy={qrPrivacy} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* 1B. STUDENT-WISE INDIVIDUAL SMART ID GENERATOR (PDF & JPEG DOWNLOAD)  */}
      {/* ===================================================================== */}
      {activeView === 'individual-student-id' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
          {/* Left: Student Selector & Search */}
          <div className="xl:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <IdCard className="w-4 h-4 text-indigo-600" />
                <span>Select Individual Student</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Generate and download an individual student&apos;s official Smart ID Card in printable PDF or JPEG format without batch processing.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="relative sm:col-span-2">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={individualSearch}
                  onChange={(e) => setIndividualSearch(e.target.value)}
                  placeholder="Search student name, roll or admission no..."
                  className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <select
                value={individualClassFilter}
                onChange={(e) => setIndividualClassFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
              >
                <option value="ALL">All Classes</option>
                {Array.from(new Set(activeStudentsList.map((s) => s.classNumber)))
                  .sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
                  .map((cls) => (
                    <option key={cls} value={cls}>
                      Class {cls}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Quick Student Dropdown ({filteredIndividualStudents.length})
              </label>
              <select
                value={selectedIndividualStudent?.id || ''}
                onChange={(e) => setSelectedIndividualStudentId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500"
              >
                {filteredIndividualStudents.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.fullName} — Class {st.classNumber}-{st.section} (Roll #{st.rollNumber} | Adm: {st.admissionNumber})
                  </option>
                ))}
              </select>
            </div>

            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-200">
              {filteredIndividualStudents.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  No active students match your search filter.
                </div>
              ) : (
                filteredIndividualStudents.map((st) => {
                  const isSelected = selectedIndividualStudent?.id === st.id;
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setSelectedIndividualStudentId(st.id)}
                      className={`w-full text-left px-3.5 py-2.5 transition-colors flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'bg-indigo-50 border-l-4 border-l-indigo-600'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className={`text-xs font-bold truncate ${isSelected ? 'text-indigo-900' : 'text-slate-900'}`}>
                          {st.fullName}
                        </p>
                        <p className="text-[11px] text-slate-500 font-mono truncate">
                          Class {st.classNumber}-{st.section} • Roll #{st.rollNumber} • Adm {st.admissionNumber}
                        </p>
                      </div>
                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded-lg shrink-0 ${
                          isSelected
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {isSelected ? 'Selected' : 'Select'}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Live Printable Smart ID Card Preview & PDF / JPEG Download Controls */}
          <div className="xl:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 space-y-5">
            {individualStudentCard && selectedIndividualStudent ? (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <p className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-600">
                      Official School Branding • Printable CR80 Layout
                    </p>
                    <h3 className="text-base font-black text-slate-900">
                      {selectedIndividualStudent.fullName}
                    </h3>
                    <p className="text-xs text-slate-500 font-mono">
                      Class {selectedIndividualStudent.classNumber}-{selectedIndividualStudent.section} • Roll #{selectedIndividualStudent.rollNumber} • Adm: {selectedIndividualStudent.admissionNumber}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={individualExportBusy !== null}
                      onClick={() => handleDownloadIndividualStudentId('pdf')}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold shadow-sm transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{individualExportBusy === 'pdf' ? 'Generating PDF...' : 'Download PDF'}</span>
                    </button>
                    <button
                      type="button"
                      disabled={individualExportBusy !== null}
                      onClick={() => handleDownloadIndividualStudentId('jpeg')}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold shadow-sm transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{individualExportBusy === 'jpeg' ? 'Generating JPEG...' : 'Download JPEG'}</span>
                    </button>
                  </div>
                </div>

                <div className="flex justify-center bg-slate-50 rounded-2xl p-5 border border-slate-200/80">
                  <IdCardPreview
                    card={individualStudentCard}
                    design={{
                      ...designConfig,
                      schoolLogoDataUrl: school.logoDataUrl || designConfig.schoolLogoDataUrl,
                    }}
                    privacy={qrPrivacy}
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                  <p className="text-[11px] text-slate-500">
                    Maintains existing school details, official school logo, academic session ({school.academicSession}), and QR code verification.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onSaveRecord(individualStudentCard);
                        showToast(`Saved ${selectedIndividualStudent.fullName}'s Smart ID card to issued directory.`);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-200"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Save to Directory</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditCard(individualStudentCard)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-indigo-700 text-xs font-bold border border-indigo-200"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit Card Details</span>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-10 text-center text-xs text-slate-500">
                Select a student from the left panel to generate and download their Smart ID Card.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 2. CREATE / EDIT STUDENT OR TEACHER ID FORM + LIVE PREVIEW            */}
      {/* ===================================================================== */}
      {(activeView === 'create-student' || activeView === 'create-teacher') && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
          {/* Left Form */}
          <form
            onSubmit={handleSaveCardForm}
            className="xl:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-black text-slate-900">
                  {editingCard.category === 'student'
                    ? 'Student Identity Card Form (17 Fields)'
                    : 'Teacher Identity Card Form (15 Fields)'}
                </h2>
                <p className="text-xs text-slate-500">
                  Prefill from roster or complete manually. QR code updates automatically.
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={openCreateStudent}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                    editingCard.category === 'student'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-600 border-slate-200'
                  }`}
                >
                  Student ID
                </button>
                <button
                  type="button"
                  onClick={openCreateTeacher}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                    editingCard.category === 'teacher'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-slate-600 border-slate-200'
                  }`}
                >
                  Teacher ID
                </button>
              </div>
            </div>

            {/* Quick Import Picker */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-700">
                Prefill from School {editingCard.category === 'student' ? 'Student' : 'Teacher'} Roster:
              </span>
              {editingCard.category === 'student' ? (
                <select
                  value={editingCard.linkedStudentId || ''}
                  onChange={(e) => handleImportStudentToForm(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-800 max-w-xs"
                >
                  <option value="">-- Select Student to Prefill --</option>
                  {students.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.fullName} (Class {st.classNumber}-{st.section} | Adm {st.admissionNumber})
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={editingCard.linkedTeacherId || ''}
                  onChange={(e) => handleImportTeacherToForm(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-800 max-w-xs"
                >
                  <option value="">-- Select Teacher to Prefill --</option>
                  {teachers.map((tc) => (
                    <option key={tc.id} value={tc.id}>
                      {tc.name} ({tc.designation} | {tc.employeeId})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {formErrors && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{formErrors}</span>
              </div>
            )}

            {/* Photo Upload + Camera + Crop Row */}
            <div className="p-3.5 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-16 h-20 rounded-xl border border-slate-300 bg-slate-100 overflow-hidden flex items-center justify-center shrink-0">
                  {editingCard.photoDataUrl ? (
                    <img
                      src={editingCard.photoDataUrl}
                      alt="ID Photo"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Camera className="w-5 h-5 text-slate-400" />
                  )}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">
                    {editingCard.category === 'student' ? '16. Student Photograph' : '14. Teacher Photograph'}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Capture with camera or upload from gallery with crop &amp; fit tool.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPhotoModalOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{editingCard.photoDataUrl ? 'Change / Crop Photo' : 'Capture / Upload Photo'}</span>
                </button>
                {editingCard.photoDataUrl && (
                  <button
                    type="button"
                    onClick={() => setEditingCard((p) => ({ ...p, photoDataUrl: undefined }))}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>

            {/* Form Inputs */}
            {editingCard.category === 'student' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">1. Student Full Name *</label>
                  <input
                    type="text"
                    required
                    value={editingCard.fullName}
                    onChange={(e) => setEditingCard((p) => ({ ...p, fullName: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">2. Father&apos;s Name *</label>
                  <input
                    type="text"
                    required
                    value={editingCard.fatherName}
                    onChange={(e) => setEditingCard((p) => ({ ...p, fatherName: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">3. Mother&apos;s Name (Optional)</label>
                  <input
                    type="text"
                    value={editingCard.motherName || ''}
                    onChange={(e) => setEditingCard((p) => ({ ...p, motherName: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">4. Class *</label>
                    <input
                      type="text"
                      required
                      value={editingCard.classNumber || ''}
                      onChange={(e) => setEditingCard((p) => ({ ...p, classNumber: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">5. Section *</label>
                    <input
                      type="text"
                      required
                      value={editingCard.section || ''}
                      onChange={(e) => setEditingCard((p) => ({ ...p, section: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200"
                    />
                  </div>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">6. Roll Number *</label>
                  <input
                    type="text"
                    required
                    value={editingCard.rollNumber || ''}
                    onChange={(e) => setEditingCard((p) => ({ ...p, rollNumber: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">7. Admission Number *</label>
                  <input
                    type="text"
                    required
                    value={editingCard.admissionNumber || ''}
                    onChange={(e) =>
                      setEditingCard((p) => ({
                        ...p,
                        admissionNumber: e.target.value,
                        uniqueIdNumber: e.target.value
                          ? `GMS-STU-${e.target.value.replace(/[^A-Za-z0-9-]/g, '')}`
                          : p.uniqueIdNumber,
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">8. Date of Birth</label>
                  <input
                    type="date"
                    value={editingCard.dob || ''}
                    onChange={(e) => setEditingCard((p) => ({ ...p, dob: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">9. Blood Group (Optional)</label>
                  <select
                    value={editingCard.bloodGroup || ''}
                    onChange={(e) => setEditingCard((p) => ({ ...p, bloodGroup: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                  >
                    {BLOOD_GROUPS.map((bg) => (
                      <option key={bg || 'none'} value={bg}>
                        {bg || 'Not Specified'}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">10. School Name</label>
                  <input
                    type="text"
                    value={editingCard.schoolName}
                    onChange={(e) => setEditingCard((p) => ({ ...p, schoolName: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">15. Academic Session</label>
                  <input
                    type="text"
                    value={editingCard.academicSession || ''}
                    onChange={(e) => setEditingCard((p) => ({ ...p, academicSession: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">11. School Address</label>
                  <input
                    type="text"
                    value={editingCard.schoolAddress}
                    onChange={(e) => setEditingCard((p) => ({ ...p, schoolAddress: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">12. Residential Address</label>
                  <input
                    type="text"
                    value={editingCard.residentialAddress}
                    onChange={(e) => setEditingCard((p) => ({ ...p, residentialAddress: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">13. Contact Number</label>
                  <input
                    type="tel"
                    value={editingCard.contactNumber}
                    onChange={(e) => setEditingCard((p) => ({ ...p, contactNumber: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">14. Parent/Guardian Contact Number</label>
                  <input
                    type="tel"
                    value={editingCard.parentContactNumber || ''}
                    onChange={(e) =>
                      setEditingCard((p) => ({ ...p, parentContactNumber: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>
                <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <p className="font-semibold text-slate-800">17. Principal&apos;s Signature (Optional)</p>
                    <p className="text-[11px] text-slate-500">
                      Uses School Principal Signature by default, or upload a card-specific image.
                    </p>
                  </div>
                  <label className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-bold text-slate-700 cursor-pointer flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Signature</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          handleAssetUpload(f, (url) =>
                            setEditingCard((p) => ({ ...p, principalSignatureDataUrl: url }))
                          );
                        }
                      }}
                    />
                  </label>
                </div>
              </div>
            ) : (
              /* TEACHER 15-FIELD FORM */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">1. Teacher Full Name *</label>
                  <input
                    type="text"
                    required
                    value={editingCard.fullName}
                    onChange={(e) => setEditingCard((p) => ({ ...p, fullName: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">2. Father&apos;s Name *</label>
                  <input
                    type="text"
                    required
                    value={editingCard.fatherName}
                    onChange={(e) => setEditingCard((p) => ({ ...p, fatherName: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">3. Designation *</label>
                  <input
                    type="text"
                    required
                    value={editingCard.designation || ''}
                    onChange={(e) => setEditingCard((p) => ({ ...p, designation: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">4. Employee ID *</label>
                  <input
                    type="text"
                    required
                    value={editingCard.employeeId || ''}
                    onChange={(e) =>
                      setEditingCard((p) => ({
                        ...p,
                        employeeId: e.target.value,
                        uniqueIdNumber: e.target.value
                          ? `GMS-TCH-${e.target.value.replace(/[^A-Za-z0-9-]/g, '')}`
                          : p.uniqueIdNumber,
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">5. Qualification (Optional)</label>
                  <input
                    type="text"
                    value={editingCard.qualification || ''}
                    onChange={(e) => setEditingCard((p) => ({ ...p, qualification: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">6. Subject</label>
                  <input
                    type="text"
                    value={editingCard.subject || ''}
                    onChange={(e) => setEditingCard((p) => ({ ...p, subject: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">7. Date of Joining</label>
                  <input
                    type="date"
                    value={editingCard.dateOfJoining || ''}
                    onChange={(e) => setEditingCard((p) => ({ ...p, dateOfJoining: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">8. Date of Birth (Optional)</label>
                  <input
                    type="date"
                    value={editingCard.dob || ''}
                    onChange={(e) => setEditingCard((p) => ({ ...p, dob: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">9. Blood Group (Optional)</label>
                  <select
                    value={editingCard.bloodGroup || ''}
                    onChange={(e) => setEditingCard((p) => ({ ...p, bloodGroup: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                  >
                    {BLOOD_GROUPS.map((bg) => (
                      <option key={bg || 'none'} value={bg}>
                        {bg || 'Not Specified'}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">13. Contact Number</label>
                  <input
                    type="tel"
                    value={editingCard.contactNumber}
                    onChange={(e) => setEditingCard((p) => ({ ...p, contactNumber: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">10. School Name</label>
                  <input
                    type="text"
                    value={editingCard.schoolName}
                    onChange={(e) => setEditingCard((p) => ({ ...p, schoolName: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">11. Complete School Address</label>
                  <input
                    type="text"
                    value={editingCard.schoolAddress}
                    onChange={(e) => setEditingCard((p) => ({ ...p, schoolAddress: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">12. Residential Address</label>
                  <input
                    type="text"
                    value={editingCard.residentialAddress}
                    onChange={(e) => setEditingCard((p) => ({ ...p, residentialAddress: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
                <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <p className="font-semibold text-slate-800">15. Principal&apos;s Signature</p>
                    <p className="text-[11px] text-slate-500">
                      Inherited from School Profile or upload signature image.
                    </p>
                  </div>
                  <label className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-bold text-slate-700 cursor-pointer flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Signature</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          handleAssetUpload(f, (url) =>
                            setEditingCard((p) => ({ ...p, principalSignatureDataUrl: url }))
                          );
                        }
                      }}
                    />
                  </label>
                </div>
              </div>
            )}

            {/* Card Validity, Template & Status Row */}
            <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Template Style</label>
                <select
                  value={editingCard.templateId}
                  onChange={(e) => {
                    const tid = e.target.value as IdCardTemplateId;
                    const tm = ID_CARD_TEMPLATES.find((t) => t.id === tid);
                    setEditingCard((p) => ({
                      ...p,
                      templateId: tid,
                      backgroundColor: tm?.defaultBg || p.backgroundColor,
                      accentColor: tm?.defaultAccent || p.accentColor,
                    }));
                  }}
                  className="w-full px-2.5 py-2 rounded-lg border border-slate-200 bg-white font-semibold"
                >
                  {ID_CARD_TEMPLATES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Valid Until (Expiry)</label>
                <input
                  type="date"
                  value={editingCard.expiryDate}
                  onChange={(e) => setEditingCard((p) => ({ ...p, expiryDate: e.target.value }))}
                  className="w-full px-2.5 py-2 rounded-lg border border-slate-200 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Card Status</label>
                <select
                  value={editingCard.status}
                  onChange={(e) =>
                    setEditingCard((p) => ({ ...p, status: e.target.value as IdCardStatus }))
                  }
                  className="w-full px-2.5 py-2 rounded-lg border border-slate-200 bg-white font-semibold"
                >
                  <option value="Valid">Valid</option>
                  <option value="Expired">Expired</option>
                  <option value="Invalid">Invalid / Revoked</option>
                </select>
              </div>
            </div>

            <div className="pt-3 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveView('dashboard')}
                className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Save Identity Card</span>
              </button>
            </div>
          </form>

          {/* Right Live Preview & Instant Individual Downloads (PDF / JPEG / PNG) */}
          <div className="xl:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 space-y-4 sticky top-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                  Live Identity Card Preview
                </h3>
                <p className="text-[11px] text-slate-400">
                  Synced with official school branding &amp; centralized logo
                </p>
              </div>
              <span className="text-[11px] font-mono font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg">
                {editingCard.uniqueIdNumber}
              </span>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 flex justify-center">
              <IdCardPreview
                card={syncedEditingCard}
                design={effectiveDesignConfig}
                privacy={qrPrivacy}
              />
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={editingExportBusy !== null}
                  onClick={() => handleExportSingleCard(syncedEditingCard, 'pdf')}
                  className="py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{editingExportBusy === 'pdf' ? 'Generating PDF...' : 'Download PDF'}</span>
                </button>
                <button
                  type="button"
                  disabled={editingExportBusy !== null}
                  onClick={() => handleExportSingleCard(syncedEditingCard, 'jpeg')}
                  className="py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{editingExportBusy === 'jpeg' ? 'Generating JPEG...' : 'Download JPEG'}</span>
                </button>
              </div>
              <button
                type="button"
                disabled={editingExportBusy !== null}
                onClick={() =>
                  downloadIdCardAsImage(syncedEditingCard, effectiveDesignConfig, qrPrivacy, 'png')
                }
                className="w-full py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download High-Res PNG</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 3 & 4. VIEW ALL STUDENTS / VIEW ALL TEACHERS                          */}
      {/* ===================================================================== */}
      {activeView === 'students-list' && renderCardList(filteredStudentCards, 'student')}
      {activeView === 'teachers-list' && renderCardList(filteredTeacherCards, 'teacher')}

      {/* ===================================================================== */}
      {/* 5. QR CODE SCANNER & VERIFICATION                                     */}
      {/* ===================================================================== */}
      {activeView === 'qr-scanner' && (
        <QrIdVerifier
          records={records}
          privacy={qrPrivacy}
          effectiveRole={effectiveRole}
        />
      )}

      {/* ===================================================================== */}
      {/* 6. ID CARD TEMPLATES & DESIGN CUSTOMIZER                              */}
      {/* ===================================================================== */}
      {activeView === 'templates' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 space-y-5">
            <div>
              <h2 className="text-sm font-black text-slate-900">
                6 Official ID Card Templates
              </h2>
              <p className="text-xs text-slate-500">
                Select a template and customize colors, font styles, logos, signatures, stamps, and motto.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ID_CARD_TEMPLATES.map((tpl) => {
                const isSelected = designConfig.templateId === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() =>
                      onUpdateDesignConfig({
                        ...designConfig,
                        templateId: tpl.id,
                        backgroundColor: tpl.defaultBg,
                        accentColor: tpl.defaultAccent,
                      })
                    }
                    className={`text-left p-3.5 rounded-xl border transition-colors ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/40 ring-1 ring-indigo-600'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold text-slate-900">{tpl.name}</span>
                      <span className="text-[10px] font-mono uppercase text-slate-500">
                        {tpl.orientation}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1">{tpl.description}</p>
                  </button>
                );
              })}
            </div>

            {/* Design Customization Controls */}
            <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Background Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={designConfig.backgroundColor}
                    onChange={(e) =>
                      onUpdateDesignConfig({ ...designConfig, backgroundColor: e.target.value })
                    }
                    className="w-9 h-9 rounded border border-slate-200 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={designConfig.backgroundColor}
                    onChange={(e) =>
                      onUpdateDesignConfig({ ...designConfig, backgroundColor: e.target.value })
                    }
                    className="flex-1 px-2.5 py-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Accent / Header Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={designConfig.accentColor}
                    onChange={(e) =>
                      onUpdateDesignConfig({ ...designConfig, accentColor: e.target.value })
                    }
                    className="w-9 h-9 rounded border border-slate-200 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={designConfig.accentColor}
                    onChange={(e) =>
                      onUpdateDesignConfig({ ...designConfig, accentColor: e.target.value })
                    }
                    className="flex-1 px-2.5 py-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Font Style</label>
                <select
                  value={designConfig.fontStyle}
                  onChange={(e) =>
                    onUpdateDesignConfig({
                      ...designConfig,
                      fontStyle: e.target.value as IdCardFontStyle,
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                >
                  <option value="jakarta">Plus Jakarta Sans (Modern)</option>
                  <option value="outfit">Outfit Clean</option>
                  <option value="serif">Georgia Classic Serif</option>
                  <option value="mono">JetBrains Technical Mono</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Font Size</label>
                <select
                  value={designConfig.fontSize}
                  onChange={(e) =>
                    onUpdateDesignConfig({
                      ...designConfig,
                      fontSize: e.target.value as IdCardFontSize,
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                >
                  <option value="compact">Compact</option>
                  <option value="standard">Standard</option>
                  <option value="large">Large Legible</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">School Motto</label>
                <input
                  type="text"
                  value={designConfig.motto}
                  onChange={(e) =>
                    onUpdateDesignConfig({ ...designConfig, motto: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Emergency Contact Info</label>
                <input
                  type="text"
                  value={designConfig.emergencyContact}
                  onChange={(e) =>
                    onUpdateDesignConfig({ ...designConfig, emergencyContact: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                />
              </div>
            </div>

            {/* Branding Asset Uploads */}
            <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <label className="p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer text-center space-y-1">
                <Upload className="w-4 h-4 text-slate-600 mx-auto" />
                <span className="block font-bold text-slate-800">Upload School Logo</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      handleAssetUpload(f, (url) => {
                        onUpdateDesignConfig({ ...designConfig, schoolLogoDataUrl: url });
                        onUpdateSchool({ ...school, logoDataUrl: url });
                      });
                    }
                  }}
                />
              </label>

              <label className="p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer text-center space-y-1">
                <Upload className="w-4 h-4 text-slate-600 mx-auto" />
                <span className="block font-bold text-slate-800">Principal&apos;s Signature</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      handleAssetUpload(f, (url) => {
                        onUpdateDesignConfig({ ...designConfig, principalSignatureDataUrl: url });
                        onUpdateSchool({ ...school, headmasterSignatureDataUrl: url });
                      });
                    }
                  }}
                />
              </label>

              <label className="p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer text-center space-y-1">
                <Upload className="w-4 h-4 text-slate-600 mx-auto" />
                <span className="block font-bold text-slate-800">Official School Stamp</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      handleAssetUpload(f, (url) => {
                        onUpdateDesignConfig({ ...designConfig, schoolStampDataUrl: url });
                        onUpdateSchool({ ...school, officialStampDataUrl: url });
                      });
                    }
                  }}
                />
              </label>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={handleApplyDesignToAll}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Apply Template &amp; Design to All Saved Cards</span>
              </button>
            </div>
          </div>

          {/* Template Live Preview */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
              Live Template Output
            </h3>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 flex justify-center">
              <IdCardPreview
                card={{
                  ...(records[0] || createBlankForm('student', school, designConfig)),
                  fullName: records[0]?.fullName || 'Ananya Sharma',
                  fatherName: records[0]?.fatherName || 'Rajesh Sharma',
                  templateId: designConfig.templateId,
                  backgroundColor: designConfig.backgroundColor,
                  accentColor: designConfig.accentColor,
                  motto: designConfig.motto,
                  emergencyContact: designConfig.emergencyContact,
                  schoolLogoDataUrl: designConfig.schoolLogoDataUrl,
                  principalSignatureDataUrl: designConfig.principalSignatureDataUrl,
                  schoolStampDataUrl: designConfig.schoolStampDataUrl,
                }}
                design={designConfig}
                privacy={qrPrivacy}
              />
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 7. SCHOOL INFORMATION SETTINGS                                        */}
      {/* ===================================================================== */}
      {activeView === 'school-info' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-5 max-w-4xl">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-black text-slate-900">
                School Information &amp; Auto-Population Settings
              </h2>
              <p className="text-xs text-slate-500">
                Saved once and automatically applied to all newly generated Student &amp; Teacher ID cards.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSyncSchoolInfoToCards}
              className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Sync to All Existing Cards</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">School Name</label>
              <input
                type="text"
                value={school.name}
                onChange={(e) => onUpdateSchool({ ...school, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Principal&apos;s Name</label>
              <input
                type="text"
                value={school.headmasterName || school.headTeacherName}
                onChange={(e) =>
                  onUpdateSchool({
                    ...school,
                    headmasterName: e.target.value,
                    headTeacherName: e.target.value,
                  })
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-200"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Complete School Address</label>
              <input
                type="text"
                value={school.address}
                onChange={(e) => onUpdateSchool({ ...school, address: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Contact Number</label>
              <input
                type="tel"
                value={school.contactNumber}
                onChange={(e) => onUpdateSchool({ ...school, contactNumber: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={school.email}
                onChange={(e) => onUpdateSchool({ ...school, email: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Website</label>
              <input
                type="url"
                placeholder="https://gmspamposh.jk.gov.in"
                value={school.website || ''}
                onChange={(e) => onUpdateSchool({ ...school, website: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Academic Session</label>
              <input
                type="text"
                value={school.academicSession}
                onChange={(e) => onUpdateSchool({ ...school, academicSession: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">School Motto</label>
              <input
                type="text"
                value={school.motto || designConfig.motto}
                onChange={(e) => {
                  onUpdateSchool({ ...school, motto: e.target.value });
                  onUpdateDesignConfig({ ...designConfig, motto: e.target.value });
                }}
                className="w-full px-3 py-2 rounded-lg border border-slate-200"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Emergency Contact</label>
              <input
                type="tel"
                value={school.emergencyContact || designConfig.emergencyContact}
                onChange={(e) => {
                  onUpdateSchool({ ...school, emergencyContact: e.target.value });
                  onUpdateDesignConfig({ ...designConfig, emergencyContact: e.target.value });
                }}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
              />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden">
                {school.logoDataUrl ? (
                  <img src={school.logoDataUrl} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <Building2 className="w-5 h-5 text-slate-400" />
                )}
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">School Logo</p>
                <p className="text-[11px] text-slate-500">Automatically placed in header of all ID cards.</p>
              </div>
            </div>
            <label className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-bold text-slate-700 cursor-pointer">
              Upload School Logo
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    handleAssetUpload(f, (url) => {
                      onUpdateSchool({ ...school, logoDataUrl: url });
                      onUpdateDesignConfig({ ...designConfig, schoolLogoDataUrl: url });
                      showToast('School logo updated.');
                    });
                  }
                }}
              />
            </label>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 8. BULK ID CARD GENERATOR                                             */}
      {/* ===================================================================== */}
      {activeView === 'bulk-generator' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-5 max-w-4xl">
          <div>
            <h2 className="text-sm font-black text-slate-900">
              Bulk ID Card Generator
            </h2>
            <p className="text-xs text-slate-500">
              Automatically generate identity cards with unique QR codes from your active Student or Teacher directory.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Target Category</label>
              <select
                value={bulkCategory}
                onChange={(e) => setBulkCategory(e.target.value as IdCardCategory)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white font-semibold"
              >
                <option value="student">Students ({students.filter((s) => s.status === 'Active').length} Active)</option>
                <option value="teacher">Teachers &amp; Staff ({teachers.length})</option>
              </select>
            </div>

            {bulkCategory === 'student' && (
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Filter Class</label>
                <select
                  value={bulkClassFilter}
                  onChange={(e) => setBulkClassFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white font-semibold"
                >
                  <option value="ALL">All Classes</option>
                  {school.classesOffered.map((cls) => (
                    <option key={cls} value={cls}>
                      Class {cls}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={bulkOverwriteExisting}
                  onChange={(e) => setBulkOverwriteExisting(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600"
                />
                <span>Refresh Existing Cards Too</span>
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleRunBulkGenerate}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5"
            >
              <Layers className="w-4 h-4" />
              <span>Generate Bulk ID Cards Now</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveView('pdf-print')}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              <span>Go to PDF &amp; Print Queue</span>
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 9. PDF EXPORT & PRINTING CENTER                                       */}
      {/* ===================================================================== */}
      {activeView === 'pdf-print' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3 no-print">
            <div>
              <h2 className="text-sm font-black text-slate-900">
                Batch PDF Export &amp; CR80 Print Layout ({selectedPrintIds.length} Selected)
              </h2>
              <p className="text-xs text-slate-500">
                Select cards below to export an A4 CR80 cut-sheet PDF or print directly.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={isPrintingAllActive || activeStudentsList.length === 0}
                onClick={() => void handlePrintAllActiveStudentsPdf()}
                className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center gap-1.5 disabled:opacity-40 shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>
                  {isPrintingAllActive
                    ? 'Generating PDF...'
                    : `Print All Active Students (${activeStudentsList.length})`}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedPrintIds(records.map((r) => r.id))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Select All ({records.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedPrintIds([])}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Clear
              </button>
              <button
                type="button"
                disabled={selectedPrintIds.length === 0}
                onClick={() => {
                  const chosen = records.filter((r) => selectedPrintIds.includes(r.id));
                  exportIdCardsToPdf(chosen, effectiveDesignConfig, qrPrivacy);
                  showToast(`Exported ${chosen.length} ID cards to A4 PDF.`);
                }}
                className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-40"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Multi-Card PDF</span>
              </button>
              <button
                type="button"
                disabled={selectedPrintIds.length === 0}
                onClick={() => window.print()}
                className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-40"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Selected</span>
              </button>
            </div>
          </div>

          {/* Selection Checklist (hidden on print) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 max-h-56 overflow-y-auto no-print">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
              {records.map((rec) => {
                const checked = selectedPrintIds.includes(rec.id);
                return (
                  <label
                    key={rec.id}
                    className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer ${
                      checked ? 'border-indigo-400 bg-indigo-50/50' : 'border-slate-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedPrintIds((p) => [...p, rec.id]);
                        } else {
                          setSelectedPrintIds((p) => p.filter((id) => id !== rec.id));
                        }
                      }}
                      className="rounded border-slate-300 text-indigo-600"
                    />
                    <span className="font-semibold text-slate-900 truncate flex-1">{rec.fullName}</span>
                    <span className="text-[10px] font-mono text-slate-500">
                      {rec.category === 'student' ? `Cl ${rec.classNumber}` : 'Staff'}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Printable Preview Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {records
              .filter((r) => selectedPrintIds.includes(r.id))
              .map((card) => (
                <div key={card.id} className="print-break-inside-avoid flex justify-center">
                  <IdCardPreview card={card} design={designConfig} privacy={qrPrivacy} />
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 10. SETTINGS & BACKUP (QR PRIVACY CONTROLS + JSON BACKUP)             */}
      {/* ===================================================================== */}
      {activeView === 'settings-backup' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* QR Privacy Controls */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-600" />
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  QR Code Data &amp; Privacy Controls
                </h3>
                <p className="text-xs text-slate-500">
                  Control which identity fields are encoded in public QR payloads vs restricted to Admins.
                </p>
              </div>
            </div>

            <div className="space-y-2.5 text-xs">
              {(
                [
                  ['showFatherName', "Include Father's Name in QR"],
                  ['showClassOrDesignation', 'Include Class / Designation in QR'],
                  ['showRollOrEmployeeId', 'Include Roll No / Employee ID in QR'],
                  ['showSchoolAddress', 'Include School Address in QR'],
                  ['showDob', 'Include Date of Birth in QR'],
                  ['showBloodGroup', 'Include Blood Group in QR'],
                  ['showResidentialAddress', 'Include Residential Address in Public QR (Sensitive)'],
                  ['showContactNumber', 'Include Personal Contact Number in Public QR (Sensitive)'],
                  ['showParentContact', 'Include Parent Contact Number in Public QR (Sensitive)'],
                  ['requireAdminForConfidential', 'Require Admin Authentication to Reveal Confidential Fields in Scanner'],
                ] as [keyof IdCardQrPrivacySettings, string][]
              ).map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer"
                >
                  <span className="font-semibold text-slate-800 pr-3">{label}</span>
                  <input
                    type="checkbox"
                    checked={qrPrivacy[key]}
                    onChange={(e) =>
                      onUpdateQrPrivacy({ ...qrPrivacy, [key]: e.target.checked })
                    }
                    className="rounded border-slate-300 text-indigo-600 w-4 h-4"
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Backup & Restore */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <FileJson className="w-4 h-4 text-emerald-600" />
              <div>
                <h3 className="text-sm font-black text-slate-900">ID Card Registry Backup &amp; Restore</h3>
                <p className="text-xs text-slate-500">
                  Export or restore all ID cards, photos, templates, and QR privacy policies as JSON.
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={handleExportIdBackupJson}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Download ID Card Maker Backup (.json)</span>
              </button>

              <label className="w-full py-2.5 px-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer">
                <Upload className="w-4 h-4" />
                <span>Restore from Backup (.json)</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleImportIdBackupJson}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Photo Capture & Crop Modal */}
      <PhotoCropModal
        isOpen={photoModalOpen}
        onClose={() => setPhotoModalOpen(false)}
        initialPhotoUrl={editingCard.photoDataUrl}
        onSavePhoto={(croppedUrl) =>
          setEditingCard((p) => ({ ...p, photoDataUrl: croppedUrl }))
        }
      />

      {/* Quick Preview Modal */}
      {inspectedCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4 no-print">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 max-w-lg w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900">
                ID Card Preview &bull; {inspectedCard.uniqueIdNumber}
              </h3>
              <button
                type="button"
                onClick={() => setInspectedCard(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex justify-center bg-slate-50 p-4 rounded-xl border border-slate-200">
              <IdCardPreview card={inspectedCard} design={designConfig} privacy={qrPrivacy} />
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() =>
                  downloadIdCardAsImage(
                    { ...inspectedCard, schoolLogoDataUrl: school.logoDataUrl || undefined },
                    effectiveDesignConfig,
                    qrPrivacy,
                    'png'
                  )
                }
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700"
              >
                Download PNG
              </button>
              <button
                type="button"
                onClick={() => handleExportSingleCard(inspectedCard, 'jpeg')}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold"
              >
                Download JPEG
              </button>
              <button
                type="button"
                onClick={() => handleExportSingleCard(inspectedCard, 'pdf')}
                className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold"
              >
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4 no-print">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 max-w-sm w-full space-y-4">
            <h3 className="text-sm font-black text-slate-900">Delete Identity Card?</h3>
            <p className="text-xs text-slate-600">
              Are you sure you want to permanently remove the ID card for{' '}
              <strong>{confirmDeleteCard.fullName}</strong> ({confirmDeleteCard.uniqueIdNumber})?
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteCard(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteRecord(confirmDeleteCard.id);
                  showToast(`Deleted ID card ${confirmDeleteCard.uniqueIdNumber}.`);
                  setConfirmDeleteCard(null);
                }}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
