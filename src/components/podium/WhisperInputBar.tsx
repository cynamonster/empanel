import React, { useState } from 'react';
import { useCase } from '../../context/CaseContext';
import { Send, Radio, MessageSquare, Sparkles, Check } from 'lucide-react';

interface WhisperInputBarProps {
  onOpenPairModal: (tab?: 'host' | 'viewer') => void;
}

const QUICK_CHIPS = [
  'Push on bias for cause',
  'Ask about prior lawsuits',
  'Hesitated on damages',
  'Wrap up questioning',
  'Strong for our side',
];

export const WhisperInputBar: React.FC<WhisperInputBarProps> = ({ onOpenPairModal }) => {
  const { syncStatus, syncLatency, sendWhisper } = useCase();
  const [text, setText] = useState('');
  const [justSent, setJustSent] = useState(false);

  const isConnected = syncStatus === 'connected_p2p' || syncStatus === 'connected_relay';

  if (!isConnected) {
    return null;
  }

  const handleSend = async (cueText?: string) => {
    const toSend = cueText || text;
    if (!toSend.trim()) return;

    await sendWhisper(toSend.trim());
    setText('');
    setJustSent(true);
    setTimeout(() => setJustSent(false), 1500);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="bg-slate-900 border-t border-slate-800 px-4 py-2 flex items-center justify-between gap-4 text-xs z-20">
      {/* Left: Input or Pair prompt */}
      <div className="flex-1 flex items-center space-x-2 px-[10rem]">
        <div className="flex items-center space-x-1.5 text-slate-400 flex-shrink-0 font-medium">
          <MessageSquare className="w-4 h-4 text-amber-400" />
          <span className="hidden sm:inline">Whisper to Podium:</span>
        </div>

        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={'Type a message to lead counsel at lectern... (Enter to send)'}
          className="flex-1 bg-slate-950 border border-slate-750 focus:border-amber-500 rounded-lg px-3 py-1.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
        />

        <button
          onClick={() => handleSend()}
          disabled={!text.trim()}
          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-30 disabled:hover:bg-amber-600 text-white font-semibold rounded-lg flex items-center space-x-1 transition-all"
        >
          {justSent ? <Check className="w-3.5 h-3.5 text-white" /> : <Send className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">Send</span>
        </button>
      </div>

      {/* Quick Chips */}
      {/* <div className="hidden lg:flex items-center space-x-1.5 flex-shrink-0">
        {QUICK_CHIPS.map((chip, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(chip)}
            className="px-2 py-1 bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-amber-500/50 rounded text-slate-300 hover:text-amber-200 transition-colors text-[11px]"
          >
            {chip}
          </button>
        ))}
      </div> */}

      {/* Right: Pair Podium status button */}
      {/* <div className="flex items-center space-x-2 flex-shrink-0">
        <button
          onClick={() => onOpenPairModal('host')}
          className={`px-2.5 py-1 rounded-lg border font-medium flex items-center space-x-1.5 transition-colors ${
            isConnected
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
              : 'bg-slate-800 hover:bg-slate-750 border-slate-700 text-slate-300'
          }`}
          title="Open E2EE Podium Session Linker"
        >
          <Radio className={`w-3.5 h-3.5 ${isConnected ? 'text-emerald-400 animate-pulse' : 'text-slate-400'}`} />
          <span>{isConnected ? `Podium Linked` : 'Pair Podium'}</span>
        </button>
      </div> */}
    </div>
  );
};
