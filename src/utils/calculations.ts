import { GradeBoundary, Holiday, SchoolProfile, Student, StudentExamSummary, StudentMarkEntry, SubjectConfig, TeacherPerformanceReport } from '../types';

/**
 * Normalizes a student's primary key (`admissionNumber` with `id` fallback)
 * for strict duplicate detection and merging across all modules.
 */
export function getStudentPrimaryKey(student: Pick<Student, 'admissionNumber' | 'id'>): string {
  const adm = (student.admissionNumber || '').trim().toUpperCase();
  if (adm) return adm;
  return (student.id || '').trim().toUpperCase();
}

/**
 * Enforces `admissionNumber` (and unique `id`) as primary key across student arrays,
 * merging non-empty fields from later entries onto earlier ones so no records are duplicated.
 */
export function deduplicateStudentsByAdmissionNumber(students: Student[]): Student[] {
  const byPrimaryKey = new Map<string, Student>();
  const seenIds = new Set<string>();

  for (const raw of students) {
    if (!raw) continue;
    const pk = getStudentPrimaryKey(raw);
    if (!pk) continue;

    const existing = byPrimaryKey.get(pk);
    if (existing) {
      // Merge non-empty updated fields while preserving the canonical record id
      byPrimaryKey.set(pk, {
        ...existing,
        ...raw,
        id: existing.id || raw.id,
        admissionNumber: (raw.admissionNumber || existing.admissionNumber).trim(),
        fullName: raw.fullName?.trim() || existing.fullName,
        fatherName: raw.fatherName?.trim() || existing.fatherName,
        motherName: raw.motherName?.trim() || existing.motherName,
        mobileNumber: raw.mobileNumber?.trim() || existing.mobileNumber,
        dob: raw.dob?.trim() || existing.dob,
        address: raw.address?.trim() || existing.address,
      });
    } else {
      let safeId = (raw.id || '').trim();
      if (!safeId || seenIds.has(safeId)) {
        safeId = `SM-${pk.replace(/[^A-Z0-9]/g, '')}`;
        let suffix = 1;
        while (seenIds.has(safeId)) {
          safeId = `SM-${pk.replace(/[^A-Z0-9]/g, '')}-${suffix++}`;
        }
      }
      seenIds.add(safeId);
      byPrimaryKey.set(pk, {
        ...raw,
        id: safeId,
        admissionNumber: (raw.admissionNumber || safeId).trim(),
      });
    }
  }

  return Array.from(byPrimaryKey.values());
}

/**
 * Deduplicates marks entries by composite key (examId + studentId + subjectCode),
 * retaining the most recent entry.
 */
export function deduplicateMarksEntries(entries: StudentMarkEntry[]): StudentMarkEntry[] {
  const map = new Map<string, StudentMarkEntry>();
  for (const entry of entries) {
    if (!entry) continue;
    const key = `${entry.examId}::${entry.studentId}::${entry.subjectCode}`;
    map.set(key, entry);
  }
  return Array.from(map.values());
}

export const OFFICIAL_SCHOOL_ADDRESS = 'Pamposh Colony, Palapora Zone, Iddgah';

export function isLegacySchoolAddress(address?: string | null): boolean {
  if (!address) return false;
  const lower = address.trim().toLowerCase();
  if (!lower) return false;
  return (
    (lower.includes('pamposh colony') &&
      (lower.includes('palpora') ||
        lower.includes('tehsil iddgah') ||
        lower.includes('190017') ||
        lower.includes('district srinagar'))) ||
    lower === 'pamposh colony, srinagar'
  );
}

/**
 * Formats the school address cleanly.
 * Automatically normalizes the legacy Pamposh Colony / Palpora / 190017 address
 * to the updated official address: "Pamposh Colony, Palapora Zone, Iddgah".
 */
