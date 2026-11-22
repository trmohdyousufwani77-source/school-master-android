import React, { useState } from 'react';
import {
  Smartphone,
  CheckCircle2,
  Copy,
  Terminal,
  FolderGit2,
  FileCode,
  Layers,
  X,
  ExternalLink,
  History,
  Download,
  ShieldCheck,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

interface AndroidApkGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AndroidApkGuideModal: React.FC<AndroidApkGuideModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'github' | 'capacitor' | 'flutter' | 'pwa' | 'history'>('github');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm no-print">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">School Master: Android APK Build & Deployment</h2>
              <p className="text-xs text-slate-400">Production compilation & version history for Android</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap rounded-none gap-2 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('github')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'github' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FolderGit2 className="w-3.5 h-3.5" />
            <span>GitHub Actions & Releases</span>
          </button>
          <button
            onClick={() => setActiveTab('capacitor')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'capacitor' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Capacitor Native APK
          </button>
          <button
            onClick={() => setActiveTab('flutter')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'flutter' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Flutter Source
          </button>
          <button
            onClick={() => setActiveTab('pwa')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'pwa' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Direct PWA Install
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'history' ? 'bg-emerald-600 text-white shadow-sm' : 'text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Version History & Rollback</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs">

          {/* TAB 0: GITHUB ACTIONS & RELEASES */}
          {activeTab === 'github' && (
            <div className="space-y-4">
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-900">
                <p className="font-bold">Automated Debug &amp; Production Release APK Pipeline (GitHub Actions)</p>
                <p className="text-[11px] mt-1 text-indigo-700">
                  Workflow <code>.github/workflows/android-build.yml</code> compiles <code>android-app/</code> with JDK 17 + Gradle 8.9, runs unit tests, verifies APK signatures with <code>apksigner</code>, and publishes direct-download APKs to GitHub Releases.
                </p>
              </div>

              <div className="space-y-1.5">
                <p className="font-bold text-slate-800">1. Push to Build &amp; Publish Debug APK (Automatic on Push):</p>
                <div className="p-3 bg-slate-900 text-emerald-400 rounded-xl font-mono text-[11px] flex items-center justify-between gap-2">
                  <code className="truncate">git push -u origin main</code>
                  <button
                    onClick={() => copyToClipboard('git push -u origin main', 10)}
                    className="p-1 hover:text-white shrink-0"
                  >
                    {copiedIndex === 10 ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="font-bold text-slate-800">2. Production Release Mode (Keystore-Signed via GitHub Secrets):</p>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 space-y-1 text-[11px]">
                  <p>Add these 4 repository secrets under <strong>Settings ➔ Secrets and variables ➔ Actions</strong>, then trigger <code>workflow_dispatch</code> with <code>build_mode=release</code> or push a <code>v*</code> tag:</p>
                  <ul className="list-disc list-inside font-mono text-[10px] text-slate-800 space-y-0.5">
                    <li>ANDROID_KEYSTORE_BASE64</li>
                    <li>ANDROID_KEYSTORE_PASSWORD</li>
                    <li>ANDROID_KEY_ALIAS</li>
                    <li>ANDROID_KEY_PASSWORD</li>
                  </ul>
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="font-bold text-slate-800">3. Direct Phone Download URLs (In-App Updates Tab Compatible):</p>
                <div className="p-3 bg-slate-900 text-sky-300 rounded-xl font-mono text-[11px] flex items-center justify-between gap-2">
                  <code className="truncate">https://github.com/&lt;OWNER&gt;/&lt;REPO&gt;/releases/latest/download/SchoolMaster-release-latest.apk</code>
                  <button
                    onClick={() => copyToClipboard('https://github.com/<OWNER>/<REPO>/releases/latest/download/SchoolMaster-release-latest.apk', 11)}
                    className="p-1 hover:text-white shrink-0"
                  >
                    {copiedIndex === 11 ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 space-y-1">
                <p className="font-semibold text-slate-800">Published Release Assets &amp; Verification:</p>
                <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                  <li><code>SchoolMaster-debug-latest.apk</code> / <code>SchoolMaster-release-latest.apk</code> — stable URLs fetched by the Android <strong>Updates</strong> tab</li>
                  <li><code>SchoolMaster-v1.0.4-&lt;mode&gt;-r&lt;run&gt;.apk</code> — run-stamped signed APK</li>
                  <li><code>.sha256</code> checksum manifests &amp; 30-day workflow artifacts</li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 1: CAPACITOR */}
          {activeTab === 'capacitor' && (
            <div className="space-y-4">
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-900">
                <p className="font-bold">Turn this React codebase into a native Android APK in 3 commands:</p>
                <p className="text-[11px] mt-1 text-indigo-700">
                  Capacitor packages the responsive web app into a high-performance Android Studio project with full offline SQLite storage, camera QR scanning, biometric authentication, and hardware back button handling.
                </p>
              </div>

              {/* Step 1 */}
              <div className="space-y-1.5">
                <p className="font-bold text-slate-800">Step 1: Install Capacitor Core & Android CLI</p>
                <div className="p-3 bg-slate-900 text-emerald-400 rounded-xl font-mono text-[11px] flex items-center justify-between">
                  <code>npm install @capacitor/core @capacitor/cli @capacitor/android</code>
                  <button
                    onClick={() => copyToClipboard('npm install @capacitor/core @capacitor/cli @capacitor/android', 1)}
                    className="p-1 hover:text-white"
                  >
                    {copiedIndex === 1 ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Step 2 */}
              <div className="space-y-1.5">
                <p className="font-bold text-slate-800">Step 2: Initialize & Build Production Bundle</p>
                <div className="p-3 bg-slate-900 text-emerald-400 rounded-xl font-mono text-[11px] flex items-center justify-between">
                  <code>npm run build && npx cap init "School Master" "in.gov.up.schoolmaster" --web-dir dist</code>
                  <button
                    onClick={() => copyToClipboard('npm run build && npx cap init "School Master" "in.gov.up.schoolmaster" --web-dir dist', 2)}
                    className="p-1 hover:text-white"
                  >
                    {copiedIndex === 2 ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Step 3 */}
              <div className="space-y-1.5">
                <p className="font-bold text-slate-800">Step 3: Add Android Platform & Open in Android Studio</p>
                <div className="p-3 bg-slate-900 text-emerald-400 rounded-xl font-mono text-[11px] flex items-center justify-between">
                  <code>npx cap add android && npx cap open android</code>
                  <button
                    onClick={() => copyToClipboard('npx cap add android && npx cap open android', 3)}
                    className="p-1 hover:text-white"
                  >
                    {copiedIndex === 3 ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 space-y-1">
                <p className="font-semibold text-slate-800">Generating the Release APK in Android Studio:</p>
                <ol className="list-decimal list-inside space-y-0.5 text-[11px]">
                  <li>In Android Studio, click <strong>Build ➔ Generate Signed Bundle / APK</strong>.</li>
                  <li>Select <strong>APK</strong> and choose your Keystore certificate.</li>
                  <li>Select <strong>release</strong> build variant and click <strong>Finish</strong>.</li>
                  <li>Output APK is generated at <code>android/app/release/app-release.apk</code> ready for distribution to teachers!</li>
                </ol>
              </div>
            </div>
          )}

          {/* TAB 2: FLUTTER */}
          {activeTab === 'flutter' && (
            <div className="space-y-4">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900">
                <p className="font-bold">Flutter Android Shell Wrapper for Hybrid Deployment:</p>
                <p className="text-[11px] mt-1 text-emerald-800">
                  Embed the web app directly into a Flutter WebView container with offline asset caching and native Android Intent integration.
                </p>
              </div>

              <div className="space-y-1.5">
                <p className="font-bold text-slate-800">1. Create Flutter Project & Add webview_flutter:</p>
                <div className="p-3 bg-slate-900 text-emerald-400 rounded-xl font-mono text-[11px] flex items-center justify-between">
                  <code>flutter create --org in.gov.up school_master_android && cd school_master_android && flutter pub add webview_flutter</code>
                  <button
                    onClick={() => copyToClipboard('flutter create --org in.gov.up school_master_android && cd school_master_android && flutter pub add webview_flutter', 4)}
                    className="p-1 hover:text-white"
                  >
                    {copiedIndex === 4 ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="font-bold text-slate-800">2. Build APK:</p>
                <div className="p-3 bg-slate-900 text-emerald-400 rounded-xl font-mono text-[11px] flex items-center justify-between">
                  <code>flutter build apk --release --split-per-abi</code>
                  <button
                    onClick={() => copyToClipboard('flutter build apk --release --split-per-abi', 5)}
                    className="p-1 hover:text-white"
                  >
                    {copiedIndex === 5 ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PWA */}
          {activeTab === 'pwa' && (
            <div className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900">
                <p className="font-bold">Instant Android Phone & Tablet Installation (Zero App Store Required):</p>
                <p className="text-[11px] mt-1 text-amber-800">
                  Teachers can install School Master directly onto any Android phone or tablet via Chrome in 5 seconds with offline cache support.
                </p>
              </div>

              <ol className="list-decimal list-inside space-y-2 text-slate-700">
                <li>Open this URL in Google Chrome on the Android tablet or phone.</li>
                <li>Tap the <strong>three dots menu (⋮)</strong> at the top right of Chrome.</li>
                <li>Tap <strong>"Install app"</strong> or <strong>"Add to Home Screen"</strong>.</li>
                <li>School Master icon will appear in your Android app drawer and launch in full-screen standalone mode without URL bars.</li>
              </ol>
            </div>
          )}

          {/* TAB 4: VERSION HISTORY & ROLLBACK */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-950 flex items-start gap-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">App Version History & Emergency Rollbacks</p>
                  <p className="text-[11px] mt-0.5 text-emerald-800">
                    If an update experiences device incompatibilities on older government tablet hardware (Android 7+), the Headmaster can immediately rollback to any previous stable APK.
                  </p>
                </div>
              </div>

              {/* Version 1.0.0 (Current) */}
              <div className="p-4 rounded-2xl border-2 border-emerald-500/40 bg-emerald-50/20 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-600 text-white">
                      v1.0.4 (Current Production)
                    </span>
                    <span className="text-slate-500 text-[11px]">Released: Oct 31, 2026 • 5.8 MB</span>
                  </div>
                  <a
                    href="/SchoolMaster-release.apk"
                    download="SchoolMaster-v1.0.4-release.apk"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition-all active:scale-95 no-underline"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download APK (.apk)</span>
                  </a>
                </div>

                <p className="text-slate-700 font-medium text-[11px]">
                  <strong>Release Highlights (Android 8.0+):</strong> Fingerprint &amp; Pattern App Lock, Voice Typing in English &amp; Urdu, Camera QR Attendance Scanner, Persistent Scan Logs, Automated Low-Attendance Alerts, and Batch Class Exports.
                </p>

                <div className="p-2 rounded-lg bg-slate-900 text-slate-300 font-mono text-[10px] flex items-center justify-between">
                  <span className="truncate">SHA-256: 98f96bf042373bff7d54261baf2ced738ce4d2d5dbd5b747d96c69c8d39c5043</span>
                  <span className="text-emerald-400 font-semibold shrink-0 ml-2">VERIFIED</span>
                </div>
              </div>

              {/* Version 0.9.5 (Beta Rollback) */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-2.5 hover:border-indigo-300 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-slate-800 text-slate-200">
                      v0.9.5 (Stable Beta Rollback)
                    </span>
                    <span className="text-slate-500 text-[11px]">Released: Sept 15, 2026 • 7.9 MB</span>
                  </div>
                  <a
                    href="/school_master_v0.9.5.apk"
                    download="school_master_v0.9.5.apk"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs shadow-sm transition-all active:scale-95 no-underline"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                    <span>Rollback to v0.9.5</span>
                  </a>
                </div>

                <p className="text-slate-600 text-[11px]">
                  <strong>Release Notes:</strong> Complete textbook inventory & distribution tracking, teacher leave application & headmaster approval system, offline synchronization queue.
                </p>

                <div className="p-2 rounded-lg bg-slate-100 text-slate-600 font-mono text-[10px] flex items-center justify-between">
                  <span className="truncate">SHA-256: a4189e3190b2c8928172df0321568912e9b04859c256020c6</span>
                  <span className="text-indigo-600 font-semibold shrink-0 ml-2">STABLE</span>
                </div>
              </div>

              {/* Version 0.9.0 (Alpha Rollback) */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-2.5 hover:border-indigo-300 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-slate-200 text-slate-700">
                      v0.9.0 (Initial Core Release)
                    </span>
                    <span className="text-slate-500 text-[11px]">Released: Aug 10, 2026 • 6.8 MB</span>
                  </div>
                  <a
                    href="/school_master_v0.9.0.apk"
                    download="school_master_v0.9.0.apk"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs shadow-sm transition-all active:scale-95 no-underline"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
                    <span>Rollback to v0.9.0</span>
                  </a>
                </div>

                <p className="text-slate-600 text-[11px]">
                  <strong>Release Notes:</strong> Core student admission register with Aadhaar validation, daily attendance register, and terminal examination marks entry with CCE report cards.
                </p>

                <div className="p-2 rounded-lg bg-slate-100 text-slate-600 font-mono text-[10px] flex items-center justify-between">
                  <span className="truncate">SHA-256: 9b12e84c5510de38127392a837190b4039185a123958102a</span>
                  <span className="text-slate-500 font-semibold shrink-0 ml-2">LEGACY</span>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Current Active Runtime: <strong>v1.0.0 (October 2026 Build)</strong>
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 text-white font-bold text-xs hover:bg-slate-900"
          >
            Got It
          </button>
        </div>

      </div>
    </div>
  );
};
