import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  Copy,
  Download,
  FileSpreadsheet,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  ExcelMappingColumnRule,
  ExcelMappingSchema,
  SchoolProfile,
  User,
} from '../types';
import {
  CANONICAL_FIELD_LABELS,
  DEMO_20_COL_TEMPLATE_HEADERS,
  matchTemplateHeader,
} from '../utils/ocrStudentExtractor';

interface ExcelTemplateMappingPageProps {
  school: SchoolProfile;
  currentUser: User;
  schemas: ExcelMappingSchema[];
  activeSchemaId: string;
  onSaveSchema: (schema: ExcelMappingSchema, isNew: boolean) => void;
  onDeleteSchema: (schemaId: string) => void;
  onSelectActiveSchema: (schemaId: string) => void;
  onProceedToBulkImport?: () => void;
}

export const ExcelTemplateMappingPage: React.FC<ExcelTemplateMappingPageProps> = ({
  school,
  currentUser,
  schemas,
  activeSchemaId,
  onSaveSchema,
  onDeleteSchema,
  onSelectActiveSchema,
  onProceedToBulkImport,
}) => {
  const selectedFromStore = useMemo(
    () => schemas.find((s) => s.id === activeSchemaId) || schemas[0],
    [schemas, activeSchemaId]
  );

  const [editingId, setEditingId] = useState<string>(selectedFromStore?.id || `schema_${Date.now()}`);
  const [isNewDraft, setIsNewDraft] = useState<boolean>(!selectedFromStore);
  const [schemaName, setSchemaName] = useState<string>(
    selectedFromStore?.name || 'Custom School Excel Schema'
  );
  const [schemaDescription, setSchemaDescription] = useState<string>(
    selectedFromStore?.description || ''
  );
  const [sheetName, setSheetName] = useState<string>(
    selectedFromStore?.sheetName || 'Student_Register'
  );
  const [columns, setColumns] = useState<ExcelMappingColumnRule[]>(
    selectedFromStore?.columns ||
      DEMO_20_COL_TEMPLATE_HEADERS.map((hdr, idx) => ({
        index: idx,
        sourceHeader: hdr,
        targetField: matchTemplateHeader(hdr),
        defaultValue: '',
        required: ['Student Full Name', "Father's Name", 'Class'].includes(hdr),
      }))
  );
  const [setAsDefault, setSetAsDefault] = useState<boolean>(
    Boolean(selectedFromStore?.isDefault ?? true)
  );
  const [pasteHeadersText, setPasteHeadersText] = useState<string>('');
  const [showPasteBox, setShowPasteBox] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [schemaToDelete, setSchemaToDelete] = useState<ExcelMappingSchema | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadSchemaIntoEditor = (schema: ExcelMappingSchema) => {
    setEditingId(schema.id);
    setIsNewDraft(false);
    setSchemaName(schema.name);
    setSchemaDescription(schema.description || '');
    setSheetName(schema.sheetName || 'Student_Register');
    setColumns(schema.columns.map((c, idx) => ({ ...c, index: idx })));
    setSetAsDefault(Boolean(schema.isDefault));
    setStatusMessage(null);
    setErrorMessage(null);
    onSelectActiveSchema(schema.id);
  };

  const handleCreateNewSchema = () => {
    const newId = `schema_${Date.now()}`;
    setEditingId(newId);
    setIsNewDraft(true);
    setSchemaName('New School Excel Register Schema');
    setSchemaDescription('Custom header-to-database mapping schema');
    setSheetName('Admission_Register');
    setColumns([
      { index: 0, sourceHeader: 'Admission No.', targetField: 'admissionNumber', defaultValue: '', required: false },
      { index: 1, sourceHeader: 'Student Name', targetField: 'fullName', defaultValue: '', required: true },
      { index: 2, sourceHeader: "Father's Name", targetField: 'fatherName', defaultValue: '', required: true },
      { index: 3, sourceHeader: 'Date of Birth', targetField: 'dob', defaultValue: '', required: false },
      { index: 4, sourceHeader: 'Class', targetField: 'classNumber', defaultValue: '', required: true },
      { index: 5, sourceHeader: 'Section', targetField: 'section', defaultValue: 'A', required: false },
    ]);
    setSetAsDefault(true);
    setStatusMessage('Started a new custom mapping schema draft. Upload your Excel file or edit rows below, then click Save Mapping Schema.');
    setErrorMessage(null);
  };

  const handleDuplicateCurrent = () => {
    const newId = `schema_${Date.now()}`;
    setEditingId(newId);
    setIsNewDraft(true);
    setSchemaName(`${schemaName} (Copy)`);
    setSetAsDefault(false);
    setStatusMessage('Cloned current schema into a new draft. Click Save Mapping Schema to persist.');
  };

  const handleUploadSchoolExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const firstSheet = wb.SheetNames[0] || 'Sheet1';
      const sheet = wb.Sheets[firstSheet];
      const rowsAoa = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' });

      const headerRowIdx = rowsAoa.findIndex(
        (r) => Array.isArray(r) && r.some((cell) => String(cell).trim() !== '')
      );
      if (headerRowIdx < 0) {
        setErrorMessage('No readable header row was found in the uploaded Excel/CSV file.');
        return;
      }

      const rawHeaderRow = rowsAoa[headerRowIdx];
      const sampleRow =
        rowsAoa.find(
          (r, idx) =>
            idx > headerRowIdx &&
            Array.isArray(r) &&
            r.some((cell) => String(cell).trim() !== '')
        ) || [];

      const extractedCols: ExcelMappingColumnRule[] = rawHeaderRow.map((cell, idx) => {
        const hdr = String(cell ?? '').trim() || `Column_${idx + 1}`;
        const autoTarget = matchTemplateHeader(hdr);
        return {
          index: idx,
          sourceHeader: hdr,
          targetField: autoTarget,
          defaultValue: '',
          required: autoTarget === 'fullName' || autoTarget === 'classNumber',
          sampleValue: sampleRow[idx] !== undefined ? String(sampleRow[idx]).trim() : '',
        };
      });

      setSheetName(firstSheet);
      if (isNewDraft || schemaName.startsWith('New School')) {
        setSchemaName(file.name.replace(/\.(xlsx|xls|csv)$/i, ''));
      }
      setColumns(extractedCols);
      const matchedCount = extractedCols.filter((c) => c.targetField !== '').length;
      setStatusMessage(
        `Extracted ${extractedCols.length} header(s) from "${file.name}" (${matchedCount} auto-matched to internal database fields). Review and save below.`
      );
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to parse the uploaded Excel file.');
    } finally {
      e.target.value = '';
    }
  };

  const handleParsePastedHeaders = () => {
    const raw = pasteHeadersText.trim();
    if (!raw) return;
    const sep = raw.includes('|') ? '|' : raw.includes('\t') ? '\t' : ',';
    const headers = raw
      .split(sep)
      .map((s) => s.trim())
      .filter(Boolean);
    if (headers.length === 0) {
      setErrorMessage('Enter at least one header column name.');
      return;
    }
    const nextCols: ExcelMappingColumnRule[] = headers.map((hdr, idx) => {
      const target = matchTemplateHeader(hdr);
      return {
        index: idx,
        sourceHeader: hdr,
        targetField: target,
        defaultValue: '',
        required: target === 'fullName' || target === 'classNumber',
      };
    });
    setColumns(nextCols);
    setShowPasteBox(false);
    setPasteHeadersText('');
    setStatusMessage(`Loaded ${nextCols.length} pasted column headers into mapping schema.`);
  };

  const handleMoveColumn = (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= columns.length) return;
    setColumns((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIdx];
      copy[targetIdx] = temp;
      return copy.map((c, idx) => ({ ...c, index: idx }));
    });
  };

  const handleAddColumn = () => {
    setColumns((prev) => [
      ...prev,
      {
        index: prev.length,
        sourceHeader: `Custom Column ${prev.length + 1}`,
        targetField: '',
        defaultValue: '',
        required: false,
      },
    ]);
  };

  const handleRemoveColumn = (index: number) => {
    if (columns.length <= 1) {
      setErrorMessage('A mapping schema must keep at least one column.');
      return;
    }
    setColumns((prev) => prev.filter((_, i) => i !== index).map((c, idx) => ({ ...c, index: idx })));
  };

  const handleSaveSchema = () => {
    setErrorMessage(null);
    const trimmedName = schemaName.trim();
    if (trimmedName.length < 2) {
      setErrorMessage('Please enter a descriptive Schema Name (at least 2 characters).');
      return;
    }
    if (columns.length === 0) {
      setErrorMessage('Add or upload at least one column header before saving.');
      return;
    }
    const nowIso = new Date().toISOString();
    const existing = schemas.find((s) => s.id === editingId);
    const payload: ExcelMappingSchema = {
      id: editingId,
      name: trimmedName,
      description: schemaDescription.trim(),
      sheetName: sheetName.trim() || 'Student_Register',
      columns: columns.map((c, idx) => ({
        ...c,
        index: idx,
        sourceHeader: c.sourceHeader.trim() || `Column_${idx + 1}`,
      })),
      isDefault: setAsDefault,
      createdByName: existing?.createdByName || currentUser.name,
      createdAt: existing?.createdAt || nowIso,
      updatedAt: nowIso,
    };

    onSaveSchema(payload, isNewDraft || !existing);
    setIsNewDraft(false);
    setStatusMessage(
      `Saved schema "${payload.name}" (${payload.columns.length} columns). ${
        setAsDefault ? 'Marked as active default for student bulk imports.' : ''
      }`
    );
  };

  const handleDownloadSchemaExcel = () => {
    const headers = columns.map((c) => c.sourceHeader);
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, (sheetName || 'Student_Register').slice(0, 31));
    const safeName = (schemaName || 'School_Template').replace(/[^a-zA-Z0-9_-]+/g, '_');
    XLSX.writeFile(wb, `${safeName}_Template.xlsx`);
  };

  const coverageStats = useMemo(() => {
    const mapped = columns.filter((c) => c.targetField !== '').length;
    const unmapped = columns.length - mapped;
    const targets = new Set(columns.map((c) => c.targetField));
    const hasName = targets.has('fullName');
    const hasClass = targets.has('classNumber');
    const hasFather = targets.has('fatherName');
    return { mapped, unmapped, hasName, hasClass, hasFather };
  }, [columns]);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="text-xs font-medium text-slate-500 flex items-center gap-2">
              <span>Smart Student Register</span>
              <span aria-hidden="true">/</span>
              <span className="text-[#0f294a] font-semibold">Excel Template Mapping</span>
            </div>
            <h1 className="text-xl font-bold text-[#0f294a] tracking-tight">
              Excel Template Mapping Configuration
            </h1>
            <p className="text-xs text-slate-600 max-w-2xl">
              Upload your school&apos;s existing Excel register headers and define reusable column mapping schemas linking spreadsheet columns to internal student database fields.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCreateNewSchema}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Mapping Schema</span>
            </button>

            <button
              type="button"
              onClick={handleSaveSchema}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0f294a] hover:bg-[#1e3a8a] text-amber-300 text-xs font-bold whitespace-nowrap cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Mapping Schema</span>
            </button>
          </div>
        </div>

        {/* Saved Schemas Switcher */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700">
              Saved School Mapping Schemas ({schemas.length})
            </span>
            <span className="text-slate-500 tabular-nums">
              Active Schema: <strong className="text-[#0f294a]">{selectedFromStore?.name || schemaName}</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {schemas.map((sc) => {
              const isSelected = !isNewDraft && sc.id === editingId;
              return (
                <div
                  key={sc.id}
                  onClick={() => loadSchemaIntoEditor(sc)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') loadSchemaIntoEditor(sc);
                  }}
                  className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer flex items-start justify-between gap-2 ${
                    isSelected
                      ? 'bg-indigo-50/70 border-indigo-400'
                      : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100/80'
                  }`}
                >
                  <div className="min-w-0 space-y-1">
                    <div className="font-bold text-xs text-[#0f294a] truncate">{sc.name}</div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5 tabular-nums">
                      <span>{sc.columns.length} cols</span>
                      <span aria-hidden="true">·</span>
                      <span>{sc.columns.filter((c) => c.targetField).length} mapped</span>
                      {sc.isDefault && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-emerald-700 font-semibold">Default</span>
                        </>
                      )}
                    </div>
                  </div>

                  {schemas.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSchemaToDelete(sc);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 shrink-0"
                      title="Delete schema"
                      aria-label={`Delete ${sc.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Status / Error Feedback */}
      {statusMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Schema Metadata & Source Header Uploader */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Mapping Schema Name *</label>
            <input
              type="text"
              value={schemaName}
              onChange={(e) => setSchemaName(e.target.value)}
              placeholder="e.g. Govt Middle School 20-Col Admission Sheet"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 font-semibold"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Target Worksheet Name</label>
            <input
              type="text"
              value={sheetName}
              onChange={(e) => setSheetName(e.target.value)}
              placeholder="Admission_Register"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 font-mono"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Description / Notes</label>
            <input
              type="text"
              value={schemaDescription}
              onChange={(e) => setSchemaDescription(e.target.value)}
              placeholder="Optional notes about this Excel format"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900"
            />
          </div>
        </div>

        {/* Source Header Import Controls */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="text-xs text-slate-700">
            <strong className="text-[#0f294a]">Import Headers from Existing School File:</strong>{' '}
            Upload any <code className="font-mono">.xlsx</code>, <code className="font-mono">.xls</code>, or{' '}
            <code className="font-mono">.csv</code> file to automatically extract its exact headers &amp; sample row values.
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleUploadSchoolExcel}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold whitespace-nowrap cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Excel / CSV Headers</span>
            </button>

            <button
              type="button"
              onClick={() => setShowPasteBox((p) => !p)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-xs font-bold whitespace-nowrap cursor-pointer"
            >
              <span>Paste Header Row</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setColumns(
                  DEMO_20_COL_TEMPLATE_HEADERS.map((hdr, idx) => ({
                    index: idx,
                    sourceHeader: hdr,
                    targetField: matchTemplateHeader(hdr),
                    defaultValue: '',
                    required: ['Student Full Name', "Father's Name", 'Class'].includes(hdr),
                  }))
                );
                setStatusMessage('Loaded 20-column Government Middle School preset headers.');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-950 text-xs font-bold whitespace-nowrap cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Load 20-Col Preset</span>
            </button>
          </div>
        </div>

        {showPasteBox && (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <label className="block text-xs font-bold text-slate-700">
              Paste Header Row (Comma, Tab, or Pipe `|` separated)
            </label>
            <textarea
              rows={2}
              value={pasteHeadersText}
              onChange={(e) => setPasteHeadersText(e.target.value)}
              placeholder="S.No., Admission No, Pupil Name, Father Name, D.O.B, Class, Section, Mobile"
              className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-mono text-xs text-slate-900"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPasteBox(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleParsePastedHeaders}
                className="px-3.5 py-1.5 rounded-lg bg-[#0f294a] text-white text-xs font-bold"
              >
                Extract Columns
              </button>
            </div>
          </div>
        )}

        {/* Mapping Coverage Summary & Default Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 text-xs">
          <div className="flex flex-wrap items-center gap-3 text-slate-700 tabular-nums">
            <span>
              Total Columns: <strong className="text-[#0f294a]">{columns.length}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Mapped to DB: <strong className="text-emerald-700">{coverageStats.mapped}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Unmapped: <strong className="text-slate-600">{coverageStats.unmapped}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span className={coverageStats.hasName && coverageStats.hasClass ? 'text-emerald-700 font-semibold' : 'text-amber-700 font-semibold'}>
              {coverageStats.hasName && coverageStats.hasClass
                ? 'Core Required Fields Mapped (Student Name, Class)'
                : 'Map Student Name & Class for valid imports'}
            </span>
          </div>

          <label className="inline-flex items-center gap-2 font-semibold text-slate-800 cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={setAsDefault}
              onChange={(e) => setSetAsDefault(e.target.checked)}
              className="accent-[#0f294a]"
            />
            <span>Set as Default Schema for Bulk Import</span>
          </label>
        </div>

        {/* Interactive Mapping Table */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="min-w-full text-xs text-left divide-y divide-slate-200">
            <thead className="bg-slate-100 text-slate-700 font-bold">
              <tr>
                <th className="py-2.5 px-3 w-16">Order</th>
                <th className="py-2.5 px-3">Excel File Column Header</th>
                <th className="py-2.5 px-3">Sample Value (Row 2)</th>
                <th className="py-2.5 px-3">Internal Database Field (`students`)</th>
                <th className="py-2.5 px-3 text-center w-20">Required</th>
                <th className="py-2.5 px-3">Default / Fallback Value</th>
                <th className="py-2.5 px-3 text-right w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {columns.map((col, idx) => {
                const isMapped = col.targetField !== '';
                return (
                  <tr key={`${idx}-${col.index}`} className="hover:bg-slate-50/80">
                    <td className="py-2 px-3 font-mono tabular-nums text-slate-500 font-bold">
                      #{idx + 1}
                    </td>
                    <td className="py-2 px-3 min-w-[200px]">
                      <input
                        type="text"
                        value={col.sourceHeader}
                        onChange={(e) => {
                          const val = e.target.value;
                          setColumns((prev) =>
                            prev.map((c, i) => (i === idx ? { ...c, sourceHeader: val } : c))
                          );
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 font-semibold"
                      />
                    </td>
                    <td className="py-2 px-3 text-slate-500 max-w-[160px] truncate" title={col.sampleValue || ''}>
                      {col.sampleValue || <span className="text-slate-300 italic">—</span>}
                    </td>
                    <td className="py-2 px-3 min-w-[230px]">
                      <select
                        value={col.targetField}
                        onChange={(e) => {
                          const nextTarget = e.target.value;
                          setColumns((prev) =>
                            prev.map((c, i) => (i === idx ? { ...c, targetField: nextTarget } : c))
                          );
                        }}
                        className={`w-full px-2.5 py-1.5 rounded-lg border font-medium ${
                          isMapped
                            ? 'border-emerald-300 bg-emerald-50/50 text-emerald-950'
                            : 'border-slate-300 bg-white text-slate-600'
                        }`}
                      >
                        <option value="">-- Unmapped (Ignore / Preserve Static) --</option>
                        <optgroup label="Internal Student Database Fields">
                          {CANONICAL_FIELD_LABELS.map((f) => (
                            <option key={f.key} value={f.key}>
                              {f.label} ({f.key})
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Auto School & Register Metadata">
                          <option value="__serial__">Auto Serial No. (1, 2, 3...)</option>
                          <option value="__schoolName__">School Name ({school.name})</option>
                          <option value="__udiseCode__">U-DISE Code ({school.code})</option>
                        </optgroup>
                      </select>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={Boolean(col.required)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setColumns((prev) =>
                            prev.map((c, i) => (i === idx ? { ...c, required: checked } : c))
                          );
                        }}
                        className="accent-[#0f294a]"
                      />
                    </td>
                    <td className="py-2 px-3 min-w-[150px]">
                      <input
                        type="text"
                        value={col.defaultValue || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setColumns((prev) =>
                            prev.map((c, i) => (i === idx ? { ...c, defaultValue: val } : c))
                          );
                        }}
                        placeholder="Optional fallback"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700"
                      />
                    </td>
                    <td className="py-2 px-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleMoveColumn(idx, -1)}
                          disabled={idx === 0}
                          className="p-1 rounded hover:bg-slate-200 text-slate-600 disabled:opacity-30"
                          title="Move column left/up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveColumn(idx, 1)}
                          disabled={idx === columns.length - 1}
                          className="p-1 rounded hover:bg-slate-200 text-slate-600 disabled:opacity-30"
                          title="Move column right/down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveColumn(idx)}
                          className="p-1 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600"
                          title="Remove column"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleAddColumn}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Column</span>
            </button>
            <button
              type="button"
              onClick={handleDuplicateCurrent}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Duplicate Schema</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadSchemaExcel}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Blank Template (.xlsx)</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSaveSchema}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0f294a] hover:bg-[#1e3a8a] text-amber-300 text-xs font-bold cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Mapping Schema</span>
            </button>
            {onProceedToBulkImport && (
              <button
                type="button"
                onClick={() => {
                  handleSaveSchema();
                  onProceedToBulkImport();
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Apply &amp; Open Bulk Import</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Delete Schema Confirmation Modal */}
      {schemaToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 no-print">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Delete Mapping Schema?</h3>
                <p className="text-xs text-slate-600 mt-1">
                  Are you sure you want to remove <strong>{schemaToDelete.name}</strong>? Existing student records will not be affected.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSchemaToDelete(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const deletedId = schemaToDelete.id;
                  onDeleteSchema(deletedId);
                  setSchemaToDelete(null);
                  const fallback = schemas.find((s) => s.id !== deletedId);
                  if (fallback) loadSchemaIntoEditor(fallback);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white"
              >
                Yes, Delete Schema
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
