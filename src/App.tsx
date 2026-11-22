/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { Sidebar, TabType } from './components/Sidebar';
import { BottomNav } from './components/BottomNav';
import { Dashboard } from './components/Dashboard';
import { StudentManagement } from './components/StudentManagement';
import { DailyAttendance } from './components/DailyAttendance';
import { MonthlyAttendance } from './components/MonthlyAttendance';
import { TeacherManagement } from './components/TeacherManagement';
import { TeacherLeave } from './components/TeacherLeave';
import { ExaminationModule } from './components/ExaminationModule';
import { ReportCardGenerator } from './components/ReportCardGenerator';
import { TeacherPerformance } from './components/TeacherPerformance';
import { ReportsCenter } from './components/ReportsCenter';
import { SchoolSettings } from './components/SchoolSettings';
import { AcceptanceTestsModal } from './components/AcceptanceTestsModal';
import { AndroidApkGuideModal } from './components/AndroidApkGuideModal';
import { MultiPlatformAppModal } from './components/MultiPlatformAppModal';
import { TextbookDistribution } from './components/TextbookDistribution';
import { AdminAccessControl } from './components/AdminAccessControl';
import { ClassManagement } from './components/ClassManagement';
import { SubjectManagement } from './components/SubjectManagement';
import { MarksEntryModule } from './components/MarksEntryModule';
import { EvaluationRegister } from './components/EvaluationRegister';
import { ExcelStudentImportRegister } from './components/ExcelStudentImportRegister';
import { ExcelTemplateMappingPage } from './components/ExcelTemplateMappingPage';
import { HolisticAssessmentModule } from './components/HolisticAssessmentModule';
import { DownloadCenterModal } from './components/DownloadCenterModal';
import { PermissionsProvider, usePermissions } from './hooks/usePermissions';
import { OfflineIndicator } from './components/OfflineIndicator';
import { defaultPendingSyncQueue } from './utils/syncDiagnostics';
import { SchoolNameDesignEditor } from './components/SchoolNameDesignEditor';
import { TeacherSubjectResultCard } from './components/TeacherSubjectResultCard';
import { AboutUsAppInfo } from './components/AboutUsAppInfo';
import { SmartIdCardMaker } from './components/SmartIdCardMaker';
import { PrincipalManagement } from './components/PrincipalManagement';
import { JkepmAppraisalPortal } from './components/JkepmAppraisalPortal';
import { SchoolEmblem } from './components/SchoolEmblem';
import {
  NEW_CPIS_CODE_OFFICIAL,
  OLD_CPIS_CODE_LEGACY,
  normalizeCpisCode,
} from './utils/jkepmReportExport';
import {
  deleteExcelMappingSchemaFromFirestore,
  deletePrincipalFromFirestore,
  FirebaseSyncSummary,
  signInWithGoogleAdmin,
  signOutFirebaseAdmin,
  subscribeFirebaseAuth,
  syncAllAttendanceAndLeavesToFirebase,
  syncExcelMappingSchemaToFirestore,
  syncPrincipalToFirestore,
  syncSchoolProfileToFirestore,
  syncStudentsBatchToFirestore,
  syncTeacherAttendanceToFirestore,
  syncTeacherLeaveToFirestore,
  testFirestoreConnection,
  subscribeFcmForegroundMessages,
} from './firebase';
import {
  dispatchLeaveDecisionNotification,
  emitPushNotification,
  evaluateAttendanceThresholdNotification,
  evaluateUpcomingExamNotifications,
  monitorAttendanceAndNotifyPrincipal,
  runScheduledExamReminderCheck,
  startAutomatedNotificationScheduler,
} from './utils/pushNotifications';
import type { User as FirebaseUser } from 'firebase/auth';
import {
  DEFAULT_QR_PRIVACY_SETTINGS,
  getDefaultDesignConfig,
  studentToIdCardRecord,
  teacherToIdCardRecord,
} from './utils/idCardRenderer';
import {
  deduplicateMarksEntries,
  deduplicateStudentsByAdmissionNumber,
} from './utils/calculations';
import {
  AttendanceAuditLog,
  AttendanceRecord,
  DeveloperAdminProfile,
  Examination,
  ExcelMappingSchema,
  IdCardDesignConfig,
  IdCardQrPrivacySettings,
  PrincipalRecord,
  SchoolIdCardRecord,
  SchoolProfile,
  Student,
  StudentHistoryEvent,
  StudentHolisticRecord,
  StudentMarkEntry,
  SubjectConfig,
  TeacherLeaveApplication,
  TeacherProfile,
  TeacherAttendanceRecord,
  TextbookDistributionRecord,
  User,
  OfflineSyncItem,
  OfflineSyncProgress,
} from './types';
import { loadExcelMappingSchemas, saveExcelMappingSchemas } from './utils/ocrStudentExtractor';
import { isLegacySchoolAddress } from './utils/calculations';
import { Language, translations } from './utils/translations';
import {
  generateSampleAttendance,
  initialDeveloperAdminProfile,
  initialSchoolProfile,
  sampleAuditLogs,
  sampleExaminations,
  sampleHolisticRecords,
  sampleMarksEntries,
  sampleStudents,
  sampleSubjectConfigs,
  sampleTeacherLeaveApplications,
  sampleTeachers,
  sampleTeacherAttendanceRecords,
  sampleTextbookRecords,
  sampleUsers,
  samplePrincipals,
  STANDARDIZED_ADDRESS,
} from './utils/sampleData';
import { Smartphone, X, Lock, ShieldCheck } from 'lucide-react';

const STORAGE_KEY_PREFIX = 'school_master_v1_';

