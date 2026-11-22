export type UserRole = 'admin' | 'head_teacher' | 'teacher' | 'primary_admin' | 'senior_admin' | 'junior_admin';

export type AdminRoleType = 'primary_admin' | 'senior_admin' | 'junior_admin' | 'teacher';

export type PermissionKey =
  | 'view_dashboard'
  | 'manage_students'
  | 'record_attendance'
  | 'approve_teacher_leave'
  | 'manage_examinations'
  | 'edit_marks'
  | 'view_reports'
  | 'export_reports'
  | 'school_settings'
  | 'admin_access_control'
  | 'purge_synced_data'
  | 'export_security_audit'
  | 'manage_credentials';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminRoleType;
  designation?: string;
  phone?: string;
  employeeId?: string;
  avatar?: string;
  assignedClasses?: string[];
  assignedSubjects?: string[];
  lastActive: string; // ISO string
  recentActions: string[];
  activity7Days: number[]; // 7 daily density values (e.g. [12, 18, 25, 9, 31, 4, 15])
  customPermissions?: Partial<Record<PermissionKey, boolean>>;
  inheritsFrom?: 'junior_admin' | 'none';
  status: 'Active' | 'Suspended';
}

export interface SecuritySettings {
  minPasswordLength: number;
  requireSpecialChar: boolean;
  requireNumbers: boolean;
  requireUppercase: boolean;
  sessionTimeoutMinutes: number;
  maxFailedLogins: number;
  twoFactorEnforced: boolean;
}

export interface AdminAuditChangeLog {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  targetUserId?: string;
  targetUserName?: string;
  actionType:
    | 'ROLE_CHANGE'
    | 'PERMISSION_UPDATE'
    | 'CREDENTIAL_RESET'
    | 'SECURITY_POLICY_UPDATE'
    | 'USER_CREATE'
    | 'USER_DELETE'
    | 'USER_UPDATE'
    | 'DATA_PURGE'
    | 'AUDIT_EXPORT';
  description: string;
  oldValue?: string;
  newValue?: string;
  oldPermissions?: Partial<Record<PermissionKey, boolean>>;
  newPermissions?: Partial<Record<PermissionKey, boolean>>;
  ipAddress?: string;
  status: 'SUCCESS' | 'FLAGGED';
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  employeeId?: string;
  avatar?: string;
  assignedClasses?: string[]; // e.g. ['5-A', '6-B']
  assignedSubjects?: string[]; // e.g. ['Mathematics', 'Science']
  lastActive?: string;
  recentActions?: string[];
  phone?: string;
  designation?: string;
}

export interface SchoolProfile {
  name: string;
  nameUrdu: string;
  nameHi?: string;
  code: string; // U-DISE Code
  address: string;
  villageTown: string;
  blockTehsil: string;
  district: string;
  state: string;
  pinCode: string;
  academicSession: string; // e.g. "2026-2027"
  headTeacherName: string;
  principalDesignation?: 'Headmaster' | 'Principal' | 'Headmistress' | 'Officiating Principal' | 'In-Charge Headmaster';
  contactNumber: string;
  email: string;
  classesOffered: string[]; // e.g. ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']
  schoolCategory?: 'Primary' | 'Middle' | 'High_School' | 'Higher_Secondary' | 'Composite';
  workingDaysPerWeek: number; // 6
  holidays: Holiday[];
  gradingScale: GradeBoundary[];
  reportHeader: string;
  reportFooter: string;

  // School Geo-Location & Geofencing for Teacher Attendance
  latitude?: number; // e.g. 28.3670
  longitude?: number; // e.g. 79.4304
  geofenceRadiusMeters?: number; // e.g. 250
  locationAddress?: string;
  requireLocationForAttendance?: boolean;

  // Administrative Profile (Admin replacing DDO, Manual Headmaster Profile, Stamp & Digital Signature)
  adminName?: string;
  headmasterName?: string;
  headmasterQualification?: string;
  headmasterContact?: string;
  headmasterEmail?: string;
  headmasterJoiningDate?: string;
  headmasterPhotoDataUrl?: string;
  headmasterManuallyEdited?: boolean;
  headmasterUpdatedAt?: string;
  officialStampDataUrl?: string;
  headmasterSignatureDataUrl?: string;

