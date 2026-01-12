import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface TutorialStep {
  id: number;
  target: string; // ref name to target
  title: string;
  message: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  advanceOn: 'navigation' | 'action' | 'dismiss'; // what triggers advancement
  advanceValue?: string; // e.g., page name for navigation
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
  },
  {
    id: 2,
    target: 'connect-account',
    title: 'Connect Your Account',
    message: 'Connect your account to unlock all features and start investing.',
    position: 'top',
    advanceOn: 'action',
  },
  {
    id: 3,
    target: 'nav-future',
    title: 'Explore Your Future',
    message: 'Calculate potential earnings! Experiment with projections to see how your investments could grow.',
    position: 'top',
    advanceOn: 'navigation',
    advanceValue: 'simulation',
  },
  {
    id: 4,
    target: 'nav-data',
    title: 'Transparency Dashboard',
    message: 'This section provides transparency into TVC operations and metrics. It\'s optional - the platform works fully without viewing it.',
    position: 'top',
    advanceOn: 'dismiss',
  },
  {
    id: 5,
    target: 'nav-contracts',
    title: 'Create Your First Contract',
    message: 'Ready to invest? Create or join contracts here to start your journey.',
    position: 'top',
    advanceOn: 'navigation',
    advanceValue: 'group',
  },
];

interface TutorialContextType {
  currentStep: number;
  isActive: boolean;
  hasSkipped: boolean;
  hasCompleted: boolean;
  currentStepData: TutorialStep | null;
  nextStep: () => void;
  skipTutorial: () => void;
  dismissStep: () => void;
  completeTutorial: () => void;
  resetTutorial: () => void;
  checkAdvancement: (type: 'navigation' | 'action', value?: string) => void;
}

const TutorialContext = createContext<TutorialContextType | null>(null);

const STORAGE_KEYS = {
  skipped: 'tvc_tutorial_skipped',
  completed: 'tvc_tutorial_completed',
  step: 'tvc_tutorial_step',
};

export const TutorialProvider: React.FC<{
  children: React.ReactNode;
  walletConnected: boolean;
}> = ({ children, walletConnected }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [hasSkipped, setHasSkipped] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);

  // Load persisted state on mount
  useEffect(() => {
    const skipped = localStorage.getItem(STORAGE_KEYS.skipped) === 'true';
    const completed = localStorage.getItem(STORAGE_KEYS.completed) === 'true';
    const savedStep = parseInt(localStorage.getItem(STORAGE_KEYS.step) || '0', 10);

    setHasSkipped(skipped);
    setHasCompleted(completed);

    if (!walletConnected && !skipped && !completed) {
      setCurrentStep(savedStep || 1);
      setIsActive(true);
    }
  }, []);

  // Handle wallet connection state changes
  useEffect(() => {
    if (walletConnected) {
      // User connected - if tutorial was active, complete it and clear state
      if (isActive || currentStep > 0) {
        setHasCompleted(true);
        setIsActive(false);
        setCurrentStep(0);
        localStorage.setItem(STORAGE_KEYS.completed, 'true');
        localStorage.removeItem(STORAGE_KEYS.step);
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

  const currentStepData = isActive && currentStep > 0 
    ? TUTORIAL_STEPS.find(s => s.id === currentStep) || null 
    : null;

  const nextStep = useCallback(() => {
    if (currentStep >= TUTORIAL_STEPS.length) {
      completeTutorial();
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
  }, []);

  const dismissStep = useCallback(() => {
    // For steps that advance on dismiss
    nextStep();
  }, [nextStep]);

  const completeTutorial = useCallback(() => {
    setHasCompleted(true);
    setIsActive(false);
    setCurrentStep(0);
    localStorage.setItem(STORAGE_KEYS.completed, 'true');
    localStorage.removeItem(STORAGE_KEYS.step);
  }, []);

  const resetTutorial = useCallback(() => {
    setHasSkipped(false);
    setHasCompleted(false);
    setCurrentStep(1);
    setIsActive(true);
    localStorage.removeItem(STORAGE_KEYS.skipped);
    localStorage.removeItem(STORAGE_KEYS.completed);
    localStorage.removeItem(STORAGE_KEYS.step);
  }, []);

  const checkAdvancement = useCallback((type: 'navigation' | 'action', value?: string) => {
    if (!currentStepData) return;
    
    if (currentStepData.advanceOn === type) {
      if (type === 'navigation' && currentStepData.advanceValue) {
        if (value === currentStepData.advanceValue) {
          nextStep();
        }
      } else if (type === 'action') {
        nextStep();
      }
    }
  }, [currentStepData, nextStep]);

  return (
    <TutorialContext.Provider
      value={{
        currentStep,
        isActive,
        hasSkipped,
        hasCompleted,
        currentStepData,
        nextStep,
        skipTutorial,
        dismissStep,
        completeTutorial,
        resetTutorial,
        checkAdvancement,
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
      nextStep: () => {},
      skipTutorial: () => {},
      dismissStep: () => {},
      completeTutorial: () => {},
      resetTutorial: () => {},
      checkAdvancement: () => {},
    } as TutorialContextType;
  }
  return context;
};
