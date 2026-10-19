import React, { useState, useRef, useLayoutEffect, useEffect } from 'react';
import { useCase } from '../../context/CaseContext';
import { JurorCard } from './JurorCard';
import {
  Users,
  Search,
  PlusCircle,
  XCircle,
  UserCheck,
  ChevronRight,
  ShieldCheck,
  Zap,
  Sparkles,
  RotateCcw,
  Gavel
} from 'lucide-react';
import type { Juror } from '../../types';

export const SeatingBoxView: React.FC = () => {
  const {
    activeCase,
    jurors,
    assignSeat,
    unseatJuror,
    recordPeremptoryStrike,
    prefillSequentialPanel,
    toggleAutoFillPanel,
  } = useCase();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'unseated' | 'struck'>('all');
  const [sortBy, setSortBy] = useState<'number' | 'rating-desc' | 'rating-asc'>('number');
  const [targetSeatModal, setTargetSeatModal] = useState<{ seatNumber: number; isAlternate: boolean } | null>(null);
  const [draggedJurorId, setDraggedJurorId] = useState<string | null>(null);
  const [dragOverSeat, setDragOverSeat] = useState<string | null>(null);
  const [swappedJurorIds, setSwappedJurorIds] = useState<string[]>([]);
  const [slidingJurorIds, setSlidingJurorIds] = useState<string[]>([]);

  const panelRef = useRef<HTMLDivElement>(null);
  const prevRectsRef = useRef<Map<string, DOMRect>>(new Map());
  const caseIdRef = useRef<string | undefined>(activeCase?.id);

  // Clear rect measurements when switching cases
  useEffect(() => {
    if (caseIdRef.current !== activeCase?.id) {
      caseIdRef.current = activeCase?.id;
      prevRectsRef.current.clear();
      setSlidingJurorIds([]);
    }
  }, [activeCase?.id]);

  // FLIP animation: smoothly animate jurors sliding into their new spots
  useLayoutEffect(() => {
    if (!panelRef.current) return;

    const currentCards = panelRef.current.querySelectorAll<HTMLElement>('[data-panel-card-id]');
    const currentRects = new Map<string, DOMRect>();
    const movedElements: { el: HTMLElement; deltaX: number; deltaY: number; id: string }[] = [];
    const newElements: { el: HTMLElement; id: string }[] = [];

    currentCards.forEach(el => {
      const id = el.getAttribute('data-panel-card-id');
      if (!id) return;
      const rect = el.getBoundingClientRect();
      currentRects.set(id, rect);

      const prevRect = prevRectsRef.current.get(id);
      if (prevRect) {
        const deltaX = prevRect.left - rect.left;
        const deltaY = prevRect.top - rect.top;
        if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
          movedElements.push({ el, deltaX, deltaY, id });
        }
      } else if (prevRectsRef.current.size > 0) {
        // Juror newly appeared in the panel (e.g. pulled from pool or alternate)
        newElements.push({ el, id });
      }
    });

    prevRectsRef.current = currentRects;

    if (movedElements.length === 0 && newElements.length === 0) return;

    // 1. Invert phase: place elements back at their previous visual position instantly
    movedElements.forEach(({ el, deltaX, deltaY }) => {
      el.style.transform = `translate3d(${deltaX}px, ${deltaY}px, 0)`;
      el.style.transition = 'none';
      el.style.zIndex = '30';
    });

    newElements.forEach(({ el }) => {
      el.style.transform = 'translate3d(50px, 0, 0) scale(0.95)';
      el.style.opacity = '0';
      el.style.transition = 'none';
      el.style.zIndex = '25';
    });

    // Force reflow
    panelRef.current.getBoundingClientRect();

    // 2. Play phase: smoothly slide elements into their new positions
    requestAnimationFrame(() => {
      movedElements.forEach(({ el }) => {
        el.style.transition = 'transform 550ms cubic-bezier(0.16, 1, 0.3, 1)';
        el.style.transform = 'translate3d(0, 0, 0)';
      });

      newElements.forEach(({ el }) => {
        el.style.transition = 'transform 550ms cubic-bezier(0.16, 1, 0.3, 1), opacity 450ms ease-out';
        el.style.transform = 'translate3d(0, 0, 0) scale(1)';
        el.style.opacity = '1';
      });
    });

    const activeMovingIds = [...movedElements.map(m => m.id), ...newElements.map(n => n.id)];
    setSlidingJurorIds(activeMovingIds);

    const timer = setTimeout(() => {
      movedElements.forEach(({ el }) => {
        el.style.transform = '';
        el.style.transition = '';
        el.style.zIndex = '';
      });
      newElements.forEach(({ el }) => {
        el.style.transform = '';
        el.style.transition = '';
        el.style.opacity = '';
        el.style.zIndex = '';
      });
      setSlidingJurorIds([]);
    }, 600);

    return () => clearTimeout(timer);
  }, [jurors]);

  if (!activeCase) return null;

  const boxSize = activeCase.boxSize || 12;
  const alternateCount = activeCase.alternateCount || 2;
  const autoFillEnabled = !!activeCase.autoFillPanel;

  // Split box into 2 rows for realistic courtroom layout (e.g. 6 & 6)
  const halfBox = Math.ceil(boxSize / 2);
  const row1Seats = Array.from({ length: halfBox }, (_, i) => i + 1);
  const row2Seats = Array.from({ length: boxSize - halfBox }, (_, i) => halfBox + i + 1);
  const alternateSeats = Array.from({ length: alternateCount }, (_, i) => i + 1);

  // Map seated jurors
  const seatedMap = new Map<number, Juror>();
  const alternateMap = new Map<number, Juror>();
  
  jurors.forEach(j => {
    if (j.seatNumber !== undefined) {
      if (j.isAlternate) {
        alternateMap.set(j.seatNumber, j);
      } else {
        seatedMap.set(j.seatNumber, j);
      }
    }
  });

  // Filter matcher (determines if juror is highlighted or dimmed)
  const matchesFilter = (j: Juror): boolean => {
    const term = search.toLowerCase();
    const textMatches = !term ||
      j.jurorNumber.toLowerCase().includes(term) ||
      j.fullName.toLowerCase().includes(term) ||
      (j.occupation && j.occupation.toLowerCase().includes(term)) ||
      (j.tags && j.tags.some(t => t.toLowerCase().includes(term)));

    if (!textMatches) return false;

    if (filter === 'unseated') {
      return j.seatNumber === undefined && !j.status.startsWith('struck_') && j.status !== 'cause_granted';
    }
    if (filter === 'active') {
      return !j.status.startsWith('struck_') && j.status !== 'cause_granted';
    }
    if (filter === 'struck') {
      return j.status.startsWith('struck_') || j.status === 'cause_granted';
    }
    return true;
  };

  // Sort all jurors for the pool
  const poolJurors = [...jurors].sort((a, b) => {
    if (sortBy === 'rating-desc') return b.rating - a.rating;
    if (sortBy === 'rating-asc') return a.rating - b.rating;
    const numA = parseInt(a.jurorNumber, 10);
    const numB = parseInt(b.jurorNumber, 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.jurorNumber.localeCompare(b.jurorNumber);
  });

  // Drag and Drop helpers with apparent animation
  const handleDragStart = (e: React.DragEvent, jurorId: string) => {
    setDraggedJurorId(jurorId);
    e.dataTransfer.setData('text/plain', jurorId);
  };

  const handleSeatDrop = (seatNum: number, isAlt: boolean) => {
    if (draggedJurorId) {
      const existing = isAlt ? alternateMap.get(seatNum) : seatedMap.get(seatNum);
      assignSeat(draggedJurorId, seatNum, isAlt);
      const affected = [draggedJurorId];
      if (existing) affected.push(existing.id);
      setSwappedJurorIds(affected);
      setTimeout(() => setSwappedJurorIds([]), 800);
      setDraggedJurorId(null);
      setDragOverSeat(null);
    }
  };

  const handlePoolCardDrop = (e: React.DragEvent, targetJuror: Juror) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain') || draggedJurorId;
    if (sourceId && sourceId !== targetJuror.id) {
      const sourceJuror = jurors.find(j => j.id === sourceId);
      if (sourceJuror) {
        if (sourceJuror.seatNumber !== undefined || targetJuror.seatNumber !== undefined) {
          const sSeat = sourceJuror.seatNumber;
          const sAlt = sourceJuror.isAlternate;
          const tSeat = targetJuror.seatNumber;
          const tAlt = targetJuror.isAlternate;
          if (sSeat !== undefined && tSeat !== undefined) {
            assignSeat(sourceId, tSeat, tAlt);
            assignSeat(targetJuror.id, sSeat, sAlt);
          } else if (sSeat !== undefined) {
            unseatJuror(sourceId);
            assignSeat(targetJuror.id, sSeat, sAlt);
          } else if (tSeat !== undefined) {
            unseatJuror(targetJuror.id);
            assignSeat(sourceId, tSeat, tAlt);
          }
        }
        setSwappedJurorIds([sourceId, targetJuror.id]);
        setTimeout(() => setSwappedJurorIds([]), 800);
      }
    }
    setDraggedJurorId(null);
  };

  const renderSeatSlot = (seatNum: number, isAlt = false) => {
    const juror = isAlt ? alternateMap.get(seatNum) : seatedMap.get(seatNum);
    const label = isAlt ? `Alt ${seatNum}` : `Seat ${seatNum}`;
    const slotKey = `${isAlt ? 'alt' : 'seat'}-${seatNum}`;
    const isOver = dragOverSeat === slotKey;

    if (juror) {
      const isDimmed = !matchesFilter(juror);
      const isSlidingOrSwapped = slidingJurorIds.includes(juror.id) || swappedJurorIds.includes(juror.id);
      return (
        <div
          key={slotKey}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverSeat(slotKey);
          }}
          onDragLeave={() => setDragOverSeat(null)}
          onDrop={(e) => {
            e.preventDefault();
            handleSeatDrop(seatNum, isAlt);
          }}
          className={`relative group rounded-xl transition-all ${
            isOver ? 'ring-2 ring-indigo-400 scale-[1.02]' : ''
          }`}
        >
          {/* Card Wrapper with data-panel-card-id for FLIP sliding physics */}
          <div
            data-panel-card-id={juror.id}
            className="w-full h-full will-change-transform"
          >
            <JurorCard
              juror={juror}
              seatLabel={label}
              isDimmed={isDimmed}
              highlightEffect={isSlidingOrSwapped}
              isDraggable={true}
              onDragStart={(e) => handleDragStart(e, juror.id)}
            />
          </div>

          {/* Unseat button on top-left hover */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              unseatJuror(juror.id);
            }}
            className="absolute -top-2 -left-2 bg-slate-900 border border-slate-700 text-slate-400 hover:text-rose-400 hover:border-rose-600 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow z-20"
            title="Remove from seat (return to pool)"
          >
            <XCircle className="w-3.5 h-3.5" />
          </button>

          {/* Quick Strike Buttons on top-right hover */}
          <div className="absolute -top-2.5 right-1 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
            <button
              onClick={(e) => {
                e.stopPropagation();
                recordPeremptoryStrike(juror.id, 'plaintiff_prosecution');
              }}
              className="bg-blue-950 hover:bg-blue-800 border border-blue-600 text-blue-200 rounded-full p-1 shadow transition-colors"
              title="Quick Peremptory Strike (Plaintiff / Prosecution)"
            >
              <Gavel className="w-3 h-3 text-blue-300" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                recordPeremptoryStrike(juror.id, 'defense');
              }}
              className="bg-rose-950 hover:bg-rose-800 border border-rose-600 text-rose-200 rounded-full p-1 shadow transition-colors"
              title="Quick Peremptory Strike (Defense)"
            >
              <Gavel className="w-3 h-3 text-rose-300" />
            </button>
          </div>
        </div>
      );
    }

    return (
      <div
        key={slotKey}
        onClick={() => setTargetSeatModal({ seatNumber: seatNum, isAlternate: isAlt })}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOverSeat(slotKey);
        }}
        onDragLeave={() => setDragOverSeat(null)}
        onDrop={(e) => {
          e.preventDefault();
          handleSeatDrop(seatNum, isAlt);
        }}
        className={`h-[105px] border-2 border-dashed rounded-xl p-3 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
          isOver
            ? 'border-indigo-400 bg-indigo-950/40 ring-2 ring-indigo-400/50'
            : 'border-slate-800 hover:border-indigo-500/60 bg-slate-950/40 hover:bg-indigo-950/20'
        } group`}
      >
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 group-hover:text-indigo-400">
          {label}
        </span>
        <PlusCircle className="w-5 h-5 text-slate-600 group-hover:text-indigo-400 my-1 transition-colors" />
        <span className="text-[10px] text-slate-600 group-hover:text-slate-400">
          {isOver ? 'Drop to Seat' : 'Click to Seat'}
        </span>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-4 space-y-6">
      {/* SECTION 1: PROSPECTIVE PANEL */}
      <div ref={panelRef} className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 className="text-sm font-bold tracking-wide uppercase text-slate-200 flex items-center space-x-2">
                <span>Prospective Panel</span>
                <span className="text-xs px-2 py-0.2 rounded-full bg-slate-800 text-slate-300 font-mono">
                  {seatedMap.size} of {boxSize} Seated
                </span>
              </h2>
              <div className="text-[11px] text-slate-400 font-mono">
                Alternates: {alternateMap.size} / {alternateCount}
              </div>
            </div>
          </div>

          {/* Sequential Panel Prefill & Auto-refill Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Auto-fill Toggle */}
            <button
              onClick={toggleAutoFillPanel}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                autoFillEnabled
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 ring-2 ring-amber-500/30'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
              title="When enabled, if any seated panel juror is struck, the next sequential unstruck juror is automatically pulled in!"
            >
              <Zap className={`w-3.5 h-3.5 ${autoFillEnabled ? 'text-amber-400 fill-amber-400' : 'text-slate-500'}`} />
              <span>Auto-Pull Replacements: {autoFillEnabled ? 'ON' : 'OFF'}</span>
            </button>

            {/* Instant Prefill Sequential Button */}
            <button
              onClick={() => prefillSequentialPanel(autoFillEnabled)}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow transition-colors"
              title="Pre-fill Prospective Panel with sequential unstruck jurors (Jurors 1, 2, ...)"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
              <span>Prefill Sequential Panel</span>
            </button>
          </div>
        </div>

        {/* Back Row */}
        <div className="mb-2">
          <div className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider mb-1.5 px-1">
            Back Row
          </div>
          <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5`}>
            {row2Seats.map(num => renderSeatSlot(num, false))}
          </div>
        </div>

        {/* Front Row */}
        <div className="mb-4">
          <div className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider mb-1.5 px-1">
            Front Row
          </div>
          <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5`}>
            {row1Seats.map(num => renderSeatSlot(num, false))}
          </div>
        </div>

        {/* Alternates Bench */}
        {alternateCount > 0 && (
          <div className="pt-3 border-t border-slate-800/80">
            <div className="text-[11px] font-semibold uppercase text-purple-400 tracking-wider mb-1.5 px-1 flex items-center space-x-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Alternate Juror Bench</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-w-xl">
              {alternateSeats.map(num => renderSeatSlot(num, true))}
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: JURY POOL */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 shadow-xl flex-1 flex flex-col">
        {/* Pool Controls */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 mb-4">
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-bold tracking-wide uppercase text-slate-300 flex items-center space-x-2">
              <span>Jury Pool</span>
              <span className="text-xs px-2 py-0.2 rounded-full bg-slate-800 text-slate-400 font-mono">
                {poolJurors.length} Total
              </span>
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search (dims non-matches)..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 outline-none"
              />
            </div>

            {/* Filter */}
            <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs">
              <button
                onClick={() => setFilter('all')}
                className={`px-2 py-1 rounded transition-colors ${filter === 'all' ? 'bg-slate-800 text-slate-200 font-medium' : 'text-slate-400 hover:text-slate-300'}`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('unseated')}
                className={`px-2 py-1 rounded transition-colors ${filter === 'unseated' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-slate-300'}`}
              >
                Unseated
              </button>
              <button
                onClick={() => setFilter('active')}
                className={`px-2 py-1 rounded transition-colors ${filter === 'active' ? 'bg-slate-800 text-slate-200 font-medium' : 'text-slate-400 hover:text-slate-300'}`}
              >
                Active
              </button>
              <button
                onClick={() => setFilter('struck')}
                className={`px-2 py-1 rounded transition-colors ${filter === 'struck' ? 'bg-rose-950/60 text-rose-300 font-medium' : 'text-slate-400 hover:text-slate-300'}`}
              >
                Struck
              </button>
            </div>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-300 outline-none"
            >
              <option value="number">Sort: Juror #</option>
              <option value="rating-desc">Sort: Rating (High → Low)</option>
              <option value="rating-asc">Sort: Rating (Low → High)</option>
            </select>
          </div>
        </div>

        {/* Pool Grid: Seats stay fixed, filtered cards greyed out */}
        {poolJurors.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            No jurors found in jury pool.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 overflow-y-auto max-h-[600px] p-1">
            {poolJurors.map(juror => {
              const isDimmed = !matchesFilter(juror);
              const isUnseated = juror.seatNumber === undefined && !juror.status.startsWith('struck_') && juror.status !== 'cause_granted';

              return (
                <div
                  key={juror.id}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handlePoolCardDrop(e, juror)}
                  className="relative group transition-all duration-300"
                >
                  <JurorCard
                    juror={juror}
                    isDimmed={isDimmed}
                    highlightEffect={swappedJurorIds.includes(juror.id)}
                    isDraggable={true}
                    onDragStart={(e) => handleDragStart(e, juror.id)}
                  />
                  
                  {/* Quick Seat Button */}
                  {isUnseated && !isDimmed && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Find first open seat in Prospective Panel
                        for (let i = 1; i <= boxSize; i++) {
                          if (!seatedMap.has(i)) {
                            assignSeat(juror.id, i, false);
                            return;
                          }
                        }
                        // If box full, try alternate
                        for (let i = 1; i <= alternateCount; i++) {
                          if (!alternateMap.has(i)) {
                            assignSeat(juror.id, i, true);
                            return;
                          }
                        }
                      }}
                      className="absolute bottom-2 right-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md px-1.5 py-0.5 text-[10px] font-medium shadow opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1"
                      title="Seat in next available seat"
                    >
                      <UserCheck className="w-3 h-3" />
                      <span>Seat</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Target Seat Picker Modal */}
      {targetSeatModal && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setTargetSeatModal(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-5 shadow-2xl flex flex-col max-h-[80vh]"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-slate-100">
                Seat Juror in {targetSeatModal.isAlternate ? `Alternate ${targetSeatModal.seatNumber}` : `Seat ${targetSeatModal.seatNumber}`}
              </h3>
              <button
                onClick={() => setTargetSeatModal(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="py-3">
              <input
                type="text"
                placeholder="Filter prospective jurors..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 py-1">
              {poolJurors
                .filter(j => !j.status.startsWith('struck_') && j.status !== 'cause_granted')
                .map(j => (
                  <div
                    key={j.id}
                    onClick={() => {
                      assignSeat(j.id, targetSeatModal.seatNumber, targetSeatModal.isAlternate);
                      setTargetSeatModal(null);
                    }}
                    className="p-2.5 rounded-xl bg-slate-950 hover:bg-indigo-950/50 border border-slate-800 hover:border-indigo-500 cursor-pointer flex items-center justify-between transition-colors"
                  >
                    <div>
                      <div className="font-semibold text-slate-200 text-xs">
                        #{j.jurorNumber} — {j.fullName}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {j.occupation || 'No occupation'} {j.age ? `• ${j.age}y` : ''}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                        j.rating > 0 ? 'bg-emerald-500/20 text-emerald-300' :
                        j.rating < 0 ? 'bg-rose-500/20 text-rose-300' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {j.rating > 0 ? `+${j.rating}` : j.rating}
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