export function formatSchoolAddressOnce(
  school: Pick<SchoolProfile, 'address' | 'district' | 'state' | 'pinCode'>
): string {
  const rawAddress = (school.address || '').trim().replace(/\s+/g, ' ');
  const lowerRaw = rawAddress.toLowerCase();

  if (
    !rawAddress ||
    lowerRaw === OFFICIAL_SCHOOL_ADDRESS.toLowerCase() ||
    lowerRaw === `${OFFICIAL_SCHOOL_ADDRESS.toLowerCase()}.` ||
    isLegacySchoolAddress(rawAddress)
  ) {
    return OFFICIAL_SCHOOL_ADDRESS;
  }

  return rawAddress.replace(/\.$/, '');
}

/**
 * Generates an organized 7-field text payload for a student's QR code.
 */
export function buildStudentQrPayload(student: Student, school: SchoolProfile): string {
  const schoolAddress = formatSchoolAddressOnce(school);
  return [
    `1. Student Name: ${student.fullName || 'N/A'}`,
    `2. Father's Name / Parentage: ${student.fatherName || 'N/A'}`,
    `3. Date of Birth (D.O.B.): ${student.dob || 'N/A'}`,
    `4. Admission Number: ${student.admissionNumber || student.id || 'N/A'}`,
    `5. Student Mobile Number: ${student.mobileNumber || student.parentWhatsAppNumber || 'N/A'}`,
    `6. School Name: ${school.name || 'N/A'}`,
    `7. Complete School Address: ${schoolAddress || 'N/A'}`,
  ].join('\n');
}

/**
 * Extracts Admission Number or Student ID from plain string, JSON, or multi-line 7-field QR text.
 */
export function extractAdmissionOrIdFromQrText(rawInput: string): string {
  const raw = (rawInput || '').trim();
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return String(parsed.admissionNumber || parsed.id || parsed.rollNumber || '').trim();
    }
  } catch {
    // Multi-line or plain string
  }
  const admMatch = raw.match(/(?:Admission\s*(?:Number|No\.?)|SRN)\s*:\s*([^\r\n]+)/i);
  if (admMatch && admMatch[1]) {
    return admMatch[1].trim();
  }
  return raw;
}

/**
 * Calculates attendance percentage:
 * Attendance Percentage = (Days Present ÷ Total Applicable School Days) × 100
 * Rounded to 2 decimal places. Returns 0 if totalSchoolDays is 0.
 */
export function calculateAttendancePercentage(daysPresent: number, totalSchoolDays: number): number {
  if (totalSchoolDays <= 0) return 0;
  const percentage = (daysPresent / totalSchoolDays) * 100;
  return Math.min(100, Math.round(percentage * 100) / 100);
}

/**
 * Computes scheduled school working days for a given month and year,
 * excluding Sundays, 2nd & 4th Saturdays, and configured holidays.
 */
export function getMonthlyWorkingDays(year: number, monthIndex: number, holidays: Holiday[]): {
  workingDays: number;
  dates: { dateStr: string; dayOfMonth: number; isHoliday: boolean; holidayName?: string }[];
} {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const dates = [];
  let workingDays = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, monthIndex, day);
    const dayOfWeek = d.getDay(); // 0 is Sunday, 6 is Saturday
    const dateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    // Check if Sunday
    const isSunday = dayOfWeek === 0;
    
    // Check if 2nd or 4th Saturday
    let isSecondOrFourthSaturday = false;
    if (dayOfWeek === 6) {
      const weekOfMonth = Math.ceil(day / 7);
      if (weekOfMonth === 2 || weekOfMonth === 4) {
        isSecondOrFourthSaturday = true;
      }
    }

    // Check holiday list
    const matchedHoliday = holidays.find(h => h.date === dateStr);

    const isNonWorking = isSunday || isSecondOrFourthSaturday || !!matchedHoliday;

    let holidayLabel: string | undefined = undefined;
    if (isSunday) holidayLabel = 'Sunday';
    else if (isSecondOrFourthSaturday) holidayLabel = '2nd/4th Saturday';
    else if (matchedHoliday) holidayLabel = matchedHoliday.name;

    if (!isNonWorking) {
      workingDays++;
    }

    dates.push({
      dateStr,
      dayOfMonth: day,
      isHoliday: isNonWorking,
      holidayName: holidayLabel,
    });
  }

  return { workingDays, dates };
}

