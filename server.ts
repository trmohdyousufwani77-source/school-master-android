import express from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

const PORT = 3000;
const JKEPM_STORE_PATH = path.resolve(process.cwd(), '.jkepm-portal-store.json');
const LEAVE_STORE_PATH = path.resolve(process.cwd(), '.teacher-leave-store.json');
const TEACHER_ATTENDANCE_STORE_PATH = path.resolve(process.cwd(), '.teacher-attendance-store.json');

interface JkepmServerStore {
  reports: any[];
  cpisMigrations: any[];
  auditLogs: any[];
  updatedAt: string;
}

interface TeacherLeaveServerStore {
  leaves: any[];
  auditLogs: any[];
  updatedAt: string;
}

interface TeacherAttendanceServerStore {
  records: any[];
  updatedAt: string;
}

function readJkepmStore(): JkepmServerStore {
  try {
    if (fs.existsSync(JKEPM_STORE_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(JKEPM_STORE_PATH, 'utf-8'));
      return {
        reports: Array.isArray(parsed.reports) ? parsed.reports : [],
        cpisMigrations: Array.isArray(parsed.cpisMigrations) ? parsed.cpisMigrations : [],
        auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [],
        updatedAt: parsed.updatedAt || new Date().toISOString(),
      };
    }
  } catch (err) {
    console.warn('JKEPM store read warning:', err);
  }
  return { reports: [], cpisMigrations: [], auditLogs: [], updatedAt: new Date().toISOString() };
}

