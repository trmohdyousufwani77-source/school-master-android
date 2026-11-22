import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocFromServer,
  getDocs,
  collection,
  query,
  where,
  serverTimestamp,
  writeBatch,
  orderBy,
  limit,
  onSnapshot,
} from 'firebase/firestore';
import {
  getMessaging,
  getToken,
  isSupported as isMessagingSupported,
  onMessage,
  MessagePayload,
} from 'firebase/messaging';
import firebaseConfig from '../firebase-applet-config.json';
import {
  AttendanceRecord,
  CpisCodeMigrationRecord,
  DeveloperAdminProfile,
  ExcelMappingSchema,
  JkepmQuarterlyAppraisalReport,
  OcrImportBatchHistory,
  PrincipalRecord,
  SchoolAboutUsInfo,
  SchoolInfoAuditEntry,
  SchoolProfile,
  Student,
  TeacherAttendanceRecord,
  TeacherLeaveApplication,
} from './types';
import { MissingLigatureReport } from './utils/urduTypography';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testFirestoreConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return { ok: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
    return { ok: false, error: msg };
  }
}

export async function signInWithGoogleAdmin(): Promise<FirebaseUser> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutFirebaseAdmin(): Promise<void> {
  await signOut(auth);
}

export function subscribeFirebaseAuth(cb: (user: FirebaseUser | null) => void): () => void {
  return onAuthStateChanged(auth, cb);
}

const sanitizeDocId = (raw: string, prefix: string): string => {
  const cleaned = (raw || '').replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 120);
  return cleaned || `${prefix}_${Date.now()}`;
};

