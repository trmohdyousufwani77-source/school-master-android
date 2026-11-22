import { ExcelMappingSchema, Student } from '../types';

export type CanonicalStudentField =
  | 'admissionNumber'
  | 'fullName'
  | 'fatherName'
  | 'motherName'
  | 'dob'
  | 'gender'
  | 'classNumber'
  | 'section'
  | 'rollNumber'
  | 'category'
  | 'religion'
  | 'nationality'
  | 'address'
  | 'mobileNumber'
  | 'previousSchool'
  | 'admissionDate'
  | 'academicSession';

export const CANONICAL_FIELD_LABELS: { key: CanonicalStudentField; label: string; required?: boolean }[] = [
  { key: 'admissionNumber', label: 'Admission Number' },
  { key: 'fullName', label: 'Student Name', required: true },
  { key: 'fatherName', label: "Father's Name", required: true },
  { key: 'motherName', label: "Mother's Name" },
  { key: 'dob', label: 'Date of Birth (D.O.B)' },
  { key: 'gender', label: 'Gender' },
  { key: 'classNumber', label: 'Class', required: true },
  { key: 'section', label: 'Section' },
  { key: 'rollNumber', label: 'Roll Number' },
  { key: 'category', label: 'Category' },
  { key: 'religion', label: 'Religion' },
  { key: 'nationality', label: 'Nationality' },
  { key: 'address', label: 'Address' },
  { key: 'mobileNumber', label: 'Mobile Number' },
  { key: 'previousSchool', label: 'Previous School' },
  { key: 'admissionDate', label: 'Admission Date' },
  { key: 'academicSession', label: 'Academic Session' },
];

const FIELD_SYNONYMS: Record<CanonicalStudentField, string[]> = {
  admissionNumber: ['admission no', 'admission number', 'adm no', 'adm. no', 'srn', 'reg no', 'registration no', 'admission_no'],
  fullName: ['student name', "student's name", 'name', 'full name', 'pupil name', 'candidate name', 'scholar name', 'fullname'],
  fatherName: ["father's name", 'father name', 'father', 'guardian name', 'guardian', 'parent name', 'fathername'],
  motherName: ["mother's name", 'mother name', 'mother', 'mothername'],
  dob: ['dob', 'd.o.b', 'd.o.b.', 'date of birth', 'birth date', 'birthdate'],
  gender: ['gender', 'sex', 'boy/girl'],
  classNumber: ['class', 'grade', 'class / grade', 'std', 'standard', 'classnumber'],
  section: ['section', 'sec', 'division'],
  rollNumber: ['roll no', 'roll number', 'roll', 'rollnumber'],
  category: ['category', 'caste', 'social category', 'reservation'],
  religion: ['religion', 'faith', 'community'],
  nationality: ['nationality', 'citizenship', 'country'],
  address: ['address', 'residential address', 'residence', 'village', 'locality'],
  mobileNumber: ['mobile number', 'mobile', 'phone', 'phone number', 'contact', 'contact number', 'email / phone number', 'whatsapp'],
  previousSchool: ['previous school', 'prev school', 'last school', 'former school'],
  admissionDate: ['admission date', 'date of admission', 'doa', 'enrolled on'],
  academicSession: ['academic session', 'session', 'academic year', 'year'],
};

export interface OcrExtractedStudentRow {
  tempId: string;
  rowIndex: number;
  admissionNumber: string;
  fullName: string;
  fatherName: string;
  motherName: string;
  dob: string;
  gender: string;
  classNumber: string;
  section: string;
  rollNumber: string;
  category: string;
  religion: string;
  nationality: string;
  address: string;
  mobileNumber: string;
  previousSchool: string;
  admissionDate: string;
  academicSession: string;
  confidenceScore: number;
  uncertainFields: CanonicalStudentField[];
  validationErrors: string[];
  isValid: boolean;
  isDuplicate: boolean;
  duplicateReason?: string;
  approved: boolean;
  selected: boolean;
}

