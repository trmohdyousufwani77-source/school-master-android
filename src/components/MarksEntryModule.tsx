import React, { useState, useMemo } from 'react';
import {
  BookOpenCheck,
  Save,
  CheckCircle2,
  Users,
  Search,
  Filter,
  Check,
  Award,
  AlertCircle,
  FileSpreadsheet,
  Percent,
  RotateCcw,
  Loader2,
  ShieldCheck,
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
import { sampleSubjectConfigs } from '../utils/sampleData';
import { calculateGradeFromPercentage, deduplicateStudentsByAdmissionNumber } from '../utils/calculations';
import { recordMarkAudit } from '../utils/marksAuditTrail';

interface MarksEntryModuleProps {
  students: Student[];
  examinations: Examination[];
  marksEntries: StudentMarkEntry[];
  school: SchoolProfile;
  currentUser: User;
  language: Language;
  subjectConfigs?: SubjectConfig[];
  onSaveMarks: (updatedMarks: StudentMarkEntry[]) => void;
}

export const MarksEntryModule: React.FC<MarksEntryModuleProps> = ({
  students,
  examinations,
  marksEntries,
  school,
  currentUser,
  language,
  subjectConfigs,
  onSaveMarks,
}) => {
  const t = translations[language];

  const availableClasses = school.classesOffered || ['Nursery', 'KG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
  const [selectedExamId, setSelectedExamId] = useState<string>(examinations[0]?.id || 'exam-hy-2026');
  const [selectedClass, setSelectedClass] = useState<string>('5');
  const [selectedSection, setSelectedSection] = useState<string>('A');
  const [selectedSubjectCode, setSelectedSubjectCode] = useState<string>('ENG');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Active exam and subject
  const currentExam = examinations.find((e) => e.id === selectedExamId) || examinations[0];
  const coreSubjects = subjectConfigs && subjectConfigs.length > 0 ? subjectConfigs : sampleSubjectConfigs;
  const currentSubject = coreSubjects.find((s) => s.code === selectedSubjectCode) || coreSubjects[0];

  // Eligible students (strictly deduplicated by admissionNumber primary key)
  const classStudents = useMemo(() => {
    return deduplicateStudentsByAdmissionNumber(students)
      .filter((s) => s.classNumber === selectedClass && s.section === selectedSection && s.status === 'Active')
      .sort((a, b) => a.rollNumber - b.rollNumber);
  }, [students, selectedClass, selectedSection]);

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return classStudents;
    const q = searchQuery.toLowerCase();
    return classStudents.filter(
      (s) =>
        s.fullName.toLowerCase().includes(q) ||
        s.admissionNumber.toLowerCase().includes(q) ||
        s.rollNumber.toString().includes(q)
    );
  }, [classStudents, searchQuery]);

  // Local draft state of marks for rapid entry and auto-calculation
  const [draftMarks, setDraftMarks] = useState<Record<string, { marks: number | null; isAbsent: boolean; remarks: string; attendanceMarks: number }>>({});
  
  // Undo stack (stores up to last 5 batch operations)
  const [undoStack, setUndoStack] = useState<Array<Record<string, { marks: number | null; isAbsent: boolean; remarks: string; attendanceMarks: number }>>>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [invalidMarksMap, setInvalidMarksMap] = useState<Record<string, string>>({});

  // Initialize draft when exam/class/section/subject changes
  React.useEffect(() => {
    const initial: Record<string, { marks: number | null; isAbsent: boolean; remarks: string; attendanceMarks: number }> = {};
    classStudents.forEach((st) => {
      const existing = marksEntries.find(
        (m) =>
          m.examId === selectedExamId &&
          m.studentId === st.id &&
          m.subjectCode === selectedSubjectCode
      );
      if (existing) {
        initial[st.id] = {
          marks: existing.marksObtained,
          isAbsent: existing.isAbsent,
          remarks: existing.remarks || '',
          attendanceMarks: existing.attendanceMarks ?? st.attendanceMarks ?? 9,
        };
      } else {
        initial[st.id] = {
          marks: null,
          isAbsent: false,
          remarks: '',
          attendanceMarks: st.attendanceMarks ?? 9,
        };
      }
    });
    setDraftMarks(initial);
    setUndoStack([]);
    setHasUnsavedChanges(false);
    setInvalidMarksMap({});
  }, [selectedExamId, selectedClass, selectedSection, selectedSubjectCode, classStudents, marksEntries]);

  // Push current state to undo stack before batch operations
  const pushUndoSnapshot = () => {
    setUndoStack((prev) => [JSON.parse(JSON.stringify(draftMarks)), ...prev.slice(0, 4)]);
    setHasUnsavedChanges(true);
  };

  // Revert last batch operation
  const handleBulkUndo = () => {
    if (undoStack.length === 0) return;
    const [previous, ...rest] = undoStack;
    setDraftMarks(previous);
    setUndoStack(rest);
    setHasUnsavedChanges(true);
    setToastMessage(`✓ Reverted last batch change (${rest.length} undos remaining)`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleAttendanceMarksChange = (studentId: string, valStr: string) => {
    pushUndoSnapshot();
    const num = Math.min(10, Math.max(0, parseFloat(valStr) || 0));
    setDraftMarks((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        attendanceMarks: num,
      },
    }));
  };

  const handleMarkChange = (studentId: string, valStr: string) => {
    // Client-side range validation (0 to maxMarks)
    if (valStr !== '') {
      const rawNum = parseFloat(valStr);
      if (isNaN(rawNum) || rawNum < 0 || rawNum > currentSubject.maxMarks) {
        setInvalidMarksMap((prev) => ({
          ...prev,
          [studentId]: `Marks must be between 0 and ${currentSubject.maxMarks}`,
        }));
      } else {
        setInvalidMarksMap((prev) => {
          const next = { ...prev };
          delete next[studentId];
          return next;
        });
      }
    } else {
      setInvalidMarksMap((prev) => {
        const next = { ...prev };
        delete next[studentId];
        return next;
      });
    }

    pushUndoSnapshot();
    const num = valStr === '' ? null : Math.min(currentSubject.maxMarks, Math.max(0, parseFloat(valStr) || 0));
    setDraftMarks((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        marks: num,
        isAbsent: false,
      },
    }));
  };

  const handleAbsentToggle = (studentId: string) => {
    pushUndoSnapshot();
    setDraftMarks((prev) => {
      const current = prev[studentId] || { marks: null, isAbsent: false, remarks: '', attendanceMarks: 9 };
      return {
        ...prev,
        [studentId]: {
          ...current,
          isAbsent: !current.isAbsent,
          marks: !current.isAbsent ? null : current.marks,
        },
      };
    });
  };

  const handleSetAttendedStatus = (studentId: string, attended: boolean) => {
    pushUndoSnapshot();
    setDraftMarks((prev) => {
      const current = prev[studentId] || { marks: null, isAbsent: false, remarks: '', attendanceMarks: 9 };
      return {
        ...prev,
        [studentId]: {
          ...current,
          isAbsent: !attended,
          marks: !attended ? null : current.marks,
        },
      };
    });
  };

  const handleMarkAllAttended = () => {
    pushUndoSnapshot();
    setDraftMarks((prev) => {
      const next = { ...prev };
      classStudents.forEach((st) => {
        const cur = next[st.id] || { marks: null, isAbsent: false, remarks: '', attendanceMarks: 9 };
        next[st.id] = { ...cur, isAbsent: false };
      });
      return next;
    });
    setToastMessage('✓ All students marked as Attended exam');
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleRemarksChange = (studentId: string, remarks: string) => {
    setDraftMarks((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        remarks,
      },
    }));
    setHasUnsavedChanges(true);
  };

  const handleSaveAllMarks = () => {
    setIsSaving(true);

    const updatedEntries: StudentMarkEntry[] = classStudents.map((st) => {
      const draft = draftMarks[st.id] || { marks: null, isAbsent: false, remarks: '', attendanceMarks: 9 };
      const maxMarks = currentSubject.maxMarks;
      const marksObtained = draft.isAbsent ? null : draft.marks;
      const percentage = marksObtained !== null && maxMarks > 0 ? (marksObtained / maxMarks) * 100 : 0;
      const grade = draft.isAbsent ? 'AB' : calculateGradeFromPercentage(percentage, school.gradingScale).grade;
      const passed = !draft.isAbsent && marksObtained !== null && marksObtained >= currentSubject.passingMarks;

      // Check if original value changed and record into audit trail
      const existing = marksEntries.find(
        (m) =>
          m.examId === selectedExamId &&
          m.studentId === st.id &&
          m.subjectCode === selectedSubjectCode
      );

      const oldScore = existing ? (existing.isAbsent ? 'AB' : existing.marksObtained ?? 0) : 'None';
      const newScore = draft.isAbsent ? 'AB' : (marksObtained ?? 0);

      if (oldScore !== newScore && oldScore !== 'None') {
        recordMarkAudit({
          studentId: st.id,
          studentName: st.fullName,
          rollNumber: st.rollNumber,
          classNumber: selectedClass,
          section: selectedSection,
          subjectCode: selectedSubjectCode,
          subjectName: currentSubject.name,
          examId: selectedExamId,
          examName: currentExam.name,
          originalValue: oldScore,
          newValue: newScore,
          userResponsible: currentUser.name,
          userId: currentUser.id,
          moduleOrigin: 'Marks Entry Register',
          reason: 'Teacher evaluation update in Marks Register',
        });
      }

      return {
        id: `mark-${selectedExamId}-${st.id}-${selectedSubjectCode}`,
        examId: selectedExamId,
        studentId: st.id,
        classNumber: selectedClass,
        section: selectedSection,
        subjectCode: selectedSubjectCode,
        maxMarks,
        marksObtained,
        isAbsent: draft.isAbsent,
        grade,
        passed,
        remarks: draft.remarks,
        attendanceMarks: draft.attendanceMarks,
      };
    });

    onSaveMarks(updatedEntries);
    setTimeout(() => {
      setIsSaving(false);
      setSaveSuccess(true);
      setHasUnsavedChanges(false);
      setToastMessage('✓ Marks successfully saved and synced across all registers!');
      setTimeout(() => {
        setSaveSuccess(false);
        setToastMessage(null);
      }, 3500);
    }, 400);
  };

  return (
    <div className="space-y-6 relative pb-16">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed top-20 right-4 z-50 bg-slate-900/95 backdrop-blur-md text-white border border-emerald-500/50 shadow-2xl rounded-2xl px-4 py-3 flex items-center gap-2.5 animate-in slide-in-from-top-4">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-xs font-bold text-slate-100">{toastMessage}</span>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <BookOpenCheck className="w-6 h-6 text-indigo-600" />
            <span>Marks Entry & Evaluation Register</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Input marks for the 6 core subjects with real-time percentage and grade calculations under NEP 2020 guidelines ({school.name}).
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {undoStack.length > 0 && (
            <button
              type="button"
              onClick={handleBulkUndo}
              className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-extrabold flex items-center gap-1.5 transition-all active:scale-95 shadow-2xs"
              title="Undo last batch operation (revert up to 5 steps)"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
              <span>Undo Last Batch ({undoStack.length})</span>
            </button>
          )}

          {saveSuccess && (
            <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-1.5 animate-in fade-in">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>Marks Saved!</span>
            </div>
          )}

          <button
            onClick={handleSaveAllMarks}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 transition-colors flex items-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{isSaving ? 'Saving Marks...' : 'Save Marks Register'}</span>
          </button>
        </div>
      </div>

      {/* Selectors Bar: Examination, Class, Section, and Six Subjects */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Examination Schedule:
            </label>
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800"
            >
              {examinations.map((ex) => (
                <option key={ex.id} value={ex.id}>{ex.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Class:
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800"
            >
              {availableClasses.map((c) => (
                <option key={c} value={c}>Class {c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Section:
            </label>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800"
            >
              <option value="A">Section A</option>
              <option value="B">Section B</option>
              <option value="C">Section C</option>
            </select>
          </div>
        </div>

        {/* 6 Core Subjects Selector Tabs */}
        <div>
          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            Select Subject (6 Mandatory Subjects):
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {coreSubjects.map((sub) => {
              const isSelected = selectedSubjectCode === sub.code;
              return (
                <button
                  key={sub.code}
                  onClick={() => setSelectedSubjectCode(sub.code)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md scale-102'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs">{sub.name}</span>
                    <span className={`text-[10px] font-mono px-1 rounded ${
                      isSelected ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {sub.code}
                    </span>
                  </div>
                  <div className={`text-[11px] font-urdu mt-0.5 ${isSelected ? 'text-indigo-100' : 'text-slate-500'}`}>
                    {sub.nameUrdu}
                  </div>
                  <div className={`text-[10px] mt-1 ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                    Max: {sub.maxMarks} • Pass: {sub.passingMarks}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Marks Table */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Entering Marks for {currentSubject.name} — Class {selectedClass}-{selectedSection}
            </h3>
            <p className="text-xs text-slate-500">
              Maximum: {currentSubject.maxMarks} Marks • Passing Minimum: {currentSubject.passingMarks}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Attended Status summary & Mark All button */}
            <div className="flex items-center gap-1.5 text-xs bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl">
              <span className="text-slate-500 font-medium">Exam Attendance:</span>
              <span className="font-extrabold text-emerald-700 bg-emerald-100/60 px-1.5 py-0.5 rounded text-[11px]">
                {classStudents.filter((s) => !draftMarks[s.id]?.isAbsent).length} Attended
              </span>
              {classStudents.filter((s) => draftMarks[s.id]?.isAbsent).length > 0 && (
                <span className="font-extrabold text-rose-700 bg-rose-100/60 px-1.5 py-0.5 rounded text-[11px]">
                  {classStudents.filter((s) => draftMarks[s.id]?.isAbsent).length} Absent
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleMarkAllAttended}
              title="Set all students in this class as Attended"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors border border-slate-200"
            >
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>Mark All Attended</span>
            </button>

            <div className="relative w-full sm:w-56">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search student or roll #..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {filteredStudents.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            No students enrolled in Class {selectedClass}-{selectedSection}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-slate-200 rounded-xl">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Roll #</th>
                  <th className="py-2.5 px-3">Student Name</th>
                  <th className="py-2.5 px-3 text-center min-w-[155px]">
                    <div className="flex items-center justify-center gap-1">
                      <span>Marks Attended</span>
                      <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200">Edit</span>
                    </div>
                  </th>
                  <th className="py-2.5 px-3 text-center w-36">Marks (Max {currentSubject.maxMarks})</th>
                  <th className="py-2.5 px-3 text-center">Percentage</th>
                  <th className="py-2.5 px-3 text-center">Grade</th>
                  <th className="py-2.5 px-3 text-center">Result</th>
                  <th className="py-2.5 px-3 text-center min-w-[130px]">Attendance Marks (10)</th>
                  <th className="py-2.5 px-3">Teacher Remarks & Observations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((st) => {
                  const draft = draftMarks[st.id] || {
                    marks: null,
                    isAbsent: false,
                    remarks: '',
                    attendanceMarks: st.attendanceMarks ?? 9,
                  };
                  const maxMarks = currentSubject.maxMarks;
                  const percentage = draft.marks !== null && maxMarks > 0 ? Math.round((draft.marks / maxMarks) * 1000) / 10 : 0;
                  const grade = draft.isAbsent ? 'AB' : draft.marks !== null ? calculateGradeFromPercentage(percentage, school.gradingScale).grade : '-';
                  const isPassed = !draft.isAbsent && draft.marks !== null && draft.marks >= currentSubject.passingMarks;

                  return (
                    <tr key={st.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2 px-3 font-mono font-bold text-slate-900">#{st.rollNumber}</td>
                      <td className="py-2 px-3">
                        <div className="font-bold text-slate-900">{st.fullName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{st.admissionNumber}</div>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-100 border border-slate-200 shadow-2xs">
                          <button
                            type="button"
                            onClick={() => handleSetAttendedStatus(st.id, true)}
                            title="Mark student as Attended exam"
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-black flex items-center gap-1 transition-all ${
                              !draft.isAbsent
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            <Check className="w-3 h-3" />
                            <span>Attended</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetAttendedStatus(st.id, false)}
                            title="Mark student as Absent from exam"
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-black flex items-center gap-1 transition-all ${
                              draft.isAbsent
                                ? 'bg-rose-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-rose-700'
                            }`}
                          >
                            <span>Absent</span>
                          </button>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <div className="flex flex-col items-center">
                          <input
                            type="number"
                            min="0"
                            max={currentSubject.maxMarks}
                            step="1"
                            disabled={draft.isAbsent}
                            value={draft.isAbsent ? '' : draft.marks ?? ''}
                            onChange={(e) => handleMarkChange(st.id, e.target.value)}
                            placeholder={draft.isAbsent ? 'Absent' : 'Marks'}
                            className={`w-24 text-center px-2 py-1 border rounded-lg font-mono font-bold text-xs focus:ring-2 focus:ring-indigo-500 transition-colors ${
                              draft.isAbsent
                                ? 'bg-rose-50/50 border-rose-200 text-rose-400 placeholder:text-rose-400 cursor-not-allowed'
                                : invalidMarksMap[st.id]
                                ? 'bg-rose-50 border-rose-500 text-rose-900 ring-2 ring-rose-400/50'
                                : 'bg-white border-slate-300 text-slate-900'
                            }`}
                          />
                          {invalidMarksMap[st.id] && (
                            <span className="text-[9px] text-rose-600 font-extrabold mt-0.5 animate-pulse">
                              0-{currentSubject.maxMarks} max
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-center font-mono font-bold text-slate-700">
                        {draft.isAbsent ? '—' : draft.marks !== null ? `${percentage}%` : '—'}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className={`font-mono font-black text-xs ${
                          grade === 'AB' ? 'text-rose-500' : 'text-indigo-800'
                        }`}>
                          {grade}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        {draft.isAbsent ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700">Absent</span>
                        ) : draft.marks !== null ? (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isPassed ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                          }`}>
                            {isPassed ? 'Passed' : 'Needs Support'}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <div className="flex flex-col items-center justify-center gap-1">
                          <div className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded-lg">
                            <input
                              type="number"
                              min="0"
                              max="10"
                              value={draft.attendanceMarks ?? 9}
                              onChange={(e) => handleAttendanceMarksChange(st.id, e.target.value)}
                              title="Points assigned based on attendance percentages (0-10)"
                              className="w-10 text-center py-0.5 text-xs font-mono font-bold text-indigo-900 bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500"
                            />
                            <span className="text-[10px] font-bold text-slate-500">/ 10</span>
                          </div>
                          <span className="text-[9px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded-full border border-emerald-200/60">
                            92% Turnout
                          </span>
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={draft.remarks ?? ''}
                          onChange={(e) => handleRemarksChange(st.id, e.target.value)}
                          placeholder="e.g. Excellent conceptual clarity, neat work..."
                          className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Persistent Floating Save Banner on Unsaved Changes */}
      {hasUnsavedChanges && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-slate-950/95 text-white border border-slate-700 shadow-2xl rounded-2xl px-5 py-3 flex items-center gap-4 backdrop-blur-md animate-in slide-in-from-bottom-3 no-print max-w-lg w-full justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
            <span className="text-xs font-bold text-amber-300">
              Unsaved marks changes • Class {selectedClass}-{selectedSection}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {undoStack.length > 0 && (
              <button
                type="button"
                onClick={handleBulkUndo}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors"
                title="Undo last change"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Undo</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleSaveAllMarks}
              disabled={isSaving || Object.keys(invalidMarksMap).length > 0}
              className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-emerald-600/30 active:scale-95 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>Save All Now</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
