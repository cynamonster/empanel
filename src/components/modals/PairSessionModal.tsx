import React, { useState, useEffect, useRef } from 'react';
import { useCase } from '../../context/CaseContext';
import { formatPin, normalizePin, isValidPin } from '../../sync/crypto';
import {
  ShieldCheck,
  Flame,
  Radio,
  Laptop,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  X,
  Wifi,
  Lock,
  ArrowRight
} from 'lucide-react';

interface PairSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'host' | 'viewer';
}

export const PairSessionModal: React.FC<PairSessionModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'host',
}) => {
  const {
    syncStatus,
    syncRole,
    syncPin,
    syncAttempts,
    syncLatency,
    startHostingSync,
    joinSyncSession,
    burnSyncRoom,
    disconnectSync,
  } = useCase();

  const [tab, setTab] = useState<'host' | 'viewer'>(initialTab);
  const [inputPin, setInputPin] = useState('');
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const pinInputRef = useRef<HTMLInputElement>(null);
  const prevStatusRef = useRef(syncStatus);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // For host session: alert when connected and automatically close the modal
  useEffect(() => {
    if (isOpen) {
      prevStatusRef.current = syncStatus;
    }
  }, [isOpen]);

  useEffect(() => {
    const wasConnected = prevStatusRef.current === 'connected_p2p' || prevStatusRef.current === 'connected_relay';
    const isNowConnected = syncStatus === 'connected_p2p' || syncStatus === 'connected_relay';

    if (isOpen && (tab === 'host' || syncRole === 'host') && isNowConnected && !wasConnected) {
      const timer = setTimeout(() => {
        alert('Podium session linked successfully!');
        onClose();
      }, 150);
      return () => clearTimeout(timer);
    }

    prevStatusRef.current = syncStatus;
  }, [isOpen, tab, syncRole, syncStatus, onClose]);

  // Initialize tab & auto-generate host PIN if opening in host mode without one
  useEffect(() => {
    if (isOpen) {
      if (initialTab) {
        setTab(initialTab);
      }
      setErrorMessage(null);
      if (initialTab === 'viewer') {
        setTimeout(() => pinInputRef.current?.focus(), 150);
      } else if (initialTab === 'host' && !syncPin) {
        startHostingSync().catch(err => {
          setErrorMessage(err?.message || 'Failed to generate PIN');
        });
      }
    }
  }, [isOpen, initialTab]);

  // When switching tabs to host, generate PIN if none exists
  const handleSelectHostTab = () => {
    setTab('host');
    setErrorMessage(null);
    if (!syncPin) {
      startHostingSync().catch(err => {
        setErrorMessage(err?.message || 'Failed to generate PIN');
      });
    }
  };

  const handleSelectViewerTab = () => {
    setTab('viewer');
    setErrorMessage(null);
    setTimeout(() => pinInputRef.current?.focus(), 100);
  };

  if (!isOpen) return null;

  const handleGenerateFreshPin = async () => {
    try {
      setErrorMessage(null);
      await startHostingSync();
    } catch (e: any) {
      setErrorMessage(e?.message || 'Failed to generate pairing PIN');
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = normalizePin(inputPin);
    if (!isValidPin(clean)) {
      setErrorMessage('Please enter a valid 6-character alphanumeric PIN');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await joinSyncSession(clean);
      onClose();
    } catch (e: any) {
      setErrorMessage(e?.message || 'Failed to connect with Second Chair');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyPin = () => {
    if (!syncPin) return;
    navigator.clipboard.writeText(formatPin(syncPin));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isConnected = syncStatus === 'connected_p2p' || syncStatus === 'connected_relay';
  const isBurned = syncStatus === 'burned' || syncAttempts.current >= syncAttempts.max;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-750 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Session Sync
                {/* <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Secured
                </span> */}
              </h2>
              <p className="text-xs text-slate-400">
                Allow others to join your session
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 p-1.5 gap-1.5">
          <button
            type="button"
            onClick={handleSelectHostTab}
            className={`flex-1 py-2.5 px-3 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-2 ${
              tab === 'host'
                ? 'bg-slate-800 text-indigo-300 shadow border border-slate-700/80 ring-1 ring-indigo-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
            }`}
          >
            <Laptop className="w-4 h-4 text-indigo-400" />
            <span>Host (Display PIN)</span>
          </button>
          <button
            type="button"
            onClick={handleSelectViewerTab}
            className={`flex-1 py-2.5 px-3 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-2 ${
              tab === 'viewer'
                ? 'bg-slate-800 text-amber-300 shadow border border-slate-700/80 ring-1 ring-amber-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
            }`}
          >
            <Radio className="w-4 h-4 text-amber-400" />
            <span>View (Enter PIN)</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 space-y-5">
          {tab === 'host' ? (
            /* HOST (Second Chair) */
            <div className="space-y-4">
              {isConnected ? (
                /* Connected state */
                <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-5 text-center space-y-2">
                  <div className="inline-flex p-3 bg-emerald-500/20 rounded-full text-emerald-400">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-sm font-bold text-emerald-200">
                    Session Connected!
                  </h3>
                  <div className="pt-2">
                    <button
                      onClick={disconnectSync}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-rose-300 border border-slate-750 rounded-lg text-xs font-medium transition-colors"
                    >
                      Disconnect Session
                    </button>
                  </div>
                </div>
              ) : isBurned ? (
                /* Room burned lockout state */
                <div className="bg-rose-950/40 border border-rose-500/40 rounded-xl p-5 text-center space-y-3">
                  <div className="inline-flex p-3 bg-rose-500/20 rounded-full text-rose-400">
                    <Flame className="w-8 h-8" />
                  </div>
                  <h3 className="text-sm font-bold text-rose-200">
                    Room Burned (Security Lockout)
                  </h3>
                  <p className="text-xs text-slate-300 max-w-sm mx-auto">
                    3 failed attempts occurred. To prevent brute-force attacks, this room was destroyed. Click below to generate a new PIN.
                  </p>
                  <button
                    onClick={handleGenerateFreshPin}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 mx-auto"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Generate Fresh PIN</span>
                  </button>
                </div>
              ) : syncPin ? (
                /* Host PIN Active */
                <div className="space-y-4">
                  <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-6 text-center space-y-3">
                    
                    {/* PIN Display */}
                    <div className="flex items-center justify-center gap-3">
                      <div className="font-mono text-4xl font-black tracking-widest text-indigo-300 bg-slate-900 border-2 border-indigo-500/40 px-6 py-3 rounded-2xl shadow-inner select-all">
                        {formatPin(syncPin)}
                      </div>
                      <button
                        onClick={handleCopyPin}
                        title="Copy PIN"
                        className="p-3.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 hover:text-white rounded-2xl transition-colors shadow"
                      >
                        {copied ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
                      </button>
                    </div>

                    <p className="text-xs text-slate-400 max-w-xs mx-auto">
                      Enter this PIN on a second device to link sessions.
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-xs px-1">
                    <span className="text-indigo-300 flex items-center gap-2">
                      <Wifi className="w-4 h-4 text-indigo-400 animate-pulse" />
                      Listening for Connection...
                    </span>
                    <button
                      onClick={burnSyncRoom}
                      className="text-slate-400 hover:text-rose-400 font-medium flex items-center gap-1 hover:underline text-xs transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Regenerate PIN</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Loading host state */
                <div className="text-center py-6">
                  <RefreshCw className="w-6 h-6 animate-spin text-indigo-400 mx-auto" />
                  <p className="text-xs text-slate-400 mt-2">Generating secure PIN...</p>
                </div>
              )}
            </div>
          ) : (
            /* VIEWER (Podium) */
            <form onSubmit={handleJoin} className="space-y-4">
              <div className="space-y-3">
                <label className="text-xs font-semibold text-slate-300 block">
                  Enter 6-Character PIN from Second Chair:
                </label>
                <input
                  ref={pinInputRef}
                  type="text"
                  maxLength={7}
                  placeholder="------"
                  value={inputPin}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                    if (raw.length <= 6) {
                      setInputPin(raw.length > 3 ? `${raw.slice(0, 3)}-${raw.slice(3)}` : raw);
                    }
                  }}
                  className="w-full px-4 py-3 bg-slate-950 border-2 border-slate-700 focus:border-amber-500 rounded-xl font-mono text-center text-3xl tracking-widest text-amber-300 focus:outline-none focus:ring-4 focus:ring-amber-500/20"
                />
                <p className="text-xs text-slate-400 text-center">
                  Look at the Second Chair screen to find the 6-character PIN.
                </p>
              </div>

              {errorMessage && (
                <div className="p-3 bg-rose-950/50 border border-rose-500/40 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || normalizePin(inputPin).length !== 6}
                className="w-full py-3.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 disabled:opacity-40 text-white font-semibold rounded-xl text-sm shadow-lg shadow-amber-600/30 transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Connecting & Opening Podium Mode...</span>
                  </>
                ) : (
                  <>
                    <span>Connect & Open Podium Mode</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
