import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Printer,
  Download,
  Search,
  Filter,
  Save,
  CheckCircle2,
  AlertTriangle,
  Award,
  BookOpen,
  Users,
  Eye,
  Edit2,
  Sparkles,
  Clock,
  Check,
} from 'lucide-react';
import {
  Examination,
  SchoolProfile,
  Student,
  StudentExamSummary,
  StudentMarkEntry,
  SubjectConfig,
  User,
} from '../types';
import { Language, translations } from '../utils/translations';
import {
  calculateStudentExamSummary,
  deduplicateMarksEntries,
  deduplicateStudentsByAdmissionNumber,
  getGradeFromPercentage,
} from '../utils/calculations';
import { sampleSubjectConfigs } from '../utils/sampleData';
import * as XLSX from 'xlsx';

interface EvaluationRecordItem {
  studentId: string;
  studentName: string;
  rollNumber: number;
  classNumber: string;
  section: string;
  admissionNumber: string;
  examId: string;
  academicSession: string;
  totalMarksObtained: number;
  totalMaxMarks: number;
  percentage: number;
  overallGrade: string;
  isPassed: boolean;
  learningStrengths: string;
  areasRequiringImprovement: string;
  teacherObservations: string;
  recommendedRemedialActivities: string;
  assessmentCompletionStatus: 'Complete' | 'Incomplete' | 'Absent_Flagged';
  lastUpdated: string;
}

interface EvaluationRegisterProps {
  students: Student[];
  examinations: Examination[];
  marksEntries: StudentMarkEntry[];
  school: SchoolProfile;
  currentUser: User;
  language: Language;
  subjectConfigs?: SubjectConfig[];
  onSaveMarks?: (updated: StudentMarkEntry[]) => void;
  onNavigateToMarks?: () => void;
  onNavigateToHpc?: () => void;
}

