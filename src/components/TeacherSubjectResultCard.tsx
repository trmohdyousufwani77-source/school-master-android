import React, { useMemo, useState } from 'react';
import {
  Award,
  BookOpen,
  CheckCircle2,
  Edit3,
  FileSpreadsheet,
  Filter,
  Printer,
  Save,
  UserCheck,
  Users,
  XCircle,
} from 'lucide-react';
import {
  Examination,
  SchoolProfile,
  Student,
  StudentMarkEntry,
  TeacherProfile,
} from '../types';
import { Language } from '../utils/translations';
import {
  deduplicateMarksEntries,
  deduplicateStudentsByAdmissionNumber,
  formatSchoolAddressOnce,
} from '../utils/calculations';
import * as XLSX from 'xlsx';

interface TeacherSubjectResultCardProps {
  students: Student[];
  examinations: Examination[];
  marksEntries: StudentMarkEntry[];
  teachers: TeacherProfile[];
  school: SchoolProfile;
  onUpdateSchool: (updated: SchoolProfile) => void;
  language: Language;
}

interface SubjectStatRow {
  mappingKey: string;
  subjectCode: string;
  subjectName: string;
  subjectNameUrdu?: string;
  teacherName: string;
  totalStudents: number;
  appearedCount: number;
  passedCount: number;
  failedCount: number;
  absentCount: number;
  resultPercentage: number;
  averageMarks: number;
  maxMarks: number;
  passingMarks: number;
}

