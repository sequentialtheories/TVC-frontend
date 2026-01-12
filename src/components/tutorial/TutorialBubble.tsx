import React, { useEffect, useState, useRef } from 'react';
import { X } from 'lucide-react';
import { useTutorial, TUTORIAL_STEPS } from './TutorialContext';

interface TutorialBubbleProps {
  targetRef: React.RefObject<HTMLElement>;
}

export const TutorialBubble: React.FC<TutorialBubbleProps> = ({ targetRef }) => {
  const { currentStepData, currentStep, dismissStep, skipTutorial, shouldShowBubble } = useTutorial();
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const bubbleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Don't show if conditions aren't met
    if (!shouldShowBubble || !currentStepData || !targetRef.current) {
      setIsVisible(false);
      return;
    }

    const updatePosition = () => {
      const targetRect = targetRef.current?.getBoundingClientRect();
      const bubbleRect = bubbleRef.current?.getBoundingClientRect();
      
      if (!targetRect) return;

      const bubbleWidth = bubbleRect?.width || 320;
      const bubbleHeight = bubbleRect?.height || 150;
      const padding = 12;
      const arrowOffset = 16;

      let top = 0;
      let left = 0;

      switch (currentStepData.position) {
        case 'top':
          top = targetRect.top - bubbleHeight - padding - arrowOffset;
          left = targetRect.left + targetRect.width / 2 - bubbleWidth / 2;
          break;
        case 'bottom':
          top = targetRect.bottom + padding + arrowOffset;
          left = targetRect.left + targetRect.width / 2 - bubbleWidth / 2;
          break;
        case 'left':
          top = targetRect.top + targetRect.height / 2 - bubbleHeight / 2;
          left = targetRect.left - bubbleWidth - padding - arrowOffset;
          break;
        case 'right':
          top = targetRect.top + targetRect.height / 2 - bubbleHeight / 2;
          left = targetRect.right + padding + arrowOffset;
          break;
      }

      // Keep bubble within viewport
      const viewportPadding = 16;
      left = Math.max(viewportPadding, Math.min(left, window.innerWidth - bubbleWidth - viewportPadding));
      top = Math.max(viewportPadding, Math.min(top, window.innerHeight - bubbleHeight - viewportPadding));

      setPosition({ top, left });
      setIsVisible(true);
    };

    // Initial position update with a small delay to ensure refs are ready
    const timer = setTimeout(updatePosition, 100);
    
    // Update on resize/scroll
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [currentStepData, targetRef, shouldShowBubble]);

  // Don't render anything if bubble shouldn't show
  if (!shouldShowBubble || !currentStepData) return null;

  const isFirstStep = currentStep === 1;
  const totalSteps = TUTORIAL_STEPS.length;

  const getArrowStyles = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: 'absolute',
      width: '16px',
      height: '16px',
      transform: 'rotate(45deg)',
      background: 'linear-gradient(145deg, hsl(225 22% 18%), hsl(225 22% 14%))',
      borderColor: 'hsl(258 75% 65% / 0.3)',
    };
    
    switch (currentStepData.position) {
      case 'top':
        return { ...base, bottom: '-8px', left: '50%', marginLeft: '-8px', borderRight: '1px solid', borderBottom: '1px solid', borderTop: 'none', borderLeft: 'none' };
      case 'bottom':
        return { ...base, top: '-8px', left: '50%', marginLeft: '-8px', borderLeft: '1px solid', borderTop: '1px solid', borderRight: 'none', borderBottom: 'none' };
      case 'left':
        return { ...base, right: '-8px', top: '50%', marginTop: '-8px', borderTop: '1px solid', borderRight: '1px solid', borderBottom: 'none', borderLeft: 'none' };
      case 'right':
        return { ...base, left: '-8px', top: '50%', marginTop: '-8px', borderBottom: '1px solid', borderLeft: '1px solid', borderTop: 'none', borderRight: 'none' };
      default:
        return base;
    }
  };

  // Determine the action hint based on step type
  const getActionHint = () => {
    switch (currentStepData.advanceOn) {
      case 'navigation':
        return `Tap the ${currentStepData.advanceValue === 'personal' ? 'Wallet' : 
          currentStepData.advanceValue === 'simulation' ? 'Future' : 
          currentStepData.advanceValue === 'group' ? 'Contracts' : 
          currentStepData.advanceValue} tab to continue`;
      case 'action':
        return 'Complete this action to continue';
      case 'dismiss':
        return null; // "Got it" button handles this
      default:
        return null;
    }
  };

  const actionHint = getActionHint();

  return (
    <div
      ref={bubbleRef}
      className={`fixed z-[100] w-80 transition-all duration-300 ${
        isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
      }`}
      style={{ top: position.top, left: position.left }}
      role="dialog"
      aria-label={`Tutorial step ${currentStep} of ${totalSteps}`}
    >
      {/* Bubble content */}
      <div className="relative p-4 rounded-2xl" style={{
        background: 'linear-gradient(145deg, hsl(225 22% 18%), hsl(225 22% 12%))',
        border: '1px solid hsl(258 75% 65% / 0.3)',
        boxShadow: '0 0 40px hsl(258 75% 65% / 0.3), 0 20px 40px -10px hsl(0 0% 0% / 0.5)',
      }}>
        {/* Arrow */}
        <div style={getArrowStyles()} />
        
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-primary/20 text-primary">
              {currentStep}/{totalSteps}
            </span>
            <h3 className="font-semibold text-foreground text-sm">
              {currentStepData.title}
            </h3>
          </div>
          <button
            onClick={skipTutorial}
            className="p-1 rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Skip tutorial"
            type="button"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message */}
        <p className="text-sm text-muted-foreground leading-relaxed mb-3">
          {currentStepData.message}
        </p>

        {/* Action hint for navigation/action steps */}
        {actionHint && (
          <p className="text-xs text-primary/70 italic mb-3">
            {actionHint}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between">
          {isFirstStep ? (
            <button
              onClick={skipTutorial}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
              type="button"
            >
              Skip Tutorial
            </button>
          ) : (
            <div />
          )}
          
          {currentStepData.advanceOn === 'dismiss' && (
            <button
              onClick={dismissStep}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
              type="button"
            >
              Got it
            </button>
          )}
        </div>
      </div>

      {/* Target highlight pulse */}
      <style>{`
        @keyframes tutorial-pulse {
          0%, 100% {
            box-shadow: 0 0 0 0 hsl(var(--primary) / 0.4);
          }
          50% {
            box-shadow: 0 0 0 8px hsl(var(--primary) / 0);
          }
        }
        .tutorial-highlight {
          animation: tutorial-pulse 2s ease-in-out infinite;
          position: relative;
          z-index: 60;
        }
      `}</style>
    </div>
  );
};

export default TutorialBubble;