  // Centralized Official School Logo & Extended ID Card Info
  logoDataUrl?: string;
  officialLogoLocked?: boolean;
  officialLogoUpdatedAt?: string;
  website?: string;
  motto?: string;
  emergencyContact?: string;

  // Persisted Subject -> Teacher Name links for Teacher-Wise Subject Result Card
  subjectTeacherMappings?: Record<
    string,
    {
      teacherName: string;
      teacherId?: string;
      classNumber?: string;
      section?: string;
      updatedAt?: string;
    }
  >;
}

export interface DeveloperAdminProfile {
  id: string;
  name: string;
  designation: string;
  institution: string;
  locality?: string;
  district: string;
  unionTerritory: string;
  email?: string;
  phone?: string;
  updatedAt?: string;
}

export interface SchoolAboutUsInfo {
  id: string;
  // A. About Us (School Admin Editable Only)
  schoolName: string;
  schoolIntroduction: string;
  schoolHistory: string;
  schoolVision: string;
  schoolMission: string;
  schoolObjectives: string;
  schoolAddress: string;
  schoolContactNumber: string;
  schoolEmail: string;
  schoolWebsite: string;
  schoolLogoDataUrl?: string;
  schoolFacilities: string;
  principalsMessage: string;
  otherSchoolInfo: string;

  // B. App Information (School Admin Editable Only)
  appName: string;
  appDescription: string;
  appVersion: string;
  appFeatures: string;
  appPurpose: string;
  appSupportEmail: string;
  appSupportContactNumber: string;
  privacyPolicy: string;
  termsAndConditions: string;
  copyrightInfo: string;

  updatedAt?: string;
  updatedByName?: string;
  updatedByRole?: string;
}

export interface SchoolInfoAuditEntry {
  id: string;
  section: 'About Us' | 'App Information' | 'School Logo';
  action: 'CREATE' | 'UPDATE';
  changedFields: string[];
  summary: string;
  actorName: string;
  actorRole: string;
  timestamp: string;
  syncedToCloud?: boolean;
}

export interface Holiday {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  nameUrdu?: string;
  nameHi?: string;
  type: 'gazetted' | 'restricted' | 'vacation' | 'weekend';
}

export interface GradeBoundary {
  grade: string;
  minPercentage: number;
  maxPercentage: number;
  remark: string;
  remarkUrdu?: string;
  remarkHi?: string;
  points: number;
}

export type StudentStatus = 'Active' | 'Transferred' | 'Graduated' | 'Archived';
export type AadhaarStatus = 'Verified' | 'Pending' | 'Alternative_ID_Provided' | 'Exempted';

export interface Student {
  id: string; // e.g. "SM-2026-001"
  admissionNumber: string;
  fullName: string;
  fatherName: string;
  motherName: string;
  guardianName?: string;
  gender: 'Male' | 'Female' | 'Other';
  dob: string; // YYYY-MM-DD
  classNumber: string; // e.g. "5"
  section: string; // "A" | "B" | "C"
  rollNumber: number;
  academicSession: string;
  address: string;
  villageTown: string;
  blockTehsil: string;
  district: string;
  state: string;
  pinCode: string;
  mobileNumber: string;
  parentWhatsAppNumber: string; // Registered WhatsApp number
  admissionDate: string;
  previousSchool?: string;
  status: StudentStatus;
  
  // UIDAI & Identity compliance fields
  aadhaarStatus: AadhaarStatus;
  maskedAadhaar?: string; // e.g. "XXXX-XXXX-8921"
  aadhaarRefNumber?: string; // e.g. "UIDAI-OFFLINE-98214"
  aadhaarVerificationDate?: string;
  parentConsentRecorded?: boolean;
  alternativeIdType?: string; // e.g. "Ration Card", "Birth Certificate"
  alternativeIdRef?: string;

  // Attendance Marks / Continuous Evaluation Points
  attendanceMarks?: number; // e.g. 0 to 5 or 0 to 10 points based on attendance %

  // Extended Smart Student Register Fields
  category?: string; // e.g. General, SC, ST, OBC, RBA, EWS
  religion?: string;
  nationality?: string;
  photoDataUrl?: string;

