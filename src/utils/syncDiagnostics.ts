import { FailedSyncLog, OfflineSyncItem, SyncConflictItem } from '../types';

const FAILED_LOGS_STORAGE_KEY = 'gbms_offline_failed_sync_logs';
const CONFLICTS_STORAGE_KEY = 'gbms_offline_sync_conflicts';

// Pre-seeded realistic last 10 failed synchronization logs for Government Boys Middle School Pamposh Colony
export const defaultFailedSyncLogs: FailedSyncLog[] = [
  {
    id: 'FAIL-LOG-101',
    timestamp: '2026-10-28T10:14:22.000Z',
    errorCode: 'ERR_SYNC_409_CONFLICT',
    errorMessage: 'Conflict: Attendance record for student SM-2026-001 already modified by relief teacher on cloud server.',
    endpoint: '/api/v1/attendance/batch-sync',
    httpStatus: 409,
    retryAttempts: 3,
    affectedCategory: 'attendance',
    affectedRecordId: 'att-2026-10-28-001',
    payloadSummary: 'Class 5-A Attendance • Student: Aarav Sharma • Status: Present',
    networkState: {
      online: true,
      effectiveType: '3g',
      downlinkMbps: 1.4,
      rttMs: 240,
    },
  },
  {
    id: 'FAIL-LOG-102',
    timestamp: '2026-10-28T09:48:15.000Z',
    errorCode: 'ERR_SYNC_504_GATEWAY_TIMEOUT',
    errorMessage: 'Gateway Timeout: Central J&K U-DISE+ API cluster did not acknowledge batch upload within 15000ms.',
    endpoint: '/api/v1/udise/bulk-records',
    httpStatus: 504,
    retryAttempts: 4,
    affectedCategory: 'student',
    affectedRecordId: 'std-reg-2026-005',
    payloadSummary: 'Class 5-B Student Registration • Fatima Sheikh • Aadhaar e-KYC',
    networkState: {
      online: false,
      effectiveType: '2g',
      downlinkMbps: 0.2,
      rttMs: 1450,
    },
  },
  {
    id: 'FAIL-LOG-103',
    timestamp: '2026-10-28T08:35:40.000Z',
    errorCode: 'ERR_SYNC_422_UNPROCESSABLE',
    errorMessage: 'Validation Error: Mathematics marks 105 exceed maximum boundary 100 in offline evaluation payload.',
    endpoint: '/api/v1/examinations/marks-entry',
    httpStatus: 422,
    retryAttempts: 1,
    affectedCategory: 'marks',
    affectedRecordId: 'mark-hy-2026-003',
    payloadSummary: 'Half-Yearly Examination 2026 • Mathematics • Chirag Verma',
    networkState: {
      online: true,
      effectiveType: '4g',
      downlinkMbps: 8.5,
      rttMs: 65,
    },
  },
  {
    id: 'FAIL-LOG-104',
    timestamp: '2026-10-27T14:22:11.000Z',
    errorCode: 'ERR_SYNC_408_NET_TIMEOUT',
    errorMessage: 'Socket Timeout: Radio connection dropped on mobile SIM interface during Class 6-B roll-call upload.',
    endpoint: '/api/v1/attendance/batch-sync',
    httpStatus: 408,
    retryAttempts: 5,
    affectedCategory: 'attendance',
    affectedRecordId: 'att-2026-10-27-014',
    payloadSummary: 'Class 6-B Morning Roll Call • 18 Student Attendance Records',
    networkState: {
      online: false,
      effectiveType: '2g',
      downlinkMbps: 0.1,
      rttMs: 2200,
    },
  },
  {
    id: 'FAIL-LOG-105',
    timestamp: '2026-10-27T11:05:30.000Z',
    errorCode: 'ERR_SYNC_503_MAINTENANCE',
    errorMessage: 'Service Unavailable: Central Portal scheduled maintenance window active (State Data Center Srinagar).',
    endpoint: '/api/v1/auth/cloud-handshake',
    httpStatus: 503,
    retryAttempts: 2,
    affectedCategory: 'general',
    affectedRecordId: 'sys-handshake-2026',
    payloadSummary: 'System Cloud Handshake & Token Refresh Protocol',
    networkState: {
      online: true,
      effectiveType: '3g',
      downlinkMbps: 2.1,
      rttMs: 180,
    },
  },
  {
    id: 'FAIL-LOG-106',
    timestamp: '2026-10-26T16:40:02.000Z',
    errorCode: 'ERR_SYNC_409_DUPLICATE_KEY',
    errorMessage: 'Conflict: Duplicate admission number collision for newly admitted offline transfer student.',
    endpoint: '/api/v1/students/register',
    httpStatus: 409,
    retryAttempts: 2,
    affectedCategory: 'student',
    affectedRecordId: 'std-2026-088',
    payloadSummary: 'Admission No: GBMS-2026-092 • Zaid Dar • Class 7-A',
    networkState: {
      online: true,
      effectiveType: '4g',
      downlinkMbps: 6.2,
      rttMs: 90,
    },
  },
  {
    id: 'FAIL-LOG-107',
    timestamp: '2026-10-26T12:18:55.000Z',
    errorCode: 'ERR_SYNC_502_BAD_GATEWAY',
    errorMessage: 'Bad Gateway: Edge reverse proxy rejected multipart payload exceeding 5MB batch buffer size.',
    endpoint: '/api/v1/textbooks/distribution-ledger',
    httpStatus: 502,
    retryAttempts: 3,
    affectedCategory: 'textbook',
    affectedRecordId: 'tb-batch-oct-2026',
    payloadSummary: 'NCERT Free Textbook Distribution Registry • 140 Items',
    networkState: {
      online: true,
      effectiveType: '3g',
      downlinkMbps: 1.8,
      rttMs: 310,
    },
  },
  {
    id: 'FAIL-LOG-108',
    timestamp: '2026-10-25T15:52:19.000Z',
    errorCode: 'ERR_SYNC_400_INVALID_SCHEMA',
    errorMessage: 'Malformed Payload: Missing mandatory academicSession attribute in offline leave request item.',
    endpoint: '/api/v1/teachers/leave/apply',
    httpStatus: 400,
    retryAttempts: 1,
    affectedCategory: 'leave',
    affectedRecordId: 'lv-app-2026-009',
    payloadSummary: 'Casual Leave Application • Altaf Hussain Khan • 2 Days',
    networkState: {
      online: true,
      effectiveType: '4g',
      downlinkMbps: 9.1,
      rttMs: 50,
    },
  },
  {
    id: 'FAIL-LOG-109',
    timestamp: '2026-10-25T10:04:41.000Z',
    errorCode: 'ERR_SYNC_408_SOCKET_CLOSED',
    errorMessage: 'Connection Reset By Peer: TCP socket abruptly terminated while streaming binary photo attachment.',
    endpoint: '/api/v1/students/photo-upload',
    httpStatus: 408,
    retryAttempts: 3,
    affectedCategory: 'student',
    affectedRecordId: 'photo-sm-2026-004',
    payloadSummary: 'Biometric Passport Photo Upload • Diya Patel (Class 7-A)',
    networkState: {
      online: false,
      effectiveType: '2g',
      downlinkMbps: 0.05,
      rttMs: 3500,
    },
  },
  {
    id: 'FAIL-LOG-110',
    timestamp: '2026-10-24T13:27:08.000Z',
    errorCode: 'ERR_SYNC_409_HPC_REVISION',
    errorMessage: 'Conflict: Holistic Progress Card rating revision timestamp older than server state.',
    endpoint: '/api/v1/hpc/ratings-update',
    httpStatus: 409,
    retryAttempts: 2,
    affectedCategory: 'marks',
    affectedRecordId: 'hpc-sm-2026-002',
    payloadSummary: 'HPC Socio-Emotional Domain Ratings • Bilal Ahmed',
    networkState: {
      online: true,
      effectiveType: '3g',
      downlinkMbps: 2.4,
      rttMs: 195,
    },
  },
];

