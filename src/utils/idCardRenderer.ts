import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import {
  IdCardDesignConfig,
  IdCardFontStyle,
  IdCardQrPrivacySettings,
  IdCardStatus,
  IdCardTemplateId,
  SchoolIdCardRecord,
  SchoolProfile,
  Student,
  TeacherProfile,
} from '../types';
import { formatSchoolAddressOnce } from './calculations';

export interface IdCardTemplateMeta {
  id: IdCardTemplateId;
  name: string;
  orientation: 'horizontal' | 'vertical';
  defaultBg: string;
  defaultAccent: string;
  description: string;
}

export const ID_CARD_TEMPLATES: IdCardTemplateMeta[] = [
  {
    id: 'modern',
    name: 'Modern School ID Card',
    orientation: 'horizontal',
    defaultBg: '#ffffff',
    defaultAccent: '#1e3a8a',
    description: 'Clean executive layout with crisp top stripe, framed photo, and QR block.',
  },
  {
    id: 'premium',
    name: 'Premium Colour ID Card',
    orientation: 'vertical',
    defaultBg: '#0f172a',
    defaultAccent: '#d97706',
    description: 'Deep slate & amber gold high-contrast official vertical card.',
  },
  {
    id: 'horizontal',
    name: 'Horizontal ID Card',
    orientation: 'horizontal',
    defaultBg: '#f8fafc',
    defaultAccent: '#0f766e',
    description: 'Classic landscape CR80 card optimized for school lanyards & holders.',
  },
  {
    id: 'vertical',
    name: 'Vertical ID Card',
    orientation: 'vertical',
    defaultBg: '#ffffff',
    defaultAccent: '#4338ca',
    description: 'Standard portrait vertical school ID with centered portrait & QR footer.',
  },
  {
    id: 'student_classic',
    name: 'Student ID Card',
    orientation: 'vertical',
    defaultBg: '#ffffff',
    defaultAccent: '#0369a1',
    description: 'Structured student format highlighting Class, Roll No, Admission No & Session.',
  },
  {
    id: 'teacher_executive',
    name: 'Teacher ID Card',
    orientation: 'horizontal',
    defaultBg: '#ffffff',
    defaultAccent: '#065f46',
    description: 'Faculty & staff format highlighting Designation, Employee ID, Subject & Joining Date.',
  },
];

export const DEFAULT_QR_PRIVACY_SETTINGS: IdCardQrPrivacySettings = {
  showFatherName: true,
  showClassOrDesignation: true,
  showRollOrEmployeeId: true,
  showSchoolAddress: true,
  showResidentialAddress: false, // Confidential by default
  showContactNumber: false, // Confidential by default
  showParentContact: false,
  showDob: true,
  showBloodGroup: true,
  requireAdminForConfidential: true,
};

export function getDefaultDesignConfig(school: SchoolProfile): IdCardDesignConfig {
  const nextYear = new Date().getFullYear() + 1;
  return {
    templateId: 'modern',
    backgroundColor: '#ffffff',
    accentColor: '#1e3a8a',
    textColor: '#0f172a',
    fontStyle: 'jakarta',
    fontSize: 'standard',
    showMotto: true,
    motto: school.motto || 'Knowledge • Discipline • Excellence',
    emergencyContact: school.emergencyContact || school.contactNumber || '+91 94190 12345',
    defaultValidityDate: `${nextYear}-03-31`,
    schoolLogoDataUrl: school.logoDataUrl,
    schoolStampDataUrl: school.officialStampDataUrl,
    principalSignatureDataUrl: school.headmasterSignatureDataUrl,
  };
}