function SchoolMasterApp() {
  const {
    currentUser: authAdminUser,
    adminUsers,
    effectiveRole,
    simulatedRole,
    setSimulatedRole,
    setCurrentUserById,
  } = usePermissions();

  const [isDownloadHubOpen, setIsDownloadHubOpen] = useState<boolean>(false);

  // 1. Language state
  const [language, setLanguage] = useState<Language>(() => {
    return (localStorage.getItem(`${STORAGE_KEY_PREFIX}lang`) as Language) || 'en';
  });

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}lang`, language);
  }, [language]);

  // 2. Active Tab state (supports ?tab=... deep links & PWA shortcuts)
  const [currentTab, setCurrentTab] = useState<TabType>(() => {
    try {
      const rawTab = new URLSearchParams(window.location.search).get('tab')?.trim().toLowerCase();
      if (!rawTab) return 'dashboard';
      const aliasMap: Record<string, TabType> = {
        'daily-attendance': 'attendance',
        'student-id-cards': 'id-card-maker',
        'examination': 'examinations',
      };
      const validTabs = new Set<TabType>([
        'dashboard', 'students', 'classes', 'subjects', 'marks-entry', 'evaluation-register',
        'attendance', 'holistic-assessment', 'progress-cards', 'teacher-subject-results',
        'banner-editor', 'reports', 'staff-management', 'settings', 'monthly-attendance',
        'textbooks', 'teachers', 'teacher-leave', 'examinations', 'student-results',
        'teacher-performance', 'admin-access', 'super-admin', 'excel-import',
        'excel-template-mapping', 'id-card-maker', 'principal-management', 'jkepm-appraisal',
        'about-us',
      ]);
      const resolved = (aliasMap[rawTab] || rawTab) as TabType;
      return validTabs.has(resolved) ? resolved : 'dashboard';
    } catch {
      return 'dashboard';
    }
  });
  const [principalInitialMode, setPrincipalInitialMode] = useState<'list' | 'add' | 'edit'>('list');
  const [teacherSubTab, setTeacherSubTab] = useState<'jkhrms' | 'service-book' | 'jkepm' | 'attendance'>('jkhrms');
  const [settingsSubTab, setSettingsSubTab] = useState<'profile' | 'administrative' | 'location' | 'grading' | 'holidays' | 'backup' | 'admin-access'>('profile');
  const [isSessionLocked, setIsSessionLocked] = useState<boolean>(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState<boolean>(false);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isSyncingCloud, setIsSyncingCloud] = useState<boolean>(false);

  // 3. Device simulation mode
  const [deviceView, setDeviceView] = useState<'desktop' | 'phone' | 'tablet'>('desktop');

  // 4. Current User & Users
  const [users] = useState<User[]>(sampleUsers);
  const [currentUser, setCurrentUser] = useState<User>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}current_user`);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return sampleUsers[0]; // Admin by default
  });

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}current_user`, JSON.stringify(currentUser));
  }, [currentUser]);

  // 5. School Profile
  const [school, setSchool] = useState<SchoolProfile>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}school`);
    if (saved) {
      try {
        const parsed: SchoolProfile = JSON.parse(saved);
        if (
          parsed.state === 'Uttar Pradesh' ||
          !parsed.state ||
          parsed.name.includes('Pattan') ||
          parsed.name.includes('Model') ||
          parsed.name.includes('Boys') ||
          !parsed.nameUrdu ||
          parsed.nameUrdu.includes('ماڈل')
        ) {
          parsed.name = 'Govt Middle School Pamposh Colony';
          parsed.nameUrdu = 'گورنمنٹ مڈل اسکول پامپوش کالونی';
          parsed.nameHi = 'राजकीय मध्य विद्यालय पम्पोष कॉलोनी';
          parsed.state = 'Jammu and Kashmir';
          parsed.district = 'Srinagar';
          parsed.villageTown = 'Pamposh Colony';
          parsed.blockTehsil = 'Palapora Zone, Iddgah';
          parsed.pinCode = '';
          parsed.address = STANDARDIZED_ADDRESS;
          parsed.locationAddress = 'Campus Main Gate, Pamposh Colony, Palapora Zone, Iddgah';
        }
        // Always migrate legacy Palpora/Tehsil Iddgah/190017 address to the updated official address
        if (!parsed.address || isLegacySchoolAddress(parsed.address)) {
          parsed.address = STANDARDIZED_ADDRESS;
          parsed.villageTown = 'Pamposh Colony';
          parsed.blockTehsil = 'Palapora Zone, Iddgah';
          if (parsed.pinCode === '190017') parsed.pinCode = '';
        }
        if (!parsed.locationAddress || isLegacySchoolAddress(parsed.locationAddress)) {
          parsed.locationAddress = 'Campus Main Gate, Pamposh Colony, Palapora Zone, Iddgah';
        }
        return parsed;
      } catch (e) { /* ignore */ }
    }
    return initialSchoolProfile;
  });

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}school`, JSON.stringify(school));
  }, [school]);

  // 5.5 Administrator / App Developer Profiles (About Us / App Information)
  const [devAdminProfiles, setDevAdminProfiles] = useState<DeveloperAdminProfile[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}dev_profiles`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) { /* ignore */ }
    }
    return [initialDeveloperAdminProfile];
  });

  const [activeDevAdminId, setActiveDevAdminId] = useState<string>(() => {
    return localStorage.getItem(`${STORAGE_KEY_PREFIX}active_dev_profile_id`) || initialDeveloperAdminProfile.id;
  });

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}dev_profiles`, JSON.stringify(devAdminProfiles));
  }, [devAdminProfiles]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}active_dev_profile_id`, activeDevAdminId);
  }, [activeDevAdminId]);

  const activeDevAdmin =
    devAdminProfiles.find((p) => p.id === activeDevAdminId) || devAdminProfiles[0] || initialDeveloperAdminProfile;

  const syncSchoolWithAdminProfile = (prof: DeveloperAdminProfile) => {
    localStorage.setItem('sm_admin_profile_name', prof.name);
    setSchool((prev) => {
      const locationChanged =
        (prof.district && prof.district.toLowerCase() !== (prev.district || '').toLowerCase()) ||
        (prof.locality && !(prev.address || '').toLowerCase().includes(prof.locality.toLowerCase()));

      const updatedAddress = locationChanged
        ? `${[prof.locality || prev.villageTown, prof.district ? `District ${prof.district}` : '', prof.unionTerritory || prev.state].filter(Boolean).join(', ')}${prev.pinCode ? ` - ${prev.pinCode}` : ''}`
        : prev.address;

      return {
        ...prev,
        name: prof.institution || prev.name,
        adminName: prof.name,
        district: prof.district || prev.district,
        villageTown: prof.locality || prev.villageTown,
        address: updatedAddress,
      };
    });
  };

  const handleSaveDevAdminProfile = (updated: DeveloperAdminProfile) => {
    setDevAdminProfiles((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    syncSchoolWithAdminProfile(updated);
  };

  const handleAddDevAdminProfile = (created: DeveloperAdminProfile) => {
    setDevAdminProfiles((prev) => [created, ...prev]);
    setActiveDevAdminId(created.id);
    syncSchoolWithAdminProfile(created);
  };

  const handleSelectActiveDevAdmin = (profileId: string) => {
    const found = devAdminProfiles.find((p) => p.id === profileId);
    if (found) {
      setActiveDevAdminId(found.id);
      syncSchoolWithAdminProfile(found);
    }
  };

  // 5.7 Principal / Headmaster Records & Firebase Auth Sync
  const [principals, setPrincipals] = useState<PrincipalRecord[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}principals`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch { /* ignore */ }
    }
    return samplePrincipals;
  });

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}principals`, JSON.stringify(principals));
  }, [principals]);

  useEffect(() => {
    testFirestoreConnection().catch(() => {});
    const unsubAuth = subscribeFirebaseAuth((user) => {
      setFirebaseUser(user);
    });
    let unsubFcm: () => void = () => {};
    subscribeFcmForegroundMessages((payload) => {
      const title = payload.notification?.title || payload.data?.title || 'GMS Pamposh Colony Alert';
      const body = payload.notification?.body || payload.data?.message || '';
      if (title || body) {
        emitPushNotification({
          title,
          message: body,
          category: (payload.data?.category as any) || 'System',
          targetRole: (payload.data?.targetRole as any) || 'all',
          priority: payload.data?.priority === 'high' ? 'high' : 'normal',
        });
      }
    }).then((fn) => {
      unsubFcm = fn;
    });
    return () => {
      unsubAuth();
      unsubFcm();
    };
  }, []);

  const syncSchoolWithActivePrincipal = (rec: PrincipalRecord) => {
    setSchool((prev) => {
      // Never automatically overwrite Headmaster details from another module/database once manually edited or persisted.
      if (prev.headmasterManuallyEdited || (prev.headmasterName && prev.headmasterName.trim().length > 0)) {
        return prev;
      }
      return {
        ...prev,
        headTeacherName: rec.fullName,
        headmasterName: rec.fullName,
        principalDesignation: rec.designation,
        headmasterQualification: prev.headmasterQualification || rec.qualification,
        headmasterContact: prev.headmasterContact || rec.contactNumber,
        headmasterEmail: prev.headmasterEmail || rec.email,
        headmasterJoiningDate: prev.headmasterJoiningDate || rec.joiningDate,
        contactNumber: rec.contactNumber || prev.contactNumber,
      };
    });
  };

  const handleAddPrincipal = async (record: PrincipalRecord) => {
    setPrincipals((prev) => {
      const normalized = record.isCurrent ? prev.map((p) => ({ ...p, isCurrent: false })) : prev;
      return [record, ...normalized];
    });
    if (record.isCurrent) syncSchoolWithActivePrincipal(record);
    try {
      await syncPrincipalToFirestore(record, true);
    } catch { /* optional if offline */ }
  };

  const handleUpdatePrincipal = async (record: PrincipalRecord) => {
    setPrincipals((prev) =>
      prev.map((p) => {
        if (p.id === record.id) return record;
        return record.isCurrent ? { ...p, isCurrent: false } : p;
      })
    );
    if (record.isCurrent) syncSchoolWithActivePrincipal(record);
    try {
      await syncPrincipalToFirestore(record, false);
    } catch { /* optional if offline */ }
  };

  const handleDeletePrincipal = async (principalId: string) => {
    setPrincipals((prev) => {
      const remaining = prev.filter((p) => p.id !== principalId);
      if (remaining.length > 0 && !remaining.some((p) => p.isCurrent)) {
        remaining[0] = { ...remaining[0], isCurrent: true };
        syncSchoolWithActivePrincipal(remaining[0]);
      }
      return remaining;
    });
    try {
      await deletePrincipalFromFirestore(principalId);
    } catch { /* optional if offline */ }
  };

  const handleSetCurrentPrincipal = async (principalId: string) => {
    let chosen: PrincipalRecord | undefined;
    setPrincipals((prev) =>
      prev.map((p) => {
        const nextIsCurrent = p.id === principalId;
        const updated = { ...p, isCurrent: nextIsCurrent, updatedAt: new Date().toISOString() };
        if (nextIsCurrent) chosen = updated;
        return updated;
      })
    );
    if (chosen) {
      syncSchoolWithActivePrincipal(chosen);
      try {
        await syncPrincipalToFirestore(chosen, false);
      } catch { /* optional if offline */ }
    }
  };

  const handleCloudBackupSync = async () => {
    setIsSyncingCloud(true);
    try {
      await syncSchoolProfileToFirestore(school);
      for (const p of principals) {
        await syncPrincipalToFirestore(p, false);
      }
      await syncStudentsBatchToFirestore(students);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSyncingCloud(false);
    }
  };

  // 6. Students
  const [students, setStudents] = useState<Student[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}students`);
    if (saved) {
      try {
        let parsed: Student[] = JSON.parse(saved);
        parsed = parsed.map((s) => {
          // Standardize legacy addresses to Pamposh Colony, Palapora Zone, Iddgah
          if (
            !s.address ||
            isLegacySchoolAddress(s.address) ||
            s.address.includes('Pattan') ||
            s.district === 'Baramulla' ||
            s.address.includes('Bhojipura') ||
            s.villageTown === 'Pattan' ||
            s.villageTown === 'Fatehganj' ||
            s.villageTown === 'Rampur' ||
            s.state === 'Uttar Pradesh' ||
            !s.state
          ) {
            return {
              ...s,
              address: STANDARDIZED_ADDRESS,
              villageTown: 'Pamposh Colony',
              blockTehsil: 'Palapora Zone, Iddgah',
              district: 'Srinagar',
              state: 'Jammu and Kashmir',
              pinCode: s.pinCode === '190017' ? '' : s.pinCode || '',
            };
          }
          return s;
        });
        const hasOctoberBday = parsed.some((s) => s.dob && s.dob.split('-')[1] === '10');
        if (!hasOctoberBday) {
          parsed = parsed.map((s) => {
            if (s.fullName === 'Ananya Sharma') return { ...s, dob: '2015-10-31' };
            if (s.fullName === 'Mohammad Zaid') return { ...s, dob: '2015-10-24' };
            if (s.fullName === 'Kabir Khan') return { ...s, dob: '2015-10-15' };
            return s;
          });
        }
        return deduplicateStudentsByAdmissionNumber(parsed);
      } catch (e) { /* ignore */ }
    }
    return deduplicateStudentsByAdmissionNumber(sampleStudents);
  });

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}students`, JSON.stringify(students));
  }, [students]);

  // 7. Teachers (JKHRMS & JKEPM Integrated)
  const [teachers, setTeachers] = useState<TeacherProfile[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}teachers`);
    if (saved) {
      try {
        let parsed: TeacherProfile[] = JSON.parse(saved);
        if (parsed.length > 0 && (!parsed[0].dob || !parsed[0].dateOfJoiningDepartment)) {
          return sampleTeachers;
        }
        parsed = parsed.map((tc) => {
          let updated = { ...tc };
          if (
            !tc.residentialAddress ||
            isLegacySchoolAddress(tc.residentialAddress) ||
            tc.residentialAddress.includes('Pattan') ||
            tc.district === 'Baramulla'
          ) {
            updated.residentialAddress = STANDARDIZED_ADDRESS;
            updated.district = 'Srinagar';
          }
          if (!updated.currentSchool || updated.currentSchool.includes('Pattan') || updated.currentSchool.includes('Model')) {
            updated.currentSchool = 'Govt Middle School Pamposh Colony';
          }
          if (!updated.schoolName || updated.schoolName.includes('Pattan') || updated.schoolName.includes('Model')) {
            updated.schoolName = 'Govt Middle School Pamposh Colony';
          }
          if (updated.serviceHistory) {
            updated.serviceHistory = updated.serviceHistory.map((s) => {
              if (s.schoolName.includes('Pattan') || s.schoolName.includes('Model')) {
                return { ...s, schoolName: 'Govt Middle School Pamposh Colony', district: 'Srinagar' };
              }
              return s;
            });
          }
          if (
            normalizeCpisCode(updated.employeeId || '') === normalizeCpisCode(OLD_CPIS_CODE_LEGACY) ||
            (updated.id === 'tch-2' && updated.employeeId === 'TCH-101')
          ) {
            updated.previousCpisCode = updated.previousCpisCode || OLD_CPIS_CODE_LEGACY;
            updated.employeeId = NEW_CPIS_CODE_OFFICIAL;
          }
          return updated;
        });
        return parsed;
      } catch (e) { /* ignore */ }
    }
    return sampleTeachers;
  });

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}teachers`, JSON.stringify(teachers));
  }, [teachers]);

  // 8. Attendance Records & Audit Logs
  const [focusedStudentId, setFocusedStudentId] = useState<string | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}attendance`);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return generateSampleAttendance();
  });

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}attendance`, JSON.stringify(attendanceRecords));
  }, [attendanceRecords]);

  const [auditLogs, setAuditLogs] = useState<AttendanceAuditLog[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}audit_logs`);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return sampleAuditLogs;
  });

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}audit_logs`, JSON.stringify(auditLogs));
  }, [auditLogs]);

  // 9. Teacher Leaves
  const [leaveApplications, setLeaveApplications] = useState<TeacherLeaveApplication[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}leaves`);
    if (saved) {
      try {
        const parsed: TeacherLeaveApplication[] = JSON.parse(saved);
        return parsed.map((l) =>
          normalizeCpisCode(l.employeeId || '') === normalizeCpisCode(OLD_CPIS_CODE_LEGACY)
            ? { ...l, employeeId: NEW_CPIS_CODE_OFFICIAL }
            : l
        );
      } catch (e) { /* ignore */ }
    }
    return sampleTeacherLeaveApplications;
  });

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}leaves`, JSON.stringify(leaveApplications));
  }, [leaveApplications]);

  // 10. Examinations & Marks Entries (Yearly Examination 2026 as Configured Default)
  const [examinations, setExaminations] = useState<Examination[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}exams`);
    if (saved) {
      try {
        const parsed: Examination[] = JSON.parse(saved);
        if (!parsed.some((e) => e.id === 'exam-yearly-2026')) {
          return sampleExaminations;
        }
        return parsed;
      } catch (e) { /* ignore */ }
    }
    return sampleExaminations;
  });

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}exams`, JSON.stringify(examinations));
  }, [examinations]);

  // 10.5 Core Subject Configs & Order (Lifted & Synced Across Report Cards + Exam Schedules)
  const [subjectConfigs, setSubjectConfigs] = useState<SubjectConfig[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}subject_configs`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) { /* ignore */ }
    }
    return sampleSubjectConfigs;
  });

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}subject_configs`, JSON.stringify(subjectConfigs));
  }, [subjectConfigs]);

  const handleUpdateSubjectConfigs = (updatedSubjects: SubjectConfig[]) => {
    setSubjectConfigs(updatedSubjects);
    const orderIndex = new Map(updatedSubjects.map((s, idx) => [s.code, idx]));
    const updatedByCode = new Map(updatedSubjects.map((s) => [s.code, s]));

    // Sync new subject sequence & marks configuration directly into all examinations' class schedules
    setExaminations((prev) =>
      prev.map((exam) => {
        const nextSubjectsByClass: { [classNumber: string]: SubjectConfig[] } = {};
        Object.entries(exam.subjects).forEach(([cls, subList]) => {
          nextSubjectsByClass[cls] = [...subList]
            .map((sub) => {
              const cfg = updatedByCode.get(sub.code);
              return cfg
                ? {
                    ...sub,
                    name: cfg.name,
                    nameHi: cfg.nameHi,
                    nameUrdu: cfg.nameUrdu,
                    isCompulsory: cfg.isCompulsory,
                  }
                : sub;
            })
            .sort((a, b) => (orderIndex.get(a.code) ?? 999) - (orderIndex.get(b.code) ?? 999));
        });
        return {
          ...exam,
          subjects: nextSubjectsByClass,
        };
      })
    );
  };

  const [marksEntries, setMarksEntries] = useState<StudentMarkEntry[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}marks`);
    if (saved) {
      try {
        const parsed: StudentMarkEntry[] = JSON.parse(saved);
        if (parsed.length > 0 && !parsed.some((m) => m.examId === 'exam-yearly-2026')) {
          return deduplicateMarksEntries(sampleMarksEntries);
        }
        return deduplicateMarksEntries(parsed);
      } catch (e) { /* ignore */ }
    }
    return deduplicateMarksEntries(sampleMarksEntries);
  });

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}marks`, JSON.stringify(marksEntries));
  }, [marksEntries]);

  // 11. Free Textbook Distribution Records
  const [textbookRecords, setTextbookRecords] = useState<TextbookDistributionRecord[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}textbooks`);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return sampleTextbookRecords;
  });

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}textbooks`, JSON.stringify(textbookRecords));
  }, [textbookRecords]);

  // 11.2 Holistic Progress Records (Persisted)
  const [holisticRecords, setHolisticRecords] = useState<Record<string, StudentHolisticRecord>>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}holistic_records`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      } catch (e) { /* ignore */ }
    }
    return sampleHolisticRecords;
  });

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}holistic_records`, JSON.stringify(holisticRecords));
  }, [holisticRecords]);

  const handleSaveHolisticRecord = (record: StudentHolisticRecord) => {
    setHolisticRecords((prev) => ({
      ...prev,
      [record.studentId]: {
        ...record,
        updatedAt: new Date().toISOString(),
      },
    }));
  };

  // 11.5 Teacher Attendance & GPS Geofenced Check-Ins
  const [teacherAttendance, setTeacherAttendance] = useState<TeacherAttendanceRecord[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}teacher_attendance`);
    if (saved) {
      try {
        const parsed: TeacherAttendanceRecord[] = JSON.parse(saved);
        return parsed.map((rec) =>
          normalizeCpisCode(rec.employeeId || '') === normalizeCpisCode(OLD_CPIS_CODE_LEGACY)
            ? { ...rec, employeeId: NEW_CPIS_CODE_OFFICIAL }
            : rec
        );
      } catch (e) { /* ignore */ }
    }
    return sampleTeacherAttendanceRecords;
  });

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}teacher_attendance`, JSON.stringify(teacherAttendance));
  }, [teacherAttendance]);

  const handleSaveTeacherAttendance = (record: TeacherAttendanceRecord) => {
    const existingRecord = teacherAttendance.find(
      (r) => r.teacherId === record.teacherId && r.date === record.date
    );
    const enrichedRecord: TeacherAttendanceRecord = {
      ...record,
      id: existingRecord?.id || record.id || `att-${record.teacherId}-${record.date}`,
      updatedAt: new Date().toISOString(),
      updatedBy: record.updatedBy || currentUser.name,
    };
    setTeacherAttendance((prev) => {
      const idx = prev.findIndex((r) => r.teacherId === enrichedRecord.teacherId && r.date === enrichedRecord.date);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = enrichedRecord;
        return copy;
      }
      return [enrichedRecord, ...prev];
    });
    const isCurrentlyOffline = isOffline || (typeof navigator !== 'undefined' && !navigator.onLine);
    if (isCurrentlyOffline) {
      const queueItem: OfflineSyncItem = {
        id: `tatt-${enrichedRecord.id}`,
        category: 'attendance',
        title: `Teacher: ${enrichedRecord.teacherName} (${enrichedRecord.employeeId})`,
        subtitle: `Status: ${enrichedRecord.status} • Date: ${enrichedRecord.date}`,
        timestamp: enrichedRecord.updatedAt || new Date().toISOString(),
        sizeBytes: 980,
        payload: enrichedRecord,
        status: 'pending',
      };
      setOfflineSyncQueue((prev) => [
        ...prev.filter((item) => item.id !== queueItem.id),
        queueItem,
      ]);
      try {
        localStorage.setItem('sm_had_offline_period_v1', 'true');
      } catch { /* ignore */ }
    } else {
      fetch('/api/teacher-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(enrichedRecord),
      }).catch(() => {});
      syncTeacherAttendanceToFirestore(enrichedRecord, !existingRecord).catch(() => {});
    }
  };

  // 12. Offline Mode & Automated Firebase Sync Queue
  const [isOffline, setIsOffline] = useState<boolean>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}is_offline`);
    return saved !== null ? JSON.parse(saved) : false;
  });
  const [offlineSyncQueue, setOfflineSyncQueue] = useState<OfflineSyncItem[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}offline_queue`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) { /* ignore */ }
    }
    return defaultPendingSyncQueue;
  });
  const [lastFirebaseSyncSummary, setLastFirebaseSyncSummary] = useState<FirebaseSyncSummary | null>(() => {
    try {
      const raw = localStorage.getItem('sm_last_firebase_sync_v1');
      return raw ? (JSON.parse(raw) as FirebaseSyncSummary) : null;
    } catch {
      return null;
    }
  });
  const isSyncRunningRef = useRef<boolean>(false);
  const prevIsOfflineRef = useRef<boolean>(isOffline);
  const hadOfflinePeriodRef = useRef<boolean>(
    (() => {
      try {
        return (
          localStorage.getItem('sm_had_offline_period_v1') === 'true' ||
          (typeof navigator !== 'undefined' && !navigator.onLine)
        );
      } catch {
        return false;
      }
    })()
  );

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}is_offline`, JSON.stringify(isOffline));
    if (isOffline) {
      hadOfflinePeriodRef.current = true;
      try {
        localStorage.setItem('sm_had_offline_period_v1', 'true');
      } catch { /* ignore */ }
    }
  }, [isOffline]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}offline_queue`, JSON.stringify(offlineSyncQueue));
  }, [offlineSyncQueue]);
  const [syncProgress, setSyncProgress] = useState<OfflineSyncProgress | null>(null);

  // 11.8 Smart School ID Card Maker State
  const [idCardDesignConfig, setIdCardDesignConfig] = useState<IdCardDesignConfig>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}idcard_design`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) { /* ignore */ }
    }
    return getDefaultDesignConfig(school);
  });

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}idcard_design`, JSON.stringify(idCardDesignConfig));
  }, [idCardDesignConfig]);

  const [qrPrivacySettings, setQrPrivacySettings] = useState<IdCardQrPrivacySettings>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}idcard_privacy`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) { /* ignore */ }
    }
    return DEFAULT_QR_PRIVACY_SETTINGS;
  });

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}idcard_privacy`, JSON.stringify(qrPrivacySettings));
  }, [qrPrivacySettings]);

  const [idCardRecords, setIdCardRecords] = useState<SchoolIdCardRecord[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}idcard_records`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) { /* ignore */ }
    }
    const defDesign = getDefaultDesignConfig(school);
    const initialStuCards = students
      .filter((s) => s.status === 'Active')
      .slice(0, 6)
      .map((s) => studentToIdCardRecord(s, school, defDesign));
    const initialTchCards = teachers
      .slice(0, 4)
      .map((t) => teacherToIdCardRecord(t, school, defDesign));
    return [...initialStuCards, ...initialTchCards];
  });

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}idcard_records`, JSON.stringify(idCardRecords));
  }, [idCardRecords]);

  const handleSaveIdCardRecord = (record: SchoolIdCardRecord) => {
    setIdCardRecords((prev) => {
      const idx = prev.findIndex((r) => r.id === record.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = record;
        return next;
      }
      return [record, ...prev];
    });
  };

  const handleSaveBulkIdCardRecords = (incoming: SchoolIdCardRecord[]) => {
    setIdCardRecords((prev) => {
      const map = new Map(prev.map((r) => [r.id, r]));
      incoming.forEach((rec) => map.set(rec.id, rec));
      return Array.from(map.values());
    });
  };

  const handleDeleteIdCardRecord = (cardId: string) => {
    setIdCardRecords((prev) => prev.filter((r) => r.id !== cardId));
  };

  // 11.9 Excel Template Mapping Schemas (Persisted)
  const [excelMappingSchemas, setExcelMappingSchemas] = useState<ExcelMappingSchema[]>(() =>
    loadExcelMappingSchemas()
  );

  useEffect(() => {
    saveExcelMappingSchemas(excelMappingSchemas);
  }, [excelMappingSchemas]);

  const [activeMappingSchemaId, setActiveMappingSchemaId] = useState<string>(() => {
    const savedId = localStorage.getItem(`${STORAGE_KEY_PREFIX}active_mapping_schema_id`);
    const schemas = loadExcelMappingSchemas();
    if (savedId && schemas.some((s) => s.id === savedId)) return savedId;
    return schemas.find((s) => s.isDefault)?.id || schemas[0]?.id || '';
  });

  useEffect(() => {
    if (activeMappingSchemaId) {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}active_mapping_schema_id`, activeMappingSchemaId);
    }
  }, [activeMappingSchemaId]);

  // 12. Helper Modals
  const [isTestRunnerOpen, setIsTestRunnerOpen] = useState<boolean>(false);
  const [isApkGuideOpen, setIsApkGuideOpen] = useState<boolean>(false);
  const [isMultiPlatformModalOpen, setIsMultiPlatformModalOpen] = useState<boolean>(false);
  const [selectedModalPlatform, setSelectedModalPlatform] = useState<'android' | 'ios' | 'windows' | undefined>(undefined);
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState<boolean>(false);

  // Handlers for Students (strict Admission Number primary key enforcement & History tracking)
  const handleAddStudent = (newStudent: Student) => {
    const nowIso = new Date().toISOString();
    const initialHistory: StudentHistoryEvent[] = newStudent.history && newStudent.history.length > 0
      ? newStudent.history
      : [
          {
            id: `hist-${Date.now()}`,
            date: nowIso,
            type: 'ADMISSION',
            title: 'Student Enrolled',
            details: `Admitted to Class ${newStudent.classNumber}-${newStudent.section} (Session ${newStudent.academicSession}, Admission No: ${newStudent.admissionNumber})`,
            actorName: currentUser.name,
          },
        ];
    const enriched: Student = {
      ...newStudent,
      updatedAt: nowIso,
      history: initialHistory,
    };
    setStudents((prev) => deduplicateStudentsByAdmissionNumber([enriched, ...prev]));
  };

  const handleUpdateStudent = (updatedStudent: Student) => {
    const nowIso = new Date().toISOString();
    setStudents((prev) =>
      deduplicateStudentsByAdmissionNumber(
        prev.map((s) => {
          const isMatch =
            s.id === updatedStudent.id ||
            (s.admissionNumber &&
              updatedStudent.admissionNumber &&
              s.admissionNumber.trim().toUpperCase() === updatedStudent.admissionNumber.trim().toUpperCase());
          if (!isMatch) return s;

          const nextHistory: StudentHistoryEvent[] = [...(updatedStudent.history || s.history || [])];
          if (s.classNumber !== updatedStudent.classNumber || s.section !== updatedStudent.section) {
            nextHistory.unshift({
              id: `hist-${Date.now()}-cls`,
              date: nowIso,
              type: 'CLASS_CHANGE',
              title: 'Class & Section Updated',
              details: `Moved from Class ${s.classNumber}-${s.section} to Class ${updatedStudent.classNumber}-${updatedStudent.section}`,
              actorName: currentUser.name,
            });
          }
          if (s.admissionNumber !== updatedStudent.admissionNumber) {
            nextHistory.unshift({
              id: `hist-${Date.now()}-adm`,
              date: nowIso,
              type: 'ADMISSION_NO_UPDATE',
              title: 'Admission Number Updated',
              details: `Changed from ${s.admissionNumber} to ${updatedStudent.admissionNumber}`,
              actorName: currentUser.name,
            });
          }
          if (s.academicSession !== updatedStudent.academicSession) {
            nextHistory.unshift({
              id: `hist-${Date.now()}-ses`,
              date: nowIso,
              type: 'SESSION_UPDATE',
              title: 'Academic Session Updated',
              details: `Session changed from ${s.academicSession} to ${updatedStudent.academicSession}`,
              actorName: currentUser.name,
            });
          }
          if (s.status !== updatedStudent.status && updatedStudent.status === 'Transferred') {
            nextHistory.unshift({
              id: `hist-${Date.now()}-trn`,
              date: nowIso,
              type: 'TRANSFER',
              title: 'Student Transferred',
              details: `Transferred to ${updatedStudent.transferSchool || 'External Institution'} on ${updatedStudent.transferDate || nowIso.slice(0, 10)}. Reason: ${updatedStudent.transferReason || 'Parent Request'}`,
              actorName: currentUser.name,
            });
          }

          return {
            ...updatedStudent,
            updatedAt: nowIso,
            history: nextHistory,
          };
        })
      )
    );
  };

  const handleDeleteStudent = (studentId: string) => {
    setStudents((prev) => prev.filter((s) => s.id !== studentId));
  };

  const handleBulkDeleteStudents = (studentIds: string[]) => {
    const idSet = new Set(studentIds);
    setStudents((prev) => prev.filter((s) => !idSet.has(s.id)));
  };

  const handleBulkAddStudents = (newStudents: Student[]) => {
    setStudents((prev) => deduplicateStudentsByAdmissionNumber([...prev, ...newStudents]));
  };

  const handleBulkPromoteStudents = (
    studentIds: string[],
    targetClass: string,
    targetSection: string,
    targetSession: string,
    isGraduated = false
  ) => {
    if (studentIds.length === 0) return;
    const idSet = new Set(studentIds);
    const nowIso = new Date().toISOString();

    setStudents((prev) =>
      prev.map((st) => {
        if (!idSet.has(st.id)) return st;
        const nextSection = targetSection === 'KEEP' ? st.section : targetSection;
        const nextClass = isGraduated ? st.classNumber : targetClass;
        const nextStatus = isGraduated ? 'Archived' : st.status;
        const event: StudentHistoryEvent = {
          id: `hist-${Date.now()}-${st.id.slice(-4)}`,
          date: nowIso,
          type: 'CLASS_CHANGE',
          title: isGraduated ? 'Completed & Graduated' : `Promoted to Class ${nextClass}`,
          details: isGraduated
            ? `Promoted from Class ${st.classNumber}-${st.section} to Alumni / Graduated Archive (Session ${targetSession})`
            : `Promoted from Class ${st.classNumber}-${st.section} (${st.academicSession}) to Class ${nextClass}-${nextSection} (${targetSession})`,
          actorName: currentUser.name,
        };
        return {
          ...st,
          classNumber: nextClass,
          section: nextSection,
          academicSession: targetSession,
          status: nextStatus,
          updatedAt: nowIso,
          history: [event, ...(st.history || [])],
        };
      })
    );
  };

  // Handlers for Excel Template Mapping Schemas
  const handleSaveExcelMappingSchema = (schema: ExcelMappingSchema, isNew: boolean) => {
    setExcelMappingSchemas((prev) => {
      const exists = prev.some((s) => s.id === schema.id);
      const baseList = schema.isDefault
        ? prev.map((s) => (s.id === schema.id ? s : { ...s, isDefault: false }))
        : prev;
      if (exists) {
        return baseList.map((s) => (s.id === schema.id ? schema : s));
      }
      return [schema, ...baseList];
    });
    setActiveMappingSchemaId(schema.id);
    void syncExcelMappingSchemaToFirestore(schema, isNew).catch(() => {
      // Local state & storage remain authoritative when offline or unauthenticated
    });
  };

  const handleDeleteExcelMappingSchema = (schemaId: string) => {
    setExcelMappingSchemas((prev) => {
      const remaining = prev.filter((s) => s.id !== schemaId);
      if (activeMappingSchemaId === schemaId) {
        const fallback = remaining.find((s) => s.isDefault) || remaining[0];
        setActiveMappingSchemaId(fallback?.id || '');
      }
      return remaining;
    });
    void deleteExcelMappingSchemaFromFirestore(schemaId).catch(() => {
      // Best-effort Firestore cleanup
    });
  };

  const handleSelectActiveSchema = (schemaId: string) => {
    setActiveMappingSchemaId(schemaId);
  };

  // Handlers for Classes
  const handleUpdateClass = (oldClassName: string, newClassName: string) => {
    const trimmed = newClassName.trim();
    if (!trimmed || trimmed === oldClassName) return;

    // 1. Update school.classesOffered
    setSchool((prev) => ({
      ...prev,
      classesOffered: prev.classesOffered.map((c) => (c === oldClassName ? trimmed : c)),
    }));

    // 2. Cascade update to all students enrolled in this class
    setStudents((prev) =>
      prev.map((s) => (s.classNumber === oldClassName ? { ...s, classNumber: trimmed } : s))
    );

    // 3. Cascade update to attendance records
    setAttendanceRecords((prev) =>
      prev.map((r) => (r.classNumber === oldClassName ? { ...r, classNumber: trimmed } : r))
    );

    // 4. Cascade update to marks entries
    setMarksEntries((prev) =>
      prev.map((m) => (m.classNumber === oldClassName ? { ...m, classNumber: trimmed } : m))
    );
  };

  const handleAddClass = (newClass: string) => {
    const trimmed = newClass.trim();
    if (!trimmed) return;
    if (!school.classesOffered.includes(trimmed)) {
      setSchool((prev) => ({
        ...prev,
        classesOffered: [...prev.classesOffered, trimmed],
      }));
    }
  };

  const handleDeleteClass = (classToDelete: string) => {
    setSchool((prev) => ({
      ...prev,
      classesOffered: prev.classesOffered.filter((c) => c !== classToDelete),
    }));
  };

  // Handlers for Teachers
  const handleAddTeacher = (newTeacher: TeacherProfile) => {
    setTeachers((prev) => [...prev, newTeacher]);
  };

  const handleUpdateTeacher = (updatedTeacher: TeacherProfile) => {
    const existingTeacher = teachers.find((t) => t.id === updatedTeacher.id);
    const prevEmpCode = normalizeCpisCode(
      existingTeacher?.employeeId || updatedTeacher.previousCpisCode || ''
    );
    setTeachers((prev) => prev.map((t) => (t.id === updatedTeacher.id ? updatedTeacher : t)));
    // Keep linked leave applications and attendance records synchronized with updated CPIS Code
    if (updatedTeacher.employeeId) {
      setLeaveApplications((prev) =>
        prev.map((l) => {
          const matchesPrevCode =
            prevEmpCode.length > 0 && normalizeCpisCode(l.employeeId || '') === prevEmpCode;
          const matchesTeacherName =
            l.teacherName.trim().toLowerCase() === updatedTeacher.name.trim().toLowerCase();
          return matchesPrevCode || matchesTeacherName
            ? { ...l, employeeId: updatedTeacher.employeeId }
            : l;
        })
      );
      setTeacherAttendance((prev) =>
        prev.map((rec) =>
          rec.teacherId === updatedTeacher.id ? { ...rec, employeeId: updatedTeacher.employeeId } : rec
        )
      );
    }
  };

  const handleDeleteTeacher = (teacherId: string) => {
    setTeachers((prev) => prev.filter((t) => t.id !== teacherId));
  };

  // Handlers for Attendance
  const handleSaveAttendance = (newRecords: AttendanceRecord[], auditEntries: AttendanceAuditLog[]) => {
    if (isOffline) {
      // Add to offline sync queue as structured items
      const newItems: OfflineSyncItem[] = newRecords.map((r) => {
        const student = students.find((s) => s.id === r.studentId);
        const studentName = student ? student.fullName : `Student ${r.studentId}`;
        return {
          id: r.id,
          category: 'attendance',
          title: `${studentName} (Class ${r.classNumber}-${r.section})`,
          subtitle: `Status: ${r.status} • Roll #${student?.rollNumber || '—'} • Date: ${r.date}`,
          timestamp: r.markedAt || new Date().toISOString(),
          sizeBytes: 1240,
          payload: r,
          status: 'pending',
        };
      });
      setOfflineSyncQueue((prev) => [...prev, ...newItems]);
      // Update local state so UI reflects it immediately
      setAttendanceRecords((prev) => {
        const idsToRemove = new Set(newRecords.map((r) => r.id));
        return [...prev.filter((r) => !idsToRemove.has(r.id)), ...newRecords];
      });
    } else {
      setAttendanceRecords((prev) => {
        const idsToRemove = new Set(newRecords.map((r) => r.id));
        const nextRecords = [...prev.filter((r) => !idsToRemove.has(r.id)), ...newRecords];
        evaluateAttendanceThresholdNotification(nextRecords, students);
        return nextRecords;
      });
      if (auditEntries.length > 0) {
        setAuditLogs((prev) => [...auditEntries, ...prev]);
      }
    }
  };

  // Populate sample queue for testing or demoing sync progress bar (5 Marks, 3 Attendance)
  const handleSimulateSampleQueue = () => {
    setOfflineSyncQueue(defaultPendingSyncQueue);
    setIsOffline(true);
  };

  // Real Firebase & Local Server Sync Now (manual or automated on internet reconnect)
  const handleSyncOfflineData = useCallback(
    async (trigger: 'manual' | 'auto-reconnect' = 'manual') => {
      if (isSyncRunningRef.current) return;
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;

      isSyncRunningRef.current = true;
      try {
        const unsyncedStudentAtt = attendanceRecords.filter((r) => r.isOfflineSynced === false);
        const queuedItemsSnapshot: OfflineSyncItem[] =
          offlineSyncQueue.length > 0
            ? [...offlineSyncQueue]
            : [
                {
                  id: `sync-stu-att-${Date.now()}`,
                  category: 'attendance',
                  title: `Student Attendance Register (${attendanceRecords.length} records)`,
                  subtitle:
                    unsyncedStudentAtt.length > 0
                      ? `${unsyncedStudentAtt.length} unsynced offline check-in(s)`
                      : 'Full local attendance snapshot → Firebase',
                  timestamp: new Date().toISOString(),
                  sizeBytes: Math.max(512, attendanceRecords.length * 320),
                  payload: null,
                  status: 'pending',
                },
                {
                  id: `sync-tch-att-${Date.now()}`,
                  category: 'attendance',
                  title: `Teacher Attendance Register (${teacherAttendance.length} records)`,
                  subtitle: 'Daily arrival/departure & service records → Firebase',
                  timestamp: new Date().toISOString(),
                  sizeBytes: Math.max(512, teacherAttendance.length * 360),
                  payload: null,
                  status: 'pending',
                },
                {
                  id: `sync-leaves-${Date.now()}`,
                  category: 'leave',
                  title: `Teacher Leave Applications (${leaveApplications.length} records)`,
                  subtitle: 'Casual & Medical Leave requests & decisions → Firebase',
                  timestamp: new Date().toISOString(),
                  sizeBytes: Math.max(512, leaveApplications.length * 420),
                  payload: null,
                  status: 'pending',
                },
              ];

        const totalVisual = queuedItemsSnapshot.length;
        setSyncProgress({
          isSyncing: true,
          currentIndex: 1,
          totalCount: totalVisual,
          currentItem: { ...queuedItemsSnapshot[0], status: 'uploading' },
          completedItems: [],
          pendingItems: queuedItemsSnapshot.slice(1),
          percentage: 12,
          speedKbps: 64,
        });

        const summary = await syncAllAttendanceAndLeavesToFirebase({
          attendanceRecords,
          teacherAttendance,
          teacherLeaves: leaveApplications,
          students,
          trigger,
          onStageProgress: ({ percentage, label }) => {
            const completedIdx = Math.min(
              totalVisual - 1,
              Math.floor((percentage / 100) * totalVisual)
            );
            setSyncProgress({
              isSyncing: percentage < 100,
              currentIndex: Math.min(totalVisual, completedIdx + 1),
              totalCount: totalVisual,
              currentItem:
                percentage < 100
                  ? {
                      ...(queuedItemsSnapshot[completedIdx] || queuedItemsSnapshot[0]),
                      title: label,
                      status: 'uploading',
                    }
                  : null,
              completedItems: queuedItemsSnapshot
                .slice(0, percentage >= 100 ? totalVisual : completedIdx)
                .map((it) => ({ ...it, status: 'synced' as const })),
              pendingItems:
                percentage >= 100 ? [] : queuedItemsSnapshot.slice(completedIdx + 1),
              percentage: Math.max(12, Math.min(100, percentage)),
              speedKbps: percentage >= 100 ? 0 : 72,
            });
          },
        });

        // Mark all local student attendance records as synced & clear offline queue
        setAttendanceRecords((prev) =>
          prev.map((r) => (r.isOfflineSynced === false ? { ...r, isOfflineSynced: true } : r))
        );
        setOfflineSyncQueue([]);
        setIsOffline(false);
        hadOfflinePeriodRef.current = false;
        try {
          localStorage.removeItem('sm_had_offline_period_v1');
          localStorage.setItem('sm_last_firebase_sync_v1', JSON.stringify(summary));
        } catch { /* ignore */ }
        setLastFirebaseSyncSummary(summary);

        setSyncProgress({
          isSyncing: false,
          currentIndex: totalVisual,
          totalCount: totalVisual,
          currentItem: null,
          completedItems: queuedItemsSnapshot.map((it) => ({ ...it, status: 'synced' as const })),
          pendingItems: [],
          percentage: 100,
          speedKbps: 0,
        });
      } finally {
        isSyncRunningRef.current = false;
      }
    },
    [attendanceRecords, leaveApplications, offlineSyncQueue, students, teacherAttendance]
  );

  // Automatically trigger Firebase 'Sync Now' when device regains internet after offline usage
  useEffect(() => {
    const handleBrowserOffline = () => {
      hadOfflinePeriodRef.current = true;
      try {
        localStorage.setItem('sm_had_offline_period_v1', 'true');
      } catch { /* ignore */ }
    };

    const handleBrowserOnline = () => {
      const hasUnsyncedLocal =
        hadOfflinePeriodRef.current ||
        offlineSyncQueue.length > 0 ||
        attendanceRecords.some((r) => r.isOfflineSynced === false);
      if (hasUnsyncedLocal) {
        void handleSyncOfflineData('auto-reconnect');
      }
    };

    window.addEventListener('offline', handleBrowserOffline);
    window.addEventListener('online', handleBrowserOnline);

    // Also auto-sync if the user was offline before reload and is now back online
    if (
      typeof navigator !== 'undefined' &&
      navigator.onLine &&
      !isOffline &&
      hadOfflinePeriodRef.current
    ) {
      const timer = window.setTimeout(() => {
        void handleSyncOfflineData('auto-reconnect');
      }, 900);
      return () => {
        window.clearTimeout(timer);
        window.removeEventListener('offline', handleBrowserOffline);
        window.removeEventListener('online', handleBrowserOnline);
      };
    }

    return () => {
      window.removeEventListener('offline', handleBrowserOffline);
      window.removeEventListener('online', handleBrowserOnline);
    };
  }, [attendanceRecords, handleSyncOfflineData, isOffline, offlineSyncQueue.length]);

  // Also trigger auto-sync when switching from Offline Mode -> Online Mode in-app
  useEffect(() => {
    if (prevIsOfflineRef.current && !isOffline) {
      if (typeof navigator === 'undefined' || navigator.onLine) {
        void handleSyncOfflineData('auto-reconnect');
      }
    }
    prevIsOfflineRef.current = isOffline;
  }, [isOffline, handleSyncOfflineData]);

  // Handlers for Leaves (Full CRUD + Review / Approve / Reject + Soft-Delete Audit + Offline Queue + API & Firestore Sync)
  const handleApplyLeave = (newLeave: TeacherLeaveApplication) => {
    setLeaveApplications((prev) => [newLeave, ...prev]);
    const isCurrentlyOffline = isOffline || (typeof navigator !== 'undefined' && !navigator.onLine);
    if (isCurrentlyOffline) {
      const leaveQueueItem: OfflineSyncItem = {
        id: `lv-${newLeave.id}`,
        category: 'leave',
        title: `Leave: ${newLeave.teacherName} (${newLeave.leaveType.replace(/_/g, ' ')})`,
        subtitle: `${newLeave.startDate} to ${newLeave.endDate} • ${newLeave.totalDays} day(s)`,
        timestamp: newLeave.updatedAt || new Date().toISOString(),
        sizeBytes: 1120,
        payload: newLeave,
        status: 'pending',
      };
      setOfflineSyncQueue((prev) => [
        ...prev.filter((item) => item.id !== leaveQueueItem.id),
        leaveQueueItem,
      ]);
      hadOfflinePeriodRef.current = true;
      try {
        localStorage.setItem('sm_had_offline_period_v1', 'true');
      } catch { /* ignore */ }
    } else {
      fetch('/api/leaves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLeave),
      }).catch(() => {});
      syncTeacherLeaveToFirestore(newLeave, true).catch(() => {});
    }
  };

  const handleUpdateLeave = (updatedLeave: TeacherLeaveApplication) => {
    setLeaveApplications((prev) => prev.map((l) => (l.id === updatedLeave.id ? updatedLeave : l)));
    const isCurrentlyOffline = isOffline || (typeof navigator !== 'undefined' && !navigator.onLine);
    if (isCurrentlyOffline) {
      const leaveQueueItem: OfflineSyncItem = {
        id: `lv-${updatedLeave.id}`,
        category: 'leave',
        title: `Leave Update: ${updatedLeave.teacherName} (${updatedLeave.status})`,
        subtitle: `${updatedLeave.startDate} to ${updatedLeave.endDate} • ${updatedLeave.totalDays} day(s)`,
        timestamp: updatedLeave.updatedAt || new Date().toISOString(),
        sizeBytes: 1120,
        payload: updatedLeave,
        status: 'pending',
      };
      setOfflineSyncQueue((prev) => [
        ...prev.filter((item) => item.id !== leaveQueueItem.id),
        leaveQueueItem,
      ]);
      hadOfflinePeriodRef.current = true;
      try {
        localStorage.setItem('sm_had_offline_period_v1', 'true');
      } catch { /* ignore */ }
    } else {
      fetch(`/api/leaves/${encodeURIComponent(updatedLeave.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedLeave),
      }).catch(() => {});
      syncTeacherLeaveToFirestore(updatedLeave, false).catch(() => {});
    }
  };

  const handleDeleteLeave = (leaveId: string, deletionReason: string) => {
    const nowIso = new Date().toISOString();
    const target = leaveApplications.find((l) => l.id === leaveId);
    if (!target || target.status === 'Approved' || target.status === 'Rejected') return;
    const archived: TeacherLeaveApplication = {
      ...target,
      deletedStatus: 'Deleted',
      deletedAt: nowIso,
      deletedBy: currentUser.name,
      deletionReason,
      updatedAt: nowIso,
      auditHistory: [
        {
          id: `LAUD-${Date.now()}`,
          applicationId: leaveId,
          action: 'DELETE',
          actorName: currentUser.name,
          actorRole: currentUser.role,
          timestamp: nowIso,
          summary: `Deleted pending application (${deletionReason || 'Withdrawn by applicant'}). Preserved in audit trail.`,
        },
        ...(target.auditHistory || []),
      ],
    };
    setLeaveApplications((prev) => prev.map((l) => (l.id === leaveId ? archived : l)));
    fetch(`/api/leaves/${encodeURIComponent(leaveId)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deletedBy: currentUser.name, reason: deletionReason }),
    }).catch(() => {});
    syncTeacherLeaveToFirestore(archived, false).catch(() => {});
  };

  const handleMarkLeaveUnderReview = (leaveId: string, remarks: string) => {
    const nowIso = new Date().toISOString();
    const today = nowIso.slice(0, 10);
    const target = leaveApplications.find((l) => l.id === leaveId);
    if (!target) return;
    const updated: TeacherLeaveApplication = {
      ...target,
      status: 'Under_Review',
      reviewedBy: currentUser.name,
      reviewDate: today,
      headmasterRemarks: remarks,
      remarks,
      updatedAt: nowIso,
      auditHistory: [
        {
          id: `LAUD-${Date.now()}`,
          applicationId: leaveId,
          action: 'REVIEW',
          actorName: currentUser.name,
          actorRole: currentUser.role,
          timestamp: nowIso,
          summary: `Marked Under Review by ${currentUser.name}: ${remarks}`,
        },
        ...(target.auditHistory || []),
      ],
    };
    setLeaveApplications((prev) => prev.map((l) => (l.id === leaveId ? updated : l)));
    fetch(`/api/leaves/${encodeURIComponent(leaveId)}/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Under_Review', actorName: currentUser.name, headmasterRemarks: remarks }),
    }).catch(() => {});
    syncTeacherLeaveToFirestore(updated, false).catch(() => {});
  };

  const handleApproveLeave = (leaveId: string, remarks: string) => {
    const targetLeave = leaveApplications.find((l) => l.id === leaveId);
    if (!targetLeave) return;

    // Deduct leave balance only when transitioning from non-approved state
    if (targetLeave.status !== 'Approved') {
      setTeachers((prev) =>
        prev.map((tc) => {
          if (tc.employeeId === targetLeave.employeeId || tc.id === targetLeave.teacherId) {
            if (targetLeave.leaveType === 'Casual_Leave') {
              return { ...tc, casualLeaveBalance: Math.max(0, tc.casualLeaveBalance - targetLeave.totalDays) };
            }
            if (targetLeave.leaveType === 'Medical_Leave') {
              return { ...tc, medicalLeaveBalance: Math.max(0, tc.medicalLeaveBalance - targetLeave.totalDays) };
            }
            if (targetLeave.leaveType === 'Earned_Leave') {
              return { ...tc, earnedLeaveBalance: Math.max(0, tc.earnedLeaveBalance - targetLeave.totalDays) };
            }
          }
          return tc;
        })
      );
    }

    const nowIso = new Date().toISOString();
    const today = nowIso.slice(0, 10);
    const updated: TeacherLeaveApplication = {
      ...targetLeave,
      status: 'Approved',
      approvedBy: currentUser.name,
      approvalDate: today,
      decisionDate: today,
      headmasterRemarks: remarks,
      remarks,
      updatedAt: nowIso,
      auditHistory: [
        {
          id: `LAUD-${Date.now()}`,
          applicationId: leaveId,
          action: 'APPROVE',
          actorName: currentUser.name,
          actorRole: currentUser.role,
          timestamp: nowIso,
          summary: `Approved by ${currentUser.name} on ${today}. Remarks: ${remarks}`,
        },
        ...(targetLeave.auditHistory || []),
      ],
    };

    setLeaveApplications((prev) => prev.map((l) => (l.id === leaveId ? updated : l)));
    fetch(`/api/leaves/${encodeURIComponent(leaveId)}/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Approved', actorName: currentUser.name, headmasterRemarks: remarks }),
    }).catch(() => {});
    syncTeacherLeaveToFirestore(updated, false).catch(() => {});
    dispatchLeaveDecisionNotification(updated, 'Approved', remarks);
  };

  const handleRejectLeave = (leaveId: string, rejectionReason: string, remarks?: string) => {
    const targetLeave = leaveApplications.find((l) => l.id === leaveId);
    if (!targetLeave) return;
    const nowIso = new Date().toISOString();
    const today = nowIso.slice(0, 10);
    const combinedRemarks = remarks ? `${rejectionReason} — ${remarks}` : rejectionReason;
    const updated: TeacherLeaveApplication = {
      ...targetLeave,
      status: 'Rejected',
      approvedBy: currentUser.name,
      approvalDate: today,
      decisionDate: today,
      rejectionReason,
      headmasterRemarks: remarks || rejectionReason,
      remarks: combinedRemarks,
      updatedAt: nowIso,
      auditHistory: [
        {
          id: `LAUD-${Date.now()}`,
          applicationId: leaveId,
          action: 'REJECT',
          actorName: currentUser.name,
          actorRole: currentUser.role,
          timestamp: nowIso,
          summary: `Rejected by ${currentUser.name} on ${today}. Reason: ${rejectionReason}`,
        },
        ...(targetLeave.auditHistory || []),
      ],
    };
    setLeaveApplications((prev) => prev.map((l) => (l.id === leaveId ? updated : l)));
    fetch(`/api/leaves/${encodeURIComponent(leaveId)}/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'Rejected',
        actorName: currentUser.name,
        rejectionReason,
        headmasterRemarks: remarks || '',
      }),
    }).catch(() => {});
    syncTeacherLeaveToFirestore(updated, false).catch(() => {});
    dispatchLeaveDecisionNotification(updated, 'Rejected', combinedRemarks);
  };

  // Handlers for Marks
  const handleSaveMarks = (updated: StudentMarkEntry[]) => {
    setMarksEntries((prev) => deduplicateMarksEntries([...prev, ...updated]));
  };

  const handleAddExamination = (newExam: Examination) => {
    setExaminations((prev) => {
      const next = [...prev, newExam];
      runScheduledExamReminderCheck(next, { force: false });
      return next;
    });
  };

  const handleUpdateExamination = (updated: Examination) => {
    setExaminations((prev) => {
      const next = prev.map((e) => (e.id === updated.id ? updated : e));
      runScheduledExamReminderCheck(next, { force: false });
      return next;
    });
  };

  useEffect(() => {
    const stopScheduler = startAutomatedNotificationScheduler(
      () => examinations,
      () => attendanceRecords,
      () => students
    );
    return () => stopScheduler();
  }, [examinations, attendanceRecords, students]);

  // Handlers for Free Textbook Distribution
  const handleAddTextbookRecord = (record: TextbookDistributionRecord) => {
    setTextbookRecords((prev) => [record, ...prev]);
  };

  const handleUpdateTextbookRecord = (record: TextbookDistributionRecord) => {
    setTextbookRecords((prev) => prev.map((r) => (r.id === record.id ? record : r)));
  };

  // Reset to sample data
  const handleResetData = () => {
    localStorage.clear();
    setSchool(initialSchoolProfile);
    setStudents(sampleStudents);
    setTeachers(sampleTeachers);
    setAttendanceRecords(generateSampleAttendance());
    setAuditLogs(sampleAuditLogs);
    setLeaveApplications(sampleTeacherLeaveApplications);
    setExaminations(sampleExaminations);
    setMarksEntries(sampleMarksEntries);
    setTextbookRecords(sampleTextbookRecords);
    setHolisticRecords(sampleHolisticRecords);
    setTeacherAttendance(sampleTeacherAttendanceRecords);
    setDevAdminProfiles([initialDeveloperAdminProfile]);
    setActiveDevAdminId(initialDeveloperAdminProfile.id);
    const resetDesign = getDefaultDesignConfig(initialSchoolProfile);
    setIdCardDesignConfig(resetDesign);
    setQrPrivacySettings(DEFAULT_QR_PRIVACY_SETTINGS);
    setIdCardRecords([
      ...sampleStudents.slice(0, 6).map((s) => studentToIdCardRecord(s, initialSchoolProfile, resetDesign)),
      ...sampleTeachers.slice(0, 4).map((t) => teacherToIdCardRecord(t, initialSchoolProfile, resetDesign)),
    ]);
  };

  // Export full JSON backup
  const handleExportBackup = () => {
    const backupObj = {
      timestamp: new Date().toISOString(),
      school,
      devAdminProfiles,
      activeDevAdminId,
      students,
      teachers,
      teacherAttendance,
      attendanceRecords,
      auditLogs,
      leaveApplications,
      examinations,
      marksEntries,
      textbookRecords,
      holisticRecords,
      idCardRecords,
      idCardDesignConfig,
      qrPrivacySettings,
    };
    const jsonStr = JSON.stringify(backupObj, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SchoolMaster_Backup_${school.code}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import JSON backup
  const handleImportBackup = (jsonStr: string) => {
    const data = JSON.parse(jsonStr);
    if (data.school) setSchool(data.school);
    if (Array.isArray(data.devAdminProfiles) && data.devAdminProfiles.length > 0) {
      setDevAdminProfiles(data.devAdminProfiles);
    }
    if (data.activeDevAdminId) setActiveDevAdminId(data.activeDevAdminId);
    if (data.students) setStudents(deduplicateStudentsByAdmissionNumber(data.students));
    if (data.teachers) setTeachers(data.teachers);
    if (data.attendanceRecords) setAttendanceRecords(data.attendanceRecords);
    if (data.auditLogs) setAuditLogs(data.auditLogs);
    if (data.leaveApplications) setLeaveApplications(data.leaveApplications);
    if (data.examinations) setExaminations(data.examinations);
    if (data.marksEntries) setMarksEntries(deduplicateMarksEntries(data.marksEntries));
    if (data.textbookRecords) setTextbookRecords(data.textbookRecords);
    if (data.holisticRecords) setHolisticRecords(data.holisticRecords);
    if (Array.isArray(data.idCardRecords)) setIdCardRecords(data.idCardRecords);
    if (data.idCardDesignConfig) setIdCardDesignConfig(data.idCardDesignConfig);
    if (data.qrPrivacySettings) setQrPrivacySettings(data.qrPrivacySettings);
  };

  const pendingLeavesCount = leaveApplications.filter(
    (l) => l.deletedStatus !== 'Deleted' && (l.status === 'Pending' || l.status === 'Under_Review')
  ).length;

  // Active view renderer
  const renderTabContent = () => {
    // Role restriction check: Teacher role is strictly restricted from School Settings, Admin Access Control & Super Admin
    if (effectiveRole === 'teacher' && (currentTab === 'settings' || currentTab === 'admin-access' || currentTab === 'super-admin')) {
      return (
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm max-w-xl mx-auto text-center space-y-4 my-8">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
            <Lock className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900">Restricted Administrative Access</h2>
            <p className="text-xs text-slate-500 mt-1">
              Your active role is <strong>Teacher</strong> ({authAdminUser.name}). School Settings and Admin Access Control modules are restricted to Senior Administrators and the Headmaster / Principal.
            </p>
          </div>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={() => setCurrentTab('dashboard')}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
            >
              Return to Dashboard
            </button>
            {simulatedRole && (
              <button
                onClick={() => setSimulatedRole(null)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm"
              >
                Exit Teacher Simulation
              </button>
            )}
          </div>
        </div>
      );
    }

    switch (currentTab) {
      case 'dashboard':
        return (
          <Dashboard
            school={school}
            currentUser={currentUser}
            effectiveRole={effectiveRole}
            students={students}
            teachers={teachers}
            attendanceRecords={attendanceRecords}
            leaveApplications={leaveApplications}
            examinations={examinations}
            marksEntries={marksEntries}
            textbookRecords={textbookRecords}
            holisticRecords={holisticRecords}
            language={language}
            onNavigateTab={(tab, subTab) => {
              setCurrentTab(tab);
              if (tab === 'principal-management') {
                setPrincipalInitialMode((subTab as 'list' | 'add' | 'edit') || 'list');
              }
              if (tab === 'teachers' && subTab) {
                setTeacherSubTab(subTab as any);
              }
              if (tab === 'settings') {
                setSettingsSubTab((subTab as any) || 'profile');
              }
            }}
            onApproveLeave={handleApproveLeave}
            onRejectLeave={handleRejectLeave}
            onAddStudent={handleAddStudent}
            onUpdateStudent={handleUpdateStudent}
            onDeleteStudent={handleDeleteStudent}
            onOpenDownloadHub={() => setIsDownloadHubOpen(true)}
            activeDevAdmin={activeDevAdmin}
            principals={principals}
            firebaseUser={firebaseUser}
            isSyncingCloud={isSyncingCloud}
            onFirebaseSignIn={() => { signInWithGoogleAdmin().catch(() => {}); }}
            onFirebaseSignOut={() => { signOutFirebaseAdmin().catch(() => {}); }}
            onCloudBackupSync={handleCloudBackupSync}
            onLockSession={() => setShowLogoutConfirm(true)}
            onUpdateSchool={setSchool}
          />
        );
      case 'principal-management':
        return (
          <PrincipalManagement
            key={`prin-${principalInitialMode}`}
            principals={principals}
            school={school}
            effectiveRole={effectiveRole}
            initialMode={principalInitialMode}
            language={language}
            onAddPrincipal={handleAddPrincipal}
            onUpdatePrincipal={handleUpdatePrincipal}
            onDeletePrincipal={handleDeletePrincipal}
            onSetCurrentPrincipal={handleSetCurrentPrincipal}
          />
        );
      case 'students':
        return (
          <StudentManagement
            students={students}
            attendanceRecords={attendanceRecords}
            school={school}
            currentUser={currentUser}
            onAddStudent={handleAddStudent}
            onUpdateStudent={handleUpdateStudent}
            onDeleteStudent={handleDeleteStudent}
            onBulkDeleteStudents={handleBulkDeleteStudents}
            onBulkPromoteStudents={handleBulkPromoteStudents}
            language={language}
            initialSelectedStudentId={focusedStudentId}
            onClearInitialSelectedStudent={() => setFocusedStudentId(null)}
          />
        );
      case 'excel-import':
        return (
          <ExcelStudentImportRegister
            students={students}
            school={school}
            currentUser={currentUser}
            onAddStudent={handleAddStudent}
            onUpdateStudent={handleUpdateStudent}
            onDeleteStudent={handleDeleteStudent}
            onBulkAddStudents={handleBulkAddStudents}
            onBulkDeleteStudents={handleBulkDeleteStudents}
            mappingSchemas={excelMappingSchemas}
            activeSchemaId={activeMappingSchemaId}
            onSaveSchema={handleSaveExcelMappingSchema}
            onDeleteSchema={handleDeleteExcelMappingSchema}
            onSelectActiveSchema={handleSelectActiveSchema}
            language={language}
            onNavigateToAttendance={() => setCurrentTab('attendance')}
            onNavigateToMarks={() => setCurrentTab('marks-entry')}
            onNavigateToHpc={() => setCurrentTab('progress-cards')}
          />
        );
      case 'excel-template-mapping':
        return (
          <ExcelTemplateMappingPage
            school={school}
            currentUser={currentUser}
            schemas={excelMappingSchemas}
            activeSchemaId={activeMappingSchemaId}
            onSaveSchema={handleSaveExcelMappingSchema}
            onDeleteSchema={handleDeleteExcelMappingSchema}
            onSelectActiveSchema={handleSelectActiveSchema}
            onProceedToBulkImport={() => setCurrentTab('excel-import')}
          />
        );
      case 'classes':
        return (
          <ClassManagement
            school={school}
            students={students}
            marksEntries={marksEntries}
            examinations={examinations}
            language={language}
            isAdmin={effectiveRole !== 'teacher'}
            onUpdateClass={handleUpdateClass}
            onAddClass={handleAddClass}
            onDeleteClass={handleDeleteClass}
            onNavigateToMarks={() => setCurrentTab('marks-entry')}
            onNavigateToProgressCard={() => setCurrentTab('progress-cards')}
          />
        );
      case 'subjects':
        return (
          <SubjectManagement
            school={school}
            teachers={teachers}
            language={language}
            isAdmin={effectiveRole !== 'teacher'}
            subjects={subjectConfigs}
            onUpdateSubjectConfig={handleUpdateSubjectConfigs}
          />
        );
      case 'marks-entry':
        return (
          <MarksEntryModule
            students={students}
            examinations={examinations}
            marksEntries={marksEntries}
            school={school}
            currentUser={currentUser}
            language={language}
            subjectConfigs={subjectConfigs}
            onSaveMarks={handleSaveMarks}
          />
        );
      case 'evaluation-register':
        return (
          <EvaluationRegister
            students={students}
            examinations={examinations}
            marksEntries={marksEntries}
            school={school}
            currentUser={currentUser}
            language={language}
            subjectConfigs={subjectConfigs}
            onSaveMarks={handleSaveMarks}
            onNavigateToMarks={() => setCurrentTab('marks-entry')}
            onNavigateToHpc={() => setCurrentTab('progress-cards')}
          />
        );
      case 'attendance':
        return (
          <DailyAttendance
            students={students}
            school={school}
            currentUser={currentUser}
            attendanceRecords={attendanceRecords}
            auditLogs={auditLogs}
            isOffline={isOffline}
            onSaveAttendance={handleSaveAttendance}
            onTriggerSyncOfflineData={handleSyncOfflineData}
            language={language}
          />
        );
      case 'holistic-assessment':
        return (
          <HolisticAssessmentModule
            students={students}
            school={school}
            currentUser={currentUser}
            language={language}
            holisticRecords={holisticRecords}
            onSaveRecord={handleSaveHolisticRecord}
          />
        );
      case 'progress-cards':
      case 'student-results':
        return (
          <ReportCardGenerator
            students={students}
            examinations={examinations}
            marksEntries={marksEntries}
            school={school}
            language={language}
            subjectConfigs={subjectConfigs}
            currentUser={currentUser}
            effectiveRole={effectiveRole}
            holisticRecords={holisticRecords}
            onSaveMarks={handleSaveMarks}
            onSaveHolisticRecord={handleSaveHolisticRecord}
            onUpdateStudent={handleUpdateStudent}
          />
        );
      case 'id-card-maker':
        return (
          <SmartIdCardMaker
            school={school}
            onUpdateSchool={setSchool}
            students={students}
            teachers={teachers}
            effectiveRole={effectiveRole}
            records={idCardRecords}
            onSaveRecord={handleSaveIdCardRecord}
            onSaveBulkRecords={handleSaveBulkIdCardRecords}
            onDeleteRecord={handleDeleteIdCardRecord}
            designConfig={idCardDesignConfig}
            onUpdateDesignConfig={setIdCardDesignConfig}
            qrPrivacy={qrPrivacySettings}
            onUpdateQrPrivacy={setQrPrivacySettings}
          />
        );
      case 'teacher-subject-results':
        return (
          <TeacherSubjectResultCard
            students={students}
            examinations={examinations}
            marksEntries={marksEntries}
            teachers={teachers}
            school={school}
            onUpdateSchool={setSchool}
            language={language}
          />
        );
      case 'banner-editor':
        return (
          <SchoolNameDesignEditor
            school={school}
            onUpdateSchool={setSchool}
            language={language}
          />
        );
      case 'monthly-attendance':
        return (
          <MonthlyAttendance
            students={students}
            school={school}
            attendanceRecords={attendanceRecords}
            language={language}
          />
        );
      case 'staff-management':
      case 'admin-access':
        return (
          <AdminAccessControl
            school={school}
            onOpenDownloadHub={() => setIsDownloadHubOpen(true)}
          />
        );
      case 'teachers':
        return (
          <TeacherManagement
            teachers={teachers}
            school={school}
            currentUser={currentUser}
            effectiveRole={effectiveRole}
            onAddTeacher={handleAddTeacher}
            onUpdateTeacher={handleUpdateTeacher}
            onDeleteTeacher={handleDeleteTeacher}
            teacherAttendance={teacherAttendance}
            onSaveTeacherAttendance={handleSaveTeacherAttendance}
            initialSubTab={teacherSubTab}
            language={language}
            onNavigateToLocationSettings={() => setCurrentTab('settings')}
          />
        );
      case 'jkepm-appraisal':
        return (
          <JkepmAppraisalPortal
            school={school}
            teachers={teachers}
            currentUser={currentUser}
            effectiveRole={effectiveRole}
            language={language}
            onUpdateTeacher={handleUpdateTeacher}
          />
        );
      case 'teacher-leave':
        return (
          <TeacherLeave
            leaves={leaveApplications}
            teachers={teachers}
            school={school}
            currentUser={currentUser}
            onApplyLeave={handleApplyLeave}
            onUpdateLeave={handleUpdateLeave}
            onDeleteLeave={handleDeleteLeave}
            onMarkUnderReview={handleMarkLeaveUnderReview}
            onApproveLeave={handleApproveLeave}
            onRejectLeave={handleRejectLeave}
            language={language}
          />
        );
      case 'examinations':
        return (
          <ExaminationModule
            examinations={examinations}
            students={students}
            marksEntries={marksEntries}
            school={school}
            currentUser={currentUser}
            subjectConfigs={subjectConfigs}
            onSaveMarks={handleSaveMarks}
            onAddExamination={handleAddExamination}
            onUpdateExamination={handleUpdateExamination}
            language={language}
          />
        );
      case 'teacher-performance':
        return (
          <TeacherPerformance
            teachers={teachers}
            examinations={examinations}
            students={students}
            marksEntries={marksEntries}
            school={school}
            language={language}
          />
        );
      case 'textbooks':
        return (
          <TextbookDistribution
            records={textbookRecords}
            students={students}
            teachers={teachers}
            school={school}
            currentUser={currentUser}
            onAddRecord={handleAddTextbookRecord}
            onUpdateRecord={handleUpdateTextbookRecord}
            language={language}
          />
        );
      case 'reports':
        return (
          <ReportsCenter
            school={school}
            students={students}
            teachers={teachers}
            attendanceRecords={attendanceRecords}
            leaveApplications={leaveApplications}
            examinations={examinations}
            marksEntries={marksEntries}
            textbookRecords={textbookRecords}
            subjectConfigs={subjectConfigs}
            language={language}
            onOpenDownloadHub={() => setIsDownloadHubOpen(true)}
          />
        );
      case 'settings':
        return (
          <SchoolSettings
            school={school}
            onUpdateSchool={setSchool}
            onResetData={handleResetData}
            onExportBackup={handleExportBackup}
            onImportBackup={handleImportBackup}
            language={language}
            effectiveRole={effectiveRole}
            initialSubTab={settingsSubTab}
            onOpenMultiPlatformModal={(plat) => {
              setSelectedModalPlatform(plat);
              setIsMultiPlatformModalOpen(true);
            }}
            onOpenDownloadHub={() => setIsDownloadHubOpen(true)}
          />
        );
      case 'about-us':
        return (
          <AboutUsAppInfo
            profiles={devAdminProfiles}
            activeProfile={activeDevAdmin}
            school={school}
            language={language}
            onUpdateSchool={setSchool}
            onSaveProfile={handleSaveDevAdminProfile}
            onAddProfile={handleAddDevAdminProfile}
            onSelectActiveProfile={handleSelectActiveDevAdmin}
          />
        );
      default:
        return null;
    }
  };

  // Main application content layout
  const appContent = (
    <div
      dir={language === 'ur' ? 'rtl' : 'ltr'}
      className={`min-h-screen bg-slate-50 flex flex-col ${language === 'ur' ? 'font-urdu' : 'font-sans'}`}
    >
      <OfflineIndicator
        isOffline={isOffline}
        queuedChangesCount={offlineSyncQueue.length}
        queueItems={offlineSyncQueue}
        syncProgress={syncProgress}
        onSyncNow={() => void handleSyncOfflineData('manual')}
        onSimulateSampleQueue={handleSimulateSampleQueue}
        language={language}
        schoolName={school.name}
        lastFirebaseSyncSummary={lastFirebaseSyncSummary}
        localAttendanceCount={attendanceRecords.length + teacherAttendance.length}
        localLeaveCount={leaveApplications.length}
        firebaseSignedIn={Boolean(firebaseUser?.emailVerified)}
        onConnectFirebase={async () => {
          try {
            await signInWithGoogleAdmin();
            await handleSyncOfflineData('manual');
          } catch { /* user cancelled popup */ }
        }}
      />

      <Header
        school={school}
        currentUser={currentUser}
        users={users}
        onSelectUser={(u) => {
          setCurrentUser(u);
          setCurrentUserById(u.id);
        }}
        language={language}
        onToggleLanguage={setLanguage}
        deviceView={deviceView}
        onSetDeviceView={setDeviceView}
        isOffline={isOffline}
        onToggleOffline={() => {
          setIsOffline((prev) => {
            const next = !prev;
            if (next && offlineSyncQueue.length === 0) {
              setOfflineSyncQueue(defaultPendingSyncQueue);
            }
            return next;
          });
        }}
        offlineSyncQueueCount={offlineSyncQueue.length}
        onSyncOfflineData={handleSyncOfflineData}
        onOpenTestRunner={() => setIsTestRunnerOpen(true)}
        onOpenApkGuide={() => setIsApkGuideOpen(true)}
        onOpenMultiPlatformModal={(plat) => {
          setSelectedModalPlatform(plat);
          setIsMultiPlatformModalOpen(true);
        }}
        onOpenDownloadHub={() => setIsDownloadHubOpen(true)}
        activeDevAdmin={activeDevAdmin}
        onOpenAboutUs={() => setCurrentTab('about-us')}
        onRunNotificationChecks={() => {
          monitorAttendanceAndNotifyPrincipal(attendanceRecords, students, 75, { force: true });
          evaluateUpcomingExamNotifications(examinations);
        }}
        students={students}
        onNavigateToStudent={(student) => {
          setFocusedStudentId(student.id);
          setCurrentTab('students');
        }}
      />

      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        {/* Sidebar for Desktop/Tablet */}
        <div className="hidden lg:block">
          <Sidebar
            currentTab={currentTab}
            onSelectTab={setCurrentTab}
            language={language}
            userRole={effectiveRole as any}
            pendingLeavesCount={pendingLeavesCount}
            onOpenTestRunner={() => setIsTestRunnerOpen(true)}
            onOpenApkGuide={() => setIsApkGuideOpen(true)}
            onOpenMultiPlatformModal={(plat) => {
              setSelectedModalPlatform(plat);
              setIsMultiPlatformModalOpen(true);
            }}
            onOpenDownloadHub={() => setIsDownloadHubOpen(true)}
          />
        </div>

        {/* Main Workspace */}
        <main className="flex-1 p-3 sm:p-6 lg:p-8 max-w-full overflow-x-hidden pb-24 lg:pb-8">
          {renderTabContent()}
        </main>
      </div>

      {/* Mobile Android Bottom Navigation */}
      <BottomNav
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        language={language}
        onOpenMoreMenu={() => setIsMobileMoreOpen(true)}
      />

      {/* Mobile "More" Menu Drawer */}
      {isMobileMoreOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 backdrop-blur-sm lg:hidden no-print">
          <div className="bg-white rounded-t-3xl w-full max-w-md p-6 space-y-4 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between border-b pb-3">
              <span className="font-bold text-slate-900 text-sm">
                {language === 'ur' ? 'تمام اسکول ماڈیولز' : 'All Modules'}
              </span>
              <button onClick={() => setIsMobileMoreOpen(false)} className="p-1 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                onClick={() => { setCurrentTab('principal-management'); setPrincipalInitialMode('list'); setIsMobileMoreOpen(false); }}
                className="p-3 rounded-xl bg-amber-50 hover:bg-amber-100 font-bold text-[#0f294a] text-left border border-amber-300 col-span-2 flex items-center justify-between"
              >
                <span>{language === 'ur' ? 'پرنسپل / ہیڈ ماسٹر مینجمنٹ' : 'Principal / Headmaster Management'}</span>
                <span className="px-1.5 py-0.5 rounded bg-[#0f294a] text-amber-300 text-[10px]">Admin</span>
              </button>
              <button
                onClick={() => { setCurrentTab('excel-import'); setIsMobileMoreOpen(false); }}
                className="p-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 font-bold text-emerald-950 text-left border border-emerald-300 col-span-2 flex items-center justify-between"
              >
                <span>{language === 'ur' ? 'سمارٹ او سی آر و ایکسل امپورٹ' : 'Smart OCR & Excel Bulk Register'}</span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10px]">OCR + XLS</span>
              </button>
              <button
                onClick={() => { setCurrentTab('excel-template-mapping'); setIsMobileMoreOpen(false); }}
                className="p-3 rounded-xl bg-sky-50 hover:bg-sky-100 font-bold text-sky-950 text-left border border-sky-300 col-span-2 flex items-center justify-between"
              >
                <span>{language === 'ur' ? 'ایکسل ٹیمپلیٹ میپنگ' : 'Excel Template Mapping'}</span>
                <span className="px-1.5 py-0.5 rounded bg-[#0f294a] text-amber-300 text-[10px]">Schema</span>
              </button>
              <button
                onClick={() => { setCurrentTab('classes'); setIsMobileMoreOpen(false); }}
                className="p-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 font-bold text-indigo-950 text-left border border-indigo-200"
              >
                {language === 'ur' ? 'جماعتیں' : 'Classes & Sections'}
              </button>
              <button
                onClick={() => { setCurrentTab('subjects'); setIsMobileMoreOpen(false); }}
                className="p-3 rounded-xl bg-blue-50 hover:bg-blue-100 font-bold text-blue-950 text-left border border-blue-200"
              >
                {language === 'ur' ? 'مضامین' : '6 Core Subjects'}
              </button>
              <button
                onClick={() => { setCurrentTab('marks-entry'); setIsMobileMoreOpen(false); }}
                className="p-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 font-bold text-emerald-950 text-left border border-emerald-200"
              >
                {language === 'ur' ? 'نمبرات اندراج' : 'Marks Entry'}
              </button>
              <button
                onClick={() => { setCurrentTab('holistic-assessment'); setIsMobileMoreOpen(false); }}
                className="p-3 rounded-xl bg-purple-50 hover:bg-purple-100 font-bold text-purple-950 text-left border border-purple-200"
              >
                {language === 'ur' ? 'جامع تشخیص' : 'Holistic Life Skills'}
              </button>
              <button
                onClick={() => { setCurrentTab('progress-cards'); setIsMobileMoreOpen(false); }}
                className="p-3 rounded-xl bg-amber-50 hover:bg-amber-100 font-bold text-amber-950 text-left border border-amber-200"
              >
                {language === 'ur' ? 'ہولسٹک رپورٹ کارڈ' : 'HPC Progress Cards'}
              </button>
              <button
                onClick={() => { setCurrentTab('id-card-maker'); setIsMobileMoreOpen(false); }}
                className="p-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 font-bold text-indigo-950 text-left border border-indigo-200 col-span-2 flex items-center justify-between"
              >
                <span>{language === 'ur' ? 'اسمارٹ شناختی کارڈ میکر' : 'Smart School ID Card Maker'}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-600 text-white font-extrabold">QR + PDF</span>
              </button>
              <button
                onClick={() => { setCurrentTab('teacher-subject-results'); setIsMobileMoreOpen(false); }}
                className="p-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 font-bold text-indigo-950 text-left border border-indigo-200"
              >
                {language === 'ur' ? 'استاد وار نتیجہ کارڈ' : 'Teacher Subject Results'}
              </button>
              <button
                onClick={() => { setCurrentTab('reports'); setIsMobileMoreOpen(false); }}
                className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 font-semibold text-slate-800 text-left border"
              >
                {translations[language].reports}
              </button>
              <button
                onClick={() => { setCurrentTab('staff-management'); setIsMobileMoreOpen(false); }}
                className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 font-semibold text-slate-800 text-left border"
              >
                {language === 'ur' ? 'اساتذہ و عملہ' : 'Staff Management'}
              </button>
              <button
                onClick={() => { setCurrentTab('attendance'); setIsMobileMoreOpen(false); }}
                className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 font-semibold text-slate-800 text-left border"
              >
                {translations[language].attendance}
              </button>
              <button
                onClick={() => { setCurrentTab('teacher-leave'); setIsMobileMoreOpen(false); }}
                className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 font-semibold text-slate-800 text-left border"
              >
                {translations[language].teacherLeave} ({pendingLeavesCount})
              </button>
              <button
                onClick={() => { setCurrentTab('settings'); setIsMobileMoreOpen(false); }}
                className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 font-semibold text-slate-800 text-left border"
              >
                {translations[language].schoolSettings}
              </button>
              <button
                onClick={() => { setCurrentTab('about-us'); setIsMobileMoreOpen(false); }}
                className="p-3 rounded-xl bg-amber-50 hover:bg-amber-100 font-bold text-amber-950 text-left border border-amber-200 col-span-2 flex items-center justify-between"
              >
                <span>{language === 'ur' ? 'ایپ اور ایڈمن پروفائل' : 'About Us & Admin Profile'}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-600 text-white font-extrabold">Editable</span>
              </button>
              <button
                onClick={() => { setCurrentTab('banner-editor'); setIsMobileMoreOpen(false); }}
                className="p-3 rounded-xl bg-amber-50 hover:bg-amber-100 font-bold text-amber-950 text-left border border-amber-200 col-span-2 flex items-center justify-between"
              >
                <span>{language === 'ur' ? 'اردو نام و بینر درستی' : 'School Name & Banner Fix'}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-600 text-white font-extrabold">Noori Nastaleeq</span>
              </button>
              <button
                onClick={() => { setIsDownloadHubOpen(true); setIsMobileMoreOpen(false); }}
                className="p-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 font-bold text-emerald-950 text-left border border-emerald-200 col-span-2 flex items-center justify-between"
              >
                <span>Download & Export Center</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-600 text-white font-extrabold">All Formats</span>
              </button>
              <button
                onClick={() => { setIsMultiPlatformModalOpen(true); setIsMobileMoreOpen(false); }}
                className="p-3 rounded-xl bg-indigo-50 text-indigo-900 font-bold text-left border border-indigo-200 col-span-2 flex items-center justify-between"
              >
                <span>Install App (Android • iOS • Windows)</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-600 text-white font-extrabold">PWA / APK</span>
              </button>
              <button
                onClick={() => { setIsTestRunnerOpen(true); setIsMobileMoreOpen(false); }}
                className="p-3 rounded-xl bg-emerald-50 text-emerald-800 font-semibold text-left border border-emerald-200 col-span-2"
              >
                {translations[language].testRunner}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Universal Download & Export Center Modal */}
      {isDownloadHubOpen && (
        <DownloadCenterModal
          isOpen={isDownloadHubOpen}
          onClose={() => setIsDownloadHubOpen(false)}
          school={school}
          students={students}
          teachers={teachers}
          attendanceRecords={attendanceRecords}
          leaveApplications={leaveApplications}
          examinations={examinations}
          marksEntries={marksEntries}
          textbookRecords={textbookRecords}
          onExportBackup={handleExportBackup}
          onRestoreBackup={(data) => handleImportBackup(JSON.stringify(data))}
          onOpenMultiPlatformModal={(plat) => {
            setSelectedModalPlatform(plat);
            setIsMultiPlatformModalOpen(true);
          }}
        />
      )}

      {/* Acceptance Tests Modal */}
      {isTestRunnerOpen && (
        <AcceptanceTestsModal
          isOpen={isTestRunnerOpen}
          onClose={() => setIsTestRunnerOpen(false)}
        />
      )}

      {/* Android APK Guide Modal */}
      {isApkGuideOpen && (
        <AndroidApkGuideModal
          isOpen={isApkGuideOpen}
          onClose={() => setIsApkGuideOpen(false)}
        />
      )}

      {/* Multi-Platform (Android, iOS, Windows) App Modal */}
      {isMultiPlatformModalOpen && (
        <MultiPlatformAppModal
          isOpen={isMultiPlatformModalOpen}
          onClose={() => setIsMultiPlatformModalOpen(false)}
          language={language}
          initialPlatform={selectedModalPlatform}
        />
      )}

      {/* Logout / Lock Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 no-print">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#0f294a] text-amber-300 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-[#0f294a]">Lock Session / Logout</h3>
                <p className="text-xs text-slate-600">Confirm before locking administrator controls or signing out of Firebase.</p>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowLogoutConfirm(false);
                  if (firebaseUser) {
                    await signOutFirebaseAdmin().catch(() => {});
                  }
                  setIsSessionLocked(true);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
              >
                Confirm Lock &amp; Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Secure Administrator Lock Overlay */}
      {isSessionLocked && (
        <div className="fixed inset-0 z-[100] bg-gradient-to-br from-[#0f294a] via-[#172554] to-[#0f172a] text-white flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white text-slate-900 rounded-3xl p-8 shadow-2xl border-2 border-amber-400 text-center space-y-5">
            {school.logoDataUrl ? (
              <div className="w-24 h-24 mx-auto rounded-2xl bg-slate-50 border border-slate-200 p-2 flex items-center justify-center shadow-sm">
                <img
                  src={school.logoDataUrl}
                  alt={school.name}
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <SchoolEmblem size={88} showMotto />
            )}
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-amber-700">
                {school.name}
              </p>
              <h2 className="text-xl font-black text-[#0f294a] mt-1">Administrator Session Locked</h2>
              <p className="text-xs text-slate-600 mt-1">
                All school records, Headmaster archives, and student databases remain safely backed up.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsSessionLocked(false)}
              className="w-full py-3 rounded-2xl bg-[#0f294a] hover:bg-[#1e3a8a] text-amber-300 font-black text-sm shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Unlock Administrator Portal</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // If in Phone or Tablet Simulation Frame View
  if (deviceView === 'phone') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="mb-3 flex items-center justify-between w-full max-w-[440px] text-xs text-slate-400">
          <span className="flex items-center gap-1.5 font-bold text-amber-400">
            <Smartphone className="w-4 h-4" />
            Android Phone Shell Preview (Pixel 9 Pro)
          </span>
          <button
            onClick={() => setDeviceView('desktop')}
            className="text-xs text-indigo-400 hover:text-white underline font-semibold"
          >
            Exit Frame (Desktop)
          </button>
        </div>
        <div className="android-frame w-full bg-white relative flex flex-col">
          {/* Top Speaker / Camera Notch */}
          <div className="h-6 bg-slate-900 w-full flex items-center justify-center relative shrink-0">
            <div className="w-16 h-3.5 bg-slate-800 rounded-full" />
          </div>
          <div className="flex-1 overflow-y-auto">
            {appContent}
          </div>
        </div>
      </div>
    );
  }

  if (deviceView === 'tablet') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="mb-3 flex items-center justify-between w-full max-w-[1024px] text-xs text-slate-400">
          <span className="flex items-center gap-1.5 font-bold text-indigo-400">
            <Smartphone className="w-4 h-4" />
            Android Tablet Shell Preview (Galaxy Tab S9)
          </span>
          <button
            onClick={() => setDeviceView('desktop')}
            className="text-xs text-indigo-400 hover:text-white underline font-semibold"
          >
            Exit Frame (Desktop)
          </button>
        </div>
        <div className="android-tablet-frame w-full bg-white relative flex flex-col">
          <div className="flex-1 overflow-y-auto">
            {appContent}
          </div>
        </div>
      </div>
    );
  }

  return appContent;
}

export default function App() {
  return (
    <PermissionsProvider>
      <SchoolMasterApp />
    </PermissionsProvider>
  );
}
