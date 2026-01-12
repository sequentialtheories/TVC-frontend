import React, { useEffect, useState, useRef } from 'react';
import { X } from 'lucide-react';
import { useTutorial, TUTORIAL_STEPS } from './TutorialContext';

interface TutorialBubbleProps {
  targetRef: React.RefObject<HTMLElement>;
}

export const TutorialBubble: React.FC<TutorialBubbleProps> = ({ targetRef }) => {
  const { currentStepData, currentStep, dismissStep, skipTutorial } = useTutorial();
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const bubbleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!currentStepData || !targetRef.current) {
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
  }, [currentStepData, targetRef]);

  if (!currentStepData) return null;

  const isFirstStep = currentStep === 1;
  const totalSteps = TUTORIAL_STEPS.length;

  const getArrowClasses = () => {
    const base = 'absolute w-4 h-4 bg-card border border-border/40 rotate-45';
    switch (currentStepData.position) {
      case 'top':
        return `${base} -bottom-2 left-1/2 -translate-x-1/2 border-t-0 border-l-0`;
      case 'bottom':
        return `${base} -top-2 left-1/2 -translate-x-1/2 border-b-0 border-r-0`;
      case 'left':
        return `${base} -right-2 top-1/2 -translate-y-1/2 border-l-0 border-b-0`;
      case 'right':
        return `${base} -left-2 top-1/2 -translate-y-1/2 border-r-0 border-t-0`;
      default:
        return base;
    }
  };

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
      <div className="relative glass-card p-4 border border-primary/30 shadow-glow-purple">
        {/* Arrow */}
        <div className={getArrowClasses()} />
        
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
            onClick={dismissStep}
            className="p-1 rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Close tutorial step"
            type="button"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message */}
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          {currentStepData.message}
        </p>

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
