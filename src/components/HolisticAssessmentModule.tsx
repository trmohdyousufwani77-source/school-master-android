import React, { useState } from 'react';
import {
  Sparkles,
  Award,
  Users,
  Save,
  Check,
  CheckCircle2,
  ChevronRight,
  Search,
  BookOpen,
  Sliders,
  Heart,
  Activity,
  Compass,
  Star,
} from 'lucide-react';
import {
  SchoolProfile,
  Student,
  User,
  HolisticRatingLevel,
  StudentHolisticRecord,
} from '../types';
import { Language, translations } from '../utils/translations';
import {
  HOLISTIC_ASSESSMENT_CATEGORIES,
  sampleHolisticRecords,
} from '../utils/sampleData';

interface HolisticAssessmentModuleProps {
  students: Student[];
  school: SchoolProfile;
  currentUser: User;
  language: Language;
  holisticRecords?: Record<string, StudentHolisticRecord>;
  onSaveRecord?: (record: StudentHolisticRecord) => void;
}

const RATING_LEVELS: { level: HolisticRatingLevel; color: string; bg: string }[] = [
  { level: 'Outstanding', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-300' },
  { level: 'Very Good', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-300' },
  { level: 'Good', color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-300' },
  { level: 'Developing', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-300' },
  { level: 'Needs Support', color: 'text-rose-700', bg: 'bg-rose-50 border-rose-300' },
];

export const HolisticAssessmentModule: React.FC<HolisticAssessmentModuleProps> = ({
  students,
  school,
  currentUser,
  language,
  holisticRecords,
  onSaveRecord,
}) => {
  const _t = translations[language];
  void _t;

  const [classFilter, setClassFilter] = useState<string>('all');
  const [sectionFilter, setSectionFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const activeStudents = React.useMemo(() => {
    return students
      .filter((s) => s.status === 'Active')
      .filter((s) => (classFilter === 'all' ? true : s.classNumber === classFilter))
      .filter((s) => (sectionFilter === 'all' ? true : s.section === sectionFilter))
      .filter((s) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          s.fullName.toLowerCase().includes(q) ||
          s.admissionNumber.toLowerCase().includes(q) ||
          String(s.rollNumber).includes(q)
        );
      })
      .sort((a, b) => a.classNumber.localeCompare(b.classNumber) || a.rollNumber - b.rollNumber);
  }, [students, classFilter, sectionFilter, searchQuery]);

  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    activeStudents[0]?.id || students.find((s) => s.status === 'Active')?.id || 'SM-2026-001'
  );
  const [localDrafts, setLocalDrafts] = useState<Record<string, StudentHolisticRecord>>(() => ({
    ...sampleHolisticRecords,
    ...(holisticRecords || {}),
  }));
  const [saveToast, setSaveToast] = useState<string>('');

  React.useEffect(() => {
    if (holisticRecords) {
      setLocalDrafts((prev) => ({
        ...holisticRecords,
        ...prev,
      }));
    }
  }, [holisticRecords]);

  React.useEffect(() => {
    if (activeStudents.length > 0 && !activeStudents.some((s) => s.id === selectedStudentId)) {
      setSelectedStudentId(activeStudents[0].id);
    }
  }, [activeStudents, selectedStudentId]);

  const selectedStudent = students.find((s) => s.id === selectedStudentId) || activeStudents[0];

  const baseRecord: StudentHolisticRecord = {
    id: `hol-${selectedStudentId}`,
    studentId: selectedStudentId,
    studentName: selectedStudent?.fullName || '',
    classNumber: selectedStudent?.classNumber || '5',
    section: selectedStudent?.section || 'A',
    academicSession: selectedStudent?.academicSession || school.academicSession || '2026-2027',
    assessedByTeacherId: currentUser.id,
    assessedByTeacherName: currentUser.name,
    assessedDate: new Date().toISOString().slice(0, 10),
    ratings: {
      comm: 'Very Good',
      read_write: 'Good',
      creativity: 'Good',
      problem_solving: 'Good',
      teamwork: 'Very Good',
      leadership: 'Good',
      discipline: 'Very Good',
      emotional_dev: 'Good',
      social_interaction: 'Very Good',
      environmental_awareness: 'Good',
      physical_sports: 'Good',
      art_music_culture: 'Good',
      classroom_participation: 'Very Good',
      digital_literacy: 'Good',
    },
    observations: {},
    strengths: 'Active classroom participant and respectful team member.',
    areasForImprovement: 'Needs to maintain regular homework submission schedule.',
    teacherRemarks: 'Showing continuous progress across all learning domains.',
    suggestionsForParents: 'Encourage daily 20-minute reading and outdoor sports.',
    goalsForNextTerm: 'Improve analytical problem-solving and participate in debate activities.',
    coScholasticRemarks: 'Participates enthusiastically in morning assembly, debates, and quizzes.',
    attendanceRemarks: 'Punctual and consistent attendance throughout the academic term.',
    healthPhysicalEducation: 'Physically active, maintains personal hygiene, participates in yoga and athletics.',
    artEducation: 'Expressive in drawing, calligraphy, and cultural folk art.',
    workEducation: 'Demonstrates neatness in craft, gardening, and classroom organization.',
    lifeSkillsSummary: 'Displays empathy, problem-solving ability, and collaborative communication.',
    valuesAndBehaviour: 'Courteous, disciplined, honest, and respectful toward elders and peers.',
    schoolActivitiesParticipation: 'Active in eco-club, morning assembly, and science exhibitions.',
    parentRemarks: 'Parents actively support home study routine and school engagement.',
    overallStudentDevelopment: 'Steady all-round progress across cognitive, affective, and psychomotor domains.',
    status: 'Completed',
  };

  const currentRecord: StudentHolisticRecord = {
    ...baseRecord,
    ...(holisticRecords?.[selectedStudentId] || {}),
    ...(localDrafts[selectedStudentId] || {}),
    ratings: {
      ...baseRecord.ratings,
      ...(holisticRecords?.[selectedStudentId]?.ratings || {}),
      ...(localDrafts[selectedStudentId]?.ratings || {}),
    },
  };

  const handleRatingChange = (categoryId: string, level: HolisticRatingLevel) => {
    setLocalDrafts((prev) => ({
      ...prev,
      [selectedStudentId]: {
        ...currentRecord,
        ratings: {
          ...currentRecord.ratings,
          [categoryId]: level,
        },
      },
    }));
  };

  const handleFieldChange = (field: keyof StudentHolisticRecord, value: string) => {
    setLocalDrafts((prev) => ({
      ...prev,
      [selectedStudentId]: {
        ...currentRecord,
        [field]: value,
      },
    }));
  };

  const handleSave = () => {
    const updated: StudentHolisticRecord = {
      ...currentRecord,
      studentId: selectedStudentId,
      studentName: selectedStudent?.fullName || currentRecord.studentName,
      classNumber: selectedStudent?.classNumber || currentRecord.classNumber,
      section: selectedStudent?.section || currentRecord.section,
      academicSession: selectedStudent?.academicSession || school.academicSession,
      assessedByTeacherId: currentUser.id,
      assessedByTeacherName: `${currentUser.name} (${currentUser.role === 'admin' ? 'Admin' : 'Teacher'})`,
      assessedDate: new Date().toISOString().slice(0, 10),
      status: currentRecord.status || 'Completed',
      updatedAt: new Date().toISOString(),
    };
    setLocalDrafts((prev) => ({
      ...prev,
      [selectedStudentId]: updated,
    }));
    if (onSaveRecord) {
      onSaveRecord(updated);
    }
    setSaveToast(`Holistic assessment for ${selectedStudent?.fullName} saved successfully!`);
    setTimeout(() => setSaveToast(''), 3500);
  };

  // Quick action: set all 14 categories to a specific level
  const handleBulkSetLevel = (level: HolisticRatingLevel) => {
    const allRatings: Record<string, HolisticRatingLevel> = {};
    HOLISTIC_ASSESSMENT_CATEGORIES.forEach((c) => {
      allRatings[c.id] = level;
    });
    setLocalDrafts((prev) => ({
      ...prev,
      [selectedStudentId]: {
        ...currentRecord,
        ratings: allRatings,
      },
    }));
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-amber-500" />
            <span>Holistic Development Assessment (14 NEP Domains)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Assess student life skills, co-scholastic activities, health, values, and overall development. Changes sync directly to Progress Cards.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {saveToast && (
            <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-1.5 animate-in fade-in">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>{saveToast}</span>
            </div>
          )}

          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 transition-colors flex items-center gap-1.5 shadow-sm active:scale-95"
          >
            <Save className="w-4 h-4" />
            <span>Save Assessment</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Student Selector Sidebar + 14 Category Assessment Form */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left Column: Student Selection List */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-xs text-slate-800">Active Student Cohort</span>
            <span className="text-[10px] text-slate-400 font-mono">{activeStudents.length} Students</span>
          </div>

          <div className="space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, admission #..."
                className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="px-2 py-1.5 text-[11px] font-bold bg-slate-50 border border-slate-200 rounded-xl"
              >
                <option value="all">All Classes</option>
                {(school.classesOffered || ['1', '2', '3', '4', '5', '6', '7', '8']).map((c) => (
                  <option key={c} value={c}>Class {c}</option>
                ))}
              </select>
              <select
                value={sectionFilter}
                onChange={(e) => setSectionFilter(e.target.value)}
                className="px-2 py-1.5 text-[11px] font-bold bg-slate-50 border border-slate-200 rounded-xl"
              >
                <option value="all">All Sec.</option>
                <option value="A">Sec A</option>
                <option value="B">Sec B</option>
                <option value="C">Sec C</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5 max-h-[600px] overflow-y-auto">
            {activeStudents.map((st) => {
              const isSelected = selectedStudentId === st.id;
              const rec = holisticRecords?.[st.id] || localDrafts[st.id];
              const isCompleted = rec?.status === 'Completed' || !!rec;

              return (
                <button
                  key={st.id}
                  onClick={() => setSelectedStudentId(st.id)}
                  className={`w-full p-2.5 rounded-xl text-left text-xs transition-all flex items-center justify-between ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-800'
                  }`}
                >
                  <div>
                    <div className="font-bold flex items-center gap-1.5">
                      <span className="font-mono text-[10px] opacity-75">#{st.rollNumber}</span>
                      <span>{st.fullName}</span>
                    </div>
                    <div className={`text-[10px] mt-0.5 ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                      Cls {st.classNumber}-{st.section} • Adm: {st.admissionNumber}
                    </div>
                  </div>

                  {isCompleted && (
                    <CheckCircle2 className={`w-4 h-4 ${isSelected ? 'text-amber-300' : 'text-emerald-500'}`} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right 3 Columns: 14 Categories Assessment & Remarks */}
        <div className="lg:col-span-3 space-y-6">
          {/* Active Student Header Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Assessing Student</span>
              <h2 className="text-lg font-black text-slate-900">
                {selectedStudent?.fullName} (Roll #{selectedStudent?.rollNumber})
              </h2>
              <p className="text-xs text-slate-500">
                Class {selectedStudent?.classNumber}-{selectedStudent?.section} • Adm: {selectedStudent?.admissionNumber} • Session: {selectedStudent?.academicSession || school.academicSession}
              </p>
            </div>

            {/* Quick Bulk Action */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <select
                value={currentRecord.status || 'Completed'}
                onChange={(e) => handleFieldChange('status', e.target.value)}
                className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-300 text-[11px] font-bold text-slate-800"
              >
                <option value="Completed">HPC Status: Completed</option>
                <option value="Pending">HPC Status: Pending</option>
              </select>
              <button
                onClick={() => handleBulkSetLevel('Very Good')}
                className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold"
              >
                All Very Good
              </button>
              <button
                onClick={() => handleBulkSetLevel('Outstanding')}
                className="px-2.5 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold"
              >
                All Outstanding
              </button>
            </div>
          </div>

          {/* 14 Categories Cards */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
              <Award className="w-4 h-4 text-indigo-600" />
              <span>14 Core Holistic Assessment Categories</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {HOLISTIC_ASSESSMENT_CATEGORIES.map((cat, i) => {
                const activeLevel = currentRecord.ratings[cat.id] || 'Good';

                return (
                  <div
                    key={cat.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-white transition-all space-y-2.5"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-200 font-mono text-[10px] font-bold flex items-center justify-center text-slate-700 shrink-0">
                          {i + 1}
                        </span>
                        <div>
                          <h4 className="font-bold text-slate-900 text-xs">{cat.name}</h4>
                          <span className="font-urdu text-[11px] text-slate-500 block">{cat.nameUrdu}</span>
                        </div>
                      </div>

                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-50 text-indigo-700">
                        {cat.domain}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                      {cat.description}
                    </p>

                    {/* 5 Configurable Level Buttons */}
                    <div className="grid grid-cols-5 gap-1 pt-1">
                      {RATING_LEVELS.map(({ level }) => {
                        const isSelected = activeLevel === level;
                        return (
                          <button
                            key={level}
                            type="button"
                            onClick={() => handleRatingChange(cat.id, level)}
                            className={`py-1 px-0.5 rounded text-[10px] font-bold text-center transition-all truncate ${
                              isSelected
                                ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-400'
                                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                            title={level}
                          >
                            {level === 'Needs Support' ? 'Needs Supp.' : level}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* All Holistic Progress Card Qualitative Sections */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-extrabold text-sm text-slate-900">
              Holistic Domains, Co-Scholastic, Health, Values & Remarks
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Co-Scholastic Activities Remarks:</label>
                <textarea rows={2} value={currentRecord.coScholasticRemarks || ''} onChange={(e) => handleFieldChange('coScholasticRemarks', e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Health & Physical Education:</label>
                <textarea rows={2} value={currentRecord.healthPhysicalEducation || ''} onChange={(e) => handleFieldChange('healthPhysicalEducation', e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Art Education:</label>
                <textarea rows={2} value={currentRecord.artEducation || ''} onChange={(e) => handleFieldChange('artEducation', e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Work Education:</label>
                <textarea rows={2} value={currentRecord.workEducation || ''} onChange={(e) => handleFieldChange('workEducation', e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Life Skills Summary:</label>
                <textarea rows={2} value={currentRecord.lifeSkillsSummary || ''} onChange={(e) => handleFieldChange('lifeSkillsSummary', e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Values & Behaviour:</label>
                <textarea rows={2} value={currentRecord.valuesAndBehaviour || ''} onChange={(e) => handleFieldChange('valuesAndBehaviour', e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Participation in School Activities:</label>
                <textarea rows={2} value={currentRecord.schoolActivitiesParticipation || ''} onChange={(e) => handleFieldChange('schoolActivitiesParticipation', e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Attendance & Regularity Remarks:</label>
                <textarea rows={2} value={currentRecord.attendanceRemarks || ''} onChange={(e) => handleFieldChange('attendanceRemarks', e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Student Strengths & Commendations:</label>
                <textarea rows={2} value={currentRecord.strengths} onChange={(e) => handleFieldChange('strengths', e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Areas Requiring Improvement:</label>
                <textarea rows={2} value={currentRecord.areasForImprovement} onChange={(e) => handleFieldChange('areasForImprovement', e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Teacher Remarks:</label>
                <textarea rows={2} value={currentRecord.teacherRemarks} onChange={(e) => handleFieldChange('teacherRemarks', e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Parent Remarks & Suggestions:</label>
                <textarea rows={2} value={currentRecord.parentRemarks || currentRecord.suggestionsForParents} onChange={(e) => handleFieldChange('parentRemarks', e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
              </div>
              <div className="md:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">Overall Student Development & Next Term Goals:</label>
                <textarea rows={2} value={currentRecord.overallStudentDevelopment || ''} onChange={(e) => handleFieldChange('overallStudentDevelopment', e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
              </div>
              <div className="md:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">Goals for the Next Academic Term:</label>
                <input
                  type="text"
                  value={currentRecord.goalsForNextTerm}
                  onChange={(e) => handleFieldChange('goalsForNextTerm', e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={handleSave}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-sm"
              >
                <Save className="w-4 h-4" />
                <span>Save All Observations for {selectedStudent?.fullName}</span>
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