export function studentToIdCardRecord(
  student: Student,
  school: SchoolProfile,
  design: IdCardDesignConfig,
  existing?: Partial<SchoolIdCardRecord>
): SchoolIdCardRecord {
  const nowIso = new Date().toISOString();
  const formattedSchoolAddress = formatSchoolAddressOnce(school);
  const admClean = (student.admissionNumber || student.id).replace(/[^A-Za-z0-9-]/g, '');
  return {
    id: existing?.id || `idcard-stu-${student.id}`,
    uniqueIdNumber: existing?.uniqueIdNumber || `GMS-STU-${admClean}`,
    category: 'student',
    linkedStudentId: student.id,
    fullName: student.fullName,
    fatherName: student.fatherName,
    motherName: student.motherName || '',
    dob: student.dob,
    bloodGroup: existing?.bloodGroup || '',
    schoolName: school.name,
    schoolAddress: formattedSchoolAddress,
    residentialAddress: student.address || formattedSchoolAddress,
    contactNumber: student.mobileNumber || student.parentWhatsAppNumber || '',
    parentContactNumber: student.parentWhatsAppNumber || student.mobileNumber || '',
    classNumber: student.classNumber,
    section: student.section,
    rollNumber: String(student.rollNumber),
    admissionNumber: student.admissionNumber,
    academicSession: student.academicSession || school.academicSession,
    photoDataUrl: existing?.photoDataUrl,
    principalSignatureDataUrl: existing?.principalSignatureDataUrl || design.principalSignatureDataUrl || school.headmasterSignatureDataUrl,
    schoolLogoDataUrl: existing?.schoolLogoDataUrl || design.schoolLogoDataUrl || school.logoDataUrl,
    schoolStampDataUrl: existing?.schoolStampDataUrl || design.schoolStampDataUrl || school.officialStampDataUrl,
    templateId: existing?.templateId || design.templateId,
    backgroundColor: existing?.backgroundColor || design.backgroundColor,
    accentColor: existing?.accentColor || design.accentColor,
    motto: existing?.motto ?? design.motto,
    emergencyContact: existing?.emergencyContact || design.emergencyContact || school.contactNumber,
    issueDate: existing?.issueDate || nowIso.slice(0, 10),
    expiryDate: existing?.expiryDate || design.defaultValidityDate,
    status: existing?.status || 'Valid',
    isDuplicate: existing?.isDuplicate || false,
    duplicateCount: existing?.duplicateCount || 0,
    createdAt: existing?.createdAt || nowIso,
    updatedAt: nowIso,
  };
}

export function teacherToIdCardRecord(
  teacher: TeacherProfile,
  school: SchoolProfile,
  design: IdCardDesignConfig,
  existing?: Partial<SchoolIdCardRecord>
): SchoolIdCardRecord {
  const nowIso = new Date().toISOString();
  const formattedSchoolAddress = formatSchoolAddressOnce(school);
  const empClean = (teacher.employeeId || teacher.id).replace(/[^A-Za-z0-9-]/g, '');
  const primarySubject =
    teacher.subjectSpecialization ||
    (teacher.assignedClasses && teacher.assignedClasses[0]?.subject) ||
    'General';

  return {
    id: existing?.id || `idcard-tch-${teacher.id}`,
    uniqueIdNumber: existing?.uniqueIdNumber || `GMS-TCH-${empClean}`,
    category: 'teacher',
    linkedTeacherId: teacher.id,
    fullName: teacher.name,
    fatherName: teacher.fatherName || teacher.fatherSpouseName || '',
    designation: teacher.designation,
    employeeId: teacher.employeeId,
    qualification: teacher.qualifications || '',
    subject: primarySubject,
    dateOfJoining: teacher.dateOfJoiningPresentSchool || teacher.dateOfJoining,
    dob: teacher.dob || '',
    bloodGroup: existing?.bloodGroup || '',
    schoolName: teacher.schoolName || school.name,
    schoolAddress: formattedSchoolAddress,
    residentialAddress: teacher.residentialAddress || formattedSchoolAddress,
    contactNumber: teacher.contactNumber || '',
    photoDataUrl: existing?.photoDataUrl,
    principalSignatureDataUrl: existing?.principalSignatureDataUrl || design.principalSignatureDataUrl || school.headmasterSignatureDataUrl,
    schoolLogoDataUrl: existing?.schoolLogoDataUrl || design.schoolLogoDataUrl || school.logoDataUrl,
    schoolStampDataUrl: existing?.schoolStampDataUrl || design.schoolStampDataUrl || school.officialStampDataUrl,
    templateId: existing?.templateId || (design.templateId === 'student_classic' ? 'teacher_executive' : design.templateId),
    backgroundColor: existing?.backgroundColor || design.backgroundColor,
    accentColor: existing?.accentColor || design.accentColor,
    motto: existing?.motto ?? design.motto,
    emergencyContact: existing?.emergencyContact || design.emergencyContact || school.contactNumber,
    issueDate: existing?.issueDate || nowIso.slice(0, 10),
    expiryDate: existing?.expiryDate || design.defaultValidityDate,
    status: existing?.status || 'Valid',
    isDuplicate: existing?.isDuplicate || false,
    duplicateCount: existing?.duplicateCount || 0,
    createdAt: existing?.createdAt || nowIso,
    updatedAt: nowIso,
  };
}