export const EvaluationRegister: React.FC<EvaluationRegisterProps> = ({
  students,
  examinations,
  marksEntries,
  school,
  currentUser,
  language,
  subjectConfigs,
  onSaveMarks,
  onNavigateToMarks,
  onNavigateToHpc,
}) => {
  const t = translations[language];

  const availableClasses = school.classesOffered || ['Nursery', 'KG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
  const [selectedExamId, setSelectedExamId] = useState<string>(examinations[0]?.id || 'exam-yearly-2026');
  const [selectedClass, setSelectedClass] = useState<string>('5');
  const [selectedSection, setSelectedSection] = useState<string>('A');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Passed' | 'Remedial' | 'Incomplete'>('all');

  const [editingItem, setEditingItem] = useState<EvaluationRecordItem | null>(null);
  const [toastNotice, setToastNotice] = useState<string | null>(null);

  // Local storage for qualitative observations per student per exam
  const [evalNotes, setEvalNotes] = useState<Record<string, {
    strengths?: string;
    improvements?: string;
    observations?: string;
    remedial?: string;
    status?: 'Complete' | 'Incomplete' | 'Absent_Flagged';
  }>>(() => {
    const saved = localStorage.getItem('sm_evaluation_register_notes');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return {
      'SM-2026-001': {
        strengths: 'Outstanding arithmetic agility, neat Nastaliq handwriting, active classroom debate.',
        improvements: 'Focus on English comprehension complex syntax.',
        observations: 'Consistently demonstrates strong peer leadership and regular homework submission.',
        remedial: 'Advanced science worksheet modules and regional vocabulary quizzes.',
        status: 'Complete',
      },
      'SM-2026-002': {
        strengths: 'Exceptional creative writing, high conceptual clarity in mathematics & biology.',
        improvements: 'Encourage independent group project coordination.',
        observations: 'Top cohort academic performer across all six core disciplines.',
        remedial: 'State olympiad prep exercises and extracurricular science exhibitions.',
        status: 'Complete',
      },
      'SM-2026-003': {
        strengths: 'Good reading pace, fluent vernacular speech, accurate mental division.',
        improvements: 'Needs structured practice in English grammar tenses.',
        observations: 'Diligent effort, receptive to teacher feedback.',
        remedial: 'Bi-weekly grammar remedial drills and reading aloud sessions.',
        status: 'Complete',
      },
      'SM-2026-005': {
        strengths: 'Cooperative attitude, expressive spoken Kashmiri, good attendance.',
        improvements: 'Requires support in long division and basic fraction operations.',
        observations: 'Requires targeted remedial intervention before term evaluations.',
        remedial: 'Daily 20-minute small-group remedial arithmetic tutoring.',
        status: 'Incomplete',
      },
    };
  });

  const showToast = (msg: string) => {
    setToastNotice(msg);
    setTimeout(() => setToastNotice(null), 3500);
  };

  const currentExam = examinations.find((e) => e.id === selectedExamId) || examinations[0];
  const coreSubjects = subjectConfigs && subjectConfigs.length > 0 ? subjectConfigs : sampleSubjectConfigs;

  // Filter students (deduplicated by Admission Number primary key)
  const classStudents = useMemo(() => {
    return deduplicateStudentsByAdmissionNumber(students)
      .filter((s) => s.classNumber === selectedClass && s.section === selectedSection && s.status === 'Active')
      .sort((a, b) => a.rollNumber - b.rollNumber);
  }, [students, selectedClass, selectedSection]);

  const uniqueMarks = useMemo(() => deduplicateMarksEntries(marksEntries), [marksEntries]);

  // Generate synchronized evaluation items directly derived from marks entries
  const evaluationRecords: EvaluationRecordItem[] = useMemo(() => {
    return classStudents.map((st) => {
      const summary: StudentExamSummary = calculateStudentExamSummary(
        st.id,
        st.fullName,
        st.rollNumber,
        st.classNumber,
        st.section,
        currentExam.id,
        currentExam.name,
        uniqueMarks,
        coreSubjects,
        school.gradingScale,
        92.4
      );

      const notes = evalNotes[st.id] || {};
      const hasAnyAbsent = summary.subjectMarks.some((m) => m.isAbsent);
      const hasMissingMarks = summary.subjectMarks.some((m) => m.marksObtained === null && !m.isAbsent);

      let completionStatus: 'Complete' | 'Incomplete' | 'Absent_Flagged' = notes.status || 'Complete';
      if (hasAnyAbsent) completionStatus = 'Absent_Flagged';
      else if (hasMissingMarks) completionStatus = 'Incomplete';

      const defaultStrength = summary.percentage >= 80
        ? 'Excellent analytical acumen, fluent language expression, and strong subject mastery.'
        : summary.percentage >= 50
        ? 'Satisfactory classroom engagement, dependable arithmetic accuracy, and good teamwork.'
        : 'Receptive to guided instruction, punctual in attendance, and shows positive attitude.';

      const defaultImprovement = summary.percentage >= 80
        ? 'Explore higher-order thinking challenges and independent research.'
        : summary.percentage >= 50
        ? 'Increase consistent daily revision and focus on problem-solving speed.'
        : 'Requires structured remediation in fundamental mathematical concepts and language drills.';

      const defaultRemedial = summary.isPassed
        ? 'Enrichment reading modules, peer tutoring leadership, and weekly quiz activities.'
        : 'Special after-school remedial sessions, individualized learning targets, and parent consultations.';

      return {
        studentId: st.id,
        studentName: st.fullName,
        rollNumber: st.rollNumber,
        classNumber: st.classNumber,
        section: st.section,
        admissionNumber: st.admissionNumber,
        examId: currentExam.id,
        academicSession: school.academicSession,
        totalMarksObtained: summary.totalMarksObtained,
        totalMaxMarks: summary.totalMaxMarks,
        percentage: summary.percentage,
        overallGrade: summary.overallGrade,
        isPassed: summary.isPassed,
        learningStrengths: notes.strengths || defaultStrength,
        areasRequiringImprovement: notes.improvements || defaultImprovement,
        teacherObservations: notes.observations || `Evaluated for ${currentExam.name}. Overall Grade: ${summary.overallGrade}.`,
        recommendedRemedialActivities: notes.remedial || defaultRemedial,
        assessmentCompletionStatus: completionStatus,
        lastUpdated: new Date().toISOString().slice(0, 10),
      };
    });
  }, [classStudents, currentExam, marksEntries, coreSubjects, school.gradingScale, school.academicSession, evalNotes]);

  const filteredRecords = useMemo(() => {
    return evaluationRecords.filter((rec) => {
      const matchesSearch =
        !searchQuery.trim() ||
        rec.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rec.admissionNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rec.rollNumber.toString().includes(searchQuery);

      let matchesStatus = true;
      if (statusFilter === 'Passed') matchesStatus = rec.isPassed;
      if (statusFilter === 'Remedial') matchesStatus = !rec.isPassed;
      if (statusFilter === 'Incomplete') matchesStatus = rec.assessmentCompletionStatus !== 'Complete';

      return matchesSearch && matchesStatus;
    });
  }, [evaluationRecords, searchQuery, statusFilter]);

  const handleSaveObservation = (item: EvaluationRecordItem) => {
    const updated = {
      ...evalNotes,
      [item.studentId]: {
        strengths: item.learningStrengths,
        improvements: item.areasRequiringImprovement,
        observations: item.teacherObservations,
        remedial: item.recommendedRemedialActivities,
        status: item.assessmentCompletionStatus,
      },
    };
    setEvalNotes(updated);
    localStorage.setItem('sm_evaluation_register_notes', JSON.stringify(updated));
    setEditingItem(null);
    showToast(`Evaluation record for ${item.studentName} successfully synchronized!`);
  };

  const handleExportExcel = () => {
    const data = filteredRecords.map((r) => ({
      'Roll No': r.rollNumber,
      'Student Name': r.studentName,
      'Admission No': r.admissionNumber,
      Class: `${r.classNumber}-${r.section}`,
      Examination: currentExam.name,
      'Session': r.academicSession,
      'Marks Obtained': r.totalMarksObtained,
      'Max Marks': r.totalMaxMarks,
      'Percentage (%)': r.percentage,
      Grade: r.overallGrade,
      'Result Status': r.isPassed ? 'PASSED' : 'REMEDIAL REQUIRED',
      'Learning Strengths': r.learningStrengths,
      'Areas for Improvement': r.areasRequiringImprovement,
      'Teacher Observations': r.teacherObservations,
      'Remedial Activities': r.recommendedRemedialActivities,
      'Assessment Status': r.assessmentCompletionStatus,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Evaluation_Class_${selectedClass}`);
    XLSX.writeFile(wb, `Evaluation_Register_Class_${selectedClass}_${currentExam.name.replace(/\s+/g, '_')}.xlsx`);
    showToast('Evaluation register exported to Excel successfully.');
  };

  const passCount = evaluationRecords.filter((r) => r.isPassed).length;
  const remedialCount = evaluationRecords.length - passCount;
  const passRate = evaluationRecords.length > 0 ? Math.round((passCount / evaluationRecords.length) * 100) : 0;

  return (
    <div className="space-y-6">
      
      {/* Toast */}
      {toastNotice && (
        <div className="fixed top-20 right-4 z-50 bg-slate-900/95 text-white px-4 py-3 rounded-2xl shadow-2xl border border-emerald-500/50 flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastNotice}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-black">
              <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900">
                Evaluation Register — ہمہ جہت تشخیصی رجسٹر
              </h1>
              <p className="text-xs text-slate-500">
                Connected directly to Marks Entry Register • Real-time synchronization of learning strengths, observations & remedial plans
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white text-slate-700 hover:bg-slate-50 border border-slate-300 transition-colors shadow-2xs"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>Print Register</span>
          </button>
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm shadow-emerald-600/30"
          >
            <Download className="w-4 h-4" />
            <span>Export Excel</span>
          </button>
          {onNavigateToMarks && (
            <button
              onClick={onNavigateToMarks}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors"
            >
              <BookOpen className="w-4 h-4" />
              <span>Marks Register</span>
            </button>
          )}
        </div>
      </div>

      {/* Selector & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3 no-print">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          
          {/* Examination */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Examination
            </label>
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-800 bg-slate-50"
            >
              {examinations.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name}
                </option>
              ))}
            </select>
          </div>

          {/* Class */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Class
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-800 bg-slate-50"
            >
              {availableClasses.map((c) => (
                <option key={c} value={c}>Class {c}</option>
              ))}
            </select>
          </div>

          {/* Section */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Section
            </label>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-800 bg-slate-50"
            >
              <option value="A">Section A</option>
              <option value="B">Section B</option>
              <option value="C">Section C</option>
            </select>
          </div>

          {/* Search */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Search Student
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Name, SRN, Roll #..."
                className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-xl text-xs font-medium"
              />
            </div>
          </div>

        </div>

        {/* Quick Filter Tabs & Summary Row */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-bold text-[11px]">Filter:</span>
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors ${
                statusFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All ({evaluationRecords.length})
            </button>
            <button
              onClick={() => setStatusFilter('Passed')}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors ${
                statusFilter === 'Passed'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              Passed ({passCount})
            </button>
            <button
              onClick={() => setStatusFilter('Remedial')}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors ${
                statusFilter === 'Remedial'
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
              }`}
            >
              Remedial Required ({remedialCount})
            </button>
          </div>

          <div className="flex items-center gap-3 text-[11px]">
            <span className="text-slate-500">
              Evaluated Students: <strong className="text-slate-900">{evaluationRecords.length}</strong>
            </span>
            <span>•</span>
            <span className="text-emerald-700 font-bold">
              Pass Rate: {passRate}%
            </span>
            <span>•</span>
            <span className="text-indigo-700 font-bold">
              Session: {school.academicSession}
            </span>
          </div>
        </div>
      </div>

      {/* Main Evaluation Register Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden printable-card">
        
        {/* Printable Official Header */}
        <div className="p-4 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div>
            <div className="font-extrabold text-sm flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400" />
              <span>OFFICIAL STUDENT EVALUATION REGISTER</span>
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5">
              {school.name} • Class {selectedClass}-{selectedSection} • {currentExam.name} ({school.academicSession})
            </p>
          </div>
          <div className="text-right text-[11px] text-slate-300">
            <span>U-DISE+: <strong className="text-white">{school.code}</strong></span>
            <span className="mx-2">•</span>
            <span>RTE & NEP 2020 Compliant</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3 w-12 text-center">Roll</th>
                <th className="py-3 px-3">Student Name & SRN</th>
                <th className="py-3 px-3 text-center">Marks (600)</th>
                <th className="py-3 px-3 text-center">Score %</th>
                <th className="py-3 px-3 text-center">Grade</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-4">Learning Strengths</th>
                <th className="py-3 px-4">Areas for Improvement</th>
                <th className="py-3 px-4">Remedial Plan</th>
                <th className="py-3 px-3 text-right no-print">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    No evaluation records found matching the active class and filter criteria.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec) => (
                  <tr key={rec.studentId} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3 text-center font-mono font-bold text-slate-800">
                      #{rec.rollNumber}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-extrabold text-slate-900">{rec.studentName}</div>
                      <div className="text-[10px] font-mono text-slate-400">{rec.admissionNumber}</div>
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-bold text-slate-800">
                      {rec.totalMarksObtained} <span className="text-[10px] text-slate-400">/ {rec.totalMaxMarks}</span>
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-extrabold text-indigo-700">
                      {rec.percentage}%
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-black text-indigo-950">
                      <span className="px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200">
                        {rec.overallGrade}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                        rec.isPassed
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                          : 'bg-rose-50 text-rose-700 border border-rose-300'
                      }`}>
                        {rec.isPassed ? 'Passed' : 'Remedial'}
                      </span>
                    </td>
                    <td className="py-3 px-4 max-w-xs">
                      <p className="text-[11px] text-slate-700 line-clamp-2 leading-tight">
                        {rec.learningStrengths}
                      </p>
                    </td>
                    <td className="py-3 px-4 max-w-xs">
                      <p className="text-[11px] text-slate-600 line-clamp-2 leading-tight">
                        {rec.areasRequiringImprovement}
                      </p>
                    </td>
                    <td className="py-3 px-4 max-w-xs">
                      <p className="text-[11px] text-indigo-800 line-clamp-2 leading-tight font-medium">
                        {rec.recommendedRemedialActivities}
                      </p>
                    </td>
                    <td className="py-3 px-3 text-right no-print">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => setEditingItem({ ...rec })}
                          title="Edit Qualitative Observations"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Printable Official Footer Signatures */}
        <div className="p-6 bg-slate-50 border-t border-slate-200 grid grid-cols-3 text-center text-xs text-slate-700">
          <div>
            <div className="h-10"></div>
            <p className="font-bold border-t border-slate-400 pt-1">Class Teacher</p>
            <p className="text-[10px] text-slate-400">Signature & Date</p>
          </div>
          <div>
            <div className="h-10"></div>
            <p className="font-bold border-t border-slate-400 pt-1">Evaluation Committee In-Charge</p>
            <p className="text-[10px] text-slate-400">Verified under RTE Norms</p>
          </div>
          <div>
            <div className="h-10"></div>
            <p className="font-bold border-t border-slate-400 pt-1">Head of Institution / Principal</p>
            <p className="text-[10px] text-slate-400">Institutional Seal</p>
          </div>
        </div>

      </div>

      {/* Edit Evaluation Record Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-150 no-print">
          <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-extrabold">Edit Evaluation & Remedial Record</h2>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (editingItem) handleSaveObservation(editingItem);
              }}
              className="p-5 space-y-4 text-xs"
            >
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="font-black text-slate-900 text-sm">{editingItem.studentName}</span>
                  <span className="text-[11px] text-slate-500 ml-2">Class {editingItem.classNumber}-{editingItem.section} • Roll #{editingItem.rollNumber}</span>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-indigo-700">{editingItem.percentage}%</span>
                  <span className="ml-1 px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 font-extrabold">Grade {editingItem.overallGrade}</span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  1. Learning Strengths & Key Proficiencies
                </label>
                <textarea
                  rows={2}
                  value={editingItem.learningStrengths}
                  onChange={(e) => setEditingItem({ ...editingItem, learningStrengths: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. Fast mental calculation, keen curiosity in science..."
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  2. Areas Requiring Academic Improvement
                </label>
                <textarea
                  rows={2}
                  value={editingItem.areasRequiringImprovement}
                  onChange={(e) => setEditingItem({ ...editingItem, areasRequiringImprovement: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. Spelling accuracy, division drills, handwriting..."
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  3. Recommended Remedial Activities & Support Plan
                </label>
                <textarea
                  rows={2}
                  value={editingItem.recommendedRemedialActivities}
                  onChange={(e) => setEditingItem({ ...editingItem, recommendedRemedialActivities: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. Daily 15-min remedial tutoring, parent follow-up..."
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  4. Teacher General Observations
                </label>
                <textarea
                  rows={2}
                  value={editingItem.teacherObservations}
                  onChange={(e) => setEditingItem({ ...editingItem, teacherObservations: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500"
                  placeholder="General demeanor, classroom participation..."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center gap-1.5 shadow-sm"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Record</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
