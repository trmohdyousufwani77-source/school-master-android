import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Sparkles,
  Download,
  CheckCircle2,
  Smartphone,
  RefreshCw,
  CloudOff,
  CloudCheck,
  Palette,
  Layers,
  Shield,
  Upload,
  Trash2,
  Eye,
  Edit3,
  Plus,
  Lock,
  X,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

interface SchoolLogoGeneratorPanelProps {
  schoolName: string;
  motto?: string;
  udiseCode?: string;
  currentLogoDataUrl: string;
  onApplyLogo: (dataUrl: string) => void;
  onDeleteLogo?: () => void;
  isAuthorized?: boolean;
}

type LogoDesignStyle = 'royal-shield' | 'circular-crest' | 'academic-diamond' | 'heritage-emblem';
type IconShape = 'circle' | 'squircle' | 'rounded';
type AndroidIconAlias = 'DefaultIcon' | 'EmeraldIcon' | 'GoldCrestIcon';

interface LogoPalette {
  id: string;
  label: string;
  primary: string;
  secondary: string;
  accent: string;
  text: string;
}

const LOGO_PALETTES: LogoPalette[] = [
  { id: 'indigo-gold', label: 'Royal Indigo', primary: '#1e1b4b', secondary: '#312e81', accent: '#f59e0b', text: '#ffffff' },
  { id: 'emerald-gold', label: 'Kashmir Emerald', primary: '#064e3b', secondary: '#047857', accent: '#fbbf24', text: '#ffffff' },
  { id: 'crimson-ivory', label: 'Academic Crimson', primary: '#7f1d1d', secondary: '#991b1b', accent: '#fde68a', text: '#ffffff' },
  { id: 'navy-sky', label: 'Navy & Sky', primary: '#0f172a', secondary: '#1d4ed8', accent: '#38bdf8', text: '#ffffff' },
  { id: 'teal-bronze', label: 'Heritage Teal', primary: '#134e4a', secondary: '#0f766e', accent: '#fcd34d', text: '#ffffff' },
];

const DESIGN_STYLES: { id: LogoDesignStyle; label: string }[] = [
  { id: 'royal-shield', label: 'Royal Shield' },
  { id: 'circular-crest', label: 'Circular Seal' },
  { id: 'academic-diamond', label: 'Modern Crest' },
  { id: 'heritage-emblem', label: 'Heritage Arch' },
];

const ICON_ALIAS_STORAGE_KEY = 'sm_android_icon_alias_v1';
const SYNC_QUEUE_STORAGE_KEY = 'sm_teacher_attendance_sync_queue_v1';
const SYNC_HISTORY_STORAGE_KEY = 'sm_sync_trend_7d_v1';

interface SyncDayPoint {
  dateIso: string;
  dayLabel: string;
  pendingCount: number;
  syncedCount: number;
}

function getSchoolInitials(name: string): string {
  const cleaned = (name || 'School Master')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0 && !['of', 'and', 'the', 'for', 'in'].includes(w.toLowerCase()));
  if (cleaned.length === 0) return 'SM';
  if (cleaned.length === 1) return cleaned[0].slice(0, 3).toUpperCase();
  return cleaned
    .slice(0, 3)
    .map((w) => w[0].toUpperCase())
    .join('');
}

