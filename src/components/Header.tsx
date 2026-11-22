import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  School,
  Globe2,
  Smartphone,
  Tablet,
  Monitor,
  Wifi,
  WifiOff,
  UserCheck,
  CheckCircle2,
  FileCheck2,
  HelpCircle,
  RefreshCw,
  Sparkles,
  Bell,
  Moon,
  Sun,
  X,
  Check,
  Trash2,
  AlertTriangle,
  GraduationCap,
  Calendar,
  Info,
  ShieldCheck,
  Laptop,
  Download,
  Sliders,
  Search,
  ArrowRight,
} from 'lucide-react';
import { Language, translations } from '../utils/translations';
import { DeveloperAdminProfile, SchoolProfile, Student, User } from '../types';
import { deduplicateStudentsByAdmissionNumber, formatSchoolAddressOnce } from '../utils/calculations';
import { SchoolEmblem } from './SchoolEmblem';
import {
  loadPushPreferences,
  PUSH_NOTIFICATION_EVENT,
  PushNotificationPreferences,
  requestBrowserNotificationPermission,
  savePushPreferences,
} from '../utils/pushNotifications';
import { registerFcmPushNotifications } from '../firebase';

interface HeaderProps {
  school: SchoolProfile;
  currentUser: User;
  users: User[];
  onSelectUser: (user: User) => void;
  language: Language;
  onToggleLanguage: (lang: Language) => void;
  deviceView: 'desktop' | 'phone' | 'tablet';
  onSetDeviceView: (view: 'desktop' | 'phone' | 'tablet') => void;
  isOffline: boolean;
  onToggleOffline: () => void;
  offlineSyncQueueCount: number;
  onSyncOfflineData: () => void;
  onOpenTestRunner: () => void;
  onOpenApkGuide: () => void;
  onOpenMultiPlatformModal?: (platform?: 'android' | 'ios' | 'windows') => void;
  onOpenDownloadHub?: () => void;
  activeDevAdmin?: DeveloperAdminProfile;
  onOpenAboutUs?: () => void;
  onRunNotificationChecks?: () => void;
  students?: Student[];
  onNavigateToStudent?: (student: Student) => void;
}

export interface NotificationItem {
  id: string;
  title: string;
  titleUrdu?: string;
  message: string;
  messageUrdu?: string;
  category: 'System' | 'Academic' | 'Attendance' | 'Inspection' | 'Leave' | 'Exam';
  targetRole?: 'teacher' | 'admin' | 'all';
  time: string;
  createdAt?: string;
  read: boolean;
  priority?: 'high' | 'normal';
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-1',
    title: 'New Report Cards Available',
    titleUrdu: 'نئے رپورٹ کارڈز دستیاب ہیں',
    message: 'Term 1 progress report cards generated for Class 5 & Class 6. Ready for print and WhatsApp distribution.',
    messageUrdu: 'کلاس 5 اور 6 کے امتحانی رپورٹ کارڈ تیار ہیں، پی ڈی ایف اور واٹس ایپ پر اشتراک کے لیے تیار ہیں۔',
    category: 'Academic',
    time: '15m ago',
    read: false,
    priority: 'normal',
  },
  {
    id: 'notif-2',
    title: 'Low Attendance Notice',
    titleUrdu: 'کم حاضری کی تنبیہ',
    message: '4 students currently below the 75% RTE compliance threshold for October. Alert parents via WhatsApp.',
    messageUrdu: 'اکتوبر میں 4 طلباء کی حاضری 75% سے کم ہے۔ براہ کرم والدین کو واٹس ایپ الرٹ بھیجیں۔',
    category: 'Attendance',
    time: '1h ago',
    read: false,
    priority: 'high',
  },
  {
    id: 'notif-3',
    title: 'Upcoming System Maintenance',
    titleUrdu: 'سسٹم مینٹیننس کی پیشگی اطلاع',
    message: 'Routine cloud backup and offline database indexing window on Sunday at 11:00 PM IST.',
    messageUrdu: 'اتوار کو رات 11 بجے روٹین کلاؤڈ بیک اپ اور ڈیٹا بیس انڈیکسنگ کی جائے گی۔',
    category: 'System',
    time: '4h ago',
    read: false,
    priority: 'normal',
  },
  {
    id: 'notif-4',
    title: 'U-DISE+ State Inspection',
    titleUrdu: 'یو ڈائس اسٹیٹ معائنہ',
    message: 'Annual District Education inspection checklist and student enrollment verify completed.',
    messageUrdu: 'ضلعی محکمہ تعلیم کا سالانہ معائنہ چیک لسٹ اور طلباء کا اندراج تصدیق شدہ ہے۔',
    category: 'Inspection',
    time: '1d ago',
    read: true,
    priority: 'normal',
  },
];

