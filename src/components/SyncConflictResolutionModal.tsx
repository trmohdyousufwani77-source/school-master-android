import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Database,
  Layers,
  RefreshCw,
  Server,
  Smartphone,
  Sparkles,
  X,
  Check,
  ShieldCheck,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import { SyncConflictItem } from '../types';

interface SyncConflictResolutionModalProps {
  isOpen: boolean;
  conflicts: SyncConflictItem[];
  onClose: () => void;
  onResolveConflicts: (resolvedList: SyncConflictItem[], strategyUsed: string) => void;
  language?: 'en' | 'ur';
}

export const SyncConflictResolutionModal: React.FC<SyncConflictResolutionModalProps> = ({
  isOpen,
  conflicts,
  onClose,
  onResolveConflicts,
  language = 'en',
}) => {
  const [conflictItems, setConflictItems] = useState<SyncConflictItem[]>(conflicts);
  const [selectedId, setSelectedId] = useState<string>(conflicts[0]?.id || '');
  const [resolutions, setResolutions] = useState<Record<string, 'local' | 'server'>>(() => {
    const initial: Record<string, 'local' | 'server'> = {};
    conflicts.forEach((c) => {
      initial[c.id] = c.chosenResolution || 'local';
    });
    return initial;
  });

  // Requirement: "Update the Sync Conflict Resolution modal to include a 'Resolve All Similar' checkbox that allows teachers to batch-resolve multiple identical data conflicts in one click."
  const [resolveAllSimilar, setResolveAllSimilar] = useState<boolean>(true);
  const [appliedBatchNotice, setAppliedBatchNotice] = useState<string | null>(null);

  // Sync state if conflicts prop changes
  React.useEffect(() => {
    setConflictItems(conflicts);
    if (conflicts.length > 0 && !conflicts.some((c) => c.id === selectedId)) {
      setSelectedId(conflicts[0].id);
    }
  }, [conflicts]);

  const activeConflict = useMemo(() => {
    return conflictItems.find((c) => c.id === selectedId) || conflictItems[0];
  }, [conflictItems, selectedId]);

  // Find all similar conflicts sharing the same similarityKey
  const similarConflicts = useMemo(() => {
    if (!activeConflict) return [];
    return conflictItems.filter((c) => c.similarityKey === activeConflict.similarityKey);
  }, [conflictItems, activeConflict]);

  // Handler for setting resolution on a conflict (with Resolve All Similar capability)
  const handleSelectResolution = (conflictId: string, choice: 'local' | 'server') => {
    const target = conflictItems.find((c) => c.id === conflictId);
    if (!target) return;

    if (resolveAllSimilar && target.similarityKey) {
      // Batch update all conflicts sharing the same similarityKey
      const key = target.similarityKey;
      const updatedMap = { ...resolutions };
      const matchingIds: string[] = [];

      conflictItems.forEach((c) => {
        if (c.similarityKey === key) {
          updatedMap[c.id] = choice;
          matchingIds.push(c.id);
        }
      });

      setResolutions(updatedMap);
      setAppliedBatchNotice(
        `✓ Batch-applied '${choice === 'local' ? 'Keep Local' : 'Keep Server'}' to all ${matchingIds.length} similar ${target.category} conflicts.`
      );
      setTimeout(() => setAppliedBatchNotice(null), 3500);
    } else {
      setResolutions((prev) => ({
        ...prev,
        [conflictId]: choice,
      }));
    }
  };

  const handleApplyAll = () => {
    const resolvedPayload = conflictItems.map((c) => ({
      ...c,
      chosenResolution: resolutions[c.id] || 'local',
    }));
    onResolveConflicts(
      resolvedPayload,
      resolveAllSimilar ? 'Batch Resolved with Resolve-All-Similar' : 'Individual Item Resolutions'
    );
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-base text-white">
                  Sync Conflict Resolution Manager
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {conflictItems.length} Divergent Records
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Reconcile differences between device local entries and central cloud database records.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Batch Notice Toast */}
        {appliedBatchNotice && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2 text-xs font-bold text-emerald-800 flex items-center justify-between animate-in fade-in">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{appliedBatchNotice}</span>
            </span>
            <button
              onClick={() => setAppliedBatchNotice(null)}
              className="text-emerald-700 font-black text-xs hover:text-emerald-950"
            >
              ×
            </button>
          </div>
        )}

        {/* Content Body: Sidebar list + Detail reconciliation panel */}
        <div className="grid grid-cols-1 md:grid-cols-12 flex-1 overflow-hidden divide-y md:divide-y-0 md:divide-x divide-slate-200">
          {/* Conflict List Sidebar (4 cols) */}
          <div className="md:col-span-4 p-3 bg-slate-50/70 overflow-y-auto space-y-2 max-h-48 md:max-h-none">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1">
              Conflicting Payloads ({conflictItems.length})
            </div>

            <div className="space-y-1.5">
              {conflictItems.map((c) => {
                const isSelected = c.id === activeConflict?.id;
                const currentChoice = resolutions[c.id] || 'local';

                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={`p-2.5 rounded-xl border cursor-pointer transition-all text-xs ${
                      isSelected
                        ? 'bg-white border-amber-500 shadow-sm ring-1 ring-amber-400'
                        : 'bg-white/80 border-slate-200 hover:bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-extrabold text-slate-900 truncate">
                        {c.studentName || c.title}
                      </span>
                      <span
                        className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded-full border ${
                          currentChoice === 'local'
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                            : 'bg-purple-50 text-purple-700 border-purple-200'
                        }`}
                      >
                        {currentChoice === 'local' ? 'Keep Local' : 'Keep Cloud'}
                      </span>
                    </div>

                    <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                      {c.category.toUpperCase()} • Class {c.classNumber}-{c.section} • Roll #{c.rollNumber}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Conflict Reconciliation Card (8 cols) */}
          {activeConflict ? (
            <div className="md:col-span-8 p-4 sm:p-6 overflow-y-auto space-y-5 bg-white">
              {/* Conflict Header */}
              <div className="border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase bg-amber-100 text-amber-800 border border-amber-300">
                    {activeConflict.category}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    {activeConflict.dateOrExam}
                  </span>
                </div>
                <h4 className="text-base font-black text-slate-900 mt-1">
                  {activeConflict.title}: {activeConflict.studentName} (Roll #{activeConflict.rollNumber})
                </h4>
                <p className="text-xs text-slate-500">
                  Class {activeConflict.classNumber} - Section {activeConflict.section} • Admission #{activeConflict.studentId}
                </p>
              </div>

              {/* Side-by-Side Comparison Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Option 1: Local Device Record */}
                <div
                  onClick={() => handleSelectResolution(activeConflict.id, 'local')}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between space-y-3 ${
                    resolutions[activeConflict.id] === 'local'
                      ? 'border-indigo-600 bg-indigo-50/50 shadow-md ring-2 ring-indigo-200'
                      : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-900">
                        <Smartphone className="w-4 h-4 text-indigo-600" />
                        <span>Local Device (Your Edit)</span>
                      </span>
                      <input
                        type="radio"
                        name={`choice-${activeConflict.id}`}
                        checked={resolutions[activeConflict.id] === 'local'}
                        onChange={() => handleSelectResolution(activeConflict.id, 'local')}
                        className="text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                      />
                    </div>

                    <div className="p-3 bg-white rounded-xl border border-indigo-100 shadow-2xs">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Recorded Value</span>
                      <strong className="text-sm font-extrabold text-slate-900 block mt-0.5">
                        {activeConflict.localValue}
                      </strong>
                    </div>

                    <div className="text-[11px] text-slate-500 flex items-center justify-between">
                      <span>Saved:</span>
                      <span className="font-mono text-slate-700">
                        {new Date(activeConflict.localModifiedAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className={`w-full py-1.5 rounded-xl font-bold text-xs transition-colors ${
                      resolutions[activeConflict.id] === 'local'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Keep Local Device Value
                  </button>
                </div>

                {/* Option 2: Cloud Server Record */}
                <div
                  onClick={() => handleSelectResolution(activeConflict.id, 'server')}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between space-y-3 ${
                    resolutions[activeConflict.id] === 'server'
                      ? 'border-purple-600 bg-purple-50/50 shadow-md ring-2 ring-purple-200'
                      : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-900">
                        <Server className="w-4 h-4 text-purple-600" />
                        <span>Cloud Server Record</span>
                      </span>
                      <input
                        type="radio"
                        name={`choice-${activeConflict.id}`}
                        checked={resolutions[activeConflict.id] === 'server'}
                        onChange={() => handleSelectResolution(activeConflict.id, 'server')}
                        className="text-purple-600 focus:ring-purple-500 w-4 h-4"
                      />
                    </div>

                    <div className="p-3 bg-white rounded-xl border border-purple-100 shadow-2xs">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Server Value</span>
                      <strong className="text-sm font-extrabold text-slate-900 block mt-0.5">
                        {activeConflict.serverValue}
                      </strong>
                    </div>

                    <div className="text-[11px] text-slate-500 flex items-center justify-between">
                      <span>Server Timestamp:</span>
                      <span className="font-mono text-slate-700">
                        {new Date(activeConflict.serverModifiedAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className={`w-full py-1.5 rounded-xl font-bold text-xs transition-colors ${
                      resolutions[activeConflict.id] === 'server'
                        ? 'bg-purple-600 text-white'
                        : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Keep Cloud Server Value
                  </button>
                </div>
              </div>

              {/* REQUIREMENT: "Resolve All Similar" Checkbox */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300/80 shadow-xs">
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    id="resolve-all-similar-checkbox"
                    checked={resolveAllSimilar}
                    onChange={(e) => setResolveAllSimilar(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-amber-600 rounded border-amber-300 focus:ring-amber-500 cursor-pointer"
                  />
                  <div className="min-w-0">
                    <span className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>Resolve All Similar Conflicts in One Click</span>
                      <span className="px-1.5 py-0.2 rounded bg-amber-200 text-amber-900 font-mono text-[10px]">
                        {similarConflicts.length} Matches
                      </span>
                    </span>
                    <p className="text-[11px] text-amber-900 mt-0.5 leading-relaxed">
                      Automatically batch-resolve all {similarConflicts.length} identical {activeConflict.category} discrepancies for Class {activeConflict.classNumber}-{activeConflict.section} using the selected strategy (
                      <span className="font-bold underline">
                        {resolutions[activeConflict.id] === 'local' ? 'Keep Local Device' : 'Keep Cloud Server'}
                      </span>
                      ).
                    </p>
                  </div>
                </label>
              </div>
            </div>
          ) : (
            <div className="md:col-span-8 p-12 text-center text-slate-400 text-xs">
              All data conflicts resolved.
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-600 font-medium">
            <span>
              {Object.keys(resolutions).length} of {conflictItems.length} conflicts configured
            </span>
            {resolveAllSimilar && (
              <span className="ml-2 font-bold text-amber-700">
                • Resolve All Similar Active
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-200 text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApplyAll}
              className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold text-xs flex items-center gap-2 shadow-md transition-all"
            >
              <Check className="w-4 h-4" />
              <span>Apply Resolution & Update Data</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
