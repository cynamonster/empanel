import React from 'react';
import type { Juror } from '../../types';
import { Hand, ShieldAlert, Gavel, Award, AlertCircle, FileText } from 'lucide-react';

interface PodiumJurorCardProps {
  juror: Juror;
  activeQuestionId: string | null;
  seatLabel: string;
  isAlternate?: boolean;
  onSelect: () => void;
  isSelected?: boolean;
}

export const PodiumJurorCard: React.FC<PodiumJurorCardProps> = ({
  juror,
  activeQuestionId,
  seatLabel,
  isAlternate = false,
  onSelect,
  isSelected = false,
}) => {
  const currentResponse = activeQuestionId ? juror.responses?.[activeQuestionId] : undefined;
  const isHandRaised = !!currentResponse?.answeredYes;

  // In podium mode, cause strikes have not occurred yet in the courtroom.
  // We rely on the Second Chair's "Plan to Strike" (strikeIntent).
  const isCausePlan = juror.strikeIntent === 'strike_cause';
  const isPeremptoryPlan = juror.strikeIntent === 'strike_peremptory';
  const isStruck = juror.status === 'struck_plaintiff' || juror.status === 'struck_defense';

  // Favorability & Strike Plan styling
  const rating = juror.rating || 0;
  let ratingBorder = 'border-slate-800';
  let ratingBg = 'bg-slate-900/90';

  if (isStruck) {
    // Actually exercised strike
    ratingBorder = 'border-slate-850 opacity-45';
    ratingBg = 'bg-slate-950/80';
  } else if (isCausePlan) {
    // Cause strike plan: Amber warning theme
    ratingBorder = 'border-amber-500/90 ring-2 ring-amber-500/30';
    ratingBg = 'bg-amber-950/25';
  } else if (isPeremptoryPlan) {
    // Peremptory strike plan: Blue/Indigo theme
    ratingBorder = 'border-blue-500/90 ring-2 ring-blue-500/30';
    ratingBg = 'bg-blue-950/25';
  } else if (rating > 0) {
    ratingBorder = rating >= 2 ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-emerald-500/60';
    ratingBg = 'bg-emerald-950/20';
  } else if (rating < 0) {
    ratingBorder = rating <= -2 ? 'border-rose-500 ring-2 ring-rose-500/20' : 'border-rose-500/60';
    ratingBg = 'bg-rose-950/20';
  }

  // Hand-raise highlight override
  if (isHandRaised) {
    ratingBorder = 'border-amber-400 ring-4 ring-amber-500/40 shadow-lg shadow-amber-500/20 animate-pulse';
    ratingBg = 'bg-amber-950/35';
  }

  return (
    <div
      onClick={onSelect}
      className={`relative cursor-pointer transition-all duration-150 rounded-xl md:rounded-2xl p-1.5 sm:p-2 md:p-3.5 flex flex-col justify-between border md:border-2 ${ratingBorder} ${ratingBg} ${
        isSelected ? 'scale-[1.02] ring-2 md:ring-4 ring-indigo-500' : 'hover:scale-[1.01]'
      } min-h-[46px] sm:min-h-[54px] md:min-h-[160px]`}
    >
      {/* Mobile Compact View: Juror #, Strike Plan, and Name */}
      <div className="md:hidden flex flex-col justify-center items-center text-center h-full w-full min-w-0 overflow-hidden leading-tight py-0.5">
        <div className="flex items-center justify-center gap-1 w-full min-w-0">
          <span className={`text-xs sm:text-sm font-mono font-black truncate ${isStruck ? 'line-through text-slate-500' : 'text-slate-100'}`}>
            #{juror.jurorNumber}
          </span>
          {isCausePlan && (
            <span className="text-[9px] font-black uppercase px-1 py-0.5 rounded bg-amber-500/25 text-amber-300 border border-amber-500/50 flex items-center gap-0.5 shrink-0" title="Plan: Cause Strike">
              <ShieldAlert className="w-2.5 h-2.5 text-amber-400" />
              <span>CAUSE</span>
            </span>
          )}
          {isPeremptoryPlan && (
            <span className="text-[9px] font-black uppercase px-1 py-0.5 rounded bg-blue-500/25 text-blue-300 border border-blue-500/50 flex items-center gap-0.5 shrink-0" title="Plan: Peremptory Strike">
              <Gavel className="w-2.5 h-2.5 text-blue-400" />
              <span>PERM</span>
            </span>
          )}
          {isHandRaised && (
            <Hand className="w-3 h-3 fill-amber-300 text-amber-950 animate-bounce shrink-0" />
          )}
        </div>
        <div className={`text-[10px] sm:text-xs font-semibold truncate w-full mt-0.5 ${
          isStruck ? 'line-through text-slate-500' : isCausePlan ? 'text-amber-200' : isPeremptoryPlan ? 'text-blue-200' : 'text-slate-200'
        }`}>
          {juror.fullName}
        </div>
      </div>

      {/* Desktop Detailed View */}
      <div className="hidden md:flex md:flex-col md:justify-between md:h-full">
        {/* Top Bar: Seat #, Juror #, Rating */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-lg sm:text-xl font-mono font-extrabold ${isStruck ? 'line-through text-slate-500' : 'text-slate-100'}`}>
              #{juror.jurorNumber}
            </span>
            {isStruck ? (
              <span className="text-[10px] uppercase font-mono font-bold px-1.5 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/40">
                {juror.status === 'struck_plaintiff' ? 'Struck (P)' : 'Struck (D)'}
              </span>
            ) : isCausePlan ? (
              <span className="text-[11px] uppercase font-mono font-black px-2 py-0.5 rounded-md bg-amber-500/25 text-amber-300 border border-amber-500/50 flex items-center gap-1 shadow-sm">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" /> Plan: Cause
              </span>
            ) : isPeremptoryPlan ? (
              <span className="text-[11px] uppercase font-mono font-black px-2 py-0.5 rounded-md bg-blue-500/25 text-blue-300 border border-blue-500/50 flex items-center gap-1 shadow-sm">
                <Gavel className="w-3.5 h-3.5 text-blue-400" /> Plan: Peremptory
              </span>
            ) : juror.seatNumber !== undefined ? (
              <span
                className={`text-[11px] uppercase font-mono font-black px-1.5 py-0.5 rounded-md ${
                  juror.isAlternate
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                    : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                }`}
              >
                {juror.isAlternate ? `Alt ${juror.seatNumber}` : `Seat ${juror.seatNumber}`}
              </span>
            ) : seatLabel !== 'Pool' ? (
              <span className="text-[10px] uppercase font-mono font-bold px-1.5 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700">
                {seatLabel}
              </span>
            ) : (
              <span></span> 
            )}
          </div>
        </div>

        {/* Center: Full Name & Primary Occupation */}
        <div className="py-2.5 space-y-1">
          <div className="text-lg font-bold text-slate-100 tracking-tight leading-tight line-clamp-1">
            {juror.fullName}
          </div>
          <div className="text-sm font-medium text-slate-300 line-clamp-1">
            {juror.occupation || 'Occupation Not Listed'}
          </div>
          {juror.employer && (
            <div className="text-xs text-slate-400 line-clamp-1">
              {juror.employer}
            </div>
          )}
        </div>

        {/* Bottom Tactical Tags & Alerts */}
        <div className="pt-2 border-slate-800/60 flex items-center justify-between gap-2">
          {isHandRaised ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/30 border border-amber-400 rounded-lg text-amber-200 text-xs font-bold">
              <Hand className="w-4 h-4 fill-amber-300 text-amber-950 animate-bounce" />
              <span>HAND RAISED</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 overflow-hidden">
              {juror.strikeIntentNote && (
                <span className="text-[11px] italic text-slate-300 truncate max-w-[220px]" title={juror.strikeIntentNote}>
                  "{juror.strikeIntentNote}"
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
