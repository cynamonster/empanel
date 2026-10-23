import React, { useState, useRef, useEffect } from 'react';
import type { Juror } from '../../types';
import { useCase } from '../../context/CaseContext';
import { Hand, User, ShieldAlert, Award, AlertCircle, MessageSquareText } from 'lucide-react';

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
    updateJuror,
  } = useCase();

  const [isHovered, setIsHovered] = useState(false);
  const [isBadgeHovered, setIsBadgeHovered] = useState(false);
  const [isInputOpen, setIsInputOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const inputContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentResponse = activeQuestionId ? juror.responses?.[activeQuestionId] : undefined;
  const isHandRaised = !!currentResponse?.answeredYes;
  const currentQuestionNote = currentResponse?.note || '';
  const [noteText, setNoteText] = useState(currentQuestionNote);

  // Sync noteText when activeQuestionId or response changes and not currently typing
  useEffect(() => {
    if (!isInputOpen) {
      setNoteText(currentQuestionNote);
    }
  }, [currentQuestionNote, isInputOpen, activeQuestionId]);

  // Focus input and move cursor to end when input is opened
  useEffect(() => {
    if (isInputOpen && inputRef.current) {
      inputRef.current.focus();
      const len = inputRef.current.value.length;
      inputRef.current.setSelectionRange(len, len);
    }
  }, [isInputOpen]);

  const saveNote = () => {
    if (!activeQuestionId) return;
    const trimmed = noteText.trim();
    if (trimmed === (currentResponse?.note || '')) return;

    const newResponses = {
      ...(juror.responses || {}),
      [activeQuestionId]: {
        answeredYes: currentResponse ? currentResponse.answeredYes : true,
        note: trimmed || undefined,
      },
    };
    updateJuror(juror.id, { responses: newResponses });
  };

  const handleCardMouseLeave = (e: React.MouseEvent) => {
    setIsHovered(false);
    setIsBadgeHovered(false);
    const related = e.relatedTarget as Node | null;
    if (inputContainerRef.current && related && inputContainerRef.current.contains(related)) {
      return;
    }
    if (isInputOpen) {
      saveNote();
      setIsInputOpen(false);
    }
  };

  const handleInputContainerMouseLeave = (e: React.MouseEvent) => {
    const related = e.relatedTarget as Node | null;
    if (cardRef.current && related && cardRef.current.contains(related)) {
      return;
    }
    if (isInputOpen) {
      saveNote();
      setIsInputOpen(false);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      saveNote();
      setIsInputOpen(false);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setIsInputOpen(false);
      setNoteText(currentQuestionNote);
    }
  };

  const handleIconClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeQuestionId) return;
    if (!isHandRaised) {
      toggleJurorResponse(juror.id, activeQuestionId);
    }
    if (selectedJurorId) {
      setSelectedJurorId(juror.id);
    }
    setIsInputOpen(true);
    setIsBadgeHovered(false);
  };

  const isSelected = selectedJurorId === juror.id;

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
    // return (
    //   <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
    //     0
    //   </span>
    // );
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
      // case 'alternate':
      //   return (
      //     <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-purple-900/60 text-purple-300 border border-purple-700">
      //       ALT
      //     </span>
      //   );
      default:
        if (juror.strikeIntent === 'strike_peremptory') {
          return (
            <span
              className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-blue-950/80 text-blue-300 border border-blue-700/80"
              title={juror.strikeIntentNote ? `Note: ${juror.strikeIntentNote}` : 'Strike Plan: Peremptory'}
            >
              Peremptory
            </span>
          );
        }
        if (juror.strikeIntent === 'strike_cause') {
          return (
            <span
              className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-950/80 text-amber-300 border border-amber-700/80"
              title={juror.strikeIntentNote ? `Note: ${juror.strikeIntentNote}` : 'Strike Plan: For Cause'}
            >
              Cause
            </span>
          );
        }
        return null;
    }
  };

  const isStruck = juror.status.startsWith('struck_') || juror.status === 'cause_granted';

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isInputOpen) {
      saveNote();
      setIsInputOpen(false);
      return;
    }
    if (activeQuestionId) {
      toggleJurorResponse(juror.id, activeQuestionId);
      if (selectedJurorId) {
        setSelectedJurorId(juror.id);
      }
    } else {
      setSelectedJurorId(juror.id);
    }
  };

  return (
    <div
      ref={cardRef}
      data-juror-card={juror.id}
      draggable={isDraggable && !activeQuestionId}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleCardMouseLeave}
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
            <span className="text-slate-300 truncate">{juror.occupation || ''}</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5 gap-1">
            <span className="truncate">
              {[juror.age ? `${juror.age}y` : null, juror.gender, juror.raceEthnicity]
                .filter(Boolean)
                .join(' • ')}
            </span>
            {(juror.areaOfCounty || juror.cityState || juror.cityOrZip) && (
              <span
                className="truncate max-w-[95px] text-[10px] text-slate-500 text-right shrink-0"
                title={juror.areaOfCounty || juror.cityState || juror.cityOrZip}
              >
                {juror.areaOfCounty || juror.cityState || juror.cityOrZip}
              </span>
            )}
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

      {/* Active Question Logger Indicator & Expanding Note Input */}
      {activeQuestionId && (
        <>
          {isInputOpen ? (
            <div
              ref={inputContainerRef}
              onClick={e => e.stopPropagation()}
              onMouseLeave={handleInputContainerMouseLeave}
              className="absolute inset-x-1 -top-3 z-40 bg-slate-900 border border-amber-400 rounded-xl p-1.5 shadow-2xl flex items-center space-x-1.5 ring-2 ring-amber-400/40"
            >
              <MessageSquareText className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 ml-1" />
              <input
                ref={inputRef}
                type="text"
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="Note on hand raise..."
                className="flex-1 min-w-0 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded px-2 py-0.5 text-xs text-slate-100 placeholder-slate-500 outline-none"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={handleIconClick}
              onMouseEnter={() => setIsBadgeHovered(true)}
              onMouseLeave={() => setIsBadgeHovered(false)}
              className={`absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center border transition-all duration-200 z-20 hover:bg-amber-800 hover:border-amber-700 hover:text-amber-100 hover:shadow-inner hover:ring-0 ${
                isBadgeHovered
                  ? 'bg-amber-800 border-amber-700 text-amber-100 scale-110 shadow-inner ring-0'
                  : isHovered
                  ? 'bg-amber-400 border-amber-200 text-slate-950 scale-110 shadow-[0_0_15px_rgba(251,191,36,0.95)] ring-2 ring-amber-300/80'
                  : isHandRaised
                  ? 'bg-amber-500 border-amber-300 text-slate-950 scale-110 shadow-md shadow-amber-500/40'
                  : 'bg-slate-800 border-slate-600 text-slate-500 shadow-none'
              }`}
              title={
                currentQuestionNote
                  ? `Note: "${currentQuestionNote}" (Click to edit)`
                  : isHovered
                  ? 'Click to add note to hand raise'
                  : isHandRaised
                  ? 'Hand Raised (Click to add note)'
                  : 'Tap to mark Hand Raised'
              }
            >
              {isHovered ? (
                <MessageSquareText className="w-3.5 h-3.5" />
              ) : (
                <Hand className="w-3.5 h-3.5" />
              )}
              {!isHovered && currentQuestionNote && (
                <span className="absolute -bottom-0.5 -left-0.5 w-2 h-2 rounded-full bg-blue-400 border border-slate-900 shadow-sm" />
              )}
            </button>
          )}
        </>
      )}
    </div>
  );
};
