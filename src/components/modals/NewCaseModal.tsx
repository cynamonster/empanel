import React, { useState } from 'react';
import { useCase } from '../../context/CaseContext';
import { Plus, Scale, Shield, Check } from 'lucide-react';

interface NewCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NewCaseModal: React.FC<NewCaseModalProps> = ({ isOpen, onClose }) => {
  const { createNewCase } = useCase();
  const [caseType, setCaseType] = useState<'civil' | 'criminal'>('criminal');
  const [name, setName] = useState('');

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createNewCase(caseType, name.trim() || undefined);
    setName('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 text-slate-100"
      onClick={onClose}
    >
      <form
        onSubmit={handleCreate}
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <Plus className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-bold text-white">Create New Trial Case</h3>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-200">
            ✕
          </button>
        </div>

        {/* Case Type Presets */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300 block">
            Select Trial Type Preset:
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setCaseType('civil')}
              className={`p-3 rounded-xl border text-left transition-colors ${
                caseType === 'civil'
                  ? 'bg-indigo-950/80 border-indigo-500 text-indigo-200'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center space-x-1.5 font-bold text-sm text-white mb-1">
                <Scale className="w-4 h-4 text-indigo-400" />
                <span>Civil Trial</span>
              </div>
              <p className="text-[11px] text-slate-400">
                3 peremptory strikes per side (standard state/federal civil rules)
              </p>
            </button>

            <button
              type="button"
              onClick={() => setCaseType('criminal')}
              className={`p-3 rounded-xl border text-left transition-colors ${
                caseType === 'criminal'
                  ? 'bg-indigo-950/80 border-indigo-500 text-indigo-200'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center space-x-1.5 font-bold text-sm text-white mb-1">
                <Shield className="w-4 h-4 text-indigo-400" />
                <span>Criminal Trial</span>
              </div>
              <p className="text-[11px] text-slate-400">
                6 peremptory strikes per side (standard felony/misdemeanor rules)
              </p>
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-300 block mb-1">
            Case Title / Caption:
          </label>
          <input
            type="text"
            placeholder={caseType === 'civil' ? 'e.g. Miller v. Apex Logistics Corp.' : 'e.g. State v. Marcus Hayes'}
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 text-slate-300 rounded-xl text-xs"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs flex items-center space-x-1"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Create Case</span>
          </button>
        </div>
      </form>
    </div>
  );
};
