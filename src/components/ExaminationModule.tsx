import React, { useState } from 'react';
import {
  BookOpenCheck,
  Plus,
  Save,
  CheckCircle,
  AlertTriangle,
  Award,
  FileSpreadsheet,
  Printer,
  ChevronRight,
  Sparkles,
  Edit2,
  X,
} from 'lucide-react';
import {
  Examination,
  SchoolProfile,
  Student,
  StudentMarkEntry,
  SubjectConfig,
  User,
} from '../types';
import { Language, translations } from '../utils/translations';
import { deduplicateStudentsByAdmissionNumber, getGradeFromPercentage } from '../utils/calculations';
import { exportExaminationMarksToExcel } from '../utils/excelExport';
import { GradeDistributionBellCurve } from './GradeDistributionBellCurve';

interface ExaminationModuleProps {
  examinations: Examination[];
  students: Student[];
  marksEntries: StudentMarkEntry[];
  school: SchoolProfile;
  currentUser: User;
  subjectConfigs?: SubjectConfig[];
  onSaveMarks: (updatedMarks: StudentMarkEntry[]) => void;
  onAddExamination: (newExam: Examination) => void;
  onUpdateExamination?: (updatedExam: Examination) => void;
  language: Language;
}

export const ExaminationModule: React.FC<ExaminationModuleProps> = ({
  examinations,
  students,
  marksEntries,
  school,
  currentUser,
  subjectConfigs,
  onSaveMarks,
  onAddExamination,
  onUpdateExamination,
  language,
}) => {
  const t = translations[language];

  const [selectedExamId, setSelectedExamId] = useState<string>(examinations[0]?.id || '');
  const [selectedClass, setSelectedClass] = useState<string>('5');
  const [selectedSection, setSelectedSection] = useState<string>('A');
  const [selectedSubjectCode, setSelectedSubjectCode] = useState<string>('MTH'); // Default Math
  const [isNewExamModalOpen, setIsNewExamModalOpen] = useState<boolean>(false);
  const [isEditExamModalOpen, setIsEditExamModalOpen] = useState<boolean>(false);
  const [editExamName, setEditExamName] = useState<string>('');
  const [editExamNameUrdu, setEditExamNameUrdu] = useState<string>('');
  const [editExamSession, setEditExamSession] = useState<string>('');
  const [editExamStartDate, setEditExamStartDate] = useState<string>('');
  const [editExamEndDate, setEditExamEndDate] = useState<string>('');
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<string>('');

  const currentExam = examinations.find((e) => e.id === selectedExamId) || examinations[0];
  const rawClassSubjects = currentExam ? (currentExam.subjects[selectedClass] || []) : [];
  const classSubjects = React.useMemo(() => {
    if (!subjectConfigs || subjectConfigs.length === 0) return rawClassSubjects;
    const orderMap = new Map(subjectConfigs.map((s, idx) => [s.code, idx]));
    return [...rawClassSubjects].sort(
      (a, b) => (orderMap.get(a.code) ?? 999) - (orderMap.get(b.code) ?? 999)
    );
  }, [rawClassSubjects, subjectConfigs]);
  const currentSubject = classSubjects.find((s) => s.code === selectedSubjectCode) || classSubjects[0];

  // Active students in selected class/section (deduplicated by Admission Number)
  const classStudents = deduplicateStudentsByAdmissionNumber(students)
    .filter((s) => s.classNumber === selectedClass && s.section === selectedSection && s.status === 'Active')
    .sort((a, b) => a.rollNumber - b.rollNumber);

  // Local draft marks: { [studentId]: { marks: number | null, isAbsent: boolean } }
  const [draftMarks, setDraftMarks] = useState<{ [studentId: string]: { marks: number | null; isAbsent: boolean } }>({});

  // Sync draftMarks when exam, class, section, or subject changes
  React.useEffect(() => {
    if (!currentSubject) return;
    const initialMap: { [studentId: string]: { marks: number | null; isAbsent: boolean } } = {};

    classStudents.forEach((st) => {
      const entry = marksEntries.find(
        (m) =>
          m.examId === currentExam.id &&
          m.studentId === st.id &&
          m.subjectCode === currentSubject.code
      );
      if (entry) {
        initialMap[st.id] = {
          marks: entry.marksObtained,
          isAbsent: entry.isAbsent,
        };
      } else {
        initialMap[st.id] = {
          marks: null,
          isAbsent: false,
        };
      }
    });

    setDraftMarks(initialMap);
    setSaveSuccessNotice('');
  }, [selectedExamId, selectedClass, selectedSection, selectedSubjectCode, currentSubject, marksEntries]);

  const handleMarkChange = (studentId: string, val: string) => {
    if (val === '') {
      setDraftMarks((prev) => ({
        ...prev,
        [studentId]: { marks: null, isAbsent: false },
      }));
      return;
    }

    const num = Number(val);
    if (isNaN(num)) return;
    const max = currentSubject?.maxMarks || 100;
    const clamped = Math.min(max, Math.max(0, num));

    setDraftMarks((prev) => ({
      ...prev,
      [studentId]: { marks: clamped, isAbsent: false },
    }));
  };

  const handleToggleAbsent = (studentId: string) => {
    setDraftMarks((prev) => {
      const current = prev[studentId] || { marks: null, isAbsent: false };
      return {
        ...prev,
        [studentId]: {
          marks: null,
          isAbsent: !current.isAbsent,
        },
      };
    });
  };

  const handleSave = () => {
    if (!currentSubject || !currentExam) return;

    const updated: StudentMarkEntry[] = classStudents.map((st) => {
      const draft = draftMarks[st.id] || { marks: null, isAbsent: false };
      const max = currentSubject.maxMarks || 100;
      const marksObt = draft.marks;
      const isAb = draft.isAbsent;

      const pct = marksObt !== null && !isAb ? (marksObt / max) * 100 : 0;
      const gradeInfo = getGradeFromPercentage(pct, school.gradingScale);
      const passed = !isAb && (marksObt !== null ? marksObt >= currentSubject.passingMarks : false);

      return {
        id: `m-${currentExam.id}-${st.id}-${currentSubject.code}`,
        examId: currentExam.id,
        studentId: st.id,
        classNumber: selectedClass,
        section: selectedSection,
        subjectCode: currentSubject.code,
        maxMarks: max,
        marksObtained: marksObt,
        isAbsent: isAb,
        grade: isAb ? 'AB' : gradeInfo.grade,
        passed,
      };
    });

    onSaveMarks(updated);
    setSaveSuccessNotice(
      language === 'ur'
        ? `کلاس ${selectedClass}-${selectedSection} کے لیے ${currentSubject.name} کے نمبرات محفوظ ہو گئے!`
        : `Marks for Class ${selectedClass}-${selectedSection} (${currentSubject.name}) successfully saved!`
    );
  };

  const handleSaveEditExam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editExamName.trim() || !currentExam) return;

    const updatedExam: Examination = {
      ...currentExam,
      name: editExamName.trim(),
      nameUrdu: editExamNameUrdu.trim() || undefined,
      academicSession: editExamSession.trim() || currentExam.academicSession,
      startDate: editExamStartDate || currentExam.startDate,
      endDate: editExamEndDate || currentExam.endDate,
    };

    if (onUpdateExamination) {
      onUpdateExamination(updatedExam);
    }
    setIsEditExamModalOpen(false);
    setSaveSuccessNotice(
      language === 'ur'
        ? `امتحان کا عنوان کامیابی سے "${updatedExam.name}" میں تبدیل ہو گیا!`
        : `Examination heading successfully updated to "${updatedExam.name}".`
    );
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <BookOpenCheck className="w-6 h-6 text-indigo-600" />
            <span>{t.examinations}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {language === 'ur'
              ? 'امتحانی شیڈول، مضامین کے مارکس کا اندراج اور خودکار گریڈنگ کا نظام۔'
              : 'Examination schedule, marks register entry, absence handling, and automatic grade calculation.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {(currentUser.role === 'admin' || currentUser.role === 'head_teacher') && (
            <button
              onClick={() => setIsNewExamModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>{language === 'ur' ? 'نیا امتحان شامل کریں' : 'Create Examination'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Configured Examination Heading (Editable by Administrator) */}
      <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white p-5 rounded-2xl shadow-md border border-indigo-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-300 text-[10px] font-mono font-bold tracking-wider uppercase border border-indigo-400/30">
              Active Assessment Ledger
            </span>
            <span className="text-xs text-indigo-200 font-mono">
              Session: {currentExam?.academicSession || school.academicSession}
            </span>
          </div>
          <h2 className="text-lg sm:text-2xl font-black text-white tracking-wide mt-1.5 uppercase font-mono flex items-center gap-2">
            <span>EXAMINATION: {currentExam?.name ? currentExam.name.toUpperCase() : 'YEARLY EXAMINATION 2026'}</span>
          </h2>
          <p className="text-xs text-slate-300 mt-0.5">
            Dates: {currentExam?.startDate} to {currentExam?.endDate} • Standardized Evaluation & Grading Scale Compliant
          </p>
        </div>

        {(currentUser.role === 'admin' || currentUser.role === 'head_teacher') && (
          <button
            onClick={() => {
              setEditExamName(currentExam?.name || '');
              setEditExamNameUrdu(currentExam?.nameUrdu || '');
              setEditExamSession(currentExam?.academicSession || school.academicSession);
              setEditExamStartDate(currentExam?.startDate || '');
              setEditExamEndDate(currentExam?.endDate || '');
              setIsEditExamModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all active:scale-95 shrink-0"
          >
            <Edit2 className="w-3.5 h-3.5 text-amber-400" />
            <span>✏️ Edit / Rename Examination</span>
          </button>
        )}
      </div>

      {/* Control Selector Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-wrap items-center justify-between gap-3 no-print">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          
          {/* Examination */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Select Examination
            </label>
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-xl font-semibold text-slate-800 bg-slate-50"
            >
              {examinations.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {language === 'ur' ? (ex.nameUrdu || ex.name) : ex.name}
                </option>
              ))}
            </select>
          </div>

          {/* Class */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              {t.class}
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-xl font-semibold text-slate-800 bg-slate-50"
            >
              {school.classesOffered.map((c) => (
                <option key={c} value={c}>Class {c}</option>
              ))}
            </select>
          </div>

          {/* Section */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              {t.section}
            </label>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-xl font-semibold text-slate-800 bg-slate-50"
            >
              <option value="A">Section A</option>
              <option value="B">Section B</option>
              <option value="C">Section C</option>
            </select>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              {t.subject}
            </label>
            <select
              value={selectedSubjectCode}
              onChange={(e) => setSelectedSubjectCode(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-xl font-bold text-indigo-700 bg-indigo-50/50"
            >
              {classSubjects.map((sub) => (
                <option key={sub.code} value={sub.code}>
                  {sub.name} (Max {sub.maxMarks})
                </option>
              ))}
            </select>
          </div>

        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-md shadow-emerald-600/20"
        >
          <Save className="w-4 h-4" />
          <span>Save Marks Register</span>
        </button>
      </div>

      {saveSuccessNotice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{saveSuccessNotice}</span>
        </div>
      )}

      {/* Subject Info Card */}
      {currentSubject && (
        <div className="bg-gradient-to-r from-slate-900 to-indigo-950 p-4 rounded-2xl text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div>
            <span className="font-extrabold text-base text-amber-300">
              {currentSubject.name} ({currentSubject.nameHi})
            </span>
            <div className="mt-1 flex items-center gap-3 text-slate-300">
              <span>Maximum Marks: <strong className="text-white">{currentSubject.maxMarks}</strong></span>
              <span>•</span>
              <span>Passing Marks: <strong className="text-emerald-400">{currentSubject.passingMarks} (33%)</strong></span>
              <span>•</span>
              <span>Status: <strong className={currentSubject.isCompulsory ? "text-amber-300" : "text-slate-300"}>{currentSubject.isCompulsory ? "Compulsory" : "Optional"}</strong></span>
            </div>
          </div>
          <div className="text-[11px] text-slate-400 bg-white/10 px-3 py-1.5 rounded-xl border border-white/10">
            Rules: Failing a compulsory subject flags overall result for remediation.
          </div>
        </div>
      )}

      {/* D3-based Grade Distribution Bell Curve */}
      {currentExam && (
        <GradeDistributionBellCurve
          examination={currentExam}
          students={students}
          marksEntries={marksEntries}
          school={school}
          selectedClass={selectedClass}
          selectedSubjectCode={selectedSubjectCode}
        />
      )}

      {/* Marks Register Entry Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden printable-card">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>
            Class {selectedClass}-{selectedSection} Students ({classStudents.length})
          </span>
          <span className="text-[11px] text-slate-400">
            Input obtained marks or toggle 'Mark Absent' if student did not appear.
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4 w-16">Roll</th>
                <th className="py-3 px-4">Student Name</th>
                <th className="py-3 px-4">Student ID / SRN</th>
                <th className="py-3 px-4">Max Marks</th>
                <th className="py-3 px-4">Marks Obtained</th>
                <th className="py-3 px-4 text-center">Absent Toggle</th>
                <th className="py-3 px-4 text-center">Grade</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {classStudents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No active students enrolled in this class.
                  </td>
                </tr>
              ) : (
                classStudents.map((st) => {
                  const draft = draftMarks[st.id] || { marks: null, isAbsent: false };
                  const maxMarks = currentSubject?.maxMarks || 100;
                  const passingMarks = currentSubject?.passingMarks || 33;
                  const marksObt = draft.marks;
                  const isAb = draft.isAbsent;

                  const pct = marksObt !== null && !isAb ? (marksObt / maxMarks) * 100 : 0;
                  const gradeInfo = getGradeFromPercentage(pct, school.gradingScale);
                  const isPass = !isAb && marksObt !== null && marksObt >= passingMarks;

                  return (
                    <tr key={st.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                        #{st.rollNumber}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        <div>{st.fullName}</div>
                        <div className="text-[10px] text-slate-400 font-normal">{st.fatherName}</div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-500 text-[11px]">
                        {st.id}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-600">
                        {maxMarks}
                      </td>
                      <td className="py-3.5 px-4">
                        {isAb ? (
                          <span className="font-mono font-bold text-rose-600 px-3 py-1 bg-rose-50 rounded-lg border border-rose-200">
                            ABSENT
                          </span>
                        ) : (
                          <input
                            type="number"
                            min={0}
                            max={maxMarks}
                            placeholder="Marks"
                            value={marksObt !== null ? marksObt : ''}
                            onChange={(e) => handleMarkChange(st.id, e.target.value)}
                            className="w-24 px-3 py-1.5 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                          />
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleAbsent(st.id)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                            isAb
                              ? 'bg-rose-600 text-white shadow-sm'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {isAb ? 'Absent (AB)' : 'Mark Absent'}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`font-mono font-extrabold text-xs px-2 py-0.5 rounded ${
                          isAb ? 'bg-slate-100 text-slate-400' : 'bg-indigo-50 text-indigo-700'
                        }`}>
                          {isAb ? 'AB' : marksObt !== null ? gradeInfo.grade : '-'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {isAb ? (
                          <span className="text-[11px] font-bold text-rose-600">Absent</span>
                        ) : marksObt !== null ? (
                          <span className={`text-[11px] font-bold ${isPass ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {isPass ? 'PASSED' : 'FAILED'}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">Pending</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit / Rename Examination Modal */}
      {isEditExamModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm no-print">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 bg-gradient-to-r from-slate-950 to-indigo-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black">Edit / Rename Examination</h3>
                  <p className="text-[11px] text-slate-300">Update examination ledger title & academic parameters</p>
                </div>
              </div>
              <button
                onClick={() => setIsEditExamModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditExam} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Examination Name (English) *
                </label>
                <input
                  type="text"
                  required
                  value={editExamName}
                  onChange={(e) => setEditExamName(e.target.value)}
                  placeholder="e.g. Yearly Examination 2026"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  This title appears across the examination registers, report cards, and administrative summaries.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Examination Name (Urdu)
                </label>
                <input
                  type="text"
                  dir="rtl"
                  value={editExamNameUrdu}
                  onChange={(e) => setEditExamNameUrdu(e.target.value)}
                  placeholder="مثلاً سالانہ امتحانات ۲۰۲۶"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-900 font-urdu focus:ring-2 focus:ring-indigo-500 text-right"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Academic Session
                  </label>
                  <input
                    type="text"
                    value={editExamSession}
                    onChange={(e) => setEditExamSession(e.target.value)}
                    placeholder="2026-2027"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-semibold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={editExamStartDate}
                    onChange={(e) => setEditExamStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={editExamEndDate}
                  onChange={(e) => setEditExamEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold text-slate-900"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditExamModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold shadow-sm"
                >
                  Save & Update Heading
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
