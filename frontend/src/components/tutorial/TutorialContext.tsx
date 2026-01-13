import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface TutorialStep {
  id: number;
  target: string; // ref name to target
  title: string;
  message: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  advanceOn: 'navigation' | 'action' | 'dismiss'; // what triggers advancement
  advanceValue?: string; // e.g., page name for navigation
  requiredPage?: string; // page that must be active for this step to show
  prerequisite?: {
    type: 'visited-page' | 'completed-step';
    value: string | number;
  };
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 1,
    target: 'nav-wallet',
    title: 'Welcome to The Vault Club!',
    message: 'Start here! Tap the Wallet tab to manage your account and connect.',
    position: 'top',
    advanceOn: 'navigation',
    advanceValue: 'personal',
    requiredPage: 'home', // Only show on home page
  },
  {
    id: 2,
    target: 'connect-account',
    title: 'Connect Your Account',
    message: 'Connect your account to unlock all features and start investing.',
    position: 'top',
    advanceOn: 'action',
    requiredPage: 'personal', // Only show on personal/wallet page
    prerequisite: { type: 'visited-page', value: 'personal' },
  },
  {
    id: 3,
    target: 'nav-future',
    title: 'Explore Your Future',
    message: 'Calculate potential earnings! Experiment with projections to see how your investments could grow.',
    position: 'top',
    advanceOn: 'navigation',
    advanceValue: 'simulation',
    requiredPage: 'home', // Show on home page (navigate from here)
    prerequisite: { type: 'visited-page', value: 'personal' },
  },
  {
    id: 4,
    target: 'nav-data',
    title: 'Transparency Dashboard',
    message: 'This section provides transparency into TVC operations and metrics. It\'s optional - the platform works fully without viewing it.',
    position: 'top',
    advanceOn: 'dismiss',
    requiredPage: 'simulation', // Show on simulation page
    prerequisite: { type: 'visited-page', value: 'simulation' },
  },
  {
    id: 5,
    target: 'nav-contracts',
    title: 'Create Your First Contract',
    message: 'Ready to invest? Create or join contracts here to start your journey.',
    position: 'top',
    advanceOn: 'navigation',
    advanceValue: 'group',
    requiredPage: 'simulation', // Show on simulation page (navigate from here)
    prerequisite: { type: 'completed-step', value: 4 },
  },
];

interface TutorialContextType {
  currentStep: number;
  isActive: boolean;
  hasSkipped: boolean;
  hasCompleted: boolean;
  currentStepData: TutorialStep | null;
  shouldShowBubble: boolean;
  nextStep: () => void;
  skipTutorial: () => void;
  dismissStep: () => void;
  completeTutorial: () => void;
  resetTutorial: () => void;
  checkAdvancement: (type: 'navigation' | 'action', value?: string) => void;
  setCurrentPage: (page: string) => void;
  setAuthModalOpen: (open: boolean) => void;
}

const TutorialContext = createContext<TutorialContextType | null>(null);

const STORAGE_KEYS = {
  skipped: 'tvc_tutorial_skipped',
  completed: 'tvc_tutorial_completed',
  step: 'tvc_tutorial_step',
  visitedPages: 'tvc_tutorial_visited_pages',
  completedSteps: 'tvc_tutorial_completed_steps',
};

