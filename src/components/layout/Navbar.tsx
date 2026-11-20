import React, { useState, useRef, useEffect } from 'react';
import { useCase } from '../../context/CaseContext';
import {
  Scale,
  Users,
  Grid,
  UserPlus,
  Upload,
  Hand,
  Gavel,
  Settings,
  Plus,
  ChevronDown,
  Sparkles,
  Undo2,
  Redo2,
  Radio,
  Maximize2,
  HelpCircle,
  Home
} from 'lucide-react';

interface NavbarProps {
  onOpenIntake: () => void;
  onOpenStrikeConsole?: () => void;
  onOpenSettings: () => void;
  onOpenNewCase: () => void;
  onOpenPairModal: (tab?: 'host' | 'viewer') => void;
  onReturnToLanding?: () => void;
  onOpenTutorial?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenIntake,
  onOpenStrikeConsole,
  onOpenSettings,
  onOpenNewCase,
  onOpenPairModal,
  onReturnToLanding,
  onOpenTutorial,
}) => {
  const {
    cases,
    activeCase,
    switchCase,
    updateActiveCase,
    jurors,
    questions,
    causeChallenges,
    peremptoryStrikes,
    activeQuestionId,
    setActiveQuestionId,
    toggleQuestionLogger,
    loadDemoCase,
    canUndo,
    canRedo,
    undo,
    redo,
    syncStatus,
    syncRole,
    connectedPeers,
    changeSyncRole,
    syncLatency,
    lastSyncActivity,
  } = useCase();

  const [showCaseMenu, setShowCaseMenu] = useState(false);
  const [isSyncPulsing, setIsSyncPulsing] = useState(false);
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!lastSyncActivity) return;
    setIsSyncPulsing(true);
    if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    pulseTimerRef.current = setTimeout(() => {
      setIsSyncPulsing(false);
    }, 1300);
    return () => {
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    };
  }, [lastSyncActivity]);

  // Peremptory strikes stats (supports soft cap and court-granted supplemental strikes)
  const plaintiffStrikesUsed = peremptoryStrikes.filter(s => s.side === 'plaintiff_prosecution').length;
  const defenseStrikesUsed = peremptoryStrikes.filter(s => s.side === 'defense').length;
  const pAllowed = activeCase?.plaintiffStrikesAllowed || 3;
  const dAllowed = activeCase?.defenseStrikesAllowed || 3;
  const pRemaining = pAllowed - plaintiffStrikesUsed;
  const dRemaining = dAllowed - defenseStrikesUsed;

  return (
    <header data-navbar="true" className="bg-slate-900 border-b border-slate-800 text-slate-100 px-2 sm:px-4 py-2.5 flex items-center justify-between shadow-md relative z-30">
      {/* Brand & Case Selector */}
      <div className="flex items-center space-x-2 sm:space-x-4 flex-shrink-0">
        <button
          onClick={onReturnToLanding}
          className="flex items-center space-x-2 text-indigo-400 font-bold tracking-tight text-lg hover:opacity-85 transition-opacity"
          title="Return to Empanel Landing Page"
        >
          <div className="p-1.5 bg-indigo-500/20 border border-indigo-500/30 rounded-lg">
            <Scale className="w-5 h-5 text-indigo-400" />
          </div>
          <span className="hidden sm:inline bg-gradient-to-r from-indigo-300 to-indigo-100 bg-clip-text text-transparent">
            EMPANEL
          </span>
        </button>

        {/* Case Dropdown (Hidden on mobile screen sizes) */}
        <div className="relative hidden sm:block">
          <button
            onClick={() => {
              if (syncRole !== 'second_chair') {
                setShowCaseMenu(!showCaseMenu);
              }
            }}
            disabled={syncRole === 'second_chair'}
            className="flex items-center space-x-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg text-sm font-medium transition-colors disabled:cursor-default"
            title={syncRole === 'second_chair' ? 'Shared courtroom trial (Active case controlled by host)' : 'Select or switch court case'}
          >
            <span className="truncate max-w-[30rem] text-slate-200">
              {activeCase?.name || 'Select Case'}
            </span>
            {syncRole === 'second_chair' ? (
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.5 rounded font-mono font-medium">
                Synced
              </span>
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
            )}
          </button>

          {showCaseMenu && (
            <div
              className="absolute left-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-2 z-50 divide-y divide-slate-800"
              onMouseLeave={() => setShowCaseMenu(false)}
            >
              <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Court Cases
              </div>
              <div className="max-h-60 overflow-y-auto py-1">
                {cases.map(c => (
                  <button
                    key={c.id}
                    onClick={() => {
                      switchCase(c.id);
                      setShowCaseMenu(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-slate-800 transition-colors ${
                      c.id === activeCase?.id ? 'bg-indigo-950/60 text-indigo-300 font-semibold border-l-2 border-indigo-500' : 'text-slate-300'
                    }`}
                  >
                    <span className="truncate">{c.name}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400 uppercase">
                      {c.caseType}
                    </span>
                  </button>
                ))}
              </div>
              <div className="pt-1.5 px-2 space-y-1">
                <button
                  onClick={() => {
                    setShowCaseMenu(false);
                    onOpenNewCase();
                  }}
                  className="w-full flex items-center justify-center space-x-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-medium text-white transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create New Case</span>
                </button>

                <button
                  onClick={async () => {
                    setShowCaseMenu(false);
                    await loadDemoCase();
                  }}
                  className="w-full flex items-center justify-center space-x-1.5 px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 text-amber-200 rounded-lg text-xs font-medium transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Load Demo Case (6-Juror Criminal)</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Center/Right Action Toolbar */}
      <div className="flex items-center space-x-1 sm:space-x-2 md:space-x-3 overflow-x-auto min-w-0">
        {/* Undo & Redo History Controls */}
        <div className="flex items-center space-x-0.5 bg-slate-800 p-0.5 rounded-lg border border-slate-700 flex-shrink-0">
          <button
            disabled={!canUndo}
            onClick={() => undo()}
            className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-300 transition-colors"
            title="Undo (Ctrl+Z / ⌘Z)"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            disabled={!canRedo}
            onClick={() => redo()}
            className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-300 transition-colors"
            title="Redo (Ctrl+Shift+Z / ⌘⇧Z)"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Live Strike Tally Badge (Non-clickable indicator) */}
        <div
          data-tour="strike-console-btn"
          className="flex items-center space-x-1.5 sm:space-x-2 px-2 sm:px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs flex-shrink-0 cursor-default select-none"
          title="Peremptory Strikes Remaining (Prosecution / Defense)"
        >
            <Gavel className="w-3.5 h-3.5 text-amber-400" />
            <div className="flex items-center space-x-1.5 sm:space-x-2">
              <span className="font-semibold text-slate-300 hidden md:inline">Strikes:</span>
              {pRemaining < 0 ? (
                <span
                  className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded font-mono font-bold text-[11px]"
                  title={`${activeCase?.caseType === 'criminal' ? 'Prosecution' : 'Plaintiff'}: Extra (+${Math.abs(pRemaining)}) strikes granted by court`}
                >
                  {activeCase?.caseType === 'criminal' ? 'Pros' : 'P'}: Extra (+{Math.abs(pRemaining)})
                </span>
              ) : (
                <span
                  className={`font-mono font-medium ${pRemaining === 0 ? 'text-amber-400 font-semibold' : 'text-rose-400'}`}
                  title={`${activeCase?.caseType === 'criminal' ? 'Prosecution' : 'Plaintiff'} Remaining: ${pRemaining} of ${pAllowed}${pRemaining === 0 ? ' (0 remaining, next is excess)' : ''}`}
                >
                  {activeCase?.caseType === 'criminal' ? 'Pros' : 'P'}: {pRemaining}/{pAllowed}
                </span>
              )}
              <span className="text-slate-600">|</span>
              {dRemaining < 0 ? (
                <span
                  className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded font-mono font-bold text-[11px]"
                  title={`Defense: Extra (+${Math.abs(dRemaining)}) strikes granted by court`}
                >
                  Def: Extra (+{Math.abs(dRemaining)})
                </span>
              ) : (
                <span
                  className={`font-mono font-medium ${dRemaining === 0 ? 'text-amber-400 font-semibold' : 'text-blue-400'}`}
                  title={`Defense Remaining: ${dRemaining} of ${dAllowed}${dRemaining === 0 ? ' (0 remaining, next is excess)' : ''}`}
                >
                  Def: {dRemaining}/{dAllowed}
                </span>
              )}
            </div>
          </div>

        {/* Group Question Mode Toggle */}
        <button
          data-tour="question-logger-btn"
          onClick={toggleQuestionLogger}
          className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors flex-shrink-0 ${
            activeQuestionId
              ? 'bg-amber-500/20 border-amber-500/50 hover:text-amber-200 text-amber-300 ring-2 ring-amber-500/30 animate-pulse'
              : 'bg-slate-800 hover:bg-slate-750 border-slate-700 hover:text-slate-200 text-slate-300'
          }`}
          title="Toggle Group Question Mode"
        >
          <Hand className="w-3.5 h-3.5" />
          {/* <span className="hidden sm:inline">
            Question
          </span> */}
        </button>

        {/* E2EE Sync Status / Pair Button */}
        {syncStatus === 'reconnecting' ? (
          <button
            onClick={() => onOpenPairModal()}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs border border-amber-500/50 bg-amber-500/20 text-amber-300 transition-colors flex-shrink-0"
            title="Connection interrupted - attempting to reconnect automatically"
          >
            <Radio className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span className="font-mono text-xs font-semibold">Reconnecting...</span>
          </button>
        ) : syncStatus === 'connected_p2p' || syncStatus === 'connected_relay' ? (
          <div className="flex items-center space-x-1.5 flex-shrink-0">
            <button
              onClick={() => onOpenPairModal()}
              className={`relative overflow-hidden flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-colors ${
                syncRole === 'second_chair'
                  ? 'border-indigo-500/50 bg-indigo-500/20 text-indigo-300'
                  : 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300'
              }`}
              title={
                syncRole === 'second_chair'
                  ? 'Connected as Second Chair (Click to manage)'
                  : `Host Active (${connectedPeers.length > 1 ? `${connectedPeers.length - 1} peers connected` : 'Waiting for peers'})`
              }
            >
              {/* Gentle circling border glow on edits */}
              {isSyncPulsing && (
                <div
                  className="pointer-events-none absolute -inset-[150%] animate-border-sweep"
                  style={{
                    background: `conic-gradient(from 0deg, transparent 0deg, transparent 270deg, ${
                      syncRole === 'second_chair' ? 'rgba(129, 140, 248, 0.95)' : 'rgba(52, 211, 153, 0.95)'
                    } 360deg)`,
                  }}
                />
              )}
              {/* Inner backing so content is sharp above the rotating beam while the beam sweeps the border */}
              <div
                className={`absolute inset-[1px] rounded-[7px] pointer-events-none ${
                  syncRole === 'second_chair' ? 'bg-slate-900/90' : 'bg-slate-900/90'
                }`}
              />

              <Radio
                className={`relative z-10 w-3.5 h-3.5 ${
                  syncRole === 'second_chair' ? 'text-indigo-400' : 'text-emerald-400'
                } animate-pulse`}
              />
              <span className="relative z-10 font-mono text-xs font-semibold">
                {syncRole === 'second_chair'
                  ? '2nd Chair'
                  : connectedPeers.length > 1
                  ? `${connectedPeers.length - 1} Linked`
                  : 'Host'}
              </span>
            </button>

            {/* If Second Chair, allow quick toggle to Podium View */}
            {syncRole === 'second_chair' && (
              <button
                onClick={() => changeSyncRole('podium')}
                className="flex items-center space-x-1 px-2 py-1.5 rounded-lg text-xs bg-slate-800 hover:bg-slate-750 border border-slate-700 text-amber-300 hover:text-amber-200 transition-colors"
                title="Switch to First Chair (Podium View)"
              >
                <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden md:inline text-xs font-medium">Podium</span>
              </button>
            )}
          </div>
        ) : (
          <button
            data-tour="pair-btn"
            onClick={() => onOpenPairModal()}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:text-slate-300 text-slate-400 transition-colors flex-shrink-0"
            title="E2EE Linking / Sync"
          >
            <Radio className="w-3.5 h-3.5" />
            {/* <span>Pair</span> */}
          </button>
        )}

        {/* Roster Intake Button */}
        <button
          data-tour="intake-btn"
          onClick={onOpenIntake}
          className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all flex-shrink-0 ${
            jurors.length === 0
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white font-bold border border-emerald-400 ring-2 ring-emerald-400/50 shadow-lg shadow-emerald-900/40 animate-pulse'
              : 'bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300'
          }`}
          title="Import Juror Roster"
        >
          <UserPlus className={`w-3.5 h-3.5 ${jurors.length === 0 ? 'text-white' : 'text-emerald-400'}`} />
          {/* <span className="hidden sm:inline">Add Jurors</span> */}
        </button>

        {/* Interactive Tour / Tutorial Button */}
        {onOpenTutorial && (
          <button
            data-tour="tutorial-btn"
            onClick={onOpenTutorial}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-indigo-400 hover:text-indigo-300 rounded-lg text-xs font-medium transition-all flex-shrink-0"
            title="Interactive Courtroom Tour & Tutorial"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            {/* <span className="hidden md:inline">Tutorial</span> */}
          </button>
        )}

        {/* Case Settings Button */}
        <button
          onClick={onOpenSettings}
          className="p-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg text-slate-400 hover:text-slate-200 transition-colors flex-shrink-0"
          title="Case & Layout Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
