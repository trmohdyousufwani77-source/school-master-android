import React, { useState, useEffect, useMemo } from 'react';
import {
  WifiOff,
  RefreshCw,
  CheckCircle2,
  UploadCloud,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  UserCheck,
  GraduationCap,
  UserPlus,
  BookOpen,
  Calendar,
  Database,
  Layers,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  X,
  FileDown,
  AlertTriangle,
  History,
  FileCode,
  Check,
  AlertCircle,
  Server,
  Smartphone,
} from 'lucide-react';
import { OfflineSyncItem, OfflineSyncProgress, OfflineSyncCategory, FailedSyncLog, SyncConflictItem } from '../types';
import { translations } from '../utils/translations';
import {
  downloadSyncDiagnostics,
  getFailedSyncLogs,
  getSyncConflicts,
  saveSyncConflicts,
} from '../utils/syncDiagnostics';
import { SyncConflictResolutionModal } from './SyncConflictResolutionModal';
import type { FirebaseSyncSummary } from '../firebase';

interface OfflineIndicatorProps {
  isOffline?: boolean;
  queuedChangesCount?: number;
  queueItems?: OfflineSyncItem[];
  syncProgress?: OfflineSyncProgress | null;
  onSyncNow?: () => void;
  onSimulateSampleQueue?: () => void;
  language?: 'en' | 'ur';
  schoolName?: string;
  onResolveConflictsCallback?: (resolved: SyncConflictItem[]) => void;
  lastFirebaseSyncSummary?: FirebaseSyncSummary | null;
  localAttendanceCount?: number;
  localLeaveCount?: number;
  firebaseSignedIn?: boolean;
  onConnectFirebase?: () => void;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  isOffline: propIsOffline,
  queuedChangesCount = 0,
  queueItems = [],
  syncProgress,
  onSyncNow,
  onSimulateSampleQueue,
  language = 'en',
  schoolName = 'Government Boys Middle School Pamposh Colony',
  onResolveConflictsCallback,
  lastFirebaseSyncSummary,
  localAttendanceCount = 0,
  localLeaveCount = 0,
  firebaseSignedIn = false,
  onConnectFirebase,
}) => {
  const [browserOnline, setBrowserOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [showReconnectedBadge, setShowReconnectedBadge] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [showSyncSuccess, setShowSyncSuccess] = useState<boolean>(false);
  const [lastSyncedCount, setLastSyncedCount] = useState<number>(0);

  // Tab state within expanded drawer
  const [drawerActiveTab, setDrawerActiveTab] = useState<'queue' | 'history' | 'conflicts'>('queue');

  // Hover Tooltip state for Pending Sync Queue breakdown
  const [isHoveringQueue, setIsHoveringQueue] = useState<boolean>(false);

  // Diagnostics and Conflict state
  const [failedLogs] = useState<FailedSyncLog[]>(() => getFailedSyncLogs());
  const [conflicts, setConflicts] = useState<SyncConflictItem[]>(() => getSyncConflicts());
  const [isConflictModalOpen, setIsConflictModalOpen] = useState<boolean>(false);
  const [diagnosticsNotice, setDiagnosticsNotice] = useState<string | null>(null);

  const t = translations[language] || translations.en;

  // Track browser online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setBrowserOnline(true);
      setShowReconnectedBadge(true);
      const timer = setTimeout(() => setShowReconnectedBadge(false), 3500);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setBrowserOnline(false);
      setShowReconnectedBadge(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // When sync completes, trigger temporary success toast
  useEffect(() => {
    if (syncProgress && !syncProgress.isSyncing && syncProgress.completedItems.length > 0) {
      setLastSyncedCount(syncProgress.completedItems.length);
      setShowSyncSuccess(true);
      const timer = setTimeout(() => {
        setShowSyncSuccess(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [syncProgress]);

  const effectiveOffline = propIsOffline ?? !browserOnline;
  const isSyncing = syncProgress?.isSyncing ?? false;

  // Requirement: "Add a detailed hover-tooltip to the Offline Indicator component that displays a summary of the 'Pending Sync Queue', specifically showing the count of records by category (e.g., 5 Marks, 3 Attendance)"
  const categoryBreakdown = useMemo(() => {
    const counts: Record<OfflineSyncCategory, number> = {
      marks: 0,
      attendance: 0,
      student: 0,
      textbook: 0,
      leave: 0,
      general: 0,
    };
    queueItems.forEach((item) => {
      if (counts[item.category] !== undefined) {
        counts[item.category] += 1;
      } else {
        counts.general += 1;
      }
    });
    return counts;
  }, [queueItems]);

  const totalPayloadKb = useMemo(() => {
    const totalBytes = queueItems.reduce((acc, item) => acc + (item.sizeBytes || 1024), 0);
    return (totalBytes / 1024).toFixed(1);
  }, [queueItems]);

  // Category Icon helper
  const renderCategoryIcon = (category: OfflineSyncCategory) => {
    switch (category) {
      case 'attendance':
        return <UserCheck className="w-4 h-4 text-emerald-400" />;
      case 'marks':
        return <GraduationCap className="w-4 h-4 text-purple-400" />;
      case 'student':
        return <UserPlus className="w-4 h-4 text-sky-400" />;
      case 'textbook':
        return <BookOpen className="w-4 h-4 text-amber-400" />;
      case 'leave':
        return <Calendar className="w-4 h-4 text-rose-400" />;
      default:
        return <Database className="w-4 h-4 text-indigo-400" />;
    }
  };

  const getCategoryBadgeClass = (category: OfflineSyncCategory) => {
    switch (category) {
      case 'attendance':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'marks':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'student':
        return 'bg-sky-500/20 text-sky-300 border-sky-500/30';
      case 'textbook':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'leave':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      default:
        return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
    }
  };

  const getCategoryLabel = (category: OfflineSyncCategory) => {
    switch (category) {
      case 'attendance':
        return language === 'ur' ? 'حاضری ریکارڈ' : 'Attendance';
      case 'marks':
        return language === 'ur' ? 'امتحانی نمبرات' : 'Exam Marks';
      case 'student':
        return language === 'ur' ? 'طالب علم کا پروفائل' : 'Student Record';
      case 'textbook':
        return language === 'ur' ? 'درسی کتب' : 'Textbook Dist.';
      case 'leave':
        return language === 'ur' ? 'رخصت کی درخواست' : 'Leave Request';
      default:
        return language === 'ur' ? 'سسٹم ڈیٹا' : 'System Record';
    }
  };

  // Requirement: Download Sync Diagnostics JSON button handler
  const handleDownloadDiagnostics = () => {
    downloadSyncDiagnostics(queueItems, failedLogs, schoolName);
    setDiagnosticsNotice('✓ Sync Diagnostics JSON exported successfully!');
    setTimeout(() => setDiagnosticsNotice(null), 4000);
  };

  // Handle resolution of conflicts from the modal
  const handleResolveConflicts = (resolvedList: SyncConflictItem[], strategyUsed: string) => {
    // Remove resolved conflicts from state
    const remaining = conflicts.filter((c) => !resolvedList.some((r) => r.id === c.id));
    setConflicts(remaining);
    saveSyncConflicts(remaining);
    if (onResolveConflictsCallback) {
      onResolveConflictsCallback(resolvedList);
    }
    setDiagnosticsNotice(`✓ Conflicts reconciled successfully (${strategyUsed})`);
    setTimeout(() => setDiagnosticsNotice(null), 4000);
  };

  // 1. ACTIVE SYNCHRONIZATION VIEW WITH GRANULAR PROGRESS BAR
  if (isSyncing && syncProgress) {
    const { currentIndex, totalCount, currentItem, completedItems, pendingItems, percentage, speedKbps } = syncProgress;
    const allItemsToDisplay: OfflineSyncItem[] = [
      ...completedItems,
      ...(currentItem ? [currentItem] : []),
      ...pendingItems,
    ];

    return (
      <aside aria-label="Synchronization Progress" className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white border-b border-indigo-500/40 shadow-xl transition-all duration-300 no-print z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 shrink-0">
                <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-xs sm:text-sm text-slate-100 flex items-center gap-1.5">
                    <span>{language === 'ur' ? 'مرکزی سرور پر ہم آہنگی جاری ہے' : 'Synchronizing Records with Central Cloud'}</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-500/20 text-cyan-300 border border-indigo-400/30">
                      {currentIndex} / {totalCount} {language === 'ur' ? 'ریکارڈز' : 'records'}
                    </span>
                  </span>
                  <span className="text-[11px] text-slate-400 hidden md:inline">
                    • {speedKbps || 48} KB/s • U-DISE+ Gateway
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-cyan-300 px-2 py-0.5 rounded bg-slate-800/90 border border-slate-700">
                {Math.round(percentage)}%
              </span>
              <button
                onClick={() => setIsExpanded((prev) => !prev)}
                className="px-2.5 py-1 rounded-lg bg-indigo-900/60 hover:bg-indigo-800 text-indigo-200 hover:text-white text-[11px] font-semibold border border-indigo-700/50 flex items-center gap-1 transition-all active:scale-95"
              >
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                <span>{isExpanded ? (language === 'ur' ? 'تفصیلات چھپائیں' : 'Hide Records') : (language === 'ur' ? 'ریکارڈز دیکھیں' : `Inspect (${totalCount})`)}</span>
                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Granular Animated Progress Bar */}
          <div className="space-y-1">
            <div className="w-full bg-slate-800/90 rounded-full h-2.5 p-0.5 border border-slate-700/60 overflow-hidden relative shadow-inner">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-400 transition-all duration-300 ease-out relative"
                style={{ width: `${Math.max(4, Math.min(100, percentage))}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
              </div>
            </div>
            <div className="flex justify-between items-center text-[10px] text-slate-400 px-0.5">
              <span>{completedItems.length} {language === 'ur' ? 'مکمل' : 'synced'}</span>
              <span className="font-medium text-cyan-400">{totalCount - completedItems.length} {language === 'ur' ? 'باقی' : 'remaining'}</span>
              <span>100%</span>
            </div>
          </div>

          {/* SPOTLIGHT: Specific record currently being uploaded */}
          {currentItem && (
            <div className="bg-slate-900/90 border border-indigo-500/30 rounded-xl p-2.5 sm:p-3 flex items-start sm:items-center justify-between gap-3 shadow-md backdrop-blur-sm">
              <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 shrink-0 mt-0.5 sm:mt-0">
                  {renderCategoryIcon(currentItem.category)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0 flex items-center gap-1 ${getCategoryBadgeClass(currentItem.category)}">
                      <Loader2 className="w-2.5 h-2.5 animate-spin text-cyan-400" />
                      <span>{language === 'ur' ? 'اپ لوڈ ہو رہا ہے:' : 'Uploading:'} {getCategoryLabel(currentItem.category)}</span>
                    </span>
                    <h4 className="font-bold text-xs sm:text-sm text-slate-100 truncate">
                      {currentItem.title}
                    </h4>
                  </div>
                  <p className="text-[11px] text-slate-300 truncate mt-0.5">
                    {currentItem.subtitle}
                  </p>
                </div>
              </div>

              <div className="hidden sm:flex items-center gap-2 text-right shrink-0">
                <div className="text-[10px] text-slate-400">
                  <div className="text-cyan-300 font-mono font-semibold">
                    {currentItem.sizeBytes ? `${(currentItem.sizeBytes / 1024).toFixed(1)} KB` : '1.2 KB'}
                  </div>
                  <div className="text-slate-500">ID: {currentItem.id.slice(0, 10)}</div>
                </div>
                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              </div>
            </div>
          )}
        </div>
      </aside>
    );
  }

  // 2. TEMPORARY SYNC SUCCESS BANNER
  if (showSyncSuccess) {
    return (
      <aside aria-label="Sync Completed" className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-700 text-white text-xs px-4 py-2 flex flex-wrap items-center justify-between gap-3 shadow-md transition-all duration-300 no-print z-40">
        <div className="flex items-center gap-2.5 font-medium max-w-5xl">
          <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-100" />
          </div>
          <div>
            <span className="font-bold">
              {lastFirebaseSyncSummary
                ? lastFirebaseSyncSummary.trigger === 'auto-reconnect'
                  ? `Auto-Synced on Reconnect: ${lastFirebaseSyncSummary.studentAttendanceSynced} Student Att., ${lastFirebaseSyncSummary.teacherAttendanceSynced} Teacher Att., ${lastFirebaseSyncSummary.leavesSynced} Leaves`
                  : `Sync Now Complete: ${lastFirebaseSyncSummary.studentAttendanceSynced} Student Att., ${lastFirebaseSyncSummary.teacherAttendanceSynced} Teacher Att., ${lastFirebaseSyncSummary.leavesSynced} Leaves`
                : language === 'ur'
                ? `تمام ${lastSyncedCount} آف لائن ریکارڈز کامیابی سے مرکزی ڈیٹا بیس سے ہم آہنگ ہو چکے ہیں!`
                : `All ${lastSyncedCount} offline records successfully synchronized with Firebase!`}
            </span>
            <span className="text-emerald-100 text-[11px] block sm:inline sm:ml-2">
              {lastFirebaseSyncSummary?.firebaseConnected
                ? 'Uploaded to Firebase Cloud Firestore.'
                : lastFirebaseSyncSummary?.requiresFirebaseAuth
                ? 'Saved to school server — connect Google Firebase for cloud backup.'
                : language === 'ur'
                ? 'مقامی کیشے اپ ٹو ڈیٹ ہے۔'
                : 'Local device cache is fully up to date.'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lastFirebaseSyncSummary?.requiresFirebaseAuth && onConnectFirebase && (
            <button
              type="button"
              onClick={onConnectFirebase}
              className="px-2.5 py-1 rounded-lg bg-white text-emerald-900 hover:bg-emerald-50 text-[11px] font-bold transition-colors"
            >
              Connect Firebase
            </button>
          )}
          <button
            onClick={() => setShowSyncSuccess(false)}
            className="text-white/80 hover:text-white p-1 rounded transition-colors"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </aside>
    );
  }

  // 3. RECONNECTED BADGE (auto-triggers Firebase Sync Now)
  if (showReconnectedBadge && !effectiveOffline) {
    return (
      <aside aria-label="Internet Connection Restored" className="bg-emerald-600 text-white text-xs px-4 py-1.5 flex items-center justify-center gap-2 font-medium shadow-sm transition-all duration-300 no-print z-40">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
        <span>
          {language === 'ur'
            ? 'انٹرنیٹ کنکشن بحال ہو گیا — مقامی حاضری اور رخصت کا ڈیٹا فائربیس پر خودکار ہم آہنگ ہو رہا ہے'
            : 'Internet restored — Automatically syncing locally stored attendance & leave records to Firebase'}
        </span>
      </aside>
    );
  }

  // 4. WORKING OFFLINE BANNER (OR WHEN QUEUED ITEMS EXIST)
  if (effectiveOffline || queuedChangesCount > 0) {
    return (
      <>
        <aside
          aria-label="Offline Mode & Sync Queue"
          className="bg-amber-600 text-white text-xs shadow-md transition-all duration-300 no-print border-b border-amber-700 relative z-30"
        >
          <div className="max-w-7xl mx-auto px-4 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              
              {/* Left: Offline Status & Hover Tooltip Trigger Area */}
              <div
                className="relative flex items-center gap-2 font-medium min-w-0 cursor-default"
                onMouseEnter={() => setIsHoveringQueue(true)}
                onMouseLeave={() => setIsHoveringQueue(false)}
              >
                <div className="w-6 h-6 rounded-lg bg-amber-700/80 flex items-center justify-center shrink-0 border border-amber-500/40">
                  <WifiOff className="w-3.5 h-3.5 text-amber-100 animate-pulse" />
                </div>
                
                <div className="min-w-0">
                  <span className="font-bold">
                    {language === 'ur' ? 'آف لائن موڈ میں کام جاری ہے' : 'Working Offline'}
                  </span>
                  <span className="hidden sm:inline text-amber-100 ml-1.5">
                    — {language === 'ur'
                      ? 'تمام حاضری، نمبرات اور تبدیلیاں آپ کی ڈیوائس پر محفوظ ہو رہی ہیں۔'
                      : 'All attendance, marks, and evaluations are securely stored in device local storage.'}
                  </span>
                </div>

                {/* Queue Pill with Hover Tooltip Trigger */}
                <div className="relative inline-flex items-center">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-800 text-amber-100 border border-amber-400/40 shrink-0 flex items-center gap-1 shadow-2xs hover:bg-amber-900 transition-colors cursor-pointer">
                    <Database className="w-2.5 h-2.5 text-amber-300" />
                    <span>{queuedChangesCount} {language === 'ur' ? 'قطار میں' : 'queued'}</span>
                  </span>

                  {/* REQUIREMENT: Detailed Hover-Tooltip showing summary of the 'Pending Sync Queue' by category */}
                  {isHoveringQueue && (
                    <div
                      role="tooltip"
                      className="absolute left-0 top-full mt-2 z-50 w-72 sm:w-80 bg-slate-900/98 backdrop-blur-md text-white rounded-2xl p-4 shadow-2xl border border-slate-700 text-xs animate-in fade-in zoom-in-95 duration-150"
                    >
                      {/* Tooltip top triangle */}
                      <div className="absolute -top-1.5 left-5 w-3 h-3 bg-slate-900 border-t border-l border-slate-700 rotate-45" />

                      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2.5">
                        <div className="flex items-center gap-2">
                          <Database className="w-4 h-4 text-amber-400" />
                          <span className="font-black text-sm text-white">Pending Sync Queue</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          {queueItems.length} Records
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-400 mb-2.5">
                        Categorized summary of local records awaiting server synchronization:
                      </p>

                      <div className="space-y-1.5">
                        {/* 1. Marks Category */}
                        <div className="flex items-center justify-between p-2 rounded-xl bg-purple-950/40 border border-purple-800/40">
                          <div className="flex items-center gap-2">
                            <GraduationCap className="w-3.5 h-3.5 text-purple-400" />
                            <span className="font-semibold text-purple-200">Exam Marks</span>
                          </div>
                          <span className="font-mono font-extrabold text-purple-300 px-2 py-0.5 rounded bg-purple-900/60 text-[11px]">
                            {categoryBreakdown.marks} Records
                          </span>
                        </div>

                        {/* 2. Attendance Category */}
                        <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-950/40 border border-emerald-800/40">
                          <div className="flex items-center gap-2">
                            <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="font-semibold text-emerald-200">Daily Attendance</span>
                          </div>
                          <span className="font-mono font-extrabold text-emerald-300 px-2 py-0.5 rounded bg-emerald-900/60 text-[11px]">
                            {categoryBreakdown.attendance} Records
                          </span>
                        </div>

                        {/* 3. Student Category */}
                        {categoryBreakdown.student > 0 && (
                          <div className="flex items-center justify-between p-2 rounded-xl bg-sky-950/40 border border-sky-800/40">
                            <div className="flex items-center gap-2">
                              <UserPlus className="w-3.5 h-3.5 text-sky-400" />
                              <span className="font-semibold text-sky-200">Student Profiles</span>
                            </div>
                            <span className="font-mono font-extrabold text-sky-300 px-2 py-0.5 rounded bg-sky-900/60 text-[11px]">
                              {categoryBreakdown.student} Records
                            </span>
                          </div>
                        )}

                        {/* 4. Textbook Category */}
                        {categoryBreakdown.textbook > 0 && (
                          <div className="flex items-center justify-between p-2 rounded-xl bg-amber-950/40 border border-amber-800/40">
                            <div className="flex items-center gap-2">
                              <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                              <span className="font-semibold text-amber-200">Textbooks</span>
                            </div>
                            <span className="font-mono font-extrabold text-amber-300 px-2 py-0.5 rounded bg-amber-900/60 text-[11px]">
                              {categoryBreakdown.textbook} Records
                            </span>
                          </div>
                        )}

                        {/* 5. Leave Category */}
                        {categoryBreakdown.leave > 0 && (
                          <div className="flex items-center justify-between p-2 rounded-xl bg-rose-950/40 border border-rose-800/40">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-3.5 h-3.5 text-rose-400" />
                              <span className="font-semibold text-rose-200">Teacher Leaves</span>
                            </div>
                            <span className="font-mono font-extrabold text-rose-300 px-2 py-0.5 rounded bg-rose-900/60 text-[11px]">
                              {categoryBreakdown.leave} Records
                            </span>
                          </div>
                        )}

                        {queueItems.length === 0 && (
                          <div className="p-3 text-center text-slate-400 text-xs italic">
                            No records currently pending synchronization.
                          </div>
                        )}
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
                        <span>Payload: {totalPayloadKb} KB</span>
                        <span className="text-amber-400 font-bold">Click drawer to inspect</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Conflict badge indicator if conflicts are pending */}
                {conflicts.length > 0 && (
                  <button
                    onClick={() => setIsConflictModalOpen(true)}
                    className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-700 hover:bg-rose-800 text-white border border-rose-400/40 shrink-0 flex items-center gap-1 shadow-sm transition-all animate-bounce"
                    title="Divergent data conflicts detected between device and server"
                  >
                    <AlertTriangle className="w-2.5 h-2.5 text-rose-200" />
                    <span>{conflicts.length} Conflicts</span>
                  </button>
                )}
              </div>

              {/* Right Action Controls */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Expand Drawer Button */}
                <button
                  onClick={() => setIsExpanded((prev) => !prev)}
                  className="px-2.5 py-1 rounded-lg bg-black/20 hover:bg-black/30 text-amber-100 text-[11px] font-medium transition-colors flex items-center gap-1"
                >
                  <Layers className="w-3 h-3" />
                  <span>{isExpanded ? (language === 'ur' ? 'چھپائیں' : 'Close Details') : (language === 'ur' ? 'تفصیلات اور ہسٹری' : 'Queue & History')}</span>
                  {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>

                {/* Conflict Resolution Button */}
                {conflicts.length > 0 && (
                  <button
                    onClick={() => setIsConflictModalOpen(true)}
                    className="px-2.5 py-1 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-[11px] font-bold transition-all flex items-center gap-1 shadow-2xs"
                  >
                    <AlertTriangle className="w-3 h-3" />
                    <span>Resolve Conflicts</span>
                  </button>
                )}

                {/* Add 5 Test Records demo button */}
                {queuedChangesCount === 0 && onSimulateSampleQueue && (
                  <button
                    onClick={onSimulateSampleQueue}
                    className="px-2.5 py-1 rounded-lg bg-amber-700/80 hover:bg-amber-800 text-white text-[11px] font-bold transition-all flex items-center gap-1 active:scale-95 border border-amber-400/40"
                    title="Queue realistic offline records (5 Marks, 3 Attendance) to test synchronization progress"
                  >
                    <Sparkles className="w-3 h-3 text-amber-200" />
                    <span>{language === 'ur' ? 'ٹیسٹ ریکارڈز لوڈ کریں' : 'Add Test Records (5 Marks, 3 Att.)'}</span>
                  </button>
                )}

                {onSyncNow && (
                  <button
                    onClick={onSyncNow}
                    disabled={typeof navigator !== 'undefined' && !navigator.onLine}
                    className="px-3 py-1 rounded-lg bg-white text-amber-950 hover:bg-amber-50 text-[11px] font-bold transition-all shadow-sm flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                    title="Upload all locally stored student attendance, teacher attendance, and leave data to Firebase"
                  >
                    <UploadCloud className="w-3.5 h-3.5 text-amber-700" />
                    <span>{language === 'ur' ? 'ابھی فائربیس سنک کریں' : 'Sync Now'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Notification Toast for Diagnostics Download */}
            {diagnosticsNotice && (
              <div className="mt-2 bg-emerald-900/90 border border-emerald-400 text-emerald-100 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-between animate-in fade-in">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{diagnosticsNotice}</span>
                </span>
                <button onClick={() => setDiagnosticsNotice(null)} className="text-white hover:text-emerald-200">×</button>
              </div>
            )}

            {/* Expandable Tabs Drawer: 1. Pending Queue, 2. Sync History & Diagnostics, 3. Conflict Resolution */}
            {isExpanded && (
              <div className="mt-2.5 pt-2 border-t border-amber-500/40 bg-slate-900 text-slate-100 rounded-2xl p-4 space-y-3 shadow-xl">
                {/* Tabs Bar */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 flex-wrap gap-2">
                  <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl text-xs">
                    <button
                      onClick={() => setDrawerActiveTab('queue')}
                      className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                        drawerActiveTab === 'queue'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Pending Queue ({queueItems.length})</span>
                    </button>

                    <button
                      onClick={() => setDrawerActiveTab('history')}
                      className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                        drawerActiveTab === 'history'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>Sync History &amp; Diagnostics</span>
                    </button>

                    <button
                      onClick={() => setDrawerActiveTab('conflicts')}
                      className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                        drawerActiveTab === 'conflicts'
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Conflicts ({conflicts.length})</span>
                    </button>
                  </div>

                  {/* Quick Action: Download Sync Diagnostics right from drawer header */}
                  <button
                    onClick={handleDownloadDiagnostics}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition-all shadow-2xs"
                    title="Export pending queue and last 10 failed synchronization logs as JSON diagnostics file"
                  >
                    <FileDown className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Download Sync Diagnostics</span>
                  </button>
                </div>

                {/* TAB 1: PENDING QUEUE */}
                {drawerActiveTab === 'queue' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>{queueItems.length} records ready to transmit to U-DISE+ cloud</span>
                      <span className="font-mono">Total payload: {totalPayloadKb} KB</span>
                    </div>

                    <div className="max-h-56 overflow-y-auto divide-y divide-slate-800/80 pr-1 space-y-1">
                      {queueItems.length === 0 ? (
                        <div className="p-6 text-center text-slate-500 text-xs italic">
                          No pending records in offline queue.
                        </div>
                      ) : (
                        queueItems.map((item) => (
                          <div
                            key={item.id}
                            className="py-2 px-3 rounded-xl bg-slate-950/70 border border-slate-800/70 flex items-center justify-between gap-3 text-xs"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {renderCategoryIcon(item.category)}
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border shrink-0 ${getCategoryBadgeClass(item.category)}`}>
                                {getCategoryLabel(item.category)}
                              </span>
                              <div className="min-w-0">
                                <p className="font-semibold text-white truncate">{item.title}</p>
                                <p className="text-[10px] text-slate-400 truncate">{item.subtitle}</p>
                              </div>
                            </div>
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 shrink-0">
                              {item.sizeBytes ? `${(item.sizeBytes / 1024).toFixed(1)} KB` : '1.2 KB'}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 2: SYNC HISTORY & DIAGNOSTICS */}
                {drawerActiveTab === 'history' && (
                  <div className="space-y-3">
                    {/* Header with Download Sync Diagnostics Button */}
                    <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-950 rounded-xl border border-slate-800">
                      <div>
                        <h4 className="font-bold text-xs text-white flex items-center gap-1.5">
                          <History className="w-4 h-4 text-indigo-400" />
                          <span>Last 10 Failed Synchronization Logs &amp; Diagnostics</span>
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Inspect recent network dropouts, 409 conflict aborts, and 504 gateway timeouts for troubleshooting.
                        </p>
                      </div>

                      {/* REQUIREMENT: Download Sync Diagnostics button in Sync History tab */}
                      <button
                        onClick={handleDownloadDiagnostics}
                        className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
                        title="Download pending sync queue and last 10 failed synchronization logs as JSON"
                      >
                        <FileDown className="w-3.5 h-3.5 text-white" />
                        <span>Download Sync Diagnostics (JSON)</span>
                      </button>
                    </div>

                    {/* Table of the Last 10 Failed Logs */}
                    <div className="overflow-x-auto max-h-56 overflow-y-auto border border-slate-800 rounded-xl">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800 text-[10px] sticky top-0 z-10">
                          <tr>
                            <th className="py-2 px-2.5">Log ID / Time</th>
                            <th className="py-2 px-2 text-center">Status</th>
                            <th className="py-2 px-2.5">Error Code</th>
                            <th className="py-2 px-3">Endpoint &amp; Category</th>
                            <th className="py-2 px-3">Failure Reason &amp; Payload</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
                          {failedLogs.slice(0, 10).map((log) => (
                            <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                              <td className="py-2 px-2.5 font-mono text-[10px] text-slate-400 whitespace-nowrap">
                                <div>{log.id}</div>
                                <div className="text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</div>
                              </td>
                              <td className="py-2 px-2 text-center">
                                <span
                                  className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                                    log.httpStatus === 409
                                      ? 'bg-amber-950 text-amber-300 border border-amber-700/60'
                                      : 'bg-rose-950 text-rose-300 border border-rose-700/60'
                                  }`}
                                >
                                  {log.httpStatus}
                                </span>
                              </td>
                              <td className="py-2 px-2.5 font-mono font-bold text-rose-300 text-[10px] whitespace-nowrap">
                                {log.errorCode}
                              </td>
                              <td className="py-2 px-3">
                                <div className="font-mono text-cyan-300 text-[10px]">{log.endpoint}</div>
                                <span className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-bold border mt-0.5 ${getCategoryBadgeClass(log.affectedCategory)}`}>
                                  {log.affectedCategory.toUpperCase()}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-slate-300 text-[11px]">
                                <p className="font-semibold text-slate-200">{log.errorMessage}</p>
                                <p className="text-[10px] text-slate-500 font-mono mt-0.5">{log.payloadSummary}</p>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* TAB 3: CONFLICTS */}
                {drawerActiveTab === 'conflicts' && (
                  <div className="space-y-3">
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-xs text-white">Pending Sync Conflicts ({conflicts.length})</h4>
                        <p className="text-[11px] text-slate-400">Records modified independently on both device and cloud.</p>
                      </div>
                      <button
                        onClick={() => setIsConflictModalOpen(true)}
                        className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Open Conflict Resolution Modal</span>
                      </button>
                    </div>

                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {conflicts.map((c) => (
                        <div key={c.id} className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-bold text-white">{c.studentName || c.title}</span>
                            <span className="text-[10px] text-slate-400 ml-2 font-mono">Class {c.classNumber}-{c.section}</span>
                            <p className="text-[11px] text-slate-400 mt-0.5">{c.title} • {c.dateOrExam}</p>
                          </div>
                          <button
                            onClick={() => setIsConflictModalOpen(true)}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 text-[11px] font-bold"
                          >
                            Resolve
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* Sync Conflict Resolution Modal with 'Resolve All Similar' Checkbox */}
        {isConflictModalOpen && (
          <SyncConflictResolutionModal
            isOpen={isConflictModalOpen}
            conflicts={conflicts}
            onClose={() => setIsConflictModalOpen(false)}
            onResolveConflicts={handleResolveConflicts}
            language={language}
          />
        )}
      </>
    );
  }

  // Online compact Auto-Sync / Firebase Sync Now bar (always accessible to sync local attendance & leave data)
  const formattedLastSync = lastFirebaseSyncSummary?.syncedAt
    ? new Date(lastFirebaseSyncSummary.syncedAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <>
      {onSyncNow && (
        <aside
          aria-label="Firebase Auto-Sync Status"
          className="bg-slate-900 text-slate-100 text-[11px] border-b border-slate-800 no-print z-30"
        >
          <div className="max-w-7xl mx-auto px-4 py-1.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <span className="inline-flex items-center gap-1.5 font-bold text-emerald-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                <span>
                  {language === 'ur' ? 'آن لائن • خودکار فائربیس سنک فعال' : 'Online • Auto-Sync Active'}
                </span>
              </span>
              <span className="text-slate-500 hidden sm:inline">|</span>
              <span className="text-slate-300 truncate">
                {localAttendanceCount} Attendance &amp; {localLeaveCount} Leave records cached locally
                {formattedLastSync ? ` • Last synced ${formattedLastSync}` : ''}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {!firebaseSignedIn && onConnectFirebase && (
                <button
                  type="button"
                  onClick={onConnectFirebase}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 text-[11px] font-bold transition-colors flex items-center gap-1"
                  title="Sign in with Google to enable direct Cloud Firestore sync"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Connect Firebase</span>
                </button>
              )}
              <button
                type="button"
                onClick={onSyncNow}
                className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition-all shadow-xs flex items-center gap-1.5 active:scale-95"
                title="Upload all locally stored attendance and leave data to Firebase now"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>{language === 'ur' ? 'فائربیس سنک کریں' : 'Sync Now'}</span>
              </button>
            </div>
          </div>
        </aside>
      )}
      {isConflictModalOpen && (
        <SyncConflictResolutionModal
          isOpen={isConflictModalOpen}
          conflicts={conflicts}
          onClose={() => setIsConflictModalOpen(false)}
          onResolveConflicts={handleResolveConflicts}
          language={language}
        />
      )}
    </>
  );
};
