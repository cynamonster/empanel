import React, { useState } from 'react';
import { useCase } from '../../context/CaseContext';
import {
  X,
  Gavel,
  ShieldAlert,
  RotateCcw,
  Plus,
  Trash2,
  CheckCircle,
  HelpCircle,
  AlertTriangle,
  Tag,
  FileText,
  User,
  MapPin,
  Briefcase,
  GraduationCap,
  FileEdit
} from 'lucide-react';

export const JurorDetailDrawer: React.FC = () => {
  const {
    jurors,
    selectedJurorId,
    setSelectedJurorId,
    updateJuror,
    deleteJuror,
    recordPeremptoryStrike,
    recordCauseChallenge,
    revertStrike,
    questions,
    toggleJurorResponse,
    activeCase,
    assignSeat,
    unseatJuror,
  } = useCase();

  const [tagInput, setTagInput] = useState('');
  const [showCauseModal, setShowCauseModal] = useState(false);
  const [causeGrounds, setCauseGrounds] = useState('');
  const [causeRuling, setCauseRuling] = useState<'pending' | 'granted' | 'denied'>('granted');

  const juror = jurors.find(j => j.id === selectedJurorId);
  if (!juror) return null;

  const ratings = [-3, -2, -1, 0, 1, 2, 3];

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagInput.trim()) return;
    const current = juror.tags || [];
    if (!current.includes(tagInput.trim())) {
      updateJuror(juror.id, { tags: [...current, tagInput.trim()] });
    }
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const current = juror.tags || [];
    updateJuror(juror.id, { tags: current.filter(t => t !== tagToRemove) });
  };

  const isStruck = juror.status.startsWith('struck_') || juror.status === 'cause_granted';

  return (
    <aside className="w-80 md:w-96 bg-slate-900 border-l border-slate-800 flex flex-col h-full shadow-2xl z-20 flex-shrink-0 animate-in slide-in-from-right duration-200">
      {/* Drawer Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
        <div className="flex items-center space-x-2">
          <span className="font-mono text-xl font-black text-indigo-400 bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-800/50">
            #{juror.jurorNumber}
          </span>
          <div className="overflow-hidden">
            <h3 className="font-bold text-sm text-slate-100 truncate">
              {juror.fullName}
            </h3>
            <div className="text-[11px] text-slate-400 truncate">
              {juror.occupation || 'No occupation recorded'}
            </div>
          </div>
        </div>
        <button
          onClick={() => setSelectedJurorId(null)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Drawer Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs text-slate-300">
        {/* SECTION: TACTICAL RATING */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
            Favorability Rating (-3 to +3)
          </label>
          <div className="grid grid-cols-7 gap-1 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
            {ratings.map(val => {
              const isSelected = juror.rating === val;
              let bg = 'text-slate-400 hover:bg-slate-800';
              if (isSelected) {
                if (val > 0) bg = 'bg-emerald-600 text-white font-bold shadow-md';
                else if (val < 0) bg = 'bg-rose-600 text-white font-bold shadow-md';
                else bg = 'bg-slate-700 text-white font-bold shadow-md';
              }
              return (
                <button
                  key={val}
                  onClick={() => updateJuror(juror.id, { rating: val })}
                  className={`py-1.5 rounded-lg text-center font-mono text-xs transition-colors ${bg}`}
                  title={val > 0 ? `+${val} Favor Our Side` : val < 0 ? `${val} Favor Opponent` : '0 Neutral'}
                >
                  {val > 0 ? `+${val}` : val}
                </button>
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 mt-1 px-1">
            <span>Favor Opponent</span>
            <span>Neutral</span>
            <span>Favor Our Side</span>
          </div>
        </div>

        {/* SECTION: STRIKE ASSESSMENT (NOTES TO SELF) */}
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
              <FileEdit className="w-3.5 h-3.5 text-indigo-400" />
              <span>Strike Plan (Notes to Self)</span>
            </label>
            {juror.strikeIntent && juror.strikeIntent !== 'none' && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                juror.strikeIntent === 'strike_peremptory'
                  ? 'bg-rose-950/70 border-rose-700/80 text-rose-300'
                  : 'bg-amber-950/70 border-amber-700/80 text-amber-300'
              }`}>
                {juror.strikeIntent === 'strike_peremptory' ? 'Plan: Peremptory' : 'Plan: For Cause'}
              </span>
            )}
          </div>

          <p className="text-[11px] text-slate-400 leading-tight">
            Record your private tactical assessment of whether to strike this juror:
          </p>

          {/* 3 Intent Options */}
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => updateJuror(juror.id, { strikeIntent: 'none' })}
              className={`px-2 py-1.5 rounded-lg text-xs font-semibold border transition-all text-center ${
                !juror.strikeIntent || juror.strikeIntent === 'none'
                  ? 'bg-slate-800 border-slate-600 text-slate-200 shadow'
                  : 'bg-slate-900/60 border-slate-800 text-slate-500 hover:text-slate-300 hover:bg-slate-850'
              }`}
            >
              Undecided
            </button>
            <button
              type="button"
              onClick={() => updateJuror(juror.id, { strikeIntent: 'strike_peremptory' })}
              className={`px-2 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center justify-center space-x-1 ${
                juror.strikeIntent === 'strike_peremptory'
                  ? 'bg-rose-950 border-rose-500 text-rose-200 ring-2 ring-rose-500/30 shadow'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-rose-300 hover:bg-rose-950/30'
              }`}
            >
              <Gavel className="w-3 h-3 text-rose-400" />
              <span>Peremptory</span>
            </button>
            <button
              type="button"
              onClick={() => updateJuror(juror.id, { strikeIntent: 'strike_cause' })}
              className={`px-2 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center justify-center space-x-1 ${
                juror.strikeIntent === 'strike_cause'
                  ? 'bg-amber-950 border-amber-500 text-amber-200 ring-2 ring-amber-500/30 shadow'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-amber-300 hover:bg-amber-950/30'
              }`}
            >
              <ShieldAlert className="w-3 h-3 text-amber-400" />
              <span>For Cause</span>
            </button>
          </div>

          {/* Optional Note */}
          <div className="space-y-1 pt-1">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">
              Optional Note on Reason / Bias:
            </span>
            <textarea
              rows={2}
              value={juror.strikeIntentNote || ''}
              onChange={e => updateJuror(juror.id, { strikeIntentNote: e.target.value })}
              placeholder="e.g. Hostile demeanor, sister arrested in similar case, admitted hesitation on beyond reasonable doubt..."
              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg p-2 text-xs text-slate-200 placeholder-slate-600 outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          {/* If juror is struck in court or currently seated in panel, show courtroom status */}
          {isStruck ? (
            <div className="flex items-center justify-between bg-slate-900/90 p-2 rounded-lg border border-slate-700/70 mt-2">
              <span className="text-[11px] text-slate-300 font-medium">
                Official Status: <span className="text-amber-300 font-semibold">{juror.statusNotes || 'Struck'}</span>
              </span>
              <button
                onClick={() => revertStrike(juror.id)}
                className="flex items-center space-x-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded text-[11px] font-semibold transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Revert Strike</span>
              </button>
            </div>
          ) : juror.seatNumber !== undefined ? (
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-[10px] text-slate-400">Currently Seated in Panel:</span>
              <div className="flex items-center space-x-1.5">
                <button
                  onClick={() => recordPeremptoryStrike(juror.id, 'defense')}
                  className="px-2 py-1 bg-rose-950/70 hover:bg-rose-900 border border-rose-700 text-rose-300 rounded text-[10px] font-semibold"
                  title="Execute official defense peremptory strike in court"
                >
                  Strike (Defense)
                </button>
                <button
                  onClick={() => setShowCauseModal(true)}
                  className="px-2 py-1 bg-amber-950/70 hover:bg-amber-900 border border-amber-700 text-amber-300 rounded text-[10px] font-semibold"
                  title="Raise official cause challenge in court"
                >
                  Cause Challenge
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {/* SECTION: SEATING POSITION */}
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <div className="font-semibold text-slate-200">
              {juror.seatNumber !== undefined
                ? juror.isAlternate
                  ? `Alternate Seat #${juror.seatNumber}`
                  : `Prospective Panel Seat #${juror.seatNumber}`
                : 'Not Seated (Jury Pool)'}
            </div>
            <div className="text-[11px] text-slate-400">
              Status: <span className="font-mono capitalize">{juror.status.replace('_', ' ')}</span>
            </div>
          </div>
          {juror.seatNumber !== undefined && (
            <button
              onClick={() => unseatJuror(juror.id)}
              className="text-xs text-rose-400 hover:text-rose-300 underline"
            >
              Unseat
            </button>
          )}
        </div>

        {/* SECTION: TAGS & BIAS FLAGS */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
            Tags & Red Flags
          </label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {(juror.tags || []).map((tag, idx) => (
              <span
                key={idx}
                className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-200 text-xs"
              >
                <span>{tag}</span>
                <button
                  onClick={() => handleRemoveTag(tag)}
                  className="text-slate-400 hover:text-rose-400"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>

          <form onSubmit={handleAddTag} className="flex gap-1.5">
            <input
              type="text"
              placeholder="Add tag (e.g. Prior Lawsuit, Engineer, Tort Bias)..."
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none"
            />
            <button
              type="submit"
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>

        {/* SECTION: RAPID NOTES */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
            Live Courtroom Notes
          </label>
          <textarea
            rows={4}
            placeholder="Type notes during questioning, demeanor observations, quotes..."
            value={juror.notes || ''}
            onChange={e => updateJuror(juror.id, { notes: e.target.value })}
            className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl p-2.5 text-xs text-slate-200 placeholder-slate-600 outline-none resize-none leading-relaxed"
          />
        </div>

        {/* SECTION: GROUP QUESTION RESPONSES */}
        {questions.length > 0 && (
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
              Group Question Hand-Raises
            </label>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {questions.map(q => {
                const raised = juror.responses?.[q.id]?.answeredYes;
                return (
                  <div
                    key={q.id}
                    onClick={() => toggleJurorResponse(juror.id, q.id)}
                    className={`p-2 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition-colors ${
                      raised
                        ? 'bg-amber-950/40 border-amber-500/50 text-amber-200'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className="truncate pr-2">{q.text}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      raised ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-500'
                    }`}>
                      {raised ? 'YES' : 'NO'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SECTION: DEMOGRAPHICS & PROFILE */}
        <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800 space-y-2">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
            Juror Profile & Demographics
          </label>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-slate-500 block text-[10px]">Age</span>
              <input
                type="text"
                value={juror.age || ''}
                onChange={e => updateJuror(juror.id, { age: e.target.value })}
                placeholder="e.g. 42"
                className="w-full bg-slate-900 border border-slate-850 rounded px-2 py-1 text-slate-200 text-xs"
              />
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Gender</span>
              <input
                type="text"
                value={juror.gender || ''}
                onChange={e => updateJuror(juror.id, { gender: e.target.value })}
                placeholder="e.g. F / M"
                className="w-full bg-slate-900 border border-slate-850 rounded px-2 py-1 text-slate-200 text-xs"
              />
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Race / Ethnicity</span>
              <input
                type="text"
                value={juror.raceEthnicity || ''}
                onChange={e => updateJuror(juror.id, { raceEthnicity: e.target.value })}
                placeholder="e.g. Caucasian / Hispanic"
                className="w-full bg-slate-900 border border-slate-850 rounded px-2 py-1 text-slate-200 text-xs"
              />
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">City / Zip</span>
              <input
                type="text"
                value={juror.cityOrZip || ''}
                onChange={e => updateJuror(juror.id, { cityOrZip: e.target.value })}
                placeholder="e.g. Austin 78701"
                className="w-full bg-slate-900 border border-slate-850 rounded px-2 py-1 text-slate-200 text-xs"
              />
            </div>
            <div className="col-span-2">
              <span className="text-slate-500 block text-[10px]">Occupation</span>
              <input
                type="text"
                value={juror.occupation || ''}
                onChange={e => updateJuror(juror.id, { occupation: e.target.value })}
                placeholder="e.g. Mechanical Engineer"
                className="w-full bg-slate-900 border border-slate-850 rounded px-2 py-1 text-slate-200 text-xs"
              />
            </div>
            <div className="col-span-2">
              <span className="text-slate-500 block text-[10px]">Employer</span>
              <input
                type="text"
                value={juror.employer || ''}
                onChange={e => updateJuror(juror.id, { employer: e.target.value })}
                placeholder="e.g. Dell Technologies"
                className="w-full bg-slate-900 border border-slate-850 rounded px-2 py-1 text-slate-200 text-xs"
              />
            </div>
          </div>
        </div>

        {/* Delete Juror */}
        <div className="pt-2 border-t border-slate-800">
          <button
            onClick={() => {
              if (confirm(`Delete Juror #${juror.jurorNumber} (${juror.fullName})?`)) {
                deleteJuror(juror.id);
              }
            }}
            className="w-full py-2 bg-slate-950 hover:bg-rose-950/60 border border-slate-800 hover:border-rose-800 text-rose-400 rounded-lg text-xs font-medium flex items-center justify-center space-x-1.5 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Remove Juror from Case</span>
          </button>
        </div>
      </div>

      {/* Cause Challenge Modal */}
      {showCauseModal && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowCauseModal(false)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <h3 className="font-bold text-slate-100 flex items-center space-x-2 text-sm">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <span>Challenge Juror #{juror.jurorNumber} for Cause</span>
              </h3>
              <button onClick={() => setShowCauseModal(false)} className="text-slate-400 hover:text-slate-200">
                ✕
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Legal Grounds for Cause Challenge:
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Juror expressly stated that they could not award damages for emotional distress, demonstrating actual bias..."
                value={causeGrounds}
                onChange={e => setCauseGrounds(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-200 outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Judge's Ruling:
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setCauseRuling('granted')}
                  className={`py-1.5 rounded-lg text-xs font-semibold border ${
                    causeRuling === 'granted'
                      ? 'bg-red-600 border-red-500 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                >
                  Granted (Excused)
                </button>
                <button
                  type="button"
                  onClick={() => setCauseRuling('denied')}
                  className={`py-1.5 rounded-lg text-xs font-semibold border ${
                    causeRuling === 'denied'
                      ? 'bg-amber-600 border-amber-500 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                >
                  Denied
                </button>
                <button
                  type="button"
                  onClick={() => setCauseRuling('pending')}
                  className={`py-1.5 rounded-lg text-xs font-semibold border ${
                    causeRuling === 'pending'
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                >
                  Pending
                </button>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCauseModal(false)}
                className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!causeGrounds.trim()) {
                    alert('Please provide the grounds for the cause challenge.');
                    return;
                  }
                  recordCauseChallenge(juror.id, causeGrounds.trim(), causeRuling);
                  setShowCauseModal(false);
                  setCauseGrounds('');
                }}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded-lg text-xs"
              >
                Record Cause Ruling
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
