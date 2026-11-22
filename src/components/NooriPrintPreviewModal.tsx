import React, { useState } from 'react';
import { FileText, Printer, X } from 'lucide-react';
import { SchoolProfile } from '../types';
import { formatSchoolAddressOnce } from '../utils/calculations';

export function extractUrduFromNooriContainer(
  containerEl: HTMLElement | null,
  fallbackTitle = ''
): { title: string; blocks: string[] } {
  const collectedBlocks: string[] = [];
  const blockTags = new Set([
    'DIV', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'SECTION', 'ARTICLE', 'LI', 'BLOCKQUOTE', 'BR',
  ]);

  const collectBlockLines = (node: Node, currentChunks: string[]) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const txt = (node.textContent || '').replace(/\s+/g, ' ');
      if (txt.trim()) currentChunks.push(txt);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const isBlock = blockTags.has(el.tagName);
    if (isBlock && currentChunks.length > 0) {
      const joined = currentChunks.join('').replace(/\s+/g, ' ').trim();
      if (joined && /[\u0600-\u06FF]/.test(joined) && !collectedBlocks.includes(joined)) {
        collectedBlocks.push(joined);
      }
      currentChunks.length = 0;
    }
    el.childNodes.forEach((child) => collectBlockLines(child, currentChunks));
    if (isBlock && currentChunks.length > 0) {
      const joined = currentChunks.join('').replace(/\s+/g, ' ').trim();
      if (joined && /[\u0600-\u06FF]/.test(joined) && !collectedBlocks.includes(joined)) {
        collectedBlocks.push(joined);
      }
      currentChunks.length = 0;
    }
  };

  if (containerEl) {
    const clone = containerEl.cloneNode(true) as HTMLElement;
    // Strip all non-printable UI elements, buttons, controls, and icons
    clone
      .querySelectorAll(
        '.no-print, [data-noori-controls="true"], [data-noori-ui="true"], button, input, select, textarea, kbd, svg, [aria-hidden="true"]'
      )
      .forEach((el) => el.remove());

    const trailingChunks: string[] = [];
    collectBlockLines(clone, trailingChunks);
    if (trailingChunks.length > 0) {
      const last = trailingChunks.join('').replace(/\s+/g, ' ').trim();
      if (last && /[\u0600-\u06FF]/.test(last) && !collectedBlocks.includes(last)) {
        collectedBlocks.push(last);
      }
    }
  }

  return {
    title: collectedBlocks[0] || fallbackTitle,
    blocks: collectedBlocks.slice(1),
  };
}

interface NooriPrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  school: SchoolProfile;
  extractedTitle: string;
  extractedBlocks: string[];
  kernOptimize: boolean;
}