  // Transfer, Audit & History Tracking
  transferDate?: string;
  transferSchool?: string;
  transferReason?: string;
  updatedAt?: string;
  history?: StudentHistoryEvent[];
}

export interface StudentHistoryEvent {
  id: string;
  date: string;
  type: 'ADMISSION' | 'CLASS_CHANGE' | 'SESSION_UPDATE' | 'ADMISSION_NO_UPDATE' | 'TRANSFER' | 'PROFILE_UPDATE';
  title: string;
  details: string;
  actorName: string;
}

export interface PrincipalRecord {
  id: string;
  fullName: string;
  designation: 'Principal' | 'Headmaster' | 'Headmistress' | 'Officiating Principal' | 'In-Charge Headmaster';
  joiningDate: string; // YYYY-MM-DD
  leavingDate?: string; // YYYY-MM-DD if previous
  contactNumber: string;
  email?: string;
  qualification: string;
  description: string;
  photoDataUrl?: string;
  isCurrent: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OcrImportBatchHistory {
  id: string;
  timestamp: string;
  sourceName: string;
  sourceType: 'camera' | 'image' | 'pdf' | 'excel' | 'csv' | 'text';
  totalScanned: number;
  importedCount: number;
  failedCount: number;
  duplicateCount: number;
  importedStudentIds: string[];
  undone?: boolean;
  actorName: string;
}

export interface ExcelMappingColumnRule {
  index: number;
  sourceHeader: string;
  targetField: string;
  defaultValue?: string;
  required?: boolean;
  sampleValue?: string;
}

export interface ExcelMappingSchema {
  id: string;
  name: string;
  description?: string;
  sheetName?: string;
  columns: ExcelMappingColumnRule[];
  isDefault?: boolean;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Approved_Leave';

export interface AttendanceRecord {
  id: string;
  date: string; // YYYY-MM-DD
  studentId: string;
  classNumber: string;
  section: string;
  status: AttendanceStatus;
  academicSession: string;
  markedByUserId: string;
  markedAt: string;
  isOfflineSynced?: boolean;
  remarks?: string;

  // GPS Geolocation fields
  latitude?: number;
  longitude?: number;
  distanceFromSchoolMeters?: number;
  isLocationVerified?: boolean;
  locationAccuracyMeters?: number;
}

export interface AttendanceAuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  studentId: string;
  studentName: string;
  date: string;
  previousStatus: AttendanceStatus;
  newStatus: AttendanceStatus;
  reason: string;
}

export interface TeacherServiceRecord {
  id: string;
  orderNumber: string;
  orderDate: string;
  schoolName: string;
  designation: string;
  fromPeriod: string;
  toPeriod: string;
  postingType: 'Initial Appointment' | 'Transfer' | 'Promotion' | 'Deputation';
  district: string;
  remarks?: string;
  documentName?: string;
}

export interface JkEpmQuarterlyRecord {
  id: string;
  academicSession: string;
  quarter: 'Q1 (Apr - Jun)' | 'Q2 (Jul - Sep)' | 'Q3 (Oct - Dec)' | 'Q4 (Jan - Mar)';
  submissionDate: string;
  scoreOutOf10: number; // e.g. 9.4
  syllabusCoveragePct: number; // e.g. 92%
  remedialClassesHeld: number;
  activityDescription: string;
  verificationStatus: 'Verified' | 'Pending_DDO' | 'Approved_by_ZEO';
  verifiedBy: string;
  remarks: string;
  supportingDocName?: string;
}

export interface TeacherProfile {
  id: string;
  employeeId: string; // CPIS / JKHRMS Code e.g. "KHYEDU 00220000"
  previousCpisCode?: string; // Legacy CPIS Code preserved in audit history e.g. "JK-EDU-1985-0451"
  name: string;
  fatherName?: string;
  motherName?: string;
  fatherSpouseName: string;
  gender?: 'Male' | 'Female' | 'Other';
  dob?: string; // YYYY-MM-DD
  designation: string; // e.g. "Principal", "Head Teacher", "Senior Teacher (TGT)", "PRT General"
  subjectSpecialization?: string; // e.g. "Mathematics", "Science", "Urdu & Languages"
  assignedClasses: { classNumber: string; section: string; subject: string }[];
  dateOfJoining: string; // Legacy / Default joining date
  
