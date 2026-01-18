import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Shield, Loader2 } from 'lucide-react';

interface ToSSection {
  id: number;
  title: string;
  content: string;
}

const TOS_SECTIONS: ToSSection[] = [
  {
    id: 0,
    title: "Introduction: The Software Provider Framework",
    content: `Welcome to TVC: The Vault Club, a non-custodial software coordination platform developed by Sequence Theory, Inc. Sequence Theory is a software developer, not a financial advisor, custodian, or broker-dealer. By interacting with the platform, you are utilizing our proprietary smart contract templates to deploy your own private investment agreements. You acknowledge that you are initiating these actions autonomously and that Sequence Theory does not exercise discretionary control over your funds or investment outcomes.`
  },
  {
    id: 1,
    title: "Eligibility & Non-Custodial Ownership",
    content: `To use this software, you must be 18+ years old and reside in a jurisdiction where DeFi protocol interaction is permitted. Your account is powered by Turnkey infrastructure, while ensuring you—and only you—retain the ability to sign transactions. Sequence Theory does not store, see, or have the power to recover your private keys. You accept full responsibility for maintaining access to your recovery email and passkey device.`
  },
  {
    id: 2,
    title: "Service Description: User-Deployed Templates",
    content: `The Vault Club provides a suite of "Investment Templates" that users can deploy into private or public Safe{Core} Multisig Vaults (1–8 participants). These templates use Routed Reinvestment Logic (RRL) to automate yield compounding across established DeFi protocols (Aave, Spark, QuickSwap). Once your chosen template reaches its "Phase 2" trigger (determined by your selection of growth or timeline thresholds), the logic automatically transitions into wBTC accumulation and wealth preservation.`
  },
  {
    id: 3,
    title: "Deposit Obligations & The 7-Day Grace Period",
    content: `Participating in TVC's contract is a social and financial commitment. Users are expected to meet the deposit frequency defined in their selected template. However, to account for real world emergencies or banking delays, every contract includes a 7-Day Grace Period. A deposit is only flagged as "Missed" if it remains unpaid after 7 full days from the due date. Late deposits within the grace period do not trigger penalties but may temporarily reduce the compounding efficiency for that cycle.`
  },
  {
    id: 4,
    title: "Risk Disclosure: Leverage vs. Equity",
    content: `You acknowledge that DeFi involves inherent risks, including protocol exploits and market volatility.

• Liquidation Risk (High Risk): Templates utilizing Subscription-Backed Borrowing (SBB) involve leverage. While protected by proprietary market-health indices, extreme market downturn events can result in loss of funds. Our metrics act as shields, not bulletproof.

• Capital Preservation (Low Risk): Templates without SBB function like "Equity Shares" and carry zero liquidation risk, though they still remain subject to market price fluctuations.

• Principal Protection: Your principal is protected by a third-party smart contract insurance provider against technical exploits only (hacks/bugs), not against market movements or price depreciations.`
  },
  {
    id: 5,
    title: "Behavioral Enforcement: The \"Kick\" & Penalties",
    content: `To maintain group integrity, the system enforces a 3% ownership redistribution penalty for every three missed deposits (post-grace period).

• The Kick Feature: A group may unanimously vote to "Kick" an inactive member. The kicked member's principal remains locked until the contract's Phase 2 trigger or original completion date to prevent users from "gaming" the lock-up period to exit early.

• Lock-up Integrity: Users may not edit the parameters of a live contract more than once every 60 days to prevent impulsive "trading-like" behavior.`
  },
  {
    id: 6,
    title: "Emergency Withdrawal & Unanimous Governance",
    content: `All structural changes to a live contract—including early termination, member removal, or switching RRL Strands—require a Unanimous Multisig Vote via the Safe{Core} interface.

• Individual Exit: An individual may initiate an emergency exit, but they will receive Principal Only; all accrued yield and profits are forfeited as a "Disruption Fee."

• Group Termination: If the entire group votes to end a contract early, 100% of the principal is returned, but 35% of total yield is retained by the protocol reserve to ensure long-term system sustainability.`
  },
  {
    id: 7,
    title: "Weekly Engine Mechanics (RRL & SBB)",
    content: `The TVC engine operates on a deterministic weekly cycle:

• Monday (Front-Loading): For leveraged templates, capital is front-loaded via Aave to maximize the time-value of money.

• Friday (The Harvest): Profits are collected and redistributed according to your template's specific Routed Reinvestment Logic. Sequence Theory provides "Indexes" that monitors market health, but the execution is performed by autonomous smart contracts on the Polygon network.`
  },
  {
    id: 8,
    title: "Utility Fees & Gas Optimization",
    content: `The Vault Club operates on a flat-fee utility model to ensure our incentives are aligned with your growth, not your losses:

• System Utility Fee: $1.00 per user/week.

• Charged Contracts: $1.25 per user/week (for contracts under 1-year duration). These serve as a "short term test" and yield is typically never substantial in these short periods.`
  },
  {
    id: 9,
    title: "Regulatory & Legal: No Managerial Efforts",
    content: `Sequence Theory affirms that TVC is a software, that is a "tool for self-direction."

• We do not offer "Investment Advice."

• We do not exercise "Managerial Efforts" over your funds; the profit you earn is a result of the decentralized protocols you chose via your template.

• We comply with Massachusetts Uniform Securities Act (Chapter 110A) by providing full transparency of logic and risk.

• OFAC Compliance: We reserve the right to blacklist frontend access to flagged IPs & wallets by global AML/Sanctions lists, or wallets engaging in suspicious, spammy activity.`
  },
  {
    id: 10,
    title: "Final Consent & Affirmation",
    content: `By clicking "Accept & Create Account" below, you affirm that: You are using a non-custodial tool and are fully responsible for your own account access and wallet security. You understand that "High Rigor" templates involve leverage and carry real potential loss risk. You accept the 3% penalty for missed deposits after the 7-day grace period. You acknowledge that Sequence Theory, Inc. is a software provider—not a custodian, bank, financial advisor, or investment manager.`
  }
];