/**
 * Calculates grade based on configured scale
 */
export function getGradeFromPercentage(
  percentage: number,
  scale: GradeBoundary[]
): { grade: string; remark: string; remarkHi?: string; remarkUrdu?: string; points: number } {
  // Sort scale descending by minPercentage
  const sorted = [...scale].sort((a, b) => b.minPercentage - a.minPercentage);
  for (const boundary of sorted) {
    if (percentage >= boundary.minPercentage) {
      return {
        grade: boundary.grade,
        remark: boundary.remark,
        remarkHi: boundary.remarkHi,
        remarkUrdu: boundary.remarkUrdu,
        points: boundary.points,
      };
    }
  }
  const lowest = sorted[sorted.length - 1];
  return {
    grade: lowest ? lowest.grade : 'E',
    remark: lowest ? lowest.remark : 'Needs Improvement',
    remarkHi: lowest?.remarkHi || 'सुधार की आवश्यकता',
    remarkUrdu: lowest?.remarkUrdu || 'بہتری کی ضرورت ہے',
    points: 0,
  };
}

export const calculateGradeFromPercentage = getGradeFromPercentage;

/**
 * Calculates Student Exam Summary
 * Handles absent marks, compulsory subject rules, total marks, percentage and grades
 */
export function calculateStudentExamSummary(
  studentId: string,
  studentName: string,
  rollNumber: number,
  classNumber: string,
  section: string,
  examId: string,
  examName: string,
  marks: StudentMarkEntry[],
  subjects: SubjectConfig[],
  scale: GradeBoundary[],
  attendancePercentage: number = 92.5
): StudentExamSummary {
  let totalMaxMarks = 0;
  let totalMarksObtained = 0;
  let compulsoryFailed = false;
  let anySubjectFailed = false;

  let totalGradePoints = 0;

  const subjectMarksList = subjects.map(sub => {
    const entry = marks.find(m => m.studentId === studentId && m.subjectCode === sub.code);
    const max = sub.maxMarks || 100;
    totalMaxMarks += max;

    const isAbsent = entry ? entry.isAbsent : false;
    const marksObtained = entry && !isAbsent ? (entry.marksObtained ?? 0) : null;
    
    if (marksObtained !== null) {
      totalMarksObtained += marksObtained;
    }

    const subPercentage = marksObtained !== null ? (marksObtained / max) * 100 : 0;
    const subGradeInfo = getGradeFromPercentage(subPercentage, scale);
    const passed = !isAbsent && (marksObtained !== null ? marksObtained >= sub.passingMarks : false);
    const gradePoints = isAbsent ? 0 : subGradeInfo.points;
    totalGradePoints += gradePoints;

    if (sub.isCompulsory && !passed) {
      compulsoryFailed = true;
    }
    if (!passed) {
      anySubjectFailed = true;
    }

    return {
      subjectCode: sub.code,
      subjectName: sub.name,
      maxMarks: max,
      marksObtained,
      isAbsent,
      grade: isAbsent ? 'AB' : subGradeInfo.grade,
      gradePoints,
      passed,
    };
  });

  const percentage = totalMaxMarks > 0 ? (totalMarksObtained / totalMaxMarks) * 100 : 0;
  const roundedPercentage = Math.round(percentage * 100) / 100;
  const overallGradeInfo = getGradeFromPercentage(roundedPercentage, scale);
  const averageGradePoints = subjectMarksList.length > 0
    ? Math.round((totalGradePoints / subjectMarksList.length) * 100) / 100
    : 0;

  // If failed a compulsory subject, overall result is not passed
  const isPassed = !compulsoryFailed && roundedPercentage >= 33;

  return {
    studentId,
    studentName,
    rollNumber,
    classNumber,
    section,
    examId,
    examName,
    totalMaxMarks,
    totalMarksObtained,
    percentage: roundedPercentage,
    overallGrade: overallGradeInfo.grade,
    isPassed,
    compulsoryFailed,
    attendancePercentage,
    totalGradePoints,
    averageGradePoints,
    subjectMarks: subjectMarksList,
  };
}

