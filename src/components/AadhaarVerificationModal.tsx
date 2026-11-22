import React, { useState } from 'react';
import {
  ShieldCheck,
  QrCode,
  FileCheck,
  AlertTriangle,
  Lock,
  X,
  CheckCircle2,
  FileText,
  User,
} from 'lucide-react';
import { AadhaarStatus, Student } from '../types';
import { maskAadhaarNumber, validateAadhaarFormat } from '../utils/calculations';
import { Language, translations } from '../utils/translations';

interface AadhaarVerificationModalProps {
  student: Student;
  isOpen: boolean;
  onClose: () => void;
  onSaveVerification: (updatedStudent: Partial<Student>, auditNote: string) => void;
  language: Language;
}

export const AadhaarVerificationModal: React.FC<AadhaarVerificationModalProps> = ({
  student,
  isOpen,
  onClose,
  onSaveVerification,
  language,
}) => {
  const t = translations[language];

  const [activeWorkflow, setActiveWorkflow] = useState<'offline_qr' | 'manual_verification' | 'alternative_id'>('offline_qr');
  
  // Offline QR / Paperless e-KYC simulator state
  const [qrInputDigits, setQrInputDigits] = useState<string>('');
  const [parentConsentChecked, setParentConsentChecked] = useState<boolean>(student?.parentConsentRecorded || false);
  const [referenceId, setReferenceId] = useState<string>(
    student?.aadhaarRefNumber || `UIDAI-OFF-${Math.floor(100000 + Math.random() * 900000)}`
  );
  
  // Alternative ID state
  const [altIdType, setAltIdType] = useState<string>(student?.alternativeIdType || 'Ration Card (NFSA / BPL)');
  const [altIdRef, setAltIdRef] = useState<string>(student?.alternativeIdRef || '');

  // Verification status
  const [verificationStatus, setVerificationStatus] = useState<AadhaarStatus>(student?.aadhaarStatus || 'Pending');
  const [officerRemarks, setOfficerRemarks] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  if (!isOpen || !student) return null;

  const handleSave = () => {
    setErrorMsg('');

    if (activeWorkflow === 'offline_qr' || activeWorkflow === 'manual_verification') {
      if (!parentConsentChecked) {
        setErrorMsg(language === 'ur'
          ? 'نابالغ طالب علم کے لیے والدین / سرپرست کی تحریری رضامندی لازمی ہے۔'
          : 'Mandatory: Parent/Guardian written consent must be confirmed for minor students.');
        return;
      }

      let masked = student.maskedAadhaar || 'XXXX-XXXX-****';
      if (qrInputDigits.trim()) {
        const raw = qrInputDigits.replace(/\D/g, '');
        if (raw.length !== 12) {
          setErrorMsg(language === 'ur'
            ? 'براہ کرم درست 12 ہندسوں کا آدھار نمبر درج کریں (صرف آخری 4 ہندسے محفوظ ہوں گے)۔'
            : 'Please enter a valid 12-digit Aadhaar number (only last 4 digits are masked and stored).');
          return;
        }
        masked = maskAadhaarNumber(raw);
      }

      onSaveVerification({
        aadhaarStatus: 'Verified',
        maskedAadhaar: masked,
        aadhaarRefNumber: referenceId,
        aadhaarVerificationDate: new Date().toISOString().slice(0, 10),
        parentConsentRecorded: true,
      }, `Aadhaar offline verification completed by authorized school authority with parent consent. Reference: ${referenceId}`);

      onClose();
    } else if (activeWorkflow === 'alternative_id') {
      if (!altIdRef.trim()) {
        setErrorMsg(language === 'ur' ? 'براہ کرم متبادل شناختی دستاویز کا نمبر درج کریں۔' : 'Please enter the alternative document number.');
        return;
      }

      onSaveVerification({
        aadhaarStatus: 'Alternative_ID_Provided',
        alternativeIdType: altIdType,
        alternativeIdRef: altIdRef.trim(),
        parentConsentRecorded: parentConsentChecked,
        aadhaarVerificationDate: new Date().toISOString().slice(0, 10),
      }, `Alternative identification recorded: ${altIdType} (${altIdRef})`);

      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm no-print">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">UIDAI Identity & Verification Module</h2>
              <p className="text-xs text-slate-400">
                {student.fullName} (Class {student.classNumber}-{student.section}, Roll {student.rollNumber})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Workflow Tabs */}
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <div className="flex rounded-xl bg-slate-200/80 p-1 text-xs font-semibold">
            <button
              onClick={() => setActiveWorkflow('offline_qr')}
              className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                activeWorkflow === 'offline_qr' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Offline QR / XML</span>
            </button>
            <button
              onClick={() => setActiveWorkflow('manual_verification')}
              className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                activeWorkflow === 'manual_verification' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileCheck className="w-3.5 h-3.5" />
              <span>Manual Official</span>
            </button>
            <button
              onClick={() => setActiveWorkflow('alternative_id')}
              className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                activeWorkflow === 'alternative_id' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Alternative ID</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
          
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Current Status banner */}
          <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-500">Current Status:</span>{' '}
              <span className="font-bold text-indigo-900">{student.aadhaarStatus}</span>
            </div>
            {student.maskedAadhaar && (
              <span className="font-mono bg-white px-2 py-0.5 rounded border border-indigo-200 font-semibold text-slate-800">
                {student.maskedAadhaar}
              </span>
            )}
          </div>

          {/* Offline QR / e-KYC Mode */}
          {activeWorkflow === 'offline_qr' && (
            <div className="space-y-4 text-xs">
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
                <p className="font-bold text-emerald-950 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  UIDAI Offline Digital Verification Workflow
                </p>
                <p className="text-emerald-800 text-[11px] leading-relaxed">
                  Per official UIDAI guidelines, schools process the offline signed Aadhaar QR code or paperless XML without storing full credentials or querying private databases.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  12-Digit Aadhaar (For Verification & Masking Only):
                </label>
                <input
                  type="text"
                  maxLength={14}
                  placeholder="e.g. 5432 9876 1234"
                  value={qrInputDigits}
                  onChange={(e) => setQrInputDigits(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  * Note: Only masked format (e.g. <span className="font-mono text-slate-700 font-semibold">{qrInputDigits ? maskAadhaarNumber(qrInputDigits) : 'XXXX-XXXX-1234'}</span>) will be stored.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Authorized Verification Reference Code:
                </label>
                <input
                  type="text"
                  value={referenceId}
                  onChange={(e) => setReferenceId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-xs bg-slate-50 text-slate-700"
                />
              </div>
            </div>
          )}

          {/* Manual Official Mode */}
          {activeWorkflow === 'manual_verification' && (
            <div className="space-y-4 text-xs">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900">
                <p className="font-bold">Manual Physical Verification By Headmaster</p>
                <p className="text-[11px] mt-0.5 text-amber-800">
                  Used when internet is unavailable or offline QR scanning is done via official handheld reader.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Last 4 Digits of Student's Aadhaar:</label>
                <input
                  type="text"
                  maxLength={4}
                  placeholder="e.g. 4589"
                  value={qrInputDigits.slice(-4)}
                  onChange={(e) => setQrInputDigits(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Verifying Official's Remarks:</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Physically verified with original Aadhaar letter presented by parent Ramkishore Kumar."
                  value={officerRemarks}
                  onChange={(e) => setOfficerRemarks(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                />
              </div>
            </div>
          )}

          {/* Alternative ID Mode */}
          {activeWorkflow === 'alternative_id' && (
            <div className="space-y-4 text-xs">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900">
                <p className="font-bold">Alternative Identity Document Recording</p>
                <p className="text-[11px] mt-0.5 text-blue-800">
                  As per RTE norms, no student shall be denied admission or benefits due to lack of an Aadhaar card.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Identification Document Type:</label>
                <select
                  value={altIdType}
                  onChange={(e) => setAltIdType(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white"
                >
                  <option value="Ration Card (NFSA / BPL / Antyodaya)">Ration Card (NFSA / BPL / Antyodaya)</option>
                  <option value="Birth Certificate (Municipal / Gram Panchayat)">Birth Certificate (Municipal / Gram Panchayat)</option>
                  <option value="Parent Voter ID Card (EPIC)">Parent Voter ID Card (EPIC)</option>
                  <option value="Kisan Credit Card / Bank Passbook">Parent Bank Passbook with Photo</option>
                  <option value="Gram Pradhan Certificate">Gram Pradhan / Ward Member Certificate</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Document Reference Number:</label>
                <input
                  type="text"
                  placeholder="e.g. UP-RC-2024-998811"
                  value={altIdRef}
                  onChange={(e) => setAltIdRef(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono"
                />
              </div>
            </div>
          )}

          {/* Mandatory Parent Consent Checkbox for Minors */}
          <div className="pt-2 border-t border-slate-200">
            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors">
              <input
                type="checkbox"
                checked={parentConsentChecked}
                onChange={(e) => setParentConsentChecked(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
              />
              <span className="text-xs text-slate-700 font-medium leading-relaxed">
                <strong className="text-slate-900">Parent / Legal Guardian Consent Verified:</strong> I hereby certify that written consent has been obtained from the parent/guardian ({student.fatherName || student.motherName}) for verifying identity solely for school academic and scholarship records.
              </span>
            </label>
          </div>

          {/* Security & Audit notice */}
          <div className="flex items-center gap-2 text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
            <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>Encrypted at rest. Audit trail records user timestamp and verification ID.</span>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors"
          >
            {t.cancel}
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors shadow-sm"
          >
            {language === 'ur' ? 'تصدیق محفوظ کریں' : 'Save & Confirm Status'}
          </button>
        </div>

      </div>
    </div>
  );
};