// Pre-seeded sample data conflicts ready for the Sync Conflict Resolution modal
export const defaultSyncConflicts: SyncConflictItem[] = [
  {
    id: 'conflict-att-001',
    category: 'attendance',
    studentId: 'SM-2026-001',
    studentName: 'Aarav Sharma',
    rollNumber: 1,
    classNumber: '5',
    section: 'A',
    title: 'Daily Attendance Discrepancy',
    dateOrExam: '28 October 2026 (Wednesday)',
    localValue: 'Present (Marked 09:02 AM by Class Master)',
    localModifiedAt: '2026-10-28T09:02:14.000Z',
    serverValue: 'Absent (Marked 09:30 AM by Relief Teacher)',
    serverModifiedAt: '2026-10-28T09:30:22.000Z',
    similarityKey: 'attendance-5-A-2026-10-28',
  },
  {
    id: 'conflict-att-002',
    category: 'attendance',
    studentId: 'SM-2026-002',
    studentName: 'Bilal Ahmed',
    rollNumber: 2,
    classNumber: '5',
    section: 'A',
    title: 'Daily Attendance Discrepancy',
    dateOrExam: '28 October 2026 (Wednesday)',
    localValue: 'Present (Marked 09:03 AM by Class Master)',
    localModifiedAt: '2026-10-28T09:03:10.000Z',
    serverValue: 'Absent (Marked 09:30 AM by Relief Teacher)',
    serverModifiedAt: '2026-10-28T09:30:22.000Z',
    similarityKey: 'attendance-5-A-2026-10-28',
  },
  {
    id: 'conflict-att-003',
    category: 'attendance',
    studentId: 'SM-2026-003',
    studentName: 'Chirag Verma',
    rollNumber: 3,
    classNumber: '5',
    section: 'A',
    title: 'Daily Attendance Discrepancy',
    dateOrExam: '28 October 2026 (Wednesday)',
    localValue: 'Present (Marked 09:04 AM by Class Master)',
    localModifiedAt: '2026-10-28T09:04:45.000Z',
    serverValue: 'Absent (Marked 09:30 AM by Relief Teacher)',
    serverModifiedAt: '2026-10-28T09:30:22.000Z',
    similarityKey: 'attendance-5-A-2026-10-28',
  },
  {
    id: 'conflict-mark-004',
    category: 'marks',
    studentId: 'SM-2026-004',
    studentName: 'Diya Patel',
    rollNumber: 4,
    classNumber: '5',
    section: 'A',
    title: 'Mathematics Term Mark Mismatch',
    dateOrExam: 'Half-Yearly Examination 2026',
    localValue: '88 / 100 (Re-evaluated Paper)',
    localModifiedAt: '2026-10-28T11:15:00.000Z',
    serverValue: '82 / 100 (Original Entry)',
    serverModifiedAt: '2026-10-26T14:20:00.000Z',
    similarityKey: 'marks-5-A-MATH',
  },
];

