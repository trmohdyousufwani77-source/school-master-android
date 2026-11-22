import React, { useState, useMemo, useEffect } from 'react';
import {
  Cake,
  Gift,
  Sparkles,
  Calendar,
  MessageCircle,
  Eye,
  ChevronDown,
  ChevronUp,
  PartyPopper,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Users,
  Search,
  RotateCcw,
  FileText,
  ExternalLink,
} from 'lucide-react';
import { Student, SchoolProfile, User } from '../types';
import { Language } from '../utils/translations';
import { deduplicateStudentsByAdmissionNumber } from '../utils/calculations';

interface UpcomingBirthdaysCardProps {
  students: Student[];
  school: SchoolProfile;
  currentUser?: User;
  language?: Language;
  onViewStudent?: (student: Student) => void;
  variant?: 'full' | 'compact';
  className?: string;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const MONTH_NAMES_UR = [
  'جنوری',
  'فروری',
  'مارچ',
  'اپریل',
  'مئی',
  'جون',
  'جولائی',
  'اگست',
  'ستمبر',
  'اکتوبر',
  'نومبر',
  'دسمبر',
];

interface BirthdayTemplate {
  id: string;
  label: string;
  body: string;
}

const DEFAULT_BIRTHDAY_TEMPLATES: BirthdayTemplate[] = [
  {
    id: 'formal',
    label: 'Formal School Blessing',
    body: '🎉 Happy Birthday {studentName}! 🎂\n\nOn behalf of {schoolName}, we wish you a joyful {age}th birthday filled with good health, wisdom, and bright academic success in Class {className}.\n\nWarm regards,\n{headmasterName}\n{schoolName}',
  },
  {
    id: 'joyful',
    label: 'Joyful Celebration',
    body: '🎈 Warmest Birthday Wishes to {studentName}! 🌟\n\nMay your special day bring endless smiles, learning, and wonderful memories with family and friends. Keep shining in Class {className}!\n\nWith blessings,\n{schoolName}',
  },
  {
    id: 'bilingual',
    label: 'English + Urdu',
    body: '🎂 Happy Birthday {studentName}!\nسالگرہ مبارک ہو {studentName}!\n\n{schoolName} کی جانب سے آپ کو خوشیوں، صحت اور تعلیم میں شاندار کامیابی کی دعائیں۔\nWishing you a bright year ahead in Class {className}.\n\n— {headmasterName}, {schoolName}',
  },
];

const SENT_WISHES_STORAGE_KEY = 'sm_birthday_wishes_sent_v1';
const CUSTOM_TEMPLATE_STORAGE_KEY = 'sm_birthday_custom_template_v1';

interface SentWishRecord {
  studentId: string;
  sentAtIso: string;
  dateKey: string;
}

function getTodayDateKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildWhatsAppUrl(rawPhone: string | undefined, message: string): string {
  const digits = (rawPhone || '').replace(/[^0-9]/g, '');
  const normalizedPhone = digits.length === 10 ? `91${digits}` : digits;
  const encoded = encodeURIComponent(message);
  return normalizedPhone ? `https://wa.me/${normalizedPhone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}

export const UpcomingBirthdaysCard: React.FC<UpcomingBirthdaysCardProps> = ({
  students,
  school,
  language = 'en',
  onViewStudent,
  className = '',
}) => {
  const now = new Date();
  const currentRealMonth = now.getMonth() + 1;
  const currentDay = now.getDate();
  const currentYear = now.getFullYear();
  const todayDateKey = getTodayDateKey();

  const [selectedMonth, setSelectedMonth] = useState<number>(currentRealMonth);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [greetingStudent, setGreetingStudent] = useState<Student | null>(null);
  const [greetingTurningAge, setGreetingTurningAge] = useState<number>(10);
  const [customWishText, setCustomWishText] = useState<string>('');
  const [copiedWish, setCopiedWish] = useState<boolean>(false);
  const [filterMode, setFilterMode] = useState<'all' | 'today' | 'upcoming'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Template & Bulk WhatsApp queue state
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('formal');
  const [editableTemplateBody, setEditableTemplateBody] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(CUSTOM_TEMPLATE_STORAGE_KEY);
      if (saved) return saved;
    } catch {
      // ignore
    }
    return DEFAULT_BIRTHDAY_TEMPLATES[0].body;
  });
  const [showBulkModal, setShowBulkModal] = useState<boolean>(false);
  const [bulkScope, setBulkScope] = useState<'today' | 'month'>('today');
  const [preventDuplicates, setPreventDuplicates] = useState<boolean>(true);
  const [sentMap, setSentMap] = useState<Record<string, SentWishRecord>>(() => {
    try {
      const raw = localStorage.getItem(SENT_WISHES_STORAGE_KEY);
      if (raw) return JSON.parse(raw) as Record<string, SentWishRecord>;
    } catch {
      // ignore
    }
    return {};
  });

  useEffect(() => {
    try {
      localStorage.setItem(SENT_WISHES_STORAGE_KEY, JSON.stringify(sentMap));
    } catch {
      // ignore
    }
  }, [sentMap]);

  const headmasterDisplayName =
    school.headmasterName || school.headTeacherName || 'Headmaster';

  const formatWishForStudent = (
    student: Student,
    turningAge: number,
    templateBody: string
  ): string => {
    return templateBody
      .replace(/\{studentName\}/g, student.fullName)
      .replace(/\{schoolName\}/g, school.name)
      .replace(/\{className\}/g, `${student.classNumber}-${student.section}`)
      .replace(/\{age\}/g, String(turningAge))
      .replace(/\{headmasterName\}/g, headmasterDisplayName);
  };

  const getSentKey = (studentId: string) => `${studentId}::${todayDateKey}`;
  const isWishSentToday = (studentId: string) => Boolean(sentMap[getSentKey(studentId)]);

  const markWishSent = (studentId: string) => {
    const key = getSentKey(studentId);
    setSentMap((prev) => ({
      ...prev,
      [key]: {
        studentId,
        sentAtIso: new Date().toISOString(),
        dateKey: todayDateKey,
      },
    }));
  };

  const unmarkWishSent = (studentId: string) => {
    const key = getSentKey(studentId);
    setSentMap((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // Process students with birthdays in selectedMonth
  const birthdayStudents = useMemo(() => {
    return deduplicateStudentsByAdmissionNumber(students)
      .filter((s) => s.status === 'Active' && s.dob)
      .map((student) => {
        const parts = student.dob.split('-');
        if (parts.length < 3) return null;
        const birthYear = parseInt(parts[0], 10);
        const birthMonth = parseInt(parts[1], 10);
        const birthDay = parseInt(parts[2], 10);

        if (isNaN(birthMonth) || isNaN(birthDay)) return null;
        if (birthMonth !== selectedMonth) return null;

        const turningAge = currentYear - birthYear;

        let status: 'today' | 'upcoming' | 'passed' = 'upcoming';
        let diffDays = 0;

        if (selectedMonth === currentRealMonth) {
          if (birthDay === currentDay) {
            status = 'today';
            diffDays = 0;
          } else if (birthDay > currentDay) {
            status = 'upcoming';
            diffDays = birthDay - currentDay;
          } else {
            status = 'passed';
            diffDays = currentDay - birthDay;
          }
        } else if (selectedMonth > currentRealMonth) {
          status = 'upcoming';
        } else {
          status = 'passed';
        }

        return {
          student,
          birthYear,
          birthMonth,
          birthDay,
          turningAge: turningAge > 0 ? turningAge : 10,
          status,
          diffDays,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => a.birthDay - b.birthDay);
  }, [students, selectedMonth, currentRealMonth, currentDay, currentYear]);

  // All today's birthdays across the entire school (regardless of selectedMonth dropdown)
  const todaysBirthdays = useMemo(() => {
    return deduplicateStudentsByAdmissionNumber(students)
      .filter((s) => s.status === 'Active' && s.dob)
      .map((student) => {
        const parts = student.dob.split('-');
        if (parts.length < 3) return null;
        const birthYear = parseInt(parts[0], 10);
        const birthMonth = parseInt(parts[1], 10);
        const birthDay = parseInt(parts[2], 10);
        if (birthMonth !== currentRealMonth || birthDay !== currentDay) return null;
        const turningAge = currentYear - birthYear;
        return {
          student,
          birthYear,
          birthMonth,
          birthDay,
          turningAge: turningAge > 0 ? turningAge : 10,
          status: 'today' as const,
          diffDays: 0,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [students, currentRealMonth, currentDay, currentYear]);

  const displayedStudents = useMemo(() => {
    return birthdayStudents.filter((item) => {
      if (filterMode === 'today' && item.status !== 'today') return false;
      if (filterMode === 'upcoming' && item.status !== 'upcoming' && item.status !== 'today') return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesName = item.student.fullName.toLowerCase().includes(q);
        const matchesClass = `class ${item.student.classNumber}`.toLowerCase().includes(q);
        const matchesId = item.student.id.toLowerCase().includes(q);
        return matchesName || matchesClass || matchesId;
      }
      return true;
    });
  }, [birthdayStudents, filterMode, searchTerm]);

  const todayCount = birthdayStudents.filter((b) => b.status === 'today').length;
  const upcomingCount = birthdayStudents.filter((b) => b.status === 'upcoming').length;
  const totalInMonth = birthdayStudents.length;
  const sentTodayCount = birthdayStudents.filter((b) => isWishSentToday(b.student.id)).length;

  const currentMonthName =
    language === 'ur' ? MONTH_NAMES_UR[selectedMonth - 1] : MONTH_NAMES[selectedMonth - 1];

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const tpl = DEFAULT_BIRTHDAY_TEMPLATES.find((item) => item.id === templateId);
    if (!tpl) return;
    setEditableTemplateBody(tpl.body);
    try {
      localStorage.setItem(CUSTOM_TEMPLATE_STORAGE_KEY, tpl.body);
    } catch {
      // ignore
    }
    if (greetingStudent) {
      setCustomWishText(formatWishForStudent(greetingStudent, greetingTurningAge, tpl.body));
    }
  };

  const handleTemplateBodyChange = (val: string) => {
    setEditableTemplateBody(val);
    try {
      localStorage.setItem(CUSTOM_TEMPLATE_STORAGE_KEY, val);
    } catch {
      // ignore
    }
  };

  const handleOpenWish = (item: (typeof birthdayStudents)[0]) => {
    setGreetingStudent(item.student);
    setGreetingTurningAge(item.turningAge);
    setCustomWishText(formatWishForStudent(item.student, item.turningAge, editableTemplateBody));
    setCopiedWish(false);
  };

  const handleCopyWish = () => {
    navigator.clipboard.writeText(customWishText);
    setCopiedWish(true);
    setTimeout(() => setCopiedWish(false), 3000);
  };

  const handleOpenBulkModal = () => {
    setBulkScope(todaysBirthdays.length > 0 ? 'today' : 'month');
    setShowBulkModal(true);
  };

  const bulkQueueItems = useMemo(() => {
    const base = bulkScope === 'today' ? todaysBirthdays : birthdayStudents;
    return base.map((item) => {
      const sent = isWishSentToday(item.student.id);
      const message = formatWishForStudent(item.student, item.turningAge, editableTemplateBody);
      const phone = item.student.parentWhatsAppNumber || item.student.mobileNumber;
      const waUrl = buildWhatsAppUrl(phone, message);
      return {
        ...item,
        sent,
        phone,
        message,
        waUrl,
      };
    });
  }, [bulkScope, todaysBirthdays, birthdayStudents, sentMap, editableTemplateBody, school.name, headmasterDisplayName]);

  const bulkSentCount = bulkQueueItems.filter((i) => i.sent).length;
  const bulkPendingCount = bulkQueueItems.length - bulkSentCount;

  return (
    <div
      className={`bg-white rounded-3xl border border-amber-200/90 shadow-sm overflow-hidden transition-all duration-200 ${className}`}
    >
      {/* Card Header Banner */}
      <div className="bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600 p-4 sm:p-5 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/30 shadow-inner shrink-0">
              <Cake className="w-6 h-6 text-amber-200 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                  <span>Upcoming Birthdays</span>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-white/25 text-white border border-white/30 backdrop-blur-sm">
                  {currentMonthName} {currentYear}
                </span>
                {todaysBirthdays.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-amber-400 text-slate-950 animate-pulse flex items-center gap-1 shadow-sm">
                    <PartyPopper className="w-3 h-3" />
                    <span>{todaysBirthdays.length} Today!</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-amber-100/90 mt-0.5 font-medium">
                Send personalized WhatsApp birthday wishes with templates, duplicate protection &amp; Sent/Pending tracking.
              </p>
            </div>
          </div>

          {/* Right Header Actions: Bulk WhatsApp Queue, Month Selector & Collapse Toggle */}
          <div className="flex items-center gap-2 flex-wrap self-start sm:self-center">
            <button
              type="button"
              onClick={handleOpenBulkModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-sm transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>
                Bulk WhatsApp ({todaysBirthdays.length > 0 ? `${todaysBirthdays.length} Today` : totalInMonth})
              </span>
            </button>

            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xs border border-white/30 focus:outline-none backdrop-blur-md cursor-pointer transition-colors"
            >
              {MONTH_NAMES.map((m, idx) => {
                const monthNum = idx + 1;
                const isCurrent = monthNum === currentRealMonth;
                return (
                  <option key={m} value={monthNum} className="text-slate-900 font-semibold">
                    {m} {isCurrent ? '(Current)' : ''}
                  </option>
                );
              })}
            </select>

            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              title={isCollapsed ? 'Expand Birthdays' : 'Collapse Birthdays'}
              className="p-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white transition-colors"
            >
              {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Quick Summary Metric Pills */}
        {!isCollapsed && (
          <div className="mt-4 pt-3 border-t border-white/20 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-bold text-white/90">Month Summary:</span>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-black/20 text-white font-semibold">
              <Cake className="w-3.5 h-3.5 text-amber-300" />
              <span>Total: <strong className="font-extrabold">{totalInMonth}</strong></span>
            </div>
            {todayCount > 0 && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-400 text-slate-950 font-extrabold shadow-sm">
                <PartyPopper className="w-3.5 h-3.5" />
                <span>Today: {todayCount}</span>
              </div>
            )}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-black/20 text-white font-semibold">
              <Calendar className="w-3.5 h-3.5 text-indigo-200" />
              <span>Upcoming: <strong className="font-extrabold">{upcomingCount}</strong></span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-950/35 text-emerald-100 border border-emerald-300/30 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
              <span>Sent Today: <strong className="font-extrabold">{sentTodayCount}</strong></span>
            </div>
            {selectedMonth !== currentRealMonth && (
              <button
                type="button"
                onClick={() => setSelectedMonth(currentRealMonth)}
                className="ml-auto text-[11px] font-bold text-amber-200 hover:text-white underline decoration-amber-300 underline-offset-2 transition-colors"
              >
                Return to Current Month ({MONTH_NAMES[currentRealMonth - 1]})
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {!isCollapsed && (
        <div className="p-4 sm:p-5 space-y-4">
          {/* Sub-toolbar: Search & Quick Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/80 w-fit">
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`px-3 py-1 rounded-lg font-bold transition-all ${
                  filterMode === 'all'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({totalInMonth})
              </button>
              {todayCount > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterMode('today')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    filterMode === 'today'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-amber-700 hover:bg-amber-100/50'
                  }`}
                >
                  🎉 Today ({todayCount})
                </button>
              )}
              <button
                type="button"
                onClick={() => setFilterMode('upcoming')}
                className={`px-3 py-1 rounded-lg font-bold transition-all ${
                  filterMode === 'upcoming'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Upcoming ({upcomingCount})
              </button>
            </div>

            {totalInMonth > 3 && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter birthdays..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-1 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-44"
                />
              </div>
            )}
          </div>

          {/* Student Birthday Cards List */}
          {displayedStudents.length === 0 ? (
            <div className="text-center py-8 px-4 bg-slate-50/70 rounded-2xl border border-dashed border-slate-200">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-2 border border-amber-200">
                <Gift className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">
                No Birthdays Found in {currentMonthName}
              </h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {searchTerm
                  ? 'No students matched your search criteria.'
                  : `There are currently no active students with recorded birthdays in ${currentMonthName}.`}
              </p>
              {selectedMonth === currentRealMonth ? (
                <button
                  type="button"
                  onClick={() => setSelectedMonth((prev) => (prev === 12 ? 1 : prev + 1))}
                  className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs border border-indigo-200 transition-colors"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>View Next Month ({MONTH_NAMES[selectedMonth % 12]})</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setSelectedMonth(currentRealMonth)}
                  className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-xs transition-colors"
                >
                  <span>Return to Current Month</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {displayedStudents.map((item) => {
                const s = item.student;
                const isToday = item.status === 'today';
                const isUpcoming = item.status === 'upcoming';
                const wishSent = isWishSentToday(s.id);

                return (
                  <div
                    key={s.id}
                    className={`p-3.5 rounded-2xl border transition-all relative overflow-hidden flex flex-col justify-between ${
                      isToday
                        ? 'bg-gradient-to-br from-amber-50 via-rose-50/40 to-amber-100/30 border-amber-300 shadow-sm ring-1 ring-amber-300'
                        : isUpcoming
                        ? 'bg-white hover:bg-slate-50/80 border-slate-200/90 shadow-2xs hover:shadow-xs'
                        : 'bg-slate-50/60 border-slate-200 text-slate-600'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div
                            className={`w-9 h-9 rounded-xl font-black text-xs flex items-center justify-center shrink-0 shadow-xs overflow-hidden ${
                              isToday
                                ? 'bg-gradient-to-tr from-amber-500 to-rose-500 text-white ring-2 ring-amber-300/60'
                                : 'bg-gradient-to-tr from-indigo-500 to-indigo-700 text-white'
                            }`}
                          >
                            {s.photoDataUrl ? (
                              <img src={s.photoDataUrl} alt={s.fullName} className="w-full h-full object-cover" />
                            ) : (
                              s.fullName.slice(0, 1)
                            )}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-extrabold text-sm text-slate-900 truncate hover:text-indigo-600 transition-colors">
                              {s.fullName}
                            </h4>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span className="font-bold text-[10px] px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                                Class {s.classNumber}-{s.section}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400">
                                #{s.rollNumber} • {s.id}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 text-right flex flex-col items-end gap-1">
                          {isToday ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-400 text-slate-950 shadow-xs">
                              <Sparkles className="w-2.5 h-2.5 text-slate-900" />
                              <span>Today!</span>
                            </span>
                          ) : isUpcoming ? (
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              <Calendar className="w-2.5 h-2.5" />
                              <span>In {item.diffDays} {item.diffDays === 1 ? 'day' : 'days'}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500">
                              {item.diffDays}d ago
                            </span>
                          )}

                          {wishSent ? (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              <span>Sent</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                              <Clock className="w-2.5 h-2.5" />
                              <span>Pending</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 p-2 rounded-xl bg-white/70 border border-slate-200/80 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <Cake className="w-4 h-4 text-amber-500 shrink-0" />
                          <div>
                            <span className="font-bold text-slate-800">
                              {currentMonthName} {item.birthDay}
                            </span>
                            <span className="text-[10px] text-slate-400 ml-1 font-mono">
                              ({s.dob})
                            </span>
                          </div>
                        </div>
                        <span className="text-[11px] font-extrabold text-indigo-600 bg-indigo-50/80 px-2 py-0.5 rounded-lg border border-indigo-100">
                          Turning {item.turningAge} yrs
                        </span>
                      </div>

                      <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between">
                        <span className="truncate">
                          Parent: <strong className="text-slate-700 font-semibold">{s.fatherName}</strong>
                        </span>
                        <span className="font-mono text-slate-600 shrink-0">
                          {s.parentWhatsAppNumber || s.mobileNumber}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenWish(item)}
                        className={`flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl font-bold text-xs transition-all shadow-2xs active:scale-95 ${
                          wishSent
                            ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300'
                            : isToday
                            ? 'bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-white shadow-amber-500/20'
                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300/80'
                        }`}
                      >
                        {wishSent ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Gift className="w-3.5 h-3.5" />}
                        <span>{wishSent ? 'Wish Sent (View)' : 'Send Wishes'}</span>
                      </button>

                      {onViewStudent && (
                        <button
                          type="button"
                          onClick={() => onViewStudent(s)}
                          title="View Complete Student Profile"
                          className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 text-xs font-bold transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Single Student Birthday Greeting / WhatsApp Modal */}
      {greetingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
            <div className="p-4 bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                  <Cake className="w-4 h-4 text-amber-200" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Send Birthday Wishes</h3>
                  <p className="text-[11px] text-amber-100 font-medium">
                    To {greetingStudent.fullName} • Class {greetingStudent.classNumber}-{greetingStudent.section}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGreetingStudent(null)}
                className="p-1 rounded-lg hover:bg-white/20 text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Recipient Parent:</span>
                  <span className="font-bold text-slate-800">{greetingStudent.fatherName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Registered WhatsApp:</span>
                  <span className="font-mono font-bold text-emerald-600">
                    {greetingStudent.parentWhatsAppNumber || greetingStudent.mobileNumber}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Today&apos;s Status:</span>
                  {isWishSentToday(greetingStudent.id) ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                      <CheckCircle2 className="w-3 h-3" />
                      Already Sent Today
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">
                      <Clock className="w-3 h-3" />
                      Pending
                    </span>
                  )}
                </div>
              </div>

              {/* Template Selector */}
              <div>
                <p className="font-bold text-slate-700 mb-1.5">Quick Greeting Template:</p>
                <div className="flex flex-wrap gap-1.5">
                  {DEFAULT_BIRTHDAY_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => handleSelectTemplate(tpl.id)}
                      className={`px-2.5 py-1.5 rounded-xl font-bold text-[11px] border transition-colors ${
                        selectedTemplateId === tpl.id
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Custom Greeting Message:</span>
                  <span className="text-[11px] text-slate-400 font-normal">Editable before sending</span>
                </label>
                <textarea
                  rows={6}
                  value={customWishText}
                  onChange={(e) => setCustomWishText(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans leading-relaxed"
                />
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={handleCopyWish}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors"
                >
                  {copiedWish ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedWish ? 'Copied to Clipboard!' : 'Copy Message'}</span>
                </button>

                <a
                  href={buildWhatsAppUrl(
                    greetingStudent.parentWhatsAppNumber || greetingStudent.mobileNumber,
                    customWishText
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => markWishSent(greetingStudent.id)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold shadow-sm shadow-emerald-600/30 transition-all active:scale-95"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Send via WhatsApp</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk WhatsApp Wishes Queue & Template Customizer Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
            <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 text-white flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5 text-emerald-100" />
                </div>
                <div>
                  <h3 className="text-base font-black">Bulk WhatsApp Birthday Wishes Queue</h3>
                  <p className="text-xs text-emerald-100">
                    Review auto-personalized messages, prevent duplicate sends on {todayDateKey}, and track Sent vs Pending.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="p-1.5 rounded-xl hover:bg-white/20 text-white font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Scope + Duplicate Guard + KPI Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setBulkScope('today')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
                      bulkScope === 'today' ? 'bg-amber-500 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Today&apos;s Birthdays ({todaysBirthdays.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkScope('month')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
                      bulkScope === 'month' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {currentMonthName} ({birthdayStudents.length})
                  </button>
                </div>

                <label className="inline-flex items-center gap-2 font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preventDuplicates}
                    onChange={(e) => setPreventDuplicates(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Prevent Duplicate Sends Today</span>
                </label>

                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-extrabold">
                    Sent: {bulkSentCount}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 font-extrabold">
                    Pending: {bulkPendingCount}
                  </span>
                </div>
              </div>

              {/* Customizable Template Editor */}
              <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-200/80 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-black text-indigo-950 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-indigo-600" />
                    Message Template (auto-inserts Student Name &amp; School Name)
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {DEFAULT_BIRTHDAY_TEMPLATES.map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => handleSelectTemplate(tpl.id)}
                        className={`px-2.5 py-1 rounded-lg font-bold text-[11px] border ${
                          selectedTemplateId === tpl.id
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-slate-700 border-indigo-200 hover:bg-indigo-50'
                        }`}
                      >
                        {tpl.label}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  rows={4}
                  value={editableTemplateBody}
                  onChange={(e) => handleTemplateBodyChange(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-indigo-200 bg-white text-xs text-slate-800 font-sans leading-relaxed"
                />
                <p className="text-[10px] text-indigo-700">
                  Available variables: <code>{'{studentName}'}</code>, <code>{'{schoolName}'}</code>,{' '}
                  <code>{'{className}'}</code>, <code>{'{age}'}</code>, <code>{'{headmasterName}'}</code>
                </p>
              </div>

              {/* Recipient Queue List */}
              {bulkQueueItems.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-slate-50 border border-dashed border-slate-200">
                  <Cake className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                  <p className="font-bold text-slate-800">
                    {bulkScope === 'today'
                      ? 'No students have a birthday today.'
                      : `No birthdays found in ${currentMonthName}.`}
                  </p>
                  {bulkScope === 'today' && birthdayStudents.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setBulkScope('month')}
                      className="mt-3 px-3.5 py-1.5 rounded-xl bg-indigo-600 text-white font-bold text-xs"
                    >
                      Switch to {currentMonthName} Birthdays ({birthdayStudents.length})
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {bulkQueueItems.map((item) => {
                    const blocked = preventDuplicates && item.sent;
                    return (
                      <div
                        key={item.student.id}
                        className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          item.sent
                            ? 'bg-emerald-50/60 border-emerald-200'
                            : 'bg-white border-slate-200'
                        }`}
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-slate-900 text-sm">
                              {item.student.fullName}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold text-[10px]">
                              Class {item.student.classNumber}-{item.student.section}
                            </span>
                            <span className="font-mono text-[11px] text-slate-500">
                              {item.phone || 'No Phone'}
                            </span>
                            {item.sent ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px]">
                                <CheckCircle2 className="w-3 h-3" />
                                Sent
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-extrabold text-[10px]">
                                <Clock className="w-3 h-3" />
                                Pending
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-600 line-clamp-2 whitespace-pre-line">
                            {item.message}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {item.sent && (
                            <button
                              type="button"
                              onClick={() => unmarkWishSent(item.student.id)}
                              className="p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-600 border border-slate-200"
                              title="Reset to Pending"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {blocked ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-100 text-emerald-800 font-bold text-xs border border-emerald-200">
                              <Check className="w-3.5 h-3.5" />
                              Duplicate Guard Active
                            </span>
                          ) : (
                            <a
                              href={item.waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => markWishSent(item.student.id)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-xs"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span>Send WhatsApp</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
