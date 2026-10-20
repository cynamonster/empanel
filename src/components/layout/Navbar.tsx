import React, { useState } from 'react';
import { useCase } from '../../context/CaseContext';
import {
  Scale,
  Users,
  Grid,
  UserPlus,
  Upload,
  Hand,
  Gavel,
  Download,
  Settings,
  Plus,
  ChevronDown,
  FileSpreadsheet,
  FileJson,
  Sparkles,
  Undo2,
  Redo2
} from 'lucide-react';
import { exportJurorsToCSV, exportCaseBackupJSON } from '../../utils/exportUtils';
import { Tooltip } from '../common/Tooltip';

interface NavbarProps {
  onOpenIntake: () => void;
  onOpenStrikeConsole: () => void;
  onOpenSettings: () => void;
  onOpenNewCase: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenIntake,
  onOpenStrikeConsole,
  onOpenSettings,
  onOpenNewCase,
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
    loadDemoCase,
    canUndo,
    canRedo,
    undo,
    redo,
  } = useCase();

  const [showCaseMenu, setShowCaseMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Peremptory strikes stats
  const plaintiffStrikesUsed = peremptoryStrikes.filter(s => s.side === 'plaintiff_prosecution').length;
  const defenseStrikesUsed = peremptoryStrikes.filter(s => s.side === 'defense').length;
  const pRemaining = Math.max(0, (activeCase?.plaintiffStrikesAllowed || 3) - plaintiffStrikesUsed);
  const dRemaining = Math.max(0, (activeCase?.defenseStrikesAllowed || 3) - defenseStrikesUsed);

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-100 px-4 py-2.5 flex items-center justify-between shadow-md relative z-30">
      {/* Brand & Case Selector */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2 text-indigo-400 font-bold tracking-tight text-lg">
          <div className="p-1.5 bg-indigo-500/20 border border-indigo-500/30 rounded-lg">
            <Scale className="w-5 h-5 text-indigo-400" />
          </div>
          <span className="hidden sm:inline bg-gradient-to-r from-indigo-300 to-indigo-100 bg-clip-text text-transparent">
            VOIR DIRE
          </span>
        </div>

        {/* Case Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowCaseMenu(!showCaseMenu)}
            className="flex items-center space-x-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg text-sm font-medium transition-colors"
          >
            <span className="truncate max-w-[30rem] text-slate-200">
              {activeCase?.name || 'Select Case'}
            </span>
            <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
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
      <div className="flex items-center space-x-2 md:space-x-3">
        {/* Undo & Redo History Controls */}
        <div className="flex items-center space-x-0.5 bg-slate-800 p-0.5 rounded-lg border border-slate-700">
          <Tooltip content="Undo (Ctrl+Z / ⌘Z)" side="bottom">
            <button
              disabled={!canUndo}
              onClick={() => undo()}
              className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-300 transition-colors"
              title="Undo (Ctrl+Z / ⌘Z)"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
          <Tooltip content="Redo (Ctrl+Shift+Z / ⌘⇧Z)" side="bottom">
            <button
              disabled={!canRedo}
              onClick={() => redo()}
              className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-300 transition-colors"
              title="Redo (Ctrl+Shift+Z / ⌘⇧Z)"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
        </div>

        {/* Live Strike Tally Badge */}
        <Tooltip content="Open Strategic Strike Console" side="bottom">
          <button
            onClick={onOpenStrikeConsole}
            className="flex items-center space-x-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg text-xs transition-colors"
            title="Open Strategic Strike Console"
          >
            <Gavel className="w-3.5 h-3.5 text-amber-400" />
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-slate-300 hidden md:inline">Strikes:</span>
              <span
                className="text-rose-400 font-mono font-medium"
                title={`${activeCase?.caseType === 'criminal' ? 'Prosecution' : 'Plaintiff'} Remaining`}
              >
                {activeCase?.caseType === 'criminal' ? 'Pros' : 'P'}: {pRemaining}/{activeCase?.plaintiffStrikesAllowed || 3}
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-blue-400 font-mono font-medium" title="Defense Remaining">
                D: {dRemaining}/{activeCase?.defenseStrikesAllowed || 3}
              </span>
            </div>
          </button>
        </Tooltip>

        {/* Group Question Mode Toggle */}
        <button
          onClick={() => {
            if (activeQuestionId) {
              setActiveQuestionId(null);
            } else if (questions.length > 0) {
              setActiveQuestionId(questions[0].id);
            } else {
              setActiveQuestionId('new');
            }
          }}
          className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            activeQuestionId
              ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 ring-2 ring-amber-500/30 animate-pulse'
              : 'bg-slate-800 hover:bg-slate-750 border-slate-700 text-slate-300'
          }`}
          title="Toggle Group Question Hand-Raise Logger"
        >
          <Hand className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">
            {activeQuestionId ? 'Logging Active' : 'Question Logger'}
          </span>
        </button>

        {/* Roster Intake Button */}
        <button
          onClick={onOpenIntake}
          className="flex items-center space-x-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg text-xs text-slate-300 transition-colors"
          title="Import Juror Roster"
        >
          <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden sm:inline">Add Jurors</span>
        </button>

        {/* Export Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg text-xs text-slate-300 transition-colors"
            title="Export / Backup"
          >
            <Download className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Export</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {showExportMenu && (
            <div
              className="absolute right-0 mt-2 w-52 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-1.5 z-50 divide-y divide-slate-800"
              onMouseLeave={() => setShowExportMenu(false)}
            >
              <button
                onClick={() => {
                  if (activeCase) exportJurorsToCSV(jurors, activeCase.name);
                  setShowExportMenu(false);
                }}
                className="w-full text-left px-3 py-2 text-xs flex items-center space-x-2 text-slate-300 hover:bg-slate-800"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>Export Jurors as CSV</span>
              </button>
              <button
                onClick={() => {
                  if (activeCase) {
                    exportCaseBackupJSON(
                      activeCase,
                      jurors,
                      questions,
                      causeChallenges,
                      peremptoryStrikes
                    );
                  }
                  setShowExportMenu(false);
                }}
                className="w-full text-left px-3 py-2 text-xs flex items-center space-x-2 text-slate-300 hover:bg-slate-800"
              >
                <FileJson className="w-4 h-4 text-indigo-400" />
                <span>Download Full JSON Backup</span>
              </button>
            </div>
          )}
        </div>

        {/* 1-Click Demo Mode Button */}
        <button
          onClick={async () => {
            await loadDemoCase();
          }}
          className="flex items-center space-x-1.5 px-2.5 py-1.5 bg-gradient-to-r from-amber-500/20 to-indigo-500/20 hover:from-amber-500/30 hover:to-indigo-500/30 border border-amber-500/40 hover:border-amber-400 text-amber-200 rounded-lg text-xs font-semibold shadow-sm transition-all"
          title="Load pre-configured 6-juror criminal demo trial (32 pool jurors, questions, strikes, and cause challenge)"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">Demo Trial</span>
        </button>

        {/* Case Settings Button */}
        <button
          onClick={onOpenSettings}
          className="p-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
          title="Case & Layout Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
