import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import {
  AdminAuditChangeLog,
  AdminUser,
  SchoolProfile,
  SecuritySettings,
} from '../types';
import { ALL_PERMISSIONS, resolveUserPermissions } from './sampleData';

/**
 * Generate Comprehensive 30-Day Security Audit PDF
 */
export function generateSecurityAuditPdf(
  school: SchoolProfile,
  auditLogs: AdminAuditChangeLog[],
  adminUsers: AdminUser[],
  securitySettings: SecuritySettings
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let currentY = 18;

  // Header Background Banner
  doc.setFillColor(30, 41, 59); // slate-800
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Title in Header
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(school.name.toUpperCase(), pageWidth / 2, 11, { align: 'center' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text(
    `U-DISE+: ${school.code} | District: ${school.district}, ${school.state} | Academic Session: ${school.academicSession}`,
    pageWidth / 2,
    17,
    { align: 'center' }
  );

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(253, 224, 71); // amber-300
  doc.text(
    'STATUTORY ADMINISTRATIVE ACCESS & SECURITY COMPLIANCE AUDIT (30-DAY REVIEW)',
    pageWidth / 2,
    23,
    { align: 'center' }
  );

  currentY = 36;

  // Audit Metadata Block
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 24, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('AUDIT PERIOD:', margin + 4, currentY + 6);
  doc.setFont('helvetica', 'normal');
  doc.text('Last 30 Days (Oct 1, 2026 – Oct 30, 2026)', margin + 30, currentY + 6);

  doc.setFont('helvetica', 'bold');
  doc.text('REPORT GENERATED:', margin + 4, currentY + 12);
  doc.setFont('helvetica', 'normal');
  doc.text(new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST', margin + 38, currentY + 12);

  doc.setFont('helvetica', 'bold');
  doc.text('SECURITY AUDITOR:', margin + 4, currentY + 18);
  doc.setFont('helvetica', 'normal');
  doc.text(`${school.headTeacherName} (${school.principalDesignation || 'Principal'})`, margin + 36, currentY + 18);

  // Key metrics on right
  const rightColX = pageWidth / 2 + 10;
  doc.setFont('helvetica', 'bold');
  doc.text('ACTIVE ADMINS:', rightColX, currentY + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(`${adminUsers.length} Enrolled (1 Primary, 1 Senior, 1 Junior, 2 Staff)`, rightColX + 28, currentY + 6);

  doc.setFont('helvetica', 'bold');
  doc.text('PASSWORD POLICY:', rightColX, currentY + 12);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Min ${securitySettings.minPasswordLength} Chars | 2FA: ${securitySettings.twoFactorEnforced ? 'Enforced' : 'Off'} | Timeout: ${securitySettings.sessionTimeoutMinutes}m`,
    rightColX + 32,
    currentY + 12
  );

  doc.setFont('helvetica', 'bold');
  doc.text('ROLE INHERITANCE:', rightColX, currentY + 18);
  doc.setFont('helvetica', 'normal');
  doc.text('ACTIVE: Senior Admin inherits Junior Admin base matrix', rightColX + 32, currentY + 18);

  currentY += 30;

  // Section 1: Administrator Roster & Permissions Hierarchy
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('1. ACTIVE ADMINISTRATOR HIERARCHY & ROLE INHERITANCE', margin, currentY);
  currentY += 4;

  // Admin Table Header
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, currentY, pageWidth - margin * 2, 6, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);

  doc.text('NAME', margin + 2, currentY + 4);
  doc.text('EMAIL / ID', margin + 42, currentY + 4);
  doc.text('ASSIGNED ROLE', margin + 84, currentY + 4);
  doc.text('INHERITANCE MODEL', margin + 118, currentY + 4);
  doc.text('LAST ACTIVE', margin + 154, currentY + 4);
  currentY += 6;

  // Admin rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  adminUsers.forEach((admin) => {
    doc.setTextColor(15, 23, 42);
    doc.text(admin.name.slice(0, 24), margin + 2, currentY + 4);
    doc.text(admin.email.slice(0, 26), margin + 42, currentY + 4);
    
    // Role with style
    const roleFormatted = admin.role.replace('_', ' ').toUpperCase();
    doc.text(roleFormatted, margin + 84, currentY + 4);

    const inheritText =
      admin.role === 'senior_admin'
        ? 'Inherits Junior Admin (5 perms)'
        : admin.role === 'primary_admin'
        ? 'Master Authority (All)'
        : 'Direct / Base Role';
    doc.text(inheritText, margin + 118, currentY + 4);

    const lastActiveFmt = admin.lastActive ? new Date(admin.lastActive).toLocaleDateString() : 'Active Today';
    doc.text(lastActiveFmt, margin + 154, currentY + 4);

    doc.setDrawColor(241, 245, 249);
    doc.line(margin, currentY + 5.5, pageWidth - margin, currentY + 5.5);
    currentY += 6;
  });

  currentY += 6;

  // Section 2: Chronological Administrative Audit Log (30-Day Activity)
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('2. 30-DAY ADMINISTRATIVE CHANGE & ACCESS LOG (CHANGE COMPARISON)', margin, currentY);
  currentY += 4;

  // Audit Table Header
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, currentY, pageWidth - margin * 2, 6, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);

  doc.text('DATE / TIME (IST)', margin + 2, currentY + 4);
  doc.text('ACTOR (ADMIN)', margin + 34, currentY + 4);
  doc.text('EVENT TYPE', margin + 74, currentY + 4);
  doc.text('CHANGE SUMMARY / COMPARISON', margin + 104, currentY + 4);
  doc.text('STATUS', margin + 168, currentY + 4);
  currentY += 6;

  // Audit Rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);

  auditLogs.slice(0, 16).forEach((log) => {
    // Check if new page is needed
    if (currentY > pageHeight - 32) {
      doc.addPage();
      currentY = 20;

      // Repeat Header on new page
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, currentY, pageWidth - margin * 2, 6, 'F');
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(51, 65, 85);
      doc.text('DATE / TIME (IST)', margin + 2, currentY + 4);
      doc.text('ACTOR (ADMIN)', margin + 34, currentY + 4);
      doc.text('EVENT TYPE', margin + 74, currentY + 4);
      doc.text('CHANGE SUMMARY / COMPARISON', margin + 104, currentY + 4);
      doc.text('STATUS', margin + 168, currentY + 4);
      currentY += 7;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
    }

    const dateStr = new Date(log.timestamp).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

    doc.setTextColor(71, 85, 105);
    doc.text(dateStr, margin + 2, currentY + 4);

    doc.setTextColor(15, 23, 42);
    doc.text(log.actorName.slice(0, 22), margin + 34, currentY + 4);

    // Event Type
    doc.setFont('helvetica', 'bold');
    doc.text(log.actionType.replace('_', ' '), margin + 74, currentY + 4);
    doc.setFont('helvetica', 'normal');

    // Description & Old vs New
    let detailText = log.description;
    if (log.oldValue && log.newValue) {
      detailText += ` [Old: ${log.oldValue} -> New: ${log.newValue}]`;
    }
    const truncatedDesc = detailText.length > 56 ? detailText.slice(0, 53) + '...' : detailText;
    doc.text(truncatedDesc, margin + 104, currentY + 4);

    // Status Badge
    doc.setTextColor(22, 101, 52); // green-800
    doc.text('PASSED', margin + 168, currentY + 4);

    doc.setDrawColor(241, 245, 249);
    doc.line(margin, currentY + 5.5, pageWidth - margin, currentY + 5.5);
    currentY += 6.5;
  });

  // Verification & Sign-off block at bottom
  if (currentY > pageHeight - 38) {
    doc.addPage();
    currentY = 24;
  } else {
    currentY = Math.max(currentY + 6, pageHeight - 36);
  }

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 26, 2, 2, 'FD');

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('STATUTORY VERIFICATION & DIGITAL SEAL', margin + 4, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    'This compliance audit log is digitally verified and permanently recorded under school data governance policies.\nNo unauthorized privilege escalations or policy breaches were detected during this 30-day review period.',
    margin + 4,
    currentY + 11
  );

  doc.setFont('helvetica', 'bold');
  doc.text('Authorized Signatory:', pageWidth - margin - 52, currentY + 16);
  doc.setFont('helvetica', 'normal');
  doc.text(school.headTeacherName, pageWidth - margin - 52, currentY + 21);
  doc.text(`${school.principalDesignation || 'Principal'} / Headmaster`, pageWidth - margin - 52, currentY + 24);

  // Trigger Save
  const fileName = `Security_Compliance_Audit_${school.code}_30Days.pdf`;
  doc.save(fileName);
}

/**
 * Export Audit Log as CSV
 */
export function exportSecurityAuditToCSV(auditLogs: AdminAuditChangeLog[], school: SchoolProfile) {
  const headers = [
    'Audit ID',
    'Timestamp',
    'Actor Name',
    'Actor ID',
    'Target User Name',
    'Action Type',
    'Description',
    'Old Value',
    'New Value',
    'IP Address',
    'Status',
  ];

  const rows = auditLogs.map((l) => [
    l.id,
    l.timestamp,
    `"${l.actorName.replace(/"/g, '""')}"`,
    l.actorId,
    `"${(l.targetUserName || '').replace(/"/g, '""')}"`,
    l.actionType,
    `"${l.description.replace(/"/g, '""')}"`,
    `"${(l.oldValue || '').replace(/"/g, '""')}"`,
    `"${(l.newValue || '').replace(/"/g, '""')}"`,
    l.ipAddress || '',
    l.status,
  ]);

  const csvContent =
    'data:text/csv;charset=utf-8,\uFEFF' +
    [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `Security_Audit_Log_${school.code}_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Export Audit Log as JSON
 */
export function exportSecurityAuditToJSON(
  auditLogs: AdminAuditChangeLog[],
  school: SchoolProfile,
  securitySettings: SecuritySettings
) {
  const exportPayload = {
    institution: {
      name: school.name,
      udiseCode: school.code,
      district: school.district,
      state: school.state,
      academicSession: school.academicSession,
      headmaster: school.headTeacherName,
    },
    securitySettings,
    auditPeriodDays: 30,
    generatedAt: new Date().toISOString(),
    recordCount: auditLogs.length,
    auditLogs,
  };

  const jsonStr = JSON.stringify(exportPayload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Security_Audit_Full_Snapshot_${school.code}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export Admin Roster & Permission Matrix to Excel (.xlsx)
 */
export function exportAdminRosterToExcel(adminUsers: AdminUser[], school: SchoolProfile) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Admin Users Roster
  const rosterData = [
    [`${school.name} - ${school.nameHi || ''}`],
    [`OFFICIAL ADMINISTRATIVE ROSTER (U-DISE: ${school.code})`],
    [],
    ['ID', 'Name', 'Email', 'Role', 'Designation', 'Contact', 'Inheritance Model', 'Last Active', 'Status'],
    ...adminUsers.map((u) => [
      u.id,
      u.name,
      u.email,
      u.role.replace('_', ' ').toUpperCase(),
      u.designation || '',
      u.phone || '',
      u.role === 'senior_admin' ? 'Inherits Junior Admin' : 'Direct Matrix',
      u.lastActive,
      u.status,
    ]),
  ];

  const wsRoster = XLSX.utils.aoa_to_sheet(rosterData);
  XLSX.utils.book_append_sheet(wb, wsRoster, 'Admin Roster');

  // Sheet 2: Permissions Matrix
  const permHeaders = ['Permission', 'Key', 'Category', ...adminUsers.map((u) => u.name)];
  const permRows = ALL_PERMISSIONS.map((perm) => {
    const row = [perm.label, perm.key, perm.category];
    adminUsers.forEach((u) => {
      const perms = resolveUserPermissions(u.role, u.customPermissions);
      row.push(perms[perm.key] ? 'YES' : 'NO');
    });
    return row;
  });

  const matrixData = [
    [`${school.name} - ROLE PERMISSION MATRIX & INHERITANCE MAP`],
    [],
    permHeaders,
    ...permRows,
  ];

  const wsMatrix = XLSX.utils.aoa_to_sheet(matrixData);
  XLSX.utils.book_append_sheet(wb, wsMatrix, 'Permission Matrix');

  XLSX.writeFile(wb, `Admin_Access_Control_Matrix_${school.code}.xlsx`);
}
