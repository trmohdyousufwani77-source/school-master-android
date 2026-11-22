import React, { useState } from 'react';
import {
  Smartphone,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import {
  OFFICIAL_APK_FILENAME,
  OFFICIAL_APK_MIN_ANDROID,
  OFFICIAL_APK_VERSION,
  downloadAndroidApkWithProgress,
} from '../utils/apkDownloader';

interface AndroidAppDownloadCardProps {
  variant?: 'dashboard' | 'compact' | 'login';
  className?: string;
}

export const AndroidAppDownloadCard: React.FC<AndroidAppDownloadCardProps> = ({
  variant = 'dashboard',
  className = '',
}) => {
  const [status, setStatus] = useState<'idle' | 'downloading' | 'success' | 'error'>('idle');
  const [progressPct, setProgressPct] = useState<number>(0);
  const [loadedText, setLoadedText] = useState<string>('');
  const [downloadedSize, setDownloadedSize] = useState<string>('5.8 MB');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState<boolean>(false);

  const handleDownloadApk = async () => {
    if (status === 'downloading') return;
    setStatus('downloading');
    setProgressPct(0);
    setLoadedText('Connecting...');
    setErrorMessage(null);

    const result = await downloadAndroidApkWithProgress(({ loadedBytes, totalBytes, percent }) => {
      if (percent !== null) setProgressPct(percent);
      const loadedMb = (loadedBytes / (1024 * 1024)).toFixed(1);
      const totalMb = totalBytes > 0 ? (totalBytes / (1024 * 1024)).toFixed(1) : '5.8';
      setLoadedText(`${loadedMb} MB / ${totalMb} MB`);
    });

    if (result.success) {
      setStatus('success');
      setProgressPct(100);
      setDownloadedSize(result.sizeMb);
      setShowGuide(true);
    } else {
      setStatus('error');
      setErrorMessage(
        result.errorMessage ||
          'The Android APK download link is currently unavailable. Please try again later.'
      );
    }
  };

  if (variant === 'login') {
    return (
      <div
        className={`w-full rounded-2xl bg-slate-800/80 border border-slate-700/80 p-3.5 text-left space-y-2.5 ${className}`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Smartphone className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-extrabold text-white truncate">Download Android App</p>
              <p className="text-[10px] text-slate-400 truncate">
                Official APK v{OFFICIAL_APK_VERSION} • {OFFICIAL_APK_MIN_ANDROID}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDownloadApk}
            disabled={status === 'downloading'}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-70 text-white font-extrabold text-[11px] shadow-sm transition-all active:scale-95 shrink-0 cursor-pointer"
          >
            {status === 'downloading' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>{status === 'downloading' ? `${progressPct}%` : 'Download App'}</span>
          </button>
        </div>

        {status === 'downloading' && (
          <div className="space-y-1">
            <div className="w-full h-1.5 rounded-full bg-slate-950 overflow-hidden">
              <div
                className="h-full bg-emerald-400 rounded-full transition-all duration-150"
                style={{ width: `${Math.max(8, progressPct)}%` }}
              />
            </div>
            <p className="text-[10px] text-emerald-300 font-mono">
              Downloading {OFFICIAL_APK_FILENAME}... {loadedText}
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="rounded-xl bg-emerald-500/15 border border-emerald-500/30 p-2 text-[11px] text-emerald-200 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">APK Download Started ({downloadedSize})</p>
              <p className="text-[10px] text-emerald-200/90 mt-0.5">
                Open <strong>{OFFICIAL_APK_FILENAME}</strong> from your Downloads folder and enable &ldquo;Install unknown apps&rdquo; if prompted.
              </p>
            </div>
          </div>
        )}

        {status === 'error' && errorMessage && (
          <div className="rounded-xl bg-rose-500/15 border border-rose-500/40 p-2 text-[11px] text-rose-200 flex items-start justify-between gap-2">
            <div className="flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={handleDownloadApk}
              className="text-[10px] font-bold text-white bg-rose-600 hover:bg-rose-500 px-2 py-0.5 rounded-lg shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowGuide((prev) => !prev)}
          className="text-[10px] font-semibold text-slate-400 hover:text-emerald-300 inline-flex items-center gap-1 transition-colors"
        >
          <span>{showGuide ? 'Hide install guide' : 'How to install on Android'}</span>
          {showGuide ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        {showGuide && (
          <ol className="text-[10px] text-slate-300 space-y-1 pl-4 list-decimal border-t border-slate-700/70 pt-2">
            <li>Tap <strong>Download App</strong> above to save the signed APK file.</li>
            <li>Open your notification bar or <strong>Downloads</strong> app and tap the APK.</li>
            <li>If prompted, allow <strong>Install unknown apps</strong> for your browser.</li>
            <li>Tap <strong>Install</strong> and open <strong>School Master</strong>.</li>
          </ol>
        )}
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div
        className={`rounded-2xl bg-slate-50 border border-slate-200 p-3.5 text-left space-y-2 ${className}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0">
              <Smartphone className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-extrabold text-slate-900">Download Android App (APK)</p>
              <p className="text-[11px] text-slate-500">
                Direct install v{OFFICIAL_APK_VERSION} • {OFFICIAL_APK_MIN_ANDROID}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDownloadApk}
            disabled={status === 'downloading'}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-70 text-white font-bold text-xs shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            {status === 'downloading' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>{status === 'downloading' ? `Downloading ${progressPct}%` : 'Download App'}</span>
          </button>
        </div>

        {status === 'downloading' && (
          <div className="space-y-1">
            <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full bg-emerald-600 rounded-full transition-all duration-150"
                style={{ width: `${Math.max(8, progressPct)}%` }}
              />
            </div>
            <p className="text-[10px] text-emerald-700 font-mono">
              Downloading {OFFICIAL_APK_FILENAME} ({loadedText})
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-2 text-[11px] text-emerald-800 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              Download complete ({downloadedSize}). Open <strong>{OFFICIAL_APK_FILENAME}</strong> on your Android phone and allow installing unknown apps if prompted.
            </span>
          </div>
        )}

        {status === 'error' && errorMessage && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 p-2 text-[11px] text-rose-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>
    );
  }

  // Full Dashboard Variant
  return (
    <div
      className={`rounded-2xl bg-slate-800/70 border border-slate-700/80 p-4 space-y-3 ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                Official Android Application
              </p>
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-bold">
                v{OFFICIAL_APK_VERSION}
              </span>
            </div>
            <p className="text-sm font-extrabold text-white mt-0.5">
              Download School Master Android App
            </p>
            <p className="text-[11px] text-slate-300 mt-0.5">
              Direct signed APK • Compatible with {OFFICIAL_APK_MIN_ANDROID}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={handleDownloadApk}
            disabled={status === 'downloading'}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-75 text-white font-extrabold text-xs shadow-md shadow-emerald-600/25 transition-all active:scale-95 cursor-pointer"
          >
            {status === 'downloading' ? (
              <Loader2 className="w-4 h-4 animate-spin text-emerald-100" />
            ) : (
              <Download className="w-4 h-4 text-emerald-100" />
            )}
            <span>
              {status === 'downloading' ? `Downloading (${progressPct}%)` : 'Download Android App'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowGuide((prev) => !prev)}
            className="inline-flex items-center gap-1 px-3 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 text-slate-200 border border-white/10 text-xs font-semibold transition-colors cursor-pointer"
          >
            <span>Install Guide</span>
            {showGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Live Download Progress */}
      {status === 'downloading' && (
        <div className="space-y-1.5 bg-slate-950/60 rounded-xl p-3 border border-emerald-500/30">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-emerald-300">
              Downloading {OFFICIAL_APK_FILENAME}...
            </span>
            <span className="font-mono text-slate-300">
              {progressPct}% ({loadedText})
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-150"
              style={{ width: `${Math.max(6, progressPct)}%` }}
            />
          </div>
        </div>
      )}

      {/* Download Success Feedback */}
      {status === 'success' && (
        <div className="rounded-xl bg-emerald-500/15 border border-emerald-500/35 p-3 text-xs text-emerald-200 flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-white">
              Download Ready: {OFFICIAL_APK_FILENAME} ({downloadedSize})
            </p>
            <p className="text-[11px] text-emerald-200/90 mt-0.5">
              Tap the downloaded APK in your Android notifications or Downloads folder to install.
            </p>
          </div>
        </div>
      )}

      {/* Unavailability / Error Feedback */}
      {status === 'error' && errorMessage && (
        <div className="rounded-xl bg-rose-500/15 border border-rose-500/40 p-3 text-xs text-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={handleDownloadApk}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] shrink-0 self-start sm:self-auto"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>
        </div>
      )}

      {/* Android Installation Guidance */}
      {showGuide && (
        <div className="rounded-xl bg-slate-950/70 border border-slate-700/80 p-3.5 text-xs text-slate-300 space-y-2">
          <div className="flex items-center gap-2 text-emerald-300 font-bold">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>Android APK Installation Steps ({OFFICIAL_APK_MIN_ANDROID})</span>
          </div>
          <ol className="list-decimal pl-5 space-y-1 text-[11px] leading-relaxed text-slate-300">
            <li>
              Tap <strong>Download Android App</strong> to download <code>{OFFICIAL_APK_FILENAME}</code> directly to your device.
            </li>
            <li>
              Open the completed file from your Android notification shade or <strong>Files / Downloads</strong> app.
            </li>
            <li>
              If Android shows a security prompt, tap <strong>Settings</strong> and toggle <strong>Allow from this source</strong> for your browser.
            </li>
            <li>
              Return and tap <strong>Install</strong>, then open <strong>School Master</strong> to access HPC reports and attendance tools.
            </li>
          </ol>
        </div>
      )}
    </div>
  );
};
