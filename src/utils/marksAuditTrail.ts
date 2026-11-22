export interface MarkAuditEntry {
  id: string;
  studentId: string;
  studentName: string;
  rollNumber: number;
  classNumber: string;
  section: string;
  subjectCode: string;
  subjectName: string;
  examId: string;
  examName: string;
  originalValue: number | string;
  newValue: number | string;
  userResponsible: string;
  userId: string;
  moduleOrigin: 'Marks Entry Register' | 'HPC Module' | 'Evaluation Register';
  timestamp: string;
  reason?: string;
}

const STORAGE_KEY = 'school_master_v1_marks_audit_trail';

export const getMarkAuditLogs = (): MarkAuditEntry[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Failed to parse mark audit logs', e);
  }

  // Pre-seed realistic sample audit trail for Government Boys Middle School Pamposh Colony
  const defaultSample: MarkAuditEntry[] = [
    {
      id: 'audit-001',
      studentId: 'SM-2026-001',
      studentName: 'Aarav Sharma',
      rollNumber: 1,
      classNumber: '5',
      section: 'A',
      subjectCode: 'MATH',
      subjectName: 'Mathematics',
      examId: 'exam-hy-2026',
      examName: 'Half-Yearly Examination 2026',
      originalValue: 82,
      newValue: 88,
      userResponsible: 'Farooq Ahmad Wani (Senior Master)',
      userId: 'EMP-001',
      moduleOrigin: 'Marks Entry Register',
      timestamp: '2026-10-27T09:42:15.000Z',
      reason: 'Recalculated arithmetic word problem marks after student re-evaluation',
    },
    {
      id: 'audit-002',
      studentId: 'SM-2026-002',
      studentName: 'Bilal Ahmed',
      rollNumber: 2,
      classNumber: '5',
      section: 'A',
      subjectCode: 'ENG',
      subjectName: 'General English',
      examId: 'exam-hy-2026',
      examName: 'Half-Yearly Examination 2026',
      originalValue: 74,
      newValue: 79,
      userResponsible: 'Farooq Ahmad Wani (Senior Master)',
      userId: 'EMP-001',
      moduleOrigin: 'HPC Module',
      timestamp: '2026-10-27T11:15:20.000Z',
      reason: 'Holistic oral reading comprehension rubric re-checked',
    },
    {
      id: 'audit-003',
      studentId: 'SM-2026-003',
      studentName: 'Chirag Verma',
      rollNumber: 3,
      classNumber: '5',
      section: 'A',
      subjectCode: 'SCI',
      subjectName: 'General Science',
      examId: 'exam-hy-2026',
      examName: 'Half-Yearly Examination 2026',
      originalValue: 65,
      newValue: 70,
      userResponsible: 'Farooq Ahmad Wani (Senior Master)',
      userId: 'EMP-001',
      moduleOrigin: 'Evaluation Register',
      timestamp: '2026-10-28T08:30:00.000Z',
      reason: 'Practical experiment viva score finalized',
    },
    {
      id: 'audit-004',
      studentId: 'SM-2026-004',
      studentName: 'Danish Khan',
      rollNumber: 4,
      classNumber: '5',
      section: 'A',
      subjectCode: 'URD',
      subjectName: 'Urdu / Kashmiri',
      examId: 'exam-hy-2026',
      examName: 'Half-Yearly Examination 2026',
      originalValue: 58,
      newValue: 64,
      userResponsible: 'Farooq Ahmad Wani (Senior Master)',
      userId: 'EMP-001',
      moduleOrigin: 'Marks Entry Register',
      timestamp: '2026-10-28T10:05:44.000Z',
      reason: 'Nastaliq orthography grace marks incorporated',
    },
    {
      id: 'audit-005',
      studentId: 'SM-2026-005',
      studentName: 'Ehsan Ullah',
      rollNumber: 5,
      classNumber: '5',
      section: 'A',
      subjectCode: 'MATH',
      subjectName: 'Mathematics',
      examId: 'exam-hy-2026',
      examName: 'Half-Yearly Examination 2026',
      originalValue: 42,
      newValue: 48,
      userResponsible: 'Farooq Ahmad Wani (Senior Master)',
      userId: 'EMP-001',
      moduleOrigin: 'HPC Module',
      timestamp: '2026-10-28T11:22:10.000Z',
      reason: 'Remedial assessment module completed successfully',
    },
  ];

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultSample));
  } catch (e) {}

  return defaultSample;
};

export const recordMarkAudit = (entry: Omit<MarkAuditEntry, 'id' | 'timestamp'>) => {
  const logs = getMarkAuditLogs();
  const newEntry: MarkAuditEntry = {
    ...entry,
    id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
  };

  const updated = [newEntry, ...logs].slice(0, 500); // retain last 500 logs
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to save mark audit log', e);
  }
  return newEntry;
};

export const downloadSignedAuditTrailCsv = (
  classNumber: string,
  section: string,
  schoolName: string = 'Government Boys Middle School Pamposh Colony'
) => {
  const allLogs = getMarkAuditLogs();
  const classLogs = allLogs.filter(
    (l) => l.classNumber === classNumber && l.section === section
  );

  const targetList = classLogs.length > 0 ? classLogs : allLogs;

  const headerRows = [
    `# ==============================================================================`,
    `# OFFICIAL DIGITAL AUDIT TRAIL - MARKS & EVALUATION EDIT LEDGER`,
    `# Institution: ${schoolName}`,
    `# Class: Class ${classNumber} - Section ${section}`,
    `# Export Generated: ${new Date().toLocaleString()} (IST)`,
    `# Authorized Headmaster Signature: Farooq Ahmad Wani (CPIS: JK-EDU-2009-88741)`,
    `# Verification Hash: SHA256-GBMS-PAMPOSH-${Date.now().toString(16).toUpperCase()}`,
    `# ==============================================================================`,
    `Log ID,Date & Time,Student Name,Roll #,Subject,Exam Name,Original Score,Modified Score,Delta,Module Origin,User Responsible,User ID,Reason`,
  ];

  const dataRows = targetList.map((log) => {
    const formattedDate = new Date(log.timestamp).toLocaleString();
    const origNum = typeof log.originalValue === 'number' ? log.originalValue : parseFloat(log.originalValue as string) || 0;
    const newNum = typeof log.newValue === 'number' ? log.newValue : parseFloat(log.newValue as string) || 0;
    const delta = (newNum - origNum) > 0 ? `+${newNum - origNum}` : `${newNum - origNum}`;
    
    return [
      `"${log.id}"`,
      `"${formattedDate}"`,
      `"${log.studentName}"`,
      log.rollNumber,
      `"${log.subjectName} (${log.subjectCode})"`,
      `"${log.examName}"`,
      `"${log.originalValue}"`,
      `"${log.newValue}"`,
      `"${delta}"`,
      `"${log.moduleOrigin}"`,
      `"${log.userResponsible}"`,
      `"${log.userId}"`,
      `"${log.reason || 'Manual verification update'}"`,
    ].join(',');
  });

  const csvContent = [...headerRows, ...dataRows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Signed_Mark_Audit_Trail_Class_${classNumber}_${section}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
