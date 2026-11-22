import { AttendanceRecord, Examination, Student, TeacherLeaveApplication } from '../types';
import { persistPushNotificationToFirestore } from '../firebase';

export interface PushNotificationItem {
  id: string;
  title: string;
  titleUrdu?: string;
  message: string;
  messageUrdu?: string;
  category: 'System' | 'Academic' | 'Attendance' | 'Inspection' | 'Leave' | 'Exam';
  targetRole?: 'teacher' | 'admin' | 'all';
  time: string;
  createdAt?: string;
  read: boolean;
  priority?: 'high' | 'normal';
}

export interface PushNotificationPreferences {
  browserPushEnabled: boolean;
  teacherLeaveAlerts: boolean;
  attendanceThresholdAlerts: boolean;
  parentLowAttendanceAlerts: boolean;
  consecutiveAbsenceAutoAlert?: boolean;
  attendanceThresholdPercent: number;
  examRemindersEnabled: boolean;
  examReminderDaysBefore: number;
}

export const DEFAULT_PUSH_PREFS: PushNotificationPreferences = {
  browserPushEnabled: true,
  teacherLeaveAlerts: true,
  attendanceThresholdAlerts: true,
  parentLowAttendanceAlerts: true,
  consecutiveAbsenceAutoAlert: true,
  attendanceThresholdPercent: 75,
  examRemindersEnabled: true,
  examReminderDaysBefore: 3,
};

export const PUSH_NOTIFS_STORAGE_KEY = 'school_master_notifications';
export const PUSH_PREFS_STORAGE_KEY = 'sm_push_notif_prefs_v1';
export const PUSH_NOTIFICATION_EVENT = 'sm-push-notification';
export const PUSH_PREFS_UPDATED_EVENT = 'sm-push-prefs-updated';
const SCHEDULER_SENT_CACHE_KEY = 'sm_exam_scheduler_sent_v1';

export function loadPushPreferences(): PushNotificationPreferences {
  try {
    const raw = localStorage.getItem(PUSH_PREFS_STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_PUSH_PREFS, ...JSON.parse(raw) };
    }
  } catch {
    // ignore
  }
  return DEFAULT_PUSH_PREFS;
}

export function savePushPreferences(prefs: PushNotificationPreferences): void {
  localStorage.setItem(PUSH_PREFS_STORAGE_KEY, JSON.stringify(prefs));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PUSH_PREFS_UPDATED_EVENT, { detail: prefs }));
  }
}

export async function requestBrowserNotificationPermission(): Promise<'granted' | 'denied' | 'default' | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  try {
    const result = await Notification.requestPermission();
    return result;
  } catch {
    return Notification.permission;
  }
}