  // JKHRMS Service Record Specifics
  dateOfInitialAppointment?: string; // e.g. "2010-04-10"
  dateOfJoiningDepartment?: string; // e.g. "2010-04-10"
  dateOfJoiningPresentSchool?: string; // e.g. "2022-04-01"
  currentSchool?: string;
  previousSchool?: string;
  transferDate?: string;
  appointmentOrderNumber?: string;
  employeeCategory?: 'General' | 'RBA' | 'SC' | 'ST' | 'ALC' | 'EWS';
  employmentType?: 'Permanent (Gazetted)' | 'Permanent (Non-Gazetted)' | 'ReT / General Line' | 'Contractual';
  employmentStatus: 'Regular' | 'Contract' | 'Deputation';
  contactNumber: string;
  email: string;
  residentialAddress: string;
  district?: string; // e.g. "Baramulla"
  schoolName?: string;
  schoolId?: string;
  qualifications: string;
  casualLeaveBalance: number;
  medicalLeaveBalance: number;
  earnedLeaveBalance: number;

  // Official Service Calculations & Dates
  retirementDate?: string; // J&K Rule 60 Years (verified or calculated)
  isRetirementDateCalculated?: boolean;
  serviceRemarks?: string;
  serviceHistory?: TeacherServiceRecord[];

  // JKEPM Performance & Quarterly Records
  jkepmRecords?: JkEpmQuarterlyRecord[];
  jkepmScore?: number;
  jkepmStatus?: 'Verified' | 'Pending_Review' | 'Updated';