export function evaluateCardStatus(card: SchoolIdCardRecord): IdCardStatus {
  if (card.status === 'Invalid') return 'Invalid';
  if (card.expiryDate) {
    const today = new Date().toISOString().slice(0, 10);
    if (card.expiryDate < today || card.status === 'Expired') {
      return 'Expired';
    }
  }
  return 'Valid';
}

export interface IdCardQrPayload {
  v: string;
  uid: string;
  cat: 'student' | 'teacher';
  name: string;
  fatherName?: string;
  roleOrClass?: string;
  idNo?: string;
  school: string;
  schoolAddress?: string;
  residentialAddress?: string;
  contact?: string;
  parentContact?: string;
  dob?: string;
  bloodGroup?: string;
  expiry: string;
  status: IdCardStatus;
  dup?: boolean;
}

export function buildIdCardQrPayload(
  card: SchoolIdCardRecord,
  privacy: IdCardQrPrivacySettings
): string {
  const effectiveStatus = evaluateCardStatus(card);
  const roleOrClass =
    card.category === 'student'
      ? `Class ${card.classNumber || '-'}${card.section ? `-${card.section}` : ''}`
      : card.designation || 'Teacher';

  const idNo =
    card.category === 'student'
      ? `Roll ${card.rollNumber || '-'} / Adm ${card.admissionNumber || '-'}`
      : card.employeeId || card.uniqueIdNumber;

  const payload: IdCardQrPayload = {
    v: 'SMS-ID-V1',
    uid: card.uniqueIdNumber,
    cat: card.category,
    name: card.fullName,
    school: card.schoolName,
    expiry: card.expiryDate,
    status: effectiveStatus,
    ...(card.isDuplicate ? { dup: true } : {}),
  };

  if (privacy.showFatherName && card.fatherName) payload.fatherName = card.fatherName;
  if (privacy.showClassOrDesignation) payload.roleOrClass = roleOrClass;
  if (privacy.showRollOrEmployeeId) payload.idNo = idNo;
  if (privacy.showSchoolAddress && card.schoolAddress) payload.schoolAddress = card.schoolAddress;
  if (privacy.showDob && card.dob) payload.dob = card.dob;
  if (privacy.showBloodGroup && card.bloodGroup) payload.bloodGroup = card.bloodGroup;

  // Confidential fields gated by privacy settings
  if (privacy.showResidentialAddress && card.residentialAddress) {
    payload.residentialAddress = card.residentialAddress;
  }
  if (privacy.showContactNumber && card.contactNumber) {
    payload.contact = card.contactNumber;
  }
  if (privacy.showParentContact && card.parentContactNumber) {
    payload.parentContact = card.parentContactNumber;
  }

  return JSON.stringify(payload);
}

export interface QrVerificationResult {
  matchedRecord: SchoolIdCardRecord | null;
  parsedPayload: Partial<IdCardQrPayload> | null;
  status: 'Valid ID' | 'Expired ID' | 'Invalid ID';
  reason: string;
}