/**
 * Calculates Subject-Wise Teacher Performance
 */
export function calculateTeacherSubjectPerformance(
  teacherId: string,
  teacherName: string,
  employeeId: string,
  subjectName: string,
  subjectCode: string,
  classNumber: string,
  section: string,
  examName: string,
  enrolledStudentsCount: number,
  marksEntries: StudentMarkEntry[],
  passingMarks: number,
  scale: GradeBoundary[]
): TeacherPerformanceReport {
  const relevantMarks = marksEntries.filter(m => m.subjectCode === subjectCode && m.classNumber === classNumber && m.section === section);
  
  const assessedStudents = relevantMarks.filter(m => !m.isAbsent && m.marksObtained !== null);
  const absentStudents = relevantMarks.filter(m => m.isAbsent).length;
  
  let passedCount = 0;
  let failedCount = 0;
  let sumMarks = 0;
  let highestMarks = 0;
  let lowestMarks = 1000;
  const gradeDistribution: { [grade: string]: number } = {};

  scale.forEach(s => { gradeDistribution[s.grade] = 0; });

  assessedStudents.forEach(m => {
    const mark = m.marksObtained ?? 0;
    sumMarks += mark;
    if (mark > highestMarks) highestMarks = mark;
    if (mark < lowestMarks) lowestMarks = mark;

    if (mark >= passingMarks) {
      passedCount++;
    } else {
      failedCount++;
    }

    const pct = m.maxMarks > 0 ? (mark / m.maxMarks) * 100 : 0;
    const gr = getGradeFromPercentage(pct, scale);
    gradeDistribution[gr.grade] = (gradeDistribution[gr.grade] || 0) + 1;
  });

  if (assessedStudents.length === 0) {
    lowestMarks = 0;
  }

  const assessedCount = assessedStudents.length;
  const passPercentage = assessedCount > 0 ? Math.round((passedCount / assessedCount) * 10000) / 100 : 0;
  const averageMarks = assessedCount > 0 ? Math.round((sumMarks / assessedCount) * 10) / 10 : 0;
  const maxMarkSample = relevantMarks[0]?.maxMarks || 100;
  const averagePercentage = maxMarkSample > 0 ? Math.round((averageMarks / maxMarkSample) * 10000) / 100 : 0;

  return {
    teacherId,
    teacherName,
    employeeId,
    subjectName,
    classNumber,
    section,
    examName,
    enrolledStudents: enrolledStudentsCount,
    assessedStudents: assessedCount,
    passedStudents: passedCount,
    failedStudents: failedCount,
    absentStudents,
    passPercentage,
    averageMarks,
    averagePercentage,
    highestMarks: assessedCount > 0 ? highestMarks : 0,
    lowestMarks: assessedCount > 0 ? lowestMarks : 0,
    gradeDistribution,
  };
}

/**
 * Aadhaar Masking & UIDAI Compliance Helper:
 * Ensures full 12-digit Aadhaar numbers are never displayed or stored in plaintext.
 * Returns XXXX-XXXX-1234
 */
export function maskAadhaarNumber(input: string): string {
  const digitsOnly = input.replace(/\D/g, '');
  if (digitsOnly.length < 4) return 'XXXX-XXXX-****';
  const last4 = digitsOnly.slice(-4);
  return `XXXX-XXXX-${last4}`;
}

export function validateAadhaarFormat(input: string): boolean {
  const digitsOnly = input.replace(/\D/g, '');
  // Aadhaar is 12 digits, does not start with 0 or 1
  return digitsOnly.length === 12 && !['0', '1'].includes(digitsOnly[0]);
}

/**
 * Calculates straight-line surface distance between two GPS coordinates in meters
 * using the Haversine formula.
 */
export function calculateHaversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

/**
 * Checks if a teacher's location coordinate is within the school campus geofence boundary.
 */
export function isWithinSchoolGeofence(
  teacherLat: number,
  teacherLon: number,
  schoolLat: number,
  schoolLon: number,
  radiusMeters: number = 250
): { isWithin: boolean; distanceMeters: number } {
  const distanceMeters = calculateHaversineDistanceMeters(teacherLat, teacherLon, schoolLat, schoolLon);
  return {
    isWithin: distanceMeters <= radiusMeters,
    distanceMeters,
  };
}