  // Account Credentials & Status
  username?: string;
  passwordHash?: string;
  accountStatus?: 'Active' | 'Inactive';
  latestHoiRemarks?: string;
  latestHoiRemarksUpdatedAt?: string;
  updatedAt?: string;
}

export type LeaveType = 'Casual_Leave' | 'Medical_Leave' | 'Earned_Leave' | 'Special_Duty' | 'Maternity_Paternity';
export type LeaveStatus = 'Pending' | 'Under_Review' | 'Approved' | 'Rejected';

export interface TeacherLeaveDocument {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
  uploadedAt: string;
  uploadedBy: string;
}

export interface TeacherLeaveAuditEntry {
  id: string;
  applicationId: string;
  action: 'CREATE' | 'EDIT' | 'UPLOAD_DOC' | 'REVIEW' | 'APPROVE' | 'REJECT' | 'DELETE';
  actorName: string;
  actorRole: string;
  timestamp: string;
  summary: string;
}

export interface TeacherLeaveApplication {
  id: string; // Application ID
  teacherId?: string; // Teacher ID
  employeeId: string; // CPIS / Employee ID
  teacherName: string;
  leaveType: LeaveType;
  applicationDate: string;
  startDate: string; // From Date
  endDate: string; // To Date
  totalDays: number;
  reason: string;
  supportingDocName?: string;
  medicalDocumentUrl?: string; // Primary Medical Document URL / data URL
  medicalDocuments?: TeacherLeaveDocument[]; // Uploaded PDF, JPG, PNG medical documents
  status: LeaveStatus;
  approvedBy?: string; // Approved / Rejected By
  reviewedBy?: string;
  reviewDate?: string;
  approvalDate?: string; // Approval / Rejection Date
  decisionDate?: string;
  remarks?: string; // Headmaster Remarks (backwards-compatible alias)
  headmasterRemarks?: string;
  rejectionReason?: string; // Mandatory on Reject
  createdAt?: string;
  updatedAt?: string;
  deletedStatus?: 'Active' | 'Deleted';
  deletedAt?: string;
  deletedBy?: string;
  deletionReason?: string;
  auditHistory?: TeacherLeaveAuditEntry[];
}

// Teacher Attendance & Location Verification
export interface TeacherCheckInLocation {
  latitude: number;
  longitude: number;
  distanceMeters: number;
  isWithinGeofence: boolean;
  accuracyMeters?: number;
  verifiedAt: string;
}

export type TeacherAttendanceStatus =
  | 'Present'
  | 'Absent'
  | 'Casual Leave (CL)'
  | 'Medical Leave (ML)'
  | 'On Duty (OD)'
  | 'Half Day'
  | 'Late Arrival'
  | 'Other'
  | 'Late'
  | 'On_Duty'
  | 'Leave'
  | 'On Leave'
  | 'Official Duty'
  | 'Holiday'
  | 'Weekly Off';

export interface TeacherAttendanceChangeLogEntry {
  id: string;
  field: 'Arrival Time' | 'Departure Time' | 'Designation' | 'Attendance Status' | 'Remarks by HOI';
  previousValue: string;
  newValue: string;
  changedBy: string;
  changedByRole: string;
  changedAt: string; // ISO timestamp
}

export interface TeacherAttendanceRecord {
  id: string;
  date: string; // YYYY-MM-DD
  teacherId: string;
  employeeId: string;
  teacherName: string;
  designation?: string;
  status: TeacherAttendanceStatus;
  checkInTime?: string; // Arrival Time (HH:MM AM/PM)
  checkOutTime?: string; // Departure Time (HH:MM AM/PM)
  checkInLocation?: TeacherCheckInLocation;
  remarks?: string;
  remarksByHoi?: string;
  updatedAt?: string;
  updatedBy?: string;
  changeHistory?: TeacherAttendanceChangeLogEntry[];
}

export interface SubjectConfig {
  code: string;
  name: string;
  nameHi?: string;
  nameUrdu?: string;
  maxMarks: number;
  passingMarks: number;
  isCompulsory: boolean;
}

export interface Examination {
  id: string;
  name: string; // e.g. "Half-Yearly Examination 2026"
  nameHi?: string;
  nameUrdu?: string;
  academicSession: string;
  startDate: string;
  endDate: string;
  classes: string[]; // ['5', '6', '7', '8']
  subjects: { [classNumber: string]: SubjectConfig[] };
  isFinalized: boolean;
}

export interface StudentMarkEntry {
  id: string;
  examId: string;
  studentId: string;
  classNumber: string;
  section: string;
  subjectCode: string;
  maxMarks: number;
  marksObtained: number | null; // null if absent
  isAbsent: boolean;
  isMedicalExempt?: boolean;
  grade: string;
  passed: boolean;
  remarks?: string;
  attendanceMarks?: number; // Attendance assigned points
}

export interface StudentExamSummary {
  studentId: string;
  studentName: string;
  rollNumber: number;
  classNumber: string;
  section: string;
  examId: string;
  examName: string;
  totalMaxMarks: number;
  totalMarksObtained: number;
  percentage: number;
  overallGrade: string;
  isPassed: boolean;
  compulsoryFailed: boolean;
  attendancePercentage: number;
  attendanceMarks?: number; // Points out of 5/10 assigned for attendance
  totalGradePoints?: number;
  averageGradePoints?: number;
  subjectMarks: {
    subjectCode: string;
    subjectName: string;
    maxMarks: number;
    marksObtained: number | null;
    isAbsent: boolean;
    grade: string;
    gradePoints?: number;
    passed: boolean;
  }[];
}

export type TextbookStatus =
  | 'Received_From_School'
  | 'Not_Available_In_School'
  | 'Not_Received_By_Student'
  | 'Partially_Received'
  | 'Pending_Distribution';

export interface TextbookDistributionRecord {
  id: string;
  studentId: string;
  studentName: string;
  classNumber: string;
  section: string;
  academicSession: string;
  subject: string;
  textbookName: string;
  textbookNameUrdu?: string;
  prescribedEdition: string;
  distributionDate: string;
  quantityRequired: number;
  quantityReceived: number;
  status: TextbookStatus;
  responsibleTeacherName: string;
  remarks?: string;
}

export interface TeacherPerformanceReport {
  teacherId: string;
  teacherName: string;
  employeeId: string;
  subjectName: string;
  classNumber: string;
  section: string;
  examName: string;
  enrolledStudents: number;
  assessedStudents: number;
  passedStudents: number;
  failedStudents: number;
  absentStudents: number;
  passPercentage: number;
  averageMarks: number;
  averagePercentage: number;
  highestMarks: number;
  lowestMarks: number;
  gradeDistribution: { [grade: string]: number };
}

// Offline Synchronization Types
export type OfflineSyncCategory = 'attendance' | 'student' | 'marks' | 'textbook' | 'leave' | 'general';

export interface OfflineSyncItem {
  id: string;
  category: OfflineSyncCategory;
  title: string;
  subtitle: string;
  timestamp: string;
  sizeBytes?: number;
  payload: any;
  status: 'pending' | 'uploading' | 'synced' | 'failed';
  error?: string;
}

export interface OfflineSyncProgress {
  isSyncing: boolean;
  currentIndex: number;
  totalCount: number;
  currentItem?: OfflineSyncItem | null;
  completedItems: OfflineSyncItem[];
  pendingItems: OfflineSyncItem[];
  failedItems?: OfflineSyncItem[];
  percentage: number;
  speedKbps?: number;
}

export interface FailedSyncLog {
  id: string;
  timestamp: string;
  errorCode: string;
  errorMessage: string;
  endpoint: string;
  httpStatus: number;
  retryAttempts: number;
  affectedCategory: OfflineSyncCategory;
  affectedRecordId: string;
  payloadSummary: string;
  networkState: {
    online: boolean;
    effectiveType: string;
    downlinkMbps: number;
    rttMs: number;
  };
}

export interface SyncConflictItem {
  id: string;
  category: OfflineSyncCategory;
  studentId?: string;
  studentName?: string;
  rollNumber?: number;
  classNumber?: string;
  section?: string;
  title: string;
  dateOrExam: string;
  localValue: string | number;
  localModifiedAt: string;
  serverValue: string | number;
  serverModifiedAt: string;
  chosenResolution?: 'local' | 'server';
  similarityKey: string;
}

// ============================================================================
// Holistic Progress Card (HPC) & Student Development Types
// ============================================================================
export type HolisticRatingLevel = 'Outstanding' | 'Very Good' | 'Good' | 'Developing' | 'Needs Support';

export interface HolisticCategoryDefinition {
  id: string;
  name: string;
  nameUrdu?: string;
  description: string;
  domain: 'Cognitive' | 'Socio-Emotional' | 'Physical & Creative' | 'Life Skills';
}

export interface StudentHolisticRecord {
  id: string;
  studentId: string;
  studentName: string;
  classNumber: string;
  section: string;
  academicSession: string;
  assessedByTeacherId: string;
  assessedByTeacherName: string;
  assessedDate: string;
  ratings: Record<string, HolisticRatingLevel>; // key is category id or name
  observations: Record<string, string>;
  strengths: string;
  areasForImprovement: string;
  teacherRemarks: string;
  suggestionsForParents: string;
  goalsForNextTerm: string;
  coScholasticRemarks?: string;
  attendancePercentageOverride?: number;
  attendanceRemarks?: string;
  healthPhysicalEducation?: string;
  artEducation?: string;
  workEducation?: string;
  lifeSkillsSummary?: string;
  valuesAndBehaviour?: string;
  schoolActivitiesParticipation?: string;
  parentRemarks?: string;
  overallStudentDevelopment?: string;
  status?: 'Completed' | 'Pending';
  updatedAt?: string;
}

export interface HolisticProgressCardData {
  student: Student;
  academicSession: string;
  examinationName: string;
  subjectResults: {
    subjectName: string;
    subjectCode: string;
    maxMarks: number;
    marksObtained: number | null;
    percentage: number;
    grade: string;
    teacherRemarks: string;
  }[];
  totalMaxMarks: number;
  totalMarksObtained: number;
  overallAcademicPercentage: number;
  overallGrade: string;
  attendance: {
    totalWorkingDays: number;
    daysPresent: number;
    daysAbsent: number;
    attendancePercentage: number;
  };
  holisticRecord?: StudentHolisticRecord;
  classTeacherName: string;
  administratorName: string;
}

// ============================================================================
// Smart School Identity Card Maker Types
// ============================================================================
export type IdCardCategory = 'student' | 'teacher';

export type IdCardTemplateId =
  | 'modern'
  | 'premium'
  | 'horizontal'
  | 'vertical'
  | 'student_classic'
  | 'teacher_executive';

export type IdCardStatus = 'Valid' | 'Expired' | 'Invalid';

export type IdCardFontStyle = 'jakarta' | 'serif' | 'mono' | 'outfit';
export type IdCardFontSize = 'compact' | 'standard' | 'large';

export interface IdCardQrPrivacySettings {
  showFatherName: boolean;
  showClassOrDesignation: boolean;
  showRollOrEmployeeId: boolean;
  showSchoolAddress: boolean;
  showResidentialAddress: boolean;
  showContactNumber: boolean;
  showParentContact: boolean;
  showDob: boolean;
  showBloodGroup: boolean;
  requireAdminForConfidential: boolean;
}

export interface IdCardDesignConfig {
  templateId: IdCardTemplateId;
  backgroundColor: string;
  accentColor: string;
  textColor: string;
  fontStyle: IdCardFontStyle;
  fontSize: IdCardFontSize;
  showMotto: boolean;
  motto: string;
  emergencyContact: string;
  defaultValidityDate: string; // YYYY-MM-DD
  schoolLogoDataUrl?: string;
  schoolStampDataUrl?: string;
  principalSignatureDataUrl?: string;
}

export interface SchoolIdCardRecord {
  id: string;
  uniqueIdNumber: string; // e.g. "ID-STU-2026-0001"
  category: IdCardCategory;
  linkedStudentId?: string;
  linkedTeacherId?: string;

