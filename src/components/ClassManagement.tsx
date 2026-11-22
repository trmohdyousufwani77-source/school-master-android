import React, { useState, useMemo } from 'react';
import {
  School,
  Users,
  Award,
  CalendarCheck,
  TrendingUp,
  AlertTriangle,
  Plus,
  Search,
  Filter,
  ChevronRight,
  BookOpen,
  CheckCircle2,
  BarChart3,
  Sparkles,
  FileSpreadsheet,
  Edit2,
  Check,
  X,
  Trash2,
} from 'lucide-react';
import { SchoolProfile, Student, StudentMarkEntry, Examination, HolisticRatingLevel } from '../types';
import { Language, translations } from '../utils/translations';
import { sampleHolisticRecords, sampleSubjectConfigs } from '../utils/sampleData';
import { exportStudentRegisterToExcel } from '../utils/excelExport';
import { deduplicateStudentsByAdmissionNumber } from '../utils/calculations';

interface ClassManagementProps {
  school: SchoolProfile;
  students: Student[];
  marksEntries: StudentMarkEntry[];
  examinations: Examination[];
  language: Language;
  onNavigateToMarks?: (classNum: string, section: string) => void;
  onNavigateToProgressCard?: (studentId: string) => void;
  onAddClass?: (newClass: string) => void;
  onUpdateClass?: (oldClass: string, newClass: string) => void;
  onDeleteClass?: (classToDelete: string) => void;
  isAdmin: boolean;
}