function drawSchoolLogoCanvas(
  canvas: HTMLCanvasElement,
  schoolName: string,
  motto: string,
  design: LogoDesignStyle,
  palette: LogoPalette
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const size = 512;
  canvas.width = size;
  canvas.height = size;
  ctx.clearRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size / 2;
  const initials = getSchoolInitials(schoolName);
  const shortTitle = (schoolName || 'SCHOOL MASTER').toUpperCase().slice(0, 30);
  const shortMotto = (motto || 'KNOWLEDGE • DISCIPLINE • EXCELLENCE').toUpperCase().slice(0, 32);

  // Helper gradient
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, palette.primary);
  grad.addColorStop(1, palette.secondary);

  if (design === 'royal-shield') {
    // Shield silhouette
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, 36);
    ctx.lineTo(size - 64, 88);
    ctx.quadraticCurveTo(size - 60, 290, cx, size - 36);
    ctx.quadraticCurveTo(60, 290, 64, 88);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 14;
    ctx.strokeStyle = palette.accent;
    ctx.stroke();

    // Inner border
    ctx.beginPath();
    ctx.moveTo(cx, 62);
    ctx.lineTo(size - 88, 108);
    ctx.quadraticCurveTo(size - 84, 280, cx, size - 64);
    ctx.quadraticCurveTo(84, 280, 88, 108);
    ctx.closePath();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.stroke();

    // Top open book symbol
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(cx, 128);
    ctx.quadraticCurveTo(cx - 38, 110, cx - 72, 126);
    ctx.lineTo(cx - 72, 166);
    ctx.quadraticCurveTo(cx - 38, 152, cx, 168);
    ctx.quadraticCurveTo(cx + 38, 152, cx + 72, 166);
    ctx.lineTo(cx + 72, 126);
    ctx.quadraticCurveTo(cx + 38, 110, cx, 128);
    ctx.stroke();

    // Monogram
    ctx.fillStyle = palette.text;
    ctx.font = '900 108px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials, cx, 266);

    // Ribbon strip
    ctx.fillStyle = palette.accent;
    ctx.fillRect(98, 332, size - 196, 46);
    ctx.fillStyle = palette.primary;
    ctx.font = '800 18px system-ui, -apple-system, sans-serif';
    ctx.fillText(shortTitle.slice(0, 24), cx, 356);

    // Motto below
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.font = '700 13px system-ui, -apple-system, sans-serif';
    ctx.fillText(shortMotto.slice(0, 22), cx, 408);
    ctx.restore();
  } else if (design === 'circular-crest') {
    ctx.save();
    // Outer ring
    ctx.beginPath();
    ctx.arc(cx, cy, 224, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 14;
    ctx.strokeStyle = palette.accent;
    ctx.stroke();

    // Inner dashed ring
    ctx.beginPath();
    ctx.arc(cx, cy, 184, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.stroke();
    ctx.setLineDash([]);

    // Center badge
    ctx.beginPath();
    ctx.arc(cx, cy, 126, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = palette.accent;
    ctx.stroke();

    // Star top
    ctx.fillStyle = palette.accent;
    ctx.font = '900 30px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★ ★ ★', cx, 104);

    // Initials
    ctx.fillStyle = palette.text;
    ctx.font = '900 104px Georgia, serif';
    ctx.fillText(initials, cx, cy - 6);

    // Title
    ctx.fillStyle = palette.accent;
    ctx.font = '800 19px system-ui, -apple-system, sans-serif';
    ctx.fillText(shortTitle.slice(0, 22), cx, cy + 72);

    // Bottom motto
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '700 14px system-ui, -apple-system, sans-serif';
    ctx.fillText(shortMotto.slice(0, 26), cx, 408);
    ctx.restore();
  } else if (design === 'academic-diamond') {
    ctx.save();
    // Rounded square background rotated 45deg feel -> modern octagon/badge
    ctx.beginPath();
    ctx.roundRect(54, 54, size - 108, size - 108, 72);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 14;
    ctx.strokeStyle = palette.accent;
    ctx.stroke();

    // Diagonal light beam
    ctx.beginPath();
    ctx.moveTo(80, 380);
    ctx.lineTo(380, 80);
    ctx.lineTo(432, 132);
    ctx.lineTo(132, 432);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fill();

    // Top bar
    ctx.fillStyle = palette.accent;
    ctx.beginPath();
    ctx.roundRect(136, 108, size - 272, 34, 17);
    ctx.fill();
    ctx.fillStyle = palette.primary;
    ctx.font = '900 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('OFFICIAL EMBLEM', cx, 125);

    // Monogram
    ctx.fillStyle = palette.text;
    ctx.font = '900 120px system-ui, -apple-system, sans-serif';
    ctx.fillText(initials, cx, 255);

    // Title & motto
    ctx.fillStyle = palette.accent;
    ctx.font = '800 20px system-ui, sans-serif';
    ctx.fillText(shortTitle.slice(0, 24), cx, 356);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.fillText(shortMotto.slice(0, 28), cx, 396);
    ctx.restore();
  } else {
    // Heritage Arch
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(76, 220);
    ctx.arc(cx, 220, 180, Math.PI, 0, false);
    ctx.lineTo(size - 76, size - 60);
    ctx.quadraticCurveTo(cx, size - 28, 76, size - 60);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 14;
    ctx.strokeStyle = palette.accent;
    ctx.stroke();

    // Decorative arch inner
    ctx.beginPath();
    ctx.moveTo(104, 222);
    ctx.arc(cx, 222, 152, Math.PI, 0, false);
    ctx.lineTo(size - 104, size - 84);
    ctx.lineTo(104, size - 84);
    ctx.closePath();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.38)';
    ctx.stroke();

    ctx.fillStyle = palette.accent;
    ctx.font = '900 28px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✦ ESTD. ✦', cx, 146);

    ctx.fillStyle = palette.text;
    ctx.font = '900 112px Georgia, serif';
    ctx.fillText(initials, cx, 256);

    ctx.fillStyle = palette.accent;
    ctx.font = '800 19px system-ui, sans-serif';
    ctx.fillText(shortTitle.slice(0, 24), cx, 356);

    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillText(shortMotto.slice(0, 28), cx, 396);
    ctx.restore();
  }
}

