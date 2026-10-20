import React, { useState } from 'react';
import { useCase } from '../../context/CaseContext';
import {
  Gavel,
  ShieldAlert,
  TrendingDown,
  Users,
  RotateCcw,
  AlertTriangle,
  Award,
  Sparkles,
  BarChart3
} from 'lucide-react';

interface StrikeConsoleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StrikeConsoleModal: React.FC<StrikeConsoleModalProps> = ({ isOpen, onClose }) => {
  const {
    activeCase,
    jurors,
    peremptoryStrikes,
    causeChallenges,
    revertStrike,
    recordPeremptoryStrike,
  } = useCase();

  const [activeTab, setActiveTab] = useState<'strikes' | 'recommendations' | 'causes' | 'batson'>('recommendations');

  if (!isOpen || !activeCase) return null;

  const plaintiffAllowed = activeCase.plaintiffStrikesAllowed || 3;
  const defenseAllowed = activeCase.defenseStrikesAllowed || 3;

  const plaintiffStrikes = peremptoryStrikes.filter(s => s.side === 'plaintiff_prosecution');
  const defenseStrikes = peremptoryStrikes.filter(s => s.side === 'defense');

  const pRemaining = Math.max(0, plaintiffAllowed - plaintiffStrikes.length);
  const dRemaining = Math.max(0, defenseAllowed - defenseStrikes.length);

  // Recommendation engine: Find active/seated jurors with negative ratings
  // Priority: Seated jurors with rating < 0, then unseated with rating < 0
  const strikeCandidates = jurors
    .filter(j => !j.status.startsWith('struck_') && j.status !== 'cause_granted')
    .sort((a, b) => {
      // Prioritize seated over unseated
      const aSeated = a.seatNumber !== undefined ? 1 : 0;
      const bSeated = b.seatNumber !== undefined ? 1 : 0;
      if (aSeated !== bSeated) return bSeated - aSeated;
      // Lower rating first (e.g. -3 before -1)
      return a.rating - b.rating;
    });

  // Batson tracking demographics calculation
  const calculateDemographics = (list: typeof jurors) => {
    const genders: Record<string, number> = {};
    const races: Record<string, number> = {};

    list.forEach(j => {
      const g = (j.gender || 'Unknown').trim();
      genders[g] = (genders[g] || 0) + 1;

      const r = (j.raceEthnicity || 'Unknown').trim();
      races[r] = (races[r] || 0) + 1;
    });

    return { genders, races };
  };

  const seatedJurors = jurors.filter(j => j.seatNumber !== undefined && !j.isAlternate);
  const struckByPlaintiff = jurors.filter(j => j.status === 'struck_plaintiff');
  const struckByDefense = jurors.filter(j => j.status === 'struck_defense');

  const seatedDemo = calculateDemographics(seatedJurors);
  const plfDemo = calculateDemographics(struckByPlaintiff);
  const defDemo = calculateDemographics(struckByDefense);

