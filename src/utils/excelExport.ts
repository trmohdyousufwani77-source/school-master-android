import * as XLSX from 'xlsx';
import {
  AttendanceRecord,
  Examination,
  SchoolProfile,
  Student,
  StudentExamSummary,
  StudentMarkEntry,
  TeacherLeaveApplication,
  TeacherPerformanceReport,
  TeacherProfile,
  TextbookDistributionRecord,
} from '../types';

function triggerDownload(wb: XLSX.WorkBook, fileName: string) {
  XLSX.writeFile(wb, fileName);
}

/**
 * Export Complete Student Register
 */
export function exportStudentRegisterToExcel(students: Student[], school: SchoolProfile, classFilter?: string) {
  const filtered = classFilter && classFilter !== 'all' 
    ? students.filter(s => s.classNumber === classFilter)
    : students;

  const titleRow = [`${school.name} - ${school.nameHi}`];
  const subTitle = [`STUDENT ADMISSION REGISTER (U-DISE: ${school.code}) - Academic Session: ${school.academicSession}`];
  const blankRow: string[] = [];

  const headers = [
    'Student ID',
    'Admission No (SRN)',
    'Roll No',
    'Class',
    'Section',
    'Full Name',
    'Gender',
    'Date of Birth',
    "Father's Name",
    "Mother's Name",
    'Mobile Number',
    'Village / Town',
    'Block / Tehsil',
    'District',
    'State',
    'PIN Code',
    'Admission Date',
    'Status',
    'Aadhaar Status',
    'Aadhaar Ref / Masked',
  ];

  const dataRows = filtered.map(s => [
    s.id,
    s.admissionNumber,
    s.rollNumber,
    s.classNumber,
    s.section,
    s.fullName,
    s.gender,
    s.dob,
    s.fatherName,
    s.motherName,
    s.mobileNumber,
    s.villageTown,
    s.blockTehsil,
    s.district,
    s.state,
    s.pinCode,
    s.admissionDate,
    s.status,
    s.aadhaarStatus,
    s.maskedAadhaar || s.alternativeIdType || 'N/A',
  ]);

  const ws = XLSX.utils.aoa_to_sheet([titleRow, subTitle, blankRow, headers, ...dataRows]);

  // Adjust column widths
  ws['!cols'] = [
    { wch: 14 }, { wch: 18 }, { wch: 8 }, { wch: 8 }, { wch: 8 },
    { wch: 22 }, { wch: 10 }, { wch: 12 }, { wch: 20 }, { wch: 20 },
    { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
    { wch: 10 }, { wch: 14 }, { wch: 10 }, { wch: 16 }, { wch: 22 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Student_Register');
  triggerDownload(wb, `Student_Register_${school.code}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Export Monthly Attendance Register Matrix
 */
export function exportMonthlyAttendanceToExcel(
  students: Student[],
  records: AttendanceRecord[],
  school: SchoolProfile,
  classNumber: string,
  section: string,
  monthName: string,
  year: number,
  daysList: { dateStr: string; dayOfMonth: number; isHoliday: boolean; holidayName?: string }[],
  workingDaysTotal: number
) {
  const classStudents = students.filter(s => s.classNumber === classNumber && s.section === section);

  const titleRow = [`${school.name} - MONTHLY ATTENDANCE REGISTER`];
  const subRow = [`Class: ${classNumber}-${section} | Month: ${monthName} ${year} | Total Working Days: ${workingDaysTotal}`];
  const blankRow: string[] = [];

  const headers = [
    'Roll No',
    'Student ID',
    'Student Name',
    "Father's Name",
    ...daysList.map(d => `${d.dayOfMonth}`),
    'Working Days',
    'Present',
    'Absent',
    'Leave',
    'Attendance %',
  ];

  const dataRows = classStudents.map(student => {
    let presentCount = 0;
    let absentCount = 0;
    let leaveCount = 0;

    const dayCols = daysList.map(d => {
      if (d.isHoliday) {
        return 'H'; // Holiday
      }
      const rec = records.find(r => r.studentId === student.id && r.date === d.dateStr);
      if (!rec) return '-';
      if (rec.status === 'Present') {
        presentCount++;
        return 'P';
      }
      if (rec.status === 'Late') {
        presentCount++;
        return 'L';
      }
      if (rec.status === 'Absent') {
        absentCount++;
        return 'A';
      }
      if (rec.status === 'Approved_Leave') {
        leaveCount++;
        return 'AL';
      }
      return '-';
    });

    const percentage = workingDaysTotal > 0 ? ((presentCount / workingDaysTotal) * 100).toFixed(2) + '%' : '0.00%';

    return [
      student.rollNumber,
      student.id,
      student.fullName,
      student.fatherName,
      ...dayCols,
      workingDaysTotal,
      presentCount,
      absentCount,
      leaveCount,
      percentage,
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([titleRow, subRow, blankRow, headers, ...dataRows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `Attendance_Class_${classNumber}_${section}`);
  triggerDownload(wb, `Monthly_Attendance_Class_${classNumber}_${section}_${monthName}_${year}.xlsx`);
}

/**
 * Export Teacher Leave Statement
 */
export function exportTeacherLeaveStatementToExcel(
  leaves: TeacherLeaveApplication[],
  teachers: TeacherProfile[],
  school: SchoolProfile
) {
  const titleRow = [`${school.name} - TEACHER LEAVE STATEMENT`];
  const subRow = [`Academic Session: ${school.academicSession} | Generated: ${new Date().toLocaleDateString()}`];
  const blankRow: string[] = [];

  const headers = [
    'Application ID',
    'Employee ID',
    'Teacher Name',
    'Designation',
    'Leave Type',
    'Application Date',
    'Start Date',
    'End Date',
    'Total Days',
    'Reason',
    'Status',
    'Approved / Rejected By',
    'Approval Date',
    'Remarks',
  ];

  const dataRows = leaves.map(l => {
    const t = teachers.find(teacher => teacher.employeeId === l.employeeId);
    return [
      l.id,
      l.employeeId,
      l.teacherName,
      t ? t.designation : 'Teacher',
      l.leaveType.replace('_', ' '),
      l.applicationDate,
      l.startDate,
      l.endDate,
      l.totalDays,
      l.reason,
      l.status,
      l.approvedBy || '-',
      l.approvalDate || '-',
      l.remarks || '-',
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([titleRow, subRow, blankRow, headers, ...dataRows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Teacher_Leave_Statement');
  triggerDownload(wb, `Teacher_Leave_Statement_${school.code}.xlsx`);
}

/**
 * Export Examination Marks Register
 */
export function exportExaminationMarksToExcel(
  summaries: StudentExamSummary[],
  exam: Examination,
  school: SchoolProfile,
  classNumber: string,
  section: string
) {
  const titleRow = [`${school.name} - EXAMINATION RESULT REGISTER`];
  const subRow = [`Exam: ${exam.name} | Class: ${classNumber}-${section} | Session: ${school.academicSession}`];
  const blankRow: string[] = [];

  const subjects = exam.subjects[classNumber] || [];
  const subjectHeaders: string[] = [];
  subjects.forEach(s => {
    subjectHeaders.push(`${s.name} (Max ${s.maxMarks})`);
  });

  const headers = [
    'Roll No',
    'Student ID',
    'Student Name',
    ...subjectHeaders,
    'Total Max Marks',
    'Marks Obtained',
    'Percentage (%)',
    'Grade',
    'Result Status',
  ];

  const dataRows = summaries.map(s => {
    const subScores = subjects.map(sub => {
      const found = s.subjectMarks.find(sm => sm.subjectCode === sub.code);
      if (!found) return '-';
      if (found.isAbsent) return 'AB';
      return found.marksObtained ?? '-';
    });

    return [
      s.rollNumber,
      s.studentId,
      s.studentName,
      ...subScores,
      s.totalMaxMarks,
      s.totalMarksObtained,
      `${s.percentage.toFixed(2)}%`,
      s.overallGrade,
      s.isPassed ? 'PASSED' : 'NEEDS IMPROVEMENT',
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([titleRow, subRow, blankRow, headers, ...dataRows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Marks_Register');
  triggerDownload(wb, `Exam_Marks_${exam.name.replace(/\s+/g, '_')}_Class_${classNumber}_${section}.xlsx`);
}

/**
 * Export Subject-Wise Teacher Performance
 */
export function exportTeacherPerformanceToExcel(
  reports: TeacherPerformanceReport[],
  school: SchoolProfile,
  examName: string
) {
  const titleRow = [`${school.name} - ACADEMIC SUBJECT-WISE TEACHER PERFORMANCE`];
  const subRow = [`Exam: ${examName} | Academic Session: ${school.academicSession}`];
  const blankRow: string[] = [];

  const headers = [
    'Teacher Name',
    'Employee ID',
    'Subject',
    'Class',
    'Section',
    'Enrolled',
    'Assessed',
    'Passed',
    'Failed',
    'Pass %',
    'Subject Avg Marks',
    'Subject Avg %',
    'Highest Mark',
    'Lowest Mark',
    'A1 Count',
    'A2 Count',
    'B1 Count',
    'B2 Count',
    'C1/C2 Count',
    'D/E Count',
  ];

  const dataRows = reports.map(r => [
    r.teacherName,
    r.employeeId,
    r.subjectName,
    r.classNumber,
    r.section,
    r.enrolledStudents,
    r.assessedStudents,
    r.passedStudents,
    r.failedStudents,
    `${r.passPercentage}%`,
    r.averageMarks,
    `${r.averagePercentage}%`,
    r.highestMarks,
    r.lowestMarks,
    r.gradeDistribution['A1'] || 0,
    r.gradeDistribution['A2'] || 0,
    r.gradeDistribution['B1'] || 0,
    r.gradeDistribution['B2'] || 0,
    (r.gradeDistribution['C1'] || 0) + (r.gradeDistribution['C2'] || 0),
    (r.gradeDistribution['D'] || 0) + (r.gradeDistribution['E'] || 0),
  ]);

  const ws = XLSX.utils.aoa_to_sheet([titleRow, subRow, blankRow, headers, ...dataRows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Teacher_Performance');
  triggerDownload(wb, `Teacher_Performance_${examName.replace(/\s+/g, '_')}.xlsx`);
}

/**
 * Download sample Excel Template for importing students
 */
export function downloadStudentImportTemplate() {
  const headers = [
    'Admission_Number',
    'Full_Name',
    'Gender',
    'Date_of_Birth_YYYY_MM_DD',
    'Class',
    'Section',
    'Roll_Number',
    'Father_Name',
    'Mother_Name',
    'Parent_Mobile',
    'Village_Town',
    'District',
    'State',
    'PIN_Code',
  ];

  const sampleRows = [
    ['SRN-2026-601', 'Rahul Verma', 'Male', '2014-06-15', '6', 'A', 3, 'Gopal Verma', 'Sushila Verma', '+91 9876543210', 'Rampur', 'Bareilly', 'Uttar Pradesh', '243001'],
    ['SRN-2026-602', 'Simran Kaur', 'Female', '2014-08-20', '6', 'A', 4, 'Gurvinder Singh', 'Jaspreet Kaur', '+91 9812345678', 'Rampur', 'Bareilly', 'Uttar Pradesh', '243001'],
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Import_Template');
  triggerDownload(wb, 'SchoolMaster_Student_Import_Template.xlsx');
}

/**
 * Export Textbook Distribution Register
 */
export function exportTextbookDistributionToExcel(
  records: TextbookDistributionRecord[],
  school: SchoolProfile,
  classFilter?: string
) {
  const filtered = classFilter && classFilter !== 'all'
    ? records.filter(r => r.classNumber === classFilter)
    : records;

  const titleRow = [`${school.name} - TEXTBOOK DISTRIBUTION REGISTER (RTE FREE SCHEME)`];
  const subRow = [`Academic Session: ${school.academicSession} | U-DISE Code: ${school.code} | Generated: ${new Date().toLocaleDateString()}`];
  const blankRow: string[] = [];

  const headers = [
    'Record ID',
    'Student ID',
    'Student Name',
    'Class',
    'Section',
    'Subject',
    'Textbook Name',
    'Edition / Year',
    'Required Qty',
    'Received Qty',
    'Status',
    'Issue Date',
    'Responsible Teacher',
    'Remarks',
  ];

  const dataRows = filtered.map(r => [
    r.id,
    r.studentId,
    r.studentName,
    r.classNumber,
    r.section,
    r.subject,
    r.textbookName,
    r.prescribedEdition,
    r.quantityRequired,
    r.quantityReceived,
    r.status.replace(/_/g, ' '),
    r.distributionDate,
    r.responsibleTeacherName,
    r.remarks || '-',
  ]);

  const ws = XLSX.utils.aoa_to_sheet([titleRow, subRow, blankRow, headers, ...dataRows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Textbook_Register');
  triggerDownload(wb, `Textbook_Distribution_${school.code}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function escapeCsvCell(value: string | number): string {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Export Monthly Attendance Percentage Statistics for the selected class as CSV
 */
export function exportAttendanceStatisticsCsv(options: {
  students: Student[];
  records: AttendanceRecord[];
  school: SchoolProfile;
  classNumber: string;
  section: string;
  monthName: string;
  year: number;
  daysList: { dateStr: string; dayOfMonth: number; isHoliday: boolean }[];
  workingDaysTotal: number;
}) {
  const {
    students,
    records,
    school,
    classNumber,
    section,
    monthName,
    year,
    daysList,
    workingDaysTotal,
  } = options;

  const classStudents = students
    .filter((s) => s.classNumber === classNumber && s.section === section && s.status === 'Active')
    .sort((a, b) => a.rollNumber - b.rollNumber);

  const workingDateSet = new Set(daysList.filter((d) => !d.isHoliday).map((d) => d.dateStr));
  const recordByStudentDate = new Map<string, AttendanceRecord>();
  records.forEach((r) => {
    if (workingDateSet.has(r.date)) {
      recordByStudentDate.set(`${r.studentId}::${r.date}`, r);
    }
  });

  const headers = [
    'Roll Number',
    'Admission Number',
    'Student Name',
    "Father's Name",
    'Class',
    'Section',
    'Month',
    'Scheduled Working Days',
    'Present Days',
    'Late Days',
    'Absent Days',
    'Approved Leave Days',
    'Attendance Percentage (%)',
    'Compliance Status',
  ];

  let totalPresentAll = 0;

  const rows = classStudents.map((st) => {
    let present = 0;
    let late = 0;
    let absent = 0;
    let leave = 0;

    daysList.forEach((d) => {
      if (d.isHoliday) return;
      const rec = recordByStudentDate.get(`${st.id}::${d.dateStr}`);
      if (!rec) return;
      if (rec.status === 'Present') present += 1;
      else if (rec.status === 'Late') late += 1;
      else if (rec.status === 'Absent') absent += 1;
      else if (rec.status === 'Approved_Leave') leave += 1;
    });

    const effectivePresent = present + late;
    totalPresentAll += effectivePresent;
    const pct = workingDaysTotal > 0 ? Math.min(100, Math.round((effectivePresent / workingDaysTotal) * 10000) / 100) : 0;
    const statusLabel = pct < 75 ? 'Below 75% Threshold' : 'Satisfactory (>=75%)';

    return [
      st.rollNumber,
      st.admissionNumber,
      st.fullName,
      st.fatherName,
      classNumber,
      section,
      `${monthName} ${year}`,
      workingDaysTotal,
      present,
      late,
      absent,
      leave,
      pct.toFixed(2),
      statusLabel,
    ];
  });

  const maxPossibleAll = classStudents.length * workingDaysTotal;
  const classPct = maxPossibleAll > 0 ? Math.min(100, Math.round((totalPresentAll / maxPossibleAll) * 10000) / 100) : 0;

  const summaryRow = [
    'TOTAL',
    `${classStudents.length} Students`,
    `Class ${classNumber}-${section} Monthly Summary`,
    school.name,
    classNumber,
    section,
    `${monthName} ${year}`,
    workingDaysTotal,
    totalPresentAll,
    '',
    '',
    '',
    classPct.toFixed(2),
    classPct < 75 ? 'Class Below 75%' : 'Class Satisfactory',
  ];

  const csvContent = [headers, ...rows, summaryRow]
    .map((row) => row.map((cell) => escapeCsvCell(cell)).join(','))
    .join('\r\n');

  const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Attendance_Statistics_Class_${classNumber}${section}_${monthName}_${year}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export interface BatchMonthlyAttendanceExportOptions {
  students: Student[];
  records: AttendanceRecord[];
  school: SchoolProfile;
  classNumber: string;
  sectionScope: 'all' | string; // 'all' exports all sections in the class together
  monthName: string;
  year: number;
  daysList: { dateStr: string; dayOfMonth: number; isHoliday: boolean; holidayName?: string }[];
  workingDaysTotal: number;
}

function getBatchClassStudents(
  students: Student[],
  classNumber: string,
  sectionScope: 'all' | string
): Student[] {
  return students
    .filter(
      (s) =>
        s.status === 'Active' &&
        s.classNumber === classNumber &&
        (sectionScope === 'all' || s.section === sectionScope)
    )
    .sort((a, b) => {
      const secCmp = (a.section || '').localeCompare(b.section || '');
      if (secCmp !== 0) return secCmp;
      return a.rollNumber - b.rollNumber;
    });
}

/**
 * Batch Export: Generates a single consolidated CSV containing full monthly attendance matrix
 * & metrics for an entire class (all sections or selected section) at once.
 */
export function exportBatchMonthlyClassCsv(options: BatchMonthlyAttendanceExportOptions): {
  filename: string;
  studentCount: number;
} {
  const {
    students,
    records,
    school,
    classNumber,
    sectionScope,
    monthName,
    year,
    daysList,
    workingDaysTotal,
  } = options;

  const classStudents = getBatchClassStudents(students, classNumber, sectionScope);
  const recordByStudentDate = new Map<string, AttendanceRecord>();
  records.forEach((r) => {
    recordByStudentDate.set(`${r.studentId}::${r.date}`, r);
  });

  const scopeLabel = sectionScope === 'all' ? 'All Sections' : `Section ${sectionScope}`;
  const titleRow = [`${school.name} - BATCH MONTHLY ATTENDANCE REPORT`];
  const metaRow = [
    `Class ${classNumber} (${scopeLabel})`,
    `Month: ${monthName} ${year}`,
    `Working Days: ${workingDaysTotal}`,
    `Total Students: ${classStudents.length}`,
    `U-DISE: ${school.code}`,
  ];
  const blankRow: string[] = [];

  const headers = [
    'Section',
    'Roll No',
    'Admission No',
    'Student Name',
    "Father's Name",
    ...daysList.map((d) => `${String(d.dayOfMonth).padStart(2, '0')}`),
    'Working Days',
    'Present',
    'Late',
    'Absent',
    'Approved Leave',
    'Attendance %',
    'Threshold Status',
  ];

  let totalPresentAll = 0;
  let totalAbsentAll = 0;
  let totalLeaveAll = 0;

  const dataRows = classStudents.map((st) => {
    let present = 0;
    let late = 0;
    let absent = 0;
    let leave = 0;

    const dayCells = daysList.map((d) => {
      if (d.isHoliday) return 'H';
      const rec = recordByStudentDate.get(`${st.id}::${d.dateStr}`);
      if (!rec) return '-';
      if (rec.status === 'Present') {
        present += 1;
        return 'P';
      }
      if (rec.status === 'Late') {
        late += 1;
        return 'L';
      }
      if (rec.status === 'Absent') {
        absent += 1;
        return 'A';
      }
      if (rec.status === 'Approved_Leave') {
        leave += 1;
        return 'AL';
      }
      return '-';
    });

    const effectivePresent = present + late;
    totalPresentAll += effectivePresent;
    totalAbsentAll += absent;
    totalLeaveAll += leave;

    const pct =
      workingDaysTotal > 0
        ? Math.min(100, Math.round((effectivePresent / workingDaysTotal) * 10000) / 100)
        : 0;

    return [
      st.section,
      st.rollNumber,
      st.admissionNumber,
      st.fullName,
      st.fatherName,
      ...dayCells,
      workingDaysTotal,
      present,
      late,
      absent,
      leave,
      `${pct.toFixed(2)}%`,
      pct < 75 ? 'Below 75%' : 'Satisfactory',
    ];
  });

  const maxPossible = classStudents.length * workingDaysTotal;
  const classPct =
    maxPossible > 0 ? Math.min(100, Math.round((totalPresentAll / maxPossible) * 10000) / 100) : 0;

  const totalRow = [
    scopeLabel,
    'TOTAL',
    `${classStudents.length} Students`,
    `Class ${classNumber} Summary`,
    school.name,
    ...daysList.map(() => ''),
    workingDaysTotal,
    totalPresentAll,
    '',
    totalAbsentAll,
    totalLeaveAll,
    `${classPct.toFixed(2)}%`,
    classPct < 75 ? 'Class Below 75%' : 'Class Satisfactory',
  ];

  const csvContent = [titleRow, metaRow, blankRow, headers, ...dataRows, totalRow]
    .map((row) => row.map((cell) => escapeCsvCell(cell)).join(','))
    .join('\r\n');

  const fileSuffix = sectionScope === 'all' ? 'AllSections' : `Sec${sectionScope}`;
  const filename = `Batch_Monthly_Attendance_Class_${classNumber}_${fileSuffix}_${monthName}_${year}.csv`;

  const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return { filename, studentCount: classStudents.length };
}

/**
 * Batch Export: Generates a single consolidated multi-page Landscape A4 PDF containing
 * full monthly attendance registers for an entire class at once.
 */
export async function exportBatchMonthlyClassPdf(
  options: BatchMonthlyAttendanceExportOptions
): Promise<{ filename: string; studentCount: number }> {
  const { jsPDF } = await import('jspdf');
  const {
    students,
    records,
    school,
    classNumber,
    sectionScope,
    monthName,
    year,
    daysList,
    workingDaysTotal,
  } = options;

  const classStudents = getBatchClassStudents(students, classNumber, sectionScope);
  const recordByStudentDate = new Map<string, AttendanceRecord>();
  records.forEach((r) => {
    recordByStudentDate.set(`${r.studentId}::${r.date}`, r);
  });

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = 297;
  const pageHeight = 210;
  const marginX = 10;

  const scopeLabel = sectionScope === 'all' ? 'All Sections' : `Section ${sectionScope}`;
  const dayCount = daysList.length;
  const fixedLeftW = 58; // Sec/Roll + Student Name
  const fixedRightW = 42; // W + P + A + AL + %
  const gridWidth = pageWidth - marginX * 2 - fixedLeftW - fixedRightW;
  const dayColW = Math.max(4.5, gridWidth / Math.max(1, dayCount));

  const drawHeader = (pageNum: number) => {
    doc.setFillColor(15, 23, 42);
    doc.rect(marginX, 8, pageWidth - marginX * 2, 16, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`${school.name} — Batch Monthly Attendance Register`, marginX + 4, 14.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(
      `Class ${classNumber} (${scopeLabel})  |  ${monthName} ${year}  |  Working Days: ${workingDaysTotal}  |  Students: ${classStudents.length}  |  U-DISE: ${school.code}`,
      marginX + 4,
      20.5
    );
    doc.text(`Page ${pageNum}`, pageWidth - marginX - 18, 14.5);

    // Table header row
    const headerY = 27;
    doc.setFillColor(241, 245, 249);
    doc.rect(marginX, headerY, pageWidth - marginX * 2, 7, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.rect(marginX, headerY, pageWidth - marginX * 2, 7, 'S');

    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text('Sec/Roll', marginX + 2, headerY + 4.7);
    doc.text('Student Name', marginX + 16, headerY + 4.7);

    let xCursor = marginX + fixedLeftW;
    daysList.forEach((d) => {
      if (d.isHoliday) {
        doc.setTextColor(148, 163, 184);
      } else {
        doc.setTextColor(51, 65, 85);
      }
      doc.text(String(d.dayOfMonth), xCursor + dayColW / 2, headerY + 4.7, { align: 'center' });
      xCursor += dayColW;
    });

    doc.setTextColor(15, 23, 42);
    const rightStart = marginX + fixedLeftW + dayCount * dayColW;
    doc.text('W', rightStart + 4, headerY + 4.7, { align: 'center' });
    doc.text('P', rightStart + 12, headerY + 4.7, { align: 'center' });
    doc.text('A', rightStart + 20, headerY + 4.7, { align: 'center' });
    doc.text('AL', rightStart + 28, headerY + 4.7, { align: 'center' });
    doc.text('%', rightStart + 37, headerY + 4.7, { align: 'center' });
  };

  let pageNum = 1;
  drawHeader(pageNum);

  let yCursor = 34;
  const rowHeight = 6.2;

  if (classStudents.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('No active students enrolled for the selected class scope.', marginX + 4, 44);
  } else {
    classStudents.forEach((st, idx) => {
      if (yCursor + rowHeight > pageHeight - 16) {
        doc.addPage();
        pageNum += 1;
        drawHeader(pageNum);
        yCursor = 34;
      }

      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(marginX, yCursor, pageWidth - marginX * 2, rowHeight, 'F');
      }
      doc.setDrawColor(226, 232, 240);
      doc.line(marginX, yCursor + rowHeight, pageWidth - marginX, yCursor + rowHeight);

      let present = 0;
      let absent = 0;
      let leave = 0;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      doc.setTextColor(30, 41, 59);
      doc.text(`${st.section}-${st.rollNumber}`, marginX + 2, yCursor + 4.3);

      doc.setFont('helvetica', 'normal');
      doc.text((st.fullName || '').slice(0, 22), marginX + 16, yCursor + 4.3);

      let xCursor = marginX + fixedLeftW;
      daysList.forEach((d) => {
        let code = '-';
        if (d.isHoliday) {
          code = 'H';
          doc.setTextColor(148, 163, 184);
        } else {
          const rec = recordByStudentDate.get(`${st.id}::${d.dateStr}`);
          if (rec?.status === 'Present') {
            present += 1;
            code = 'P';
            doc.setTextColor(5, 150, 105);
          } else if (rec?.status === 'Late') {
            present += 1;
            code = 'L';
            doc.setTextColor(217, 119, 6);
          } else if (rec?.status === 'Absent') {
            absent += 1;
            code = 'A';
            doc.setTextColor(225, 29, 72);
          } else if (rec?.status === 'Approved_Leave') {
            leave += 1;
            code = 'AL';
            doc.setTextColor(37, 99, 235);
          } else {
            doc.setTextColor(203, 213, 225);
          }
        }
        doc.text(code, xCursor + dayColW / 2, yCursor + 4.3, { align: 'center' });
        xCursor += dayColW;
      });

      const pct =
        workingDaysTotal > 0 ? Math.min(100, Math.round((present / workingDaysTotal) * 1000) / 10) : 0;

      const rightStart = marginX + fixedLeftW + dayCount * dayColW;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(51, 65, 85);
      doc.text(String(workingDaysTotal), rightStart + 4, yCursor + 4.3, { align: 'center' });
      doc.setTextColor(5, 150, 105);
      doc.text(String(present), rightStart + 12, yCursor + 4.3, { align: 'center' });
      doc.setTextColor(225, 29, 72);
      doc.text(String(absent), rightStart + 20, yCursor + 4.3, { align: 'center' });
      doc.setTextColor(37, 99, 235);
      doc.text(String(leave), rightStart + 28, yCursor + 4.3, { align: 'center' });
      doc.setTextColor(pct < 75 ? 225 : 30, pct < 75 ? 29 : 41, pct < 75 ? 72 : 59);
      doc.text(`${pct.toFixed(1)}%`, rightStart + 37, yCursor + 4.3, { align: 'center' });

      yCursor += rowHeight;
    });
  }

  // Footer Legend
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Legend: P = Present, L = Late, A = Absent, AL = Approved Leave, H = Holiday  |  Generated via School Master Batch Export',
    marginX,
    pageHeight - 7
  );

  const fileSuffix = sectionScope === 'all' ? 'AllSections' : `Sec${sectionScope}`;
  const filename = `Batch_Monthly_Attendance_Class_${classNumber}_${fileSuffix}_${monthName}_${year}.pdf`;
  doc.save(filename);

  return { filename, studentCount: classStudents.length };
}

