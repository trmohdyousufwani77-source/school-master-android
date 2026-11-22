import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  QrCode,
  Camera,
  CameraOff,
  Upload,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  Lock,
  Unlock,
  Search,
} from 'lucide-react';
import {
  AdminRoleType,
  IdCardQrPrivacySettings,
  SchoolIdCardRecord,
} from '../types';
import {
  QrVerificationResult,
  verifyIdCardQrInput,
} from '../utils/idCardRenderer';

interface QrIdVerifierProps {
  records: SchoolIdCardRecord[];
  privacy: IdCardQrPrivacySettings;
  effectiveRole: AdminRoleType;
}

export const QrIdVerifier: React.FC<QrIdVerifierProps> = ({
  records,
  privacy,
  effectiveRole,
}) => {
  const [scanInput, setScanInput] = useState<string>('');
  const [result, setResult] = useState<QrVerificationResult | null>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [adminUnlocked, setAdminUnlocked] = useState<boolean>(effectiveRole !== 'teacher');
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerRegionId = 'smart-id-qr-scanner-region';

  useEffect(() => {
    setAdminUnlocked(effectiveRole !== 'teacher');
  }, [effectiveRole]);

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch {
        // ignore cleanup error
      }
      scannerRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const handleStartCameraScan = async () => {
    setCameraError(null);
    try {
      setCameraActive(true);
      // Wait next tick for container mount
      await new Promise((res) => setTimeout(res, 120));
      const html5QrCode = new Html5Qrcode(scannerRegionId);
      scannerRef.current = html5QrCode;
      await html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          setScanInput(decodedText);
          setResult(verifyIdCardQrInput(decodedText, records));
          stopScanner();
        },
        () => {
          // ignore frame read misses
        }
      );
    } catch (err: any) {
      setCameraActive(false);
      setCameraError(
        err?.message
          ? `Camera scanner unavailable (${err.message}). Upload a QR image or enter ID below.`
          : 'Camera scanner unavailable. Upload a QR image or enter ID below.'
      );
    }
  };

  const handleScanImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCameraError(null);
    try {
      const html5QrCode = new Html5Qrcode('smart-id-qr-file-temp');
      const decoded = await html5QrCode.scanFile(file, true);
      setScanInput(decoded);
      setResult(verifyIdCardQrInput(decoded, records));
      html5QrCode.clear();
    } catch {
      setCameraError('Could not detect a readable QR code in the selected image.');
    }
  };

  const handleManualVerify = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setResult(verifyIdCardQrInput(scanInput, records));
  };

  const handleUnlockConfidential = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput.trim() === '2026' || pinInput.trim() === 'admin123') {
      setAdminUnlocked(true);
      setPinError(null);
      setPinInput('');
    } else {
      setPinError('Invalid administrator verification PIN (Default: 2026).');
    }
  };

  const canSeeConfidential =
    !privacy.requireAdminForConfidential || adminUnlocked;

  const matched = result?.matchedRecord;
  const parsed = result?.parsedPayload;

  return (
    <div className="space-y-5">
      <div id="smart-id-qr-file-temp" className="hidden" />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Scanner & Lookup Controls */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <QrCode className="w-4 h-4 text-indigo-600" />
                <span>QR Identity Verification Scanner</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Scan camera QR, upload QR screenshot, or enter Card / Admission / Employee ID.
              </p>
            </div>
          </div>

          {/* Camera Feed Box */}
          {cameraActive ? (
            <div className="space-y-2.5">
              <div
                id={scannerRegionId}
                className="w-full min-h-[240px] rounded-xl overflow-hidden bg-slate-950 border border-slate-300"
              />
              <button
                type="button"
                onClick={stopScanner}
                className="w-full py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <CameraOff className="w-4 h-4" />
                <span>Stop Camera Scanner</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleStartCameraScan}
                className="py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <Camera className="w-4 h-4" />
                <span>Start Camera Scan</span>
              </button>
              <label className="py-2.5 px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer">
                <Upload className="w-4 h-4 text-slate-600" />
                <span>Scan QR Image</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleScanImageFile}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {cameraError && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
              {cameraError}
            </div>
          )}

          {/* Manual ID or QR Payload Lookup */}
          <form onSubmit={handleManualVerify} className="space-y-2.5 pt-2 border-t border-slate-100">
            <label className="block text-xs font-semibold text-slate-700">
              Lookup by Unique ID, Admission No, Employee ID, or Paste QR Payload
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                placeholder="e.g. GMS-STU-ADM-2026-001 or TCH-101"
                className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 shrink-0"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Verify</span>
              </button>
            </div>
          </form>

          {/* Quick-Test from Saved Registry */}
          {records.length > 0 && (
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Quick Verify Saved Card
              </span>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                {records.slice(0, 6).map((rec) => (
                  <button
                    key={rec.id}
                    type="button"
                    onClick={() => {
                      setScanInput(rec.uniqueIdNumber);
                      setResult(verifyIdCardQrInput(rec.uniqueIdNumber, records));
                    }}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-300 text-[11px] font-medium text-slate-700 truncate max-w-[180px]"
                  >
                    {rec.fullName}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Verification Result Card */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between">
          {!result ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-12 space-y-2">
              <ShieldCheck className="w-10 h-10 text-slate-300" />
              <h4 className="text-sm font-bold text-slate-800">Ready to Verify School ID Card</h4>
              <p className="text-xs text-slate-500 max-w-sm">
                Scan any student or teacher QR code or select a card on the left to inspect authenticity, expiry status, and protected institutional records.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Status Banner */}
              <div
                className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                  result.status === 'Valid ID'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                    : result.status === 'Expired ID'
                    ? 'bg-amber-50 border-amber-200 text-amber-950'
                    : 'bg-rose-50 border-rose-200 text-rose-950'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {result.status === 'Valid ID' && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
                  {result.status === 'Expired ID' && <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />}
                  {result.status === 'Invalid ID' && <XCircle className="w-5 h-5 text-rose-600 shrink-0" />}
                  <div>
                    <p className="text-sm font-extrabold">{result.status}</p>
                    <p className="text-xs opacity-90">{result.reason}</p>
                  </div>
                </div>
                {matched?.isDuplicate && (
                  <span className="px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-mono font-bold">
                    DUPLICATE #{Math.max(1, matched.duplicateCount)}
                  </span>
                )}
              </div>

              {(matched || parsed) && (
                <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-4 pt-1">
                  {/* Photo */}
                  <div className="w-28 h-36 rounded-xl border border-slate-200 bg-slate-100 overflow-hidden flex items-center justify-center mx-auto sm:mx-0">
                    {matched?.photoDataUrl ? (
                      <img
                        src={matched.photoDataUrl}
                        alt={matched.fullName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-2xl font-black text-slate-400">
                        {(matched?.fullName || parsed?.name || 'ID').slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>

                  {/* Verified Details */}
                  <div className="space-y-2.5 text-xs">
                    <div>
                      <p className="text-[11px] font-mono font-semibold text-slate-500">
                        {matched?.uniqueIdNumber || parsed?.uid}
                      </p>
                      <h4 className="text-base font-black text-slate-900">
                        {matched?.fullName || parsed?.name}
                      </h4>
                      <p className="text-xs font-semibold text-indigo-700">
                        {matched
                          ? matched.category === 'student'
                            ? `Student • Class ${matched.classNumber}-${matched.section} • Roll #${matched.rollNumber}`
                            : `Teacher • ${matched.designation} (${matched.subject || 'Faculty'})`
                          : parsed?.roleOrClass || parsed?.cat?.toUpperCase()}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-2 border-t border-slate-100">
                      <div>
                        <span className="text-slate-500">Father&apos;s Name: </span>
                        <span className="font-semibold text-slate-900">
                          {matched?.fatherName || parsed?.fatherName || 'Hidden by Privacy'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Expiry Date: </span>
                        <span className="font-mono font-semibold text-slate-900">
                          {matched?.expiryDate || parsed?.expiry || '—'}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-500">Institution: </span>
                        <span className="font-semibold text-slate-900">
                          {matched?.schoolName || parsed?.school}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-500">School Address: </span>
                        <span className="text-slate-800">
                          {matched?.schoolAddress || parsed?.schoolAddress || '—'}
                        </span>
                      </div>
                    </div>

                    {/* Confidential Details Gate */}
                    <div className="mt-3 p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                          {canSeeConfidential ? (
                            <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Lock className="w-3.5 h-3.5 text-amber-600" />
                          )}
                          <span>Confidential Identity Fields</span>
                        </span>
                        <span className="text-[10px] font-semibold text-slate-500">
                          {canSeeConfidential ? 'Authorized Access' : 'Admin Verification Required'}
                        </span>
                      </div>

                      {canSeeConfidential ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                          <div>
                            <span className="text-slate-500">Contact Number: </span>
                            <span className="font-mono font-semibold text-slate-900">
                              {matched?.contactNumber || parsed?.contact || '—'}
                            </span>
                          </div>
                          {matched?.parentContactNumber && (
                            <div>
                              <span className="text-slate-500">Parent Contact: </span>
                              <span className="font-mono font-semibold text-slate-900">
                                {matched.parentContactNumber}
                              </span>
                            </div>
                          )}
                          <div className="sm:col-span-2">
                            <span className="text-slate-500">Residential Address: </span>
                            <span className="font-medium text-slate-900">
                              {matched?.residentialAddress || parsed?.residentialAddress || '—'}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <form onSubmit={handleUnlockConfidential} className="space-y-1.5 pt-1">
                          <p className="text-[11px] text-slate-600">
                            Residential address and personal contact details are masked. Enter Admin PIN (2026) to view confidential fields.
                          </p>
                          <div className="flex items-center gap-2">
                            <input
                              type="password"
                              value={pinInput}
                              onChange={(e) => setPinInput(e.target.value)}
                              placeholder="Enter Admin PIN"
                              className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-mono w-36"
                            />
                            <button
                              type="submit"
                              className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold"
                            >
                              Unlock
                            </button>
                          </div>
                          {pinError && <p className="text-[11px] text-rose-600 font-semibold">{pinError}</p>}
                        </form>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