  return (
    <div
      className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 text-slate-100"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl p-6 shadow-2xl flex flex-col max-h-[88vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-amber-500/20 border border-amber-500/30 rounded-xl text-amber-400">
              <Gavel className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Strategic Strike Console</h3>
              <p className="text-xs text-slate-400">
                Turn-based peremptory tracking, cause rulings, strike recommendations & Batson log
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 p-1">
            ✕
          </button>
        </div>

        {/* Big Scoreboard Bar */}
        <div className="grid grid-cols-2 gap-4 py-3">
          {/* Plaintiff / Prosecution */}
          <div className="bg-slate-950/80 border border-rose-900/60 rounded-xl p-3 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-rose-400">
                {activeCase.caseType === 'criminal' ? 'Prosecution' : 'Plaintiff'} Strikes
              </div>
              <div className="text-xl font-mono font-extrabold text-rose-200 mt-0.5">
                {pRemaining} Remaining{' '}
                <span className="text-xs text-slate-500 font-normal">
                  ({plaintiffStrikes.length} of {plaintiffAllowed} used)
                </span>
              </div>
            </div>
            <div className="flex space-x-1">
              {Array.from({ length: plaintiffAllowed }).map((_, idx) => (
                <div
                  key={idx}
                  className={`w-4 h-4 rounded-full border ${
                    idx < plaintiffStrikes.length
                      ? 'bg-rose-600 border-rose-400 shadow-sm'
                      : 'border-slate-700 bg-slate-900'
                  }`}
                  title={idx < plaintiffStrikes.length ? 'Strike Used' : 'Strike Available'}
                />
              ))}
            </div>
          </div>

          {/* Defense */}
          <div className="bg-slate-950/80 border border-blue-900/60 rounded-xl p-3 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-blue-400">
                Defense Strikes
              </div>
              <div className="text-xl font-mono font-extrabold text-blue-200 mt-0.5">
                {dRemaining} Remaining{' '}
                <span className="text-xs text-slate-500 font-normal">
                  ({defenseStrikes.length} of {defenseAllowed} used)
                </span>
              </div>
            </div>
            <div className="flex space-x-1">
              {Array.from({ length: defenseAllowed }).map((_, idx) => (
                <div
                  key={idx}
                  className={`w-4 h-4 rounded-full border ${
                    idx < defenseStrikes.length
                      ? 'bg-blue-600 border-blue-400 shadow-sm'
                      : 'border-slate-700 bg-slate-900'
                  }`}
                  title={idx < defenseStrikes.length ? 'Strike Used' : 'Strike Available'}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex space-x-2 border-b border-slate-800 pb-2 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('recommendations')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-colors ${
              activeTab === 'recommendations' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Strike Recommendations</span>
          </button>
          <button
            onClick={() => setActiveTab('strikes')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-colors ${
              activeTab === 'strikes' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Gavel className="w-3.5 h-3.5" />
            <span>Peremptory Log ({peremptoryStrikes.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('causes')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-colors ${
              activeTab === 'causes' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Cause Challenges ({causeChallenges.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('batson')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-colors ${
              activeTab === 'batson' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Batson & Demographics Record</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="py-4 flex-1 overflow-y-auto space-y-4">
          {/* TAB 1: RECOMMENDATIONS */}
          {activeTab === 'recommendations' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>
                  Prioritizing jurors with negative favorability ratings, especially currently seated in the box:
                </span>
                <span className="font-mono text-slate-500">
                  {strikeCandidates.filter(c => c.rating < 0).length} Unfavorable Jurors Identified
                </span>
              </div>

              <div className="space-y-2">
                {strikeCandidates.slice(0, 10).map((cand, idx) => {
                  const isSeated = cand.seatNumber !== undefined;
                  return (
                    <div
                      key={cand.id}
                      className={`p-3 rounded-xl border flex items-center justify-between transition-colors ${
                        cand.rating < 0
                          ? isSeated
                            ? 'bg-rose-950/40 border-rose-700/80 shadow-md'
                            : 'bg-slate-950 border-rose-900/40'
                          : 'bg-slate-950 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <span className="font-mono font-bold text-xs text-slate-400">
                          #{idx + 1}
                        </span>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-sm text-slate-100 font-mono">
                              Juror #{cand.jurorNumber}
                            </span>
                            <span className="text-slate-200 text-xs font-semibold">
                              {cand.fullName}
                            </span>
                            {isSeated && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                SEAT {cand.seatNumber}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center space-x-2 mt-0.5">
                            <span>{cand.occupation || 'No occupation'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        <div className="text-right">
                          <span className={`text-xs font-extrabold font-mono px-2 py-0.5 rounded ${
                            cand.rating < 0 ? 'bg-rose-600 text-white' :
                            cand.rating > 0 ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
                          }`}>
                            Rating: {cand.rating > 0 ? `+${cand.rating}` : cand.rating}
                          </span>
                        </div>

                        {/* Direct Strike Buttons */}
                        <div className="flex space-x-1.5">
                          <button
                            onClick={() => recordPeremptoryStrike(cand.id, 'plaintiff_prosecution')}
                            className="px-2.5 py-1 bg-rose-900/80 hover:bg-rose-800 text-rose-200 rounded-lg text-xs font-semibold border border-rose-700"
                            title={`Strike using ${activeCase.caseType === 'criminal' ? 'Prosecution' : 'Plaintiff'} peremptory`}
                          >
                            Strike ({activeCase.caseType === 'criminal' ? 'Pros' : 'P'})
                          </button>
                          <button
                            onClick={() => recordPeremptoryStrike(cand.id, 'defense')}
                            className="px-2.5 py-1 bg-blue-900/80 hover:bg-blue-800 text-blue-200 rounded-lg text-xs font-semibold border border-blue-700"
                            title="Strike using Defense peremptory"
                          >
                            Strike (Def)
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: PEREMPTORY LOG */}
          {activeTab === 'strikes' && (
            <div className="space-y-2">
              {peremptoryStrikes.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-xs">
                  No peremptory strikes exercised yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
                  {peremptoryStrikes.map(s => (
                    <div key={s.id} className="p-3 flex items-center justify-between text-xs hover:bg-slate-900/50">
                      <div className="flex items-center space-x-3">
                        <span className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                          s.side === 'plaintiff_prosecution' ? 'bg-rose-900/70 text-rose-300' : 'bg-blue-900/70 text-blue-300'
                        }`}>
                          {s.side === 'plaintiff_prosecution' ? (activeCase.caseType === 'criminal' ? 'Prosecution' : 'Plaintiff') : 'Defense'} Round {s.round}
                        </span>
                        <div>
                          <span className="font-bold font-mono text-slate-100">
                            Juror #{s.jurorNumber}
                          </span>
                          <span className="text-slate-300 ml-2">{s.jurorName}</span>
                          {s.notes && <p className="text-[11px] text-slate-500 mt-0.5">{s.notes}</p>}
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        <span className="text-[10px] text-slate-500 font-mono">
                          {new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <button
                          onClick={() => revertStrike(s.jurorId)}
                          className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center space-x-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Undo Strike</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CAUSE CHALLENGES */}
          {activeTab === 'causes' && (
            <div className="space-y-2">
              {causeChallenges.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-xs">
                  No challenges for cause recorded yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {causeChallenges.map(c => (
                    <div key={c.id} className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold font-mono text-slate-100">
                            Juror #{c.jurorNumber}
                          </span>
                          <span className="text-slate-300 font-medium">{c.jurorName}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          c.ruling === 'granted' ? 'bg-red-900/70 text-red-200 border border-red-700' :
                          c.ruling === 'denied' ? 'bg-amber-900/70 text-amber-200 border border-amber-700' :
                          'bg-indigo-900/70 text-indigo-200'
                        }`}>
                          Ruling: {c.ruling}
                        </span>
                      </div>
                      <div className="text-slate-400 bg-slate-900 p-2 rounded-lg border border-slate-800/80">
                        <strong className="text-slate-300">Grounds:</strong> {c.grounds}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: BATSON / DEMOGRAPHICS */}
          {activeTab === 'batson' && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-400 leading-relaxed">
                <strong className="text-slate-200 block mb-1">Batson / J.E.B. Challenge Preservation</strong>
                Record of demographic strike distribution to ensure compliance with Batson v. Kentucky and preserve appellate records.
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                {/* Seated Jury */}
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <h4 className="font-bold text-slate-200 border-b border-slate-850 pb-1.5 mb-2">
                    Seated Jury ({seatedJurors.length})
                  </h4>
                  <div className="space-y-1 text-slate-400">
                    <strong className="text-slate-300 text-[10px] uppercase block">Gender:</strong>
                    {Object.entries(seatedDemo.genders).map(([g, count]) => (
                      <div key={g} className="flex justify-between">
                        <span>{g}</span>
                        <span className="font-mono text-slate-200">{count}</span>
                      </div>
                    ))}
                    <strong className="text-slate-300 text-[10px] uppercase block pt-2">Race / Ethnicity:</strong>
                    {Object.entries(seatedDemo.races).map(([r, count]) => (
                      <div key={r} className="flex justify-between">
                        <span>{r}</span>
                        <span className="font-mono text-slate-200">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Struck by Plaintiff / Prosecution */}
                <div className="bg-slate-950 p-3 rounded-xl border border-rose-900/40">
                  <h4 className="font-bold text-rose-300 border-b border-slate-850 pb-1.5 mb-2">
                    {activeCase.caseType === 'criminal' ? 'Struck by Prosecution' : 'Struck by Plaintiff'} ({struckByPlaintiff.length})
                  </h4>
                  <div className="space-y-1 text-slate-400">
                    <strong className="text-slate-300 text-[10px] uppercase block">Gender:</strong>
                    {Object.entries(plfDemo.genders).map(([g, count]) => (
                      <div key={g} className="flex justify-between">
                        <span>{g}</span>
                        <span className="font-mono text-slate-200">{count}</span>
                      </div>
                    ))}
                    <strong className="text-slate-300 text-[10px] uppercase block pt-2">Race / Ethnicity:</strong>
                    {Object.entries(plfDemo.races).map(([r, count]) => (
                      <div key={r} className="flex justify-between">
                        <span>{r}</span>
                        <span className="font-mono text-slate-200">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Struck by Defense */}
                <div className="bg-slate-950 p-3 rounded-xl border border-blue-900/40">
                  <h4 className="font-bold text-blue-300 border-b border-slate-850 pb-1.5 mb-2">
                    Struck by Defense ({struckByDefense.length})
                  </h4>
                  <div className="space-y-1 text-slate-400">
                    <strong className="text-slate-300 text-[10px] uppercase block">Gender:</strong>
                    {Object.entries(defDemo.genders).map(([g, count]) => (
                      <div key={g} className="flex justify-between">
                        <span>{g}</span>
                        <span className="font-mono text-slate-200">{count}</span>
                      </div>
                    ))}
                    <strong className="text-slate-300 text-[10px] uppercase block pt-2">Race / Ethnicity:</strong>
                    {Object.entries(defDemo.races).map(([r, count]) => (
                      <div key={r} className="flex justify-between">
                        <span>{r}</span>
                        <span className="font-mono text-slate-200">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 pt-3 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 font-semibold rounded-xl text-xs transition-colors"
          >
            Close Console
          </button>
        </div>
      </div>
    </div>
  );
};
