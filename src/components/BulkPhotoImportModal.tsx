import React, { useMemo, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  AlertTriangle,
  Upload,
  X,
  Image as ImageIcon,
  ShieldAlert,
} from 'lucide-react';
import { Student } from '../types';

interface BulkPhotoImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  onApplyMatchedPhotos: (updates: { student: Student; photoDataUrl: string }[]) => void;
}

interface MatchedPhotoRow {
  fileName: string;
  baseKey: string;
  dataUrl: string;
  matchedStudent: Student | null;
  hasExistingPhoto: boolean;
}

function normalizePhotoKey(raw: string): string {
  return raw
    .replace(/\.[^.]+$/, '') // strip extension
    .trim()
    .toUpperCase()
    .replace(/[\s_]+/g, '-');
}

function resizeImageFileToDataUrl(file: File, maxDimension = 480): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const rawUrl = String(reader.result || '');
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height, 1));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(rawUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => resolve(rawUrl);
      img.src = rawUrl;
    };
    reader.readAsDataURL(file);
  });
}

export const BulkPhotoImportModal: React.FC<BulkPhotoImportModalProps> = ({
  isOpen,
  onClose,
  students,
  onApplyMatchedPhotos,
}) => {
  const [rows, setRows] = useState<MatchedPhotoRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);

  const studentLookup = useMemo(() => {
    const map = new Map<string, Student>();
    for (const s of students) {
      if (s.admissionNumber) {
        map.set(normalizePhotoKey(s.admissionNumber), s);
        map.set(s.admissionNumber.trim().toUpperCase().replace(/[^A-Z0-9]/g, ''), s);
      }
      if (s.id) {
        map.set(normalizePhotoKey(s.id), s);
        map.set(s.id.trim().toUpperCase().replace(/[^A-Z0-9]/g, ''), s);
      }
    }
    return map;
  }, [students]);

  if (!isOpen) return null;

  const handleSelectFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsLoading(true);
    setConfirmOverwrite(false);
    try {
      const processed: MatchedPhotoRow[] = [];
      for (const file of files) {
        if (!file.type.startsWith('image/')) continue;
        const baseKey = normalizePhotoKey(file.name);
        const strippedKey = baseKey.replace(/[^A-Z0-9]/g, '');
        const matchedStudent =
          studentLookup.get(baseKey) || studentLookup.get(strippedKey) || null;
        const dataUrl = await resizeImageFileToDataUrl(file);
        processed.push({
          fileName: file.name,
          baseKey,
          dataUrl,
          matchedStudent,
          hasExistingPhoto: Boolean(matchedStudent?.photoDataUrl),
        });
      }
      setRows(processed);
    } finally {
      setIsLoading(false);
      e.target.value = '';
    }
  };

  const matchedRows = rows.filter((r) => r.matchedStudent !== null);
  const unmatchedRows = rows.filter((r) => r.matchedStudent === null);
  const overwriteRows = matchedRows.filter((r) => r.hasExistingPhoto);
  const needsOverwriteConfirmation = overwriteRows.length > 0 && !confirmOverwrite;

  const handleApply = () => {
    const updates = matchedRows
      .filter((r) => r.matchedStudent !== null && (!r.hasExistingPhoto || confirmOverwrite))
      .map((r) => ({
        student: r.matchedStudent!,
        photoDataUrl: r.dataUrl,
      }));
    if (updates.length === 0) return;
    onApplyMatchedPhotos(updates);
    setRows([]);
    setConfirmOverwrite(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm">
      <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center">
              <Camera className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black">Bulk Student Photo Match (Excel / Admission No)</h3>
              <p className="text-[11px] text-slate-300">
                Upload JPG/JPEG/PNG student photos named by Admission Number or Student ID (e.g. <code>SRN-2026-001.jpg</code>).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Upload Dropzone */}
          <label className="flex flex-col items-center justify-center gap-2 p-6 rounded-2xl border-2 border-dashed border-indigo-300 bg-indigo-50/50 hover:bg-indigo-50 cursor-pointer transition-colors text-center">
            <Upload className="w-7 h-7 text-indigo-600" />
            <div>
              <p className="font-extrabold text-slate-900 text-sm">
                {isLoading ? 'Processing & matching photographs...' : 'Select Student Photographs (JPG, JPEG, PNG)'}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Multiple files supported • Filenames are automatically matched to Student Admission Numbers or IDs without altering any student names or records.
              </p>
            </div>
            <input
              type="file"
              accept="image/jpeg,image/jpg,image/png"
              multiple
              onChange={handleSelectFiles}
              className="hidden"
            />
          </label>

          {/* Summary Badges */}
          {rows.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-xl bg-slate-100 text-slate-800 font-bold">
                Uploaded: {rows.length}
              </span>
              <span className="px-3 py-1 rounded-xl bg-emerald-100 text-emerald-800 font-extrabold">
                Matched: {matchedRows.length}
              </span>
              {unmatchedRows.length > 0 && (
                <span className="px-3 py-1 rounded-xl bg-amber-100 text-amber-900 font-bold">
                  Unmatched: {unmatchedRows.length}
                </span>
              )}
              {overwriteRows.length > 0 && (
                <span className="px-3 py-1 rounded-xl bg-rose-100 text-rose-800 font-extrabold">
                  Existing Photos Affected: {overwriteRows.length}
                </span>
              )}
            </div>
          )}

          {/* Explicit Overwrite Confirmation Warning */}
          {overwriteRows.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 space-y-2">
              <div className="flex items-start gap-2 text-rose-900">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-extrabold">Confirmation Required Before Overwriting Existing Photographs</p>
                  <p className="text-[11px] text-rose-700 mt-0.5">
                    {overwriteRows.length} matched student(s) already have a saved photograph. Existing photos will NOT be replaced unless you explicitly confirm below.
                  </p>
                </div>
              </div>
              <label className="inline-flex items-center gap-2 font-bold text-rose-900 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={confirmOverwrite}
                  onChange={(e) => setConfirmOverwrite(e.target.checked)}
                  className="rounded border-rose-300 text-rose-600 focus:ring-rose-500"
                />
                <span>Yes, replace existing photographs for the {overwriteRows.length} matched student(s)</span>
              </label>
            </div>
          )}

          {/* Matched Preview Grid */}
          {matchedRows.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-black text-slate-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Matched Student Records ({matchedRows.length})</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {matchedRows.map((row) => (
                  <div
                    key={row.fileName}
                    className={`p-2.5 rounded-2xl border flex items-center gap-3 ${
                      row.hasExistingPhoto ? 'bg-rose-50/40 border-rose-200' : 'bg-emerald-50/40 border-emerald-200'
                    }`}
                  >
                    <img
                      src={row.dataUrl}
                      alt={row.fileName}
                      className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-extrabold text-slate-900 truncate">{row.matchedStudent!.fullName}</p>
                      <p className="text-[10px] font-mono text-slate-600">
                        {row.matchedStudent!.admissionNumber} • Class {row.matchedStudent!.classNumber}-{row.matchedStudent!.section}
                      </p>
                      <p className="text-[10px] text-slate-500 truncate">File: {row.fileName}</p>
                      {row.hasExistingPhoto && (
                        <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-bold text-[9px]">
                          Replaces existing photo
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unmatched Files List */}
          {unmatchedRows.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-black text-amber-900 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Unmatched Files ({unmatchedRows.length})</span>
              </h4>
              <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-1">
                {unmatchedRows.map((row) => (
                  <div key={row.fileName} className="flex items-center justify-between text-[11px] text-amber-900">
                    <span className="font-mono font-semibold flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-amber-600" />
                      {row.fileName}
                    </span>
                    <span className="text-amber-700">No student matches &ldquo;{row.baseKey}&rdquo;</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <p className="text-[11px] text-slate-500">
            Photos are linked strictly by Admission No / Student ID. Existing names &amp; academic data remain untouched.
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={matchedRows.length === 0 || (needsOverwriteConfirmation && matchedRows.length === overwriteRows.length)}
              className="px-4 py-2 rounded-xl text-xs font-extrabold bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:text-slate-500 text-white shadow-xs"
            >
              Apply {confirmOverwrite ? matchedRows.length : matchedRows.length - overwriteRows.length} Matched Photo(s)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
