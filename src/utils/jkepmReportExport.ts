import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import {
  CpisCodeMigrationRecord,
  JkepmAttendanceLeaveSummary,
  JkepmAuditLogEntry,
  JkepmQuarterlyAppraisalReport,
  JkepmQuarter,
  SchoolProfile,
  TeacherProfile,
} from '../types';
import { formatSchoolAddressOnce } from './calculations';

export const OLD_CPIS_CODE_LEGACY = 'JK-EDU-1985-0451';
export const NEW_CPIS_CODE_OFFICIAL = 'KHYEDU 00220000';

export const JKEPM_QUARTERS: JkepmQuarter[] = [
  'Q1 (Apr - Jun)',
  'Q2 (Jul - Sep)',
  'Q3 (Oct - Dec)',
  'Q4 (Jan - Mar)',
];

export const QUARTER_REPORTING_PERIODS: Record<JkepmQuarter, string> = {
  'Q1 (Apr - Jun)': '01 April 2026 to 30 June 2026',
  'Q2 (Jul - Sep)': '01 July 2026 to 30 September 2026',
  'Q3 (Oct - Dec)': '01 October 2026 to 31 December 2026',
  'Q4 (Jan - Mar)': '01 January 2027 to 31 March 2027',
};

export function normalizeCpisCode(code: string): string {
  return String(code || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

export function recalculateAttendanceLeaveSummary(
  summary: JkepmAttendanceLeaveSummary
): JkepmAttendanceLeaveSummary {
  const working = Math.max(0, Math.round(Number(summary.totalWorkingDays) || 0));
  const attended = Math.max(0, Math.round(Number(summary.totalDaysAttended) || 0));

  // If itemized leave records exist, keep their totals synced when higher or directly editable
  const cl = Math.max(0, Math.round(Number(summary.casualLeaves) || 0));
  const ml = Math.max(0, Math.round(Number(summary.medicalLeaves) || 0));
  const el = Math.max(0, Math.round(Number(summary.earnedLeaves) || 0));
  const other = Math.max(0, Math.round(Number(summary.otherLeaves) || 0));

  const totalLeaveDays = cl + ml + el + other;
  const attendancePercentage =
    working > 0 ? Math.min(100, Math.round((attended / working) * 1000) / 10) : 0;

  return {
    ...summary,
    totalWorkingDays: working,
    totalDaysAttended: attended,
    casualLeaves: cl,
    medicalLeaves: ml,
    earnedLeaves: el,
    otherLeaves: other,
    totalLeaveDays,
    attendancePercentage,
  };
}

export function validateJkepmAttendanceAndLeave(
  summary: JkepmAttendanceLeaveSummary
): string[] {
  const errors: string[] = [];
  const calc = recalculateAttendanceLeaveSummary(summary);

  if (calc.totalWorkingDays <= 0) {
    errors.push('Total Number of Working Days must be greater than 0.');
  }
  if (calc.totalDaysAttended > calc.totalWorkingDays) {
    errors.push(
      `Total Days Attended (${calc.totalDaysAttended}) cannot exceed Total Working Days (${calc.totalWorkingDays}).`
    );
  }
  if (calc.totalDaysAttended + calc.totalLeaveDays > calc.totalWorkingDays) {
    errors.push(
      `Days Attended (${calc.totalDaysAttended}) + Total Leave Days (${calc.totalLeaveDays}) = ${
        calc.totalDaysAttended + calc.totalLeaveDays
      }, which exceeds Total Working Days (${calc.totalWorkingDays}).`
    );
  }
  if (calc.medicalLeaves > 0 && !calc.medicalSanctionOrderNumber.trim()) {
    errors.push('Medical Leave Sanction Order Number is required when Medical Leaves > 0.');
  }
  if (calc.medicalLeaves > 0 && !calc.medicalSanctionOrderDate.trim()) {
    errors.push('Medical Leave Sanction Order Date is required when Medical Leaves > 0.');
  }
  if (calc.leavePeriodFrom && calc.leavePeriodTo && calc.leavePeriodFrom > calc.leavePeriodTo) {
    errors.push('Leave Period "From" date cannot be later than Leave Period "To" date.');
  }
  return errors;
}

export function buildInitialCpisMigrations(
  teachers: TeacherProfile[],
  school: SchoolProfile
): CpisCodeMigrationRecord[] {
  const nazir =
    teachers.find(
      (t) =>
        t.id === 'tch-2' ||
        normalizeCpisCode(t.employeeId) === normalizeCpisCode(NEW_CPIS_CODE_OFFICIAL) ||
        normalizeCpisCode(t.employeeId) === normalizeCpisCode(OLD_CPIS_CODE_LEGACY)
    ) || teachers[1] || teachers[0];

  if (!nazir) return [];

  return [
    {
      id: 'cpis-mig-001',
      teacherId: nazir.id,
      teacherName: nazir.name,
      designation: nazir.designation,
      schoolName: school.name,
      schoolUdiseCode: school.code,
      oldCpisCode: OLD_CPIS_CODE_LEGACY,
      newCpisCode: NEW_CPIS_CODE_OFFICIAL,
      status: 'Approved',
      requestedByUserId: 'user-admin-wani',
      requestedByName: 'Mohd Yousuf Wani (HOI / Admin)',
      requestedAt: '2026-10-01T09:15:00Z',
      verifiedByUserId: 'user-admin-wani',
      verifiedByName: 'Mohd Yousuf Wani (Authorized Admin)',
      verifiedAt: '2026-10-01T09:30:00Z',
      remarks:
        'Controlled CPIS Code correction from JK-EDU-1985-0451 to KHYEDU 00220000 verified and linked across teacher profile, school records, and JKEPM appraisal submissions.',
    },
  ];
}

export function buildInitialJkepmReports(
  teachers: TeacherProfile[],
  school: SchoolProfile
): JkepmQuarterlyAppraisalReport[] {
  const nazir =
    teachers.find(
      (t) =>
        t.id === 'tch-2' ||
        normalizeCpisCode(t.employeeId) === normalizeCpisCode(NEW_CPIS_CODE_OFFICIAL)
    ) || teachers[0];
  const bilal = teachers.find((t) => t.id === 'tch-3') || teachers[2];
  const head = teachers.find((t) => t.id === 'tch-1') || teachers[0];

  const seeded: JkepmQuarterlyAppraisalReport[] = [];

  if (nazir) {
    seeded.push({
      id: 'jkepm-app-2026-q2-nazir',
      teacherId: nazir.id,
      teacherName: nazir.name,
      employeeId: NEW_CPIS_CODE_OFFICIAL,
      designation: nazir.designation,
      schoolName: school.name,
      schoolUdiseCode: school.code,
      cpisCode: NEW_CPIS_CODE_OFFICIAL,
      previousCpisCode: OLD_CPIS_CODE_LEGACY,
      academicSession: school.academicSession || '2026-2027',
      quarter: 'Q2 (Jul - Sep)',
      reportingPeriod: QUARTER_REPORTING_PERIODS['Q2 (Jul - Sep)'],
      dateOfJoining: nazir.dateOfJoining || '2012-08-12',
      classTeachingDetails: [
        {
          id: 'cls-teach-1',
          classNumber: '5',
          section: 'A',
          subject: 'Mathematics',
          periodsAllotted: 72,
          periodsConducted: 70,
          classTimetable: 'Mon–Sat • Period 2 (09:45 AM – 10:30 AM)',
          teachingActivitiesCompleted:
            'Activity-based fraction boards, mental math drills, NCERT workbook exercises Ch. 4–7.',
          syllabusCoveredPct: 95,
          syllabusDetails: 'Fractions, Decimals, Geometry Basics, Perimeter & Area completed.',
          learningOutcomesAchieved:
            '91% students independently solve multi-step word problems and fraction operations.',
          studentAssessmentDetails: 'Weekly formative quizzes + Term-1 unit assessment graded.',
          remedialTeachingActivities:
            '18 remedial sessions conducted for 6 slow learners in foundational numeracy.',
        },
        {
          id: 'cls-teach-2',
          classNumber: '6',
          section: 'A',
          subject: 'Mathematics',
          periodsAllotted: 66,
          periodsConducted: 64,
          classTimetable: 'Mon–Sat • Period 4 (11:15 AM – 12:00 PM)',
          teachingActivitiesCompleted:
            'Integers number-line workshops, algebraic expression flashcards, peer problem solving.',
          syllabusCoveredPct: 92,
          syllabusDetails: 'Whole Numbers, Playing with Numbers, Basic Geometrical Ideas, Integers.',
          learningOutcomesAchieved:
            '88% students mastered integer operations and geometric classification.',
          studentAssessmentDetails: 'Continuous rubric grading + notebook verification every Friday.',
          remedialTeachingActivities:
            'After-assembly 20-minute math clinic twice weekly for students scoring below 60%.',
        },
      ],
      schoolAssignments: [
        {
          id: 'asg-1',
          category: 'Morning Assembly Duties',
          title: 'Daily Morning Assembly & Attendance Coordination',
          scheduleOrPeriod: 'Mon–Sat • 08:45 AM – 09:00 AM',
          description:
            'Supervised morning prayer, daily news reading, uniform hygiene check, and student roll-call compilation.',
          assignedBy: school.headTeacherName || 'Head of Institution',
          completionStatus: 'Completed',
        },
        {
          id: 'asg-2',
          category: 'Examination Duties',
          title: 'Term-1 Internal Assessment Invigilation & Script Evaluation',
          scheduleOrPeriod: 'Sep 14 – Sep 24, 2026',
          description:
            'Invigilated Class 5 & 6 Mathematics and English examinations and completed evaluation of 68 answer scripts.',
          assignedBy: school.headTeacherName || 'Head of Institution',
          completionStatus: 'Completed',
        },
        {
          id: 'asg-3',
          category: 'Mid-Day Meal (MDM) Duties',
          title: 'MDM Quality Inspection & Daily Register Supervision',
          scheduleOrPeriod: 'Wednesdays & Fridays • 12:30 PM',
          description:
            'Verified kitchen hygiene, ration stock weight, and tasted cooked meals prior to distribution.',
          assignedBy: school.headTeacherName || 'Head of Institution',
          completionStatus: 'Ongoing',
        },
      ],
      attendanceAndLeave: recalculateAttendanceLeaveSummary({
        totalWorkingDays: 74,
        totalDaysAttended: 70,
        casualLeaves: 2,
        medicalLeaves: 2,
        earnedLeaves: 0,
        otherLeaves: 0,
        totalLeaveDays: 4,
        attendancePercentage: 94.6,
        leavePeriodFrom: '2026-08-18',
        leavePeriodTo: '2026-08-19',
        medicalSanctionOrderNumber: 'HOI/GMS-PC/ML/2026/114',
        medicalSanctionOrderDate: '2026-08-20',
        casualSanctionOrderNumber: 'HOI/GMS-PC/CL/2026/089',
        remarks: 'Medical certificate from PHC Iddgah verified and attached; all classes covered by substitution.',
        leaveRecords: [
          {
            id: 'lv-rec-1',
            leaveType: 'Casual_Leave',
            days: 2,
            fromDate: '2026-07-16',
            toDate: '2026-07-17',
            casualSanctionOrderNo: 'HOI/GMS-PC/CL/2026/089',
            remarks: 'Domestic urgency; prior permission granted by HOI.',
            supportingDocuments: [],
          },
          {
            id: 'lv-rec-2',
            leaveType: 'Medical_Leave',
            days: 2,
            fromDate: '2026-08-18',
            toDate: '2026-08-19',
            medicalSanctionOrderNo: 'HOI/GMS-PC/ML/2026/114',
            medicalSanctionOrderDate: '2026-08-20',
            remarks: 'Seasonal fever with PHC medical fitness certificate.',
            supportingDocuments: [
              {
                id: 'doc-seed-1',
                name: 'PHC_Medical_Certificate_Aug2026.pdf',
                docType: 'Medical Certificate',
                mimeType: 'application/pdf',
                sizeBytes: 184320,
                uploadedAt: '2026-08-20T10:00:00Z',
              },
            ],
          },
        ],
        supportingDocuments: [
          {
            id: 'doc-seed-1',
            name: 'PHC_Medical_Certificate_Aug2026.pdf',
            docType: 'Medical Certificate',
            mimeType: 'application/pdf',
            sizeBytes: 184320,
            uploadedAt: '2026-08-20T10:00:00Z',
          },
          {
            id: 'doc-seed-2',
            name: 'HOI_Sanction_Order_114.pdf',
            docType: 'Leave Sanction Order',
            mimeType: 'application/pdf',
            sizeBytes: 98400,
            uploadedAt: '2026-08-20T10:15:00Z',
          },
        ],
      }),
      selfAssessmentScore: 9.4,
      teacherDeclarationAccepted: true,
      teacherDeclarationDate: '2026-09-28',
      status: 'Approved',
      submittedAt: '2026-09-28T14:20:00Z',
      hoiRemarks:
        'Verified against daily class registers and MDM/Exam logs. CPIS updated to KHYEDU 00220000. Recommended and approved.',
      hoiReviewerName: school.headTeacherName || 'Mohd Yousuf Wani (HOI)',
      hoiReviewedAt: '2026-09-30T11:10:00Z',
      districtRemarks: 'Verified at ZEO Iddgah / District Srinagar JKEPM monitoring desk.',
      districtOfficerName: 'ZEO Iddgah (Srinagar)',
      districtApprovedAt: '2026-10-02T15:00:00Z',
      createdByUserId: 'user-teacher-nazir',
      createdAt: '2026-09-26T09:00:00Z',
      updatedAt: '2026-10-02T15:00:00Z',
    });

    // Active Q3 Submission ready for review/edit
    seeded.push({
      id: 'jkepm-app-2026-q3-nazir',
      teacherId: nazir.id,
      teacherName: nazir.name,
      employeeId: NEW_CPIS_CODE_OFFICIAL,
      designation: nazir.designation,
      schoolName: school.name,
      schoolUdiseCode: school.code,
      cpisCode: NEW_CPIS_CODE_OFFICIAL,
      previousCpisCode: OLD_CPIS_CODE_LEGACY,
      academicSession: school.academicSession || '2026-2027',
      quarter: 'Q3 (Oct - Dec)',
      reportingPeriod: QUARTER_REPORTING_PERIODS['Q3 (Oct - Dec)'],
      dateOfJoining: nazir.dateOfJoining || '2012-08-12',
      classTeachingDetails: [
        {
          id: 'cls-teach-q3-1',
          classNumber: '5',
          section: 'A',
          subject: 'Mathematics',
          periodsAllotted: 48,
          periodsConducted: 46,
          classTimetable: 'Mon–Sat • Period 2 (09:45 AM – 10:30 AM)',
          teachingActivitiesCompleted: 'Measurement, Symmetry, Data Handling bar charts.',
          syllabusCoveredPct: 78,
          syllabusDetails: 'Term-2 chapters 8 to 11 in progress with practical worksheets.',
          learningOutcomesAchieved: 'Students construct bar charts from classroom attendance data.',
          studentAssessmentDetails: 'October monthly test completed and graded.',
          remedialTeachingActivities: '10 remedial periods conducted for division & word problems.',
        },
      ],
      schoolAssignments: [
        {
          id: 'asg-q3-1',
          category: 'School Administrative Assignments',
          title: 'U-DISE+ Student Data & QR Attendance Coordination',
          scheduleOrPeriod: 'Oct 2026 – Ongoing',
          description: 'Assisted HOI in verifying Aadhaar status and QR attendance registers.',
          assignedBy: school.headTeacherName || 'Head of Institution',
          completionStatus: 'Ongoing',
        },
      ],
      attendanceAndLeave: recalculateAttendanceLeaveSummary({
        totalWorkingDays: 50,
        totalDaysAttended: 48,
        casualLeaves: 2,
        medicalLeaves: 0,
        earnedLeaves: 0,
        otherLeaves: 0,
        totalLeaveDays: 2,
        attendancePercentage: 96.0,
        leavePeriodFrom: '2026-10-29',
        leavePeriodTo: '2026-10-30',
        medicalSanctionOrderNumber: '',
        medicalSanctionOrderDate: '',
        casualSanctionOrderNumber: 'HOI/GMS-PC/CL/2026/132',
        remarks: '2 days CL applied for family commitment.',
        leaveRecords: [
          {
            id: 'lv-q3-1',
            leaveType: 'Casual_Leave',
            days: 2,
            fromDate: '2026-10-29',
            toDate: '2026-10-30',
            casualSanctionOrderNo: 'HOI/GMS-PC/CL/2026/132',
            remarks: 'Domestic urgency.',
            supportingDocuments: [],
          },
        ],
        supportingDocuments: [],
      }),
      selfAssessmentScore: 9.2,
      teacherDeclarationAccepted: true,
      teacherDeclarationDate: '2026-11-18',
      status: 'Submitted',
      submittedAt: '2026-11-18T11:30:00Z',
      createdByUserId: 'user-teacher-nazir',
      createdAt: '2026-11-10T09:00:00Z',
      updatedAt: '2026-11-18T11:30:00Z',
    });
  }

  if (bilal) {
    seeded.push({
      id: 'jkepm-app-2026-q2-bilal',
      teacherId: bilal.id,
      teacherName: bilal.name,
      employeeId: bilal.employeeId,
      designation: bilal.designation,
      schoolName: school.name,
      schoolUdiseCode: school.code,
      cpisCode: bilal.employeeId,
      academicSession: school.academicSession || '2026-2027',
      quarter: 'Q2 (Jul - Sep)',
      reportingPeriod: QUARTER_REPORTING_PERIODS['Q2 (Jul - Sep)'],
      dateOfJoining: bilal.dateOfJoining || '2015-09-20',
      classTeachingDetails: [
        {
          id: 'cls-teach-b1',
          classNumber: '5',
          section: 'A',
          subject: 'Science',
          periodsAllotted: 66,
          periodsConducted: 62,
          classTimetable: 'Mon–Sat • Period 3 (10:30 AM – 11:15 AM)',
          teachingActivitiesCompleted: 'Plant life models, water filtration experiment, lab charts.',
          syllabusCoveredPct: 91,
          syllabusDetails: 'Living Organisms, States of Matter, Food & Health, Environment.',
          learningOutcomesAchieved: 'Students demonstrate simple filtration and germination steps.',
          studentAssessmentDetails: 'Lab practical rubric + oral viva assessments.',
          remedialTeachingActivities: '15 remedial hours for scientific vocabulary in English/Urdu.',
        },
      ],
      schoolAssignments: [
        {
          id: 'asg-b1',
          category: 'Sports & Cultural Activities',
          title: 'Independence Day & Kashmiri Cultural Programme Coordinator',
          scheduleOrPeriod: 'August 2026',
          description: 'Coordinated cultural recitation, quiz competition, and school sports day.',
          assignedBy: school.headTeacherName || 'Head of Institution',
          completionStatus: 'Completed',
        },
      ],
      attendanceAndLeave: recalculateAttendanceLeaveSummary({
        totalWorkingDays: 74,
        totalDaysAttended: 71,
        casualLeaves: 0,
        medicalLeaves: 3,
        earnedLeaves: 0,
        otherLeaves: 0,
        totalLeaveDays: 3,
        attendancePercentage: 95.9,
        leavePeriodFrom: '2026-09-12',
        leavePeriodTo: '2026-09-14',
        medicalSanctionOrderNumber: 'HOI/GMS-PC/ML/2026/121',
        medicalSanctionOrderDate: '2026-09-15',
        casualSanctionOrderNumber: '',
        remarks: 'Viral fever medical leave sanctioned with PHC certificate.',
        leaveRecords: [
          {
            id: 'lv-b1',
            leaveType: 'Medical_Leave',
            days: 3,
            fromDate: '2026-09-12',
            toDate: '2026-09-14',
            medicalSanctionOrderNo: 'HOI/GMS-PC/ML/2026/121',
            medicalSanctionOrderDate: '2026-09-15',
            remarks: 'PHC certified rest for 3 days.',
            supportingDocuments: [],
          },
        ],
        supportingDocuments: [],
      }),
      selfAssessmentScore: 9.2,
      teacherDeclarationAccepted: true,
      teacherDeclarationDate: '2026-09-29',
      status: 'Recommended_By_HOI',
      submittedAt: '2026-09-29T12:15:00Z',
      hoiRemarks: 'Strong lab engagement and cultural leadership. Recommended for district approval.',
      hoiReviewerName: head?.name || school.headTeacherName || 'Mohd Yousuf Wani',
      hoiReviewedAt: '2026-09-30T14:00:00Z',
      createdByUserId: 'user-teacher-bilal',
      createdAt: '2026-09-28T10:00:00Z',
      updatedAt: '2026-09-30T14:00:00Z',
    });
  }

  return seeded;
}

export function buildInitialJkepmAuditLogs(): JkepmAuditLogEntry[] {
  return [
    {
      id: 'audit-cpis-001',
      timestamp: '2026-10-01T09:30:00Z',
      userId: 'user-admin-wani',
      userName: 'Mohd Yousuf Wani (Admin / HOI)',
      userRole: 'admin',
      action: 'CPIS_CODE_APPROVED',
      entityId: 'cpis-mig-001',
      summary:
        'Approved CPIS Code migration for Nazir Ahmad Dar: JK-EDU-1985-0451 -> KHYEDU 00220000 across teacher profile, school records, and JKEPM reports.',
      previousValue: OLD_CPIS_CODE_LEGACY,
      newValue: NEW_CPIS_CODE_OFFICIAL,
    },
    {
      id: 'audit-jkepm-002',
      timestamp: '2026-10-02T15:00:00Z',
      userId: 'user-admin-wani',
      userName: 'ZEO Iddgah / Admin',
      userRole: 'admin',
      action: 'REPORT_APPROVED',
      entityId: 'jkepm-app-2026-q2-nazir',
      summary: 'Approved Q2 (Jul - Sep) JKEPM Quarterly Appraisal for Nazir Ahmad Dar (CPIS: KHYEDU 00220000).',
    },
  ];
}

// =========================================================================
// OFFICIAL QUARTERLY APPRAISAL PDF GENERATOR (Download / Print / Share)
// =========================================================================
export function generateJkepmAppraisalPdf(
  report: JkepmQuarterlyAppraisalReport,
  school: SchoolProfile,
  mode: 'download' | 'print' | 'blob' = 'download'
): Blob | void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentW = pageW - margin * 2;
  let y = 12;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - 16) {
      doc.addPage();
      y = 14;
    }
  };

  const drawSectionBanner = (title: string) => {
    ensureSpace(12);
    doc.setFillColor(30, 41, 59);
    doc.roundedRect(margin, y, contentW, 7.5, 1.5, 1.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(title, margin + 3, y + 5.1);
    doc.setTextColor(15, 23, 42);
    y += 10;
  };

  // Top Government / Portal Header
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(margin, y, contentW, 28, 2.5, 2.5, 'F');

  // School logo if available (preserving aspect ratio, never overlapping text)
  let textStartX = margin + 5;
  if (school.logoDataUrl && school.logoDataUrl.startsWith('data:image/')) {
    try {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(margin + 3.5, y + 3.5, 21, 21, 2, 2, 'F');
      const imgFormat = school.logoDataUrl.includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(school.logoDataUrl, imgFormat, margin + 5, y + 5, 18, 18, undefined, 'FAST');
      textStartX = margin + 28;
    } catch {
      // Ignore logo decode errors
    }
  }

  doc.setTextColor(251, 191, 36);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('J&K SCHOOL EDUCATION DEPARTMENT • JKEPM PORTAL', textStartX, y + 6.5);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12.5);
  doc.text((school.name || report.schoolName).toUpperCase().slice(0, 56), textStartX, y + 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(203, 213, 225);
  doc.text(formatSchoolAddressOnce(school), textStartX, y + 18.2);
  doc.text(
    `U-DISE Code: ${report.schoolUdiseCode || school.code}  |  Session: ${report.academicSession}  |  Quarter: ${report.quarter}`,
    textStartX,
    y + 23.2
  );
  y += 32;

  // Document Title Strip
  doc.setFillColor(238, 242, 255);
  doc.setDrawColor(165, 180, 252);
  doc.roundedRect(margin, y, contentW, 9, 1.5, 1.5, 'FD');
  doc.setTextColor(30, 27, 75);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('JKEPM QUARTERLY SELF-ASSESSMENT & APPRAISAL REPORT', pageW / 2, y + 6, { align: 'center' });
  y += 12;

  // SECTION 1: TEACHER PARTICULARS & CPIS CODE
  drawSectionBanner('1. TEACHER PARTICULARS & VERIFIED CPIS CODE');

  const particulars: Array<[string, string, string, string]> = [
    ['Teacher Name', report.teacherName, 'Updated CPIS Code', report.cpisCode],
    ['Employee ID', report.employeeId, 'Legacy CPIS (Audit Ref)', report.previousCpisCode || 'N/A'],
    ['Designation', report.designation, 'Date of Joining', report.dateOfJoining || '—'],
    ['School Name', report.schoolName, 'School U-DISE Code', report.schoolUdiseCode],
    ['Academic Session', report.academicSession, 'Quarter & Period', `${report.quarter} (${report.reportingPeriod})`],
    ['Submission Status', report.status.replace(/_/g, ' '), 'Self-Assessment Score', `${report.selfAssessmentScore} / 10`],
  ];

  doc.setFontSize(8.2);
  particulars.forEach(([k1, v1, k2, v2]) => {
    ensureSpace(8);
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, y, 32, 6.8, 'FD');
    doc.rect(margin + contentW / 2, y, 36, 6.8, 'FD');
    doc.rect(margin + 32, y, contentW / 2 - 32, 6.8, 'S');
    doc.rect(margin + contentW / 2 + 36, y, contentW / 2 - 36, 6.8, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text(k1, margin + 2, y + 4.6);
    doc.text(k2, margin + contentW / 2 + 2, y + 4.6);

    doc.setFont('helvetica', k2.includes('CPIS') ? 'bold' : 'normal');
    doc.setTextColor(k2 === 'Updated CPIS Code' ? 22 : 15, k2 === 'Updated CPIS Code' ? 101 : 23, k2 === 'Updated CPIS Code' ? 52 : 42);
    doc.text(String(v1 || '—').slice(0, 34), margin + 34, y + 4.6);
    doc.text(String(v2 || '—').slice(0, 34), margin + contentW / 2 + 38, y + 4.6);
    y += 6.8;
  });
  y += 5;

  // SECTION 2: CLASS-WISE TEACHING DETAILS & TIMETABLE
  drawSectionBanner(`2. CLASS-WISE TEACHING PERFORMANCE & TIMETABLE (${report.classTeachingDetails.length} Entries)`);
  if (report.classTeachingDetails.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.text('No class-wise teaching entries recorded.', margin + 2, y + 4);
    y += 8;
  } else {
    report.classTeachingDetails.forEach((cls, idx) => {
      ensureSpace(30);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(margin, y, contentW, 27, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);
      doc.text(
        `${idx + 1}. Class ${cls.classNumber}-${cls.section} • ${cls.subject}  |  Periods: ${cls.periodsConducted}/${cls.periodsAllotted}  |  Syllabus: ${cls.syllabusCoveredPct}%`,
        margin + 3,
        y + 5
      );
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.8);
      doc.setTextColor(51, 65, 85);
      doc.text(`Timetable: ${(cls.classTimetable || '—').slice(0, 95)}`, margin + 3, y + 10);
      doc.text(`Activities & Syllabus: ${(cls.teachingActivitiesCompleted || cls.syllabusDetails || '—').slice(0, 95)}`, margin + 3, y + 14.5);
      doc.text(`Learning Outcomes: ${(cls.learningOutcomesAchieved || '—').slice(0, 95)}`, margin + 3, y + 19);
      doc.text(`Assessment & Remedial: ${(cls.studentAssessmentDetails || '—').slice(0, 46)} | ${(cls.remedialTeachingActivities || '—').slice(0, 44)}`, margin + 3, y + 23.5);
      y += 29.5;
    });
  }
  y += 2;

  // SECTION 3: SCHOOL TIMETABLE & OTHER ASSIGNMENTS
  drawSectionBanner(`3. SCHOOL TIMETABLE & ADDITIONAL ASSIGNMENTS (${report.schoolAssignments.length} Entries)`);
  if (report.schoolAssignments.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.text('No additional school assignments recorded.', margin + 2, y + 4);
    y += 8;
  } else {
    report.schoolAssignments.forEach((asg, idx) => {
      ensureSpace(16);
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, y, contentW, 14, 1.2, 1.2, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.2);
      doc.setTextColor(15, 23, 42);
      doc.text(`${idx + 1}. [${asg.category}] ${asg.title.slice(0, 56)} (${asg.completionStatus})`, margin + 3, y + 5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.6);
      doc.setTextColor(71, 85, 105);
      doc.text(`Schedule: ${(asg.scheduleOrPeriod || '—').slice(0, 40)}  |  Assigned By: ${(asg.assignedBy || 'HOI').slice(0, 32)}`, margin + 3, y + 9.2);
      doc.text(`Details: ${(asg.description || '—').slice(0, 102)}`, margin + 3, y + 12.8);
      y += 16;
    });
  }
  y += 2;

  // SECTION 4: ATTENDANCE & LEAVE DETAILS
  const att = recalculateAttendanceLeaveSummary(report.attendanceAndLeave);
  drawSectionBanner('4. WORKING DAYS, ATTENDANCE & LEAVE SANCTION DETAILS');
  ensureSpace(36);
  const attRows: Array<[string, string, string, string]> = [
    ['Total Working Days', String(att.totalWorkingDays), 'Total Days Attended', `${att.totalDaysAttended} (${att.attendancePercentage}%)`],
    ['Casual Leaves (CL)', String(att.casualLeaves), 'Medical Leaves (ML)', String(att.medicalLeaves)],
    ['Earned Leave (EL)', String(att.earnedLeaves), 'Other Leaves / Total Leave', `${att.otherLeaves} / ${att.totalLeaveDays} Days`],
    ['Leave Period (From–To)', `${att.leavePeriodFrom || '—'} to ${att.leavePeriodTo || '—'}`, 'CL Sanction Order No.', att.casualSanctionOrderNumber || 'N/A'],
    ['Medical Sanction Order No.', att.medicalSanctionOrderNumber || 'N/A', 'Medical Order Date', att.medicalSanctionOrderDate || 'N/A'],
  ];

  doc.setFontSize(8.1);
  attRows.forEach(([k1, v1, k2, v2]) => {
    ensureSpace(7.5);
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, y, 38, 6.5, 'FD');
    doc.rect(margin + contentW / 2, y, 40, 6.5, 'FD');
    doc.rect(margin + 38, y, contentW / 2 - 38, 6.5, 'S');
    doc.rect(margin + contentW / 2 + 40, y, contentW / 2 - 40, 6.5, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text(k1, margin + 2, y + 4.4);
    doc.text(k2, margin + contentW / 2 + 2, y + 4.4);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(String(v1).slice(0, 32), margin + 40, y + 4.4);
    doc.text(String(v2).slice(0, 30), margin + contentW / 2 + 42, y + 4.4);
    y += 6.5;
  });

  if (att.remarks) {
    ensureSpace(8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Leave & Attendance Remarks: ${att.remarks.slice(0, 110)}`, margin + 2, y + 5);
    y += 7;
  }

  if (att.supportingDocuments.length > 0) {
    ensureSpace(8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(
      `Supporting Documents Attached (${att.supportingDocuments.length}): ${att.supportingDocuments
        .map((d) => `${d.docType} [${d.name}]`)
        .join('; ')
        .slice(0, 105)}`,
      margin + 2,
      y + 4.5
    );
    y += 7.5;
  }

  y += 3;

  // SECTION 5: DECLARATION, HOI REMARKS & APPROVAL BLOCK
  drawSectionBanner('5. TEACHER DECLARATION, HEAD OF INSTITUTION REMARKS & APPROVAL');
  ensureSpace(46);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text(
    'Teacher Declaration: I hereby certify that the class-wise teaching, timetable, assignments, attendance, and leave sanction particulars',
    margin + 2,
    y + 4
  );
  doc.text(
    `furnished above under CPIS Code ${report.cpisCode} are true and verified from school records. (Date: ${report.teacherDeclarationDate || new Date().toISOString().slice(0, 10)})`,
    margin + 2,
    y + 8.5
  );

  y += 12;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, contentW, 13, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.text('Head of Institution / Principal Observations & Remarks:', margin + 3, y + 4.8);
  doc.setFont('helvetica', 'normal');
  doc.text((report.hoiRemarks || 'Pending Head of Institution verification remarks.').slice(0, 118), margin + 3, y + 9.8);
  y += 16;

  if (report.districtRemarks) {
    ensureSpace(12);
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(134, 239, 172);
    doc.roundedRect(margin, y, contentW, 10, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(22, 101, 52);
    doc.text(`District / ZEO Officer Remarks (${report.districtOfficerName || 'Authorized Officer'}):`, margin + 3, y + 4.2);
    doc.setFont('helvetica', 'normal');
    doc.text(report.districtRemarks.slice(0, 115), margin + 3, y + 8.2);
    doc.setTextColor(15, 23, 42);
    y += 13;
  }

  // Signature Footer Row
  ensureSpace(18);
  const sigW = contentW / 3;
  doc.setDrawColor(148, 163, 184);
  doc.line(margin + 2, y + 10, margin + sigW - 6, y + 10);
  doc.line(margin + sigW + 2, y + 10, margin + sigW * 2 - 6, y + 10);
  doc.line(margin + sigW * 2 + 2, y + 10, margin + contentW - 2, y + 10);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  doc.text(report.teacherName, margin + 2, y + 14);
  doc.text(report.hoiReviewerName || school.headTeacherName || 'Head of Institution', margin + sigW + 2, y + 14);
  doc.text(report.districtOfficerName || 'ZEO / District Officer', margin + sigW * 2 + 2, y + 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`Teacher Signature • CPIS: ${report.cpisCode}`, margin + 2, y + 17.5);
  doc.text('Head of Institution Seal & Sign', margin + sigW + 2, y + 17.5);
  doc.text(`Status: ${report.status.replace(/_/g, ' ')}`, margin + sigW * 2 + 2, y + 17.5);

  const safeName = report.teacherName.replace(/[^a-zA-Z0-9]+/g, '_');
  const safeQuarter = report.quarter.slice(0, 2);
  const filename = `JKEPM_Appraisal_${safeName}_${report.cpisCode.replace(/\s+/g, '_')}_${safeQuarter}.pdf`;

  if (mode === 'blob') {
    return doc.output('blob');
  }
  if (mode === 'print') {
    doc.autoPrint();
    const blobUrl = doc.output('bloburl');
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.src = String(blobUrl);
    document.body.appendChild(iframe);
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
        doc.save(filename);
      }
    }, 500);
    return;
  }

  doc.save(filename);
}

// =========================================================================
// CONSOLIDATED SCHOOL / DISTRICT PDF & EXCEL EXPORTS
// =========================================================================
export function generateConsolidatedJkepmPdf(
  reports: JkepmQuarterlyAppraisalReport[],
  school: SchoolProfile,
  titleLabel = 'Consolidated School & District JKEPM Quarterly Appraisal Register'
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;
  let y = 12;

  doc.setFillColor(15, 23, 42);
  doc.roundedRect(margin, y, pageW - margin * 2, 20, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(titleLabel.toUpperCase(), margin + 5, y + 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  doc.text(
    `${school.name} • ${formatSchoolAddressOnce(school)} • U-DISE: ${school.code} • Generated: ${new Date().toLocaleString()}`,
    margin + 5,
    y + 15
  );
  y += 24;

  const headers = [
    { label: 'Teacher Name', w: 42 },
    { label: 'CPIS Code', w: 34 },
    { label: 'Quarter', w: 26 },
    { label: 'Classes', w: 18 },
    { label: 'Assignments', w: 22 },
    { label: 'Working / Att', w: 28 },
    { label: 'Att %', w: 16 },
    { label: 'CL / ML', w: 18 },
    { label: 'Score', w: 16 },
    { label: 'Status', w: 32 },
    { label: 'HOI Remarks', w: 25 },
  ];

  const drawHeader = () => {
    doc.setFillColor(30, 41, 59);
    doc.rect(margin, y, pageW - margin * 2, 7.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    let x = margin + 2;
    headers.forEach((h) => {
      doc.text(h.label, x, y + 5);
      x += h.w;
    });
    y += 7.5;
  };

  drawHeader();

  reports.forEach((r, idx) => {
    if (y + 8 > pageH - 12) {
      doc.addPage();
      y = 12;
      drawHeader();
    }
    const att = recalculateAttendanceLeaveSummary(r.attendanceAndLeave);
    if (idx % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, pageW - margin * 2, 7.5, 'F');
    }
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, y, pageW - margin * 2, 7.5, 'S');
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.3);

    const rowValues = [
      r.teacherName.slice(0, 24),
      r.cpisCode.slice(0, 18),
      r.quarter.slice(0, 14),
      String(r.classTeachingDetails.length),
      String(r.schoolAssignments.length),
      `${att.totalDaysAttended} / ${att.totalWorkingDays}`,
      `${att.attendancePercentage}%`,
      `${att.casualLeaves} / ${att.medicalLeaves}`,
      `${r.selfAssessmentScore}/10`,
      r.status.replace(/_/g, ' ').slice(0, 18),
      (r.hoiRemarks || '—').slice(0, 16),
    ];

    let x = margin + 2;
    rowValues.forEach((val, colIdx) => {
      doc.text(val, x, y + 5);
      x += headers[colIdx].w;
    });
    y += 7.5;
  });

  doc.save(`JKEPM_Consolidated_Report_${school.code}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportJkepmConsolidatedExcel(params: {
  reports: JkepmQuarterlyAppraisalReport[];
  teachers: TeacherProfile[];
  cpisMigrations: CpisCodeMigrationRecord[];
  auditLogs: JkepmAuditLogEntry[];
  school: SchoolProfile;
  activeQuarter: JkepmQuarter;
}): void {
  const { reports, teachers, cpisMigrations, auditLogs, school, activeQuarter } = params;
  const wb = XLSX.utils.book_new();

  // Sheet 1: All Quarterly Appraisals
  const appraisalRows = reports.map((r, i) => {
    const att = recalculateAttendanceLeaveSummary(r.attendanceAndLeave);
    return {
      'S.No': i + 1,
      'Report ID': r.id,
      'Teacher Name': r.teacherName,
      'Updated CPIS Code': r.cpisCode,
      'Previous CPIS Code': r.previousCpisCode || '—',
      Designation: r.designation,
      'School Name': r.schoolName,
      'U-DISE Code': r.schoolUdiseCode,
      Session: r.academicSession,
      Quarter: r.quarter,
      'Reporting Period': r.reportingPeriod,
      'Classes Taught': r.classTeachingDetails.length,
      'School Assignments': r.schoolAssignments.length,
      'Working Days': att.totalWorkingDays,
      'Days Attended': att.totalDaysAttended,
      'Attendance %': att.attendancePercentage,
      'Casual Leaves': att.casualLeaves,
      'Medical Leaves': att.medicalLeaves,
      'Earned Leaves': att.earnedLeaves,
      'Other Leaves': att.otherLeaves,
      'Total Leave Days': att.totalLeaveDays,
      'Medical Sanction Order': att.medicalSanctionOrderNumber || '—',
      'CL Sanction Order': att.casualSanctionOrderNumber || '—',
      'Self Score (/10)': r.selfAssessmentScore,
      Status: r.status.replace(/_/g, ' '),
      'HOI Remarks': r.hoiRemarks || '',
      'District Remarks': r.districtRemarks || '',
    };
  });
  const ws1 = XLSX.utils.json_to_sheet(appraisalRows.length ? appraisalRows : [{ Notice: 'No JKEPM reports recorded yet.' }]);
  ws1['!cols'] = [
    { wch: 6 }, { wch: 24 }, { wch: 22 }, { wch: 20 }, { wch: 18 }, { wch: 26 },
    { wch: 28 }, { wch: 15 }, { wch: 12 }, { wch: 16 }, { wch: 26 }, { wch: 13 },
    { wch: 15 }, { wch: 12 }, { wch: 13 }, { wch: 13 }, { wch: 12 }, { wch: 13 },
    { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 22 }, { wch: 22 }, { wch: 14 },
    { wch: 20 }, { wch: 30 }, { wch: 30 },
  ];
  XLSX.utils.book_append_sheet(wb, ws1, 'Quarterly_Appraisals');

  // Sheet 2: Pending Submissions List for Active Quarter
  const submittedTeacherIds = new Set(
    reports
      .filter((r) => !r.isArchivedDeleted && r.quarter === activeQuarter && r.status !== 'Draft')
      .map((r) => r.teacherId)
  );
  const pendingRows = teachers
    .filter((t) => !submittedTeacherIds.has(t.id))
    .map((t, idx) => ({
      'S.No': idx + 1,
      'Teacher Name': t.name,
      'CPIS Code': t.employeeId,
      Designation: t.designation,
      'School Name': t.schoolName || school.name,
      'U-DISE Code': t.schoolId || school.code,
      'Pending Quarter': activeQuarter,
      Contact: t.contactNumber,
    }));
  const ws2 = XLSX.utils.json_to_sheet(
    pendingRows.length ? pendingRows : [{ Status: `All teachers have submitted for ${activeQuarter}` }]
  );
  XLSX.utils.book_append_sheet(wb, ws2, 'Pending_Submissions');

  // Sheet 3: CPIS Code Migration Audit History
  const cpisRows = cpisMigrations.map((m, idx) => ({
    'S.No': idx + 1,
    'Teacher Name': m.teacherName,
    'Old CPIS Code': m.oldCpisCode,
    'New CPIS Code': m.newCpisCode,
    'U-DISE Code': m.schoolUdiseCode,
    Status: m.status.replace(/_/g, ' '),
    'Requested By': m.requestedByName,
    'Requested At': m.requestedAt,
    'Verified By': m.verifiedByName || 'Pending',
    'Verified At': m.verifiedAt || '—',
    Remarks: m.remarks,
  }));
  const ws3 = XLSX.utils.json_to_sheet(cpisRows.length ? cpisRows : [{ Notice: 'No CPIS migrations recorded.' }]);
  XLSX.utils.book_append_sheet(wb, ws3, 'CPIS_Migration_Audit');

  // Sheet 4: Full System Audit Trail
  const auditRows = auditLogs.map((a, idx) => ({
    'S.No': idx + 1,
    Timestamp: a.timestamp,
    'User ID': a.userId,
    'User Name': a.userName,
    Role: a.userRole,
    Action: a.action,
    'Entity ID': a.entityId,
    Summary: a.summary,
    'Previous Value': a.previousValue || '—',
    'New Value': a.newValue || '—',
  }));
  const ws4 = XLSX.utils.json_to_sheet(auditRows.length ? auditRows : [{ Notice: 'No audit logs recorded.' }]);
  XLSX.utils.book_append_sheet(wb, ws4, 'Audit_Trail');

  XLSX.writeFile(wb, `JKEPM_District_Consolidated_${school.code}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function exportTeacherJkepmExcel(params: {
  reports: JkepmQuarterlyAppraisalReport[];
  teacherName: string;
  cpisCode: string;
  school: SchoolProfile;
  singleReport?: JkepmQuarterlyAppraisalReport;
}): void {
  const { reports, teacherName, cpisCode, school, singleReport } = params;
  const targetReports = singleReport ? [singleReport] : reports;
  const wb = XLSX.utils.book_new();

  // Sheet 1: Quarterly Report Summary & Teacher Particulars
  const summaryRows = targetReports.map((r, idx) => {
    const att = recalculateAttendanceLeaveSummary(r.attendanceAndLeave);
    return {
      'S.No': idx + 1,
      'Report ID': r.id,
      'Teacher Name': r.teacherName,
      'Employee ID': r.employeeId,
      'Updated CPIS Code': r.cpisCode,
      'Previous CPIS Code': r.previousCpisCode || '—',
      Designation: r.designation,
      'School Name': r.schoolName || school.name,
      'U-DISE Code': r.schoolUdiseCode || school.code,
      'Academic Session': r.academicSession,
      Quarter: r.quarter,
      'Reporting Period': r.reportingPeriod,
      'Date of Joining': r.dateOfJoining,
      'Classes Taught': r.classTeachingDetails.length,
      'Assignments Logged': r.schoolAssignments.length,
      'Working Days': att.totalWorkingDays,
      'Days Attended': att.totalDaysAttended,
      'Attendance %': att.attendancePercentage,
      'Casual Leaves': att.casualLeaves,
      'Medical Leaves': att.medicalLeaves,
      'Earned Leaves': att.earnedLeaves,
      'Other Leaves': att.otherLeaves,
      'Total Leave Days': att.totalLeaveDays,
      'Self Assessment Score (/10)': r.selfAssessmentScore,
      'Submission Status': r.status.replace(/_/g, ' '),
      'Submitted At': r.submittedAt ? r.submittedAt.slice(0, 10) : 'Draft',
      'HOI Remarks': r.hoiRemarks || '',
      'District Remarks': r.districtRemarks || '',
    };
  });
  const wsSummary = XLSX.utils.json_to_sheet(
    summaryRows.length ? summaryRows : [{ Notice: 'No quarterly appraisal reports available for export.' }]
  );
  wsSummary['!cols'] = [
    { wch: 6 }, { wch: 22 }, { wch: 22 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
    { wch: 22 }, { wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 24 },
    { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 13 }, { wch: 14 }, { wch: 13 },
    { wch: 13 }, { wch: 14 }, { wch: 13 }, { wch: 13 }, { wch: 16 }, { wch: 20 },
    { wch: 20 }, { wch: 14 }, { wch: 28 }, { wch: 28 },
  ];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Quarterly_Reports');

  // Sheet 2: Part A — Class-Wise Teaching Details
  const teachingRows = targetReports.flatMap((r) =>
    r.classTeachingDetails.map((c, idx) => ({
      'S.No': idx + 1,
      Quarter: r.quarter,
      Session: r.academicSession,
      'Teacher Name': r.teacherName,
      'CPIS Code': r.cpisCode,
      Class: `Class ${c.classNumber}`,
      Section: c.section,
      Subject: c.subject,
      'Periods Allotted': c.periodsAllotted,
      'Periods Conducted': c.periodsConducted,
      'Class Timetable': c.classTimetable,
      'Syllabus Covered (%)': c.syllabusCoveredPct,
      'Teaching Activities': c.teachingActivitiesCompleted,
      'Learning Outcomes': c.learningOutcomesAchieved,
      'Student Assessment': c.studentAssessmentDetails,
      'Remedial Teaching': c.remedialTeachingActivities,
    }))
  );
  const wsTeaching = XLSX.utils.json_to_sheet(
    teachingRows.length ? teachingRows : [{ Notice: 'No class-wise teaching entries recorded.' }]
  );
  XLSX.utils.book_append_sheet(wb, wsTeaching, 'Part_A_Class_Teaching');

  // Sheet 3: Part B — School Timetable & Additional Assignments
  const assignmentRows = targetReports.flatMap((r) =>
    r.schoolAssignments.map((a, idx) => ({
      'S.No': idx + 1,
      Quarter: r.quarter,
      Session: r.academicSession,
      Category: a.category,
      'Assignment Title': a.title,
      'Schedule / Period': a.scheduleOrPeriod,
      Description: a.description,
      'Assigned By': a.assignedBy,
      'Completion Status': a.completionStatus,
    }))
  );
  const wsAssignments = XLSX.utils.json_to_sheet(
    assignmentRows.length ? assignmentRows : [{ Notice: 'No school assignments recorded.' }]
  );
  XLSX.utils.book_append_sheet(wb, wsAssignments, 'Part_B_Assignments');

  // Sheet 4: Part C — Attendance & Leave Records
  const leaveRows = targetReports.flatMap((r) => {
    const att = recalculateAttendanceLeaveSummary(r.attendanceAndLeave);
    if (att.leaveRecords && att.leaveRecords.length > 0) {
      return att.leaveRecords.map((l, idx) => ({
        'S.No': idx + 1,
        Quarter: r.quarter,
        Session: r.academicSession,
        'Leave Type': l.leaveType.replace(/_/g, ' '),
        'From Date': l.fromDate,
        'To Date': l.toDate,
        Days: l.days,
        'Sanction Order No.': l.medicalSanctionOrderNo || l.casualSanctionOrderNo || '—',
        'Sanction Order Date': l.medicalSanctionOrderDate || '—',
        Remarks: l.remarks || '',
      }));
    }
    return [
      {
        'S.No': 1,
        Quarter: r.quarter,
        Session: r.academicSession,
        'Leave Type': 'Quarterly Summary',
        'From Date': att.leavePeriodFrom || '—',
        'To Date': att.leavePeriodTo || '—',
        Days: att.totalLeaveDays,
        'Sanction Order No.': att.medicalSanctionOrderNumber || att.casualSanctionOrderNumber || '—',
        'Sanction Order Date': att.medicalSanctionOrderDate || '—',
        Remarks: `CL: ${att.casualLeaves}, ML: ${att.medicalLeaves}, EL: ${att.earnedLeaves}, Other: ${att.otherLeaves}`,
      },
    ];
  });
  const wsLeaves = XLSX.utils.json_to_sheet(
    leaveRows.length ? leaveRows : [{ Notice: 'No leave records logged.' }]
  );
  XLSX.utils.book_append_sheet(wb, wsLeaves, 'Part_C_Attendance_Leaves');

  const safeTeacher = (teacherName || 'Teacher').replace(/[^A-Za-z0-9]+/g, '_').slice(0, 28);
  const safeCpis = (cpisCode || 'CPIS').replace(/[^A-Za-z0-9]+/g, '_');
  const suffix = singleReport
    ? `${singleReport.quarter.split(' ')[0]}_${singleReport.academicSession}`
    : new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `JKEPM_Teacher_Appraisal_${safeTeacher}_${safeCpis}_${suffix}.xlsx`);
}

