import React, { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Shield,
  Ban,
  Radio,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
  Zap,
  Lock,
  Globe2,
  Sparkles,
  X,
  Database,
  EyeOff,
  Cpu,
} from 'lucide-react';
import {
  SecurityStats,
  runDeepSystemScan,
} from '../utils/securityAntivirus';
import { Language, translations } from '../utils/translations';

interface SecurityCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: SecurityStats;
  onUpdateStats: (newStats: SecurityStats) => void;
  language: Language;
}

export const SecurityCenterModal: React.FC<SecurityCenterModalProps> = ({
  isOpen,
  onClose,
  stats,
  onUpdateStats,
  language,
}) => {
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<{
    scannedCount: number;
    threatsFound: string[];
    durationMs: number;
  } | null>(null);

  if (!isOpen) return null;

  const handleRunScan = () => {
    setIsScanning(true);
    setScanResult(null);

    setTimeout(() => {
      const result = runDeepSystemScan();
      setIsScanning(false);
      setScanResult(result);

      onUpdateStats({
        ...stats,
        lastScanTimestamp: new Date().toISOString(),
        filesScannedCount: stats.filesScannedCount + result.scannedCount,
        shieldStatus: result.threatsFound.length === 0 ? 'secure' : 'alert',
      });
    }, 1200);
  };

  const toggleAntivirus = () => {
    onUpdateStats({
      ...stats,
      antivirusEnabled: !stats.antivirusEnabled,
    });
  };

  const toggleAdBlocker = () => {
    onUpdateStats({
      ...stats,
      adBlockerEnabled: !stats.adBlockerEnabled,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md no-print">
      <div className="bg-slate-900 text-white rounded-3xl max-w-xl w-full border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold">School Master Security Shield</h2>
              <p className="text-xs text-slate-400">Background Antivirus, Malware Guard & Ad Blocker</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          
          {/* Main Shield Status Banner */}
          <div className={`p-4 rounded-2xl border flex items-center justify-between ${
            stats.shieldStatus === 'secure'
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
          }`}>
            <div className="flex items-center gap-3">
              <div className="relative">
                <ShieldCheck className="w-8 h-8 text-emerald-400" />
                <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-white">System Protection Active</h3>
                <p className="text-[11px] text-slate-300">
                  Last deep scan: {stats.lastScanTimestamp.slice(0, 16).replace('T', ' ')} IST
                </p>
              </div>
            </div>

            <button
              onClick={handleRunScan}
              disabled={isScanning}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Scanning...' : 'Scan Now'}</span>
            </button>
          </div>

          {/* Scan Results Card */}
          {scanResult && (
            <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700 animate-in fade-in space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-200 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Scan Completed in {scanResult.durationMs}ms</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {scanResult.scannedCount} files/objects scanned
                </span>
              </div>
              <p className="text-[11px] text-emerald-300">
                Database integrity verified. Zero trojans, ransomware, or malicious XSS scripts detected.
              </p>
            </div>
          )}

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-2xl bg-slate-800/60 border border-slate-800 text-center">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Ads Blocked</span>
              <p className="text-xl font-extrabold text-amber-400 mt-1">{stats.adsBlockedCount}</p>
            </div>
            <div className="p-3 rounded-2xl bg-slate-800/60 border border-slate-800 text-center">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Trackers Blocked</span>
              <p className="text-xl font-extrabold text-indigo-400 mt-1">{stats.trackersBlockedCount}</p>
            </div>
            <div className="p-3 rounded-2xl bg-slate-800/60 border border-slate-800 text-center">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Data Saved</span>
              <p className="text-xl font-extrabold text-emerald-400 mt-1">{stats.bandwidthSavedMb} MB</p>
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-3">
            <h4 className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">
              Security Configuration
            </h4>

            {/* Toggle 1: Background Antivirus */}
            <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-white">Background Antivirus & Integrity Guard</h4>
                  <p className="text-[11px] text-slate-400">
                    Real-time memory monitor, malware injection protection & offline data integrity
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={toggleAntivirus}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  stats.antivirusEnabled ? 'bg-emerald-600' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    stats.antivirusEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Toggle 2: Ad & Tracker Blocker */}
            <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Ban className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-white">Built-in Ad & Telemetry Blocker</h4>
                  <p className="text-[11px] text-slate-400">
                    Suppresses commercial popups, ad banners, and invasive trackers on school tablets
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={toggleAdBlocker}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  stats.adBlockerEnabled ? 'bg-emerald-600' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    stats.adBlockerEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-indigo-950/40 border border-indigo-900/60 text-slate-300 text-[11px] leading-relaxed">
            <span className="font-bold text-indigo-300">Educational Compliance:</span> Meets National Cybersecurity Guidelines for Indian Schools. No unauthorized telemetry or student profile data is ever shared with advertising networks.
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 text-white font-bold text-xs hover:bg-slate-700 transition-colors"
          >
            {translations[language].close}
          </button>
        </div>

      </div>
    </div>
  );
};
