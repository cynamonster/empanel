import React, { useState, useRef, useEffect } from 'react';
import { useCase } from '../../context/CaseContext';
import {
  X,
  Gavel,
  ShieldAlert,
  RotateCcw,
  Plus,
  Minus,
  Trash2,
  HelpCircle,
  AlertTriangle,
  FileText,
  User,
  MapPin,
  Briefcase,
  GraduationCap,
  FileEdit
} from 'lucide-react';
import type { Juror } from '../../types';

function getOrderedJurors(jurors: Juror[], activeCase: any, currentJuror: Juror | null | undefined): Juror[] {
  if (!activeCase || jurors.length === 0) return jurors;

  // 1. Check if currentJuror is seated on panel or alternates
  const isCurrentlySeated = currentJuror?.seatNumber !== undefined;

  // Seated panel jurors (seats 1..boxSize)
  const panelJurors = jurors
    .filter(j => j.seatNumber !== undefined && !j.isAlternate && !j.status.startsWith('struck_') && j.status !== 'cause_granted')
    .sort((a, b) => (a.seatNumber || 0) - (b.seatNumber || 0));

  // Seated alternate jurors (seats 1..alternateCount)
  const altJurors = jurors
    .filter(j => j.seatNumber !== undefined && j.isAlternate && !j.status.startsWith('struck_') && j.status !== 'cause_granted')
    .sort((a, b) => (a.seatNumber || 0) - (b.seatNumber || 0));

  const allSeated = [...panelJurors, ...altJurors];

  // If currently seated and there are seated jurors, cycle through panel + alternates
  if (isCurrentlySeated && allSeated.length > 0) {
    return allSeated;
  }

  // Otherwise, sort all jurors by gallery order or jurorNumber
  return [...jurors].sort((a, b) => {
    if (activeCase.galleryOrder && activeCase.galleryOrder.length > 0) {
      const idxA = activeCase.galleryOrder.indexOf(a.id);
      const idxB = activeCase.galleryOrder.indexOf(b.id);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
    }
    const numA = parseInt(a.jurorNumber, 10);
    const numB = parseInt(b.jurorNumber, 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.jurorNumber.localeCompare(b.jurorNumber);
  });
}

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
    activeQuestionId,
    setActiveQuestionId,
  } = useCase();

  const [showCauseModal, setShowCauseModal] = useState(false);
  const [causeGrounds, setCauseGrounds] = useState('');
  const [causeRuling, setCauseRuling] = useState<'pending' | 'granted' | 'denied'>('granted');

  const notesRef = useRef<HTMLTextAreaElement>(null);
  const strikeNoteRef = useRef<HTMLTextAreaElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const pendingFocusFieldRef = useRef<'notes' | 'strikeIntentNote' | null>(null);

  const currentJuror = jurors.find(j => j.id === selectedJurorId);
  const lastJurorRef = useRef<Juror | null>(null);
  if (currentJuror) {
    lastJurorRef.current = currentJuror;
  }
  const juror = currentJuror || lastJurorRef.current;
  const isOpen = Boolean(selectedJurorId && juror);

  const [localNotes, setLocalNotes] = useState(juror?.notes || '');
  const [localStrikeNote, setLocalStrikeNote] = useState(juror?.strikeIntentNote || '');

  // Debounced auto-save for textareas to prevent cursor jump & rerender lag
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingUpdatesRef = useRef<Partial<Juror>>({});
  const activeJurorIdRef = useRef<string | undefined>(juror?.id);

  const flushUpdates = (targetId?: string) => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const idToUpdate = targetId || activeJurorIdRef.current;
    if (idToUpdate && Object.keys(pendingUpdatesRef.current).length > 0) {
      updateJuror(idToUpdate, pendingUpdatesRef.current);
      pendingUpdatesRef.current = {};
    }
  };

  const scheduleUpdate = (updates: Partial<Juror>) => {
    pendingUpdatesRef.current = { ...pendingUpdatesRef.current, ...updates };
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      flushUpdates();
    }, 250);
  };

  useEffect(() => {
    if (activeJurorIdRef.current && activeJurorIdRef.current !== juror?.id) {
      flushUpdates(activeJurorIdRef.current);
    }
    activeJurorIdRef.current = juror?.id;
    if (juror) {
      setLocalNotes(juror.notes || '');
      setLocalStrikeNote(juror.strikeIntentNote || '');
    }

    // Auto-fit height when switching juror & retain focus if navigated via backtick
    requestAnimationFrame(() => {
      if (notesRef.current) {
        notesRef.current.style.height = 'auto';
        notesRef.current.style.height = `${Math.max(72, notesRef.current.scrollHeight)}px`;
      }
      if (strikeNoteRef.current) {
        strikeNoteRef.current.style.height = 'auto';
        strikeNoteRef.current.style.height = `${Math.max(52, strikeNoteRef.current.scrollHeight)}px`;
      }

      if (pendingFocusFieldRef.current === 'notes' && notesRef.current) {
        notesRef.current.focus();
        const len = notesRef.current.value.length;
        notesRef.current.setSelectionRange(len, len);
      } else if (pendingFocusFieldRef.current === 'strikeIntentNote' && strikeNoteRef.current) {
        strikeNoteRef.current.focus();
        const len = strikeNoteRef.current.value.length;
        strikeNoteRef.current.setSelectionRange(len, len);
      }
    });
  }, [juror?.id]);

  useEffect(() => {
    return () => {
      flushUpdates();
    };
  }, []);

  // Keyboard Shortcuts: Sequential Juror Cycling (` / ~), Ratings (1-3, Shift+1-3, 0), and Question Logger (q)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null;
      const isInput = activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement || (activeEl as HTMLElement)?.isContentEditable;
      const isModalOpen = Boolean(document.querySelector('.fixed.inset-0.z-50'));

      // 1. ESCAPE KEY: Close drawer (if no modal is open)
      if (e.key === 'Escape') {
        if (!isModalOpen && selectedJurorId) {
          flushUpdates();
          setSelectedJurorId(null);
          pendingFocusFieldRef.current = null;
        }
        return;
      }

      // If a modal is open, do not execute global shortcuts
      if (isModalOpen) return;

      // 2. BACKTICK (`) / TILDE (~): Sequential Juror Cycling (NO INPUT ISOLATION)
      // Listened for even while inside text inputs / textareas to allow seamless rapid note-taking!
      if ((e.code === 'Backquote' || e.key === '`' || e.key === '~') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();

        // Remember which field had focus so we keep focus for the new juror
        if (activeEl?.getAttribute('data-field') === 'notes') {
          pendingFocusFieldRef.current = 'notes';
        } else if (activeEl?.getAttribute('data-field') === 'strikeIntentNote') {
          pendingFocusFieldRef.current = 'strikeIntentNote';
        } else {
          pendingFocusFieldRef.current = null;
        }

        // Flush any pending text changes for current juror before moving
        flushUpdates();

        const ordered = getOrderedJurors(jurors, activeCase, currentJuror);
        if (ordered.length === 0) return;

        let nextIdx = 0;
        if (selectedJurorId) {
          const currIdx = ordered.findIndex(j => j.id === selectedJurorId);
          if (currIdx !== -1) {
            nextIdx = e.shiftKey
              ? (currIdx - 1 + ordered.length) % ordered.length
              : (currIdx + 1) % ordered.length;
          }
        }

        const nextJuror = ordered[nextIdx];
        if (nextJuror) {
          setSelectedJurorId(nextJuror.id);
        }
        return;
      }

      // ALL SHORTCUTS BELOW REQUIRE INPUT ISOLATION (Do not fire if user is typing in a field)
      if (isInput) return;

      // 3. TACTILE RATINGS: 1, 2, 3 (Favorable) and Shift+1, 2, 3 (Negative), 0 (Neutral)
      if (selectedJurorId && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === '1' && !e.shiftKey) {
          e.preventDefault();
          updateJuror(selectedJurorId, { rating: 1 });
          return;
        }
        if (e.key === '2' && !e.shiftKey) {
          e.preventDefault();
          updateJuror(selectedJurorId, { rating: 2 });
          return;
        }
        if (e.key === '3' && !e.shiftKey) {
          e.preventDefault();
          updateJuror(selectedJurorId, { rating: 3 });
          return;
        }
        if (e.key === '!' || (e.key === '1' && e.shiftKey)) {
          e.preventDefault();
          updateJuror(selectedJurorId, { rating: -1 });
          return;
        }
        if (e.key === '@' || (e.key === '2' && e.shiftKey)) {
          e.preventDefault();
          updateJuror(selectedJurorId, { rating: -2 });
          return;
        }
        if (e.key === '#' || (e.key === '3' && e.shiftKey)) {
          e.preventDefault();
          updateJuror(selectedJurorId, { rating: -3 });
          return;
        }
        if (e.key === '0') {
          e.preventDefault();
          updateJuror(selectedJurorId, { rating: 0 });
          return;
        }
      }

      // 4. QUESTION LOGGER TOGGLE: 'q' / 'Q'
      if ((e.key === 'q' || e.key === 'Q') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        if (activeQuestionId) {
          setActiveQuestionId(null);
        } else if (questions.length > 0) {
          setActiveQuestionId(questions[0].id);
        } else {
          setActiveQuestionId('new');
        }
        return;
      }
    };

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (!selectedJurorId) return;
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        const target = e.target as HTMLElement;
        // Do not close if clicking a juror card, modal, dialog, navbar, or question logger toolbar
        if (
          target.closest('[data-panel-card-id]') ||
          target.closest('[data-juror-card]') ||
          target.closest('.modal-container') ||
          target.closest('[role="dialog"]') ||
          target.closest('.fixed.inset-0') ||
          target.closest('header') ||
          target.closest('nav') ||
          target.closest('[data-navbar]') ||
          target.closest('[data-question-logger]')
        ) {
          return;
        }
        flushUpdates();
        setSelectedJurorId(null);
        pendingFocusFieldRef.current = null;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [selectedJurorId, setSelectedJurorId, jurors, activeCase, currentJuror, updateJuror, activeQuestionId, setActiveQuestionId, questions]);

  if (!juror) {
    return (
      <aside
        ref={drawerRef}
        className="w-0 translate-x-full opacity-0 pointer-events-none border-l-0 overflow-hidden flex-shrink-0 h-full bg-slate-900 transition-all duration-200 ease-in-out"
      />
    );
  }

  const boxSize = activeCase?.boxSize || 6;
  const alternateCount = activeCase?.alternateCount || 1;

  // Calculate open seats in prospective panel and alternate bench
  const seatedNumbers = new Set(
    jurors
      .filter(j => j.seatNumber !== undefined && !j.isAlternate && !j.status.startsWith('struck_') && j.status !== 'cause_granted')
      .map(j => j.seatNumber!)
  );
  const alternateNumbers = new Set(
    jurors
      .filter(j => j.seatNumber !== undefined && j.isAlternate && !j.status.startsWith('struck_') && j.status !== 'cause_granted')
      .map(j => j.seatNumber!)
  );

  const openSeats: { seatNum: number; isAlt: boolean }[] = [];
  for (let s = 1; s <= boxSize; s++) {
    if (!seatedNumbers.has(s)) {
      openSeats.push({ seatNum: s, isAlt: false });
    }
  }
  for (let a = 1; a <= alternateCount; a++) {
    if (!alternateNumbers.has(a)) {
      openSeats.push({ seatNum: a, isAlt: true });
    }
  }

  const ratings = [-3, -2, -1, 0, 1, 2, 3];

  const isStruck = juror.status.startsWith('struck_') || juror.status === 'cause_granted';

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const start = e.target.selectionStart;
    const end = e.target.selectionEnd;
    setLocalNotes(val);
    scheduleUpdate({ notes: val });

    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.max(72, el.scrollHeight)}px`;
    if (start !== null && end !== null) {
      requestAnimationFrame(() => {
        if (document.activeElement === el) {
          el.setSelectionRange(start, end);
        }
      });
    }
  };

  const handleStrikeNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const start = e.target.selectionStart;
    const end = e.target.selectionEnd;
    setLocalStrikeNote(val);
    scheduleUpdate({ strikeIntentNote: val });

    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.max(52, el.scrollHeight)}px`;
    if (start !== null && end !== null) {
      requestAnimationFrame(() => {
        if (document.activeElement === el) {
          el.setSelectionRange(start, end);
        }
      });
    }
  };

  return (
    <aside
      ref={drawerRef}
      className={`transition-all duration-200 ease-in-out flex-shrink-0 h-full bg-slate-900 border-l border-slate-800 flex flex-col shadow-2xl z-20 overflow-hidden ${
        isOpen
          ? 'w-80 md:w-96 translate-x-0 opacity-100'
          : 'w-0 translate-x-full opacity-0 pointer-events-none border-l-0'
      }`}
    >
      <div className="w-80 md:w-96 h-full flex flex-col flex-shrink-0">
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
        <div className="flex items-center space-x-2">
          {/* <div className="hidden sm:flex items-center space-x-1 font-mono text-[10px] text-slate-400 bg-slate-950/80 px-1.5 py-0.5 rounded border border-slate-800" title="Cycle Jurors: ` next, ~ prev">
            <span>` next</span>
            <span>•</span>
            <span>~ prev</span>
          </div> */}
          <button
            onClick={() => {
              flushUpdates();
              setSelectedJurorId(null);
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="Close Drawer (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Drawer Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs text-slate-300">

        {/* SECTION: SEATING POSITION */}
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <div className="font-semibold text-slate-200">
              {juror.seatNumber !== undefined
                ? juror.isAlternate
                  ? `Alternate #${juror.seatNumber}`
                  : `Prospective Juror #${juror.seatNumber}`
                : 'Not in Jury Panel'}
            </div>
          </div>

          {!isStruck && (
            <div>
              {juror.seatNumber === undefined ? (
                openSeats.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => assignSeat(juror.id, openSeats[0].seatNum, openSeats[0].isAlt)}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow transition-colors flex items-center space-x-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add to Panel</span>
                  </button>
                ) : (
                  <span className="text-[11px] text-slate-500 italic">Panel Full</span>
                )
              ) : (
                <button
                  type="button"
                  onClick={() => unseatJuror(juror.id)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-rose-300 border border-slate-700 hover:border-rose-800/80 rounded-lg text-xs font-medium transition-colors flex items-center space-x-1.5"
                >
                  <Minus className="w-3.5 h-3.5 text-rose-400" />
                  <span>Remove from Panel</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* SECTION: TACTICAL RATING */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Favorability Rating
            </label>
            <span className="text-[10px] text-slate-500 font-mono">
              Keyboard: 1–3, Shift 1–3, 0
            </span>
          </div>
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
                  title={val > 0 ? `+${val} Favors Us` : val < 0 ? `${val} Favors Them` : '0 Neutral'}
                >
                  {val > 0 ? `+${val}` : val}
                </button>
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 mt-1 px-1">
            <span>Favors Them</span>
            <span>Neutral</span>
            <span>Favors Us</span>
          </div>
        </div>

        {/* SECTION: STRIKE ASSESSMENT (NOTES TO SELF) */}
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
              <FileEdit className="w-3.5 h-3.5 text-indigo-400" />
              <span>Plan to Strike?</span>
            </label>
            {juror.strikeIntent && juror.strikeIntent !== 'none' && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                juror.strikeIntent === 'strike_peremptory'
                  ? 'bg-blue-950/70 border-blue-700/80 text-blue-300'
                  : 'bg-amber-950/70 border-amber-700/80 text-amber-300'
              }`}>
                {juror.strikeIntent === 'strike_peremptory' ? 'Peremptory' : 'For Cause'}
              </span>
            )}
          </div>

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
                  ? 'bg-blue-950 border-blue-500 text-blue-200 ring-2 ring-blue-500/30 shadow'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-blue-300 hover:bg-blue-950/30'
              }`}
            >
              <Gavel className="w-3 h-3 text-blue-400" />
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
              Reason / Bias:
            </span>
            <textarea
              ref={strikeNoteRef}
              data-field="strikeIntentNote"
              rows={2}
              value={localStrikeNote}
              onChange={handleStrikeNoteChange}
              onBlur={() => flushUpdates()}
              placeholder="e.g. Hostile demeanor, sister arrested in similar case, admitted hesitation on beyond reasonable doubt..."
              className="w-full bg-slate-900 border border-slate-700/80 focus:border-indigo-500 rounded-lg p-2 text-xs text-slate-200 placeholder-slate-600 outline-none resize-none leading-relaxed overflow-hidden"
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
          ) : null}
        </div>

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
                className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs focus:border-indigo-500 outline-none"
              />
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Gender</span>
              <input
                type="text"
                value={juror.gender || ''}
                onChange={e => updateJuror(juror.id, { gender: e.target.value })}
                placeholder="e.g. F / M"
                className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs focus:border-indigo-500 outline-none"
              />
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Race / Ethnicity</span>
              <input
                type="text"
                value={juror.raceEthnicity || ''}
                onChange={e => updateJuror(juror.id, { raceEthnicity: e.target.value })}
                placeholder="e.g. Caucasian / Hispanic"
                className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs focus:border-indigo-500 outline-none"
              />
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Area of County</span>
              <input
                type="text"
                value={juror.areaOfCounty || juror.cityState || juror.cityOrZip || ''}
                onChange={e => updateJuror(juror.id, { areaOfCounty: e.target.value, cityState: e.target.value })}
                placeholder="e.g. North County, East Austin"
                className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs focus:border-indigo-500 outline-none"
              />
            </div>
            <div className="col-span-2">
              <span className="text-slate-500 block text-[10px]">Occupation</span>
              <input
                type="text"
                value={juror.occupation || ''}
                onChange={e => updateJuror(juror.id, { occupation: e.target.value })}
                placeholder="e.g. Mechanical Engineer"
                className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs focus:border-indigo-500 outline-none"
              />
            </div>
            <div className="col-span-2">
              <span className="text-slate-500 block text-[10px]">Employer</span>
              <input
                type="text"
                value={juror.employer || ''}
                onChange={e => updateJuror(juror.id, { employer: e.target.value })}
                placeholder="e.g. Dell Technologies"
                className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs focus:border-indigo-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* SECTION: GROUP QUESTION RESPONSES */}
        {questions.length > 0 && (
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
              Group Question Hand-Raises
            </label>
            <div className="space-y-1.5">
              {questions.map(q => {
                const raised = juror.responses?.[q.id]?.answeredYes;
                return (
                  <div
                    key={q.id}
                    onClick={() => toggleJurorResponse(juror.id, q.id)}
                    className={`p-2.5 rounded-lg border text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                      raised
                        ? 'bg-amber-950/40 border-amber-500/50 text-amber-200'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <span className="leading-snug break-words flex-1">{q.text}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded flex-shrink-0 ${
                      raised ? 'bg-amber-500 text-slate-950 font-black shadow-sm' : 'bg-slate-800 text-slate-500'
                    }`}>
                      {raised ? 'YES' : 'NO'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SECTION: RAPID NOTES */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Notes
            </label>
          </div>
          <textarea
            ref={notesRef}
            data-field="notes"
            rows={3}
            placeholder="Type notes during questioning, demeanor observations, quotes..."
            value={localNotes}
            onChange={handleNotesChange}
            onBlur={() => flushUpdates()}
            className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl p-2.5 text-xs text-slate-200 placeholder-slate-600 outline-none resize-none leading-relaxed overflow-hidden"
          />
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
      </div>
    </aside>
  );
};