export function matchHeaderToCanonicalField(rawHeader: string): CanonicalStudentField | null {
  const norm = (rawHeader || '')
    .toLowerCase()
    .replace(/[._:()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!norm) return null;

  for (const [field, synonyms] of Object.entries(FIELD_SYNONYMS) as [CanonicalStudentField, string[]][]) {
    if (synonyms.some((syn) => norm === syn)) return field;
  }
  for (const [field, synonyms] of Object.entries(FIELD_SYNONYMS) as [CanonicalStudentField, string[]][]) {
    if (synonyms.some((syn) => norm.includes(syn) || syn.includes(norm))) return field;
  }
  return null;
}

export function normalizeScannedDob(raw: string): string {
  const s = (raw || '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dmy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (dmy) {
    const day = dmy[1].padStart(2, '0');
    const mon = dmy[2].padStart(2, '0');
    let yr = dmy[3];
    if (yr.length === 2) yr = Number(yr) > 40 ? `19${yr}` : `20${yr}`;
    return `${yr}-${mon}-${day}`;
  }
  const dt = new Date(s);
  if (!isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
  return s;
}

export function normalizeScannedClass(raw: string): string {
  const s = (raw || '')
    .trim()
    .replace(/class|grade|std|th|st|nd|rd/gi, '')
    .trim();
  return s || '1';
}

export function normalizeScannedGender(raw: string): 'Male' | 'Female' | 'Other' {
  const clean = (raw || '').trim().toLowerCase();
  if (clean === 'f' || clean === 'female' || clean === 'girl') return 'Female';
  if (clean === 'other' || clean === 'transgender') return 'Other';
  return 'Male';
}

export function parseStructuredOcrText(rawText: string): {
  rawHeaders: string[];
  rawRows: string[][];
  autoMapping: Record<number, CanonicalStudentField | ''>;
  hasRecognizableHeaders: boolean;
} {
  const lines = (rawText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { rawHeaders: [], rawRows: [], autoMapping: {}, hasRecognizableHeaders: false };
  }

  const delimiter = lines[0].includes('|')
    ? '|'
    : lines[0].includes('\t')
    ? '\t'
    : ',';

  const splitRow = (line: string) =>
    line.split(delimiter).map((cell) => cell.trim().replace(/^["']|["']$/g, ''));

  const firstCells = splitRow(lines[0]);
  const mapping: Record<number, CanonicalStudentField | ''> = {};
  let headerHits = 0;

  firstCells.forEach((cell, idx) => {
    const matched = matchHeaderToCanonicalField(cell);
    mapping[idx] = matched || '';
    if (matched) headerHits++;
  });

  const hasRecognizableHeaders = headerHits >= 2;
  const rawHeaders = hasRecognizableHeaders
    ? firstCells
    : firstCells.map((_, idx) => `Column ${idx + 1}`);
  const dataLines = hasRecognizableHeaders ? lines.slice(1) : lines;
  const rawRows = dataLines.map(splitRow);

  return { rawHeaders, rawRows, autoMapping: mapping, hasRecognizableHeaders };
}

export function evaluateOcrStudentRows(
  rows: Omit<
    OcrExtractedStudentRow,
    'validationErrors' | 'isValid' | 'isDuplicate' | 'duplicateReason'
  >[],
  existingStudents: Student[]
): OcrExtractedStudentRow[] {
  return rows.map((row, idx) => {
    const errors: string[] = [];
    const uncertain = new Set<CanonicalStudentField>(row.uncertainFields || []);

    if (!row.fullName || row.fullName.trim().length < 2) {
      errors.push('Student Name missing or too short');
      uncertain.add('fullName');
    }
    if (!row.fatherName || row.fatherName.trim().length < 2) {
      uncertain.add('fatherName');
    }
    if (!row.classNumber) {
      errors.push('Class is required');
      uncertain.add('classNumber');
    }
    if (row.dob && !/^\d{4}-\d{2}-\d{2}$/.test(normalizeScannedDob(row.dob))) {
      errors.push('Date of Birth format uncertain (expected YYYY-MM-DD)');
      uncertain.add('dob');
    }

    const normName = (row.fullName || '').trim().toLowerCase();
    const normDob = normalizeScannedDob(row.dob);
    const normAdm = (row.admissionNumber || '').trim().toUpperCase();
    const normPhone = (row.mobileNumber || '').replace(/\D/g, '');

    let isDuplicate = false;
    let duplicateReason: string | undefined;

    const dbDup = existingStudents.find((s) => {
      if (normAdm && s.admissionNumber.trim().toUpperCase() === normAdm) return true;
      if (normName && s.fullName.trim().toLowerCase() === normName) {
        if (normDob && s.dob === normDob) return true;
        if (normPhone && s.mobileNumber.replace(/\D/g, '') === normPhone) return true;
      }
      return false;
    });

    if (dbDup) {
      isDuplicate = true;
      duplicateReason = `Matches existing DB student ${dbDup.fullName} (${dbDup.admissionNumber})`;
    } else {
      const batchDup = rows.find((other, otherIdx) => {
        if (otherIdx >= idx) return false;
        if (normAdm && other.admissionNumber.trim().toUpperCase() === normAdm) return true;
        return (
          Boolean(normName) &&
          other.fullName.trim().toLowerCase() === normName &&
          normalizeScannedDob(other.dob) === normDob
        );
      });
      if (batchDup) {
        isDuplicate = true;
        duplicateReason = `Duplicate of scanned Row #${batchDup.rowIndex}`;
      }
    }

    return {
      ...row,
      dob: normDob || row.dob,
      classNumber: row.classNumber ? normalizeScannedClass(row.classNumber) : '',
      uncertainFields: Array.from(uncertain),
      validationErrors: errors,
      isValid: errors.length === 0,
      isDuplicate,
      duplicateReason,
    };
  });
}

export const SAMPLE_OCR_ADMISSION_SHEET = `Student Name | Father's Name | Mother's Name | D.O.B | Gender | Class | Section | Admission Number | Address | Mobile Number | Category | Religion | Previous School
Aamir Ahmad | Mohammad Ahmad | Haseena Begum | 12-05-2012 | Male | 8th | A | ADM-2026-801 | Pamposh Colony Palpora Srinagar | 9419011223 | General | Islam | Govt Primary School Palpora
Sara Khan | Abdul Khan | Shameema Bano | 21-08-2013 | Female | 7th | A | ADM-2026-702 | Noorbagh Srinagar | 9797022334 | RBA | Islam | Crescent Public School
Zoya Tariq | Tariq Ahmad Bhat | Rubina Akhter | 04-11-2014 | Female | 6th | B | ADM-2026-603 | Pamposh Colony Srinagar | 9906544556 | General | Islam | Govt Middle School Palpora
Farhan Yousuf | Yousuf Lone | Farida Begum | 18-02-2015 | Male | 5th | A | ADM-2026-504 | Palpora Tehsil Iddgah | 9419577889 | ST | Islam | Sunshine Academy`;

export type TemplateColumnMappingTarget =
  | CanonicalStudentField
  | '__serial__'
  | '__schoolName__'
  | '__udiseCode__'
  | '';

export interface ExcelTemplateColumn {
  index: number;
  headerName: string;
  mappedField: TemplateColumnMappingTarget;
  defaultValue: string;
}

export const DEMO_20_COL_TEMPLATE_HEADERS: string[] = [
  'Sr. No.',
  'U-DISE Code',
  'School Name',
  'Academic Session',
  'Admission No.',
  'Admission Date',
  'Student Full Name',
  "Father's Name",
  "Mother's Name",
  'Date of Birth (D.O.B)',
  'Gender',
  'Class',
  'Section',
  'Roll Number',
  'Social Category',
  'Religion',
  'Nationality',
  'Residential Address',
  'Parent Mobile No.',
  'Previous School Name',
];

export function matchTemplateHeader(rawHeader: string): TemplateColumnMappingTarget {
  const norm = (rawHeader || '')
    .toLowerCase()
    .replace(/[._:()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!norm) return '';

  if (/^(sr no|sr\.? no|s no|sl no|serial|serial no|serial number|#)$/.test(norm)) {
    return '__serial__';
  }
  if (norm.includes('udise') || norm.includes('u dise') || norm === 'school code') {
    return '__udiseCode__';
  }
  if (norm === 'school' || norm === 'school name' || norm === 'name of school' || norm === 'institution') {
    return '__schoolName__';
  }

  return matchHeaderToCanonicalField(rawHeader) || '';
}

export function extractExcelTemplateColumns(
  headers: string[],
  _firstSampleRow?: string[]
): ExcelTemplateColumn[] {
  return headers.map((rawHeader, idx) => ({
    index: idx,
    headerName: rawHeader,
    mappedField: matchTemplateHeader(rawHeader),
    defaultValue: '',
  }));
}

export function mapRecordToTemplateRow(
  record: Partial<OcrExtractedStudentRow> | Partial<Student>,
  templateColumns: ExcelTemplateColumn[],
  rowNumber: number,
  schoolMeta?: { name?: string; code?: string; academicSession?: string }
): (string | number)[] {
  return templateColumns.map((col) => {
    switch (col.mappedField) {
      case '__serial__':
        return rowNumber;
      case '__schoolName__':
        return schoolMeta?.name || col.defaultValue || '';
      case '__udiseCode__':
        return schoolMeta?.code || col.defaultValue || '';
      case '':
        return col.defaultValue || '';
      case 'academicSession':
        return String(record.academicSession || schoolMeta?.academicSession || col.defaultValue || '');
      case 'rollNumber':
        return record.rollNumber !== undefined && record.rollNumber !== ''
          ? record.rollNumber
          : col.defaultValue || '';
      default: {
        const val = (record as Record<string, unknown>)[col.mappedField];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          return String(val);
        }
        return col.defaultValue || '';
      }
    }
  });
}

// ============================================================================
// EXCEL TEMPLATE MAPPING SCHEMA PERSISTENCE & HEADER MATCHING
// ============================================================================
export const EXCEL_MAPPING_SCHEMAS_STORAGE_KEY = 'sm_excel_mapping_schemas_v1';

export function createDefaultMappingSchemas(): ExcelMappingSchema[] {
  const nowIso = new Date().toISOString();
  return [
    {
      id: 'schema_gms_20col_default',
      name: 'GMS Pamposh 20-Column Register',
      description: 'Standard 20-column Government Middle School Admission & Bulk Register format.',
      sheetName: 'Admission_Register',
      isDefault: true,
      createdByName: 'System Administrator',
      createdAt: nowIso,
      updatedAt: nowIso,
      columns: DEMO_20_COL_TEMPLATE_HEADERS.map((hdr, idx) => ({
        index: idx,
        sourceHeader: hdr,
        targetField: matchTemplateHeader(hdr),
        defaultValue: '',
        required: ['Student Full Name', "Father's Name", 'Class'].includes(hdr),
      })),
    },
  ];
}

export function loadExcelMappingSchemas(): ExcelMappingSchema[] {
  try {
    const raw = localStorage.getItem(EXCEL_MAPPING_SCHEMAS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // fallback to default
  }
  return createDefaultMappingSchemas();
}

export function saveExcelMappingSchemas(schemas: ExcelMappingSchema[]): void {
  localStorage.setItem(EXCEL_MAPPING_SCHEMAS_STORAGE_KEY, JSON.stringify(schemas));
}

export function schemaToTemplateColumns(schema: ExcelMappingSchema): ExcelTemplateColumn[] {
  return schema.columns.map((c, idx) => ({
    index: idx,
    headerName: c.sourceHeader,
    mappedField: (c.targetField as TemplateColumnMappingTarget) || '',
    defaultValue: c.defaultValue || '',
  }));
}

export function applySchemaToUploadedHeaders(
  uploadedHeaders: string[],
  schema?: ExcelMappingSchema | null
): {
  mapping: Record<number, CanonicalStudentField | ''>;
  matchedBySchemaCount: number;
  autoMatchedCount: number;
} {
  const mapping: Record<number, CanonicalStudentField | ''> = {};
  let matchedBySchemaCount = 0;
  let autoMatchedCount = 0;

  const normalizeHdr = (s: string) =>
    (s || '').toLowerCase().replace(/[._:()]/g, ' ').replace(/\s+/g, ' ').trim();

  const canonicalSet = new Set<string>(CANONICAL_FIELD_LABELS.map((f) => f.key));

  uploadedHeaders.forEach((hdr, idx) => {
    const norm = normalizeHdr(hdr);
    if (schema) {
      const rule =
        schema.columns.find((c) => normalizeHdr(c.sourceHeader) === norm) ||
        (schema.columns.length === uploadedHeaders.length ? schema.columns[idx] : undefined);
      if (rule && rule.targetField && canonicalSet.has(rule.targetField)) {
        mapping[idx] = rule.targetField as CanonicalStudentField;
        matchedBySchemaCount++;
        return;
      }
      if (rule && rule.targetField && rule.targetField.startsWith('__')) {
        mapping[idx] = '';
        return;
      }
    }
    const auto = matchHeaderToCanonicalField(hdr);
    mapping[idx] = auto || '';
    if (auto) autoMatchedCount++;
  });

  return { mapping, matchedBySchemaCount, autoMatchedCount };
}

// ============================================================================
// OCR PREVIEW CONFIDENCE HEATMAP CLASSIFICATION (GREEN / YELLOW / RED)
// ============================================================================
export type CellConfidenceStatus = 'high' | 'uncertain' | 'error';

export interface CellConfidenceInfo {
  status: CellConfidenceStatus;
  reason: string;
}

const HEATMAP_CORE_FIELDS = new Set<CanonicalStudentField>([
  'admissionNumber',
  'fullName',
  'fatherName',
  'dob',
  'gender',
  'classNumber',
  'section',
  'mobileNumber',
]);

export function getCellConfidenceInfo(
  row: OcrExtractedStudentRow,
  field: CanonicalStudentField
): CellConfidenceInfo {
  const rawVal = String((row as unknown as Record<string, unknown>)[field] ?? '').trim();

  if (field === 'fullName' && rawVal.length < 2) {
    return { status: 'error', reason: 'Missing or invalid Student Name' };
  }
  if (field === 'classNumber' && !rawVal) {
    return { status: 'error', reason: 'Missing required Class' };
  }
  if (field === 'dob' && rawVal && !/^\d{4}-\d{2}-\d{2}$/.test(normalizeScannedDob(rawVal))) {
    return { status: 'error', reason: 'Invalid Date of Birth format (expected YYYY-MM-DD)' };
  }
  if (row.isDuplicate && (field === 'admissionNumber' || field === 'fullName')) {
    return { status: 'error', reason: row.duplicateReason || 'Duplicate record detected' };
  }
  if (!rawVal && HEATMAP_CORE_FIELDS.has(field)) {
    return { status: 'error', reason: 'Missing value — manual entry recommended' };
  }
  if (!rawVal) {
    return { status: 'uncertain', reason: 'Optional field empty in scanned source' };
  }
  if (row.uncertainFields.includes(field)) {
    return { status: 'uncertain', reason: 'Low OCR confidence — verify against document' };
  }
  if (row.confidenceScore < 85) {
    return { status: 'uncertain', reason: `Row OCR confidence ${row.confidenceScore}% (<85%)` };
  }

  return { status: 'high', reason: `High confidence (${row.confidenceScore}%)` };
}

export function computeBatchHeatmapStats(
  rows: OcrExtractedStudentRow[],
  fields: CanonicalStudentField[]
): { high: number; uncertain: number; error: number; rowsNeedingAttention: number } {
  let high = 0;
  let uncertain = 0;
  let error = 0;
  let rowsNeedingAttention = 0;

  rows.forEach((row) => {
    let rowNeedsAttention = false;
    fields.forEach((f) => {
      const info = getCellConfidenceInfo(row, f);
      if (info.status === 'high') high++;
      else if (info.status === 'uncertain') {
        uncertain++;
        rowNeedsAttention = true;
      } else {
        error++;
        rowNeedsAttention = true;
      }
    });
    if (rowNeedsAttention) rowsNeedingAttention++;
  });

  return { high, uncertain, error, rowsNeedingAttention };
}