export function verifyIdCardQrInput(
  rawInput: string,
  records: SchoolIdCardRecord[]
): QrVerificationResult {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return {
      matchedRecord: null,
      parsedPayload: null,
      status: 'Invalid ID',
      reason: 'Empty scan payload.',
    };
  }

  // Direct lookup by Unique ID Number, Admission No, or Employee ID
  const directMatch = records.find(
    (r) =>
      r.uniqueIdNumber.toLowerCase() === trimmed.toLowerCase() ||
      (r.admissionNumber && r.admissionNumber.toLowerCase() === trimmed.toLowerCase()) ||
      (r.employeeId && r.employeeId.toLowerCase() === trimmed.toLowerCase())
  );
  if (directMatch) {
    const evaluated = evaluateCardStatus(directMatch);
    return {
      matchedRecord: directMatch,
      parsedPayload: {
        uid: directMatch.uniqueIdNumber,
        name: directMatch.fullName,
        cat: directMatch.category,
        school: directMatch.schoolName,
        expiry: directMatch.expiryDate,
        status: evaluated,
      },
      status: evaluated === 'Valid' ? 'Valid ID' : evaluated === 'Expired' ? 'Expired ID' : 'Invalid ID',
      reason:
        evaluated === 'Valid'
          ? 'Verified directly against active school ID database.'
          : evaluated === 'Expired'
          ? `Card expired on ${directMatch.expiryDate}.`
          : 'Card has been marked Invalid / Revoked by School Administration.',
    };
  }

  // Try parsing JSON QR payload
  try {
    const parsed = JSON.parse(trimmed) as Partial<IdCardQrPayload>;
    if (!parsed || typeof parsed !== 'object' || (!parsed.uid && !parsed.name)) {
      return {
        matchedRecord: null,
        parsedPayload: null,
        status: 'Invalid ID',
        reason: 'QR payload format does not match Smart School ID standard.',
      };
    }

    const dbMatch = records.find(
      (r) =>
        (parsed.uid && r.uniqueIdNumber.toLowerCase() === String(parsed.uid).toLowerCase()) ||
        (parsed.name && r.fullName.toLowerCase() === String(parsed.name).toLowerCase())
    );

    if (dbMatch) {
      const evaluated = evaluateCardStatus(dbMatch);
      return {
        matchedRecord: dbMatch,
        parsedPayload: parsed,
        status: evaluated === 'Valid' ? 'Valid ID' : evaluated === 'Expired' ? 'Expired ID' : 'Invalid ID',
        reason:
          evaluated === 'Valid'
            ? 'QR signature verified with school master registry.'
            : evaluated === 'Expired'
            ? `Card validity ended on ${dbMatch.expiryDate}.`
            : 'Card status is Invalid / Revoked in school registry.',
      };
    }

    // Valid structured QR not found in local database (could be printed from another session or revoked)
    const today = new Date().toISOString().slice(0, 10);
    if (parsed.status === 'Invalid') {
      return {
        matchedRecord: null,
        parsedPayload: parsed,
        status: 'Invalid ID',
        reason: 'QR payload carries Revoked / Invalid status.',
      };
    }
    if (parsed.expiry && parsed.expiry < today) {
      return {
        matchedRecord: null,
        parsedPayload: parsed,
        status: 'Expired ID',
        reason: `Embedded expiry date (${parsed.expiry}) has passed.`,
      };
    }
    return {
      matchedRecord: null,
      parsedPayload: parsed,
      status: 'Invalid ID',
      reason: `Card ID (${parsed.uid || 'Unknown'}) not found in current school registry.`,
    };
  } catch {
    return {
      matchedRecord: null,
      parsedPayload: null,
      status: 'Invalid ID',
      reason: 'Unrecognized QR code or ID number. Please scan a valid School ID QR.',
    };
  }
}

function getCanvasFontFamily(fontStyle: IdCardFontStyle): string {
  switch (fontStyle) {
    case 'serif':
      return 'Georgia, "Times New Roman", serif';
    case 'mono':
      return '"JetBrains Mono", "Courier New", monospace';
    case 'outfit':
      return '"Outfit", "Plus Jakarta Sans", sans-serif';
    case 'jakarta':
    default:
      return '"Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
  }
}

function loadImageSafe(src?: string): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 2
): number {
  const words = text.split(/\s+/);
  let line = '';
  let currentY = y;
  let lineCount = 0;

  for (let i = 0; i < words.length; i++) {
    const testLine = line ? `${line} ${words[i]}` : words[i];
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && line) {
      ctx.fillText(line, x, currentY);
      line = words[i];
      currentY += lineHeight;
      lineCount++;
      if (lineCount >= maxLines - 1) {
        // Fit remainder on last line
        const remainder = [line, ...words.slice(i + 1)].join(' ');
        let clipped = remainder;
        while (ctx.measureText(`${clipped}...`).width > maxWidth && clipped.length > 4) {
          clipped = clipped.slice(0, -1);
        }
        ctx.fillText(clipped !== remainder ? `${clipped}...` : remainder, x, currentY);
        return currentY + lineHeight;
      }
    } else {
      line = testLine;
    }
  }
  if (line) {
    ctx.fillText(line, x, currentY);
    currentY += lineHeight;
  }
  return currentY;
}

