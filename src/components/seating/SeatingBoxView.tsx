import React, { useState, useRef, useLayoutEffect, useEffect } from 'react';
import { useCase } from '../../context/CaseContext';
import { JurorCard } from './JurorCard';
import {
  Users,
  Search,
  PlusCircle,
  XCircle,
  ShieldCheck,
  Zap,
  Sparkles,
  Gavel,
  Compass,
  Grid,
  Trash2
} from 'lucide-react';
import type { Juror } from '../../types';

function getColumnSplits(totalCols: number, gutters: 'none' | '1'): number[] {
  if (gutters === 'none' || totalCols < 2) return [totalCols];
  const left = Math.ceil(totalCols / 2);
  const right = totalCols - left;
  return [left, right];
}

export const SeatingBoxView: React.FC = () => {
  const {
    activeCase,
    jurors,
    assignSeat,
    unseatJuror,
    recordPeremptoryStrike,
    prefillSequentialPanel,
    clearPanel,
    toggleAutoFillPanel,
    updateActiveCase,
    reorderGalleryJurors,
  } = useCase();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'positive' | 'negative' | 'struck'>('all');
  const [targetSeatModal, setTargetSeatModal] = useState<{ seatNumber: number; isAlternate: boolean } | null>(null);
  const [draggedJurorId, setDraggedJurorId] = useState<string | null>(null);
  const [dragOverSeat, setDragOverSeat] = useState<string | null>(null);
  const [dragOverGalleryId, setDragOverGalleryId] = useState<string | null>(null);
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

  const boxSize = activeCase.boxSize || 6;
  const alternateCount = activeCase.alternateCount || 1;
  const autoFillEnabled = !!activeCase.autoFillPanel;
  const gridCols = activeCase.gridCols || 8;
  const gutters = (activeCase.galleryGutters === 'none' ? 'none' : '1') as 'none' | '1';
  const origin = activeCase.galleryOrigin || 'bottom-left';

  // Section 1 Row Calculation:
  // Regardless of how many jurors a panel has, fill every slot in div.mb-2 (up to 6)
  // before moving onto div.mb-4 and so on!
  const MAX_PANEL_ROW_SEATS = 6;
  const row1Seats = Array.from(
    { length: Math.min(boxSize, MAX_PANEL_ROW_SEATS) },
    (_, i) => i + 1
  );
  const row2Seats = boxSize > MAX_PANEL_ROW_SEATS
    ? Array.from(
        { length: Math.min(boxSize - MAX_PANEL_ROW_SEATS, MAX_PANEL_ROW_SEATS) },
        (_, i) => MAX_PANEL_ROW_SEATS + i + 1
      )
    : [];
  const row3Seats = boxSize > MAX_PANEL_ROW_SEATS * 2
    ? Array.from(
        { length: boxSize - MAX_PANEL_ROW_SEATS * 2 },
        (_, i) => MAX_PANEL_ROW_SEATS * 2 + i + 1
      )
    : [];

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
      (j.strikeIntentNote && j.strikeIntentNote.toLowerCase().includes(term));

    if (!textMatches) return false;

    if (filter === 'active') return !j.status.startsWith('struck_') && j.status !== 'cause_granted';
    if (filter === 'positive') return j.rating > 0;
    if (filter === 'negative') return j.rating < 0;
    if (filter === 'struck') return j.status.startsWith('struck_') || j.status === 'cause_granted';

    return true;
  };

  // Drag and Drop handlers
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

  const handleGalleryDrop = (e: React.DragEvent, targetJuror: Juror) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain') || draggedJurorId;
    if (sourceId && sourceId !== targetJuror.id) {
      reorderGalleryJurors(sourceId, targetJuror.id);
      setSwappedJurorIds([sourceId, targetJuror.id]);
      setTimeout(() => setSwappedJurorIds([]), 800);
    }
    setDraggedJurorId(null);
    setDragOverGalleryId(null);
  };

  // Section 2 Gallery Calculations:
  const splits: number[] = getColumnSplits(gridCols, gutters);

  const sortedJurors = [...jurors].sort((a, b) => {
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

  const numRows = Math.max(1, Math.ceil(sortedJurors.length / gridCols));
  const rowsData: { rowNumber: number; jurors: (Juror | null)[] }[] = [];
  for (let r = 0; r < numRows; r++) {
    const startIdx = r * gridCols;
    const rowJurors: (Juror | null)[] = [];
    for (let c = 0; c < gridCols; c++) {
      const jIdx = startIdx + c;
      rowJurors.push(jIdx < sortedJurors.length ? sortedJurors[jIdx] : null);
    }
    rowsData.push({ rowNumber: r + 1, jurors: rowJurors });
  }

  const displayedRows = origin === 'bottom-left'
    ? [...rowsData].reverse()
    : rowsData;

  // Render a single seat slot in the Prospective Panel
  const renderSeatSlot = (seatNum: number, isAlt = false) => {
    const juror = isAlt ? alternateMap.get(seatNum) : seatedMap.get(seatNum);
    const label = isAlt ? `Alt ${seatNum}` : `Juror ${seatNum}`;
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
              className="bg-rose-950 hover:bg-rose-800 border border-rose-600 text-rose-200 rounded-full p-1 shadow transition-colors"
              title={`Quick Peremptory Strike (${activeCase.caseType === 'criminal' ? 'Prosecution' : 'Plaintiff'})`}
            >
              <Gavel className="w-3 h-3 text-rose-300" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                recordPeremptoryStrike(juror.id, 'defense');
              }}
              className="bg-blue-950 hover:bg-blue-800 border border-blue-600 text-blue-200 rounded-full p-1 shadow transition-colors"
              title="Quick Peremptory Strike (Defense)"
            >
              <Gavel className="w-3 h-3 text-blue-300" />
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
              title="When enabled, if any seated panel juror is struck, remaining jurors slide and replacements are automatically pulled in!"
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

            {/* Clear Prospective Jury Panel Button */}
            <button
              onClick={() => clearPanel()}
              disabled={seatedMap.size === 0 && alternateMap.size === 0}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-rose-950/60 hover:border-rose-700/80 hover:text-rose-300 text-slate-300 border border-slate-700 rounded-lg text-xs font-semibold shadow-sm transition-all disabled:opacity-40 disabled:hover:bg-slate-800 disabled:hover:border-slate-700 disabled:hover:text-slate-300 disabled:cursor-not-allowed"
              title="Clear all seated jurors from the Prospective Panel and return them to the unseated pool"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Clear Panel</span>
            </button>
          </div>
        </div>

        {/* Row 1 / Primary Bench (Seats 1-6) */}
        {/* Fills every div.relative group.rounded-xl.transition-all in div.mb-2 before moving onto div.mb-4 */}
        <div className="mb-2">
          <div className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider mb-1.5 px-1 flex items-center justify-between">
            <span>{boxSize > MAX_PANEL_ROW_SEATS ? 'Row 1 (Seats 1–6)' : 'Prospective Jury Box (Seats 1–6)'}</span>
            <span className="text-[10px] text-slate-600 font-mono">
              {row1Seats.filter(s => seatedMap.has(s)).length} / {row1Seats.length} Seated
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
            {row1Seats.map(num => renderSeatSlot(num, false))}
          </div>
        </div>

        {/* Row 2 (Seats 7-12, only if boxSize > 6) */}
        {row2Seats.length > 0 && (
          <div className="mb-4">
            <div className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider mb-1.5 px-1 flex items-center justify-between">
              <span>Row 2 (Seats 7–{MAX_PANEL_ROW_SEATS + row2Seats.length})</span>
              <span className="text-[10px] text-slate-600 font-mono">
                {row2Seats.filter(s => seatedMap.has(s)).length} / {row2Seats.length} Seated
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
              {row2Seats.map(num => renderSeatSlot(num, false))}
            </div>
          </div>
        )}

        {/* Row 3 (if boxSize > 12) */}
        {row3Seats.length > 0 && (
          <div className="mb-4">
            <div className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider mb-1.5 px-1">
              <span>Row 3</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
              {row3Seats.map(num => renderSeatSlot(num, false))}
            </div>
          </div>
        )}

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

      {/* SECTION 2: VENIRE GALLERY GRID (Replaces plain pool) */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 shadow-xl flex-1 flex flex-col space-y-4">
        {/* Gallery Controls Header */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-center space-x-2">
            <Grid className="w-5 h-5 text-indigo-400" />
            <div>
              <h3 className="text-sm font-bold tracking-wide uppercase text-slate-200 flex items-center space-x-2">
                <span>Venire Gallery</span>
                <span className="text-xs px-2 py-0.2 rounded-full bg-slate-800 text-slate-300 font-mono">
                  {jurors.length} Jurors
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Courtroom seating gallery • Drag to swap gallery seats or drag up to panel
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative flex-1 sm:w-48">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search gallery..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 outline-none"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs">
              {(['all', 'active', 'positive', 'negative', 'struck'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2 py-1 rounded capitalize transition-colors ${
                    filter === f
                      ? f === 'positive'
                        ? 'bg-emerald-950/80 text-emerald-300 font-medium'
                        : f === 'negative' || f === 'struck'
                        ? 'bg-rose-950/80 text-rose-300 font-medium'
                        : 'bg-indigo-600 text-white font-medium'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {f === 'positive' ? 'Favorable' : f === 'negative' ? 'Unfavorable' : f}
                </button>
              ))}
            </div>

            {/* Vertical Aisle Walkway Toggle */}
            <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs">
              <span className="text-[10px] text-slate-400 font-semibold px-2 uppercase tracking-wider hidden sm:inline">
                Aisle:
              </span>
              <button
                onClick={() => updateActiveCase({ galleryGutters: 'none' })}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  gutters === 'none'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Continuous gallery bench"
              >
                None
              </button>
              <button
                onClick={() => updateActiveCase({ galleryGutters: '1' })}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  gutters === '1'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="1 Central Walkway Aisle"
              >
                1 Central
              </button>
            </div>

            {/* Origin Toggle (Courtroom Bottom-Left vs Top-Left) */}
            <button
              onClick={() => updateActiveCase({ galleryOrigin: origin === 'bottom-left' ? 'top-left' : 'bottom-left' })}
              className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                origin === 'bottom-left'
                  ? 'bg-indigo-950/70 border-indigo-600 text-indigo-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              title="Toggle between courtroom perspective (Juror #1 at bottom-left) and standard reading order"
            >
              <Compass className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {origin === 'bottom-left' ? 'Bottom-Left #1' : 'Top-Left #1'}
              </span>
            </button>

            {/* Column Selector */}
            <div className="flex items-center space-x-1.5 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 text-xs text-slate-400">
              <span>Cols:</span>
              <select
                value={gridCols}
                onChange={e => updateActiveCase({ gridCols: parseInt(e.target.value, 10) })}
                className="bg-transparent text-slate-200 font-semibold outline-none cursor-pointer"
              >
                <option value="6" className="bg-slate-900">6</option>
                <option value="8" className="bg-slate-900">8</option>
                <option value="10" className="bg-slate-900">10</option>
                <option value="12" className="bg-slate-900">12</option>
              </select>
            </div>
          </div>
        </div>

        {/* Gallery Benches Canvas */}
        {sortedJurors.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            No jurors in gallery. Use the "Intake" button at the top to import a juror roster.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Top Label for Back of Courtroom (if bottom-left origin) */}
            {origin === 'bottom-left' && (
              <div className="text-center py-1 bg-slate-950/60 border border-dashed border-slate-800 rounded-lg text-[11px] font-semibold text-slate-500 uppercase tracking-widest">
                🚪 BACK OF COURTROOM / GALLERY ENTRANCE
              </div>
            )}

            {/* Gallery Rows with optional central walkway aisle */}
            <div className="space-y-3">
              {displayedRows.map((row) => (
                <div key={row.rowNumber} className="flex items-center gap-2">
                  <div className="w-12 text-right text-[11px] font-mono text-slate-500 select-none">
                    Row {row.rowNumber}
                  </div>

                  <div className="flex-1 flex items-stretch gap-3">
                    {/* Render split banks (left and right sections if central aisle) */}
                    {(() => {
                      let colOffset = 0;
                      return splits.map((bankWidth, bankIdx) => {
                        const bankJurors = row.jurors.slice(colOffset, colOffset + bankWidth);
                        const isLastBank = bankIdx === splits.length - 1;
                        colOffset += bankWidth;

                        return (
                          <React.Fragment key={bankIdx}>
                            {/* Bank Grid */}
                            <div
                              className="flex-1 grid gap-2.5"
                              style={{
                                gridTemplateColumns: `repeat(${bankWidth}, minmax(0, 1fr))`
                              }}
                            >
                              {bankJurors.map((juror, cIdx) => {
                                if (!juror) {
                                  return (
                                    <div
                                      key={`empty-${cIdx}`}
                                      className="h-[105px] border border-dashed border-slate-850 rounded-xl bg-slate-950/20"
                                    />
                                  );
                                }

                                const isDimmed = !matchesFilter(juror);
                                const isOver = dragOverGalleryId === juror.id;
                                const isSwapped = swappedJurorIds.includes(juror.id);

                                return (
                                  <div
                                    key={juror.id}
                                    onDragOver={(e) => {
                                      e.preventDefault();
                                      setDragOverGalleryId(juror.id);
                                    }}
                                    onDragLeave={() => setDragOverGalleryId(null)}
                                    onDrop={(e) => handleGalleryDrop(e, juror)}
                                    className={`relative rounded-xl transition-all duration-200 ${
                                      isOver ? 'ring-2 ring-indigo-400 scale-[1.03] z-10' : ''
                                    }`}
                                  >
                                    <JurorCard
                                      juror={juror}
                                      isDimmed={isDimmed}
                                      highlightEffect={isSwapped}
                                      isDraggable={true}
                                      onDragStart={(e) => handleDragStart(e, juror.id)}
                                    />
                                  </div>
                                );
                              })}
                            </div>

                            {/* Clean Walkway Aisle between banks */}
                            {!isLastBank && (
                              <div className="w-9 self-stretch flex flex-col items-center justify-center relative select-none">
                                <div className="w-1.5 h-full rounded-full bg-slate-800/80 border border-slate-700/50" />
                                <span className="absolute top-1/2 -translate-y-1/2 -rotate-90 text-[8px] font-mono tracking-widest text-slate-500 uppercase whitespace-nowrap pointer-events-none">
                                  AISLE
                                </span>
                              </div>
                            )}
                          </React.Fragment>
                        );
                      });
                    })()}
                  </div>
                </div>
              ))}
            </div>

            {/* Well of Court / Judge's Bench Banner (if bottom-left origin) */}
            {origin === 'bottom-left' && (
              <div className="text-center py-2 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-900/40 rounded-xl text-xs font-bold text-indigo-300 uppercase tracking-widest shadow-inner">
                ⚖️ WELL OF COURT / COUNSEL TABLES & JUDGE’S BENCH
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
