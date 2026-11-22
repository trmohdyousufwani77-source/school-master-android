import React from 'react';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  CalendarDays,
  GraduationCap,
  CalendarClock,
  BookOpenCheck,
  BookOpen,
  Award,
  TrendingUp,
  FileSpreadsheet,
  Settings,
  ShieldCheck,
  Clock,
  Smartphone,
  Sparkles,
  Laptop,
  Download,
  Crown,
  Type,
  Info,
  IdCard,
  ClipboardCheck,
} from 'lucide-react';
import { Language, translations } from '../utils/translations';
import { UserRole } from '../types';

export type TabType =
  | 'dashboard'
  | 'students'
  | 'classes'
  | 'subjects'
  | 'marks-entry'
  | 'evaluation-register'
  | 'attendance'
  | 'holistic-assessment'
  | 'progress-cards'
  | 'teacher-subject-results'
  | 'banner-editor'
  | 'reports'
  | 'staff-management'
  | 'settings'
  | 'monthly-attendance'
  | 'textbooks'
  | 'teachers'
  | 'teacher-leave'
  | 'examinations'
  | 'student-results'
  | 'teacher-performance'
  | 'admin-access'
  | 'super-admin'
  | 'excel-import'
  | 'excel-template-mapping'
  | 'id-card-maker'
  | 'principal-management'
  | 'jkepm-appraisal'
  | 'about-us';

