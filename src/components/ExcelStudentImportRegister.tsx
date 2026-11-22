import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  Users,
  Search,
  Printer,
  Plus,
  Edit2,
  Trash2,
  X,
  ArrowUpDown,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { ExcelMappingSchema, SchoolProfile, Student, User } from '../types';
import { Language } from '../utils/translations';
import { deduplicateStudentsByAdmissionNumber, formatSchoolAddressOnce } from '../utils/calculations';
import { SmartOcrBulkImportTab } from './SmartOcrBulkImportTab';
import { ExcelTemplateMappingPage } from './ExcelTemplateMappingPage';

interface ExcelStudentImportRegisterProps {
  students: Student[];
  school: SchoolProfile;
  currentUser: User;
  onAddStudent: (newStudent: Student) => void;
  onUpdateStudent: (updatedStudent: Student) => void;
  onDeleteStudent?: (studentId: string) => void;
  onBulkAddStudents: (newStudents: Student[]) => void;
  onBulkDeleteStudents?: (studentIds: string[]) => void;
  mappingSchemas?: ExcelMappingSchema[];
  activeSchemaId?: string;
  onSaveSchema?: (schema: ExcelMappingSchema, isNew: boolean) => void;
  onDeleteSchema?: (schemaId: string) => void;
  onSelectActiveSchema?: (schemaId: string) => void;
  language: Language;
  onNavigateToAttendance?: () => void;
  onNavigateToMarks?: () => void;
  onNavigateToHpc?: () => void;
}

export interface ExcelRowPreview {
  tempId: string;
  name: string;
  className: string;
  section: string;
  gender: string;
  dob: string;
  contact: string;
  guardian: string;
  isValid: boolean;
  errors: string[];
  isDuplicate: boolean;
  duplicateReason?: string;
  duplicateResolution: 'skip' | 'update' | 'import_new';
}

