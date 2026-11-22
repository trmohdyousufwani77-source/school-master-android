import jsPDF from 'jspdf';
import { SchoolProfile, TeacherLeaveApplication, TeacherProfile } from '../types';
import { formatSchoolAddressOnce } from './calculations';

export interface TeacherLeaveSummaryStats {
  teacherId: string;
  employeeId: string;
  teacherName: string;
  designation: string;
  casualLeaveTakenDays: number;
  medicalLeaveTakenDays: number;
  otherApprovedLeaveDays: number;
  totalApprovedLeaveDays: number;
  pendingCount: number;
  underReviewCount: number;
  approvedCount: number;
  rejectedCount: number;
  deletedCount: number;
}

export interface MonthlyLeaveBreakdownRow {
  monthIndex: number;
  monthLabel: string;
  casualDays: number;
  medicalDays: number;
  otherDays: number;
  totalApprovedDays: number;
  pendingApplications: number;
  rejectedApplications: number;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function computeInclusiveLeaveDays(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0;
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return 0;
  const diffMs = end.getTime() - start.getTime();
  return Math.floor(diffMs / 86400000) + 1;
}

export function findOverlappingLeave(
  leaves: TeacherLeaveApplication[],
  employeeId: string,
  startDate: string,
  endDate: string,
  excludeId?: string
): TeacherLeaveApplication | undefined {
  const normEmp = (employeeId || '').trim().toUpperCase();
  return leaves.find((l) => {
    if (excludeId && l.id === excludeId) return false;
    if (l.deletedStatus === 'Deleted') return false;
    if (l.status === 'Rejected') return false;
    if ((l.employeeId || '').trim().toUpperCase() !== normEmp) return false;
    return l.startDate <= endDate && l.endDate >= startDate;
  });
}

export function computeTeacherLeaveStats(
  leaves: TeacherLeaveApplication[],
  teacher: TeacherProfile,
  yearFilter?: string
): TeacherLeaveSummaryStats {
  const normEmp = (teacher.employeeId || '').trim().toUpperCase();
  const normName = teacher.name.trim().toLowerCase();

  const matchingAll = leaves.filter((l) => {
    const matchesTeacher =
      l.teacherId === teacher.id ||
      (l.employeeId || '').trim().toUpperCase() === normEmp ||
      l.teacherName.trim().toLowerCase() === normName;
    if (!matchesTeacher) return false;
    if (yearFilter && yearFilter !== 'ALL') {
      const yr = (l.startDate || l.applicationDate || '').slice(0, 4);
      if (yr !== yearFilter) return false;
    }
    return true;
  });

  const active = matchingAll.filter((l) => l.deletedStatus !== 'Deleted');
  const deletedCount = matchingAll.filter((l) => l.deletedStatus === 'Deleted').length;

  // CRITICAL RULE: Only APPROVED leave applications are counted in approved totals
  const approved = active.filter((l) => l.status === 'Approved');
  const casualLeaveTakenDays = approved
    .filter((l) => l.leaveType === 'Casual_Leave')
    .reduce((sum, l) => sum + (Number(l.totalDays) || 0), 0);
  const medicalLeaveTakenDays = approved
    .filter((l) => l.leaveType === 'Medical_Leave')
    .reduce((sum, l) => sum + (Number(l.totalDays) || 0), 0);
  const otherApprovedLeaveDays = approved
    .filter((l) => l.leaveType !== 'Casual_Leave' && l.leaveType !== 'Medical_Leave')
    .reduce((sum, l) => sum + (Number(l.totalDays) || 0), 0);

  return {
    teacherId: teacher.id,
    employeeId: teacher.employeeId,
    teacherName: teacher.name,
    designation: teacher.designation,
    casualLeaveTakenDays,
    medicalLeaveTakenDays,
    otherApprovedLeaveDays,
    totalApprovedLeaveDays: casualLeaveTakenDays + medicalLeaveTakenDays + otherApprovedLeaveDays,
    pendingCount: active.filter((l) => l.status === 'Pending').length,
    underReviewCount: active.filter((l) => l.status === 'Under_Review').length,
    approvedCount: approved.length,
    rejectedCount: active.filter((l) => l.status === 'Rejected').length,
    deletedCount,
  };
}

export function computeMonthlyLeaveBreakdown(
  leaves: TeacherLeaveApplication[],
  year: string,
  teacherFilter?: TeacherProfile
): MonthlyLeaveBreakdownRow[] {
  const rows: MonthlyLeaveBreakdownRow[] = MONTH_NAMES.map((label, idx) => ({
    monthIndex: idx,
    monthLabel: label,
    casualDays: 0,
    medicalDays: 0,
    otherDays: 0,
    totalApprovedDays: 0,
    pendingApplications: 0,
    rejectedApplications: 0,
  }));

  leaves.forEach((l) => {
    if (l.deletedStatus === 'Deleted') return;
    if (teacherFilter) {
      const normEmp = (teacherFilter.employeeId || '').trim().toUpperCase();
      const matches =
        l.teacherId === teacherFilter.id ||
        (l.employeeId || '').trim().toUpperCase() === normEmp ||
        l.teacherName.trim().toLowerCase() === teacherFilter.name.trim().toLowerCase();
      if (!matches) return;
    }
    const dateStr = l.startDate || l.applicationDate || '';
    if (year !== 'ALL' && dateStr.slice(0, 4) !== year) return;
    const monthNum = parseInt(dateStr.slice(5, 7), 10);
    if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) return;
    const row = rows[monthNum - 1];
    if (l.status === 'Approved') {
      const days = Number(l.totalDays) || 0;
      if (l.leaveType === 'Casual_Leave') row.casualDays += days;
      else if (l.leaveType === 'Medical_Leave') row.medicalDays += days;
      else row.otherDays += days;
      row.totalApprovedDays += days;
    } else if (l.status === 'Pending' || l.status === 'Under_Review') {
      row.pendingApplications += 1;
    } else if (l.status === 'Rejected') {
      row.rejectedApplications += 1;
    }
  });

