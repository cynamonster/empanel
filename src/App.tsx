import React, { useState } from 'react';
import { CaseProvider, useCase } from './context/CaseContext';
import { Navbar } from './components/layout/Navbar';
import { SeatingBoxView } from './components/seating/SeatingBoxView';
import { SeatingGridView } from './components/seating/SeatingGridView';
import { JurorDetailDrawer } from './components/drawer/JurorDetailDrawer';
import { QuestionLoggerDrawer } from './components/drawer/QuestionLoggerDrawer';
import { IntakeModal } from './components/modals/IntakeModal';
import { StrikeConsoleModal } from './components/modals/StrikeConsoleModal';
import { CaseSettingsModal } from './components/modals/CaseSettingsModal';
import { NewCaseModal } from './components/modals/NewCaseModal';

const CourtroomWorkspace: React.FC = () => {
  const { activeCase, selectedJurorId } = useCase();

  const [isIntakeOpen, setIsIntakeOpen] = useState(false);
  const [isStrikeConsoleOpen, setIsStrikeConsoleOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNewCaseOpen, setIsNewCaseOpen] = useState(false);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      {/* Top Navigation */}
      <Navbar
        onOpenIntake={() => setIsIntakeOpen(true)}
        onOpenStrikeConsole={() => setIsStrikeConsoleOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenNewCase={() => setIsNewCaseOpen(true)}
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

      {/* Modals */}
      <IntakeModal isOpen={isIntakeOpen} onClose={() => setIsIntakeOpen(false)} />
      <StrikeConsoleModal isOpen={isStrikeConsoleOpen} onClose={() => setIsStrikeConsoleOpen(false)} />
      <CaseSettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <NewCaseModal isOpen={isNewCaseOpen} onClose={() => setIsNewCaseOpen(false)} />
    </div>
  );
};

export default function App() {
  return (
    <CaseProvider>
      <CourtroomWorkspace />
    </CaseProvider>
  );
}
