import React, { useState } from 'react';
import {
  TrendingUp,
  FileSpreadsheet,
  Printer,
  Award,
  Users,
  AlertCircle,
  BarChart3,
  BookOpen,
} from 'lucide-react';
import {
  Examination,
  SchoolProfile,
  Student,
  StudentMarkEntry,
  TeacherPerformanceReport,
  TeacherProfile,
} from '../types';
import { Language, translations } from '../utils/translations';
import {
  calculateTeacherSubjectPerformance,
  deduplicateMarksEntries,
  deduplicateStudentsByAdmissionNumber,
} from '../utils/calculations';
import { exportTeacherPerformanceToExcel } from '../utils/excelExport';

interface TeacherPerformanceProps {
  teachers: TeacherProfile[];
  examinations: Examination[];
  students: Student[];
  marksEntries: StudentMarkEntry[];
  school: SchoolProfile;
  language: Language;
}

export const TeacherPerformance: React.FC<TeacherPerformanceProps> = ({
  teachers,
  examinations,
  students,
  marksEntries,
  school,
  language,
}) => {
  const t = translations[language];

  const [selectedExamId, setSelectedExamId] = useState<string>(examinations[0]?.id || '');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('all');
  const [selectedClass, setSelectedClass] = useState<string>('all');

  const currentExam = examinations.find((e) => e.id === selectedExamId) || examinations[0];

  // Map each teacher assignment to a performance report
  const uniqueStudents = deduplicateStudentsByAdmissionNumber(students);
  const uniqueMarks = deduplicateMarksEntries(marksEntries);
  const performanceReports: TeacherPerformanceReport[] = [];

  teachers.forEach((tc) => {
    tc.assignedClasses.forEach((ac) => {
      // Find subject code
      const subConfigList = currentExam.subjects[ac.classNumber] || [];
      const matchedSub = subConfigList.find((s) => s.name.toLowerCase() === ac.subject.toLowerCase()) || subConfigList[0];

      if (matchedSub) {
        const enrolledCount = uniqueStudents.filter(
          (s) => s.classNumber === ac.classNumber && s.section === ac.section && s.status === 'Active'
        ).length;

        const report = calculateTeacherSubjectPerformance(
          tc.id,
          tc.name,
          tc.employeeId,
          matchedSub.name,
          matchedSub.code,
          ac.classNumber,
          ac.section,
          currentExam.name,
          enrolledCount,
          uniqueMarks,
          matchedSub.passingMarks,
          school.gradingScale
        );

        performanceReports.push(report);
      }
    });
  });

  // Filter reports
  const filteredReports = performanceReports.filter((r) => {
    const matchTeacher = selectedTeacherId === 'all' || r.teacherId === selectedTeacherId;
    const matchClass = selectedClass === 'all' || r.classNumber === selectedClass;
    return matchTeacher && matchClass;
  });

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-indigo-600" />
            <span>{t.teacherPerformance}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {language === 'ur'
              ? 'اساتذہ کی مضمون وار تعلیمی کارکردگی، کامیابی کا تناسب، اوسط نمبرات اور گریڈز کا جائزہ۔'
              : 'Subject-wise and teacher-wise academic performance metrics, pass rates, and grade distribution.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => exportTeacherPerformanceToExcel(filteredReports, school, currentExam.name)}
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
        </div>
      </div>

      {/* Mandatory Statutory Note from prompt Section 12 */}
      <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-start gap-2.5">
        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong>Academic Guidance Notice:</strong> {t.academicDisclaimer} Examination outcomes reflect student learning levels at a point in time and should not be used as an exclusive benchmark of individual faculty contribution.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-wrap items-center gap-3 no-print text-xs">
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            {t.examination}
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

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Filter Teacher
          </label>
          <select
            value={selectedTeacherId}
            onChange={(e) => setSelectedTeacherId(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-xl font-semibold text-slate-800 bg-slate-50"
          >
            <option value="all">All Teachers ({teachers.length})</option>
            {teachers.map((tc) => (
              <option key={tc.id} value={tc.id}>
                {tc.name} ({tc.employeeId})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Filter Class
          </label>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-xl font-semibold text-slate-800 bg-slate-50"
          >
            <option value="all">All Classes</option>
            {school.classesOffered.map((c) => (
              <option key={c} value={c}>Class {c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Performance Reports List Cards */}
      <div className="space-y-4">
        {filteredReports.map((r, idx) => (
          <div
            key={idx}
            className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 space-y-4 printable-card"
          >
            {/* Header info */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-base text-slate-900">{r.teacherName}</h3>
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                    {r.employeeId}
                  </span>
                </div>
                <p className="text-xs text-indigo-700 font-bold mt-0.5">
                  Subject: {r.subjectName} • Class {r.classNumber}-{r.section} • {r.examName}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Pass Rate</span>
                  <p className={`text-xl font-black ${r.passPercentage >= 80 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {r.passPercentage}%
                  </p>
                </div>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 text-xs text-center">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 text-[11px]">Enrolled</span>
                <p className="font-mono font-bold text-slate-900 text-base mt-1">{r.enrolledStudents}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 text-[11px]">Assessed</span>
                <p className="font-mono font-bold text-slate-900 text-base mt-1">{r.assessedStudents}</p>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                <span className="text-emerald-800 text-[11px] font-bold">Passed</span>
                <p className="font-mono font-bold text-emerald-700 text-base mt-1">{r.passedStudents}</p>
              </div>
              <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
                <span className="text-rose-800 text-[11px] font-bold">Failed</span>
                <p className="font-mono font-bold text-rose-700 text-base mt-1">{r.failedStudents}</p>
              </div>
              <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-200">
                <span className="text-indigo-800 text-[11px] font-bold">Subject Avg</span>
                <p className="font-mono font-bold text-indigo-900 text-base mt-1">{r.averageMarks} ({r.averagePercentage}%)</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 text-[11px]">High / Low</span>
                <p className="font-mono font-bold text-slate-900 text-base mt-1">{r.highestMarks} / {r.lowestMarks}</p>
              </div>
            </div>

            {/* Grade Distribution Bar */}
            <div className="pt-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-600 mb-2">
                <span>Grade Distribution:</span>
                <span className="text-[11px] text-slate-400">Count of students per achievement level</span>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {Object.entries(r.gradeDistribution).map(([grade, count]) => (
                  <div
                    key={grade}
                    className="flex-1 min-w-[60px] p-2 bg-slate-50 rounded-xl border border-slate-200 text-center"
                  >
                    <span className="font-mono font-extrabold text-indigo-700">{grade}</span>
                    <p className="font-bold text-slate-900 mt-0.5">{count}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};
