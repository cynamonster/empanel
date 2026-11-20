import React, { useState, useEffect } from 'react';
import { CaseProvider, useCase } from './context/CaseContext';
import { Navbar } from './components/layout/Navbar';
import { SeatingBoxView } from './components/seating/SeatingBoxView';
import { JurorDetailDrawer } from './components/drawer/JurorDetailDrawer';
import { QuestionLoggerDrawer } from './components/drawer/QuestionLoggerDrawer';
import { IntakeModal } from './components/modals/IntakeModal';
import { StrikeConsoleModal } from './components/modals/StrikeConsoleModal';
import { CaseSettingsModal } from './components/modals/CaseSettingsModal';
import { NewCaseModal } from './components/modals/NewCaseModal';
import { PairSessionModal } from './components/modals/PairSessionModal';
import { SessionEndedModal } from './components/modals/SessionEndedModal';
import { PodiumView } from './components/podium/PodiumView';
import { WhisperInputBar } from './components/podium/WhisperInputBar';
import { LandingPage } from './components/landing/LandingPage';
import { OnboardingWizard } from './components/onboarding/OnboardingWizard';
import { normalizePin, isValidPin } from './sync/crypto';

interface CourtroomWorkspaceProps {
  onReturnToLanding: () => void;
}

const CourtroomWorkspace: React.FC<CourtroomWorkspaceProps> = ({ onReturnToLanding }) => {
  const { viewMode, syncRole, syncStatus, connectedPeers, joinSyncSession, loadDemoCase } = useCase();

  const [isIntakeOpen, setIsIntakeOpen] = useState(false);
  const [isStrikeConsoleOpen, setIsStrikeConsoleOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNewCaseOpen, setIsNewCaseOpen] = useState(false);
  const [isPairOpen, setIsPairOpen] = useState(false);
  const [pairModalTab, setPairModalTab] = useState<'host' | 'viewer'>('host');
  
  // First-run Onboarding Wizard state
  const [isTutorialOpen, setIsTutorialOpen] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        const completed = localStorage.getItem('empanel_onboarding_completed');
        // Do not auto-open in podium mode
        if (completed !== 'true' && viewMode !== 'podium' && syncRole !== 'podium') {
          return true;
        }
      }
    } catch (e) {}
    return false;
  });

  // Auto-connect if URL contains ?join=PIN or ?pin=PIN
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const joinPin = params.get('join') || params.get('pin');
      if (joinPin && syncRole !== 'host') {
        const clean = normalizePin(joinPin);
        if (isValidPin(clean)) {
          const newUrl = window.location.pathname;
          window.history.replaceState({}, '', newUrl);
          joinSyncSession(clean, 'second_chair').catch(err => {
            console.error('Auto-join from URL failed', err);
          });
        }
      }
    } catch (e) {}
  }, []);

  const handleOpenPairModal = (tab: 'host' | 'viewer' = 'host') => {
    setPairModalTab(tab);
    setIsPairOpen(true);
  };

  // Explicit podium mode: render Podium View
  if (viewMode === 'podium' || syncRole === 'podium') {
    return (
      <>
        <PodiumView />
        <PairSessionModal
          isOpen={isPairOpen}
          onClose={() => setIsPairOpen(false)}
          initialTab={pairModalTab}
        />
        <SessionEndedModal />
      </>
    );
  }

  // Standard Table Console (Second Chair) View
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      {/* Top Navigation */}
      <Navbar
        onOpenIntake={() => setIsIntakeOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenNewCase={() => setIsNewCaseOpen(true)}
        onOpenPairModal={handleOpenPairModal}
        onReturnToLanding={onReturnToLanding}
        onOpenTutorial={() => setIsTutorialOpen(true)}
      />

      {/* Real-time Group Question Logger Banner (When Active) */}
      <QuestionLoggerDrawer />

      {/* Main 2-Pane Command Center */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left/Center Workspace: Seating Layout */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          <SeatingBoxView />
        </main>

        {/* Right Collapsible Context Drawer: Juror Profiling & Courtroom Action */}
        <JurorDetailDrawer />
      </div>

      {/* Second Chair Whisper Input & Live Sync Status Bar (only visible when a podium viewer is connected) */}
      {(syncStatus === 'connected_p2p' || syncStatus === 'connected_relay') && connectedPeers.some(p => p.role === 'podium') && (
        <WhisperInputBar onOpenPairModal={handleOpenPairModal} />
      )}

      {/* Modals */}
      <IntakeModal isOpen={isIntakeOpen} onClose={() => setIsIntakeOpen(false)} />
      <StrikeConsoleModal isOpen={isStrikeConsoleOpen} onClose={() => setIsStrikeConsoleOpen(false)} />
      <CaseSettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <NewCaseModal isOpen={isNewCaseOpen} onClose={() => setIsNewCaseOpen(false)} />
      <PairSessionModal
        isOpen={isPairOpen}
        onClose={() => setIsPairOpen(false)}
        initialTab={pairModalTab}
      />
      <SessionEndedModal />

      {/* First-Run & On-Demand Interactive Spotlight Tour */}
      <OnboardingWizard
        isOpen={isTutorialOpen}
        onClose={() => setIsTutorialOpen(false)}
        onLoadDemo={loadDemoCase}
        onCloseIntake={() => setIsIntakeOpen(false)}
        isStrikeConsoleOpen={isStrikeConsoleOpen}
      />
    </div>
  );
};

const MainApp: React.FC = () => {
  const { joinSyncSession, loadDemoCase } = useCase();

  // State-driven (Zero Path) screen selector: 'landing' or 'courtroom'
  const [activeView, setActiveView] = useState<'landing' | 'courtroom'>(() => {
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        // Direct trial pairing from link
        if (params.get('join') || params.get('pin')) return 'courtroom';
        // Explicit demo or view override
        if (params.get('demo') || params.get('view') === 'courtroom' || params.get('view') === 'app') return 'courtroom';
        // Installed standalone PWA launch
        if (
          window.matchMedia('(display-mode: standalone)').matches ||
          (window.navigator as any).standalone === true
        ) {
          return 'courtroom';
        }
        // User preference flag
        if (localStorage.getItem('empanel_screen_pref') === 'courtroom') {
          return 'courtroom';
        }
      }
    } catch (e) {}
    return 'landing';
  });

  // Handle URL ?demo=true auto-load
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('demo') === 'true' || params.get('demo') === '1') {
        loadDemoCase();
      }
    } catch (e) {}
  }, []);

  const handleLaunchApp = () => {
    setActiveView('courtroom');
  };

  const handleLaunchDemo = async () => {
    await loadDemoCase();
    setActiveView('courtroom');
  };

  const handleJoinSession = async (pin: string) => {
    setActiveView('courtroom');
    await joinSyncSession(pin, 'second_chair');
  };

  if (activeView === 'landing') {
    return (
      <LandingPage
        onLaunchApp={handleLaunchApp}
        onLaunchDemo={handleLaunchDemo}
        onJoinSession={handleJoinSession}
      />
    );
  }

  return (
    <CourtroomWorkspace
      onReturnToLanding={() => setActiveView('landing')}
    />
  );
};

export default function App() {
  return (
    <CaseProvider>
      <MainApp />
    </CaseProvider>
  );
}