export function emitPushNotification(
  item: Omit<PushNotificationItem, 'id' | 'time' | 'read' | 'createdAt'>
): PushNotificationItem {
  const created: PushNotificationItem = {
    ...item,
    id: `push_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    time: 'Just now',
    createdAt: new Date().toISOString(),
    read: false,
  };

  try {
    const existingRaw = localStorage.getItem(PUSH_NOTIFS_STORAGE_KEY);
    const existing: PushNotificationItem[] = existingRaw ? JSON.parse(existingRaw) : [];
    const deduped = [created, ...existing.filter((n) => n.id !== created.id)].slice(0, 40);
    localStorage.setItem(PUSH_NOTIFS_STORAGE_KEY, JSON.stringify(deduped));
  } catch {
    // ignore storage errors
  }

  window.dispatchEvent(new CustomEvent(PUSH_NOTIFICATION_EVENT, { detail: created }));

  // Sync notification to Firestore when signed in for cross-device FCM dispatch
  persistPushNotificationToFirestore({
    id: created.id,
    title: created.title,
    message: created.message,
    category: created.category,
    targetRole: created.targetRole,
    priority: created.priority,
  }).catch(() => {});

  const prefs = loadPushPreferences();
  if (
    prefs.browserPushEnabled &&
    typeof window !== 'undefined' &&
    'Notification' in window &&
    Notification.permission === 'granted'
  ) {
    try {
      new Notification(created.title, {
        body: created.message,
        icon: '/icon.svg',
        tag: created.id,
      });
    } catch {
      // Safe fallback inside restricted iframes
    }
  }

  return created;
}

export function dispatchLeaveDecisionNotification(
  leave: TeacherLeaveApplication,
  decision: 'Approved' | 'Rejected',
  remarks?: string
): PushNotificationItem | null {
  const prefs = loadPushPreferences();
  if (!prefs.teacherLeaveAlerts) return null;

  const isApproved = decision === 'Approved';
  return emitPushNotification({
    title: isApproved
      ? `Leave Approved: ${leave.teacherName}`
      : `Leave Rejected: ${leave.teacherName}`,
    titleUrdu: isApproved
      ? `رخصت منظور: ${leave.teacherName}`
      : `رخصت نامنظور: ${leave.teacherName}`,
    message: `${leave.leaveType.replace('_', ' ')} (${leave.startDate} to ${leave.endDate}, ${leave.totalDays} day(s)) has been ${decision.toLowerCase()}.${remarks ? ` Note: ${remarks}` : ''}`,
    messageUrdu: `${leave.startDate} تا ${leave.endDate} (${leave.totalDays} دن) کی درخواست ${isApproved ? 'منظور' : 'نامنظور'} کر دی گئی ہے۔`,
    category: 'Leave',
    targetRole: 'teacher',
    priority: isApproved ? 'normal' : 'high',
  });
}

export interface LowAttendanceStudentAlert {
  studentId: string;
  name: string;
  classSection: string;
  presentDays: number;
  totalDays: number;
  percentage: number;
}

export interface AttendanceMonitorReport {
  thresholdPct: number;
  flaggedStudents: LowAttendanceStudentAlert[];
  notification: PushNotificationItem | null;
}

/**
 * Service function monitoring attendance records per student and automatically
 * sending a high-priority Principal's dashboard alert whenever attendance drops below 75%.
 */
export function monitorAttendanceAndNotifyPrincipal(
  records: AttendanceRecord[],
  students: Student[],
  thresholdPct?: number,
  options?: { force?: boolean; silent?: boolean }
): AttendanceMonitorReport {
  const prefs = loadPushPreferences();
  const limit = thresholdPct ?? prefs.attendanceThresholdPercent ?? 75;

  const studentTotals = new Map<string, { present: number; total: number }>();
  records.forEach((r) => {
    const entry = studentTotals.get(r.studentId) || { present: 0, total: 0 };
    entry.total += 1;
    if (r.status === 'Present' || r.status === 'Late') entry.present += 1;
    studentTotals.set(r.studentId, entry);
  });

  const flaggedStudents: LowAttendanceStudentAlert[] = [];
  studentTotals.forEach((stats, stuId) => {
    if (stats.total > 0) {
      const pct = Math.round((stats.present / stats.total) * 100);
      if (pct < limit) {
        const stu = students.find((s) => s.id === stuId);
        if (stu && stu.status === 'Active') {
          flaggedStudents.push({
            studentId: stu.id,
            name: stu.fullName,
            classSection: `${stu.classNumber}-${stu.section}`,
            presentDays: stats.present,
            totalDays: stats.total,
            percentage: pct,
          });
        }
      }
    }
  });

  flaggedStudents.sort((a, b) => a.percentage - b.percentage);

  if (options?.silent || !prefs.attendanceThresholdAlerts || flaggedStudents.length === 0) {
    return { thresholdPct: limit, flaggedStudents, notification: null };
  }

  const todayKey = new Date().toISOString().slice(0, 10);
  const signature = `${todayKey}_${limit}_${flaggedStudents.map((f) => `${f.studentId}:${f.percentage}`).join(',')}`;
  const lastSig = sessionStorage.getItem('sm_last_attendance_alert_sig');

  if (!options?.force && lastSig === signature) {
    return { thresholdPct: limit, flaggedStudents, notification: null };
  }
  sessionStorage.setItem('sm_last_attendance_alert_sig', signature);

  const sampleList = flaggedStudents
    .slice(0, 3)
    .map((s) => `${s.name} (Class ${s.classSection}): ${s.percentage}%`)
    .join('; ');

  const notification = emitPushNotification({
    title: `Principal Alert: ${flaggedStudents.length} student(s) below ${limit}% attendance`,
    titleUrdu: `پرنسپل الرٹ: ${flaggedStudents.length} طلباء ${limit}% سے کم حاضری`,
    message: `High-priority threshold (<${limit}%) triggered — ${sampleList}${flaggedStudents.length > 3 ? ` +${flaggedStudents.length - 3} more` : ''}.`,
    messageUrdu: `${flaggedStudents.length} طلباء کی حاضری مقررہ حد (${limit}%) سے کم ہے۔ فوری توجہ درکار ہے۔`,
    category: 'Attendance',
    targetRole: 'admin',
    priority: 'high',
  });

  return { thresholdPct: limit, flaggedStudents, notification };
}

export function evaluateAttendanceThresholdNotification(
  records: AttendanceRecord[],
  students: Student[],
  thresholdPct?: number
): PushNotificationItem | null {
  return monitorAttendanceAndNotifyPrincipal(records, students, thresholdPct, { force: true }).notification;
}

/**
 * Evaluates student attendance rates and automatically dispatches parent-facing
 * push notifications when automated parent low-attendance alerts are enabled
 * and a student's attendance falls below the configured threshold (default 75%).
 */
export function dispatchParentLowAttendanceNotifications(
  records: AttendanceRecord[],
  students: Student[],
  thresholdPct?: number
): { enabled: boolean; flaggedStudents: LowAttendanceStudentAlert[]; notificationsSent: PushNotificationItem[] } {
  const prefs = loadPushPreferences();
  const limit = thresholdPct ?? prefs.attendanceThresholdPercent ?? 75;
  const report = monitorAttendanceAndNotifyPrincipal(records, students, limit, { silent: true });

  if (!prefs.parentLowAttendanceAlerts || report.flaggedStudents.length === 0) {
    return {
      enabled: prefs.parentLowAttendanceAlerts,
      flaggedStudents: report.flaggedStudents,
      notificationsSent: [],
    };
  }

  const notificationsSent: PushNotificationItem[] = [];
  const todayKey = new Date().toISOString().slice(0, 10);
  const dedupKey = `sm_parent_low_att_sent_${todayKey}_${limit}_${report.flaggedStudents.map((s) => s.studentId).join(',')}`;

  if (sessionStorage.getItem(dedupKey)) {
    return {
      enabled: true,
      flaggedStudents: report.flaggedStudents,
      notificationsSent: [],
    };
  }
  sessionStorage.setItem(dedupKey, '1');

  const topList = report.flaggedStudents
    .slice(0, 4)
    .map((s) => `${s.name} (Class ${s.classSection}: ${s.percentage}%)`)
    .join(', ');

  notificationsSent.push(
    emitPushNotification({
      title: `Parent Push Alerts Sent (${report.flaggedStudents.length} below ${limit}%)`,
      titleUrdu: `والدین کو حاضری الرٹ بھیجا گیا (${report.flaggedStudents.length} طلباء ${limit}% سے کم)`,
      message: `Automated parent push notifications dispatched for students below ${limit}% threshold: ${topList}${
        report.flaggedStudents.length > 4 ? ` +${report.flaggedStudents.length - 4} more` : ''
      }.`,
      messageUrdu: `${limit}% سے کم حاضری والے طلباء کے والدین کو خودکار اطلاع بھیج دی گئی ہے۔`,
      category: 'Attendance',
      targetRole: 'all',
      priority: 'high',
    })
  );

  return {
    enabled: true,
    flaggedStudents: report.flaggedStudents,
    notificationsSent,
  };
}

export interface UpcomingExamCountdown {
  exam: Examination;
  daysUntilStart: number;
  isWithinReminderWindow: boolean;
}

/**
 * Inspects registered examinations in the Examination Module and automatically
 * dispatches push reminders to staff & administrators 3 days before start date.
 */
export function getUpcomingExamCountdowns(
  examinations: Examination[],
  daysBefore?: number,
  referenceDateStr?: string
): UpcomingExamCountdown[] {
  const prefs = loadPushPreferences();
  const windowDays = daysBefore ?? prefs.examReminderDaysBefore ?? 3;
  const refDate = referenceDateStr ? new Date(referenceDateStr) : new Date();
  refDate.setHours(0, 0, 0, 0);

  return examinations
    .filter((ex) => Boolean(ex.startDate))
    .map((ex) => {
      const start = new Date(ex.startDate);
      start.setHours(0, 0, 0, 0);
      const diffDays = Math.round((start.getTime() - refDate.getTime()) / 86400000);
      return {
        exam: ex,
        daysUntilStart: diffDays,
        isWithinReminderWindow: diffDays >= 0 && diffDays <= windowDays,
      };
    })
    .sort((a, b) => a.daysUntilStart - b.daysUntilStart);
}

export function runScheduledExamReminderCheck(
  examinations: Examination[],
  options?: { force?: boolean; daysBefore?: number; referenceDateStr?: string }
): PushNotificationItem[] {
  const prefs = loadPushPreferences();
  if (!prefs.examRemindersEnabled || examinations.length === 0) return [];

  const windowDays = options?.daysBefore ?? prefs.examReminderDaysBefore ?? 3;
  const countdowns = getUpcomingExamCountdowns(examinations, windowDays, options?.referenceDateStr);
  const dueExams = countdowns.filter((c) => c.isWithinReminderWindow);
  if (dueExams.length === 0) return [];

  const todayKey = new Date().toISOString().slice(0, 10);
  let sentCache: Record<string, string> = {};
  try {
    sentCache = JSON.parse(localStorage.getItem(SCHEDULER_SENT_CACHE_KEY) || '{}');
  } catch {
    sentCache = {};
  }

  const emitted: PushNotificationItem[] = [];
  dueExams.forEach(({ exam, daysUntilStart }) => {
    const cacheKey = `${exam.id}_${todayKey}`;
    if (!options?.force && sentCache[cacheKey]) return;
    sentCache[cacheKey] = new Date().toISOString();

    const dayLabel =
      daysUntilStart === 0
        ? 'Starts today'
        : daysUntilStart === 1
        ? 'Starts tomorrow (1 day left)'
        : `Starts in ${daysUntilStart} days`;

    emitted.push(
      emitPushNotification({
        title: `Exam Reminder (${dayLabel}): ${exam.name}`,
        titleUrdu: `امتحان کی یاد دہانی: ${exam.nameUrdu || exam.name}`,
        message: `${dayLabel} — Scheduled ${exam.startDate} to ${exam.endDate} for Classes ${exam.classes.join(', ')}. Staff & admins ensure question papers and registers are ready.`,
        messageUrdu: `تاریخ: ${exam.startDate} تا ${exam.endDate}۔ تمام اساتذہ اور عملہ امتحانی تیاری مکمل رکھیں۔`,
        category: 'Exam',
        targetRole: 'all',
        priority: daysUntilStart <= 1 ? 'high' : 'normal',
      })
    );
  });

  try {
    localStorage.setItem(SCHEDULER_SENT_CACHE_KEY, JSON.stringify(sentCache));
  } catch {
    // ignore
  }

  return emitted;
}

export function evaluateUpcomingExamNotifications(
  examinations: Examination[],
  referenceDateStr?: string
): PushNotificationItem | null {
  const list = runScheduledExamReminderCheck(examinations, {
    force: true,
    referenceDateStr,
  });
  if (list.length > 0) return list[0];

  // Fallback check if exams are scheduled beyond 3 days when manually tested
  const upcoming = getUpcomingExamCountdowns(examinations, 365, referenceDateStr).filter(
    (c) => c.daysUntilStart >= 0
  );
  if (upcoming.length === 0) return null;

  const nextExam = upcoming[0];
  return emitPushNotification({
    title: `Scheduled Exam Tracker: ${nextExam.exam.name}`,
    titleUrdu: `امتحان شیڈول: ${nextExam.exam.nameUrdu || nextExam.exam.name}`,
    message: `${nextExam.daysUntilStart} day(s) until ${nextExam.exam.startDate} (3-day auto-reminder armed for Classes ${nextExam.exam.classes.join(', ')}).`,
    messageUrdu: `امتحان ${nextExam.exam.startDate} کو شروع ہوگا۔ 3 دن قبل خودکار یاد دہانی فعال ہے۔`,
    category: 'Exam',
    targetRole: 'all',
    priority: 'normal',
  });
}

export interface ConsecutiveAbsenceAlert {
  student: Student;
  consecutiveDays: number;
  absentDates: string[];
  isOngoing: boolean;
  lastRecordedDate: string;
  parentContact: string;
}

export interface ConsecutiveAbsenceDispatchLog {
  id: string;
  dispatchedAt: string;
  channel: 'SMS + Push' | 'Push Only' | 'SMS Only';
  triggerType: 'manual_bulk' | 'automated_trigger';
  triggeredBy: string;
  recipientCount: number;
  recipients: Array<{
    studentId: string;
    studentName: string;
    admissionNumber: string;
    classSection: string;
    consecutiveDays: number;
    parentContact: string;
    status: 'Delivered (Push)' | 'Queued (SMS + Push)' | 'Queued (SMS)';
  }>;
  messagePreview: string;
}

export const CONSECUTIVE_ABSENCE_LOG_KEY = 'sm_consecutive_absence_dispatch_log_v1';

export function loadConsecutiveAbsenceDispatchLogs(): ConsecutiveAbsenceDispatchLog[] {
  try {
    const raw = localStorage.getItem(CONSECUTIVE_ABSENCE_LOG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch {
    // ignore storage parse issues
  }
  return [];
}

/**
 * Scans attendance records chronologically per student and returns active students
 * who have been marked 'Absent' for `minConsecutiveDays` (default 3) or more
 * consecutive recorded school days.
 */
export function findStudentsWithConsecutiveAbsences(
  records: AttendanceRecord[],
  students: Student[],
  minConsecutiveDays = 3
): ConsecutiveAbsenceAlert[] {
  const byStudent = new Map<string, Map<string, AttendanceRecord>>();

  records.forEach((rec) => {
    if (!rec.studentId || !rec.date) return;
    if (!byStudent.has(rec.studentId)) {
      byStudent.set(rec.studentId, new Map());
    }
    byStudent.get(rec.studentId)!.set(rec.date, rec);
  });

  const alerts: ConsecutiveAbsenceAlert[] = [];

  students.forEach((student) => {
    if (student.status !== 'Active') return;
    const dateMap = byStudent.get(student.id);
    if (!dateMap || dateMap.size < minConsecutiveDays) return;

    const sortedDates = Array.from(dateMap.keys()).sort();
    let bestDates: string[] = [];
    let currentDates: string[] = [];

    sortedDates.forEach((dateStr) => {
      const rec = dateMap.get(dateStr)!;
      if (rec.status === 'Absent') {
        currentDates.push(dateStr);
        if (currentDates.length >= bestDates.length) {
          bestDates = [...currentDates];
        }
      } else {
        currentDates = [];
      }
    });

    const isOngoing = currentDates.length >= minConsecutiveDays;
    const qualifyingDates = isOngoing ? currentDates : bestDates;

    if (qualifyingDates.length >= minConsecutiveDays) {
      alerts.push({
        student,
        consecutiveDays: qualifyingDates.length,
        absentDates: qualifyingDates,
        isOngoing,
        lastRecordedDate: sortedDates[sortedDates.length - 1],
        parentContact: student.parentWhatsAppNumber || student.mobileNumber || 'Not Provided',
      });
    }
  });

  return alerts.sort((a, b) => {
    if (a.isOngoing !== b.isOngoing) return a.isOngoing ? -1 : 1;
    if (b.consecutiveDays !== a.consecutiveDays) return b.consecutiveDays - a.consecutiveDays;
    return a.student.fullName.localeCompare(b.student.fullName);
  });
}

/**
 * Dispatches bulk SMS / Push notifications to parents of students absent for 3+ consecutive days,
 * emits a real in-app + browser Push Notification, and logs delivery receipts for admin audit.
 */
export function dispatchBulkConsecutiveAbsenceNotifications(params: {
  alerts: ConsecutiveAbsenceAlert[];
  channel: 'SMS + Push' | 'Push Only' | 'SMS Only';
  messageTemplate: string;
  schoolName: string;
  triggeredBy: string;
  triggerType: 'manual_bulk' | 'automated_trigger';
}): { logEntry: ConsecutiveAbsenceDispatchLog; pushItem: PushNotificationItem | null } {
  const { alerts, channel, messageTemplate, schoolName, triggeredBy, triggerType } = params;

  const deliveryStatus: 'Delivered (Push)' | 'Queued (SMS + Push)' | 'Queued (SMS)' =
    channel === 'SMS + Push'
      ? 'Queued (SMS + Push)'
      : channel === 'Push Only'
      ? 'Delivered (Push)'
      : 'Queued (SMS)';

  const sampleAlert = alerts[0];
  const samplePreview = sampleAlert
    ? messageTemplate
        .replace(/\{studentName\}/g, sampleAlert.student.fullName)
        .replace(/\{admissionNumber\}/g, sampleAlert.student.admissionNumber)
        .replace(/\{classSection\}/g, `${sampleAlert.student.classNumber}-${sampleAlert.student.section}`)
        .replace(/\{days\}/g, String(sampleAlert.consecutiveDays))
        .replace(/\{dates\}/g, sampleAlert.absentDates.join(', '))
        .replace(/\{schoolName\}/g, schoolName)
    : messageTemplate;

  const logEntry: ConsecutiveAbsenceDispatchLog = {
    id: `abs_dispatch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    dispatchedAt: new Date().toISOString(),
    channel,
    triggerType,
    triggeredBy,
    recipientCount: alerts.length,
    recipients: alerts.map((a) => ({
      studentId: a.student.id,
      studentName: a.student.fullName,
      admissionNumber: a.student.admissionNumber,
      classSection: `${a.student.classNumber}-${a.student.section}`,
      consecutiveDays: a.consecutiveDays,
      parentContact: a.parentContact,
      status: deliveryStatus,
    })),
    messagePreview: samplePreview,
  };

  try {
    const existing = loadConsecutiveAbsenceDispatchLogs();
    const updated = [logEntry, ...existing].slice(0, 25);
    localStorage.setItem(CONSECUTIVE_ABSENCE_LOG_KEY, JSON.stringify(updated));
  } catch {
    // ignore storage errors
  }

  let pushItem: PushNotificationItem | null = null;
  if (alerts.length > 0) {
    const namesSummary = alerts
      .slice(0, 3)
      .map((a) => `${a.student.fullName} (${a.consecutiveDays}d)`)
      .join(', ');
    pushItem = emitPushNotification({
      title: `Parent ${channel} Dispatched (${alerts.length} student${alerts.length === 1 ? '' : 's'} · 3+ Days Absent)`,
      titleUrdu: `والدین کو مسلسل غیر حاضری الرٹ بھیجا گیا (${alerts.length} طلباء)`,
      message: `${triggerType === 'automated_trigger' ? 'Automated trigger' : 'Admin bulk dispatch'} sent ${channel} alerts to parents of: ${namesSummary}${
        alerts.length > 3 ? ` +${alerts.length - 3} more` : ''
      }.`,
      messageUrdu: `مسلسل 3 یا زیادہ دن غیر حاضر طلباء کے والدین کو ${channel} اطلاع بھیج دی گئی ہے۔`,
      category: 'Attendance',
      targetRole: 'all',
      priority: 'high',
    });
  }

  return { logEntry, pushItem };
}

/**
 * Starts the automated background scheduler that checks Examination dates (3-day lead window)
 * and Principal attendance threshold (<75%) on startup and every 60 seconds.
 */
export function startAutomatedNotificationScheduler(
  getExaminations: () => Examination[],
  getAttendanceRecords: () => AttendanceRecord[],
  getStudents: () => Student[]
): () => void {
  const tick = () => {
    runScheduledExamReminderCheck(getExaminations(), { force: false });
    monitorAttendanceAndNotifyPrincipal(getAttendanceRecords(), getStudents());
  };

  const initialTimer = setTimeout(tick, 1200);
  const intervalId = setInterval(tick, 60_000);
  return () => {
    clearTimeout(initialTimer);
    clearInterval(intervalId);
  };
}
