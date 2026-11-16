import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useCase } from '../../context/CaseContext';
import { formatPin, normalizePin, isValidPin } from '../../sync/crypto';
import { generateQrSvgPath } from '../../utils/qrCode';
import {
  ShieldCheck,
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
  ArrowRight,
  QrCode,
  Scale,
  LayoutGrid
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
    connectedPeers,
    startHostingSync,
    joinSyncSession,
    burnSyncRoom,
    disconnectSync,
  } = useCase();

  const [tab, setTab] = useState<'host' | 'viewer'>(initialTab);
  const [selectedJoinRole, setSelectedJoinRole] = useState<'second_chair' | 'podium'>('second_chair');
  const [inputPin, setInputPin] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [lanIp, setLanIp] = useState<string | null>(null);
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

  // Discover LAN IP from dev/preview server when modal is open
  useEffect(() => {
    if (isOpen) {
      fetch('/api/lan-ip')
        .then(res => res.json())
        .then(data => {
          if (data?.ip) setLanIp(data.ip);
        })
        .catch(() => {
          // Dev API endpoint not available in static CDN mode, fallback silently
        });
    }
  }, [isOpen]);

  // Compute mobile join URL and QR Code SVG path
  const mobileJoinUrl = useMemo(() => {
    if (!syncPin) return '';
    const hostname = window.location.hostname;
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
    const targetHost = (isLocal && lanIp)
      ? `${lanIp}${window.location.port ? `:${window.location.port}` : ''}`
      : window.location.host;
    return `${window.location.protocol}//${targetHost}/?join=${syncPin}`;
  }, [syncPin, lanIp]);

  const qrData = useMemo(() => {
    if (!mobileJoinUrl) return null;
    return generateQrSvgPath(mobileJoinUrl);
  }, [mobileJoinUrl]);

  // Automatically close modal when connection succeeds
  useEffect(() => {
    if (isOpen) {
      prevStatusRef.current = syncStatus;
    }
  }, [isOpen]);

  useEffect(() => {
    const wasConnected = prevStatusRef.current === 'connected_p2p' || prevStatusRef.current === 'connected_relay';
    const isNowConnected = syncStatus === 'connected_p2p' || syncStatus === 'connected_relay';

    if (isOpen && isNowConnected && !wasConnected) {
      setIsSubmitting(false);
      // Auto-close for viewer upon connecting; keep host open so additional peers can join
      if (tab === 'viewer' || syncRole === 'viewer') {
        const timer = setTimeout(() => {
          onClose();
        }, 350);
        return () => clearTimeout(timer);
      }
    }

    if (isOpen && syncStatus === 'error' && isSubmitting) {
      setIsSubmitting(false);
      setErrorMessage('Connection failed. Please check the PIN and ensure the host is running.');
    }

    prevStatusRef.current = syncStatus;
  }, [isOpen, tab, syncRole, syncStatus, isSubmitting, onClose]);

  // Safety timeout for join requests
  useEffect(() => {
    if (!isSubmitting) return;
    const timeout = setTimeout(() => {
      setIsSubmitting(false);
      setErrorMessage('Connection timed out. Ensure the Second Chair host is running and on the same Wi-Fi.');
    }, 15000);
    return () => clearTimeout(timeout);
  }, [isSubmitting]);

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
      setErrorMessage('Please enter a valid 6-letter PIN (letters only)');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await joinSyncSession(clean, selectedJoinRole);
      // Let the isNowConnected effect auto-close the modal upon handshake completion
    } catch (e: any) {
      setIsSubmitting(false);
      setErrorMessage(e?.message || 'Failed to connect with host session');
    }
  };

  const handleCopyPin = () => {
    if (!syncPin) return;
    navigator.clipboard.writeText(formatPin(syncPin));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyUrl = () => {
    if (!mobileJoinUrl) return;
    navigator.clipboard.writeText(mobileJoinUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const isConnected = syncStatus === 'connected_p2p' || syncStatus === 'connected_relay';

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-750 w-full max-w-lg max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Session Sync
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
        <div className="flex border-b border-slate-800 bg-slate-950/40 p-1.5 gap-1.5 flex-shrink-0">
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
            <span>Join Session (Enter PIN)</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {tab === 'host' ? (
            /* HOST (Second Chair) */
            <div className="space-y-4">
              {syncPin ? (
                /* Host PIN Active (Keeps showing PIN and QR even when peers connect) */
                <div className="space-y-4">
                  {/* Connected Status Banner & Peer List */}
                  {isConnected && (
                    <div className="bg-emerald-950/50 border border-emerald-500/40 rounded-xl p-3 space-y-2 animate-in fade-in">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="text-xs font-bold text-emerald-300">
                            {connectedPeers.length > 1
                              ? `${connectedPeers.length - 1} Devices Connected`
                              : 'Session Active & Syncing'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={disconnectSync}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-rose-300 border border-slate-700 rounded-lg text-xs font-medium transition-colors"
                        >
                          End Session
                        </button>
                      </div>

                      {/* Peer List Badges */}
                      {connectedPeers.length > 1 && (
                        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-emerald-500/20">
                          {connectedPeers.map(peer => (
                            <span
                              key={peer.id}
                              className={`text-[10px] font-mono px-2 py-0.5 rounded-md border ${
                                peer.role === 'host'
                                  ? 'bg-slate-800 border-slate-650 text-slate-300'
                                  : peer.role === 'second_chair'
                                  ? 'bg-indigo-900/60 border-indigo-500/50 text-indigo-200'
                                  : 'bg-amber-900/60 border-amber-500/50 text-amber-200'
                              }`}
                            >
                              {peer.role === 'host'
                                ? '★ Host'
                                : peer.role === 'second_chair'
                                ? '2nd Chair (Table)'
                                : '1st Chair (Podium)'}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 text-center space-y-3">
                    
                    {/* PIN Display */}
                    <div className="flex items-center justify-center gap-3">
                      <div className="font-mono text-3xl font-black tracking-widest text-indigo-300 bg-slate-900 border-2 border-indigo-500/40 px-5 py-2.5 rounded-2xl shadow-inner select-all">
                        {formatPin(syncPin)}
                      </div>
                      <button
                        onClick={handleCopyPin}
                        title="Copy PIN"
                        className="p-3 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 hover:text-white rounded-xl transition-colors shadow"
                      >
                        {copied ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
                      </button>
                    </div>

                    <p className="text-xs text-slate-400 max-w-xs mx-auto">
                      {isConnected
                        ? 'Share this PIN or QR code to allow additional devices to join this session:'
                        : 'Enter this PIN on a second device, or scan the QR code below:'}
                    </p>

                    {/* QR Code */}
                    {qrData && (
                      <div className="pt-2 flex flex-col items-center gap-2.5">
                        <div className="bg-white p-3 rounded-2xl shadow-lg border border-slate-700/50">
                          <svg
                            viewBox={`0 0 ${qrData.size} ${qrData.size}`}
                            className="w-36 h-36"
                            shapeRendering="crispEdges"
                          >
                            <path d={qrData.path} fill="#0f172a" />
                          </svg>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-300">
                          <QrCode className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Scan with Phone Camera to Auto-Join</span>
                        </div>
                      </div>
                    )}

                    {/* Mobile Join URL */}
                    {mobileJoinUrl && (
                      <div className="flex flex-col gap-1.5 w-full mt-2">
                        <div className="flex items-center gap-2 bg-slate-900 border border-slate-850 rounded-xl px-3 py-1.5 text-left">
                          <span className="text-[11px] font-mono text-slate-300 truncate flex-1 select-all">
                            {mobileJoinUrl}
                          </span>
                          <button
                            type="button"
                            onClick={handleCopyUrl}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-750 text-indigo-300 hover:text-indigo-200 border border-slate-700 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 shrink-0"
                          >
                            {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedUrl ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-400 text-center">
                          {window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
                            ? 'Local dev mode: phone must be on the same Wi-Fi. (In production on empanel.app, connects over any network)'
                            : 'Open this link or visit empanel.app and enter the PIN'}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs px-1 text-slate-400">
                    <span className="text-indigo-300 flex items-center gap-2">
                      <Wifi className="w-4 h-4 text-indigo-400 animate-pulse" />
                      Listening for connections...
                    </span>
                    <button
                      type="button"
                      onClick={handleGenerateFreshPin}
                      className="text-slate-400 hover:text-indigo-300 font-medium flex items-center gap-1 hover:underline text-xs transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Generate New PIN</span>
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
            /* JOIN SESSION (Second Chair or Podium) */
            <form onSubmit={handleJoin} className="space-y-4">
              <div className="space-y-3">
                <label className="text-xs font-semibold text-slate-300 block">
                  Enter 6-Letter PIN from Host Console:
                </label>
                <input
                  ref={pinInputRef}
                  type="text"
                  maxLength={7}
                  placeholder="ABC-DEF"
                  value={inputPin}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^A-Za-z]/g, '').toUpperCase();
                    if (raw.length <= 6) {
                      setInputPin(raw.length > 3 ? `${raw.slice(0, 3)}-${raw.slice(3)}` : raw);
                    }
                  }}
                  className="w-full px-4 py-3 bg-slate-950 border-2 border-slate-700 focus:border-indigo-500 rounded-xl font-mono text-center text-3xl tracking-widest text-indigo-300 focus:outline-none focus:ring-4 focus:ring-indigo-500/20"
                />
                <p className="text-xs text-slate-400 text-center">
                  Look at the host screen to find the 6-letter PIN or scan the QR code.
                </p>
              </div>

              {/* Role Selection */}
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-semibold text-slate-300 block">
                  Select Your Role for this Session:
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSelectedJoinRole('second_chair')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      selectedJoinRole === 'second_chair'
                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-100 ring-1 ring-indigo-500/50'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center space-x-1.5 font-bold text-xs text-indigo-300 mb-1">
                      <Scale className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Second Chair</span>
                    </div>
                    <p className="text-[10px] leading-tight text-slate-400">
                      Full table console: ratings, strikes, notes & seating chart
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedJoinRole('podium')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      selectedJoinRole === 'podium'
                        ? 'bg-amber-600/20 border-amber-500 text-amber-100 ring-1 ring-amber-500/50'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center space-x-1.5 font-bold text-xs text-amber-300 mb-1">
                      <Radio className="w-3.5 h-3.5 text-amber-400" />
                      <span>First Chair (Podium)</span>
                    </div>
                    <p className="text-[10px] leading-tight text-slate-400">
                      Glanceable lectern view with giant juror cards & whisper cues
                    </p>
                  </button>
                </div>
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
                className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-40 text-white font-semibold rounded-xl text-sm shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Connecting to Courtroom Session...</span>
                  </>
                ) : (
                  <>
                    <span>
                      {selectedJoinRole === 'second_chair'
                        ? 'Connect as Second Chair (Table Console)'
                        : 'Connect as First Chair (Podium View)'}
                    </span>
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