  return rows;
}

interface PdfColumnSpec {
  label: string;
  w: number;
}

function drawSimplePdfTable(
  doc: jsPDF,
  margin: number,
  startY: number,
  columns: PdfColumnSpec[],
  rows: string[][],
  headerRgb: [number, number, number]
): number {
  const pageH = doc.internal.pageSize.getHeight();
  const totalW = columns.reduce((s, c) => s + c.w, 0);
  let y = startY;

  const drawHeader = () => {
    doc.setFillColor(headerRgb[0], headerRgb[1], headerRgb[2]);
    doc.rect(margin, y, totalW, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    let x = margin + 1.8;
    columns.forEach((col) => {
      doc.text(col.label, x, y + 4.7);
      x += col.w;
    });
    y += 7;
  };

  drawHeader();

  rows.forEach((row, rIdx) => {
    const rowH = 6.8;
    if (y + rowH > pageH - 16) {
      doc.addPage();
      y = 14;
      drawHeader();
    }
    if (rIdx % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, totalW, rowH, 'F');
    }
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, y, totalW, rowH, 'S');
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);

    let x = margin + 1.8;
    row.forEach((cell, cIdx) => {
      const maxChars = Math.max(4, Math.floor((columns[cIdx].w - 2.5) / 1.65));
      const clean = String(cell || '').replace(/\s+/g, ' ').slice(0, maxChars);
      doc.text(clean, x, y + 4.5);
      x += columns[cIdx].w;
    });
    y += rowH;
  });

  return y;
}

