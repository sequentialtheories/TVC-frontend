import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface TutorialStep {
  id: number;
  displayStep: string; // e.g., "1/6", "2/6" - what shows in the bubble
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
  // ========== BUBBLE 1/6: Welcome & Wallet ==========
  {
    id: 1,
    displayStep: '1/6',
    target: 'nav-wallet',
    title: 'Welcome',
    message: 'Good to have you here. The Wallet tab is where you can set up your account and get started.',
    position: 'top',
    advanceOn: 'navigation',
    advanceValue: 'personal',
    requiredPage: 'home',
  },
  {
    id: 2,
    displayStep: '1/6',
    target: 'connect-account',
    title: 'Connect Your Account',
    message: 'This is where you create your account. Once connected, you\'ll have a secure wallet ready to go.',
    position: 'top',
    advanceOn: 'action',
    requiredPage: 'personal',
    prerequisite: { type: 'visited-page', value: 'personal' },
  },
  
  // ========== BUBBLE 2/6: Future Page ==========
  {
    id: 3,
    displayStep: '2/6',
    target: 'nav-future',
    title: 'View Projections',
    message: 'The Future tab lets you explore how your deposits could grow over time. Worth a look.',
    position: 'top',
    advanceOn: 'navigation',
    advanceValue: 'simulation',
    requiredPage: 'personal',
    prerequisite: { type: 'completed-step', value: 2 },
  },
  {
    id: 4,
    displayStep: '2/6',
    target: 'future-page-intro',
    title: 'Future Projections',
    message: 'Here you\'ll find three investment "Strands," each with its own earnings rate. Feel free to adjust the numbers and see how different scenarios play out.',
    position: 'bottom',
    advanceOn: 'dismiss',
    requiredPage: 'simulation',
    prerequisite: { type: 'visited-page', value: 'simulation' },
  },
  
  // ========== BUBBLE 3/6: Data Page ==========
  {
    id: 5,
    displayStep: '3/6',
    target: 'nav-data',
    title: 'Transparency',
    message: 'If you\'re interested in the details, the Data page shows fund distributions and live rates. It\'s there whenever you want a closer look.',
    position: 'top',
    advanceOn: 'navigation',
    advanceValue: 'dataset',
    requiredPage: 'simulation',
    prerequisite: { type: 'completed-step', value: 4 },
  },
  
  // ========== BUBBLE 4/6: Contracts Page ==========
  {
    id: 6,
    displayStep: '4/6',
    target: 'nav-contracts',
    title: 'Contracts',
    message: 'The Contracts tab is where you can see what\'s available and find the right fit.',
    position: 'top',
    advanceOn: 'navigation',
    advanceValue: 'group',
    requiredPage: 'dataset',
    prerequisite: { type: 'completed-step', value: 5 },
  },
  {
    id: 7,
    displayStep: '4/6',
    target: 'contracts-directory',
    title: 'Club Directory',
    message: 'From here, you can either create your own contract or browse existing ones to join. Either path works—it\'s up to you.',
    position: 'bottom',
    advanceOn: 'dismiss',
    requiredPage: 'group',
    prerequisite: { type: 'visited-page', value: 'group' },
  },
  
  // ========== BUBBLE 5/6: Homepage & Sequence Theory ==========
  {
    id: 8,
    displayStep: '5/6',
    target: 'nav-home',
    title: 'Back to Home',
    message: 'A couple more things to show you on the Homepage.',
    position: 'top',
    advanceOn: 'navigation',
    advanceValue: 'home',
    requiredPage: 'group',
    prerequisite: { type: 'completed-step', value: 7 },
  },
  {
    id: 9,
    displayStep: '5/6',
    target: 'sequence-theory-btn',
    title: 'About Us',
    message: 'If you\'d like to learn more about the company and team behind this, the Sequence Theory link has all the details.',
    position: 'bottom',
    advanceOn: 'dismiss',
    requiredPage: 'home',
    prerequisite: { type: 'visited-page', value: 'home' },
  },
  
  // ========== BUBBLE 6/6: Contract Details on Homepage ==========
  {
    id: 10,
    displayStep: '6/6',
    target: 'home-contract-section',
    title: 'Your Overview',
    message: 'This is your home base—contract value, progress, and how your deposits are distributed. You\'re all set to explore.',
    position: 'top',
    advanceOn: 'dismiss',
    requiredPage: 'home',
    prerequisite: { type: 'completed-step', value: 9 },
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
      // User connected - if we were on step 2 (connect account), advance to step 3
      if (isActive && currentStep === 2) {
        // Mark step 2 as completed and advance to step 3
        setCompletedSteps(prev => new Set([...prev, 2]));
        setCurrentStep(3);
        localStorage.setItem(STORAGE_KEYS.step, '3');
      } else if (currentStep === 0 && !hasCompleted && !hasSkipped) {
        // User was already connected (e.g., returning user) - mark tutorial as completed
        setHasCompleted(true);
        setIsActive(false);
        localStorage.setItem(STORAGE_KEYS.completed, 'true');
      }
    } else if (!hasSkipped && !hasCompleted) {
      // User disconnected and hasn't skipped/completed - activate tutorial
      if (currentStep === 0) {
        setCurrentStep(1);
      }
      setIsActive(true);
    }
    // Only depend on walletConnected to avoid loops
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
    // Get the current step regardless of visibility
    const stepData = TUTORIAL_STEPS.find(s => s.id === currentStep);
    if (!stepData || !isActive) return;
    
    if (stepData.advanceOn === type) {
      if (type === 'navigation' && stepData.advanceValue) {
        if (value === stepData.advanceValue) {
          console.log('[Tutorial] Advancing from step', currentStep, 'via navigation to', value);
          nextStep();
        }
      } else if (type === 'action') {
        console.log('[Tutorial] Advancing from step', currentStep, 'via action');
        nextStep();
      }
    }
  }, [currentStep, isActive, nextStep]);

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = React.useMemo(() => ({
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
  }), [
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
    // setAuthModalOpen is stable as it's a state setter
  ]);

  return (
    <TutorialContext.Provider value={contextValue}>
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
