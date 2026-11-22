import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  IdCardDesignConfig,
  IdCardQrPrivacySettings,
  SchoolIdCardRecord,
} from '../types';
import {
  buildIdCardQrPayload,
  evaluateCardStatus,
  ID_CARD_TEMPLATES,
} from '../utils/idCardRenderer';

interface IdCardPreviewProps {
  card: SchoolIdCardRecord;
  design: IdCardDesignConfig;
  privacy: IdCardQrPrivacySettings;
  compact?: boolean;
}

export const IdCardPreview: React.FC<IdCardPreviewProps> = ({
  card,
  design,
  privacy,
  compact = false,
}) => {
  const [qrUrl, setQrUrl] = useState<string>('');

  const activeTemplateId = card.templateId || design.templateId;
  const templateMeta =
    ID_CARD_TEMPLATES.find((t) => t.id === activeTemplateId) || ID_CARD_TEMPLATES[0];
  const isVertical = templateMeta.orientation === 'vertical';

  const bgColor = card.backgroundColor || design.backgroundColor || templateMeta.defaultBg;
  const accentColor = card.accentColor || design.accentColor || templateMeta.defaultAccent;
  const isDark =
    bgColor.toLowerCase() === '#0f172a' ||
    bgColor.toLowerCase() === '#1e293b' ||
    bgColor.toLowerCase() === '#000000';

  const logoSrc = card.schoolLogoDataUrl || design.schoolLogoDataUrl;
  const sigSrc = card.principalSignatureDataUrl || design.principalSignatureDataUrl;
  const stampSrc = card.schoolStampDataUrl || design.schoolStampDataUrl;
  const effectiveStatus = evaluateCardStatus(card);

  const fontClass =
    design.fontStyle === 'serif'
      ? 'font-serif'
      : design.fontStyle === 'mono'
      ? 'font-mono'
      : 'font-sans';

  const scaleText =
    design.fontSize === 'compact'
      ? 'text-[10px]'
      : design.fontSize === 'large'
      ? 'text-xs'
      : 'text-[11px]';

  useEffect(() => {
    const payload = buildIdCardQrPayload(card, privacy);
    QRCode.toDataURL(payload, {
      width: 180,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
      .then((url) => setQrUrl(url))
      .catch(() => {});
  }, [card, privacy]);

  const mottoText = card.motto || design.motto;
  const emergencyText = card.emergencyContact || design.emergencyContact;

  if (isVertical) {
    return (
      <div
        className={`relative rounded-2xl border shadow-sm overflow-hidden select-none mx-auto ${fontClass} ${
          isDark ? 'border-slate-700 text-slate-100' : 'border-slate-300 text-slate-900'
        } ${compact ? 'w-[260px]' : 'w-[300px]'}`}
        style={{ backgroundColor: bgColor }}
      >
        {/* Top Header */}
        <div
          className="px-3.5 py-3 text-white flex items-center gap-2.5"
          style={{ backgroundColor: accentColor }}
        >
          <div className="w-10 h-10 rounded-lg bg-white/95 shrink-0 flex items-center justify-center overflow-hidden border border-white/40">
            {logoSrc ? (
              <img src={logoSrc} alt="School Logo" className="w-full h-full object-contain p-0.5" />
            ) : (
              <span className="text-xs font-black text-slate-800">
                {card.schoolName.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-[11px] font-extrabold uppercase leading-tight line-clamp-2 tracking-wide">
              {card.schoolName}
            </h4>
            <p className="text-[9px] text-white/85 line-clamp-2 leading-snug mt-0.5">
              {card.schoolAddress}
            </p>
          </div>
        </div>

        {design.showMotto && mottoText && (
          <div
            className="text-center text-[9px] font-semibold py-1 px-2 border-b"
            style={{
              backgroundColor: isDark ? '#1e293b' : '#f8fafc',
              borderColor: isDark ? '#334155' : '#e2e8f0',
              color: isDark ? '#fde68a' : accentColor,
            }}
          >
            &ldquo;{mottoText}&rdquo;
          </div>
        )}

        {/* Body */}
        <div className="p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span
              className="text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded border"
              style={{
                borderColor: accentColor,
                color: isDark ? '#fbbf24' : accentColor,
              }}
            >
              {card.category === 'student' ? 'Student Identity Card' : 'Teacher Identity Card'}
            </span>
            {card.isDuplicate && (
              <span className="text-[9px] font-mono font-extrabold px-1.5 py-0.5 rounded bg-rose-600 text-white">
                DUPLICATE
              </span>
            )}
          </div>

          {/* Photo */}
          <div className="flex flex-col items-center pt-1">
            <div
              className="w-24 h-28 rounded-xl overflow-hidden border-2 flex items-center justify-center bg-slate-100"
              style={{ borderColor: accentColor }}
            >
              {card.photoDataUrl ? (
                <img
                  src={card.photoDataUrl}
                  alt={card.fullName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xl font-black text-slate-400">
                  {card.fullName.slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            <h3 className="mt-2 text-sm font-black text-center leading-tight">{card.fullName}</h3>
            <p
              className="text-[11px] font-bold text-center"
              style={{ color: isDark ? '#fbbf24' : accentColor }}
            >
              {card.category === 'student'
                ? `Class ${card.classNumber || '-'}-${card.section || 'A'} • Roll #${card.rollNumber || '-'}`
                : `${card.designation || 'Teacher'} • ${card.subject || 'Faculty'}`}
            </p>
          </div>

          {/* Key Info Table */}
          <div className={`space-y-1 pt-1 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'} ${scaleText}`}>
            <div className="grid grid-cols-[92px_1fr] gap-1">
              <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Father&apos;s Name</span>
              <span className="font-semibold truncate">: {card.fatherName || '—'}</span>
            </div>
            {card.category === 'student' ? (
              <>
                <div className="grid grid-cols-[92px_1fr] gap-1">
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Admission No</span>
                  <span className="font-mono font-semibold truncate">: {card.admissionNumber || '—'}</span>
                </div>
                <div className="grid grid-cols-[92px_1fr] gap-1">
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>DOB / Blood</span>
                  <span className="font-semibold truncate">
                    : {card.dob || '—'} {card.bloodGroup ? `(${card.bloodGroup})` : ''}
                  </span>
                </div>
                <div className="grid grid-cols-[92px_1fr] gap-1">
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Session</span>
                  <span className="font-semibold truncate">: {card.academicSession || '2026-2027'}</span>
                </div>
                <div className="grid grid-cols-[92px_1fr] gap-1">
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Guardian Ph</span>
                  <span className="font-mono font-semibold truncate">
                    : {card.parentContactNumber || card.contactNumber || '—'}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-[92px_1fr] gap-1">
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Employee ID</span>
                  <span className="font-mono font-semibold truncate">: {card.employeeId || '—'}</span>
                </div>
                <div className="grid grid-cols-[92px_1fr] gap-1">
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Qualification</span>
                  <span className="font-semibold truncate">: {card.qualification || '—'}</span>
                </div>
                <div className="grid grid-cols-[92px_1fr] gap-1">
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Joining Date</span>
                  <span className="font-mono font-semibold truncate">: {card.dateOfJoining || '—'}</span>
                </div>
                <div className="grid grid-cols-[92px_1fr] gap-1">
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Contact No</span>
                  <span className="font-mono font-semibold truncate">: {card.contactNumber || '—'}</span>
                </div>
              </>
            )}
            <div className="grid grid-cols-[92px_1fr] gap-1">
              <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Address</span>
              <span className="font-medium line-clamp-2 leading-tight">: {card.residentialAddress || '—'}</span>
            </div>
          </div>

          {/* QR + Signature Footer */}
          <div
            className="pt-2 border-t flex items-end justify-between gap-2"
            style={{ borderColor: isDark ? '#334155' : '#e2e8f0' }}
          >
            <div className="flex items-center gap-2">
              {qrUrl && (
                <img
                  src={qrUrl}
                  alt="ID QR"
                  className="w-16 h-16 rounded-md bg-white p-0.5 border border-slate-200 shrink-0"
                />
              )}
              <div className="text-[9px] font-mono leading-tight space-y-0.5">
                <p className="font-bold">{card.uniqueIdNumber}</p>
                <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>Exp: {card.expiryDate}</p>
                <p
                  className={`font-bold ${
                    effectiveStatus === 'Valid'
                      ? 'text-emerald-600'
                      : effectiveStatus === 'Expired'
                      ? 'text-amber-600'
                      : 'text-rose-600'
                  }`}
                >
                  {effectiveStatus}
                </p>
              </div>
            </div>

            <div className="text-center shrink-0">
              <div className="flex items-end justify-center gap-1 h-9">
                {stampSrc && <img src={stampSrc} alt="Stamp" className="h-9 w-9 object-contain opacity-85" />}
                {sigSrc && <img src={sigSrc} alt="Principal Signature" className="h-7 max-w-[66px] object-contain" />}
              </div>
              <div className="border-t border-slate-400 pt-0.5 text-[8px] font-bold uppercase tracking-wide">
                Principal
              </div>
            </div>
          </div>
        </div>

        {/* Emergency Bar */}
        {emergencyText && (
          <div
            className="px-3 py-1 text-[9px] font-semibold flex items-center justify-between"
            style={{
              backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
              color: isDark ? '#cbd5e1' : '#475569',
            }}
          >
            <span>Emergency: {emergencyText}</span>
            <span className="font-mono">{card.issueDate}</span>
          </div>
        )}
      </div>
    );
  }

  // HORIZONTAL CARD PREVIEW
  return (
    <div
      className={`relative rounded-2xl border shadow-sm overflow-hidden select-none mx-auto w-full max-w-[460px] ${fontClass} ${
        isDark ? 'border-slate-700 text-slate-100' : 'border-slate-300 text-slate-900'
      }`}
      style={{ backgroundColor: bgColor }}
    >
      {/* Header Band */}
      <div
        className="px-4 py-2.5 text-white flex items-center justify-between gap-3"
        style={{ backgroundColor: accentColor }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-white shrink-0 flex items-center justify-center overflow-hidden">
            {logoSrc ? (
              <img src={logoSrc} alt="School Logo" className="w-full h-full object-contain p-0.5" />
            ) : (
              <span className="text-xs font-black text-slate-900">
                {card.schoolName.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-extrabold uppercase tracking-wide truncate">
              {card.schoolName}
            </h4>
            <p className="text-[10px] text-white/85 truncate">{card.schoolAddress}</p>
            {design.showMotto && mottoText && (
              <p className="text-[9px] text-amber-200 font-semibold truncate">{mottoText}</p>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <span className="inline-block px-2 py-0.5 rounded bg-white/20 text-[9px] font-extrabold uppercase tracking-wider">
            {card.category === 'student' ? 'Student ID' : 'Teacher ID'}
          </span>
          {card.isDuplicate && (
            <div className="mt-1">
              <span className="inline-block px-1.5 py-0.5 rounded bg-rose-600 text-white font-mono text-[8px] font-bold">
                DUPLICATE
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="p-3.5 grid grid-cols-[88px_1fr_84px] gap-3 items-start">
        {/* Photo Column */}
        <div className="space-y-1.5">
          <div
            className="w-[88px] h-[108px] rounded-xl overflow-hidden border-2 bg-slate-100 flex items-center justify-center"
            style={{ borderColor: accentColor }}
          >
            {card.photoDataUrl ? (
              <img
                src={card.photoDataUrl}
                alt={card.fullName}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-lg font-black text-slate-400">
                {card.fullName.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <div
            className="text-center text-[9px] font-mono font-bold py-0.5 px-1 rounded truncate"
            style={{
              backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
            }}
          >
            {card.uniqueIdNumber}
          </div>
        </div>

        {/* Center Identity Fields */}
        <div className={`min-w-0 space-y-1 ${scaleText}`}>
          <h3 className="text-sm font-black leading-tight truncate">{card.fullName}</h3>
          <p
            className="text-[11px] font-bold truncate"
            style={{ color: isDark ? '#fbbf24' : accentColor }}
          >
            {card.category === 'student'
              ? `Class ${card.classNumber || '-'}-${card.section || 'A'} • Roll #${card.rollNumber || '-'}`
              : `${card.designation || 'Teacher'} • ${card.subject || 'Faculty'}`}
          </p>

          <div className="space-y-0.5 pt-1">
            <p className="truncate">
              <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Father: </span>
              <span className="font-semibold">{card.fatherName || '—'}</span>
            </p>
            {card.category === 'student' ? (
              <>
                <p className="truncate">
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Adm No: </span>
                  <span className="font-mono font-semibold">{card.admissionNumber || '—'}</span>
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}> • Sess: </span>
                  <span className="font-semibold">{card.academicSession || '2026-27'}</span>
                </p>
                <p className="truncate">
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>DOB: </span>
                  <span className="font-mono font-semibold">{card.dob || '—'}</span>
                  {card.bloodGroup && (
                    <span className="font-bold text-rose-600"> • {card.bloodGroup}</span>
                  )}
                </p>
                <p className="truncate">
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Contact: </span>
                  <span className="font-mono font-semibold">
                    {card.parentContactNumber || card.contactNumber || '—'}
                  </span>
                </p>
              </>
            ) : (
              <>
                <p className="truncate">
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Emp ID: </span>
                  <span className="font-mono font-semibold">{card.employeeId || '—'}</span>
                  {card.qualification && <span> • {card.qualification}</span>}
                </p>
                <p className="truncate">
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Joined: </span>
                  <span className="font-mono font-semibold">{card.dateOfJoining || '—'}</span>
                  {card.bloodGroup && (
                    <span className="font-bold text-rose-600"> • {card.bloodGroup}</span>
                  )}
                </p>
                <p className="truncate">
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Phone: </span>
                  <span className="font-mono font-semibold">{card.contactNumber || '—'}</span>
                </p>
              </>
            )}
            <p className="line-clamp-2 leading-tight">
              <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Addr: </span>
              <span>{card.residentialAddress || '—'}</span>
            </p>
          </div>
        </div>

        {/* Right QR & Signature */}
        <div className="flex flex-col items-center justify-between h-full gap-1.5">
          <div className="text-center">
            {qrUrl && (
              <img
                src={qrUrl}
                alt="QR Verification"
                className="w-[76px] h-[76px] rounded-lg bg-white p-0.5 border border-slate-200"
              />
            )}
            <p className="text-[8px] font-mono text-slate-500 mt-0.5">EXP {card.expiryDate}</p>
          </div>

          <div className="w-full text-center pt-1">
            <div className="flex items-end justify-center gap-0.5 h-7">
              {stampSrc && <img src={stampSrc} alt="Stamp" className="h-7 w-7 object-contain opacity-85" />}
              {sigSrc && <img src={sigSrc} alt="Sig" className="h-6 max-w-[54px] object-contain" />}
            </div>
            <div className="border-t border-slate-400 pt-0.5 text-[7px] font-bold uppercase tracking-wider">
              Principal Sign
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Emergency Strip */}
      <div
        className="px-4 py-1.5 text-[9px] font-semibold flex items-center justify-between border-t"
        style={{
          backgroundColor: isDark ? '#1e293b' : '#f8fafc',
          borderColor: isDark ? '#334155' : '#e2e8f0',
          color: isDark ? '#cbd5e1' : '#475569',
        }}
      >
        <span>Emergency: {emergencyText || '—'}</span>
        <span
          className={`font-bold ${
            effectiveStatus === 'Valid'
              ? 'text-emerald-600'
              : effectiveStatus === 'Expired'
              ? 'text-amber-600'
              : 'text-rose-600'
          }`}
        >
          Status: {effectiveStatus}
        </span>
      </div>
    </div>
  );
};
