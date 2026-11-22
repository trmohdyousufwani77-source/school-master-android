import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileCode2,
  FileWarning,
  Layers,
  Plus,
  Sparkles,
  X,
} from 'lucide-react';
import {
  buildNooriGlyphMetricsReport,
  formatUnicodeHexSequence,
  MissingLigatureReport,
  runLigatureBatchScan,
} from '../utils/urduTypography';
import { syncLigatureReportToFirestore } from '../firebase';

interface NooriFontToolsPanelProps {
  sampleText: string;
  documentSources: { source: string; text: string }[];
  fontSizePx: number;
  lineHeight: number;
  kernOptimize: boolean;
  highContrast: boolean;
  onEnableKernOptimize: () => void;
  onApplyRecommendedMetrics?: (opts: { kernOptimize: boolean; lineHeight: number }) => void;
  showBatchScan: boolean;
  onCloseBatchScan: () => void;
  showFontAssetsManager: boolean;
  onCloseFontAssetsManager: () => void;
  variant?: 'dark' | 'light';
}

const MISSING_LIGATURE_STORAGE_KEY = 'sm_missing_ligature_reports_v1';

export const NooriFontToolsPanel: React.FC<NooriFontToolsPanelProps> = ({
  sampleText,
  documentSources,
  fontSizePx,
  lineHeight,
  kernOptimize,
  highContrast,
  onEnableKernOptimize,
  onApplyRecommendedMetrics,
  showBatchScan,
  onCloseBatchScan,
  showFontAssetsManager,
  onCloseFontAssetsManager,
  variant = 'dark',
}) => {
  const [missingReports, setMissingReports] = useState<MissingLigatureReport[]>(() => {
    try {
      const raw = localStorage.getItem(MISSING_LIGATURE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  });

  const [reportWord, setReportWord] = useState<string>('');
  const [reportIssueType, setReportIssueType] = useState<MissingLigatureReport['issueType']>('Missing Glyph');
  const [reportNotes, setReportNotes] = useState<string>('');
  const [reportStatusMsg, setReportStatusMsg] = useState<string | null>(null);

  const batchResult = useMemo(
    () => runLigatureBatchScan(documentSources),
    [documentSources]
  );

  const metricsReport = useMemo(
    () =>
      buildNooriGlyphMetricsReport({
        sampleText,
        fontSizePx,
        lineHeight,
        kernOptimize,
        highContrast,
        missingReports,
      }),
    [sampleText, fontSizePx, lineHeight, kernOptimize, highContrast, missingReports]
  );

  const saveReports = (next: MissingLigatureReport[]) => {
    setMissingReports(next);
    localStorage.setItem(MISSING_LIGATURE_STORAGE_KEY, JSON.stringify(next));
  };

  const handleDownloadMetricsJson = () => {
    const blob = new Blob([JSON.stringify(metricsReport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NooriNastaleeq_GlyphMetrics_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setReportStatusMsg('Downloaded Noori Nastaleeq glyph metrics (.json).');
  };

  const handleDownloadMetricsCsv = () => {
    const header = ['Index', 'Ligature', 'Unicode Sequence', 'Glyph Length', 'Overlap Risk', 'Recommended CSS'];
    const rows = metricsReport.glyphLigatureTable.map((g) => [
      String(g.index),
      g.ligature,
      g.unicodeSequence,
      String(g.glyphLength),
      g.overlapRisk ? 'High Risk' : 'Nominal',
      g.recommendedCss,
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NooriNastaleeq_GlyphMetrics_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setReportStatusMsg('Downloaded Noori Nastaleeq glyph metrics (.csv).');
  };

  const handleSubmitMissingLigature = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = reportWord.trim();
    if (!cleaned) return;

    const newReport: MissingLigatureReport = {
      id: `lig_${Date.now()}`,
      word: cleaned,
      unicodeHex: formatUnicodeHexSequence(cleaned),
      issueType: reportIssueType,
      notes: reportNotes.trim() || 'Submitted via Noori Nastaleeq Font Assets Manager.',
      createdAt: new Date().toISOString(),
    };

    const next = [newReport, ...missingReports];
    saveReports(next);
    setReportWord('');
    setReportNotes('');
    setReportStatusMsg(`Reported "${newReport.word}" (${newReport.unicodeHex}) for manual @font-face optimization.`);
    try {
      await syncLigatureReportToFirestore(newReport);
    } catch {
      // Firestore optional if user not signed in
    }
  };

  const surfaceCls =
    variant === 'dark'
      ? 'bg-slate-950/90 border-slate-700 text-slate-100'
      : 'bg-white border-slate-300 text-slate-900 shadow-sm';

  return (
    <div data-noori-ui="true" dir="ltr" className="no-print space-y-2.5 font-sans text-xs">
      {/* 1. Ligature Inspector: Batch Scan Top 5 Overlapping Regions */}
      {showBatchScan && (
        <div className={`rounded-xl border p-3.5 space-y-3 ${surfaceCls}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="font-bold text-sm">
                Ligature Inspector Batch Scan — Top 5 Overlapping Regions
              </span>
              <span className="text-[11px] opacity-75">
                ({batchResult.totalDocumentsScanned} sections · {batchResult.totalUrduWordsScanned} Urdu words)
              </span>
            </div>
            <button
              type="button"
              onClick={onCloseBatchScan}
              className="p-1 rounded-lg hover:bg-white/10"
              aria-label="Close Batch Scan"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {batchResult.top5Hotspots.length === 0 ? (
            <p className="text-xs opacity-80">No overlapping ligature clusters detected across the active document.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {batchResult.top5Hotspots.map((spot) => (
                <div
                  key={`${spot.rank}-${spot.region}`}
                  className={`rounded-lg border p-2.5 space-y-1.5 ${
                    variant === 'dark'
                      ? 'bg-white/5 border-amber-400/35'
                      : 'bg-amber-50/70 border-amber-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-amber-500">
                      #{spot.rank} Hotspot · {spot.frequency}x hits
                    </span>
                    <span className="font-noori text-base font-bold px-2 py-0.5 rounded bg-yellow-200 text-slate-950" dir="rtl">
                      {spot.region}
                    </span>
                  </div>
                  <div className="text-[11px] opacity-90">
                    Words:{' '}
                    <span className="font-noori font-bold text-sm" dir="rtl">
                      {spot.sampleWords.join(' ، ')}
                    </span>
                  </div>
                  <p className="text-[11px] opacity-80 leading-snug">{spot.reason}</p>
                  <div className="pt-1 border-t border-white/10 flex flex-wrap items-center justify-between gap-1.5">
                    <code className="text-[10px] font-mono text-emerald-400">
                      {spot.suggestedKernSetting} · lh {spot.recommendedLineHeight.toFixed(1)}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        if (onApplyRecommendedMetrics) {
                          onApplyRecommendedMetrics({
                            kernOptimize: true,
                            lineHeight: spot.recommendedLineHeight,
                          });
                        } else {
                          onEnableKernOptimize();
                        }
                      }}
                      className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold cursor-pointer"
                    >
                      Apply Kern Fix
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2. Font Assets Manager Drawer */}
      {showFontAssetsManager && (
        <div className={`rounded-xl border p-3.5 space-y-3 ${surfaceCls}`}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
            <div className="flex items-center gap-2">
              <FileCode2 className="w-4 h-4 text-sky-400 shrink-0" />
              <div>
                <h4 className="font-bold text-sm">Noori Nastaleeq Font Assets Manager</h4>
                <p className="text-[11px] opacity-75">
                  Download glyph &amp; OpenType kern metrics or report missing ligature sets for font-face tuning.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={handleDownloadMetricsJson}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Metrics (.JSON)</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadMetricsCsv}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Glyph Table (.CSV)</span>
              </button>
              <button
                type="button"
                onClick={onCloseFontAssetsManager}
                className="p-1 rounded-lg hover:bg-white/10"
                aria-label="Close Font Assets Manager"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {reportStatusMsg && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/20 border border-emerald-400/50 text-emerald-200 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{reportStatusMsg}</span>
            </div>
          )}

          {/* Active FontFace Telemetry */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            <div className="p-2 rounded-lg bg-white/5 border border-white/10">
              <span className="opacity-70 block">Active Family</span>
              <span className="font-bold">Noori Nastaleeq</span>
            </div>
            <div className="p-2 rounded-lg bg-white/5 border border-white/10">
              <span className="opacity-70 block">Tracked Ligatures</span>
              <span className="font-mono font-bold tabular-nums">{metricsReport.glyphLigatureTable.length}</span>
            </div>
            <div className="p-2 rounded-lg bg-white/5 border border-white/10">
              <span className="opacity-70 block">Cascade Depth</span>
              <span className="font-mono font-bold tabular-nums">{metricsReport.documentMetrics.maxCascadeDepthTiers} tiers</span>
            </div>
            <div className="p-2 rounded-lg bg-white/5 border border-white/10">
              <span className="opacity-70 block">Active Kerning</span>
              <span className="font-mono font-bold">{metricsReport.activeConfiguration.fontFeatureSettings}</span>
            </div>
          </div>

          {/* Report Missing Ligature Set Form */}
          <form onSubmit={handleSubmitMissingLigature} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end pt-1">
            <div className="sm:col-span-3">
              <label className="block text-[11px] font-semibold mb-1">Urdu Word / Ligature</label>
              <input
                type="text"
                dir="rtl"
                value={reportWord}
                onChange={(e) => setReportWord(e.target.value)}
                placeholder="مثال: گورنمنٹ"
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm font-noori"
                required
              />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-[11px] font-semibold mb-1">Issue Type</label>
              <select
                value={reportIssueType}
                onChange={(e) => setReportIssueType(e.target.value as MissingLigatureReport['issueType'])}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-600 text-white text-xs"
              >
                <option value="Missing Glyph">Missing Glyph</option>
                <option value="Overlapping Nuqta">Overlapping Nuqta</option>
                <option value="Broken Join">Broken Join</option>
                <option value="Spacing Anomaly">Spacing Anomaly</option>
              </select>
            </div>
            <div className="sm:col-span-4">
              <label className="block text-[11px] font-semibold mb-1">
                Optimization Notes {reportWord.trim() ? `(${formatUnicodeHexSequence(reportWord)})` : ''}
              </label>
              <input
                type="text"
                value={reportNotes}
                onChange={(e) => setReportNotes(e.target.value)}
                placeholder="e.g., Noon-Meem join clips at 18px"
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-600 text-white text-xs"
              />
            </div>
            <div className="sm:col-span-2">
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Report</span>
              </button>
            </div>
          </form>

          {missingReports.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <div className="text-[11px] font-bold flex items-center gap-1.5 text-amber-400">
                <FileWarning className="w-3.5 h-3.5" />
                <span>Submitted Missing Ligature Reports ({missingReports.length})</span>
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                {missingReports.map((rep) => (
                  <div
                    key={rep.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 rounded bg-white/5 border border-white/10 text-[11px]"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-noori font-bold text-sm text-amber-300" dir="rtl">{rep.word}</span>
                      <span className="font-mono text-[10px] opacity-75">{rep.unicodeHex}</span>
                    </div>
                    <div className="flex items-center gap-2 opacity-85">
                      <span className="font-semibold text-rose-300">{rep.issueType}</span>
                      <span>·</span>
                      <span className="truncate max-w-[200px]">{rep.notes}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
