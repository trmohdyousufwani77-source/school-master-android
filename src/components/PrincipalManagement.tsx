import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Award,
  Calendar,
  Camera,
  CheckCircle2,
  Edit2,
  Eye,
  Mail,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  UserCheck,
  X,
} from 'lucide-react';
import { AdminRoleType, PrincipalRecord, SchoolProfile } from '../types';
import { Language } from '../utils/translations';
import { SchoolEmblem } from './SchoolEmblem';

interface PrincipalManagementProps {
  principals: PrincipalRecord[];
  school: SchoolProfile;
  effectiveRole: AdminRoleType;
  initialMode?: 'list' | 'add' | 'edit';
  language: Language;
  onAddPrincipal: (record: PrincipalRecord) => void;
  onUpdatePrincipal: (record: PrincipalRecord) => void;
  onDeletePrincipal: (principalId: string) => void;
  onSetCurrentPrincipal: (principalId: string) => void;
}

const DESIGNATIONS: PrincipalRecord['designation'][] = [
  'Headmaster',
  'Principal',
  'Headmistress',
  'Officiating Principal',
  'In-Charge Headmaster',
];

export const PrincipalManagement: React.FC<PrincipalManagementProps> = ({
  principals,
  school,
  effectiveRole,
  initialMode = 'list',
  onAddPrincipal,
  onUpdatePrincipal,
  onDeletePrincipal,
  onSetCurrentPrincipal,
}) => {
  const isAuthorizedAdmin = effectiveRole !== 'teacher';
  const currentPrincipal = useMemo(
    () => principals.find((p) => p.isCurrent) || principals[0],
    [principals]
  );

  const [viewMode, setViewMode] = useState<'list' | 'add' | 'edit'>(initialMode);
  const [editingId, setEditingId] = useState<string | null>(
    initialMode === 'edit' && currentPrincipal ? currentPrincipal.id : null
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterScope, setFilterScope] = useState<'all' | 'current' | 'previous'>('all');
  const [viewingPrincipal, setViewingPrincipal] = useState<PrincipalRecord | null>(null);
  const [principalToDelete, setPrincipalToDelete] = useState<PrincipalRecord | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Form State
  const [fullName, setFullName] = useState<string>(
    initialMode === 'edit' && currentPrincipal ? currentPrincipal.fullName : ''
  );
  const [designation, setDesignation] = useState<PrincipalRecord['designation']>(
    initialMode === 'edit' && currentPrincipal ? currentPrincipal.designation : 'Headmaster'
  );
  const [joiningDate, setJoiningDate] = useState<string>(
    initialMode === 'edit' && currentPrincipal ? currentPrincipal.joiningDate : new Date().toISOString().slice(0, 10)
  );
  const [leavingDate, setLeavingDate] = useState<string>(
    initialMode === 'edit' && currentPrincipal?.leavingDate ? currentPrincipal.leavingDate : ''
  );
  const [contactNumber, setContactNumber] = useState<string>(
    initialMode === 'edit' && currentPrincipal ? currentPrincipal.contactNumber : ''
  );
  const [email, setEmail] = useState<string>(
    initialMode === 'edit' && currentPrincipal?.email ? currentPrincipal.email : ''
  );
  const [qualification, setQualification] = useState<string>(
    initialMode === 'edit' && currentPrincipal ? currentPrincipal.qualification : ''
  );
  const [description, setDescription] = useState<string>(
    initialMode === 'edit' && currentPrincipal ? currentPrincipal.description : ''
  );
  const [photoDataUrl, setPhotoDataUrl] = useState<string>(
    initialMode === 'edit' && currentPrincipal?.photoDataUrl ? currentPrincipal.photoDataUrl : ''
  );
  const [isCurrent, setIsCurrent] = useState<boolean>(true);
  const [formError, setFormError] = useState<string | null>(null);

  const photoInputRef = useRef<HTMLInputElement>(null);

  const notify = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const openAddForm = () => {
    if (!isAuthorizedAdmin) {
      notify('Only authorised administrators can add Principal / Headmaster records.');
      return;
    }
    setEditingId(null);
    setFullName('');
    setDesignation('Headmaster');
    setJoiningDate(new Date().toISOString().slice(0, 10));
    setLeavingDate('');
    setContactNumber('');
    setEmail('');
    setQualification('');
    setDescription('');
    setPhotoDataUrl('');
    setIsCurrent(true);
    setFormError(null);
    setViewMode('add');
  };

  const openEditForm = (rec: PrincipalRecord) => {
    if (!isAuthorizedAdmin) {
      notify('Only authorised administrators can edit Principal / Headmaster records.');
      return;
    }
    setEditingId(rec.id);
    setFullName(rec.fullName);
    setDesignation(rec.designation);
    setJoiningDate(rec.joiningDate);
    setLeavingDate(rec.leavingDate || '');
    setContactNumber(rec.contactNumber);
    setEmail(rec.email || '');
    setQualification(rec.qualification);
    setDescription(rec.description);
    setPhotoDataUrl(rec.photoDataUrl || '');
    setIsCurrent(rec.isCurrent);
    setFormError(null);
    setViewMode('edit');
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFormError('Please select a valid image file (PNG, JPG, WebP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotoDataUrl(reader.result);
        setFormError(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthorizedAdmin) {
      setFormError('Permission denied: Administrator role required.');
      return;
    }
    if (fullName.trim().length < 2) {
      setFormError('Full Name is required (minimum 2 characters).');
      return;
    }
    if (!joiningDate) {
      setFormError('Joining Date is required.');
      return;
    }
    if (!contactNumber.trim()) {
      setFormError('Contact Number is required.');
      return;
    }
    if (!qualification.trim()) {
      setFormError('Qualification is required.');
      return;
    }

    const nowIso = new Date().toISOString();

    if (viewMode === 'add') {
      const created: PrincipalRecord = {
        id: `prin-${Date.now()}`,
        fullName: fullName.trim(),
        designation,
        joiningDate,
        leavingDate: !isCurrent && leavingDate ? leavingDate : undefined,
        contactNumber: contactNumber.trim(),
        email: email.trim() || undefined,
        qualification: qualification.trim(),
        description: description.trim(),
        photoDataUrl: photoDataUrl || undefined,
        isCurrent,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      onAddPrincipal(created);
      notify(`Saved "${created.fullName}" (${created.designation}) and updated the dashboard.`);
      setViewMode('list');
      return;
    }

    if (viewMode === 'edit' && editingId) {
      const existing = principals.find((p) => p.id === editingId);
      const updated: PrincipalRecord = {
        id: editingId,
        fullName: fullName.trim(),
        designation,
        joiningDate,
        leavingDate: !isCurrent && leavingDate ? leavingDate : undefined,
        contactNumber: contactNumber.trim(),
        email: email.trim() || undefined,
        qualification: qualification.trim(),
        description: description.trim(),
        photoDataUrl: photoDataUrl || undefined,
        isCurrent,
        createdAt: existing?.createdAt || nowIso,
        updatedAt: nowIso,
      };
      onUpdatePrincipal(updated);
      notify(`Updated "${updated.fullName}" — changes reflected on Home Screen Dashboard.`);
      setViewMode('list');
    }
  };

  const filteredPrincipals = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return principals
      .filter((p) => {
        if (filterScope === 'current' && !p.isCurrent) return false;
        if (filterScope === 'previous' && p.isCurrent) return false;
        if (!q) return true;
        return (
          p.fullName.toLowerCase().includes(q) ||
          p.designation.toLowerCase().includes(q) ||
          p.qualification.toLowerCase().includes(q) ||
          p.contactNumber.toLowerCase().includes(q) ||
          p.joiningDate.includes(q)
        );
      })
      .sort((a, b) => (a.isCurrent === b.isCurrent ? b.joiningDate.localeCompare(a.joiningDate) : a.isCurrent ? -1 : 1));
  }, [principals, searchQuery, filterScope]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {toastMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs font-bold flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{toastMsg}</span>
          </div>
          <button onClick={() => setToastMsg(null)} className="text-emerald-700 hover:text-emerald-950">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navy Blue & Golden-Yellow Material 3 Header */}
      <div className="rounded-3xl bg-gradient-to-r from-[#0f294a] via-[#172554] to-[#0f172a] text-white p-6 sm:p-7 border border-amber-400/35 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <SchoolEmblem size={72} />
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-amber-300">
              {school.name} · U-DISE {school.code}
            </p>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight mt-0.5">
              Principal / Headmaster Management
            </h1>
            <p className="text-xs text-slate-200 mt-1">
              Manage active Head of Institution, upload official photographs, and preserve historical Headmaster tenure archives.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {viewMode !== 'list' && (
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 transition-colors cursor-pointer"
            >
              Back to Directory
            </button>
          )}
          {currentPrincipal && viewMode === 'list' && isAuthorizedAdmin && (
            <button
              type="button"
              onClick={() => openEditForm(currentPrincipal)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-[#0f294a] hover:bg-slate-100 text-xs font-extrabold shadow-sm transition-colors cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Edit Current Principal</span>
            </button>
          )}
          {isAuthorizedAdmin && (
            <button
              type="button"
              onClick={openAddForm}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Principal / Headmaster</span>
            </button>
          )}
        </div>
      </div>

      {/* Role restriction notice for non-admin users */}
      {!isAuthorizedAdmin && (
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 text-xs font-semibold flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
          <span>Read-only view: Switch to an authorised Administrator account to add, edit, or delete Principal / Headmaster records.</span>
        </div>
      )}

      {/* ADD / EDIT FORM */}
      {(viewMode === 'add' || viewMode === 'edit') && (
        <form
          onSubmit={handleSave}
          className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6"
        >
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-black text-[#0f294a]">
                {viewMode === 'add' ? 'Add New Principal / Headmaster' : 'Edit Principal / Headmaster Record'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Updates save immediately to persistent storage and sync automatically to the Home Screen Dashboard.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className="p-2 rounded-xl hover:bg-slate-100 text-slate-500"
              aria-label="Cancel form"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Profile Photograph Uploader */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="w-24 h-24 rounded-2xl bg-[#0f294a] text-amber-300 flex items-center justify-center overflow-hidden border-2 border-amber-400 shrink-0 shadow-sm">
              {photoDataUrl ? (
                <img src={photoDataUrl} alt={fullName || 'Principal Photo'} className="w-full h-full object-cover" />
              ) : (
                <UserCheck className="w-10 h-10" />
              )}
            </div>
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-900">Profile Photograph</div>
              <p className="text-xs text-slate-500">Upload an official portrait photograph (JPG/PNG) or capture via mobile camera.</p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0f294a] hover:bg-[#1e3a8a] text-white text-xs font-bold cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{photoDataUrl ? 'Change Photograph' : 'Upload Photograph'}</span>
                </button>
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 text-xs font-bold border border-amber-300 cursor-pointer">
                  <Camera className="w-3.5 h-3.5" />
                  <span>Capture Camera</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="user"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>
                {photoDataUrl && (
                  <button
                    type="button"
                    onClick={() => setPhotoDataUrl('')}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-700 hover:bg-rose-50 border border-rose-200 cursor-pointer"
                  >
                    Remove Photo
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Full Name *</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g., Mohd Yousuf Wani"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 focus:ring-2 focus:ring-[#0f294a] outline-none"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Designation *</label>
              <select
                value={designation}
                onChange={(e) => setDesignation(e.target.value as PrincipalRecord['designation'])}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 bg-white focus:ring-2 focus:ring-[#0f294a] outline-none"
              >
                {DESIGNATIONS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Joining Date *</label>
              <input
                type="date"
                value={joiningDate}
                onChange={(e) => setJoiningDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 focus:ring-2 focus:ring-[#0f294a] outline-none"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Contact Number *</label>
              <input
                type="tel"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                placeholder="+91 94190 12345"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 focus:ring-2 focus:ring-[#0f294a] outline-none"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Qualification *</label>
              <input
                type="text"
                value={qualification}
                onChange={(e) => setQualification(e.target.value)}
                placeholder="e.g., M.Sc., M.Ed."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 focus:ring-2 focus:ring-[#0f294a] outline-none"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Official Email (Optional)</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="principal@gmspamposh.edu.in"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 focus:ring-2 focus:ring-[#0f294a] outline-none"
              />
            </div>

            <div className="sm:col-span-2 flex flex-wrap items-center gap-6 p-3.5 rounded-xl bg-amber-50/70 border border-amber-200">
              <label className="inline-flex items-center gap-2 font-bold text-slate-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isCurrent}
                  onChange={(e) => setIsCurrent(e.target.checked)}
                  className="w-4 h-4 accent-[#0f294a]"
                />
                <span>Set as Current Active Principal / Headmaster (Display on Home Screen Dashboard)</span>
              </label>

              {!isCurrent && (
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-700">Relieving / End Date:</span>
                  <input
                    type="date"
                    value={leavingDate}
                    onChange={(e) => setLeavingDate(e.target.value)}
                    className="px-2.5 py-1 rounded-lg border border-slate-300 text-slate-900"
                  />
                </div>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">Short Profile / Description</label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Administrative tenure highlights, academic initiatives, and message for students & staff..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 focus:ring-2 focus:ring-[#0f294a] outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-[#0f294a] hover:bg-[#1e3a8a] text-amber-300 font-black text-xs shadow-sm cursor-pointer"
            >
              Save Principal Record
            </button>
          </div>
        </form>
      )}

      {/* CURRENT PRINCIPAL SPOTLIGHT + DIRECTORY */}
      {viewMode === 'list' && (
        <>
          {currentPrincipal && (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                  <div className="w-24 h-24 rounded-2xl bg-[#0f294a] text-amber-300 flex items-center justify-center overflow-hidden border-2 border-amber-400 shadow-md shrink-0">
                    {currentPrincipal.photoDataUrl ? (
                      <img
                        src={currentPrincipal.photoDataUrl}
                        alt={currentPrincipal.fullName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-3xl font-black">{currentPrincipal.fullName.slice(0, 1)}</span>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <div className="text-xs font-extrabold uppercase tracking-wider text-amber-700">
                      Current {currentPrincipal.designation} · {school.name}
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-[#0f294a]">{currentPrincipal.fullName}</h2>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 font-medium">
                      <span className="inline-flex items-center gap-1">
                        <Award className="w-3.5 h-3.5 text-amber-600" />
                        {currentPrincipal.qualification}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                        <Calendar className="w-3.5 h-3.5 text-[#0f294a]" />
                        Joined {currentPrincipal.joiningDate}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                        <Phone className="w-3.5 h-3.5 text-emerald-700" />
                        {currentPrincipal.contactNumber}
                      </span>
                    </div>
                    {currentPrincipal.description && (
                      <p className="text-xs text-slate-600 leading-relaxed max-w-3xl pt-1">
                        {currentPrincipal.description}
                      </p>
                    )}
                  </div>
                </div>

                {isAuthorizedAdmin && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditForm(currentPrincipal)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0f294a] hover:bg-[#1e3a8a] text-white text-xs font-bold cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-amber-300" />
                      <span>Edit Details</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Previous & All Headmasters Searchable Register */}
          <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-[#0f294a]">
                  Headmasters &amp; Principals Tenure Archive ({filteredPrincipals.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Search, inspect, update, or archive current and previous school heads.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search name, degree, year..."
                    className="pl-9 pr-3 py-1.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-[#0f294a] outline-none"
                  />
                </div>

                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl text-xs">
                  {(['all', 'current', 'previous'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setFilterScope(tab)}
                      className={`px-3 py-1 rounded-lg font-bold capitalize transition-colors cursor-pointer ${
                        filterScope === tab
                          ? 'bg-[#0f294a] text-amber-300'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {filteredPrincipals.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-slate-300 rounded-2xl text-xs text-slate-500 space-y-2">
                <p>No Principal / Headmaster records matched your search criteria.</p>
                {isAuthorizedAdmin && (
                  <button
                    type="button"
                    onClick={openAddForm}
                    className="px-4 py-2 rounded-xl bg-[#0f294a] text-white font-bold cursor-pointer"
                  >
                    Add First Record
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredPrincipals.map((rec) => (
                  <div
                    key={rec.id}
                    className={`rounded-2xl border p-4 flex flex-col justify-between gap-3 transition-colors ${
                      rec.isCurrent
                        ? 'border-amber-400 bg-amber-50/30'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="w-14 h-14 rounded-xl bg-[#0f294a] text-amber-300 flex items-center justify-center overflow-hidden shrink-0 border border-amber-400/60">
                        {rec.photoDataUrl ? (
                          <img src={rec.photoDataUrl} alt={rec.fullName} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-lg font-black">{rec.fullName.slice(0, 1)}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-bold text-amber-700">
                          {rec.isCurrent ? 'Current Active Head' : 'Previous Headmaster'} · {rec.designation}
                        </div>
                        <h4 className="text-sm font-black text-slate-900 truncate">{rec.fullName}</h4>
                        <p className="text-xs text-slate-600 truncate">{rec.qualification}</p>
                        <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-1">
                          Tenure: {rec.joiningDate} {rec.leavingDate ? `→ ${rec.leavingDate}` : rec.isCurrent ? '→ Present' : ''}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                      <span className="text-slate-600 font-mono tabular-nums">{rec.contactNumber}</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setViewingPrincipal(rec)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </button>
                        {isAuthorizedAdmin && (
                          <>
                            {!rec.isCurrent && (
                              <button
                                type="button"
                                onClick={() => {
                                  onSetCurrentPrincipal(rec.id);
                                  notify(`Set "${rec.fullName}" as Current Active Principal on Home Screen.`);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold cursor-pointer"
                              >
                                Set Active
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openEditForm(rec)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0f294a] hover:bg-[#1e3a8a] text-white font-semibold cursor-pointer"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setPrincipalToDelete(rec)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold border border-rose-200 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Delete</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* VIEW FULL PROFILE MODAL */}
      {viewingPrincipal && (
        <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <div className="w-16 h-16 rounded-2xl bg-[#0f294a] text-amber-300 flex items-center justify-center overflow-hidden border-2 border-amber-400 shrink-0">
                  {viewingPrincipal.photoDataUrl ? (
                    <img src={viewingPrincipal.photoDataUrl} alt={viewingPrincipal.fullName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl font-black">{viewingPrincipal.fullName.slice(0, 1)}</span>
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold text-amber-700">
                    {viewingPrincipal.isCurrent ? 'Current Head of Institution' : 'Former Headmaster'} · {viewingPrincipal.designation}
                  </div>
                  <h3 className="text-lg font-black text-[#0f294a]">{viewingPrincipal.fullName}</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingPrincipal(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-700 border-t border-b border-slate-100 py-3">
              <div><strong>Qualification:</strong> {viewingPrincipal.qualification}</div>
              <div><strong>Joining Date:</strong> {viewingPrincipal.joiningDate}</div>
              {viewingPrincipal.leavingDate && (
                <div><strong>Relieving Date:</strong> {viewingPrincipal.leavingDate}</div>
              )}
              <div className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-700" />
                <span>{viewingPrincipal.contactNumber}</span>
              </div>
              {viewingPrincipal.email && (
                <div className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-[#0f294a]" />
                  <span>{viewingPrincipal.email}</span>
                </div>
              )}
              <p className="pt-2 text-slate-600 leading-relaxed">{viewingPrincipal.description || 'No additional profile notes.'}</p>
            </div>

            <div className="flex justify-end gap-2">
              {isAuthorizedAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    const target = viewingPrincipal;
                    setViewingPrincipal(null);
                    openEditForm(target);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#0f294a] text-white text-xs font-bold cursor-pointer"
                >
                  Edit Record
                </button>
              )}
              <button
                type="button"
                onClick={() => setViewingPrincipal(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {principalToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-rose-200">
            <div className="flex items-center gap-3 text-rose-700">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Confirm Record Deletion</h3>
                <p className="text-xs text-slate-600">This action will permanently remove the selected record.</p>
              </div>
            </div>
            <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200">
              Delete <strong>{principalToDelete.fullName}</strong> ({principalToDelete.designation}, joined {principalToDelete.joiningDate})?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPrincipalToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const deletedName = principalToDelete.fullName;
                  onDeletePrincipal(principalToDelete.id);
                  setPrincipalToDelete(null);
                  notify(`Deleted Principal / Headmaster record for "${deletedName}".`);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
