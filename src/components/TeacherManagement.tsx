import React, { useState, useMemo, useEffect } from 'react';
import {
  GraduationCap,
  Plus,
  Search,
  Mail,
  Phone,
  MapPin,
  Calendar,
  BookOpen,
  Award,
  Edit2,
  FileSpreadsheet,
  Printer,
  X,
  UserCheck,
  ShieldCheck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Users,
  Settings,
  Sparkles,
  TrendingUp,
  FileText,
  Trash2,
  ChevronRight,
  Download,
  Check,
  Filter,
  Eye,
  Building,
  Briefcase,
  Compass,
  KeyRound,
  Power,
  Lock,
  History,
  Save,
  ChevronDown,
} from 'lucide-react';
import {
  AdminRoleType,
  SchoolProfile,
  TeacherProfile,
  TeacherAttendanceRecord,
  TeacherAttendanceStatus,
  TeacherAttendanceChangeLogEntry,
  User,
  TeacherServiceRecord,
  JkEpmQuarterlyRecord,
} from '../types';
import { Language, translations } from '../utils/translations';
import {
  calculateJKRetirementDate,
  calculateServiceDuration,
  calculateTeacherAge,
  calculateHaversineDistanceMeters,
  formatSchoolAddressOnce,
} from '../utils/calculations';
import * as XLSX from 'xlsx';
import { LocationMapModal, CheckInLocationData } from './LocationMapModal';
import { STANDARDIZED_ADDRESS } from '../utils/sampleData';

async function hashTeacherPassword(password: string): Promise<string> {
  const salted = `jk_hpc_teacher_salt::${password}`;
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salted));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return `fallback_${btoa(unescape(encodeURIComponent(salted)))}`;
}

const STANDARD_TEACHER_DESIGNATIONS: string[] = [
  'Headmaster',
  'In-Charge Headmaster',
  'Master',
  'Senior Teacher',
  'General Line Teacher',
  'Teacher (General Line)',
  'ReT Teacher',
  'RReT Teacher',
  'Physical Education Teacher (PET)',
  'Urdu Teacher',
  'Science Teacher',
  'Mathematics Teacher',
  'Social Studies Teacher',
];

const ATTENDANCE_STATUS_OPTIONS: TeacherAttendanceStatus[] = [
  'Present',
  'Absent',
  'Casual Leave (CL)',
  'Medical Leave (ML)',
  'On Duty (OD)',
  'Half Day',
  'Late Arrival',
  'Other',
];

function parseTo24HourTime(value: string | undefined, fallback: string): string {
  const raw = (value || '').trim();
  if (!raw) return fallback;
  const h24 = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (h24) {
    return `${h24[1].padStart(2, '0')}:${h24[2]}`;
  }
  const h12 = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (h12) {
    let hrs = parseInt(h12[1], 10);
    const mins = h12[2];
    const period = h12[3].toUpperCase();
    if (period === 'PM' && hrs < 12) hrs += 12;
    if (period === 'AM' && hrs === 12) hrs = 0;
    return `${String(hrs).padStart(2, '0')}:${mins}`;
  }
  return fallback;
}