/**
 * JKHRMS Official Date Calculation: Automatic Retirement Date
 * Based on Jammu and Kashmir Civil Services Regulations (CSR Rule 60 Years):
 * - Normal Superannuation Age: 60 years.
 * - Effective retirement date: Afternoon of the last day of the month in which the employee attains age 60.
 * - Exception: If the date of birth is the 1st of the month, the employee retires on the afternoon
 *   of the last day of the preceding month.
 */
export function calculateJKRetirementDate(dobStr: string): {
  retirementDate: string;
  isFirstOfMonthException: boolean;
  explanation: string;
} {
  if (!dobStr) {
    return { retirementDate: '', isFirstOfMonthException: false, explanation: 'Date of birth not provided' };
  }

  const parts = dobStr.split('-');
  if (parts.length !== 3) {
    return { retirementDate: '', isFirstOfMonthException: false, explanation: 'Invalid date format' };
  }

  const birthYear = parseInt(parts[0], 10);
  const birthMonth = parseInt(parts[1], 10); // 1 - 12
  const birthDay = parseInt(parts[2], 10);

  const retirementYear = birthYear + 60;
  let targetYear = retirementYear;
  let targetMonth = birthMonth;
  let isFirstOfMonthException = false;

  if (birthDay === 1) {
    // 1st of Month Exception: Retires on the last day of the preceding month
    isFirstOfMonthException = true;
    targetMonth = birthMonth - 1;
    if (targetMonth === 0) {
      targetMonth = 12;
      targetYear = retirementYear - 1;
    }
  }

  // Get last day of the target month
  const lastDay = new Date(targetYear, targetMonth, 0).getDate();
  const retirementDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const explanation = isFirstOfMonthException
    ? `J&K CSR Rule: Born on 1st of the month — superannuates on the afternoon of the last day of the preceding month (${retirementDate}).`
    : `J&K CSR Rule (60 Years): Superannuates on the afternoon of the last day of the birth month (${retirementDate}).`;

  return {
    retirementDate,
    isFirstOfMonthException,
    explanation,
  };
}

/**
 * Calculates exact duration between two dates in Years, Months, and Days.
 * Used for:
 * 1. Total Department Service (from dateOfJoiningDepartment to current date)
 * 2. Present School Tenure (from dateOfJoiningPresentSchool to current date)
 * 3. Teacher Age (from DOB to current date)
 */
export function calculateServiceDuration(
  startDateStr: string,
  endDateStr?: string
): {
  years: number;
  months: number;
  days: number;
  formatted: string;
} {
  if (!startDateStr) {
    return { years: 0, months: 0, days: 0, formatted: '0 Years, 0 Months, 0 Days' };
  }

  const startDate = new Date(startDateStr);
  const endDate = endDateStr ? new Date(endDateStr) : new Date();

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || endDate < startDate) {
    return { years: 0, months: 0, days: 0, formatted: '0 Years, 0 Months, 0 Days' };
  }

  let years = endDate.getFullYear() - startDate.getFullYear();
  let months = endDate.getMonth() - startDate.getMonth();
  let days = endDate.getDate() - startDate.getDate();

  if (days < 0) {
    // Borrow days from previous month
    months -= 1;
    const prevMonthLastDay = new Date(endDate.getFullYear(), endDate.getMonth(), 0).getDate();
    days += prevMonthLastDay;
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const formatted = `${years} ${years === 1 ? 'Year' : 'Years'}, ${months} ${months === 1 ? 'Month' : 'Months'}, ${days} ${days === 1 ? 'Day' : 'Days'}`;

  return {
    years,
    months,
    days,
    formatted,
  };
}

/**
 * Calculates teacher's exact age in years, months, and days.
 */
export function calculateTeacherAge(dobStr: string, asOfDateStr?: string): {
  years: number;
  months: number;
  days: number;
  formatted: string;
} {
  return calculateServiceDuration(dobStr, asOfDateStr);
}