  // Shared / Core Fields
  fullName: string;
  fatherName: string;
  motherName?: string; // Student optional
  dob?: string; // Student required, Teacher optional
  bloodGroup?: string;
  schoolName: string;
  schoolAddress: string;
  residentialAddress: string;
  contactNumber: string;
  photoDataUrl?: string;
  principalSignatureDataUrl?: string;
  schoolLogoDataUrl?: string;
  schoolStampDataUrl?: string;

  // Student-Specific Fields (17 fields coverage)
  classNumber?: string;
  section?: string;
  rollNumber?: string;
  admissionNumber?: string;
  parentContactNumber?: string;
  academicSession?: string;

  // Teacher-Specific Fields (15 fields coverage)
  designation?: string;
  employeeId?: string;
  qualification?: string;
  subject?: string;
  dateOfJoining?: string;

  // Design Override & Card Metadata
  templateId: IdCardTemplateId;
  backgroundColor?: string;
  accentColor?: string;
  motto?: string;
  emergencyContact?: string;

  // Verification, Lifecycle & Duplicate Tracking
  issueDate: string; // YYYY-MM-DD
  expiryDate: string; // YYYY-MM-DD
  status: IdCardStatus;
  isDuplicate: boolean;
  duplicateCount: number;
  createdAt: string;
  updatedAt: string;
}

// =========================================================================
// CPIS CODE CHANGE & JKEPM QUARTERLY SELF-ASSESSMENT & APPRAISAL PORTAL
// =========================================================================

export type JkepmQuarter = 'Q1 (Apr - Jun)' | 'Q2 (Jul - Sep)' | 'Q3 (Oct - Dec)' | 'Q4 (Jan - Mar)';

export type JkepmAppraisalStatus =
  | 'Draft'
  | 'Submitted'
  | 'Returned_For_Correction'
  | 'Recommended_By_HOI'
  | 'Approved'
  | 'Rejected';

export interface JkepmClassTeachingDetail {
  id: string;
  classNumber: string; // '1' to '12'
  section: string;
  subject: string;
  periodsAllotted: number;
  periodsConducted: number;
  classTimetable: string;
  teachingActivitiesCompleted: string;
  syllabusCoveredPct: number;
  syllabusDetails: string;
  learningOutcomesAchieved: string;
  studentAssessmentDetails: string;
  remedialTeachingActivities: string;
}

export type JkepmAssignmentCategory =
  | 'School Timetable & Teaching Schedule'
  | 'Morning Assembly Duties'
  | 'Examination Duties'
  | 'Evaluation & Answer Script Checking'
  | 'Mid-Day Meal (MDM) Duties'
  | 'School Administrative Assignments'
  | 'Co-Curricular Activities'
  | 'Sports & Cultural Activities'
  | 'Election / Official Government Duties'
  | 'Additional Responsibility (HOI Assigned)';

export interface JkepmSchoolAssignment {
  id: string;
  category: JkepmAssignmentCategory;
  title: string;
  scheduleOrPeriod: string;
  description: string;
  assignedBy: string;
  completionStatus: 'Ongoing' | 'Completed' | 'Scheduled';
}

export type JkepmLeaveCategory = 'Casual_Leave' | 'Medical_Leave' | 'Earned_Leave' | 'Other_Leave';

export interface JkepmSupportingDocument {
  id: string;
  name: string;
  docType: 'Medical Certificate' | 'Leave Sanction Order' | 'Official Permission Letter' | 'Other';
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  dataUrl?: string;
}

export interface JkepmLeaveEntry {
  id: string;
  leaveType: JkepmLeaveCategory;
  days: number;
  fromDate: string; // YYYY-MM-DD
  toDate: string; // YYYY-MM-DD
  medicalSanctionOrderNo?: string;
  medicalSanctionOrderDate?: string;
  casualSanctionOrderNo?: string;
  remarks: string;
  supportingDocuments: JkepmSupportingDocument[];
}

export interface JkepmAttendanceLeaveSummary {
  totalWorkingDays: number;
  totalDaysAttended: number;
  casualLeaves: number;
  medicalLeaves: number;
  earnedLeaves: number;
  otherLeaves: number;
  totalLeaveDays: number;
  attendancePercentage: number;
  leavePeriodFrom: string;
  leavePeriodTo: string;
  medicalSanctionOrderNumber: string;
  medicalSanctionOrderDate: string;
  casualSanctionOrderNumber: string;
  remarks: string;
  leaveRecords: JkepmLeaveEntry[];
  supportingDocuments: JkepmSupportingDocument[];
}

export interface JkepmAuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: string;
  action:
    | 'CPIS_CODE_MIGRATED'
    | 'CPIS_CODE_APPROVED'
    | 'CPIS_CODE_REJECTED'
    | 'REPORT_CREATED'
    | 'REPORT_DRAFT_SAVED'
    | 'REPORT_EDITED'
    | 'REPORT_SUBMITTED'
    | 'REPORT_RETURNED'
    | 'REPORT_RECOMMENDED'
    | 'REPORT_APPROVED'
    | 'REPORT_REJECTED'
    | 'REPORT_DELETED'
    | 'DOCUMENT_UPLOADED';
  entityId: string;
  summary: string;
  previousValue?: string;
  newValue?: string;
}

