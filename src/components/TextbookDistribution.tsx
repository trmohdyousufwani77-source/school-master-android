import React, { useState } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  Filter,
  FileSpreadsheet,
  Printer,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Layers,
  Edit2,
  Eye,
  X,
  Sparkles,
} from 'lucide-react';
import {
  SchoolProfile,
  Student,
  TeacherProfile,
  TextbookDistributionRecord,
  TextbookStatus,
  User,
} from '../types';
import { Language, translations } from '../utils/translations';
import * as XLSX from 'xlsx';

interface TextbookDistributionProps {
  records: TextbookDistributionRecord[];
  students: Student[];
  teachers: TeacherProfile[];
  school: SchoolProfile;
  currentUser: User;
  onAddRecord: (newRecord: TextbookDistributionRecord) => void;
  onUpdateRecord: (updatedRecord: TextbookDistributionRecord) => void;
  language: Language;
}

export const TextbookDistribution: React.FC<TextbookDistributionProps> = ({
  records,
  students,
  teachers,
  school,
  currentUser,
  onAddRecord,
  onUpdateRecord,
  language,
}) => {
  const t = translations[language];

  // Filters
  const [selectedClass, setSelectedClass] = useState<string>('5');
  const [selectedSection, setSelectedSection] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modal states
  const [isRecordModalOpen, setIsRecordModalOpen] = useState<boolean>(false);
  const [editingRecord, setEditingRecord] = useState<TextbookDistributionRecord | null>(null);

  // Filtered records
  const filteredRecords = records.filter((r) => {
    const matchClass = selectedClass === 'all' || r.classNumber === selectedClass;
    const matchSection = selectedSection === 'all' || r.section === selectedSection;
    const matchStatus = selectedStatus === 'all' || r.status === selectedStatus;
    const matchSearch =
      r.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.studentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.textbookName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.subject.toLowerCase().includes(searchTerm.toLowerCase());

    return matchClass && matchSection && matchStatus && matchSearch;
  });

  // Analytics summary for class
  const classRecords = selectedClass === 'all' ? records : records.filter((r) => r.classNumber === selectedClass);
  const receivedCount = classRecords.filter((r) => r.status === 'Received_From_School').length;
  const unavailableCount = classRecords.filter((r) => r.status === 'Not_Available_In_School').length;
  const notReceivedCount = classRecords.filter((r) => r.status === 'Not_Received_By_Student').length;
  const pendingCount = classRecords.filter((r) => r.status === 'Pending_Distribution').length;

  // Export to Excel
  const handleExportExcel = () => {
    const headers = [
      'Record ID',
      'Student ID',
      'Student Name',
      'Class',
      'Section',
      'Subject',
      'Textbook Name',
      'Edition / Year',
      'Distribution Date',
      'Qty Required',
      'Qty Received',
      'Status',
      'Responsible Teacher',
      'Remarks',
    ];

    const dataRows = filteredRecords.map((r) => [
      r.id,
      r.studentId,
      r.studentName,
      r.classNumber,
      r.section,
      r.subject,
      r.textbookName,
      r.prescribedEdition,
      r.distributionDate,
      r.quantityRequired,
      r.quantityReceived,
      r.status.replace(/_/g, ' '),
      r.responsibleTeacherName,
      r.remarks || '-',
    ]);

    const ws = XLSX.utils.aoa_to_sheet([
      [`${school.name} - TEXTBOOK DISTRIBUTION REGISTER`],
      [`Class: ${selectedClass} | Academic Session: ${school.academicSession}`],
      [],
      headers,
      ...dataRows,
    ]);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Textbook_Register');
    XLSX.writeFile(wb, `Textbook_Distribution_Class_${selectedClass}_${school.code}.xlsx`);
  };

  const getStatusBadge = (status: TextbookStatus) => {
    switch (status) {
      case 'Received_From_School':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>{t.receivedFromSchool}</span>
          </span>
        );
      case 'Not_Available_In_School':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-300">
            <XCircle className="w-3 h-3 text-rose-600" />
            <span>{t.notAvailableInSchool}</span>
          </span>
        );
      case 'Not_Received_By_Student':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-300">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            <span>{t.notReceivedByStudent}</span>
          </span>
        );
      case 'Partially_Received':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-300">
            <Layers className="w-3 h-3 text-blue-600" />
            <span>{t.partiallyReceived}</span>
          </span>
        );
      case 'Pending_Distribution':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
            <Clock className="w-3 h-3 text-slate-500" />
            <span>{t.pendingDistribution}</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-indigo-600" />
            <span>{t.textbookRegister}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {language === 'ur'
              ? 'درسی کتب کی مفت تقسیم، اسکول اسٹاک، عدم دستیابی کی فہرست اور طالب علم وار تقسیم کا سرکاری ریکارڈ۔'
              : 'School textbook distribution register under Samagra Shiksha / RTE. Track stock availability, distribution, and shortages.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100 transition-colors shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>{t.exportExcel}</span>
          </button>

          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors shadow-sm"
          >
            <Printer className="w-4 h-4 text-indigo-600" />
            <span>{t.exportPdf}</span>
          </button>

          <button
            onClick={() => {
              setEditingRecord(null);
              setIsRecordModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-600/30"
          >
            <Plus className="w-4 h-4" />
            <span>{t.recordBookDistribution}</span>
          </button>
        </div>
      </div>

      {/* Stock & Distribution Summary Counters */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-500 font-semibold">{t.receivedFromSchool}</span>
            <p className="text-xl font-black text-emerald-600 mt-0.5">{receivedCount}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <XCircle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-500 font-semibold">{t.notAvailableInSchool}</span>
            <p className="text-xl font-black text-rose-600 mt-0.5">{unavailableCount}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-500 font-semibold">{t.notReceivedByStudent}</span>
            <p className="text-xl font-black text-amber-600 mt-0.5">{notReceivedCount}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-500 font-semibold">{t.pendingDistribution}</span>
            <p className="text-xl font-black text-slate-800 mt-0.5">{pendingCount}</p>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row gap-3 no-print">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={language === 'ur' ? 'طالب علم کا نام، شناختی نمبر، یا درسی کتاب سے تلاش کریں...' : 'Search student name, student ID, textbook...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
          />
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-semibold text-slate-700"
          >
            <option value="all">{language === 'ur' ? 'تمام جماعتیں' : 'All Classes'}</option>
            {school.classesOffered.map((c) => (
              <option key={c} value={c}>Class {c}</option>
            ))}
          </select>

          <select
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-semibold text-slate-700"
          >
            <option value="all">{language === 'ur' ? 'تمام سیکشنز' : 'All Sections'}</option>
            <option value="A">Section A</option>
            <option value="B">Section B</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-semibold text-slate-700"
          >
            <option value="all">{language === 'ur' ? 'تمام صورتحال' : 'All Statuses'}</option>
            <option value="Received_From_School">{t.receivedFromSchool}</option>
            <option value="Not_Available_In_School">{t.notAvailableInSchool}</option>
            <option value="Not_Received_By_Student">{t.notReceivedByStudent}</option>
            <option value="Pending_Distribution">{t.pendingDistribution}</option>
          </select>
        </div>
      </div>

      {/* Textbook Distribution Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden printable-card">
        
        {/* Printable Official Header */}
        <div className="p-4 border-b border-slate-100 text-center">
          <h2 className="text-base font-extrabold text-slate-900 uppercase">
            {school.name} ({school.nameUrdu})
          </h2>
          <p className="text-xs text-slate-600">
            OFFICIAL TEXTBOOK DISTRIBUTION & INVENTORY REGISTER • U-DISE: {school.code} • Session: {school.academicSession}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3">Student Name / ID</th>
                <th className="py-3 px-3">Class-Sec</th>
                <th className="py-3 px-3">Subject</th>
                <th className="py-3 px-3">Textbook Title</th>
                <th className="py-3 px-3 text-center">Req / Rec</th>
                <th className="py-3 px-3">Distribution Status</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Teacher / Remarks</th>
                <th className="py-3 px-3 text-right no-print">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No textbook distribution entries matching criteria.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-3 font-semibold text-slate-900">
                      <div>{r.studentName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{r.studentId}</div>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="font-bold font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-[11px]">
                        Class {r.classNumber}-{r.section}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 font-semibold text-indigo-700">
                      {r.subject}
                    </td>
                    <td className="py-3.5 px-3 text-slate-800 font-medium">
                      <div>{r.textbookName}</div>
                      {r.textbookNameUrdu && (
                        <div className="text-[11px] text-slate-500 font-urdu">{r.textbookNameUrdu}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-3 text-center font-mono font-bold">
                      {r.quantityRequired} / {r.quantityReceived}
                    </td>
                    <td className="py-3.5 px-3">
                      {getStatusBadge(r.status)}
                    </td>
                    <td className="py-3.5 px-3 font-mono text-slate-500 text-[11px]">
                      {r.distributionDate}
                    </td>
                    <td className="py-3.5 px-3 text-slate-600 max-w-xs">
                      <p className="truncate text-[11px] font-medium">{r.responsibleTeacherName}</p>
                      {r.remarks && <p className="text-[10px] text-slate-400 truncate">"{r.remarks}"</p>}
                    </td>
                    <td className="py-3.5 px-3 text-right no-print">
                      <button
                        onClick={() => {
                          setEditingRecord(r);
                          setIsRecordModalOpen(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer sign off for print */}
        <div className="p-6 border-t border-slate-200 mt-4 grid grid-cols-3 text-center text-xs text-slate-700">
          <div>
            <div className="h-10"></div>
            <p className="font-bold border-t border-slate-400 pt-1">Textbook In-Charge Teacher</p>
          </div>
          <div>
            <div className="h-10"></div>
            <p className="font-bold border-t border-slate-400 pt-1">Class Teacher Verification</p>
          </div>
          <div>
            <div className="h-10"></div>
            <p className="font-bold border-t border-slate-400 pt-1">Headmaster Seal & Signature</p>
          </div>
        </div>

      </div>

      {/* Record / Edit Textbook Modal */}
      {isRecordModalOpen && (
        <TextbookFormModal
          isOpen={isRecordModalOpen}
          onClose={() => {
            setIsRecordModalOpen(false);
            setEditingRecord(null);
          }}
          initialData={editingRecord}
          students={students}
          teachers={teachers}
          school={school}
          onSave={(data) => {
            if (editingRecord) {
              onUpdateRecord({ ...editingRecord, ...data });
            } else {
              onAddRecord({
                id: `tb-${Date.now()}`,
                academicSession: school.academicSession,
                ...data,
              } as TextbookDistributionRecord);
            }
            setIsRecordModalOpen(false);
            setEditingRecord(null);
          }}
          language={language}
        />
      )}

    </div>
  );
};

interface TextbookFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData: TextbookDistributionRecord | null;
  students: Student[];
  teachers: TeacherProfile[];
  school: SchoolProfile;
  onSave: (data: Partial<TextbookDistributionRecord>) => void;
  language: Language;
}

const TextbookFormModal: React.FC<TextbookFormModalProps> = ({
  isOpen,
  onClose,
  initialData,
  students,
  teachers,
  school,
  onSave,
  language,
}) => {
  const t = translations[language];

  const [studentId, setStudentId] = useState<string>(initialData?.studentId || students?.[0]?.id || '');
  const [subject, setSubject] = useState<string>(initialData?.subject || 'Urdu');
  const [textbookName, setTextbookName] = useState<string>(initialData?.textbookName || 'Ibtidai Urdu - Class 5');
  const [textbookNameUrdu, setTextbookNameUrdu] = useState<string>(initialData?.textbookNameUrdu || 'ابتدائی اردو');
  const [prescribedEdition, setPrescribedEdition] = useState<string>(initialData?.prescribedEdition || '2026-27 Edition');
  const [distributionDate, setDistributionDate] = useState<string>(initialData?.distributionDate || new Date().toISOString().slice(0, 10));
  const [quantityRequired, setQuantityRequired] = useState<number>(initialData?.quantityRequired ?? 1);
  const [quantityReceived, setQuantityReceived] = useState<number>(initialData?.quantityReceived ?? 1);
  const [status, setStatus] = useState<TextbookStatus>(initialData?.status || 'Received_From_School');
  const [responsibleTeacherName, setResponsibleTeacherName] = useState<string>(
    initialData?.responsibleTeacherName || teachers?.[0]?.name || 'Teacher'
  );
  const [remarks, setRemarks] = useState<string>(initialData?.remarks || '');

  if (!isOpen) return null;

  const selectedStudent = students.find((s) => s.id === studentId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;

    onSave({
      studentId,
      studentName: selectedStudent.fullName,
      classNumber: selectedStudent.classNumber,
      section: selectedStudent.section,
      subject,
      textbookName,
      textbookNameUrdu,
      prescribedEdition,
      distributionDate,
      quantityRequired: Number(quantityRequired),
      quantityReceived: Number(quantityReceived),
      status,
      responsibleTeacherName,
      remarks,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm no-print">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-amber-400" />
            <span>{initialData ? t.edit : t.recordBookDistribution}</span>
          </h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Select Student *</label>
            <select
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="w-full px-3 py-2 border rounded-xl bg-white font-medium"
            >
              {students.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.fullName} (Class {st.classNumber}-{st.section}, Roll #{st.rollNumber} - {st.id})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">{t.subject} *</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl bg-white"
              >
                <option value="Urdu">Urdu (اردو)</option>
                <option value="English">English</option>
                <option value="Mathematics">Mathematics (ریاضی)</option>
                <option value="Science">Science (سائنس)</option>
                <option value="Social Studies">Social Studies (سماجی علوم)</option>
                <option value="Hindi">Hindi (हिन्दी)</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">{t.prescribedEdition}</label>
              <input
                type="text"
                value={prescribedEdition}
                onChange={(e) => setPrescribedEdition(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">{t.textbookName} *</label>
              <input
                type="text"
                required
                value={textbookName}
                onChange={(e) => setTextbookName(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">کتاب کا نام (اردو)</label>
              <input
                type="text"
                value={textbookNameUrdu}
                onChange={(e) => setTextbookNameUrdu(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl font-urdu"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">{t.quantityRequired}</label>
              <input
                type="number"
                min={1}
                value={quantityRequired}
                onChange={(e) => setQuantityRequired(Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-xl font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">{t.quantityReceived}</label>
              <input
                type="number"
                min={0}
                value={quantityReceived}
                onChange={(e) => setQuantityReceived(Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-xl font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">{t.distributionDate}</label>
              <input
                type="date"
                value={distributionDate}
                onChange={(e) => setDistributionDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Distribution Status *</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as TextbookStatus)}
              className="w-full px-3 py-2 border rounded-xl bg-white font-bold text-indigo-700"
            >
              <option value="Received_From_School">{t.receivedFromSchool}</option>
              <option value="Not_Available_In_School">{t.notAvailableInSchool}</option>
              <option value="Not_Received_By_Student">{t.notReceivedByStudent}</option>
              <option value="Partially_Received">{t.partiallyReceived}</option>
              <option value="Pending_Distribution">{t.pendingDistribution}</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">{t.responsibleTeacher}</label>
            <select
              value={responsibleTeacherName}
              onChange={(e) => setResponsibleTeacherName(e.target.value)}
              className="w-full px-3 py-2 border rounded-xl bg-white"
            >
              {teachers.map((tc) => (
                <option key={tc.id} value={`${tc.name} (${tc.designation})`}>
                  {tc.name} ({tc.designation})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">{t.distributionRemarks}</label>
            <textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Free textbook issued under SSA scheme. Acknowledged by parent."
              className="w-full px-3 py-2 border rounded-xl text-xs"
            />
          </div>

          <div className="pt-3 border-t flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100">
              {t.cancel}
            </button>
            <button type="submit" className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700">
              {t.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