interface ToSAgreementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
  isLoading?: boolean;
  loadingMessage?: string;
}

export const ToSAgreementModal: React.FC<ToSAgreementModalProps> = ({
  isOpen,
  onClose,
  onAccept,
  isLoading = false,
  loadingMessage = 'Creating Account...'
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const totalSteps = TOS_SECTIONS.length;
  const isLastStep = currentStep === totalSteps - 1;
  const currentSection = TOS_SECTIONS[currentStep];

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleNext = () => {
    if (isLastStep) {
      onAccept();
    } else {
      setCurrentStep(prev => Math.min(prev + 1, totalSteps - 1));
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  const handleClose = () => {
    setCurrentStep(0);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl ring-1 ring-white/10 flex flex-col" style={{ height: '580px' }}>
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-5 rounded-t-2xl flex justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-white" />
            <div>
              <h2 className="text-lg font-bold text-white">Terms of Service</h2>
              <p className="text-white/70 text-sm">Step {currentStep + 1} of {totalSteps}</p>
            </div>
          </div>
          <button 
            onClick={handleClose}
            disabled={isLoading}
            className="text-white/80 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-5 py-3 bg-slate-800/50 border-b border-slate-700/50 flex-shrink-0">
          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-300 ease-out"
              style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        {/* Content - Fixed Height */}
        <div className="flex-1 flex flex-col p-5 min-h-0 overflow-hidden">
          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center">
              <Loader2 className="w-12 h-12 text-purple-500 animate-spin mb-4" />
              <p className="text-white font-medium text-lg">{loadingMessage}</p>
              <p className="text-slate-400 text-sm mt-2">Please wait while we set up your account...</p>
            </div>
          ) : (
            <>
              {/* Section Title */}
              <div className="flex items-center gap-3 mb-4 flex-shrink-0">
                <span className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 text-sm font-bold flex items-center justify-center">
                  {currentStep + 1}
                </span>
                <h3 className="font-semibold text-white text-lg">
                  {currentSection.title.replace(/^\d+\.\s*/, '')}
                </h3>
              </div>

              {/* Section Content - Scrollable if needed */}
              <div className="flex-1 overflow-y-auto pr-2 min-h-0">
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                  <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">
                    {currentSection.content}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer with Navigation */}
        <div className="p-5 border-t border-slate-700/50 flex-shrink-0 bg-slate-900/80">
          {!isLoading && (
            <div className="flex gap-3">
              {/* Back Button - Hidden on first step */}
              {currentStep > 0 ? (
                <button
                  onClick={handleBack}
                  className="flex-1 py-3 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl text-white font-medium transition-all duration-300 flex items-center justify-center gap-2"
                >
                  <ChevronLeft className="w-5 h-5" />
                  <span>Back</span>
                </button>
              ) : (
                <button
                  onClick={handleClose}
                  className="flex-1 py-3 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl text-white font-medium transition-all duration-300"
                >
                  Cancel
                </button>
              )}

              {/* Next/Accept Button */}
              <button
                onClick={handleNext}
                className="flex-1 py-3 px-4 rounded-xl font-medium transition-all duration-300 flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl"
              >
                {isLastStep ? (
                  <>
                    <Shield className="w-5 h-5" />
                    <span>Accept & Create Account</span>
                  </>
                ) : (
                  <>
                    <span>Next</span>
                    <ChevronRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          )}
          
          {isLoading && (
            <div className="text-center">
              <p className="text-slate-400 text-sm">
                Setting up your wallet and syncing your profile...
              </p>
            </div>
          )}
        </div>

        {/* Version Footer */}
        <div className="px-5 pb-3 text-center flex-shrink-0">
          <p className="text-slate-600 text-xs">
            Last Updated: January 18, 2026 | Version: 2.0
          </p>
        </div>
      </div>
    </div>
  );
};

// Simple ToS Viewer for the Data page (non-modal version)
export const ToSViewer: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-slate-900 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl ring-1 ring-white/10">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-5 rounded-t-2xl flex justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-white" />
            <div>
              <h2 className="text-lg font-bold text-white">Terms of Service</h2>
              <p className="text-white/70 text-sm">TVC: The Vault Club by Sequence Theory, Inc.</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-white/80 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0">
          {TOS_SECTIONS.map((section) => (
            <div 
              key={section.id}
              className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50"
            >
              <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 text-xs flex items-center justify-center">
                  {section.id + 1}
                </span>
                {section.title.replace(/^\d+\.\s*/, '')}
              </h4>
              <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">
                {section.content}
              </p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-700/50 flex-shrink-0 text-center">
          <p className="text-slate-500 text-xs">
            Last Updated: January 18, 2026 | Version: 2.0 | Sequence Theory, Inc.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ToSAgreementModal;
