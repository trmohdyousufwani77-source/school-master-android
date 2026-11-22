import jsPDF from 'jspdf';
import {
  Examination,
  SchoolProfile,
  Student,
  StudentExamSummary,
  StudentHolisticRecord,
  StudentMarkEntry,
} from '../types';
import {
  HOLISTIC_ASSESSMENT_CATEGORIES,
  sampleHolisticRecords,
  sampleSubjectConfigs,
} from './sampleData';
import {
  deduplicateStudentsByAdmissionNumber,
  formatSchoolAddressOnce,
} from './calculations';

function inferImageFormat(dataUrl: string): 'PNG' | 'JPEG' | 'WEBP' {
  if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')) return 'JPEG';
  if (dataUrl.startsWith('data:image/webp')) return 'WEBP';
  return 'PNG';
}

export interface BatchClassProgressCardPdfOptions {
  school: SchoolProfile;
  examination: Examination;
  studentSummaries: StudentExamSummary[];
  students: Student[];
  marksEntries: StudentMarkEntry[];
  holisticRecords?: Record<string, StudentHolisticRecord>;
  classNumber: string;
  section: string;
  selectedStudentIds?: string[];
  customFileName?: string;
}

/**
 * Consolidates student Holistic Progress Cards (HPC) for a class or selected students
 * into a single, multi-page, printer-friendly A4 PDF document.
 */
