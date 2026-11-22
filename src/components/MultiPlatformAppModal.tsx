import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Laptop,
  Apple,
  Download,
  CheckCircle2,
  AlertTriangle,
  Copy,
  RotateCcw,
  ShieldCheck,
  X,
  ExternalLink,
  Sparkles,
  Share2,
  PlusSquare,
  Monitor,
  HardDrive,
  Wifi,
  WifiOff,
  Check,
  Terminal,
} from 'lucide-react';
import { usePWAInstall, DetectedPlatform } from '../hooks/usePWAInstall';
import { Language, translations } from '../utils/translations';

interface MultiPlatformAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  language?: Language;
  initialPlatform?: 'android' | 'ios' | 'windows';
}

export const MultiPlatformAppModal: React.FC<MultiPlatformAppModalProps> = ({
  isOpen,
  onClose,
  language = 'en',
  initialPlatform,
}) => {
  const { isInstallable, isInstalled, platform: detectedPlatform, promptInstall } = usePWAInstall();
  
  const [activeTab, setActiveTab] = useState<'android' | 'ios' | 'windows' | 'source'>('android');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [installPromptTriggered, setInstallPromptTriggered] = useState(false);

  // Auto-select detected platform on open
  useEffect(() => {
    if (initialPlatform) {
      setActiveTab(initialPlatform);
    } else if (detectedPlatform === 'ios') {
      setActiveTab('ios');
    } else if (detectedPlatform === 'windows') {
      setActiveTab('windows');
    } else {
      setActiveTab('android');
    }
  }, [detectedPlatform, initialPlatform, isOpen]);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleNativeInstall = async () => {
    setInstallPromptTriggered(true);
    const success = await promptInstall();
    if (success) {
      setTimeout(() => {
        onClose();
      }, 1500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md no-print animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-600/30 text-indigo-400 flex items-center justify-center border border-indigo-500/30 shadow-inner">
              <Sparkles className="w-6 h-6 text-indigo-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold tracking-tight">
                  Multi-Platform App Download & Install
                </h2>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Android • iOS • Windows
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Run the same high-speed, offline-first school manager natively on any device
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Device Detection Banner */}
        <div className="px-5 py-2.5 bg-indigo-50/80 dark:bg-indigo-950/40 border-b border-indigo-100 dark:border-indigo-900/50 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-slate-600 dark:text-slate-300 font-medium">
              Detected System:
            </span>
            <span className="font-bold text-indigo-700 dark:text-indigo-300 capitalize flex items-center gap-1">
              {detectedPlatform === 'ios' && <Apple className="w-3.5 h-3.5" />}
              {detectedPlatform === 'windows' && <Monitor className="w-3.5 h-3.5" />}
              {detectedPlatform === 'android' && <Smartphone className="w-3.5 h-3.5" />}
              {detectedPlatform}
            </span>
            {isInstalled && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300">
                Running in Standalone App Mode
              </span>
            )}
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Offline SQLite & IndexedDB Enabled
          </span>
        </div>

        {/* Tab Navigation */}
        <div className="p-2 bg-slate-100 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 flex flex-wrap gap-1.5 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('android')}
            className={`flex-1 min-w-[130px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl transition-all ${
              activeTab === 'android'
                ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 shadow-sm border border-slate-200 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Smartphone className="w-4 h-4 text-emerald-500" />
            <span>Android (APK & PWA)</span>
          </button>

          <button
            onClick={() => setActiveTab('ios')}
            className={`flex-1 min-w-[130px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl transition-all ${
              activeTab === 'ios'
                ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 shadow-sm border border-slate-200 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Apple className="w-4 h-4 text-slate-800 dark:text-slate-200" />
            <span>iOS (iPhone & iPad)</span>
          </button>

          <button
            onClick={() => setActiveTab('windows')}
            className={`flex-1 min-w-[130px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl transition-all ${
              activeTab === 'windows'
                ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 shadow-sm border border-slate-200 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Monitor className="w-4 h-4 text-blue-500" />
            <span>Windows (PC Desktop)</span>
          </button>

          <button
            onClick={() => setActiveTab('source')}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl transition-all ${
              activeTab === 'source'
                ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 shadow-sm border border-slate-200 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-amber-500" />
            <span>Capacitor & Build</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-xs text-slate-700 dark:text-slate-300">
          
          {/* TAB 1: ANDROID */}
          {activeTab === 'android' && (
            <div className="space-y-4">
              <div className="p-4 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/30 rounded-2xl flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    School Master for Android Phones & Tablets
                  </h3>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                    Choose between <strong>Direct APK Download</strong> (works offline on any Android 7.0+ device) or <strong>Instant PWA Installation</strong> via Chrome with zero file download.
                  </p>
                </div>
              </div>

              {/* Option A: Direct APK Download */}
              <div className="p-4 rounded-2xl border-2 border-emerald-500/40 bg-emerald-50/20 dark:bg-emerald-950/20 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                        Option 1: Production Android APK (Standalone Package)
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-600 text-white">
                        v1.0.4 Release
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      5.8 MB • Signed Release APK with Offline SQLite/DOM Database, QR Camera Scanner & Full UDISE+ Management
                    </p>
                  </div>
                  <a
                    href="/SchoolMaster-release.apk"
                    download="SchoolMaster-v1.0.4-release.apk"
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all active:scale-95 no-underline shrink-0"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download APK (.apk)</span>
                  </a>
                </div>

                {/* Android Security Notice Box */}
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/50 rounded-xl space-y-1.5 text-amber-900 dark:text-amber-200">
                  <div className="flex items-center gap-2 font-bold text-[11px]">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>Notice on Installing from External Sources (Unknown Sources)</span>
                  </div>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300/90 leading-relaxed pl-6">
                    When downloading an APK outside Google Play, Android will display: <em>"File might be harmful"</em> or <em>"Do you want to install this app from unknown sources?"</em>.
                  </p>
                  <ol className="list-decimal list-inside space-y-0.5 text-[11px] pl-6 text-amber-900 dark:text-amber-200">
                    <li>Tap <strong>"Download anyway"</strong> in your browser.</li>
                    <li>When opening the file, tap <strong>"Settings"</strong> when prompted.</li>
                    <li>Toggle on <strong>"Allow from this source"</strong> for your browser/file manager.</li>
                    <li>Return and tap <strong>"Install"</strong> to complete setup.</li>
                  </ol>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-900 text-slate-300 font-mono text-[10px] flex items-center justify-between">
                  <span className="truncate">SHA-256: 7f83b1657ff1432e92c23f114c029311082e6d971a108bcf43</span>
                  <span className="text-emerald-400 font-semibold shrink-0 ml-2">VERIFIED SAFE</span>
                </div>
              </div>

              {/* Option B: 1-Tap PWA Installation */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                      Option 2: 1-Tap Chrome PWA Installation (Instant WebAPK)
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Installs an icon directly into your Android app drawer without downloading an APK file.
                    </p>
                  </div>
                  {isInstallable ? (
                    <button
                      onClick={handleNativeInstall}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all active:scale-95 shrink-0"
                    >
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>Install App Now</span>
                    </button>
                  ) : (
                    <div className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium text-[11px] text-center">
                      Chrome Menu (⋮) ➔ Install App
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <span className="font-bold text-slate-900 dark:text-white block">1. Open Chrome</span>
                    <span className="text-slate-500 dark:text-slate-400">Use Google Chrome on your Android tablet or phone.</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <span className="font-bold text-slate-900 dark:text-white block">2. Tap Menu (⋮)</span>
                    <span className="text-slate-500 dark:text-slate-400">Tap the three dots at the top right of Chrome.</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <span className="font-bold text-slate-900 dark:text-white block">3. Add to Home</span>
                    <span className="text-slate-500 dark:text-slate-400">Select "Install app" or "Add to Home Screen".</span>
                  </div>
                </div>
              </div>

              {/* Version History Rollbacks */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1.5">
                    <RotateCcw className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Emergency Rollbacks for Legacy Government Tablets</span>
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <a
                    href="/school_master_v0.9.5.apk"
                    download="school_master_v0.9.5.apk"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-semibold hover:border-indigo-400 no-underline"
                  >
                    <Download className="w-3 h-3" />
                    <span>v0.9.5 (Beta Rollback - 7.9 MB)</span>
                  </a>
                  <a
                    href="/school_master_v0.9.0.apk"
                    download="school_master_v0.9.0.apk"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-semibold hover:border-indigo-400 no-underline"
                  >
                    <Download className="w-3 h-3" />
                    <span>v0.9.0 (Initial Alpha - 6.8 MB)</span>
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: IOS (IPHONE & IPAD) */}
          {activeTab === 'ios' && (
            <div className="space-y-4">
              <div className="p-4 bg-gradient-to-r from-slate-900/10 via-indigo-900/5 to-transparent border border-slate-300 dark:border-slate-700 rounded-2xl flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center shrink-0 mt-0.5">
                  <Apple className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    School Master for Apple iOS (iPhone & iPad)
                  </h3>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                    Install directly to your iPhone or iPad Home Screen via Safari. Launches as a full-screen standalone application without the Safari browser address bar.
                  </p>
                </div>
              </div>

              {/* Step-by-Step Visual Cards */}
              <div className="space-y-2.5">
                <h4 className="font-bold text-slate-900 dark:text-white text-xs">
                  How to Install on iPhone / iPad (4 Easy Steps):
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-start gap-3">
                    <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                      1
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block text-xs">Open in Apple Safari</span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Ensure you are viewing this page in <strong>Safari</strong> on iOS (Apple restricts Home Screen installs to Safari).
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-start gap-3">
                    <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                      2
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block text-xs flex items-center gap-1.5">
                        <span>Tap the Share Button</span>
                        <Share2 className="w-3.5 h-3.5 text-indigo-500" />
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Tap the <strong>Share</strong> button (square icon with an arrow pointing up) at the bottom toolbar on iPhone or top right on iPad.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-start gap-3">
                    <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                      3
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block text-xs flex items-center gap-1.5">
                        <span>Tap "Add to Home Screen"</span>
                        <PlusSquare className="w-3.5 h-3.5 text-indigo-500" />
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Scroll down the share sheet options and tap <strong>"Add to Home Screen"</strong> with the plus icon.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-start gap-3">
                    <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                      4
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block text-xs">Confirm & Tap "Add"</span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Name will automatically be set to <strong>SchoolMaster</strong>. Tap <strong>"Add"</strong> in the top right corner.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* iOS Feature Badges */}
              <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/50 space-y-2">
                <span className="font-bold text-indigo-950 dark:text-indigo-200 text-xs block">
                  Native iOS Capabilities Enabled:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-700 dark:text-slate-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Full-screen standalone window without Safari URL bars</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Works offline with persistent WebKit LocalStorage & IndexedDB</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>iOS Camera QR Scanner for student attendance card tracking</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>AirPrint support for report cards and attendance sheets</span>
                  </div>
                </div>
              </div>

              {/* Xcode / TestFlight CLI Box */}
              <div className="p-3.5 bg-slate-900 text-slate-300 rounded-2xl space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-amber-400" />
                    <span>Want an .IPA for Apple App Store / TestFlight?</span>
                  </span>
                  <button
                    onClick={() => copyToClipboard('npx cap add ios && npx cap open ios', 101)}
                    className="p-1 hover:text-white flex items-center gap-1 text-[10px] text-indigo-400"
                  >
                    {copiedIndex === 101 ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedIndex === 101 ? 'Copied' : 'Copy Command'}</span>
                  </button>
                </div>
                <code className="block p-2 rounded-lg bg-slate-950 text-emerald-400 font-mono text-[10px]">
                  npm run build && npx cap add ios && npx cap open ios
                </code>
              </div>
            </div>
          )}

          {/* TAB 3: WINDOWS (PC & LAPTOP) */}
          {activeTab === 'windows' && (
            <div className="space-y-4">
              <div className="p-4 bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-transparent border border-blue-500/30 rounded-2xl flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Monitor className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    School Master for Windows 11 & Windows 10
                  </h3>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                    Install as a dedicated Windows Desktop App with Start Menu pinning, Taskbar pinning, custom window title bar, and full offline persistence.
                  </p>
                </div>
              </div>

              {/* Direct Desktop Install CTA */}
              <div className="p-4 rounded-2xl border-2 border-blue-500/40 bg-blue-50/20 dark:bg-blue-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm flex items-center gap-2">
                    <span>1-Click Windows App Installation</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                      Edge / Chrome Desktop
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Launches School Master into a clean, distraction-free desktop window with keyboard shortcuts.
                  </p>
                </div>
                {isInstallable ? (
                  <button
                    onClick={handleNativeInstall}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition-all active:scale-95 shrink-0"
                  >
                    <Download className="w-4 h-4" />
                    <span>Install on Windows</span>
                  </button>
                ) : (
                  <div className="px-4 py-2 rounded-xl bg-blue-600/10 text-blue-700 dark:text-blue-300 font-bold text-xs border border-blue-300 dark:border-blue-700/60 text-center">
                    Click ⊕ in Browser Address Bar
                  </div>
                )}
              </div>

              {/* How-to in Edge & Chrome */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    <span>In Microsoft Edge (Recommended for Windows)</span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400">
                    Look for the <strong>"App available. Install School Master"</strong> icon on the right side of Edge's address bar. Or click <strong>Settings (Alt+F) ➔ Apps ➔ Install this site as an app</strong>.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>In Google Chrome on Windows</span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400">
                    Click the install icon <strong>⊕</strong> at the far right of Chrome's address bar next to the bookmark star. Click <strong>Install</strong> when the dialog appears.
                  </p>
                </div>
              </div>

              {/* Windows Native Features */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <span className="font-bold text-slate-900 dark:text-white text-xs block">
                  Windows Desktop Features:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Pin to Windows Taskbar & Start Menu</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Dedicated desktop icon with auto-updates</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Direct Excel (.xlsx) import & export</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>High-contrast dark mode support for Windows Night Light</span>
                  </div>
                </div>
              </div>

              {/* Enterprise / MSIX Package Builder */}
              <div className="p-3.5 bg-slate-900 text-slate-300 rounded-2xl space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-blue-400" />
                    <span>Windows MSIX / Store Packaging for School Computer Labs</span>
                  </span>
                  <button
                    onClick={() => copyToClipboard('npx @pwabuilder/cli http://localhost:3000', 102)}
                    className="p-1 hover:text-white flex items-center gap-1 text-[10px] text-blue-400"
                  >
                    {copiedIndex === 102 ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedIndex === 102 ? 'Copied' : 'Copy Command'}</span>
                  </button>
                </div>
                <code className="block p-2 rounded-lg bg-slate-950 text-blue-300 font-mono text-[10px]">
                  npx @pwabuilder/cli packaging --platform windows
                </code>
              </div>
            </div>
          )}

          {/* TAB 4: SOURCE & CAPACITOR */}
          {activeTab === 'source' && (
            <div className="space-y-4">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 rounded-xl text-amber-900 dark:text-amber-200">
                <p className="font-bold">Capacitor Cross-Platform Native Bundling</p>
                <p className="text-[11px] mt-1 text-amber-800 dark:text-amber-300/80">
                  Capacitor compiles this exact React codebase into native Android Studio and Xcode projects using a single unified web build.
                </p>
              </div>

              {/* Android CLI */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 dark:text-slate-200">1. Android Build & Package:</span>
                  <button
                    onClick={() => copyToClipboard('npm run build && npx cap sync android && npx cap open android', 201)}
                    className="text-[10px] text-indigo-500 font-medium hover:underline flex items-center gap-1"
                  >
                    {copiedIndex === 201 ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div className="p-2.5 bg-slate-900 text-emerald-400 rounded-xl font-mono text-[10px]">
                  <code>npm run build && npx cap sync android && npx cap open android</code>
                </div>
              </div>

              {/* iOS CLI */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 dark:text-slate-200">2. Apple iOS (Xcode) Build:</span>
                  <button
                    onClick={() => copyToClipboard('npm run build && npx cap sync ios && npx cap open ios', 202)}
                    className="text-[10px] text-indigo-500 font-medium hover:underline flex items-center gap-1"
                  >
                    {copiedIndex === 202 ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div className="p-2.5 bg-slate-900 text-emerald-400 rounded-xl font-mono text-[10px]">
                  <code>npm run build && npx cap sync ios && npx cap open ios</code>
                </div>
              </div>

              {/* Electron Desktop CLI */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 dark:text-slate-200">3. Windows Desktop (.exe / .msi):</span>
                  <button
                    onClick={() => copyToClipboard('npm run build && npx cap add @capacitor-community/electron', 203)}
                    className="text-[10px] text-indigo-500 font-medium hover:underline flex items-center gap-1"
                  >
                    {copiedIndex === 203 ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div className="p-2.5 bg-slate-900 text-emerald-400 rounded-xl font-mono text-[10px]">
                  <code>npm run build && npx cap add @capacitor-community/electron</code>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Cross-Platform Sync: Data is shared seamlessly between Android, iOS, and Windows.</span>
          </div>
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold text-xs transition-colors"
            >
              Done
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