export const ExcelStudentImportRegister: React.FC<ExcelStudentImportRegisterProps> = ({
  students,
  school,
  currentUser,
  onAddStudent,
  onUpdateStudent,
  onDeleteStudent,
  onBulkAddStudents,
  onBulkDeleteStudents,
  mappingSchemas = [],
  activeSchemaId = '',
  onSaveSchema,
  onDeleteSchema,
  onSelectActiveSchema,
  language,
  onNavigateToAttendance,
  onNavigateToMarks,
  onNavigateToHpc,
}) => {
  // Active View Tab: 'import' | 'class_registers' | 'template_mapping'
  const [activeTab, setActiveTab] = useState<'import' | 'class_registers' | 'template_mapping'>('import');

  // Available classes (e.g., 1 to 8 or school classesOffered)
  const availableClasses = useMemo(() => {
    return school.classesOffered && school.classesOffered.length > 0
      ? school.classesOffered
      : ['1', '2', '3', '4', '5', '6', '7', '8'];
  }, [school.classesOffered]);

  // Selected Class in Class-Wise Register
  const [selectedClass, setSelectedClass] = useState<string>(availableClasses[0] || '1');

  // Filters within Class-Wise Register
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [genderFilter, setGenderFilter] = useState<'All' | 'Male' | 'Female' | 'Other'>('All');
  const [sectionFilter, setSectionFilter] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'roll' | 'name' | 'dob'>('roll');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Edit / Add Student Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  // Form Fields for Add/Edit
  const [formName, setFormName] = useState<string>('');
  const [formClass, setFormClass] = useState<string>('1');
  const [formSection, setFormSection] = useState<string>('A');
  const [formGender, setFormGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [formDob, setFormDob] = useState<string>('2016-01-15');
  const [formContact, setFormContact] = useState<string>('');
  const [formGuardian, setFormGuardian] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);

  // Deletion Confirmation State
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);

  // Notification Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // =========================================================================
  // CLASS-WISE STUDENT REGISTER LOGIC (Unified per class, NOT split by section)
  // =========================================================================
  // Filter all students belonging to the selected Class (e.g. Class 5, deduplicated by Admission Number)
  const classStudents = useMemo(() => {
    return deduplicateStudentsByAdmissionNumber(students).filter(
      (s) => s.classNumber === selectedClass && s.status === 'Active'
    );
  }, [students, selectedClass]);

  // Available sections within this class for optional secondary filter
  const classSections = useMemo(() => {
    const secs = new Set(classStudents.map((s) => s.section || 'A'));
    return Array.from(secs).sort();
  }, [classStudents]);

  // Filter & sort
  const filteredClassStudents = useMemo(() => {
    let result = classStudents.filter((s) => {
      // Search
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        s.fullName.toLowerCase().includes(q) ||
        s.admissionNumber.toLowerCase().includes(q) ||
        (s.mobileNumber || '').includes(q) ||
        (s.guardianName || s.fatherName || '').toLowerCase().includes(q) ||
        String(s.rollNumber) === q;

      // Gender filter
      const matchGender = genderFilter === 'All' || s.gender === genderFilter;

      // Optional Section filter (does not change underlying class-wise organization)
      const matchSection = sectionFilter === 'All' || s.section === sectionFilter;

      return matchSearch && matchGender && matchSection;
    });

    // Sorting
    result.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'roll') {
        cmp = a.rollNumber - b.rollNumber;
      } else if (sortBy === 'name') {
        cmp = a.fullName.localeCompare(b.fullName);
      } else if (sortBy === 'dob') {
        cmp = (a.dob || '').localeCompare(b.dob || '');
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [classStudents, searchQuery, genderFilter, sectionFilter, sortBy, sortOrder]);

  // Add / Edit Handlers
  const handleOpenAddModal = () => {
    setModalMode('add');
    setEditingStudent(null);
    setFormName('');
    setFormClass(selectedClass);
    setFormSection('A');
    setFormGender('Male');
    setFormDob('2016-01-15');
    setFormContact('');
    setFormGuardian('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (student: Student) => {
    setModalMode('edit');
    setEditingStudent(student);
    setFormName(student.fullName);
    setFormClass(student.classNumber);
    setFormSection(student.section || 'A');
    setFormGender(student.gender || 'Male');
    setFormDob(student.dob || '2016-01-15');
    setFormContact(student.mobileNumber || student.parentWhatsAppNumber || '');
    setFormGuardian(student.guardianName || student.fatherName || '');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSaveStudentForm = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = formName.trim();
    if (!cleanName || cleanName.length < 2) {
      setFormError('Student full name is required (minimum 2 characters).');
      return;
    }
    if (!formDob || !/^\d{4}-\d{2}-\d{2}$/.test(formDob)) {
      setFormError('Valid Date of Birth is required (YYYY-MM-DD).');
      return;
    }

    if (modalMode === 'add') {
      const nextSeq = students.length + 1;
      const newStudent: Student = {
        id: `SM-2026-${String(nextSeq).padStart(3, '0')}`,
        admissionNumber: `ADM-2026-${String(1000 + nextSeq)}`,
        fullName: cleanName,
        fatherName: formGuardian.trim() || 'Guardian',
        motherName: 'Mother',
        guardianName: formGuardian.trim(),
        gender: formGender,
        dob: formDob,
        classNumber: formClass,
        section: formSection.toUpperCase(),
        rollNumber: nextSeq,
        academicSession: school.academicSession,
        address: formatSchoolAddressOnce(school),
        villageTown: school.villageTown || 'Pamposh Colony, Palpora',
        blockTehsil: school.blockTehsil || 'Iddgah',
        district: school.district || 'Srinagar',
        state: school.state || 'Jammu and Kashmir',
        pinCode: school.pinCode || '190017',
        mobileNumber: formContact.trim() || '+91 98000 00000',
        parentWhatsAppNumber: formContact.trim() || '+91 98000 00000',
        admissionDate: new Date().toISOString().slice(0, 10),
        status: 'Active',
        aadhaarStatus: 'Pending',
        parentConsentRecorded: false,
      };
      onAddStudent(newStudent);
      showToast(`Student "${cleanName}" added successfully to Class ${formClass}.`);
    } else if (modalMode === 'edit' && editingStudent) {
      const wasClassChanged = editingStudent.classNumber !== formClass;
      const updated: Student = {
        ...editingStudent,
        fullName: cleanName,
        classNumber: formClass,
        section: formSection.toUpperCase(),
        gender: formGender,
        dob: formDob,
        mobileNumber: formContact.trim() || editingStudent.mobileNumber,
        parentWhatsAppNumber: formContact.trim() || editingStudent.parentWhatsAppNumber,
        guardianName: formGuardian.trim() || editingStudent.guardianName,
        fatherName: formGuardian.trim() || editingStudent.fatherName,
      };
      onUpdateStudent(updated);
      showToast(
        wasClassChanged
          ? `Updated "${cleanName}" and moved to Class ${formClass} register.`
          : `Updated details for "${cleanName}".`
      );
    }

    setIsModalOpen(false);
  };

  const handleConfirmDelete = () => {
    if (!studentToDelete) return;
    if (onDeleteStudent) {
      onDeleteStudent(studentToDelete.id);
      showToast(`Student "${studentToDelete.fullName}" was removed from the register.`);
    }
    setStudentToDelete(null);
  };

  // Export Class-Wise Register to Excel
  const handleExportClassToExcel = () => {
    const data = filteredClassStudents.map((s, idx) => ({
      'S. No.': idx + 1,
      'Student Name (Full Name)': s.fullName,
      'Class / Grade': s.classNumber,
      'Section': s.section,
      'Gender': s.gender,
      'Date of Birth': s.dob,
      'Email / Phone Number': s.mobileNumber || s.parentWhatsAppNumber || 'N/A',
      'Guardian / Emergency Contact': s.guardianName || s.fatherName || 'N/A',
      'Admission Number': s.admissionNumber,
      'Roll Number': s.rollNumber,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [
      { wch: 8 },
      { wch: 26 },
      { wch: 12 },
      { wch: 10 },
      { wch: 10 },
      { wch: 14 },
      { wch: 22 },
      { wch: 30 },
      { wch: 16 },
      { wch: 10 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Class_${selectedClass}_Register`);
    XLSX.writeFile(wb, `Class_${selectedClass}_Student_Register_${school.academicSession}.xlsx`);
    showToast(`Exported Class ${selectedClass} register to Excel.`);
  };

  // Print Register
  const handlePrintRegister = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-slate-950 text-white border border-emerald-500/80 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-xs font-bold animate-in slide-in-from-top-3 no-print">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Official Header Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 text-white p-5 sm:p-6 rounded-3xl border border-emerald-500/30 shadow-xl no-print">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-bold">
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>OFFICIAL MODULE • 7-COLUMN ROSTER COMPLIANT</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              BULK STUDENT IMPORT (EXCEL) & CLASS-WISE STUDENT REGISTER
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100/80">
              Government of Jammu and Kashmir • School Education Department • RTE Statutory Register
            </p>
          </div>

          {/* Module Switcher Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-white/10 rounded-2xl border border-white/10 shrink-0">
            <button
              onClick={() => setActiveTab('class_registers')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                activeTab === 'class_registers'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-white hover:bg-white/10'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Class-Wise Student Register</span>
            </button>

            <button
              onClick={() => setActiveTab('import')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                activeTab === 'import'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-white hover:bg-white/10'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>Smart OCR &amp; Excel Bulk Import</span>
            </button>

            <button
              onClick={() => setActiveTab('template_mapping')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                activeTab === 'template_mapping'
                  ? 'bg-amber-400 text-slate-950 shadow-md'
                  : 'text-white hover:bg-white/10'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Excel Template Mapping</span>
            </button>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: SMART OCR & BULK EXCEL STUDENT IMPORT WORKFLOW                 */}
      {/* ===================================================================== */}
      {activeTab === 'import' && (
        <SmartOcrBulkImportTab
          students={students}
          school={school}
          currentUser={currentUser}
          onBulkAddStudents={onBulkAddStudents}
          onBulkDeleteStudents={onBulkDeleteStudents}
          mappingSchemas={mappingSchemas}
          activeSchemaId={activeSchemaId}
          onSelectActiveSchema={onSelectActiveSchema}
          onOpenTemplateMappingPage={() => setActiveTab('template_mapping')}
        />
      )}

      {/* ===================================================================== */}
      {/* TAB 3: EXCEL TEMPLATE MAPPING CONFIGURATION                           */}
      {/* ===================================================================== */}
      {activeTab === 'template_mapping' && onSaveSchema && onDeleteSchema && onSelectActiveSchema && (
        <ExcelTemplateMappingPage
          school={school}
          currentUser={currentUser}
          schemas={mappingSchemas}
          activeSchemaId={activeSchemaId}
          onSaveSchema={onSaveSchema}
          onDeleteSchema={onDeleteSchema}
          onSelectActiveSchema={onSelectActiveSchema}
          onProceedToBulkImport={() => setActiveTab('import')}
        />
      )}

      {/* ===================================================================== */}
      {/* TAB 2: CLASS-WISE STUDENT REGISTER                                    */}
      {/* ===================================================================== */}
      {activeTab === 'class_registers' && (
        <div className="space-y-6">
          {/* Class Selector Navigation Pills */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm space-y-3 no-print">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider block">
                  Select Class / Grade
                </span>
                <p className="text-xs text-slate-600">
                  Displays all students enrolled in the class together regardless of Section A, B, or C.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenAddModal}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Student to Class {selectedClass}</span>
                </button>
              </div>
            </div>

            {/* Class Buttons */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {availableClasses.map((cls) => {
                const count = students.filter((s) => s.classNumber === cls && s.status === 'Active').length;
                const isSelected = selectedClass === cls;
                return (
                  <button
                    key={cls}
                    type="button"
                    onClick={() => {
                      setSelectedClass(cls);
                      setSectionFilter('All');
                    }}
                    className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 shrink-0 ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 scale-105'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                    }`}
                  >
                    <span>Class {cls}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                        isSelected ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Table Header Card with Filters & Actions */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-black text-slate-900">
                    Official Class {selectedClass} Student Register
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {filteredClassStudents.length} Students
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Unified class roster including all sections. Section can be edited without duplicating records.
                </p>
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center gap-2 no-print">
                <button
                  type="button"
                  onClick={handleExportClassToExcel}
                  className="px-3.5 py-2 rounded-xl bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300 font-bold text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Export to Excel</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrintRegister}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-1.5 transition-colors border border-slate-300 shadow-2xs"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-600" />
                  <span>Print Register</span>
                </button>
              </div>
            </div>

            {/* Search, Filter & Sort Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs no-print">
              {/* Search */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search name, roll #, contact..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 pl-9 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>

              {/* Gender Filter */}
              <div className="flex items-center gap-2">
                <label className="text-slate-500 font-semibold shrink-0">Gender:</label>
                <select
                  value={genderFilter}
                  onChange={(e) => setGenderFilter(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                >
                  <option value="All">All Genders</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Section Filter (Secondary filter, does not separate class view) */}
              <div className="flex items-center gap-2">
                <label className="text-slate-500 font-semibold shrink-0">Section:</label>
                <select
                  value={sectionFilter}
                  onChange={(e) => setSectionFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                >
                  <option value="All">All Sections (Unified)</option>
                  {classSections.map((sec) => (
                    <option key={sec} value={sec}>
                      Section {sec} only
                    </option>
                  ))}
                </select>
              </div>

              {/* Sort Order */}
              <div className="flex items-center gap-2">
                <label className="text-slate-500 font-semibold shrink-0">Sort By:</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                >
                  <option value="roll">Roll Number</option>
                  <option value="name">Student Name</option>
                  <option value="dob">Date of Birth</option>
                </select>
                <button
                  type="button"
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="p-2 rounded-xl border border-slate-300 hover:bg-slate-100"
                  title="Toggle sort direction"
                >
                  <ArrowUpDown className="w-4 h-4 text-slate-600" />
                </button>
              </div>
            </div>

            {/* The 7 Statutory Columns Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-left text-xs divide-y divide-slate-200">
                <thead className="bg-slate-100 font-extrabold text-slate-700">
                  <tr>
                    <th className="py-3 px-3">S. No.</th>
                    <th className="py-3 px-3">Student Name</th>
                    <th className="py-3 px-3 text-center">Class / Grade</th>
                    <th className="py-3 px-3 text-center">Section</th>
                    <th className="py-3 px-3 text-center">Gender</th>
                    <th className="py-3 px-3">Date of Birth</th>
                    <th className="py-3 px-3">Email / Phone Number</th>
                    <th className="py-3 px-3">Guardian / Emergency Contact</th>
                    <th className="py-3 px-3 text-right no-print">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredClassStudents.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        No students enrolled in Class {selectedClass} matching the selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredClassStudents.map((st, idx) => (
                      <tr key={st.id} className="hover:bg-slate-50 transition-colors">
                        {/* S. No. */}
                        <td className="py-2.5 px-3 font-mono text-slate-500 font-bold">
                          {idx + 1}
                        </td>

                        {/* Student Name */}
                        <td className="py-2.5 px-3">
                          <div className="font-extrabold text-slate-900">{st.fullName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            Adm: {st.admissionNumber} • Roll #{st.rollNumber}
                          </div>
                        </td>

                        {/* Class / Grade */}
                        <td className="py-2.5 px-3 text-center font-bold text-indigo-700">
                          Class {st.classNumber}
                        </td>

                        {/* Section */}
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-900 border border-indigo-200 font-extrabold text-xs">
                            {st.section || 'A'}
                          </span>
                        </td>

                        {/* Gender */}
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold ${
                              st.gender === 'Female'
                                ? 'bg-pink-50 text-pink-700 border border-pink-200'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}
                          >
                            {st.gender}
                          </span>
                        </td>

                        {/* Date of Birth */}
                        <td className="py-2.5 px-3 font-mono font-medium text-slate-700">
                          {st.dob}
                        </td>

                        {/* Email / Phone Number */}
                        <td className="py-2.5 px-3 font-mono text-slate-700">
                          {st.mobileNumber || st.parentWhatsAppNumber || 'N/A'}
                        </td>

                        {/* Guardian / Emergency Contact */}
                        <td className="py-2.5 px-3 text-slate-700">
                          <div className="font-semibold">{st.guardianName || st.fatherName || 'Guardian'}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {st.parentWhatsAppNumber || st.mobileNumber || ''}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-2.5 px-3 text-right no-print">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(st)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 transition-colors"
                              title="Edit student details"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => setStudentToDelete(st)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 transition-colors"
                              title="Delete student"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Quick Cross-Navigation Links to Attendance, Marks, HPC */}
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs no-print">
              <span className="text-slate-500 font-medium">
                Integrated Modules for Class {selectedClass}:
              </span>
              <div className="flex items-center gap-2">
                {onNavigateToAttendance && (
                  <button
                    type="button"
                    onClick={onNavigateToAttendance}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors"
                  >
                    Take Class Attendance →
                  </button>
                )}
                {onNavigateToMarks && (
                  <button
                    type="button"
                    onClick={onNavigateToMarks}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors"
                  >
                    Enter Marks →
                  </button>
                )}
                {onNavigateToHpc && (
                  <button
                    type="button"
                    onClick={onNavigateToHpc}
                    className="px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold transition-colors"
                  >
                    Generate HPCs →
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* ADD / EDIT STUDENT MODAL                                              */}
      {/* ===================================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm no-print animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-4 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-black">
                  {modalMode === 'add' ? `Add Student to Class ${formClass}` : `Edit Details: ${formName}`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStudentForm} className="p-5 space-y-4 text-xs">
              {formError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 font-bold">
                  {formError}
                </div>
              )}

              {/* 1. Student Full Name */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  1. Student Name (Full Name) *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Mohammad Zaid"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-semibold"
                />
              </div>

              {/* 2 & 3. Class & Section */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    2. Class / Grade *
                  </label>
                  <select
                    value={formClass}
                    onChange={(e) => setFormClass(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold"
                  >
                    {availableClasses.map((cls) => (
                      <option key={cls} value={cls}>
                        Class {cls}
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-slate-400">
                    Changing class automatically transfers student to that class register.
                  </span>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    3. Section *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={3}
                    value={formSection}
                    onChange={(e) => setFormSection(e.target.value.toUpperCase())}
                    placeholder="e.g. A"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-center font-bold"
                  />
                  <span className="text-[10px] text-slate-400">
                    Updates section without creating duplicate records.
                  </span>
                </div>
              </div>

              {/* 4 & 5. Gender & Date of Birth */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    4. Gender *
                  </label>
                  <select
                    value={formGender}
                    onChange={(e) => setFormGender(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    5. Date of Birth (YYYY-MM-DD) *
                  </label>
                  <input
                    type="date"
                    required
                    value={formDob}
                    onChange={(e) => setFormDob(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                  />
                </div>
              </div>

              {/* 6. Email / Phone Number */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  6. Email / Phone Number
                </label>
                <input
                  type="text"
                  value={formContact}
                  onChange={(e) => setFormContact(e.target.value)}
                  placeholder="e.g. +91 98000 12345"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                />
              </div>

              {/* 7. Guardian / Emergency Contact */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  7. Guardian / Emergency Contact
                </label>
                <input
                  type="text"
                  value={formGuardian}
                  onChange={(e) => setFormGuardian(e.target.value)}
                  placeholder="e.g. Ghulam Mohammad Wani (Father)"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              {/* Footer Actions */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold shadow-md active:scale-95 transition-all"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* DELETE CONFIRMATION MODAL                                             */}
      {/* ===================================================================== */}
      {studentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm no-print animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl p-6 border border-slate-200 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-black text-slate-900">Confirm Student Deletion</h3>
              <p className="text-xs text-slate-600 mt-1">
                Are you sure you want to delete <strong className="text-slate-900">{studentToDelete.fullName}</strong> from Class {studentToDelete.classNumber}? This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStudentToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-5 py-2 rounded-xl text-xs font-extrabold bg-rose-600 text-white hover:bg-rose-700 shadow-md transition-all active:scale-95"
              >
                Yes, Delete Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