export interface CpisCodeMigrationRecord {
  id: string;
  teacherId: string;
  teacherName: string;
  designation: string;
  schoolName: string;
  schoolUdiseCode: string;
  oldCpisCode: string;
  newCpisCode: string;
  status: 'Pending_Verification' | 'Approved' | 'Rejected';
  requestedByUserId: string;
  requestedByName: string;
  requestedAt: string;
  verifiedByUserId?: string;
  verifiedByName?: string;
  verifiedAt?: string;
  remarks: string;
}

export interface JkepmQuarterlyAppraisalReport {
  id: string;
  // Teacher Particulars (10 fields)
  teacherId: string;
  teacherName: string;
  employeeId: string;
  designation: string;
  schoolName: string;
  schoolUdiseCode: string;
  cpisCode: string; // Updated CPIS Code e.g. "KHYEDU 00220000"
  previousCpisCode?: string; // Preserved audit reference e.g. "JK-EDU-1985-0451"
  academicSession: string;
  quarter: JkepmQuarter;
  reportingPeriod: string;
  dateOfJoining: string;

  // Performance Parts
  classTeachingDetails: JkepmClassTeachingDetail[];
  schoolAssignments: JkepmSchoolAssignment[];
  attendanceAndLeave: JkepmAttendanceLeaveSummary;

  // Self-Assessment Score & Declaration
  selfAssessmentScore: number; // out of 10
  teacherDeclarationAccepted: boolean;
  teacherDeclarationDate?: string;

  // Workflow Status & HOI / District Review
  status: JkepmAppraisalStatus;
  submittedAt?: string;
  hoiRemarks?: string;
  hoiReviewerName?: string;
  hoiReviewedAt?: string;
  districtRemarks?: string;
  districtOfficerName?: string;
  districtApprovedAt?: string;

  // Metadata
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  isArchivedDeleted?: boolean;
}

