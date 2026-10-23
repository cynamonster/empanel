import React, { useState, useRef } from 'react';
import { useCase } from '../../context/CaseContext';
import { parseDelimitedText, mapRowsToJurors } from '../../utils/csvParser';
import { Upload, ClipboardList, Plus, FileText, Check, AlertCircle, Trash2 } from 'lucide-react';
import type { Juror } from '../../types';

interface IntakeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const IntakeModal: React.FC<IntakeModalProps> = ({ isOpen, onClose }) => {
  const { activeCase, addJurors } = useCase();
  const [activeTab, setActiveTab] = useState<'upload' | 'paste' | 'manual'>('upload');
  const [rawText, setRawText] = useState('');
  const [parsedPreview, setParsedPreview] = useState<Juror[]>([]);
  const [fileName, setFileName] = useState('');
  
  // Manual single add form state
  const [manualNumber, setManualNumber] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualOcc, setManualOcc] = useState('');
  const [manualAge, setManualAge] = useState('');
  const [manualGender, setManualGender] = useState('');
  const [manualCity, setManualCity] = useState('');

  const nameInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen || !activeCase) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        const matrix = parseDelimitedText(text);
        const mapped = mapRowsToJurors(matrix, activeCase.id);
        setParsedPreview(mapped);
      }
    };
    reader.readAsText(file);
  };

  const handleParsePastedText = () => {
    if (!rawText.trim()) return;
    const matrix = parseDelimitedText(rawText);
    const mapped = mapRowsToJurors(matrix, activeCase.id);
    setParsedPreview(mapped);
  };

  const handleManualAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualNumber.trim()) return;

    const newJuror: Juror = {
      id: `juror-${activeCase.id}-${manualNumber}-${Date.now()}`,
      caseId: activeCase.id,
      jurorNumber: manualNumber.trim(),
      fullName: manualName.trim() || `Juror #${manualNumber.trim()}`,
      occupation: manualOcc.trim() || undefined,
      age: manualAge.trim() || undefined,
      gender: manualGender.trim() || undefined,
      areaOfCounty: manualCity.trim() || undefined,
      cityState: manualCity.trim() || undefined,
      cityOrZip: manualCity.trim() || undefined,
      rating: 0,
      status: 'active',
      notes: '',
      responses: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setParsedPreview(prev => [newJuror, ...prev]);
    // Reset inputs
    const nextNum = parseInt(manualNumber, 10);
    setManualNumber(!isNaN(nextNum) ? String(nextNum + 1) : '');
    setManualName('');
    setManualOcc('');
    setManualAge('');
    setManualGender('');
    setManualCity('');

    // Reset focus to Full Name input for rapid entry
    setTimeout(() => {
      nameInputRef.current?.focus();
    }, 0);
  };

  const handleConfirmImport = async () => {
    if (parsedPreview.length === 0) return;
    await addJurors(parsedPreview);
    setParsedPreview([]);
    setRawText('');
    setFileName('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 text-slate-100"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl p-6 shadow-2xl flex flex-col max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <Upload className="w-5 h-5 text-indigo-400" />
              <span>Juror Roster Intake</span>
            </h3>
            <p className="text-xs text-slate-400">
              Import prospective juror venire data into <strong className="text-slate-200">{activeCase.name}</strong>
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 p-1">
            ✕
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex space-x-2 border-b border-slate-800 pt-3 pb-2 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-colors ${
              activeTab === 'upload' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>CSV / Excel Upload</span>
          </button>
          <button
            onClick={() => setActiveTab('paste')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-colors ${
              activeTab === 'paste' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            <span>Quick-Paste Text</span>
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-colors ${
              activeTab === 'manual' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Manual Entry</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="py-4 flex-1 overflow-y-auto space-y-4">
          {activeTab === 'upload' && (
            <div className="space-y-3">
              <div className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-xl p-8 text-center bg-slate-950/40 cursor-pointer relative group transition-colors">
                <input
                  type="file"
                  accept=".csv,.tsv,.txt"
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <Upload className="w-10 h-10 text-slate-500 group-hover:text-indigo-400 mx-auto mb-2 transition-colors" />
                <div className="text-sm font-semibold text-slate-200">
                  {fileName ? fileName : 'Choose CSV/TSV File or Drag & Drop'}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Supports court-provided rosters (Juror #, Name, Occupation, Age, Area of County)
                </div>
              </div>
            </div>
          )}

          {activeTab === 'paste' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                Paste rows directly from a spreadsheet, PDF, or court email (comma or tab separated):
              </p>
              <textarea
                rows={5}
                placeholder={"1\tJane Doe\tAccountant\t45\tNorth County\n2\tJohn Smith\tElectrician\t38\tSouth County"}
                value={rawText}
                onChange={e => setRawText(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 font-mono outline-none focus:border-indigo-500 resize-none"
              />
              <button
                type="button"
                onClick={handleParsePastedText}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-indigo-300 border border-slate-700 rounded-lg text-xs font-semibold"
              >
                Parse Pasted Roster
              </button>
            </div>
          )}

          {activeTab === 'manual' && (
            <form onSubmit={handleManualAdd} className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Quick-Add Juror
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Juror # *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 1"
                    value={manualNumber}
                    onChange={e => setManualNumber(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] text-slate-400 block mb-1">Full Name</label>
                  <input
                    ref={nameInputRef}
                    type="text"
                    placeholder="e.g. Eleanor Vance"
                    value={manualName}
                    onChange={e => setManualName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Occupation</label>
                  <input
                    type="text"
                    placeholder="e.g. Nurse"
                    value={manualOcc}
                    onChange={e => setManualOcc(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Age</label>
                  <input
                    type="text"
                    placeholder="e.g. 34"
                    value={manualAge}
                    onChange={e => setManualAge(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Gender</label>
                  <input
                    type="text"
                    placeholder="e.g. Female"
                    value={manualGender}
                    onChange={e => setManualGender(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-[10px] text-slate-400 block mb-1">Area of County</label>
                  <input
                    type="text"
                    placeholder="e.g. North County, East District"
                    value={manualCity}
                    onChange={e => setManualCity(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-xs"
                >
                  Add to Preview List
                </button>
              </div>
            </form>
          )}

          {/* Parsed Preview Table */}
          {parsedPreview.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-slate-300">
                  Ready to Import: <span className="text-emerald-400 font-mono">{parsedPreview.length} Jurors</span>
                </div>
                <button
                  onClick={() => setParsedPreview([])}
                  className="text-xs text-rose-400 hover:text-rose-300 flex items-center space-x-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear Preview</span>
                </button>
              </div>

              <div className="border border-slate-800 rounded-xl overflow-hidden max-h-52 overflow-y-auto bg-slate-950">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-slate-400 sticky top-0 border-b border-slate-800 text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="p-2">#</th>
                      <th className="p-2">Full Name</th>
                      <th className="p-2">Occupation</th>
                      <th className="p-2">Age/Gender</th>
                      <th className="p-2">Area of County</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {parsedPreview.map((p, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/50">
                        <td className="p-2 font-mono font-bold text-indigo-400">{p.jurorNumber}</td>
                        <td className="p-2 font-medium text-slate-200">{p.fullName}</td>
                        <td className="p-2 text-slate-400">{p.occupation || '—'}</td>
                        <td className="p-2 text-slate-400">{p.age || ''} {p.gender || ''}</td>
                        <td className="p-2 text-slate-400">{p.areaOfCounty || p.cityState || p.cityOrZip || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-slate-800 pt-4 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Jurors will be imported as active venirepersons in the pool.
          </div>
          <div className="flex space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl text-xs font-medium"
            >
              Cancel
            </button>
            <button
              disabled={parsedPreview.length === 0}
              onClick={handleConfirmImport}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs shadow-lg transition-colors flex items-center space-x-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Import {parsedPreview.length} Jurors</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