export const NooriPrintPreviewModal: React.FC<NooriPrintPreviewModalProps> = ({
  isOpen,
  onClose,
  school,
  extractedTitle,
  extractedBlocks,
  kernOptimize,
}) => {
  const [docType, setDocType] = useState<'notice' | 'certificate'>('notice');
  const [customBody, setCustomBody] = useState<string>(
    'بخدمت والدین و سرپرستانِ طلباء: مطلع کیا جاتا ہے کہ اسکول کے تعلیمی و غیر نصابی پروگرام حسبِ معمول جاری ہیں۔ براہِ کرم طلباء کی باقاعدہ حاضری یقینی بنائیں۔'
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex flex-col p-4 sm:p-6 overflow-y-auto text-slate-900">
      {/* Control Header (stripped on print) */}
      <div className="max-w-4xl mx-auto w-full flex flex-wrap items-center justify-between gap-3 bg-slate-900 text-white px-5 py-3.5 rounded-2xl border border-slate-700 mb-4 no-print">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-emerald-400" />
          <div>
            <h3 className="text-sm font-extrabold">A4 Print-Friendly Layout Preview</h3>
            <p className="text-[11px] text-slate-400">
              Extracted from .font-noori container with non-printable UI elements stripped
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700 text-xs font-bold">
            <button
              type="button"
              onClick={() => setDocType('notice')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                docType === 'notice' ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:text-white'
              }`}
            >
              Official Notice
            </button>
            <button
              type="button"
              onClick={() => setDocType('certificate')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                docType === 'certificate' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'
              }`}
            >
              Certificate
            </button>
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print A4 Document</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-200 transition-colors"
            title="Close Print Preview"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Custom Body Input (no-print) */}
      <div className="max-w-4xl mx-auto w-full mb-4 bg-white rounded-2xl p-3 border border-slate-200 no-print">
        <label className="block text-[11px] font-bold text-slate-600 mb-1">
          Edit Official Urdu Notice / Certificate Text (RTL):
        </label>
        <textarea
          dir="rtl"
          rows={2}
          value={customBody}
          onChange={(e) => setCustomBody(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-xl font-noori text-base text-slate-900 bg-slate-50"
        />
      </div>

      {/* A4 Vertical Document Preview */}
      <div
        className={`mx-auto bg-white text-slate-900 shadow-2xl printable-card flex flex-col justify-between ${
          docType === 'certificate' ? 'border-[10px] border-double border-emerald-800' : 'border border-slate-300'
        }`}
        style={{
          width: '210mm',
          minHeight: '297mm',
          maxWidth: '100%',
          padding: '20mm 18mm',
        }}
      >
        <div className="space-y-4">
          <div className="text-center border-b-2 border-slate-900 pb-4 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-600">
              DEPARTMENT OF SCHOOL EDUCATION &bull; JAMMU &amp; KASHMIR
            </p>
            <h1
              dir="rtl"
              className={`font-noori ${kernOptimize ? 'kern-optimize' : ''} text-3xl sm:text-4xl font-bold text-slate-950 leading-loose py-2`}
            >
              {extractedTitle}
            </h1>
            <h2 className="text-base font-extrabold uppercase tracking-wide text-slate-900">
              {school.name}
            </h2>
            <p className="text-xs text-slate-600">
              {formatSchoolAddressOnce(school)} &bull; U-DISE: {school.code}
            </p>
          </div>

          <div className="flex items-center justify-between text-xs font-mono text-slate-700 border-b border-slate-200 pb-2">
            <span>Ref No: {school.code}/2026/______</span>
            <span>Date: {new Date().toLocaleDateString('en-IN')}</span>
          </div>

          <div className="text-center py-4">
            <span
              dir="rtl"
              className={`font-noori ${kernOptimize ? 'kern-optimize' : ''} inline-block px-6 py-2 rounded-lg border-2 border-slate-800 text-2xl font-bold text-slate-900 bg-slate-50`}
            >
              {docType === 'notice'
                ? 'سرکاری اطلاع نامہ (Official Notice)'
                : 'سندِ فضیلت و تحسین (Certificate)'}
            </span>
          </div>

          <div
            dir="rtl"
            className={`font-noori ${kernOptimize ? 'kern-optimize' : ''} text-xl leading-[2.6] text-right text-slate-900 py-6 px-5 border border-slate-200 rounded-xl bg-slate-50/40 space-y-3`}
          >
            <p>{customBody}</p>
            {extractedBlocks.length > 0 && (
              <div className="pt-3 border-t border-slate-200/80 text-base text-slate-700 space-y-1">
                {extractedBlocks.map((block, idx) => (
                  <p key={idx}>{block}</p>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="pt-12 mt-12 border-t border-slate-300 flex items-end justify-between gap-6">
          <div className="text-xs text-slate-600">
            <p className="font-bold text-slate-800">{school.name}</p>
            <p>Session: {school.academicSession}</p>
          </div>

          <div className="text-center">
            {school.officialStampDataUrl && (
              <img
                src={school.officialStampDataUrl}
                alt="Official Stamp"
                className="h-16 w-auto mx-auto mb-1 object-contain"
              />
            )}
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Official School Seal
            </span>
          </div>

          <div className="text-center min-w-[180px]">
            {school.headmasterSignatureDataUrl && (
              <img
                src={school.headmasterSignatureDataUrl}
                alt="Headmaster Signature"
                className="h-12 w-auto mx-auto mb-1 object-contain"
              />
            )}
            <div className="border-t border-slate-800 pt-1">
              <p className="text-xs font-bold text-slate-900">
                {school.headmasterName || school.headTeacherName || 'Mohd Yousuf Wani'}
              </p>
              <p className="text-[10px] text-slate-600">
                {school.principalDesignation || 'Headmaster'} / Admin
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