function writeJkepmStore(store: JkepmServerStore): void {
  try {
    store.updatedAt = new Date().toISOString();
    fs.writeFileSync(JKEPM_STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.warn('JKEPM store write warning:', err);
  }
}

function readLeaveStore(): TeacherLeaveServerStore {
  try {
    if (fs.existsSync(LEAVE_STORE_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(LEAVE_STORE_PATH, 'utf-8'));
      return {
        leaves: Array.isArray(parsed.leaves) ? parsed.leaves : [],
        auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [],
        updatedAt: parsed.updatedAt || new Date().toISOString(),
      };
    }
  } catch (err) {
    console.warn('Leave store read warning:', err);
  }
  return { leaves: [], auditLogs: [], updatedAt: new Date().toISOString() };
}

function writeLeaveStore(store: TeacherLeaveServerStore): void {
  try {
    store.updatedAt = new Date().toISOString();
    fs.writeFileSync(LEAVE_STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Leave store write warning:', err);
  }
}

function readTeacherAttendanceStore(): TeacherAttendanceServerStore {
  try {
    if (fs.existsSync(TEACHER_ATTENDANCE_STORE_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(TEACHER_ATTENDANCE_STORE_PATH, 'utf-8'));
      return {
        records: Array.isArray(parsed.records) ? parsed.records : [],
        updatedAt: parsed.updatedAt || new Date().toISOString(),
      };
    }
  } catch (err) {
    console.warn('Teacher attendance store read warning:', err);
  }
  return { records: [], updatedAt: new Date().toISOString() };
}

function writeTeacherAttendanceStore(store: TeacherAttendanceServerStore): void {
  try {
    store.updatedAt = new Date().toISOString();
    fs.writeFileSync(TEACHER_ATTENDANCE_STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Teacher attendance store write warning:', err);
  }
}

function hasOverlappingActiveLeave(
  leaves: any[],
  employeeId: string,
  startDate: string,
  endDate: string,
  excludeId?: string
): any | undefined {
  const normEmp = String(employeeId || '').trim().toUpperCase();
  return leaves.find((l) => {
    if (excludeId && l.id === excludeId) return false;
    if (l.deletedStatus === 'Deleted' || l.status === 'Rejected') return false;
    if (String(l.employeeId || '').trim().toUpperCase() !== normEmp) return false;
    return l.startDate <= endDate && l.endDate >= startDate;
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '32mb' }));

  app.get(/\.apk$/i, (req, res) => {
    const requestedName = path.basename(req.path);
    if (!/^[A-Za-z0-9._-]+\.apk$/i.test(requestedName)) {
      return res.status(400).json({ ok: false, error: 'Invalid APK filename requested.' });
    }

    const candidateRoots = [
      path.resolve(process.cwd(), 'public'),
      path.resolve(process.cwd(), 'dist'),
    ];

    let resolvedApkPath: string | null = null;
    for (const rootDir of candidateRoots) {
      const candidate = path.resolve(rootDir, requestedName);
      if (candidate.startsWith(rootDir + path.sep) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        resolvedApkPath = candidate;
        break;
      }
    }

    if (!resolvedApkPath) {
      return res.status(404).json({ ok: false, error: `Requested APK "${requestedName}" was not found on this server.` });
    }

    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${requestedName === 'SchoolMaster-release.apk' ? 'SchoolMaster-v1.0.4-release.apk' : requestedName}"`
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.sendFile(resolvedApkPath);
  });

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'school-master', timestamp: new Date().toISOString() });
  });

  // =========================================================================
  // JKEPM QUARTERLY APPRAISAL & CPIS CODE MIGRATION REST API
  // =========================================================================
  app.get('/api/jkepm/state', (_req, res) => {
    const store = readJkepmStore();
    res.json(store);
  });

  app.get('/api/jkepm/submissions', (req, res) => {
    const store = readJkepmStore();
    const { teacherId, cpisCode, quarter, status, udise } = req.query as Record<string, string | undefined>;
    let list = store.reports.filter((r) => !r.isArchivedDeleted);
    if (teacherId) list = list.filter((r) => r.teacherId === teacherId);
    if (cpisCode) list = list.filter((r) => String(r.cpisCode || '').toLowerCase().includes(cpisCode.toLowerCase()));
    if (quarter) list = list.filter((r) => r.quarter === quarter);
    if (status) list = list.filter((r) => r.status === status);
    if (udise) list = list.filter((r) => String(r.schoolUdiseCode || '').includes(udise));
    res.json({ count: list.length, submissions: list });
  });

  app.post('/api/jkepm/submissions', (req, res) => {
    const payload = req.body;
    if (!payload || !payload.id || !payload.teacherId || !payload.cpisCode) {
      return res.status(400).json({ error: 'Invalid JKEPM appraisal payload: id, teacherId, and cpisCode are required.' });
    }
    const store = readJkepmStore();
    const idx = store.reports.findIndex((r) => r.id === payload.id);
    if (idx >= 0) {
      store.reports[idx] = { ...store.reports[idx], ...payload, updatedAt: new Date().toISOString() };
    } else {
      store.reports.unshift({ ...payload, createdAt: payload.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    writeJkepmStore(store);
    return res.status(idx >= 0 ? 200 : 201).json({ ok: true, report: idx >= 0 ? store.reports[idx] : store.reports[0] });
  });

  app.put('/api/jkepm/submissions/:id', (req, res) => {
    const { id } = req.params;
    const payload = req.body;
    const store = readJkepmStore();
    const idx = store.reports.findIndex((r) => r.id === id);
    if (idx < 0) {
      store.reports.unshift({ ...payload, id, updatedAt: new Date().toISOString() });
    } else {
      store.reports[idx] = { ...store.reports[idx], ...payload, id, updatedAt: new Date().toISOString() };
    }
    writeJkepmStore(store);
    return res.json({ ok: true, report: store.reports[idx >= 0 ? idx : 0] });
  });

  app.delete('/api/jkepm/submissions/:id', (req, res) => {
    const { id } = req.params;
    const { authorizedAdmin } = req.query as { authorizedAdmin?: string };
    const store = readJkepmStore();
    const idx = store.reports.findIndex((r) => r.id === id);
    if (idx < 0) return res.status(404).json({ error: 'Submission not found.' });
    const target = store.reports[idx];
    if (target.status !== 'Draft' && authorizedAdmin !== 'true') {
      return res.status(403).json({ error: 'Submitted reports cannot be permanently deleted without administrative authorization.' });
    }
    if (target.status === 'Draft') {
      store.reports.splice(idx, 1);
    } else {
      store.reports[idx] = { ...target, isArchivedDeleted: true, updatedAt: new Date().toISOString() };
    }
    writeJkepmStore(store);
    return res.json({ ok: true });
  });

  app.post('/api/jkepm/cpis-migrations', (req, res) => {
    const migration = req.body;
    if (!migration || !migration.id || !migration.oldCpisCode || !migration.newCpisCode) {
      return res.status(400).json({ error: 'Invalid CPIS migration payload.' });
    }
    const store = readJkepmStore();
    const normalizedNew = String(migration.newCpisCode).trim().toUpperCase();
    const duplicate = store.cpisMigrations.find(
      (m) =>
        m.id !== migration.id &&
        m.teacherId !== migration.teacherId &&
        m.status !== 'Rejected' &&
        String(m.newCpisCode || '').trim().toUpperCase() === normalizedNew
    );
    if (duplicate) {
      return res.status(409).json({
        error: `Duplicate CPIS Code "${migration.newCpisCode}" is already assigned to ${duplicate.teacherName}.`,
      });
    }
    const idx = store.cpisMigrations.findIndex((m) => m.id === migration.id);
    if (idx >= 0) {
      store.cpisMigrations[idx] = { ...store.cpisMigrations[idx], ...migration };
    } else {
      store.cpisMigrations.unshift(migration);
    }
    writeJkepmStore(store);
    return res.json({ ok: true, migration });
  });

  app.post('/api/jkepm/audit', (req, res) => {
    const entry = req.body;
    if (!entry || !entry.id || !entry.action) {
      return res.status(400).json({ error: 'Invalid audit entry.' });
    }
    const store = readJkepmStore();
    store.auditLogs = [entry, ...store.auditLogs.filter((a) => a.id !== entry.id)].slice(0, 500);
    writeJkepmStore(store);
    return res.status(201).json({ ok: true });
  });

  // =========================================================================
  // TEACHER LEAVE MANAGEMENT REST API (CRUD, REVIEW, APPROVE, REJECT, AUDIT)
  // =========================================================================
  app.get('/api/leaves', (req, res) => {
    const store = readLeaveStore();
    const { employeeId, status, includeDeleted } = req.query as Record<string, string | undefined>;
    let list = store.leaves;
    if (includeDeleted !== 'true') {
      list = list.filter((l) => l.deletedStatus !== 'Deleted');
    }
    if (employeeId) {
      list = list.filter((l) => String(l.employeeId || '').toUpperCase() === employeeId.toUpperCase());
    }
    if (status) {
      list = list.filter((l) => l.status === status);
    }
    res.json({ count: list.length, leaves: list, auditLogs: store.auditLogs });
  });

  app.post('/api/leaves', (req, res) => {
    const payload = req.body;
    if (!payload || !payload.id || !payload.employeeId || !payload.startDate || !payload.endDate || !payload.reason) {
      return res.status(400).json({ error: 'Missing required leave application fields.' });
    }
    if (payload.endDate < payload.startDate) {
      return res.status(400).json({ error: 'End date cannot be earlier than start date.' });
    }
    const store = readLeaveStore();
    const overlap = hasOverlappingActiveLeave(store.leaves, payload.employeeId, payload.startDate, payload.endDate, payload.id);
    if (overlap) {
      return res.status(409).json({
        error: `Overlapping leave application (${overlap.startDate} to ${overlap.endDate}) already exists.`,
      });
    }
    const now = new Date().toISOString();
    const record = {
      ...payload,
      status: payload.status || 'Pending',
      deletedStatus: payload.deletedStatus || 'Active',
      createdAt: payload.createdAt || now,
      updatedAt: now,
    };
    const idx = store.leaves.findIndex((l) => l.id === record.id);
    if (idx >= 0) {
      store.leaves[idx] = record;
    } else {
      store.leaves.unshift(record);
    }
    writeLeaveStore(store);
    return res.status(idx >= 0 ? 200 : 201).json({ ok: true, leave: record });
  });

  app.put('/api/leaves/:id', (req, res) => {
    const { id } = req.params;
    const payload = req.body;
    const store = readLeaveStore();
    const idx = store.leaves.findIndex((l) => l.id === id);
    const existing = idx >= 0 ? store.leaves[idx] : null;
    const isAdminActor = req.query.isHeadmaster === 'true';
    if (existing && (existing.status === 'Approved' || existing.status === 'Rejected') && !isAdminActor) {
      return res.status(403).json({ error: 'Approved or rejected leave applications are read-only.' });
    }
    if (payload.startDate && payload.endDate && payload.endDate < payload.startDate) {
      return res.status(400).json({ error: 'End date cannot be earlier than start date.' });
    }
    if (payload.employeeId && payload.startDate && payload.endDate) {
      const overlap = hasOverlappingActiveLeave(store.leaves, payload.employeeId, payload.startDate, payload.endDate, id);
      if (overlap) {
        return res.status(409).json({
          error: `Dates overlap with existing application (${overlap.startDate} to ${overlap.endDate}).`,
        });
      }
    }
    const now = new Date().toISOString();
    const updated = { ...(existing || {}), ...payload, id, updatedAt: now };
    if (idx >= 0) {
      store.leaves[idx] = updated;
    } else {
      store.leaves.unshift(updated);
    }
    writeLeaveStore(store);
    return res.json({ ok: true, leave: updated });
  });

  app.post('/api/leaves/:id/decision', (req, res) => {
    const { id } = req.params;
    const { status, actorName, headmasterRemarks, rejectionReason } = req.body || {};
    if (!['Under_Review', 'Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid decision status.' });
    }
    if (status === 'Rejected' && !String(rejectionReason || '').trim()) {
      return res.status(400).json({ error: 'Mandatory rejection reason is required.' });
    }
    const store = readLeaveStore();
    const idx = store.leaves.findIndex((l) => l.id === id);
    if (idx < 0) return res.status(404).json({ error: 'Leave application not found.' });
    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    store.leaves[idx] = {
      ...store.leaves[idx],
      status,
      approvedBy: status === 'Under_Review' ? store.leaves[idx].approvedBy : actorName || 'Headmaster',
      reviewedBy: actorName || 'Headmaster',
      reviewDate: today,
      approvalDate: status === 'Under_Review' ? store.leaves[idx].approvalDate : today,
      decisionDate: status === 'Under_Review' ? store.leaves[idx].decisionDate : today,
      headmasterRemarks: headmasterRemarks || store.leaves[idx].headmasterRemarks || '',
      remarks: headmasterRemarks || rejectionReason || store.leaves[idx].remarks || '',
      rejectionReason: status === 'Rejected' ? String(rejectionReason).trim() : store.leaves[idx].rejectionReason,
      updatedAt: now,
    };
    writeLeaveStore(store);
    return res.json({ ok: true, leave: store.leaves[idx] });
  });

  app.delete('/api/leaves/:id', (req, res) => {
    const { id } = req.params;
    const { deletedBy, reason } = req.body || {};
    const store = readLeaveStore();
    const idx = store.leaves.findIndex((l) => l.id === id);
    if (idx < 0) return res.status(404).json({ error: 'Leave application not found.' });
    const target = store.leaves[idx];
    if (target.status === 'Approved' || target.status === 'Rejected') {
      return res.status(403).json({ error: 'Approved or rejected applications cannot be deleted.' });
    }
    const now = new Date().toISOString();
    store.leaves[idx] = {
      ...target,
      deletedStatus: 'Deleted',
      deletedAt: now,
      deletedBy: deletedBy || 'Teacher',
      deletionReason: reason || 'Withdrawn by applicant',
      updatedAt: now,
    };
    writeLeaveStore(store);
    return res.json({ ok: true, leave: store.leaves[idx] });
  });

  app.post('/api/ocr/extract-students', async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          error: 'GEMINI_API_KEY is not configured in server secrets.',
          fallbackAvailable: true,
        });
      }

      const { files = [], rawText = '' } = req.body as {
        files?: { name?: string; mimeType: string; base64Data: string }[];
        rawText?: string;
      };

      if ((!Array.isArray(files) || files.length === 0) && !String(rawText || '').trim()) {
        return res.status(400).json({ error: 'Provide at least one image/PDF file or OCR text.' });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const parts: any[] = [];
      for (const file of files.slice(0, 8)) {
        if (file?.base64Data && file?.mimeType) {
          parts.push({
            inlineData: {
              mimeType: file.mimeType,
              data: file.base64Data,
            },
          });
        }
      }

      const promptText = [
        'Extract ALL student records from these school admission forms, registers, or scanned sheets.',
        'Intelligently map column headings (e.g. Name/Student Name/Pupil Name -> fullName; Father/Father\'s Name/Guardian Name -> fatherName; DOB/Date of Birth/Birth Date -> dob).',
        'Do NOT mix fields from adjacent rows. Normalize dates to YYYY-MM-DD when unambiguous; otherwise keep exact scanned string and list that field inside uncertainFields.',
        'Estimate confidenceScore from 0 to 100 for each extracted student row.',
        rawText ? `Additional scanned text:\n${rawText}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      parts.push({ text: promptText });

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: { parts },
        config: {
          systemInstruction:
            'You are a high-precision school admission register OCR engine. Extract tabular and form-based student records accurately without hallucinating missing data.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              detectedHeaders: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              records: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    admissionNumber: { type: Type.STRING },
                    fullName: { type: Type.STRING },
                    fatherName: { type: Type.STRING },
                    motherName: { type: Type.STRING },
                    dob: { type: Type.STRING },
                    gender: { type: Type.STRING },
                    classNumber: { type: Type.STRING },
                    section: { type: Type.STRING },
                    rollNumber: { type: Type.STRING },
                    category: { type: Type.STRING },
                    religion: { type: Type.STRING },
                    nationality: { type: Type.STRING },
                    address: { type: Type.STRING },
                    mobileNumber: { type: Type.STRING },
                    previousSchool: { type: Type.STRING },
                    admissionDate: { type: Type.STRING },
                    academicSession: { type: Type.STRING },
                    confidenceScore: { type: Type.NUMBER },
                    uncertainFields: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                  },
                },
              },
            },
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      return res.json({
        detectedHeaders: Array.isArray(parsed.detectedHeaders) ? parsed.detectedHeaders : [],
        records: Array.isArray(parsed.records) ? parsed.records : [],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'OCR extraction failed.';
      console.error('OCR API Error:', message);
      return res.status(500).json({ error: message });
    }
  });

  // =========================================================================
  // TEACHER ATTENDANCE & SERVICE BOOK DAILY REGISTER API (DATE-WISE SYNC)
  // =========================================================================
  app.get('/api/teacher-attendance', (req, res) => {
    const store = readTeacherAttendanceStore();
    const { teacherId, date } = req.query as { teacherId?: string; date?: string };
    let list = store.records;
    if (teacherId) list = list.filter((r) => r.teacherId === teacherId);
    if (date) list = list.filter((r) => r.date === date);
    return res.json({ count: list.length, records: list });
  });

  app.post('/api/teacher-attendance', (req, res) => {
    const payload = req.body;
    if (!payload || !payload.teacherId || !payload.date || !payload.status) {
      return res.status(400).json({ error: 'Missing required teacher attendance fields (teacherId, date, status).' });
    }
    const store = readTeacherAttendanceStore();
    const now = new Date().toISOString();
    const id = payload.id || `att-${payload.teacherId}-${payload.date}`;
    const idx = store.records.findIndex((r) => r.teacherId === payload.teacherId && r.date === payload.date);
    const mergedRecord = {
      ...(idx >= 0 ? store.records[idx] : {}),
      ...payload,
      id,
      updatedAt: now,
    };
    if (idx >= 0) {
      store.records[idx] = mergedRecord;
    } else {
      store.records.unshift(mergedRecord);
    }
    writeTeacherAttendanceStore(store);
    return res.status(idx >= 0 ? 200 : 201).json({ ok: true, record: mergedRecord });
  });

  app.put('/api/teacher-attendance/:id', (req, res) => {
    const { id } = req.params;
    const payload = req.body;
    const store = readTeacherAttendanceStore();
    const now = new Date().toISOString();
    const idx = store.records.findIndex(
      (r) => r.id === id || (payload?.teacherId && payload?.date && r.teacherId === payload.teacherId && r.date === payload.date)
    );
    const mergedRecord = {
      ...(idx >= 0 ? store.records[idx] : {}),
      ...payload,
      id,
      updatedAt: now,
    };
    if (idx >= 0) {
      store.records[idx] = mergedRecord;
    } else {
      store.records.unshift(mergedRecord);
    }
    writeTeacherAttendanceStore(store);
    return res.json({ ok: true, record: mergedRecord });
  });

  // =========================================================================
  // ABOUT US & APP INFORMATION API (RBAC ENFORCED + SEPARATE PROTECTED DEV PROFILE)
  // =========================================================================
  let schoolAboutUsRecord: Record<string, any> = {
    id: 'school-about-main',
    schoolName: 'Govt Middle School Pamposh Colony',
    schoolAddress: 'Pamposh Colony, Palapora Zone, Iddgah',
    appName: 'SchoolMaster (HPC & JKHRMS)',
    appVersion: 'v1.0.0',
    updatedAt: new Date().toISOString(),
  };
  const schoolInfoAuditLogStore: Array<Record<string, any>> = [];

  // Strictly separated protected developer / ownership record (NEVER writable by School Admin)
  const protectedDeveloperRecord: Record<string, any> = Object.seal({
    id: 'dev-admin-1',
    developerName: 'Mohd Yousuf Wani',
    designation: 'App Developer / Administrator',
    institution: 'Govt Middle School, Pamposh Colony',
    locality: 'Pamposh Colony',
    district: 'Srinagar',
    unionTerritory: 'Jammu & Kashmir, India',
    developerEmail: 'mohdyousufwani1977@gmail.com',
    developerPhone: '+91 94190 12345',
    ownershipNotice: 'Protected Original App Developer & Super Administrator Ownership Record',
    isProtected: true,
    updatedAt: '2026-11-14T00:00:00.000Z',
  });

  const ALLOWED_SCHOOL_ADMIN_ROLES = new Set([
    'school_admin',
    'admin',
    'head_teacher',
    'primary_admin',
    'senior_admin',
    'junior_admin',
    'super_admin',
    'app_developer',
  ]);

  const ALLOWED_SCHOOL_INFO_FIELDS = new Set([
    'schoolName',
    'schoolIntroduction',
    'schoolHistory',
    'schoolVision',
    'schoolMission',
    'schoolObjectives',
    'schoolAddress',
    'schoolContactNumber',
    'schoolEmail',
    'schoolWebsite',
    'schoolFacilities',
    'principalsMessage',
    'otherSchoolInfo',
    'appName',
    'appDescription',
    'appVersion',
    'appFeatures',
    'appPurpose',
    'appSupportEmail',
    'appSupportContactNumber',
    'privacyPolicy',
    'termsAndConditions',
    'copyrightInfo',
  ]);

  app.get('/api/school-about-us', (_req, res) => {
    return res.json({
      ok: true,
      data: schoolAboutUsRecord,
      auditLogs: schoolInfoAuditLogStore.slice(0, 100),
    });
  });

  app.put('/api/school-about-us', (req, res) => {
    const role = String(req.headers['x-user-role'] || req.body?.actorRole || '').toLowerCase().trim();
    const actorName = String(req.headers['x-user-name'] || req.body?.actorName || 'School Admin').slice(0, 140);
    if (!ALLOWED_SCHOOL_ADMIN_ROLES.has(role)) {
      return res.status(403).json({
        ok: false,
        error: 'Forbidden: Only authorized School Administrators can update About Us and App Information.',
      });
    }

    const incomingData = req.body?.data && typeof req.body.data === 'object' ? req.body.data : req.body;
    const sanitizedPatch: Record<string, string> = {};
    const changedFields: string[] = [];

    for (const [key, val] of Object.entries(incomingData || {})) {
      if (!ALLOWED_SCHOOL_INFO_FIELDS.has(key)) continue;
      const strVal = String(val ?? '').trim().slice(0, 3000);
      if (schoolAboutUsRecord[key] !== strVal) {
        changedFields.push(key);
      }
      sanitizedPatch[key] = strVal;
    }

    if (sanitizedPatch.schoolName !== undefined && sanitizedPatch.schoolName.length < 2) {
      return res.status(400).json({ ok: false, error: 'School Name must be at least 2 characters.' });
    }
    if (sanitizedPatch.appName !== undefined && sanitizedPatch.appName.length < 2) {
      return res.status(400).json({ ok: false, error: 'App Name must be at least 2 characters.' });
    }

    const now = new Date().toISOString();
    schoolAboutUsRecord = {
      ...schoolAboutUsRecord,
      ...sanitizedPatch,
      updatedByName: actorName,
      updatedByRole: role,
      updatedAt: now,
    };

    const section =
      req.body?.section === 'App Information' || req.body?.section === 'School Logo'
        ? req.body.section
        : 'About Us';
    const auditEntry = {
      id: `about-audit-${Date.now()}`,
      section,
      action: 'UPDATE',
      changedFields,
      summary:
        String(req.body?.summary || '').slice(0, 600) ||
        `Updated ${section} (${changedFields.length > 0 ? changedFields.join(', ') : 'metadata saved'})`,
      actorName,
      actorRole: role,
      timestamp: now,
    };
    schoolInfoAuditLogStore.unshift(auditEntry);

    return res.json({
      ok: true,
      data: schoolAboutUsRecord,
      auditEntry,
    });
  });

  // Read-only protected developer record endpoint (NEVER modifiable by School Admin)
  app.get('/api/protected-developer-profile', (_req, res) => {
    return res.json({
      ok: true,
      readOnlyForSchoolAdmin: true,
      profile: { ...protectedDeveloperRecord },
    });
  });

  app.put('/api/protected-developer-profile', (req, res) => {
    const role = String(req.headers['x-user-role'] || '').toLowerCase().trim();
    const devEmail = String(req.headers['x-developer-email'] || '').toLowerCase().trim();
    if ((role !== 'super_admin' && role !== 'app_developer') || devEmail !== 'mohdyousufwani1977@gmail.com') {
      return res.status(403).json({
        ok: false,
        error:
          'Forbidden: Developer & Original App Ownership records are strictly protected and cannot be modified by School Admin or Teacher accounts.',
      });
    }
    return res.json({
      ok: true,
      profile: { ...protectedDeveloperRecord },
    });
  });

  app.delete('/api/protected-developer-profile', (_req, res) => {
    return res.status(403).json({
      ok: false,
      error: 'Forbidden: Protected App Developer and Original Ownership records cannot be deleted.',
    });
  });

  // Return structured JSON 404 for unknown /api/* routes instead of HTML fallback
  app.all('/api/*', (_req, res) => {
    return res.status(404).json({ ok: false, error: 'API endpoint not found.' });
  });

  // Structured JSON error handler for malformed JSON bodies and unexpected API errors
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err && err.type === 'entity.parse.failed') {
      return res.status(400).json({ ok: false, error: 'Malformed JSON request body.' });
    }
    if (req.path.startsWith('/api/')) {
      console.error('Unhandled API error:', err?.message || err);
      return res.status(500).json({ ok: false, error: 'Internal server error.' });
    }
    return next(err);
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
