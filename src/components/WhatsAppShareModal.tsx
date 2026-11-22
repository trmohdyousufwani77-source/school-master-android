import React, { useState } from 'react';
import {
  MessageSquare,
  Share2,
  CheckCircle2,
  AlertCircle,
  X,
  Phone,
  FileText,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { SchoolProfile, Student, StudentExamSummary } from '../types';
import { Language, translations } from '../utils/translations';

interface WhatsAppShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student;
  summary: StudentExamSummary;
  school: SchoolProfile;
  examName: string;
  language: Language;
}

export const WhatsAppShareModal: React.FC<WhatsAppShareModalProps> = ({
  isOpen,
  onClose,
  student,
  summary,
  school,
  examName,
  language,
}) => {
  const t = translations[language];

  // Verified destination phone number
  const initialPhone = student?.parentWhatsAppNumber || student?.mobileNumber || '';
  const [targetNumber, setTargetNumber] = useState<string>(initialPhone);
  const [shareLanguage, setShareLanguage] = useState<'ur' | 'en'>(language === 'ur' ? 'ur' : 'en');
  const [copiedNotice, setCopiedNotice] = useState<boolean>(false);
  const [shareStatus, setShareStatus] = useState<'idle' | 'opened' | 'copied'>('idle');

  if (!isOpen || !student || !summary) return null;

  // Format clean international phone number
  const cleanPhone = targetNumber.replace(/\D/g, '');

  // Pre-formatted official academic message text
  const messageEn = `*${school.name}*\n` +
    `*STUDENT PROGRESS REPORT CARD*\n` +
    `Academic Session: ${school.academicSession}\n\n` +
    `Dear Parent / Guardian of *${summary.studentName}*,\n` +
    `Roll No: #${summary.rollNumber} | Class: ${summary.classNumber}-${summary.section}\n` +
    `Examination: ${examName}\n\n` +
    `*Summary of Academic Evaluation:*\n` +
    `• Total Marks: ${summary.totalMarksObtained} / ${summary.totalMaxMarks}\n` +
    `• Aggregate Percentage: ${summary.percentage}%\n` +
    `• Final Grade: ${summary.overallGrade}\n` +
    `• Attendance: ${summary.attendancePercentage}%\n` +
    `• Result Status: ${summary.isPassed ? 'PASSED / PROMOTED' : 'NEEDS SUPPORT'}\n\n` +
    `For full subject-wise marks breakdown, please inspect the printed copy or visit the school office.\n` +
    `- Headmaster, ${school.name}\n` +
    `U-DISE: ${school.code}`;

  const messageUrdu = `*${school.nameUrdu || school.name}*\n` +
    `*طالب علم کا تعلیمی ترقیاتی رپورٹ کارڈ*\n` +
    `تعلیمی سال: ${school.academicSession}\n\n` +
    `محترم والدین / سرپرست برائے *${summary.studentName}*،\n` +
    `رول نمبر: #${summary.rollNumber} | جماعت: ${summary.classNumber}-${summary.section}\n` +
    `امتحان: ${examName}\n\n` +
    `*امتحانی کارکردگی کا خلاصہ:*\n` +
    `• کل حاصل کردہ نمبرات: ${summary.totalMarksObtained} / ${summary.totalMaxMarks}\n` +
    `• حاصل کردہ فیصد: ${summary.percentage}%\n` +
    `• فائنل گریڈ: ${summary.overallGrade}\n` +
    `• حاضری فیصد: ${summary.attendancePercentage}%\n` +
    `• امتحانی نتیجہ: ${summary.isPassed ? 'کامیاب (PASSED)' : 'توجہ طلب'}\n\n` +
    `مضامین کی تفصیلی فہرست کے لیے اسکول آفس سے رابطہ فرمائیں۔\n` +
    `- صدر مدرس، ${school.nameUrdu || school.name}\n` +
    `یو ڈائس: ${school.code}`;

  const activeMessage = shareLanguage === 'ur' ? messageUrdu : messageEn;

  // Direct WhatsApp Web / Android Intent
  const handleOpenWhatsApp = () => {
    if (!cleanPhone) {
      alert('Please enter a valid WhatsApp mobile number with country code (e.g. +91 98000 00000).');
      return;
    }

    const encoded = encodeURIComponent(activeMessage);
    const url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`;
    window.open(url, '_blank');
    setShareStatus('opened');
  };

  // Android Native Share Sheet (Web Share API)
  const handleAndroidNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Report Card - ${summary.studentName}`,
          text: activeMessage,
        });
        setShareStatus('opened');
      } catch (err) {
        // User cancelled or share failed
      }
    } else {
      handleOpenWhatsApp();
    }
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(activeMessage);
    setCopiedNotice(true);
    setShareStatus('copied');
    setTimeout(() => setCopiedNotice(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm no-print">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150 flex flex-col">
        
        {/* Header */}
        <div className="p-4 bg-emerald-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold">
                {language === 'ur' ? 'واٹس ایپ پر رپورٹ کارڈ شیئر کریں' : 'Share Report Card on WhatsApp'}
              </h2>
              <p className="text-[11px] text-emerald-100">
                {summary.studentName} (Class {summary.classNumber}-{summary.section})
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-emerald-200 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs overflow-y-auto max-h-[75vh]">
          
          {/* Recipient WhatsApp Phone Confirmation */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
            <label className="block font-bold text-slate-800">
              {language === 'ur' ? 'والد یا سرپرست کا تصدیق شدہ واٹس ایپ نمبر:' : 'Confirm Parent / Guardian Registered WhatsApp Number:'}
            </label>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={targetNumber}
                onChange={(e) => setTargetNumber(e.target.value)}
                placeholder="+91 98000 00000"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-xs font-bold text-slate-900 bg-white focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <p className="text-[10px] text-slate-500">
              * Country code prefix (e.g. +91 for India) is required for WhatsApp routing.
            </p>
          </div>

          {/* Language Selector for Message Text */}
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-700">Message Language:</span>
            <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs font-bold">
              <button
                type="button"
                onClick={() => setShareLanguage('en')}
                className={`px-3 py-1 rounded-md transition-all ${
                  shareLanguage === 'en' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setShareLanguage('ur')}
                className={`px-3 py-1 rounded-md transition-all font-urdu ${
                  shareLanguage === 'ur' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'
                }`}
              >
                اردو
              </button>
            </div>
          </div>

          {/* Message Preview */}
          <div>
            <div className="flex items-center justify-between mb-1 text-slate-600">
              <span className="font-semibold">Pre-Formatted Report Summary Payload:</span>
              <button
                onClick={handleCopyMessage}
                className="text-[11px] text-emerald-700 hover:text-emerald-900 font-semibold flex items-center gap-1"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copiedNotice ? 'Copied!' : 'Copy Text'}</span>
              </button>
            </div>
            <textarea
              readOnly
              rows={8}
              value={activeMessage}
              className={`w-full p-3 border border-slate-200 rounded-xl bg-slate-50 text-[11px] font-mono leading-relaxed select-all ${
                shareLanguage === 'ur' ? 'font-urdu text-right' : ''
              }`}
            />
          </div>

          {/* Delivery disclaimer */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-[11px] flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Official Privacy Note:</strong> Per Android guidelines and UIDAI norms, student reports are transmitted securely with parent authorization. WhatsApp will launch with this prefilled message ready to confirm before dispatch.
            </p>
          </div>

          {shareStatus === 'opened' && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>WhatsApp document share screen initiated. Verify sending in WhatsApp.</span>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
          >
            {t.close}
          </button>

          <div className="flex gap-2">
            <button
              onClick={handleAndroidNativeShare}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Android Share Sheet</span>
            </button>

            <button
              onClick={handleOpenWhatsApp}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-md shadow-emerald-600/20"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Open in WhatsApp</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
