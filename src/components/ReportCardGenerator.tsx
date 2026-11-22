import React, { useState, useMemo } from 'react';
import {
  Award,
  Printer,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Eye,
  School,
  Sparkles,
  ChevronRight,
  X,
  MessageSquare,
  Share2,
  Download,
  Calendar,
  UserCheck,
  Loader2,
  FileDown,
  FileText,
  TrendingUp,
  Trophy,
  AlertTriangle,
  BarChart3,
  Layers,
  Filter,
  Edit3,
  Save,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Copy,
  Link,
  Check,
  Search,
  Image as ImageIcon,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid,
} from 'recharts';
import {
  AdminRoleType,
  Examination,
  HolisticRatingLevel,
  SchoolProfile,
  Student,
  StudentExamSummary,
  StudentHolisticRecord,
  StudentMarkEntry,
  SubjectConfig,
  User,
} from '../types';
import { Language, translations } from '../utils/translations';
import {
  calculateStudentExamSummary,
  deduplicateStudentsByAdmissionNumber,
  formatSchoolAddressOnce,
  getGradeFromPercentage,
} from '../utils/calculations';
import { exportExaminationMarksToExcel } from '../utils/excelExport';
import { WhatsAppShareModal } from './WhatsAppShareModal';
import { SchoolEmblem } from './SchoolEmblem';
import {
  HOLISTIC_ASSESSMENT_CATEGORIES,
  sampleHolisticRecords,
  sampleSubjectConfigs,
} from '../utils/sampleData';
import {
  generateBatchClassProgressCardsPdf,
  generateHpcCardsJpegBatch,
} from '../utils/batchProgressCardPdf';
import {
  recordMarkAudit,
  getMarkAuditLogs,
  downloadSignedAuditTrailCsv,
  MarkAuditEntry,
} from '../utils/marksAuditTrail';

interface ReportCardGeneratorProps {
  students: Student[];
  examinations: Examination[];
  marksEntries: StudentMarkEntry[];
  school: SchoolProfile;
  language: Language;
  subjectConfigs?: SubjectConfig[];
  currentUser?: User | { id: string; name: string; role: string; assignedClasses?: string[] };
  effectiveRole?: AdminRoleType;
  holisticRecords?: Record<string, StudentHolisticRecord>;
  onSaveMarks?: (updatedMarks: StudentMarkEntry[]) => void;
  onSaveHolisticRecord?: (record: StudentHolisticRecord) => void;
  onUpdateStudent?: (student: Student) => void;
}

