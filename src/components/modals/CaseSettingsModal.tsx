import React, { useState } from 'react';
import { useCase } from '../../context/CaseContext';
import { Settings, Trash2, Check, Scale } from 'lucide-react';

interface CaseSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CaseSettingsModal: React.FC<CaseSettingsModalProps> = ({ isOpen, onClose }) => {
  const { activeCase, updateActiveCase, deleteCase } = useCase();

  if (!isOpen || !activeCase) return null;

  const [name, setName] = useState(activeCase.name);
  const [caseNumber, setCaseNumber] = useState(activeCase.caseNumber || '');
  const [court, setCourt] = useState(activeCase.court || '');
  const [judge, setJudge] = useState(activeCase.judge || '');
  const [caseType, setCaseType] = useState(activeCase.caseType);
  const [ourSide, setOurSide] = useState(activeCase.ourSide);
  const [plaintiffStrikes, setPlaintiffStrikes] = useState(activeCase.plaintiffStrikesAllowed);
  const [defenseStrikes, setDefenseStrikes] = useState(activeCase.defenseStrikesAllowed);
  const [boxSize, setBoxSize] = useState(activeCase.boxSize);
  const [alternateCount, setAlternateCount] = useState(activeCase.alternateCount);
  const [gridCols, setGridCols] = useState(activeCase.gridCols);
  const [galleryGutters, setGalleryGutters] = useState(activeCase.galleryGutters || '1');
  const [galleryOrigin, setGalleryOrigin] = useState(activeCase.galleryOrigin || 'bottom-left');

  const applyPreset = (type: 'civil' | 'criminal') => {
    setCaseType(type);
    if (type === 'civil') {
      setPlaintiffStrikes(3);
      setDefenseStrikes(3);
      setOurSide('plaintiff_prosecution');
    } else {
      setPlaintiffStrikes(6);
      setDefenseStrikes(6);
      setOurSide('defense');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateActiveCase({
      name,
      caseNumber: caseNumber.trim() || undefined,
      court: court.trim() || undefined,
      judge: judge.trim() || undefined,
      caseType,
      ourSide,
      plaintiffStrikesAllowed: plaintiffStrikes,
      defenseStrikesAllowed: defenseStrikes,
      boxSize,
      alternateCount,
      gridCols,
      galleryGutters,
      galleryOrigin,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 text-slate-100"
      onClick={onClose}
    >
      <form
        onSubmit={handleSave}
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <Settings className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-bold text-white">Case & Voir Dire Settings</h3>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-200">
            ✕
          </button>
        </div>

        {/* Presets */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
            Rule Presets
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => applyPreset('civil')}
              className={`p-2.5 rounded-xl border text-left transition-colors ${
                caseType === 'civil'
                  ? 'bg-indigo-950/70 border-indigo-500 text-indigo-200'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="font-bold text-xs text-white">Civil Trial Preset</div>
              <div className="text-[10px] text-slate-400">3 Peremptory Strikes / Side</div>
            </button>
            <button
              type="button"
              onClick={() => applyPreset('criminal')}
              className={`p-2.5 rounded-xl border text-left transition-colors ${
                caseType === 'criminal'
                  ? 'bg-indigo-950/70 border-indigo-500 text-indigo-200'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="font-bold text-xs text-white">Criminal Trial Preset</div>
              <div className="text-[10px] text-slate-400">6 Peremptory Strikes / Side</div>
            </button>
          </div>
        </div>

        {/* Case Details */}
        <div className="space-y-2.5">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Case Caption / Trial Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Cause / Docket Number</label>
              <input
                type="text"
                placeholder="e.g. 24-CV-1092"
                value={caseNumber}
                onChange={e => setCaseNumber(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Presiding Judge</label>
              <input
                type="text"
                placeholder="e.g. Hon. Sarah Miller"
                value={judge}
                onChange={e => setJudge(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Representing</label>
            <select
              value={ourSide}
              onChange={e => setOurSide(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 outline-none"
            >
              <option value="plaintiff_prosecution">Plaintiff / Prosecution</option>
              <option value="defense">Defense</option>
            </select>
          </div>
        </div>

        {/* Strike Rules */}
        <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
            Peremptory Strike Allowances
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[10px] text-slate-400 block mb-1">Plaintiff / Prosecution Strikes</span>
              <input
                type="number"
                min={1}
                max={30}
                value={plaintiffStrikes}
                onChange={e => setPlaintiffStrikes(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 outline-none font-mono"
              />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block mb-1">Defense Strikes</span>
              <input
                type="number"
                min={1}
                max={30}
                value={defenseStrikes}
                onChange={e => setDefenseStrikes(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 outline-none font-mono"
              />
            </div>
          </div>
        </div>

        {/* Layout Dimensions */}
        <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
            Courtroom Seating Configuration
          </label>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <span className="text-[10px] text-slate-400 block mb-1">Prospective Panel Size</span>
              <select
                value={boxSize}
                onChange={e => setBoxSize(parseInt(e.target.value, 10))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-100 outline-none"
              >
                <option value={6}>6 Jurors</option>
                <option value={8}>8 Jurors</option>
                <option value={12}>12 Jurors</option>
                <option value={14}>14 Jurors</option>
              </select>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block mb-1">Alternates</span>
              <select
                value={alternateCount}
                onChange={e => setAlternateCount(parseInt(e.target.value, 10))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-100 outline-none"
              >
                <option value={0}>0 Alternates</option>
                <option value={1}>1 Alternate</option>
                <option value={2}>2 Alternates</option>
                <option value={3}>3 Alternates</option>
                <option value={4}>4 Alternates</option>
              </select>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block mb-1">Grid Columns</span>
              <select
                value={gridCols}
                onChange={e => setGridCols(parseInt(e.target.value, 10))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-100 outline-none"
              >
                <option value={6}>6 Columns</option>
                <option value={8}>8 Columns</option>
                <option value={10}>10 Columns</option>
                <option value={12}>12 Columns</option>
              </select>
            </div>
            <div className="col-span-2">
              <span className="text-[10px] text-slate-400 block mb-1">Venire Gallery Vertical Aisles</span>
              <select
                value={galleryGutters}
                onChange={e => setGalleryGutters(e.target.value as any)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-100 outline-none"
              >
                <option value="none">None (Continuous Bench)</option>
                <option value="1">1 Central Aisle (2 Sections)</option>
              </select>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block mb-1">Seating Orientation</span>
              <select
                value={galleryOrigin}
                onChange={e => setGalleryOrigin(e.target.value as any)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-100 outline-none"
              >
                <option value="bottom-left">Juror #1 at Bottom-Left (Courtroom View)</option>
                <option value="top-left">Juror #1 at Top-Left</option>
              </select>
            </div>
          </div>
        </div>

        {/* Delete Case Option */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              if (confirm(`Are you sure you want to permanently delete "${activeCase.name}" and all associated juror data?`)) {
                deleteCase(activeCase.id);
                onClose();
              }
            }}
            className="text-xs text-rose-400 hover:text-rose-300 flex items-center space-x-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Case</span>
          </button>

          <div className="flex space-x-2">
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
              <span>Save Changes</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