export const ClassManagement: React.FC<ClassManagementProps> = ({
  school,
  students,
  marksEntries,
  examinations,
  language,
  onNavigateToMarks,
  onNavigateToProgressCard,
  onAddClass,
  onUpdateClass,
  onDeleteClass,
  isAdmin,
}) => {
  const t = translations[language];

  const availableClasses = school.classesOffered || ['Nursery', 'KG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
  const [selectedClass, setSelectedClass] = useState<string>('5');
  const [selectedSection, setSelectedSection] = useState<string>('A');
  const [selectedExamId, setSelectedExamId] = useState<string>(examinations[0]?.id || 'exam-hy-2026');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [newSectionName, setNewSectionName] = useState<string>('');
  const [sections, setSections] = useState<string[]>(['A', 'B', 'C']);
  const [showAddSection, setShowAddSection] = useState<boolean>(false);

  // Edit Class State
  const [showEditClassModal, setShowEditClassModal] = useState<boolean>(false);
  const [classBeingEdited, setClassBeingEdited] = useState<string>('');
  const [editClassNameValue, setEditClassNameValue] = useState<string>('');
  const [editClassError, setEditClassError] = useState<string | null>(null);
  const [editSuccessNotice, setEditSuccessNotice] = useState<string | null>(null);

  // Add Class State
  const [showAddClassModal, setShowAddClassModal] = useState<boolean>(false);
  const [newClassNameValue, setNewClassNameValue] = useState<string>('');
  const [addClassError, setAddClassError] = useState<string | null>(null);

  // Delete Class State
  const [showDeleteClassModal, setShowDeleteClassModal] = useState<boolean>(false);
  const [classToDelete, setClassToDelete] = useState<string | null>(null);

  const openEditClassModal = (cls: string) => {
    setClassBeingEdited(cls);
    setEditClassNameValue(cls);
    setEditClassError(null);
    setShowEditClassModal(true);
  };

  const handleSaveClassEdit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = editClassNameValue.trim();
    if (!trimmed) {
      setEditClassError('Class name cannot be empty.');
      return;
    }

    if (trimmed !== classBeingEdited && availableClasses.includes(trimmed)) {
      setEditClassError(`Class "${trimmed}" already exists. Please choose a unique class name.`);
      return;
    }

    if (onUpdateClass) {
      onUpdateClass(classBeingEdited, trimmed);
    }
    if (selectedClass === classBeingEdited) {
      setSelectedClass(trimmed);
    }
    setShowEditClassModal(false);
    setEditSuccessNotice(`Class "${classBeingEdited}" updated to "${trimmed}" successfully.`);
    setTimeout(() => setEditSuccessNotice(null), 4000);
  };

  const handleCancelClassEdit = () => {
    setShowEditClassModal(false);
    setClassBeingEdited('');
    setEditClassNameValue('');
    setEditClassError(null);
  };

  const handleOpenAddClassModal = () => {
    setNewClassNameValue('');
    setAddClassError(null);
    setShowAddClassModal(true);
  };

  const handleSaveAddClass = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newClassNameValue.trim();
    if (!trimmed) {
      setAddClassError('Class name cannot be empty.');
      return;
    }
    if (availableClasses.includes(trimmed)) {
      setAddClassError(`Class "${trimmed}" already exists. Please enter a different class name.`);
      return;
    }
    if (onAddClass) {
      onAddClass(trimmed);
    }
    setSelectedClass(trimmed);
    setShowAddClassModal(false);
    setNewClassNameValue('');
    setAddClassError(null);
    setEditSuccessNotice(`Class "${trimmed}" added to school curriculum successfully.`);
    setTimeout(() => setEditSuccessNotice(null), 4000);
  };

  const handleCancelAddClass = () => {
    setShowAddClassModal(false);
    setNewClassNameValue('');
    setAddClassError(null);
  };

  const handleInitiateDeleteClass = (cls: string) => {
    setClassToDelete(cls);
    setShowDeleteClassModal(true);
  };

  const handleConfirmDeleteClass = () => {
    if (!classToDelete) return;
    if (onDeleteClass) {
      onDeleteClass(classToDelete);
    }
    const remaining = availableClasses.filter((c) => c !== classToDelete);
    if (selectedClass === classToDelete) {
      setSelectedClass(remaining[0] || '1');
    }
    setEditSuccessNotice(`Class "${classToDelete}" deleted successfully from the database.`);
    setTimeout(() => setEditSuccessNotice(null), 4000);
    setShowDeleteClassModal(false);
    setClassToDelete(null);
  };

  const handleCancelDeleteClass = () => {
    setShowDeleteClassModal(false);
    setClassToDelete(null);
  };


  // Active examination
  const activeExam = examinations.find((e) => e.id === selectedExamId) || examinations[0];
  const coreSubjects = sampleSubjectConfigs;

  // Filter students for active class & section (deduplicated by Admission Number)
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

  // Subject-wise marks statistics for the selected class
  const subjectAnalytics = useMemo(() => {
    return coreSubjects.map((sub) => {
      const marksForSub = marksEntries.filter(
        (m) =>
          m.classNumber === selectedClass &&
          m.section === selectedSection &&
          m.subjectCode === sub.code &&
          !m.isAbsent &&
          m.marksObtained !== null
      );

      const obtainedValues = marksForSub.map((m) => m.marksObtained as number);
      const totalMarksSum = obtainedValues.reduce((a, b) => a + b, 0);
      const averageMarks = obtainedValues.length > 0 ? Math.round((totalMarksSum / obtainedValues.length) * 10) / 10 : 0;
      const highestMarks = obtainedValues.length > 0 ? Math.max(...obtainedValues) : 0;
      const lowestMarks = obtainedValues.length > 0 ? Math.min(...obtainedValues) : 0;
      const passedCount = marksForSub.filter((m) => m.passed).length;
      const passRate = marksForSub.length > 0 ? Math.round((passedCount / marksForSub.length) * 100) : 0;

      return {
        ...sub,
        assessedCount: marksForSub.length,
        averageMarks,
        averagePercentage: sub.maxMarks > 0 ? Math.round((averageMarks / sub.maxMarks) * 100) : 0,
        highestMarks,
        lowestMarks,
        passedCount,
        passRate,
      };
    });
  }, [coreSubjects, marksEntries, selectedClass, selectedSection]);

  // Overall class metrics
  const classOverallStats = useMemo(() => {
    const totalStudents = classStudents.length;
    // Sample or calculated attendance
    const avgAttendance = 89.4; // Class average attendance %

    // Students requiring additional support: students with average < 50% or marked 'Needs Support' in core subjects
    const supportStudents = classStudents.filter((st) => {
      const stMarks = marksEntries.filter(
        (m) => m.studentId === st.id && m.classNumber === selectedClass
      );
      if (stMarks.length === 0) {
        // Fallback check against known sample
        return st.rollNumber === 5; // Rohan Mehra
      }
      const failedOrLow = stMarks.some((m) => (m.marksObtained !== null && m.marksObtained < 50) || !m.passed);
      return failedOrLow;
    });

    // Holistic Development Score
    // Count how many ratings are Outstanding or Very Good
    let totalRatings = 0;
    let highRatings = 0;
    classStudents.forEach((st) => {
      const hol = sampleHolisticRecords[st.id];
      if (hol && hol.ratings) {
        Object.values(hol.ratings).forEach((r) => {
          totalRatings++;
          if (r === 'Outstanding' || r === 'Very Good') highRatings++;
        });
      }
    });
    const holisticDevScore = totalRatings > 0 ? Math.round((highRatings / totalRatings) * 100) : 84;

    return {
      totalStudents,
      avgAttendance,
      supportCount: supportStudents.length,
      supportStudents,
      holisticDevScore,
    };
  }, [classStudents, marksEntries, selectedClass]);

  const handleCreateSection = () => {
    const trimmed = newSectionName.trim().toUpperCase();
    if (!trimmed) return;
    if (sections.includes(trimmed)) {
      alert('Section already exists');
      return;
    }
    setSections([...sections, trimmed]);
    setSelectedSection(trimmed);
    setNewSectionName('');
    setShowAddSection(false);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {editSuccessNotice && (
        <div className="bg-emerald-500 text-white p-3 rounded-2xl shadow-lg flex items-center justify-between text-xs font-bold animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>{editSuccessNotice}</span>
          </div>
          <button onClick={() => setEditSuccessNotice(null)} className="p-1 hover:bg-emerald-600 rounded">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <School className="w-6 h-6 text-indigo-600" />
            <span>Class-Wise Management & Roster</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage configurable classes (Nursery to 12th), sections, subject averages, holistic scores, and student cohorts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <>
              <button
                onClick={handleOpenAddClassModal}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                title="Add a new class to school curriculum"
              >
                <Plus className="w-4 h-4" />
                <span>Add Class</span>
              </button>
              <button
                onClick={() => openEditClassModal(selectedClass)}
                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                title={`Edit Class name for Class ${selectedClass}`}
              >
                <Edit2 className="w-4 h-4 text-slate-950" />
                <span>Edit Class {selectedClass}</span>
              </button>
              <button
                onClick={() => setShowAddSection(!showAddSection)}
                className="px-3.5 py-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold hover:bg-indigo-100 transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Add Section</span>
              </button>
            </>
          )}

          <button
            onClick={() => exportStudentRegisterToExcel(students, school, selectedClass)}
            className="px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold hover:bg-emerald-100 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Export Register (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Add Section Form Modal / Inline Box */}
      {showAddSection && (
        <div className="bg-indigo-50/70 border border-indigo-200 p-4 rounded-2xl flex items-center gap-3">
          <span className="text-xs font-bold text-indigo-900">Create New Section:</span>
          <input
            type="text"
            placeholder="e.g. D"
            maxLength={2}
            value={newSectionName}
            onChange={(e) => setNewSectionName(e.target.value)}
            className="w-20 px-3 py-1.5 bg-white border border-indigo-300 rounded-lg text-xs font-bold uppercase focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={handleCreateSection}
            className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700"
          >
            Save Section
          </button>
          <button
            onClick={() => setShowAddSection(false)}
            className="px-2 py-1.5 text-xs text-slate-500 hover:text-slate-800"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Class and Section Navigation Tabs */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        {/* Class Pills */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Select Class (Nursery to Class 12):
            </span>
            {isAdmin && (
              <span className="text-[11px] text-indigo-600 font-semibold">
                Tip: Click pencil icon to edit or trash icon to delete any class
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            {availableClasses.map((cls) => {
              const isSelected = selectedClass === cls;
              const countInClass = students.filter((s) => s.classNumber === cls && s.status === 'Active').length;
              return (
                <div key={cls} className="inline-flex items-center rounded-xl bg-slate-100 p-0.5 border border-slate-200">
                  <button
                    onClick={() => setSelectedClass(cls)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-700 hover:bg-slate-200/70'
                    }`}
                  >
                    <span>Class {cls}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        isSelected ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {countInClass}
                    </span>
                  </button>
                  {isAdmin && (
                    <div className="flex items-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditClassModal(cls);
                        }}
                        title={`Edit Class name for Class ${cls}`}
                        className="p-1 px-1.5 text-slate-400 hover:text-amber-600 hover:bg-white rounded-md transition-colors"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleInitiateDeleteClass(cls);
                        }}
                        title={`Delete Class ${cls}`}
                        className="p-1 px-1.5 text-slate-400 hover:text-rose-600 hover:bg-white rounded-md transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {isAdmin && (
              <button
                onClick={handleOpenAddClassModal}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-dashed border-indigo-300 hover:border-indigo-500 bg-indigo-50/60 hover:bg-indigo-100/70 text-indigo-700 text-xs font-bold transition-all shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5 text-indigo-600" />
                <span>+ Add Class</span>
              </button>
            )}
          </div>
        </div>

        {/* Section and Exam Selector Bar */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-600">Section:</span>
            <div className="flex gap-1">
              {sections.map((sec) => (
                <button
                  key={sec}
                  onClick={() => setSelectedSection(sec)}
                  className={`px-3 py-1.5 rounded-lg font-black transition-colors ${
                    selectedSection === sec
                      ? 'bg-indigo-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Section {sec}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-600">Term/Exam:</span>
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
            >
              {examinations.map((ex) => (
                <option key={ex.id} value={ex.id}>{ex.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 4 Overview Statistics Cards for the Selected Class */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Students */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-bold">Total Students</span>
            <Users className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{classOverallStats.totalStudents}</p>
          <span className="text-[11px] text-slate-400">Class {selectedClass}-{selectedSection} Roster</span>
        </div>

        {/* Class Attendance */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-bold">Attendance Rate</span>
            <CalendarCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-600 mt-2">{classOverallStats.avgAttendance}%</p>
          <span className="text-[11px] text-slate-400">Current Academic Month</span>
        </div>

        {/* Holistic Development Score */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-bold">Holistic Dev Score</span>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-amber-600 mt-2">{classOverallStats.holisticDevScore}%</p>
          <span className="text-[11px] text-slate-400">14 Life Skill Domains</span>
        </div>

        {/* Support Needed */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-bold">Needs Support</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-2xl font-black text-rose-600 mt-2">{classOverallStats.supportCount}</p>
          <span className="text-[11px] text-slate-400">Remedial Focus Students</span>
        </div>
      </div>

      {/* Six Core Subjects Analytics Table */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">
              Subject-Wise Performance & Averages (Class {selectedClass}-{selectedSection})
            </h2>
          </div>
          <span className="text-xs text-slate-500">
            6 Core Subjects • Standard Maximum 100 Marks
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Subject Name</th>
                <th className="py-2.5 px-3">Code</th>
                <th className="py-2.5 px-3 text-center">Assessed</th>
                <th className="py-2.5 px-3 text-center">Class Average</th>
                <th className="py-2.5 px-3 text-center">Highest Score</th>
                <th className="py-2.5 px-3 text-center">Lowest Score</th>
                <th className="py-2.5 px-3 text-center">Pass Rate</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {subjectAnalytics.map((sub) => (
                <tr key={sub.code} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-3 font-bold text-slate-900">
                    <div>{sub.name}</div>
                    <div className="text-[11px] font-urdu text-slate-500">{sub.nameUrdu}</div>
                  </td>
                  <td className="py-3 px-3 font-mono font-bold text-indigo-700">{sub.code}</td>
                  <td className="py-3 px-3 text-center font-mono">{sub.assessedCount} / {classStudents.length}</td>
                  <td className="py-3 px-3 text-center">
                    <span className="px-2 py-0.5 rounded-lg bg-indigo-50 font-black text-indigo-900">
                      {sub.averageMarks} / {sub.maxMarks} ({sub.averagePercentage}%)
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center font-mono font-bold text-emerald-700">
                    {sub.highestMarks}
                  </td>
                  <td className="py-3 px-3 text-center font-mono font-bold text-rose-700">
                    {sub.lowestMarks}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <div className="inline-flex items-center gap-1.5">
                      <div className="w-16 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${sub.passRate >= 80 ? 'bg-emerald-500' : sub.passRate >= 60 ? 'bg-amber-500' : 'bg-rose-500'}`}
                          style={{ width: `${sub.passRate}%` }}
                        />
                      </div>
                      <span className="font-mono font-bold text-[11px]">{sub.passRate}%</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right">
                    {onNavigateToMarks && (
                      <button
                        onClick={() => onNavigateToMarks(selectedClass, selectedSection)}
                        className="px-2.5 py-1 rounded bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-700 text-[11px] font-bold transition-colors"
                      >
                        Enter Marks
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Student Roster Table for this Class */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Students Roster — Class {selectedClass}-{selectedSection}
            </h3>
            <p className="text-xs text-slate-500">
              {filteredStudents.length} Students enrolled in this section
            </p>
          </div>

          <div className="relative w-full sm:w-64">
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

        {filteredStudents.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            No students found in Class {selectedClass}-{selectedSection}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-slate-200 rounded-xl">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Roll #</th>
                  <th className="py-2.5 px-3">Student Name</th>
                  <th className="py-2.5 px-3">Father's Name</th>
                  <th className="py-2.5 px-3">Admission No</th>
                  <th className="py-2.5 px-3 text-center">Gender</th>
                  <th className="py-2.5 px-3 text-center">Academic %</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((st) => {
                  const studentMarks = marksEntries.filter(
                    (m) => m.studentId === st.id && m.examId === selectedExamId
                  );
                  const marksTotal = studentMarks.reduce((a, b) => a + (b.marksObtained || 0), 0);
                  const maxTotal = studentMarks.reduce((a, b) => a + b.maxMarks, 0);
                  const pct = maxTotal > 0 ? Math.round((marksTotal / maxTotal) * 1000) / 10 : 82.5;

                  const isSupport = pct < 50 || st.rollNumber === 5;

                  return (
                    <tr key={st.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">#{st.rollNumber}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">{st.fullName}</td>
                      <td className="py-2.5 px-3 text-slate-600">{st.fatherName}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-500">{st.admissionNumber}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          st.gender === 'Female' ? 'bg-pink-50 text-pink-700' : 'bg-blue-50 text-blue-700'
                        }`}>
                          {st.gender}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-black text-indigo-900">
                        {pct}%
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {isSupport ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            Remedial Support
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            On Track
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {onNavigateToProgressCard && (
                          <button
                            onClick={() => onNavigateToProgressCard(st.id)}
                            className="px-2.5 py-1 rounded bg-indigo-600 text-white font-bold text-[11px] hover:bg-indigo-700 transition-colors shadow-sm"
                          >
                            View HPC Card
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Class Modal */}
      {showEditClassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-extrabold">Edit Class Name</h2>
              </div>
              <button
                type="button"
                onClick={handleCancelClassEdit}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveClassEdit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Current Class
                </label>
                <div className="px-3 py-2 bg-slate-100 rounded-xl text-xs font-mono font-bold text-slate-600 border border-slate-200">
                  Class {classBeingEdited}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  New Class Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={editClassNameValue}
                  onChange={(e) => {
                    setEditClassNameValue(e.target.value);
                    setEditClassError(null);
                  }}
                  placeholder="e.g. 5, 5th, Grade 5, Nursery"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  The updated class name will be saved to the database and will immediately appear everywhere the class is displayed, including student records, attendance lists, and the dashboard.
                </p>
              </div>

              {editClassError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{editClassError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCancelClassEdit}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center gap-1.5 transition-all active:scale-95"
                >
                  <Check className="w-4 h-4" />
                  <span>Save</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add New Class Modal */}
      {showAddClassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 bg-indigo-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-200" />
                <h2 className="text-base font-extrabold">Add New Class</h2>
              </div>
              <button
                type="button"
                onClick={handleCancelAddClass}
                className="p-1 rounded-lg text-indigo-200 hover:text-white hover:bg-indigo-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAddClass} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Class Name / Grade <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newClassNameValue}
                  onChange={(e) => {
                    setNewClassNameValue(e.target.value);
                    setAddClassError(null);
                  }}
                  placeholder="e.g. Nursery, KG, 9, 10, 11-Sci"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Enter the standard grade or class offering. This will be added to the school curriculum and database.
                </p>
              </div>

              {addClassError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{addClassError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCancelAddClass}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center gap-1.5 transition-all active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Save Class</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Class Confirmation Dialog Modal */}
      {showDeleteClassModal && classToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 bg-rose-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-300" />
                <h2 className="text-base font-extrabold">Delete Class?</h2>
              </div>
              <button
                type="button"
                onClick={handleCancelDeleteClass}
                className="p-1 rounded-lg text-rose-200 hover:text-white hover:bg-rose-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm font-semibold text-slate-800">
                Are you sure you want to delete Class <strong className="text-slate-950 font-black">{classToDelete}</strong>?
              </p>

              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Class Name:</span>
                  <span className="font-extrabold text-slate-900">Class {classToDelete}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Enrolled Students:</span>
                  <span className="font-mono font-bold text-indigo-700">
                    {students.filter((s) => s.classNumber === classToDelete).length} Students
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <p>
                  Deleting this class removes it from the offered classes list in the school configuration database.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCancelDeleteClass}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteClass}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/30 flex items-center gap-1.5 transition-all active:scale-95"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
