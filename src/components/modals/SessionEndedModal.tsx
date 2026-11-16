import React from 'react';
import { useCase } from '../../context/CaseContext';
import { Unlink, Save, RotateCcw, AlertCircle } from 'lucide-react';

export const SessionEndedModal: React.FC = () => {
  const { sessionEndedPrompt, resolveSessionEnded, activeCase } = useCase();

  if (!sessionEndedPrompt) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-750 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col p-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
            <Unlink className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">Host Disconnected</h3>
            <p className="text-xs text-slate-400">Courtroom session ended</p>
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed mb-6">
          The host has disconnected or ended the shared trial session. All jurors, notes, and strikes from{' '}
          <strong className="text-indigo-300 font-semibold">{activeCase?.name || 'the shared trial'}</strong> are
          currently cached on this device.
        </p>

        <div className="flex flex-col gap-2.5">
          <button
            onClick={() => resolveSessionEnded(true)}
            className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md transition-all flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>Keep Synced Case (Save Locally)</span>
          </button>

          <button
            onClick={() => resolveSessionEnded(false)}
            className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4 text-slate-400" />
            <span>Revert to Previous Workspace</span>
          </button>
        </div>
      </div>
    </div>
  );
};
