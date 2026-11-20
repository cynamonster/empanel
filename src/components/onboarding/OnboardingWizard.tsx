import React, { useState, useEffect, useRef } from 'react';
import {
  Scale,
  Users,
  Hand,
  Radio,
  ArrowLeft,
  X,
  Sparkles,
  ChevronRight,
  MousePointerClick,
  UserPlus,
  SlidersHorizontal,
  FileText
} from 'lucide-react';
import { useCase } from '../../context/CaseContext';

interface OnboardingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadDemo: () => void;
  onCloseIntake?: () => void;
  isStrikeConsoleOpen?: boolean;
}

interface TourStep {
  id: string;
  targetSelector: string;
  fallbackSelector?: string;
  title: string;
  subtitle: string;
  description: string;
  actionHint: string;
  icon: React.ReactNode;
  placement?: 'bottom' | 'top' | 'left' | 'right';
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  isOpen,
  onClose,
  onLoadDemo,
  onCloseIntake,
}) => {
  const {
    jurors,
    selectedJurorId,
    setSelectedJurorId,
    activeQuestionId,
    setActiveQuestionId,
    questions,
    addQuestion,
  } = useCase();

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRects, setTargetRects] = useState<DOMRect[]>([]);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number; arrowPlacement: string }>({
    top: 100,
    left: 100,
    arrowPlacement: 'top',
  });

  const prevSelectedJurorRef = useRef<string | null>(selectedJurorId);
  const prevQuestionActiveRef = useRef<boolean>(!!activeQuestionId);
  const currentJurorRating = jurors.find((j) => j.id === selectedJurorId)?.rating;
  const prevJurorRatingRef = useRef<number | undefined>(currentJurorRating);

  // Dynamic tour steps
  const steps: TourStep[] = [
    {
      id: 'intake',
      targetSelector: '[data-tour="intake-btn"]',
      title: 'Juror Roster Intake',
      subtitle: 'Import Courtroom Pool',
      description:
        'Start here to import juror lists from a clerk\'s CSV file or add prospective jurors manually. Clicking Next will populate sample trial data for the walkthrough.',
      actionHint: 'Click Next to load sample trial data',
      icon: <UserPlus className="w-4 h-4 text-emerald-400" />,
      placement: 'bottom' as const,
    },
    {
      id: 'gallery-controls',
      targetSelector: '[data-tour="gallery-controls"]',
      fallbackSelector: '[data-tour="jury-pool"]',
      title: 'Courtroom Geometry & Aisles',
      subtitle: 'Aisle & Column Adjusters',
      description:
        'Configure physical courtroom geometry: toggle central aisle splits (Aisle ON/OFF) and adjust gallery column count to match your courtroom benches.',
      actionHint: 'Click Next to continue',
      icon: <SlidersHorizontal className="w-4 h-4 text-indigo-400" />,
      placement: 'top' as const,
    },
    {
      id: 'jury-box',
      targetSelector: '[data-panel-card-id]',
      fallbackSelector: '[data-tour="jury-box"]',
      title: 'Courtroom Jury Box',
      subtitle: 'Spatial Seating & Juror Cards',
      description:
        'This is your active jury box. Each card displays seat number, juror badge, name, and tactical favorability. Click on any seated juror to inspect their detailed profile.',
      actionHint: 'Click any juror card (or click Next to auto-open)',
      icon: <Users className="w-4 h-4 text-indigo-400" />,
      placement: 'bottom' as const,
    },
    {
      id: 'juror-drawer',
      targetSelector: '[data-tour="rating-section"]',
      fallbackSelector: '[data-tour="juror-drawer"]',
      title: 'Tactical Sentiment Rating',
      subtitle: 'Score Jurors from -3 to +3',
      description:
        'Rate juror favorability on a 7-point scale: -3 (Favors Opponent), 0 (Neutral), or +3 (Favors Our Side). You can also designate strike intent (Peremptory vs. Cause).',
      actionHint: 'Click a rating score or press Next',
      icon: <Sparkles className="w-4 h-4 text-emerald-400" />,
      placement: 'left' as const,
    },
    {
      id: 'juror-notes',
      targetSelector: '[data-tour="juror-notes"]',
      fallbackSelector: '[data-tour="juror-drawer"]',
      title: 'General Notes & Observations',
      subtitle: 'Document Real-Time Demeanor',
      description:
        'Record real-time impressions, quotes during questioning, and specific body language cues. Notes auto-save directly to local storage.',
      actionHint: 'Click Next to continue',
      icon: <FileText className="w-4 h-4 text-indigo-400" />,
      placement: 'left' as const,
    },
    {
      id: 'question-logger',
      targetSelector: '[data-tour="question-logger-btn"]',
      title: 'Group Question Mode',
      subtitle: 'Open Hand-Raise Logger',
      description:
        'When asking broad questions to the venire ("Raise your hand if..."), click the Question button in the top bar to toggle the Question Logger.',
      actionHint: 'Click the hand in the top bar to continue',
      icon: <Hand className="w-4 h-4 text-amber-400" />,
      placement: 'bottom' as const,
    },
    {
      id: 'pool-hand-raise',
      targetSelector: '[data-tour="jury-pool"]',
      title: 'Try Raising Juror Hands',
      subtitle: 'Interactive Hand-Raise Practice',
      description:
        'With Question mode active, try clicking on some juror cards in the pool to raise or lower their hands (marked in amber). Tap the hand badge on any card to add a comment explaining their response.',
      actionHint: 'Click on juror cards to practice, then click Next',
      icon: <Hand className="w-4 h-4 text-amber-400" />,
      placement: 'bottom' as const,
    },
    {
      id: 'podium-pairing',
      targetSelector: '[data-tour="pair-btn"]',
      title: 'Lead Counsel Podium Pairing',
      subtitle: 'Zero-Knowledge E2EE Prompter Sync',
      description:
        'Pair Lead Counsel\'s smartphone or iPad at the lectern with a 4-letter PIN. Second Chair can send silent whisper cues live from counsel table during questioning.',
      actionHint: 'Click Finish Tour to start your session',
      icon: <Radio className="w-4 h-4 text-indigo-400" />,
      placement: 'bottom' as const,
    },
  ];

  const currentStep = steps[Math.min(currentStepIndex, steps.length - 1)];

  // Auto-progress when user completes an interactive action
  useEffect(() => {
    if (!isOpen || !currentStep) return;

    // If on jury-box step and user selected a juror
    if (currentStep.id === 'jury-box' && selectedJurorId && !prevSelectedJurorRef.current) {
      setCurrentStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
    }
    prevSelectedJurorRef.current = selectedJurorId;

    // If on juror-drawer step and user clicked a rating score
    if (
      currentStep.id === 'juror-drawer' &&
      currentJurorRating !== undefined &&
      prevJurorRatingRef.current !== undefined &&
      currentJurorRating !== prevJurorRatingRef.current
    ) {
      setCurrentStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
    }
    prevJurorRatingRef.current = currentJurorRating;

    // If on question-logger step and user clicked Question button to open logger
    if (currentStep.id === 'question-logger' && activeQuestionId && !prevQuestionActiveRef.current) {
      setCurrentStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
    }
    prevQuestionActiveRef.current = !!activeQuestionId;
  }, [isOpen, currentStep?.id, selectedJurorId, activeQuestionId, currentJurorRating, steps.length]);

  // Handle specific step actions (scrolling into view, ensuring activeQuestionId on Step 7)
  useEffect(() => {
    if (!isOpen || !currentStep) return;

    if (currentStep.id === 'gallery-controls' || currentStep.id === 'pool-hand-raise') {
      // Animate scroll down to show the Jury Pool / gallery
      const poolEl = document.querySelector('[data-tour="jury-pool"]');
      if (poolEl) {
        poolEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      // Ensure Question mode is actively engaged on Step 7
      if (currentStep.id === 'pool-hand-raise') {
        setSelectedJurorId(null);
        if (!activeQuestionId || activeQuestionId === 'new') {
          if (questions && questions.length > 0) {
            setActiveQuestionId(questions[0].id);
          } else {
            addQuestion('Have you or a family member ever had experience with law enforcement?').then((newQ) => {
              if (newQ?.id) setActiveQuestionId(newQ.id);
            });
          }
        }
      }
    } else if (currentStep.id === 'jury-box') {
      // Scroll back up to the Jury Box
      const boxEl = document.querySelector('[data-tour="jury-box"]');
      if (boxEl) {
        boxEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } else if (currentStep.id === 'juror-notes') {
      // Scroll the drawer down to highlight the notes section
      const notesEl = document.querySelector('[data-tour="juror-notes"]');
      if (notesEl) {
        notesEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [isOpen, currentStep?.id, activeQuestionId, questions, setActiveQuestionId, addQuestion]);

  // Update target rects and position tooltip with guaranteed clearance
  useEffect(() => {
    if (!isOpen || !currentStep) return;

    const updatePosition = () => {
      // On Step 7 (pool-hand-raise), don't draw any focus borders or dim the screen;
      // float the guidance tooltip cleanly in the top-right corner below the navbar / logger banner
      if (currentStep.id === 'pool-hand-raise') {
        setTargetRects([]);
        const tooltipWidth = Math.min(380, window.innerWidth - 32);
        const left = Math.max(16, window.innerWidth - tooltipWidth - 24);
        const loggerEl = document.querySelector('[data-question-logger]');
        const navbarEl = document.querySelector('[data-navbar]');
        let top = 80;
        if (loggerEl) {
          top = loggerEl.getBoundingClientRect().bottom + 16;
        } else if (navbarEl) {
          top = navbarEl.getBoundingClientRect().bottom + 16;
        }
        setTooltipPos({ top, left, arrowPlacement: 'none' });
        return;
      }

      let targetEl = document.querySelector(currentStep.targetSelector) as HTMLElement | null;
      if (!targetEl && currentStep.fallbackSelector) {
        targetEl = document.querySelector(currentStep.fallbackSelector) as HTMLElement | null;
      }

      if (!targetEl) {
        setTargetRects([]);
        return;
      }

      const rect = targetEl.getBoundingClientRect();
      setTargetRects([rect]);

      // Tooltip dimensions
      const tooltipWidth = Math.min(380, window.innerWidth - 32);
      const tooltipHeight = 220;
      const margin = 16;

      let top = 0;
      let left = 0;
      let arrowPlacement = 'top';

      const preferredPlacement = currentStep.placement || 'bottom';

      if (preferredPlacement === 'top') {
        // Only place above if there is sufficient space without covering the buttons
        if (rect.top >= tooltipHeight + margin + 20) {
          top = rect.top - tooltipHeight - margin;
          arrowPlacement = 'bottom';
        } else {
          // Flip to below the target to prevent covering it
          top = rect.bottom + margin;
          arrowPlacement = 'top';
        }
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
      } else if (preferredPlacement === 'bottom') {
        // Check if there is enough space below without overflowing the screen
        if (rect.bottom + tooltipHeight + margin <= window.innerHeight - 20) {
          top = rect.bottom + margin;
          arrowPlacement = 'top';
        } else {
          // Flip to above the target
          top = Math.max(16, rect.top - tooltipHeight - margin);
          arrowPlacement = 'bottom';
        }
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
      } else if (preferredPlacement === 'left') {
        if (rect.left >= tooltipWidth + margin + 20) {
          left = rect.left - tooltipWidth - margin;
          top = Math.max(16, rect.top - 20);
          arrowPlacement = 'right';
        } else {
          left = Math.min(window.innerWidth - tooltipWidth - 16, rect.right + margin);
          top = Math.max(16, rect.top - 20);
          arrowPlacement = 'left';
        }
      } else {
        left = rect.right + margin;
        top = Math.max(16, rect.top - 20);
        arrowPlacement = 'left';
      }

      // Clamp left and top to keep entirely within the visible viewport
      left = Math.max(16, Math.min(window.innerWidth - tooltipWidth - 16, left));
      top = Math.max(16, Math.min(window.innerHeight - tooltipHeight - 16, top));

      setTooltipPos({ top, left, arrowPlacement });
    };

    updatePosition();
    const interval = setInterval(updatePosition, 300);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, currentStep, currentStepIndex]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        if (currentStep.id !== 'question-logger') {
          handleNext();
        }
      } else if (e.key === 'ArrowLeft') {
        handleBack();
      } else if (e.key === 'Escape') {
        handleDismiss();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentStepIndex, steps.length, jurors, selectedJurorId, currentStep?.id]);

  if (!isOpen || !currentStep) return null;

  const handleDismiss = () => {
    try {
      localStorage.setItem('empanel_onboarding_completed', 'true');
    } catch (e) {}
    onClose();
  };

  const handleNext = async () => {
    // If advancing from intake step: close intake modal and ensure demo case is loaded
    if (currentStep.id === 'intake') {
      onCloseIntake?.();
      if (jurors.length === 0) {
        await onLoadDemo();
      }
    }

    // If advancing from jury-box step without selecting a juror, auto-select first juror to open drawer
    if (currentStep.id === 'jury-box' && !selectedJurorId) {
      const firstJuror = jurors.find((j) => j.seatNumber) || jurors[0];
      if (firstJuror) {
        setSelectedJurorId(firstJuror.id);
      }
    }

    // If advancing from juror drawer steps to question-logger, close drawer
    if (currentStep.id === 'juror-notes') {
      setSelectedJurorId(null);
    }

    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      handleDismiss();
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  return (
    <>
      {/* Spotlight Cutout Overlays:
          Only rendered for steps other than Step 7.
          On Step 7, no focus border and no darkened overlay is used so the screen remains completely un-dimmed. */}
      {currentStep.id !== 'pool-hand-raise' &&
        targetRects.map((rect, idx) => (
          <div
            key={idx}
            className="fixed transition-all duration-300 ease-out pointer-events-none rounded-xl"
            style={{
              top: rect.top - 6,
              left: rect.left - 6,
              width: rect.width + 12,
              height: rect.height + 12,
              boxShadow:
                idx === 0
                  ? '0 0 0 9999px rgba(2, 6, 23, 0.78), 0 0 24px rgba(99, 102, 241, 0.7)'
                  : '0 0 24px rgba(99, 102, 241, 0.7)',
              border: '2px solid rgba(129, 140, 248, 0.95)',
              zIndex: 45,
            }}
          />
        ))}

      {/* If no target found and not step 7, render a darkened backdrop */}
      {currentStep.id !== 'pool-hand-raise' && targetRects.length === 0 && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-40 transition-opacity" />
      )}

      {/* Floating Interactive Tooltip Popover */}
      <div
        className="fixed z-50 w-[360px] max-w-[calc(100vw-32px)] bg-slate-900 border border-indigo-500/50 rounded-2xl shadow-2xl shadow-indigo-950/80 text-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        style={{
          top: tooltipPos.top,
          left: tooltipPos.left,
        }}
      >
        {/* Header Bar */}
        <div className="px-4 py-3 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-indigo-500/20 border border-indigo-500/30 rounded-lg text-indigo-400">
              {currentStep.icon}
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-400 block">
                Step {currentStepIndex + 1} of {steps.length}
              </span>
              <h4 className="text-sm font-bold text-white tracking-tight leading-none">
                {currentStep.title}
              </h4>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="Exit Tour (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tooltip Body */}
        <div className="p-4 space-y-3 text-left">
          <p className="text-xs text-slate-300 leading-relaxed">
            {currentStep.description}
          </p>

          {/* Action Prompt Pill */}
          <div className="flex items-center space-x-2 p-2 rounded-xl bg-indigo-950/60 border border-indigo-800/60 text-indigo-200 text-xs font-medium">
            <MousePointerClick className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0 animate-bounce" />
            <span className="truncate">{currentStep.actionHint}</span>
          </div>
        </div>

        {/* Footer Navigation Bar */}
        <div className="px-4 py-2.5 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between">
          {/* Step Progress Dots */}
          <div className="flex items-center space-x-1">
            {steps.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentStepIndex(idx)}
                className={`h-1.5 rounded-full transition-all ${
                  idx === currentStepIndex ? 'w-4 bg-indigo-500' : 'w-1.5 bg-slate-700'
                }`}
                title={`Go to step ${idx + 1}`}
              />
            ))}
          </div>

          <div className="flex items-center space-x-2">
            {currentStepIndex > 0 && (
              <button
                onClick={handleBack}
                className="px-2.5 py-1 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors flex items-center space-x-1"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>Back</span>
              </button>
            )}

            {/* Next button is omitted on Step 6 so user MUST click the Question button */}
            {currentStep.id !== 'question-logger' && (
              <button
                onClick={handleNext}
                className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30 transition-all flex items-center space-x-1"
              >
                <span>{currentStepIndex === steps.length - 1 ? 'Finish Tour' : 'Next'}</span>
                {currentStepIndex < steps.length - 1 && <ChevronRight className="w-3 h-3" />}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
