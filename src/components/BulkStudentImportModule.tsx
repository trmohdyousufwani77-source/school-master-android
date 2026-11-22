import React, { useState, useRef, useMemo } from 'react';
import {
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Users,
  Search,
  Filter,
  Trash2,
  Edit2,
  Printer,
  ChevronRight,
  ArrowRight,
  RefreshCw,
  Plus,
  X,
  Check,
  School,
  FileText,
  AlertCircle,
  GraduationCap,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { SchoolProfile, Student, User } from '../types';
import { Language, translations } from '../utils/translations';
import { exportStudentRegisterToExcel } from '../utils/excelExport';

interface BulkStudentImportModuleProps {
  students: Student[];
  school: SchoolProfile;
  currentUser: User;
  onAddStudent: (newStudent: Student) => void;
  onUpdateStudent: (updatedStudent: Student) => void;
  onDeleteStudent?: (studentId: string) => void;
  onBulkAddStudents?: (newStudents: Student[]) => void;
  language: Language;
  onNavigateToStudentRegister?: () => void;
}

// 7 Required Columns for Excel Import
export const REQUIRED_EXCEL_COLUMNS = [
  'Student Name (Full Name)',
  'Class / Grade',
  'Section',
  'Gender',
  'Date of Birth',
  'Email / Phone Number',
  'Guardian / Emergency Contact',
] as const;

export interface RawImportRow {
  rowNumber: number;
  fullName: string;
  classNumber: string;
  section: string;
  gender: string;
  dob: string;
  contactNumber: string;
  guardianContact: string;
  isValid: boolean;
  errors: string[];
  isDuplicate: boolean;
}

export const BulkStudentImportModule: React.FC<BulkStudentImportModuleProps> = ({
  students,
  school,
  currentUser,
  onAddStudent,
  onUpdateStudent,
  onDeleteStudent,
  onBulkAddStudents,
  language,
  onNavigateToStudentRegister,
}) => {
  const t = translations[language];

  // Active Main Sub-Tab: 'import' (6-step upload flow) or 'class-register' (class-wise student register)
  const [activeView, setActiveView] = useState<'import' | 'class-register'>('import');

  // =========================================================================
  // 1. EXCEL IMPORT 6-STEP WORKFLOW STATE
  // =========================================================================
  // Step 1: Upload, Step 2: Read, Step 3: Preview, Step 4: Validate, Step 5: Confirm, Step 6: Saved Report
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [fileName, setFileName] = useState<string>('');
  const [fileSize, setFileSize] = useState<string>('');
  const [importedRows, setImportedRows] = useState<RawImportRow[]>([]);
  const [importSummary, setImportSummary] = useState<{
    totalRecords: number;
    validRecords: number;
    invalidRecords: number;
    duplicateRecords: number;
    readyToImport: number;
    importedCount: number;
  }>({
    totalRecords: 0,
    validRecords: 0,
    invalidRecords: 0,
    duplicateRecords: 0,
    readyToImport: 0,
    importedCount: 0,
  });

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Inline Editing State for Step 3 Preview
  const [editingRowIdx, setEditingRowIdx] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState<RawImportRow | null>(null);

  // Filter in Preview Table (All, Valid Only, Invalid Only, Duplicates)
  const [previewFilter, setPreviewFilter] = useState<'all' | 'valid' | 'invalid' | 'duplicates'>('all');

  // =========================================================================
  // 2. CLASS-WISE STUDENT REGISTER STATE
  // =========================================================================
  const availableClasses = ['1', '2', '3', '4', '5', '6', '7', '8'];
  const [selectedClassTab, setSelectedClassTab] = useState<string>('all');
  const [classSectionFilter, setClassSectionFilter] = useState<string>('all');
  const [classSearchTerm, setClassSearchTerm] = useState<string>('');
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3800);
  };

  // =========================================================================
  // DOWNLOAD EXCEL TEMPLATE (Includes the 7 exact columns with sample row)
  // =========================================================================
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'Student Name (Full Name)': 'Zubair Ahmad Lone',
        'Class / Grade': '5',
        'Section': 'A',
        'Gender': 'Male',
        'Date of Birth': '2015-05-14',
        'Email / Phone Number': '+91 94190 12345',
        'Guardian / Emergency Contact': 'Mohammad Subhan Lone (+91 94190 12345)',
      },
      {
        'Student Name (Full Name)': 'Insha Mushtaq',
        'Class / Grade': '5',
        'Section': 'B',
        'Gender': 'Female',
        'Date of Birth': '2015-08-22',
        'Email / Phone Number': 'insha.family@gmail.com',
        'Guardian / Emergency Contact': 'Mushtaq Ahmad Dar (+91 94190 54321)',
      },
      {
        'Student Name (Full Name)': 'Aaqib Rashid Bhat',
        'Class / Grade': '6',
        'Section': 'A',
        'Gender': 'Male',
        'Date of Birth': '2014-11-03',
        'Email / Phone Number': '+91 97970 88990',
        'Guardian / Emergency Contact': 'Abdul Rashid Bhat (+91 97970 88990)',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);

    // Set column widths
    ws['!cols'] = [
      { wch: 28 }, // Student Name (Full Name)
      { wch: 15 }, // Class / Grade
      { wch: 12 }, // Section
      { wch: 14 }, // Gender
      { wch: 16 }, // Date of Birth
      { wch: 24 }, // Email / Phone Number
      { wch: 38 }, // Guardian / Emergency Contact
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Student_Import_Template');
    XLSX.writeFile(wb, 'JK_School_Student_Import_Template.xlsx');
    showToast('Student Excel Template downloaded successfully!');
  };

  // =========================================================================
  // VALIDATION HELPER (Checks 7 required criteria)
  // =========================================================================
  const validateRow = (
    row: {
      fullName: string;
      classNumber: string;
      section: string;
      gender: string;
      dob: string;
      contactNumber: string;
      guardianContact: string;
    },
    allRows: { fullName: string; dob: string; contactNumber: string }[],
    existingStudents: Student[],
    currentRowIdx: number
  ): { isValid: boolean; errors: string[]; isDuplicate: boolean } => {
    const errors: string[] = [];
    let isDuplicate = false;

    // 1. Missing student names
    if (!row.fullName || row.fullName.trim().length < 2) {
      errors.push('Missing or invalid student full name (minimum 2 characters required)');
    }

    // 2. Missing class or grade
    if (!row.classNumber || row.classNumber.trim() === '') {
      errors.push('Missing Class / Grade');
    } else {
      const cls = row.classNumber.trim().toUpperCase().replace(/CLASS|GRADE|\s/g, '');
      const validClassList = ['NURSERY', 'LKG', 'UKG', 'KG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
      if (!validClassList.includes(cls) && isNaN(Number(cls))) {
        errors.push(`Invalid Class / Grade "${row.classNumber}" (Accepted: 1 to 12, KG, Nursery)`);
      }
    }

    // 3. Invalid date-of-birth formats
    if (!row.dob || row.dob.trim() === '') {
      errors.push('Missing Date of Birth');
    } else {
      const dobStr = row.dob.trim();
      // Test YYYY-MM-DD or DD/MM/YYYY or DD-MM-YYYY
      const dateParsed = new Date(dobStr);
      const isIso = /^\d{4}-\d{2}-\d{2}$/.test(dobStr);
      const isDmy = /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(dobStr);
      if (isNaN(dateParsed.getTime()) && !isIso && !isDmy) {
        errors.push('Invalid Date of Birth format (Use YYYY-MM-DD or DD/MM/YYYY)');
      }
    }

    // 4. Invalid gender values
    const cleanGender = (row.gender || '').trim().toLowerCase();
    const validGenders = ['male', 'female', 'other', 'm', 'f'];
    if (!cleanGender || !validGenders.includes(cleanGender)) {
      errors.push('Invalid Gender (Accepted: Male, Female, or Other)');
    }

    // 5. Contact details format check
    if (row.contactNumber) {
      const cleanContact = row.contactNumber.replace(/[\s\-+()]/g, '');
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.contactNumber.trim());
      const isPhone = /^\d{7,15}$/.test(cleanContact);
      if (!isEmail && !isPhone && cleanContact.length < 5) {
        errors.push('Invalid Email or Phone Number format');
      }
    }

    // 6. Duplicate student records check (by Full Name + DOB or Full Name + Contact)
    const normName = (row.fullName || '').trim().toLowerCase();
    const normDob = (row.dob || '').trim();

    // Check duplicate against existing database
    const dbDuplicate = existingStudents.some((st) => {
      const sameName = st.fullName.trim().toLowerCase() === normName;
      const sameDob = st.dob === normDob;
      const sameRoll = st.classNumber === row.classNumber && st.section === row.section;
      return sameName && (sameDob || st.mobileNumber === row.contactNumber);
    });

    // Check duplicate against other rows in this spreadsheet
    const sheetDuplicate = allRows.some((other, idx) => {
      if (idx === currentRowIdx) return false;
      const otherName = (other.fullName || '').trim().toLowerCase();
      const otherDob = (other.dob || '').trim();
      return otherName === normName && (otherDob === normDob || other.contactNumber === row.contactNumber);
    });

    if (dbDuplicate || sheetDuplicate) {
      isDuplicate = true;
      errors.push(dbDuplicate ? 'Duplicate: Student already enrolled in database' : 'Duplicate: Appears multiple times in this spreadsheet');
    }

    return {
      isValid: errors.length === 0,
      errors,
      isDuplicate,
    };
  };

  // =========================================================================
  // STEP 1 & 2: FILE UPLOAD AND EXCEL READING
  // =========================================================================
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file extension
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (ext !== '.xlsx' && ext !== '.xls') {
      setUploadError('Invalid file type. Please upload an Excel file (.xlsx or .xls).');
      return;
    }

    setFileName(file.name);
    setFileSize(`${(file.size / 1024).toFixed(1)} KB`);
    setIsProcessing(true);
    setCurrentStep(2);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];

        // Parse sheet to JSON array
        const rawJson: any[] = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });

        if (rawJson.length === 0) {
          setUploadError('The uploaded Excel sheet contains no student records.');
          setIsProcessing(false);
          setCurrentStep(1);
          return;
        }

        // Map and normalize columns to the 7 required columns with fallback aliases
        const mappedRows: RawImportRow[] = rawJson.map((row, idx) => {
          // Identify columns with flexible alias matching
          const fullName = String(
            row['Student Name (Full Name)'] ??
            row['Student Name'] ??
            row['Full Name'] ??
            row['Name'] ??
            row['fullName'] ??
            ''
          ).trim();

          const rawClass = String(
            row['Class / Grade'] ??
            row['Class'] ??
            row['Grade'] ??
            row['classNumber'] ??
            '5'
          ).trim();
          const classNumber = rawClass.toUpperCase().replace(/CLASS|GRADE|\s/g, '') || '5';

          const section = String(
            row['Section'] ??
            row['Sec'] ??
            row['section'] ??
            'A'
          ).trim().toUpperCase() || 'A';

          let gender = String(
            row['Gender'] ??
            row['Sex'] ??
            row['gender'] ??
            ''
          ).trim();
          if (gender.toLowerCase() === 'm' || gender.toLowerCase() === 'male') gender = 'Male';
          else if (gender.toLowerCase() === 'f' || gender.toLowerCase() === 'female') gender = 'Female';
          else if (gender) gender = 'Other';

          // Format Date of Birth
          let dob = String(
            row['Date of Birth'] ??
            row['DOB'] ??
            row['Date_of_Birth_YYYY_MM_DD'] ??
            row['DateOfBirth'] ??
            ''
          ).trim();

          // Handle Excel date string if formatted as Date
          if (dob && !dob.includes('-') && dob.includes('/')) {
            const parts = dob.split('/');
            if (parts.length === 3) {
              if (parts[2].length === 4) {
                // DD/MM/YYYY
                dob = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
              }
            }
          }

          const contactNumber = String(
            row['Email / Phone Number'] ??
            row['Phone Number'] ??
            row['Phone'] ??
            row['Email'] ??
            row['Mobile Number'] ??
            row['Parent_Mobile'] ??
            ''
          ).trim();

          const guardianContact = String(
            row['Guardian / Emergency Contact'] ??
            row['Guardian Contact'] ??
            row['Emergency Contact'] ??
            row['Father_Name'] ??
            row['Guardian'] ??
            ''
          ).trim();

          return {
            rowNumber: idx + 2, // Excel 1-based index (Header is row 1)
            fullName,
            classNumber,
            section,
            gender,
            dob,
            contactNumber,
            guardianContact,
            isValid: true,
            errors: [],
            isDuplicate: false,
          };
        });

        // Run Step 4 validation on all rows
        const validatedRows = mappedRows.map((r, i) => {
          const res = validateRow(r, mappedRows, students, i);
          return {
            ...r,
            isValid: res.isValid,
            errors: res.errors,
            isDuplicate: res.isDuplicate,
          };
        });

        const totalRecords = validatedRows.length;
        const duplicateRecords = validatedRows.filter((r) => r.isDuplicate).length;
        const invalidRecords = validatedRows.filter((r) => !r.isValid && !r.isDuplicate).length;
        const validRecords = validatedRows.filter((r) => r.isValid).length;

        setImportedRows(validatedRows);
        setImportSummary({
          totalRecords,
          validRecords,
          invalidRecords,
          duplicateRecords,
          readyToImport: validRecords,
          importedCount: 0,
        });

        setIsProcessing(false);
        setCurrentStep(3); // Advance to Preview & Validation
        showToast(`Parsed ${totalRecords} records from ${file.name}`);
      } catch (err: any) {
        console.error('Error reading Excel spreadsheet', err);
        setUploadError(`Failed to process Excel spreadsheet: ${err.message || 'Corrupt or unreadable format'}`);
        setIsProcessing(false);
        setCurrentStep(1);
      }
    };
    reader.readAsBinaryString(file);
  };

  // Re-run validation on rows whenever a row is edited inline
  const revalidateAllRows = (updatedRows: RawImportRow[]) => {
    const validated = updatedRows.map((r, i) => {
      const res = validateRow(r, updatedRows, students, i);
      return {
        ...r,
        isValid: res.isValid,
        errors: res.errors,
        isDuplicate: res.isDuplicate,
      };
    });

    const totalRecords = validated.length;
    const duplicateRecords = validated.filter((r) => r.isDuplicate).length;
    const invalidRecords = validated.filter((r) => !r.isValid && !r.isDuplicate).length;
    const validRecords = validated.filter((r) => r.isValid).length;

    setImportedRows(validated);
    setImportSummary((prev) => ({
      ...prev,
      totalRecords,
      validRecords,
      invalidRecords,
      duplicateRecords,
      readyToImport: validRecords,
    }));
  };

  // =========================================================================
  // STEP 3: INLINE CORRECTION IN PREVIEW TABLE
  // =========================================================================
  const handleStartEditRow = (row: RawImportRow, idx: number) => {
    setEditingRowIdx(idx);
    setEditFormData({ ...row });
  };

  const handleSaveEditRow = () => {
    if (editingRowIdx === null || !editFormData) return;
    const updated = [...importedRows];
    updated[editingRowIdx] = editFormData;
    revalidateAllRows(updated);
    setEditingRowIdx(null);
    setEditFormData(null);
    showToast('Row updated and re-validated.');
  };

  const handleCancelEditRow = () => {
    setEditingRowIdx(null);
    setEditFormData(null);
  };

  const handleDeleteRow = (idx: number) => {
    const updated = importedRows.filter((_, i) => i !== idx);
    revalidateAllRows(updated);
    showToast('Row removed from import queue.');
  };

  // Filtered rows in Preview Table
  const filteredPreviewRows = useMemo(() => {
    if (previewFilter === 'valid') return importedRows.filter((r) => r.isValid);
    if (previewFilter === 'invalid') return importedRows.filter((r) => !r.isValid && !r.isDuplicate);
    if (previewFilter === 'duplicates') return importedRows.filter((r) => r.isDuplicate);
    return importedRows;
  }, [importedRows, previewFilter]);

  // =========================================================================
  // STEP 5 & 6: CONFIRM & IMPORT TO DATABASE
  // =========================================================================
  const handleConfirmImport = () => {
    const validRowsToImport = importedRows.filter((r) => r.isValid);
    if (validRowsToImport.length === 0) {
      setUploadError('No valid student records are ready to import. Please correct invalid rows before proceeding.');
      return;
    }

    const currentMaxId = students.reduce((max, s) => {
      const match = s.id.match(/SM-2026-(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        return num > max ? num : max;
      }
      return max;
    }, 0);

    const newStudentObjects: Student[] = validRowsToImport.map((row, idx) => {
      const nextNum = currentMaxId + idx + 1;
      const newId = `SM-2026-${String(nextNum).padStart(3, '0')}`;
      const admissionNum = `SRN-2026-${String(nextNum + 200).padStart(3, '0')}`;

      // Extract guardian details
      let fatherName = 'Guardian';
      let emergencyPhone = row.contactNumber || '+91 94190 00000';
      if (row.guardianContact) {
        const parts = row.guardianContact.split(/[()]/);
        if (parts[0] && parts[0].trim()) fatherName = parts[0].trim();
        if (parts[1] && parts[1].trim()) emergencyPhone = parts[1].trim();
      }

      const rollNumber = idx + 1;

      return {
        id: newId,
        admissionNumber: admissionNum,
        fullName: row.fullName,
        fatherName: fatherName,
        motherName: 'Mother',
        gender: (row.gender === 'Female' ? 'Female' : row.gender === 'Other' ? 'Other' : 'Male') as any,
        dob: row.dob || '2015-05-10',
        classNumber: row.classNumber || '5',
        section: (row.section || 'A').toUpperCase(),
        rollNumber: rollNumber,
        academicSession: school.academicSession || '2026-2027',
        address: school.address || `${school.villageTown || 'Pamposh Colony'}, ${school.district || 'Srinagar'}`,
        villageTown: school.villageTown || 'Pamposh Colony, Palpora',
        blockTehsil: school.blockTehsil || 'Iddgah',
        district: school.district || 'Srinagar',
        state: 'Jammu and Kashmir',
        pinCode: school.pinCode || '190017',
        mobileNumber: row.contactNumber || emergencyPhone,
        parentWhatsAppNumber: row.contactNumber || emergencyPhone,
        admissionDate: new Date().toISOString().slice(0, 10),
        status: 'Active',
        aadhaarStatus: 'Pending',
        parentConsentRecorded: false,
        attendanceMarks: 9,
      };
    });

    if (onBulkAddStudents) {
      onBulkAddStudents(newStudentObjects);
    } else {
      newStudentObjects.forEach((s) => onAddStudent(s));
    }

    setImportSummary((prev) => ({
      ...prev,
      importedCount: newStudentObjects.length,
    }));

    setCurrentStep(6); // Show Success & Saved Report
    showToast(`Successfully added ${newStudentObjects.length} students to database!`);
  };

  const handleResetImport = () => {
    setCurrentStep(1);
    setFileName('');
    setFileSize('');
    setImportedRows([]);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // =========================================================================
  // CLASS-WISE STUDENT REGISTER LOGIC
  // Organizes all students by Class / Grade (All students in a class shown together)
  // Section is displayed and editable, and optional section filter does not break class view
  // =========================================================================
  const filteredClassRegisterStudents = useMemo(() => {
    return students.filter((s) => {
      const matchesSearch =
        s.fullName.toLowerCase().includes(classSearchTerm.toLowerCase()) ||
        s.admissionNumber.toLowerCase().includes(classSearchTerm.toLowerCase()) ||
        s.rollNumber.toString().includes(classSearchTerm) ||
        s.id.toLowerCase().includes(classSearchTerm.toLowerCase());

      const matchesClass = selectedClassTab === 'all' || s.classNumber === selectedClassTab;
      const matchesSection = classSectionFilter === 'all' || s.section === classSectionFilter;

      return matchesSearch && matchesClass && matchesSection;
    }).sort((a, b) => {
      // Sort primarily by class number, then roll number
      if (a.classNumber !== b.classNumber) {
        return parseInt(a.classNumber, 10) - parseInt(b.classNumber, 10);
      }
      return a.rollNumber - b.rollNumber;
    });
  }, [students, selectedClassTab, classSectionFilter, classSearchTerm]);

  // Handle Editing Student (Move class or edit section without duplicate)
  const handleSaveStudentEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    onUpdateStudent(editingStudent);
    showToast(`Updated details for ${editingStudent.fullName}.`);
    setEditingStudent(null);
  };

  const handleConfirmDeleteStudent = () => {
    if (!studentToDelete) return;
    if (onDeleteStudent) {
      onDeleteStudent(studentToDelete.id);
    }
    showToast(`Deleted student ${studentToDelete.fullName}.`);
    setStudentToDelete(null);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notice */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-emerald-500/50 flex items-center gap-2.5 text-xs font-bold animate-in slide-in-from-top-4">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 text-white p-6 rounded-3xl border border-indigo-800/40 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-amber-400/20">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                  Bulk Student Import (Excel) & Class-Wise Student Register
                </h1>
                <p className="text-xs text-indigo-200 mt-0.5">
                  Universal spreadsheet onboarding engine & RTE class-wise enrolment registers for J&K schools.
                </p>
              </div>
            </div>
          </div>

          {/* Sub-Tab Navigation Switcher */}
          <div className="flex items-center gap-2 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-700/80 shrink-0">
            <button
              type="button"
              onClick={() => setActiveView('import')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeView === 'import'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>Bulk Excel Import</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveView('class-register')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeView === 'class-register'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              <span>Class-Wise Student Register</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-400 text-slate-950 font-black">
                {students.length}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* VIEW 1: BULK EXCEL IMPORT WORKFLOW (6 STEPS)                        */}
      {/* =================================================================== */}
      {activeView === 'import' && (
        <div className="space-y-6">
          
          {/* 6-Step Visual Progress Indicator */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
            <div className="flex items-center justify-between min-w-[620px] gap-2">
              {[
                { num: 1, label: 'Upload File' },
                { num: 2, label: 'Read Data' },
                { num: 3, label: 'Preview' },
                { num: 4, label: 'Validate' },
                { num: 5, label: 'Confirm Import' },
                { num: 6, label: 'Save & Report' },
              ].map((step, idx) => {
                const isCurrent = currentStep === step.num;
                const isPassed = currentStep > step.num;

                return (
                  <React.Fragment key={step.num}>
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs transition-all ${
                          isPassed
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : isCurrent
                            ? 'bg-indigo-600 text-white shadow-md ring-4 ring-indigo-100'
                            : 'bg-slate-100 text-slate-400 border border-slate-200'
                        }`}
                      >
                        {isPassed ? <Check className="w-3.5 h-3.5" /> : step.num}
                      </div>
                      <span
                        className={`text-xs font-bold whitespace-nowrap ${
                          isCurrent
                            ? 'text-indigo-900'
                            : isPassed
                            ? 'text-slate-800'
                            : 'text-slate-400'
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                    {idx < 5 && (
                      <div
                        className={`flex-1 h-0.5 mx-2 ${
                          isPassed ? 'bg-emerald-500' : 'bg-slate-200'
                        }`}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* Error Banner */}
          {uploadError && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <span>{uploadError}</span>
              </div>
              <button
                type="button"
                onClick={() => setUploadError(null)}
                className="text-rose-500 hover:text-rose-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* STEP 1: UPLOAD FILE & DOWNLOAD TEMPLATE */}
          {currentStep === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Upload Card */}
              <div className="md:col-span-2 bg-white p-8 rounded-3xl border-2 border-dashed border-indigo-200 hover:border-indigo-400 transition-all text-center flex flex-col items-center justify-center space-y-4 shadow-sm">
                <div className="w-16 h-16 rounded-3xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-inner">
                  <Upload className="w-8 h-8 animate-bounce" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Upload Student Spreadsheet
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-md">
                    Select an Excel file (<strong>.xlsx</strong> or <strong>.xls</strong>) from your computer or mobile device. All 7 columns will be automatically parsed and validated.
                  </p>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="excel-file-upload-input"
                />

                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <label
                    htmlFor="excel-file-upload-input"
                    className="cursor-pointer px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs transition-all shadow-md shadow-indigo-600/30 flex items-center gap-2 active:scale-95"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Select Excel File (.xlsx / .xls)</span>
                  </label>

                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors border border-slate-300 flex items-center gap-2"
                  >
                    <Download className="w-4 h-4 text-slate-600" />
                    <span>Download Excel Template</span>
                  </button>
                </div>

                <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-400 flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Supports Microsoft Excel, LibreOffice Calc, and Google Sheets exported files.</span>
                </div>
              </div>

              {/* Required Format Guide Card */}
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 flex flex-col justify-between space-y-4 text-xs">
                <div>
                  <div className="flex items-center gap-2 text-slate-900 font-extrabold text-sm mb-2">
                    <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                    <span>Required 7 Excel Columns</span>
                  </div>
                  <p className="text-slate-500 text-[11px] mb-3">
                    Ensure your spreadsheet contains these exact columns:
                  </p>

                  <ol className="space-y-1.5 text-slate-700">
                    <li className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded bg-indigo-100 text-indigo-900 font-mono text-[10px] font-bold flex items-center justify-center">1</span>
                      <strong className="text-slate-900">Student Name (Full Name)</strong>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded bg-indigo-100 text-indigo-900 font-mono text-[10px] font-bold flex items-center justify-center">2</span>
                      <strong className="text-slate-900">Class / Grade</strong>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded bg-indigo-100 text-indigo-900 font-mono text-[10px] font-bold flex items-center justify-center">3</span>
                      <strong className="text-slate-900">Section</strong>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded bg-indigo-100 text-indigo-900 font-mono text-[10px] font-bold flex items-center justify-center">4</span>
                      <strong className="text-slate-900">Gender</strong> (Male, Female, Other)
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded bg-indigo-100 text-indigo-900 font-mono text-[10px] font-bold flex items-center justify-center">5</span>
                      <strong className="text-slate-900">Date of Birth</strong> (YYYY-MM-DD)
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded bg-indigo-100 text-indigo-900 font-mono text-[10px] font-bold flex items-center justify-center">6</span>
                      <strong className="text-slate-900">Email / Phone Number</strong>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded bg-indigo-100 text-indigo-900 font-mono text-[10px] font-bold flex items-center justify-center">7</span>
                      <strong className="text-slate-900">Guardian / Emergency Contact</strong>
                    </li>
                  </ol>
                </div>

                <div className="bg-white p-3 rounded-2xl border border-slate-200 text-[11px] text-slate-600">
                  <span className="font-bold text-indigo-900 block mb-0.5">Automated Validation:</span>
                  Checks for missing names, invalid classes, DOB formats, gender values, and duplicate records.
                </div>
              </div>

            </div>
          )}

          {/* STEP 2: PROCESSING INDICATOR */}
          {currentStep === 2 && (
            <div className="bg-white p-12 rounded-3xl border border-slate-200 shadow-sm text-center flex flex-col items-center justify-center space-y-3">
              <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
              <h3 className="text-base font-bold text-slate-900">Reading Excel Spreadsheet...</h3>
              <p className="text-xs text-slate-500">Mapping 7 required columns and validating student records.</p>
            </div>
          )}

          {/* STEP 3, 4 & 5: PREVIEW, VALIDATION & CONFIRMATION SUMMARY */}
          {(currentStep === 3 || currentStep === 4 || currentStep === 5) && (
            <div className="space-y-5">
              
              {/* Validation Summary Stat Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total In Excel</span>
                  <p className="text-2xl font-black text-slate-900 mt-0.5">{importSummary.totalRecords}</p>
                </div>
                <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Valid Records</span>
                  <p className="text-2xl font-black text-emerald-700 mt-0.5">{importSummary.validRecords}</p>
                </div>
                <div className="p-3.5 bg-rose-50 rounded-2xl border border-rose-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider block">Invalid Records</span>
                  <p className="text-2xl font-black text-rose-700 mt-0.5">{importSummary.invalidRecords}</p>
                </div>
                <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">Duplicates</span>
                  <p className="text-2xl font-black text-amber-700 mt-0.5">{importSummary.duplicateRecords}</p>
                </div>
                <div className="p-3.5 bg-indigo-50 rounded-2xl border border-indigo-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider block">Ready to Import</span>
                  <p className="text-2xl font-black text-indigo-700 mt-0.5">{importSummary.readyToImport}</p>
                </div>
              </div>

              {/* Action Toolbar & Filters */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
                
                {/* Filter Selector */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-slate-500 mr-1">Show:</span>
                  <button
                    type="button"
                    onClick={() => setPreviewFilter('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      previewFilter === 'all'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    All ({importedRows.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewFilter('valid')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      previewFilter === 'valid'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    }`}
                  >
                    Valid Only ({importSummary.validRecords})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewFilter('invalid')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      previewFilter === 'invalid'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                    }`}
                  >
                    Invalid Only ({importSummary.invalidRecords})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewFilter('duplicates')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      previewFilter === 'duplicates'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                    }`}
                  >
                    Duplicates ({importSummary.duplicateRecords})
                  </button>
                </div>

                {/* Import and Cancel Actions */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetImport}
                    className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    Upload Different File
                  </button>

                  <button
                    type="button"
                    onClick={handleConfirmImport}
                    disabled={importSummary.readyToImport === 0}
                    className={`px-5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-md ${
                      importSummary.readyToImport > 0
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30 active:scale-95'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Import {importSummary.readyToImport} Students</span>
                  </button>
                </div>
              </div>

              {/* Preview Table with Inline Edit Support */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider">
                      Preview Student Records ({filteredPreviewRows.length} shown)
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Review parsed entries. Click "Edit" on any row to correct missing fields or formats before importing.
                    </p>
                  </div>
                  <span className="font-mono text-xs font-bold text-slate-500">{fileName} ({fileSize})</span>
                </div>

                <div className="overflow-x-auto max-h-[480px]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase text-[10px] border-b border-slate-200 sticky top-0 z-10">
                      <tr>
                        <th className="py-2.5 px-3">Row</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Student Full Name</th>
                        <th className="py-2.5 px-3">Class</th>
                        <th className="py-2.5 px-3">Section</th>
                        <th className="py-2.5 px-3">Gender</th>
                        <th className="py-2.5 px-3">Date of Birth</th>
                        <th className="py-2.5 px-3">Email / Phone</th>
                        <th className="py-2.5 px-3">Guardian / Emergency</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredPreviewRows.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="py-8 text-center text-slate-400">
                            No records match the selected filter.
                          </td>
                        </tr>
                      ) : (
                        filteredPreviewRows.map((row, idx) => {
                          const isEditing = editingRowIdx === idx;

                          return (
                            <tr
                              key={idx}
                              className={`transition-colors ${
                                !row.isValid
                                  ? 'bg-rose-50/40 hover:bg-rose-50/70'
                                  : row.isDuplicate
                                  ? 'bg-amber-50/40 hover:bg-amber-50/70'
                                  : 'hover:bg-slate-50'
                              }`}
                            >
                              <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">
                                #{row.rowNumber}
                              </td>

                              {/* Validation Status Indicator */}
                              <td className="py-2.5 px-3">
                                {row.isValid ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <Check className="w-3 h-3" /> Valid
                                  </span>
                                ) : row.isDuplicate ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200" title={row.errors.join('; ')}>
                                    <AlertTriangle className="w-3 h-3" /> Duplicate
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200" title={row.errors.join('; ')}>
                                    <XCircle className="w-3 h-3" /> Invalid
                                  </span>
                                )}
                              </td>

                              {/* Full Name */}
                              <td className="py-2.5 px-3">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={editFormData?.fullName || ''}
                                    onChange={(e) => setEditFormData((prev) => prev ? ({ ...prev, fullName: e.target.value }) : null)}
                                    className="px-2 py-1 rounded border border-indigo-400 text-xs w-full font-bold"
                                  />
                                ) : (
                                  <div>
                                    <span className="font-bold text-slate-900 block">{row.fullName || '—'}</span>
                                    {row.errors.length > 0 && (
                                      <span className="text-[10px] text-rose-600 block line-clamp-1">{row.errors[0]}</span>
                                    )}
                                  </div>
                                )}
                              </td>

                              {/* Class */}
                              <td className="py-2.5 px-3 font-mono">
                                {isEditing ? (
                                  <select
                                    value={editFormData?.classNumber || '5'}
                                    onChange={(e) => setEditFormData((prev) => prev ? ({ ...prev, classNumber: e.target.value }) : null)}
                                    className="px-2 py-1 rounded border border-indigo-400 text-xs font-bold"
                                  >
                                    {availableClasses.map((c) => (
                                      <option key={c} value={c}>Class {c}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-900 font-bold border border-indigo-100">
                                    Class {row.classNumber}
                                  </span>
                                )}
                              </td>

                              {/* Section */}
                              <td className="py-2.5 px-3 font-mono">
                                {isEditing ? (
                                  <select
                                    value={editFormData?.section || 'A'}
                                    onChange={(e) => setEditFormData((prev) => prev ? ({ ...prev, section: e.target.value.toUpperCase() }) : null)}
                                    className="px-2 py-1 rounded border border-indigo-400 text-xs font-bold"
                                  >
                                    <option value="A">A</option>
                                    <option value="B">B</option>
                                    <option value="C">C</option>
                                  </select>
                                ) : (
                                  <span className="font-bold text-slate-700">Sec {row.section}</span>
                                )}
                              </td>

                              {/* Gender */}
                              <td className="py-2.5 px-3">
                                {isEditing ? (
                                  <select
                                    value={editFormData?.gender || 'Male'}
                                    onChange={(e) => setEditFormData((prev) => prev ? ({ ...prev, gender: e.target.value }) : null)}
                                    className="px-2 py-1 rounded border border-indigo-400 text-xs"
                                  >
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                    <option value="Other">Other</option>
                                  </select>
                                ) : (
                                  <span className="text-slate-700">{row.gender}</span>
                                )}
                              </td>

                              {/* Date of Birth */}
                              <td className="py-2.5 px-3 font-mono">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    placeholder="YYYY-MM-DD"
                                    value={editFormData?.dob || ''}
                                    onChange={(e) => setEditFormData((prev) => prev ? ({ ...prev, dob: e.target.value }) : null)}
                                    className="px-2 py-1 rounded border border-indigo-400 text-xs w-28 font-mono"
                                  />
                                ) : (
                                  <span className="text-slate-800">{row.dob || '—'}</span>
                                )}
                              </td>

                              {/* Contact Number */}
                              <td className="py-2.5 px-3 font-mono">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={editFormData?.contactNumber || ''}
                                    onChange={(e) => setEditFormData((prev) => prev ? ({ ...prev, contactNumber: e.target.value }) : null)}
                                    className="px-2 py-1 rounded border border-indigo-400 text-xs w-32 font-mono"
                                  />
                                ) : (
                                  <span className="text-slate-600">{row.contactNumber || '—'}</span>
                                )}
                              </td>

                              {/* Guardian */}
                              <td className="py-2.5 px-3">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={editFormData?.guardianContact || ''}
                                    onChange={(e) => setEditFormData((prev) => prev ? ({ ...prev, guardianContact: e.target.value }) : null)}
                                    className="px-2 py-1 rounded border border-indigo-400 text-xs w-full"
                                  />
                                ) : (
                                  <span className="text-slate-700 truncate max-w-xs block">{row.guardianContact || '—'}</span>
                                )}
                              </td>

                              {/* Row Actions */}
                              <td className="py-2.5 px-3 text-right">
                                {isEditing ? (
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      type="button"
                                      onClick={handleSaveEditRow}
                                      className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-700"
                                      title="Save Correction"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={handleCancelEditRow}
                                      className="p-1 rounded bg-slate-200 text-slate-700 hover:bg-slate-300"
                                      title="Cancel"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-end gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleStartEditRow(row, idx)}
                                      className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                                      title="Edit Record"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteRow(idx)}
                                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                                      title="Delete Record"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
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

            </div>
          )}

          {/* STEP 6: SAVED TO DATABASE SUCCESS REPORT */}
          {currentStep === 6 && (
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm text-center max-w-xl mx-auto space-y-5">
              <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-inner border border-emerald-200">
                <CheckCircle className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-xl font-extrabold text-slate-900">
                  Import Completed Successfully!
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  <strong>{importSummary.importedCount}</strong> new student records have been saved to the school database.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-700 space-y-2 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Source Spreadsheet:</span>
                  <span className="font-mono font-bold text-slate-900">{fileName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Total Valid Records Enrolled:</span>
                  <span className="font-bold text-emerald-700">{importSummary.importedCount}</span>
                </div>
                {importSummary.invalidRecords > 0 && (
                  <div className="flex items-center justify-between text-rose-700">
                    <span>Rejected Invalid Rows:</span>
                    <span className="font-bold">{importSummary.invalidRecords}</span>
                  </div>
                )}
                {importSummary.duplicateRecords > 0 && (
                  <div className="flex items-center justify-between text-amber-700">
                    <span>Skipped Duplicate Rows:</span>
                    <span className="font-bold">{importSummary.duplicateRecords}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveView('class-register')}
                  className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs transition-all shadow-md shadow-indigo-600/30 flex items-center gap-2"
                >
                  <GraduationCap className="w-4 h-4" />
                  <span>View Class-Wise Student Register</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetImport}
                  className="px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors border border-slate-300"
                >
                  Import Another Spreadsheet
                </button>
              </div>
            </div>
          )}

        </div>
      )}

      {/* =================================================================== */}
      {/* VIEW 2: CLASS-WISE STUDENT REGISTER                                 */}
      {/* Automatically organizes students by Class / Grade field             */}
      {/* Displays students class-wise (All students in a class together)     */}
      {/* =================================================================== */}
      {activeView === 'class-register' && (
        <div className="space-y-5">
          
          {/* Class Navigation Tabs (Class 1 to Class 8 & All) */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => setSelectedClassTab('all')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  selectedClassTab === 'all'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                All Classes ({students.length})
              </button>

              {availableClasses.map((cls) => {
                const count = students.filter((s) => s.classNumber === cls).length;
                const isSelected = selectedClassTab === cls;

                return (
                  <button
                    key={cls}
                    type="button"
                    onClick={() => setSelectedClassTab(cls)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <span>Class {cls}</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                      isSelected ? 'bg-amber-400 text-slate-950' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Quick Export & Print Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => exportStudentRegisterToExcel(students, school, selectedClassTab)}
                className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs flex items-center gap-1.5 transition-colors"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Export Excel</span>
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-bold text-xs flex items-center gap-1.5 transition-colors"
              >
                <Printer className="w-3.5 h-3.5 text-slate-600" />
                <span>Print Register</span>
              </button>
            </div>
          </div>

          {/* Search & Section Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full sm:max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search students by name, roll #, or SRN admission number..."
                value={classSearchTerm}
                onChange={(e) => setClassSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Filter Section:</span>
              <select
                value={classSectionFilter}
                onChange={(e) => setClassSectionFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Sections (Class-Wise Display)</option>
                <option value="A">Section A</option>
                <option value="B">Section B</option>
                <option value="C">Section C</option>
              </select>
            </div>
          </div>

          {/* Class-Wise Student Register Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-2">
                  <span>Class-Wise Student Register: {selectedClassTab === 'all' ? 'All Classes (Enrolled)' : `Class ${selectedClassTab}`}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-900 border border-indigo-200">
                    {filteredClassRegisterStudents.length} Students
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Displays all students enrolled in this class across all sections. Section is stored per student and remain editable.
                </p>
              </div>

              <div className="text-[11px] text-slate-500 font-mono">
                Academic Session: {school.academicSession}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Roll #</th>
                    <th className="py-2.5 px-3">Student Name</th>
                    <th className="py-2.5 px-3">Admission No</th>
                    <th className="py-2.5 px-3">Class</th>
                    <th className="py-2.5 px-3">Section</th>
                    <th className="py-2.5 px-3">Gender</th>
                    <th className="py-2.5 px-3">Date of Birth</th>
                    <th className="py-2.5 px-3">Guardian / Father</th>
                    <th className="py-2.5 px-3">Emergency Mobile</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredClassRegisterStudents.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-400">
                        No students enrolled in this class filter.
                      </td>
                    </tr>
                  ) : (
                    filteredClassRegisterStudents.map((st) => (
                      <tr key={st.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                          #{st.rollNumber}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-slate-900 block">{st.fullName}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{st.id}</span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-indigo-900 font-bold">
                          {st.admissionNumber}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-900 font-bold border border-indigo-200">
                            Class {st.classNumber}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-700">
                          Sec {st.section}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">
                          {st.gender}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-700">
                          {st.dob}
                        </td>
                        <td className="py-2.5 px-3 text-slate-800">
                          {st.fatherName}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-700">
                          {st.mobileNumber}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setEditingStudent({ ...st })}
                              className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                              title="Edit Student"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setStudentToDelete(st)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                              title="Delete Student"
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
          </div>

        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: EDIT STUDENT DETAILS (Class move, section change, details)    */}
      {/* =================================================================== */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 bg-indigo-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold">Edit Student Details</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveStudentEdit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Student Full Name</label>
                <input
                  type="text"
                  required
                  value={editingStudent.fullName}
                  onChange={(e) => setEditingStudent({ ...editingStudent, fullName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Class / Grade</label>
                  <select
                    value={editingStudent.classNumber}
                    onChange={(e) => setEditingStudent({ ...editingStudent, classNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                  >
                    {availableClasses.map((c) => (
                      <option key={c} value={c}>Class {c}</option>
                    ))}
                  </select>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Moving class moves student to that class register.</span>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Section</label>
                  <select
                    value={editingStudent.section}
                    onChange={(e) => setEditingStudent({ ...editingStudent, section: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                  >
                    <option value="A">Section A</option>
                    <option value="B">Section B</option>
                    <option value="C">Section C</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Roll Number</label>
                  <input
                    type="number"
                    value={editingStudent.rollNumber}
                    onChange={(e) => setEditingStudent({ ...editingStudent, rollNumber: parseInt(e.target.value, 10) || 1 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Gender</label>
                  <select
                    value={editingStudent.gender}
                    onChange={(e) => setEditingStudent({ ...editingStudent, gender: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={editingStudent.dob}
                    onChange={(e) => setEditingStudent({ ...editingStudent, dob: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Emergency Mobile</label>
                  <input
                    type="text"
                    value={editingStudent.mobileNumber}
                    onChange={(e) => setEditingStudent({ ...editingStudent, mobileNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Guardian / Father Name</label>
                <input
                  type="text"
                  value={editingStudent.fatherName}
                  onChange={(e) => setEditingStudent({ ...editingStudent, fatherName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-900"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold shadow-md shadow-indigo-600/30"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: DELETE STUDENT CONFIRMATION                                  */}
      {/* =================================================================== */}
      {studentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl p-6 border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Confirm Delete Student
              </h3>
              <p className="text-xs text-slate-600 mt-1">
                Are you sure you want to remove <strong>{studentToDelete.fullName}</strong> (Roll #{studentToDelete.rollNumber}, Class {studentToDelete.classNumber}-{studentToDelete.section}) from the school register?
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStudentToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteStudent}
                className="px-4 py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20"
              >
                Delete Student Record
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
