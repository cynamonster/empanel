import React, { useState } from 'react';
import { useCase } from '../../context/CaseContext';
import { Hand, Plus, Trash2, CheckCircle2, ChevronRight, X } from 'lucide-react';

export const QuestionLoggerDrawer: React.FC = () => {
  const {
    activeCase,
    questions,
    jurors,
    activeQuestionId,
    setActiveQuestionId,
    addQuestion,
    deleteQuestion,
  } = useCase();

  const [newQuestionText, setNewQuestionText] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  if (!activeQuestionId) return null;

  const currentQuestion = questions.find(q => q.id === activeQuestionId);

  // Count how many jurors raised hand for current question
  const yesCount = currentQuestion
    ? jurors.filter(j => j.responses?.[currentQuestion.id]?.answeredYes).length
    : 0;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestionText.trim()) return;
    const created = await addQuestion(newQuestionText.trim());
    setActiveQuestionId(created.id);
    setNewQuestionText('');
    setShowAddForm(false);
  };

  return (
    <div className="bg-amber-950/70 border-b border-amber-500/40 text-amber-100 px-4 py-2.5 shadow-lg flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 relative z-20 backdrop-blur-md">
      {/* Left: Active Question Indicator & Instruction */}
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-amber-500 text-slate-950 rounded-xl font-bold flex items-center justify-center shadow-md animate-pulse">
          <Hand className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
              Active Question Hand-Raise Mode
            </span>
            <span className="text-[11px] px-2 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono font-semibold">
              {yesCount} Hand{yesCount === 1 ? '' : 's'} Raised
            </span>
          </div>
          <div className="text-sm font-semibold text-white truncate max-w-xl">
            {currentQuestion ? currentQuestion.text : 'Select or type a question to log hand-raises...'}
          </div>
        </div>
      </div>

      {/* Center: Instruction badge */}
      <div className="hidden lg:flex items-center space-x-1.5 px-3 py-1 bg-amber-900/40 border border-amber-700/50 rounded-lg text-xs text-amber-200">
        <span>👉 Tap any juror card in the seating chart or grid to toggle hand raised!</span>
      </div>

      {/* Right: Question Switcher & Add Form */}
      <div className="flex items-center space-x-2">
        {questions.length > 0 && (
          <select
            value={activeQuestionId}
            onChange={e => {
              if (e.target.value === '__new__') {
                setShowAddForm(true);
              } else {
                setActiveQuestionId(e.target.value);
              }
            }}
            className="bg-slate-900 border border-amber-700/60 rounded-lg px-2.5 py-1.5 text-xs text-amber-100 outline-none max-w-[200px] truncate"
          >
            {questions.map((q, idx) => (
              <option key={q.id} value={q.id}>
                Q{idx + 1}: {q.text}
              </option>
            ))}
            <option value="__new__">+ New Question...</option>
          </select>
        )}

        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center space-x-1 px-2.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded-lg text-xs transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Question</span>
        </button>

        <button
          onClick={() => setActiveQuestionId(null)}
          className="p-1.5 bg-slate-900/80 hover:bg-slate-800 border border-amber-700/50 rounded-lg text-amber-300 hover:text-white transition-colors"
          title="Exit Question Logger Mode"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* New Question Modal */}
      {showAddForm && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 text-slate-100"
          onClick={() => setShowAddForm(false)}
        >
          <form
            onSubmit={handleCreate}
            onClick={e => e.stopPropagation()}
            className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <h3 className="font-bold text-slate-100 text-sm flex items-center space-x-2">
                <Hand className="w-4 h-4 text-amber-400" />
                <span>Add Group Question</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Question Text:
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Has anyone here ever served in the military or had close family in law enforcement?"
                value={newQuestionText}
                onChange={e => setNewQuestionText(e.target.value)}
                autoFocus
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-200 outline-none focus:border-amber-500 leading-relaxed"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs"
              >
                Start Question
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