export function generateBatchClassProgressCardsPdf(options: BatchClassProgressCardPdfOptions): void {
  const {
    school,
    examination,
    studentSummaries,
    students,
    marksEntries,
    holisticRecords,
    classNumber,
    section,
    selectedStudentIds,
    customFileName,
  } = options;

  const uniqueStudents = deduplicateStudentsByAdmissionNumber(students);
  const selectedSet = selectedStudentIds && selectedStudentIds.length > 0 ? new Set(selectedStudentIds) : null;
  const seenSummaryKeys = new Set<string>();
  const uniqueSummaries = (studentSummaries || []).filter((sum) => {
    if (selectedSet && !selectedSet.has(sum.studentId)) return false;
    const matched = uniqueStudents.find((s) => s.id === sum.studentId);
    const key = (matched?.admissionNumber || sum.studentId || '').trim().toUpperCase();
    if (!key || seenSummaryKeys.has(key)) return false;
    seenSummaryKeys.add(key);
    return true;
  });

  if (uniqueSummaries.length === 0) {
    return;
  }

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 12;
  const contentWidth = pageWidth - margin * 2; // 186mm
  const totalPages = uniqueSummaries.length;
  const formattedAddressOnce = formatSchoolAddressOnce(school);

  uniqueSummaries.forEach((summary, index) => {
    if (index > 0) {
      doc.addPage('a4', 'portrait');
    }

    const student = uniqueStudents.find((s) => s.id === summary.studentId);
    const hol = holisticRecords?.[summary.studentId] || sampleHolisticRecords[summary.studentId] || {
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
      suggestionsForParents: 'Support daily reading habits and review homework assignments.',
      goalsForNextTerm: 'Strive for distinction in mathematics and science.',
    };

    // ------------------------------------------------------------------------
    // 1. PAGE BORDER (Formal Certificate Style)
    // ------------------------------------------------------------------------
    doc.setDrawColor(30, 41, 59); // slate-800
    doc.setLineWidth(0.6);
    doc.rect(margin - 4, 6, contentWidth + 8, pageHeight - 12);
    doc.setLineWidth(0.2);
    doc.rect(margin - 2.5, 7.5, contentWidth + 5, pageHeight - 15);

    // ------------------------------------------------------------------------
    // 2. HEADER BANNER: School Information & School Logo (Aspect-Ratio Safe, Zero Overlap)
    // ------------------------------------------------------------------------
    doc.setFillColor(15, 41, 74); // deep navy #0f294a
    doc.rect(margin, 10, contentWidth, 20, 'F');

    let headerTextCenterX = pageWidth / 2;
    let headerTextMaxWidth = contentWidth - 10;

    if (school.logoDataUrl) {
      try {
        const frameX = margin + 3;
        const frameY = 11.5;
        const frameSize = 17;
        const innerPad = 1.4;
        const availSize = frameSize - innerPad * 2;

        // Crisp white rounded container so logo is clearly visible and never covered
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(251, 191, 36); // amber accent border
        doc.setLineWidth(0.35);
        doc.roundedRect(frameX, frameY, frameSize, frameSize, 1.8, 1.8, 'FD');

        let drawW = availSize;
        let drawH = availSize;
        try {
          const props = doc.getImageProperties(school.logoDataUrl);
          if (props && props.width > 0 && props.height > 0) {
            const aspect = props.width / props.height;
            if (aspect >= 1) {
              drawW = availSize;
              drawH = availSize / aspect;
            } else {
              drawH = availSize;
              drawW = availSize * aspect;
            }
          }
        } catch {
          // Keep square fallback if metadata unavailable
        }

        const drawX = frameX + (frameSize - drawW) / 2;
        const drawY = frameY + (frameSize - drawH) / 2;

        doc.addImage(
          school.logoDataUrl,
          inferImageFormat(school.logoDataUrl),
          drawX,
          drawY,
          drawW,
          drawH
        );

        // Shift text zone cleanly to the right of the logo frame with generous spacing
        const textZoneLeft = frameX + frameSize + 4;
        const textZoneRight = margin + contentWidth - 3;
        headerTextMaxWidth = textZoneRight - textZoneLeft;
        headerTextCenterX = textZoneLeft + headerTextMaxWidth / 2;
      } catch {
        // Fallback if invalid logo data URL
      }
    }

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.text(school.name.toUpperCase(), headerTextCenterX, 16.2, {
      align: 'center',
      maxWidth: headerTextMaxWidth,
    });

    doc.setFontSize(7.6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(226, 232, 240); // slate-200
    doc.text(
      `${formattedAddressOnce}  |  U-DISE: ${school.code}`,
      headerTextCenterX,
      21.8,
      { align: 'center', maxWidth: headerTextMaxWidth }
    );
    doc.setTextColor(253, 230, 138); // warm amber
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.text(
      `ACADEMIC SESSION: ${school.academicSession}  |  EXAMINATION: ${examination.name.toUpperCase()}`,
      headerTextCenterX,
      26.4,
      { align: 'center', maxWidth: headerTextMaxWidth }
    );

    // Subheader Ribbon: Holistic Progress Card Title
    doc.setFillColor(241, 245, 249); // slate-100
    doc.setDrawColor(203, 213, 225); // slate-300
    doc.setLineWidth(0.2);
    doc.rect(margin, 31.2, contentWidth, 6.4, 'FD');

    doc.setTextColor(15, 23, 42); // slate-900
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(
      'HOLISTIC STUDENT PROGRESS CARD (HPC) - 360-DEGREE MULTI-DIMENSIONAL ASSESSMENT',
      pageWidth / 2,
      34.8,
      { align: 'center' }
    );

    // ------------------------------------------------------------------------
    // 3. SECTION A: Student Demographics & Profile
    // ------------------------------------------------------------------------
    const bioY = 39;
    const bioHeight = 16;
    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(203, 213, 225);
    doc.rect(margin, bioY, contentWidth, bioHeight, 'FD');

    doc.setFontSize(7.5);
    const colW = contentWidth / 4;

    // Row 1
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('Student Name:', margin + 2, bioY + 4);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(summary.studentName, margin + 22, bioY + 4);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('Roll Number:', margin + colW * 1.5 + 2, bioY + 4);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(67, 56, 202); // indigo-700
    doc.text(`#${summary.rollNumber}`, margin + colW * 1.5 + 20, bioY + 4);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('Class & Section:', margin + colW * 2.5 + 2, bioY + 4);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`Class ${classNumber} - Section ${section}`, margin + colW * 2.5 + 24, bioY + 4);

    // Row 2
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text("Father's Name:", margin + 2, bioY + 9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(student?.fatherName || 'Mohd Hussain', margin + 22, bioY + 9);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text("Mother's Name:", margin + colW * 1.5 + 2, bioY + 9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(student?.motherName || 'Nasreen Akhtar', margin + colW * 1.5 + 22, bioY + 9);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('Admission / SRN:', margin + colW * 2.5 + 2, bioY + 9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(student?.admissionNumber || summary.studentId, margin + colW * 2.5 + 24, bioY + 9);

    // Row 3
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('Date of Birth:', margin + 2, bioY + 14);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(student?.dob || '2015-05-14', margin + 22, bioY + 14);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('Gender:', margin + colW * 1.5 + 2, bioY + 14);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(student?.gender || 'Male', margin + colW * 1.5 + 14, bioY + 14);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('Attendance Rate:', margin + colW * 2.5 + 2, bioY + 14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(4, 120, 87); // emerald-700
    doc.text('92.4% (22/24 Working Days)', margin + colW * 2.5 + 24, bioY + 14);

    // ------------------------------------------------------------------------
    // 4. SECTION B: Scholastic Performance Table (6 Core Subjects)
    // ------------------------------------------------------------------------
    const tableStartY = 58;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text('SECTION B: SCHOLASTIC ASSESSMENT (6 MANDATORY SUBJECTS)', margin, tableStartY - 1.5);

    // Table Header
    doc.setFillColor(30, 41, 59);
    doc.rect(margin, tableStartY, contentWidth, 6, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.text('Subject Name', margin + 3, tableStartY + 4.2);
    doc.text('Max Marks', margin + 55, tableStartY + 4.2, { align: 'center' });
    doc.text('Marks Obtained', margin + 85, tableStartY + 4.2, { align: 'center' });
    doc.text('Percentage', margin + 115, tableStartY + 4.2, { align: 'center' });
    doc.text('Grade', margin + 135, tableStartY + 4.2, { align: 'center' });
    doc.text('Teacher Subject Remarks & Observations', margin + 145, tableStartY + 4.2);

    // 6 Subjects Rows
    const rowH = 5.2;
    sampleSubjectConfigs.forEach((sub, sIdx) => {
      const rY = tableStartY + 6 + sIdx * rowH;
      const isAlt = sIdx % 2 === 1;

      if (isAlt) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, rY, contentWidth, rowH, 'F');
      }
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, rY + rowH, margin + contentWidth, rY + rowH);

      const entry = marksEntries.find(
        (m) => m.studentId === summary.studentId && m.subjectCode === sub.code
      );
      const marks = entry ? entry.marksObtained : 82;
      const maxMarks = sub.maxMarks;
      const pct = marks !== null && maxMarks > 0 ? Math.round((marks / maxMarks) * 1000) / 10 : 0;
      const grade = entry?.grade || (pct >= 80 ? 'A+' : pct >= 65 ? 'A' : pct >= 50 ? 'B' : 'C');
      const remarks = entry?.remarks || 'Good progress demonstrated in curricular work.';

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(7);
      doc.text(sub.name, margin + 3, rY + 3.8);

      doc.setFont('helvetica', 'normal');
      doc.text(String(maxMarks), margin + 55, rY + 3.8, { align: 'center' });

      doc.setFont('helvetica', 'bold');
      doc.text(marks !== null ? String(marks) : 'AB', margin + 85, rY + 3.8, { align: 'center' });

      doc.text(`${pct}%`, margin + 115, rY + 3.8, { align: 'center' });

      doc.setTextColor(67, 56, 202);
      doc.text(grade, margin + 135, rY + 3.8, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(remarks.slice(0, 36), margin + 145, rY + 3.8);
    });

    // Total Aggregate Row
    const totY = tableStartY + 6 + 6 * rowH;
    doc.setFillColor(224, 231, 255); // indigo-100
    doc.rect(margin, totY, contentWidth, 6, 'F');
    doc.setDrawColor(199, 210, 254);
    doc.rect(margin, totY, contentWidth, 6, 'D');

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(7.5);
    doc.text('TOTAL AGGREGATE PERFORMANCE', margin + 3, totY + 4.2);
    doc.text(String(summary.totalMaxMarks), margin + 55, totY + 4.2, { align: 'center' });
    doc.text(String(summary.totalMarksObtained), margin + 85, totY + 4.2, { align: 'center' });
    doc.text(`${summary.percentage}%`, margin + 115, totY + 4.2, { align: 'center' });
    doc.setTextColor(67, 56, 202);
    doc.text(summary.overallGrade, margin + 135, totY + 4.2, { align: 'center' });
    doc.setTextColor(summary.isPassed ? 4 : 225, summary.isPassed ? 120 : 29, summary.isPassed ? 87 : 72);
    doc.text(summary.isPassed ? 'PROMOTED / PASSED' : 'NEEDS REMEDIAL SUPPORT', margin + 145, totY + 4.2);

    // ------------------------------------------------------------------------
    // 5. SECTION C: Holistic Life Skill Domains Assessment (14 Categories)
    // ------------------------------------------------------------------------
    const holStartY = 104;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(
      'SECTION C: 14 HOLISTIC LIFE SKILLS & COGNITIVE-AFFECTIVE DOMAINS (NEP 2020)',
      margin,
      holStartY - 1.5
    );

    const holHalfWidth = (contentWidth - 4) / 2;
    const holRowHeight = 6.8;

    // Render 14 categories in 2 columns (7 per column)
    HOLISTIC_ASSESSMENT_CATEGORIES.forEach((cat, cIdx) => {
      const isRightCol = cIdx >= 7;
      const colX = isRightCol ? margin + holHalfWidth + 4 : margin;
      const rowIndex = isRightCol ? cIdx - 7 : cIdx;
      const cY = holStartY + rowIndex * holRowHeight;

      const rating = hol.ratings[cat.id] || 'Good';

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.rect(colX, cY, holHalfWidth, holRowHeight - 1, 'FD');

      // Domain Category Name
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(6.8);
      doc.text(`${cIdx + 1}. ${cat.name}`, colX + 2, cY + 4);

      // Rating badge color determination
      let ratingBg = [224, 231, 255]; // indigo-100 default
      let ratingText = [67, 56, 202]; // indigo-700
      if (rating === 'Outstanding') {
        ratingBg = [209, 250, 229]; // emerald-100
        ratingText = [4, 120, 87]; // emerald-700
      } else if (rating === 'Very Good') {
        ratingBg = [219, 234, 254]; // blue-100
        ratingText = [29, 78, 216]; // blue-700
      } else if (rating === 'Developing') {
        ratingBg = [254, 243, 199]; // amber-100
        ratingText = [180, 83, 9]; // amber-700
      } else if (rating === 'Needs Support') {
        ratingBg = [255, 228, 230]; // rose-100
        ratingText = [190, 18, 60]; // rose-700
      }

      doc.setFillColor(ratingBg[0], ratingBg[1], ratingBg[2]);
      doc.roundedRect(colX + holHalfWidth - 26, cY + 1, 24, 4, 1, 1, 'F');
      doc.setTextColor(ratingText[0], ratingText[1], ratingText[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.2);
      doc.text(rating, colX + holHalfWidth - 14, cY + 3.8, { align: 'center' });
    });

    // ------------------------------------------------------------------------
    // 6. SECTION D & E: Comprehensive Observations & Action Plan
    // ------------------------------------------------------------------------
    const obsY = 156;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text('SECTION D & E: COMPREHENSIVE TEACHER OBSERVATIONS & GROWTH PLAN', margin, obsY - 1.5);

    const boxW = (contentWidth - 4) / 2;

    // Box 1: Student Strengths
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.rect(margin, obsY, boxW, 14, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(4, 120, 87);
    doc.setFontSize(6.8);
    doc.text('Notable Strengths & Talents:', margin + 2.5, obsY + 3.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(doc.splitTextToSize(hol.strengths, boxW - 5), margin + 2.5, obsY + 7);

    // Box 2: Areas for Improvement
    doc.setFillColor(248, 250, 252);
    doc.rect(margin + boxW + 4, obsY, boxW, 14, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(180, 83, 9);
    doc.text('Areas for Improvement & Remedial Focus:', margin + boxW + 6.5, obsY + 3.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(doc.splitTextToSize(hol.areasForImprovement, boxW - 5), margin + boxW + 6.5, obsY + 7);

    // Box 3: Teacher's General Remarks (single-line auto-fit layout)
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, obsY + 16, boxW, 14, 'FD');
    const teacherRemarkBody = (
      hol.teacherRemarks ||
      'Diligent learner demonstrating steady holistic growth across academic and Co-Scholastic activities.'
    )
      .replace(/\s+/g, ' ')
      .trim();
    const remarkPrefix = /^teacher remarks:/i.test(teacherRemarkBody) ? '' : 'Teacher Remarks: ';
    const fullRemarkSingleLine = `${remarkPrefix}${teacherRemarkBody}`;
    const maxRemarkWidth = boxW - 5;
    let remarkFontSize = 7.2;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(remarkFontSize);
    while (remarkFontSize > 4.2 && doc.getTextWidth(fullRemarkSingleLine) > maxRemarkWidth) {
      remarkFontSize = Number((remarkFontSize - 0.15).toFixed(2));
      doc.setFontSize(remarkFontSize);
    }
    if (remarkPrefix) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text(remarkPrefix, margin + 2.5, obsY + 23.8);
      const prefixWidth = doc.getTextWidth(remarkPrefix);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(teacherRemarkBody, margin + 2.5 + prefixWidth, obsY + 23.8);
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(fullRemarkSingleLine, margin + 2.5, obsY + 23.8);
    }
    doc.setFontSize(6.5);

    // Box 4: Suggestions for Parents & Next Term Goals
    doc.setFillColor(248, 250, 252);
    doc.rect(margin + boxW + 4, obsY + 16, boxW, 14, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Parent Remarks, Goals & Overall Development:', margin + boxW + 6.5, obsY + 19.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    const parentNotes = `${hol.parentRemarks || hol.suggestionsForParents} | Goal: ${hol.goalsForNextTerm}${hol.overallStudentDevelopment ? ` | ${hol.overallStudentDevelopment}` : ''}`;
    doc.text(doc.splitTextToSize(parentNotes, boxW - 5), margin + boxW + 6.5, obsY + 23);

    // ------------------------------------------------------------------------
    // 7. SECTION F: Official Institutional Signatures
    // ------------------------------------------------------------------------
    const sigY = 194;
    doc.setDrawColor(30, 41, 59);
    doc.setLineWidth(0.4);
    doc.line(margin, sigY, margin + contentWidth, sigY);

    const sigColW = contentWidth / 3;

    // Signature 1: Class Teacher
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text('Nazir Ahmad Dar (Teacher)', margin + sigColW / 2, sigY + 9, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Class Teacher Signature', margin + sigColW / 2, sigY + 13, { align: 'center' });

    // Signature 2: Official School Stamp (middle column)
    if (school.officialStampDataUrl) {
      try {
        doc.addImage(
          school.officialStampDataUrl,
          inferImageFormat(school.officialStampDataUrl),
          margin + sigColW * 1.5 - 11,
          sigY - 4,
          22,
          12
        );
      } catch {
        // Fallback if invalid image data URL
      }
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(
      school.officialStampDataUrl ? '' : '_________________________',
      margin + sigColW * 1.5,
      sigY + 9,
      { align: 'center' }
    );
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Parent Signature / Official Stamp', margin + sigColW * 1.5, sigY + 13, { align: 'center' });

    // Signature 3: Headmaster Only (Developer name strictly excluded from all HPC documents)
    const headmasterDisplayName = school.headmasterName || school.headTeacherName || 'Headmaster';
    if (school.headmasterSignatureDataUrl) {
      try {
        doc.addImage(
          school.headmasterSignatureDataUrl,
          inferImageFormat(school.headmasterSignatureDataUrl),
          margin + sigColW * 2.5 - 14,
          sigY - 4,
          28,
          10
        );
      } catch {
        // Fallback if invalid image data URL
      }
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(
      headmasterDisplayName,
      margin + sigColW * 2.5,
      sigY + 9,
      { align: 'center' }
    );
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `${school.principalDesignation || 'Headmaster'} • Official Seal & Signature`,
      margin + sigColW * 2.5,
      sigY + 13,
      { align: 'center' }
    );

    // ------------------------------------------------------------------------
    // 8. PAGE FOOTER
    // ------------------------------------------------------------------------
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);
    doc.line(margin, pageHeight - 11, margin + contentWidth, pageHeight - 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Class ${classNumber}-${section} • Academic Session ${school.academicSession} • NEP 2020 Holistic Progress Card`,
      margin,
      pageHeight - 8
    );
    doc.text(
      `Student ${index + 1} of ${totalPages} | Consolidated Document`,
      pageWidth - margin,
      pageHeight - 8,
      { align: 'right' }
    );
  });

  const fileName =
    customFileName ||
    `Class_${classNumber}_${section}_Holistic_Progress_Cards_${school.academicSession.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
  doc.save(fileName);
}

async function loadImageElement(src?: string): Promise<HTMLImageElement | null> {
  if (!src) return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Generates high-resolution, print-ready JPEG Holistic Progress Cards for a single student,
 * multiple selected students, or an entire class. Displays ONLY the Headmaster's Name
 * in the authority signature block (zero developer name).
 */
export async function generateHpcCardsJpegBatch(
  options: BatchClassProgressCardPdfOptions
): Promise<number> {
  const {
    school,
    examination,
    studentSummaries,
    students,
    marksEntries,
    holisticRecords,
    classNumber,
    section,
    selectedStudentIds,
  } = options;

  const uniqueStudents = deduplicateStudentsByAdmissionNumber(students);
  const selectedSet = selectedStudentIds && selectedStudentIds.length > 0 ? new Set(selectedStudentIds) : null;
  const targets = studentSummaries.filter((sum) => !selectedSet || selectedSet.has(sum.studentId));
  if (targets.length === 0) return 0;

  const schoolLogoImg = await loadImageElement(school.logoDataUrl);
  const headmasterSigImg = await loadImageElement(school.headmasterSignatureDataUrl);
  const headmasterDisplayName = school.headmasterName || school.headTeacherName || 'Headmaster';
  const formattedAddress = formatSchoolAddressOnce(school);

  let exportedCount = 0;

  for (const summary of targets) {
    const student = uniqueStudents.find((s) => s.id === summary.studentId);
    const studentPhotoImg = await loadImageElement(student?.photoDataUrl);
    const hol = holisticRecords?.[summary.studentId] || sampleHolisticRecords[summary.studentId];

    const canvas = document.createElement('canvas');
    canvas.width = 1240;
    canvas.height = 1754;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    // White print page background + double formal border
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 5;
    ctx.strokeRect(36, 36, canvas.width - 72, canvas.height - 72);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(48, 48, canvas.width - 96, canvas.height - 96);

    // School Header Banner (Aspect-Ratio Safe Logo + Dedicated Non-Overlapping Text Area)
    ctx.fillStyle = '#0f294a';
    ctx.fillRect(68, 68, canvas.width - 136, 162);

    let textAreaLeft = 92;
    const textAreaRight = canvas.width - 92;

    if (schoolLogoImg) {
      ctx.save();
      const boxX = 88;
      const boxY = 86;
      const boxSize = 126;
      const innerPad = 10;
      const maxLogoDim = boxSize - innerPad * 2;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(boxX, boxY, boxSize, boxSize);
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 3;
      ctx.strokeRect(boxX, boxY, boxSize, boxSize);

      const natW = schoolLogoImg.naturalWidth || schoolLogoImg.width || maxLogoDim;
      const natH = schoolLogoImg.naturalHeight || schoolLogoImg.height || maxLogoDim;
      const aspect = natW / natH;
      let drawW = maxLogoDim;
      let drawH = maxLogoDim;
      if (aspect >= 1) {
        drawW = maxLogoDim;
        drawH = maxLogoDim / aspect;
      } else {
        drawH = maxLogoDim;
        drawW = maxLogoDim * aspect;
      }

      const drawX = boxX + (boxSize - drawW) / 2;
      const drawY = boxY + (boxSize - drawH) / 2;
      ctx.drawImage(schoolLogoImg, drawX, drawY, drawW, drawH);
      ctx.restore();

      // Reserve clear margin to the right of the logo box so text never overlaps
      textAreaLeft = boxX + boxSize + 28;
    }

    const textAreaWidth = textAreaRight - textAreaLeft;
    const textCenterX = textAreaLeft + textAreaWidth / 2;

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 33px sans-serif';
    ctx.fillText(school.name.toUpperCase(), textCenterX, 128, textAreaWidth);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '20px sans-serif';
    ctx.fillText(`${formattedAddress}  |  U-DISE: ${school.code}`, textCenterX, 166, textAreaWidth);
    ctx.fillStyle = '#fde68a';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(
      `HOLISTIC PROGRESS CARD (HPC) • SESSION ${school.academicSession} • ${examination.name.toUpperCase()}`,
      textCenterX,
      204,
      textAreaWidth
    );

    // Student Profile Card + Photograph
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(68, 244, canvas.width - 136, 178);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.strokeRect(68, 244, canvas.width - 136, 178);

    const photoX = canvas.width - 216;
    const photoY = 262;
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(photoX, photoY, 130, 142);
    if (studentPhotoImg) {
      ctx.drawImage(studentPhotoImg, photoX, photoY, 130, 142);
    } else {
      ctx.fillStyle = '#64748b';
      ctx.textAlign = 'center';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('STUDENT', photoX + 65, photoY + 64);
      ctx.fillText('PHOTO', photoX + 65, photoY + 86);
    }

    ctx.textAlign = 'left';
    const bioRows: Array<[string, string, string, string]> = [
      ['Student Name:', summary.studentName, 'Admission No:', student?.admissionNumber || summary.studentId],
      ["Father's Name:", student?.fatherName || '—', 'Class & Section:', `Class ${classNumber}-${section} (Roll #${summary.rollNumber})`],
      ["Mother's Name:", student?.motherName || '—', 'Date of Birth:', student?.dob || '—'],
      ['Overall Grade:', `${summary.overallGrade} (${summary.percentage.toFixed(1)}%)`, 'Result Status:', summary.isPassed ? 'PASSED / PROMOTED' : 'NEEDS SUPPORT'],
    ];
    bioRows.forEach((row, rIdx) => {
      const y = 286 + rIdx * 36;
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(row[0], 92, y);
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(row[1], 246, y);

      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(row[2], 580, y);
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(row[3], 748, y);
    });

    // Academic Marks Table
    let cursorY = 456;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(68, cursorY, canvas.width - 136, 46);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('SUBJECT', 92, cursorY + 30);
    ctx.fillText('OBTAINED', 650, cursorY + 30);
    ctx.fillText('MAX MARKS', 820, cursorY + 30);
    ctx.fillText('GRADE', 1020, cursorY + 30);
    cursorY += 46;

    const subjectList = sampleSubjectConfigs.slice(0, 6).map((sub) => {
      const entry = marksEntries.find(
        (m) => m.studentId === summary.studentId && m.examId === examination.id && m.subjectCode === sub.code
      );
      const obtained =
        entry && entry.marksObtained !== null
          ? entry.marksObtained
          : Math.round((summary.percentage / 100) * (sub.maxMarks || 100));
      return {
        name: sub.name,
        obtained,
        max: sub.maxMarks || 100,
      };
    });

    subjectList.forEach((sub, sIdx) => {
      ctx.fillStyle = sIdx % 2 === 0 ? '#ffffff' : '#f8fafc';
      ctx.fillRect(68, cursorY, canvas.width - 136, 46);
      ctx.strokeStyle = '#e2e8f0';
      ctx.strokeRect(68, cursorY, canvas.width - 136, 46);

      const pct = sub.max > 0 ? (sub.obtained / sub.max) * 100 : 0;
      const grade = pct >= 90 ? 'A+' : pct >= 75 ? 'A' : pct >= 60 ? 'B' : pct >= 45 ? 'C' : 'D';

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 19px sans-serif';
      ctx.fillText(sub.name, 92, cursorY + 30);
      ctx.fillText(String(sub.obtained), 670, cursorY + 30);
      ctx.fillText(String(sub.max), 845, cursorY + 30);
      ctx.fillStyle = '#3730a3';
      ctx.fillText(grade, 1035, cursorY + 30);
      cursorY += 46;
    });

    // Total Summary Bar
    ctx.fillStyle = '#eef2ff';
    ctx.fillRect(68, cursorY, canvas.width - 136, 52);
    ctx.strokeStyle = '#a5b4fc';
    ctx.strokeRect(68, cursorY, canvas.width - 136, 52);
    ctx.fillStyle = '#1e1b4b';
    ctx.font = 'bold 21px sans-serif';
    ctx.fillText(
      `TOTAL: ${summary.totalMarksObtained} / ${summary.totalMaxMarks}   •   PERCENTAGE: ${summary.percentage.toFixed(1)}%   •   GRADE: ${summary.overallGrade}`,
      92,
      cursorY + 33
    );
    cursorY += 80;

    // Holistic Domains & Observations
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('HOLISTIC ASSESSMENT & TEACHER OBSERVATIONS', 68, cursorY);
    cursorY += 16;

    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(68, cursorY, canvas.width - 136, 260);
    ctx.strokeStyle = '#cbd5e1';
    ctx.strokeRect(68, cursorY, canvas.width - 136, 260);

    const ratingsEntries = HOLISTIC_ASSESSMENT_CATEGORIES.slice(0, 6);
    ratingsEntries.forEach((cat, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const x = 92 + col * 540;
      const y = cursorY + 42 + row * 40;
      const val = hol?.ratings?.[cat.id] || 'Very Good';
      ctx.fillStyle = '#475569';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(`${cat.name}:`, x, y);
      ctx.fillStyle = '#047857';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(val, x + 280, y);
    });

    const remarkBodyCanvas = (
      hol?.teacherRemarks ||
      'Diligent learner demonstrating steady holistic growth across academic and Co-Scholastic activities.'
    )
      .replace(/\s+/g, ' ')
      .trim();
    const remarkPrefixCanvas = /^teacher remarks:/i.test(remarkBodyCanvas) ? '' : 'Teacher Remarks: ';
    const remarksText = `${remarkPrefixCanvas}${remarkBodyCanvas}`;
    const maxCanvasRemarksWidth = canvas.width - 184;
    let canvasRemarkSize = 18;
    ctx.font = `${canvasRemarkSize}px sans-serif`;
    while (canvasRemarkSize > 10 && ctx.measureText(remarksText).width > maxCanvasRemarksWidth) {
      canvasRemarkSize -= 0.5;
      ctx.font = `${canvasRemarkSize}px sans-serif`;
    }
    if (remarkPrefixCanvas) {
      ctx.fillStyle = '#1e293b';
      ctx.font = `bold ${canvasRemarkSize}px sans-serif`;
      ctx.fillText(remarkPrefixCanvas, 92, cursorY + 196);
      const prefixW = ctx.measureText(remarkPrefixCanvas).width;
      ctx.fillStyle = '#334155';
      ctx.font = `${canvasRemarkSize}px sans-serif`;
      ctx.fillText(remarkBodyCanvas, 92 + prefixW, cursorY + 196);
    } else {
      ctx.fillStyle = '#334155';
      ctx.font = `${canvasRemarkSize}px sans-serif`;
      ctx.fillText(remarksText, 92, cursorY + 196);
    }

    // Signatures Footer (ONLY Headmaster's Name — NO developer name)
    const sigBaseY = canvas.height - 170;
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(68, sigBaseY - 40);
    ctx.lineTo(canvas.width - 68, sigBaseY - 40);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('Class Teacher', 260, sigBaseY + 34);
    ctx.fillStyle = '#64748b';
    ctx.font = '17px sans-serif';
    ctx.fillText('Signature & Date', 260, sigBaseY + 62);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('Parent / Guardian', canvas.width / 2, sigBaseY + 34);
    ctx.fillStyle = '#64748b';
    ctx.font = '17px sans-serif';
    ctx.fillText('Signature & Stamp', canvas.width / 2, sigBaseY + 62);

    if (headmasterSigImg) {
      ctx.drawImage(headmasterSigImg, canvas.width - 330, sigBaseY - 26, 140, 44);
    }
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 21px sans-serif';
    ctx.fillText(headmasterDisplayName, canvas.width - 260, sigBaseY + 34);
    ctx.fillStyle = '#475569';
    ctx.font = 'bold 17px sans-serif';
    ctx.fillText(`${school.principalDesignation || 'Headmaster'} • Seal & Signature`, canvas.width - 260, sigBaseY + 62);

    const safeName = `${summary.studentName}_${student?.admissionNumber || summary.studentId}`
      .replace(/[^a-zA-Z0-9_-]/g, '_');
    const dataUrl = canvas.toDataURL('image/jpeg', 0.94);
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `HPC_Class_${classNumber}_${section}_${safeName}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    exportedCount++;

    if (targets.length > 1) {
      await new Promise((r) => setTimeout(r, 180));
    }
  }

  return exportedCount;
}
