import React, { useState, useEffect } from 'react';
import {
  Building2,
  CheckCircle2,
  Edit2,
  MapPin,
  Save,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import { DeveloperAdminProfile, SchoolProfile } from '../types';

export interface AdminEditorProps {
  mode: 'edit' | 'add';
  activeProfile: DeveloperAdminProfile;
  school: SchoolProfile;
  isAuthorized: boolean;
  isUnlocked: boolean;
  onSave: (profile: DeveloperAdminProfile, isNew: boolean) => void;
  onCancel: () => void;
}

const DESIGNATION_PRESETS = [
  'App Developer / Administrator',
  'Administrator / Headmaster',
  'Principal / Administrator',
  'System Administrator',
];

/**
 * Dedicated Admin Editor component rendered inside About Us & App Information.
 * Reads from and updates the `devAdminProfiles` state, persisting changes to
 * localStorage and propagating updates globally across the application.
 */
export const AdminEditor: React.FC<AdminEditorProps> = ({
  mode,
  activeProfile,
  school,
  isAuthorized,
  isUnlocked,
  onSave,
  onCancel,
}) => {
  const [name, setName] = useState<string>(
    mode === 'add' ? '' : activeProfile.name || 'Mohd Yousuf Wani'
  );
  const [designation, setDesignation] = useState<string>(
    mode === 'add'
      ? 'Administrator'
      : activeProfile.designation || 'App Developer / Administrator'
  );
  const [institution, setInstitution] = useState<string>(
    activeProfile.institution || school.name || 'Govt Middle School, Pamposh Colony'
  );
  const [locationLocality, setLocationLocality] = useState<string>(
    activeProfile.locality || school.villageTown || 'Pamposh Colony'
  );
  const [district, setDistrict] = useState<string>(
    activeProfile.district || school.district || 'Srinagar'
  );
  const [unionTerritory, setUnionTerritory] = useState<string>(
    activeProfile.unionTerritory || school.state || 'Jammu & Kashmir, India'
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === 'edit') {
      setName(activeProfile.name || '');
      setDesignation(activeProfile.designation || 'App Developer / Administrator');
      setInstitution(activeProfile.institution || school.name || '');
      setLocationLocality(activeProfile.locality || '');
      setDistrict(activeProfile.district || school.district || '');
      setUnionTerritory(activeProfile.unionTerritory || 'Jammu & Kashmir, India');
    } else {
      setName('');
      setDesignation('Administrator');
      setInstitution(activeProfile.institution || school.name || 'Govt Middle School, Pamposh Colony');
      setLocationLocality(activeProfile.locality || 'Pamposh Colony');
      setDistrict(activeProfile.district || school.district || 'Srinagar');
      setUnionTerritory(activeProfile.unionTerritory || 'Jammu & Kashmir, India');
    }
    setError(null);
  }, [mode, activeProfile, school.name, school.district]);

  const formattedLocationPreview = [
    locationLocality.trim(),
    district.trim() ? `District ${district.trim()}` : '',
    unionTerritory.trim(),
  ]
    .filter(Boolean)
    .join(', ');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isAuthorized || !isUnlocked) {
      setError('Administrator password authentication is required before saving changes.');
      return;
    }

    const cleanName = name.trim();
    const cleanDesignation = designation.trim();
    const cleanInstitution = institution.trim();
    const cleanLocality = locationLocality.trim();
    const cleanDistrict = district.trim();
    const cleanUT = unionTerritory.trim();

    if (!cleanName || !cleanDesignation || !cleanInstitution || !cleanDistrict || !cleanUT) {
      setError('Please complete Name, Designation, Institution, District, and Location fields.');
      return;
    }

    const nowIso = new Date().toISOString();

    if (mode === 'add') {
      const created: DeveloperAdminProfile = {
        id: `dev-admin-${Date.now()}`,
        name: cleanName,
        designation: cleanDesignation,
        institution: cleanInstitution,
        locality: cleanLocality,
        district: cleanDistrict,
        unionTerritory: cleanUT,
        email: activeProfile.email || school.email,
        phone: activeProfile.phone || school.contactNumber,
        updatedAt: nowIso,
      };
      onSave(created, true);
      return;
    }

    const updated: DeveloperAdminProfile = {
      ...activeProfile,
      name: cleanName,
      designation: cleanDesignation,
      institution: cleanInstitution,
      locality: cleanLocality,
      district: cleanDistrict,
      unionTerritory: cleanUT,
      updatedAt: nowIso,
    };
    onSave(updated, false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 text-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-200">
            {mode === 'add' ? <UserPlus className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900">
              Admin Editor — {mode === 'add' ? 'Add New Administrator Profile' : 'Edit Administrator Profile'}
            </h3>
            <p className="text-[11px] text-slate-500">
              Updates <code className="font-mono text-indigo-700">devAdminProfiles</code> state, persists in localStorage, and syncs across the app.
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 self-start sm:self-auto">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Password Verified Session</span>
        </span>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Field 1: Name */}
        <div>
          <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
            <span>Administrator / Developer Name *</span>
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Mohd Yousuf Wani"
            className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Field 2: Designation */}
        <div>
          <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Designation *</span>
          </label>
          <input
            type="text"
            required
            value={designation}
            onChange={(e) => setDesignation(e.target.value)}
            placeholder="e.g. App Developer / Administrator"
            className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {DESIGNATION_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setDesignation(preset)}
                className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-indigo-100 text-[10px] font-semibold text-slate-700 border border-slate-200 transition-colors"
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {/* Field 3: Institution */}
        <div className="md:col-span-2">
          <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Institution *</span>
          </label>
          <input
            type="text"
            required
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
            placeholder="e.g. Govt Middle School, Pamposh Colony"
            className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Field 4: Location (Locality, District, Union Territory / State) */}
        <div>
          <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-rose-600" />
            <span>Location (Locality / Area)</span>
          </label>
          <input
            type="text"
            value={locationLocality}
            onChange={(e) => setLocationLocality(e.target.value)}
            placeholder="e.g. Pamposh Colony"
            className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-indigo-600" />
            <span>District *</span>
          </label>
          <input
            type="text"
            required
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            placeholder="e.g. Srinagar"
            className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-emerald-600" />
            <span>Location (Union Territory / State &amp; Country) *</span>
          </label>
          <input
            type="text"
            required
            value={unionTerritory}
            onChange={(e) => setUnionTerritory(e.target.value)}
            placeholder="e.g. Jammu & Kashmir, India"
            className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Live Location & Global Sync Preview */}
      <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200 flex items-start gap-2.5">
        <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
        <div className="text-[11px] text-indigo-950">
          <span className="font-bold block">Global Display Preview:</span>
          <span>
            <strong>{name.trim() || 'Administrator Name'}</strong> ({designation.trim() || 'Designation'}) •{' '}
            {institution.trim() || 'Institution'} • {formattedLocationPreview || 'Location'}
          </span>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          <span>Cancel</span>
        </button>
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold shadow-md active:scale-95 transition-all"
        >
          <Save className="w-4 h-4" />
          <span>{mode === 'add' ? 'Save New Profile' : 'Save Changes'}</span>
        </button>
      </div>
    </form>
  );
};
