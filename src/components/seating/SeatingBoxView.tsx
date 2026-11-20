import React, { useState, useRef, useEffect } from 'react';
import { useCase } from '../../context/CaseContext';
import { JurorCard } from './JurorCard';
import { Tooltip } from '../common/Tooltip';
import {
  Users,
  Search,
  PlusCircle,
  XCircle,
  ShieldCheck,
  ShieldAlert,
  Zap,
  Sparkles,
  Gavel,
  Grid,
  Trash2,
  Plus,
  Minus,
  X,
  Move
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
    recordCauseChallenge,
    prefillSequentialPanel,
    clearPanel,
    toggleAutoFillPanel,
    updateActiveCase,
    reorderGalleryJurors,
    moveJurorToGallerySpot,
    peremptoryStrikes,
  } = useCase();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'positive' | 'negative' | 'struck'>('all');
  const [targetSeatModal, setTargetSeatModal] = useState<{ seatNumber: number; isAlternate: boolean } | null>(null);
  const [targetSeatSearch, setTargetSeatSearch] = useState('');
  const [draggedJurorId, setDraggedJurorId] = useState<string | null>(null);
  const [dragOverSeat, setDragOverSeat] = useState<string | null>(null);
  const [dragOverGalleryId, setDragOverGalleryId] = useState<string | null>(null);
  const [dragOverEmptyIndex, setDragOverEmptyIndex] = useState<number | null>(null);
  const [swappedJurorIds, setSwappedJurorIds] = useState<string[]>([]);

  const panelRef = useRef<HTMLDivElement>(null);

  // Close target seat modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && targetSeatModal) {
        setTargetSeatModal(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [targetSeatModal]);

  if (!activeCase) return null;

  const boxSize = activeCase.boxSize || 6;
  const alternateCount = activeCase.alternateCount || 1;
  const autoFillEnabled = !!activeCase.autoFillPanel;
  const gridCols = activeCase.gridCols || 8;
  const gutters = (activeCase.galleryGutters === 'none' ? 'none' : '1') as 'none' | '1';
  const origin = activeCase.galleryOrigin || 'bottom-left';

  // Peremptory strike tracking (supports soft cap and court-granted supplemental strikes)
  const plaintiffStrikesUsed = peremptoryStrikes.filter(s => s.side === 'plaintiff_prosecution').length;
  const defenseStrikesUsed = peremptoryStrikes.filter(s => s.side === 'defense').length;
  const pAllowed = activeCase.plaintiffStrikesAllowed ?? 3;
  const dAllowed = activeCase.defenseStrikesAllowed ?? 3;
  const pRemaining = pAllowed - plaintiffStrikesUsed;
  const dRemaining = dAllowed - defenseStrikesUsed;
  const plaintiffLabel = activeCase.caseType === 'criminal' ? 'Prosecution' : 'Plaintiff';

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

  const handleSeatDrop = (seatNum: number, isAlt: boolean, e?: React.DragEvent) => {
    const sourceId = e?.dataTransfer?.getData('text/plain') || draggedJurorId;
    if (sourceId) {
      const existing = isAlt ? alternateMap.get(seatNum) : seatedMap.get(seatNum);
      assignSeat(sourceId, seatNum, isAlt);
      const affected = [sourceId];
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

  const handleGalleryEmptyDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain') || draggedJurorId;
    if (sourceId) {
      moveJurorToGallerySpot(sourceId, targetIndex);
      setSwappedJurorIds([sourceId]);
      setTimeout(() => setSwappedJurorIds([]), 800);
    }
    setDraggedJurorId(null);
    setDragOverEmptyIndex(null);
  };

  // Section 2 Gallery Calculations:
  const splits: number[] = getColumnSplits(gridCols, gutters);

  const jurorsMap = new Map(jurors.map(j => [j.id, j]));
  const galleryOrder = activeCase.galleryOrder;
  let slotJurors: (Juror | null)[] = [];

  if (galleryOrder && galleryOrder.length > 0) {
    slotJurors = galleryOrder.map(id => (id ? jurorsMap.get(id) || null : null));
    const placedIds = new Set(galleryOrder.filter(Boolean));
    const unplacedJurors = jurors
      .filter(j => !placedIds.has(j.id))
      .sort((a, b) => {
        const numA = parseInt(a.jurorNumber, 10);
        const numB = parseInt(b.jurorNumber, 10);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.jurorNumber.localeCompare(b.jurorNumber);
      });
    let unplacedIdx = 0;
    for (let i = 0; i < slotJurors.length && unplacedIdx < unplacedJurors.length; i++) {
      if (slotJurors[i] === null) {
        slotJurors[i] = unplacedJurors[unplacedIdx++];
      }
    }
    while (unplacedIdx < unplacedJurors.length) {
      slotJurors.push(unplacedJurors[unplacedIdx++]);
    }
  } else {
    const sorted = [...jurors].sort((a, b) => {
      const numA = parseInt(a.jurorNumber, 10);
      const numB = parseInt(b.jurorNumber, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.jurorNumber.localeCompare(b.jurorNumber);
    });
    slotJurors = sorted;
  }

  const numRows = Math.max(1, Math.ceil(slotJurors.length / gridCols));
  const totalSlots = numRows * gridCols;
  while (slotJurors.length < totalSlots) {
    slotJurors.push(null);
  }

  const rowsData: { rowNumber: number; slots: { juror: Juror | null; slotIndex: number }[] }[] = [];
  for (let r = 0; r < numRows; r++) {
    const startIdx = r * gridCols;
    const rowSlots: { juror: Juror | null; slotIndex: number }[] = [];
    for (let c = 0; c < gridCols; c++) {
      const idx = startIdx + c;
      rowSlots.push({ juror: slotJurors[idx], slotIndex: idx });
    }
    if (origin === 'top-right') {
      rowSlots.reverse();
    }
    rowsData.push({ rowNumber: r + 1, slots: rowSlots });
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
          className={`relative group rounded-xl min-h-[105px] ${
            isOver ? 'ring-2 ring-indigo-400' : ''
          }`}
        >
          {/* Card Wrapper */}
          <div
            data-panel-card-id={juror.id}
            className="w-full h-full"
          >
            <JurorCard
              juror={juror}
              seatLabel={label}
              isDimmed={isDimmed}
              isDraggable={true}
              onDragStart={(e) => handleDragStart(e, juror.id)}
            />
          </div>

          {/* Strike for Cause button on top-left hover */}
          <div className="absolute -top-2.5 -left-1 opacity-0 group-hover:opacity-100 transition-opacity z-30">
            <Tooltip content="Struck for Cause" side="top" align="left">
              <button
                data-strike-action="true"
                onClick={(e) => {
                  e.stopPropagation();
                  recordCauseChallenge(
                    juror.id,
                    juror.strikeIntentNote || 'Excused for cause by court',
                    'granted'
                  );
                }}
                className="bg-amber-950 hover:bg-amber-800 border border-amber-600 text-amber-200 rounded-full p-1 shadow transition-colors"
                title="Struck for Cause"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-amber-300" />
              </button>
            </Tooltip>
          </div>

          {/* Quick Strike Buttons on top-right hover */}
          <div className="absolute -top-2.5 right-1 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity z-30">
            <Tooltip
              content={
                pRemaining > 0
                  ? `Struck Peremptorily (${plaintiffLabel}) (${pRemaining} remaining)`
                  : pRemaining === 0
                  ? `Struck Peremptorily (${plaintiffLabel}) - 0 Remaining (Next is Excess)`
                  : `Struck Peremptorily (${plaintiffLabel}) - Extra (+${Math.abs(pRemaining)}) [Statutory allotment exceeded]`
              }
              side="top"
              align="right"
            >
              <button
                data-strike-action="true"
                onClick={(e) => {
                  e.stopPropagation();
                  recordPeremptoryStrike(juror.id, 'plaintiff_prosecution');
                }}
                className={`relative rounded-full p-1 shadow transition-all border ${
                  pRemaining > 0
                    ? 'bg-rose-950 hover:bg-rose-800 border-rose-600 text-rose-200 cursor-pointer'
                    : pRemaining === 0
                    ? 'bg-amber-950/90 hover:bg-amber-800 border-amber-500 text-amber-200 ring-1 ring-amber-400/50 cursor-pointer'
                    : 'bg-amber-900 hover:bg-amber-800 border-amber-400 text-amber-100 ring-2 ring-amber-400/70 shadow-lg shadow-amber-950/60 cursor-pointer'
                }`}
                title={
                  pRemaining > 0
                    ? `Struck Peremptorily (${plaintiffLabel}) (${pRemaining} remaining)`
                    : pRemaining === 0
                    ? `Struck Peremptorily (${plaintiffLabel}) - 0 Remaining (Next is Excess)`
                    : `Struck Peremptorily (${plaintiffLabel}) - Extra (+${Math.abs(pRemaining)})`
                }
              >
                <Gavel className="w-3 h-3 text-rose-300" />
                {pRemaining < 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-slate-950 font-black text-[8px] px-1 rounded-full border border-amber-300 shadow leading-tight">
                    +{Math.abs(pRemaining)}
                  </span>
                )}
              </button>
            </Tooltip>

            <Tooltip
              content={
                dRemaining > 0
                  ? `Struck Peremptorily (Defense) (${dRemaining} remaining)`
                  : dRemaining === 0
                  ? 'Struck Peremptorily (Defense) - 0 Remaining (Next is Excess)'
                  : `Struck Peremptorily (Defense) - Extra (+${Math.abs(dRemaining)}) [Statutory allotment exceeded]`
              }
              side="top"
              align="right"
            >
              <button
                data-strike-action="true"
                onClick={(e) => {
                  e.stopPropagation();
                  recordPeremptoryStrike(juror.id, 'defense');
                }}
                className={`relative rounded-full p-1 shadow transition-all border ${
                  dRemaining > 0
                    ? 'bg-blue-950 hover:bg-blue-800 border-blue-600 text-blue-200 cursor-pointer'
                    : dRemaining === 0
                    ? 'bg-amber-950/90 hover:bg-amber-800 border-amber-500 text-amber-200 ring-1 ring-amber-400/50 cursor-pointer'
                    : 'bg-amber-900 hover:bg-amber-800 border-amber-400 text-amber-100 ring-2 ring-amber-400/70 shadow-lg shadow-amber-950/60 cursor-pointer'
                }`}
                title={
                  dRemaining > 0
                    ? `Struck Peremptorily (Defense) (${dRemaining} remaining)`
                    : dRemaining === 0
                    ? 'Struck Peremptorily (Defense) - 0 Remaining (Next is Excess)'
                    : `Struck Peremptorily (Defense) - Extra (+${Math.abs(dRemaining)})`
                }
              >
                <Gavel className="w-3 h-3 text-blue-300" />
                {dRemaining < 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-slate-950 font-black text-[8px] px-1 rounded-full border border-amber-300 shadow leading-tight">
                    +{Math.abs(dRemaining)}
                  </span>
                )}
              </button>
            </Tooltip>
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
          handleSeatDrop(seatNum, isAlt, e);
        }}
        className={`h-[105px] border-2 border-dashed rounded-xl p-3 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
          isOver
            ? 'border-indigo-400 bg-indigo-950/40 ring-2 ring-indigo-400/50'
            : 'border-slate-800 hover:border-indigo-500/60 bg-slate-950/40 hover:bg-indigo-950/20'
        } group`}
      >
        <PlusCircle className="w-5 h-5 text-slate-500 group-hover:text-indigo-400 mb-1 transition-colors" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-indigo-300">
          {label}
        </span>
        <span className="text-[10px] text-slate-500 group-hover:text-indigo-400/80">
          Click to Seat
        </span>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-4 space-y-6 [overflow-anchor:none]">
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
            {/* Conditional Prefill or Clear Panel Button (mutually exclusive) */}
            {seatedMap.size > 0 || alternateMap.size > 0 ? (
              <button
                onClick={() => clearPanel()}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-rose-950/60 hover:border-rose-700/80 hover:text-rose-300 text-slate-300 border border-slate-700 rounded-lg text-xs font-semibold shadow-sm transition-all"
                title="Clear all seated jurors from the Prospective Panel and return them to the unseated pool"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Clear Panel</span>
              </button>
            ) : (
              <button
                onClick={() => prefillSequentialPanel(autoFillEnabled)}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow transition-colors"
                title="Pre-fill Prospective Panel with sequential unstruck jurors (Jurors 1, 2, ...)"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
                <span>Prefill Panel</span>
              </button>
            )}

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
              <span>Auto-Fill Panel: {autoFillEnabled ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        </div>

        {/* Row 1 / Primary Bench (Seats 1-6) */}
        {/* Fills every div.relative group.rounded-xl.transition-all in div.mb-2 before moving onto div.mb-4 */}
        <div data-tour="jury-box" className="mb-2">
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
        <div className="pt-3 border-t border-slate-800/80">
          <div className="text-[11px] font-semibold uppercase text-purple-400 tracking-wider mb-2 px-1 flex items-center justify-between">
            <div className="flex items-center space-x-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Alternate Juror Bench</span>
              <span className="text-[10px] text-purple-300/70 font-mono">
                ({alternateMap.size} of {alternateCount} Seated)
              </span>
            </div>

            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={() => {
                  if (alternateCount > 0) {
                    const lastAltJuror = alternateMap.get(alternateCount);
                    if (lastAltJuror) {
                      unseatJuror(lastAltJuror.id);
                    }
                    updateActiveCase({ alternateCount: alternateCount - 1 });
                  }
                }}
                disabled={alternateCount === 0}
                className="w-6 h-6 flex items-center justify-center rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 hover:text-white border border-slate-700 transition-colors"
                title="Remove an alternate seat"
              >
                <Minus className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => {
                  updateActiveCase({ alternateCount: alternateCount + 1 });
                }}
                disabled={alternateCount >= 8}
                className="w-6 h-6 flex items-center justify-center rounded bg-purple-900/40 hover:bg-purple-800/60 border border-purple-700/60 text-purple-200 transition-colors"
                title="Add an alternate seat"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>

          {alternateCount > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
              {alternateSeats.map(num => renderSeatSlot(num, true))}
            </div>
          ) : (
            <div className="text-center py-2.5 text-slate-500 text-[11px] border border-dashed border-slate-800 rounded-lg">
              No alternates configured. Click <span className="text-purple-400 font-bold">+</span> to add alternate seats.
            </div>
          )}
        </div>
      </div>

      {/* SECTION 2: VENIRE GALLERY GRID (Replaces plain pool) */}
      <div data-tour="jury-pool" className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 shadow-xl flex-1 flex flex-col space-y-4">
        {/* Gallery Controls Header */}
        <div className="sticky -top-4 z-20 bg-slate-900/95 backdrop-blur-md -mx-4 -mt-4 px-4 py-3 rounded-t-2xl border-b border-slate-800 shadow-md flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <Grid className="w-5 h-5 text-indigo-400" />
            <div>
              <h3 className="text-sm font-bold tracking-wide uppercase text-slate-200 flex items-center space-x-2">
                <span>Jury Pool</span>
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

            {/* Courtroom Geometry & Aisle Adjusters */}
            <div data-tour="gallery-controls" className="flex items-center space-x-2 flex-wrap gap-y-1.5">
              {/* Vertical Aisle Walkway Simple On/Off Toggle */}
              <button
                type="button"
                onClick={() => updateActiveCase({ galleryGutters: gutters === 'none' ? '1' : 'none' })}
                className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                  gutters === '1'
                    ? 'bg-indigo-950/70 border-indigo-600 text-indigo-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
                title={gutters === '1' ? 'Aisle is ON (click to turn OFF)' : 'Aisle is OFF (click to turn ON)'}
              >
                <span>Aisle</span>
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    gutters === '1' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {gutters === '1' ? 'ON' : 'OFF'}
                </span>
              </button>

              {/* Custom Column Selector */}
              <div className="flex items-center space-x-1.5 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 text-xs text-slate-400">
                <label htmlFor="box-grid-cols" className="cursor-pointer">Cols:</label>
                <input
                  id="box-grid-cols"
                  type="number"
                  min={2}
                  max={30}
                  value={gridCols}
                  onChange={e => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val) && val >= 2 && val <= 30) {
                      updateActiveCase({ gridCols: val });
                    }
                  }}
                  className="w-12 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-slate-200 font-semibold text-center outline-none focus:border-indigo-500"
                  title="Enter custom number of columns (2-30)"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Gallery Benches Canvas */}
        {jurors.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            No jurors in gallery. Use the "Intake" button at the top to import a juror roster.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Top Label for Courtroom Orientation */}
            {origin === 'bottom-left' ? (
              <div className="text-center py-1 bg-slate-950/60 border border-dashed border-slate-800 rounded-lg text-[11px] font-semibold text-slate-500 uppercase tracking-widest">
                🚪 BACK OF COURTROOM / GALLERY ENTRANCE
              </div>
            ) : (
              <div className="text-center py-1.5 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-900/40 rounded-xl text-xs font-bold text-indigo-300 uppercase tracking-widest shadow-inner">
                ⚖️ WELL OF COURT / COUNSEL TABLES & JUDGE’S BENCH
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
                        const bankSlots = row.slots.slice(colOffset, colOffset + bankWidth);
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
                              {bankSlots.map((slot) => {
                                const { juror, slotIndex } = slot;
                                if (!juror) {
                                  return (
                                    <div
                                      key={`empty-${slotIndex}`}
                                      onDragOver={(e) => {
                                        e.preventDefault();
                                        setDragOverEmptyIndex(slotIndex);
                                      }}
                                      onDragLeave={() => setDragOverEmptyIndex(null)}
                                      onDrop={(e) => handleGalleryEmptyDrop(e, slotIndex)}
                                      className={`h-[105px] border border-dashed rounded-xl transition-all flex flex-col items-center justify-center p-2 text-center select-none ${
                                        dragOverEmptyIndex === slotIndex
                                          ? 'border-indigo-500/80 bg-indigo-950/40 text-indigo-300'
                                          : 'border-slate-800/80 bg-slate-950/20 text-slate-500 hover:border-slate-700 hover:text-slate-400'
                                      }`}
                                    >
                                      <Move className="w-4 h-4 mb-1 opacity-50" />
                                      <span className="text-[10px] font-medium leading-tight">
                                        Drag & drop juror here
                                      </span>
                                    </div>
                                  );
                                }

                                const isDimmed = !matchesFilter(juror);
                                const isOver = dragOverGalleryId === juror.id;
                                const isSwapped = swappedJurorIds.includes(juror.id);
                                const isStruck = juror.status.startsWith('struck_') || juror.status === 'cause_granted';

                                return (
                                  <div
                                    key={juror.id}
                                    data-tour="gallery-juror-card"
                                    onDragOver={(e) => {
                                      e.preventDefault();
                                      setDragOverGalleryId(juror.id);
                                    }}
                                    onDragLeave={() => setDragOverGalleryId(null)}
                                    onDrop={(e) => handleGalleryDrop(e, juror)}
                                    className={`relative group rounded-xl transition-all duration-200 ${
                                      isOver ? 'ring-2 ring-indigo-400 scale-[1.03] z-10' : ''
                                    }`}
                                  >
                                    <JurorCard
                                      juror={juror}
                                      isDimmed={isDimmed}
                                      isDraggable={true}
                                      onDragStart={(e) => handleDragStart(e, juror.id)}
                                    />

                                    {/* Strike for Cause from within Jury Pool */}
                                    {!isStruck && (
                                      <div className="absolute -top-2.5 -left-1 opacity-0 group-hover:opacity-100 transition-opacity z-30">
                                        <Tooltip content="Struck for Cause" side="top" align="left">
                                          <button
                                            data-strike-action="true"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              recordCauseChallenge(
                                                juror.id,
                                                juror.strikeIntentNote || 'Excused for cause by court',
                                                'granted'
                                              );
                                            }}
                                            className="bg-amber-950 hover:bg-amber-800 border border-amber-600 text-amber-200 rounded-full p-1 shadow transition-colors"
                                            title="Struck for Cause"
                                          >
                                            <ShieldAlert className="w-3.5 h-3.5 text-amber-300" />
                                          </button>
                                        </Tooltip>
                                      </div>
                                    )}
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

            {/* Bottom Label for Courtroom Orientation */}
            {origin === 'bottom-left' ? (
              <div className="text-center py-2 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-900/40 rounded-xl text-xs font-bold text-indigo-300 uppercase tracking-widest shadow-inner">
                ⚖️ WELL OF COURT / COUNSEL TABLES & JUDGE’S BENCH
              </div>
            ) : origin === 'top-right' ? (
              <div className="text-center py-1 bg-slate-950/60 border border-dashed border-slate-800 rounded-lg text-[11px] font-semibold text-slate-500 uppercase tracking-widest">
                🚪 BACK OF COURTROOM (Observer Seated Here)
              </div>
            ) : (
              <div className="text-center py-1 bg-slate-950/60 border border-dashed border-slate-800 rounded-lg text-[11px] font-semibold text-slate-500 uppercase tracking-widest">
                🚪 BACK OF COURTROOM / GALLERY ENTRANCE
              </div>
            )}
          </div>
        )}
      </div>

      {/* Target Seat Modal to select & seat a specific juror */}
      {targetSeatModal && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setTargetSeatModal(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl p-5 space-y-4 max-h-[85vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
                  <span>Seat Juror into</span>
                  <span className="px-2 py-0.5 rounded bg-indigo-950 border border-indigo-700/60 text-indigo-300 font-mono text-sm">
                    {targetSeatModal.isAlternate ? `Alternate ${targetSeatModal.seatNumber}` : `Panel Seat ${targetSeatModal.seatNumber}`}
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Select an unstruck pool juror to place into this seat.
                </p>
              </div>
              <button
                onClick={() => setTargetSeatModal(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                autoFocus
                placeholder="Filter by juror #, name, occupation..."
                value={targetSeatSearch}
                onChange={e => setTargetSeatSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 outline-none"
              />
            </div>

            {/* Juror List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[200px]">
              {(() => {
                const eligiblePoolJurors = jurors.filter(j => {
                  const isStruck = j.status.startsWith('struck_') || j.status === 'cause_granted';
                  if (isStruck || j.seatNumber) return false;
                  if (!targetSeatSearch.trim()) return true;
                  const q = targetSeatSearch.toLowerCase();
                  return (
                    j.jurorNumber.toLowerCase().includes(q) ||
                    (j.fullName && j.fullName.toLowerCase().includes(q)) ||
                    (j.occupation && j.occupation.toLowerCase().includes(q)) ||
                    (j.notes && j.notes.toLowerCase().includes(q))
                  );
                });

                if (eligiblePoolJurors.length === 0) {
                  return (
                    <div className="text-center py-10 text-xs text-slate-500">
                      No unstruck pool jurors available to seat.
                    </div>
                  );
                }

                return eligiblePoolJurors.map(juror => (
                  <div
                    key={juror.id}
                    onClick={() => {
                      assignSeat(juror.id, targetSeatModal.seatNumber, targetSeatModal.isAlternate);
                      setTargetSeatModal(null);
                      setTargetSeatSearch('');
                    }}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 hover:bg-indigo-950/40 border border-slate-800 hover:border-indigo-500/60 cursor-pointer transition-all group"
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <span className="text-sm font-extrabold font-mono text-indigo-400 bg-indigo-950/60 border border-indigo-800/60 px-2 py-1 rounded-lg">
                        #{juror.jurorNumber}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-200 group-hover:text-white truncate">
                          {juror.fullName || `Juror #${juror.jurorNumber}`}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {juror.occupation || 'No occupation'} {(juror.areaOfCounty || juror.cityState) ? `• ${juror.areaOfCounty || juror.cityState}` : ''}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {juror.rating !== 0 && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          juror.rating > 0
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                            : 'bg-rose-950 text-rose-300 border border-rose-700'
                        }`}>
                          {juror.rating > 0 ? `+${juror.rating}` : juror.rating}
                        </span>
                      )}
                      <span className="text-xs font-semibold text-indigo-400 group-hover:text-indigo-300 px-2.5 py-1 rounded-lg bg-slate-900 group-hover:bg-indigo-900/60 border border-slate-800 group-hover:border-indigo-700/60 transition-colors">
                        Seat Here →
                      </span>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