export const TutorialProvider: React.FC<{
  children: React.ReactNode;
  walletConnected: boolean;
}> = ({ children, walletConnected }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [hasSkipped, setHasSkipped] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);
  const [currentPage, setCurrentPageState] = useState('home');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [visitedPages, setVisitedPages] = useState<Set<string>>(new Set(['home']));
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  // Load persisted state on mount
  useEffect(() => {
    const skipped = localStorage.getItem(STORAGE_KEYS.skipped) === 'true';
    const completed = localStorage.getItem(STORAGE_KEYS.completed) === 'true';
    const savedStep = parseInt(localStorage.getItem(STORAGE_KEYS.step) || '0', 10);
    const savedVisited = JSON.parse(localStorage.getItem(STORAGE_KEYS.visitedPages) || '["home"]');
    const savedCompleted = JSON.parse(localStorage.getItem(STORAGE_KEYS.completedSteps) || '[]');

    setHasSkipped(skipped);
    setHasCompleted(completed);
    setVisitedPages(new Set(savedVisited));
    setCompletedSteps(new Set(savedCompleted));

    if (!walletConnected && !skipped && !completed) {
      setCurrentStep(savedStep || 1);
      setIsActive(true);
    }
  }, []);

  // Handle wallet connection state changes
  useEffect(() => {
    if (walletConnected) {
      // User connected - complete tutorial and clear state
      if (isActive || currentStep > 0) {
        setHasCompleted(true);
        setIsActive(false);
        setCurrentStep(0);
        localStorage.setItem(STORAGE_KEYS.completed, 'true');
        localStorage.removeItem(STORAGE_KEYS.step);
        localStorage.removeItem(STORAGE_KEYS.visitedPages);
        localStorage.removeItem(STORAGE_KEYS.completedSteps);
      }
    } else if (!hasSkipped && !hasCompleted) {
      // User disconnected and hasn't skipped/completed - activate tutorial
      if (currentStep === 0) {
        setCurrentStep(1);
      }
      setIsActive(true);
    }
  }, [walletConnected]);

  // Save step progress
  useEffect(() => {
    if (currentStep > 0) {
      localStorage.setItem(STORAGE_KEYS.step, currentStep.toString());
    }
  }, [currentStep]);

  // Save visited pages
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.visitedPages, JSON.stringify(Array.from(visitedPages)));
  }, [visitedPages]);

  // Save completed steps
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.completedSteps, JSON.stringify(Array.from(completedSteps)));
  }, [completedSteps]);

  // Track page visits
  const setCurrentPage = useCallback((page: string) => {
    setCurrentPageState(page);
    setVisitedPages(prev => new Set([...prev, page]));
  }, []);

  // Check if prerequisite is met for a step
  const isPrerequisiteMet = useCallback((step: TutorialStep): boolean => {
    if (!step.prerequisite) return true;
    
    if (step.prerequisite.type === 'visited-page') {
      return visitedPages.has(step.prerequisite.value as string);
    }
    
    if (step.prerequisite.type === 'completed-step') {
      return completedSteps.has(step.prerequisite.value as number);
    }
    
    return true;
  }, [visitedPages, completedSteps]);

  // Get current step data, checking if it should be shown
  const rawStepData = isActive && currentStep > 0 
    ? TUTORIAL_STEPS.find(s => s.id === currentStep) || null 
    : null;

  // Determine if bubble should actually be visible
  const shouldShowBubble = (() => {
    // Don't show if auth modal is open
    if (authModalOpen) return false;
    
    // Don't show if no step data
    if (!rawStepData) return false;
    
    // Don't show if not on the required page
    if (rawStepData.requiredPage && rawStepData.requiredPage !== currentPage) return false;
    
    // Don't show if prerequisite not met
    if (!isPrerequisiteMet(rawStepData)) return false;
    
    return true;
  })();

  // Only expose step data when it should actually be shown
  const currentStepData = shouldShowBubble ? rawStepData : null;

  const nextStep = useCallback(() => {
    // Mark current step as completed
    setCompletedSteps(prev => new Set([...prev, currentStep]));
    
    if (currentStep >= TUTORIAL_STEPS.length) {
      setHasCompleted(true);
      setIsActive(false);
      setCurrentStep(0);
      localStorage.setItem(STORAGE_KEYS.completed, 'true');
      localStorage.removeItem(STORAGE_KEYS.step);
    } else {
      setCurrentStep(prev => prev + 1);
    }
  }, [currentStep]);

  const skipTutorial = useCallback(() => {
    setHasSkipped(true);
    setIsActive(false);
    setCurrentStep(0);
    localStorage.setItem(STORAGE_KEYS.skipped, 'true');
    localStorage.removeItem(STORAGE_KEYS.step);
    localStorage.removeItem(STORAGE_KEYS.visitedPages);
    localStorage.removeItem(STORAGE_KEYS.completedSteps);
  }, []);

  const dismissStep = useCallback(() => {
    // Only advance if this step is specifically designed to advance on dismiss
    if (rawStepData?.advanceOn === 'dismiss') {
      nextStep();
    }
    // For other step types, X just hides the bubble temporarily
    // (it will reappear when conditions are met again, or stay hidden if conditions change)
  }, [rawStepData, nextStep]);

  const completeTutorial = useCallback(() => {
    setHasCompleted(true);
    setIsActive(false);
    setCurrentStep(0);
    localStorage.setItem(STORAGE_KEYS.completed, 'true');
    localStorage.removeItem(STORAGE_KEYS.step);
    localStorage.removeItem(STORAGE_KEYS.visitedPages);
    localStorage.removeItem(STORAGE_KEYS.completedSteps);
  }, []);

  const resetTutorial = useCallback(() => {
    setHasSkipped(false);
    setHasCompleted(false);
    setCurrentStep(1);
    setIsActive(true);
    setVisitedPages(new Set(['home']));
    setCompletedSteps(new Set());
    localStorage.removeItem(STORAGE_KEYS.skipped);
    localStorage.removeItem(STORAGE_KEYS.completed);
    localStorage.removeItem(STORAGE_KEYS.step);
    localStorage.removeItem(STORAGE_KEYS.visitedPages);
    localStorage.removeItem(STORAGE_KEYS.completedSteps);
  }, []);

  const checkAdvancement = useCallback((type: 'navigation' | 'action', value?: string) => {
    if (!rawStepData || !shouldShowBubble) return;
    
    if (rawStepData.advanceOn === type) {
      if (type === 'navigation' && rawStepData.advanceValue) {
        if (value === rawStepData.advanceValue) {
          nextStep();
        }
      } else if (type === 'action') {
        nextStep();
      }
    }
  }, [rawStepData, shouldShowBubble, nextStep]);

  return (
    <TutorialContext.Provider
      value={{
        currentStep,
        isActive,
        hasSkipped,
        hasCompleted,
        currentStepData,
        shouldShowBubble,
        nextStep,
        skipTutorial,
        dismissStep,
        completeTutorial,
        resetTutorial,
        checkAdvancement,
        setCurrentPage,
        setAuthModalOpen,
      }}
    >
      {children}
    </TutorialContext.Provider>
  );
};

export const useTutorial = () => {
  const context = useContext(TutorialContext);
  if (!context) {
    // Return a safe default when used outside provider (prevents crashes during initial render)
    return {
      currentStep: 0,
      isActive: false,
      hasSkipped: false,
      hasCompleted: false,
      currentStepData: null,
      shouldShowBubble: false,
      nextStep: () => {},
      skipTutorial: () => {},
      dismissStep: () => {},
      completeTutorial: () => {},
      resetTutorial: () => {},
      checkAdvancement: () => {},
      setCurrentPage: () => {},
      setAuthModalOpen: () => {},
    } as TutorialContextType;
  }
  return context;
};
