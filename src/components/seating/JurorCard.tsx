import React from 'react';
import type { Juror } from '../../types';
import { useCase } from '../../context/CaseContext';
import { Hand, User, ShieldAlert, Award, AlertCircle } from 'lucide-react';

interface JurorCardProps {
  juror: Juror;
  compact?: boolean;
  isDraggable?: boolean;
  seatLabel?: string;
  isDimmed?: boolean;
  highlightEffect?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}

export const JurorCard: React.FC<JurorCardProps> = ({
  juror,
  compact = false,
  isDraggable = true,
  seatLabel,
  isDimmed = false,
  highlightEffect = false,
  onDragStart,
  onDragOver,
  onDrop,
}) => {
  const {
    selectedJurorId,
    setSelectedJurorId,
    activeQuestionId,
    toggleJurorResponse,
  } = useCase();

  const isSelected = selectedJurorId === juror.id;
  const isHandRaised = activeQuestionId && juror.responses?.[activeQuestionId]?.answeredYes;

  const getRatingBadge = (rating: number) => {
    if (rating > 0) {
      return (
        <span className="px-1.5 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
          +{rating}
        </span>
      );
    }
    if (rating < 0) {
      return (
        <span className="px-1.5 py-0.5 rounded text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
          {rating}
        </span>
      );
    }
    return (
      <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
        0
      </span>
    );
  };

  const getStatusBadge = () => {
    switch (juror.status) {
      case 'struck_plaintiff':
        return (
          <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-rose-900/60 text-rose-300 border border-rose-700">
            STRUCK (Pros)
          </span>
        );
      case 'struck_defense':
        return (
          <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-blue-900/60 text-blue-300 border border-blue-700">
            STRUCK (Def)
          </span>
        );
      case 'cause_granted':
        return (
          <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-red-900/80 text-red-200 border border-red-700 flex items-center space-x-1">
            <ShieldAlert className="w-2.5 h-2.5" />
            <span>CAUSE</span>
          </span>
        );
      case 'cause_denied':
        return (
          <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-900/60 text-amber-300 border border-amber-700">
            CAUSE DENIED
          </span>
        );
      case 'alternate':
        return (
          <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-purple-900/60 text-purple-300 border border-purple-700">
            ALT
          </span>
        );
      default:
        if (juror.strikeIntent === 'strike_peremptory') {
          return (
            <span
              className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-blue-950/80 text-blue-300 border border-blue-700/80"
              title={juror.strikeIntentNote ? `Note: ${juror.strikeIntentNote}` : 'Strike Plan: Peremptory'}
            >
              PLAN: (D)
            </span>
          );
        }
        if (juror.strikeIntent === 'strike_cause') {
          return (
            <span
              className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-950/80 text-amber-300 border border-amber-700/80"
              title={juror.strikeIntentNote ? `Note: ${juror.strikeIntentNote}` : 'Strike Plan: For Cause'}
            >
              PLAN: CAUSE
            </span>
          );
        }
        return null;
    }
  };

  const isStruck = juror.status.startsWith('struck_') || juror.status === 'cause_granted';

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeQuestionId) {
      toggleJurorResponse(juror.id, activeQuestionId);
    } else {
      setSelectedJurorId(juror.id);
    }
  };

  return (
    <div
      draggable={isDraggable && !activeQuestionId}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={handleClick}
      className={`relative group rounded-xl p-2.5 select-none transition-all duration-300 ease-out transform ${
        isDraggable ? 'cursor-grab active:cursor-grabbing hover:scale-[1.01]' : 'cursor-pointer'
      } ${
        highlightEffect
          ? 'ring-2 ring-emerald-400 bg-emerald-950/40 shadow-lg shadow-emerald-500/30 scale-[1.03] animate-pulse'
          : isDimmed
          ? 'opacity-20 grayscale brightness-50 hover:opacity-85 hover:grayscale-0 hover:brightness-100 bg-slate-950/60 border-slate-850'
          : activeQuestionId
          ? isHandRaised
            ? 'bg-amber-950/40 border-amber-400 ring-2 ring-amber-400/50 shadow-lg shadow-amber-900/30'
            : 'bg-slate-900/90 border-slate-700/80 hover:border-amber-500/50 hover:bg-slate-850'
          : isSelected
          ? 'bg-indigo-950/80 border-indigo-400 ring-2 ring-indigo-400/50 shadow-lg shadow-indigo-950/50'
          : isStruck
          ? 'bg-slate-900/40 border-slate-800/80 opacity-60 hover:opacity-100 hover:bg-slate-900/70'
          : 'bg-slate-900 border-slate-800 hover:border-slate-650 hover:bg-slate-850 shadow-sm'
      }`}
    >
      {/* Header: Seat / Juror # + Status / Rating */}
      <div className="flex items-center justify-between gap-1 mb-1.5">
        <div className="flex items-center space-x-1.5">
          <span className="text-sm font-extrabold text-slate-100 font-mono tracking-tight">
            #{juror.jurorNumber}
          </span>
          {seatLabel && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 bg-indigo-950/80 px-1 rounded border border-indigo-800/50">
              {seatLabel}
            </span>
          )}
        </div>

        <div className="flex items-center space-x-1.5">
          {getStatusBadge()}
          {getRatingBadge(juror.rating)}
        </div>
      </div>

      {/* Full Name */}
      <div className="text-sm font-semibold text-slate-200 truncate group-hover:text-white">
        {juror.fullName || `Juror #${juror.jurorNumber}`}
      </div>

      {/* Demographics / Details */}
      {!compact && (
        <div className="mt-1 space-y-0.5 text-xs text-slate-400">
          <div className="truncate flex items-center space-x-1">
            <span className="text-slate-500">Occ:</span>
            <span className="text-slate-300 truncate">{juror.occupation || '—'}</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
            <span>
              {juror.age ? `${juror.age}y` : ''}{juror.age && juror.gender ? ' • ' : ''}{juror.gender || ''}
            </span>
            <span className="truncate max-w-[120px] text-slate-500 text-right">
              {juror.cityState || juror.cityOrZip || ''}
            </span>
          </div>
        </div>
      )}

      {/* Strike Intent Note to self preview */}
      {juror.strikeIntentNote && !compact && (
        <div
          className="mt-1 text-[10px] text-amber-300/90 italic truncate bg-amber-950/30 px-1.5 py-0.5 rounded border border-amber-900/40"
          title={`Note to self: ${juror.strikeIntentNote}`}
        >
          📝 {juror.strikeIntentNote}
        </div>
      )}

      {/* Active Question Logger Indicator (Floating Hand) */}
      {activeQuestionId && (
        <div
          className={`absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center border shadow transition-all ${
            isHandRaised
              ? 'bg-amber-500 border-amber-300 text-slate-950 scale-110 shadow-amber-500/50'
              : 'bg-slate-800 border-slate-600 text-slate-500 hover:text-amber-300 hover:border-amber-500'
          }`}
          title={isHandRaised ? 'Hand Raised (Tap to toggle)' : 'Tap to mark Hand Raised'}
        >
          <Hand className="w-3.5 h-3.5" />
        </div>
      )}
    </div>
  );
};