interface SidebarProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  language: Language;
  userRole: UserRole;
  pendingLeavesCount: number;
  onOpenTestRunner: () => void;
  onOpenApkGuide: () => void;
  onOpenMultiPlatformModal?: (platform?: 'android' | 'ios' | 'windows') => void;
  onOpenDownloadHub?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  language,
  userRole,
  pendingLeavesCount,
  onOpenTestRunner,
  onOpenApkGuide,
  onOpenMultiPlatformModal,
  onOpenDownloadHub,
}) => {
  const t = translations[language];

  // 11 Main Navigation Sections specified by Holistic Student Progress Card Management System
  const menuItems = [
    { id: 'dashboard' as TabType, label: t.dashboard || 'Dashboard', icon: LayoutDashboard },
    { id: 'principal-management' as TabType, label: language === 'ur' ? 'پرنسپل / ہیڈماسٹر' : 'Principal / Headmaster', icon: Crown },
    { id: 'students' as TabType, label: t.students || 'Students', icon: Users },
    { id: 'excel-import' as TabType, label: language === 'ur' ? 'اسمارٹ او سی آر و ایکسل امپورٹ' : 'Smart OCR & Excel Import', icon: FileSpreadsheet },
    { id: 'excel-template-mapping' as TabType, label: language === 'ur' ? 'ایکسل ٹیمپلیٹ میپنگ' : 'Excel Template Mapping', icon: FileSpreadsheet, adminOnly: true },
    { id: 'classes' as TabType, label: language === 'ur' ? 'جماعتیں' : 'Classes', icon: GraduationCap },
    { id: 'subjects' as TabType, label: language === 'ur' ? 'مضامین' : 'Subjects', icon: BookOpen },
    { id: 'marks-entry' as TabType, label: language === 'ur' ? 'اندراج نمبرات' : 'Marks Entry', icon: BookOpenCheck },
    { id: 'evaluation-register' as TabType, label: language === 'ur' ? 'تشخیصی رجسٹر' : 'Evaluation Register', icon: FileSpreadsheet },
    { id: 'attendance' as TabType, label: t.attendance || 'Attendance', icon: CalendarCheck },
    { id: 'holistic-assessment' as TabType, label: language === 'ur' ? 'جامع تشخیص' : 'Holistic Assessment', icon: Sparkles },
    { id: 'progress-cards' as TabType, label: language === 'ur' ? 'ترقیاتی کارڈ' : 'Progress Cards', icon: Award },
    { id: 'id-card-maker' as TabType, label: language === 'ur' ? 'اسمارٹ شناختی کارڈ میکر' : 'Smart ID Card Maker', icon: IdCard },
    {
      id: 'teacher-subject-results' as TabType,
      label: language === 'ur' ? 'استاد وار نتیجہ کارڈ' : 'Teacher Subject Results',
      icon: TrendingUp,
    },
    {
      id: 'banner-editor' as TabType,
      label: language === 'ur' ? 'اردو نام و بینر درستی' : 'School Name & Banner Fix',
      icon: Type,
    },
    { id: 'reports' as TabType, label: t.reports || 'Reports & Analytics', icon: FileSpreadsheet },
    {
      id: 'jkepm-appraisal' as TabType,
      label: language === 'ur' ? 'جے کے ای پی ایم اپریزل و سی پی آئی ایس' : 'JKEPM Appraisal & CPIS',
      icon: ClipboardCheck,
    },
    {
      id: 'teacher-leave' as TabType,
      label: t.teacherLeave || 'Teacher Leave',
      icon: CalendarClock,
      badge: pendingLeavesCount > 0 ? pendingLeavesCount : undefined,
    },
    {
      id: 'staff-management' as TabType,
      label: language === 'ur' ? 'اساتذہ و عملہ' : 'Staff Management',
      icon: ShieldCheck,
      badge: pendingLeavesCount > 0 ? pendingLeavesCount : undefined,
    },
    {
      id: 'settings' as TabType,
      label: t.schoolSettings || 'Settings',
      icon: Settings,
      adminOnly: true,
    },
    {
      id: 'about-us' as TabType,
      label: language === 'ur' ? 'ایپ اور ایڈمن پروفائل' : 'About Us & App Info',
      icon: Info,
    },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 min-h-[calc(100vh-4rem)] no-print">
      
      {/* Role Badge Container */}
      <div className="p-4 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            {t.currentRole}
          </span>
        </div>
        <div className="mt-1 text-sm font-semibold text-slate-900 flex items-center justify-between">
          <span>{userRole === 'admin' ? t.admin : userRole === 'head_teacher' ? t.headTeacher : t.teacher}</span>
          <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-indigo-50 text-indigo-700 border border-indigo-200/60 uppercase">
            {userRole}
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 py-3 px-3 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          if (item.adminOnly && userRole === 'teacher') {
            return null;
          }

          const Icon = item.icon;
          const isActive = currentTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
              }`}
            >
              <div className="flex items-center gap-3 truncate">
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span className="truncate">{item.label}</span>
              </div>

              {item.badge !== undefined && (
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full font-extrabold flex items-center gap-1 shadow-xs transition-all ${
                    isActive
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-rose-500 text-white animate-pulse'
                  }`}
                  title={`${item.badge} pending approval`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-white inline-block animate-ping" />
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom utilities */}
      <div className="p-3 border-t border-slate-100 space-y-2">
        {onOpenDownloadHub && (
          <button
            onClick={onOpenDownloadHub}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-emerald-950 bg-gradient-to-r from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100 transition-all border border-emerald-300 shadow-2xs"
          >
            <div className="flex items-center gap-2 truncate">
              <Download className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="truncate">Download & Export Hub</span>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-600 text-white font-extrabold shrink-0">
              PDF / Excel
            </span>
          </button>
        )}

        <button
          onClick={() => onOpenMultiPlatformModal ? onOpenMultiPlatformModal() : onOpenApkGuide()}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-indigo-900 bg-gradient-to-r from-indigo-50 to-blue-50 hover:from-indigo-100 hover:to-blue-100 transition-all border border-indigo-200/80 shadow-xs"
        >
          <div className="flex items-center gap-2 truncate">
            <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
            <span className="truncate">Android • iOS • Windows</span>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-indigo-600 text-white font-extrabold shrink-0">
            App
          </span>
        </button>

        <button
          onClick={onOpenTestRunner}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 transition-colors border border-emerald-200/60"
        >
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="truncate">{t.testRunner}</span>
        </button>

        <button
          onClick={onOpenApkGuide}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors border border-slate-200"
        >
          <Smartphone className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="truncate">{t.apkGuide}</span>
        </button>
      </div>

    </aside>
  );
};
