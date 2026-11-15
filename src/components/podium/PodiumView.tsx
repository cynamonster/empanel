import React, { useState, useEffect, useMemo } from 'react';
import { useCase } from '../../context/CaseContext';
import { PodiumJurorCard } from './PodiumJurorCard';
import type { Juror } from '../../types';
import {
  Radio,
  Maximize2,
  Minimize2,
  Sun,
  Moon,
  MessageSquare,
  X,
  User,
  MapPin,
  Briefcase,
  GraduationCap,
  Scale,
  Hand,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Volume2,
  Unlink
} from 'lucide-react';

function getColumnSplits(totalCols: number, gutters: 'none' | '1'): number[] {
  if (gutters === 'none' || totalCols < 2) return [totalCols];
  const left = Math.ceil(totalCols / 2);
  const right = totalCols - left;
  return [left, right];
}

export const PodiumView: React.FC = () => {
  const {
    activeCase,
    jurors,
    questions,
    activeQuestionId,
    activeWhisper,
    dismissWhisper,
    syncStatus,
    syncLatency,
    disconnectSync,
  } = useCase();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [highContrastLight, setHighContrastLight] = useState(false);
  const [spotlightJurorId, setSpotlightJurorId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);

  // Window resize listener to dynamically toggle compact card grid on mobile
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Keyboard shortcut listener (Space to dismiss whisper, Esc to close spotlight, numeric keys)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' && activeWhisper) {
        e.preventDefault();
        dismissWhisper(activeWhisper.id);
      } else if (e.key === 'Escape' && spotlightJurorId) {
        setSpotlightJurorId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeWhisper, spotlightJurorId]);

  const gridCols = activeCase?.gridCols || 8;
  const gutters = (activeCase?.galleryGutters === 'none' ? 'none' : '1') as 'none' | '1';
  const origin = activeCase?.galleryOrigin || 'bottom-left';

  const splits = useMemo(() => getColumnSplits(gridCols, gutters), [gridCols, gutters]);

  // Sort full jury pool (respecting manual gallery order or juror numbers)
  const sortedJurors = useMemo(() => {
    return [...jurors].sort((a, b) => {
      if (activeCase?.galleryOrder && activeCase.galleryOrder.length > 0) {
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
  }, [jurors, activeCase?.galleryOrder]);

  // Arrange pool jurors into courtroom rows
  const numRows = Math.max(1, Math.ceil(sortedJurors.length / gridCols));
  const rowsData = useMemo(() => {
    const rows: { rowNumber: number; jurors: (Juror | null)[] }[] = [];
    for (let r = 0; r < numRows; r++) {
      const startIdx = r * gridCols;
      const rowJurors: (Juror | null)[] = [];
      for (let c = 0; c < gridCols; c++) {
        const jIdx = startIdx + c;
        rowJurors.push(jIdx < sortedJurors.length ? sortedJurors[jIdx] : null);
      }
      if (origin === 'top-right') {
        rowJurors.reverse();
      }
      rows.push({ rowNumber: r + 1, jurors: rowJurors });
    }
    return origin === 'bottom-left' ? [...rows].reverse() : rows;
  }, [numRows, gridCols, sortedJurors, origin]);

  if (!activeCase) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-950 text-slate-200 gap-3 font-sans p-6 text-center">
        <Radio className="w-10 h-10 text-indigo-400 animate-pulse" />
        <div className="text-base font-semibold text-slate-200">Connecting to Courtroom Session...</div>
        <div className="text-xs text-slate-400 font-mono">Syncing live jury pool data with table console</div>
        <button
          onClick={() => disconnectSync()}
          className="mt-4 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold transition-colors flex items-center gap-1.5"
        >
          <Unlink className="w-3.5 h-3.5 text-rose-400" />
          <span>Cancel & Return to Table Console</span>
        </button>
      </div>
    );
  }

  // Active question details
  const activeQuestion = questions.find(q => q.id === activeQuestionId);
  const totalRaisedHands = activeQuestionId
    ? jurors.filter(j => j.responses?.[activeQuestionId]?.answeredYes).length
    : 0;

  // Active spotlight juror
  const spotlightJuror = jurors.find(j => j.id === spotlightJurorId);

  const themeClasses = highContrastLight
    ? 'bg-slate-100 text-slate-900'
    : 'bg-slate-950 text-slate-100';

  return (
    <div className={`h-screen w-screen overflow-hidden flex flex-col font-sans transition-colors duration-150 ${themeClasses}`}>
      
      {/* Top Lectern HUD */}
      <header className="px-3 sm:px-6 py-2 sm:py-3 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between shadow-md relative z-20">
        <div className="flex items-center space-x-2 sm:space-x-4">
          <div className="flex items-center space-x-1.5 sm:space-x-2 text-indigo-400 font-black tracking-tight text-sm sm:text-lg">
            <Scale className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400 shrink-0" />
            <span>EMPANEL</span>
          </div>

          <div className="hidden sm:flex items-center space-x-2 px-3 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs font-medium text-slate-300">
            <span className="truncate max-w-[20rem]">{activeCase.name}</span>
            <span className="text-slate-500">•</span>
            <span className="font-mono text-indigo-300">{jurors.length} Jury Pool</span>
          </div>
        </div>

        {/* Sync Status Badge & Action Controls */}
        <div className="flex items-center space-x-1.5 sm:space-x-3">
          <div className="flex items-center space-x-1.5 px-2 sm:px-3 py-1 bg-slate-800/80 border border-slate-700/80 rounded-lg text-[11px] sm:text-xs font-mono">
            <span
              className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${
                syncStatus === 'connected_p2p'
                  ? 'bg-emerald-400 animate-pulse'
                  : syncStatus === 'connected_relay'
                  ? 'bg-amber-400'
                  : 'bg-slate-500'
              }`}
            />
            <span className="text-slate-300">
              {syncStatus === 'connected_p2p'
                ? `Direct`
                : syncStatus === 'connected_relay'
                ? `Relay`
                : 'Offline'}
            </span>
          </div>

          {/* Contrast Mode Toggle */}
          {/* <button
            onClick={() => setHighContrastLight(!highContrastLight)}
            title="Toggle High-Contrast Light Mode"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 transition-colors"
          >
            {highContrastLight ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-400" />}
          </button> */}

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            title="Toggle Fullscreen"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Disconnect Button */}
          <button
            onClick={() => {
              if (confirm('Disconnect this viewer session and return to table console?')) {
                disconnectSync();
              }
            }}
            title="Disconnect viewer session"
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 text-xs font-semibold transition-colors"
          >
            <Unlink className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden sm:inline">Disconnect</span>
          </button>
        </div>
      </header>

      {/* Real-time Second Chair Prompter / Whisper Alert Banner (Absolute Overlay) */}
      {activeWhisper && !activeWhisper.dismissed && (
        <div className="absolute top-16 left-4 right-4 md:left-8 md:right-8 z-40 max-w-4xl mx-auto px-6 py-4 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-slate-950 shadow-2xl rounded-2xl flex items-start sm:items-center justify-between gap-4 border-2 border-amber-300 animate-in slide-in-from-top-4 duration-200">
          <div className="flex items-start sm:items-center space-x-3.5 flex-1 min-w-0">
            <div className="p-2.5 bg-slate-950/20 rounded-xl flex-shrink-0 mt-0.5 sm:mt-0">
              <MessageSquare className="w-6 h-6 text-slate-950 font-bold" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-black uppercase tracking-wider text-slate-900/80">
                Message from Second Chair
              </div>
              <div className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-950 break-words whitespace-normal leading-snug">
                {activeWhisper.text}
              </div>
            </div>
          </div>

          <button
            onClick={() => dismissWhisper(activeWhisper.id)}
            className="px-4 py-2 bg-slate-950 hover:bg-slate-900 text-amber-300 font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 flex-shrink-0"
          >
            <span>Dismiss</span>
            <span className="font-mono text-[10px] opacity-70 bg-slate-800 px-1.5 py-0.5 rounded hidden sm:inline">
              Space
            </span>
          </button>
        </div>
      )}

      {/* Active Group Question Banner */}
      {activeQuestion && (
        <div className="px-6 py-2.5 bg-indigo-950/40 border-b border-indigo-500/30 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="px-2.5 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 rounded-lg text-xs font-mono font-bold">
              Q{activeQuestion.order || 1}
            </span>
            <span className="text-base font-bold text-slate-100">
              {activeQuestion.text}
            </span>
          </div>

          <div className="flex items-center space-x-2 px-3 py-1 bg-amber-500/20 border border-amber-400/50 rounded-xl text-amber-200 text-sm font-bold animate-pulse">
            <Hand className="w-4 h-4 fill-amber-300 text-amber-950" />
            <span>{totalRaisedHands} Raised Hands</span>
          </div>
        </div>
      )}

      {/* Main Jury Pool Gallery Canvas */}
      <main className="flex-1 overflow-y-auto p-2 sm:p-4 md:p-6 space-y-2.5 sm:space-y-3.5 md:space-y-5">
        {/* Gallery Rows with optional aisle */}
        <div className="space-y-2 sm:space-y-2.5 md:space-y-4">
          {rowsData.map((row) => (
            <div key={row.rowNumber} className="space-y-1">

              <div className="flex items-stretch gap-1 sm:gap-2 md:gap-3 overflow-x-auto pb-1">
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
                          className="flex-1 grid gap-1 sm:gap-1.5 md:gap-3 min-w-0 md:min-w-[280px]"
                          style={{
                            gridTemplateColumns: isMobile
                              ? `repeat(${bankWidth}, minmax(0, 1fr))`
                              : `repeat(${bankWidth}, minmax(130px, 1fr))`
                          }}
                        >
                          {bankJurors.map((juror, cIdx) => {
                            if (!juror) {
                              return (
                                <div
                                  key={`empty-${cIdx}`}
                                  className="min-h-[46px] sm:min-h-[54px] md:min-h-[160px] border border-dashed border-slate-850 rounded-xl md:rounded-2xl bg-slate-950/20"
                                />
                              );
                            }

                            const seatLabel = juror.seatNumber !== undefined
                              ? (juror.isAlternate ? `Alt ${juror.seatNumber}` : `Seat ${juror.seatNumber}`)
                              : `Pool`;

                            return (
                              <PodiumJurorCard
                                key={juror.id}
                                juror={juror}
                                seatLabel={seatLabel}
                                isAlternate={juror.isAlternate}
                                activeQuestionId={activeQuestionId}
                                onSelect={() => setSpotlightJurorId(juror.id)}
                                isSelected={spotlightJurorId === juror.id}
                              />
                            );
                          })}
                        </div>

                        {/* Center Walkway Aisle */}
                        {!isLastBank && (
                          <div className="flex flex-col items-center justify-center px-0.5 sm:px-1 md:px-2 select-none shrink-0">
                            <div className="h-full border-r border-dashed border-slate-700/60 md:border-r-2 md:border-slate-700/50" />
                            <span className="hidden md:inline text-[9px] font-mono tracking-widest text-slate-500 uppercase rotate-90 my-2">
                              Aisle
                            </span>
                            <div className="h-full border-r border-dashed border-slate-700/60 md:border-r-2 md:border-slate-700/50" />
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
      </main>

      {/* Hot-Seat Spotlight Dossier Modal */}
      {spotlightJuror && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-end">
          <div className="bg-slate-900 border-l border-slate-750 w-full max-w-lg h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
              <div className="flex items-center gap-3">
                <div className="font-mono text-3xl font-black text-indigo-400 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
                  #{spotlightJuror.jurorNumber}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-100">
                    {spotlightJuror.fullName}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {spotlightJuror.seatNumber !== undefined
                      ? (spotlightJuror.isAlternate ? `Alternate ${spotlightJuror.seatNumber}` : `Panel Seat ${spotlightJuror.seatNumber}`)
                      : 'Jury Pool'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSpotlightJurorId(null)}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Demographics Card */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-indigo-400" />
                  Juror Background
                </h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block">Occupation:</span>
                    <span className="font-semibold text-slate-200">{spotlightJuror.occupation || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Employer:</span>
                    <span className="font-semibold text-slate-200">{spotlightJuror.employer || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Age / Gender:</span>
                    <span className="font-semibold text-slate-200">
                      {spotlightJuror.age || '—'} / {spotlightJuror.gender || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Location:</span>
                    <span className="font-semibold text-slate-200">
                      {spotlightJuror.cityOrZip || spotlightJuror.cityState || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Education:</span>
                    <span className="font-semibold text-slate-200">{spotlightJuror.education || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Prior Jury Service:</span>
                    <span className="font-semibold text-slate-200">{spotlightJuror.priorJuryService || 'None'}</span>
                  </div>
                </div>
              </div>

              {/* Second Chair Notes */}
              {spotlightJuror.notes && (
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-amber-400" />
                    Second Chair Tactical Notes
                  </h3>
                  <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                    {spotlightJuror.notes}
                  </p>
                </div>
              )}

              {/* Group Question Response History */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Hand className="w-4 h-4 text-emerald-400" />
                  Question Hand-Raise Responses
                </h3>
                <div className="space-y-2">
                  {questions.map(q => {
                    const resp = spotlightJuror.responses?.[q.id];
                    const isYes = !!resp?.answeredYes;
                    return (
                      <div
                        key={q.id}
                        className={`p-3 rounded-lg border text-xs flex items-start justify-between gap-3 ${
                          isYes
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-200 font-medium'
                            : 'bg-slate-900 border-slate-800 text-slate-400'
                        }`}
                      >
                        <div>
                          <span className="font-bold text-slate-300 block mb-0.5">
                            Q{q.order}: {q.text}
                          </span>
                          {resp?.note && (
                            <span className="text-xs text-amber-300 italic block mt-1">
                              Note: {resp.note}
                            </span>
                          )}
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            isYes ? 'bg-amber-400 text-slate-950 font-black' : 'bg-slate-800 text-slate-500'
                          }`}
                        >
                          {isYes ? 'YES' : 'NO'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950 text-right">
              <button
                onClick={() => setSpotlightJurorId(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold rounded-lg transition-colors"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