function buildInitial7DayTrend(): SyncDayPoint[] {
  const today = new Date();
  const points: SyncDayPoint[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateIso = d.toISOString().slice(0, 10);
    const dayLabel = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' });
    points.push({
      dateIso,
      dayLabel,
      pendingCount: i === 0 ? 2 : Math.max(0, (i % 3) + (i === 2 ? 2 : 0)),
      syncedCount: 6 + ((6 - i) % 4),
    });
  }
  return points;
}

export const SchoolLogoGeneratorPanel: React.FC<SchoolLogoGeneratorPanelProps> = ({
  schoolName,
  motto,
  currentLogoDataUrl,
  onApplyLogo,
  onDeleteLogo,
  isAuthorized = true,
}) => {
  const logoCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const [designStyle, setDesignStyle] = useState<LogoDesignStyle>('royal-shield');
  const [paletteId, setPaletteId] = useState<string>('indigo-gold');
  const [generatedPreviewUrl, setGeneratedPreviewUrl] = useState<string>('');
  const [appliedBanner, setAppliedBanner] = useState<string>('');
  const [isCustomizerOpen, setIsCustomizerOpen] = useState<boolean>(false);
  const [isLogoPreviewOpen, setIsLogoPreviewOpen] = useState<boolean>(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState<boolean>(false);

  // Android App Icon Customizer state
  const [iconShape, setIconShape] = useState<IconShape>('squircle');
  const [iconBgColor, setIconBgColor] = useState<string>('#1e1b4b');
  const [iconAlias, setIconAlias] = useState<AndroidIconAlias>(() => {
    try {
      const saved = localStorage.getItem(ICON_ALIAS_STORAGE_KEY) as AndroidIconAlias | null;
      return saved || 'DefaultIcon';
    } catch {
      return 'DefaultIcon';
    }
  });

  // Sync Status Dashboard + 7-day trend state
  const [syncTrend, setSyncTrend] = useState<SyncDayPoint[]>(() => {
    try {
      const raw = localStorage.getItem(SYNC_HISTORY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SyncDayPoint[];
        if (Array.isArray(parsed) && parsed.length === 7) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return buildInitial7DayTrend();
  });
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string>(() =>
    new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  );

  const selectedPalette = useMemo(
    () => LOGO_PALETTES.find((p) => p.id === paletteId) || LOGO_PALETTES[0],
    [paletteId]
  );

  // Only render generator draft canvas when authorized user explicitly opens the customizer.
  // Never auto-regenerate or overwrite the centrally managed Official School Logo.
  useEffect(() => {
    if (!isCustomizerOpen || !logoCanvasRef.current) return;
    drawSchoolLogoCanvas(logoCanvasRef.current, schoolName, motto || '', designStyle, selectedPalette);
    try {
      setGeneratedPreviewUrl(logoCanvasRef.current.toDataURL('image/png'));
    } catch {
      // ignore
    }
  }, [isCustomizerOpen, schoolName, motto, designStyle, selectedPalette]);

  // Displayed logo always reflects the exact centrally managed Official School Logo when saved
  const displayedOfficialLogo = currentLogoDataUrl || (isCustomizerOpen ? generatedPreviewUrl : '');
  const activeLauncherLogo = currentLogoDataUrl || generatedPreviewUrl;
  const pendingRecordsToday = syncTrend[syncTrend.length - 1]?.pendingCount ?? 0;
  const totalPendingWeek = syncTrend.reduce((acc, item) => acc + item.pendingCount, 0);

  const handleApplyGeneratedLogo = () => {
    if (!isAuthorized || !generatedPreviewUrl) return;
    onApplyLogo(generatedPreviewUrl);
    setIsCustomizerOpen(false);
    setAppliedBanner('Official School Logo saved & synced across all modules.');
    setTimeout(() => setAppliedBanner(''), 3500);
  };

  const handleUploadSyncedLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAuthorized) return;
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setAppliedBanner('Please select an image smaller than 2 MB.');
      setTimeout(() => setAppliedBanner(''), 3500);
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      const result = evt.target?.result;
      if (typeof result === 'string') {
        onApplyLogo(result);
        setIsCustomizerOpen(false);
        setAppliedBanner('Official School Logo saved & synced identically here.');
        setTimeout(() => setAppliedBanner(''), 3500);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleDeleteSyncedLogo = () => {
    if (!isAuthorized) return;
    if (onDeleteLogo) {
      onDeleteLogo();
    } else {
      onApplyLogo('');
    }
    setConfirmDeleteOpen(false);
    setAppliedBanner('Official School Logo deleted.');
    setTimeout(() => setAppliedBanner(''), 3500);
  };

  const handleDownloadDisplayedLogo = () => {
    const src = isCustomizerOpen && generatedPreviewUrl ? generatedPreviewUrl : currentLogoDataUrl;
    if (!src) return;
    const link = document.createElement('a');
    link.href = src;
    const safeName = (schoolName || 'Official_School_Logo').replace(/[^a-zA-Z0-9_-]/g, '_');
    link.download = `${safeName}_Official_Logo.png`;
    link.click();
  };

  const handleDownloadAndroidIcon = () => {
    const outCanvas = document.createElement('canvas');
    outCanvas.width = 512;
    outCanvas.height = 512;
    const ctx = outCanvas.getContext('2d');
    if (!ctx) return;

    // Shape clip
    ctx.save();
    ctx.beginPath();
    if (iconShape === 'circle') {
      ctx.arc(256, 256, 248, 0, Math.PI * 2);
    } else if (iconShape === 'squircle') {
      ctx.roundRect(12, 12, 488, 488, 128);
    } else {
      ctx.roundRect(12, 12, 488, 488, 72);
    }
    ctx.closePath();
    ctx.clip();

    ctx.fillStyle = iconBgColor;
    ctx.fillRect(0, 0, 512, 512);

    const finalize = () => {
      ctx.restore();
      const link = document.createElement('a');
      link.href = outCanvas.toDataURL('image/png');
      link.download = `ic_launcher_${iconAlias}_512.png`;
      link.click();
    };

    if (activeLauncherLogo) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        ctx.drawImage(img, 56, 56, 400, 400);
        finalize();
      };
      img.onerror = finalize;
      img.src = activeLauncherLogo;
    } else {
      finalize();
    }
  };

  const handleSelectAndroidAlias = (alias: AndroidIconAlias) => {
    setIconAlias(alias);
    try {
      localStorage.setItem(ICON_ALIAS_STORAGE_KEY, alias);
      const bridge = (window as unknown as { AndroidBridge?: { setLauncherIconAlias?: (a: string) => void } })
        .AndroidBridge;
      bridge?.setLauncherIconAlias?.(alias);
    } catch {
      // ignore
    }
  };

  const handleSimulateAddPending = () => {
    setSyncTrend((prev) => {
      const next = prev.map((pt, idx) =>
        idx === prev.length - 1 ? { ...pt, pendingCount: pt.pendingCount + 1 } : pt
      );
      try {
        localStorage.setItem(SYNC_HISTORY_STORAGE_KEY, JSON.stringify(next));
        localStorage.setItem(SYNC_QUEUE_STORAGE_KEY, JSON.stringify({ pending: next[next.length - 1].pendingCount }));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleTriggerSync = () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setTimeout(() => {
      setSyncTrend((prev) => {
        const next = prev.map((pt, idx) =>
          idx === prev.length - 1
            ? { ...pt, syncedCount: pt.syncedCount + pt.pendingCount, pendingCount: 0 }
            : pt
        );
        try {
          localStorage.setItem(SYNC_HISTORY_STORAGE_KEY, JSON.stringify(next));
          localStorage.setItem(SYNC_QUEUE_STORAGE_KEY, JSON.stringify({ pending: 0 }));
        } catch {
          // ignore
        }
        return next;
      });
      setLastSyncedAt(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
      setIsSyncing(false);
    }, 1100);
  };

  return (
    <div className="space-y-5 mt-5">
      {/* 1. Automatic School Logo Generator (Synced Identically with Official School Logo) */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50/80 via-white to-amber-50/50 border border-indigo-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-black text-slate-900 text-sm">Automatic School Logo Generator</h4>
              <p className="text-[11px] text-slate-500">
                Displays the exact centrally saved Official School Logo without automatic regeneration or alteration.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {currentLogoDataUrl && !isCustomizerOpen && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[11px]">
                <Lock className="w-3 h-3" />
                <span>Synced with Official Logo</span>
              </span>
            )}
            {appliedBanner && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-[11px]">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {appliedBanner}
              </span>
            )}
          </div>
        </div>

        <input
          ref={uploadInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={handleUploadSyncedLogo}
        />

        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
          {/* Synced Official Logo Preview Box */}
          <div className="md:col-span-4 flex flex-col items-center gap-3 p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
            <div className="w-40 h-40 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center overflow-hidden p-2">
              {isCustomizerOpen ? (
                <canvas
                  ref={logoCanvasRef}
                  className="w-full h-full rounded-xl object-contain"
                  aria-label="Draft generated logo preview"
                />
              ) : displayedOfficialLogo ? (
                <img
                  src={displayedOfficialLogo}
                  alt="Official School Logo"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-center text-slate-400 space-y-1.5 px-2">
                  <Shield className="w-9 h-9 mx-auto text-slate-300" />
                  <p className="text-[11px] font-semibold">No Official Logo Saved</p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-1.5 w-full">
              {isAuthorized ? (
                <>
                  <button
                    type="button"
                    onClick={() => uploadInputRef.current?.click()}
                    className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] shadow-xs transition-colors"
                  >
                    {currentLogoDataUrl ? <Edit3 className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                    <span>{currentLogoDataUrl ? 'Edit' : 'Add'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsLogoPreviewOpen(true)}
                    disabled={!displayedOfficialLogo}
                    className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-800 font-bold text-[11px] border border-slate-200 transition-colors"
                  >
                    <Eye className="w-3 h-3" />
                    <span>Preview</span>
                  </button>
                  {currentLogoDataUrl && (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteOpen(true)}
                      className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] border border-rose-200 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Delete</span>
                    </button>
                  )}
                </>
              ) : (
                <span className="text-[11px] font-semibold text-slate-500">View Only (Authorized Admins Only)</span>
              )}
              {displayedOfficialLogo && (
                <button
                  type="button"
                  onClick={handleDownloadDisplayedLogo}
                  className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] border border-slate-200 transition-colors"
                  title="Download PNG"
                >
                  <Download className="w-3 h-3" />
                  <span>PNG</span>
                </button>
              )}
            </div>

            {confirmDeleteOpen && isAuthorized && (
              <div className="w-full p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-center space-y-2">
                <p className="text-[11px] font-bold text-rose-800">Delete Official School Logo?</p>
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={handleDeleteSyncedLogo}
                    className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px]"
                  >
                    Confirm Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteOpen(false)}
                    className="px-2.5 py-1 rounded-lg bg-white text-slate-700 border border-slate-200 font-bold text-[11px]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel: Sync Status + Optional Manual Customizer */}
          <div className="md:col-span-8 space-y-4">
            {!isCustomizerOpen ? (
              <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-extrabold text-slate-900">
                      Centralized Official School Logo Sync Active
                    </p>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                      Your saved Official School Logo is automatically mirrored across the School Master Widget, Smart ID Cards, Holistic Progress Cards, and this panel without auto-regeneration.
                    </p>
                  </div>
                  {isAuthorized && (
                    <button
                      type="button"
                      onClick={() => setIsCustomizerOpen(true)}
                      className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs transition-colors"
                    >
                      <Palette className="w-3.5 h-3.5" />
                      <span>Design Custom Logo</span>
                    </button>
                  )}
                </div>

                {isAuthorized && (
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => uploadInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{currentLogoDataUrl ? 'Replace Official Logo' : 'Add Official Logo'}</span>
                    </button>
                    {currentLogoDataUrl && (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Logo</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-[11px] font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-600" />
                    <span>1. Select Layout Style</span>
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {DESIGN_STYLES.map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setDesignStyle(st.id)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                          designStyle === st.id
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-[11px] font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-amber-600" />
                    <span>2. Select Color Theme</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {LOGO_PALETTES.map((pal) => (
                      <button
                        key={pal.id}
                        type="button"
                        onClick={() => setPaletteId(pal.id)}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                          paletteId === pal.id
                            ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-white/60 shrink-0"
                          style={{ background: `linear-gradient(135deg, ${pal.primary}, ${pal.accent})` }}
                        />
                        <span>{pal.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/70">
                  <button
                    type="button"
                    onClick={handleApplyGeneratedLogo}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Save &amp; Apply Official Logo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCustomizerOpen(false)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-200"
                  >
                    <span>Cancel (Keep Saved Official Logo)</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Fullscreen Official Logo Preview Modal */}
        {isLogoPreviewOpen && displayedOfficialLogo && (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-sm w-full p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h5 className="font-black text-slate-900 text-sm">Official School Logo Preview</h5>
                <button
                  type="button"
                  onClick={() => setIsLogoPreviewOpen(false)}
                  className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="aspect-square rounded-2xl bg-slate-50 border border-slate-200 p-6 flex items-center justify-center">
                <img
                  src={displayedOfficialLogo}
                  alt="Official School Logo Preview"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleDownloadDisplayedLogo}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PNG</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsLogoPreviewOpen(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. Android App Icon Customizer + Sync Status Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Android App Icon Customizer */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-black text-slate-900 text-sm">Android App Icon Customizer</h4>
              <p className="text-[11px] text-slate-500">
                Preview &amp; export adaptive Android launcher icons using your school emblem.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <div
              className={`w-20 h-20 flex items-center justify-center p-2.5 shadow-md shrink-0 transition-all ${
                iconShape === 'circle'
                  ? 'rounded-full'
                  : iconShape === 'squircle'
                  ? 'rounded-[22px]'
                  : 'rounded-xl'
              }`}
              style={{ backgroundColor: iconBgColor }}
            >
              {activeLauncherLogo ? (
                <img src={activeLauncherLogo} alt="Android Launcher Preview" className="w-full h-full object-contain" />
              ) : (
                <Shield className="w-9 h-9 text-amber-300" />
              )}
            </div>
            <div className="space-y-2 flex-1 min-w-0">
              <div className="flex flex-wrap gap-1.5">
                {(['squircle', 'circle', 'rounded'] as IconShape[]).map((sh) => (
                  <button
                    key={sh}
                    type="button"
                    onClick={() => setIconShape(sh)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold capitalize border ${
                      iconShape === sh
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    {sh}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-600">Bg:</span>
                {['#1e1b4b', '#064e3b', '#7f1d1d', '#0f172a', '#ffffff'].map((bg) => (
                  <button
                    key={bg}
                    type="button"
                    onClick={() => setIconBgColor(bg)}
                    className={`w-5 h-5 rounded-full border-2 ${
                      iconBgColor === bg ? 'border-indigo-500 scale-110' : 'border-slate-300'
                    }`}
                    style={{ backgroundColor: bg }}
                    title={`Background ${bg}`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-bold text-slate-700">Native Android Launcher Alias:</p>
            <div className="grid grid-cols-3 gap-2">
              {([
                { id: 'DefaultIcon', label: 'Classic Indigo' },
                { id: 'EmeraldIcon', label: 'Emerald Crest' },
                { id: 'GoldCrestIcon', label: 'Gold Heritage' },
              ] as { id: AndroidIconAlias; label: string }[]).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelectAndroidAlias(opt.id)}
                  className={`px-2.5 py-2 rounded-xl text-[11px] font-bold border transition-all ${
                    iconAlias === opt.id
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleDownloadAndroidIcon}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Download Adaptive Android Icon (512×512 PNG)</span>
          </button>
        </div>

        {/* Sync Status Dashboard & 7-Day Trend Chart */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-xs ${
                  isSyncing
                    ? 'bg-indigo-600 text-white'
                    : pendingRecordsToday > 0
                    ? 'bg-amber-500 text-white'
                    : 'bg-emerald-600 text-white'
                }`}
              >
                {isSyncing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : pendingRecordsToday > 0 ? (
                  <CloudOff className="w-4 h-4" />
                ) : (
                  <CloudCheck className="w-4 h-4" />
                )}
              </div>
              <div>
                <h4 className="font-black text-slate-900 text-sm">Sync Status Dashboard</h4>
                <p className="text-[11px] text-slate-500">
                  Teacher Attendance offline queue • Last synced {lastSyncedAt}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleSimulateAddPending}
                className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] border border-slate-200"
                title="Queue an offline attendance entry"
              >
                + Queue
              </button>
              <button
                type="button"
                onClick={handleTriggerSync}
                disabled={isSyncing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold text-xs shadow-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
              </button>
            </div>
          </div>

          {/* Summary KPI Row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Pending Today</p>
              <p className="text-xl font-black text-amber-900 mt-0.5">{pendingRecordsToday}</p>
            </div>
            <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200/80">
              <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">7-Day Pending Total</p>
              <p className="text-xl font-black text-indigo-900 mt-0.5">{totalPendingWeek}</p>
            </div>
          </div>

          {/* Recharts 7-Day Trend LineChart */}
          <div className="h-44 w-full bg-slate-50/70 rounded-xl border border-slate-200/80 p-2">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2 mb-1">
              Pending Sync Records — Last 7 Days
            </p>
            <ResponsiveContainer width="100%" height="84%">
              <LineChart data={syncTrend} margin={{ top: 6, right: 12, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="dayLabel" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid #cbd5e1',
                    fontSize: '11px',
                    fontWeight: 700,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="pendingCount"
                  name="Pending Sync"
                  stroke="#4f46e5"
                  strokeWidth={2.5}
                  dot={{ r: 3.5, fill: '#4f46e5' }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