export const getFailedSyncLogs = (): FailedSyncLog[] => {
  try {
    const raw = localStorage.getItem(FAILED_LOGS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to parse sync failure logs', e);
  }
  return defaultFailedSyncLogs;
};

export const getSyncConflicts = (): SyncConflictItem[] => {
  try {
    const raw = localStorage.getItem(CONFLICTS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to parse sync conflicts', e);
  }
  return defaultSyncConflicts;
};

export const saveSyncConflicts = (conflicts: SyncConflictItem[]) => {
  try {
    localStorage.setItem(CONFLICTS_STORAGE_KEY, JSON.stringify(conflicts));
  } catch (e) {
    console.warn('Failed to save sync conflicts', e);
  }
};

/**
 * Downloads full sync diagnostics package as JSON
 */
export const downloadSyncDiagnostics = (
  pendingQueue: OfflineSyncItem[],
  failedLogs: FailedSyncLog[] = getFailedSyncLogs(),
  schoolName: string = 'Government Boys Middle School Pamposh Colony'
) => {
  const last10Failed = failedLogs.slice(0, 10);

  const diagnosticsPayload = {
    metadata: {
      institution: schoolName,
      address: 'Pamposh Colony, Srinagar, Jammu & Kashmir - 190015',
      udiseCode: '01040101234',
      academicSession: '2026-2027',
      reportType: 'OFFLINE_SYNCHRONIZATION_DIAGNOSTICS_REPORT',
      exportTimestamp: new Date().toISOString(),
      exportTimestampFormatted: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' (IST)',
      authorizedHeadmaster: 'Farooq Ahmad Wani (Senior Master / HM)',
      verificationHash: `DIAG-SHA256-${Date.now().toString(16).toUpperCase()}-GBMS-PAMPOSH`,
      systemStatus: navigator.onLine ? 'ONLINE' : 'OFFLINE',
    },
    clientEnvironment: {
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
      platform: typeof navigator !== 'undefined' ? (navigator as any).platform || 'Linux/Android' : 'Linux',
      language: typeof navigator !== 'undefined' ? navigator.language : 'en-US',
      cookieEnabled: typeof navigator !== 'undefined' ? navigator.cookieEnabled : true,
      screenResolution: typeof window !== 'undefined' ? `${window.screen.width}x${window.screen.height}` : '1920x1080',
    },
    queueDiagnostics: {
      totalPendingItems: pendingQueue.length,
      categoryBreakdown: {
        attendance: pendingQueue.filter((q) => q.category === 'attendance').length,
        marks: pendingQueue.filter((q) => q.category === 'marks').length,
        student: pendingQueue.filter((q) => q.category === 'student').length,
        textbook: pendingQueue.filter((q) => q.category === 'textbook').length,
        leave: pendingQueue.filter((q) => q.category === 'leave').length,
        general: pendingQueue.filter((q) => q.category === 'general').length,
      },
      estimatedTotalPayloadBytes: pendingQueue.reduce((acc, item) => acc + (item.sizeBytes || 1024), 0),
      pendingQueueItems: pendingQueue,
    },
    failureDiagnostics: {
      failedLogsRecorded: last10Failed.length,
      last10FailedSyncLogs: last10Failed,
      primaryErrorSignatures: [
        { code: 'ERR_SYNC_409_CONFLICT', occurrences: last10Failed.filter((f) => f.httpStatus === 409).length },
        { code: 'ERR_SYNC_504_GATEWAY_TIMEOUT', occurrences: last10Failed.filter((f) => f.httpStatus === 504).length },
        { code: 'ERR_SYNC_408_NET_TIMEOUT', occurrences: last10Failed.filter((f) => f.httpStatus === 408).length },
        { code: 'ERR_SYNC_422_UNPROCESSABLE', occurrences: last10Failed.filter((f) => f.httpStatus === 422).length },
      ],
      recommendedRemediation: [
        'Run Sync Conflict Resolution Manager to reconcile divergent attendance & marks states.',
        'Verify cellular/broadband connection latency to State Data Center Srinagar edge proxy.',
        'Ensure device battery is above 20% to prevent radio interface power throttling.',
      ],
    },
  };

  const jsonString = JSON.stringify(diagnosticsPayload, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute(
    'download',
    `GBMS_Pamposh_Sync_Diagnostics_${new Date().toISOString().slice(0, 10)}_${Date.now().toString(16)}.json`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const defaultPendingSyncQueue: OfflineSyncItem[] = [
  {
    id: 'queue-mark-001',
    category: 'marks',
    title: 'Aarav Sharma — Mathematics (Class 5-A)',
    subtitle: 'Half-Yearly Exam: 88/100 (Grade A) • Re-evaluated',
    timestamp: '2026-10-28T09:12:00.000Z',
    sizeBytes: 2048,
    payload: { studentId: 'SM-2026-001', examId: 'exam-hy-2026', subject: 'MATH', marks: 88 },
    status: 'pending',
  },
  {
    id: 'queue-mark-002',
    category: 'marks',
    title: 'Bilal Ahmed — Mathematics (Class 5-A)',
    subtitle: 'Half-Yearly Exam: 82/100 (Grade A) • Recalculated',
    timestamp: '2026-10-28T09:13:00.000Z',
    sizeBytes: 2048,
    payload: { studentId: 'SM-2026-002', examId: 'exam-hy-2026', subject: 'MATH', marks: 82 },
    status: 'pending',
  },
  {
    id: 'queue-mark-003',
    category: 'marks',
    title: 'Chirag Verma — Science (Class 5-A)',
    subtitle: 'Half-Yearly Exam: 79/100 (Grade B+) • Updated',
    timestamp: '2026-10-28T09:14:00.000Z',
    sizeBytes: 2048,
    payload: { studentId: 'SM-2026-003', examId: 'exam-hy-2026', subject: 'SCI', marks: 79 },
    status: 'pending',
  },
  {
    id: 'queue-mark-004',
    category: 'marks',
    title: 'Diya Patel — English (Class 5-A)',
    subtitle: 'Half-Yearly Exam: 91/100 (Grade A+) • Verified',
    timestamp: '2026-10-28T09:15:00.000Z',
    sizeBytes: 2048,
    payload: { studentId: 'SM-2026-004', examId: 'exam-hy-2026', subject: 'ENG', marks: 91 },
    status: 'pending',
  },
  {
    id: 'queue-mark-005',
    category: 'marks',
    title: 'Fatima Sheikh — Urdu (Class 5-A)',
    subtitle: 'Half-Yearly Exam: 95/100 (Grade A+) • Distinction',
    timestamp: '2026-10-28T09:16:00.000Z',
    sizeBytes: 2048,
    payload: { studentId: 'SM-2026-005', examId: 'exam-hy-2026', subject: 'URDU', marks: 95 },
    status: 'pending',
  },
  {
    id: 'queue-att-006',
    category: 'attendance',
    title: 'Aarav Sharma (Class 5-A)',
    subtitle: 'Morning Roll Call: Present • Biometric QR Verified',
    timestamp: '2026-10-28T09:02:14.000Z',
    sizeBytes: 1240,
    payload: { studentId: 'SM-2026-001', status: 'Present', date: '2026-10-28' },
    status: 'pending',
  },
  {
    id: 'queue-att-007',
    category: 'attendance',
    title: 'Bilal Ahmed (Class 5-A)',
    subtitle: 'Morning Roll Call: Present • Timed 09:03 AM',
    timestamp: '2026-10-28T09:03:10.000Z',
    sizeBytes: 1240,
    payload: { studentId: 'SM-2026-002', status: 'Present', date: '2026-10-28' },
    status: 'pending',
  },
  {
    id: 'queue-att-008',
    category: 'attendance',
    title: 'Chirag Verma (Class 5-A)',
    subtitle: 'Morning Roll Call: Present • Timed 09:04 AM',
    timestamp: '2026-10-28T09:04:45.000Z',
    sizeBytes: 1240,
    payload: { studentId: 'SM-2026-003', status: 'Present', date: '2026-10-28' },
    status: 'pending',
  },
];

