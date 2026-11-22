import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  Check,
  CheckCircle2,
  Download,
  Edit2,
  FileSpreadsheet,
  FileText,
  History,
  ImagePlus,
  Loader2,
  Printer,
  RefreshCw,
  RotateCcw,
  ScanText,
  Sliders,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import { ExcelMappingSchema, OcrImportBatchHistory, SchoolProfile, Student, User } from '../types';
import {
  applySchemaToUploadedHeaders,
  CANONICAL_FIELD_LABELS,
  CanonicalStudentField,
  computeBatchHeatmapStats,
  DEMO_20_COL_TEMPLATE_HEADERS,
  evaluateOcrStudentRows,
  ExcelTemplateColumn,
  extractExcelTemplateColumns,
  getCellConfidenceInfo,
  mapRecordToTemplateRow,
  normalizeScannedClass,
  normalizeScannedDob,
  normalizeScannedGender,
  OcrExtractedStudentRow,
  parseStructuredOcrText,
  SAMPLE_OCR_ADMISSION_SHEET,
  schemaToTemplateColumns,
  TemplateColumnMappingTarget,
} from '../utils/ocrStudentExtractor';
import {
  deleteStudentsBatchFromFirestore,
  markOcrBatchUndoneInFirestore,
  syncOcrBatchToFirestore,
  syncStudentsBatchToFirestore,
} from '../firebase';

interface SmartOcrBulkImportTabProps {
  students: Student[];
  school: SchoolProfile;
  currentUser: User;
  onBulkAddStudents: (newStudents: Student[]) => void;
  onBulkDeleteStudents?: (studentIds: string[]) => void;
  mappingSchemas?: ExcelMappingSchema[];
  activeSchemaId?: string;
  onSelectActiveSchema?: (schemaId: string) => void;
  onOpenTemplateMappingPage?: () => void;
}

const OCR_HISTORY_STORAGE_KEY = 'sm_ocr_import_history_v1';

const PREVIEW_HEATMAP_FIELDS: CanonicalStudentField[] = [
  'admissionNumber',
  'fullName',
  'fatherName',
  'dob',
  'gender',
  'classNumber',
  'section',
  'mobileNumber',
];

