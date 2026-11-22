import jsPDF from 'jspdf';
import { SchoolProfile, Student } from '../types';
import { deduplicateStudentsByAdmissionNumber, formatSchoolAddressOnce } from './calculations';

function inferImageFormat(dataUrl: string): 'PNG' | 'JPEG' | 'WEBP' {
  if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')) return 'JPEG';
  if (dataUrl.startsWith('data:image/webp')) return 'WEBP';
  return 'PNG';
}

/**
 * Clean string for filenames
 */
function sanitizeFilename(name: string): string {
  return name.trim().replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_');
}

/**
 * 1. Generate Individual Student Information PDF
 * Output format: [Student_Name]_Student_Record.pdf (e.g. Jan_Mohammad_Student_Record.pdf)
 */
export function generateIndividualStudentPdf(
  student: Student,
  school: SchoolProfile,
  recordedByAdmin?: string
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 182mm

  // Draw decorative outer border
  doc.setDrawColor(79, 70, 229); // Indigo 600
  doc.setLineWidth(1.2);
  doc.rect(margin - 4, margin - 4, contentWidth + 8, pageHeight - margin * 2 + 8);
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.setLineWidth(0.4);
  doc.rect(margin - 2, margin - 2, contentWidth + 4, pageHeight - margin * 2 + 4);

  // Top Institutional Header Banner
  doc.setFillColor(30, 27, 75); // Indigo 950
  doc.rect(margin, margin, contentWidth, 28, 'F');

  // Header Text
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(school.name.toUpperCase(), margin + contentWidth / 2, margin + 9, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(224, 231, 255);
  doc.text(
    `U-DISE+ CODE: ${school.code}  |  ACADEMIC SESSION: ${school.academicSession}  |  DISTRICT: ${school.district.toUpperCase()}`,
    margin + contentWidth / 2,
    margin + 16,
    { align: 'center' }
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(251, 191, 36); // Amber 400
  doc.text('OFFICIAL STUDENT RECORD & ADMISSION PROFILE', margin + contentWidth / 2, margin + 23, {
    align: 'center',
  });

  // Current Y position tracker
  let currentY = margin + 34;

  // Student Basic Identity Bar
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, currentY, contentWidth, 36, 2, 2, 'FD');

  // Photo Box (Left)
  const photoW = 26;
  const photoH = 30;
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(148, 163, 184);
  doc.roundedRect(margin + 3, currentY + 3, photoW, photoH, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('STUDENT', margin + 3 + photoW / 2, currentY + 14, { align: 'center' });
  doc.text('PHOTO', margin + 3 + photoW / 2, currentY + 19, { align: 'center' });

  // Main Identity Information beside photo
  const infoX = margin + 33;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42);
  doc.text(student.fullName, infoX, currentY + 10);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(79, 70, 229);
  doc.text(`Student Record ID: ${student.id}`, infoX, currentY + 17);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text(
    `Admission No (SRN): ${student.admissionNumber}   |   Roll No: #${student.rollNumber}   |   Class & Section: Class ${student.classNumber}-${student.section}`,
    infoX,
    currentY + 24
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Status: ${student.status.toUpperCase()}   |   UIDAI Status: ${student.aadhaarStatus.replace(/_/g, ' ')} (${student.maskedAadhaar || 'Masked'})`,
    infoX,
    currentY + 30
  );

  currentY += 41;

  // Section 1: Detailed Demographic & Family Information
  doc.setFillColor(79, 70, 229);
  doc.rect(margin, currentY, contentWidth, 6.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text('1. DEMOGRAPHIC & PARENTAL INFORMATION', margin + 3, currentY + 4.8);

  currentY += 8.5;

  const demographicFields = [
    ["Student's Full Name", student.fullName, "Father's Full Name", student.fatherName || 'N/A'],
    ["Mother's Full Name", student.motherName || 'N/A', 'Guardian Name', student.guardianName || student.fatherName || 'N/A'],
    ['Date of Birth', student.dob || 'N/A', 'Gender', student.gender || 'N/A'],
    ['Primary Contact No', student.mobileNumber || 'N/A', 'WhatsApp Number', student.parentWhatsAppNumber || student.mobileNumber || 'N/A'],
    ['Residential Address', student.address || formatSchoolAddressOnce(school), 'Village / Town', student.villageTown || 'N/A'],
    ['Block / Tehsil', student.blockTehsil || 'Iddgah', 'District & State', `${student.district || school.district}, ${student.state || school.state}`],
    ['Postal PIN Code', student.pinCode || school.pinCode, 'Academic Session', student.academicSession || school.academicSession],
  ];

  demographicFields.forEach((row) => {
    // Left pair
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, currentY, 40, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(row[0], margin + 2, currentY + 4.2);

    doc.setFillColor(255, 255, 255);
    doc.rect(margin + 40, currentY, 51, 6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(String(row[1]), margin + 42, currentY + 4.2);

    // Right pair
    doc.setFillColor(248, 250, 252);
    doc.rect(margin + 91, currentY, 40, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(row[2], margin + 93, currentY + 4.2);

    doc.setFillColor(255, 255, 255);
    doc.rect(margin + 131, currentY, 51, 6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(String(row[3]), margin + 133, currentY + 4.2);

    currentY += 6;
  });

  currentY += 5;

  // Section 2: School Enrollment & Compliance Details
  doc.setFillColor(79, 70, 229);
  doc.rect(margin, currentY, contentWidth, 6.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text('2. ENROLLMENT & INSTITUTIONAL DATA', margin + 3, currentY + 4.8);

  currentY += 8.5;

  const enrollmentFields = [
    ['Institution Name', school.name, 'U-DISE+ School Code', school.code],
    ['Admission Date', student.admissionDate || 'N/A', 'Previous School', student.previousSchool || 'None Recorded'],
    ['Enrolled Class & Sec', `Class ${student.classNumber} - Section ${student.section}`, 'Assigned Roll Number', `#${student.rollNumber}`],
    ['Aadhaar Compliance', student.aadhaarStatus, 'Masked Aadhaar / ID Ref', student.maskedAadhaar || student.alternativeIdType || 'Verified Offline'],
    ['Parental Consent', student.parentConsentRecorded ? 'Recorded on Admission File' : 'Pending', 'Enrollment Status', student.status],
  ];

  enrollmentFields.forEach((row) => {
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, currentY, 40, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(row[0], margin + 2, currentY + 4.2);

    doc.setFillColor(255, 255, 255);
    doc.rect(margin + 40, currentY, 51, 6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(String(row[1]), margin + 42, currentY + 4.2);

    doc.setFillColor(248, 250, 252);
    doc.rect(margin + 91, currentY, 40, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(row[2], margin + 93, currentY + 4.2);

    doc.setFillColor(255, 255, 255);
    doc.rect(margin + 131, currentY, 51, 6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(String(row[3]), margin + 133, currentY + 4.2);

    currentY += 6;
  });

  currentY += 5;

  // Section 3: Notes & Additional Observations
  doc.setFillColor(79, 70, 229);
  doc.rect(margin, currentY, contentWidth, 6.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text('3. ACADEMIC & INSTITUTIONAL REMARKS', margin + 3, currentY + 4.8);

  currentY += 8.5;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.rect(margin, currentY, contentWidth, 18, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);

  const noteText =
    (student as any).notes ||
    `Official student registration profile maintained under RTE Act 2009 and UDISE+ guidelines. Student is regular and active in Class ${student.classNumber}-${student.section}.`;
  doc.text(noteText, margin + 4, currentY + 6, { maxWidth: contentWidth - 8 });

  currentY += 24;

  // Audit and Authenticity stamp box
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, currentY, contentWidth, 22, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('SYSTEM AUTHENTICATION & VERIFICATION RECORD', margin + 4, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  const nowStr = new Date().toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  doc.text(`Generated On: ${nowStr}`, margin + 4, currentY + 12);
  doc.text(
    `Authorized Administrator: ${recordedByAdmin || school.headTeacherName || 'Mohd Yousuf Wani (Admin)'}`,
    margin + 4,
    currentY + 17
  );

  doc.setFont('helvetica', 'italic');
  doc.text('Cryptographically generated document via School Master Mobile Application.', margin + 95, currentY + 12);
  doc.text('Valid for all statutory, scholarship, and verification purposes.', margin + 95, currentY + 17);

  currentY += 30;

  // Signature Blocks
  const sigBoxW = (contentWidth - 10) / 3;

  // 1. Class In-Charge
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.line(margin, currentY + 12, margin + sigBoxW, currentY + 12);
  doc.text('Class In-Charge / Teacher', margin + sigBoxW / 2, currentY + 17, { align: 'center' });

  // 2. School Seal (with uploaded Official Stamp if available)
  if (school.officialStampDataUrl) {
    try {
      doc.addImage(
        school.officialStampDataUrl,
        inferImageFormat(school.officialStampDataUrl),
        margin + sigBoxW * 1.5 - 6,
        currentY - 2,
        22,
        13
      );
    } catch {
      // Ignore invalid image payload
    }
  }
  doc.line(margin + sigBoxW + 5, currentY + 12, margin + sigBoxW * 2 + 5, currentY + 12);
  doc.text('Institution Official Seal', margin + sigBoxW * 1.5 + 5, currentY + 17, { align: 'center' });

  // 3. Headmaster / Principal (with Digital Signature & Name)
  const headmasterName = school.headmasterName || school.headTeacherName || 'Mohd Yousuf Wani';
  if (school.headmasterSignatureDataUrl) {
    try {
      doc.addImage(
        school.headmasterSignatureDataUrl,
        inferImageFormat(school.headmasterSignatureDataUrl),
        margin + sigBoxW * 2.5 - 4,
        currentY - 1,
        28,
        11
      );
    } catch {
      // Ignore invalid image payload
    }
  }
  doc.line(margin + sigBoxW * 2 + 10, currentY + 12, margin + contentWidth, currentY + 12);
  doc.text(
    `${headmasterName} (${school.principalDesignation || 'Headmaster'})`,
    margin + sigBoxW * 2.5 + 10,
    currentY + 17,
    { align: 'center' }
  );

  // Filename strictly formatted as [Student_Name]_Student_Record.pdf
  const filename = `${sanitizeFilename(student.fullName)}_Student_Record.pdf`;
  doc.save(filename);
}

/**
 * 2. Generate Comprehensive Multi-Page PDF for All Students
 */
export function generateAllStudentsPdf(
  students: Student[],
  school: SchoolProfile,
  filterClass?: string
): void {
  const uniqueStudents = deduplicateStudentsByAdmissionNumber(students);
  const filtered = filterClass && filterClass !== 'all'
    ? uniqueStudents.filter((s) => s.classNumber === filterClass)
    : uniqueStudents;

  if (filtered.length === 0) {
    alert('No students found to export.');
    return;
  }

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 297;
  const pageHeight = 210;
  const margin = 12;
  const contentWidth = pageWidth - margin * 2; // 273mm

  const itemsPerPage = 12;
  const totalPages = Math.ceil(filtered.length / itemsPerPage);

  for (let page = 0; page < totalPages; page++) {
    if (page > 0) {
      doc.addPage('a4', 'landscape');
    }

    // Outer border
    doc.setDrawColor(79, 70, 229);
    doc.setLineWidth(0.8);
    doc.rect(margin - 2, margin - 2, contentWidth + 4, pageHeight - margin * 2 + 4);

    // Header banner
    doc.setFillColor(30, 27, 75);
    doc.rect(margin, margin, contentWidth, 20, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(
      `${school.name.toUpperCase()} - COMPREHENSIVE STUDENT REGISTER`,
      margin + contentWidth / 2,
      margin + 8,
      { align: 'center' }
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(224, 231, 255);
    doc.text(
      `U-DISE+ Code: ${school.code}  |  Session: ${school.academicSession}  |  Total Enrolled: ${filtered.length}  |  Page ${page + 1} of ${totalPages}`,
      margin + contentWidth / 2,
      margin + 15,
      { align: 'center' }
    );

    let currentY = margin + 25;

    // Table Header
    doc.setFillColor(79, 70, 229);
    doc.rect(margin, currentY, contentWidth, 8, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);

    const cols = [
      { header: 'S.No', x: margin + 2, w: 12 },
      { header: 'Student ID', x: margin + 14, w: 26 },
      { header: 'Admission No', x: margin + 40, w: 26 },
      { header: 'Student Full Name', x: margin + 66, w: 45 },
      { header: 'Father Name', x: margin + 111, w: 42 },
      { header: 'Class-Sec', x: margin + 153, w: 18 },
      { header: 'DOB', x: margin + 171, w: 20 },
      { header: 'Gender', x: margin + 191, w: 16 },
      { header: 'Mobile Number', x: margin + 207, w: 28 },
      { header: 'Aadhaar Status', x: margin + 235, w: 24 },
      { header: 'Status', x: margin + 259, w: 14 },
    ];

    cols.forEach((col) => {
      doc.text(col.header, col.x, currentY + 5.5);
    });

    currentY += 8;

    // Table Rows
    const startIndex = page * itemsPerPage;
    const pageStudents = filtered.slice(startIndex, startIndex + itemsPerPage);

    pageStudents.forEach((st, idx) => {
      const isEven = idx % 2 === 0;
      doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
      doc.rect(margin, currentY, contentWidth, 9.5, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, currentY + 9.5, margin + contentWidth, currentY + 9.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);

      const sNo = String(startIndex + idx + 1);
      doc.text(sNo, cols[0].x, currentY + 6);
      doc.setFont('helvetica', 'bold');
      doc.text(st.id, cols[1].x, currentY + 6);
      doc.setFont('helvetica', 'normal');
      doc.text(st.admissionNumber, cols[2].x, currentY + 6);
      doc.setFont('helvetica', 'bold');
      doc.text(st.fullName, cols[3].x, currentY + 6);
      doc.setFont('helvetica', 'normal');
      doc.text(st.fatherName, cols[4].x, currentY + 6);
      doc.text(`${st.classNumber}-${st.section}`, cols[5].x, currentY + 6);
      doc.text(st.dob, cols[6].x, currentY + 6);
      doc.text(st.gender, cols[7].x, currentY + 6);
      doc.text(st.mobileNumber, cols[8].x, currentY + 6);
      doc.text(st.aadhaarStatus, cols[9].x, currentY + 6);
      doc.text(st.status, cols[10].x, currentY + 6);

      currentY += 9.5;
    });

    // Footer
    const footerY = pageHeight - margin + 2;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Official UDISE+ Roster • Generated on ${new Date().toLocaleDateString('en-IN')} • School Master Android App`,
      margin,
      footerY
    );
    doc.text(`Page ${page + 1} of ${totalPages}`, margin + contentWidth, footerY, { align: 'right' });
  }

  doc.save('All_Students_Comprehensive_Register.pdf');
}

/**
 * 3. Generate Official Printable Student Register PDF
 */
export function generatePrintableStudentRegisterPdf(
  students: Student[],
  school: SchoolProfile,
  classFilter?: string
): void {
  generateAllStudentsPdf(students, school, classFilter);
}

/**
 * 4. Export Student Data to CSV with UTF-8 BOM
 */
export function exportStudentsToCsv(
  students: Student[],
  school: SchoolProfile,
  classFilter?: string
): void {
  const uniqueStudents = deduplicateStudentsByAdmissionNumber(students);
  const filtered = classFilter && classFilter !== 'all'
    ? uniqueStudents.filter((s) => s.classNumber === classFilter)
    : uniqueStudents;

  const escapeCsv = (val: any): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const headers = [
    'Student ID',
    'Admission Number (SRN)',
    'Roll Number',
    'Class',
    'Section',
    'Student Full Name',
    'Date of Birth',
    'Gender',
    'Father Name',
    'Mother Name',
    'Contact Number',
    'WhatsApp Number',
    'Residential Address',
    'Village or Town',
    'Block or Tehsil',
    'District',
    'State',
    'PIN Code',
    'Admission Date',
    'Academic Session',
    'Status',
    'Aadhaar Status',
    'Masked Aadhaar',
  ];

  const rows = filtered.map((s) => [
    escapeCsv(s.id),
    escapeCsv(s.admissionNumber),
    escapeCsv(s.rollNumber),
    escapeCsv(s.classNumber),
    escapeCsv(s.section),
    escapeCsv(s.fullName),
    escapeCsv(s.dob),
    escapeCsv(s.gender),
    escapeCsv(s.fatherName),
    escapeCsv(s.motherName),
    escapeCsv(s.mobileNumber),
    escapeCsv(s.parentWhatsAppNumber),
    escapeCsv(s.address),
    escapeCsv(s.villageTown),
    escapeCsv(s.blockTehsil),
    escapeCsv(s.district),
    escapeCsv(s.state),
    escapeCsv(s.pinCode),
    escapeCsv(s.admissionDate),
    escapeCsv(s.academicSession),
    escapeCsv(s.status),
    escapeCsv(s.aadhaarStatus),
    escapeCsv(s.maskedAadhaar || 'N/A'),
  ]);

  const csvContent = '\uFEFF' + [headers.map(escapeCsv).join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Student_Records_Export_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
