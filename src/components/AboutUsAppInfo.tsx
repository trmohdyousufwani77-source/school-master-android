import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Building2,
  CheckCircle2,
  ClipboardList,
  Copyright,
  Edit2,
  FileText,
  Globe,
  History,
  ImagePlus,
  Info,
  KeyRound,
  Lock,
  Mail,
  MapPin,
  MessageSquareQuote,
  Phone,
  Plus,
  Save,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Target,
  Unlock,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import {
  DeveloperAdminProfile,
  SchoolAboutUsInfo,
  SchoolInfoAuditEntry,
  SchoolProfile,
} from '../types';
import { Language } from '../utils/translations';
import { usePermissions } from '../hooks/usePermissions';
import { AdminEditor } from './AdminEditor';
import {
  appendSchoolInfoAuditLogToFirestore,
  syncProtectedDeveloperProfileToFirestore,
  syncSchoolAboutUsToFirestore,
} from '../firebase';

interface AboutUsAppInfoProps {
  profiles: DeveloperAdminProfile[];
  activeProfile: DeveloperAdminProfile;
  school: SchoolProfile;
  language: Language;
  onUpdateSchool?: (updated: SchoolProfile) => void;
  onSaveProfile: (updated: DeveloperAdminProfile) => void;
  onAddProfile: (created: DeveloperAdminProfile) => void;
  onSelectActiveProfile: (profileId: string) => void;
}

const ABOUT_US_STORAGE_KEY = 'school_master_v1_school_about_us_info';
const ABOUT_AUDIT_STORAGE_KEY = 'school_master_v1_school_info_audit_logs';
const DEV_PROFILE_PWD_KEY = 'school_master_v1_dev_profile_pwd_hash';
const LEGACY_WANI_PWD_KEY = 'sm_admin_pwd_hash_user-admin-wani';
const ORIGINAL_DEVELOPER_EMAIL = 'mohdyousufwani1977@gmail.com';