export const SmartOcrBulkImportTab: React.FC<SmartOcrBulkImportTabProps> = ({
  students,
  school,
  currentUser,
  onBulkAddStudents,
  onBulkDeleteStudents,
  mappingSchemas = [],
  activeSchemaId,
  onSelectActiveSchema,
  onOpenTemplateMappingPage,
}) => {
  // Multi-source OCR input state
  const [sourceMode, setSourceMode] = useState<'camera' | 'gallery' | 'pdf' | 'excel' | 'text'>('excel');
  const [selectedFiles, setSelectedFiles] = useState<{ name: string; mimeType: string; base64Data: string }[]>([]);
  const [ocrTextInput, setOcrTextInput] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanStatusMsg, setScanStatusMsg] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // Camera live capture state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const streamRef = useRef<MediaStream | null>(null);

  // Manual column mapping fallback state
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawMatrixRows, setRawMatrixRows] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<number, CanonicalStudentField | ''>>({});
  const [showColumnMapper, setShowColumnMapper] = useState<boolean>(false);

  // Preview & Verification State (NEVER auto-saves without Admin Approval!)
  const [extractedRows, setExtractedRows] = useState<OcrExtractedStudentRow[]>([]);
  const [isInlineEditMode, setIsInlineEditMode] = useState<boolean>(false);
  const [skipDuplicates, setSkipDuplicates] = useState<boolean>(true);
  const [isConfidenceHeatmapEnabled, setIsConfidenceHeatmapEnabled] = useState<boolean>(true);
  const [focusLowConfidenceOnly, setFocusLowConfidenceOnly] = useState<boolean>(false);
  const [pendingUndoBatch, setPendingUndoBatch] = useState<OcrImportBatchHistory | null>(null);

  // Bulk Import Execution & History State
  const [importProgressPct, setImportProgressPct] = useState<number>(0);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [lastBatchStats, setLastBatchStats] = useState<{
    imported: number;
    failed: number;
    duplicates: number;
    errors: string[];
  } | null>(null);

  const [importHistory, setImportHistory] = useState<OcrImportBatchHistory[]>(() => {
    try {
      const saved = localStorage.getItem(OCR_HISTORY_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [];
  });

  // Filtered Export Controls
  const [exportClass, setExportClass] = useState<string>('all');
  const [exportSection, setExportSection] = useState<string>('all');
  const [exportSession, setExportSession] = useState<string>('all');

  // Excel Template Matching state (preserves 100% of original column names & order)
  const activeMappingSchema = useMemo(
    () =>
      mappingSchemas.find((s) => s.id === activeSchemaId) ||
      mappingSchemas.find((s) => s.isDefault) ||
      mappingSchemas[0] ||
      null,
    [mappingSchemas, activeSchemaId]
  );

  const [templateFileName, setTemplateFileName] = useState<string | null>(null);
  const [templateSheetName, setTemplateSheetName] = useState<string>('Student_Register');
  const [templateColumns, setTemplateColumns] = useState<ExcelTemplateColumn[]>([]);
  const [showTemplateMapper, setShowTemplateMapper] = useState<boolean>(true);
  const templateInputRef = useRef<HTMLInputElement>(null);

  const galleryInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);

  const saveHistory = (next: OcrImportBatchHistory[]) => {
    setImportHistory(next);
    localStorage.setItem(OCR_HISTORY_STORAGE_KEY, JSON.stringify(next));
  };

  // Start / Stop Mobile/Webcam Camera for Document Scanning
  const handleStartCamera = async () => {
    setScanError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      setIsCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 60);
    } catch {
      setScanError('Camera access unavailable in this browser frame. You can still upload camera photos or gallery images below.');
    }
  };

  const handleStopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const handleCaptureCameraFrame = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 1280;
    canvas.height = videoRef.current.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    const base64Data = dataUrl.split(',')[1];
    setSelectedFiles((prev) => [
      ...prev,
      { name: `Camera_Page_${prev.length + 1}.jpg`, mimeType: 'image/jpeg', base64Data },
    ]);
    setScanStatusMsg(`Captured page ${selectedFiles.length + 1}. Add more pages or click "Run OCR Extraction".`);
  };

  const readFileAsBase64 = (file: File): Promise<{ name: string; mimeType: string; base64Data: string }> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const res = String(reader.result || '');
        const base64Data = res.includes(',') ? res.split(',')[1] : res;
        resolve({ name: file.name, mimeType: file.type || 'image/jpeg', base64Data });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = Array.from(e.target.files || []);
    if (fileList.length === 0) return;
    setScanError(null);
    const encoded = await Promise.all(fileList.map(readFileAsBase64));
    setSelectedFiles((prev) => [...prev, ...encoded]);
    setScanStatusMsg(`Queued ${encoded.length} document page(s) for OCR session.`);
  };

  // Apply Raw Matrix + Manual/Auto Column Mapping into Preview Rows
  const applyMatrixWithMapping = (
    matrix: string[][],
    mapping: Record<number, CanonicalStudentField | ''>,
    confidenceDefault = 94
  ) => {
    const mapped = matrix.map((cells, idx) => {
      const obj: Record<string, string> = {};
      cells.forEach((val, colIdx) => {
        const targetField = mapping[colIdx];
        if (targetField) obj[targetField] = val;
      });
      const uncertain: CanonicalStudentField[] = [];
      if (!obj.fullName) uncertain.push('fullName');
      if (!obj.fatherName) uncertain.push('fatherName');
      if (!obj.dob) uncertain.push('dob');
      if (!obj.classNumber) uncertain.push('classNumber');

      return {
        tempId: `ocr-${Date.now()}-${idx}`,
        rowIndex: idx + 1,
        admissionNumber: obj.admissionNumber || '',
        fullName: obj.fullName || '',
        fatherName: obj.fatherName || '',
        motherName: obj.motherName || '',
        dob: obj.dob || '',
        gender: obj.gender || 'Male',
        classNumber: obj.classNumber || '',
        section: obj.section || 'A',
        rollNumber: obj.rollNumber || String(idx + 1),
        category: obj.category || 'General',
        religion: obj.religion || '',
        nationality: obj.nationality || 'Indian',
        address: obj.address || school.address,
        mobileNumber: obj.mobileNumber || '',
        previousSchool: obj.previousSchool || '',
        admissionDate: obj.admissionDate || new Date().toISOString().slice(0, 10),
        academicSession: obj.academicSession || school.academicSession,
        confidenceScore: uncertain.length > 0 ? Math.max(62, confidenceDefault - uncertain.length * 8) : confidenceDefault,
        uncertainFields: uncertain,
        approved: false,
        selected: true,
      };
    });

    setExtractedRows(evaluateOcrStudentRows(mapped, students));
  };

  // Parse Excel / CSV immediately via XLSX
  const handleExcelCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsScanning(true);
    setScanError(null);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rowsAoa = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' });
      const nonEmpty = rowsAoa.filter((r) => Array.isArray(r) && r.some((cell) => String(cell).trim() !== ''));
      if (nonEmpty.length === 0) {
        setScanError('Uploaded Excel/CSV sheet has no readable rows.');
        setIsScanning(false);
        return;
      }

      const headers = nonEmpty[0].map((c) => String(c || '').trim());
      const { mapping, matchedBySchemaCount, autoMatchedCount } = applySchemaToUploadedHeaders(
        headers,
        activeMappingSchema
      );
      const recognized = matchedBySchemaCount + autoMatchedCount;

      const dataRows = (recognized >= 2 ? nonEmpty.slice(1) : nonEmpty).map((r) =>
        r.map((cell) => String(cell ?? '').trim())
      );

      setRawHeaders(recognized >= 2 ? headers : headers.map((_, i) => `Column ${i + 1}`));
      setRawMatrixRows(dataRows);
      setColumnMapping(mapping);
      setShowColumnMapper(recognized < 2);
      applyMatrixWithMapping(dataRows, mapping, 98);
      setScanStatusMsg(
        `Parsed ${dataRows.length} student row(s) from "${file.name}"${
          activeMappingSchema && matchedBySchemaCount > 0
            ? ` using schema "${activeMappingSchema.name}" (${matchedBySchemaCount} columns mapped)`
            : ''
        }. Review & approve below before importing.`
      );
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Failed to read spreadsheet file.');
    } finally {
      setIsScanning(false);
    }
  };

  // Run Server Gemini Multimodal OCR OR Structured Text OCR
  const handleRunOcrExtraction = async () => {
    setIsScanning(true);
    setScanError(null);
    setScanStatusMsg(null);

    try {
      if (selectedFiles.length > 0) {
        const resp = await fetch('/api/ocr/extract-students', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            files: selectedFiles,
            rawText: ocrTextInput,
          }),
        });
        const data = await resp.json();
        if (!resp.ok) {
          throw new Error(data.error || 'Document OCR failed on server.');
        }

        const apiRecords = Array.isArray(data.records) ? data.records : [];
        const preEvaluated = apiRecords.map((rec: any, idx: number) => ({
          tempId: `ocr-api-${Date.now()}-${idx}`,
          rowIndex: idx + 1,
          admissionNumber: String(rec.admissionNumber || ''),
          fullName: String(rec.fullName || ''),
          fatherName: String(rec.fatherName || ''),
          motherName: String(rec.motherName || ''),
          dob: String(rec.dob || ''),
          gender: String(rec.gender || 'Male'),
          classNumber: String(rec.classNumber || ''),
          section: String(rec.section || 'A'),
          rollNumber: String(rec.rollNumber || idx + 1),
          category: String(rec.category || 'General'),
          religion: String(rec.religion || ''),
          nationality: String(rec.nationality || 'Indian'),
          address: String(rec.address || school.address),
          mobileNumber: String(rec.mobileNumber || ''),
          previousSchool: String(rec.previousSchool || ''),
          admissionDate: String(rec.admissionDate || new Date().toISOString().slice(0, 10)),
          academicSession: String(rec.academicSession || school.academicSession),
          confidenceScore: Number(rec.confidenceScore) || 85,
          uncertainFields: Array.isArray(rec.uncertainFields) ? rec.uncertainFields : [],
          approved: false,
          selected: true,
        }));

        setExtractedRows(evaluateOcrStudentRows(preEvaluated, students));
        setScanStatusMsg(
          `OCR extracted ${preEvaluated.length} student record(s) across ${selectedFiles.length} document page(s). Please verify before importing.`
        );
        setIsScanning(false);
        return;
      }

      if (ocrTextInput.trim()) {
        const parsed = parseStructuredOcrText(ocrTextInput);
        setRawHeaders(parsed.rawHeaders);
        setRawMatrixRows(parsed.rawRows);
        setColumnMapping(parsed.autoMapping);
        setShowColumnMapper(!parsed.hasRecognizableHeaders);
        applyMatrixWithMapping(parsed.rawRows, parsed.autoMapping, 91);
        setScanStatusMsg(
          `OCR parsed ${parsed.rawRows.length} student row(s). ${
            parsed.hasRecognizableHeaders
              ? 'Column headings automatically mapped.'
              : 'No column headings recognized — please verify manual column mapping.'
          }`
        );
      } else {
        setScanError('Please capture a photo, upload images/PDF/Excel, or paste scanned register text first.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'OCR error';
      if (ocrTextInput.trim()) {
        const parsed = parseStructuredOcrText(ocrTextInput);
        applyMatrixWithMapping(parsed.rawRows, parsed.autoMapping, 88);
        setScanStatusMsg(`Extracted ${parsed.rawRows.length} records via structured text parser.`);
      } else {
        setScanError(msg);
      }
    } finally {
      setIsScanning(false);
    }
  };

  const handleLoadSampleOcrSheet = () => {
    setSourceMode('text');
    setOcrTextInput(SAMPLE_OCR_ADMISSION_SHEET);
    const parsed = parseStructuredOcrText(SAMPLE_OCR_ADMISSION_SHEET);
    setRawHeaders(parsed.rawHeaders);
    setRawMatrixRows(parsed.rawRows);
    setColumnMapping(parsed.autoMapping);
    setShowColumnMapper(false);
    applyMatrixWithMapping(parsed.rawRows, parsed.autoMapping, 96);
    setScanStatusMsg('Loaded sample multi-column admission sheet. Review, edit, or approve records before importing.');
  };

  // Inline Editing Handler
  const handleUpdateExtractedCell = (
    tempId: string,
    field: CanonicalStudentField,
    value: string
  ) => {
    const updated = extractedRows.map((row) => {
      if (row.tempId !== tempId) return row;
      const nextUncertain = row.uncertainFields.filter((f) => f !== field);
      const nextScore = nextUncertain.length === 0 ? Math.max(row.confidenceScore, 96) : Math.max(row.confidenceScore, 86);
      return {
        ...row,
        [field]: value,
        uncertainFields: nextUncertain,
        confidenceScore: nextScore,
      };
    });
    setExtractedRows(evaluateOcrStudentRows(updated, students));
  };

  // 1. Approve All
  const handleApproveAll = () => {
    setExtractedRows((prev) =>
      prev.map((r) => ({ ...r, approved: true, selected: r.isValid && !(skipDuplicates && r.isDuplicate) }))
    );
    setScanStatusMsg('All valid extracted records marked as Administrator-Approved and ready for import.');
  };

  // 2. Import Selected (with real progress indicator & batch rollback history)
  const handleImportSelected = async () => {
    const selectedRows = extractedRows.filter((r) => r.selected);
    if (selectedRows.length === 0) {
      setScanError('Select at least one verified student row to import.');
      return;
    }

    setIsImporting(true);
    setImportProgressPct(5);
    const validToImport: Student[] = [];
    const errors: string[] = [];
    let dupCount = 0;

    for (let i = 0; i < selectedRows.length; i++) {
      const row = selectedRows[i];
      if (!row.isValid) {
        errors.push(`Row #${row.rowIndex} (${row.fullName || 'Unnamed'}): ${row.validationErrors.join(', ')}`);
        continue;
      }
      if (skipDuplicates && row.isDuplicate) {
        dupCount++;
        continue;
      }

      const nowIso = new Date().toISOString();
      const safeAdm =
        row.admissionNumber.trim() ||
        `ADM-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}-${i + 1}`;
      const stuId = `SM-OCR-${Date.now()}-${i}`;

      validToImport.push({
        id: stuId,
        admissionNumber: safeAdm,
        fullName: row.fullName.trim(),
        fatherName: row.fatherName.trim() || 'Parent / Guardian',
        motherName: row.motherName.trim() || '',
        gender: normalizeScannedGender(row.gender),
        dob: normalizeScannedDob(row.dob) || '2014-01-01',
        classNumber: normalizeScannedClass(row.classNumber),
        section: (row.section || 'A').trim().toUpperCase(),
        rollNumber: parseInt(row.rollNumber, 10) || students.length + i + 1,
        academicSession: row.academicSession || school.academicSession,
        address: row.address || school.address,
        villageTown: school.villageTown,
        blockTehsil: school.blockTehsil,
        district: school.district,
        state: school.state,
        pinCode: school.pinCode,
        mobileNumber: row.mobileNumber || '',
        parentWhatsAppNumber: row.mobileNumber || '',
        admissionDate: row.admissionDate || nowIso.slice(0, 10),
        previousSchool: row.previousSchool || '',
        category: row.category || 'General',
        religion: row.religion || '',
        nationality: row.nationality || 'Indian',
        status: 'Active',
        aadhaarStatus: 'Pending',
        updatedAt: nowIso,
        history: [
          {
            id: `hist-${Date.now()}-${i}`,
            date: nowIso,
            type: 'ADMISSION',
            title: 'Bulk OCR Student Import',
            details: `Imported via Smart Student Register (${sourceMode.toUpperCase()})`,
            actorName: currentUser.name,
          },
        ],
      });

      if (i % 25 === 0 || i === selectedRows.length - 1) {
        setImportProgressPct(Math.round(((i + 1) / selectedRows.length) * 85));
        await new Promise((r) => setTimeout(r, 15));
      }
    }

    if (validToImport.length > 0) {
      onBulkAddStudents(validToImport);
      try {
        await syncStudentsBatchToFirestore(validToImport);
      } catch {
        // Local storage persisted; Firestore optional if signed out
      }
    }

    const batchLog: OcrImportBatchHistory = {
      id: `batch_${Date.now()}`,
      timestamp: new Date().toISOString(),
      sourceName: selectedFiles[0]?.name || `${sourceMode.toUpperCase()} Scan`,
      sourceType: sourceMode === 'gallery' ? 'image' : sourceMode,
      totalScanned: selectedRows.length,
      importedCount: validToImport.length,
      failedCount: errors.length,
      duplicateCount: dupCount,
      importedStudentIds: validToImport.map((s) => s.id),
      undone: false,
      actorName: currentUser.name,
    };
    saveHistory([batchLog, ...importHistory]);
    try {
      await syncOcrBatchToFirestore(batchLog);
    } catch {
      // ignore if offline
    }

    setImportProgressPct(100);
    setLastBatchStats({
      imported: validToImport.length,
      failed: errors.length,
      duplicates: dupCount,
      errors,
    });
    // Retain only unimported / failed rows in preview for instant retry
    const importedIds = new Set(selectedRows.filter((r) => r.isValid && !(skipDuplicates && r.isDuplicate)).map((r) => r.tempId));
    setExtractedRows((prev) => prev.filter((r) => !importedIds.has(r.tempId)));
    setIsImporting(false);
    setScanStatusMsg(
      `Imported ${validToImport.length} student record(s) into database. Failed: ${errors.length}, Skipped Duplicates: ${dupCount}.`
    );
  };

  const latestUndoableBatch = useMemo(
    () => importHistory.find((b) => !b.undone && b.importedStudentIds.length > 0) || null,
    [importHistory]
  );

  const handleConfirmUndoLatestBatch = async () => {
    if (!pendingUndoBatch || !onBulkDeleteStudents) return;
    const targetBatch = pendingUndoBatch;
    setPendingUndoBatch(null);

    onBulkDeleteStudents(targetBatch.importedStudentIds);
    saveHistory(
      importHistory.map((b) => (b.id === targetBatch.id ? { ...b, undone: true } : b))
    );

    try {
      await deleteStudentsBatchFromFirestore(targetBatch.importedStudentIds);
      await markOcrBatchUndoneInFirestore(targetBatch.id);
    } catch {
      // Local state already rolled back; Firestore sync is best-effort when offline/signed out
    }

    setScanStatusMsg(
      `Undo Last Import complete: removed ${targetBatch.importedStudentIds.length} specific student record(s) from "${targetBatch.sourceName}".`
    );
  };

  const handleRetryFailed = () => {
    setExtractedRows((prev) => prev.map((r) => ({ ...r, selected: true })));
    setIsInlineEditMode(true);
    setScanStatusMsg('Highlighted failed rows in inline edit mode — fix missing fields and click Import Selected.');
  };

  // Filtered Export Helpers
  const filteredExportStudents = useMemo(() => {
    return students.filter((s) => {
      if (exportClass !== 'all' && s.classNumber !== exportClass) return false;
      if (exportSection !== 'all' && s.section !== exportSection) return false;
      if (exportSession !== 'all' && s.academicSession !== exportSession) return false;
      return true;
    });
  }, [students, exportClass, exportSection, exportSession]);

  const handleTemplateExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanError(null);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const sheetName = wb.SheetNames[0] || 'Sheet1';
      const sheet = wb.Sheets[sheetName];
      const rowsAoa = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' });
      const firstHeaderRow = rowsAoa.find(
        (r) => Array.isArray(r) && r.some((cell) => String(cell).trim() !== '')
      );
      if (!firstHeaderRow || firstHeaderRow.length === 0) {
        setScanError('Uploaded Excel template does not contain a header row.');
        return;
      }

      // Preserve 100% of original column names (including blank trailing slots labeled Column N if empty) and exact index order
      const exactHeaders = firstHeaderRow.map((cell, idx) => {
        const text = String(cell ?? '').trim();
        return text || `Column_${idx + 1}`;
      });
      const sampleDataRow = rowsAoa.find(
        (r, idx) => idx > rowsAoa.indexOf(firstHeaderRow) && Array.isArray(r) && r.some((c) => String(c).trim() !== '')
      );

      const cols = extractExcelTemplateColumns(
        exactHeaders,
        sampleDataRow ? sampleDataRow.map((c) => String(c ?? '')) : undefined
      );
      const matchedCount = cols.filter((c) => c.mappedField !== '').length;

      setTemplateFileName(file.name);
      setTemplateSheetName(sheetName);
      setTemplateColumns(cols);
      setShowTemplateMapper(true);
      setScanStatusMsg(
        `Loaded Excel template "${file.name}" (${cols.length} columns preserved in exact order; ${matchedCount} auto-matched to student fields).`
      );
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Failed to parse Excel template file.');
    }
  };

  const handleLoadDemo20ColTemplate = () => {
    const cols = extractExcelTemplateColumns(DEMO_20_COL_TEMPLATE_HEADERS);
    setTemplateFileName('Govt_School_20Col_Register_Template.xlsx');
    setTemplateSheetName('Admission_Register');
    setTemplateColumns(cols);
    setShowTemplateMapper(true);
    setScanStatusMsg(
      `Loaded 20-column School Register template (${cols.filter((c) => c.mappedField !== '').length}/20 columns auto-matched).`
    );
  };

  const handleDownloadBlank20ColTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([DEMO_20_COL_TEMPLATE_HEADERS]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Admission_Register');
    XLSX.writeFile(wb, `School_20Col_Register_Template_${school.code}.xlsx`);
  };

  const handleExportPopulatedTemplate = (source: 'ocr-preview' | 'filtered-students') => {
    if (templateColumns.length === 0) {
      setScanError('Upload an existing Excel template or load the 20-Column template first.');
      return;
    }

    const recordsToPopulate =
      source === 'ocr-preview'
        ? extractedRows.filter((r) => r.selected)
        : filteredExportStudents;

    if (recordsToPopulate.length === 0) {
      setScanError(
        source === 'ocr-preview'
          ? 'Select at least one OCR preview row to populate the template.'
          : 'No matching student records found for the active filter.'
      );
      return;
    }

    const exactHeaders = templateColumns.map((c) => c.headerName);
    const dataMatrix = recordsToPopulate.map((rec, idx) =>
      mapRecordToTemplateRow(rec, templateColumns, idx + 1, {
        name: school.name,
        code: school.code,
        academicSession: school.academicSession,
      })
    );

    const ws = XLSX.utils.aoa_to_sheet([exactHeaders, ...dataMatrix]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, templateSheetName.slice(0, 31) || 'Student_Register');
    const baseName = (templateFileName || 'Matched_Template').replace(/\.(xlsx|xls|csv)$/i, '');
    XLSX.writeFile(wb, `${baseName}_Populated_${new Date().toISOString().slice(0, 10)}.xlsx`);
    setScanStatusMsg(
      `Exported ${recordsToPopulate.length} record(s) into exact "${templateFileName || 'Matched Template'}" format (${exactHeaders.length} columns in original order).`
    );
  };

  const handleExportRegisterExcel = () => {
    const rows = filteredExportStudents.map((s) => ({
      'Student ID': s.id,
      'Admission Number': s.admissionNumber,
      'Student Name': s.fullName,
      "Father's Name": s.fatherName,
      "Mother's Name": s.motherName,
      'Date of Birth': s.dob,
      Gender: s.gender,
      Class: s.classNumber,
      Section: s.section,
      'Roll Number': s.rollNumber,
      Category: s.category || 'General',
      Religion: s.religion || '',
      Nationality: s.nationality || 'Indian',
      Address: s.address,
      'Mobile Number': s.mobileNumber,
      'Previous School': s.previousSchool || '',
      'Admission Date': s.admissionDate,
      'Academic Session': s.academicSession,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Student_Register');
    XLSX.writeFile(wb, `Smart_Student_Register_${school.code}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleExportRegisterCsv = () => {
    const header = [
      'Admission Number',
      'Student Name',
      "Father's Name",
      "Mother's Name",
      'DOB',
      'Gender',
      'Class',
      'Section',
      'Roll No',
      'Mobile Number',
      'Address',
      'Session',
    ];
    const rows = filteredExportStudents.map((s) => [
      s.admissionNumber,
      s.fullName,
      s.fatherName,
      s.motherName,
      s.dob,
      s.gender,
      s.classNumber,
      s.section,
      String(s.rollNumber),
      s.mobileNumber,
      s.address,
      s.academicSession,
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c || '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Student_Register_${school.code}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportRegisterPdf = () => {
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    pdf.setFontSize(14);
    pdf.text(`${school.name} — Official Student Admission Register`, 14, 14);
    pdf.setFontSize(9);
    pdf.text(`U-DISE: ${school.code} | Records: ${filteredExportStudents.length} | Generated: ${new Date().toISOString().slice(0, 10)}`, 14, 20);

    let y = 28;
    pdf.setFontSize(8);
    pdf.text('Adm No | Student Name | Father Name | DOB | Class-Sec | Mobile', 14, y);
    y += 5;
    filteredExportStudents.slice(0, 200).forEach((s, idx) => {
      if (y > 195) {
        pdf.addPage();
        y = 16;
      }
      pdf.text(
        `${idx + 1}. ${s.admissionNumber} | ${s.fullName} | ${s.fatherName} | ${s.dob} | ${s.classNumber}-${s.section} | ${s.mobileNumber}`,
        14,
        y
      );
      y += 5.5;
    });
    pdf.save(`Student_Register_${school.code}.pdf`);
  };

  const previewStats = useMemo(() => {
    const total = extractedRows.length;
    const valid = extractedRows.filter((r) => r.isValid).length;
    const duplicates = extractedRows.filter((r) => r.isDuplicate).length;
    const uncertain = extractedRows.filter((r) => r.uncertainFields.length > 0).length;
    const selected = extractedRows.filter((r) => r.selected).length;
    return { total, valid, duplicates, uncertain, selected };
  }, [extractedRows]);

  return (
    <div className="space-y-6">
      {/* Import Source Selector & Scanner Controls */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#0f294a] text-amber-300 flex items-center justify-center shrink-0">
              <ScanText className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-[#0f294a]">
                Smart Student Register — Bulk OCR &amp; Spreadsheet Importer
              </h2>
              <p className="text-xs text-slate-500">
                Scan multi-page admission forms, camera photos, PDFs, Excel (.xlsx), or CSV files with intelligent column heading mapping.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLoadSampleOcrSheet}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold text-xs border border-amber-300 cursor-pointer shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Load Sample Register</span>
          </button>
        </div>

        {/* 5 Input Modes */}
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'excel', label: 'Excel / CSV', icon: FileSpreadsheet },
            { id: 'camera', label: 'Camera Scan', icon: Camera },
            { id: 'gallery', label: 'Gallery Images', icon: ImagePlus },
            { id: 'pdf', label: 'PDF Document', icon: FileText },
            { id: 'text', label: 'Paste / OCR Text', icon: ScanText },
          ].map((mode) => {
            const Icon = mode.icon;
            const active = sourceMode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => setSourceMode(mode.id as any)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#0f294a] text-amber-300 border-[#0f294a]'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{mode.label}</span>
              </button>
            );
          })}
        </div>

        {/* Source Input Dropzone */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
          {sourceMode === 'excel' && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs text-slate-600">
                  Upload <strong>.xlsx, .xls, or .csv</strong> with up to 1,000+ student records. Matches columns automatically using your active Excel Template Mapping schema.
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {onOpenTemplateMappingPage && (
                    <button
                      type="button"
                      onClick={onOpenTemplateMappingPage}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-[#0f294a] text-xs font-bold cursor-pointer"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>Configure Mapping Schema</span>
                    </button>
                  )}
                  <input
                    ref={excelInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleExcelCsvUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => excelInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Select Excel / CSV File</span>
                  </button>
                </div>
              </div>

              {mappingSchemas.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/80 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-700">Active Mapping Schema:</span>
                    <select
                      value={activeMappingSchema?.id || ''}
                      onChange={(e) => onSelectActiveSchema?.(e.target.value)}
                      className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-slate-900 font-semibold"
                    >
                      {mappingSchemas.map((sc) => (
                        <option key={sc.id} value={sc.id}>
                          {sc.name} ({sc.columns.length} cols)
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!activeMappingSchema) return;
                      setTemplateFileName(`${activeMappingSchema.name}.xlsx`);
                      setTemplateSheetName(activeMappingSchema.sheetName || 'Student_Register');
                      setTemplateColumns(schemaToTemplateColumns(activeMappingSchema));
                      setShowTemplateMapper(true);
                      setScanStatusMsg(`Loaded saved mapping schema "${activeMappingSchema.name}" for template export.`);
                    }}
                    className="text-indigo-700 font-bold hover:underline cursor-pointer"
                  >
                    Load Schema into Template Exporter
                  </button>
                </div>
              )}
            </div>
          )}

          {sourceMode === 'camera' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {!isCameraActive ? (
                  <button
                    type="button"
                    onClick={handleStartCamera}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0f294a] text-white text-xs font-bold cursor-pointer"
                  >
                    <Camera className="w-4 h-4 text-amber-300" />
                    <span>Open Live Camera Scanner</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleCaptureCameraFrame}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-black cursor-pointer"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Capture Page ({selectedFiles.length} queued)</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleStopCamera}
                      className="px-3 py-2 rounded-xl bg-slate-200 text-slate-800 text-xs font-bold cursor-pointer"
                    >
                      Stop Camera
                    </button>
                  </>
                )}

                <label className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-slate-300 text-slate-800 text-xs font-bold cursor-pointer">
                  <Upload className="w-4 h-4" />
                  <span>Mobile Camera Photo Capture</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    onChange={handleFilesSelected}
                    className="hidden"
                  />
                </label>
              </div>

              {isCameraActive && (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full max-h-64 rounded-xl bg-black object-contain"
                />
              )}
            </div>
          )}

          {sourceMode === 'gallery' && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-slate-600">
                Upload multiple admission form photos or printed register pages (PNG, JPG, WebP) in one multi-page batch.
              </div>
              <div>
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFilesSelected}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0f294a] hover:bg-[#1e3a8a] text-white text-xs font-bold cursor-pointer"
                >
                  <ImagePlus className="w-4 h-4 text-amber-300" />
                  <span>Upload Gallery Pages</span>
                </button>
              </div>
            </div>
          )}

          {sourceMode === 'pdf' && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-slate-600">
                Upload multi-page PDF student admission lists or government school registers for intelligent OCR table extraction.
              </div>
              <div>
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept="application/pdf"
                  multiple
                  onChange={handleFilesSelected}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => pdfInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0f294a] hover:bg-[#1e3a8a] text-white text-xs font-bold cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-amber-300" />
                  <span>Select PDF Documents</span>
                </button>
              </div>
            </div>
          )}

          {sourceMode === 'text' && (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Scanned Register Text (Pipe `|`, Tab, or Comma separated)
              </label>
              <textarea
                rows={4}
                value={ocrTextInput}
                onChange={(e) => setOcrTextInput(e.target.value)}
                placeholder="Student Name | Father's Name | D.O.B | Class | Section&#10;Aamir Ahmad | Mohammad Ahmad | 12-05-2012 | 8th | A"
                className="w-full p-3 rounded-xl border border-slate-300 bg-white font-mono text-xs text-slate-900"
              />
            </div>
          )}

          {/* Queued multi-page files */}
          {selectedFiles.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {selectedFiles.map((f, i) => (
                <span
                  key={`${f.name}-${i}`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-slate-700"
                >
                  <span>{f.name}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedFiles((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-slate-400 hover:text-rose-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {(sourceMode !== 'excel' || selectedFiles.length > 0 || ocrTextInput.trim()) && (
            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={isScanning}
                onClick={handleRunOcrExtraction}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-sm disabled:opacity-60 cursor-pointer"
              >
                {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanText className="w-4 h-4" />}
                <span>{isScanning ? 'Extracting Student Rows...' : 'Run Intelligent OCR Extraction'}</span>
              </button>
            </div>
          )}
        </div>

        {scanStatusMsg && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{scanStatusMsg}</span>
          </div>
        )}
        {scanError && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-xs font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{scanError}</span>
          </div>
        )}
      </div>

      {/* MANUAL COLUMN MAPPER FALLBACK */}
      {rawHeaders.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-[#0f294a]">
              <Sliders className="w-4 h-4 text-amber-600" />
              <span>Column Heading Mapper ({rawHeaders.length} detected columns)</span>
            </div>
            <button
              type="button"
              onClick={() => setShowColumnMapper((prev) => !prev)}
              className="text-xs font-bold text-indigo-700 hover:underline cursor-pointer"
            >
              {showColumnMapper ? 'Hide Column Mapper' : 'Adjust Column Mapping Manually'}
            </button>
          </div>

          {showColumnMapper && (
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                {rawHeaders.map((hdr, idx) => (
                  <div key={`${hdr}-${idx}`} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                    <div className="font-bold text-slate-700 truncate">Source: {hdr}</div>
                    <select
                      value={columnMapping[idx] || ''}
                      onChange={(e) =>
                        setColumnMapping((prev) => ({
                          ...prev,
                          [idx]: e.target.value as CanonicalStudentField | '',
                        }))
                      }
                      className="w-full px-2 py-1 rounded-lg border border-slate-300 bg-white text-slate-900"
                    >
                      <option value="">-- Ignore Column --</option>
                      {CANONICAL_FIELD_LABELS.map((f) => (
                        <option key={f.key} value={f.key}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => applyMatrixWithMapping(rawMatrixRows, columnMapping, 92)}
                  className="px-4 py-2 rounded-xl bg-[#0f294a] text-white text-xs font-bold cursor-pointer"
                >
                  Apply Column Mapping to Preview
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. OCR PREVIEW & VERIFICATION SCREEN WITH CONFIDENCE HEATMAP */}
      {extractedRows.length > 0 && (() => {
        const heatmapStats = computeBatchHeatmapStats(extractedRows, PREVIEW_HEATMAP_FIELDS);
        const displayedRows = focusLowConfidenceOnly
          ? extractedRows.filter((row) =>
              row.isDuplicate ||
              row.validationErrors.length > 0 ||
              PREVIEW_HEATMAP_FIELDS.some((f) => getCellConfidenceInfo(row, f).status !== 'high')
            )
          : extractedRows;

        return (
          <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-black text-[#0f294a]">
                  OCR Preview &amp; Administrator Verification ({previewStats.total} Records)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Records are held in verification staging until approved. Use the Confidence Heatmap to inspect green (high), yellow (uncertain), and red (missing/error) cells before importing.
                </p>
                <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-600 tabular-nums">
                  <span>Valid: <strong className="text-emerald-700">{previewStats.valid}</strong></span>
                  <span aria-hidden="true">·</span>
                  <span>Uncertain Rows: <strong className="text-amber-700">{previewStats.uncertain}</strong></span>
                  <span aria-hidden="true">·</span>
                  <span>Duplicates: <strong className="text-rose-700">{previewStats.duplicates}</strong></span>
                  <span aria-hidden="true">·</span>
                  <span>Selected: <strong className="text-[#0f294a]">{previewStats.selected}</strong></span>
                </div>
              </div>

              {/* Required Three Actions: Approve All, Edit Records, Import Selected */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 mr-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={skipDuplicates}
                    onChange={(e) => setSkipDuplicates(e.target.checked)}
                    className="accent-[#0f294a]"
                  />
                  <span>Skip Duplicates</span>
                </label>

                <button
                  type="button"
                  onClick={handleApproveAll}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Approve All</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsInlineEditMode((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-bold cursor-pointer ${
                    isInlineEditMode
                      ? 'bg-amber-400 border-amber-500 text-slate-950'
                      : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                  }`}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>{isInlineEditMode ? 'Editing Records (ON)' : 'Edit Records'}</span>
                </button>

                <button
                  type="button"
                  disabled={isImporting}
                  onClick={handleImportSelected}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0f294a] hover:bg-[#1e3a8a] text-amber-300 text-xs font-black shadow-sm disabled:opacity-60 cursor-pointer"
                >
                  {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>Import Selected ({previewStats.selected})</span>
                </button>

                {templateColumns.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleExportPopulatedTemplate('ocr-preview')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Populate Template ({previewStats.selected})</span>
                  </button>
                )}
              </div>
            </div>

            {/* Confidence Heatmap Legend & Filter Strip */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
              <div className="flex flex-wrap items-center gap-3 tabular-nums">
                <span className="font-bold text-[#0f294a]">Confidence Heatmap:</span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-100 border border-emerald-300 text-emerald-900 font-semibold">
                  <span aria-hidden="true">✓</span>
                  <span>High Confidence ({heatmapStats.high})</span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-100 border border-amber-400 text-amber-950 font-semibold">
                  <span aria-hidden="true">?</span>
                  <span>Uncertain ({heatmapStats.uncertain})</span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-rose-100 border border-rose-400 text-rose-950 font-semibold">
                  <span aria-hidden="true">!</span>
                  <span>Missing / Error ({heatmapStats.error})</span>
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsConfidenceHeatmapEnabled((prev) => !prev)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer ${
                    isConfidenceHeatmapEnabled
                      ? 'bg-[#0f294a] text-amber-300 border-[#0f294a]'
                      : 'bg-white text-slate-700 border-slate-300'
                  }`}
                >
                  Heatmap: {isConfidenceHeatmapEnabled ? 'ON' : 'OFF'}
                </button>
                <button
                  type="button"
                  onClick={() => setFocusLowConfidenceOnly((prev) => !prev)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer tabular-nums ${
                    focusLowConfidenceOnly
                      ? 'bg-amber-400 text-slate-950 border-amber-500'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {focusLowConfidenceOnly
                    ? `Showing Attention Rows (${displayedRows.length})`
                    : `Focus Low-Confidence / Errors (${heatmapStats.rowsNeedingAttention})`}
                </button>
              </div>
            </div>

            {isImporting && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-[#0f294a]">
                  <span>Importing Verified Student Records...</span>
                  <span className="font-mono tabular-nums">{importProgressPct}%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 transition-all duration-150"
                    style={{ width: `${importProgressPct}%` }}
                  />
                </div>
              </div>
            )}

            {/* Horizontal Scrolling Verification Grid */}
            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="min-w-full text-xs text-left divide-y divide-slate-200">
                <thead className="bg-slate-50 text-slate-700 font-bold">
                  <tr>
                    <th className="p-2.5">
                      <input
                        type="checkbox"
                        checked={extractedRows.length > 0 && extractedRows.every((r) => r.selected)}
                        onChange={(e) =>
                          setExtractedRows((prev) => prev.map((r) => ({ ...r, selected: e.target.checked })))
                        }
                        aria-label="Select all preview rows"
                      />
                    </th>
                    <th className="p-2.5">#</th>
                    <th className="p-2.5">Confidence</th>
                    <th className="p-2.5">Adm. No</th>
                    <th className="p-2.5">Student Name *</th>
                    <th className="p-2.5">Father&apos;s Name</th>
                    <th className="p-2.5">D.O.B</th>
                    <th className="p-2.5">Gender</th>
                    <th className="p-2.5">Class *</th>
                    <th className="p-2.5">Sec</th>
                    <th className="p-2.5">Mobile</th>
                    <th className="p-2.5">Status / Warnings</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {displayedRows.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="p-6 text-center text-slate-500">
                        All extracted rows have high confidence with zero missing or error cells.
                      </td>
                    </tr>
                  ) : (
                    displayedRows.map((row) => (
                      <tr key={row.tempId} className="hover:bg-slate-50/70">
                        <td className="p-2.5">
                          <input
                            type="checkbox"
                            checked={row.selected}
                            onChange={(e) =>
                              setExtractedRows((prev) =>
                                prev.map((r) => (r.tempId === row.tempId ? { ...r, selected: e.target.checked } : r))
                              )
                            }
                          />
                        </td>
                        <td className="p-2.5 font-mono tabular-nums text-slate-500">{row.rowIndex}</td>
                        <td className="p-2.5 font-mono tabular-nums font-bold">
                          <span
                            className={
                              row.confidenceScore >= 90
                                ? 'text-emerald-700'
                                : row.confidenceScore >= 75
                                ? 'text-amber-700'
                                : 'text-rose-700'
                            }
                          >
                            {row.confidenceScore}%
                          </span>
                        </td>
                        {PREVIEW_HEATMAP_FIELDS.map((fieldKey) => {
                          const cellInfo = getCellConfidenceInfo(row, fieldKey);
                          const val = String((row as any)[fieldKey] || '');
                          const showInput = isInlineEditMode || cellInfo.status !== 'high';

                          const heatmapInputClasses = isConfidenceHeatmapEnabled
                            ? cellInfo.status === 'error'
                              ? 'border-rose-400 bg-rose-100 text-rose-950 font-semibold'
                              : cellInfo.status === 'uncertain'
                              ? 'border-amber-400 bg-amber-100 text-amber-950 font-semibold'
                              : 'border-emerald-300 bg-emerald-50 text-emerald-950'
                            : 'border-slate-300 bg-white text-slate-900';

                          const heatmapDisplayClasses = isConfidenceHeatmapEnabled
                            ? cellInfo.status === 'error'
                              ? 'bg-rose-100 border border-rose-300 text-rose-950 font-semibold'
                              : cellInfo.status === 'uncertain'
                              ? 'bg-amber-100 border border-amber-300 text-amber-950 font-semibold'
                              : 'bg-emerald-50 border border-emerald-200 text-emerald-950'
                            : 'text-slate-900';

                          const statusGlyph =
                            cellInfo.status === 'error' ? '!' : cellInfo.status === 'uncertain' ? '?' : '✓';

                          return (
                            <td key={fieldKey} className="p-1.5" title={cellInfo.reason}>
                              {showInput ? (
                                <div className="relative flex items-center gap-1">
                                  {isConfidenceHeatmapEnabled && (
                                    <span
                                      aria-label={cellInfo.status}
                                      className={`text-[10px] font-black shrink-0 ${
                                        cellInfo.status === 'error'
                                          ? 'text-rose-700'
                                          : cellInfo.status === 'uncertain'
                                          ? 'text-amber-800'
                                          : 'text-emerald-700'
                                      }`}
                                    >
                                      {statusGlyph}
                                    </span>
                                  )}
                                  <input
                                    type="text"
                                    value={val}
                                    placeholder={cellInfo.status === 'error' ? 'Missing' : ''}
                                    onChange={(e) => handleUpdateExtractedCell(row.tempId, fieldKey, e.target.value)}
                                    className={`w-full min-w-[96px] px-2 py-1 rounded border text-xs ${heatmapInputClasses}`}
                                  />
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setIsInlineEditMode(true)}
                                  className={`w-full text-left px-2 py-1 rounded flex items-center gap-1.5 truncate max-w-[160px] cursor-pointer ${heatmapDisplayClasses}`}
                                  title={`${cellInfo.reason} — Click to edit`}
                                >
                                  {isConfidenceHeatmapEnabled && (
                                    <span className="text-[10px] font-black text-emerald-700 shrink-0" aria-hidden="true">
                                      ✓
                                    </span>
                                  )}
                                  <span className="truncate">{val}</span>
                                </button>
                              )}
                            </td>
                          );
                        })}
                        <td className="p-2.5 text-[11px] min-w-[180px]">
                          {row.isDuplicate && (
                            <div className="text-rose-700 font-bold">{row.duplicateReason}</div>
                          )}
                          {row.validationErrors.length > 0 && (
                            <div className="text-rose-800 font-semibold">{row.validationErrors.join('; ')}</div>
                          )}
                          {!row.isDuplicate && row.validationErrors.length === 0 && (
                            <span className="text-emerald-700 font-bold">
                              {row.approved ? 'Approved' : 'Ready to Verify'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* IMPORT HISTORY & UNDO LAST IMPORT */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-[#0f294a]" />
            <h3 className="text-sm font-black text-[#0f294a]">
              Import History &amp; Batch Rollback ({importHistory.length})
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {lastBatchStats && lastBatchStats.failed > 0 && (
              <button
                type="button"
                onClick={handleRetryFailed}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 text-xs font-bold cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Failed ({lastBatchStats.failed})</span>
              </button>
            )}
            {latestUndoableBatch && onBulkDeleteStudents && (
              <button
                type="button"
                onClick={() => setPendingUndoBatch(latestUndoableBatch)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Undo Last Import ({latestUndoableBatch.importedStudentIds.length} records)</span>
              </button>
            )}
          </div>
        </div>

        {lastBatchStats && (
          <div className="grid grid-cols-3 gap-3 text-xs tabular-nums">
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
              <div className="text-slate-600">Successful Imports</div>
              <div className="text-lg font-black text-emerald-700">{lastBatchStats.imported}</div>
            </div>
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
              <div className="text-slate-600">Failed Records</div>
              <div className="text-lg font-black text-rose-700">{lastBatchStats.failed}</div>
            </div>
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
              <div className="text-slate-600">Duplicates Skipped</div>
              <div className="text-lg font-black text-amber-700">{lastBatchStats.duplicates}</div>
            </div>
          </div>
        )}

        {lastBatchStats && lastBatchStats.errors.length > 0 && (
          <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200 text-xs text-rose-900 space-y-1">
            <div className="font-bold">Error Report:</div>
            {lastBatchStats.errors.map((err, i) => (
              <div key={i}>· {err}</div>
            ))}
          </div>
        )}

        {importHistory.length === 0 ? (
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
            No bulk student import batches recorded yet. Once you approve and import scanned or Excel rows, each batch appears here with one-click Undo Last Import rollback.
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-2xl">
            <table className="min-w-full text-xs text-left divide-y divide-slate-200">
              <thead className="bg-slate-50 text-slate-700 font-bold">
                <tr>
                  <th className="py-2.5 px-3">Date &amp; Time</th>
                  <th className="py-2.5 px-3">Source File / Mode</th>
                  <th className="py-2.5 px-3">Imported By</th>
                  <th className="py-2.5 px-3 text-right">Imported</th>
                  <th className="py-2.5 px-3 text-right">Skipped / Failed</th>
                  <th className="py-2.5 px-3">Batch Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {importHistory.slice(0, 10).map((batch) => {
                  const isLatestActive = latestUndoableBatch?.id === batch.id;
                  return (
                    <tr key={batch.id} className={batch.undone ? 'bg-slate-50/70 text-slate-400' : ''}>
                      <td className="py-2.5 px-3 font-mono tabular-nums whitespace-nowrap">
                        {new Date(batch.timestamp).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">
                        {batch.sourceName}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{batch.actorName}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-emerald-700">
                        {batch.importedCount}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600">
                        {batch.duplicateCount} dup / {batch.failedCount} err
                      </td>
                      <td className="py-2.5 px-3 font-semibold">
                        {batch.undone ? (
                          <span className="text-slate-500">Undone (Rolled Back)</span>
                        ) : isLatestActive ? (
                          <span className="text-emerald-700">Latest Active Batch</span>
                        ) : (
                          <span className="text-slate-700">Imported</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* UNDO LAST IMPORT CONFIRMATION DIALOG */}
      {pendingUndoBatch && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 no-print">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Undo Last Import — Are you sure?
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  Are you sure you want to remove the{' '}
                  <strong className="text-rose-700">
                    {pendingUndoBatch.importedStudentIds.length} student record(s)
                  </strong>{' '}
                  added in <strong>{pendingUndoBatch.sourceName}</strong> (
                  {new Date(pendingUndoBatch.timestamp).toLocaleString()})? Earlier student records will remain untouched.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1 max-h-36 overflow-y-auto">
              <div className="font-bold text-slate-800">Records scheduled for removal:</div>
              {pendingUndoBatch.importedStudentIds.slice(0, 6).map((id) => {
                const match = students.find((s) => s.id === id);
                return (
                  <div key={id} className="truncate font-mono text-[11px]">
                    · {match ? `${match.fullName} (${match.admissionNumber}, Class ${match.classNumber})` : id}
                  </div>
                );
              })}
              {pendingUndoBatch.importedStudentIds.length > 6 && (
                <div className="text-[11px] text-slate-500">
                  + {pendingUndoBatch.importedStudentIds.length - 6} more record(s) from this batch
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPendingUndoBatch(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmUndoLatestBatch}
                className="px-4 py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-700 text-white shadow-sm cursor-pointer"
              >
                Yes, Undo Last Import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXCEL TEMPLATE MATCHING — PRESERVE 100% COLUMN NAMES & EXACT ORDER */}
      <div className="bg-white rounded-3xl border border-indigo-200 p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-950 text-amber-300 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-[#0f294a]">
                Excel Template Matching (Exact School Format Preservation)
              </h3>
              <p className="text-xs text-slate-600">
                Upload any school Excel sheet (e.g., 20-column register). Preserves 100% of original column names &amp; column order while mapping scanned OCR or DB student fields into matching columns.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <input
              ref={templateInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleTemplateExcelUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => templateInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0f294a] hover:bg-[#1e3a8a] text-amber-300 text-xs font-bold cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload School Excel Template</span>
            </button>
            <button
              type="button"
              onClick={handleLoadDemo20ColTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 text-xs font-bold cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Load 20-Col Demo</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadBlank20ColTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-xs font-bold cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Blank 20-Col (.xlsx)</span>
            </button>
          </div>
        </div>

        {templateColumns.length > 0 && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-indigo-50/70 border border-indigo-200 rounded-2xl px-4 py-2.5 text-xs">
              <div className="flex flex-wrap items-center gap-2 text-indigo-950 font-semibold">
                <span className="font-black">{templateFileName}</span>
                <span aria-hidden="true">·</span>
                <span>{templateColumns.length} Columns Preserved (100% Original Order)</span>
                <span aria-hidden="true">·</span>
                <span className="text-emerald-700 font-bold">
                  {templateColumns.filter((c) => c.mappedField !== '').length} Auto-Matched
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowTemplateMapper((p) => !p)}
                  className="text-indigo-700 font-bold hover:underline cursor-pointer"
                >
                  {showTemplateMapper ? 'Hide Column Map' : 'Edit Column Map'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTemplateColumns([]);
                    setTemplateFileName(null);
                  }}
                  className="text-slate-500 hover:text-rose-600 cursor-pointer"
                  aria-label="Clear Excel template"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {showTemplateMapper && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
                {templateColumns.map((col) => (
                  <div
                    key={`${col.index}-${col.headerName}`}
                    className={`p-2.5 rounded-xl border space-y-1.5 ${
                      col.mappedField ? 'bg-emerald-50/40 border-emerald-200' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-black text-[#0f294a] truncate" title={col.headerName}>
                        #{col.index + 1} {col.headerName}
                      </span>
                    </div>
                    <select
                      value={col.mappedField}
                      onChange={(e) => {
                        const nextVal = e.target.value as TemplateColumnMappingTarget;
                        setTemplateColumns((prev) =>
                          prev.map((c) => (c.index === col.index ? { ...c, mappedField: nextVal } : c))
                        );
                      }}
                      className="w-full px-2 py-1 rounded-lg border border-slate-300 bg-white text-slate-900 font-medium"
                    >
                      <option value="">-- Unmapped (Preserve Empty/Default) --</option>
                      <option value="__serial__">Auto Serial No. (1, 2, 3...)</option>
                      <option value="__schoolName__">School Name ({school.name})</option>
                      <option value="__udiseCode__">U-DISE Code ({school.code})</option>
                      {CANONICAL_FIELD_LABELS.map((f) => (
                        <option key={f.key} value={f.key}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={col.defaultValue}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTemplateColumns((prev) =>
                          prev.map((c) => (c.index === col.index ? { ...c, defaultValue: val } : c))
                        );
                      }}
                      placeholder="Static/fallback value (optional)"
                      className="w-full px-2 py-1 rounded-lg border border-slate-200 bg-white text-[11px] text-slate-700"
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              {extractedRows.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleExportPopulatedTemplate('ocr-preview')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Staged OCR Preview into Template ({previewStats.selected})</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => handleExportPopulatedTemplate('filtered-students')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Filtered DB into Template ({filteredExportStudents.length})</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* FILTERED EXPORT CENTER */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-black text-[#0f294a] mr-1">Export Filtered Register ({filteredExportStudents.length}):</span>
          <select
            value={exportClass}
            onChange={(e) => setExportClass(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-semibold"
          >
            <option value="all">All Classes</option>
            {school.classesOffered.map((c) => (
              <option key={c} value={c}>Class {c}</option>
            ))}
          </select>
          <select
            value={exportSection}
            onChange={(e) => setExportSection(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-semibold"
          >
            <option value="all">All Sections</option>
            {['A', 'B', 'C', 'D'].map((sec) => (
              <option key={sec} value={sec}>Section {sec}</option>
            ))}
          </select>
          <select
            value={exportSession}
            onChange={(e) => setExportSession(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-semibold"
          >
            <option value="all">All Sessions</option>
            <option value={school.academicSession}>{school.academicSession}</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {templateColumns.length > 0 && (
            <button
              type="button"
              onClick={() => handleExportPopulatedTemplate('filtered-students')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Matched Template (.xlsx)</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleExportRegisterExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Excel (.xlsx)</span>
          </button>
          <button
            type="button"
            onClick={handleExportRegisterCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0f294a] hover:bg-[#1e3a8a] text-white text-xs font-bold cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
          <button
            type="button"
            onClick={handleExportRegisterPdf}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>PDF Register</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>
        </div>
      </div>
    </div>
  );
};