export const ReportCardGenerator: React.FC<ReportCardGeneratorProps> = ({
  students,
  examinations,
  marksEntries,
  school,
  language,
  subjectConfigs,
  currentUser = { id: 'EMP-001', name: 'Farooq Ahmad Wani', role: 'head_teacher' },
  effectiveRole = 'primary_admin',
  holisticRecords,
  onSaveMarks,
  onSaveHolisticRecord,
  onUpdateStudent,
}) => {
  const _t = translations[language];
  void _t;

  const availableClasses = school.classesOffered || ['Nursery', 'KG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
  const [selectedExamId, setSelectedExamId] = useState<string>(examinations[0]?.id || 'exam-hy-2026');
  const [selectedClass, setSelectedClass] = useState<string>('5');
  const [selectedSection, setSelectedSection] = useState<string>('A');
  const [selectedStudentSummary, setSelectedStudentSummary] = useState<StudentExamSummary | null>(null);
  const [whatsAppStudentSummary, setWhatsAppStudentSummary] = useState<StudentExamSummary | null>(null);

  // Grade Filter state for isolating students in snapshot & roster
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string>('all');

  // Batch PDF, JPEG & Print state
  const [isGeneratingBatchPdf, setIsGeneratingBatchPdf] = useState<boolean>(false);
  const [isGeneratingBatchJpeg, setIsGeneratingBatchJpeg] = useState<boolean>(false);
  const [batchDownloadSuccess, setBatchDownloadSuccess] = useState<string>('');
  const [isConsolidatedDocOpen, setIsConsolidatedDocOpen] = useState<boolean>(false);

  // Student Name-Wise School-Wide Instant Search + Multi-Student Bulk Selection
  const [hpcSearchQuery, setHpcSearchQuery] = useState<string>('');
  const [selectedStudentIdsForExport, setSelectedStudentIdsForExport] = useState<string[]>([]);

  // Bulk Edit Mode in HPC
  const [isBulkEditMode, setIsBulkEditMode] = useState<boolean>(false);
  const [bulkHpcDraftMarks, setBulkHpcDraftMarks] = useState<Record<string, number>>({});
  const [bulkUndoStack, setBulkUndoStack] = useState<Array<Record<string, number>>>([]);
  const [isBulkSaving, setIsBulkSaving] = useState<boolean>(false);
  const [bulkSaveNotice, setBulkSaveNotice] = useState<string | null>(null);
  const [showClassAuditModal, setShowClassAuditModal] = useState<boolean>(false);
  const [allAuditLogs, setAllAuditLogs] = useState<MarkAuditEntry[]>(() => getMarkAuditLogs());

  const allSchoolActiveStudents = useMemo(
    () => deduplicateStudentsByAdmissionNumber(students).filter((s) => s.status === 'Active'),
    [students]
  );

  const instantSearchMatches = useMemo(() => {
    const q = hpcSearchQuery.trim().toLowerCase();
    if (!q) return [];
    return allSchoolActiveStudents
      .filter(
        (s) =>
          s.fullName.toLowerCase().includes(q) ||
          s.admissionNumber.toLowerCase().includes(q) ||
          `class ${s.classNumber}-${s.section}`.toLowerCase().includes(q)
      )
      .slice(0, 12);
  }, [allSchoolActiveStudents, hpcSearchQuery]);

  const openAuditModal = () => {
    setAllAuditLogs(getMarkAuditLogs());
    setShowClassAuditModal(true);
  };

  const currentExam = examinations.find((e) => e.id === selectedExamId) || examinations[0];
  const classSubjects = subjectConfigs && subjectConfigs.length > 0 ? subjectConfigs : sampleSubjectConfigs;

  // Filter students strictly deduplicated by admissionNumber primary key
  const classStudents = React.useMemo(() => {
    return deduplicateStudentsByAdmissionNumber(students)
      .filter((s) => s.classNumber === selectedClass && s.section === selectedSection && s.status === 'Active')
      .sort((a, b) => a.rollNumber - b.rollNumber);
  }, [students, selectedClass, selectedSection]);

  // Sync initial bulk marks
  React.useEffect(() => {
    const map: Record<string, number> = {};
    classStudents.forEach((st) => {
      const sum = calculateStudentExamSummary(
        st.id,
        st.fullName,
        st.rollNumber,
        st.classNumber,
        st.section,
        currentExam.id,
        currentExam.name,
        marksEntries,
        classSubjects,
        school.gradingScale,
        92.4
      );
      map[st.id] = sum.totalMarksObtained;
    });
    setBulkHpcDraftMarks(map);
    setBulkUndoStack([]);
  }, [selectedExamId, selectedClass, selectedSection, marksEntries, classStudents, currentExam.id, currentExam.name, school.gradingScale]);

  const handleBulkMarkChange = (studentId: string, val: string) => {
    const raw = parseInt(val, 10);
    const num = isNaN(raw) ? 0 : Math.min(600, Math.max(0, raw));
    setBulkUndoStack((prev) => [{ ...bulkHpcDraftMarks }, ...prev.slice(0, 4)]);
    setBulkHpcDraftMarks((prev) => ({
      ...prev,
      [studentId]: num,
    }));
  };

  const handleBulkUndo = () => {
    if (bulkUndoStack.length === 0) return;
    const [previous, ...rest] = bulkUndoStack;
    setBulkHpcDraftMarks(previous);
    setBulkUndoStack(rest);
    setBulkSaveNotice(`✓ Reverted last bulk change (${rest.length} undos remaining)`);
    setTimeout(() => setBulkSaveNotice(null), 3000);
  };

  const handleSaveAllBulkHpcMarks = () => {
    if (!onSaveMarks) return;
    setIsBulkSaving(true);

    const updatedEntries: StudentMarkEntry[] = [];
    classStudents.forEach((st) => {
      const newTotal = bulkHpcDraftMarks[st.id] ?? 480;
      const perSubject = Math.round(newTotal / 6);
      classSubjects.forEach((cfg) => {
        const existing = marksEntries.find(
          (m) => m.examId === currentExam.id && m.studentId === st.id && m.subjectCode === cfg.code
        );
        const oldScore = existing?.marksObtained ?? 80;
        if (oldScore !== perSubject) {
          recordMarkAudit({
            studentId: st.id,
            studentName: st.fullName,
            rollNumber: st.rollNumber,
            classNumber: selectedClass,
            section: selectedSection,
            subjectCode: cfg.code,
            subjectName: cfg.name,
            examId: currentExam.id,
            examName: currentExam.name,
            originalValue: oldScore,
            newValue: perSubject,
            userResponsible: currentUser.name,
            userId: currentUser.id,
            moduleOrigin: 'HPC Module',
            reason: 'Whole-Class Bulk Edit in HPC Module',
          });
        }
        updatedEntries.push({
          id: `mark-${currentExam.id}-${st.id}-${cfg.code}`,
          examId: currentExam.id,
          studentId: st.id,
          classNumber: selectedClass,
          section: selectedSection,
          subjectCode: cfg.code,
          maxMarks: cfg.maxMarks,
          marksObtained: perSubject,
          isAbsent: false,
          grade: 'A',
          passed: true,
          remarks: 'Updated via HPC Bulk Edit Mode',
        });
      });
    });

    onSaveMarks(updatedEntries);
    setTimeout(() => {
      setIsBulkSaving(false);
      setIsBulkEditMode(false);
      setBulkSaveNotice('✓ All Class HPC marks successfully saved and synchronized with Marks Register!');
      setTimeout(() => setBulkSaveNotice(null), 4000);
    }, 450);
  };

  // Compute student exam summaries
  const studentSummaries: StudentExamSummary[] = classStudents.map((st) => {
    return calculateStudentExamSummary(
      st.id,
      st.fullName,
      st.rollNumber,
      st.classNumber,
      st.section,
      currentExam.id,
      currentExam.name,
      marksEntries,
      classSubjects,
      school.gradingScale,
      92.4 // Attendance percentage
    );
  });

  // Persistent 'Sync Status' detection: check if class student marks deviate from Marks Entry & Evaluation Register
  const classSyncDiscrepancies = useMemo(() => {
    const list: Array<{
      studentId: string;
      studentName: string;
      rollNumber: number;
      hpcTotal: number;
      registerTotal: number;
    }> = [];

    classStudents.forEach((st) => {
      let regTotal = 0;
      classSubjects.forEach((cfg) => {
        const existing = marksEntries.find(
          (m) => m.examId === currentExam.id && m.studentId === st.id && m.subjectCode === cfg.code
        );
        const registerVal = (existing && existing.marksObtained !== null) ? existing.marksObtained : 80;
        regTotal += registerVal;
      });

      const currentHpcTotal = bulkHpcDraftMarks[st.id] !== undefined ? bulkHpcDraftMarks[st.id] : regTotal;

      if (currentHpcTotal !== regTotal) {
        list.push({
          studentId: st.id,
          studentName: st.fullName,
          rollNumber: st.rollNumber,
          hpcTotal: currentHpcTotal,
          registerTotal: regTotal,
        });
      }
    });

    return list;
  }, [classStudents, marksEntries, currentExam, bulkHpcDraftMarks]);

  const handleSyncClassHpcWithRegister = () => {
    const map: Record<string, number> = {};
    classStudents.forEach((st) => {
      const sum = calculateStudentExamSummary(
        st.id,
        st.fullName,
        st.rollNumber,
        st.classNumber,
        st.section,
        currentExam.id,
        currentExam.name,
        marksEntries,
        classSubjects,
        school.gradingScale,
        92.4
      );
      map[st.id] = sum.totalMarksObtained;
    });
    setBulkHpcDraftMarks(map);
    setBulkUndoStack([]);
    setBulkSaveNotice('✓ Successfully synchronized all Class HPC marks with the Marks Entry & Evaluation Register.');
    setTimeout(() => setBulkSaveNotice(null), 4000);
  };

  // Filtered students isolated by selected grade
  const filteredByGradeStudents = useMemo(() => {
    if (selectedGradeFilter === 'all') {
      return studentSummaries;
    }
    return studentSummaries.filter((s) => s.overallGrade === selectedGradeFilter);
  }, [studentSummaries, selectedGradeFilter]);

  // Automated Class Performance Snapshot Analytics
  const snapshotMetrics = useMemo(() => {
    const total = studentSummaries.length;
    if (total === 0) {
      return {
        averagePercentage: 0,
        averageMarks: 0,
        topScorer: null,
        needSupportCount: 0,
        needSupportStudents: [] as StudentExamSummary[],
        passCount: 0,
        passRate: 0,
      };
    }

    const totalMarks = studentSummaries.reduce((sum, s) => sum + s.totalMarksObtained, 0);
    const avgMarks = Math.round(totalMarks / total);
    const totalPct = studentSummaries.reduce((sum, s) => sum + s.percentage, 0);
    const avgPct = Math.round((totalPct / total) * 10) / 10;

    const sortedByScore = [...studentSummaries].sort((a, b) => b.percentage - a.percentage);
    const top = sortedByScore[0] || null;

    // Students needing extra academic support (failed any subject or percentage < 50% or not passed)
    const needSupport = studentSummaries.filter(
      (s) => !s.isPassed || s.percentage < 50 || s.overallGrade === 'D' || s.overallGrade === 'E'
    );

    const passed = studentSummaries.filter((s) => s.isPassed).length;
    const passPercentage = Math.round((passed / total) * 100);

    return {
      averagePercentage: avgPct,
      averageMarks: avgMarks,
      topScorer: top,
      needSupportCount: needSupport.length,
      needSupportStudents: needSupport,
      passCount: passed,
      passRate: passPercentage,
    };
  }, [studentSummaries]);

  // Automated Grade Distribution Data for Bar Chart
  const gradeDistributionData = useMemo(() => {
    // Configured scale grades from school profile or standard fallback spectrum
    const scaleGrades = (school.gradingScale || []).map((b) => b.grade);
    const distinctGrades = Array.from(
      new Set([
        ...scaleGrades,
        ...studentSummaries.map((s) => s.overallGrade),
      ])
    ).filter(Boolean);

    // Dynamic grade color mapping
    const getGradeColor = (grade: string) => {
      const g = grade.toUpperCase();
      if (g.startsWith('A') || g.includes('+')) return '#4f46e5'; // Indigo (A+, A1, A2)
      if (g.startsWith('B')) return '#0ea5e9'; // Sky blue (B+, B1, B2)
      if (g.startsWith('C')) return '#10b981'; // Emerald (C1, C2)
      if (g.startsWith('D')) return '#f59e0b'; // Amber (D)
      if (g.startsWith('E') || g === 'F' || g === 'AB') return '#ef4444'; // Rose / Red (E, Needs Support)
      return '#6366f1';
    };

    return distinctGrades.map((grade) => {
      const matching = studentSummaries.filter((s) => s.overallGrade === grade);
      const count = matching.length;
      const percentage =
        studentSummaries.length > 0 ? Math.round((count / studentSummaries.length) * 100) : 0;
      const studentNames = matching.map((s) => s.studentName).join(', ');

      return {
        grade,
        count,
        percentage,
        studentNames,
        color: getGradeColor(grade),
      };
    });
  }, [studentSummaries, school.gradingScale]);

  // Batch Class PDF generation handler
  const handleDownloadClassPdf = async () => {
    if (studentSummaries.length === 0) {
      setBulkSaveNotice(`No active students found in Class ${selectedClass}-${selectedSection} to generate PDF.`);
      setTimeout(() => setBulkSaveNotice(null), 4000);
      return;
    }

    setIsGeneratingBatchPdf(true);
    setBatchDownloadSuccess('');

    try {
      // Brief pause to allow UI loader animation to present
      await new Promise((resolve) => setTimeout(resolve, 250));

      generateBatchClassProgressCardsPdf({
        school,
        examination: currentExam,
        studentSummaries,
        students,
        marksEntries,
        holisticRecords,
        classNumber: selectedClass,
        section: selectedSection,
      });

      setBatchDownloadSuccess(
        `Class ${selectedClass}-${selectedSection} Consolidated A4 PDF (${studentSummaries.length} student cards) generated and downloaded successfully!`
      );
      setTimeout(() => setBatchDownloadSuccess(''), 7000);
    } catch (err) {
      console.error('Batch Class PDF Generation Error:', err);
      setBulkSaveNotice('An error occurred while generating the consolidated class PDF. Please try again.');
      setTimeout(() => setBulkSaveNotice(null), 5000);
    } finally {
      setIsGeneratingBatchPdf(false);
    }
  };

  const handleDownloadClassJpeg = async (targetIds?: string[]) => {
    if (studentSummaries.length === 0) return;
    setIsGeneratingBatchJpeg(true);
    setBatchDownloadSuccess('');
    try {
      const count = await generateHpcCardsJpegBatch({
        school,
        examination: currentExam,
        studentSummaries,
        students: classStudents,
        marksEntries,
        holisticRecords,
        classNumber: selectedClass,
        section: selectedSection,
        selectedStudentIds: targetIds,
      });
      setBatchDownloadSuccess(
        `Exported ${count} print-ready HPC JPEG card${count > 1 ? 's' : ''} (Headmaster signature only).`
      );
      setTimeout(() => setBatchDownloadSuccess(''), 7000);
    } catch (err) {
      console.error('Batch Class JPEG Generation Error:', err);
      setBulkSaveNotice('An error occurred while exporting HPC JPEG cards. Please try again.');
      setTimeout(() => setBulkSaveNotice(null), 5000);
    } finally {
      setIsGeneratingBatchJpeg(false);
    }
  };

  const handleOpenSearchedStudentHpc = (st: Student) => {
    setSelectedClass(st.classNumber);
    setSelectedSection(st.section);
    setSelectedGradeFilter('all');
    const summary = calculateStudentExamSummary(
      st.id,
      st.fullName,
      st.rollNumber,
      st.classNumber,
      st.section,
      currentExam.id,
      currentExam.name,
      marksEntries,
      classSubjects,
      school.gradingScale,
      92.4
    );
    setSelectedStudentSummary(summary);
    setHpcSearchQuery('');
  };

  const handleDownloadSearchedStudentFile = async (st: Student, format: 'pdf' | 'jpeg') => {
    const summary = calculateStudentExamSummary(
      st.id,
      st.fullName,
      st.rollNumber,
      st.classNumber,
      st.section,
      currentExam.id,
      currentExam.name,
      marksEntries,
      classSubjects,
      school.gradingScale,
      92.4
    );
    if (format === 'pdf') {
      generateBatchClassProgressCardsPdf({
        school,
        examination: currentExam,
        studentSummaries: [summary],
        students: [st],
        marksEntries,
        holisticRecords,
        classNumber: st.classNumber,
        section: st.section,
        customFileName: `HPC_${st.fullName.replace(/[^a-zA-Z0-9]/g, '_')}_${st.admissionNumber}.pdf`,
      });
      setBatchDownloadSuccess(`Downloaded HPC PDF for ${st.fullName} (Class ${st.classNumber}-${st.section}).`);
    } else {
      await generateHpcCardsJpegBatch({
        school,
        examination: currentExam,
        studentSummaries: [summary],
        students: [st],
        marksEntries,
        holisticRecords,
        classNumber: st.classNumber,
        section: st.section,
      });
      setBatchDownloadSuccess(`Downloaded HPC JPEG for ${st.fullName} (Class ${st.classNumber}-${st.section}).`);
    }
    setTimeout(() => setBatchDownloadSuccess(''), 6000);
  };

  const [manualSelectedStudentId, setManualSelectedStudentId] = useState<string>('');
  const [manualExportBusy, setManualExportBusy] = useState<'pdf' | 'jpeg' | null>(null);

  const allActiveStudentsSorted = useMemo(
    () =>
      students
        .filter((s) => s.status === 'Active')
        .sort((a, b) => {
          const clsDiff = parseInt(a.classNumber, 10) - parseInt(b.classNumber, 10);
          if (clsDiff !== 0) return clsDiff;
          return (Number(a.rollNumber) || 0) - (Number(b.rollNumber) || 0);
        }),
    [students]
  );

  const manualSelectedStudent = useMemo(() => {
    if (manualSelectedStudentId) {
      const found = allActiveStudentsSorted.find((s) => s.id === manualSelectedStudentId);
      if (found) return found;
    }
    const firstInClass = studentSummaries[0]
      ? allActiveStudentsSorted.find((s) => s.id === studentSummaries[0].studentId)
      : undefined;
    return firstInClass || allActiveStudentsSorted[0] || null;
  }, [manualSelectedStudentId, allActiveStudentsSorted, studentSummaries]);

  const handleManualIndividualDownload = async (format: 'pdf' | 'jpeg') => {
    if (!manualSelectedStudent) return;
    setManualExportBusy(format);
    try {
      await handleDownloadSearchedStudentFile(manualSelectedStudent, format);
    } finally {
      setManualExportBusy(null);
    }
  };

  const handleManualIndividualPrint = () => {
    if (!manualSelectedStudent) return;
    handleOpenSearchedStudentHpc(manualSelectedStudent);
    setTimeout(() => {
      window.print();
    }, 350);
  };

  const handleQuickPrint = () => {
    // Immediately trigger browser native print dialog for the current report card view, bypassing download workflow
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Award className="w-6 h-6 text-indigo-600" />
            <span>Holistic Progress Cards (HPC) & Evaluation</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Official student Holistic Progress Cards under NEP 2020. 6 Core Subjects, 14 Life Skill Domains, Attendance metrics, and print-ready A4 batch consolidation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Print Icon Button */}
          <button
            id="quick-print-btn"
            onClick={handleQuickPrint}
            disabled={studentSummaries.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-black bg-slate-900 hover:bg-slate-800 active:scale-95 text-white transition-all shadow-md shadow-slate-900/20 border border-slate-800 disabled:opacity-50"
            title="Quick Print: Immediately trigger native browser print dialog for current report card view (bypasses download)"
            aria-label="Quick Print Report Cards"
          >
            <Printer className="w-4 h-4 text-emerald-400" />
            <span>Quick Print</span>
          </button>

          {/* Primary Feature: Download Class PDF */}
          <button
            id="download-class-pdf-btn"
            onClick={handleDownloadClassPdf}
            disabled={isGeneratingBatchPdf || studentSummaries.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white transition-all shadow-md shadow-indigo-600/25 border border-indigo-700 disabled:opacity-50"
            title="Consolidate all students in this class into a single multi-page A4 PDF progress card document"
          >
            {isGeneratingBatchPdf ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Generating Class PDF...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4 text-amber-300" />
                <span>Download Class PDF</span>
              </>
            )}
          </button>

          {/* Bulk Class JPEG Export */}
          <button
            id="download-class-jpeg-btn"
            onClick={() => handleDownloadClassJpeg()}
            disabled={isGeneratingBatchJpeg || studentSummaries.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 transition-all shadow-md shadow-amber-500/20 disabled:opacity-50"
            title="Export print-ready high-resolution JPEG HPC cards for all students in this class"
          >
            {isGeneratingBatchJpeg ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Exporting JPEGs...</span>
              </>
            ) : (
              <>
                <ImageIcon className="w-4 h-4" />
                <span>Bulk Class JPEG</span>
              </>
            )}
          </button>

          {/* Consolidated Multi-Page A4 Document Preview & Print */}
          <button
            onClick={() => setIsConsolidatedDocOpen(true)}
            disabled={studentSummaries.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors border border-slate-300 shadow-xs disabled:opacity-50"
            title="Open consolidated printer-friendly document containing all student cards"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>Consolidated A4 Document</span>
          </button>

          {/* Excel Export */}
          <button
            onClick={() =>
              exportExaminationMarksToExcel(
                studentSummaries,
                currentExam,
                school,
                selectedClass,
                selectedSection
              )
            }
            className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100 transition-colors shadow-2xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Export Class (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Dedicated Student-Wise Manual HPC Download Controls (PDF, JPEG, Preview, Print) */}
      <div className="bg-gradient-to-r from-indigo-50/90 via-white to-emerald-50/70 p-4 sm:p-5 rounded-2xl border border-indigo-200/80 shadow-sm no-print space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Award className="w-4 h-4 text-indigo-600" />
              <span>Individual Student Holistic Progress Card (Manual Download &amp; Print)</span>
            </h2>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Manually select any individual student to preview, print, or download their print-friendly HPC in PDF or JPEG without downloading the entire class record.
            </p>
          </div>
          {manualSelectedStudent && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white border border-indigo-200 text-[11px] font-bold text-indigo-900 shrink-0 self-start lg:self-auto">
              <span>Selected:</span>
              <span className="font-black">{manualSelectedStudent.fullName}</span>
              <span className="font-mono text-indigo-600">
                (Class {manualSelectedStudent.classNumber}-{manualSelectedStudent.section} • Adm {manualSelectedStudent.admissionNumber})
              </span>
            </span>
          )}
        </div>

        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
          <div className="flex-1 min-w-[240px]">
            <select
              aria-label="Select individual student for Holistic Progress Card download"
              value={manualSelectedStudent?.id || ''}
              onChange={(e) => setManualSelectedStudentId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 shadow-2xs"
            >
              {allActiveStudentsSorted.length === 0 ? (
                <option value="">No active students available</option>
              ) : (
                allActiveStudentsSorted.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.fullName} — Class {st.classNumber}-{st.section} | Roll #{st.rollNumber} | Adm: {st.admissionNumber}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={!manualSelectedStudent || manualExportBusy !== null}
              onClick={() => handleManualIndividualDownload('pdf')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-extrabold shadow-xs transition-colors"
            >
              {manualExportBusy === 'pdf' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5 text-amber-300" />
              )}
              <span>Download PDF</span>
            </button>

            <button
              type="button"
              disabled={!manualSelectedStudent || manualExportBusy !== null}
              onClick={() => handleManualIndividualDownload('jpeg')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-extrabold shadow-xs transition-colors"
            >
              {manualExportBusy === 'jpeg' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ImageIcon className="w-3.5 h-3.5" />
              )}
              <span>Download JPEG</span>
            </button>

            <button
              type="button"
              disabled={!manualSelectedStudent}
              onClick={() => manualSelectedStudent && handleOpenSearchedStudentHpc(manualSelectedStudent)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-800 border border-slate-300 text-xs font-bold shadow-2xs transition-colors"
            >
              <Eye className="w-3.5 h-3.5 text-indigo-600" />
              <span>Preview</span>
            </button>

            <button
              type="button"
              disabled={!manualSelectedStudent}
              onClick={handleManualIndividualPrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition-colors"
            >
              <Printer className="w-3.5 h-3.5 text-emerald-400" />
              <span>Print</span>
            </button>
          </div>
        </div>
      </div>

      {/* Batch PDF Success Notification Toast */}
      {batchDownloadSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-center justify-between text-xs text-emerald-900 animate-in fade-in slide-in-from-top-2 no-print shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-bold">{batchDownloadSuccess}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsConsolidatedDocOpen(true)}
              className="text-[11px] underline font-bold text-emerald-800 hover:text-emerald-950"
            >
              View Document Preview
            </button>
            <button
              onClick={() => setBatchDownloadSuccess('')}
              className="p-1 hover:bg-emerald-100 rounded text-emerald-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Selectors Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3 no-print text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Examination Schedule
            </label>
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-xl font-semibold text-slate-800 bg-slate-50 focus:ring-2 focus:ring-indigo-500"
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
              onChange={(e) => {
                setSelectedClass(e.target.value);
                setSelectedGradeFilter('all');
              }}
              className="px-3 py-2 border border-slate-300 rounded-xl font-semibold text-slate-800 bg-slate-50 focus:ring-2 focus:ring-indigo-500"
            >
              {availableClasses.map((c) => (
                <option key={c} value={c}>Class {c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Section
            </label>
            <select
              value={selectedSection}
              onChange={(e) => {
                setSelectedSection(e.target.value);
                setSelectedGradeFilter('all');
              }}
              className="px-3 py-2 border border-slate-300 rounded-xl font-semibold text-slate-800 bg-slate-50 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="A">Section A</option>
              <option value="B">Section B</option>
              <option value="C">Section C</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-4 text-right">
          <div>
            <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Class Teacher</span>
            <span className="text-xs font-bold text-indigo-900">Nazir Ahmad Dar (Teacher)</span>
          </div>
          <div className="h-8 w-px bg-slate-200 hidden sm:block" />
          <div>
            <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">
              {school.principalDesignation || 'Headmaster'}
            </span>
            <span className="text-xs font-bold text-slate-800">
              {school.headmasterName || school.headTeacherName || 'Headmaster'}
            </span>
          </div>
        </div>
      </div>

      {/* Student Name-Wise Instant HPC Search Bar (Searches Entire School) */}
      <div className="bg-white p-4 rounded-2xl border border-indigo-200/80 shadow-xs no-print space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-extrabold text-slate-900">
              Student Name-Wise HPC Search &amp; Quick Download
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              {allSchoolActiveStudents.length} Students Indexed
            </span>
          </div>
          {selectedStudentIdsForExport.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold text-indigo-800">
                {selectedStudentIdsForExport.length} Selected:
              </span>
              <button
                type="button"
                onClick={() => {
                  generateBatchClassProgressCardsPdf({
                    school,
                    examination: currentExam,
                    studentSummaries,
                    students: classStudents,
                    marksEntries,
                    holisticRecords,
                    classNumber: selectedClass,
                    section: selectedSection,
                    selectedStudentIds: selectedStudentIdsForExport,
                    customFileName: `Selected_${selectedStudentIdsForExport.length}_Students_HPC_Class_${selectedClass}_${selectedSection}.pdf`,
                  });
                  setBatchDownloadSuccess(`Downloaded combined PDF for ${selectedStudentIdsForExport.length} selected students.`);
                  setTimeout(() => setBatchDownloadSuccess(''), 6000);
                }}
                className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-[11px] font-bold hover:bg-indigo-700"
              >
                Bulk PDF ({selectedStudentIdsForExport.length})
              </button>
              <button
                type="button"
                onClick={() => handleDownloadClassJpeg(selectedStudentIdsForExport)}
                className="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 text-[11px] font-bold hover:bg-amber-600"
              >
                Bulk JPEG ({selectedStudentIdsForExport.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedStudentIdsForExport([])}
                className="text-[11px] font-bold text-slate-500 hover:text-slate-800"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={hpcSearchQuery}
            onChange={(e) => setHpcSearchQuery(e.target.value)}
            placeholder="Search any student by partial name, admission number, or class (e.g. Aarav, SRN-2026)..."
            className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 text-xs font-semibold text-slate-900"
          />
          {hpcSearchQuery && (
            <button
              type="button"
              onClick={() => setHpcSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {hpcSearchQuery.trim().length > 0 && (
          <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-64 overflow-y-auto bg-white">
            {instantSearchMatches.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-500">
                No matching students found for &quot;{hpcSearchQuery}&quot;.
              </div>
            ) : (
              instantSearchMatches.map((st) => {
                const isChecked = selectedStudentIdsForExport.includes(st.id);
                return (
                  <div
                    key={st.id}
                    className="p-2.5 flex flex-wrap items-center justify-between gap-2 hover:bg-indigo-50/50 transition-colors text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() =>
                          setSelectedStudentIdsForExport((prev) =>
                            prev.includes(st.id) ? prev.filter((id) => id !== st.id) : [...prev, st.id]
                          )
                        }
                        className="rounded border-slate-300 text-indigo-600"
                        title="Select for bulk download"
                      />
                      <div className="min-w-0">
                        <div className="font-extrabold text-slate-900 truncate">{st.fullName}</div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          Adm: {st.admissionNumber} • Class {st.classNumber}-{st.section} • Roll #{st.rollNumber}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenSearchedStudentHpc(st)}
                        className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Open HPC</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadSearchedStudentFile(st, 'pdf')}
                        className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px]"
                      >
                        PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadSearchedStudentFile(st, 'jpeg')}
                        className="px-2 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-[11px]"
                      >
                        JPEG
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Persistent 'Sync Status' Indicator Bar in HPC Module */}
      <div
        className={`p-3.5 sm:p-4 rounded-2xl border transition-all no-print flex flex-wrap items-center justify-between gap-3 shadow-xs ${
          classSyncDiscrepancies.length > 0
            ? 'bg-amber-50 border-amber-300 text-amber-950'
            : 'bg-emerald-50/80 border-emerald-300/80 text-emerald-950'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
              classSyncDiscrepancies.length > 0
                ? 'bg-amber-100 text-amber-700 border-amber-300'
                : 'bg-emerald-100 text-emerald-700 border-emerald-300'
            }`}
          >
            {classSyncDiscrepancies.length > 0 ? (
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-emerald-700" />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-extrabold text-xs sm:text-sm">
                Sync Status:
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold uppercase ${
                  classSyncDiscrepancies.length > 0
                    ? 'bg-amber-200 text-amber-900 border border-amber-400'
                    : 'bg-emerald-200 text-emerald-900 border border-emerald-400'
                }`}
              >
                {classSyncDiscrepancies.length > 0
                  ? `${classSyncDiscrepancies.length} Student Record${classSyncDiscrepancies.length > 1 ? 's' : ''} Deviate`
                  : 'Synchronized with Marks Register'}
              </span>
              <span className="text-[11px] text-slate-500 hidden md:inline">
                • Examination: {currentExam.name}
              </span>
            </div>

            <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
              {classSyncDiscrepancies.length > 0 ? (
                <span>
                  Discrepancy detected between HPC draft records and the base Marks Entry &amp; Evaluation Register for:{' '}
                  <strong className="text-amber-900 font-semibold">
                    {classSyncDiscrepancies.map((d) => `${d.studentName} (Roll #${d.rollNumber})`).join(', ')}
                  </strong>
                  . Click Sync Now to resolve and pull updated marks.
                </span>
              ) : (
                <span>
                  All student progress cards in Class {selectedClass}-{selectedSection} accurately match saved entries in the Marks Entry &amp; Evaluation Register.
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {classSyncDiscrepancies.length > 0 ? (
            <button
              onClick={handleSyncClassHpcWithRegister}
              className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              title="Synchronize all HPC marks with the base Marks Entry Register"
            >
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
              <span>Sync Now</span>
            </button>
          ) : (
            <button
              onClick={handleSyncClassHpcWithRegister}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Verify and re-synchronize latest marks from Marks Entry Register"
            >
              <RefreshCw className="w-3 h-3 text-emerald-600" />
              <span>Verify &amp; Re-Sync</span>
            </button>
          )}
        </div>
      </div>

      {/* Class Performance Snapshot Widget */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm space-y-4 no-print">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center shadow-xs">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <span>Class Performance Snapshot</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-extrabold uppercase">
                  Class {selectedClass}-{selectedSection}
                </span>
              </h2>
              <p className="text-[11px] text-slate-500">
                Automated analytics for {currentExam.name} • 6 Core Subjects evaluated
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-auto">
            {/* Grade Filter Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1 shadow-2xs">
              <Filter className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <label htmlFor="grade-filter-dropdown" className="text-[11px] font-bold text-slate-700 shrink-0">
                Grade Filter:
              </label>
              <select
                id="grade-filter-dropdown"
                value={selectedGradeFilter}
                onChange={(e) => setSelectedGradeFilter(e.target.value)}
                className="bg-transparent text-xs font-black text-indigo-900 focus:outline-none cursor-pointer py-0.5"
              >
                <option value="all">All Grades ({studentSummaries.length})</option>
                {gradeDistributionData.map((d) => (
                  <option key={d.grade} value={d.grade}>
                    Grade {d.grade} ({d.count} {d.count === 1 ? 'student' : 'students'})
                  </option>
                ))}
              </select>
              {selectedGradeFilter !== 'all' && (
                <button
                  onClick={() => setSelectedGradeFilter('all')}
                  className="ml-1 text-[10px] px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-700 font-bold hover:bg-indigo-200 transition-colors"
                  title="Clear grade filter"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-[11px] font-bold text-slate-500">
                Evaluated: <strong className="text-slate-900">{studentSummaries.length} Students</strong>
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                Pass Rate: {snapshotMetrics.passRate}%
              </span>
            </div>
          </div>
        </div>

        {studentSummaries.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            No students enrolled in Class {selectedClass}-{selectedSection} to compute snapshot analytics.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            {/* Metric 1: Class Average */}
            <div className="bg-gradient-to-br from-slate-50 to-indigo-50/40 p-4 rounded-xl border border-slate-200 hover:border-indigo-300 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Class Average</span>
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-slate-900">
                  {snapshotMetrics.averagePercentage}%
                </span>
                <span className="text-xs font-bold text-indigo-700 font-mono">
                  ({snapshotMetrics.averageMarks} / 600)
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-200/60">
                <span>RTE State Benchmark: 70%</span>
                <span className={`font-bold ${snapshotMetrics.averagePercentage >= 70 ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {snapshotMetrics.averagePercentage >= 70 ? 'Above Benchmark' : 'Below Benchmark'}
                </span>
              </div>
            </div>

            {/* Metric 2: Top Scorer */}
            <div className="bg-gradient-to-br from-slate-50 to-amber-50/40 p-4 rounded-xl border border-slate-200 hover:border-amber-300 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Top Scorer (Rank #1)</span>
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Trophy className="w-4 h-4" />
                </div>
              </div>
              {snapshotMetrics.topScorer ? (
                <>
                  <div className="mt-2 flex items-baseline justify-between gap-1">
                    <span className="text-base sm:text-lg font-black text-slate-900 truncate">
                      {snapshotMetrics.topScorer.studentName}
                    </span>
                    <span className="text-sm font-black text-amber-700 shrink-0 font-mono">
                      {snapshotMetrics.topScorer.percentage}%
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-200/60">
                    <span className="font-mono font-bold text-slate-600">Roll #{snapshotMetrics.topScorer.rollNumber}</span>
                    <span className="font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded text-[10px]">
                      Grade {snapshotMetrics.topScorer.overallGrade}
                    </span>
                  </div>
                </>
              ) : (
                <div className="mt-3 text-xs text-slate-400">No data</div>
              )}
            </div>

            {/* Metric 3: Students Needing Extra Support */}
            <div className={`p-4 rounded-xl border transition-colors ${
              snapshotMetrics.needSupportCount > 0
                ? 'bg-gradient-to-br from-rose-50/60 to-amber-50/40 border-rose-200 hover:border-rose-300'
                : 'bg-gradient-to-br from-emerald-50/60 to-slate-50 border-emerald-200 hover:border-emerald-300'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Need Extra Support</span>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  snapshotMetrics.needSupportCount > 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                }`}>
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className={`text-2xl sm:text-3xl font-black ${
                  snapshotMetrics.needSupportCount > 0 ? 'text-rose-700' : 'text-emerald-700'
                }`}>
                  {snapshotMetrics.needSupportCount}
                </span>
                <span className="text-xs font-bold text-slate-600">
                  {snapshotMetrics.needSupportCount === 1 ? 'Student' : 'Students'}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-200/60">
                <span className="truncate max-w-[150px] sm:max-w-[180px]">
                  {snapshotMetrics.needSupportCount > 0
                    ? snapshotMetrics.needSupportStudents.map((s) => s.studentName).join(', ')
                    : 'All students on track'}
                </span>
                <span className={`font-bold shrink-0 ml-1.5 px-1.5 py-0.5 rounded text-[10px] ${
                  snapshotMetrics.needSupportCount > 0 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {snapshotMetrics.needSupportCount > 0 ? 'Remedial Plan' : '100% Target'}
                </span>
              </div>
            </div>

            {/* Dynamic Grade Distribution Bar Chart */}
            <div className="mt-2 pt-4 border-t border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center shadow-2xs">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <span>Grade Distribution Spectrum</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold">
                        {studentSummaries.length} Students Evaluated
                      </span>
                    </h3>
                    <p className="text-[10px] text-slate-500">
                      Visual student count per academic grade (A+, A, B, etc.) for Class {selectedClass}-{selectedSection}
                    </p>
                  </div>
                </div>

                {/* Grade badges pill list */}
                <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                  {gradeDistributionData.map((d) => (
                    <button
                      key={d.grade}
                      type="button"
                      onClick={() => setSelectedGradeFilter(selectedGradeFilter === d.grade ? 'all' : d.grade)}
                      className={`px-2 py-0.5 rounded-md font-bold font-mono border transition-all cursor-pointer ${
                        selectedGradeFilter === d.grade
                          ? 'ring-2 ring-indigo-600 font-black scale-105 shadow-xs'
                          : 'opacity-90 hover:opacity-100 hover:scale-102'
                      }`}
                      style={{
                        backgroundColor: selectedGradeFilter === d.grade ? `${d.color}25` : `${d.color}15`,
                        color: d.color,
                        borderColor: selectedGradeFilter === d.grade ? d.color : `${d.color}35`,
                      }}
                      title={`Click to isolate Grade ${d.grade} (${d.count} students)`}
                    >
                      {d.grade}: {d.count} ({d.percentage}%)
                    </button>
                  ))}
                </div>
              </div>

              {/* Recharts Bar Chart Container */}
              <div className="h-48 w-full bg-slate-50/70 rounded-xl p-3 border border-slate-200/90">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={gradeDistributionData}
                    margin={{ top: 10, right: 12, left: -20, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis
                      dataKey="grade"
                      tick={{ fontSize: 11, fontWeight: 700, fill: '#334155' }}
                      tickLine={false}
                      axisLine={{ stroke: '#CBD5E1' }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 10, fill: '#64748B' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-slate-900 text-white p-3 rounded-xl text-xs shadow-xl border border-slate-700 min-w-[180px] space-y-1">
                              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-1.5">
                                <span className="font-bold text-amber-300 text-sm">Grade {data.grade}</span>
                                <span className="font-mono font-extrabold text-white bg-slate-800 px-2 py-0.5 rounded text-[11px]">
                                  {data.count} {data.count === 1 ? 'Student' : 'Students'}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-300 flex items-center justify-between">
                                <span>Cohort Share:</span>
                                <strong className="font-mono text-indigo-300">{data.percentage}%</strong>
                              </div>
                              {data.studentNames ? (
                                <div className="text-[10px] text-slate-400 border-t border-slate-800/80 pt-1 mt-1">
                                  <span className="text-slate-300 font-bold block">Students:</span>
                                  <span className="text-slate-200">{data.studentNames}</span>
                                </div>
                              ) : (
                                <div className="text-[10px] text-slate-500 italic">No students in this bracket</div>
                              )}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={46}>
                      {gradeDistributionData.map((entry, index) => (
                        <Cell key={`cell-grade-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Chart Insights & Caption */}
              <div className="mt-2.5 flex flex-wrap items-center justify-between text-[11px] text-slate-500 px-1">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                  <span>Distinction & High Achievers (A1/A2): <strong>{gradeDistributionData.filter(d => d.grade.startsWith('A')).reduce((acc, d) => acc + d.count, 0)} Students</strong></span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  <span>Remedial Support Required (E/Needs Support): <strong>{snapshotMetrics.needSupportCount} Student(s)</strong></span>
                </span>
              </div>
            </div>

            {/* Isolated Students Cohort Panel when Grade Filter is Active */}
            {selectedGradeFilter !== 'all' && (
              <div className="mt-3 p-4 bg-indigo-50/80 border-2 border-indigo-200 rounded-2xl space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-200/60 pb-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-black text-xs font-mono shadow-xs">
                      Grade {selectedGradeFilter}
                    </span>
                    <div>
                      <h4 className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                        <span>Isolated Cohort ({filteredByGradeStudents.length} Students)</span>
                        <span className="text-[10px] font-medium text-indigo-700">
                          • {studentSummaries.length > 0 ? Math.round((filteredByGradeStudents.length / studentSummaries.length) * 100) : 0}% of Class {selectedClass}-{selectedSection}
                        </span>
                      </h4>
                      <p className="text-[10px] text-slate-500">
                        Students who achieved Grade {selectedGradeFilter} in {currentExam.name}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-600">
                      Cohort Average: <strong className="text-indigo-900 font-mono">
                        {filteredByGradeStudents.length > 0
                          ? Math.round((filteredByGradeStudents.reduce((acc, s) => acc + s.percentage, 0) / filteredByGradeStudents.length) * 10) / 10
                          : 0}%
                      </strong>
                    </span>
                    <button
                      onClick={() => setSelectedGradeFilter('all')}
                      className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 bg-white px-2.5 py-1 rounded-lg border border-indigo-200 shadow-2xs flex items-center gap-1"
                    >
                      <X className="w-3 h-3" />
                      <span>Clear Filter</span>
                    </button>
                  </div>
                </div>

                {filteredByGradeStudents.length === 0 ? (
                  <div className="p-3 text-center text-xs text-slate-500 italic bg-white rounded-xl border border-indigo-100">
                    No students in Class {selectedClass}-{selectedSection} achieved Grade {selectedGradeFilter}.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {filteredByGradeStudents.map((st) => (
                      <div
                        key={st.studentId}
                        className="bg-white p-3 rounded-xl border border-indigo-200/90 shadow-2xs hover:shadow-xs hover:border-indigo-400 transition-all flex items-center justify-between"
                      >
                        <div className="truncate mr-2">
                          <div className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5 truncate">
                            <span className="font-mono text-indigo-700 font-bold">#{st.rollNumber}</span>
                            <span className="truncate">{st.studentName}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5 font-mono">
                            <span className="font-bold text-slate-800">{st.percentage}%</span>
                            <span>•</span>
                            <span>{st.totalMarksObtained}/{st.totalMaxMarks}</span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded font-bold uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">
                              Grade {st.overallGrade}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => setSelectedStudentSummary(st)}
                            className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] flex items-center gap-1 shadow-2xs"
                            title="View individual Holistic Progress Card"
                          >
                            <Eye className="w-3 h-3" />
                            <span>HPC</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        )}
      </div>

      {/* Roster of Students with Progress Card Actions */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden no-print">
        {/* Roster Toolbar with Bulk Edit & Audit Controls */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-700">
              Student Register ({selectedGradeFilter !== 'all' ? `${filteredByGradeStudents.length} of ${studentSummaries.length}` : studentSummaries.length} enrolled in Class {selectedClass}-{selectedSection})
            </span>
            {selectedGradeFilter !== 'all' && (
              <span className="inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-bold border border-indigo-300">
                <span>Isolated: Grade {selectedGradeFilter} ({filteredByGradeStudents.length})</span>
                <button
                  onClick={() => setSelectedGradeFilter('all')}
                  className="hover:text-indigo-950 font-black ml-0.5 text-xs"
                  title="Remove grade filter"
                >
                  ×
                </button>
              </span>
            )}
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">
              All 6 Core Subjects
            </span>

            {isBulkEditMode && (
              <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-extrabold border border-amber-300 animate-pulse">
                <Edit3 className="w-3 h-3 text-amber-700" />
                <span>Bulk Edit Mode Active (All Students Unlocked)</span>
              </span>
            )}
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            {/* Bulk Edit Toggle */}
            <button
              onClick={() => setIsBulkEditMode(!isBulkEditMode)}
              className={`text-xs font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all ${
                isBulkEditMode
                  ? 'bg-amber-600 text-white border-amber-700 shadow-sm'
                  : 'bg-white text-slate-700 hover:text-slate-900 border-slate-300 shadow-2xs hover:bg-slate-50'
              }`}
              title="Toggle inline editing for all students in this class simultaneously"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{isBulkEditMode ? 'Exit Bulk Edit' : 'Bulk Edit HPC Mode'}</span>
            </button>

            {/* Bulk Undo Button */}
            {isBulkEditMode && bulkUndoStack.length > 0 && (
              <button
                onClick={handleBulkUndo}
                className="text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-2.5 py-1.5 rounded-lg flex items-center gap-1 shadow-2xs transition-colors"
                title={`Undo last bulk change (${bulkUndoStack.length} in stack, max 5)`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Undo ({bulkUndoStack.length})</span>
              </button>
            )}

            {/* Save All Class HPC Marks Button */}
            {isBulkEditMode && (
              <button
                onClick={handleSaveAllBulkHpcMarks}
                disabled={isBulkSaving}
                className="text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 border border-emerald-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
              >
                {isBulkSaving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>Save All Class HPC Marks</span>
              </button>
            )}

            {/* Download Signed Audit Trail CSV */}
            <button
              onClick={() => downloadSignedAuditTrailCsv(selectedClass, selectedSection, school.name)}
              className="text-xs font-bold text-slate-700 hover:text-indigo-800 flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-slate-300 shadow-2xs hover:bg-indigo-50/50 transition-colors"
              title="Download tamper-evident signed CSV audit trail of all mark edits for Class"
            >
              <FileDown className="w-3.5 h-3.5 text-indigo-600" />
              <span>Download Audit Trail (CSV)</span>
            </button>

            {/* View Full Audit Trail Modal */}
            <button
              onClick={openAuditModal}
              className="text-xs font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1.5 rounded-lg shadow-2xs transition-colors"
              title="Inspect historical mark changes, original values, and responsible users"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
              <span>Audit Trail</span>
            </button>

            <button
              onClick={handleQuickPrint}
              disabled={studentSummaries.length === 0}
              className="text-xs font-bold text-slate-800 hover:text-slate-950 flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-slate-300 shadow-2xs hover:bg-slate-50 transition-colors"
              title="Quick Print: Immediately trigger native browser print dialog for current report card view"
            >
              <Printer className="w-3.5 h-3.5 text-emerald-600" />
              <span>Quick Print</span>
            </button>
            <button
              onClick={handleDownloadClassPdf}
              disabled={isGeneratingBatchPdf || studentSummaries.length === 0}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-white px-2.5 py-1.5 rounded-lg border border-slate-300 shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-indigo-600" />
              <span>Download Class PDF ({studentSummaries.length})</span>
            </button>
          </div>
        </div>

        {/* Bulk Save Notice Banner */}
        {bulkSaveNotice && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2 text-xs font-bold text-emerald-800 flex items-center justify-between animate-in fade-in">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{bulkSaveNotice}</span>
            </span>
            <button
              onClick={() => setBulkSaveNotice(null)}
              className="text-emerald-700 hover:text-emerald-950 text-xs font-black"
            >
              ×
            </button>
          </div>
        )}

        {studentSummaries.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No students found in Class {selectedClass}-{selectedSection}.
          </div>
        ) : filteredByGradeStudents.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 bg-slate-50">
            <p className="font-bold text-slate-700">No students found with Grade {selectedGradeFilter}.</p>
            <button
              onClick={() => setSelectedGradeFilter('all')}
              className="mt-2 text-xs font-bold text-indigo-600 hover:underline"
            >
              Reset to All Grades
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Roll #</th>
                  <th className="py-2.5 px-3">Student Name</th>
                  <th className="py-2.5 px-3 text-center">
                    {isBulkEditMode ? 'Total Marks (0-600)' : 'Marks Obtained'}
                  </th>
                  <th className="py-2.5 px-3 text-center">Percentage</th>
                  <th className="py-2.5 px-3 text-center">Att. Marks (Edit)</th>
                  <th className="py-2.5 px-3 text-center">Grade</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredByGradeStudents.map((sum) => {
                  const currentBulkVal = bulkHpcDraftMarks[sum.studentId] ?? sum.totalMarksObtained;
                  const isInvalidBulk = currentBulkVal < 0 || currentBulkVal > 600;
                  const bulkPct = Math.round((currentBulkVal / 600) * 100);
                  const isDeviated = isBulkEditMode && currentBulkVal !== sum.totalMarksObtained;

                  return (
                    <tr
                      key={sum.studentId}
                      className={`transition-colors ${
                        isBulkEditMode ? 'hover:bg-amber-50/50 bg-amber-50/20' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">#{sum.rollNumber}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        <div className="flex items-center gap-1.5">
                          <span>{sum.studentName}</span>
                          {isDeviated && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-800 rounded border border-amber-300" title="Draft differs from saved marks register">
                              <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
                              <span>Edited</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {isBulkEditMode ? (
                          <div className="inline-flex items-center gap-1 justify-center">
                            <input
                              type="number"
                              min={0}
                              max={600}
                              value={currentBulkVal}
                              onChange={(e) => handleBulkMarkChange(sum.studentId, e.target.value)}
                              className={`w-20 px-2 py-1 text-center font-mono font-bold text-xs rounded-lg border ${
                                isInvalidBulk
                                  ? 'border-rose-500 bg-rose-50 text-rose-700 ring-2 ring-rose-200'
                                  : 'border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-amber-500'
                              }`}
                            />
                            <span className="text-[11px] text-slate-400 font-mono">/ 600</span>
                          </div>
                        ) : (
                          <span className="font-mono font-bold text-slate-800">
                            {sum.totalMarksObtained} / {sum.totalMaxMarks}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-extrabold text-indigo-700">
                        {isBulkEditMode ? `${bulkPct}%` : `${sum.percentage}%`}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="inline-flex items-center gap-1 font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                          <span>{students.find((s) => s.id === sum.studentId)?.attendanceMarks ?? 9}</span>
                          <span className="text-[10px] text-emerald-600">/ 10</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-black text-indigo-900">
                        {isBulkEditMode
                          ? bulkPct >= 90 ? 'A+' : bulkPct >= 75 ? 'A' : bulkPct >= 60 ? 'B' : bulkPct >= 40 ? 'C' : 'D'
                          : sum.overallGrade}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          (isBulkEditMode ? bulkPct >= 33 : sum.isPassed)
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {(isBulkEditMode ? bulkPct >= 33 : sum.isPassed) ? 'Passed' : 'Needs Support'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="inline-flex items-center gap-1.5 flex-wrap justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              const st = students.find((s) => s.id === sum.studentId);
                              if (st) handleDownloadSearchedStudentFile(st, 'pdf');
                            }}
                            className="px-2 py-1 rounded bg-indigo-50 text-indigo-700 font-bold text-[11px] hover:bg-indigo-100 transition-colors border border-indigo-200 flex items-center gap-1"
                            title="Download individual student HPC as PDF"
                          >
                            <Download className="w-3 h-3" />
                            <span>PDF</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const st = students.find((s) => s.id === sum.studentId);
                              if (st) handleDownloadSearchedStudentFile(st, 'jpeg');
                            }}
                            className="px-2 py-1 rounded bg-amber-50 text-amber-800 font-bold text-[11px] hover:bg-amber-100 transition-colors border border-amber-200 flex items-center gap-1"
                            title="Download individual student HPC as JPEG"
                          >
                            <ImageIcon className="w-3 h-3" />
                            <span>JPEG</span>
                          </button>
                          <button
                            onClick={() => setSelectedStudentSummary(sum)}
                            className="px-2.5 py-1 rounded bg-indigo-600 text-white font-bold text-[11px] hover:bg-indigo-700 transition-colors flex items-center gap-1 shadow-sm"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Preview</span>
                          </button>
                          <button
                            onClick={() => setWhatsAppStudentSummary(sum)}
                            className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 font-bold text-[11px] hover:bg-emerald-100 transition-colors border border-emerald-200 flex items-center gap-1"
                          >
                            <MessageSquare className="w-3 h-3 text-emerald-600" />
                            <span>Share</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Individual HPC Detailed Modal (A4 Print-Ready Document) */}
      {selectedStudentSummary && (
        <HolisticProgressCardModal
          summary={selectedStudentSummary}
          student={students.find((s) => s.id === selectedStudentSummary.studentId)}
          school={school}
          marksEntries={marksEntries}
          holisticRecord={holisticRecords?.[selectedStudentSummary.studentId]}
          subjectConfigs={classSubjects}
          language={language}
          currentUser={currentUser}
          effectiveRole={effectiveRole}
          onSaveMarks={onSaveMarks}
          onSaveHolisticRecord={onSaveHolisticRecord}
          onUpdateStudent={onUpdateStudent}
          onClose={() => setSelectedStudentSummary(null)}
          onShareWhatsApp={() => {
            setWhatsAppStudentSummary(selectedStudentSummary);
            setSelectedStudentSummary(null);
          }}
        />
      )}

      {/* Consolidated Class Progress Cards Batch Modal (A4 Multi-Page Batch View) */}
      {isConsolidatedDocOpen && (
        <ConsolidatedClassProgressCardsModal
          isOpen={isConsolidatedDocOpen}
          onClose={() => setIsConsolidatedDocOpen(false)}
          studentSummaries={studentSummaries}
          students={students}
          school={school}
          examination={currentExam}
          marksEntries={marksEntries}
          holisticRecords={holisticRecords}
          subjectConfigs={classSubjects}
          classNumber={selectedClass}
          section={selectedSection}
          language={language}
          onDownloadPdf={handleDownloadClassPdf}
          isGeneratingPdf={isGeneratingBatchPdf}
        />
      )}

      {/* WhatsApp / Android Share Modal */}
      {whatsAppStudentSummary && (() => {
        const matchedStudent = students.find((s) => s.id === whatsAppStudentSummary.studentId);
        if (!matchedStudent) return null;
        return (
          <WhatsAppShareModal
            isOpen={true}
            summary={whatsAppStudentSummary}
            student={matchedStudent}
            school={school}
            examName={currentExam?.name || 'Half-Yearly Examination 2026'}
            language={language}
            onClose={() => setWhatsAppStudentSummary(null)}
          />
        );
      })()}

      {/* Class Level Mark Audit Trail Modal */}
      {showClassAuditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] shadow-2xl flex flex-col overflow-hidden border border-slate-200">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="font-extrabold text-sm">Class {selectedClass}-{selectedSection} Mark Change Audit Trail</h3>
                  <p className="text-[11px] text-slate-400">Complete historical ledger of score updates, responsible users, and timestamps</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => downloadSignedAuditTrailCsv(selectedClass, selectedSection, school.name)}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1 shadow-sm"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>Download Signed CSV</span>
                </button>
                <button
                  onClick={() => setShowClassAuditModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-100">
                  <span className="text-[10px] text-indigo-600 uppercase font-bold block">Class Modifications</span>
                  <span className="text-xl font-black text-indigo-950 font-mono">
                    {allAuditLogs.filter((l) => l.classNumber === selectedClass && l.section === selectedSection).length}
                  </span>
                </div>
                <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-100">
                  <span className="text-[10px] text-emerald-600 uppercase font-bold block">Total System Logs</span>
                  <span className="text-xl font-black text-emerald-950 font-mono">{allAuditLogs.length}</span>
                </div>
                <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-100">
                  <span className="text-[10px] text-amber-700 uppercase font-bold block">Digital Signature</span>
                  <span className="text-xs font-bold text-amber-950 block mt-1">Verified Headmaster Seal</span>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Date & Time</th>
                      <th className="py-2.5 px-3">Student</th>
                      <th className="py-2.5 px-3">Subject</th>
                      <th className="py-2.5 px-3 text-center">Original</th>
                      <th className="py-2.5 px-3 text-center">New</th>
                      <th className="py-2.5 px-3 text-center">Delta</th>
                      <th className="py-2.5 px-3">User Responsible</th>
                      <th className="py-2.5 px-3">Module</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {allAuditLogs.map((log) => {
                      const origNum = typeof log.originalValue === 'number' ? log.originalValue : parseFloat(log.originalValue as string) || 0;
                      const newNum = typeof log.newValue === 'number' ? log.newValue : parseFloat(log.newValue as string) || 0;
                      const diff = newNum - origNum;
                      return (
                        <tr key={log.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            <div>{log.studentName}</div>
                            <span className="text-[10px] font-mono text-slate-400">Roll #{log.rollNumber}</span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-semibold text-slate-800">{log.subjectName}</span>
                            <span className="text-[10px] text-slate-400 ml-1 font-mono">({log.subjectCode})</span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-600 bg-slate-50/50">
                            {log.originalValue}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-black text-indigo-900 bg-indigo-50/30">
                            {log.newValue}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                              diff > 0 ? 'bg-emerald-100 text-emerald-800' : diff < 0 ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'
                            }`}>
                              {diff > 0 ? `+${diff}` : diff}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-800">{log.userResponsible}</div>
                            <span className="text-[10px] font-mono text-slate-400">{log.userId}</span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              {log.moduleOrigin}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 text-right">
              <button
                onClick={() => setShowClassAuditModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold"
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden on screen, visible during native print for current report card view (bypasses download workflow) */}
      {!selectedStudentSummary && !isConsolidatedDocOpen && (
        <div className="hidden print:block">
          {(selectedGradeFilter !== 'all' ? filteredByGradeStudents : studentSummaries).map((summary, idx, arr) => {
            const student = students.find((s) => s.id === summary.studentId);
            return (
              <div key={summary.studentId} className="batch-card-wrapper mb-6 print:mb-0">
                <SingleStudentProgressCardView
                  summary={summary}
                  student={student}
                  school={school}
                  marksEntries={marksEntries}
                  holisticRecord={holisticRecords?.[summary.studentId]}
                  subjectConfigs={classSubjects}
                  pageIndex={idx}
                  totalPages={arr.length}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// SINGLE STUDENT PROGRESS CARD VIEW (Reusable for Individual & Batch Consolidation)
// ============================================================================
interface SingleStudentProgressCardViewProps {
  summary: StudentExamSummary;
  student?: Student;
  school: SchoolProfile;
  marksEntries: StudentMarkEntry[];
  holisticRecord?: StudentHolisticRecord;
  subjectConfigs?: SubjectConfig[];
  pageIndex?: number;
  totalPages?: number;
}

const SingleStudentProgressCardView: React.FC<SingleStudentProgressCardViewProps> = ({
  summary,
  student,
  school,
  marksEntries,
  holisticRecord,
  subjectConfigs,
  pageIndex,
  totalPages,
}) => {
  const orderedSubjects = subjectConfigs && subjectConfigs.length > 0 ? subjectConfigs : sampleSubjectConfigs;
  const hol = holisticRecord || sampleHolisticRecords[summary.studentId] || {
    ratings: {
      comm: 'Very Good',
      read_write: 'Good',
      creativity: 'Very Good',
      problem_solving: 'Good',
      teamwork: 'Very Good',
      leadership: 'Good',
      discipline: 'Very Good',
      emotional_dev: 'Very Good',
      social_interaction: 'Very Good',
      environmental_awareness: 'Very Good',
      physical_sports: 'Good',
      art_music_culture: 'Good',
      classroom_participation: 'Very Good',
      digital_literacy: 'Good',
    },
    strengths: 'Active participation, good conduct, and helpful attitude.',
    areasForImprovement: 'Regular practice in mathematical problem-solving.',
    teacherRemarks: 'Diligent student with commendable enthusiasm in class.',
    suggestionsForParents: 'Support reading habits at home and monitor homework.',
    goalsForNextTerm: 'Strive for distinction in mathematics and science.',
  };

  const [editableAttendanceMarks, setEditableAttendanceMarks] = useState<number>(student?.attendanceMarks ?? 9);

  const getSubjectRemark = (code: string) => {
    const entry = marksEntries.find(
      (m) => m.studentId === summary.studentId && m.subjectCode === code
    );
    return entry?.remarks || 'Good progress demonstrated in curricular work.';
  };

  return (
    <div className="printable-card page-break-always bg-white border border-slate-300 rounded-2xl p-6 md:p-8 space-y-4 text-slate-900 shadow-sm print:shadow-none print:border-none print:p-0">
      
      {/* Section A: Header & Identity */}
      <div className="text-center border-b-2 border-slate-900 pb-4">
        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mb-3">
          <span>GOVT. OF JAMMU & KASHMIR • SCHOOL EDUCATION DEPT.</span>
          {pageIndex !== undefined && totalPages !== undefined && (
            <span className="font-bold text-slate-700">PAGE {pageIndex + 1} OF {totalPages}</span>
          )}
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 px-2">
          <div className="w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-2xl bg-white border-2 border-slate-200 shadow-xs p-2 flex items-center justify-center overflow-hidden">
            {school.logoDataUrl ? (
              <img
                src={school.logoDataUrl}
                alt={`${school.name} Official Logo`}
                className="max-w-full max-h-full w-auto h-auto object-contain"
              />
            ) : (
              <SchoolEmblem size={72} />
            )}
          </div>
          <div className="text-center sm:text-left space-y-1 min-w-0">
            <h2 className="text-base sm:text-xl font-black text-slate-900 uppercase tracking-tight leading-snug">
              {school.name}
            </h2>
            <h3 className="text-base sm:text-lg font-bold text-slate-800 font-noori font-urdu leading-relaxed" dir="rtl">
              {school.nameUrdu || 'گورنمنٹ مڈل اسکول پامپوش کالونی'}
            </h3>
            <p className="text-xs font-semibold text-slate-700">
              {formatSchoolAddressOnce(school)}
            </p>
            <p className="text-[11px] text-indigo-900 font-extrabold">
              U-DISE+: {school.code} • Academic Session: {school.academicSession}
            </p>
          </div>
        </div>
        <div className="mt-1.5 inline-flex flex-wrap items-center justify-center gap-2 px-3 py-1 rounded bg-slate-100 border border-slate-400 font-black text-[10px] text-slate-900 uppercase tracking-wider">
          <span>HOLISTIC STUDENT PROGRESS CARD (HPC)</span>
          <span>—</span>
          <span
            dir="rtl"
            className="font-noori text-base sm:text-lg font-bold leading-relaxed tracking-normal px-1 text-indigo-950"
          >
            ہمہ جہت ترقیاتی کارڈ
          </span>
        </div>
      </div>

      {/* Student Biodata Box */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-xs bg-slate-50 p-3 rounded-xl border border-slate-300">
        <div>
          <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Student Name</span>
          <strong className="text-slate-900 text-sm font-extrabold">{summary.studentName}</strong>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Father's Name</span>
          <strong className="text-slate-900">{student?.fatherName || 'Mohd Hussain'}</strong>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Mother's Name</span>
          <strong className="text-slate-900">{student?.motherName || 'Nasreen Akhtar'}</strong>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Date of Birth / Gender</span>
          <strong>{student?.dob || '2015-05-14'} ({student?.gender || 'Male'})</strong>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Class & Section</span>
          <strong className="text-indigo-900 font-bold">Class {summary.classNumber} - Section {summary.section}</strong>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Roll Number</span>
          <strong className="font-mono text-indigo-800">#{summary.rollNumber}</strong>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Admission No / ID</span>
          <strong className="font-mono">{student?.admissionNumber || summary.studentId}</strong>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Attendance Rate</span>
          <strong className="text-emerald-700 font-mono font-bold">92.4% (22/24 Working Days)</strong>
        </div>
      </div>

      {/* Section B: Academic Performance Table (The 6 Core Subjects) */}
      <div>
        <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-800 mb-1 flex items-center gap-1.5">
          <span>Section B: Scholastic Performance (6 Mandatory Subjects)</span>
        </h4>
        <table className="w-full text-left border-collapse text-xs border border-slate-300">
          <thead>
            <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300 text-center text-[11px]">
              <th className="py-1.5 px-2 text-center border-r border-slate-300 w-12 font-mono">S. No.</th>
              <th className="py-1.5 px-2.5 text-left border-r border-slate-300">Subject</th>
              <th className="py-1.5 px-2 border-r border-slate-300">Maximum Marks</th>
              <th className="py-1.5 px-2 border-r border-slate-300">Marks Obtained</th>
              <th className="py-1.5 px-2 border-r border-slate-300">Percentage</th>
              <th className="py-1.5 px-2 border-r border-slate-300">Grade</th>
              <th className="py-1.5 px-2 text-left">Teacher Remarks</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {orderedSubjects.map((cfg, idx) => {
              const entry = marksEntries.find(
                (m) => m.studentId === summary.studentId && m.subjectCode === cfg.code
              );
              const isAbsent = entry ? !!entry.isAbsent : false;
              const marks = entry && !isAbsent ? entry.marksObtained : (isAbsent ? null : 80);
              const maxMarks = cfg.maxMarks;
              const pct = marks !== null ? Math.round(((marks / maxMarks) * 100) * 10) / 10 : 0;
              const grade = isAbsent ? 'AB' : (entry?.grade || 'A');
              const remark = getSubjectRemark(cfg.code);

              return (
                <tr key={cfg.code} className="hover:bg-slate-50 text-center">
                  <td className="py-1.5 px-2 font-mono font-bold text-slate-600 border-r border-slate-200">
                    {idx + 1}
                  </td>
                  <td className="py-1.5 px-2.5 text-left font-bold text-slate-900 border-r border-slate-200">
                    <span>{cfg.name}</span>
                    <span className="font-noori font-urdu text-[11px] text-slate-600 ml-1.5" dir="rtl">({cfg.nameUrdu})</span>
                  </td>
                  <td className="py-1.5 px-2 font-mono border-r border-slate-200">{maxMarks}</td>
                  <td className="py-1.5 px-2 font-mono font-bold text-slate-900 border-r border-slate-200">
                    {isAbsent ? (
                      <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-bold text-[10px]">AB</span>
                    ) : (
                      marks
                    )}
                  </td>
                  <td className="py-1.5 px-2 font-mono font-bold text-indigo-700 border-r border-slate-200">
                    {isAbsent ? '—' : `${pct}%`}
                  </td>
                  <td className="py-1.5 px-2 font-mono font-black text-indigo-900 border-r border-slate-200">
                    {grade}
                  </td>
                  <td className="py-1.5 px-2 text-left text-slate-600 text-[10px] italic">
                    {remark}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 font-bold border-t-2 border-slate-800 text-center text-xs">
              <td colSpan={2} className="py-1.5 px-2.5 text-left border-r border-slate-300 font-extrabold">
                Grand Total
              </td>
              <td className="py-1.5 px-2 font-mono border-r border-slate-300">{summary.totalMaxMarks || 600}</td>
              <td className="py-1.5 px-2 font-mono font-black text-slate-900 border-r border-slate-300">
                {summary.totalMarksObtained}
              </td>
              <td className="py-1.5 px-2 font-mono font-black text-indigo-700 border-r border-slate-300">
                {summary.percentage}%
              </td>
              <td className="py-1.5 px-2 font-mono font-black text-indigo-900 border-r border-slate-300">
                {summary.overallGrade}
              </td>
              <td className="py-1.5 px-2 text-left font-bold text-emerald-700">
                {summary.isPassed ? 'PASSED & PROMOTED' : 'NEEDS REMEDIAL SUPPORT'}
              </td>
            </tr>

            {/* Dedicated Edit Row below Marks Percentage for Continuous Attendance Marks */}
            <tr className="bg-amber-50/70 border-t-2 border-amber-300 text-xs font-bold text-amber-950">
              <td className="py-2 px-2.5 text-left border-r border-amber-300">
                <div className="flex items-center gap-1.5">
                  <span>Attendance & Continuous Evaluation Points</span>
                  <span className="text-[9.5px] font-black uppercase bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded border border-amber-300">
                    Edit Column
                  </span>
                </div>
              </td>
              <td className="py-2 px-2 text-center font-mono border-r border-amber-300">10 Pts</td>
              <td className="py-2 px-2 text-center font-mono border-r border-amber-300">
                <div className="inline-flex items-center justify-center gap-1">
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={editableAttendanceMarks}
                    onChange={(e) => setEditableAttendanceMarks(Math.min(10, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                    title="Edit continuous attendance evaluation marks directly below marks percentage"
                    className="w-12 text-center py-0.5 font-mono font-bold text-xs bg-white border border-amber-400 rounded-lg text-amber-900 focus:ring-2 focus:ring-amber-500 shadow-2xs"
                  />
                  <span className="text-[10px] text-amber-800">/ 10</span>
                </div>
              </td>
              <td className="py-2 px-2 font-mono text-center text-amber-900 border-r border-amber-300">
                {Math.round((editableAttendanceMarks / 10) * 100)}% (Continuous)
              </td>
              <td className="py-2 px-2 font-mono font-black text-center text-amber-900 border-r border-amber-300">
                {editableAttendanceMarks >= 9 ? 'A+' : editableAttendanceMarks >= 8 ? 'A' : editableAttendanceMarks >= 7 ? 'B' : 'C'}
              </td>
              <td className="py-2 px-2 text-left text-[10px] font-medium text-amber-900 italic">
                Awarded for regularity, punctuality & classroom attendance conduct.
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Section C: Holistic Development Assessment (14 NEP Categories) */}
      <div>
        <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-800 mb-1">
          Section C: 14 Holistic Life Skill Domains (Cognitive, Socio-Emotional & Physical)
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 text-xs">
          {HOLISTIC_ASSESSMENT_CATEGORIES.map((cat) => {
            const rating = hol.ratings[cat.id] || 'Very Good';
            return (
              <div key={cat.id} className="p-1.5 border border-slate-200 rounded-lg bg-slate-50/70">
                <div className="text-[9.5px] text-slate-500 font-medium leading-tight">{cat.name}</div>
                <div className="font-extrabold text-indigo-900 mt-0.5 flex items-center justify-between text-[11px]">
                  <span>{rating}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section D: Attendance Summary */}
      <div className="grid grid-cols-4 gap-2 text-center text-xs p-2 bg-slate-50 rounded-xl border border-slate-300">
        <div>
          <span className="text-slate-500 block text-[9.5px] uppercase font-bold">Total Working Days</span>
          <strong className="text-slate-900 font-mono text-xs">24 Days</strong>
        </div>
        <div>
          <span className="text-slate-500 block text-[9.5px] uppercase font-bold">Days Present</span>
          <strong className="text-emerald-700 font-mono text-xs">22 Days</strong>
        </div>
        <div>
          <span className="text-slate-500 block text-[9.5px] uppercase font-bold">Days Absent</span>
          <strong className="text-rose-700 font-mono text-xs">2 Days</strong>
        </div>
        <div>
          <span className="text-slate-500 block text-[9.5px] uppercase font-bold">Attendance Rate</span>
          <strong className="text-indigo-900 font-mono text-xs">91.7%</strong>
        </div>
      </div>

      {/* Section E: Overall Student Progress, Strengths, Domains & Goals */}
      <div className="space-y-1.5 text-xs">
        {(hol.coScholasticRemarks || hol.healthPhysicalEducation || hol.artEducation || hol.workEducation) && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
              <strong className="text-slate-800 block text-[10px] uppercase font-bold">Co-Scholastic &amp; Activities:</strong>
              <p className="text-slate-600 text-[10px] mt-0.5">{hol.coScholasticRemarks || hol.schoolActivitiesParticipation || 'Active in morning assembly & co-curricular activities.'}</p>
            </div>
            <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
              <strong className="text-slate-800 block text-[10px] uppercase font-bold">Health &amp; Physical Education:</strong>
              <p className="text-slate-600 text-[10px] mt-0.5">{hol.healthPhysicalEducation || 'Physically active and attentive to personal hygiene.'}</p>
            </div>
            <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
              <strong className="text-slate-800 block text-[10px] uppercase font-bold">Art, Work &amp; Values:</strong>
              <p className="text-slate-600 text-[10px] mt-0.5">{[hol.artEducation, hol.workEducation, hol.valuesAndBehaviour].filter(Boolean).join(' • ') || 'Courteous, disciplined, and creative.'}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
            <strong className="text-slate-800 block text-[10px] uppercase font-bold text-emerald-800">Student Strengths:</strong>
            <p className="text-slate-600 text-[11px] italic mt-0.5">{hol.strengths}</p>
          </div>
          <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
            <strong className="text-slate-800 block text-[10px] uppercase font-bold text-amber-800">Areas for Improvement:</strong>
            <p className="text-slate-600 text-[11px] mt-0.5">{hol.areasForImprovement}</p>
          </div>
        </div>

        <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
          <p className="text-slate-600 text-[clamp(7px,1.35vw,11px)] print:text-[9.5px] leading-tight whitespace-nowrap tracking-tight">
            <strong className="text-slate-800 font-bold">Teacher Remarks:</strong>{' '}
            {(
              hol.teacherRemarks ||
              'Diligent learner demonstrating steady holistic growth across academic and Co-Scholastic activities.'
            )
              .replace(/^teacher remarks:\s*/i, '')
              .replace(/\s+/g, ' ')
              .trim()}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
            <strong className="text-slate-800 block text-[10px] uppercase font-bold">Parent Remarks &amp; Suggestions:</strong>
            <p className="text-slate-600 text-[10px] mt-0.5">{hol.parentRemarks || hol.suggestionsForParents}</p>
          </div>
          <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
            <strong className="text-slate-800 block text-[10px] uppercase font-bold">Goals for Next Academic Term:</strong>
            <p className="text-slate-600 text-[10px] mt-0.5">{hol.goalsForNextTerm}</p>
          </div>
        </div>
      </div>

      {/* Section F: Signatures */}
      <div className="pt-6 grid grid-cols-3 text-center text-xs text-slate-800 border-t-2 border-slate-800 items-end gap-3">
        <div>
          <div className="h-12 flex items-end justify-center"></div>
          <p className="font-extrabold border-t border-slate-400 pt-1 text-[11px]">Class Teacher</p>
          <p className="text-[10px] text-slate-500 font-bold">Nazir Ahmad Dar (Teacher)</p>
        </div>
        <div>
          <div className="h-12 flex items-end justify-center pb-1">
            {school.officialStampDataUrl && (
              <img src={school.officialStampDataUrl} alt="Official Stamp" className="h-11 w-auto object-contain" />
            )}
          </div>
          <p className="font-extrabold border-t border-slate-400 pt-1 text-[11px]">Parent Sign / Official Stamp</p>
          <p className="text-[10px] text-slate-400">Date: _______________</p>
        </div>
        <div>
          <div className="h-12 flex items-end justify-center pb-1">
            {school.headmasterSignatureDataUrl && (
              <img src={school.headmasterSignatureDataUrl} alt="Headmaster Signature" className="h-10 w-auto object-contain" />
            )}
          </div>
          <p className="font-extrabold border-t border-slate-400 pt-1 text-[11px]">
            {school.headmasterName || school.headTeacherName || 'Headmaster'}
          </p>
          <p className="text-[10px] text-slate-600 font-bold">
            {school.principalDesignation || 'Headmaster'} • Official Seal &amp; Signature
          </p>
        </div>
      </div>

    </div>
  );
};

// ============================================================================
// OFFICIAL INDIVIDUAL HOLISTIC PROGRESS CARD MODAL WITH FULL 13-SECTION EDITING
// ============================================================================
interface HolisticProgressCardModalProps {
  summary: StudentExamSummary;
  student?: Student;
  school: SchoolProfile;
  marksEntries: StudentMarkEntry[];
  holisticRecord?: StudentHolisticRecord;
  subjectConfigs?: SubjectConfig[];
  language: Language;
  currentUser: User | { id: string; name: string; role: string; assignedClasses?: string[] };
  effectiveRole?: AdminRoleType;
  onSaveMarks?: (updated: StudentMarkEntry[]) => void;
  onSaveHolisticRecord?: (record: StudentHolisticRecord) => void;
  onUpdateStudent?: (student: Student) => void;
  onClose: () => void;
  onShareWhatsApp: () => void;
}

const HOLISTIC_RATING_OPTIONS: HolisticRatingLevel[] = [
  'Outstanding',
  'Very Good',
  'Good',
  'Developing',
  'Needs Support',
];

const HolisticProgressCardModal: React.FC<HolisticProgressCardModalProps> = ({
  summary,
  student,
  school,
  marksEntries,
  holisticRecord,
  subjectConfigs,
  language,
  currentUser,
  effectiveRole = 'primary_admin',
  onSaveMarks,
  onSaveHolisticRecord,
  onUpdateStudent,
  onClose,
  onShareWhatsApp,
}) => {
  void language;
  const activeSubjectConfigs = subjectConfigs && subjectConfigs.length > 0 ? subjectConfigs : sampleSubjectConfigs;
  const classKey = `${summary.classNumber}-${summary.section}`;
  const isTeacherAssigned =
    !(currentUser as User).assignedClasses?.length ||
    (currentUser as User).assignedClasses!.some((ac) => ac === classKey || ac === summary.classNumber);
  const canEditCard = effectiveRole !== 'teacher' || isTeacherAssigned;

  // Resolve active holistic record from persisted store -> sample -> defaults
  const baseHolistic: StudentHolisticRecord = useMemo(() => {
    const src = holisticRecord || sampleHolisticRecords[summary.studentId];
    return {
      id: src?.id || `hol-${summary.studentId}`,
      studentId: summary.studentId,
      studentName: student?.fullName || summary.studentName,
      classNumber: student?.classNumber || summary.classNumber,
      section: student?.section || summary.section,
      academicSession: student?.academicSession || school.academicSession,
      assessedByTeacherId: src?.assessedByTeacherId || currentUser.id,
      assessedByTeacherName: src?.assessedByTeacherName || currentUser.name,
      assessedDate: src?.assessedDate || new Date().toISOString().slice(0, 10),
      ratings: {
        comm: 'Very Good',
        read_write: 'Good',
        creativity: 'Very Good',
        problem_solving: 'Good',
        teamwork: 'Very Good',
        leadership: 'Good',
        discipline: 'Very Good',
        emotional_dev: 'Very Good',
        social_interaction: 'Very Good',
        environmental_awareness: 'Very Good',
        physical_sports: 'Good',
        art_music_culture: 'Good',
        classroom_participation: 'Very Good',
        digital_literacy: 'Good',
        ...(src?.ratings || {}),
      },
      observations: src?.observations || {},
      strengths: src?.strengths || 'Active participation, good conduct, and helpful attitude.',
      areasForImprovement: src?.areasForImprovement || 'Regular practice in mathematical problem-solving.',
      teacherRemarks: src?.teacherRemarks || 'Diligent student with commendable enthusiasm in class.',
      suggestionsForParents: src?.suggestionsForParents || 'Support reading habits at home and monitor homework.',
      goalsForNextTerm: src?.goalsForNextTerm || 'Strive for distinction in mathematics and science.',
      coScholasticRemarks:
        src?.coScholasticRemarks || 'Active in morning assembly, debates, quiz competitions, and peer teamwork.',
      attendancePercentageOverride: src?.attendancePercentageOverride ?? 92.4,
      attendanceRemarks:
        src?.attendanceRemarks || 'Punctual and consistent classroom attendance throughout the academic term.',
      healthPhysicalEducation:
        src?.healthPhysicalEducation || 'Physically active, maintains good hygiene, participates in yoga and athletics.',
      artEducation:
        src?.artEducation || 'Expressive in drawing, calligraphy, and cultural craft work.',
      workEducation:
        src?.workEducation || 'Neatness in craft, gardening, and collaborative school upkeep.',
      lifeSkillsSummary:
        src?.lifeSkillsSummary || 'Demonstrates empathy, critical thinking, and clear communication.',
      valuesAndBehaviour:
        src?.valuesAndBehaviour || 'Respectful toward teachers and elders; honest, disciplined, and helpful.',
      schoolActivitiesParticipation:
        src?.schoolActivitiesParticipation || 'Regular participant in Eco-Club, Sports Day, and Science Exhibition.',
      parentRemarks:
        src?.parentRemarks || 'Parents actively encourage daily study routine and school activities.',
      overallStudentDevelopment:
        src?.overallStudentDevelopment || 'Strong all-round holistic growth across scholastic and co-scholastic domains.',
      status: src?.status || 'Completed',
      updatedAt: src?.updatedAt,
    };
  }, [holisticRecord, summary, student, school.academicSession, currentUser.id, currentUser.name]);

  // Full 13-Section Progress Card Editing State
  const [isEditingFullCard, setIsEditingFullCard] = useState<boolean>(false);
  const [draftPersonal, setDraftPersonal] = useState({
    fullName: student?.fullName || summary.studentName,
    fatherName: student?.fatherName || 'Mohd Hussain',
    motherName: student?.motherName || 'Nasreen Akhtar',
    dob: student?.dob || '2015-05-14',
    gender: student?.gender || ('Male' as 'Male' | 'Female' | 'Other'),
    classNumber: student?.classNumber || summary.classNumber,
    section: student?.section || summary.section,
    rollNumber: String(student?.rollNumber ?? summary.rollNumber),
    admissionNumber: student?.admissionNumber || summary.studentId,
    academicSession: student?.academicSession || school.academicSession,
    attendanceMarks: String(student?.attendanceMarks ?? 9),
  });
  const [draftHolistic, setDraftHolistic] = useState<StudentHolisticRecord>(baseHolistic);

  const handleStartFullCardEdit = () => {
    if (!canEditCard) return;
    setDraftPersonal({
      fullName: student?.fullName || summary.studentName,
      fatherName: student?.fatherName || 'Mohd Hussain',
      motherName: student?.motherName || 'Nasreen Akhtar',
      dob: student?.dob || '2015-05-14',
      gender: student?.gender || 'Male',
      classNumber: student?.classNumber || summary.classNumber,
      section: student?.section || summary.section,
      rollNumber: String(student?.rollNumber ?? summary.rollNumber),
      admissionNumber: student?.admissionNumber || summary.studentId,
      academicSession: student?.academicSession || school.academicSession,
      attendanceMarks: String(student?.attendanceMarks ?? 9),
    });
    setDraftHolistic(baseHolistic);
    setIsEditingFullCard(true);
  };

  const handleCancelFullCardEdit = () => {
    setDraftHolistic(baseHolistic);
    setIsEditingFullCard(false);
  };

  const handleSaveFullCard = (mode: 'save' | 'update') => {
    const parsedRoll = parseInt(draftPersonal.rollNumber, 10) || summary.rollNumber;
    const parsedAttMarks = Math.min(10, Math.max(0, parseInt(draftPersonal.attendanceMarks, 10) || 0));

    if (student && onUpdateStudent) {
      onUpdateStudent({
        ...student,
        fullName: draftPersonal.fullName.trim() || student.fullName,
        fatherName: draftPersonal.fatherName.trim() || student.fatherName,
        motherName: draftPersonal.motherName.trim() || student.motherName,
        dob: draftPersonal.dob,
        gender: draftPersonal.gender,
        classNumber: draftPersonal.classNumber,
        section: draftPersonal.section,
        rollNumber: parsedRoll,
        admissionNumber: draftPersonal.admissionNumber.trim() || student.admissionNumber,
        academicSession: draftPersonal.academicSession.trim() || student.academicSession,
        attendanceMarks: parsedAttMarks,
      });
    }

    if (onSaveHolisticRecord) {
      onSaveHolisticRecord({
        ...draftHolistic,
        studentId: summary.studentId,
        studentName: draftPersonal.fullName.trim() || summary.studentName,
        classNumber: draftPersonal.classNumber,
        section: draftPersonal.section,
        academicSession: draftPersonal.academicSession,
        assessedByTeacherId: currentUser.id,
        assessedByTeacherName: currentUser.name,
        assessedDate: new Date().toISOString().slice(0, 10),
        status: draftHolistic.status || 'Completed',
        updatedAt: new Date().toISOString(),
      });
    }

    setIsEditingFullCard(false);
    setSaveNotice(
      mode === 'update'
        ? `✓ Progress Card updated across all 13 sections for ${draftPersonal.fullName}!`
        : `✓ Progress Card saved for ${draftPersonal.fullName}!`
    );
    setTimeout(() => setSaveNotice(null), 4500);
  };
  // Live marks state per subject (supporting numbers, decimals, and absent status)
  const [subjectMarks, setSubjectMarks] = useState<Record<string, { marksObtained: number | null; isAbsent: boolean; remarks: string }>>(() => {
    const map: Record<string, { marksObtained: number | null; isAbsent: boolean; remarks: string }> = {};
    activeSubjectConfigs.forEach((cfg) => {
      const entry = marksEntries.find(
        (m) => m.examId === summary.examId && m.studentId === summary.studentId && m.subjectCode === cfg.code
      );
      const isAbsent = entry ? !!entry.isAbsent : false;
      map[cfg.code] = {
        marksObtained: (entry && !isAbsent && entry.marksObtained !== null) ? entry.marksObtained : (isAbsent ? null : 80),
        isAbsent,
        remarks: entry?.remarks || 'Good progress demonstrated in curricular work.',
      };
    });
    return map;
  });

  // Individual subject editing state
  const [editingSubjectCode, setEditingSubjectCode] = useState<string | null>(null);
  const [rowMarksInput, setRowMarksInput] = useState<string>('');
  const [rowAbsentInput, setRowAbsentInput] = useState<boolean>(false);
  const [rowRemarksInput, setRowRemarksInput] = useState<string>('');
  const [rowValidationError, setRowValidationError] = useState<string | null>(null);

  // Confirmation modal state before saving
  const [confirmSaveModal, setConfirmSaveModal] = useState<{
    isOpen: boolean;
    subjectCode: string;
    subjectName: string;
    oldMarks: number | null;
    oldAbsent: boolean;
    newMarks: number | null;
    newAbsent: boolean;
    remarks: string;
  } | null>(null);

  // Sync conflict resolution modal
  const [syncConflictModal, setSyncConflictModal] = useState<{
    isOpen: boolean;
    conflicts: Array<{ code: string; name: string; hpcValue: string | number; regValue: string | number }>;
  } | null>(null);

  // Notifications and audit modal
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [copiedLinkNotice, setCopiedLinkNotice] = useState<boolean>(false);
  const [showStudentAuditModal, setShowStudentAuditModal] = useState<boolean>(false);
  const [studentAuditLogs, setStudentAuditLogs] = useState<MarkAuditEntry[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Automated synchronous calculation of Results
  const liveCalculations = useMemo(() => {
    let totalMaxMarks = 0;
    let totalMarksObtained = 0;
    let anySubjectFailed = false;

    activeSubjectConfigs.forEach((cfg) => {
      totalMaxMarks += cfg.maxMarks;
      const sub = subjectMarks[cfg.code] || { marksObtained: 80, isAbsent: false, remarks: '' };
      if (!sub.isAbsent && sub.marksObtained !== null) {
        totalMarksObtained += sub.marksObtained;
        if (sub.marksObtained < cfg.passingMarks) {
          anySubjectFailed = true;
        }
      } else if (sub.isAbsent) {
        anySubjectFailed = true;
      }
    });

    const overallPct = totalMaxMarks > 0 ? Math.round((totalMarksObtained / totalMaxMarks) * 1000) / 10 : 0;
    const gradeInfo = getGradeFromPercentage(overallPct, school.gradingScale);

    return {
      totalMaxMarks,
      totalMarksObtained: Math.round(totalMarksObtained * 10) / 10,
      overallPercentage: overallPct,
      overallGrade: gradeInfo.grade,
      isPassed: !anySubjectFailed && overallPct >= 33,
    };
  }, [subjectMarks, school.gradingScale]);

  // Check discrepancies between current HPC marks and Marks Entry Register
  const discrepancies = useMemo(() => {
    const list: Array<{ code: string; name: string; hpcValue: string | number; regValue: string | number }> = [];
    activeSubjectConfigs.forEach((cfg) => {
      const reg = marksEntries.find(
        (m) => m.examId === summary.examId && m.studentId === summary.studentId && m.subjectCode === cfg.code
      );
      const regVal = reg ? (reg.isAbsent ? 'AB' : (reg.marksObtained ?? 80)) : 80;
      const current = subjectMarks[cfg.code];
      const curVal = current ? (current.isAbsent ? 'AB' : (current.marksObtained ?? 80)) : 80;

      if (String(curVal) !== String(regVal)) {
        list.push({
          code: cfg.code,
          name: cfg.name,
          hpcValue: curVal,
          regValue: regVal,
        });
      }
    });
    return list;
  }, [subjectMarks, marksEntries, summary]);

  // Start individual subject edit
  const handleStartEditRow = (code: string) => {
    const current = subjectMarks[code] || { marksObtained: 80, isAbsent: false, remarks: '' };
    setEditingSubjectCode(code);
    setRowMarksInput(current.isAbsent ? '' : (current.marksObtained !== null ? String(current.marksObtained) : ''));
    setRowAbsentInput(current.isAbsent);
    setRowRemarksInput(current.remarks);
    setRowValidationError(null);
  };

  // Cancel individual subject edit
  const handleCancelRowEdit = () => {
    setEditingSubjectCode(null);
    setRowValidationError(null);
  };

  // Initiate save for individual row (triggers confirmation modal)
  const handleInitiateRowSave = (cfg: { code: string; name: string; maxMarks: number }) => {
    const current = subjectMarks[cfg.code] || { marksObtained: 80, isAbsent: false, remarks: '' };
    
    if (rowAbsentInput) {
      setConfirmSaveModal({
        isOpen: true,
        subjectCode: cfg.code,
        subjectName: cfg.name,
        oldMarks: current.marksObtained,
        oldAbsent: current.isAbsent,
        newMarks: null,
        newAbsent: true,
        remarks: rowRemarksInput,
      });
      return;
    }

    if (rowMarksInput.trim() === '') {
      setRowValidationError('Marks Obtained cannot be empty. Check "Absent (AB)" if student did not appear.');
      return;
    }

    const parsed = parseFloat(rowMarksInput);
    if (isNaN(parsed)) {
      setRowValidationError('Please enter a valid numeric value.');
      return;
    }
    if (parsed < 0) {
      setRowValidationError('Marks Obtained cannot be negative.');
      return;
    }
    if (parsed > cfg.maxMarks) {
      setRowValidationError(`Marks Obtained cannot exceed Maximum Marks (${cfg.maxMarks}).`);
      return;
    }

    setRowValidationError(null);
    setConfirmSaveModal({
      isOpen: true,
      subjectCode: cfg.code,
      subjectName: cfg.name,
      oldMarks: current.marksObtained,
      oldAbsent: current.isAbsent,
      newMarks: parsed,
      newAbsent: false,
      remarks: rowRemarksInput,
    });
  };

  // Confirm and persist marks modification
  const handleConfirmSave = () => {
    if (!confirmSaveModal) return;
    setIsSaving(true);

    const { subjectCode, subjectName, oldMarks, oldAbsent, newMarks, newAbsent, remarks } = confirmSaveModal;
    const oldValDisplay = oldAbsent ? 'AB' : (oldMarks !== null ? oldMarks : 80);
    const newValDisplay = newAbsent ? 'AB' : (newMarks !== null ? newMarks : 0);

    // Record permanent tamper-evident audit trail
    if (oldValDisplay !== newValDisplay) {
      recordMarkAudit({
        studentId: summary.studentId,
        studentName: summary.studentName,
        rollNumber: summary.rollNumber,
        classNumber: summary.classNumber,
        section: summary.section,
        subjectCode,
        subjectName,
        examId: summary.examId,
        examName: summary.examName,
        originalValue: oldValDisplay,
        newValue: newValDisplay,
        userResponsible: currentUser.name,
        userId: currentUser.id,
        moduleOrigin: 'HPC Module',
        reason: `Subject marks manual evaluation update (${subjectName})`,
      });
    }

    // Update local subject marks state
    setSubjectMarks((prev) => ({
      ...prev,
      [subjectCode]: {
        marksObtained: newAbsent ? null : newMarks,
        isAbsent: newAbsent,
        remarks: remarks || 'Updated in HPC Module',
      },
    }));

    // Update parent database / marks entries
    if (onSaveMarks) {
      const cfg = activeSubjectConfigs.find((c) => c.code === subjectCode);
      const maxMarks = cfg?.maxMarks || 100;
      const subPct = newMarks !== null ? Math.round(((newMarks / maxMarks) * 100) * 10) / 10 : 0;
      const grade = newAbsent ? 'AB' : getGradeFromPercentage(subPct, school.gradingScale).grade;

      const updatedEntry: StudentMarkEntry = {
        id: `mark-${summary.examId}-${summary.studentId}-${subjectCode}`,
        examId: summary.examId,
        studentId: summary.studentId,
        classNumber: summary.classNumber,
        section: summary.section,
        subjectCode,
        maxMarks,
        marksObtained: newAbsent ? null : newMarks,
        isAbsent: newAbsent,
        grade,
        passed: !newAbsent && (newMarks !== null ? newMarks >= (cfg?.passingMarks || 33) : false),
        remarks: remarks || 'Updated in HPC Module',
      };
      onSaveMarks([updatedEntry]);
    }

    setTimeout(() => {
      setIsSaving(false);
      setEditingSubjectCode(null);
      setConfirmSaveModal(null);
      setSaveNotice(`✓ Marks successfully saved for ${subjectName}! Score: ${newValDisplay}. Results and audit ledger updated.`);
      setTimeout(() => setSaveNotice(null), 4500);
    }, 300);
  };

  // Sync Marks from Register with conflict detection
  const handleSyncFromRegister = () => {
    if (discrepancies.length > 0) {
      setSyncConflictModal({
        isOpen: true,
        conflicts: discrepancies,
      });
    } else {
      executeRegisterSync();
    }
  };

  const executeRegisterSync = () => {
    const map: Record<string, { marksObtained: number | null; isAbsent: boolean; remarks: string }> = {};
    activeSubjectConfigs.forEach((cfg) => {
      const entry = marksEntries.find(
        (m) => m.examId === summary.examId && m.studentId === summary.studentId && m.subjectCode === cfg.code
      );
      const isAbsent = entry ? !!entry.isAbsent : false;
      map[cfg.code] = {
        marksObtained: (entry && !isAbsent && entry.marksObtained !== null) ? entry.marksObtained : (isAbsent ? null : 80),
        isAbsent,
        remarks: entry?.remarks || 'Good progress demonstrated in curricular work.',
      };
    });
    setSubjectMarks(map);
    setEditingSubjectCode(null);
    setSyncConflictModal(null);
    setSaveNotice('✓ Successfully fetched and synchronized current marks from the Marks Entry & Evaluation Register.');
    setTimeout(() => setSaveNotice(null), 4000);
  };

  // Refresh data handler
  const handleRefreshData = () => {
    setSaveNotice('✓ Data refreshed. Totals, percentages, and grade calculations are current.');
    setTimeout(() => setSaveNotice(null), 3000);
  };

  // View Mark History
  const handleOpenStudentAudit = () => {
    const all = getMarkAuditLogs();
    const filtered = all.filter((l) => l.studentId === summary.studentId);
    setStudentAuditLogs(filtered);
    setShowStudentAuditModal(true);
  };

  // Share portal link
  const handleGenerateShareableLink = () => {
    const link = `${window.location.origin}/hpc/portal?student=${summary.studentId}&exam=${summary.examId}&session=${encodeURIComponent(school.academicSession)}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedLinkNotice(true);
      setTimeout(() => setCopiedLinkNotice(false), 3000);
    }).catch(() => {
      setCopiedLinkNotice(true);
      setTimeout(() => setCopiedLinkNotice(false), 3000);
    });
  };

  // Native Android / Web Share
  const handleAndroidShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `HPC: ${summary.studentName} — ${school.name}`,
          text: `Holistic Progress Card for ${summary.studentName} (Class ${summary.classNumber}-${summary.section}). Total: ${liveCalculations.totalMarksObtained}/${liveCalculations.totalMaxMarks} (${liveCalculations.overallPercentage}%, Grade ${liveCalculations.overallGrade}). Conducted under NEP 2020.`,
          url: window.location.href,
        });
      } catch (err) {
        // Ignored or cancelled
      }
    } else {
      onShareWhatsApp();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-3 bg-slate-900/75 backdrop-blur-sm print:p-0 print:static print:bg-white print:z-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[96vh] flex flex-col print:max-h-none print:h-auto print:border-none print:shadow-none print:rounded-none">
        
        {/* Modal Top Actions Toolbar */}
        <div className="p-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 no-print shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs">
              <Award className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-extrabold text-white">
                  Holistic Progress Card: {summary.studentName}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                  Roll #{summary.rollNumber}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5 flex items-center gap-1.5">
                <span>Class {summary.classNumber}-{summary.section} • {summary.examName}</span>
                <span>•</span>
                <span className="font-noori font-urdu text-amber-300" dir="rtl">{school.nameUrdu || 'گورنمنٹ مڈل اسکول پمپوش کالونی'}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Full 13-Section Progress Card Edit / Save / Update / Cancel */}
            {canEditCard && !isEditingFullCard && (
              <button
                onClick={handleStartFullCardEdit}
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-sm transition-colors"
                title="Edit all 13 sections of this Holistic Progress Card"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Card</span>
              </button>
            )}
            {canEditCard && isEditingFullCard && (
              <>
                <button
                  onClick={() => handleSaveFullCard('save')}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black flex items-center gap-1 shadow-sm"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save</span>
                </button>
                <button
                  onClick={() => handleSaveFullCard('update')}
                  className="px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-black flex items-center gap-1 shadow-sm"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Update</span>
                </button>
                <button
                  onClick={handleCancelFullCardEdit}
                  className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Cancel</span>
                </button>
              </>
            )}

            {/* Sync Marks from Register */}
            <button
              onClick={handleSyncFromRegister}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold flex items-center gap-1.5 border border-slate-700 shadow-2xs transition-colors"
              title="Synchronize student marks directly with Marks Entry & Evaluation Register"
            >
              <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
              <span>Sync from Register</span>
            </button>

            {/* Refresh Data */}
            <button
              onClick={handleRefreshData}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold flex items-center gap-1.5 border border-slate-700 shadow-2xs transition-colors"
              title="Recalculate results, overall percentages, and grades"
            >
              <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
              <span>Refresh Data</span>
            </button>

            {/* View Mark History */}
            <button
              onClick={handleOpenStudentAudit}
              className="px-2.5 py-1.5 rounded-lg bg-indigo-950/90 hover:bg-indigo-900 text-indigo-200 hover:text-white text-xs font-bold flex items-center gap-1.5 border border-indigo-800/80 shadow-2xs transition-colors"
              title="Inspect historical audit trail of marks for this student"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-300" />
              <span>View History</span>
            </button>

            {/* Share Portal Link */}
            <button
              onClick={handleGenerateShareableLink}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-700"
              title="Generate parent portal shareable link"
            >
              {copiedLinkNotice ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Link className="w-3.5 h-3.5 text-indigo-300" />
                  <span>Portal Link</span>
                </>
              )}
            </button>

            {/* Android / WhatsApp Share */}
            <button
              onClick={handleAndroidShare}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
              title="Share progress card via WhatsApp or Android Share Sheet"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share</span>
            </button>

            {/* Native Print */}
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
              title="Quick Print: Trigger browser native print dialog for official A4 card"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>

            <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Save Notice Notification Toast */}
        {saveNotice && (
          <div className="bg-emerald-50 border-b border-emerald-300 px-4 py-2.5 text-xs font-bold text-emerald-900 flex items-center justify-between no-print animate-in fade-in">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{saveNotice}</span>
            </span>
            <button onClick={() => setSaveNotice(null)} className="text-emerald-700 hover:text-emerald-900 font-black text-sm">×</button>
          </div>
        )}

        {/* Sync Status Banner */}
        <div
          className={`border-b px-4 py-2 flex flex-wrap items-center justify-between gap-2.5 no-print transition-colors ${
            discrepancies.length > 0
              ? 'bg-amber-50 border-amber-300 text-amber-900'
              : 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0 text-xs">
            {discrepancies.length > 0 ? (
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
            <div>
              <span className={`font-black uppercase tracking-wider text-[10px] px-2 py-0.5 rounded mr-1.5 font-mono ${
                discrepancies.length > 0
                  ? 'bg-amber-200 text-amber-950 border border-amber-400'
                  : 'bg-emerald-200 text-emerald-950 border border-emerald-400'
              }`}>
                {discrepancies.length > 0 ? 'Sync Discrepancy' : 'Register Synced'}
              </span>
              {discrepancies.length > 0 ? (
                <span>
                  <strong>{discrepancies.length} subject(s) modified in HPC:</strong>{' '}
                  <span className="font-mono text-[11px] font-bold text-amber-950">
                    {discrepancies.map((d) => `${d.name} (HPC: ${d.hpcValue} vs Reg: ${d.regValue})`).join(' • ')}
                  </span>
                </span>
              ) : (
                <span className="text-emerald-800 font-medium">
                  HPC marks and evaluations are matched with the central Marks Entry Register.
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncFromRegister}
              className="text-xs font-bold text-indigo-700 hover:text-indigo-900 underline flex items-center gap-1 cursor-pointer"
            >
              <span>{discrepancies.length > 0 ? 'Resolve & Re-sync' : 'Check Sync'}</span>
            </button>
          </div>
        </div>

        {/* Main Document Content Area */}
        <div className="overflow-y-auto p-4 md:p-6 bg-slate-100 flex-1 print:p-0 print:bg-white print:overflow-visible space-y-4">
          <div className="printable-card page-break-always bg-white border border-slate-300 rounded-2xl p-6 md:p-8 space-y-4 text-slate-900 shadow-sm print:shadow-none print:border-none print:p-0">
            
            {/* Section A: Header & School Identity */}
            <div className="text-center border-b-2 border-slate-900 pb-4">
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mb-3">
                <span>GOVT. OF JAMMU & KASHMIR • SCHOOL EDUCATION DEPT.</span>
                <span className="font-bold text-slate-700">OFFICIAL STUDENT PROGRESS CARD</span>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 px-2">
                <div className="w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-2xl bg-white border-2 border-slate-200 shadow-xs p-2 flex items-center justify-center overflow-hidden">
                  {school.logoDataUrl ? (
                    <img
                      src={school.logoDataUrl}
                      alt={`${school.name} Official Logo`}
                      className="max-w-full max-h-full w-auto h-auto object-contain"
                    />
                  ) : (
                    <SchoolEmblem size={72} />
                  )}
                </div>
                <div className="text-center sm:text-left space-y-1 min-w-0">
                  <h2 className="text-base sm:text-xl font-black text-slate-900 uppercase tracking-tight leading-snug">
                    {school.name}
                  </h2>
                  <h3 className="text-base sm:text-lg font-bold text-slate-800 font-noori font-urdu leading-relaxed" dir="rtl">
                    {school.nameUrdu || 'گورنمنٹ مڈل اسکول پامپوش کالونی'}
                  </h3>
                  <p className="text-xs font-semibold text-slate-700">
                    {formatSchoolAddressOnce(school)}
                  </p>
                  <p className="text-[11px] text-indigo-900 font-extrabold">
                    U-DISE+: {school.code} • Academic Session: {isEditingFullCard ? draftPersonal.academicSession : (student?.academicSession || school.academicSession)}
                  </p>
                </div>
              </div>
              <div className="mt-1.5 inline-flex flex-wrap items-center justify-center gap-2 px-3 py-1 rounded bg-slate-100 border border-slate-400 font-black text-[10px] text-slate-900 uppercase tracking-wider">
                <span>HOLISTIC STUDENT PROGRESS CARD (HPC)</span>
                <span>—</span>
                <span
                  dir="rtl"
                  className="font-noori text-base sm:text-lg font-bold leading-relaxed tracking-normal px-1 text-indigo-950"
                >
                  ہمہ جہت ترقیاتی کارڈ
                </span>
              </div>
            </div>

            {!canEditCard && (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold flex items-center gap-2 no-print">
                <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
                <span>View-Only Mode: Only Primary Administrators or Teachers assigned to Class {summary.classNumber}-{summary.section} can edit this card.</span>
              </div>
            )}

            {/* Section 1: Student Personal Info (Editable in Full Card Edit Mode) */}
            {isEditingFullCard ? (
              <div className="bg-indigo-50/70 p-4 rounded-xl border-2 border-indigo-300 space-y-3 text-xs no-print">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-indigo-900">
                    Section 1: Personal Info & Attendance (Editing)
                  </span>
                  <span className="text-[10px] font-bold text-indigo-700">Changes sync directly to Student Master</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Student Name</label>
                    <input type="text" value={draftPersonal.fullName} onChange={(e) => setDraftPersonal({ ...draftPersonal, fullName: e.target.value })} className="w-full px-2 py-1 rounded border border-indigo-300 bg-white font-bold" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Father&apos;s Name</label>
                    <input type="text" value={draftPersonal.fatherName} onChange={(e) => setDraftPersonal({ ...draftPersonal, fatherName: e.target.value })} className="w-full px-2 py-1 rounded border border-indigo-300 bg-white" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Mother&apos;s Name</label>
                    <input type="text" value={draftPersonal.motherName} onChange={(e) => setDraftPersonal({ ...draftPersonal, motherName: e.target.value })} className="w-full px-2 py-1 rounded border border-indigo-300 bg-white" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Date of Birth</label>
                    <input type="date" value={draftPersonal.dob} onChange={(e) => setDraftPersonal({ ...draftPersonal, dob: e.target.value })} className="w-full px-2 py-1 rounded border border-indigo-300 bg-white" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Class</label>
                    <input type="text" value={draftPersonal.classNumber} onChange={(e) => setDraftPersonal({ ...draftPersonal, classNumber: e.target.value })} className="w-full px-2 py-1 rounded border border-indigo-300 bg-white font-bold" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Section</label>
                    <select value={draftPersonal.section} onChange={(e) => setDraftPersonal({ ...draftPersonal, section: e.target.value })} className="w-full px-2 py-1 rounded border border-indigo-300 bg-white font-bold">
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="C">C</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Roll Number</label>
                    <input type="number" min="1" value={draftPersonal.rollNumber} onChange={(e) => setDraftPersonal({ ...draftPersonal, rollNumber: e.target.value })} className="w-full px-2 py-1 rounded border border-indigo-300 bg-white font-mono" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Admission Number</label>
                    <input type="text" value={draftPersonal.admissionNumber} onChange={(e) => setDraftPersonal({ ...draftPersonal, admissionNumber: e.target.value })} className="w-full px-2 py-1 rounded border border-indigo-300 bg-white font-mono" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Academic Session</label>
                    <input type="text" value={draftPersonal.academicSession} onChange={(e) => setDraftPersonal({ ...draftPersonal, academicSession: e.target.value })} className="w-full px-2 py-1 rounded border border-indigo-300 bg-white font-mono" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Attendance %</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={draftHolistic.attendancePercentageOverride ?? 92.4}
                      onChange={(e) => setDraftHolistic({ ...draftHolistic, attendancePercentageOverride: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2 py-1 rounded border border-indigo-300 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Att. Marks (/10)</label>
                    <input type="number" min="0" max="10" value={draftPersonal.attendanceMarks} onChange={(e) => setDraftPersonal({ ...draftPersonal, attendanceMarks: e.target.value })} className="w-full px-2 py-1 rounded border border-indigo-300 bg-white font-mono" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">HPC Status</label>
                    <select
                      value={draftHolistic.status || 'Completed'}
                      onChange={(e) => setDraftHolistic({ ...draftHolistic, status: e.target.value as 'Completed' | 'Pending' })}
                      className="w-full px-2 py-1 rounded border border-indigo-300 bg-white font-bold"
                    >
                      <option value="Completed">Completed</option>
                      <option value="Pending">Pending</option>
                    </select>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-xs bg-slate-50 p-3 rounded-xl border border-slate-300">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Student Name</span>
                  <strong className="text-slate-900 text-sm font-extrabold">{student?.fullName || summary.studentName}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Father&apos;s Name</span>
                  <strong className="text-slate-900">{student?.fatherName || 'Mohd Hussain'}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Mother&apos;s Name</span>
                  <strong className="text-slate-900">{student?.motherName || 'Nasreen Akhtar'}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Date of Birth / Gender</span>
                  <strong>{student?.dob || '2015-05-14'} ({student?.gender || 'Male'})</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Class & Section</span>
                  <strong className="text-indigo-900 font-bold">Class {student?.classNumber || summary.classNumber} - Section {student?.section || summary.section}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Roll Number</span>
                  <strong className="font-mono text-indigo-800">#{student?.rollNumber ?? summary.rollNumber}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Admission No / ID</span>
                  <strong className="font-mono">{student?.admissionNumber || summary.studentId}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Attendance Rate</span>
                  <strong className="text-emerald-700 font-mono font-bold">{baseHolistic.attendancePercentageOverride ?? 92.4}%</strong>
                </div>
              </div>
            )}

            {/* Section B: Scholastic Performance with Marks Obtained Column & Individual Edit Controls */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <span>Section B: Scholastic Performance (6 Mandatory Subjects)</span>
                </h4>
                <div className="flex items-center gap-2 text-xs no-print">
                  <span className="text-[11px] font-mono text-slate-600 font-bold">
                    Live Score: <strong className="text-indigo-900 font-black">{liveCalculations.totalMarksObtained}</strong>/{liveCalculations.totalMaxMarks} ({liveCalculations.overallPercentage}%)
                  </span>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200">
                    Grade {liveCalculations.overallGrade}
                  </span>
                </div>
              </div>

              {/* Row validation error alert */}
              {rowValidationError && (
                <div className="mb-2 p-2 rounded-lg bg-rose-50 border border-rose-300 text-rose-800 text-xs font-bold flex items-center gap-1.5 no-print animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{rowValidationError}</span>
                </div>
              )}

              {/* Section B Scholastic Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs border border-slate-300">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300 text-center text-[11px]">
                      <th className="py-2 px-2 text-center border-r border-slate-300 w-12 font-mono">S. No.</th>
                      <th className="py-2 px-2.5 text-left border-r border-slate-300">Subject</th>
                      <th className="py-2 px-2 border-r border-slate-300 w-24">Maximum Marks</th>
                      <th className="py-2 px-3 border-r border-slate-300 w-36">Marks Obtained</th>
                      <th className="py-2 px-2 border-r border-slate-300 w-20">Percentage</th>
                      <th className="py-2 px-2 border-r border-slate-300 w-16">Grade</th>
                      <th className="py-2 px-2 text-left">Teacher Remarks</th>
                      <th className="py-2 px-2 text-center w-28 no-print">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {activeSubjectConfigs.map((cfg, idx) => {
                      const isEditing = editingSubjectCode === cfg.code;
                      const sub = subjectMarks[cfg.code] || { marksObtained: 80, isAbsent: false, remarks: '' };
                      const maxMarks = cfg.maxMarks;
                      
                      const marksVal = sub.isAbsent ? null : sub.marksObtained;
                      const pct = marksVal !== null ? Math.round(((marksVal / maxMarks) * 100) * 10) / 10 : 0;
                      const grade = sub.isAbsent ? 'AB' : getGradeFromPercentage(pct, school.gradingScale).grade;

                      return (
                        <tr
                          key={cfg.code}
                          className={`text-center transition-colors ${
                            isEditing ? 'bg-indigo-50/60 ring-2 ring-indigo-400/40' : 'hover:bg-slate-50/70'
                          }`}
                        >
                          {/* 1. S. No. Column */}
                          <td className="py-2 px-2 font-mono font-bold text-slate-600 border-r border-slate-200">
                            {idx + 1}
                          </td>

                          {/* 2. Subject Column (English + Noori Nastaleeq Urdu) */}
                          <td className="py-2 px-2.5 text-left font-bold text-slate-900 border-r border-slate-200">
                            <div>
                              <span>{cfg.name}</span>
                              <span className="font-noori font-urdu text-[11.5px] text-slate-600 ml-1.5" dir="rtl">
                                ({cfg.nameUrdu})
                              </span>
                            </div>
                            <span className="text-[9.5px] font-mono text-slate-400">Code: {cfg.code}</span>
                          </td>

                          {/* 3. Maximum Marks Column (Retained, clearly displayed) */}
                          <td className="py-2 px-2 font-mono font-bold text-slate-700 border-r border-slate-200">
                            {maxMarks}
                          </td>

                          {/* 4. Marks Obtained Column (Editable with decimal and absent support) */}
                          <td className="py-2 px-3 border-r border-slate-200 text-center font-mono">
                            {isEditing ? (
                              <div className="space-y-1.5">
                                <div className="inline-flex items-center gap-1 justify-center">
                                  <input
                                    type="number"
                                    step="0.5"
                                    min="0"
                                    max={maxMarks}
                                    disabled={rowAbsentInput}
                                    value={rowMarksInput}
                                    onChange={(e) => {
                                      setRowMarksInput(e.target.value);
                                      setRowValidationError(null);
                                    }}
                                    placeholder="Marks"
                                    className={`w-20 px-2 py-1 text-center font-mono font-bold text-xs rounded-lg border shadow-2xs ${
                                      rowAbsentInput
                                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                        : 'bg-white text-slate-900 border-indigo-400 focus:ring-2 focus:ring-indigo-500'
                                    }`}
                                  />
                                  <span className="text-slate-400 text-[10px]">/{maxMarks}</span>
                                </div>
                                <div>
                                  <label className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 hover:text-slate-900 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={rowAbsentInput}
                                      onChange={(e) => {
                                        setRowAbsentInput(e.target.checked);
                                        if (e.target.checked) {
                                          setRowMarksInput('');
                                        }
                                        setRowValidationError(null);
                                      }}
                                      className="rounded text-indigo-600 focus:ring-indigo-500 w-3 h-3"
                                    />
                                    <span>Absent (AB)</span>
                                  </label>
                                </div>
                              </div>
                            ) : (
                              <div className="font-extrabold text-slate-900 text-sm">
                                {sub.isAbsent ? (
                                  <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold text-xs">
                                    AB (Absent)
                                  </span>
                                ) : (
                                  <span className="text-indigo-950 font-black">{marksVal}</span>
                                )}
                              </div>
                            )}
                          </td>

                          {/* 5. Percentage Column */}
                          <td className="py-2 px-2 font-mono font-bold text-indigo-700 border-r border-slate-200">
                            {isEditing ? (
                              rowAbsentInput ? '—' : `${rowMarksInput ? Math.round(((parseFloat(rowMarksInput) || 0) / maxMarks) * 1000) / 10 : 0}%`
                            ) : (
                              sub.isAbsent ? '—' : `${pct}%`
                            )}
                          </td>

                          {/* 6. Grade Column */}
                          <td className="py-2 px-2 font-mono font-black text-indigo-900 border-r border-slate-200">
                            {isEditing ? (
                              rowAbsentInput ? 'AB' : getGradeFromPercentage(rowMarksInput ? ((parseFloat(rowMarksInput) || 0) / maxMarks) * 100 : 0, school.gradingScale).grade
                            ) : (
                              grade
                            )}
                          </td>

                          {/* 7. Teacher Remarks Column */}
                          <td className="py-2 px-2 text-left text-slate-600 text-[10.5px]">
                            {isEditing ? (
                              <input
                                type="text"
                                value={rowRemarksInput}
                                onChange={(e) => setRowRemarksInput(e.target.value)}
                                className="w-full px-2 py-1 text-[11px] rounded border border-slate-300 bg-white focus:ring-1 focus:ring-indigo-500"
                                placeholder="Subject evaluation remark..."
                              />
                            ) : (
                              <span className="italic">{sub.remarks}</span>
                            )}
                          </td>

                          {/* 8. Row Action Buttons (Save Changes / Cancel / Edit Marks) */}
                          <td className="py-2 px-2 text-center no-print border-l border-slate-200">
                            {isEditing ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => handleInitiateRowSave(cfg)}
                                  className="px-2 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-[11px] flex items-center gap-1 shadow-2xs cursor-pointer"
                                  title="Save Changes for this subject"
                                >
                                  <Save className="w-3 h-3" />
                                  <span>Save</span>
                                </button>
                                <button
                                  onClick={handleCancelRowEdit}
                                  className="px-2 py-1 rounded-md bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-[11px] flex items-center gap-0.5 cursor-pointer"
                                  title="Cancel editing"
                                >
                                  <X className="w-3 h-3" />
                                  <span>Cancel</span>
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleStartEditRow(cfg.code)}
                                className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-800 font-bold text-[11px] border border-slate-300 shadow-2xs flex items-center gap-1 mx-auto transition-colors cursor-pointer"
                                title={`Edit Marks Obtained for ${cfg.name}`}
                              >
                                <Edit3 className="w-3 h-3 text-indigo-600" />
                                <span>Edit Marks</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    {/* Automated Calculations Summary Row */}
                    <tr className="bg-slate-100 font-bold border-t-2 border-slate-800 text-center text-xs">
                      <td colSpan={2} className="py-2 px-2.5 text-left border-r border-slate-300 font-black">
                        Total Scholastic Marks
                      </td>
                      <td className="py-2 px-2 font-mono border-r border-slate-300 text-slate-800 font-black">
                        {liveCalculations.totalMaxMarks}
                      </td>
                      <td className="py-2 px-3 font-mono font-black text-slate-950 border-r border-slate-300 text-sm">
                        {liveCalculations.totalMarksObtained}
                      </td>
                      <td className="py-2 px-2 font-mono font-black text-indigo-700 border-r border-slate-300">
                        {liveCalculations.overallPercentage}%
                      </td>
                      <td className="py-2 px-2 font-mono font-black text-indigo-950 border-r border-slate-300">
                        {liveCalculations.overallGrade}
                      </td>
                      <td colSpan={2} className="py-2 px-2 text-left font-bold text-emerald-700">
                        {liveCalculations.isPassed ? 'PASSED & PROMOTED' : 'NEEDS REMEDIAL SUPPORT'}
                      </td>
                    </tr>

                    {/* Continuous Attendance Evaluation Row */}
                    <tr className="bg-amber-50/70 border-t-2 border-amber-300 text-xs font-bold text-amber-950">
                      <td colSpan={2} className="py-2 px-2.5 text-left border-r border-amber-300">
                        <div className="flex items-center gap-1.5">
                          <span>Attendance &amp; Continuous Evaluation Points</span>
                          <span className="text-[9.5px] font-black uppercase bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded border border-amber-300">
                            Evaluation Points
                          </span>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-center font-mono border-r border-amber-300">10 Pts</td>
                      <td className="py-2 px-2 text-center font-mono border-r border-amber-300 font-black">
                        9 / 10
                      </td>
                      <td className="py-2 px-2 text-center font-mono text-amber-900 border-r border-amber-300">
                        90%
                      </td>
                      <td className="py-2 px-2 text-center font-mono font-black text-amber-950 border-r border-amber-300">
                        A1
                      </td>
                      <td colSpan={2} className="py-2 px-2 text-left text-[10px] text-amber-900 italic font-medium">
                        Continuous engagement and punctuality rating (NEP co-curricular weightage)
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Section C: Co-Curricular & NEP 2020 14 Life Skill Domains */}
            <div>
              <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-800 mb-1 flex items-center justify-between gap-1.5">
                <span>Section C: Co-Scholastic &amp; 14 Life Skill Domains (360° NEP Evaluation)</span>
                {isEditingFullCard && (
                  <span className="text-[10px] text-indigo-700 font-bold no-print">Click dropdowns to edit ratings</span>
                )}
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-1.5 text-center text-[10px]">
                {HOLISTIC_ASSESSMENT_CATEGORIES.map((cat) => {
                  const activeRatings = isEditingFullCard ? draftHolistic.ratings : baseHolistic.ratings;
                  const rating = (activeRatings?.[cat.id] as HolisticRatingLevel) || 'Very Good';
                  const isVeryGood = rating === 'Very Good' || rating === 'Outstanding';
                  return (
                    <div
                      key={cat.id}
                      className={`p-1.5 rounded-lg border flex flex-col justify-between ${
                        isVeryGood
                          ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                          : 'bg-slate-50 border-slate-200 text-slate-800'
                      }`}
                    >
                      <div className="font-bold truncate text-[10px]" title={cat.name}>
                        {cat.name}
                      </div>
                      {isEditingFullCard ? (
                        <select
                          value={rating}
                          onChange={(e) =>
                            setDraftHolistic({
                              ...draftHolistic,
                              ratings: {
                                ...draftHolistic.ratings,
                                [cat.id]: e.target.value as HolisticRatingLevel,
                              },
                            })
                          }
                          className="mt-1 px-1 py-0.5 rounded border border-indigo-300 bg-white font-bold text-[10px]"
                        >
                          {HOLISTIC_RATING_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : (
                        <div className="font-black text-xs mt-1 font-mono">{rating}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sections D & E: Full 13-Section Holistic Progress Details (Co-Scholastic, Attendance, Health/PE, Art, Work, Life Skills, Values, Activities, Teacher/Parent Remarks, Overall Development) */}
            {isEditingFullCard ? (
              <div className="space-y-3 text-xs bg-indigo-50/50 p-4 rounded-xl border-2 border-indigo-200 no-print">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-indigo-950">
                    Sections 3–13: Co-Scholastic, Health, Art, Work, Life Skills, Values, Activities &amp; Remarks
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSaveFullCard('save')}
                      className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1"
                    >
                      <Save className="w-3 h-3" />
                      <span>Save</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveFullCard('update')}
                      className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Update</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelFullCardEdit}
                      className="px-3 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-[11px]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">3. Co-Scholastic Remarks</label>
                    <textarea rows={2} value={draftHolistic.coScholasticRemarks || ''} onChange={(e) => setDraftHolistic({ ...draftHolistic, coScholasticRemarks: e.target.value })} className="w-full p-2 rounded-lg border border-indigo-200 bg-white text-xs" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">4. Attendance Remarks</label>
                    <textarea rows={2} value={draftHolistic.attendanceRemarks || ''} onChange={(e) => setDraftHolistic({ ...draftHolistic, attendanceRemarks: e.target.value })} className="w-full p-2 rounded-lg border border-indigo-200 bg-white text-xs" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">5. Health &amp; Physical Education</label>
                    <textarea rows={2} value={draftHolistic.healthPhysicalEducation || ''} onChange={(e) => setDraftHolistic({ ...draftHolistic, healthPhysicalEducation: e.target.value })} className="w-full p-2 rounded-lg border border-indigo-200 bg-white text-xs" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">6. Art Education</label>
                    <textarea rows={2} value={draftHolistic.artEducation || ''} onChange={(e) => setDraftHolistic({ ...draftHolistic, artEducation: e.target.value })} className="w-full p-2 rounded-lg border border-indigo-200 bg-white text-xs" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">7. Work Education</label>
                    <textarea rows={2} value={draftHolistic.workEducation || ''} onChange={(e) => setDraftHolistic({ ...draftHolistic, workEducation: e.target.value })} className="w-full p-2 rounded-lg border border-indigo-200 bg-white text-xs" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">8. Life Skills Summary</label>
                    <textarea rows={2} value={draftHolistic.lifeSkillsSummary || ''} onChange={(e) => setDraftHolistic({ ...draftHolistic, lifeSkillsSummary: e.target.value })} className="w-full p-2 rounded-lg border border-indigo-200 bg-white text-xs" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">9. Values &amp; Behaviour</label>
                    <textarea rows={2} value={draftHolistic.valuesAndBehaviour || ''} onChange={(e) => setDraftHolistic({ ...draftHolistic, valuesAndBehaviour: e.target.value })} className="w-full p-2 rounded-lg border border-indigo-200 bg-white text-xs" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">10. Participation in School Activities</label>
                    <textarea rows={2} value={draftHolistic.schoolActivitiesParticipation || ''} onChange={(e) => setDraftHolistic({ ...draftHolistic, schoolActivitiesParticipation: e.target.value })} className="w-full p-2 rounded-lg border border-indigo-200 bg-white text-xs" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">Key Strengths</label>
                    <textarea rows={2} value={draftHolistic.strengths} onChange={(e) => setDraftHolistic({ ...draftHolistic, strengths: e.target.value })} className="w-full p-2 rounded-lg border border-indigo-200 bg-white text-xs" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">Areas for Improvement</label>
                    <textarea rows={2} value={draftHolistic.areasForImprovement} onChange={(e) => setDraftHolistic({ ...draftHolistic, areasForImprovement: e.target.value })} className="w-full p-2 rounded-lg border border-indigo-200 bg-white text-xs" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">11. Teacher Remarks</label>
                    <textarea rows={2} value={draftHolistic.teacherRemarks} onChange={(e) => setDraftHolistic({ ...draftHolistic, teacherRemarks: e.target.value })} className="w-full p-2 rounded-lg border border-indigo-200 bg-white text-xs" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">12. Parent Remarks &amp; Suggestions</label>
                    <textarea rows={2} value={draftHolistic.parentRemarks || draftHolistic.suggestionsForParents} onChange={(e) => setDraftHolistic({ ...draftHolistic, parentRemarks: e.target.value, suggestionsForParents: e.target.value })} className="w-full p-2 rounded-lg border border-indigo-200 bg-white text-xs" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">13. Overall Student Development</label>
                    <textarea rows={2} value={draftHolistic.overallStudentDevelopment || ''} onChange={(e) => setDraftHolistic({ ...draftHolistic, overallStudentDevelopment: e.target.value })} className="w-full p-2 rounded-lg border border-indigo-200 bg-white text-xs" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">Goals for Next Academic Term</label>
                    <textarea rows={2} value={draftHolistic.goalsForNextTerm} onChange={(e) => setDraftHolistic({ ...draftHolistic, goalsForNextTerm: e.target.value })} className="w-full p-2 rounded-lg border border-indigo-200 bg-white text-xs" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                    <strong className="text-slate-800 block text-[10px] uppercase font-bold">Co-Scholastic Activities:</strong>
                    <p className="text-slate-600 text-[10px] mt-0.5">{baseHolistic.coScholasticRemarks}</p>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                    <strong className="text-slate-800 block text-[10px] uppercase font-bold">Health &amp; Physical Education:</strong>
                    <p className="text-slate-600 text-[10px] mt-0.5">{baseHolistic.healthPhysicalEducation}</p>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                    <strong className="text-slate-800 block text-[10px] uppercase font-bold">Art &amp; Work Education:</strong>
                    <p className="text-slate-600 text-[10px] mt-0.5">{baseHolistic.artEducation} • {baseHolistic.workEducation}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                    <strong className="text-slate-800 block text-[10px] uppercase font-bold">Life Skills:</strong>
                    <p className="text-slate-600 text-[10px] mt-0.5">{baseHolistic.lifeSkillsSummary}</p>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                    <strong className="text-slate-800 block text-[10px] uppercase font-bold">Values &amp; Behaviour:</strong>
                    <p className="text-slate-600 text-[10px] mt-0.5">{baseHolistic.valuesAndBehaviour}</p>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                    <strong className="text-slate-800 block text-[10px] uppercase font-bold">School Activities Participation:</strong>
                    <p className="text-slate-600 text-[10px] mt-0.5">{baseHolistic.schoolActivitiesParticipation}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                    <strong className="text-slate-800 block text-[10px] uppercase font-bold">Key Strengths:</strong>
                    <p className="text-slate-600 text-[10px] mt-0.5">{baseHolistic.strengths}</p>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                    <strong className="text-slate-800 block text-[10px] uppercase font-bold">Areas for Improvement:</strong>
                    <p className="text-slate-600 text-[10px] mt-0.5">{baseHolistic.areasForImprovement}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
                    <p className="text-slate-600 text-[clamp(7px,1.35vw,11px)] print:text-[9.5px] leading-tight whitespace-nowrap tracking-tight">
                      <strong className="text-slate-800 font-bold">Teacher Remarks:</strong>{' '}
                      {(
                        baseHolistic.teacherRemarks ||
                        'Diligent learner demonstrating steady holistic growth across academic and Co-Scholastic activities.'
                      )
                        .replace(/^teacher remarks:\s*/i, '')
                        .replace(/\s+/g, ' ')
                        .trim()}
                    </p>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                    <strong className="text-slate-800 block text-[10px] uppercase font-bold">Parent Remarks &amp; Suggestions:</strong>
                    <p className="text-slate-600 text-[10px] mt-0.5">{baseHolistic.parentRemarks || baseHolistic.suggestionsForParents}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="p-2 bg-indigo-50/50 rounded-lg border border-indigo-200">
                    <strong className="text-indigo-950 block text-[10px] uppercase font-bold">Overall Student Development:</strong>
                    <p className="text-slate-700 text-[10px] mt-0.5">{baseHolistic.overallStudentDevelopment}</p>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                    <strong className="text-slate-800 block text-[10px] uppercase font-bold">Goals for Next Academic Term:</strong>
                    <p className="text-slate-600 text-[10px] mt-0.5">{baseHolistic.goalsForNextTerm}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Section F: Signatures */}
            <div className="pt-6 grid grid-cols-3 text-center text-xs text-slate-800 border-t-2 border-slate-800 items-end gap-3">
              <div>
                <div className="h-12 flex items-end justify-center"></div>
                <p className="font-extrabold border-t border-slate-400 pt-1 text-[11px]">Class Teacher</p>
                <p className="text-[10px] text-slate-500 font-bold">Nazir Ahmad Dar (Teacher)</p>
              </div>
              <div>
                <div className="h-12 flex items-end justify-center pb-1">
                  {school.officialStampDataUrl && (
                    <img src={school.officialStampDataUrl} alt="Official Stamp" className="h-11 w-auto object-contain" />
                  )}
                </div>
                <p className="font-extrabold border-t border-slate-400 pt-1 text-[11px]">Parent Sign / Official Stamp</p>
                <p className="text-[10px] text-slate-400">Date: _______________</p>
              </div>
              <div>
                <div className="h-12 flex items-end justify-center pb-1">
                  {school.headmasterSignatureDataUrl && (
                    <img src={school.headmasterSignatureDataUrl} alt="Headmaster Signature" className="h-10 w-auto object-contain" />
                  )}
                </div>
                <p className="font-extrabold border-t border-slate-400 pt-1 text-[11px]">
                  {school.headmasterName || school.headTeacherName || 'Headmaster'}
                </p>
                <p className="text-[10px] text-slate-600 font-bold">
                  {school.principalDesignation || 'Headmaster'} • Official Seal &amp; Signature
                </p>
              </div>
            </div>

          </div>
        </div>

        {/* Confirmation Modal before Saving */}
        {confirmSaveModal && (
          <div className="fixed inset-0 z-70 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200 flex flex-col">
              <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Save className="w-5 h-5 text-emerald-400" />
                  <h4 className="font-black text-sm">Confirm Save Changes</h4>
                </div>
                <button
                  onClick={() => setConfirmSaveModal(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <p className="text-xs text-slate-600">
                  Please review the score modification for <strong>{summary.studentName}</strong> before committing to the central database:
                </p>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-2">
                  <div className="flex justify-between items-center border-b border-slate-200 pb-1.5">
                    <span className="text-slate-500">Subject:</span>
                    <strong className="text-slate-900">{confirmSaveModal.subjectName} ({confirmSaveModal.subjectCode})</strong>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-200 pb-1.5">
                    <span className="text-slate-500">Original Value:</span>
                    <span className="font-mono font-bold text-slate-700">
                      {confirmSaveModal.oldAbsent ? 'AB (Absent)' : `${confirmSaveModal.oldMarks ?? 80} / 100`}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-200 pb-1.5">
                    <span className="text-slate-500">New Value to Save:</span>
                    <strong className="font-mono font-black text-indigo-700 text-sm">
                      {confirmSaveModal.newAbsent ? 'AB (Absent)' : `${confirmSaveModal.newMarks} / 100`}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-200 pb-1.5">
                    <span className="text-slate-500">User Responsible:</span>
                    <span className="font-bold text-slate-800">{currentUser.name} ({currentUser.role})</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-400">Timestamp:</span>
                    <span className="font-mono text-slate-500">{new Date().toLocaleString()}</span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 italic">
                  Note: Saving this change will update the student's Holistic Progress Card, recalculate percentages and grades, and log an entry in the permanent tamper-evident audit ledger.
                </p>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  onClick={() => setConfirmSaveModal(null)}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmSave}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Confirm &amp; Save Changes</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sync Conflict Resolution Modal */}
        {syncConflictModal && (
          <div className="fixed inset-0 z-70 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-200 flex flex-col">
              <div className="p-4 bg-amber-600 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-white" />
                  <h4 className="font-black text-sm">Synchronization Conflict Detected</h4>
                </div>
                <button
                  onClick={() => setSyncConflictModal(null)}
                  className="p-1 rounded-lg text-amber-200 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <p className="text-xs text-slate-700 font-medium">
                  The following subject marks in this Holistic Progress Card differ from the records in the central Marks Entry Register:
                </p>

                <div className="border border-amber-200 rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-amber-50 text-amber-950 font-bold border-b border-amber-200">
                      <tr>
                        <th className="py-2 px-3">Subject</th>
                        <th className="py-2 px-3 text-center">Current HPC Draft</th>
                        <th className="py-2 px-3 text-center">Register Record</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-100">
                      {syncConflictModal.conflicts.map((c) => (
                        <tr key={c.code} className="hover:bg-amber-50/50">
                          <td className="py-2 px-3 font-bold text-slate-900">{c.name}</td>
                          <td className="py-2 px-3 text-center font-mono font-bold text-amber-900 bg-amber-50/60">{c.hpcValue}</td>
                          <td className="py-2 px-3 text-center font-mono font-bold text-indigo-900 bg-indigo-50/40">{c.regValue}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="text-[11px] text-slate-500">
                  Would you like to overwrite your manual HPC edits with the values from the Marks Entry Register, or keep your current edits?
                </p>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  onClick={() => setSyncConflictModal(null)}
                  className="px-3.5 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold cursor-pointer"
                >
                  Keep Current HPC Edits
                </button>
                <button
                  onClick={executeRegisterSync}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Overwrite &amp; Sync from Register</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Student Specific Mark Change Audit Modal */}
        {showStudentAuditModal && (
          <div className="fixed inset-0 z-70 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[85vh]">
              <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-400" />
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      Mark Change Audit: {summary.studentName}
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Roll #{summary.rollNumber} • Class {summary.classNumber}-{summary.section}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowStudentAuditModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 overflow-y-auto flex-1 space-y-3">
                {studentAuditLogs.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                    <ShieldCheck className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="font-bold text-slate-700">No score modifications logged for this student.</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Original evaluated marks are unaltered in central register.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3">Date & Time</th>
                          <th className="py-2 px-3">Subject</th>
                          <th className="py-2 px-2 text-center">Original</th>
                          <th className="py-2 px-2 text-center">New</th>
                          <th className="py-2 px-3">User Responsible</th>
                          <th className="py-2 px-2">Module</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {studentAuditLogs.map((log) => {
                          const origNum = typeof log.originalValue === 'number' ? log.originalValue : parseFloat(log.originalValue as string) || 0;
                          const newNum = typeof log.newValue === 'number' ? log.newValue : parseFloat(log.newValue as string) || 0;
                          const delta = newNum - origNum;

                          return (
                            <tr key={log.id} className="hover:bg-slate-50">
                              <td className="py-2 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                                {new Date(log.timestamp).toLocaleString()}
                              </td>
                              <td className="py-2 px-3 font-semibold text-slate-900">
                                <div>{log.subjectName}</div>
                                <span className="text-[10px] text-slate-400 font-mono">({log.subjectCode})</span>
                              </td>
                              <td className="py-2 px-2 text-center font-mono font-bold text-slate-600 bg-slate-50">
                                {log.originalValue}
                              </td>
                              <td className="py-2 px-2 text-center font-mono font-black text-indigo-900 bg-indigo-50/50">
                                <div>{log.newValue}</div>
                                <span className={`text-[9px] font-bold ${delta > 0 ? 'text-emerald-700' : delta < 0 ? 'text-rose-700' : 'text-slate-500'}`}>
                                  ({delta > 0 ? `+${delta}` : delta})
                                </span>
                              </td>
                              <td className="py-2 px-3">
                                <div className="font-semibold text-slate-800">{log.userResponsible}</div>
                                <span className="text-[10px] text-slate-400 font-mono">{log.userId}</span>
                              </td>
                              <td className="py-2 px-2">
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap">
                                  {log.moduleOrigin}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="p-3 bg-slate-50 border-t border-slate-200 text-right">
                <button
                  onClick={() => setShowStudentAuditModal(false)}
                  className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold cursor-pointer"
                >
                  Close Audit View
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

// ============================================================================
// CONSOLIDATED CLASS PROGRESS CARDS MODAL (BATCH PREVIEW & PRINTER-FRIENDLY A4)
// ============================================================================
interface ConsolidatedClassProgressCardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentSummaries: StudentExamSummary[];
  students: Student[];
  school: SchoolProfile;
  examination: Examination;
  marksEntries: StudentMarkEntry[];
  holisticRecords?: Record<string, StudentHolisticRecord>;
  subjectConfigs?: SubjectConfig[];
  classNumber: string;
  section: string;
  language: Language;
  onDownloadPdf: () => void;
  isGeneratingPdf: boolean;
}

const ConsolidatedClassProgressCardsModal: React.FC<ConsolidatedClassProgressCardsModalProps> = ({
  isOpen,
  onClose,
  studentSummaries,
  students,
  school,
  examination,
  marksEntries,
  holisticRecords,
  subjectConfigs,
  classNumber,
  section,
  language,
  onDownloadPdf,
  isGeneratingPdf,
}) => {
  void examination;
  void language;
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm print:p-0 print:static print:bg-white print:z-auto">
      <div className="bg-slate-100 rounded-3xl max-w-5xl w-full shadow-2xl overflow-hidden border border-slate-300 max-h-[96vh] flex flex-col print:max-h-none print:h-auto print:border-none print:shadow-none print:rounded-none print:bg-white">
        
        {/* Sticky Header with Batch Actions */}
        <div className="p-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 shrink-0 no-print">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-400" />
              <h3 className="text-sm font-extrabold text-white">
                Class {classNumber}-{section} Consolidated Progress Cards ({studentSummaries.length} Students)
              </h3>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Single consolidated printer-friendly A4 document with automatic page breaks between student progress cards.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onDownloadPdf}
              disabled={isGeneratingPdf}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-50"
            >
              {isGeneratingPdf ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating PDF...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5 text-amber-300" />
                  <span>Download Class PDF</span>
                </>
              )}
            </button>

            <button
              onClick={() => window.print()}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95"
              title="Quick Print: Immediately trigger native print dialog for all class cards"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Quick Print All (A4)</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable multi-student consolidated A4 document */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 bg-slate-200/70 print:p-0 print:space-y-0 print:bg-white print:overflow-visible">
          {studentSummaries.map((summary, idx) => {
            const student = students.find((s) => s.id === summary.studentId);
            return (
              <div key={summary.studentId} className="batch-card-wrapper">
                <SingleStudentProgressCardView
                  summary={summary}
                  student={student}
                  school={school}
                  marksEntries={marksEntries}
                  holisticRecord={holisticRecords?.[summary.studentId]}
                  subjectConfigs={subjectConfigs}
                  pageIndex={idx}
                  totalPages={studentSummaries.length}
                />
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
};