function formatTo12HourAmPm(time24: string): string {
  const match = (time24 || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return time24 || '09:00 AM';
  let hrs = parseInt(match[1], 10);
  const mins = match[2];
  const period = hrs >= 12 ? 'PM' : 'AM';
  hrs = hrs % 12;
  if (hrs === 0) hrs = 12;
  return `${String(hrs).padStart(2, '0')}:${mins} ${period}`;
}

interface AttendanceStatusVisualMeta {
  dotClass: string;
  badgeClass: string;
  shortLabel: string;
}

function getAttendanceStatusMeta(status: TeacherAttendanceStatus | string): AttendanceStatusVisualMeta {
  switch (status) {
    case 'Present':
      return {
        dotClass: 'bg-emerald-500',
        badgeClass: 'bg-emerald-50 text-emerald-800 border border-emerald-300',
        shortLabel: 'Present',
      };
    case 'Absent':
      return {
        dotClass: 'bg-rose-500',
        badgeClass: 'bg-rose-50 text-rose-800 border border-rose-300',
        shortLabel: 'Absent',
      };
    case 'Casual Leave (CL)':
    case 'On Leave':
    case 'Leave':
      return {
        dotClass: 'bg-blue-500',
        badgeClass: 'bg-blue-50 text-blue-800 border border-blue-300',
        shortLabel: 'Casual Leave (CL)',
      };
    case 'Medical Leave (ML)':
      return {
        dotClass: 'bg-sky-500',
        badgeClass: 'bg-sky-50 text-sky-800 border border-sky-300',
        shortLabel: 'Medical Leave (ML)',
      };
    case 'On Duty (OD)':
    case 'Official Duty':
    case 'On_Duty':
      return {
        dotClass: 'bg-indigo-500',
        badgeClass: 'bg-indigo-50 text-indigo-800 border border-indigo-300',
        shortLabel: 'On Duty (OD)',
      };
    case 'Half Day':
      return {
        dotClass: 'bg-amber-500',
        badgeClass: 'bg-amber-50 text-amber-800 border border-amber-300',
        shortLabel: 'Half Day',
      };
    case 'Late Arrival':
    case 'Late':
      return {
        dotClass: 'bg-orange-500',
        badgeClass: 'bg-orange-50 text-orange-800 border border-orange-300',
        shortLabel: 'Late Arrival',
      };
    default:
      return {
        dotClass: 'bg-slate-500',
        badgeClass: 'bg-slate-100 text-slate-800 border border-slate-300',
        shortLabel: String(status || 'Other'),
      };
  }
}

function getAttendanceStatusBadgeStyle(status: TeacherAttendanceStatus): string {
  return getAttendanceStatusMeta(status).badgeClass;
}

function escapeCsvCell(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

interface TeacherManagementProps {
  teachers: TeacherProfile[];
  school: SchoolProfile;
  currentUser: User;
  effectiveRole?: AdminRoleType;
  onAddTeacher: (teacher: TeacherProfile) => void;
  onUpdateTeacher: (teacher: TeacherProfile) => void;
  onDeleteTeacher?: (teacherId: string) => void;
  teacherAttendance?: TeacherAttendanceRecord[];
  onSaveTeacherAttendance?: (record: TeacherAttendanceRecord) => void;
  initialSubTab?: 'jkhrms' | 'service-book' | 'jkepm' | 'attendance';
  language: Language;
  onNavigateToLocationSettings?: () => void;
}

export const TeacherManagement: React.FC<TeacherManagementProps> = ({
  teachers,
  school,
  currentUser,
  effectiveRole,
  onAddTeacher,
  onUpdateTeacher,
  onDeleteTeacher,
  teacherAttendance = [],
  onSaveTeacherAttendance,
  initialSubTab = 'jkhrms',
  language,
  onNavigateToLocationSettings,
}) => {
  const t = translations[language];
  const isAdminUser = effectiveRole
    ? effectiveRole !== 'teacher'
    : currentUser.role === 'admin' ||
      currentUser.role === 'head_teacher' ||
      currentUser.role === 'primary_admin' ||
      currentUser.role === 'senior_admin';

  // 5 Statutory Sub-Tabs
  const [activeSubTab, setActiveSubTab] = useState<'jkhrms' | 'service-book' | 'jkepm' | 'attendance' | 'duty-roster'>(initialSubTab as any);

  // Duty Roster State & Points
  const [dutyRosterWeek, setDutyRosterWeek] = useState<string>('Week 44 (Oct 26 - Oct 31, 2026)');
  const [rosterAssignments, setRosterAssignments] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('sm_teacher_duty_roster');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return {
      'Monday_Playground': teachers[0]?.id || '',
      'Monday_Gate': teachers[1]?.id || '',
      'Monday_Assembly': teachers[2]?.id || '',
      'Tuesday_Playground': teachers[1]?.id || '',
      'Tuesday_Gate': teachers[2]?.id || '',
      'Tuesday_Lunch': teachers[0]?.id || '',
      'Wednesday_Assembly': teachers[0]?.id || '',
      'Wednesday_Playground': teachers[2]?.id || '',
      'Thursday_Lunch': teachers[1]?.id || '',
      'Thursday_Gate': teachers[0]?.id || '',
      'Friday_Assembly': teachers[1]?.id || '',
      'Friday_Playground': teachers[0]?.id || '',
      'Saturday_Gate': teachers[2]?.id || '',
      'Saturday_Assembly': teachers[0]?.id || '',
    };
  });

  const handleAssignDuty = (day: string, dutyType: string, teacherId: string) => {
    const key = `${day}_${dutyType}`;
    const updated = { ...rosterAssignments, [key]: teacherId };
    setRosterAssignments(updated);
    localStorage.setItem('sm_teacher_duty_roster', JSON.stringify(updated));
    showToast(`Supervision duty updated: ${dutyType} on ${day} assigned.`);
  };

  // Selected teacher for Service Book view
  const [selectedServiceBookTeacherId, setSelectedServiceBookTeacherId] = useState<string>(teachers[0]?.id || '');
  const selectedServiceBookTeacher = teachers.find((tc) => tc.id === selectedServiceBookTeacherId) || teachers[0];

  // Toast / Feedback message
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterDesignation, setFilterDesignation] = useState<string>('all');

  // Teacher Add/Edit Modal
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingTeacher, setEditingTeacher] = useState<TeacherProfile | null>(null);

  // Form Fields
  const [empId, setEmpId] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [fatherName, setFatherName] = useState<string>('');
  const [motherName, setMotherName] = useState<string>('');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [dob, setDob] = useState<string>('1984-05-15');
  const [designation, setDesignation] = useState<string>('Teacher (General Line)');
  const [subjectSpecialization, setSubjectSpecialization] = useState<string>('General / Science');
  const [employmentStatus, setEmploymentStatus] = useState<'Regular' | 'Contract' | 'Deputation'>('Regular');
  const [employmentType, setEmploymentType] = useState<'Permanent (Gazetted)' | 'Permanent (Non-Gazetted)' | 'ReT / General Line' | 'Contractual'>('Permanent (Non-Gazetted)');
  const [employeeCategory, setEmployeeCategory] = useState<'General' | 'RBA' | 'SC' | 'ST' | 'ALC' | 'EWS'>('General');
  const [dateOfInitialAppointment, setDateOfInitialAppointment] = useState<string>('2010-04-10');
  const [dateOfJoiningDepartment, setDateOfJoiningDepartment] = useState<string>('2010-04-10');
  const [dateOfJoiningPresentSchool, setDateOfJoiningPresentSchool] = useState<string>('2022-04-01');
  const [appointmentOrderNumber, setAppointmentOrderNumber] = useState<string>('DSEK/Estt/Appt-4412/10');
  const [currentSchool, setCurrentSchool] = useState<string>('Govt Middle School Pamposh Colony');
  const [previousSchool, setPreviousSchool] = useState<string>('Govt Boys High School, Mirgund');
  const [transferDate, setTransferDate] = useState<string>('2022-03-28');
  const [contactNumber, setContactNumber] = useState<string>('+91 94190');
  const [email, setEmail] = useState<string>('');
  const [residentialAddress, setResidentialAddress] = useState<string>(STANDARDIZED_ADDRESS);
  const [district, setDistrict] = useState<string>('Srinagar');
  const [qualifications, setQualifications] = useState<string>('M.Sc., B.Ed.');
  const [serviceRemarks, setServiceRemarks] = useState<string>('Records verified under JKHRMS J&K CSR Rules.');
  const [clBalance, setClBalance] = useState<number>(12);
  const [mlBalance, setMlBalance] = useState<number>(20);
  const [elBalance, setElBalance] = useState<number>(30);
  const [assignedClassesInput, setAssignedClassesInput] = useState<{ classNumber: string; section: string; subject: string }[]>([]);
  const [newAssignClass, setNewAssignClass] = useState<string>('5');
  const [newAssignSection, setNewAssignSection] = useState<string>('A');
  const [newAssignSubject, setNewAssignSubject] = useState<string>('Mathematics');
  const [usernameInput, setUsernameInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [accountStatusInput, setAccountStatusInput] = useState<'Active' | 'Inactive'>('Active');

  // View Profile, Reset Password, and Delete Confirmation Modals
  const [viewingTeacherProfile, setViewingTeacherProfile] = useState<TeacherProfile | null>(null);
  const [resetPasswordTeacher, setResetPasswordTeacher] = useState<TeacherProfile | null>(null);
  const [resetNewPwd, setResetNewPwd] = useState<string>('');
  const [resetConfirmPwd, setResetConfirmPwd] = useState<string>('');
  const [resetPwdError, setResetPwdError] = useState<string | null>(null);
  const [teacherToDeleteConfirm, setTeacherToDeleteConfirm] = useState<TeacherProfile | null>(null);

  // Dedicated Edit Teacher Address Modal / Quick Edit State
  const [addressEditingTeacher, setAddressEditingTeacher] = useState<TeacherProfile | null>(null);
  const [editedTeacherAddressValue, setEditedTeacherAddressValue] = useState<string>('');
  const [editedTeacherDistrict, setEditedTeacherDistrict] = useState<string>('Srinagar');
  const [teacherAddressEditError, setTeacherAddressEditError] = useState<string | null>(null);

  const handleOpenEditTeacherAddress = (tc: TeacherProfile) => {
    setAddressEditingTeacher(tc);
    setEditedTeacherAddressValue(tc.residentialAddress || STANDARDIZED_ADDRESS);
    setEditedTeacherDistrict(tc.district || 'Srinagar');
    setTeacherAddressEditError(null);
  };

  const handleApplyStandardTeacherAddress = () => {
    setEditedTeacherAddressValue(STANDARDIZED_ADDRESS);
    setEditedTeacherDistrict('Srinagar');
    setTeacherAddressEditError(null);
  };

  const handleSaveTeacherAddress = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!addressEditingTeacher) return;
    const trimmed = editedTeacherAddressValue.trim();
    if (!trimmed || trimmed.length < 5) {
      setTeacherAddressEditError('Please enter a valid residential address (minimum 5 characters).');
      return;
    }

    const updated: TeacherProfile = {
      ...addressEditingTeacher,
      residentialAddress: trimmed,
      district: editedTeacherDistrict.trim() || 'Srinagar',
    };

    onUpdateTeacher(updated);
    showToast(`✓ Residential address successfully updated & saved for Teacher "${updated.name}"!`);
    setAddressEditingTeacher(null);
    setTeacherAddressEditError(null);
  };

  const handleCancelEditTeacherAddress = () => {
    setAddressEditingTeacher(null);
    setTeacherAddressEditError(null);
  };

  // Dynamic Live Calculations in Modal
  const calculatedRetirement = useMemo(() => {
    return calculateJKRetirementDate(dob);
  }, [dob]);

  const calculatedAge = useMemo(() => {
    return calculateTeacherAge(dob);
  }, [dob]);

  const calculatedDeptService = useMemo(() => {
    return calculateServiceDuration(dateOfJoiningDepartment);
  }, [dateOfJoiningDepartment]);

  const calculatedSchoolTenure = useMemo(() => {
    return calculateServiceDuration(dateOfJoiningPresentSchool);
  }, [dateOfJoiningPresentSchool]);

  // Attendance Register State
  const [attendanceDate, setAttendanceDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [attendanceFilterStatus, setAttendanceFilterStatus] = useState<string>('all');
  const [showGpsPanel, setShowGpsPanel] = useState<boolean>(false);
  const [selectedLocationForMap, setSelectedLocationForMap] = useState<CheckInLocationData | null>(null);

  // GPS Check-In state
  const [isAcquiringGps, setIsAcquiringGps] = useState<boolean>(false);
  const [gpsCheckInResult, setGpsCheckInResult] = useState<{
    latitude: number;
    longitude: number;
    accuracyMeters: number;
    distanceMeters: number;
    isWithinGeofence: boolean;
    timestamp: string;
  } | null>(null);

  const schoolLat = school.latitude ?? 34.0837; // Srinagar default
  const schoolLng = school.longitude ?? 74.7973;
  const geofenceRadius = school.geofenceRadiusMeters ?? 250;
  const campusAddress = school.locationAddress || formatSchoolAddressOnce(school);

  // Filter teachers list
  const filteredTeachers = useMemo(() => {
    return teachers.filter((tc) => {
      const matchSearch =
        tc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tc.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tc.designation.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (tc.subjectSpecialization && tc.subjectSpecialization.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchStatus = filterStatus === 'all' || tc.employmentStatus === filterStatus;
      const matchDesig = filterDesignation === 'all' || tc.designation.includes(filterDesignation);
      return matchSearch && matchStatus && matchDesig;
    });
  }, [teachers, searchTerm, filterStatus, filterDesignation]);

  // Open modal for Add or Edit
  const openModalForTeacher = (tc?: TeacherProfile) => {
    if (tc) {
      setEditingTeacher(tc);
      setEmpId(tc.employeeId);
      setName(tc.name);
      setFatherName(tc.fatherName || tc.fatherSpouseName);
      setMotherName(tc.motherName || '');
      setGender(tc.gender || 'Male');
      setDob(tc.dob || '1984-05-15');
      setDesignation(tc.designation);
      setSubjectSpecialization(tc.subjectSpecialization || 'General / Science');
      setEmploymentStatus(tc.employmentStatus);
      setEmploymentType(tc.employmentType || 'Permanent (Non-Gazetted)');
      setEmployeeCategory(tc.employeeCategory || 'General');
      setDateOfInitialAppointment(tc.dateOfInitialAppointment || tc.dateOfJoining || '2010-04-10');
      setDateOfJoiningDepartment(tc.dateOfJoiningDepartment || tc.dateOfJoining || '2010-04-10');
      setDateOfJoiningPresentSchool(tc.dateOfJoiningPresentSchool || '2022-04-01');
      setAppointmentOrderNumber(tc.appointmentOrderNumber || 'DSEK/Estt/Appt-4412/10');
      setCurrentSchool(tc.currentSchool || school.name);
      setPreviousSchool(tc.previousSchool || 'Govt Boys High School, Mirgund');
      setTransferDate(tc.transferDate || '2022-03-28');
      setContactNumber(tc.contactNumber);
      setEmail(tc.email);
      setResidentialAddress(tc.residentialAddress || STANDARDIZED_ADDRESS);
      setDistrict(tc.district || 'Srinagar');
      setQualifications(tc.qualifications);
      setServiceRemarks(tc.serviceRemarks || 'Verified under JKHRMS J&K CSR Rules.');
      setClBalance(tc.casualLeaveBalance);
      setMlBalance(tc.medicalLeaveBalance);
      setElBalance(tc.earnedLeaveBalance);
      setAssignedClassesInput(tc.assignedClasses || []);
      setUsernameInput(tc.username || tc.email || tc.employeeId.toLowerCase());
      setPasswordInput('');
      setAccountStatusInput(tc.accountStatus || 'Active');
    } else {
      setEditingTeacher(null);
      const genEmpId = `CPIS-SGR-${Math.floor(100 + Math.random() * 900)}`;
      setEmpId(genEmpId);
      setName('');
      setFatherName('');
      setMotherName('');
      setGender('Male');
      setDob('1985-06-15');
      setDesignation('Teacher (General Line)');
      setSubjectSpecialization('Mathematics / Science');
      setEmploymentStatus('Regular');
      setEmploymentType('Permanent (Non-Gazetted)');
      setEmployeeCategory('General');
      setDateOfInitialAppointment('2012-05-01');
      setDateOfJoiningDepartment('2012-05-01');
      setDateOfJoiningPresentSchool(new Date().toISOString().slice(0, 10));
      setAppointmentOrderNumber(`DSEK/Estt/Appt-${Math.floor(1000 + Math.random() * 9000)}/12`);
      setCurrentSchool(school.name);
      setPreviousSchool('Govt Primary School, Palpora');
      setTransferDate(new Date().toISOString().slice(0, 10));
      setContactNumber('+91 94190');
      setEmail('');
      setResidentialAddress(STANDARDIZED_ADDRESS);
      setDistrict('Srinagar');
      setQualifications('M.Sc., B.Ed.');
      setServiceRemarks('Fresh service entry submitted for JKHRMS verification.');
      setClBalance(12);
      setMlBalance(20);
      setElBalance(30);
      setAssignedClassesInput([{ classNumber: '5', section: 'A', subject: 'Mathematics' }]);
      setUsernameInput(genEmpId.toLowerCase());
      setPasswordInput('');
      setAccountStatusInput('Active');
    }
    setIsModalOpen(true);
  };

  const handleAddAssignedClassRow = () => {
    const subj = newAssignSubject.trim();
    if (!subj) return;
    const exists = assignedClassesInput.some(
      (a) => a.classNumber === newAssignClass && a.section === newAssignSection && a.subject.toLowerCase() === subj.toLowerCase()
    );
    if (exists) return;
    setAssignedClassesInput((prev) => [
      ...prev,
      { classNumber: newAssignClass, section: newAssignSection, subject: subj },
    ]);
  };

  const handleRemoveAssignedClassRow = (idx: number) => {
    setAssignedClassesInput((prev) => prev.filter((_, i) => i !== idx));
  };

  // Save handler for Add / Edit
  const handleSaveTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !empId.trim() || !isAdminUser) return;

    const normalizedNewCpis = empId.trim().replace(/\s+/g, ' ').toUpperCase();
    const compactNewCpis = normalizedNewCpis.replace(/[^A-Z0-9]/g, '');
    const duplicateHolder = teachers.find(
      (tc) =>
        tc.id !== editingTeacher?.id &&
        (tc.employeeId || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase() === compactNewCpis
    );
    if (duplicateHolder) {
      showToast(
        `Duplicate CPIS Code "${normalizedNewCpis}" blocked — already assigned to ${duplicateHolder.name}.`
      );
      return;
    }

    // J&K CSR 60-Year Superannuation Date
    const retInfo = calculateJKRetirementDate(dob);
    const computedPasswordHash = passwordInput.trim()
      ? await hashTeacherPassword(passwordInput.trim())
      : editingTeacher?.passwordHash;

    if (editingTeacher) {
      const cpisChanged =
        (editingTeacher.employeeId || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase() !== compactNewCpis;
      const updated: TeacherProfile = {
        ...editingTeacher,
        employeeId: normalizedNewCpis,
        previousCpisCode: cpisChanged
          ? editingTeacher.employeeId
          : editingTeacher.previousCpisCode,
        name: name.trim(),
        fatherName: fatherName.trim(),
        fatherSpouseName: fatherName.trim(),
        motherName: motherName.trim(),
        gender,
        dob,
        designation,
        subjectSpecialization,
        assignedClasses: assignedClassesInput,
        employmentStatus,
        employmentType,
        employeeCategory,
        dateOfInitialAppointment,
        dateOfJoiningDepartment,
        dateOfJoiningPresentSchool,
        dateOfJoining: dateOfJoiningDepartment,
        appointmentOrderNumber,
        currentSchool,
        previousSchool,
        transferDate,
        contactNumber,
        email,
        residentialAddress,
        district,
        schoolName: school.name,
        schoolId: school.code,
        qualifications,
        retirementDate: retInfo.retirementDate,
        isRetirementDateCalculated: true,
        serviceRemarks,
        casualLeaveBalance: clBalance,
        medicalLeaveBalance: mlBalance,
        earnedLeaveBalance: elBalance,
        username: usernameInput.trim() || email.trim() || empId.toLowerCase(),
        passwordHash: computedPasswordHash,
        accountStatus: accountStatusInput,
        updatedAt: new Date().toISOString(),
      };
      onUpdateTeacher(updated);
      showToast(`Teacher record & credentials for ${name} updated successfully!`);
    } else {
      const newTeacher: TeacherProfile = {
        id: `tch-${Date.now()}`,
        employeeId: empId,
        name: name.trim(),
        fatherName: fatherName.trim(),
        fatherSpouseName: fatherName.trim(),
        motherName: motherName.trim(),
        gender,
        dob,
        designation,
        subjectSpecialization,
        assignedClasses: assignedClassesInput,
        employmentStatus,
        employmentType,
        employeeCategory,
        dateOfInitialAppointment,
        dateOfJoiningDepartment,
        dateOfJoiningPresentSchool,
        dateOfJoining: dateOfJoiningDepartment,
        appointmentOrderNumber,
        currentSchool,
        previousSchool,
        transferDate,
        contactNumber,
        email,
        residentialAddress,
        district,
        schoolName: school.name,
        schoolId: school.code,
        qualifications,
        retirementDate: retInfo.retirementDate,
        isRetirementDateCalculated: true,
        serviceRemarks,
        casualLeaveBalance: clBalance,
        medicalLeaveBalance: mlBalance,
        earnedLeaveBalance: elBalance,
        username: usernameInput.trim() || email.trim() || empId.toLowerCase(),
        passwordHash: computedPasswordHash,
        accountStatus: accountStatusInput,
        updatedAt: new Date().toISOString(),
      };
      onAddTeacher(newTeacher);
      showToast(`New Teacher ${name} registered with login account!`);
    }
    setIsModalOpen(false);
  };

  // Toggle Activate / Deactivate Teacher (Admin only)
  const handleToggleTeacherAccountStatus = (tc: TeacherProfile) => {
    if (!isAdminUser) return;
    const nextStatus: 'Active' | 'Inactive' = (tc.accountStatus || 'Active') === 'Active' ? 'Inactive' : 'Active';
    onUpdateTeacher({
      ...tc,
      accountStatus: nextStatus,
      updatedAt: new Date().toISOString(),
    });
    showToast(`Teacher account for ${tc.name} is now ${nextStatus}.`);
  };

  // Reset Teacher Password (Admin only)
  const handleOpenResetPassword = (tc: TeacherProfile) => {
    if (!isAdminUser) return;
    setResetPasswordTeacher(tc);
    setResetNewPwd('');
    setResetConfirmPwd('');
    setResetPwdError(null);
  };

  const handleConfirmResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordTeacher || !isAdminUser) return;
    if (resetNewPwd.trim().length < 6) {
      setResetPwdError('Password must be at least 6 characters.');
      return;
    }
    if (resetNewPwd !== resetConfirmPwd) {
      setResetPwdError('Passwords do not match.');
      return;
    }
    const passwordHash = await hashTeacherPassword(resetNewPwd.trim());
    onUpdateTeacher({
      ...resetPasswordTeacher,
      passwordHash,
      updatedAt: new Date().toISOString(),
    });
    showToast(`Password securely reset for ${resetPasswordTeacher.name}.`);
    setResetPasswordTeacher(null);
  };

  // Delete Teacher handler (uses in-app modal instead of window.confirm)
  const handleDeleteTeacherRecord = (tc: TeacherProfile) => {
    if (!onDeleteTeacher || !isAdminUser) return;
    setTeacherToDeleteConfirm(tc);
  };

  const handleConfirmDeleteTeacher = () => {
    if (!teacherToDeleteConfirm || !onDeleteTeacher || !isAdminUser) return;
    onDeleteTeacher(teacherToDeleteConfirm.id);
    showToast(`Service record for ${teacherToDeleteConfirm.name} deleted.`);
    setTeacherToDeleteConfirm(null);
  };

  // Export JKHRMS Register to Excel
  const exportJkhrmsToExcel = () => {
    const headers = [
      'Employee Code (CPIS)',
      'Teacher Full Name',
      'Father Name',
      'Mother Name',
      'Gender',
      'Date of Birth',
      'Calculated Age (Y/M/D)',
      'Designation',
      'Subject Specialization',
      'Employment Type',
      'Category',
      'Initial Appointment Date',
      'Joining Dept Date',
      'Dept Total Service (Y/M/D)',
      'Present School Joining Date',
      'Present School Tenure (Y/M/D)',
      'Retirement Date (J&K CSR 60-Yr Rule)',
      'Appointment Order No',
      'Previous School',
      'Contact Number',
      'Email Address',
      'District',
      'Current School',
      'Qualifications',
      'Service Remarks',
    ];

    const rows = teachers.map((tc) => {
      const age = calculateTeacherAge(tc.dob || '1984-05-15');
      const deptService = calculateServiceDuration(tc.dateOfJoiningDepartment || tc.dateOfJoining);
      const tenure = calculateServiceDuration(tc.dateOfJoiningPresentSchool || '2022-04-01');
      const retDate = tc.retirementDate || calculateJKRetirementDate(tc.dob || '1984-05-15').retirementDate;

      return [
        tc.employeeId,
        tc.name,
        tc.fatherName || tc.fatherSpouseName,
        tc.motherName || '—',
        tc.gender || '—',
        tc.dob || '—',
        age.formatted,
        tc.designation,
        tc.subjectSpecialization || 'General',
        tc.employmentType || 'Permanent',
        tc.employeeCategory || 'General',
        tc.dateOfInitialAppointment || '—',
        tc.dateOfJoiningDepartment || tc.dateOfJoining,
        deptService.formatted,
        tc.dateOfJoiningPresentSchool || '—',
        tenure.formatted,
        retDate,
        tc.appointmentOrderNumber || '—',
        tc.previousSchool || '—',
        tc.contactNumber,
        tc.email,
        tc.district || 'Baramulla',
        school.name,
        tc.qualifications,
        tc.serviceRemarks || 'Verified under J&K CSR Rules.',
      ];
    });

    const ws = XLSX.utils.aoa_to_sheet([
      [`${school.name} - OFFICIAL JKHRMS TEACHER SERVICE REGISTER`],
      [`District: ${school.district || 'Srinagar'}, Jammu & Kashmir | U-DISE: ${school.code} | Generated: ${new Date().toLocaleDateString()}`],
      [],
      headers,
      ...rows,
    ]);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'JKHRMS_Register');
    XLSX.writeFile(wb, `JKHRMS_Teacher_Register_${school.code}.xlsx`);
    showToast('JKHRMS Register exported successfully to Excel!');
  };

  // Export JKEPM Quarterly Records to Excel
  const exportJkEpmToExcel = () => {
    const headers = [
      'Academic Session',
      'Quarter',
      'Teacher Name',
      'Employee CPIS',
      'Designation',
      'Self-Assessment Score (/10)',
      'Syllabus Coverage (%)',
      'Remedial Classes Held',
      'Activities Description',
      'Verification Status',
      'Verified By (HOI/Admin)',
      'Remarks',
    ];

    const rows: any[] = [];
    teachers.forEach((tc) => {
      const records = tc.jkepmRecords || [
        {
          id: `epm-${tc.id}-q1`,
          academicSession: school.academicSession,
          quarter: 'Q1 (Apr - Jun)' as const,
          submissionDate: '2026-06-30',
          scoreOutOf10: tc.jkepmScore || 9.4,
          syllabusCoveragePct: 92,
          remedialClassesHeld: 18,
          activityDescription: 'Completed Term syllabus, conducted diagnostic assessments.',
          verificationStatus: 'Verified' as const,
          verifiedBy: `${school.adminName || 'Mohd Yousuf Wani'} (HOI / Admin)`,
          remarks: 'Satisfactory performance; remedial outcomes documented.',
        },
      ];

      records.forEach((r) => {
        rows.push([
          r.academicSession,
          r.quarter,
          tc.name,
          tc.employeeId,
          tc.designation,
          r.scoreOutOf10,
          `${r.syllabusCoveragePct}%`,
          r.remedialClassesHeld,
          r.activityDescription,
          r.verificationStatus,
          r.verifiedBy,
          r.remarks,
        ]);
      });
    });

    const ws = XLSX.utils.aoa_to_sheet([
      [`${school.name} - JKEPM QUARTERLY TEACHER & SCHOOL PERFORMANCE REGISTER`],
      [`Academic Session: ${school.academicSession} | District: ${school.district || 'Srinagar'}, J&K | U-DISE: ${school.code}`],
      [],
      headers,
      ...rows,
    ]);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'JKEPM_Performance');
    XLSX.writeFile(wb, `JKEPM_Quarterly_Register_${school.code}.xlsx`);
    showToast('JKEPM Performance Register exported successfully!');
  };

  // Export Daily Teacher Attendance to Excel
  const exportDailyTeacherAttendance = () => {
    const headers = [
      'Date',
      'Employee CPIS',
      'Teacher Full Name',
      'Designation',
      'Attendance Status',
      'Arrival Time',
      'Departure Time',
      'Remarks by HOI',
      'Last Updated By',
      'Campus Geofence Verification',
    ];

    const rows = teachers.map((tc) => {
      const rec = teacherAttendance.find((r) => r.teacherId === tc.id && r.date === attendanceDate);
      return [
        attendanceDate,
        tc.employeeId,
        tc.name,
        rec?.designation || tc.designation,
        rec?.status || 'Present',
        rec?.checkInTime || '09:00 AM',
        rec?.checkOutTime || '04:00 PM',
        rec?.remarksByHoi ?? rec?.remarks ?? tc.latestHoiRemarks ?? '',
        rec?.updatedBy || '—',
        rec?.checkInLocation?.isWithinGeofence ? 'Verified On-Campus' : 'Standard Manual Roll',
      ];
    });

    const ws = XLSX.utils.aoa_to_sheet([
      [`${school.name} - DAILY FACULTY ATTENDANCE & SERVICE REGISTER`],
      [`Date: ${attendanceDate} | District: ${school.district || 'Srinagar'}, J&K | School: ${school.name}`],
      [],
      headers,
      ...rows,
    ]);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Faculty_Attendance');
    XLSX.writeFile(wb, `Daily_Faculty_Attendance_${attendanceDate}.xlsx`);
    showToast(`Daily Faculty Attendance for ${attendanceDate} exported!`);
  };

  // Export Structured CSV of Teacher Attendance History & Service Book Records
  const exportTeacherAttendanceAndServiceCsv = () => {
    const lines: string[] = [];
    const pushRow = (cols: unknown[]) => {
      lines.push(cols.map(escapeCsvCell).join(','));
    };

    pushRow([`${school.name} - TEACHER ATTENDANCE HISTORY & SERVICE BOOK REGISTER (CSV)`]);
    pushRow([
      `U-DISE: ${school.code}`,
      `District: ${school.district || 'Srinagar'}`,
      `Academic Session: ${school.academicSession}`,
      `Exported On: ${new Date().toISOString().slice(0, 10)}`,
    ]);
    pushRow([]);

    // Section 1: Service Book & Teacher Profile Records
    pushRow(['SECTION 1: TEACHER SERVICE BOOK & PROFILE RECORDS']);
    pushRow([
      'Employee ID (CPIS)',
      'Teacher Full Name',
      'Designation',
      'Subject Specialization',
      'Employment Status',
      'Employment Type',
      'Date of Birth',
      'Initial Appointment Date',
      'Dept Joining Date',
      'Present School Joining Date',
      'Calculated Retirement Date',
      'Casual Leave Balance',
      'Medical Leave Balance',
      'Earned Leave Balance',
      'Latest Remarks by HOI',
      'Contact Number',
      'Residential Address',
    ]);

    teachers.forEach((tc) => {
      const latestRec = getLatestAttendanceRecordForTeacher(tc);
      const retDate = tc.retirementDate || calculateJKRetirementDate(tc.dob || '1984-05-15').retirementDate;
      pushRow([
        tc.employeeId,
        tc.name,
        latestRec?.designation || tc.designation,
        tc.subjectSpecialization || 'General',
        tc.employmentStatus || 'Regular',
        tc.employmentType || 'Permanent (Non-Gazetted)',
        tc.dob || '',
        tc.dateOfInitialAppointment || '',
        tc.dateOfJoiningDepartment || tc.dateOfJoining || '',
        tc.dateOfJoiningPresentSchool || '',
        retDate,
        tc.casualLeaveBalance,
        tc.medicalLeaveBalance,
        tc.earnedLeaveBalance,
        latestRec?.remarksByHoi ?? latestRec?.remarks ?? tc.latestHoiRemarks ?? '',
        tc.contactNumber || '',
        tc.residentialAddress || '',
      ]);
    });

    pushRow([]);
    // Section 2: Date-Wise Teacher Attendance History
    pushRow(['SECTION 2: TEACHER ATTENDANCE HISTORY (DATE-WISE)']);
    pushRow([
      'Date',
      'Employee ID (CPIS)',
      'Teacher Full Name',
      'Designation',
      'Attendance Status',
      'Arrival Time',
      'Departure Time',
      'Remarks by HOI',
      'Last Updated By',
      'Last Updated At',
      'Change Log Count',
    ]);

    const sortedAttendanceHistory = [...teacherAttendance].sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date);
      if (dateCmp !== 0) return dateCmp;
      return (a.teacherName || '').localeCompare(b.teacherName || '');
    });

    if (sortedAttendanceHistory.length > 0) {
      sortedAttendanceHistory.forEach((rec) => {
        const matchedTeacher = teachers.find((tc) => tc.id === rec.teacherId);
        pushRow([
          rec.date,
          rec.employeeId || matchedTeacher?.employeeId || '',
          rec.teacherName || matchedTeacher?.name || '',
          rec.designation || matchedTeacher?.designation || '',
          rec.status || 'Present',
          rec.checkInTime || '09:00 AM',
          rec.checkOutTime || '04:00 PM',
          rec.remarksByHoi ?? rec.remarks ?? '',
          rec.updatedBy || 'HOI',
          rec.updatedAt || '',
          rec.changeHistory ? rec.changeHistory.length : 0,
        ]);
      });
    } else {
      teachers.forEach((tc) => {
        pushRow([
          attendanceDate,
          tc.employeeId,
          tc.name,
          tc.designation,
          'Present',
          '09:00 AM',
          '04:00 PM',
          tc.latestHoiRemarks || '',
          currentUser.name,
          new Date().toISOString(),
          0,
        ]);
      });
    }

    const csvBlob = new Blob([`\uFEFF${lines.join('\r\n')}`], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(csvBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Teacher_Attendance_Service_Records_${school.code || 'School'}_${attendanceDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Teacher attendance history & service records exported as CSV!');
  };

  // Per-field inline Edit / Save / Cancel State for Attendance & Service Book Daily Register
  type EditableAttendanceField =
    | 'arrivalTime'
    | 'departureTime'
    | 'designation'
    | 'status'
    | 'remarksByHoi';

  const [editingAttendanceField, setEditingAttendanceField] = useState<{
    teacherId: string;
    field: EditableAttendanceField;
  } | null>(null);
  const [draftArrival24, setDraftArrival24] = useState<string>('09:00');
  const [draftDeparture24, setDraftDeparture24] = useState<string>('16:00');
  const [draftDesignationSelect, setDraftDesignationSelect] = useState<string>('');
  const [draftDesignationCustom, setDraftDesignationCustom] = useState<string>('');
  const [draftAttendanceStatus, setDraftAttendanceStatus] = useState<TeacherAttendanceStatus>('Present');
  const [draftHoiRemarks, setDraftHoiRemarks] = useState<string>('');
  const [expandedHistoryTeacherId, setExpandedHistoryTeacherId] = useState<string | null>(null);
  const [openStatusDropdownTeacherId, setOpenStatusDropdownTeacherId] = useState<string | null>(null);
  const [isFilterStatusDropdownOpen, setIsFilterStatusDropdownOpen] = useState<boolean>(false);

  // Service Book HOI Remarks inline editor state
  const [isEditingServiceBookHoiRemarks, setIsEditingServiceBookHoiRemarks] = useState<boolean>(false);
  const [serviceBookHoiRemarksDraft, setServiceBookHoiRemarksDraft] = useState<string>('');

  const getAttendanceRecordForDate = (tc: TeacherProfile, dateIso: string): TeacherAttendanceRecord | undefined =>
    teacherAttendance.find((r) => r.teacherId === tc.id && r.date === dateIso);

  const getLatestAttendanceRecordForTeacher = (tc: TeacherProfile): TeacherAttendanceRecord | undefined =>
    teacherAttendance
      .filter((r) => r.teacherId === tc.id)
      .sort((a, b) => b.date.localeCompare(a.date))[0];

  const startEditingAttendanceField = (tc: TeacherProfile, field: EditableAttendanceField) => {
    if (!isAdminUser) {
      showToast('Only Head of Institution / Authorized Admin can edit attendance fields.');
      return;
    }
    const rec = getAttendanceRecordForDate(tc, attendanceDate);
    if (field === 'arrivalTime') {
      setDraftArrival24(parseTo24HourTime(rec?.checkInTime, '09:00'));
    } else if (field === 'departureTime') {
      setDraftDeparture24(parseTo24HourTime(rec?.checkOutTime, '16:00'));
    } else if (field === 'designation') {
      const currentDesig = (rec?.designation || tc.designation || '').trim();
      if (STANDARD_TEACHER_DESIGNATIONS.includes(currentDesig)) {
        setDraftDesignationSelect(currentDesig);
        setDraftDesignationCustom('');
      } else {
        setDraftDesignationSelect('__CUSTOM__');
        setDraftDesignationCustom(currentDesig);
      }
    } else if (field === 'status') {
      const rawStatus = rec?.status || 'Present';
      if (rawStatus === 'On Leave' || rawStatus === 'Leave') {
        setDraftAttendanceStatus('Casual Leave (CL)');
      } else if (rawStatus === 'Official Duty' || rawStatus === 'On_Duty') {
        setDraftAttendanceStatus('On Duty (OD)');
      } else if (rawStatus === 'Late') {
        setDraftAttendanceStatus('Late Arrival');
      } else {
        setDraftAttendanceStatus(rawStatus);
      }
    } else if (field === 'remarksByHoi') {
      setDraftHoiRemarks(rec?.remarksByHoi ?? rec?.remarks ?? tc.latestHoiRemarks ?? '');
    }
    setEditingAttendanceField({ teacherId: tc.id, field });
  };

  const cancelEditingAttendanceField = () => {
    setEditingAttendanceField(null);
  };

  const saveEditingAttendanceField = (tc: TeacherProfile, field: EditableAttendanceField) => {
    if (!onSaveTeacherAttendance || !isAdminUser) return;
    const existing = getAttendanceRecordForDate(tc, attendanceDate);
    const nowIso = new Date().toISOString();
    const actorRole = effectiveRole || currentUser.role || 'admin';
    const baseRecord: TeacherAttendanceRecord = {
      id: existing ? existing.id : `att-${tc.id}-${attendanceDate}`,
      date: attendanceDate,
      teacherId: tc.id,
      employeeId: tc.employeeId,
      teacherName: tc.name,
      designation: existing?.designation || tc.designation,
      status: existing?.status || 'Present',
      checkInTime: existing?.checkInTime || '09:00 AM',
      checkOutTime: existing?.checkOutTime || '04:00 PM',
      checkInLocation: existing?.checkInLocation,
      remarks: existing?.remarks || '',
      remarksByHoi: existing?.remarksByHoi ?? existing?.remarks ?? tc.latestHoiRemarks ?? '',
      changeHistory: existing?.changeHistory ? [...existing.changeHistory] : [],
      updatedAt: nowIso,
      updatedBy: currentUser.name,
    };

    let fieldLabel: TeacherAttendanceChangeLogEntry['field'] = 'Attendance Status';
    let previousValue = '';
    let newValue = '';

    if (field === 'arrivalTime') {
      fieldLabel = 'Arrival Time';
      previousValue = baseRecord.checkInTime || 'Not Set';
      newValue = formatTo12HourAmPm(draftArrival24);
      baseRecord.checkInTime = newValue;
    } else if (field === 'departureTime') {
      fieldLabel = 'Departure Time';
      previousValue = baseRecord.checkOutTime || 'Not Set';
      newValue = formatTo12HourAmPm(draftDeparture24);
      baseRecord.checkOutTime = newValue;
    } else if (field === 'designation') {
      const resolvedDesig =
        draftDesignationSelect === '__CUSTOM__'
          ? draftDesignationCustom.trim()
          : draftDesignationSelect.trim();
      if (!resolvedDesig) {
        showToast('Please select or enter a valid designation before saving.');
        return;
      }
      fieldLabel = 'Designation';
      previousValue = baseRecord.designation || tc.designation;
      newValue = resolvedDesig;
      baseRecord.designation = resolvedDesig;
      // Persist permanently to Teacher Profile & Service Book Register
      onUpdateTeacher({
        ...tc,
        designation: resolvedDesig,
        updatedAt: nowIso,
      });
    } else if (field === 'status') {
      fieldLabel = 'Attendance Status';
      previousValue = baseRecord.status;
      newValue = draftAttendanceStatus;
      baseRecord.status = draftAttendanceStatus;
    } else if (field === 'remarksByHoi') {
      fieldLabel = 'Remarks by HOI';
      previousValue = (baseRecord.remarksByHoi || '').trim() || '—';
      newValue = draftHoiRemarks.trim();
      baseRecord.remarksByHoi = newValue;
      baseRecord.remarks = newValue;
      // Sync latest HOI remarks to Teacher Profile & Service Book Register
      onUpdateTeacher({
        ...tc,
        latestHoiRemarks: newValue,
        latestHoiRemarksUpdatedAt: nowIso,
        updatedAt: nowIso,
      });
    }

    const logEntry: TeacherAttendanceChangeLogEntry = {
      id: `chg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      field: fieldLabel,
      previousValue,
      newValue: newValue || '—',
      changedBy: currentUser.name,
      changedByRole: actorRole,
      changedAt: nowIso,
    };

    baseRecord.changeHistory = [logEntry, ...(baseRecord.changeHistory || [])].slice(0, 50);
    onSaveTeacherAttendance(baseRecord);
    setEditingAttendanceField(null);
    showToast(`${fieldLabel} saved for ${tc.name} (${attendanceDate})!`);
  };

  // Bulk Mark All Present
  const handleBulkMarkAllPresent = () => {
    if (!onSaveTeacherAttendance) return;
    const nowIso = new Date().toISOString();
    let count = 0;
    teachers.forEach((tc) => {
      const existing = getAttendanceRecordForDate(tc, attendanceDate);
      const rec: TeacherAttendanceRecord = {
        id: existing ? existing.id : `att-${tc.id}-${attendanceDate}`,
        date: attendanceDate,
        teacherId: tc.id,
        employeeId: tc.employeeId,
        teacherName: tc.name,
        designation: existing?.designation || tc.designation,
        status: 'Present',
        checkInTime: existing?.checkInTime || '09:00 AM',
        checkOutTime: existing?.checkOutTime || '04:00 PM',
        remarks: existing?.remarks || 'Bulk marked Present by HOI',
        remarksByHoi: existing?.remarksByHoi ?? existing?.remarks ?? tc.latestHoiRemarks ?? '',
        updatedAt: nowIso,
        updatedBy: currentUser.name,
        changeHistory: [
          {
            id: `chg-bulk-${Date.now()}-${count}`,
            field: 'Attendance Status' as const,
            previousValue: existing?.status || 'Unmarked',
            newValue: 'Present',
            changedBy: currentUser.name,
            changedByRole: effectiveRole || currentUser.role || 'admin',
            changedAt: nowIso,
          },
          ...(existing?.changeHistory || []),
        ].slice(0, 50),
      };
      onSaveTeacherAttendance(rec);
      count++;
    });
    showToast(`Successfully marked all ${count} teachers as Present for ${attendanceDate}!`);
  };

  // Single Teacher Attendance Quick Status update (preserves times, designation, HOI remarks & audit log)
  const handleSetSingleTeacherStatus = (tc: TeacherProfile, status: TeacherAttendanceStatus) => {
    if (!onSaveTeacherAttendance) return;
    const existing = getAttendanceRecordForDate(tc, attendanceDate);
    const nowIso = new Date().toISOString();
    const rec: TeacherAttendanceRecord = {
      id: existing ? existing.id : `att-${tc.id}-${attendanceDate}`,
      date: attendanceDate,
      teacherId: tc.id,
      employeeId: tc.employeeId,
      teacherName: tc.name,
      designation: existing?.designation || tc.designation,
      status,
      checkInTime: existing?.checkInTime || '09:00 AM',
      checkOutTime: existing?.checkOutTime || '04:00 PM',
      remarks: existing?.remarks || '',
      remarksByHoi: existing?.remarksByHoi ?? existing?.remarks ?? tc.latestHoiRemarks ?? '',
      checkInLocation: existing?.checkInLocation,
      updatedAt: nowIso,
      updatedBy: currentUser.name,
      changeHistory: [
        {
          id: `chg-qs-${Date.now()}`,
          field: 'Attendance Status' as const,
          previousValue: existing?.status || 'Present',
          newValue: status,
          changedBy: currentUser.name,
          changedByRole: effectiveRole || currentUser.role || 'admin',
          changedAt: nowIso,
        },
        ...(existing?.changeHistory || []),
      ].slice(0, 50),
    };
    onSaveTeacherAttendance(rec);
    showToast(`Attendance Status updated to "${status}" for ${tc.name} (${attendanceDate}).`);
  };

  // Print Daily Attendance Sheet
  const handlePrintDailyAttendance = () => {
    window.print();
  };

  // Attendance Statistics for selected date
  const selectedDateRecords = useMemo(() => {
    return teacherAttendance.filter((r) => r.date === attendanceDate);
  }, [teacherAttendance, attendanceDate]);

  const attPresentCount = selectedDateRecords.filter(
    (r) => r.status === 'Present' || r.status === 'Half Day' || r.status === 'Late Arrival' || r.status === 'Late'
  ).length;
  const attAbsentCount = selectedDateRecords.filter((r) => r.status === 'Absent').length;
  const attLeaveCount = selectedDateRecords.filter(
    (r) =>
      r.status === 'Casual Leave (CL)' ||
      r.status === 'Medical Leave (ML)' ||
      r.status === 'Leave' ||
      r.status === 'On Leave'
  ).length;
  const attDutyCount = selectedDateRecords.filter(
    (r) => r.status === 'On Duty (OD)' || r.status === 'Official Duty' || r.status === 'On_Duty'
  ).length;

  const filteredAttendanceTeachers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return teachers.filter((tc) => {
      if (q) {
        const matchesQuery =
          tc.name.toLowerCase().includes(q) ||
          (tc.employeeId || '').toLowerCase().includes(q) ||
          (tc.designation || '').toLowerCase().includes(q);
        if (!matchesQuery) return false;
      }
      if (attendanceFilterStatus === 'all') return true;
      const rec = teacherAttendance.find((r) => r.teacherId === tc.id && r.date === attendanceDate);
      const st = rec?.status || 'Present';
      return st === attendanceFilterStatus;
    });
  }, [teachers, teacherAttendance, attendanceDate, attendanceFilterStatus, searchTerm]);

  const filteredServiceBookTeachers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter(
      (tc) =>
        tc.name.toLowerCase().includes(q) ||
        (tc.employeeId || '').toLowerCase().includes(q) ||
        (tc.designation || '').toLowerCase().includes(q)
    );
  }, [teachers, searchTerm]);

  return (
    <div className="space-y-6">
      
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold border border-slate-700 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Banner */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-mono font-extrabold uppercase border border-indigo-200">
              JKHRMS + JKEPM PORTAL INTEGRATION
            </span>
            <span className="text-xs text-slate-500 font-mono">
              {school.name} • {school.district || 'Srinagar'} • U-DISE {school.code}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2 mt-1">
            <GraduationCap className="w-7 h-7 text-indigo-600" />
            <span>Teacher Management & Service Book Register</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Comprehensive JKHRMS service profiles, dynamic 60-year retirement calculation, printable e-Service Book, JKEPM quarterly records & daily faculty roll-calls.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {activeSubTab === 'jkhrms' && (
            <button
              onClick={exportJkhrmsToExcel}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100 transition-colors shadow-2xs"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Export JKHRMS (Excel)</span>
            </button>
          )}

          {activeSubTab === 'jkepm' && (
            <button
              onClick={exportJkEpmToExcel}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100 transition-colors shadow-2xs"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Export JKEPM Register</span>
            </button>
          )}

          {activeSubTab === 'attendance' && (
            <>
              <button
                onClick={handlePrintDailyAttendance}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200 transition-colors shadow-2xs"
              >
                <Printer className="w-4 h-4 text-slate-600" />
                <span>Print Sheet</span>
              </button>
              <button
                onClick={exportDailyTeacherAttendance}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100 transition-colors shadow-2xs"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Export Attendance</span>
              </button>
            </>
          )}

          {activeSubTab === 'service-book' && (
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-md shadow-indigo-600/30"
            >
              <Printer className="w-4 h-4" />
              <span>Print Official Service Book</span>
            </button>
          )}

          <button
            type="button"
            onClick={exportTeacherAttendanceAndServiceCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold bg-teal-50 text-teal-800 border border-teal-300 hover:bg-teal-100 transition-colors shadow-2xs"
          >
            <Download className="w-4 h-4 text-teal-700" />
            <span>Export CSV</span>
          </button>

          {isAdminUser && (
            <button
              onClick={() => openModalForTeacher()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-md shadow-indigo-600/30"
            >
              <Plus className="w-4 h-4" />
              <span>Add Teacher / Account</span>
            </button>
          )}
        </div>
      </div>

      {/* 4 Statutory Sub-Tabs Navigation */}
      <div className="flex flex-wrap rounded-2xl bg-white p-1.5 border border-slate-200/90 shadow-sm text-xs font-bold gap-1.5 no-print">
        <button
          onClick={() => setActiveSubTab('jkhrms')}
          className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-2 ${
            activeSubTab === 'jkhrms'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          <span>1. JKHRMS Teacher Management</span>
          <span className="px-1.5 py-0.2 rounded-md bg-white/20 text-[10px] font-mono">
            {teachers.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('service-book')}
          className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-2 ${
            activeSubTab === 'service-book'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <BookOpen className="w-4 h-4 text-amber-400" />
          <span>2. Teacher Service Book (e-Book)</span>
          <span className="px-1.5 py-0.2 rounded-md bg-amber-500/20 text-amber-200 text-[10px] font-mono">
            Official
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('jkepm')}
          className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-2 ${
            activeSubTab === 'jkepm'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          <span>3. JKEPM Records & Ratings</span>
          <span className="px-1.5 py-0.2 rounded-md bg-emerald-500/20 text-emerald-200 text-[10px] font-mono">
            Quarterly
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('attendance')}
          className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-2 ${
            activeSubTab === 'attendance'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Clock className="w-4 h-4 text-teal-400" />
          <span>4. Faculty Attendance</span>
          <span className="px-1.5 py-0.2 rounded-md bg-teal-500/20 text-teal-200 text-[10px] font-mono">
            Daily
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('duty-roster')}
          className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-2 ${
            activeSubTab === 'duty-roster'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-amber-400" />
          <span>5. Duty Roster & Points</span>
          <span className="px-1.5 py-0.2 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold">
            Weekly
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SUB-TAB 1: JKHRMS TEACHER MANAGEMENT & SERVICE RECORDS                   */}
      {/* ========================================================================= */}
      {activeSubTab === 'jkhrms' && (
        <div className="space-y-4">
          
          {/* Search & Filter Controls */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs no-print">
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[260px]">
              
              {/* Search Bar */}
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  aria-label="Search teachers by name or employee ID"
                  placeholder="Search teacher by Name or Employee ID (CPIS)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    aria-label="Clear teacher search"
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Status Filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-xl font-semibold text-slate-700 bg-slate-50"
              >
                <option value="all">All Statuses</option>
                <option value="Regular">Regular</option>
                <option value="Contract">Contract</option>
                <option value="Deputation">Deputation</option>
              </select>

              {/* Designation Filter */}
              <select
                value={filterDesignation}
                onChange={(e) => setFilterDesignation(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-xl font-semibold text-slate-700 bg-slate-50"
              >
                <option value="all">All Designations</option>
                <option value="Head Teacher">Head Teacher / HOI</option>
                <option value="Master">Master / TGT</option>
                <option value="Teacher">Teacher (General Line)</option>
              </select>

            </div>

            <div className="text-[11px] font-bold text-slate-500 font-mono">
              Showing {filteredTeachers.length} of {teachers.length} JKHRMS Faculty Records
            </div>
          </div>

          {/* JKHRMS Faculty Records Table */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white text-[11px] font-bold uppercase tracking-wider">
                    <th className="py-3.5 px-4">CPIS Code & Name</th>
                    <th className="py-3.5 px-4">Designation & Subject</th>
                    <th className="py-3.5 px-4">DOB & Calculated Age</th>
                    <th className="py-3.5 px-4">Dept Service (Y/M/D)</th>
                    <th className="py-3.5 px-4">Present School Tenure</th>
                    <th className="py-3.5 px-4">Retirement Date (J&K Rule)</th>
                    <th className="py-3.5 px-4">Appt Order No</th>
                    <th className="py-3.5 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTeachers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No teachers found matching your search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredTeachers.map((tc) => {
                      const ageInfo = calculateTeacherAge(tc.dob || '1984-05-15');
                      const deptService = calculateServiceDuration(tc.dateOfJoiningDepartment || tc.dateOfJoining);
                      const schoolTenure = calculateServiceDuration(tc.dateOfJoiningPresentSchool || '2022-04-01');
                      const retCalc = calculateJKRetirementDate(tc.dob || '1984-05-15');
                      const effectiveRetDate = tc.retirementDate || retCalc.retirementDate;

                      return (
                        <tr key={tc.id} className="hover:bg-slate-50 transition-colors">
                          
                          {/* CPIS & Name */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-extrabold text-slate-900 text-sm">{tc.name}</span>
                              <span
                                className={`px-1.5 py-0.2 rounded-full text-[9.5px] font-extrabold border ${
                                  (tc.accountStatus || 'Active') === 'Active'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-rose-50 text-rose-700 border-rose-200'
                                }`}
                              >
                                {tc.accountStatus || 'Active'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span className="px-1.5 py-0.2 rounded font-mono font-bold text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200">
                                {tc.employeeId}
                              </span>
                              <span className="text-[10px] text-slate-500">
                                {tc.gender || 'Male'} • {tc.employeeCategory || 'General'}
                              </span>
                              {tc.username && (
                                <span className="text-[10px] font-mono text-slate-500">@{tc.username}</span>
                              )}
                            </div>
                            {tc.assignedClasses && tc.assignedClasses.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {tc.assignedClasses.slice(0, 3).map((ac, i) => (
                                  <span
                                    key={i}
                                    className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 text-[9.5px] font-semibold border border-slate-200"
                                  >
                                    {ac.classNumber}-{ac.section}: {ac.subject}
                                  </span>
                                ))}
                                {tc.assignedClasses.length > 3 && (
                                  <span className="text-[9.5px] text-slate-400 font-bold">
                                    +{tc.assignedClasses.length - 3} more
                                  </span>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Designation & Subject */}
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-800">{tc.designation}</div>
                            <div className="text-[11px] text-indigo-600 font-semibold mt-0.5">
                              {tc.subjectSpecialization || 'General Curriculum'}
                            </div>
                            {tc.qualifications && (
                              <div className="text-[10px] text-slate-500 mt-0.5">{tc.qualifications}</div>
                            )}
                          </td>

                          {/* DOB & Age */}
                          <td className="py-3.5 px-4">
                            <div className="font-mono text-slate-700 font-semibold">{tc.dob || '—'}</div>
                            <div className="text-[10.5px] font-bold text-slate-500 font-mono mt-0.5">
                              {ageInfo.formatted}
                            </div>
                          </td>

                          {/* Dept Service */}
                          <td className="py-3.5 px-4">
                            <div className="font-mono text-slate-700 text-[11px]">
                              Joined: {tc.dateOfJoiningDepartment || tc.dateOfJoining}
                            </div>
                            <div className="text-[11px] font-extrabold text-emerald-700 font-mono mt-0.5">
                              {deptService.formatted}
                            </div>
                          </td>

                          {/* Present School Tenure */}
                          <td className="py-3.5 px-4">
                            <div className="font-mono text-slate-700 text-[11px]">
                              Since: {tc.dateOfJoiningPresentSchool || '2022-04-01'}
                            </div>
                            <div className="text-[11px] font-bold text-indigo-700 font-mono mt-0.5">
                              {schoolTenure.formatted}
                            </div>
                          </td>

                          {/* Retirement Date */}
                          <td className="py-3.5 px-4">
                            <div className="font-mono font-extrabold text-slate-900 text-xs">
                              {effectiveRetDate}
                            </div>
                            <div className="mt-1">
                              <span
                                title={retCalc.explanation}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300"
                              >
                                <span>J&amp;K 60-Yr Rule</span>
                                <span className="text-amber-600 font-mono text-[9px]">✓</span>
                              </span>
                            </div>
                          </td>

                          {/* Appt Order */}
                          <td className="py-3.5 px-4">
                            <span className="font-mono text-[10.5px] text-slate-600 block truncate max-w-[140px]" title={tc.appointmentOrderNumber}>
                              {tc.appointmentOrderNumber || '—'}
                            </span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">
                              {tc.employmentType || 'Regular'}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1 flex-wrap">
                              <button
                                onClick={() => setViewingTeacherProfile(tc)}
                                title="View Teacher Profile"
                                className="p-1.5 rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 transition-colors"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedServiceBookTeacherId(tc.id);
                                  setActiveSubTab('service-book');
                                }}
                                title="View e-Service Book"
                                className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
                              >
                                <BookOpen className="w-4 h-4" />
                              </button>
                              
                              <button
                                onClick={() => handleOpenEditTeacherAddress(tc)}
                                title="Edit Residential Address"
                                className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                              >
                                <MapPin className="w-4 h-4" />
                              </button>
                              
                              {isAdminUser && (
                                <>
                                  <button
                                    onClick={() => openModalForTeacher(tc)}
                                    title="Edit Teacher Profile & Classes"
                                    className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleToggleTeacherAccountStatus(tc)}
                                    title={(tc.accountStatus || 'Active') === 'Active' ? 'Deactivate Teacher Account' : 'Activate Teacher Account'}
                                    className={`p-1.5 rounded-lg transition-colors ${
                                      (tc.accountStatus || 'Active') === 'Active'
                                        ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                    }`}
                                  >
                                    <Power className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleOpenResetPassword(tc)}
                                    title="Reset Teacher Password (Admin Only)"
                                    className="p-1.5 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors"
                                  >
                                    <KeyRound className="w-4 h-4" />
                                  </button>
                                  {onDeleteTeacher && (
                                    <button
                                      onClick={() => handleDeleteTeacherRecord(tc)}
                                      title="Delete Teacher Record"
                                      className="p-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
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
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 2: TEACHER SERVICE BOOK (PRINTABLE OFFICIAL E-SERVICE BOOK)       */}
      {/* ========================================================================= */}
      {activeSubTab === 'service-book' && (
        <div className="space-y-4">
          
          {/* Teacher Selector Toolbar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs no-print">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="relative min-w-[210px] flex-1 max-w-xs">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  aria-label="Find teacher in Service Book by name or employee ID"
                  placeholder="Find by Teacher Name or Employee ID..."
                  value={searchTerm}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSearchTerm(val);
                    const q = val.trim().toLowerCase();
                    if (q) {
                      const firstMatch = teachers.find(
                        (tc) =>
                          tc.name.toLowerCase().includes(q) ||
                          (tc.employeeId || '').toLowerCase().includes(q)
                      );
                      if (firstMatch) setSelectedServiceBookTeacherId(firstMatch.id);
                    }
                  }}
                  className="w-full pl-9 pr-8 py-2 border border-slate-300 rounded-xl font-medium bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    aria-label="Clear Service Book search"
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <label className="font-bold text-slate-600 uppercase text-[11px] tracking-wider">
                  Service Book:
                </label>
                <select
                  value={selectedServiceBookTeacherId}
                  onChange={(e) => setSelectedServiceBookTeacherId(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-xl font-bold text-indigo-800 bg-indigo-50/50"
                >
                  {(filteredServiceBookTeachers.length > 0 ? filteredServiceBookTeachers : teachers).map((tc) => (
                    <option key={tc.id} value={tc.id}>
                      {tc.name} ({tc.employeeId} - {tc.designation})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={exportTeacherAttendanceAndServiceCsv}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold bg-teal-600 text-white hover:bg-teal-700 transition-all shadow-sm"
              >
                <Download className="w-4 h-4" />
                <span>Export CSV</span>
              </button>

              <button
                onClick={() => openModalForTeacher(selectedServiceBookTeacher)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold bg-amber-500 text-white hover:bg-amber-600 transition-all shadow-sm"
              >
                <Edit2 className="w-4 h-4" />
                <span>Edit Service Book & Teacher Details</span>
              </button>

              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-sm"
              >
                <Printer className="w-4 h-4" />
                <span>Print Official e-Service Book</span>
              </button>
            </div>
          </div>

          {/* Printable Official Service Book Ledger */}
          <div className="bg-white p-8 rounded-3xl border border-slate-300 shadow-lg text-slate-900 space-y-6 print:border-none print:shadow-none print:p-0">
            
            {/* Government of J&K Header */}
            <div className="border-b-2 border-slate-900 pb-5 text-center space-y-1">
              <div className="text-[11px] font-black uppercase tracking-widest text-slate-700">
                GOVERNMENT OF JAMMU AND KASHMIR
              </div>
              <div className="text-base sm:text-lg font-black uppercase text-slate-950 tracking-tight">
                DEPARTMENT OF SCHOOL EDUCATION • JKHRMS SERVICE RECORD
              </div>
              <div className="text-xs font-bold text-slate-600 font-mono">
                {school.name} • {formatSchoolAddressOnce(school)}
              </div>
              <div className="inline-block mt-2 px-3 py-1 bg-slate-900 text-white rounded-md text-[11px] font-mono font-black uppercase tracking-wider">
                OFFICIAL ELECTRONIC SERVICE BOOK (E-SERVICE BOOK)
              </div>
            </div>

            {/* PART I: Personal Details */}
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider bg-slate-100 p-2 rounded-lg border border-slate-200 flex items-center justify-between">
                <span>PART I: EMPLOYEE IDENTIFICATION & PERSONAL PARTICULARS</span>
                <span className="font-mono text-[10px] text-slate-500">JKHRMS Rule 102</span>
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div className="border p-2.5 rounded-xl bg-slate-50/50">
                  <span className="text-[10px] font-bold text-slate-500 block uppercase">Employee CPIS Code</span>
                  <span className="font-mono font-black text-indigo-700 text-sm">{selectedServiceBookTeacher.employeeId}</span>
                </div>
                <div className="border p-2.5 rounded-xl bg-slate-50/50">
                  <span className="text-[10px] font-bold text-slate-500 block uppercase">Full Name</span>
                  <span className="font-bold text-slate-900 text-sm">{selectedServiceBookTeacher.name}</span>
                </div>
                <div className="border p-2.5 rounded-xl bg-slate-50/50">
                  <span className="text-[10px] font-bold text-slate-500 block uppercase">Father's Name</span>
                  <span className="font-semibold text-slate-800">{selectedServiceBookTeacher.fatherName || selectedServiceBookTeacher.fatherSpouseName}</span>
                </div>
                <div className="border p-2.5 rounded-xl bg-slate-50/50">
                  <span className="text-[10px] font-bold text-slate-500 block uppercase">Mother's Name</span>
                  <span className="font-semibold text-slate-800">{selectedServiceBookTeacher.motherName || 'Amina Begum'}</span>
                </div>

                <div className="border p-2.5 rounded-xl bg-slate-50/50">
                  <span className="text-[10px] font-bold text-slate-500 block uppercase">Date of Birth</span>
                  <span className="font-mono font-bold text-slate-900">{selectedServiceBookTeacher.dob || '1984-05-15'}</span>
                </div>
                <div className="border p-2.5 rounded-xl bg-slate-50/50">
                  <span className="text-[10px] font-bold text-slate-500 block uppercase">Current Calculated Age</span>
                  <span className="font-mono font-bold text-slate-900">
                    {calculateTeacherAge(selectedServiceBookTeacher.dob || '1984-05-15').formatted}
                  </span>
                </div>
                <div className="border p-2.5 rounded-xl bg-slate-50/50">
                  <span className="text-[10px] font-bold text-slate-500 block uppercase">Gender & Category</span>
                  <span className="font-semibold text-slate-800">
                    {selectedServiceBookTeacher.gender || 'Male'} • {selectedServiceBookTeacher.employeeCategory || 'General'}
                  </span>
                </div>
                <div className="border p-2.5 rounded-xl bg-slate-50/50">
                  <span className="text-[10px] font-bold text-slate-500 block uppercase">Academic Qualifications</span>
                  <span className="font-semibold text-slate-800">{selectedServiceBookTeacher.qualifications}</span>
                </div>

                {/* Permanent Residential Address with Edit & Save Options */}
                <div className="col-span-2 sm:col-span-4 border border-emerald-200 p-3 rounded-2xl bg-emerald-50/40 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10.5px] font-bold text-emerald-900 uppercase flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-rose-500" />
                      <span>Permanent Residential Address (Standardized)</span>
                    </span>
                    {(currentUser.role === 'admin' || currentUser.role === 'head_teacher') && (
                      <button
                        onClick={() => handleOpenEditTeacherAddress(selectedServiceBookTeacher)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-emerald-800 bg-white hover:bg-emerald-100 border border-emerald-300 transition-colors shadow-2xs no-print active:scale-95"
                        title="Edit Teacher Address"
                      >
                        <Edit2 className="w-3 h-3 text-emerald-700" />
                        <span>Edit Address</span>
                      </button>
                    )}
                  </div>
                  <div className="text-xs font-semibold text-slate-900 bg-white p-2 rounded-xl border border-emerald-100">
                    {selectedServiceBookTeacher.residentialAddress || STANDARDIZED_ADDRESS}
                  </div>
                  <div className="text-[10px] text-emerald-800 font-mono flex items-center gap-2">
                    <span>District: <strong className="font-bold">{selectedServiceBookTeacher.district || 'Srinagar'}</strong></span>
                    <span>•</span>
                    <span>State: <strong>Jammu & Kashmir</strong></span>
                  </div>
                </div>
              </div>
            </div>

            {/* PART II: Service Timeline & Superannuation Details */}
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider bg-slate-100 p-2 rounded-lg border border-slate-200 flex items-center justify-between">
                <span>PART II: APPOINTMENT, POSTING HISTORY & SUPERANNUATION CALCULATION</span>
                <span className="font-mono text-[10px] text-slate-500">J&K CSR Rule 226 Compliant</span>
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                <div className="border p-2.5 rounded-xl bg-slate-50/50">
                  <span className="text-[10px] font-bold text-slate-500 block uppercase">Initial Appointment Date</span>
                  <span className="font-mono font-bold text-slate-900">{selectedServiceBookTeacher.dateOfInitialAppointment || selectedServiceBookTeacher.dateOfJoining}</span>
                </div>
                <div className="border p-2.5 rounded-xl bg-slate-50/50">
                  <span className="text-[10px] font-bold text-slate-500 block uppercase">Appointment Order Number</span>
                  <span className="font-mono font-bold text-slate-900">{selectedServiceBookTeacher.appointmentOrderNumber || 'DSEK/Estt/Appt-4412/10'}</span>
                </div>
                <div className="border p-2.5 rounded-xl bg-slate-50/50">
                  <span className="text-[10px] font-bold text-slate-500 block uppercase">Employment Status & Type</span>
                  <span className="font-semibold text-slate-800">
                    {selectedServiceBookTeacher.employmentStatus} • {selectedServiceBookTeacher.employmentType || 'Permanent'}
                  </span>
                </div>

                <div className="border p-2.5 rounded-xl bg-emerald-50/50 border-emerald-200">
                  <span className="text-[10px] font-bold text-emerald-800 block uppercase">Total Department Service</span>
                  <span className="font-mono font-black text-emerald-900 text-sm">
                    {calculateServiceDuration(selectedServiceBookTeacher.dateOfJoiningDepartment || selectedServiceBookTeacher.dateOfJoining).formatted}
                  </span>
                </div>
                <div className="border p-2.5 rounded-xl bg-indigo-50/50 border-indigo-200">
                  <span className="text-[10px] font-bold text-indigo-800 block uppercase">Tenure in Present School ({school.villageTown || 'Pamposh Colony'})</span>
                  <span className="font-mono font-black text-indigo-900 text-sm">
                    {calculateServiceDuration(selectedServiceBookTeacher.dateOfJoiningPresentSchool || '2022-04-01').formatted}
                  </span>
                </div>
                <div className="border p-2.5 rounded-xl bg-amber-50/50 border-amber-200">
                  <span className="text-[10px] font-bold text-amber-900 block uppercase">Calculated Retirement Date (60 Years)</span>
                  <span className="font-mono font-black text-amber-950 text-sm">
                    {selectedServiceBookTeacher.retirementDate || calculateJKRetirementDate(selectedServiceBookTeacher.dob || '1984-05-15').retirementDate}
                  </span>
                  <span className="text-[9.5px] text-amber-700 block mt-0.5">
                    {calculateJKRetirementDate(selectedServiceBookTeacher.dob || '1984-05-15').explanation}
                  </span>
                </div>
              </div>
            </div>

            {/* PART III: Leave Account Ledger */}
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider bg-slate-100 p-2 rounded-lg border border-slate-200">
                PART III: STATUTORY LEAVE ACCOUNT & BALANCES
              </h3>

              <div className="grid grid-cols-3 gap-4 text-xs">
                <div className="p-3 rounded-xl border border-blue-200 bg-blue-50/50 text-center">
                  <span className="text-[10px] font-bold text-blue-700 uppercase block">Casual Leave (CL)</span>
                  <span className="text-2xl font-black text-blue-900 font-mono">{selectedServiceBookTeacher.casualLeaveBalance}</span>
                  <span className="text-[10px] text-blue-600 block mt-0.5">Days Balance</span>
                </div>
                <div className="p-3 rounded-xl border border-teal-200 bg-teal-50/50 text-center">
                  <span className="text-[10px] font-bold text-teal-700 uppercase block">Medical Leave (ML)</span>
                  <span className="text-2xl font-black text-teal-900 font-mono">{selectedServiceBookTeacher.medicalLeaveBalance}</span>
                  <span className="text-[10px] text-teal-600 block mt-0.5">Days Balance</span>
                </div>
                <div className="p-3 rounded-xl border border-purple-200 bg-purple-50/50 text-center">
                  <span className="text-[10px] font-bold text-purple-700 uppercase block">Earned Leave (EL)</span>
                  <span className="text-2xl font-black text-purple-900 font-mono">{selectedServiceBookTeacher.earnedLeaveBalance}</span>
                  <span className="text-[10px] text-purple-600 block mt-0.5">Days Balance</span>
                </div>
              </div>
            </div>

            {/* PART III-B: HOI Remarks & Latest Daily Attendance / Service Record */}
            {(() => {
              const latestRec = getLatestAttendanceRecordForTeacher(selectedServiceBookTeacher);
              const displayedHoiRemarks =
                latestRec?.remarksByHoi ??
                latestRec?.remarks ??
                selectedServiceBookTeacher.latestHoiRemarks ??
                '';
              return (
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider bg-slate-100 p-2 rounded-lg border border-slate-200 flex items-center justify-between">
                    <span>PART III-B: REMARKS BY HOI (HEAD OF INSTITUTION) &amp; DAILY ATTENDANCE SNAPSHOT</span>
                    <span className="font-mono text-[10px] text-slate-500">
                      {latestRec ? `Latest Record: ${latestRec.date}` : `Date: ${attendanceDate}`}
                    </span>
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="border p-2.5 rounded-xl bg-slate-50/60">
                      <span className="text-[10px] font-bold text-slate-500 block uppercase">Current Designation</span>
                      <span className="font-bold text-slate-900">
                        {latestRec?.designation || selectedServiceBookTeacher.designation}
                      </span>
                    </div>
                    <div className="border p-2.5 rounded-xl bg-slate-50/60">
                      <span className="text-[10px] font-bold text-slate-500 block uppercase">Latest Attendance Status</span>
                      <span className="font-bold text-indigo-800">{latestRec?.status || 'Present'}</span>
                    </div>
                    <div className="border p-2.5 rounded-xl bg-slate-50/60">
                      <span className="text-[10px] font-bold text-slate-500 block uppercase">Arrival Time</span>
                      <span className="font-mono font-bold text-slate-900">{latestRec?.checkInTime || '09:00 AM'}</span>
                    </div>
                    <div className="border p-2.5 rounded-xl bg-slate-50/60">
                      <span className="text-[10px] font-bold text-slate-500 block uppercase">Departure Time</span>
                      <span className="font-mono font-bold text-slate-900">{latestRec?.checkOutTime || '04:00 PM'}</span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl border border-amber-200 bg-amber-50/40 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10.5px] font-black uppercase text-amber-900 tracking-wider">
                        Remarks by HOI (Head of Institution)
                      </span>
                      {isAdminUser && !isEditingServiceBookHoiRemarks && (
                        <button
                          type="button"
                          onClick={() => {
                            setServiceBookHoiRemarksDraft(displayedHoiRemarks);
                            setIsEditingServiceBookHoiRemarks(true);
                          }}
                          className="no-print inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold"
                        >
                          <Edit2 className="w-3 h-3" /> Edit HOI Remarks
                        </button>
                      )}
                    </div>

                    {isEditingServiceBookHoiRemarks ? (
                      <div className="space-y-2 no-print">
                        <textarea
                          rows={3}
                          value={serviceBookHoiRemarksDraft}
                          onChange={(e) => setServiceBookHoiRemarksDraft(e.target.value)}
                          placeholder="Enter official administrative remarks, late arrival explanation, duty note, or HOI observation..."
                          className="w-full p-2.5 rounded-xl border border-amber-300 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                        />
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setIsEditingServiceBookHoiRemarks(false)}
                            className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const targetDate = latestRec?.date || attendanceDate;
                              const nowIso = new Date().toISOString();
                              const cleanText = serviceBookHoiRemarksDraft.trim();
                              onUpdateTeacher({
                                ...selectedServiceBookTeacher,
                                latestHoiRemarks: cleanText,
                                latestHoiRemarksUpdatedAt: nowIso,
                                updatedAt: nowIso,
                              });
                              if (onSaveTeacherAttendance) {
                                onSaveTeacherAttendance({
                                  id: latestRec ? latestRec.id : `att-${selectedServiceBookTeacher.id}-${targetDate}`,
                                  date: targetDate,
                                  teacherId: selectedServiceBookTeacher.id,
                                  employeeId: selectedServiceBookTeacher.employeeId,
                                  teacherName: selectedServiceBookTeacher.name,
                                  designation: latestRec?.designation || selectedServiceBookTeacher.designation,
                                  status: latestRec?.status || 'Present',
                                  checkInTime: latestRec?.checkInTime || '09:00 AM',
                                  checkOutTime: latestRec?.checkOutTime || '04:00 PM',
                                  remarks: cleanText,
                                  remarksByHoi: cleanText,
                                  updatedAt: nowIso,
                                  updatedBy: currentUser.name,
                                  changeHistory: [
                                    {
                                      id: `chg-sb-${Date.now()}`,
                                      field: 'Remarks by HOI' as const,
                                      previousValue: displayedHoiRemarks || '—',
                                      newValue: cleanText || '—',
                                      changedBy: currentUser.name,
                                      changedByRole: effectiveRole || currentUser.role || 'admin',
                                      changedAt: nowIso,
                                    },
                                    ...(latestRec?.changeHistory || []),
                                  ].slice(0, 50),
                                });
                              }
                              setIsEditingServiceBookHoiRemarks(false);
                              showToast(`Remarks by HOI saved for ${selectedServiceBookTeacher.name}!`);
                            }}
                            className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                          >
                            <Save className="w-3.5 h-3.5" /> Save Remarks
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                        {displayedHoiRemarks || 'No HOI remarks recorded yet. Click "Edit HOI Remarks" to add administrative comments or duty notes.'}
                      </p>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* PART IV: Official Verification & Attestation */}
            <div className="pt-6 border-t-2 border-slate-900 grid grid-cols-2 gap-8 text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Attestation & Verification Status</span>
                <p className="mt-1 text-slate-700 leading-relaxed text-[11px]">
                  Certified that the above entries have been verified against original appointment orders, qualification degrees, matriculation certificate (date of birth), and official transfer records maintained under Jammu and Kashmir Human Resource Management System (JKHRMS).
                </p>
                <div className="mt-4 flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                    ✓ JKHRMS Verified
                  </span>
                  <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[10px] font-bold">
                    ✓ JKEPM Synced
                  </span>
                </div>
              </div>

              <div className="text-right flex flex-col justify-end">
                <div className="h-14 flex items-end justify-end">
                  <div className="border-b border-slate-900 w-48 text-center pb-1 font-serif italic text-xs text-slate-600">
                    {school.adminName || school.headmasterName || 'Mohd Yousuf Wani'}
                  </div>
                </div>
                <span className="font-bold text-slate-900 text-xs block">Admin</span>
                <span className="text-[11px] text-slate-500 block">
                  Head of Institution • {school.name}
                </span>
                <span className="text-[10px] text-slate-400 block font-mono">
                  District {school.district || 'Srinagar'}, {school.state || 'Jammu & Kashmir'}
                </span>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 3: JKEPM TEACHER AND SCHOOL RECORDS                               */}
      {/* ========================================================================= */}
      {activeSubTab === 'jkepm' && (
        <div className="space-y-4">
          
          {/* JKEPM Overview Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">School JKEPM Rating</span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-emerald-700 font-mono">9.3</span>
                <span className="text-xs text-slate-400">/ 10</span>
              </div>
              <span className="text-[10.5px] text-emerald-600 font-semibold block mt-1">Outstanding Faculty Rating</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Quarterly Submissions</span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-indigo-700 font-mono">Q1, Q2, Q3</span>
              </div>
              <span className="text-[10.5px] text-indigo-600 font-semibold block mt-1">Session {school.academicSession}</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Remedial Sessions Held</span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-amber-700 font-mono">48</span>
                <span className="text-xs text-slate-400">classes</span>
              </div>
              <span className="text-[10.5px] text-amber-700 font-semibold block mt-1">For Grade D/E Students</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Verification Compliance</span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-purple-700 font-mono">100%</span>
              </div>
              <span className="text-[10.5px] text-purple-700 font-semibold block mt-1">Admin & ZEO Approved</span>
            </div>
          </div>

          {/* JKEPM Records Table */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider">
                  JKEPM Quarterly Self-Assessment & Appraisal Submissions
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Official submissions pursuant to J&K Employee Performance Monitoring portal guidelines
                </p>
              </div>

              <button
                onClick={exportJkEpmToExcel}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 shadow-2xs"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                <span>Download JKEPM Dataset</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white text-[11px] font-bold uppercase tracking-wider">
                    <th className="py-3.5 px-4">Teacher & CPIS</th>
                    <th className="py-3.5 px-4">Quarter</th>
                    <th className="py-3.5 px-4">Score (/10)</th>
                    <th className="py-3.5 px-4">Syllabus Covered</th>
                    <th className="py-3.5 px-4">Remedial Classes</th>
                    <th className="py-3.5 px-4">Status & Verified By</th>
                    <th className="py-3.5 px-4">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {teachers.map((tc) => {
                    const score = tc.jkepmScore || (tc.designation.includes('Head') ? 9.6 : 9.2);
                    return (
                      <tr key={tc.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-extrabold text-slate-900">{tc.name}</div>
                          <div className="font-mono text-[10px] text-slate-500">{tc.employeeId} • {tc.designation}</div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold text-[11px] border border-indigo-200">
                            Q1 & Q2 (Apr - Sep)
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="font-mono font-black text-emerald-700 text-sm">
                            {score}
                          </span>
                          <span className="text-[10px] text-slate-400"> / 10</span>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="w-24 bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div className="bg-emerald-600 h-2 rounded-full" style={{ width: '92%' }}></div>
                          </div>
                          <span className="text-[10.5px] font-mono font-bold text-slate-700 mt-1 block">92% Covered</span>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="font-mono font-bold text-slate-800">16 sessions</span>
                          <span className="text-[10px] text-slate-400 block">Class 5 & 8 Math</span>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold text-[10px] inline-flex items-center gap-1">
                            <span>✓ Verified</span>
                          </span>
                          <span className="text-[10px] text-slate-500 block mt-0.5">Admin / HOI ({school.adminName || 'Mohd Yousuf Wani'}) • {school.villageTown || 'Pamposh Colony'}</span>
                        </td>

                        <td className="py-3.5 px-4 text-slate-600 text-[11px]">
                          Excellent classroom turnouts and proactive remedial teaching.
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

      {/* ========================================================================= */}
      {/* SUB-TAB 4: MANUAL DAILY TEACHER ATTENDANCE                                */}
      {/* ========================================================================= */}
      {activeSubTab === 'attendance' && (
        <div className="space-y-4">
          
          {/* Date Picker, Teacher Search Bar, Color-Coded Status Filter & Quick Actions Toolbar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs no-print">
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[260px]">
              
              {/* Search Bar for Teacher Name or Employee ID */}
              <div className="relative flex-1 min-w-[210px] max-w-xs">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2" />
                <input
                  type="text"
                  aria-label="Search attendance register by teacher name or employee ID"
                  placeholder="Search teacher by Name or Employee ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-8 py-1.5 border border-slate-300 rounded-xl font-medium bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    aria-label="Clear search"
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Date Input */}
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-600" />
                <span className="font-bold text-slate-700">Date:</span>
                <input
                  type="date"
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                  className="px-3 py-1.5 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 bg-slate-50"
                />
              </div>

              {/* Color-Coded Status Filter Dropdown (All 8 Attendance Status Options) */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsFilterStatusDropdownOpen((prev) => !prev)}
                  className="inline-flex items-center justify-between gap-2 min-w-[190px] px-3 py-1.5 border border-slate-300 rounded-xl font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <span className="inline-flex items-center gap-2 truncate">
                    {attendanceFilterStatus === 'all' ? (
                      <>
                        <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-emerald-500 via-blue-500 to-rose-500 shrink-0" />
                        <span>All Attendance Statuses</span>
                      </>
                    ) : (
                      <>
                        <span
                          className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                            getAttendanceStatusMeta(attendanceFilterStatus).dotClass
                          }`}
                        />
                        <span>{attendanceFilterStatus}</span>
                      </>
                    )}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                </button>

                {isFilterStatusDropdownOpen && (
                  <div className="absolute left-0 mt-1.5 w-56 rounded-2xl bg-white border border-slate-200 shadow-xl z-40 py-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setAttendanceFilterStatus('all');
                        setIsFilterStatusDropdownOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-left text-xs font-bold flex items-center justify-between hover:bg-slate-50 ${
                        attendanceFilterStatus === 'all' ? 'bg-indigo-50 text-indigo-800' : 'text-slate-700'
                      }`}
                    >
                      <span className="inline-flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-emerald-500 via-blue-500 to-rose-500" />
                        <span>All Attendance Statuses</span>
                      </span>
                      {attendanceFilterStatus === 'all' && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                    </button>
                    {ATTENDANCE_STATUS_OPTIONS.map((opt) => {
                      const meta = getAttendanceStatusMeta(opt);
                      const isSelected = attendanceFilterStatus === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => {
                            setAttendanceFilterStatus(opt);
                            setIsFilterStatusDropdownOpen(false);
                          }}
                          className={`w-full px-3 py-2 text-left text-xs font-bold flex items-center justify-between hover:bg-slate-50 ${
                            isSelected ? 'bg-slate-100 text-slate-950' : 'text-slate-700'
                          }`}
                        >
                          <span className="inline-flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full ${meta.dotClass}`} />
                            <span>{opt}</span>
                          </span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleBulkMarkAllPresent}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-sm"
              >
                <Check className="w-4 h-4" />
                <span>Mark All Present</span>
              </button>

              <button
                type="button"
                onClick={exportTeacherAttendanceAndServiceCsv}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold bg-teal-600 text-white hover:bg-teal-700 transition-colors shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>

              <button
                onClick={exportDailyTeacherAttendance}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-800 border border-slate-300 hover:bg-slate-200 transition-colors"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                <span>Export Excel</span>
              </button>

              <button
                onClick={handlePrintDailyAttendance}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-800 border border-slate-300 hover:bg-slate-200 transition-colors"
              >
                <Printer className="w-3.5 h-3.5 text-indigo-700" />
                <span>Print Register</span>
              </button>

              <button
                onClick={() => setShowGpsPanel(!showGpsPanel)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>{showGpsPanel ? 'Hide Campus Geofence' : 'Campus Geofence (GPS)'}</span>
              </button>
            </div>
          </div>

          {/* Turnout Statistics Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl">
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Present / On Campus</span>
              <div className="mt-1 text-2xl font-black text-emerald-900 font-mono">
                {attPresentCount} / {teachers.length}
              </div>
              <span className="text-[10.5px] text-emerald-700 font-semibold block mt-0.5">
                {Math.round((attPresentCount / (teachers.length || 1)) * 100)}% Faculty Turnout
              </span>
            </div>

            <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-2xl">
              <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider block">Absent</span>
              <div className="mt-1 text-2xl font-black text-rose-900 font-mono">
                {attAbsentCount}
              </div>
              <span className="text-[10.5px] text-rose-700 font-semibold block mt-0.5">Marked Absent</span>
            </div>

            <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl">
              <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">Leave (CL / ML)</span>
              <div className="mt-1 text-2xl font-black text-amber-900 font-mono">
                {attLeaveCount}
              </div>
              <span className="text-[10.5px] text-amber-700 font-semibold block mt-0.5">Casual / Medical Leave</span>
            </div>

            <div className="bg-indigo-50 border border-indigo-200 p-3.5 rounded-2xl">
              <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider block">On Duty (OD)</span>
              <div className="mt-1 text-2xl font-black text-indigo-900 font-mono">
                {attDutyCount}
              </div>
              <span className="text-[10.5px] text-indigo-700 font-semibold block mt-0.5">Official / ZEO Duty</span>
            </div>
          </div>

          {/* GPS Campus Geofence Testing Panel (Optional) */}
          {showGpsPanel && (
            <div className="bg-white p-4 rounded-2xl border border-indigo-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-indigo-600" />
                  <span className="font-extrabold text-xs text-slate-900">Campus Geofenced Check-In Engine ({school.name})</span>
                </div>
                <span className="text-[11px] font-mono text-slate-500">
                  Radius: {geofenceRadius}m • Coordinates: {schoolLat}, {schoolLng}
                </span>
              </div>
              <p className="text-xs text-slate-600">
                School Location: {campusAddress}. Faculty can verify real device location before clocking in.
              </p>
            </div>
          )}

          {/* Daily Editable Attendance & Service Book Register (Per-Field Edit / Save / Cancel + Change Audit History) */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider">
                  Date-Wise Teacher Attendance &amp; Daily Service Register — {attendanceDate}
                </h3>
                <p className="text-[11px] text-slate-300">
                  Click the individual <strong>Edit</strong> button next to Arrival Time, Departure Time, Designation, Attendance Status, or Remarks by HOI to update &amp; save permanently with full audit history.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-[11px] font-mono text-amber-300 self-start sm:self-center">
                {filteredAttendanceTeachers.length} Staff Shown
              </span>
            </div>

            <div className="divide-y divide-slate-200">
              {filteredAttendanceTeachers.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  No teacher records match the selected status filter for {attendanceDate}.
                </div>
              ) : (
                filteredAttendanceTeachers.map((tc) => {
                  const rec = getAttendanceRecordForDate(tc, attendanceDate);
                  const currentStatus: TeacherAttendanceStatus = rec?.status || 'Present';
                  const currentDesignation = rec?.designation || tc.designation;
                  const currentArrival = rec?.checkInTime || '09:00 AM';
                  const currentDeparture = rec?.checkOutTime || '04:00 PM';
                  const currentHoiRemarks = rec?.remarksByHoi ?? rec?.remarks ?? tc.latestHoiRemarks ?? '';
                  const historyEntries = rec?.changeHistory || [];

                  const isEditingArrival =
                    editingAttendanceField?.teacherId === tc.id && editingAttendanceField?.field === 'arrivalTime';
                  const isEditingDeparture =
                    editingAttendanceField?.teacherId === tc.id && editingAttendanceField?.field === 'departureTime';
                  const isEditingDesignation =
                    editingAttendanceField?.teacherId === tc.id && editingAttendanceField?.field === 'designation';
                  const isEditingStatus =
                    editingAttendanceField?.teacherId === tc.id && editingAttendanceField?.field === 'status';
                  const isEditingRemarks =
                    editingAttendanceField?.teacherId === tc.id && editingAttendanceField?.field === 'remarksByHoi';
                  const showHistory = expandedHistoryTeacherId === tc.id;

                  return (
                    <div key={tc.id} className="p-4 sm:p-5 hover:bg-slate-50/60 transition-colors space-y-3.5">
                      {/* Teacher Identity Row + Quick History Toggle */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center font-black text-indigo-700 text-sm shrink-0">
                            {tc.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-extrabold text-slate-900 text-sm">{tc.name}</div>
                            <div className="font-mono text-[11px] text-slate-500 flex flex-wrap items-center gap-2">
                              <span>CPIS: {tc.employeeId}</span>
                              <span>•</span>
                              <span>Date: {attendanceDate}</span>
                              {rec?.updatedAt && (
                                <>
                                  <span>•</span>
                                  <span className="text-emerald-700 font-semibold">
                                    Updated by {rec.updatedBy || 'HOI'}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap no-print">
                          {/* Quick One-Tap Presets */}
                          <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                            {(
                              [
                                { label: 'P', status: 'Present', activeCls: 'bg-emerald-600 text-white' },
                                { label: 'A', status: 'Absent', activeCls: 'bg-rose-600 text-white' },
                                { label: 'CL', status: 'Casual Leave (CL)', activeCls: 'bg-amber-600 text-white' },
                                { label: 'ML', status: 'Medical Leave (ML)', activeCls: 'bg-teal-600 text-white' },
                                { label: 'OD', status: 'On Duty (OD)', activeCls: 'bg-indigo-600 text-white' },
                              ] as const
                            ).map((preset) => (
                              <button
                                key={preset.label}
                                type="button"
                                disabled={!isAdminUser}
                                onClick={() => handleSetSingleTeacherStatus(tc, preset.status)}
                                title={`Quick set status: ${preset.status}`}
                                className={`px-2 py-1 rounded-lg text-[10.5px] font-extrabold transition-all ${
                                  currentStatus === preset.status
                                    ? `${preset.activeCls} shadow-xs`
                                    : 'text-slate-600 hover:bg-white'
                                } disabled:opacity-50`}
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              setExpandedHistoryTeacherId(showHistory ? null : tc.id)
                            }
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-colors ${
                              showHistory
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                            }`}
                          >
                            <History className="w-3.5 h-3.5" />
                            <span>Change History ({historyEntries.length})</span>
                          </button>
                        </div>
                      </div>

                      {/* 4 Structured Editable Fields Grid: Arrival Time, Departure Time, Designation, Attendance Status */}
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 text-xs">
                        {/* 1. ARRIVAL TIME */}
                        <div className="p-3 rounded-2xl border border-slate-200 bg-white space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-emerald-600" />
                              Arrival Time
                            </span>
                            {isAdminUser && !isEditingArrival && (
                              <button
                                type="button"
                                onClick={() => startEditingAttendanceField(tc, 'arrivalTime')}
                                className="no-print inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10.5px] font-bold"
                              >
                                <Edit2 className="w-2.5 h-2.5" /> Edit
                              </button>
                            )}
                          </div>

                          {isEditingArrival ? (
                            <div className="space-y-2 no-print">
                              <input
                                type="time"
                                value={draftArrival24}
                                onChange={(e) => setDraftArrival24(e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-xl border border-indigo-300 font-mono font-bold text-slate-900 bg-indigo-50/30"
                              />
                              <div className="text-[10px] text-slate-500 font-mono">
                                Preview: <strong>{formatTo12HourAmPm(draftArrival24)}</strong>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => saveEditingAttendanceField(tc, 'arrivalTime')}
                                  className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold"
                                >
                                  <Save className="w-3 h-3" /> Save
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelEditingAttendanceField}
                                  className="px-2.5 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-[11px] font-bold"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="font-mono font-black text-slate-900 text-sm">
                              {currentArrival}
                            </div>
                          )}
                        </div>

                        {/* 2. DEPARTURE TIME */}
                        <div className="p-3 rounded-2xl border border-slate-200 bg-white space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-amber-600" />
                              Departure Time
                            </span>
                            {isAdminUser && !isEditingDeparture && (
                              <button
                                type="button"
                                onClick={() => startEditingAttendanceField(tc, 'departureTime')}
                                className="no-print inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10.5px] font-bold"
                              >
                                <Edit2 className="w-2.5 h-2.5" /> Edit
                              </button>
                            )}
                          </div>

                          {isEditingDeparture ? (
                            <div className="space-y-2 no-print">
                              <input
                                type="time"
                                value={draftDeparture24}
                                onChange={(e) => setDraftDeparture24(e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-xl border border-indigo-300 font-mono font-bold text-slate-900 bg-indigo-50/30"
                              />
                              <div className="text-[10px] text-slate-500 font-mono">
                                Preview: <strong>{formatTo12HourAmPm(draftDeparture24)}</strong>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => saveEditingAttendanceField(tc, 'departureTime')}
                                  className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold"
                                >
                                  <Save className="w-3 h-3" /> Save
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelEditingAttendanceField}
                                  className="px-2.5 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-[11px] font-bold"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="font-mono font-black text-slate-900 text-sm">
                              {currentDeparture}
                            </div>
                          )}
                        </div>

                        {/* 3. DESIGNATION (Dropdown + Manual Custom Entry) */}
                        <div className="p-3 rounded-2xl border border-slate-200 bg-white space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                              <Briefcase className="w-3 h-3 text-indigo-600" />
                              Designation
                            </span>
                            {isAdminUser && !isEditingDesignation && (
                              <button
                                type="button"
                                onClick={() => startEditingAttendanceField(tc, 'designation')}
                                className="no-print inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10.5px] font-bold"
                              >
                                <Edit2 className="w-2.5 h-2.5" /> Edit
                              </button>
                            )}
                          </div>

                          {isEditingDesignation ? (
                            <div className="space-y-2 no-print">
                              <select
                                value={draftDesignationSelect}
                                onChange={(e) => setDraftDesignationSelect(e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-xl border border-indigo-300 text-xs font-bold bg-white"
                              >
                                {STANDARD_TEACHER_DESIGNATIONS.map((d) => (
                                  <option key={d} value={d}>
                                    {d}
                                  </option>
                                ))}
                                <option value="__CUSTOM__">Other / Custom Designation...</option>
                              </select>
                              {draftDesignationSelect === '__CUSTOM__' && (
                                <input
                                  type="text"
                                  value={draftDesignationCustom}
                                  onChange={(e) => setDraftDesignationCustom(e.target.value)}
                                  placeholder="Type custom designation..."
                                  className="w-full px-2.5 py-1.5 rounded-xl border border-indigo-300 text-xs font-semibold bg-indigo-50/20"
                                />
                              )}
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => saveEditingAttendanceField(tc, 'designation')}
                                  className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold"
                                >
                                  <Save className="w-3 h-3" /> Save
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelEditingAttendanceField}
                                  className="px-2.5 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-[11px] font-bold"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="font-extrabold text-slate-900 text-xs leading-snug">
                              {currentDesignation}
                            </div>
                          )}
                        </div>

                        {/* 4. ATTENDANCE STATUS (Color-Coded 8-Option Dropdown) */}
                        <div className="p-3 rounded-2xl border border-slate-200 bg-white space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-indigo-600" />
                              Attendance Status
                            </span>
                            {isAdminUser && !isEditingStatus && (
                              <button
                                type="button"
                                onClick={() => {
                                  startEditingAttendanceField(tc, 'status');
                                  setOpenStatusDropdownTeacherId(tc.id);
                                }}
                                className="no-print inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10.5px] font-bold"
                              >
                                <Edit2 className="w-2.5 h-2.5" /> Edit
                              </button>
                            )}
                          </div>

                          {isEditingStatus ? (
                            <div className="space-y-2 no-print relative">
                              {/* Color-Coded Custom Status Dropdown */}
                              <button
                                type="button"
                                aria-haspopup="listbox"
                                aria-expanded={openStatusDropdownTeacherId === tc.id}
                                onClick={() =>
                                  setOpenStatusDropdownTeacherId(
                                    openStatusDropdownTeacherId === tc.id ? null : tc.id
                                  )
                                }
                                className={`w-full px-2.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center justify-between gap-2 transition-colors ${
                                  getAttendanceStatusMeta(draftAttendanceStatus).badgeClass
                                }`}
                              >
                                <span className="inline-flex items-center gap-2 truncate">
                                  <span
                                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                      getAttendanceStatusMeta(draftAttendanceStatus).dotClass
                                    }`}
                                  />
                                  <span className="truncate">{draftAttendanceStatus}</span>
                                </span>
                                <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-75" />
                              </button>

                              {openStatusDropdownTeacherId === tc.id && (
                                <div
                                  role="listbox"
                                  className="absolute left-0 right-0 mt-1 rounded-2xl bg-white border border-slate-200 shadow-xl z-40 py-1 max-h-60 overflow-y-auto"
                                >
                                  {ATTENDANCE_STATUS_OPTIONS.map((opt) => {
                                    const optMeta = getAttendanceStatusMeta(opt);
                                    const isSelected = draftAttendanceStatus === opt;
                                    return (
                                      <button
                                        key={opt}
                                        type="button"
                                        role="option"
                                        aria-selected={isSelected}
                                        onClick={() => {
                                          setDraftAttendanceStatus(opt);
                                          setOpenStatusDropdownTeacherId(null);
                                        }}
                                        className={`w-full px-3 py-2 text-left text-xs font-bold flex items-center justify-between gap-2 hover:bg-slate-50 transition-colors ${
                                          isSelected ? 'bg-slate-100 text-slate-950' : 'text-slate-700'
                                        }`}
                                      >
                                        <span className="inline-flex items-center gap-2">
                                          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${optMeta.dotClass}`} />
                                          <span>{opt}</span>
                                        </span>
                                        {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenStatusDropdownTeacherId(null);
                                    saveEditingAttendanceField(tc, 'status');
                                  }}
                                  className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold"
                                >
                                  <Save className="w-3 h-3" /> Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenStatusDropdownTeacherId(null);
                                    cancelEditingAttendanceField();
                                  }}
                                  className="px-2.5 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-[11px] font-bold"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <span
                                className={`px-2.5 py-1 rounded-lg font-extrabold text-xs inline-flex items-center gap-1.5 ${getAttendanceStatusBadgeStyle(
                                  currentStatus
                                )}`}
                              >
                                <span
                                  className={`w-2 h-2 rounded-full shrink-0 ${
                                    getAttendanceStatusMeta(currentStatus).dotClass
                                  }`}
                                />
                                <span>{currentStatus}</span>
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 5. REMARKS BY HOI (Separate Multiline Text Box with Edit / Save / Cancel) */}
                      <div className="p-3.5 rounded-2xl border border-amber-200 bg-amber-50/40 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10.5px] font-black uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-amber-700" />
                            Remarks by HOI (Head of Institution)
                          </span>
                          {isAdminUser && !isEditingRemarks && (
                            <button
                              type="button"
                              onClick={() => startEditingAttendanceField(tc, 'remarksByHoi')}
                              className="no-print inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[10.5px] font-bold"
                            >
                              <Edit2 className="w-3 h-3" /> Edit Remarks
                            </button>
                          )}
                        </div>

                        {isEditingRemarks ? (
                          <div className="space-y-2 no-print">
                            <textarea
                              rows={3}
                              value={draftHoiRemarks}
                              onChange={(e) => setDraftHoiRemarks(e.target.value)}
                              placeholder="Enter official remarks by Head of Institution (late arrival explanation, duty note, administrative comment)..."
                              className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                            />
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={cancelEditingAttendanceField}
                                className="px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => saveEditingAttendanceField(tc, 'remarksByHoi')}
                                className="inline-flex items-center gap-1 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold"
                              >
                                <Save className="w-3.5 h-3.5" /> Save Remarks by HOI
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                            {currentHoiRemarks || (
                              <span className="italic text-slate-400">
                                No HOI remarks recorded for {attendanceDate}. Click &ldquo;Edit Remarks&rdquo; to add administrative notes.
                              </span>
                            )}
                          </p>
                        )}
                      </div>

                      {/* Collapsible Change History Audit Log */}
                      {showHistory && (
                        <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50 space-y-2 no-print">
                          <div className="flex items-center justify-between">
                            <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                              <History className="w-3.5 h-3.5 text-indigo-600" />
                              Change History Audit Log ({attendanceDate})
                            </h4>
                            <span className="text-[10px] font-mono text-slate-500">
                              Preserved permanently per date
                            </span>
                          </div>
                          {historyEntries.length === 0 ? (
                            <p className="text-xs text-slate-500 italic">
                              No edits recorded for {tc.name} on {attendanceDate} yet. Every field save is automatically logged with timestamp and user details.
                            </p>
                          ) : (
                            <div className="space-y-1.5 max-h-48 overflow-y-auto">
                              {historyEntries.map((entry) => (
                                <div
                                  key={entry.id}
                                  className="p-2.5 rounded-xl bg-white border border-slate-200 text-[11px] flex flex-col sm:flex-row sm:items-center justify-between gap-1.5"
                                >
                                  <div>
                                    <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-800 font-extrabold text-[10px] mr-1.5">
                                      {entry.field}
                                    </span>
                                    <span className="text-slate-500 line-through mr-1">{entry.previousValue}</span>
                                    <span className="text-slate-400 mr-1">→</span>
                                    <span className="font-bold text-emerald-800">{entry.newValue}</span>
                                  </div>
                                  <div className="text-[10px] font-mono text-slate-500 shrink-0">
                                    {entry.changedBy} ({entry.changedByRole}) • {new Date(entry.changedAt).toLocaleString()}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 5: DUTY ROSTER & REWARD POINTS (WEEKLY CALENDAR & BADGES)          */}
      {/* ========================================================================= */}
      {activeSubTab === 'duty-roster' && (
        <div className="space-y-6">
          {/* Header Controls */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-mono font-extrabold uppercase border border-amber-200">
                  CAMPUS SUPERVISION & REWARD SYSTEM
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  {dutyRosterWeek}
                </span>
              </div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2 mt-1">
                <ShieldCheck className="w-5 h-5 text-amber-500" />
                <span>Teacher Weekly Duty Roster & Points Leaderboard</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Assign non-teaching supervision duties (Playground, Lunch, Gate, Assembly) across days. Teachers earn digital badges & duty points for their official service profile.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold bg-slate-900 text-white hover:bg-slate-800 transition-all shadow-sm"
              >
                <Printer className="w-4 h-4 text-amber-400" />
                <span>Print Weekly Roster</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Weekly Duty Slots</span>
              <div className="text-2xl font-black text-slate-900 font-mono mt-1">30</div>
              <span className="text-[10px] text-emerald-600 font-bold block mt-0.5">
                {Object.values(rosterAssignments).filter(Boolean).length} Assigned
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Points per Duty</span>
              <div className="text-2xl font-black text-amber-600 font-mono mt-1">+10</div>
              <span className="text-[10px] text-slate-500 block mt-0.5">Merit reward per completed shift</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Active Faculty On Duty</span>
              <div className="text-2xl font-black text-indigo-600 font-mono mt-1">{teachers.length}</div>
              <span className="text-[10px] text-slate-500 block mt-0.5">Rotational allocation</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Safety Standard</span>
              <div className="text-2xl font-black text-emerald-600 font-mono mt-1">100%</div>
              <span className="text-[10px] text-emerald-600 font-bold block mt-0.5">RTE & NEP Compliant</span>
            </div>
          </div>

          {/* Weekly Calendar Matrix */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden printable-card">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-600" />
                <span className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">
                  Weekly Supervision Schedule ({school.name})
                </span>
              </div>
              <span className="text-[11px] font-semibold text-slate-500 font-mono">
                Session: {school.academicSession}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-extrabold uppercase text-[10.5px]">
                    <th className="py-3 px-3 w-48 border-r border-slate-200">Supervision Duty Type</th>
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day) => (
                      <th key={day} className="py-3 px-3 text-center border-r border-slate-200 last:border-r-0">
                        {day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {[
                    { id: 'Assembly', label: 'Morning Assembly Lead', icon: '🌟', hint: 'Pledge, Prayer, News' },
                    { id: 'Gate', label: 'Campus Gate Duty', icon: '🚪', hint: 'Entry / Exit monitoring' },
                    { id: 'Playground', label: 'Playground Supervision', icon: '⚽', hint: 'Recess sports & student safety' },
                    { id: 'Lunch', label: 'Mid-Day Meal & Lunch Duty', icon: '🍲', hint: 'Hygiene & food distribution' },
                    { id: 'Corridor', label: 'Corridor & Discipline Monitor', hint: 'Order between class transitions' },
                  ].map((duty) => (
                    <tr key={duty.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3 bg-slate-50/60 font-bold border-r border-slate-200">
                        <div className="flex items-center gap-1.5 text-slate-900 font-extrabold text-xs">
                          <span>{duty.icon || '🛡️'}</span>
                          <span>{duty.label}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 block mt-0.5">{duty.hint}</span>
                        <span className="inline-block mt-1 text-[9px] px-1.5 py-0.2 rounded font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          +10 Duty Pts
                        </span>
                      </td>

                      {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day) => {
                        const assignedTeacherId = rosterAssignments[`${day}_${duty.id}`] || '';
                        const assignedTeacher = teachers.find((tc) => tc.id === assignedTeacherId);

                        return (
                          <td key={day} className="py-2.5 px-2 border-r border-slate-200 last:border-r-0 text-center">
                            <div className="space-y-1">
                              <select
                                value={assignedTeacherId}
                                onChange={(e) => handleAssignDuty(day, duty.id, e.target.value)}
                                className={`w-full text-xs font-bold py-1.5 px-2 rounded-xl border transition-all no-print ${
                                  assignedTeacherId
                                    ? 'bg-indigo-50/80 border-indigo-300 text-indigo-950 font-semibold'
                                    : 'bg-slate-50 border-slate-300 text-slate-400 italic'
                                }`}
                              >
                                <option value="">-- Unassigned --</option>
                                {teachers.map((tc) => (
                                  <option key={tc.id} value={tc.id}>
                                    {tc.name} ({tc.designation.split(' ')[0]})
                                  </option>
                                ))}
                              </select>

                              {/* Print-friendly display */}
                              <div className="hidden print:block font-bold text-xs text-slate-900">
                                {assignedTeacher ? assignedTeacher.name : 'Unassigned'}
                              </div>

                              {assignedTeacher && (
                                <div className="text-[10px] font-mono text-indigo-700 flex items-center justify-center gap-1">
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  <span>{assignedTeacher.name.split(' ')[0]} (+10 pts)</span>
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Duty Points & Digital Badges Leaderboard */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-500" />
                  <span>Teacher Duty Points & Digital Badges Register</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Recognizing faculty contribution to campus discipline, safety, and school events. Points are logged in JKHRMS annual performance appraisal.
                </p>
              </div>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-xl bg-amber-50 text-amber-800 border border-amber-200">
                Official Merit System
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teachers.map((tc, index) => {
                // Calculate assigned duties count for this teacher
                const dutyCount = Object.values(rosterAssignments).filter((id) => id === tc.id).length;
                const points = dutyCount * 10 + 20; // base + weekly shifts
                let badge = { name: 'Active Supervisor', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: '🥉' };
                if (points >= 50) {
                  badge = { name: 'Duty Champion', color: 'bg-amber-50 text-amber-800 border-amber-300 font-extrabold', icon: '👑' };
                } else if (points >= 30) {
                  badge = { name: 'Discipline Star', color: 'bg-emerald-50 text-emerald-800 border-emerald-300', icon: '🌟' };
                }

                return (
                  <div key={tc.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-slate-100/70 transition-all flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
                        {tc.name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-xs font-black text-slate-900 flex items-center gap-1">
                          <span>{tc.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">({tc.employeeId})</span>
                        </div>
                        <div className="text-[11px] text-slate-500">{tc.designation}</div>
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className={`text-[9.5px] px-2 py-0.5 rounded-full border ${badge.color}`}>
                            {badge.icon} {badge.name}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xl font-black text-indigo-700 font-mono">{points}</div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase">Duty Pts</div>
                      <div className="text-[10px] text-emerald-600 font-semibold">{dutyCount} shifts/wk</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ADD / EDIT JKHRMS TEACHER MODAL (WITH LIVE RECALCULATIONS)               */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm no-print">
          <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center border border-indigo-400/30">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black">
                    {editingTeacher ? `Edit JKHRMS Profile: ${editingTeacher.name}` : 'New JKHRMS Teacher Service Registration'}
                  </h3>
                  <p className="text-xs text-indigo-200">
                    Compliant with J&K CSR 60-Year Superannuation and Service Verification Rules
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSaveTeacher} className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
              
              {/* Dynamic Live Calculation Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50 to-slate-50 border border-indigo-200/90 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase text-indigo-950 tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Automatic JKHRMS Date & Superannuation Engine</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    Live Recalculation Active
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Current Age</span>
                    <span className="font-mono font-black text-slate-900 text-xs">{calculatedAge.formatted}</span>
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Dept Service</span>
                    <span className="font-mono font-black text-emerald-700 text-xs">{calculatedDeptService.formatted}</span>
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Present School Tenure</span>
                    <span className="font-mono font-black text-indigo-700 text-xs">{calculatedSchoolTenure.formatted}</span>
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border border-amber-300 bg-amber-50/50">
                    <span className="text-[10px] font-bold text-amber-900 uppercase block">Retirement Date (60Y)</span>
                    <span className="font-mono font-black text-amber-950 text-xs">{calculatedRetirement.retirementDate}</span>
                  </div>
                </div>

                <p className="text-[10.5px] text-slate-600">
                  <strong className="text-slate-800">Rule Logic:</strong> {calculatedRetirement.explanation}
                </p>
              </div>

              {/* Section 1: Identification */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b pb-1.5">
                  1. Personal & Identification Particulars
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Employee CPIS Code *
                    </label>
                    <input
                      type="text"
                      required
                      value={empId}
                      onChange={(e) => setEmpId(e.target.value)}
                      placeholder="e.g. CPIS-BAR-101"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Teacher Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Mohd Yousuf Wani"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Father's Name
                    </label>
                    <input
                      type="text"
                      value={fatherName}
                      onChange={(e) => setFatherName(e.target.value)}
                      placeholder="e.g. Ghulam Hassan Wani"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold text-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Date of Birth (DOB) *
                    </label>
                    <input
                      type="date"
                      required
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold text-indigo-700"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Gender
                    </label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value as any)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold text-slate-900"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Category
                    </label>
                    <select
                      value={employeeCategory}
                      onChange={(e) => setEmployeeCategory(e.target.value as any)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold text-slate-900"
                    >
                      <option value="General">General</option>
                      <option value="RBA">RBA</option>
                      <option value="SC">SC</option>
                      <option value="ST">ST</option>
                      <option value="ALC">ALC</option>
                      <option value="EWS">EWS</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      District
                    </label>
                    <input
                      type="text"
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold text-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Appointment & Service */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b pb-1.5">
                  2. Service Dates & Appointment Particulars
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Employee Designation *
                    </label>
                    <input
                      type="text"
                      required
                      value={designation}
                      onChange={(e) => setDesignation(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Subject Specialization
                    </label>
                    <input
                      type="text"
                      value={subjectSpecialization}
                      onChange={(e) => setSubjectSpecialization(e.target.value)}
                      placeholder="e.g. Mathematics / Urdu"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Employment Type
                    </label>
                    <select
                      value={employmentType}
                      onChange={(e) => setEmploymentType(e.target.value as any)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold text-slate-900"
                    >
                      <option value="Permanent (Gazetted)">Permanent (Gazetted)</option>
                      <option value="Permanent (Non-Gazetted)">Permanent (Non-Gazetted)</option>
                      <option value="ReT / General Line">ReT / General Line</option>
                      <option value="Contractual">Contractual</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Initial Dept Joining Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={dateOfJoiningDepartment}
                      onChange={(e) => setDateOfJoiningDepartment(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold text-emerald-700"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Joining Present School ({school.villageTown || 'Pamposh Colony'}) *
                    </label>
                    <input
                      type="date"
                      required
                      value={dateOfJoiningPresentSchool}
                      onChange={(e) => setDateOfJoiningPresentSchool(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold text-indigo-700"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Appointment Order Number
                    </label>
                    <input
                      type="text"
                      value={appointmentOrderNumber}
                      onChange={(e) => setAppointmentOrderNumber(e.target.value)}
                      placeholder="DSEK/Estt/Appt-4412/10"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-semibold text-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Previous School / Posting
                    </label>
                    <input
                      type="text"
                      value={previousSchool}
                      onChange={(e) => setPreviousSchool(e.target.value)}
                      placeholder="e.g. Govt Boys High School, Mirgund"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Qualifications (Degrees)
                    </label>
                    <input
                      type="text"
                      value={qualifications}
                      onChange={(e) => setQualifications(e.target.value)}
                      placeholder="e.g. M.A., B.Ed."
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold text-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Contact & Remarks */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b pb-1.5">
                  3. Contact, Address & Service Remarks
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Mobile Number
                    </label>
                    <input
                      type="text"
                      value={contactNumber}
                      onChange={(e) => setContactNumber(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="teacher@jkschools.edu.in"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Residential Address
                  </label>
                  <input
                    type="text"
                    value={residentialAddress}
                    onChange={(e) => setResidentialAddress(e.target.value)}
                    placeholder="Pamposh Colony, Palapora Zone, Iddgah"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Service Remarks / Attestation Notes
                  </label>
                  <input
                    type="text"
                    value={serviceRemarks}
                    onChange={(e) => setServiceRemarks(e.target.value)}
                    placeholder="e.g. Verified under JKHRMS J&K CSR Rules."
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold text-slate-900"
                  />
                </div>
              </div>

              {/* Section 4: Assigned Classes, Sections, Subjects & Login Credentials */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b pb-1.5 flex items-center justify-between">
                  <span>4. Assigned Classes, Subjects &amp; Login Credentials</span>
                  <span className="text-[10px] font-mono text-indigo-600">{assignedClassesInput.length} Assigned</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Class</label>
                    <select
                      value={newAssignClass}
                      onChange={(e) => setNewAssignClass(e.target.value)}
                      className="w-full px-2.5 py-2 border border-slate-300 rounded-xl font-semibold bg-white"
                    >
                      {school.classesOffered.map((c) => (
                        <option key={c} value={c}>Class {c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Section</label>
                    <select
                      value={newAssignSection}
                      onChange={(e) => setNewAssignSection(e.target.value)}
                      className="w-full px-2.5 py-2 border border-slate-300 rounded-xl font-semibold bg-white"
                    >
                      <option value="A">Section A</option>
                      <option value="B">Section B</option>
                      <option value="C">Section C</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Subject</label>
                    <input
                      type="text"
                      value={newAssignSubject}
                      onChange={(e) => setNewAssignSubject(e.target.value)}
                      placeholder="e.g. Mathematics"
                      className="w-full px-2.5 py-2 border border-slate-300 rounded-xl font-semibold bg-white"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddAssignedClassRow}
                    className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Assign Class</span>
                  </button>
                </div>

                {assignedClassesInput.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {assignedClassesInput.map((ac, idx) => (
                      <span
                        key={`${ac.classNumber}-${ac.section}-${ac.subject}-${idx}`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-50 text-indigo-900 border border-indigo-200 text-[11px] font-bold"
                      >
                        <span>Class {ac.classNumber}-{ac.section} • {ac.subject}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveAssignedClassRow(idx)}
                          className="text-indigo-500 hover:text-rose-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Login Username
                    </label>
                    <input
                      type="text"
                      value={usernameInput}
                      onChange={(e) => setUsernameInput(e.target.value)}
                      placeholder="e.g. nazir.dar"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-semibold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      {editingTeacher ? 'New Password (Optional)' : 'Account Password'}
                    </label>
                    <input
                      type="password"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      placeholder={editingTeacher ? 'Leave blank to keep current' : 'Set login password'}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-semibold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Account Status
                    </label>
                    <select
                      value={accountStatusInput}
                      onChange={(e) => setAccountStatusInput(e.target.value as 'Active' | 'Inactive')}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold bg-white text-slate-900"
                    >
                      <option value="Active">Active (Allowed Login)</option>
                      <option value="Inactive">Inactive (Suspended)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-md shadow-indigo-600/30"
                >
                  {editingTeacher ? 'Update JKHRMS Record' : 'Save JKHRMS Record'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Quick Edit Teacher Address Modal */}
      {addressEditingTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm no-print animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-300" />
                <h2 className="text-sm font-extrabold">Edit Teacher Residential Address</h2>
              </div>
              <button
                type="button"
                onClick={handleCancelEditTeacherAddress}
                className="p-1 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTeacherAddress} className="p-5 space-y-4">
              {/* Teacher info badge */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    CPIS Code: {addressEditingTeacher.employeeId}
                  </span>
                  <span className="text-sm font-black text-slate-900">
                    {addressEditingTeacher.name}
                  </span>
                  <p className="text-[11px] text-slate-500">
                    {addressEditingTeacher.designation} • {addressEditingTeacher.employmentStatus}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleApplyStandardTeacherAddress}
                  className="px-2.5 py-1.5 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 text-[11px] font-extrabold shadow-2xs transition-all active:scale-95 flex items-center gap-1"
                  title="Auto-fill with official standardized address for Pamposh Colony"
                >
                  <span>⚡ Use Standard Address</span>
                </button>
              </div>

              {/* Residential Address Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Residential Address <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  required
                  autoFocus
                  value={editedTeacherAddressValue}
                  onChange={(e) => {
                    setEditedTeacherAddressValue(e.target.value);
                    setTeacherAddressEditError(null);
                  }}
                  placeholder="Pamposh Colony, Palapora Zone, Iddgah"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 leading-relaxed"
                />
                <p className="text-[10.5px] text-slate-500 mt-1">
                  Standard format: <span className="font-semibold text-slate-700">Pamposh Colony, Palapora Zone, Iddgah</span>
                </p>
              </div>

              {/* District */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  District
                </label>
                <input
                  type="text"
                  value={editedTeacherDistrict}
                  onChange={(e) => setEditedTeacherDistrict(e.target.value)}
                  placeholder="Srinagar"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {teacherAddressEditError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{teacherAddressEditError}</span>
                </div>
              )}

              {/* Footer buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCancelEditTeacherAddress}
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

      {/* View Teacher Profile Modal */}
      {viewingTeacherProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-sm no-print">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <UserCheck className="w-5 h-5 text-amber-400" />
                <div>
                  <h2 className="text-sm font-black">{viewingTeacherProfile.name}</h2>
                  <p className="text-[11px] text-slate-400 font-mono">
                    {viewingTeacherProfile.employeeId} • {viewingTeacherProfile.designation}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingTeacherProfile(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Account Status</span>
                  <span className={`font-black ${(viewingTeacherProfile.accountStatus || 'Active') === 'Active' ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {viewingTeacherProfile.accountStatus || 'Active'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Username</span>
                  <span className="font-mono font-bold text-slate-900">{viewingTeacherProfile.username || viewingTeacherProfile.employeeId.toLowerCase()}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Qualifications</span>
                  <span className="font-bold text-slate-900">{viewingTeacherProfile.qualifications}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Mobile</span>
                  <span className="font-mono font-bold text-slate-900">{viewingTeacherProfile.contactNumber}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Email</span>
                  <span className="font-semibold text-slate-900">{viewingTeacherProfile.email || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Specialization</span>
                  <span className="font-bold text-indigo-700">{viewingTeacherProfile.subjectSpecialization || 'General'}</span>
                </div>
              </div>

              <div>
                <h4 className="font-black text-slate-800 uppercase tracking-wider text-[11px] mb-2">
                  Assigned Classes, Sections &amp; Subjects
                </h4>
                {viewingTeacherProfile.assignedClasses && viewingTeacherProfile.assignedClasses.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {viewingTeacherProfile.assignedClasses.map((ac, i) => (
                      <span key={i} className="px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-900 border border-indigo-200 font-bold">
                        Class {ac.classNumber}-{ac.section} • {ac.subject}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500 italic">No specific class-section schedule assigned yet.</p>
                )}
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Residential Address</span>
                <p className="font-semibold text-slate-800 mt-0.5">{viewingTeacherProfile.residentialAddress}</p>
              </div>

              {/* Latest Attendance Snapshot & Remarks by HOI inside Teacher Profile */}
              {(() => {
                const latestProfileAtt = getLatestAttendanceRecordForTeacher(viewingTeacherProfile);
                const profileHoiRemarks =
                  latestProfileAtt?.remarksByHoi ??
                  latestProfileAtt?.remarks ??
                  viewingTeacherProfile.latestHoiRemarks ??
                  '';
                return (
                  <div className="p-3.5 rounded-2xl bg-amber-50/50 border border-amber-200 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-black uppercase text-amber-900">
                        Remarks by HOI (Head of Institution) &amp; Daily Attendance
                      </span>
                      {latestProfileAtt && (
                        <span className="text-[10px] font-mono text-amber-800">
                          {latestProfileAtt.date} • {latestProfileAtt.status} ({latestProfileAtt.checkInTime || '09:00 AM'} – {latestProfileAtt.checkOutTime || '04:00 PM'})
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-700 whitespace-pre-wrap">
                      {profileHoiRemarks || 'No HOI remarks recorded yet. Update remarks in the Teacher Attendance Register or Service Book.'}
                    </p>
                  </div>
                );
              })()}
            </div>
            <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50">
              {isAdminUser && (
                <button
                  type="button"
                  onClick={() => {
                    const target = viewingTeacherProfile;
                    setViewingTeacherProfile(null);
                    openModalForTeacher(target);
                  }}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
                >
                  Edit Teacher Details
                </button>
              )}
              <button
                type="button"
                onClick={() => setViewingTeacherProfile(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin-Only Reset Teacher Password Modal */}
      {resetPasswordTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-sm no-print">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-purple-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-300" />
                <h2 className="text-sm font-extrabold">Reset Teacher Password (Admin)</h2>
              </div>
              <button type="button" onClick={() => setResetPasswordTeacher(null)} className="p-1 text-purple-200 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleConfirmResetPassword} className="p-5 space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-purple-50 border border-purple-200">
                <p className="font-bold text-purple-950">{resetPasswordTeacher.name}</p>
                <p className="text-[11px] text-purple-700 font-mono">
                  Username: {resetPasswordTeacher.username || resetPasswordTeacher.employeeId.toLowerCase()} • CPIS: {resetPasswordTeacher.employeeId}
                </p>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">New Password (min 6 chars) *</label>
                <input
                  type="password"
                  required
                  value={resetNewPwd}
                  onChange={(e) => {
                    setResetNewPwd(e.target.value);
                    setResetPwdError(null);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Confirm New Password *</label>
                <input
                  type="password"
                  required
                  value={resetConfirmPwd}
                  onChange={(e) => {
                    setResetConfirmPwd(e.target.value);
                    setResetPwdError(null);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                />
              </div>
              {resetPwdError && (
                <p className="text-rose-700 font-bold bg-rose-50 p-2 rounded-lg border border-rose-200">{resetPwdError}</p>
              )}
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setResetPasswordTeacher(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold"
                >
                  Save New Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Teacher Confirmation Modal */}
      {teacherToDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-sm no-print">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden p-6 space-y-4 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-sm text-slate-900">Delete Teacher Account</h3>
                <p className="text-slate-500">
                  Remove <strong>{teacherToDeleteConfirm.name}</strong> ({teacherToDeleteConfirm.employeeId}) from JKHRMS?
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setTeacherToDeleteConfirm(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteTeacher}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Map modal for check-in viewing if needed */}
      {selectedLocationForMap && (
        <LocationMapModal
          locationData={selectedLocationForMap}
          onClose={() => setSelectedLocationForMap(null)}
          language={language}
        />
      )}

    </div>
  );
};