export async function syncSchoolProfileToFirestore(school: SchoolProfile): Promise<void> {
  if (!auth.currentUser) return;
  const docId = sanitizeDocId(school.code || 'gms_pamposh', 'school');
  const path = `schools/${docId}`;
  try {
    await setDoc(
      doc(db, 'schools', docId),
      {
        name: (school.name || '').slice(0, 160),
        nameUrdu: (school.nameUrdu || '').slice(0, 200),
        code: (school.code || '09240104502').slice(0, 32),
        address: (school.address || '').slice(0, 300),
        district: (school.district || 'Srinagar').slice(0, 80),
        state: (school.state || 'Jammu and Kashmir').slice(0, 80),
        pinCode: (school.pinCode || '190017').slice(0, 16),
        academicSession: (school.academicSession || '2026-2027').slice(0, 32),
        headTeacherName: (school.headTeacherName || '').slice(0, 120),
        motto: (school.motto || 'LEARN • GROW • EXCEL').slice(0, 120),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncPrincipalToFirestore(
  principal: PrincipalRecord,
  isNew: boolean
): Promise<void> {
  if (!auth.currentUser) return;
  const safeId = sanitizeDocId(principal.id, 'prin');
  const path = `principals/${safeId}`;
  try {
    const payload: Record<string, any> = {
      id: safeId,
      fullName: principal.fullName.slice(0, 120),
      designation: principal.designation,
      joiningDate: (principal.joiningDate || '').slice(0, 32),
      contactNumber: (principal.contactNumber || '').slice(0, 32),
      qualification: (principal.qualification || '').slice(0, 160),
      description: (principal.description || '').slice(0, 1000),
      isCurrent: Boolean(principal.isCurrent),
      updatedAt: serverTimestamp(),
    };
    if (principal.leavingDate) payload.leavingDate = principal.leavingDate.slice(0, 32);
    if (principal.email) payload.email = principal.email.slice(0, 120);
    if (isNew) {
      payload.createdByUid = auth.currentUser.uid;
      payload.createdAt = serverTimestamp();
    }
    await setDoc(doc(db, 'principals', safeId), payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deletePrincipalFromFirestore(principalId: string): Promise<void> {
  if (!auth.currentUser) return;
  const safeId = sanitizeDocId(principalId, 'prin');
  const path = `principals/${safeId}`;
  try {
    await deleteDoc(doc(db, 'principals', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function syncStudentsBatchToFirestore(studentsList: Student[]): Promise<number> {
  if (!auth.currentUser || studentsList.length === 0) return 0;
  const uid = auth.currentUser.uid;
  const CHUNK_SIZE = 400;
  let synced = 0;

  for (let i = 0; i < studentsList.length; i += CHUNK_SIZE) {
    const slice = studentsList.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const s of slice) {
      const safeId = sanitizeDocId(s.id, 'stu');
      const ref = doc(db, 'students', safeId);
      batch.set(
        ref,
        {
          id: safeId,
          admissionNumber: (s.admissionNumber || safeId).slice(0, 64),
          fullName: (s.fullName || 'Student').slice(0, 140),
          fatherName: (s.fatherName || '').slice(0, 140),
          motherName: (s.motherName || '').slice(0, 140),
          gender: s.gender || 'Male',
          dob: (s.dob || '').slice(0, 32),
          classNumber: (s.classNumber || '1').slice(0, 24),
          section: (s.section || 'A').slice(0, 16),
          rollNumber: Number.isInteger(s.rollNumber) ? s.rollNumber : 1,
          category: (s.category || 'General').slice(0, 40),
          religion: (s.religion || '').slice(0, 40),
          nationality: (s.nationality || 'Indian').slice(0, 60),
          address: (s.address || '').slice(0, 300),
          mobileNumber: (s.mobileNumber || '').slice(0, 32),
          previousSchool: (s.previousSchool || '').slice(0, 160),
          admissionDate: (s.admissionDate || '').slice(0, 32),
          academicSession: (s.academicSession || '2026-2027').slice(0, 32),
          status: s.status || 'Active',
          createdByUid: uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      synced++;
    }
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'students');
    }
  }
  return synced;
}

export async function syncOcrBatchToFirestore(batchLog: OcrImportBatchHistory): Promise<void> {
  if (!auth.currentUser) return;
  const safeId = sanitizeDocId(batchLog.id, 'batch');
  const path = `ocrBatches/${safeId}`;
  try {
    await setDoc(doc(db, 'ocrBatches', safeId), {
      id: safeId,
      sourceName: (batchLog.sourceName || 'Upload').slice(0, 200),
      sourceType: batchLog.sourceType,
      totalScanned: Math.round(batchLog.totalScanned),
      importedCount: Math.round(batchLog.importedCount),
      failedCount: Math.round(batchLog.failedCount),
      duplicateCount: Math.round(batchLog.duplicateCount),
      undone: Boolean(batchLog.undone),
      actorUid: auth.currentUser.uid,
      actorName: (batchLog.actorName || auth.currentUser.displayName || 'Admin').slice(0, 120),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteStudentsBatchFromFirestore(studentIds: string[]): Promise<number> {
  if (!auth.currentUser || !auth.currentUser.emailVerified || studentIds.length === 0) return 0;
  const CHUNK_SIZE = 400;
  let deleted = 0;
  for (let i = 0; i < studentIds.length; i += CHUNK_SIZE) {
    const slice = studentIds.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const id of slice) {
      const safeId = sanitizeDocId(id, 'stu');
      batch.delete(doc(db, 'students', safeId));
      deleted++;
    }
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'students');
    }
  }
  return deleted;
}

export async function markOcrBatchUndoneInFirestore(batchId: string): Promise<void> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return;
  const safeId = sanitizeDocId(batchId, 'batch');
  const path = `ocrBatches/${safeId}`;
  try {
    await updateDoc(doc(db, 'ocrBatches', safeId), {
      undone: true,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function syncExcelMappingSchemaToFirestore(
  schema: ExcelMappingSchema,
  isNew: boolean
): Promise<void> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return;
  const safeId = sanitizeDocId(schema.id, 'schema');
  const path = `excelMappingSchemas/${safeId}`;
  const normalizedCols = schema.columns.slice(0, 60).map((col, idx) => ({
    index: Number.isInteger(col.index) ? col.index : idx,
    sourceHeader: String(col.sourceHeader || `Column ${idx + 1}`).slice(0, 120),
    targetField: String(col.targetField || '').slice(0, 64),
    defaultValue: String(col.defaultValue || '').slice(0, 160),
    required: Boolean(col.required),
  }));
  try {
    if (isNew) {
      await setDoc(doc(db, 'excelMappingSchemas', safeId), {
        id: safeId,
        name: (schema.name || 'Custom Excel Schema').slice(0, 120),
        description: (schema.description || '').slice(0, 300),
        sheetName: (schema.sheetName || 'Student_Register').slice(0, 80),
        columns: normalizedCols,
        columnsCount: normalizedCols.length,
        isDefault: Boolean(schema.isDefault),
        createdByUid: auth.currentUser.uid,
        createdByName: (schema.createdByName || auth.currentUser.displayName || 'Admin').slice(0, 120),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(doc(db, 'excelMappingSchemas', safeId), {
        name: (schema.name || 'Custom Excel Schema').slice(0, 120),
        description: (schema.description || '').slice(0, 300),
        sheetName: (schema.sheetName || 'Student_Register').slice(0, 80),
        columns: normalizedCols,
        columnsCount: normalizedCols.length,
        isDefault: Boolean(schema.isDefault),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deleteExcelMappingSchemaFromFirestore(schemaId: string): Promise<void> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return;
  const safeId = sanitizeDocId(schemaId, 'schema');
  const path = `excelMappingSchemas/${safeId}`;
  try {
    await deleteDoc(doc(db, 'excelMappingSchemas', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function syncLigatureReportToFirestore(report: MissingLigatureReport): Promise<void> {
  if (!auth.currentUser) return;
  const safeId = sanitizeDocId(report.id, 'lig');
  const path = `ligatureReports/${safeId}`;
  try {
    await setDoc(doc(db, 'ligatureReports', safeId), {
      id: safeId,
      word: report.word.slice(0, 120),
      unicodeHex: report.unicodeHex.slice(0, 250),
      issueType: report.issueType,
      notes: (report.notes || '').slice(0, 400),
      reportedByUid: auth.currentUser.uid,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function fetchMyStudentsFromFirestore(): Promise<Student[]> {
  if (!auth.currentUser) return [];
  const path = 'students';
  try {
    const q = query(collection(db, 'students'), where('createdByUid', '==', auth.currentUser.uid));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as Student);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export interface FcmRegistrationResult {
  status: 'registered' | 'permission-denied' | 'unsupported' | 'sw-ready-no-vapid' | 'error';
  token?: string;
  message: string;
}

export async function registerFcmPushNotifications(
  role: 'teacher' | 'admin' | 'principal' = 'admin'
): Promise<FcmRegistrationResult> {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return { status: 'unsupported', message: 'Notifications API unavailable in this browser.' };
    }

    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      return { status: 'permission-denied', message: 'Browser notification permission was denied.' };
    }

    let swReg: ServiceWorkerRegistration | undefined;
    if ('serviceWorker' in navigator) {
      swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      const sw = swReg.active || swReg.waiting || swReg.installing;
      if (sw) {
        sw.postMessage({ type: 'INIT_FCM', config: firebaseConfig });
      }
    }

    const supported = await isMessagingSupported().catch(() => false);
    if (!supported) {
      return {
        status: 'sw-ready-no-vapid',
        message: 'Browser push active (FCM Service Worker initialized).',
      };
    }

    const messaging = getMessaging(app);
    const vapidKey = (import.meta as any).env?.VITE_FIREBASE_VAPID_KEY as string | undefined;

    let fcmToken = '';
    try {
      fcmToken = await getToken(messaging, {
        ...(vapidKey ? { vapidKey } : {}),
        ...(swReg ? { serviceWorkerRegistration: swReg } : {}),
      });
    } catch {
      return {
        status: 'sw-ready-no-vapid',
        message: 'FCM Service Worker ready; Web Notifications active for real-time alerts.',
      };
    }

    if (fcmToken) {
      localStorage.setItem('sm_fcm_token_v1', fcmToken);
      if (auth.currentUser && auth.currentUser.emailVerified) {
        const safeId = sanitizeDocId(`fcm_${auth.currentUser.uid}`, 'fcm');
        const path = `fcmTokens/${safeId}`;
        try {
          await setDoc(
            doc(db, 'fcmTokens', safeId),
            {
              id: safeId,
              uid: auth.currentUser.uid,
              token: fcmToken.slice(0, 512),
              role,
              platform: 'web',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, path);
        }
      }
      return {
        status: 'registered',
        token: fcmToken,
        message: 'Firebase Cloud Messaging (FCM) active and token synced.',
      };
    }

    return {
      status: 'sw-ready-no-vapid',
      message: 'Notification channel initialized.',
    };
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Unable to register FCM channel.',
    };
  }
}

export async function subscribeFcmForegroundMessages(
  handler: (payload: MessagePayload) => void
): Promise<() => void> {
  try {
    const supported = await isMessagingSupported().catch(() => false);
    if (!supported) return () => {};
    const messaging = getMessaging(app);
    return onMessage(messaging, handler);
  } catch {
    return () => {};
  }
}

export async function persistPushNotificationToFirestore(notif: {
  id: string;
  title: string;
  message: string;
  category: 'System' | 'Academic' | 'Attendance' | 'Inspection' | 'Leave' | 'Exam';
  targetRole?: 'teacher' | 'admin' | 'all';
  priority?: 'high' | 'normal';
}): Promise<void> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return;
  const safeId = sanitizeDocId(notif.id, 'notif');
  const path = `notifications/${safeId}`;
  try {
    await setDoc(doc(db, 'notifications', safeId), {
      id: safeId,
      title: (notif.title || 'School Alert').slice(0, 180),
      message: (notif.message || '').slice(0, 600),
      category: notif.category,
      targetRole: notif.targetRole || 'all',
      priority: notif.priority || 'normal',
      senderUid: auth.currentUser.uid,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeFirestoreNotifications(
  onIncoming: (items: { id: string; title: string; message: string; category: any; targetRole: any; priority: any }[]) => void
): () => void {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return () => {};
  const path = 'notifications';
  const q = query(
    collection(db, 'notifications'),
    where('targetRole', 'in', ['all', 'teacher']),
    orderBy('createdAt', 'desc'),
    limit(20)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => d.data() as any);
      onIncoming(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function syncJkepmSubmissionToFirestore(
  report: JkepmQuarterlyAppraisalReport,
  isNew: boolean
): Promise<void> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return;
  const safeId = sanitizeDocId(report.id, 'jkepm');
  const path = `jkepmSubmissions/${safeId}`;
  try {
    const basePayload: Record<string, any> = {
      id: safeId,
      teacherId: (report.teacherId || 'tch').slice(0, 80),
      teacherName: (report.teacherName || 'Teacher').slice(0, 140),
      employeeId: (report.employeeId || 'EMP').slice(0, 64),
      cpisCode: (report.cpisCode || 'KHYEDU 00220000').slice(0, 40),
      designation: (report.designation || '').slice(0, 140),
      schoolName: (report.schoolName || '').slice(0, 180),
      schoolUdiseCode: (report.schoolUdiseCode || '09240104502').slice(0, 32),
      academicSession: (report.academicSession || '2026-2027').slice(0, 32),
      quarter: report.quarter,
      reportingPeriod: (report.reportingPeriod || '').slice(0, 80),
      status: report.status,
      totalWorkingDays: Math.max(0, Math.min(366, Math.round(report.attendanceAndLeave.totalWorkingDays || 0))),
      totalDaysAttended: Math.max(0, Math.min(366, Math.round(report.attendanceAndLeave.totalDaysAttended || 0))),
      totalLeaveDays: Math.max(0, Math.min(366, Math.round(report.attendanceAndLeave.totalLeaveDays || 0))),
      attendancePercentage: Math.max(0, Math.min(100, Number(report.attendanceAndLeave.attendancePercentage || 0))),
      selfAssessmentScore: Math.max(0, Math.min(10, Number(report.selfAssessmentScore || 0))),
      updatedAt: serverTimestamp(),
    };
    if (report.previousCpisCode) basePayload.previousCpisCode = report.previousCpisCode.slice(0, 40);
    if (report.hoiRemarks) basePayload.hoiRemarks = report.hoiRemarks.slice(0, 1000);
    if (report.districtRemarks) basePayload.districtRemarks = report.districtRemarks.slice(0, 1000);

    if (isNew) {
      basePayload.createdByUid = auth.currentUser.uid;
      basePayload.createdAt = serverTimestamp();
      await setDoc(doc(db, 'jkepmSubmissions', safeId), basePayload);
    } else {
      await setDoc(doc(db, 'jkepmSubmissions', safeId), basePayload, { merge: true });
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deleteJkepmSubmissionFromFirestore(submissionId: string): Promise<void> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return;
  const safeId = sanitizeDocId(submissionId, 'jkepm');
  const path = `jkepmSubmissions/${safeId}`;
  try {
    await deleteDoc(doc(db, 'jkepmSubmissions', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function syncCpisMigrationToFirestore(
  migration: CpisCodeMigrationRecord,
  isNew: boolean
): Promise<void> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return;
  const safeId = sanitizeDocId(migration.id, 'cpis');
  const path = `cpisMigrations/${safeId}`;
  try {
    const payload: Record<string, any> = {
      id: safeId,
      teacherId: (migration.teacherId || 'tch').slice(0, 80),
      teacherName: (migration.teacherName || 'Teacher').slice(0, 140),
      schoolUdiseCode: (migration.schoolUdiseCode || '09240104502').slice(0, 32),
      oldCpisCode: (migration.oldCpisCode || 'JK-EDU-1985-0451').slice(0, 40),
      newCpisCode: (migration.newCpisCode || 'KHYEDU 00220000').slice(0, 40),
      status: migration.status,
      requestedByName: (migration.requestedByName || auth.currentUser.displayName || 'Admin').slice(0, 140),
      remarks: (migration.remarks || '').slice(0, 600),
      updatedAt: serverTimestamp(),
    };
    if (migration.verifiedByName) {
      payload.verifiedByName = migration.verifiedByName.slice(0, 140);
    }
    if (isNew) {
      payload.requestedByUid = auth.currentUser.uid;
      payload.createdAt = serverTimestamp();
      await setDoc(doc(db, 'cpisMigrations', safeId), payload);
    } else {
      await setDoc(doc(db, 'cpisMigrations', safeId), payload, { merge: true });
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function syncTeacherLeaveToFirestore(
  leave: TeacherLeaveApplication,
  isNew: boolean
): Promise<void> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return;
  const safeId = sanitizeDocId(leave.id, 'leave');
  const path = `teacherLeaves/${safeId}`;
  try {
    const rawDocUrl = leave.medicalDocumentUrl || '';
    const safeDocUrl =
      rawDocUrl.startsWith('data:')
        ? `local-attachment://${(leave.supportingDocName || 'medical-document').slice(0, 120)}`
        : rawDocUrl.slice(0, 500);

    const payload: Record<string, any> = {
      id: safeId,
      teacherId: (leave.teacherId || leave.employeeId || 'tch').slice(0, 80),
      employeeId: (leave.employeeId || 'EMP').slice(0, 64),
      teacherName: (leave.teacherName || 'Teacher').slice(0, 140),
      leaveType: leave.leaveType,
      applicationDate: (leave.applicationDate || new Date().toISOString().slice(0, 10)).slice(0, 32),
      startDate: (leave.startDate || new Date().toISOString().slice(0, 10)).slice(0, 32),
      endDate: (leave.endDate || new Date().toISOString().slice(0, 10)).slice(0, 32),
      totalDays: Math.max(1, Math.min(366, Math.round(leave.totalDays || 1))),
      reason: (leave.reason || 'Leave requested').slice(0, 1000),
      status: leave.status,
      deletedStatus: leave.deletedStatus || 'Active',
      updatedAt: serverTimestamp(),
    };
    if (leave.supportingDocName) payload.supportingDocName = leave.supportingDocName.slice(0, 200);
    if (safeDocUrl) payload.medicalDocumentUrl = safeDocUrl;
    if (leave.headmasterRemarks || leave.remarks) {
      payload.headmasterRemarks = (leave.headmasterRemarks || leave.remarks || '').slice(0, 1000);
    }
    if (leave.rejectionReason) payload.rejectionReason = leave.rejectionReason.slice(0, 1000);
    if (leave.approvedBy) payload.approvedBy = leave.approvedBy.slice(0, 140);
    if (leave.approvalDate || leave.decisionDate) {
      payload.approvalDate = (leave.approvalDate || leave.decisionDate || '').slice(0, 32);
    }
    if (leave.deletedBy) payload.deletedBy = leave.deletedBy.slice(0, 140);
    if (leave.deletionReason) payload.deletionReason = leave.deletionReason.slice(0, 500);

    if (isNew) {
      payload.createdByUid = auth.currentUser.uid;
      payload.createdAt = serverTimestamp();
      await setDoc(doc(db, 'teacherLeaves', safeId), payload);
    } else {
      await setDoc(doc(db, 'teacherLeaves', safeId), payload, { merge: true });
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function syncTeacherAttendanceToFirestore(
  record: TeacherAttendanceRecord,
  isNew: boolean
): Promise<void> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return;
  const safeId = sanitizeDocId(record.id || `att-${record.teacherId}-${record.date}`, 'att');
  const path = `teacherAttendance/${safeId}`;
  try {
    const payload: Record<string, any> = {
      id: safeId,
      date: (record.date || new Date().toISOString().slice(0, 10)).slice(0, 32),
      teacherId: (record.teacherId || 'tch').slice(0, 80),
      employeeId: (record.employeeId || 'EMP').slice(0, 64),
      teacherName: (record.teacherName || 'Teacher').slice(0, 140),
      status: record.status || 'Present',
      updatedAt: serverTimestamp(),
    };
    if (record.designation) payload.designation = record.designation.slice(0, 140);
    if (record.checkInTime) payload.checkInTime = record.checkInTime.slice(0, 32);
    if (record.checkOutTime) payload.checkOutTime = record.checkOutTime.slice(0, 32);
    if (record.remarks !== undefined) payload.remarks = String(record.remarks).slice(0, 1000);
    if (record.remarksByHoi !== undefined) payload.remarksByHoi = String(record.remarksByHoi).slice(0, 1000);
    if (record.updatedBy) payload.updatedBy = record.updatedBy.slice(0, 140);

    if (isNew) {
      payload.createdByUid = auth.currentUser.uid;
      payload.createdAt = serverTimestamp();
      await setDoc(doc(db, 'teacherAttendance', safeId), payload);
    } else {
      await setDoc(doc(db, 'teacherAttendance', safeId), payload, { merge: true });
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export interface FirebaseSyncSummary {
  studentAttendanceSynced: number;
  teacherAttendanceSynced: number;
  leavesSynced: number;
  totalSynced: number;
  firebaseConnected: boolean;
  requiresFirebaseAuth: boolean;
  syncedAt: string;
  trigger: 'manual' | 'auto-reconnect';
  message: string;
}

const VALID_STUDENT_ATTENDANCE_STATUSES = new Set(['Present', 'Absent', 'Late', 'Approved_Leave']);

export async function syncStudentAttendanceBatchToFirestore(
  records: AttendanceRecord[],
  students: Student[] = []
): Promise<number> {
  if (!auth.currentUser || !auth.currentUser.emailVerified || records.length === 0) return 0;
  const uid = auth.currentUser.uid;
  const studentLookup = new Map<string, Student>();
  students.forEach((s) => studentLookup.set(s.id, s));

  // Discover existing docs owned by current user to obey immutable createdAt/createdByUid rules
  const existingIds = new Set<string>();
  try {
    const snap = await getDocs(
      query(collection(db, 'studentAttendance'), where('createdByUid', '==', uid))
    );
    snap.docs.forEach((d) => existingIds.add(d.id));
  } catch {
    // Proceed cleanly; individual writes report via handleFirestoreError
  }

  const CHUNK_SIZE = 350;
  let synced = 0;

  for (let i = 0; i < records.length; i += CHUNK_SIZE) {
    const slice = records.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const r of slice) {
      const safeId = sanitizeDocId(r.id || `att-${r.studentId}-${r.date}`, 'satt');
      const stu = studentLookup.get(r.studentId);
      const safeStatus = VALID_STUDENT_ATTENDANCE_STATUSES.has(r.status) ? r.status : 'Present';
      const ref = doc(db, 'studentAttendance', safeId);

      if (existingIds.has(safeId)) {
        const updatePayload: Record<string, any> = {
          classNumber: (r.classNumber || stu?.classNumber || '1').slice(0, 24),
          section: (r.section || stu?.section || 'A').slice(0, 16),
          status: safeStatus,
          academicSession: (r.academicSession || '2026-2027').slice(0, 32),
          markedByUserId: (r.markedByUserId || uid).slice(0, 80),
          markedAt: (r.markedAt || new Date().toISOString()).slice(0, 64),
          updatedAt: serverTimestamp(),
        };
        if (stu?.fullName) updatePayload.studentName = stu.fullName.slice(0, 140);
        if (stu?.admissionNumber) updatePayload.admissionNumber = stu.admissionNumber.slice(0, 64);
        if (r.remarks !== undefined) updatePayload.remarks = String(r.remarks).slice(0, 500);
        batch.update(ref, updatePayload);
      } else {
        const createPayload: Record<string, any> = {
          id: safeId,
          date: (r.date || new Date().toISOString().slice(0, 10)).slice(0, 32),
          studentId: (r.studentId || 'stu').slice(0, 80),
          classNumber: (r.classNumber || stu?.classNumber || '1').slice(0, 24),
          section: (r.section || stu?.section || 'A').slice(0, 16),
          status: safeStatus,
          academicSession: (r.academicSession || '2026-2027').slice(0, 32),
          markedByUserId: (r.markedByUserId || uid).slice(0, 80),
          markedAt: (r.markedAt || new Date().toISOString()).slice(0, 64),
          createdByUid: uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        if (stu?.fullName) createPayload.studentName = stu.fullName.slice(0, 140);
        if (stu?.admissionNumber) createPayload.admissionNumber = stu.admissionNumber.slice(0, 64);
        if (r.remarks !== undefined) createPayload.remarks = String(r.remarks).slice(0, 500);
        batch.set(ref, createPayload);
      }
      synced++;
    }
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'studentAttendance');
    }
  }
  return synced;
}

export async function syncAllAttendanceAndLeavesToFirebase(params: {
  attendanceRecords: AttendanceRecord[];
  teacherAttendance: TeacherAttendanceRecord[];
  teacherLeaves: TeacherLeaveApplication[];
  students?: Student[];
  trigger: 'manual' | 'auto-reconnect';
  onStageProgress?: (stage: {
    label: string;
    percentage: number;
    completed: number;
    total: number;
  }) => void;
}): Promise<FirebaseSyncSummary> {
  const {
    attendanceRecords,
    teacherAttendance,
    teacherLeaves,
    students = [],
    trigger,
    onStageProgress,
  } = params;

  const syncedAt = new Date().toISOString();
  const totalCandidates =
    attendanceRecords.length + teacherAttendance.length + teacherLeaves.length;

  const mirrorToLocalApi = async () => {
    const recentTeacherAtt = teacherAttendance.slice(0, 40);
    await Promise.allSettled(
      recentTeacherAtt.map((rec) =>
        fetch('/api/teacher-attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rec),
        })
      )
    );
    const activeLeaves = teacherLeaves.filter((l) => l.deletedStatus !== 'Deleted').slice(0, 40);
    await Promise.allSettled(
      activeLeaves.map((lv) =>
        fetch('/api/leaves', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(lv),
        })
      )
    );
  };

  if (!auth.currentUser || !auth.currentUser.emailVerified) {
    onStageProgress?.({
      label: 'Syncing local attendance & leave data with school server...',
      percentage: 60,
      completed: Math.floor(totalCandidates / 2),
      total: Math.max(1, totalCandidates),
    });
    await mirrorToLocalApi().catch(() => {});
    onStageProgress?.({
      label: 'Local server synced (Sign in with Google for Firebase Cloud upload)',
      percentage: 100,
      completed: totalCandidates,
      total: Math.max(1, totalCandidates),
    });
    return {
      studentAttendanceSynced: attendanceRecords.length,
      teacherAttendanceSynced: teacherAttendance.length,
      leavesSynced: teacherLeaves.length,
      totalSynced: totalCandidates,
      firebaseConnected: false,
      requiresFirebaseAuth: true,
      syncedAt,
      trigger,
      message: `Synced ${totalCandidates} local records to school server. Connect Google Firebase to upload directly to Cloud Firestore.`,
    };
  }

  const uid = auth.currentUser.uid;
  let studentAttendanceSynced = 0;
  let teacherAttendanceSynced = 0;
  let leavesSynced = 0;

  // Stage 1: Student Attendance
  onStageProgress?.({
    label: `Uploading ${attendanceRecords.length} student attendance record(s) to Firebase...`,
    percentage: 20,
    completed: 0,
    total: Math.max(1, totalCandidates),
  });
  if (attendanceRecords.length > 0) {
    try {
      studentAttendanceSynced = await syncStudentAttendanceBatchToFirestore(
        attendanceRecords,
        students
      );
    } catch {
      // Logged via handleFirestoreError; proceed with remaining collections
    }
  }

  // Stage 2: Teacher Attendance
  onStageProgress?.({
    label: `Uploading ${teacherAttendance.length} teacher attendance record(s) to Firebase...`,
    percentage: 55,
    completed: studentAttendanceSynced,
    total: Math.max(1, totalCandidates),
  });
  if (teacherAttendance.length > 0) {
    const existingTeacherAttIds = new Set<string>();
    try {
      const snap = await getDocs(
        query(collection(db, 'teacherAttendance'), where('createdByUid', '==', uid))
      );
      snap.docs.forEach((d) => existingTeacherAttIds.add(d.id));
    } catch {
      // Ignore pre-check failure
    }

    for (const rec of teacherAttendance) {
      const safeId = sanitizeDocId(rec.id || `att-${rec.teacherId}-${rec.date}`, 'att');
      const isExisting = existingTeacherAttIds.has(safeId);
      try {
        if (isExisting) {
          const updatePayload: Record<string, any> = {
            employeeId: (rec.employeeId || 'EMP').slice(0, 64),
            teacherName: (rec.teacherName || 'Teacher').slice(0, 140),
            status: rec.status || 'Present',
            updatedAt: serverTimestamp(),
          };
          if (rec.designation) updatePayload.designation = rec.designation.slice(0, 140);
          if (rec.checkInTime) updatePayload.checkInTime = rec.checkInTime.slice(0, 32);
          if (rec.checkOutTime) updatePayload.checkOutTime = rec.checkOutTime.slice(0, 32);
          if (rec.remarks !== undefined) updatePayload.remarks = String(rec.remarks).slice(0, 1000);
          if (rec.remarksByHoi !== undefined) updatePayload.remarksByHoi = String(rec.remarksByHoi).slice(0, 1000);
          if (rec.updatedBy) updatePayload.updatedBy = rec.updatedBy.slice(0, 140);
          await updateDoc(doc(db, 'teacherAttendance', safeId), updatePayload);
        } else {
          await syncTeacherAttendanceToFirestore(rec, true);
        }
        teacherAttendanceSynced++;
      } catch {
        // Respect RBAC rules cleanly
      }
    }
  }

  // Stage 3: Teacher Leaves
  onStageProgress?.({
    label: `Uploading ${teacherLeaves.length} teacher leave record(s) to Firebase...`,
    percentage: 82,
    completed: studentAttendanceSynced + teacherAttendanceSynced,
    total: Math.max(1, totalCandidates),
  });
  if (teacherLeaves.length > 0) {
    const existingLeaveIds = new Set<string>();
    try {
      const snap = await getDocs(
        query(collection(db, 'teacherLeaves'), where('createdByUid', '==', uid))
      );
      snap.docs.forEach((d) => existingLeaveIds.add(d.id));
    } catch {
      // Ignore pre-check failure
    }

    for (const lv of teacherLeaves) {
      const safeId = sanitizeDocId(lv.id, 'leave');
      const isExisting = existingLeaveIds.has(safeId);
      if (!isExisting && lv.deletedStatus === 'Deleted') {
        continue;
      }
      try {
        if (isExisting) {
          const rawDocUrl = lv.medicalDocumentUrl || '';
          const safeDocUrl = rawDocUrl.startsWith('data:')
            ? `local-attachment://${(lv.supportingDocName || 'medical-document').slice(0, 120)}`
            : rawDocUrl.slice(0, 500);
          const updatePayload: Record<string, any> = {
            leaveType: lv.leaveType,
            startDate: (lv.startDate || new Date().toISOString().slice(0, 10)).slice(0, 32),
            endDate: (lv.endDate || new Date().toISOString().slice(0, 10)).slice(0, 32),
            totalDays: Math.max(1, Math.min(366, Math.round(lv.totalDays || 1))),
            reason: (lv.reason || 'Leave requested').slice(0, 1000),
            status: lv.status,
            deletedStatus: lv.deletedStatus || 'Active',
            updatedAt: serverTimestamp(),
          };
          if (lv.supportingDocName) updatePayload.supportingDocName = lv.supportingDocName.slice(0, 200);
          if (safeDocUrl) updatePayload.medicalDocumentUrl = safeDocUrl;
          if (lv.headmasterRemarks || lv.remarks) {
            updatePayload.headmasterRemarks = (lv.headmasterRemarks || lv.remarks || '').slice(0, 1000);
          }
          if (lv.rejectionReason) updatePayload.rejectionReason = lv.rejectionReason.slice(0, 1000);
          if (lv.approvedBy) updatePayload.approvedBy = lv.approvedBy.slice(0, 140);
          if (lv.approvalDate || lv.decisionDate) {
            updatePayload.approvalDate = (lv.approvalDate || lv.decisionDate || '').slice(0, 32);
          }
          if (lv.deletedBy) updatePayload.deletedBy = lv.deletedBy.slice(0, 140);
          if (lv.deletionReason) updatePayload.deletionReason = lv.deletionReason.slice(0, 500);
          await updateDoc(doc(db, 'teacherLeaves', safeId), updatePayload);
        } else {
          await syncTeacherLeaveToFirestore(lv, true);
        }
        leavesSynced++;
      } catch {
        // Respect RBAC rules cleanly
      }
    }
  }

  await mirrorToLocalApi().catch(() => {});

  const totalSynced = studentAttendanceSynced + teacherAttendanceSynced + leavesSynced;
  onStageProgress?.({
    label: `Synced ${totalSynced} record(s) to Firebase Cloud Firestore`,
    percentage: 100,
    completed: totalSynced,
    total: Math.max(1, totalSynced),
  });

  return {
    studentAttendanceSynced,
    teacherAttendanceSynced,
    leavesSynced,
    totalSynced,
    firebaseConnected: true,
    requiresFirebaseAuth: false,
    syncedAt,
    trigger,
    message:
      trigger === 'auto-reconnect'
        ? `Auto-Sync complete: uploaded ${studentAttendanceSynced} student attendance, ${teacherAttendanceSynced} teacher attendance, and ${leavesSynced} leave records to Firebase.`
        : `Sync Now complete: uploaded ${studentAttendanceSynced} student attendance, ${teacherAttendanceSynced} teacher attendance, and ${leavesSynced} leave records to Firebase.`,
  };
}

/**
 * Syncs School Admin-managed About Us & App Information to /schoolAboutUs/{docId}.
 * Strictly separated from /protectedDeveloperProfiles.
 */
export async function syncSchoolAboutUsToFirestore(
  info: SchoolAboutUsInfo,
  actorName: string,
  actorRole: string
): Promise<boolean> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return false;
  const safeId = sanitizeDocId(info.id || 'school-about-main', 'about');
  const docPath = `schoolAboutUs/${safeId}`;
  const rawLogoUrl = info.schoolLogoDataUrl || '';
  const safeLogoUrl = rawLogoUrl.startsWith('data:')
    ? 'local-logo://uploaded-school-logo'
    : rawLogoUrl.slice(0, 500);

  const payload: Record<string, any> = {
    id: safeId,
    schoolName: (info.schoolName || 'Government Middle School Pamposh Colony').slice(0, 180),
    schoolIntroduction: (info.schoolIntroduction || '').slice(0, 2000),
    schoolHistory: (info.schoolHistory || '').slice(0, 2000),
    schoolVision: (info.schoolVision || '').slice(0, 1000),
    schoolMission: (info.schoolMission || '').slice(0, 1000),
    schoolObjectives: (info.schoolObjectives || '').slice(0, 1500),
    schoolAddress: (info.schoolAddress || '').slice(0, 350),
    schoolContactNumber: (info.schoolContactNumber || '').slice(0, 40),
    schoolEmail: (info.schoolEmail || '').slice(0, 140),
    schoolWebsite: (info.schoolWebsite || '').slice(0, 220),
    schoolLogoUrl: safeLogoUrl,
    schoolFacilities: (info.schoolFacilities || '').slice(0, 1500),
    principalsMessage: (info.principalsMessage || '').slice(0, 2000),
    otherSchoolInfo: (info.otherSchoolInfo || '').slice(0, 1500),
    appName: (info.appName || 'SchoolMaster').slice(0, 140),
    appDescription: (info.appDescription || '').slice(0, 1500),
    appVersion: (info.appVersion || 'v1.0.0').slice(0, 40),
    appFeatures: (info.appFeatures || '').slice(0, 2000),
    appPurpose: (info.appPurpose || '').slice(0, 1200),
    appSupportEmail: (info.appSupportEmail || '').slice(0, 140),
    appSupportContactNumber: (info.appSupportContactNumber || '').slice(0, 40),
    privacyPolicy: (info.privacyPolicy || '').slice(0, 3000),
    termsAndConditions: (info.termsAndConditions || '').slice(0, 3000),
    copyrightInfo: (info.copyrightInfo || '').slice(0, 300),
    updatedByUid: auth.currentUser.uid,
    updatedByName: (actorName || auth.currentUser.displayName || 'School Admin').slice(0, 140),
    updatedByRole: (actorRole || 'school_admin').slice(0, 40),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'schoolAboutUs', safeId), payload, { merge: false });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
    return false;
  }
}

/**
 * Appends an immutable audit entry to /schoolInfoAuditLogs/{logId}.
 */
export async function appendSchoolInfoAuditLogToFirestore(
  entry: SchoolInfoAuditEntry
): Promise<boolean> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return false;
  const safeId = sanitizeDocId(entry.id || `about-audit-${Date.now()}`, 'about-audit');
  const docPath = `schoolInfoAuditLogs/${safeId}`;
  const payload = {
    id: safeId,
    section: entry.section,
    action: entry.action,
    changedFields: entry.changedFields.join(', ').slice(0, 600),
    summary: (entry.summary || 'Updated school information').slice(0, 600),
    actorUid: auth.currentUser.uid,
    actorName: (entry.actorName || 'School Admin').slice(0, 140),
    actorRole: (entry.actorRole || 'school_admin').slice(0, 40),
    createdAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'schoolInfoAuditLogs', safeId), payload);
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, docPath);
    return false;
  }
}

/**
 * Protected write helper for /protectedDeveloperProfiles/{profileId}.
 * Enforced by Firestore security rules to allow ONLY the verified original App Developer / Super Admin.
 */
export async function syncProtectedDeveloperProfileToFirestore(
  profile: DeveloperAdminProfile,
  isNew = false
): Promise<boolean> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return false;
  const safeId = sanitizeDocId(profile.id || 'dev-admin-1', 'dev-admin');
  const docPath = `protectedDeveloperProfiles/${safeId}`;
  const baseFields: Record<string, any> = {
    developerName: (profile.name || 'Mohd Yousuf Wani').slice(0, 140),
    developerProfile: 'Original App Developer & System Architect — SchoolMaster Educational Suite'.slice(0, 1000),
    designation: (profile.designation || 'App Developer / Administrator').slice(0, 140),
    institution: (profile.institution || 'Govt Middle School, Pamposh Colony').slice(0, 180),
    locality: (profile.locality || 'Pamposh Colony').slice(0, 120),
    district: (profile.district || 'Srinagar').slice(0, 80),
    unionTerritory: (profile.unionTerritory || 'Jammu & Kashmir, India').slice(0, 100),
    developerEmail: (profile.email || 'mohdyousufwani1977@gmail.com').slice(0, 140),
    developerPhone: (profile.phone || '+91 94190 12345').slice(0, 40),
    administratorName: (profile.name || 'Mohd Yousuf Wani').slice(0, 140),
    administratorProfile: 'Protected Super Administrator — Original App Ownership & Platform Governance'.slice(0, 1000),
    ownershipNotice: 'Original App Ownership & Developer Profile is permanently protected against School Admin edits.'.slice(0, 500),
    updatedByUid: auth.currentUser.uid,
    updatedAt: serverTimestamp(),
  };

  try {
    if (isNew) {
      await setDoc(doc(db, 'protectedDeveloperProfiles', safeId), {
        id: safeId,
        ...baseFields,
        isProtected: true,
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(doc(db, 'protectedDeveloperProfiles', safeId), baseFields);
    }
    return true;
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, docPath);
    return false;
  }
}