export async function renderIdCardToCanvas(
  card: SchoolIdCardRecord,
  design: IdCardDesignConfig,
  privacy: IdCardQrPrivacySettings
): Promise<HTMLCanvasElement> {
  const templateMeta = ID_CARD_TEMPLATES.find((t) => t.id === (card.templateId || design.templateId)) || ID_CARD_TEMPLATES[0];
  const isVertical = templateMeta.orientation === 'vertical';
  const width = isVertical ? 640 : 1012;
  const height = isVertical ? 1012 : 640;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const bgColor = card.backgroundColor || design.backgroundColor || templateMeta.defaultBg;
  const accentColor = card.accentColor || design.accentColor || templateMeta.defaultAccent;
  const isDarkBg = bgColor.toLowerCase() === '#0f172a' || bgColor.toLowerCase() === '#1e293b' || bgColor.toLowerCase() === '#000000';
  const primaryText = isDarkBg ? '#f8fafc' : '#0f172a';
  const mutedText = isDarkBg ? '#cbd5e1' : '#475569';
  const fontFamily = getCanvasFontFamily(design.fontStyle);
  const sizeBump = design.fontSize === 'large' ? 2 : design.fontSize === 'compact' ? -2 : 0;

  const qrPayload = buildIdCardQrPayload(card, privacy);
  const qrDataUrl = await QRCode.toDataURL(qrPayload, {
    width: 240,
    margin: 1,
    color: { dark: '#0f172a', light: '#ffffff' },
    errorCorrectionLevel: 'M',
  });

  const [photoImg, logoImg, sigImg, stampImg, qrImg] = await Promise.all([
    loadImageSafe(card.photoDataUrl),
    loadImageSafe(card.schoolLogoDataUrl || design.schoolLogoDataUrl),
    loadImageSafe(card.principalSignatureDataUrl || design.principalSignatureDataUrl),
    loadImageSafe(card.schoolStampDataUrl || design.schoolStampDataUrl),
    loadImageSafe(qrDataUrl),
  ]);

  // Card Background
  ctx.fillStyle = bgColor;
  drawRoundedRect(ctx, 0, 0, width, height, 28);
  ctx.fill();

  // Outer Hairline Border
  ctx.strokeStyle = isDarkBg ? '#334155' : '#cbd5e1';
  ctx.lineWidth = 4;
  drawRoundedRect(ctx, 4, 4, width - 8, height - 8, 24);
  ctx.stroke();

  if (isVertical) {
    // VERTICAL LAYOUT (640 x 1012)
    // Top Header Band
    ctx.fillStyle = accentColor;
    drawRoundedRect(ctx, 0, 0, width, 185, 24);
    ctx.fill();
    ctx.fillRect(0, 150, width, 35);

    // Logo
    if (logoImg) {
      ctx.save();
      drawRoundedRect(ctx, 28, 28, 86, 86, 16);
      ctx.clip();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(28, 28, 86, 86);
      ctx.drawImage(logoImg, 32, 32, 78, 78);
      ctx.restore();
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      drawRoundedRect(ctx, 28, 28, 86, 86, 16);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 28px ${fontFamily}`;
      ctx.textAlign = 'center';
      ctx.fillText(card.schoolName.slice(0, 2).toUpperCase(), 71, 81);
      ctx.textAlign = 'left';
    }

    // School Header Text
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 ${24 + sizeBump}px ${fontFamily}`;
    drawWrappedText(ctx, card.schoolName.toUpperCase(), 132, 58, 480, 28, 2);

    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.font = `500 ${14 + sizeBump}px ${fontFamily}`;
    drawWrappedText(ctx, card.schoolAddress, 132, 118, 480, 19, 2);

    if (design.showMotto && (card.motto || design.motto)) {
      ctx.fillStyle = '#fde68a';
      ctx.font = `600 13px ${fontFamily}`;
      ctx.textAlign = 'center';
      ctx.fillText(`"${card.motto || design.motto}"`, width / 2, 172);
      ctx.textAlign = 'left';
    }

    // Category Strip
    ctx.fillStyle = isDarkBg ? '#1e293b' : '#f1f5f9';
    drawRoundedRect(ctx, 180, 200, 280, 34, 8);
    ctx.fill();
    ctx.fillStyle = isDarkBg ? '#fbbf24' : accentColor;
    ctx.font = `800 15px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.fillText(
      card.category === 'student' ? 'STUDENT IDENTITY CARD' : 'FACULTY / TEACHER ID CARD',
      width / 2,
      222
    );
    ctx.textAlign = 'left';

    // Photo Box Centered
    const photoX = (width - 190) / 2;
    const photoY = 250;
    ctx.fillStyle = isDarkBg ? '#1e293b' : '#e2e8f0';
    drawRoundedRect(ctx, photoX - 5, photoY - 5, 200, 240, 18);
    ctx.fill();
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 4;
    ctx.stroke();

    if (photoImg) {
      ctx.save();
      drawRoundedRect(ctx, photoX, photoY, 190, 230, 14);
      ctx.clip();
      ctx.drawImage(photoImg, photoX, photoY, 190, 230);
      ctx.restore();
    } else {
      ctx.fillStyle = mutedText;
      ctx.font = `700 44px ${fontFamily}`;
      ctx.textAlign = 'center';
      ctx.fillText(card.fullName.slice(0, 2).toUpperCase(), width / 2, photoY + 130);
      ctx.textAlign = 'left';
    }

    // Name & Subtitle
    ctx.fillStyle = primaryText;
    ctx.font = `800 ${28 + sizeBump}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.fillText(card.fullName, width / 2, 524);

    ctx.fillStyle = isDarkBg ? '#fbbf24' : accentColor;
    ctx.font = `700 ${17 + sizeBump}px ${fontFamily}`;
    const subLabel =
      card.category === 'student'
        ? `Class ${card.classNumber || '-'} • Section ${card.section || 'A'} • Roll #${card.rollNumber || '-'}`
        : `${card.designation || 'Teacher'} • ${card.subject || 'Faculty'}`;
    ctx.fillText(subLabel, width / 2, 554);
    ctx.textAlign = 'left';

    // Details Grid
    const rows: [string, string][] =
      card.category === 'student'
        ? [
            ['Father Name', card.fatherName || '—'],
            ['Admission No', card.admissionNumber || card.uniqueIdNumber],
            ['Date of Birth', card.dob || '—'],
            ['Session', card.academicSession || '2026-2027'],
            ['Blood Group', card.bloodGroup || '—'],
            ['Parent Contact', card.parentContactNumber || card.contactNumber || '—'],
            ['Address', card.residentialAddress || '—'],
          ]
        : [
            ['Father Name', card.fatherName || '—'],
            ['Employee ID', card.employeeId || card.uniqueIdNumber],
            ['Qualification', card.qualification || '—'],
            ['Date of Joining', card.dateOfJoining || '—'],
            ['Blood Group', card.bloodGroup || '—'],
            ['Contact No', card.contactNumber || '—'],
            ['Address', card.residentialAddress || '—'],
          ];

    let rowY = 594;
    rows.forEach(([label, value]) => {
      ctx.fillStyle = mutedText;
      ctx.font = `600 ${14 + sizeBump}px ${fontFamily}`;
      ctx.fillText(label, 42, rowY);

      ctx.fillStyle = primaryText;
      ctx.font = `700 ${14 + sizeBump}px ${fontFamily}`;
      rowY = drawWrappedText(ctx, `: ${value}`, 195, rowY, 405, 20, 2);
      rowY += 6;
    });

    // Bottom Strip: QR on left, Stamp + Principal Signature on right
    ctx.strokeStyle = isDarkBg ? '#334155' : '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(32, 818);
    ctx.lineTo(width - 32, 818);
    ctx.stroke();

    if (qrImg) {
      ctx.fillStyle = '#ffffff';
      drawRoundedRect(ctx, 36, 832, 134, 134, 10);
      ctx.fill();
      ctx.drawImage(qrImg, 42, 838, 122, 122);
    }

    ctx.fillStyle = mutedText;
    ctx.font = `700 12px "JetBrains Mono", monospace`;
    ctx.fillText(`ID: ${card.uniqueIdNumber}`, 186, 856);
    ctx.fillText(`Valid Till: ${card.expiryDate}`, 186, 878);
    ctx.fillText(`Emergency: ${card.emergencyContact || design.emergencyContact || '—'}`, 186, 900);

    if (stampImg) {
      ctx.drawImage(stampImg, 355, 840, 86, 86);
    }
    if (sigImg) {
      ctx.drawImage(sigImg, 460, 845, 140, 56);
    }
    ctx.strokeStyle = mutedText;
    ctx.beginPath();
    ctx.moveTo(455, 916);
    ctx.lineTo(605, 916);
    ctx.stroke();
    ctx.fillStyle = primaryText;
    ctx.font = `700 13px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.fillText('Principal / Headmaster', 530, 936);
    ctx.textAlign = 'left';
  } else {
    // HORIZONTAL LAYOUT (1012 x 640)
    // Header Banner
    ctx.fillStyle = accentColor;
    drawRoundedRect(ctx, 0, 0, width, 134, 24);
    ctx.fill();
    ctx.fillRect(0, 100, width, 34);

    if (logoImg) {
      ctx.save();
      drawRoundedRect(ctx, 26, 20, 88, 88, 14);
      ctx.clip();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(26, 20, 88, 88);
      ctx.drawImage(logoImg, 30, 24, 80, 80);
      ctx.restore();
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      drawRoundedRect(ctx, 26, 20, 88, 88, 14);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `800 30px ${fontFamily}`;
      ctx.textAlign = 'center';
      ctx.fillText(card.schoolName.slice(0, 2).toUpperCase(), 70, 74);
      ctx.textAlign = 'left';
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = `800 ${28 + sizeBump}px ${fontFamily}`;
    ctx.fillText(card.schoolName.toUpperCase(), 134, 52);

    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = `500 ${15 + sizeBump}px ${fontFamily}`;
    drawWrappedText(ctx, card.schoolAddress, 134, 80, 650, 20, 2);

    if (design.showMotto && (card.motto || design.motto)) {
      ctx.fillStyle = '#fde68a';
      ctx.font = `600 13px ${fontFamily}`;
      ctx.fillText(card.motto || design.motto, 134, 122);
    }

    // Category Tag on Top-Right
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    drawRoundedRect(ctx, width - 220, 24, 194, 42, 10);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 14px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.fillText(card.category === 'student' ? 'STUDENT ID' : 'TEACHER ID', width - 123, 50);
    ctx.textAlign = 'left';

    // Left Photo Frame
    const photoX = 34;
    const photoY = 160;
    ctx.fillStyle = isDarkBg ? '#1e293b' : '#f1f5f9';
    drawRoundedRect(ctx, photoX - 4, photoY - 4, 214, 264, 18);
    ctx.fill();
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 4;
    ctx.stroke();

    if (photoImg) {
      ctx.save();
      drawRoundedRect(ctx, photoX, photoY, 206, 256, 14);
      ctx.clip();
      ctx.drawImage(photoImg, photoX, photoY, 206, 256);
      ctx.restore();
    } else {
      ctx.fillStyle = mutedText;
      ctx.font = `800 54px ${fontFamily}`;
      ctx.textAlign = 'center';
      ctx.fillText(card.fullName.slice(0, 2).toUpperCase(), photoX + 103, photoY + 145);
      ctx.textAlign = 'left';
    }

    // ID Code pill under Photo
    ctx.fillStyle = isDarkBg ? '#1e293b' : '#f1f5f9';
    drawRoundedRect(ctx, 30, 440, 214, 34, 8);
    ctx.fill();
    ctx.fillStyle = primaryText;
    ctx.font = `700 13px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(card.uniqueIdNumber, 137, 462);
    ctx.textAlign = 'left';

    // Center Details
    ctx.fillStyle = primaryText;
    ctx.font = `800 ${30 + sizeBump}px ${fontFamily}`;
    ctx.fillText(card.fullName, 276, 192);

    ctx.fillStyle = isDarkBg ? '#fbbf24' : accentColor;
    ctx.font = `700 ${17 + sizeBump}px ${fontFamily}`;
    ctx.fillText(
      card.category === 'student'
        ? `Class ${card.classNumber || '-'} (${card.section || 'A'}) • Roll No: ${card.rollNumber || '-'} • Session ${card.academicSession || '2026-27'}`
        : `${card.designation || 'Teacher'} • Subject: ${card.subject || 'General'}`,
      276,
      222
    );

    const hRows: [string, string][] =
      card.category === 'student'
        ? [
            ["Father's Name", card.fatherName || '—'],
            ['Admission No', card.admissionNumber || '—'],
            ['Date of Birth', `${card.dob || '—'}${card.bloodGroup ? `  •  Blood: ${card.bloodGroup}` : ''}`],
            ['Contact', card.parentContactNumber || card.contactNumber || '—'],
            ['Address', card.residentialAddress || '—'],
          ]
        : [
            ["Father's Name", card.fatherName || '—'],
            ['Employee ID', card.employeeId || '—'],
            ['Qualification', card.qualification || '—'],
            ['Joining Date', `${card.dateOfJoining || '—'}${card.bloodGroup ? `  •  Blood: ${card.bloodGroup}` : ''}`],
            ['Contact', card.contactNumber || '—'],
            ['Address', card.residentialAddress || '—'],
          ];

    let curY = 264;
    hRows.forEach(([lbl, val]) => {
      ctx.fillStyle = mutedText;
      ctx.font = `600 ${15 + sizeBump}px ${fontFamily}`;
      ctx.fillText(lbl, 276, curY);
      ctx.fillStyle = primaryText;
      ctx.font = `700 ${15 + sizeBump}px ${fontFamily}`;
      curY = drawWrappedText(ctx, `: ${val}`, 418, curY, 370, 21, 2);
      curY += 8;
    });

    // Right QR & Verification Panel
    if (qrImg) {
      ctx.fillStyle = '#ffffff';
      drawRoundedRect(ctx, 814, 162, 166, 166, 14);
      ctx.fill();
      ctx.strokeStyle = isDarkBg ? '#334155' : '#cbd5e1';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.drawImage(qrImg, 823, 171, 148, 148);
    }

    ctx.fillStyle = mutedText;
    ctx.font = `700 12px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('SCAN TO VERIFY', 897, 350);
    ctx.fillText(`EXP: ${card.expiryDate}`, 897, 370);
    ctx.textAlign = 'left';

    // Stamp & Principal Signature Bottom Right
    if (stampImg) {
      ctx.drawImage(stampImg, 725, 488, 86, 86);
    }
    if (sigImg) {
      ctx.drawImage(sigImg, 825, 494, 150, 56);
    }
    ctx.strokeStyle = mutedText;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(818, 562);
    ctx.lineTo(980, 562);
    ctx.stroke();
    ctx.fillStyle = primaryText;
    ctx.font = `700 13px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.fillText('Principal Signature', 899, 582);
    ctx.textAlign = 'left';

    // Bottom Emergency Strip
    ctx.fillStyle = isDarkBg ? '#1e293b' : '#f1f5f9';
    ctx.fillRect(0, height - 42, width, 42);
    ctx.fillStyle = mutedText;
    ctx.font = `600 13px ${fontFamily}`;
    ctx.fillText(
      `Emergency Contact: ${card.emergencyContact || design.emergencyContact || '—'}   •   Issued: ${card.issueDate}`,
      30,
      height - 16
    );
  }

  // DUPLICATE Watermark Banner if isDuplicate
  if (card.isDuplicate) {
    ctx.save();
    ctx.fillStyle = '#dc2626';
    drawRoundedRect(ctx, width - 210, height - 86, 175, 32, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 13px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(`DUPLICATE #${Math.max(1, card.duplicateCount)}`, width - 122, height - 65);
    ctx.restore();
  }

  return canvas;
}

export async function downloadIdCardAsImage(
  card: SchoolIdCardRecord,
  design: IdCardDesignConfig,
  privacy: IdCardQrPrivacySettings,
  format: 'png' | 'jpeg'
) {
  const canvas = await renderIdCardToCanvas(card, design, privacy);
  const mime = format === 'png' ? 'image/png' : 'image/jpeg';
  const ext = format === 'png' ? 'png' : 'jpg';
  const dataUrl = canvas.toDataURL(mime, 0.96);
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `${card.uniqueIdNumber}_${card.fullName.replace(/\s+/g, '_')}.${ext}`;
  a.click();
}

export async function exportIdCardsToPdf(
  cards: SchoolIdCardRecord[],
  design: IdCardDesignConfig,
  privacy: IdCardQrPrivacySettings,
  filename = 'School_Identity_Cards.pdf'
) {
  if (cards.length === 0) return;

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 12;
  const marginY = 14;
  const gapX = 8;
  const gapY = 8;

  // CR80 physical scale in mm: Horizontal ~88x56mm (2 cols x 4 rows = 8 per A4), Vertical ~56x88mm (3 cols x 3 rows = 9 per A4)
  let curX = marginX;
  let curY = marginY;
  let rowMaxH = 0;

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const templateMeta = ID_CARD_TEMPLATES.find((t) => t.id === (card.templateId || design.templateId)) || ID_CARD_TEMPLATES[0];
    const isVertical = templateMeta.orientation === 'vertical';
    const cardW = isVertical ? 58 : 89;
    const cardH = isVertical ? 91 : 56.5;

    if (curX + cardW > pageWidth - marginX + 0.5) {
      curX = marginX;
      curY += rowMaxH + gapY;
      rowMaxH = 0;
    }

    if (curY + cardH > pageHeight - marginY + 0.5) {
      pdf.addPage();
      curX = marginX;
      curY = marginY;
      rowMaxH = 0;
    }

    const canvas = await renderIdCardToCanvas(card, design, privacy);
    const imgData = canvas.toDataURL('image/png', 1.0);
    pdf.addImage(imgData, 'PNG', curX, curY, cardW, cardH);

    // Subtle cut guides
    pdf.setDrawColor(203, 213, 225);
    pdf.setLineWidth(0.2);
    pdf.rect(curX, curY, cardW, cardH);

    curX += cardW + gapX;
    if (cardH > rowMaxH) rowMaxH = cardH;
  }

  pdf.save(filename);
}