async function hashAdminSecret(secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(secret + '_schoolmaster_salt_2026');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function buildDefaultAboutUsInfo(school: SchoolProfile): SchoolAboutUsInfo {
  return {
    id: 'school-about-main',
    schoolName: school.name || 'Govt Middle School Pamposh Colony',
    schoolIntroduction:
      'Government Middle School Pamposh Colony is a dedicated public educational institution committed to foundational literacy, numeracy, and holistic student development under the NEP 2020 framework.',
    schoolHistory:
      'Established to serve families in Pamposh Colony and the Palapora Zone, Iddgah, the school has steadily grown its academic, co-scholastic, and digital record-keeping capabilities for classes 1 through 8.',
    schoolVision:
      'To nurture confident, compassionate, and lifelong learners equipped with strong foundational skills, ethical values, and digital readiness.',
    schoolMission:
      'Deliver inclusive, student-centric education through regular attendance tracking, Holistic Progress Cards (HPC), engaged teaching faculty, and transparent parent-school collaboration.',
    schoolObjectives:
      '1. Ensure 100% enrollment and consistent daily student attendance.\n2. Track academic and co-scholastic progress transparently through NEP 2020 Holistic Progress Cards.\n3. Empower teachers with streamlined leave, attendance, and JKEPM appraisal workflows.',
    schoolAddress: school.address || 'Pamposh Colony, Palapora Zone, Iddgah',
    schoolContactNumber: school.contactNumber || '+91 194 240 0000',
    schoolEmail: school.email || 'gmspamposhcolony@jk.gov.in',
    schoolWebsite: school.website || 'https://education.jk.gov.in',
    schoolLogoDataUrl: school.logoDataUrl,
    schoolFacilities:
      'Well-ventilated classrooms, School Library & Reading Corner, Drinking Water & Sanitation Facilities, Mid-Day Meal (PM POSHAN) Kitchen, Playground, and Smart Digital Attendance & ID Card System.',
    principalsMessage:
      'Welcome to our digital school platform. Together with dedicated teachers and supportive parents, we strive every day to build a safe, joyful, and high-achieving learning environment for every child.',
    otherSchoolInfo: `U-DISE Code: ${school.code} • Academic Session: ${school.academicSession} • Working Days: ${school.workingDaysPerWeek} days/week`,
    appName: 'SchoolMaster (HPC & JKHRMS)',
    appDescription:
      'Comprehensive School Administration, Touchless QR Daily Attendance, NEP 2020 Holistic Progress Card (HPC), Teacher Leave Management, and JKEPM Appraisal application.',
    appVersion: 'v1.0.0 (Android / PWA)',
    appFeatures:
      '• Touchless QR Student Attendance with Geolocation Audit\n• NEP 2020 13-Section Holistic Progress Cards (HPC) & PDF Export\n• Student Admission, Promotion & Smart QR ID Card Studio\n• Teacher Management, Service Book & Leave Statement System\n• JKEPM Quarterly Self-Assessment & CPIS Portal\n• Offline-First Sync with Firebase Cloud Backup',
    appPurpose:
      'Streamline daily academic administration, reduce manual paperwork, ensure transparent attendance and assessment records, and provide offline-capable school management for teachers and administrators.',
    appSupportEmail: school.email || 'support@schoolmaster.edu.in',
    appSupportContactNumber: school.contactNumber || '+91 194 240 0000',
    privacyPolicy:
      'Student and teacher records are stored securely with strict role-based access control. Personal data is used solely for authorized school administration, attendance tracking, and statutory educational reporting. No student information is shared with unauthorized third parties.',
    termsAndConditions:
      'Authorized school personnel must maintain confidentiality of login credentials and student records. All administrative updates to school profiles, attendance, and appraisals are logged for institutional accountability.',
    copyrightInfo: `© ${new Date().getFullYear()} ${school.name || 'Govt Middle School Pamposh Colony'} • SchoolMaster Platform. All Rights Reserved.`,
    updatedAt: new Date().toISOString(),
    updatedByName: 'System Default',
    updatedByRole: 'school_admin',
  };
}

function validateEmail(value: string): boolean {
  if (!value.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function validateWebsite(value: string): boolean {
  if (!value.trim()) return true;
  return /^(https?:\/\/)?[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/.*)?$/.test(value.trim());
}

function validatePhone(value: string): boolean {
  if (!value.trim()) return true;
  return /^[0-9+\-\s()]{7,25}$/.test(value.trim());
}

export const AboutUsAppInfo: React.FC<AboutUsAppInfoProps> = ({
  profiles,
  activeProfile,
  school,
  language,
  onUpdateSchool,
  onSaveProfile,
  onAddProfile,
  onSelectActiveProfile,
}) => {
  const { currentUser, effectiveRole, addAuditLog } = usePermissions();

  // Strict Role-Based Access Control (RBAC):
  // 1. School Admin (primary_admin / senior_admin / junior_admin) can edit ONLY About Us & App Information.
  // 2. Teacher is strictly read-only across all sections.
  // 3. ONLY the original verified App Developer / Super Administrator can manage the separate Protected Developer Profile.
  const canEditSchoolInfo =
    effectiveRole === 'primary_admin' ||
    effectiveRole === 'senior_admin' ||
    effectiveRole === 'junior_admin';

  const isOriginalSuperDeveloper =
    effectiveRole === 'primary_admin' &&
    (currentUser.email || '').trim().toLowerCase() === ORIGINAL_DEVELOPER_EMAIL;

  const activeRoleDisplay = isOriginalSuperDeveloper
    ? 'Super Admin / App Developer'
    : canEditSchoolInfo
    ? 'School Admin'
    : 'Teacher (Read-Only)';

  // Section tabs
  const [activeSection, setActiveSection] = useState<'about-us' | 'app-info' | 'developer' | 'audit'>('about-us');

  // School Admin Editable State (About Us + App Information) — strictly isolated from Developer Profile
  const [schoolAboutInfo, setSchoolAboutInfo] = useState<SchoolAboutUsInfo>(() => {
    const fallback = buildDefaultAboutUsInfo(school);
    try {
      const raw = localStorage.getItem(ABOUT_US_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SchoolAboutUsInfo>;
        return {
          ...fallback,
          ...parsed,
          schoolLogoDataUrl: parsed.schoolLogoDataUrl || school.logoDataUrl,
        };
      }
    } catch {
      // ignore storage errors
    }
    return fallback;
  });

  const [aboutAuditLogs, setAboutAuditLogs] = useState<SchoolInfoAuditEntry[]>(() => {
    try {
      const raw = localStorage.getItem(ABOUT_AUDIT_STORAGE_KEY);
      if (raw) return JSON.parse(raw) as SchoolInfoAuditEntry[];
    } catch {
      // ignore
    }
    return [];
  });

  const [isEditingAboutUs, setIsEditingAboutUs] = useState<boolean>(false);
  const [isEditingAppInfo, setIsEditingAppInfo] = useState<boolean>(false);
  const [draftForm, setDraftForm] = useState<SchoolAboutUsInfo>(schoolAboutInfo);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isSavingSchoolInfo, setIsSavingSchoolInfo] = useState<boolean>(false);
  const logoFileInputRef = useRef<HTMLInputElement | null>(null);

  // Separate Protected Super Admin / App Developer unlock state (NEVER accessible to School Admin)
  const [isDevVaultUnlocked, setIsDevVaultUnlocked] = useState<boolean>(false);
  const [hasPasswordConfigured, setHasPasswordConfigured] = useState<boolean>(false);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [pendingDevAction, setPendingDevAction] = useState<'edit' | 'add' | null>(null);
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [newPasswordInput, setNewPasswordInput] = useState<string>('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [devMode, setDevMode] = useState<'view' | 'edit' | 'add'>('view');
  const [isChangingPassword, setIsChangingPassword] = useState<boolean>(false);

  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const devHash = localStorage.getItem(DEV_PROFILE_PWD_KEY);
    const waniHash = localStorage.getItem(LEGACY_WANI_PWD_KEY);
    setHasPasswordConfigured(Boolean(devHash || waniHash));
  }, []);

  // Keep localStorage synced for School About Us & Audit Logs
  useEffect(() => {
    try {
      localStorage.setItem(ABOUT_US_STORAGE_KEY, JSON.stringify(schoolAboutInfo));
    } catch {
      // ignore storage quota
    }
  }, [schoolAboutInfo]);

  useEffect(() => {
    try {
      localStorage.setItem(ABOUT_AUDIT_STORAGE_KEY, JSON.stringify(aboutAuditLogs));
    } catch {
      // ignore storage quota
    }
  }, [aboutAuditLogs]);

  // If role drops (e.g. simulated switch to Teacher or School Admin), immediately cancel restricted edit modes
  useEffect(() => {
    if (!canEditSchoolInfo) {
      setIsEditingAboutUs(false);
      setIsEditingAppInfo(false);
    }
    if (!isOriginalSuperDeveloper) {
      setIsDevVaultUnlocked(false);
      setDevMode('view');
      setShowAuthModal(false);
    }
  }, [canEditSchoolInfo, isOriginalSuperDeveloper]);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ type, text });
    window.setTimeout(() => setToastMsg(null), 4500);
  };

  // Start editing About Us or App Information (School Admin only)
  const handleStartEditAboutUs = () => {
    if (!canEditSchoolInfo) {
      showToast('Access Denied: Only School Admin can edit About Us information.', 'error');
      return;
    }
    setDraftForm({
      ...schoolAboutInfo,
      schoolLogoDataUrl: schoolAboutInfo.schoolLogoDataUrl || school.logoDataUrl,
    });
    setValidationErrors({});
    setIsEditingAboutUs(true);
  };

  const handleStartEditAppInfo = () => {
    if (!canEditSchoolInfo) {
      showToast('Access Denied: Only School Admin can edit App Information.', 'error');
      return;
    }
    setDraftForm({ ...schoolAboutInfo });
    setValidationErrors({});
    setIsEditingAppInfo(true);
  };

  const handleCancelSchoolEdit = () => {
    setDraftForm({ ...schoolAboutInfo });
    setValidationErrors({});
    setIsEditingAboutUs(false);
    setIsEditingAppInfo(false);
  };

  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.type)) {
      setValidationErrors((prev) => ({
        ...prev,
        schoolLogoDataUrl: 'Please upload a valid PNG, JPG, WEBP, or SVG logo image.',
      }));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setValidationErrors((prev) => ({
        ...prev,
        schoolLogoDataUrl: 'School logo image must be smaller than 2 MB.',
      }));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setDraftForm((prev) => ({ ...prev, schoolLogoDataUrl: reader.result as string }));
        setValidationErrors((prev) => {
          const next = { ...prev };
          delete next.schoolLogoDataUrl;
          return next;
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const validateSection = (section: 'About Us' | 'App Information', data: SchoolAboutUsInfo) => {
    const errs: Record<string, string> = {};
    if (section === 'About Us') {
      if (data.schoolName.trim().length < 2) {
        errs.schoolName = 'School Name is required (minimum 2 characters).';
      }
      if (data.schoolAddress.trim().length < 3) {
        errs.schoolAddress = 'School Address is required.';
      }
      if (!validateEmail(data.schoolEmail)) {
        errs.schoolEmail = 'Please enter a valid School Email Address.';
      }
      if (!validatePhone(data.schoolContactNumber)) {
        errs.schoolContactNumber = 'Please enter a valid School Contact Number (7–25 digits).';
      }
      if (!validateWebsite(data.schoolWebsite)) {
        errs.schoolWebsite = 'Please enter a valid School Website URL (e.g. https://school.edu.in).';
      }
    } else {
      if (data.appName.trim().length < 2) {
        errs.appName = 'App Name is required (minimum 2 characters).';
      }
      if (data.appVersion.trim().length < 1) {
        errs.appVersion = 'App Version is required (e.g. v1.0.0).';
      }
      if (!validateEmail(data.appSupportEmail)) {
        errs.appSupportEmail = 'Please enter a valid Support Email Address.';
      }
      if (!validatePhone(data.appSupportContactNumber)) {
        errs.appSupportContactNumber = 'Please enter a valid Support Contact Number.';
      }
    }
    return errs;
  };

  const handleSaveSchoolSection = async (section: 'About Us' | 'App Information') => {
    if (!canEditSchoolInfo) {
      showToast('Permission Denied: Only School Admin can save school information.', 'error');
      return;
    }

    const errs = validateSection(section, draftForm);
    setValidationErrors(errs);
    if (Object.keys(errs).length > 0) {
      showToast('Please correct the highlighted validation errors before saving.', 'error');
      return;
    }

    setIsSavingSchoolInfo(true);
    try {
      const nowIso = new Date().toISOString();
      const fieldList: Array<keyof SchoolAboutUsInfo> =
        section === 'About Us'
          ? [
              'schoolName',
              'schoolIntroduction',
              'schoolHistory',
              'schoolVision',
              'schoolMission',
              'schoolObjectives',
              'schoolAddress',
              'schoolContactNumber',
              'schoolEmail',
              'schoolWebsite',
              'schoolLogoDataUrl',
              'schoolFacilities',
              'principalsMessage',
              'otherSchoolInfo',
            ]
          : [
              'appName',
              'appDescription',
              'appVersion',
              'appFeatures',
              'appPurpose',
              'appSupportEmail',
              'appSupportContactNumber',
              'privacyPolicy',
              'termsAndConditions',
              'copyrightInfo',
            ];

      const changedFields: string[] = [];
      fieldList.forEach((key) => {
        if ((schoolAboutInfo[key] || '') !== (draftForm[key] || '')) {
          changedFields.push(String(key));
        }
      });

      const updatedInfo: SchoolAboutUsInfo = {
        ...schoolAboutInfo,
        ...draftForm,
        schoolName: draftForm.schoolName.trim(),
        schoolAddress: draftForm.schoolAddress.trim(),
        appName: draftForm.appName.trim(),
        appVersion: draftForm.appVersion.trim(),
        updatedAt: nowIso,
        updatedByName: currentUser.name,
        updatedByRole: effectiveRole,
      };

      // 1. Update local state (NEVER touches DeveloperAdminProfile!)
      setSchoolAboutInfo(updatedInfo);

      // 2. Sync core institutional fields with SchoolProfile when About Us is saved
      if (section === 'About Us' && onUpdateSchool) {
        onUpdateSchool({
          ...school,
          name: updatedInfo.schoolName || school.name,
          address: updatedInfo.schoolAddress || school.address,
          contactNumber: updatedInfo.schoolContactNumber || school.contactNumber,
          email: updatedInfo.schoolEmail || school.email,
          website: updatedInfo.schoolWebsite || school.website,
          logoDataUrl: updatedInfo.schoolLogoDataUrl || school.logoDataUrl,
        });
      }

      // 3. Create immutable Audit Log entry
      const auditEntry: SchoolInfoAuditEntry = {
        id: `about-audit-${Date.now()}`,
        section:
          changedFields.length === 1 && changedFields[0] === 'schoolLogoDataUrl'
            ? 'School Logo'
            : section,
        action: 'UPDATE',
        changedFields: changedFields.length > 0 ? changedFields : [section],
        summary: `Updated ${section} (${
          changedFields.length > 0 ? changedFields.join(', ') : 'confirmed details'
        })`,
        actorName: currentUser.name,
        actorRole: effectiveRole,
        timestamp: nowIso,
        syncedToCloud: false,
      };

      // 4. Backend Express RBAC API enforcement + Firestore persistence
      let cloudSynced = false;
      try {
        await fetch('/api/school-about-us', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-user-role': effectiveRole,
            'x-user-name': currentUser.name,
          },
          body: JSON.stringify({
            section: auditEntry.section,
            summary: auditEntry.summary,
            actorName: currentUser.name,
            actorRole: effectiveRole,
            data: updatedInfo,
          }),
        });
      } catch {
        // Offline-capable local persistence remains intact
      }

      try {
        const syncedDoc = await syncSchoolAboutUsToFirestore(
          updatedInfo,
          currentUser.name,
          effectiveRole
        );
        if (syncedDoc) {
          await appendSchoolInfoAuditLogToFirestore(auditEntry);
          cloudSynced = true;
        }
      } catch {
        // Structured Firestore error already logged via handleFirestoreError
      }

      const finalAuditEntry: SchoolInfoAuditEntry = {
        ...auditEntry,
        syncedToCloud: cloudSynced,
      };
      setAboutAuditLogs((prev) => [finalAuditEntry, ...prev.slice(0, 99)]);

      addAuditLog({
        actorId: currentUser.id,
        actorName: `${currentUser.name} (${effectiveRole})`,
        actionType: 'SECURITY_POLICY_UPDATE',
        description: `${finalAuditEntry.summary} — Protected Developer Profile untouched.`,
        newValue: section === 'About Us' ? updatedInfo.schoolName : `${updatedInfo.appName} ${updatedInfo.appVersion}`,
        status: 'SUCCESS',
      });

      setIsEditingAboutUs(false);
      setIsEditingAppInfo(false);
      showToast(
        `${section} updated and saved successfully${cloudSynced ? ' (Synced to Cloud Firestore)' : ''}.`
      );
    } finally {
      setIsSavingSchoolInfo(false);
    }
  };

  // Protected Developer / Super Administrator actions — STRICTLY blocked for School Admin & Teacher
  const handleRequestSuperDevAction = (action: 'edit' | 'add') => {
    if (!isOriginalSuperDeveloper) {
      showToast(
        'Protected Section: School Admin cannot edit, replace, or delete the original App Developer / Administrator Profile.',
        'error'
      );
      return;
    }

    if (isDevVaultUnlocked) {
      setDevMode(action);
      return;
    }

    setPendingDevAction(action);
    setPasswordInput('');
    setNewPasswordInput('');
    setConfirmPasswordInput('');
    setAuthError(null);
    setShowAuthModal(true);
  };

  const handleVerifyOrCreatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOriginalSuperDeveloper) {
      setAuthError('Forbidden: Only the original App Developer / Super Admin can unlock this console.');
      return;
    }
    setAuthError(null);

    const existingDevHash = localStorage.getItem(DEV_PROFILE_PWD_KEY);
    const existingWaniHash = localStorage.getItem(LEGACY_WANI_PWD_KEY);

    if ((!existingDevHash && !existingWaniHash) || isChangingPassword) {
      if (isChangingPassword && (existingDevHash || existingWaniHash)) {
        const currentHash = await hashAdminSecret(passwordInput);
        const currentMatches =
          (existingDevHash && currentHash === existingDevHash) ||
          (existingWaniHash && currentHash === existingWaniHash);
        if (!currentMatches) {
          setAuthError('Current Super Admin password is incorrect.');
          return;
        }
      }

      if (newPasswordInput.trim().length < 4) {
        setAuthError('Please enter a protection password of at least 4 characters.');
        return;
      }
      if (newPasswordInput !== confirmPasswordInput) {
        setAuthError('Passwords do not match.');
        return;
      }
      const hashed = await hashAdminSecret(newPasswordInput);
      localStorage.setItem(DEV_PROFILE_PWD_KEY, hashed);
      setHasPasswordConfigured(true);
      setIsDevVaultUnlocked(true);
      setIsChangingPassword(false);
      setShowAuthModal(false);

      addAuditLog({
        actorId: currentUser.id,
        actorName: `${currentUser.name} (Super Admin)`,
        actionType: 'CREDENTIAL_RESET',
        description: isChangingPassword
          ? 'Updated protected Developer Profile vault password'
          : 'Configured protected Developer Profile vault password',
        status: 'SUCCESS',
      });

      if (pendingDevAction) setDevMode(pendingDevAction);
      else showToast('Protected Developer Console password saved.');
      setPendingDevAction(null);
      return;
    }

    const enteredHash = await hashAdminSecret(passwordInput);
    const matches =
      (existingDevHash && enteredHash === existingDevHash) ||
      (existingWaniHash && enteredHash === existingWaniHash);

    if (!matches) {
      setAuthError('Incorrect Super Admin password. Protected Developer Profile remains locked.');
      return;
    }

    setIsDevVaultUnlocked(true);
    setShowAuthModal(false);
    if (pendingDevAction) setDevMode(pendingDevAction);
    setPendingDevAction(null);
  };

  const handleAdminEditorSave = async (profile: DeveloperAdminProfile, isNew: boolean) => {
    if (!isOriginalSuperDeveloper) {
      showToast('Access Denied: Only the original App Developer / Super Admin can modify this record.', 'error');
      setDevMode('view');
      return;
    }

    if (isNew) {
      onAddProfile(profile);
      void syncProtectedDeveloperProfileToFirestore(profile, true).catch(() => {});
      addAuditLog({
        actorId: currentUser.id,
        actorName: `${currentUser.name} (Super Admin)`,
        actionType: 'USER_CREATE',
        description: `Added protected Developer/Administrator Profile: ${profile.name} (${profile.designation})`,
        newValue: `${profile.name} — ${profile.institution}`,
        status: 'SUCCESS',
      });
      setDevMode('view');
      showToast(`Added protected Developer Profile for ${profile.name}.`);
      return;
    }

    onSaveProfile(profile);
    void syncProtectedDeveloperProfileToFirestore(profile, false).catch(() => {});
    addAuditLog({
      actorId: currentUser.id,
      actorName: `${currentUser.name} (Super Admin)`,
      actionType: 'USER_UPDATE',
      description: `Updated protected Developer/Administrator Profile: ${profile.name} (${profile.designation})`,
      oldValue: `${activeProfile.name} (${activeProfile.designation})`,
      newValue: `${profile.name} (${profile.designation})`,
      status: 'SUCCESS',
    });
    setDevMode('view');
    showToast('Protected Developer Profile updated via Super Admin Console.');
  };

  const developerLocationSummary = useMemo(
    () =>
      [
        activeProfile.locality,
        activeProfile.district ? `District ${activeProfile.district}` : '',
        activeProfile.unionTerritory,
      ]
        .filter(Boolean)
        .join(', '),
    [activeProfile]
  );

  const displayedLogo = isEditingAboutUs
    ? draftForm.schoolLogoDataUrl || school.logoDataUrl
    : schoolAboutInfo.schoolLogoDataUrl || school.logoDataUrl;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Confirmation / Error Toast Banner */}
      {toastMsg && (
        <div
          role="status"
          data-testid="about-us-toast"
          className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center justify-between shadow-sm ${
            toastMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {toastMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{toastMsg.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMsg(null)}
            aria-label="Dismiss message"
            className="opacity-70 hover:opacity-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Module Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-slate-900 text-white flex items-center justify-center shadow-md shrink-0">
            <Info className="w-6 h-6 text-amber-300" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black text-slate-900">
              {language === 'ur' ? 'ہمارے بارے میں اور ایپ کی معلومات' : 'About Us & App Information'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage institutional About Us &amp; App Information with strict Role-Based Protection for the original App Developer Profile.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold border ${
              isOriginalSuperDeveloper
                ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                : canEditSchoolInfo
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Role: {activeRoleDisplay}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <Lock className="w-3.5 h-3.5 text-amber-600" />
            <span>Developer Profile Protected</span>
          </span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div
        role="tablist"
        aria-label="About Us and App Information sections"
        className="bg-white p-1.5 rounded-2xl border border-slate-200 shadow-xs inline-flex flex-wrap gap-1.5"
      >
        {[
          { id: 'about-us' as const, label: 'About Us (School)', icon: Building2 },
          { id: 'app-info' as const, label: 'App Information', icon: Smartphone },
          { id: 'developer' as const, label: 'Developer Profile (Protected)', icon: Shield },
          {
            id: 'audit' as const,
            label: `Update Audit Log (${aboutAuditLogs.length})`,
            icon: History,
          },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setActiveSection(tab.id);
                setValidationErrors({});
              }}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                active
                  ? tab.id === 'developer'
                    ? 'bg-slate-900 text-amber-300 shadow-sm'
                    : 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ================================================================= */}
      {/* SECTION A: ABOUT US (SCHOOL ADMIN EDITABLE ONLY)                  */}
      {/* ================================================================= */}
      {activeSection === 'about-us' && (
        <section
          aria-label="School About Us"
          data-testid="about-us-school-section"
          className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden"
        >
          {/* Header Banner with Logo & Edit/Save/Cancel */}
          <div className="p-6 bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-20 h-20 rounded-2xl bg-white p-2 border-2 border-white/20 flex items-center justify-center shrink-0 shadow-md">
                {displayedLogo ? (
                  <img
                    src={displayedLogo}
                    alt={`${schoolAboutInfo.schoolName} Logo`}
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <Building2 className="w-9 h-9 text-indigo-700" />
                )}
              </div>
              <div className="min-w-0 space-y-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-[10px] font-extrabold uppercase tracking-wider text-emerald-200">
                  <Building2 className="w-3 h-3" />
                  <span>School Admin Managed • About Us</span>
                </span>
                <h2 className="text-lg sm:text-2xl font-black tracking-tight text-white truncate">
                  {schoolAboutInfo.schoolName}
                </h2>
                <p className="text-xs text-indigo-200 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                  <span className="truncate">{schoolAboutInfo.schoolAddress}</span>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {canEditSchoolInfo ? (
                isEditingAboutUs ? (
                  <>
                    <button
                      type="button"
                      onClick={handleCancelSchoolEdit}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/25 text-xs font-bold transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Cancel</span>
                    </button>
                    <button
                      type="button"
                      disabled={isSavingSchoolInfo}
                      onClick={() => void handleSaveSchoolSection('About Us')}
                      data-testid="save-about-us-btn"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold shadow-md transition-colors disabled:opacity-60"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{isSavingSchoolInfo ? 'Saving...' : 'Save About Us'}</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleStartEditAboutUs}
                    data-testid="edit-about-us-btn"
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold shadow-md transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit About Us</span>
                  </button>
                )
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 text-slate-200 border border-white/20 text-xs font-bold">
                  <Lock className="w-3.5 h-3.5 text-amber-300" />
                  <span>School Admin Edit Only</span>
                </span>
              )}
            </div>
          </div>

          <div className="p-6 space-y-6">
            {isEditingAboutUs ? (
              <div className="space-y-5 text-xs">
                {/* School Logo Upload */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 p-2 flex items-center justify-center shrink-0">
                      {displayedLogo ? (
                        <img
                          src={displayedLogo}
                          alt="School Logo Preview"
                          className="max-w-full max-h-full object-contain"
                        />
                      ) : (
                        <Building2 className="w-7 h-7 text-slate-400" />
                      )}
                    </div>
                    <div>
                      <p className="font-extrabold text-slate-900">School Logo</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Upload PNG, JPG, WEBP, or SVG (max 2 MB). Original aspect ratio is preserved cleanly.
                      </p>
                      {validationErrors.schoolLogoDataUrl && (
                        <p className="text-[11px] font-bold text-rose-600 mt-1">
                          {validationErrors.schoolLogoDataUrl}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      ref={logoFileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      onChange={handleLogoFileUpload}
                      className="hidden"
                      aria-label="Upload school logo"
                    />
                    <button
                      type="button"
                      onClick={() => logoFileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-colors"
                    >
                      <ImagePlus className="w-3.5 h-3.5" />
                      <span>Upload School Logo</span>
                    </button>
                  </div>
                </div>

                {/* Core Institutional Identity & Contact */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">School Name *</label>
                    <input
                      type="text"
                      value={draftForm.schoolName}
                      onChange={(e) => setDraftForm((p) => ({ ...p, schoolName: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    {validationErrors.schoolName && (
                      <p className="text-rose-600 font-semibold mt-1">{validationErrors.schoolName}</p>
                    )}
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">School Address *</label>
                    <input
                      type="text"
                      value={draftForm.schoolAddress}
                      onChange={(e) => setDraftForm((p) => ({ ...p, schoolAddress: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    {validationErrors.schoolAddress && (
                      <p className="text-rose-600 font-semibold mt-1">{validationErrors.schoolAddress}</p>
                    )}
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">School Contact Number</label>
                    <input
                      type="text"
                      value={draftForm.schoolContactNumber}
                      onChange={(e) => setDraftForm((p) => ({ ...p, schoolContactNumber: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    {validationErrors.schoolContactNumber && (
                      <p className="text-rose-600 font-semibold mt-1">{validationErrors.schoolContactNumber}</p>
                    )}
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">School Email Address</label>
                    <input
                      type="email"
                      value={draftForm.schoolEmail}
                      onChange={(e) => setDraftForm((p) => ({ ...p, schoolEmail: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    {validationErrors.schoolEmail && (
                      <p className="text-rose-600 font-semibold mt-1">{validationErrors.schoolEmail}</p>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">School Website</label>
                    <input
                      type="text"
                      value={draftForm.schoolWebsite}
                      onChange={(e) => setDraftForm((p) => ({ ...p, schoolWebsite: e.target.value }))}
                      placeholder="https://example.edu.in"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    {validationErrors.schoolWebsite && (
                      <p className="text-rose-600 font-semibold mt-1">{validationErrors.schoolWebsite}</p>
                    )}
                  </div>
                </div>

                {/* Narrative Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">School Introduction / About School</label>
                    <textarea
                      rows={3}
                      value={draftForm.schoolIntroduction}
                      onChange={(e) => setDraftForm((p) => ({ ...p, schoolIntroduction: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">School History</label>
                    <textarea
                      rows={3}
                      value={draftForm.schoolHistory}
                      onChange={(e) => setDraftForm((p) => ({ ...p, schoolHistory: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">School Vision</label>
                    <textarea
                      rows={3}
                      value={draftForm.schoolVision}
                      onChange={(e) => setDraftForm((p) => ({ ...p, schoolVision: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">School Mission</label>
                    <textarea
                      rows={3}
                      value={draftForm.schoolMission}
                      onChange={(e) => setDraftForm((p) => ({ ...p, schoolMission: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">School Objectives</label>
                    <textarea
                      rows={3}
                      value={draftForm.schoolObjectives}
                      onChange={(e) => setDraftForm((p) => ({ ...p, schoolObjectives: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">School Facilities</label>
                    <textarea
                      rows={3}
                      value={draftForm.schoolFacilities}
                      onChange={(e) => setDraftForm((p) => ({ ...p, schoolFacilities: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Principal&apos;s Message</label>
                    <textarea
                      rows={3}
                      value={draftForm.principalsMessage}
                      onChange={(e) => setDraftForm((p) => ({ ...p, principalsMessage: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Other School Information</label>
                    <textarea
                      rows={3}
                      value={draftForm.otherSchoolInfo}
                      onChange={(e) => setDraftForm((p) => ({ ...p, otherSchoolInfo: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Form Footer Buttons */}
                <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleCancelSchoolEdit}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isSavingSchoolInfo}
                    onClick={() => void handleSaveSchoolSection('About Us')}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold shadow-sm disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isSavingSchoolInfo ? 'Saving...' : 'Save Changes'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-5 text-xs">
                {/* Contact Quick Strip */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-rose-500" />
                      <span>School Address</span>
                    </span>
                    <p className="font-bold text-slate-900">{schoolAboutInfo.schoolAddress}</p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Contact Number</span>
                    </span>
                    <p className="font-mono font-bold text-slate-900">{schoolAboutInfo.schoolContactNumber || '—'}</p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Email Address</span>
                    </span>
                    <p className="font-bold text-slate-900 break-all">{schoolAboutInfo.schoolEmail || '—'}</p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <Globe className="w-3.5 h-3.5 text-sky-600" />
                      <span>Website</span>
                    </span>
                    <p className="font-bold text-indigo-700 break-all">{schoolAboutInfo.schoolWebsite || '—'}</p>
                  </div>
                </div>

                {/* Structured About Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-1.5">
                    <h3 className="font-black text-slate-900 flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-indigo-600" />
                      <span>School Introduction / About School</span>
                    </h3>
                    <p className="text-slate-600 leading-relaxed whitespace-pre-line">
                      {schoolAboutInfo.schoolIntroduction}
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-1.5">
                    <h3 className="font-black text-slate-900 flex items-center gap-1.5">
                      <History className="w-4 h-4 text-amber-600" />
                      <span>School History</span>
                    </h3>
                    <p className="text-slate-600 leading-relaxed whitespace-pre-line">
                      {schoolAboutInfo.schoolHistory}
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200/80 space-y-1.5">
                    <h3 className="font-black text-emerald-950 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      <span>School Vision</span>
                    </h3>
                    <p className="text-emerald-900/90 leading-relaxed whitespace-pre-line">
                      {schoolAboutInfo.schoolVision}
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-200/80 space-y-1.5">
                    <h3 className="font-black text-indigo-950 flex items-center gap-1.5">
                      <Target className="w-4 h-4 text-indigo-600" />
                      <span>School Mission</span>
                    </h3>
                    <p className="text-indigo-900/90 leading-relaxed whitespace-pre-line">
                      {schoolAboutInfo.schoolMission}
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-1.5">
                    <h3 className="font-black text-slate-900 flex items-center gap-1.5">
                      <ClipboardList className="w-4 h-4 text-indigo-600" />
                      <span>School Objectives</span>
                    </h3>
                    <p className="text-slate-600 leading-relaxed whitespace-pre-line">
                      {schoolAboutInfo.schoolObjectives}
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-1.5">
                    <h3 className="font-black text-slate-900 flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-emerald-600" />
                      <span>School Facilities</span>
                    </h3>
                    <p className="text-slate-600 leading-relaxed whitespace-pre-line">
                      {schoolAboutInfo.schoolFacilities}
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200/80 space-y-1.5">
                    <h3 className="font-black text-amber-950 flex items-center gap-1.5">
                      <MessageSquareQuote className="w-4 h-4 text-amber-600" />
                      <span>Principal&apos;s Message</span>
                    </h3>
                    <p className="text-amber-950/90 leading-relaxed whitespace-pre-line">
                      {schoolAboutInfo.principalsMessage}
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-1.5">
                    <h3 className="font-black text-slate-900 flex items-center gap-1.5">
                      <Info className="w-4 h-4 text-slate-600" />
                      <span>Other School Information</span>
                    </h3>
                    <p className="text-slate-600 leading-relaxed whitespace-pre-line">
                      {schoolAboutInfo.otherSchoolInfo}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ================================================================= */}
      {/* SECTION B: APP INFORMATION (SCHOOL ADMIN EDITABLE ONLY)           */}
      {/* ================================================================= */}
      {activeSection === 'app-info' && (
        <section
          aria-label="Application Information"
          data-testid="about-us-app-info-section"
          className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden"
        >
          <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center shrink-0">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900">
                  {schoolAboutInfo.appName}
                </h2>
                <p className="text-xs text-slate-500">
                  Version <strong className="font-mono text-indigo-700">{schoolAboutInfo.appVersion}</strong> • Editable by School Admin (Developer Profile remains untouched)
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {canEditSchoolInfo ? (
                isEditingAppInfo ? (
                  <>
                    <button
                      type="button"
                      onClick={handleCancelSchoolEdit}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Cancel</span>
                    </button>
                    <button
                      type="button"
                      disabled={isSavingSchoolInfo}
                      onClick={() => void handleSaveSchoolSection('App Information')}
                      data-testid="save-app-info-btn"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-xs disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{isSavingSchoolInfo ? 'Saving...' : 'Save App Info'}</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleStartEditAppInfo}
                    data-testid="edit-app-info-btn"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold shadow-xs"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit App Information</span>
                  </button>
                )
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 border border-slate-200 text-xs font-bold">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Read-Only</span>
                </span>
              )}
            </div>
          </div>

          <div className="p-6 text-xs">
            {isEditingAppInfo ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">App Name *</label>
                    <input
                      type="text"
                      value={draftForm.appName}
                      onChange={(e) => setDraftForm((p) => ({ ...p, appName: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    {validationErrors.appName && (
                      <p className="text-rose-600 font-semibold mt-1">{validationErrors.appName}</p>
                    )}
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">App Version *</label>
                    <input
                      type="text"
                      value={draftForm.appVersion}
                      onChange={(e) => setDraftForm((p) => ({ ...p, appVersion: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    {validationErrors.appVersion && (
                      <p className="text-rose-600 font-semibold mt-1">{validationErrors.appVersion}</p>
                    )}
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">App Support Email</label>
                    <input
                      type="email"
                      value={draftForm.appSupportEmail}
                      onChange={(e) => setDraftForm((p) => ({ ...p, appSupportEmail: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    {validationErrors.appSupportEmail && (
                      <p className="text-rose-600 font-semibold mt-1">{validationErrors.appSupportEmail}</p>
                    )}
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">App Support Contact Number</label>
                    <input
                      type="text"
                      value={draftForm.appSupportContactNumber}
                      onChange={(e) => setDraftForm((p) => ({ ...p, appSupportContactNumber: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    {validationErrors.appSupportContactNumber && (
                      <p className="text-rose-600 font-semibold mt-1">{validationErrors.appSupportContactNumber}</p>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">Copyright Information</label>
                    <input
                      type="text"
                      value={draftForm.copyrightInfo}
                      onChange={(e) => setDraftForm((p) => ({ ...p, copyrightInfo: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">App Description</label>
                    <textarea
                      rows={3}
                      value={draftForm.appDescription}
                      onChange={(e) => setDraftForm((p) => ({ ...p, appDescription: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">App Purpose</label>
                    <textarea
                      rows={3}
                      value={draftForm.appPurpose}
                      onChange={(e) => setDraftForm((p) => ({ ...p, appPurpose: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">App Features</label>
                    <textarea
                      rows={4}
                      value={draftForm.appFeatures}
                      onChange={(e) => setDraftForm((p) => ({ ...p, appFeatures: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Privacy Policy</label>
                    <textarea
                      rows={4}
                      value={draftForm.privacyPolicy}
                      onChange={(e) => setDraftForm((p) => ({ ...p, privacyPolicy: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Terms &amp; Conditions</label>
                    <textarea
                      rows={4}
                      value={draftForm.termsAndConditions}
                      onChange={(e) => setDraftForm((p) => ({ ...p, termsAndConditions: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleCancelSchoolEdit}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isSavingSchoolInfo}
                    onClick={() => void handleSaveSchoolSection('App Information')}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold shadow-sm disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isSavingSchoolInfo ? 'Saving...' : 'Save App Information'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">App Name</span>
                    <strong className="text-slate-900 font-extrabold mt-0.5 block">{schoolAboutInfo.appName}</strong>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">App Version</span>
                    <strong className="text-indigo-700 font-mono font-extrabold mt-0.5 block">{schoolAboutInfo.appVersion}</strong>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Support Email</span>
                    <strong className="text-slate-900 font-bold mt-0.5 block break-all">{schoolAboutInfo.appSupportEmail || '—'}</strong>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Support Contact</span>
                    <strong className="text-slate-900 font-mono font-bold mt-0.5 block">{schoolAboutInfo.appSupportContactNumber || '—'}</strong>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-1.5">
                    <h3 className="font-black text-slate-900">App Description</h3>
                    <p className="text-slate-600 leading-relaxed whitespace-pre-line">{schoolAboutInfo.appDescription}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-1.5">
                    <h3 className="font-black text-slate-900">App Purpose</h3>
                    <p className="text-slate-600 leading-relaxed whitespace-pre-line">{schoolAboutInfo.appPurpose}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-indigo-50/40 border border-indigo-200/80 space-y-1.5 md:col-span-2">
                    <h3 className="font-black text-indigo-950">Key App Features</h3>
                    <p className="text-indigo-950/90 leading-relaxed whitespace-pre-line">{schoolAboutInfo.appFeatures}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-1.5">
                    <h3 className="font-black text-slate-900 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-emerald-600" />
                      <span>Privacy Policy</span>
                    </h3>
                    <p className="text-slate-600 leading-relaxed whitespace-pre-line">{schoolAboutInfo.privacyPolicy}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-1.5">
                    <h3 className="font-black text-slate-900 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-indigo-600" />
                      <span>Terms &amp; Conditions</span>
                    </h3>
                    <p className="text-slate-600 leading-relaxed whitespace-pre-line">{schoolAboutInfo.termsAndConditions}</p>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-100/80 border border-slate-200 flex items-center gap-2 text-slate-700 font-semibold">
                  <Copyright className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>{schoolAboutInfo.copyrightInfo}</span>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ================================================================= */}
      {/* SECTION C: DEVELOPER / ADMINISTRATOR PROFILE (STRICTLY PROTECTED) */}
      {/* ================================================================= */}
      {activeSection === 'developer' && (
        <section
          aria-label="Protected App Developer and Administrator Profile"
          data-testid="protected-developer-profile-section"
          className="space-y-5"
        >
          {/* Strict Protection Notice */}
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 text-xs flex items-start gap-3 shadow-xs">
            <Lock className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-black text-amber-950">
                Strictly Protected Developer &amp; Original Ownership Profile (Read-Only for School Admin)
              </p>
              <p className="text-amber-900/90 leading-relaxed">
                Stored in an isolated protected database collection (<code className="font-mono font-bold">/protectedDeveloperProfiles</code>) enforced by both Backend API &amp; Firestore Security Rules. School Admin edits to About Us or App Information never modify, replace, or delete this record.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-2xl font-black text-amber-300 shrink-0">
                  {(activeProfile.name || 'M').charAt(0).toUpperCase()}
                </div>
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400/20 border border-amber-300/30 text-[10px] font-extrabold uppercase tracking-wider text-amber-200">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Verified Original App Developer &amp; Super Administrator</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                    {activeProfile.name}
                  </h2>
                  <p className="text-xs sm:text-sm font-bold text-indigo-200">
                    {activeProfile.designation}
                  </p>
                </div>
              </div>

              {/* Separate Protected Super Admin / App Developer Controls — HIDDEN from School Admin & Teacher */}
              <div className="flex flex-wrap items-center gap-2 self-start md:self-center">
                {isOriginalSuperDeveloper ? (
                  devMode === 'view' ? (
                    <>
                      {isDevVaultUnlocked && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsChangingPassword(true);
                            setPendingDevAction(null);
                            setPasswordInput('');
                            setNewPasswordInput('');
                            setConfirmPasswordInput('');
                            setAuthError(null);
                            setShowAuthModal(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-indigo-100 border border-white/20 text-xs font-bold"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          <span>Vault Password</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRequestSuperDevAction('edit')}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold shadow-md"
                      >
                        {isDevVaultUnlocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                        <span>Super Admin Protected Console</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRequestSuperDevAction('add')}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/25 text-xs font-bold"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Add Protected Profile</span>
                      </button>
                    </>
                  ) : null
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/20 border border-rose-400/40 text-rose-100 text-xs font-extrabold">
                    <ShieldAlert className="w-4 h-4 text-rose-300" />
                    <span>Read-Only (Locked for {effectiveRole === 'teacher' ? 'Teacher' : 'School Admin'})</span>
                  </span>
                )}
              </div>
            </div>

            <div className="p-6">
              {devMode === 'view' || !isOriginalSuperDeveloper ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                        <span>App Developer &amp; Administrator Name</span>
                      </span>
                      <p className="text-sm font-black text-slate-900">{activeProfile.name}</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                        <span>Developer / Administrator Profile</span>
                      </span>
                      <p className="text-sm font-black text-indigo-900">{activeProfile.designation}</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Primary Institution</span>
                      </span>
                      <p className="text-sm font-black text-slate-900">{activeProfile.institution}</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Developer Contact Email</span>
                      </span>
                      <p className="text-sm font-bold text-slate-900 break-all">
                        {activeProfile.email || ORIGINAL_DEVELOPER_EMAIL}
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Developer Contact Phone</span>
                      </span>
                      <p className="text-sm font-mono font-bold text-slate-900">
                        {activeProfile.phone || '+91 94190 12345'}
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-rose-600" />
                        <span>District &amp; Location</span>
                      </span>
                      <p className="text-sm font-bold text-slate-900">
                        {developerLocationSummary || `${activeProfile.district}, ${activeProfile.unionTerritory}`}
                      </p>
                    </div>
                  </div>

                  {/* Original App Ownership Statement */}
                  <div className="p-4 rounded-2xl bg-slate-900 text-slate-100 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <p className="font-extrabold text-amber-300 uppercase tracking-wider text-[10px]">
                        Original App Ownership &amp; Integrity Protection
                      </p>
                      <p className="text-slate-200 leading-relaxed">
                        Original architecture, administration ownership, and developer identity belong exclusively to <strong>{activeProfile.name}</strong> ({activeProfile.designation}). This record cannot be edited, overwritten, or deleted by School Admins.
                      </p>
                    </div>
                    <span className="px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 font-mono text-[10px] font-bold shrink-0">
                      IMMUTABLE TO SCHOOL ADMIN
                    </span>
                  </div>

                  {/* Role-Based Access Control (RBAC) Matrix */}
                  <div className="rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                      <h3 className="text-xs font-black text-slate-800">
                        Role-Based Access Control (RBAC) Enforcement Matrix
                      </h3>
                      <span className="text-[10px] font-bold text-slate-500">
                        Enforced on Frontend, Express API &amp; Firestore Rules
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-white border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500">
                            <th className="py-2.5 px-4">User Role</th>
                            <th className="py-2.5 px-4">About Us</th>
                            <th className="py-2.5 px-4">App Information</th>
                            <th className="py-2.5 px-4">Developer / Ownership Profile</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          <tr>
                            <td className="py-2.5 px-4 font-bold text-slate-900">School Admin</td>
                            <td className="py-2.5 px-4 font-bold text-emerald-700">View &amp; Edit</td>
                            <td className="py-2.5 px-4 font-bold text-emerald-700">View &amp; Edit</td>
                            <td className="py-2.5 px-4 font-bold text-rose-700">Read-Only (Edit / Delete Blocked)</td>
                          </tr>
                          <tr>
                            <td className="py-2.5 px-4 font-bold text-slate-900">Teacher</td>
                            <td className="py-2.5 px-4 text-slate-600">Read-Only</td>
                            <td className="py-2.5 px-4 text-slate-600">Read-Only</td>
                            <td className="py-2.5 px-4 text-slate-600">Read-Only</td>
                          </tr>
                          <tr>
                            <td className="py-2.5 px-4 font-bold text-indigo-900">App Developer / Super Admin</td>
                            <td className="py-2.5 px-4 font-bold text-emerald-700">Full Access</td>
                            <td className="py-2.5 px-4 font-bold text-emerald-700">Full Access</td>
                            <td className="py-2.5 px-4 font-bold text-indigo-700">Protected Console Access (Delete Disabled)</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Protected Profiles Directory (Switch only for Original Super Developer) */}
                  {profiles.length > 1 && isOriginalSuperDeveloper && (
                    <div className="pt-4 border-t border-slate-100 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                          Protected Super Admin Profiles ({profiles.length})
                        </h3>
                        <button
                          type="button"
                          onClick={() => handleRequestSuperDevAction('add')}
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Protected Profile</span>
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {profiles.map((prof) => {
                          const isActive = prof.id === activeProfile.id;
                          return (
                            <div
                              key={prof.id}
                              className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                                isActive ? 'bg-indigo-50/70 border-indigo-300' : 'bg-white border-slate-200'
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-extrabold text-xs text-slate-900 truncate">{prof.name}</span>
                                  {isActive && (
                                    <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold">
                                      Active
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] font-semibold text-indigo-700 truncate">{prof.designation}</p>
                              </div>
                              {!isActive && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onSelectActiveProfile(prof.id);
                                    showToast(`Active Protected Developer Profile switched to ${prof.name}.`);
                                  }}
                                  className="px-3 py-1.5 rounded-xl bg-white border border-slate-300 hover:bg-indigo-600 hover:text-white text-xs font-bold text-slate-700 shrink-0"
                                >
                                  Set Active
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <AdminEditor
                  mode={devMode}
                  activeProfile={activeProfile}
                  school={school}
                  isAuthorized={isOriginalSuperDeveloper}
                  isUnlocked={isDevVaultUnlocked}
                  onSave={(profile, isNew) => void handleAdminEditorSave(profile, isNew)}
                  onCancel={() => setDevMode('view')}
                />
              )}
            </div>
          </div>
        </section>
      )}

      {/* ================================================================= */}
      {/* SECTION D: SCHOOL INFO UPDATE AUDIT LOG                           */}
      {/* ================================================================= */}
      {activeSection === 'audit' && (
        <section
          aria-label="School Information Audit Log"
          data-testid="school-info-audit-log-section"
          className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden"
        >
          <div className="p-5 border-b border-slate-100 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-600" />
                <span>School Information Update Audit Log</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Immutable history of School Admin edits to About Us, App Information, and School Logo.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-mono text-xs font-bold">
              {aboutAuditLogs.length} Record(s)
            </span>
          </div>

          <div className="p-5">
            {aboutAuditLogs.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500 space-y-1.5">
                <History className="w-7 h-7 text-slate-300 mx-auto" />
                <p className="font-bold text-slate-700">No School Information Edits Recorded Yet</p>
                <p>Any update made by a School Admin to About Us or App Information will be logged here automatically.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500">
                      <th className="py-2.5 px-3">Timestamp</th>
                      <th className="py-2.5 px-3">Section</th>
                      <th className="py-2.5 px-3">Actor &amp; Role</th>
                      <th className="py-2.5 px-3">Summary &amp; Changed Fields</th>
                      <th className="py-2.5 px-3">Sync</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {aboutAuditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold text-[10px]">
                            {log.section}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900">{log.actorName}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{log.actorRole}</div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">{log.summary}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              log.syncedToCloud
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {log.syncedToCloud ? 'Cloud Logged' : 'Local Logged'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Protected Super Admin / App Developer Password Modal (ONLY reachable by Original Super Admin) */}
      {showAuthModal && isOriginalSuperDeveloper && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold">
                  {isChangingPassword
                    ? 'Change Protected Developer Vault Password'
                    : hasPasswordConfigured
                    ? 'Super Admin / App Developer Verification'
                    : 'Set Protected Developer Vault Password'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAuthModal(false);
                  setIsChangingPassword(false);
                  setPendingDevAction(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleVerifyOrCreatePassword} className="p-6 space-y-4 text-xs">
              <p className="text-slate-600 leading-relaxed">
                Separate protected administration vault exclusively for the original App Developer / Super Administrator.
              </p>

              {(hasPasswordConfigured || isChangingPassword) && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {isChangingPassword ? 'Current Vault Password *' : 'Super Admin Vault Password *'}
                  </label>
                  <input
                    type="password"
                    required
                    autoFocus
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Enter vault password"
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}

              {(!hasPasswordConfigured || isChangingPassword) && (
                <>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      {isChangingPassword ? 'New Vault Password *' : 'Create Vault Password *'}
                    </label>
                    <input
                      type="password"
                      required
                      autoFocus={!isChangingPassword}
                      value={newPasswordInput}
                      onChange={(e) => setNewPasswordInput(e.target.value)}
                      placeholder="Minimum 4 characters"
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Confirm Vault Password *</label>
                    <input
                      type="password"
                      required
                      value={confirmPasswordInput}
                      onChange={(e) => setConfirmPasswordInput(e.target.value)}
                      placeholder="Re-enter password"
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </>
              )}

              {authError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold">
                  {authError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowAuthModal(false);
                    setIsChangingPassword(false);
                    setPendingDevAction(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold shadow-sm"
                >
                  {isChangingPassword
                    ? 'Update Password'
                    : hasPasswordConfigured
                    ? 'Unlock Protected Console'
                    : 'Set Password & Unlock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