export const Header: React.FC<HeaderProps> = ({
  school,
  currentUser,
  users,
  onSelectUser,
  language,
  onToggleLanguage,
  deviceView,
  onSetDeviceView,
  isOffline,
  onToggleOffline,
  offlineSyncQueueCount,
  onSyncOfflineData,
  onOpenTestRunner,
  onOpenApkGuide,
  onOpenMultiPlatformModal,
  onOpenDownloadHub,
  activeDevAdmin,
  onOpenAboutUs,
  onRunNotificationChecks,
  students = [],
  onNavigateToStudent,
}) => {
  const t = translations[language];

  // Global Persistent Student Search Bar State
  const [globalSearchQuery, setGlobalSearchQuery] = useState<string>('');
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState<boolean>(false);
  const [highlightedSearchIdx, setHighlightedSearchIdx] = useState<number>(0);
  const globalSearchContainerRef = useRef<HTMLDivElement>(null);
  const globalSearchInputRef = useRef<HTMLInputElement>(null);

  const uniqueSearchableStudents = useMemo(
    () => deduplicateStudentsByAdmissionNumber(students),
    [students]
  );

  const globalSearchResults = useMemo(() => {
    const q = globalSearchQuery.trim().toLowerCase();
    if (!q) return [];
    return uniqueSearchableStudents
      .filter((s) => {
        const adm = (s.admissionNumber || '').toLowerCase();
        const name = (s.fullName || '').toLowerCase();
        const id = (s.id || '').toLowerCase();
        const father = (s.fatherName || '').toLowerCase();
        return (
          adm.includes(q) ||
          name.includes(q) ||
          id.includes(q) ||
          father.includes(q)
        );
      })
      .sort((a, b) => {
        const aExactAdm = (a.admissionNumber || '').toLowerCase().startsWith(q) ? 0 : 1;
        const bExactAdm = (b.admissionNumber || '').toLowerCase().startsWith(q) ? 0 : 1;
        if (aExactAdm !== bExactAdm) return aExactAdm - bExactAdm;
        const aStartsName = (a.fullName || '').toLowerCase().startsWith(q) ? 0 : 1;
        const bStartsName = (b.fullName || '').toLowerCase().startsWith(q) ? 0 : 1;
        if (aStartsName !== bStartsName) return aStartsName - bStartsName;
        return a.fullName.localeCompare(b.fullName);
      })
      .slice(0, 8);
  }, [uniqueSearchableStudents, globalSearchQuery]);

  useEffect(() => {
    setHighlightedSearchIdx(0);
  }, [globalSearchQuery]);

  // Ctrl+K / Cmd+K global shortcut to focus header student search
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        globalSearchInputRef.current?.focus();
        setIsSearchDropdownOpen(true);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Close search dropdown on click outside
  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      if (
        globalSearchContainerRef.current &&
        !globalSearchContainerRef.current.contains(event.target as Node)
      ) {
        setIsSearchDropdownOpen(false);
      }
    };
    if (isSearchDropdownOpen) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isSearchDropdownOpen]);

  const handleSelectGlobalStudent = (student: Student) => {
    setIsSearchDropdownOpen(false);
    setGlobalSearchQuery('');
    if (onNavigateToStudent) {
      onNavigateToStudent(student);
    }
  };

  const handleGlobalSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsSearchDropdownOpen(false);
      (e.target as HTMLInputElement).blur();
      return;
    }
    if (!isSearchDropdownOpen && globalSearchQuery.trim()) {
      setIsSearchDropdownOpen(true);
    }
    if (globalSearchResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedSearchIdx((prev) => (prev + 1) % globalSearchResults.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedSearchIdx((prev) => (prev - 1 + globalSearchResults.length) % globalSearchResults.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = globalSearchResults[highlightedSearchIdx] || globalSearchResults[0];
      if (target) handleSelectGlobalStudent(target);
    }
  };

  // Dark Mode State
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('school_master_theme') === 'dark';
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('school_master_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('school_master_theme', 'light');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
  };

  // Notification Center State
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    const saved = localStorage.getItem('school_master_notifications');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // use default
      }
    }
    return INITIAL_NOTIFICATIONS;
  });
  const [isNotifOpen, setIsNotifOpen] = useState<boolean>(false);
  const [showNotifPrefs, setShowNotifPrefs] = useState<boolean>(false);
  const [pushPrefs, setPushPrefs] = useState<PushNotificationPreferences>(() => loadPushPreferences());
  const [activePushToast, setActivePushToast] = useState<NotificationItem | null>(null);
  const [browserPermStatus, setBrowserPermStatus] = useState<string>(() =>
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  );
  const notifDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('school_master_notifications', JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    const handlePushEvent = (evt: Event) => {
      const custom = evt as CustomEvent<NotificationItem>;
      if (custom.detail) {
        setNotifications((prev) => [custom.detail, ...prev.filter((n) => n.id !== custom.detail.id)].slice(0, 40));
        if (custom.detail.priority === 'high' || custom.detail.category === 'Attendance') {
          setActivePushToast(custom.detail);
        }
      }
    };
    window.addEventListener(PUSH_NOTIFICATION_EVENT, handlePushEvent);
    return () => window.removeEventListener(PUSH_NOTIFICATION_EVENT, handlePushEvent);
  }, []);

  useEffect(() => {
    if (!activePushToast) return;
    const timer = window.setTimeout(() => {
      setActivePushToast(null);
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [activePushToast]);

  const updatePushPref = <K extends keyof PushNotificationPreferences>(key: K, val: PushNotificationPreferences[K]) => {
    setPushPrefs((prev) => {
      const next = { ...prev, [key]: val };
      savePushPreferences(next);
      return next;
    });
  };

  const [fcmChannelMsg, setFcmChannelMsg] = useState<string | null>(() =>
    localStorage.getItem('sm_fcm_token_v1') ? 'FCM Device Token Synced' : null
  );

  const handleEnableBrowserPush = async () => {
    const fcmRes = await registerFcmPushNotifications(
      currentUser.role === 'teacher' ? 'teacher' : currentUser.role === 'head_teacher' ? 'principal' : 'admin'
    );
    if (fcmRes.status === 'registered' || fcmRes.status === 'sw-ready-no-vapid') {
      setBrowserPermStatus('granted');
      updatePushPref('browserPushEnabled', true);
      setFcmChannelMsg(fcmRes.message);
    } else {
      const perm = await requestBrowserNotificationPermission();
      setBrowserPermStatus(perm);
      if (perm === 'granted') {
        updatePushPref('browserPushEnabled', true);
      }
      setFcmChannelMsg(fcmRes.message);
    }
  };

  // Click outside to close notifications dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    if (isNotifOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isNotifOpen]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleClearAllNotifs = () => {
    setNotifications([]);
  };

  const handleToggleRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: !n.read } : n))
    );
  };

  const handleDeleteNotif = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <>
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 shadow-sm no-print">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-2">
          
          {/* Left: Brand & School info */}
          <div className="flex items-center gap-3.5 min-w-0">
            {school.logoDataUrl ? (
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-white flex items-center justify-center shadow-lg shrink-0 ring-2 ring-amber-400/50 overflow-hidden p-1.5">
                <img
                  src={school.logoDataUrl}
                  alt={`${school.name} Official Logo`}
                  className="max-w-full max-h-full w-auto h-auto object-contain"
                />
              </div>
            ) : (
              <SchoolEmblem size={44} />
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base sm:text-lg tracking-tight bg-gradient-to-r from-amber-200 via-white to-orange-200 bg-clip-text text-transparent truncate">
                  {language === 'ur' ? (school.nameUrdu || school.name) : school.name}
                </span>
                <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                  U-DISE: {school.code}
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate flex items-center gap-1.5">
                <span className="hidden xl:inline text-amber-300/90 font-semibold">Holistic Progress Card System</span>
                <span className="hidden xl:inline text-slate-600">•</span>
                <span className="text-indigo-400 font-medium">Session: {school.academicSession}</span>
                <span className="hidden sm:inline text-slate-500">•</span>
                <span className="hidden sm:inline text-slate-300">{formatSchoolAddressOnce(school)}</span>
              </p>
            </div>
          </div>

          {/* Right: Controls & User Switcher */}
          <div className="flex items-center space-x-1.5 sm:space-x-2.5">
            
            {/* Offline Simulator & Sync */}
            <div className="flex items-center">
              <button
                onClick={onToggleOffline}
                title={isOffline ? "Currently working offline. Click to go online" : "Click to simulate offline network"}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isOffline
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 animate-pulse'
                    : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'
                }`}
              >
                {isOffline ? <WifiOff className="w-3.5 h-3.5 text-rose-400" /> : <Wifi className="w-3.5 h-3.5 text-emerald-400" />}
                <span className="hidden lg:inline">{isOffline ? t.offline : t.online}</span>
              </button>

              {offlineSyncQueueCount > 0 && (
                <button
                  onClick={onSyncOfflineData}
                  title="Synchronize queued offline records"
                  className="ml-1.5 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors shadow-sm"
                >
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Sync ({offlineSyncQueueCount})</span>
                </button>
              )}
            </div>

            {/* Dark Mode Toggle */}
            <button
              onClick={toggleDarkMode}
              title={isDarkMode ? t.lightMode : t.darkMode}
              className={`p-2 rounded-lg border text-xs font-medium transition-all ${
                isDarkMode
                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-300" />}
            </button>

            {/* Notification Center Popover */}
            <div className="relative" ref={notifDropdownRef}>
              <button
                onClick={() => setIsNotifOpen((prev) => !prev)}
                title={t.notifications}
                className={`relative p-2 rounded-lg border transition-all ${
                  isNotifOpen
                    ? 'bg-indigo-600 text-white border-indigo-500'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-sm animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Center Dropdown */}
              {isNotifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                  {/* Header */}
                  <div className="p-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-amber-400" />
                      <span className="font-bold text-xs sm:text-sm text-white">{t.notifications}</span>
                      {unreadCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setShowNotifPrefs((prev) => !prev)}
                        className={`px-2 py-0.5 rounded-md font-semibold flex items-center gap-1 transition-colors ${
                          showNotifPrefs ? 'bg-amber-400 text-slate-950' : 'text-slate-300 hover:text-white bg-slate-800'
                        }`}
                        title="Configure Push Notification Rules & Attendance Threshold"
                      >
                        <Sliders className="w-3 h-3" />
                        <span>Rules</span>
                      </button>
                      {unreadCount > 0 && (
                        <button
                          onClick={handleMarkAllRead}
                          className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors"
                        >
                          {t.markAllAsRead}
                        </button>
                      )}
                      {notifications.length > 0 && (
                        <button
                          onClick={handleClearAllNotifs}
                          className="text-slate-400 hover:text-rose-400 font-semibold transition-colors flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>{t.clearAll}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Push Notification Rules & Threshold Settings */}
                  {showNotifPrefs && (
                    <div className="p-3.5 bg-slate-950 border-b border-slate-800 space-y-2.5 text-[11px] text-slate-200">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <span className="font-bold text-amber-300 block">FCM Push Notification Triggers</span>
                          {fcmChannelMsg && (
                            <span className="text-[10px] text-emerald-300 block">{fcmChannelMsg}</span>
                          )}
                        </div>
                        {browserPermStatus !== 'granted' ? (
                          <button
                            type="button"
                            onClick={handleEnableBrowserPush}
                            className="px-2 py-1 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-[10px] cursor-pointer shrink-0"
                          >
                            Enable FCM Push
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={handleEnableBrowserPush}
                            className="text-[10px] font-bold text-emerald-400 hover:underline cursor-pointer shrink-0"
                          >
                            FCM Active · Sync Token
                          </button>
                        )}
                      </div>

                      <label className="flex items-center justify-between gap-2 cursor-pointer">
                        <span>Teacher Leave Approval/Rejection</span>
                        <input
                          type="checkbox"
                          checked={pushPrefs.teacherLeaveAlerts}
                          onChange={(e) => updatePushPref('teacherLeaveAlerts', e.target.checked)}
                          className="accent-amber-400"
                        />
                      </label>

                      <div className="flex items-center justify-between gap-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={pushPrefs.attendanceThresholdAlerts}
                            onChange={(e) => updatePushPref('attendanceThresholdAlerts', e.target.checked)}
                            className="accent-amber-400"
                          />
                          <span>Admin Attendance Alert &lt;</span>
                        </label>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={40}
                            max={99}
                            value={pushPrefs.attendanceThresholdPercent}
                            onChange={(e) => updatePushPref('attendanceThresholdPercent', Math.max(40, Math.min(99, Number(e.target.value) || 75)))}
                            className="w-12 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-right font-mono text-white"
                          />
                          <span>%</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={pushPrefs.examRemindersEnabled}
                            onChange={(e) => updatePushPref('examRemindersEnabled', e.target.checked)}
                            className="accent-amber-400"
                          />
                          <span>Exam Reminders (within days)</span>
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={90}
                          value={pushPrefs.examReminderDaysBefore}
                          onChange={(e) => updatePushPref('examReminderDaysBefore', Math.max(1, Math.min(90, Number(e.target.value) || 30)))}
                          className="w-12 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-right font-mono text-white"
                        />
                      </div>

                      {onRunNotificationChecks && (
                        <button
                          type="button"
                          onClick={onRunNotificationChecks}
                          className="w-full py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] transition-colors cursor-pointer"
                        >
                          Run Attendance &amp; Exam Alert Check Now
                        </button>
                      )}
                    </div>
                  )}

                  {/* Notification List */}
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/80 text-xs">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 space-y-2">
                        <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto opacity-70" />
                        <p className="font-semibold text-slate-300">{t.noNotifications}</p>
                      </div>
                    ) : (
                      notifications.map((item) => (
                        <div
                          key={item.id}
                          className={`p-3.5 hover:bg-slate-800/60 transition-colors flex items-start gap-3 ${
                            !item.read ? 'bg-indigo-950/25' : ''
                          }`}
                        >
                          <div className="mt-0.5 shrink-0">
                            {item.category === 'Attendance' && (
                              <div className="w-7 h-7 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
                                <AlertTriangle className="w-4 h-4" />
                              </div>
                            )}
                            {item.category === 'Academic' && (
                              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                                <GraduationCap className="w-4 h-4" />
                              </div>
                            )}
                            {item.category === 'System' && (
                              <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                                <Info className="w-4 h-4" />
                              </div>
                            )}
                            {item.category === 'Inspection' && (
                              <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                                <ShieldCheck className="w-4 h-4" />
                              </div>
                            )}
                            {item.category === 'Leave' && (
                              <div className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center border border-sky-500/30">
                                <UserCheck className="w-4 h-4" />
                              </div>
                            )}
                            {item.category === 'Exam' && (
                              <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
                                <Calendar className="w-4 h-4" />
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <h4 className="font-bold text-slate-200 truncate">
                                {language === 'ur' && item.titleUrdu ? item.titleUrdu : item.title}
                              </h4>
                              <span className="text-[10px] text-slate-400 whitespace-nowrap">{item.time}</span>
                            </div>
                            <p className="mt-1 text-[11px] text-slate-300 leading-relaxed">
                              {language === 'ur' && item.messageUrdu ? item.messageUrdu : item.message}
                            </p>
                            <div className="mt-2 flex items-center justify-between">
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                {item.category}
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleToggleRead(item.id)}
                                  className="text-[10px] font-medium text-slate-400 hover:text-indigo-300 transition-colors"
                                >
                                  {item.read ? 'Mark unread' : 'Mark read'}
                                </button>
                                <button
                                  onClick={() => handleDeleteNotif(item.id)}
                                  className="text-slate-500 hover:text-rose-400 transition-colors"
                                  title="Dismiss"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Language Switcher */}
            <div className="flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-700">
              <button
                onClick={() => onToggleLanguage('en')}
                className={`px-2 py-1 text-xs font-bold rounded-md transition-colors ${
                  language === 'en'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                EN
              </button>
              <button
                onClick={() => onToggleLanguage('ur')}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors font-urdu ${
                  language === 'ur'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                اردو
              </button>
            </div>

            {/* Device View Frame Switcher */}
            <div className="hidden xl:flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-700" title="Preview Android Shell Mode">
              <button
                onClick={() => onSetDeviceView('desktop')}
                className={`p-1.5 rounded-md transition-colors ${deviceView === 'desktop' ? 'bg-slate-700 text-indigo-400' : 'text-slate-400 hover:text-white'}`}
                title="Desktop View"
              >
                <Monitor className="w-4 h-4" />
              </button>
              <button
                onClick={() => onSetDeviceView('tablet')}
                className={`p-1.5 rounded-md transition-colors ${deviceView === 'tablet' ? 'bg-slate-700 text-indigo-400' : 'text-slate-400 hover:text-white'}`}
                title="Android Tablet View"
              >
                <Tablet className="w-4 h-4" />
              </button>
              <button
                onClick={() => onSetDeviceView('phone')}
                className={`p-1.5 rounded-md transition-colors ${deviceView === 'phone' ? 'bg-slate-700 text-indigo-400' : 'text-slate-400 hover:text-white'}`}
                title="Android Phone View"
              >
                <Smartphone className="w-4 h-4" />
              </button>
            </div>

            {/* Verification Tests */}
            <button
              onClick={onOpenTestRunner}
              title="Run Automated Acceptance & Calculations Verification Tests"
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors"
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>Verify</span>
            </button>

            {/* Multi-Platform App (Android, iOS, Windows) */}
            <button
              onClick={() => onOpenMultiPlatformModal ? onOpenMultiPlatformModal() : onOpenApkGuide()}
              title="Install or Download App for Android, iOS & Windows PC"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-indigo-600 via-indigo-500 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-sm border border-indigo-400/40 active:scale-95 transition-all"
            >
              <div className="flex items-center -space-x-1">
                <Smartphone className="w-3.5 h-3.5 text-emerald-300" />
                <Laptop className="w-3.5 h-3.5 text-blue-200" />
              </div>
              <span className="hidden sm:inline">Install App</span>
              <span className="sm:hidden">App</span>
              <span className="hidden md:inline-flex px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-white/20 text-white">
                All OS
              </span>
            </button>

            {/* About Us / Administrator Profile Shortcut */}
            {onOpenAboutUs && (
              <button
                onClick={onOpenAboutUs}
                title={
                  activeDevAdmin
                    ? `About Us • ${activeDevAdmin.name} (${activeDevAdmin.designation})`
                    : 'About Us & Administrator Profile'
                }
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 transition-colors"
              >
                <Info className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">About</span>
              </button>
            )}

            {/* Universal Downloads & Exports Button */}
            {onOpenDownloadHub && (
              <button
                onClick={onOpenDownloadHub}
                title="Download Reports, Security Audits, Student Registers, and Backups"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm border border-emerald-400/40 active:scale-95 transition-all"
              >
                <Download className="w-3.5 h-3.5 text-white" />
                <span className="hidden sm:inline">Downloads</span>
              </button>
            )}

            {/* Role Switcher Dropdown */}
            <div className="relative group">
              <select
                value={currentUser.id}
                onChange={(e) => {
                  const selected = users.find(u => u.id === e.target.value);
                  if (selected) onSelectUser(selected);
                }}
                className="appearance-none bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/60 rounded-xl px-2.5 py-1.5 pr-8 text-xs font-semibold text-indigo-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
              >
                {users.map(u => (
                  <option key={u.id} value={u.id} className="bg-slate-900 text-white">
                    {u.name} ({u.role === 'admin' ? 'Admin' : u.role === 'head_teacher' ? 'Principal' : 'Teacher'})
                  </option>
                ))}
              </select>
              <UserCheck className="w-3.5 h-3.5 text-indigo-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

          </div>

        </div>

        {/* Global Persistent Student Search Bar (Quick Profile Navigation from Any Screen) */}
        {onNavigateToStudent && (
          <div className="pb-2.5 pt-0.5" ref={globalSearchContainerRef}>
            <div className="relative max-w-2xl mx-auto">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={globalSearchInputRef}
                type="text"
                value={globalSearchQuery}
                onFocus={() => setIsSearchDropdownOpen(true)}
                onChange={(e) => {
                  setGlobalSearchQuery(e.target.value);
                  setIsSearchDropdownOpen(true);
                }}
                onKeyDown={handleGlobalSearchKeyDown}
                placeholder={
                  language === 'ur'
                    ? 'کسی بھی اسکرین سے طالب علم تلاش کریں (داخلہ نمبر یا نام)...'
                    : 'Quick search student by Admission No. or Name to open profile from any screen...'
                }
                aria-label="Global student search by admission number or name"
                className="w-full pl-10 pr-24 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-800 focus:bg-slate-950 border border-slate-700/90 focus:border-indigo-500 text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                {globalSearchQuery ? (
                  <button
                    type="button"
                    onClick={() => {
                      setGlobalSearchQuery('');
                      globalSearchInputRef.current?.focus();
                    }}
                    className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded bg-slate-900/90 border border-slate-700 text-[10px] font-mono text-slate-400">
                    Ctrl+K
                  </span>
                )}
                <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold">
                  {uniqueSearchableStudents.length} Students
                </span>
              </div>

              {/* Search Results Floating Dropdown */}
              {isSearchDropdownOpen && globalSearchQuery.trim().length > 0 && (
                <div className="absolute left-0 right-0 mt-1.5 rounded-2xl bg-slate-900 border border-slate-700/90 shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="px-3.5 py-2 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                    <span>
                      {globalSearchResults.length > 0
                        ? `Showing ${globalSearchResults.length} matching student${globalSearchResults.length === 1 ? '' : 's'}`
                        : 'No matching students'}
                    </span>
                    <span className="hidden sm:inline font-mono text-[10px] text-slate-500">
                      ↑↓ navigate • Enter to open profile
                    </span>
                  </div>

                  {globalSearchResults.length === 0 ? (
                    <div className="px-4 py-6 text-center text-xs text-slate-400">
                      No student found matching &ldquo;<span className="text-white font-semibold">{globalSearchQuery}</span>&rdquo;. Try searching by Admission Number (e.g., ADM-2026-001) or student name.
                    </div>
                  ) : (
                    <ul className="max-h-72 overflow-y-auto divide-y divide-slate-800/80">
                      {globalSearchResults.map((student, idx) => {
                        const isHighlighted = idx === highlightedSearchIdx;
                        const initials = student.fullName
                          .split(' ')
                          .map((p) => p[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase();
                        return (
                          <li key={student.id}>
                            <button
                              type="button"
                              onMouseEnter={() => setHighlightedSearchIdx(idx)}
                              onClick={() => handleSelectGlobalStudent(student)}
                              className={`w-full px-3.5 py-2.5 flex items-center justify-between gap-3 text-left transition-colors ${
                                isHighlighted ? 'bg-indigo-600/25' : 'hover:bg-slate-800/80'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                {student.photoDataUrl ? (
                                  <img
                                    src={student.photoDataUrl}
                                    alt={student.fullName}
                                    className="w-9 h-9 rounded-xl object-cover border border-slate-700 shrink-0"
                                  />
                                ) : (
                                  <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 flex items-center justify-center font-extrabold text-xs shrink-0">
                                    {initials}
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs sm:text-sm font-bold text-white truncate">
                                      {student.fullName}
                                    </span>
                                    <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-mono font-bold shrink-0">
                                      {student.admissionNumber}
                                    </span>
                                    {student.status !== 'Active' && (
                                      <span className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 text-[10px] font-semibold">
                                        {student.status}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-slate-400 truncate mt-0.5">
                                    Class {student.classNumber}-{student.section} • Roll #{student.rollNumber}
                                    {student.fatherName ? ` • S/D of ${student.fatherName}` : ''}
                                  </p>
                                </div>
                              </div>

                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 text-[10px] font-bold shrink-0">
                                <span>Profile</span>
                                <ArrowRight className="w-3 h-3" />
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>

    {activePushToast && (
      <div
        role="alert"
        data-testid="global-attendance-alert-toast"
        className="fixed bottom-5 left-5 z-[85] max-w-sm w-[calc(100vw-2.5rem)] rounded-2xl bg-slate-950 text-white border border-rose-500/60 shadow-2xl p-3.5 flex items-start gap-3 no-print"
      >
        <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-extrabold text-rose-300 uppercase tracking-wider">
              {activePushToast.category} Alert
            </span>
            <button
              type="button"
              onClick={() => setActivePushToast(null)}
              className="text-slate-400 hover:text-white"
              aria-label="Dismiss alert notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-xs font-bold text-white mt-0.5 truncate">
            {language === 'ur' && activePushToast.titleUrdu ? activePushToast.titleUrdu : activePushToast.title}
          </p>
          <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
            {language === 'ur' && activePushToast.messageUrdu ? activePushToast.messageUrdu : activePushToast.message}
          </p>
        </div>
      </div>
    )}
    </>
  );
};