export function generateTeacherLeaveStatementPdf(params: {
  school: SchoolProfile;
  teachers: TeacherProfile[];
  leaves: TeacherLeaveApplication[];
  selectedTeacher?: TeacherProfile | null;
  selectedYear: string;
  selectedMonth?: string; // 'ALL' or '01'..'12'
  mode?: 'download' | 'print';
}): void {
  const {
    school,
    teachers,
    leaves,
    selectedTeacher,
    selectedYear,
    selectedMonth = 'ALL',
    mode = 'download',
  } = params;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;
  let y = 12;

  // Header Banner
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(margin, y, pageW - margin * 2, 26, 2.5, 2.5, 'F');

  let textStartX = margin + 5;
  if (school.logoDataUrl && school.logoDataUrl.startsWith('data:image/')) {
    try {
      const props = doc.getImageProperties(school.logoDataUrl);
      const maxH = 18;
      const maxW = 18;
      const ratio = props.width && props.height ? props.width / props.height : 1;
      const drawW = ratio >= 1 ? maxW : maxH * ratio;
      const drawH = ratio >= 1 ? maxW / ratio : maxH;
      const imgX = margin + 4 + (maxW - drawW) / 2;
      const imgY = y + 4 + (maxH - drawH) / 2;
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(margin + 3.5, y + 3.5, 19, 19, 2, 2, 'F');
      doc.addImage(school.logoDataUrl, imgX, imgY, drawW, drawH);
      textStartX = margin + 26;
    } catch {
      // ignore image errors
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('TEACHER LEAVE STATEMENT & OFFICIAL REGISTER', textStartX, y + 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(226, 232, 240);
  doc.text(school.name.toUpperCase(), textStartX, y + 14);
  doc.setFontSize(7.6);
  doc.setTextColor(203, 213, 225);
  doc.text(
    `${formatSchoolAddressOnce(school)} • U-DISE: ${school.code} • Session: ${school.academicSession}`,
    textStartX,
    y + 19.2
  );
  const periodLabel =
    selectedYear === 'ALL'
      ? 'All Years'
      : selectedMonth !== 'ALL'
      ? `${MONTH_NAMES[parseInt(selectedMonth, 10) - 1] || selectedMonth} ${selectedYear}`
      : `Year ${selectedYear}`;
  doc.text(
    `Scope: ${selectedTeacher ? `${selectedTeacher.name} (${selectedTeacher.employeeId})` : 'All School Teachers'} • Period: ${periodLabel} • Generated: ${new Date().toLocaleDateString()}`,
    textStartX,
    y + 23.8
  );

  y += 31;

  // Filter leaves for selected scope
  const activeLeaves = leaves.filter((l) => {
    if (l.deletedStatus === 'Deleted') return false;
    if (selectedTeacher) {
      const normEmp = (selectedTeacher.employeeId || '').trim().toUpperCase();
      const matches =
        l.teacherId === selectedTeacher.id ||
        (l.employeeId || '').trim().toUpperCase() === normEmp ||
        l.teacherName.trim().toLowerCase() === selectedTeacher.name.trim().toLowerCase();
      if (!matches) return false;
    }
    const dateStr = l.startDate || l.applicationDate || '';
    if (selectedYear !== 'ALL' && dateStr.slice(0, 4) !== selectedYear) return false;
    if (selectedMonth !== 'ALL' && dateStr.slice(5, 7) !== selectedMonth) return false;
    return true;
  });

  // Section 1: Summary Table per Teacher (Only Approved Leaves counted in Approved Totals)
  const targetTeachers = selectedTeacher ? [selectedTeacher] : teachers;
  const summaryRows = targetTeachers.map((tc, idx) => {
    const s = computeTeacherLeaveStats(activeLeaves, tc, 'ALL');
    return [
      String(idx + 1),
      s.teacherName,
      s.employeeId,
      String(s.casualLeaveTakenDays),
      String(s.medicalLeaveTakenDays),
      String(s.totalApprovedLeaveDays),
      String(s.pendingCount + s.underReviewCount),
      String(s.rejectedCount),
    ];
  });

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.2);
  doc.text('1. Approved Leave Summary (Only Approved Applications Counted in Totals)', margin, y);
  y += 3.5;

  y = drawSimplePdfTable(
    doc,
    margin,
    y,
    [
      { label: '#', w: 8 },
      { label: 'Teacher Name', w: 42 },
      { label: 'CPIS / Emp ID', w: 34 },
      { label: 'CL (d)', w: 18 },
      { label: 'ML (d)', w: 18 },
      { label: 'Total Appr.', w: 24 },
      { label: 'Pending', w: 20 },
      { label: 'Rejected', w: 22 },
    ],
    summaryRows.length ? summaryRows : [['—', 'No teachers found', '—', '0', '0', '0', '0', '0']],
    [30, 41, 59]
  );
  y += 7;

  // Section 2: Monthly Breakdown (when viewing a specific year)
  if (selectedYear !== 'ALL' && selectedMonth === 'ALL') {
    if (y > pageH - 65) {
      doc.addPage();
      y = 14;
    }
    const monthly = computeMonthlyLeaveBreakdown(activeLeaves, selectedYear, selectedTeacher || undefined);
    const nonEmptyMonths = monthly.filter(
      (m) => m.totalApprovedDays > 0 || m.pendingApplications > 0 || m.rejectedApplications > 0
    );
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.2);
    doc.text(`2. Monthly Leave Report (${selectedYear})`, margin, y);
    y += 3.5;

    y = drawSimplePdfTable(
      doc,
      margin,
      y,
      [
        { label: 'Month', w: 34 },
        { label: 'Appr. CL (d)', w: 25 },
        { label: 'Appr. ML (d)', w: 25 },
        { label: 'Other (d)', w: 24 },
        { label: 'Total Appr.', w: 28 },
        { label: 'Pending Apps', w: 25 },
        { label: 'Rejected Apps', w: 25 },
      ],
      (nonEmptyMonths.length ? nonEmptyMonths : monthly.slice(0, 6)).map((m) => [
        m.monthLabel,
        String(m.casualDays),
        String(m.medicalDays),
        String(m.otherDays),
        String(m.totalApprovedDays),
        String(m.pendingApplications),
        String(m.rejectedApplications),
      ]),
      [15, 118, 110]
    );
    y += 7;
  }

  // Section 3: Detailed Leave Applications Register
  if (y > pageH - 55) {
    doc.addPage();
    y = 14;
  }
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.2);
  doc.text('3. Itemized Leave Applications Ledger', margin, y);
  y += 3.5;

  y = drawSimplePdfTable(
    doc,
    margin,
    y,
    [
      { label: 'App ID', w: 20 },
      { label: 'Teacher', w: 32 },
      { label: 'Category', w: 26 },
      { label: 'Dates', w: 36 },
      { label: 'Days', w: 12 },
      { label: 'Status', w: 22 },
      { label: 'Remarks / Rejection', w: 38 },
    ],
    activeLeaves.length
      ? activeLeaves.map((l) => [
          l.id,
          l.teacherName,
          l.leaveType.replace(/_/g, ' '),
          `${l.startDate}..${l.endDate}`,
          String(l.totalDays),
          l.status.replace(/_/g, ' '),
          l.status === 'Rejected'
            ? `Rej: ${l.rejectionReason || l.remarks || '—'}`
            : l.headmasterRemarks || l.remarks || l.reason,
        ])
      : [['—', 'No applications recorded', '—', '—', '0', '—', '—']],
    [67, 56, 202]
  );

  // Signatures
  const sigY = Math.min(y + 18, pageH - 18);
  if (y + 22 > pageH - 12) {
    doc.addPage();
  }
  const finalSigY = y + 22 > pageH - 12 ? 28 : sigY;
  doc.setDrawColor(148, 163, 184);
  doc.line(margin, finalSigY, margin + 55, finalSigY);
  doc.line(pageW - margin - 60, finalSigY, pageW - margin, finalSigY);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text('Teacher / Applicant Signature', margin, finalSigY + 4.5);
  doc.text(`Headmaster (${school.headTeacherName || 'HOI'})`, pageW - margin - 60, finalSigY + 4.5);

  const safeName = selectedTeacher
    ? selectedTeacher.name.replace(/[^A-Za-z0-9]+/g, '_')
    : 'All_Teachers';
  const fileName = `Teacher_Leave_Statement_${safeName}_${selectedYear}_${new Date().toISOString().slice(0, 10)}.pdf`;

  if (mode === 'print') {
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
        doc.save(fileName);
      }
    }, 450);
    return;
  }

  doc.save(fileName);
}
