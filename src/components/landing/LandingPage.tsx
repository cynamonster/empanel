import React, { useState, useEffect } from 'react';
import {
  Scale,
  Shield,
  WifiOff,
  Radio,
  ArrowRight,
  Play,
  CheckCircle2,
  Users,
  Hand,
  Gavel,
  Lock,
  ChevronDown,
  Sparkles,
  Smartphone,
  Monitor,
  ExternalLink,
  Laptop
} from 'lucide-react';
import { db } from '../../db';
import { normalizePin, isValidPin } from '../../sync/crypto';

interface LandingPageProps {
  onLaunchApp: () => void;
  onLaunchDemo: () => void;
  onJoinSession: (pin: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onLaunchApp,
  onLaunchDemo,
  onJoinSession,
}) => {
  const [hasExistingCases, setHasExistingCases] = useState(false);
  const [caseCount, setCaseCount] = useState(0);
  const [pairPin, setPairPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  useEffect(() => {
    db.cases.count().then(count => {
      setHasExistingCases(count > 0);
      setCaseCount(count);
    }).catch(() => {});
  }, []);

  const handlePairSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = normalizePin(pairPin);
    if (!isValidPin(clean)) {
      setPinError('Please enter a valid 4-letter PIN');
      return;
    }
    setPinError('');
    onJoinSession(clean);
  };

  const faqs = [
    {
      q: 'Does Empanel require Wi-Fi or cellular service in the courtroom?',
      a: 'No. Empanel is 100% offline-first. All seating charts, strike tallies, and juror notes are persisted directly in your local browser IndexedDB. If you are in a basement courtroom or an air-gapped facility with zero connectivity, the full workspace functions without interruption.'
    },
    {
      q: 'How does Lead Counsel at the podium sync with Second Chair at counsel table?',
      a: 'Second Chair creates an ephemeral session and shares a 4-letter PIN (or QR code). Lead Counsel connects from any smartphone, tablet, or secondary laptop using zero-knowledge end-to-end encryption (AES-256-GCM). Devices connect directly over local Wi-Fi / hotspot, or via our zero-logging fallback relay.'
    },
    {
      q: 'Is confidential juror and strategy data stored on your cloud servers?',
      a: 'Never. Empanel maintains strict adherence to ABA Model Rule 1.6 (Confidentiality) and attorney work-product privilege. There is no cloud database, no user tracking, and no server-side retention. Real-time pairing keys are derived locally on-device and never transmitted to any server.'
    },
    {
      q: 'Can I import prospective juror lists provided by the court clerk?',
      a: 'Yes. Empanel includes an automated CSV intake parser with intelligent column auto-mapping for Juror #, Name, Age/Birth Year, Occupation, Employer, City/Zip, and Education.'
    },
    {
      q: 'Can Empanel be installed as a native app on iPad, Mac, and Windows?',
      a: 'Yes! Empanel is a Progressive Web App (PWA). In Safari on iPad/Mac or Chrome/Edge on Windows, tap "Add to Home Screen" or the Install icon in the address bar to install it as a standalone, distraction-free courtroom app.'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Header Navigation */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur sticky top-0 z-40 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-500/20 border border-indigo-500/30 rounded-xl shadow-inner">
            <Scale className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-indigo-300 via-indigo-100 to-white bg-clip-text text-transparent">
                EMPANEL
              </span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-950/90 text-indigo-300 border border-indigo-800/60">
                v1.0 Ready
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">Tactical Voir Dire & Jury Selection</p>
          </div>
        </div>

        <nav className="hidden md:flex items-center space-x-6 text-sm text-slate-300 font-medium">
          <a href="#features" className="hover:text-indigo-300 transition-colors">Features</a>
          <a href="#security" className="hover:text-indigo-300 transition-colors">Security & Ethics</a>
          <a href="#podium" className="hover:text-indigo-300 transition-colors">Podium Sync</a>
          <a href="#faq" className="hover:text-indigo-300 transition-colors">FAQ</a>
        </nav>

        <div className="flex items-center space-x-3">
          {hasExistingCases ? (
            <button
              onClick={onLaunchApp}
              className="px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition-all flex items-center space-x-1.5"
            >
              <span>Resume Active Case ({caseCount})</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={onLaunchApp}
              className="px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition-all flex items-center space-x-1.5"
            >
              <span>Launch Console</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-16 sm:pt-20 sm:pb-24 px-4 sm:px-8 border-b border-slate-800/60">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(79,70,229,0.18),rgba(2,6,23,0))] pointer-events-none" />

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-900/90 border border-indigo-500/30 text-indigo-300 text-xs font-medium mb-6 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Built Specifically for Criminal & Civil Trial Lawyers</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white mb-6 leading-[1.12]">
            The Tactical <span className="bg-gradient-to-r from-indigo-400 via-indigo-200 to-indigo-400 bg-clip-text text-transparent">Voir Dire</span> Command Center
          </h1>

          <p className="text-base sm:text-xl text-slate-300 max-w-3xl mx-auto mb-10 leading-relaxed font-normal">
            Offline-first courtroom seating, real-time strike telemetry, and zero-knowledge encrypted second chair sync. Make decisive peremptory strikes with confidence.
          </p>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 mb-12">
            <button
              onClick={onLaunchApp}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-base shadow-xl shadow-indigo-600/25 transition-all flex items-center justify-center space-x-2 group"
            >
              <span>Launch Courtroom Console</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={onLaunchDemo}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-semibold text-base transition-all flex items-center justify-center space-x-2 shadow-sm"
            >
              <Play className="w-4 h-4 text-emerald-400 fill-emerald-400/20" />
              <span>Try Interactive Demo (State v. Henderson)</span>
            </button>
          </div>

          {/* Quick PIN Pairing Bar */}
          <div className="max-w-md mx-auto p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl backdrop-blur">
            <form onSubmit={handlePairSubmit} className="flex flex-col sm:flex-row items-center gap-2">
              <div className="flex-1 w-full text-left">
                <label htmlFor="landing-pin" className="block text-[11px] font-semibold text-slate-400 mb-1 ml-1 uppercase tracking-wider">
                  Quick Join Active Trial Session
                </label>
                <div className="relative">
                  <input
                    id="landing-pin"
                    type="text"
                    maxLength={4}
                    value={pairPin}
                    onChange={(e) => setPairPin(e.target.value.toUpperCase())}
                    placeholder="Enter 4-Letter PIN"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-center tracking-widest uppercase placeholder:tracking-normal placeholder:text-slate-500 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full sm:w-auto mt-2 sm:mt-5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center space-x-1"
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Join</span>
              </button>
            </form>
            {pinError && <p className="text-rose-400 text-xs mt-1.5 ml-1">{pinError}</p>}
          </div>
        </div>

        {/* Interactive Stylized Courtroom Preview */}
        <div className="mt-14 max-w-5xl mx-auto px-2">
          <div className="p-3 sm:p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-2xl backdrop-blur">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs text-slate-400 font-medium">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-slate-200 font-semibold">Simulated Courtroom Seating Console</span>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-indigo-400 font-semibold">Pros: 3 Left</span>
                <span className="text-emerald-400 font-semibold">Def: 4 Left</span>
              </div>
            </div>

            {/* Mock Jury Box Preview */}
            <div className="pt-4 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
              {[
                { seat: 1, num: '104', name: 'Marcus Vance', score: '+2', status: 'Favor', tag: 'Educated' },
                { seat: 2, num: '109', name: 'Elena Rostova', score: '-1', status: 'Oppose', tag: 'Tort Reform' },
                { seat: 3, num: '112', name: 'David Chen', score: '0', status: 'Neutral', tag: 'Engineer' },
                { seat: 4, num: '115', name: 'Sarah Jenkins', score: '+3', status: 'Strong', tag: 'Leader' },
                { seat: 5, num: '118', name: 'Robert King', score: '-2', status: 'Struck', tag: 'Ex-LEO', struck: true },
                { seat: 6, num: '121', name: 'Maya Patel', score: '+1', status: 'Favor', tag: 'Accountant' },
              ].map((j) => (
                <div
                  key={j.seat}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    j.struck
                      ? 'bg-slate-950/60 border-rose-900/40 opacity-60'
                      : 'bg-slate-950 border-slate-800 hover:border-indigo-500/50'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] mb-1 font-mono">
                    <span className="text-slate-400 font-bold">Seat #{j.seat}</span>
                    <span className="text-slate-300 font-semibold">Juror #{j.num}</span>
                  </div>
                  <div className="text-xs font-bold text-white truncate">{j.name}</div>
                  <div className="flex items-center justify-between mt-2 text-[10px]">
                    <span className={`px-1.5 py-0.5 rounded font-mono font-bold ${
                      j.struck
                        ? 'bg-rose-950 text-rose-300 border border-rose-800'
                        : j.score.startsWith('+')
                        ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60'
                        : 'bg-rose-950/80 text-rose-300 border border-rose-800/60'
                    }`}>
                      {j.struck ? 'STRUCK' : j.score}
                    </span>
                    <span className="text-slate-400 truncate ml-1">{j.tag}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 text-center">
              <span className="text-[11px] text-slate-500 font-mono">
                Click "Try Interactive Demo" above to interact with full 18-seat panels, strike logs, and whisper cues.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Core Capabilities Section */}
      <section id="features" className="py-16 sm:py-24 px-4 sm:px-8 border-b border-slate-800/60 max-w-6xl mx-auto w-full">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white mb-4">
            Engineered for High-Stakes Voir Dire
          </h2>
          <p className="text-slate-400 text-sm sm:text-base">
            Replace chaotic paper seating charts, illegible sticky notes, and fragile spreadsheets with a purpose-built tactical console.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          {/* Pillar 1 */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all flex flex-col">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-5">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Spatial Seating & Venire Gallery</h3>
            <p className="text-sm text-slate-300 leading-relaxed flex-1">
              Dual-tier 12/14-seat jury box plus alternates with configurable aisle splits and gallery orientation. Drag and drop jurors directly to re-seat or utilize sequential panel auto-fill.
            </p>
            <ul className="mt-4 space-y-1.5 text-xs text-slate-400 border-t border-slate-800/60 pt-4">
              <li className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
                <span>Single or dual-box courtroom layouts</span>
              </li>
              <li className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
                <span>Custom aisle splits and gallery numbering</span>
              </li>
            </ul>
          </div>

          {/* Pillar 2 */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all flex flex-col">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-5">
              <Hand className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Tactical Profiling & Hand-Raise Logging</h3>
            <p className="text-sm text-slate-300 leading-relaxed flex-1">
              Ask group questions ("Raise your hand if...") and log responses across the room with a single tap. Rate juror sentiment from -3 to +3 and maintain detailed notes for cause challenges.
            </p>
            <ul className="mt-4 space-y-1.5 text-xs text-slate-400 border-t border-slate-800/60 pt-4">
              <li className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>1-touch group question response logging</span>
              </li>
              <li className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Demographic, occupation, & prior jury tags</span>
              </li>
            </ul>
          </div>

          {/* Pillar 3 */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all flex flex-col">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-5">
              <Gavel className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Strike Console & Batson Records</h3>
            <p className="text-sm text-slate-300 leading-relaxed flex-1">
              Live peremptory strike counters for both sides with soft-cap handling. Record judge cause challenge rulings and timestamp strikes for appellate and Batson preservation.
            </p>
            <ul className="mt-4 space-y-1.5 text-xs text-slate-400 border-t border-slate-800/60 pt-4">
              <li className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Statutory strike allowance limits</span>
              </li>
              <li className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Instant undo / redo with state snapshots</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Podium Mode & Real-Time Sync Section */}
      <section id="podium" className="py-16 sm:py-24 px-4 sm:px-8 border-b border-slate-800/60 bg-slate-900/30">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center gap-10 sm:gap-14">
          <div className="flex-1 text-left">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-semibold mb-4">
              <Radio className="w-3.5 h-3.5" />
              <span>Zero-Knowledge E2EE Real-Time Pairing</span>
            </div>

            <h2 className="text-2xl sm:text-4xl font-extrabold text-white mb-4 leading-tight">
              Lead Counsel at the Podium.<br />Second Chair at Counsel Table.
            </h2>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed mb-6 font-normal">
              Lead counsel needs their hands free and head up. Second Chair operates the comprehensive command center from their laptop, while Lead Counsel glances at a simplified mobile prompter card deck on their phone or iPad.
            </p>

            <div className="space-y-3.5 text-sm text-slate-300">
              <div className="flex items-start space-x-3">
                <div className="p-1 rounded bg-indigo-500/20 text-indigo-400 mt-0.5">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-semibold text-white">Live Whisper Cues:</span> Second chair sends silent notes ("Ask #4 about insurance", "Strike #11") that appear instantly on lead counsel's screen.
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="p-1 rounded bg-indigo-500/20 text-indigo-400 mt-0.5">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-semibold text-white">4-Letter Ephemeral PIN:</span> Zero account creation or registration. Connect in 2 seconds with a simple code or QR scan.
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 w-full max-w-sm">
            {/* Visual Phone Mockup */}
            <div className="p-4 rounded-3xl bg-slate-950 border-2 border-indigo-500/40 shadow-2xl relative">
              <div className="w-20 h-4 bg-slate-900 rounded-full mx-auto mb-4" />
              <div className="p-3 bg-indigo-950/60 border border-indigo-800/80 rounded-xl mb-3 text-left">
                <div className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider mb-0.5">
                  Silent Whisper from Table
                </div>
                <div className="text-xs text-white font-medium">
                  "Follow up with Juror #7 on tort skepticism."
                </div>
              </div>

              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-left">
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="font-bold text-white">Seat 3 • Juror #108</span>
                  <span className="text-xs font-mono font-bold text-emerald-400">+2 Favorable</span>
                </div>
                <div className="text-xs text-slate-300 font-semibold">David Sullivan (54)</div>
                <div className="text-[11px] text-slate-400">Civil Engineer • Prior Jury: None</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Security & Ethics Section */}
      <section id="security" className="py-16 sm:py-24 px-4 sm:px-8 border-b border-slate-800/60">
        <div className="max-w-4xl mx-auto text-center">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mx-auto mb-6">
            <Shield className="w-6 h-6" />
          </div>

          <h2 className="text-2xl sm:text-4xl font-extrabold text-white mb-4">
            100% Client-Side. 0 Cloud Databases. Air-Gapped Ready.
          </h2>

          <p className="text-slate-300 text-sm sm:text-base max-w-2xl mx-auto mb-10 leading-relaxed font-normal">
            Under ABA Model Rule 1.6 and attorney-client work product doctrine, trial strategy and juror evaluations are sacrosanct. Empanel is architected so that your sensitive jury notes never leave your personal hardware.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
            <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
              <WifiOff className="w-5 h-5 text-indigo-400 mb-2" />
              <h4 className="text-sm font-bold text-white mb-1">Offline-First IndexedDB</h4>
              <p className="text-xs text-slate-400">All data resides in browser storage on your laptop or tablet. Works completely disconnected.</p>
            </div>
            <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
              <Lock className="w-5 h-5 text-indigo-400 mb-2" />
              <h4 className="text-sm font-bold text-white mb-1">AES-256-GCM Encryption</h4>
              <p className="text-xs text-slate-400">Pairing channels are encrypted client-side using Web Crypto. Keys are never transmitted to our servers.</p>
            </div>
            <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
              <Scale className="w-5 h-5 text-indigo-400 mb-2" />
              <h4 className="text-sm font-bold text-white mb-1">Zero Telemetry & Tracking</h4>
              <p className="text-xs text-slate-400">No analytics cookies, no behavioral profiling, and no third-party scripts touching your session.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-16 sm:py-24 px-4 sm:px-8 max-w-3xl mx-auto w-full">
        <h2 className="text-2xl sm:text-4xl font-extrabold text-white mb-4 text-center">
          Frequently Asked Questions
        </h2>
        <p className="text-slate-400 text-sm text-center mb-10">
          Everything you need to know about deploying Empanel in your trial.
        </p>

        <div className="space-y-3">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className="border border-slate-800 rounded-xl bg-slate-900/40 overflow-hidden transition-all"
            >
              <button
                onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                className="w-full px-5 py-4 text-left flex items-center justify-between text-sm sm:text-base font-semibold text-white hover:text-indigo-300 transition-colors"
              >
                <span>{faq.q}</span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform ${
                    expandedFaq === idx ? 'rotate-180 text-indigo-400' : ''
                  }`}
                />
              </button>
              {expandedFaq === idx && (
                <div className="px-5 pb-4 text-xs sm:text-sm text-slate-300 leading-relaxed border-t border-slate-800/60 pt-3">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="py-16 px-4 sm:px-8 border-t border-slate-800/80 bg-gradient-to-b from-slate-950 to-indigo-950/40 text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white mb-4">
            Empanel Your Next Jury with Precision
          </h2>
          <p className="text-slate-300 text-sm sm:text-base mb-8 max-w-xl mx-auto">
            Ready to experience a modern, offline-first jury selection workflow? Launch the courtroom console now or explore the interactive trial case.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={onLaunchApp}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/25 transition-all flex items-center justify-center space-x-2"
            >
              <span>Launch Courtroom Console</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={onLaunchDemo}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-semibold text-sm transition-all flex items-center justify-center space-x-2"
            >
              <Play className="w-4 h-4 text-emerald-400 fill-emerald-400/20" />
              <span>Explore Interactive Demo</span>
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-8 px-4 sm:px-8 text-center text-xs text-slate-500 bg-slate-950">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <Scale className="w-4 h-4 text-indigo-400" />
            <span className="font-bold text-slate-300">Empanel v1.0</span>
            <span>— The Voir Dire Command Center</span>
          </div>
          <div className="flex items-center space-x-6 text-slate-400">
            <button onClick={onLaunchDemo} className="hover:text-indigo-300 transition-colors">
              Interactive Demo
            </button>
            <button onClick={onLaunchApp} className="hover:text-indigo-300 transition-colors">
              Courtroom Console
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