export const TeacherSubjectResultCard: React.FC<TeacherSubjectResultCardProps> = ({
  students,
  examinations,
  marksEntries,
  teachers,
  school,
  onUpdateSchool,
  language,
}) => {
  const [selectedExamId, setSelectedExamId] = useState<string>(examinations[0]?.id || '');
  const [selectedClass, setSelectedClass] = useState<string>('5');
  const [selectedSection, setSelectedSection] = useState<string>('A');
  const [selectedTeacherFilter, setSelectedTeacherFilter] = useState<string>('all');

  // Inline teacher linking editor state
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [teacherInput, setTeacherInput] = useState<string>('');
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  const currentExam = useMemo(
    () => examinations.find((e) => e.id === selectedExamId) || examinations[0],
    [examinations, selectedExamId]
  );

  // Deduplicate students strictly by Admission Number primary key and marks by composite key
  const uniqueStudents = useMemo(
    () => deduplicateStudentsByAdmissionNumber(students),
    [students]
  );
  const uniqueMarks = useMemo(
    () => deduplicateMarksEntries(marksEntries),
    [marksEntries]
  );

  const classStudents = useMemo(
    () =>
      uniqueStudents.filter(
        (s) =>
          s.classNumber === selectedClass &&
          (selectedSection === 'all' || s.section === selectedSection) &&
          s.status === 'Active'
      ),
    [uniqueStudents, selectedClass, selectedSection]
  );

  const subjectConfigs = useMemo(() => {
    if (!currentExam) return [];
    const perClass = currentExam.subjects[selectedClass];
    if (perClass && perClass.length > 0) return perClass;
    const firstKey = Object.keys(currentExam.subjects)[0];
    return firstKey ? currentExam.subjects[firstKey] : [];
  }, [currentExam, selectedClass]);

  // Resolve teacher linked to subject (saved mapping > assigned teacher in teachers array > Unassigned)
  const resolveTeacherForSubject = (subjectCode: string, subjectName: string): { key: string; name: string } => {
    const key = `${selectedClass}-${selectedSection}-${subjectCode}`;
    const saved = school.subjectTeacherMappings?.[key];
    if (saved && saved.teacherName?.trim()) {
      return { key, name: saved.teacherName.trim() };
    }

    const fallbackTeacher = teachers.find((tc) =>
      tc.assignedClasses.some(
        (ac) =>
          ac.classNumber === selectedClass &&
          (selectedSection === 'all' || ac.section === selectedSection) &&
          (ac.subject.toLowerCase().includes(subjectName.toLowerCase()) ||
            subjectName.toLowerCase().includes(ac.subject.toLowerCase()))
      )
    );

    if (fallbackTeacher) {
      return { key, name: fallbackTeacher.name };
    }

    return { key, name: 'Unassigned Teacher' };
  };

  // Compute subject-wise statistics from marksEntries & deduplicated students
  const subjectStats: SubjectStatRow[] = useMemo(() => {
    if (!currentExam) return [];

    const studentIds = new Set(classStudents.map((s) => s.id));
    const examMarks = uniqueMarks.filter(
      (m) =>
        m.examId === currentExam.id &&
        m.classNumber === selectedClass &&
        (selectedSection === 'all' || m.section === selectedSection) &&
        (studentIds.size === 0 || studentIds.has(m.studentId))
    );

    return subjectConfigs.map((sub) => {
      const subMarks = examMarks.filter((m) => m.subjectCode === sub.code);
      const { key, name: teacherName } = resolveTeacherForSubject(sub.code, sub.name);

      const absentCount = subMarks.filter((m) => m.isAbsent).length;
      const appearedMarks = subMarks.filter((m) => !m.isAbsent && m.marksObtained !== null);

      let passedCount = 0;
      let failedCount = 0;
      let sumMarks = 0;

      appearedMarks.forEach((m) => {
        const score = m.marksObtained ?? 0;
        sumMarks += score;
        if (score >= sub.passingMarks) {
          passedCount++;
        } else {
          failedCount++;
        }
      });

      // Treat absent students in registered exam marks as not passed
      const totalAssessedOrEnrolled = subMarks.length > 0 ? subMarks.length : classStudents.length;
      const totalFailedIncludingAbsent = failedCount + absentCount;
      const resultPercentage =
        totalAssessedOrEnrolled > 0
          ? Math.round((passedCount / totalAssessedOrEnrolled) * 10000) / 100
          : 0;
      const averageMarks =
        appearedMarks.length > 0 ? Math.round((sumMarks / appearedMarks.length) * 10) / 10 : 0;

      return {
        mappingKey: key,
        subjectCode: sub.code,
        subjectName: sub.name,
        subjectNameUrdu: sub.nameUrdu,
        teacherName,
        totalStudents: totalAssessedOrEnrolled,
        appearedCount: appearedMarks.length,
        passedCount,
        failedCount: totalFailedIncludingAbsent,
        absentCount,
        resultPercentage,
        averageMarks,
        maxMarks: sub.maxMarks,
        passingMarks: sub.passingMarks,
      };
    });
  }, [currentExam, subjectConfigs, uniqueMarks, classStudents, selectedClass, selectedSection, school.subjectTeacherMappings, teachers]);

  const filteredStats = useMemo(() => {
    if (selectedTeacherFilter === 'all') return subjectStats;
    return subjectStats.filter(
      (r) => r.teacherName.toLowerCase() === selectedTeacherFilter.toLowerCase()
    );
  }, [subjectStats, selectedTeacherFilter]);

  const distinctTeachers = useMemo(() => {
    const names = new Set<string>();
    subjectStats.forEach((r) => names.add(r.teacherName));
    return Array.from(names);
  }, [subjectStats]);

  const handleOpenLinkEditor = (row: SubjectStatRow) => {
    setEditingKey(row.mappingKey);
    setTeacherInput(row.teacherName === 'Unassigned Teacher' ? '' : row.teacherName);
  };

  const handleSaveTeacherLink = (row: SubjectStatRow) => {
    const trimmed = teacherInput.trim();
    if (!trimmed) return;
    const matchedTeacher = teachers.find((t) => t.name.toLowerCase() === trimmed.toLowerCase());
    const nextMappings = {
      ...(school.subjectTeacherMappings || {}),
      [row.mappingKey]: {
        teacherName: trimmed,
        teacherId: matchedTeacher?.id,
        classNumber: selectedClass,
        section: selectedSection,
        updatedAt: new Date().toISOString(),
      },
    };
    const updatedSchool: SchoolProfile = {
      ...school,
      subjectTeacherMappings: nextMappings,
    };
    onUpdateSchool(updatedSchool);
    try {
      localStorage.setItem('school_master_v1_school', JSON.stringify(updatedSchool));
    } catch {
      // Ignore storage quota warnings
    }
    setEditingKey(null);
    setTeacherInput('');
    setSaveFeedback(`Linked "${trimmed}" to ${row.subjectName} (Class ${selectedClass}-${selectedSection})`);
    setTimeout(() => setSaveFeedback(null), 3500);
  };

  const handleExportExcel = () => {
    const rows = filteredStats.map((r) => ({
      'Subject Code': r.subjectCode,
      'Subject Name': r.subjectName,
      'Linked Teacher': r.teacherName,
      Class: `Class ${selectedClass}-${selectedSection}`,
      'Academic Session': school.academicSession,
      Examination: currentExam?.name || '',
      'Total Students': r.totalStudents,
      'Students Passed': r.passedCount,
      'Students Failed': r.failedCount,
      'Result Percentage (%)': `${r.resultPercentage}%`,
      'Average Marks': `${r.averageMarks} / ${r.maxMarks}`,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Teacher_Subject_Result');
    XLSX.writeFile(
      wb,
      `Teacher_Subject_Result_Class_${selectedClass}_${selectedSection}_${school.code}.xlsx`
    );
  };

  const schoolAddressOnce = formatSchoolAddressOnce(school);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <Award className="w-6 h-6 text-indigo-600" />
            <span>
              {language === 'ur'
                ? 'استاد وار مضمون نتیجہ کارڈ (Teacher-Wise Subject Result Card)'
                : 'Teacher-Wise Subject Result Card'}
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {language === 'ur'
              ? 'طلباء کے امتحانی نمبرات سے مضمون وار کامیابی کا تناسب اور اساتذہ کی تفصیلات منسلک کریں۔'
              : 'Computes subject-wise pass/fail statistics from marks entries and lets administrators link teachers to subjects for result reporting.'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Export Excel</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Printer className="w-4 h-4" />
            <span>Print Result Card</span>
          </button>
        </div>
      </div>

      {saveFeedback && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 no-print">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{saveFeedback}</span>
        </div>
      )}

      {/* Filter Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-wrap items-center gap-4 text-xs no-print">
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Examination
          </label>
          <select
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-xl font-semibold text-slate-800 bg-slate-50"
          >
            {examinations.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Class
          </label>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-xl font-semibold text-slate-800 bg-slate-50"
          >
            {school.classesOffered.map((c) => (
              <option key={c} value={c}>
                Class {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Section
          </label>
          <select
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-xl font-semibold text-slate-800 bg-slate-50"
          >
            <option value="all">All Sections</option>
            <option value="A">Section A</option>
            <option value="B">Section B</option>
            <option value="C">Section C</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Filter by Teacher
          </label>
          <select
            value={selectedTeacherFilter}
            onChange={(e) => setSelectedTeacherFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-xl font-semibold text-slate-800 bg-slate-50"
          >
            <option value="all">All Teachers ({distinctTeachers.length})</option>
            {distinctTeachers.map((tName) => (
              <option key={tName} value={tName}>
                {tName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Printable Official Result Card Container */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden printable-card">
        {/* School Banner Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white border-b-4 border-amber-400">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-amber-300 font-bold block">
                TEACHER-WISE SUBJECT RESULT PERFORMANCE CARD
              </span>
              <h2 className="text-lg font-black uppercase tracking-tight">{school.name}</h2>
              <p className="text-xs text-slate-300">{schoolAddressOnce}</p>
            </div>
            <div className="text-left sm:text-right text-xs font-mono space-y-0.5">
              <div className="text-amber-300 font-bold">
                Class {selectedClass} {selectedSection === 'all' ? '(All Sections)' : `- Section ${selectedSection}`}
              </div>
              <div className="text-slate-200">Session: {school.academicSession}</div>
              <div className="text-slate-300 text-[11px]">{currentExam?.name}</div>
            </div>
          </div>
        </div>

        {/* Subject Cards Grid */}
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStats.map((row) => {
            const isEditing = editingKey === row.mappingKey;
            return (
              <div
                key={row.mappingKey}
                className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 hover:bg-white transition-all shadow-2xs flex flex-col justify-between space-y-3"
              >
                <div className="flex items-start justify-between gap-2 border-b border-slate-200 pb-2.5">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-indigo-600" />
                      <h3 className="font-extrabold text-sm text-slate-900">{row.subjectName}</h3>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">
                      Code: {row.subjectCode} • Pass Marks: {row.passingMarks}/{row.maxMarks}
                    </span>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-xl text-xs font-black font-mono border ${
                      row.resultPercentage >= 80
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : row.resultPercentage >= 50
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}
                  >
                    {row.resultPercentage}%
                  </span>
                </div>

                {/* Linked Teacher Name & Editor */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                      <UserCheck className="w-3 h-3 text-indigo-500" />
                      Subject Teacher
                    </span>
                    {!isEditing && (
                      <button
                        type="button"
                        onClick={() => handleOpenLinkEditor(row)}
                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 no-print"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Link / Edit</span>
                      </button>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="space-y-1.5 no-print">
                      <input
                        type="text"
                        list={`teacher-options-${row.subjectCode}`}
                        value={teacherInput}
                        onChange={(e) => setTeacherInput(e.target.value)}
                        placeholder="Enter or pick teacher name"
                        className="w-full px-2.5 py-1.5 text-xs border border-indigo-300 rounded-lg bg-white font-semibold"
                      />
                      <datalist id={`teacher-options-${row.subjectCode}`}>
                        {teachers.map((tc) => (
                          <option key={tc.id} value={tc.name} />
                        ))}
                      </datalist>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleSaveTeacherLink(row)}
                          className="flex-1 py-1 px-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold flex items-center justify-center gap-1"
                        >
                          <Save className="w-3 h-3" />
                          <span>Save Link</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingKey(null)}
                          className="py-1 px-2.5 rounded-lg bg-slate-200 text-slate-700 text-[11px] font-semibold"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs font-extrabold text-slate-900 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
                      {row.teacherName}
                    </p>
                  )}
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-3 gap-2 text-center pt-1">
                  <div className="p-2 rounded-xl bg-white border border-slate-200">
                    <span className="text-[9.5px] text-slate-500 font-bold uppercase block">Total</span>
                    <span className="text-sm font-black font-mono text-slate-900">{row.totalStudents}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200">
                    <span className="text-[9.5px] text-emerald-700 font-bold uppercase block">Passed</span>
                    <span className="text-sm font-black font-mono text-emerald-700">{row.passedCount}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-rose-50 border border-rose-200">
                    <span className="text-[9.5px] text-rose-700 font-bold uppercase block">Failed</span>
                    <span className="text-sm font-black font-mono text-rose-700">{row.failedCount}</span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-semibold text-slate-600">
                    <span>Pass Percentage</span>
                    <span className="font-mono font-bold text-slate-900">
                      Avg: {row.averageMarks}/{row.maxMarks}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        row.resultPercentage >= 80
                          ? 'bg-emerald-500'
                          : row.resultPercentage >= 50
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      }`}
                      style={{ width: `${Math.min(100, row.resultPercentage)}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Consolidated Summary Table */}
        <div className="px-5 pb-5 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs border border-slate-200 rounded-xl overflow-hidden">
            <thead>
              <tr className="bg-slate-900 text-white font-bold uppercase text-[10.5px]">
                <th className="py-2.5 px-3">Subject</th>
                <th className="py-2.5 px-3">Linked Teacher</th>
                <th className="py-2.5 px-3 text-center">Class &amp; Sec</th>
                <th className="py-2.5 px-3 text-center">Session</th>
                <th className="py-2.5 px-3 text-center">Total Students</th>
                <th className="py-2.5 px-3 text-center">Passed</th>
                <th className="py-2.5 px-3 text-center">Failed</th>
                <th className="py-2.5 px-3 text-right">Result %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredStats.map((r) => (
                <tr key={`row-${r.mappingKey}`} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-bold text-slate-900">
                    {r.subjectName} <span className="text-[10px] font-mono text-slate-500">({r.subjectCode})</span>
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-indigo-800">{r.teacherName}</td>
                  <td className="py-2.5 px-3 text-center font-mono">
                    {selectedClass}-{selectedSection === 'all' ? 'All' : selectedSection}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono">{school.academicSession}</td>
                  <td className="py-2.5 px-3 text-center font-mono font-bold">{r.totalStudents}</td>
                  <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-700">{r.passedCount}</td>
                  <td className="py-2.5 px-3 text-center font-mono font-bold text-rose-700">{r.failedCount}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900">{r.resultPercentage}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Official Stamp & Headmaster Signature Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-end justify-between gap-6">
          <div className="text-[11px] text-slate-500">
            <p className="font-bold text-slate-800">{school.name}</p>
            <p>U-DISE+: {school.code}</p>
          </div>
          <div className="text-center">
            {school.officialStampDataUrl && (
              <img src={school.officialStampDataUrl} alt="Official Stamp" className="h-12 w-auto mx-auto mb-1 object-contain" />
            )}
            <span className="text-[10px] font-semibold text-slate-500">Official School Stamp</span>
          </div>
          <div className="text-center min-w-[160px]">
            {school.headmasterSignatureDataUrl && (
              <img src={school.headmasterSignatureDataUrl} alt="Signature" className="h-10 w-auto mx-auto mb-1 object-contain" />
            )}
            <div className="border-t border-slate-500 pt-1">
              <p className="text-xs font-bold text-slate-900">
                {school.headmasterName || school.headTeacherName || 'Mohd Yousuf Wani'}
              </p>
              <p className="text-[10px] text-slate-600">
                {school.principalDesignation || 'Headmaster'} • Admin: {school.adminName || 'Mohd Yousuf Wani'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
