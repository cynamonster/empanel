import React, { useState } from 'react';
import { useCase } from '../../context/CaseContext';
import { JurorCard } from './JurorCard';
import {
  Grid,
  Search,
  Compass,
  RotateCcw
} from 'lucide-react';
import type { Juror } from '../../types';

function getColumnSplits(totalCols: number, gutters: 'none' | '1'): number[] {
  if (gutters === 'none' || totalCols < 2) return [totalCols];
  const left = Math.ceil(totalCols / 2);
  const right = totalCols - left;
  return [left, right];
}

export const SeatingGridView: React.FC = () => {
  const {
    activeCase,
    jurors,
    updateActiveCase,
    reorderGalleryJurors,
  } = useCase();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'positive' | 'negative' | 'struck'>('all');
  const [draggedJurorId, setDraggedJurorId] = useState<string | null>(null);
  const [dragOverJurorId, setDragOverJurorId] = useState<string | null>(null);
  const [swappedJurorIds, setSwappedJurorIds] = useState<string[]>([]);

  if (!activeCase) return null;

  const gridCols = activeCase.gridCols || 8;
  const gutters = (activeCase.galleryGutters === 'none' ? 'none' : '1') as 'none' | '1'; // Default to 1 central gutter
  const origin = activeCase.galleryOrigin || 'bottom-left'; // Default to bottom-left

  // Column splits: either 1 bank (none) or 2 banks (1 central)
  const splits: number[] = getColumnSplits(gridCols, gutters);

  // Determine full juror sequence in the gallery
  // If custom galleryOrder is present, respect it; otherwise sort by jurorNumber
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

  // Filter matcher (determines if juror is highlighted or dimmed)
  const matchesFilter = (j: Juror): boolean => {
    const term = search.toLowerCase();
    const textMatches = !term ||
      j.jurorNumber.toLowerCase().includes(term) ||
      j.fullName.toLowerCase().includes(term) ||
      (j.occupation && j.occupation.toLowerCase().includes(term));

    if (!textMatches) return false;

    if (filter === 'active') return !j.status.startsWith('struck_') && j.status !== 'cause_granted';
    if (filter === 'positive') return j.rating > 0;
    if (filter === 'negative') return j.rating < 0;
    if (filter === 'struck') return j.status.startsWith('struck_') || j.status === 'cause_granted';

    return true;
  };

  // Group jurors into rows without moving seats!
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

  // Courtroom perspective:
  // If bottom-left origin: Row 1 (Front Row, Juror #1 at bottom-left) is at the bottom of the screen.
  const displayedRows = origin === 'bottom-left'
    ? [...rowsData].reverse()
    : rowsData;

  const handleGutterToggle = (newGutter: 'none' | '1') => {
    updateActiveCase({ galleryGutters: newGutter });
  };

  const handleOriginToggle = () => {
    const next = origin === 'bottom-left' ? 'top-left' : 'bottom-left';
    updateActiveCase({ galleryOrigin: next });
  };

  // Juror drag & drop with apparent visual animation
  const handleJurorDragStart = (e: React.DragEvent, jurorId: string) => {
    setDraggedJurorId(jurorId);
    e.dataTransfer.setData('text/plain', jurorId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleJurorDragOver = (e: React.DragEvent, jurorId: string) => {
    e.preventDefault();
    if (draggedJurorId && draggedJurorId !== jurorId) {
      setDragOverJurorId(jurorId);
    }
  };

  const handleJurorDrop = (e: React.DragEvent, targetJurorId: string) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain') || draggedJurorId;
    if (sourceId && sourceId !== targetJurorId) {
      reorderGalleryJurors(sourceId, targetJurorId);
      // Trigger quick visual highlight animation on swapped cards
      setSwappedJurorIds([sourceId, targetJurorId]);
      setTimeout(() => setSwappedJurorIds([]), 800);
    }
    setDraggedJurorId(null);
    setDragOverJurorId(null);
  };

  const handleResetGalleryOrder = () => {
    updateActiveCase({ galleryOrder: undefined });
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-4 space-y-4">
      {/* Grid Top Toolbar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <Grid className="w-5 h-5 text-indigo-400" />
          <div>
            <h2 className="text-sm font-bold tracking-wide uppercase text-slate-200 flex items-center space-x-2">
              <span>Venire Gallery Grid</span>
              <span className="text-xs px-2 py-0.2 rounded-full bg-slate-800 text-slate-400 font-mono">
                {sortedJurors.length} Total
              </span>
            </h2>
            <div className="text-[11px] text-slate-400 flex items-center space-x-1.5 mt-0.5">
              <span>{numRows} Rows × {gridCols} Cols</span>
              <span>•</span>
              <span className="text-indigo-400 font-medium">
                {origin === 'bottom-left' ? 'Front-to-Back (Juror #1 at Bottom-Left)' : 'Top-to-Bottom'}
              </span>
              {activeCase.galleryOrder && (
                <>
                  <span>•</span>
                  <button
                    onClick={handleResetGalleryOrder}
                    className="text-amber-400 hover:text-amber-300 underline flex items-center space-x-0.5"
                    title="Reset custom drag order to original juror numbers"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    <span>Reset Order</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 sm:w-48">
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
              onClick={() => setFilter('active')}
              className={`px-2 py-1 rounded transition-colors ${filter === 'active' ? 'bg-slate-800 text-slate-200 font-medium' : 'text-slate-400 hover:text-slate-300'}`}
            >
              Active
            </button>
            <button
              onClick={() => setFilter('positive')}
              className={`px-2 py-1 rounded transition-colors ${filter === 'positive' ? 'bg-emerald-950/60 text-emerald-300 font-medium' : 'text-slate-400 hover:text-slate-300'}`}
            >
              Favorable
            </button>
            <button
              onClick={() => setFilter('negative')}
              className={`px-2 py-1 rounded transition-colors ${filter === 'negative' ? 'bg-rose-950/60 text-rose-300 font-medium' : 'text-slate-400 hover:text-slate-300'}`}
            >
              Unfavorable
            </button>
            <button
              onClick={() => setFilter('struck')}
              className={`px-2 py-1 rounded transition-colors ${filter === 'struck' ? 'bg-rose-950/60 text-rose-300 font-medium' : 'text-slate-400 hover:text-slate-300'}`}
            >
              Struck
            </button>
          </div>

          {/* Vertical Gutters (Aisles) Toggle: None or 1 Central */}
          <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs">
            <span className="text-[10px] text-slate-400 font-semibold px-2 uppercase tracking-wider hidden sm:inline">
              Aisle:
            </span>
            <button
              onClick={() => handleGutterToggle('none')}
              className={`px-2.5 py-1 rounded font-medium transition-colors ${
                gutters === 'none'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="No vertical aisle / continuous bench"
            >
              None
            </button>
            <button
              onClick={() => handleGutterToggle('1')}
              className={`px-2.5 py-1 rounded font-medium transition-colors ${
                gutters === '1'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="1 Central Aisle (2 bench sections)"
            >
              1 Central
            </button>
          </div>

          {/* Origin Toggle (Bottom-Left vs Top-Left) */}
          <button
            onClick={handleOriginToggle}
            className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
              origin === 'bottom-left'
                ? 'bg-indigo-950/70 border-indigo-600 text-indigo-300'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle between courtroom perspective (Juror #1 at bottom-left) and standard reading order"
          >
            <Compass className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {origin === 'bottom-left' ? 'Bottom-Left Origin' : 'Top-Left Origin'}
            </span>
          </button>

          {/* Grid column adjuster */}
          <div className="flex items-center space-x-1.5 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 text-xs text-slate-400">
            <span>Cols:</span>
            <select
              value={gridCols}
              onChange={e => {
                const newCols = parseInt(e.target.value, 10);
                updateActiveCase({ gridCols: newCols });
              }}
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

      {/* Grid Canvas */}
      {sortedJurors.length === 0 ? (
        <div className="py-16 text-center text-slate-500 text-xs bg-slate-900/40 border border-slate-800/80 rounded-2xl">
          No jurors found. Use the "Intake" button at the top to import or create prospective jurors.
        </div>
      ) : (
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 shadow-xl flex-1 flex flex-col justify-between space-y-4">
          
          {/* Top Label for Back of Courtroom (if bottom-left origin) */}
          {origin === 'bottom-left' && (
            <div className="text-center py-1 bg-slate-950/60 border border-dashed border-slate-800 rounded-lg text-[11px] font-semibold text-slate-500 uppercase tracking-widest flex items-center justify-center space-x-2">
              <span>🚪 BACK OF COURTROOM / GALLERY ENTRANCE</span>
              <span className="text-[10px] text-slate-600 font-normal">
                (Drag cards to swap seats with instant visual confirmation)
              </span>
            </div>
          )}

          {/* Seating Rows */}
          <div className="space-y-3.5 overflow-x-auto py-1">
            {displayedRows.map((row) => {
              const isFrontRow = row.rowNumber === 1;
              const isBackRow = row.rowNumber === numRows;

              let colOffset = 0;

              return (
                <div key={row.rowNumber} className="flex items-center space-x-3">
                  {/* Row Indicator Badge */}
                  <div className="w-20 flex-shrink-0 text-right">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border block truncate ${
                      isFrontRow
                        ? 'bg-indigo-950/80 border-indigo-500/50 text-indigo-300 font-extrabold shadow-sm'
                        : isBackRow
                        ? 'bg-slate-950 border-slate-800 text-slate-500'
                        : 'bg-slate-950 border-slate-850 text-slate-400'
                    }`}>
                      Row {row.rowNumber}
                      {isFrontRow ? ' (Front)' : isBackRow ? ' (Back)' : ''}
                    </span>
                  </div>

                  {/* Row Banks with Static Clean Vertical Aisles */}
                  <div className="flex-1 flex items-center space-x-2 min-w-[700px]">
                    {splits.map((bankCols, bankIdx) => {
                      const bankJurors = row.jurors.slice(colOffset, colOffset + bankCols);
                      colOffset += bankCols;

                      return (
                        <React.Fragment key={bankIdx}>
                          {/* Static Aisle Walkway (between banks) */}
                          {bankIdx > 0 && (
                            <div className="w-8 md:w-12 h-24 flex-shrink-0 flex flex-col items-center justify-center border-x border-dashed border-slate-800/80 bg-slate-950/30 rounded select-none">
                              <span className="text-[9px] font-mono font-semibold text-slate-600 rotate-90 uppercase tracking-widest">
                                AISLE
                              </span>
                            </div>
                          )}

                          {/* Bank Grid */}
                          <div
                            className="flex-1 grid gap-2.5"
                            style={{
                              gridTemplateColumns: `repeat(${bankCols}, minmax(130px, 1fr))`,
                            }}
                          >
                            {bankJurors.map((juror, seatIdx) => {
                              if (!juror) {
                                return (
                                  <div
                                    key={seatIdx}
                                    className="h-[105px] rounded-xl border border-dashed border-slate-850/60 bg-slate-950/20 flex items-center justify-center text-slate-700 text-[10px]"
                                  >
                                    Empty
                                  </div>
                                );
                              }

                              const isDimmed = !matchesFilter(juror);
                              const isOver = dragOverJurorId === juror.id;
                              const isSwapped = swappedJurorIds.includes(juror.id);

                              return (
                                <div
                                  key={juror.id}
                                  onDragOver={(e) => handleJurorDragOver(e, juror.id)}
                                  onDrop={(e) => handleJurorDrop(e, juror.id)}
                                  className={`rounded-xl transition-all duration-300 ease-out transform ${
                                    isOver
                                      ? 'ring-2 ring-indigo-400 scale-[1.03] shadow-xl shadow-indigo-950/80'
                                      : ''
                                  }`}
                                >
                                  <JurorCard
                                    juror={juror}
                                    isDimmed={isDimmed}
                                    isDraggable={true}
                                    highlightEffect={isSwapped}
                                    onDragStart={(e) => handleJurorDragStart(e, juror.id)}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Bar: Front of Courtroom / Well / Counsel Table (if bottom-left origin) */}
          {origin === 'bottom-left' ? (
            <div className="text-center py-2 bg-indigo-950/40 border border-indigo-500/30 rounded-xl text-xs font-bold text-indigo-300 uppercase tracking-wider shadow-inner flex items-center justify-center space-x-2">
              <span>🏛️ FRONT OF COURTROOM • COUNSEL TABLE & PODIUM (WELL)</span>
              <span className="text-[10px] text-indigo-400/80 font-normal">
                (Juror #1 at Front-Left ↙ • Seats stay fixed when filtered)
              </span>
            </div>
          ) : (
            <div className="text-center py-1 bg-slate-950/60 border border-dashed border-slate-800 rounded-lg text-[11px] font-semibold text-slate-500 uppercase tracking-widest">
              🚪 Back of Courtroom / Gallery Entrance
            </div>
          )}

        </div>
      )}
    </div>
  );
};
