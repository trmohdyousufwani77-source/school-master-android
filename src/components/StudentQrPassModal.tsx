import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  QrCode,
  Printer,
  Download,
  X,
  School,
  CheckCircle2,
  Users,
  Sparkles,
  Layers,
  Copy,
  Check,
} from 'lucide-react';
import { SchoolProfile, Student } from '../types';
import { Language, translations } from '../utils/translations';
import { buildStudentQrPayload, formatSchoolAddressOnce } from '../utils/calculations';

interface StudentQrPassModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  classStudents?: Student[];
  school: SchoolProfile;
  language: Language;
}

export const StudentQrPassModal: React.FC<StudentQrPassModalProps> = ({
  isOpen,
  onClose,
  student,
  classStudents = [],
  school,
  language,
}) => {
  const t = translations[language];

  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [batchMode, setBatchMode] = useState<boolean>(false);
  const [batchQrMap, setBatchQrMap] = useState<Record<string, string>>({});
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Generate QR code encoding all 7 required student & school details (auto-updates on edit)
  useEffect(() => {
    if (!student) return;
    const encodedPayload = buildStudentQrPayload(student, school);

    QRCode.toDataURL(encodedPayload, {
      width: 420,
      margin: 2,
      color: {
        dark: '#090d16',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Failed to generate student QR code', err));
  }, [student, school]);

  // Generate batch QR codes for the whole class when batch mode is active
  useEffect(() => {
    if (!batchMode || classStudents.length === 0) return;

    const promises = classStudents.map(async (st) => {
      const payload = buildStudentQrPayload(st, school);
      const url = await QRCode.toDataURL(payload, {
        width: 300,
        margin: 2,
        color: {
          dark: '#090d16',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'M',
      });
      return { id: st.id, url };
    });

    Promise.all(promises).then((results) => {
      const map: Record<string, string> = {};
      results.forEach((r) => {
        map[r.id] = r.url;
      });
      setBatchQrMap(map);
    });
  }, [batchMode, classStudents, school]);

  if (!isOpen || !student) return null;

  const formattedSchoolAddress = formatSchoolAddressOnce(school);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadSinglePng = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `QR_${student.fullName.replace(/\s+/g, '_')}_${student.admissionNumber}.png`;
    link.click();
  };

  const handleExportAsImage = () => {
    if (!qrDataUrl) return;
    const canvas = document.createElement('canvas');
    canvas.width = 760;
    canvas.height = 980;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Card background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Outer border
    ctx.strokeStyle = '#1e1b4b';
    ctx.lineWidth = 8;
    ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);

    // Header banner
    ctx.fillStyle = '#1e1b4b';
    ctx.fillRect(16, 16, canvas.width - 32, 145);

    ctx.fillStyle = '#fcd34d';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DEPARTMENT OF SCHOOL EDUCATION • STUDENT QR PASS', canvas.width / 2, 52);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(school.name.toUpperCase(), canvas.width / 2, 92);

    ctx.fillStyle = '#c7d2fe';
    ctx.font = '16px sans-serif';
    ctx.fillText(`U-DISE+: ${school.code} • Session ${school.academicSession}`, canvas.width / 2, 126);

    // Load QR Image onto canvas
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, (canvas.width - 330) / 2, 185, 330, 330);

      // Admission Badge
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(150, 530, 460, 44);
      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`ADMISSION NO: ${student.admissionNumber}`, canvas.width / 2, 559);

      // All 7 Details Block
      ctx.textAlign = 'left';
      const rows = [
        ['1. Student Name:', student.fullName || 'N/A'],
        ["2. Father's Name:", student.fatherName || 'N/A'],
        ['3. Date of Birth:', student.dob || 'N/A'],
        ['4. Admission No:', student.admissionNumber || student.id],
        ['5. Mobile Number:', student.mobileNumber || 'N/A'],
        ['6. School Name:', school.name || 'N/A'],
        ['7. School Address:', formattedSchoolAddress || 'N/A'],
      ];

      let y = 615;
      rows.forEach(([label, val]) => {
        ctx.fillStyle = '#475569';
        ctx.font = 'bold 17px sans-serif';
        ctx.fillText(label, 52, y);
        ctx.fillStyle = '#0f172a';
        ctx.font = '17px sans-serif';
        ctx.fillText(String(val).slice(0, 48), 240, y);
        y += 44;
      });

      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `Student_QR_Card_${student.fullName.replace(/\s+/g, '_')}_${student.admissionNumber}.png`;
      link.click();
    };
    img.src = qrDataUrl;
  };

  const handleCopyAdmissionNo = () => {
    if (student.admissionNumber) {
      navigator.clipboard.writeText(student.admissionNumber);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-sm animate-in fade-in duration-150 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col my-auto max-h-[92vh]">
        
        {/* Top Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900 text-white flex items-center justify-between no-print">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-white">
                  Student QR Attendance Pass
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  Admission SRN Encoded
                </span>
              </div>
              <p className="text-xs text-indigo-200 mt-0.5">
                Facilitates instant touchless scanning in the Daily Attendance QR module.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {classStudents.length > 1 && (
              <button
                type="button"
                onClick={() => setBatchMode(!batchMode)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  batchMode
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{batchMode ? 'Single Pass View' : `Batch Class Sheet (${classStudents.length})`}</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">

          {!batchMode ? (
            /* Single Student Printable ID Pass Card */
            <div className="flex flex-col items-center">
              
              {/* ID Card Physical Dimensions Preview (86mm x 54mm aspect ratio) */}
              <div
                id="printable-student-qr-card"
                className="w-full max-w-[380px] bg-white rounded-3xl border-2 border-indigo-900 shadow-xl overflow-hidden text-slate-900 relative print:border-2 print:border-black print:shadow-none print:m-0"
              >
                {/* Institutional Header Banner */}
                <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 text-white p-3.5 text-center border-b-2 border-amber-400 relative">
                  <div className="flex items-center justify-center gap-1.5 text-[9px] font-mono text-amber-300 tracking-wider font-extrabold uppercase mb-0.5">
                    <span>GOVT. OF JAMMU & KASHMIR • EDUCATION DEPT.</span>
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-tight text-white leading-tight">
                    {school.name}
                  </h3>
                  <p className="text-[10px] text-indigo-200 mt-0.5">
                    U-DISE+: {school.code} • Session {school.academicSession}
                  </p>
                  <div className="mt-1 inline-block px-2 py-0.2 bg-amber-400 text-slate-950 font-black text-[9px] rounded uppercase tracking-wider">
                    STUDENT VERIFIED QR IDENTITY PASS
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 space-y-3 bg-gradient-to-b from-indigo-50/30 via-white to-slate-50/50">
                  
                  {/* Student Identity Section */}
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-800 text-white font-black text-xl flex items-center justify-center shadow-md shrink-0 border-2 border-white">
                      {student.fullName.slice(0, 1)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-base font-extrabold text-slate-900 truncate">
                        {student.fullName}
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-extrabold text-xs text-indigo-900 bg-indigo-100/70 px-2 py-0.5 rounded-md border border-indigo-200">
                          Class {student.classNumber}-{student.section}
                        </span>
                        <span className="font-mono font-bold text-xs text-slate-700">
                          Roll #{student.rollNumber}
                        </span>
                      </div>
                      <p className="text-[10.5px] text-slate-500 mt-0.5 truncate">
                        Father's Name: <strong>{student.fatherName}</strong>
                      </p>
                    </div>
                  </div>

                  {/* QR Code Presentation Box */}
                  <div className="p-3 bg-white rounded-2xl border-2 border-indigo-200 shadow-inner flex flex-col items-center justify-center relative">
                    {qrDataUrl ? (
                      <img
                        src={qrDataUrl}
                        alt={`QR Code representing ${student.fullName} (${student.admissionNumber})`}
                        className="w-44 h-44 object-contain"
                      />
                    ) : (
                      <div className="w-44 h-44 flex items-center justify-center text-slate-400 text-xs">
                        Generating QR Code...
                      </div>
                    )}

                    {/* Encoded Admission Number Badge */}
                    <div className="mt-2 text-center w-full bg-slate-900 text-white py-1 px-2 rounded-xl flex items-center justify-center gap-2">
                      <span className="text-[9.5px] font-bold text-amber-300 uppercase tracking-wider">
                        Admission No:
                      </span>
                      <span className="font-mono font-black text-xs text-emerald-400 tracking-wider">
                        {student.admissionNumber}
                      </span>
                    </div>
                  </div>

                  {/* 7 Encoded QR Details Preview */}
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px] text-slate-600 pt-2 border-t border-slate-200 bg-white/80 p-2.5 rounded-xl border">
                    <div>
                      <span className="block text-slate-400 uppercase font-bold text-[8.5px]">D.O.B.</span>
                      <strong className="text-slate-800 font-mono">{student.dob || 'N/A'}</strong>
                    </div>
                    <div className="text-right">
                      <span className="block text-slate-400 uppercase font-bold text-[8.5px]">Mobile No</span>
                      <strong className="text-slate-800 font-mono">{student.mobileNumber || 'N/A'}</strong>
                    </div>
                    <div className="col-span-2 pt-1 border-t border-slate-100">
                      <span className="block text-slate-400 uppercase font-bold text-[8.5px]">School Address</span>
                      <strong className="text-slate-800 leading-snug block">{formattedSchoolAddress}</strong>
                    </div>
                  </div>

                  <div className="text-center text-[9px] text-slate-400 italic">
                    QR encodes all 7 verified student &amp; institutional fields; updates automatically on edit.
                  </div>
                </div>

                {/* Bottom Barcode Decorative Strip */}
                <div className="h-1.5 w-full bg-gradient-to-r from-indigo-700 via-amber-400 to-indigo-700" />
              </div>

              {/* Quick Details & Verification helper */}
              <div className="mt-4 p-3 bg-slate-50 rounded-2xl border border-slate-200 max-w-[380px] w-full text-xs text-slate-600 flex items-center justify-between no-print">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-medium">Encoded Value:</span>
                  <strong className="font-mono text-indigo-900 font-bold">{student.admissionNumber}</strong>
                </div>
                <button
                  type="button"
                  onClick={handleCopyAdmissionNo}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-[11px] flex items-center gap-1 transition-all"
                >
                  {copiedCode ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-500" />}
                  <span>{copiedCode ? 'Copied!' : 'Copy SRN'}</span>
                </button>
              </div>
            </div>
          ) : (
            /* Batch Class Sheet View (A4 Grid ready to print/laminate) */
            <div className="space-y-4">
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-2xl text-xs text-indigo-900 flex items-center justify-between no-print">
                <span className="font-bold flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-indigo-600" />
                  <span>Batch QR Pass Grid: {classStudents.length} Students in Class {student.classNumber}-{student.section}</span>
                </span>
                <span className="text-[11px] text-slate-500">Optimized for multi-card A4 lamination</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {classStudents.map((st) => {
                  const url = batchQrMap[st.id] || (st.id === student.id ? qrDataUrl : '');

                  return (
                    <div
                      key={st.id}
                      className="p-3.5 bg-white rounded-2xl border-2 border-indigo-900 shadow-sm flex flex-col justify-between space-y-2 text-center"
                    >
                      <div className="border-b border-indigo-100 pb-1.5">
                        <div className="text-[8px] font-mono uppercase text-slate-400 font-bold">
                          {school.name.slice(0, 24)}
                        </div>
                        <h4 className="font-extrabold text-xs text-slate-900 truncate">
                          {st.fullName}
                        </h4>
                        <div className="text-[10px] text-indigo-700 font-bold">
                          Class {st.classNumber}-{st.section} • Roll #{st.rollNumber}
                        </div>
                      </div>

                      <div className="p-1.5 bg-white rounded-xl border border-slate-200 flex items-center justify-center">
                        {url ? (
                          <img src={url} alt={`QR for ${st.admissionNumber}`} className="w-28 h-28 object-contain" />
                        ) : (
                          <div className="w-28 h-28 flex items-center justify-center text-[10px] text-slate-400">
                            Rendering QR...
                          </div>
                        )}
                      </div>

                      <div className="font-mono font-black text-[10px] text-indigo-900 bg-indigo-50 py-0.5 rounded border border-indigo-200 truncate">
                        {st.admissionNumber}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* Modal Actions Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 no-print">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>High-density QR code verified for low-light camera scanners</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {!batchMode && (
              <>
                <button
                  type="button"
                  onClick={handleDownloadSinglePng}
                  className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-bold text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5 text-slate-600" />
                  <span>Download QR</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportAsImage}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export as Image</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/30 active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>{batchMode ? `Print All (${classStudents.length}) Passes` : 'Print QR Pass Card'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs transition-colors"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
