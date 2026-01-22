import React, { useState, useEffect, useRef } from 'react';
import { Database, User, Users, TrendingUp, X, Bitcoin, DollarSign, Zap, Shield, ArrowLeft, Wallet, Home, Share2, FileText, ChevronLeft, ChevronRight, Clock, Target, Sparkles, Flame, Rocket, Crown, TestTube, Settings, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Session } from '@supabase/supabase-js';
import { ThemeToggle } from './ThemeToggle';
import VaultBackground from './VaultBackground';
import { TutorialProvider, useTutorial, TutorialBubble } from './tutorial';
import { ToSAgreementModal, ToSViewer } from './ToSAgreementModal';
import { 
  registerUser, 
  signInUser, 
  signOutUser, 
  triggerWalletCreation,
  fetchExistingWallet,
  onAuthStateChange as authStateChange
} from '@/services/authService';

// Type declarations
interface VaultStats {
  totalMembers: number;
  totalDeposits: string;
  systemHealth: number;
  transactions: number;
  strand1Balance: string;
  strand2Balance: string;
  strand3Balance: string;
}
interface AaveRates {
  liquidityRate: number;
  aavePolygonRate: number;
}
interface SchedulePeriod {
  yearStart: number;
  yearEnd: number;
  amount: number;
}
interface ClubCreationData {
  lockupPeriod: number;
  rigorLevel: string;
  riskLevel: string;
  maxMembers: number;
  isPrivate: boolean;
  isChargedContract: boolean;
  customDepositFrequency: 'daily' | 'weekly' | 'monthly';
  customWeeklyAmount: number;
  customSchedule: SchedulePeriod[];
  // Phase 2 trigger settings
  phase2TriggerType: 'time' | 'value' | 'both';
  phase2TimePercent: number; // 0-100
  phase2ValueThreshold: number; // Dollar amount
}
interface Subclub {
  id: number;
  contractAddress: string;
  creator: string | null;
  maxMembers: number;
  lockupPeriod: number;
  rigorLevel: string;
  riskLevel: string;
  isPrivate: boolean;
  isChargedContract: boolean;
  currentMembers: number;
  createdAt: string;
  status: string;
  totalDeposits: number;
  members: string[];
  borderColor: string;
  customDepositFrequency?: 'daily' | 'weekly' | 'monthly';
  customWeeklyAmount?: number;
  customSchedule?: SchedulePeriod[];
  strand1Balance: string;
  strand2Balance: string;
  strand3Balance: string;
  totalContractBalance: string;
}
interface ChartDataPoint {
  year: number;
  total: number;
  strand1: number;
  strand2: number;
  strand3: number;
  wbtc: number;
  phase: number;
  initialDeposits: number;
  cumulativeGasFees: number;
  cumulativeUtilityFees: number;
}
interface StrandData {
  title: string;
  subtitle: string;
  apy: string;
  description: string;
  features: string[];
  color: string;
  icon: React.ReactNode;
}

// Rigor amounts mapping
const rigorAmounts: Record<string, number> = {
  light: 25,
  medium: 50,
  heavy: 100,
  custom: 0
};
const toWeeklyAmount = (amount: number, frequency: 'daily' | 'weekly' | 'monthly' = 'weekly') => {
  if (frequency === 'daily') return amount * 7;
  if (frequency === 'monthly') return amount * 12 / 52;
  return amount;
};
const periodsPerYear = (frequency: 'daily' | 'weekly' | 'monthly' = 'weekly') => {
  if (frequency === 'daily') return 365;
  if (frequency === 'monthly') return 12;
  return 52;
};

// Connect wallet and return address or null
async function connectWallet(): Promise<string | null> {
  if (typeof window === 'undefined' || !window.ethereum) {
    alert("MetaMask is required to use this app.");
    return null;
  }
  try {
    const accounts = (await window.ethereum.request({
      method: 'eth_requestAccounts'
    })) as string[];
    return accounts[0];
  } catch (error) {
    console.error("Wallet connection rejected", error);
    return null;
  }
}

// Get vault stats from contract - fallback version
async function getVaultStats(): Promise<VaultStats> {
  return {
    totalMembers: 0,
    totalDeposits: "0",
    systemHealth: 100,
    transactions: 0,
    strand1Balance: "0",
    strand2Balance: "0",
    strand3Balance: "0"
  };
}

// Get Spark Protocol USDC and AAVE lending rates on Polygon
// AAVE rate: Supply USDC rate from AAVE V3 on Polygon
async function getAaveRates(): Promise<AaveRates> {
  try {
    const response = await fetch('https://yields.llama.fi/pools');
    if (!response.ok) {
      throw new Error('API response not ok');
    }
    
    const data = await response.json();
    
    // Spark Protocol USDC lending on Ethereum
    const sparkPool = data.data.find((pool: {
      project: string;
      chain: string;
      symbol: string;
      apy: number;
    }) => pool.project === 'sparklend' && pool.chain === 'Ethereum' && pool.symbol.includes('USDC'));
    
    // AAVE V3 on Polygon - USDC Supply rate
    const aaveUsdcPolygon = data.data.find((pool: {
      project: string;
      chain: string;
      symbol: string;
      apy: number;
    }) => pool.project === 'aave-v3' && pool.chain === 'Polygon' && pool.symbol === 'USDC');
    
    // AAVE V3 on Polygon - DAI Supply rate (for reference in re-deposit strategy)
    const aaveDaiPolygon = data.data.find((pool: {
      project: string;
      chain: string;
      symbol: string;
      apy: number;
    }) => pool.project === 'aave-v3' && pool.chain === 'Polygon' && pool.symbol === 'DAI');
    
    const usdcSupplyRate = aaveUsdcPolygon?.apy || 3.0;
    const daiSupplyRate = aaveDaiPolygon?.apy || 3.6;
    
    // Calculate combined rate: USDC supply + DAI supply averaged (simulating re-deposit strategy)
    // This represents supplying USDC, and the potential of re-depositing into DAI
    const combinedRate = (usdcSupplyRate + daiSupplyRate) / 2 * 1.2; // 1.2x for yield optimization
    
    return {
      liquidityRate: sparkPool?.apy || 3.5,
      aavePolygonRate: combinedRate
    };
  } catch (error) {
    console.error("Error fetching lending rates:", error);
    return {
      liquidityRate: 3.5,
      aavePolygonRate: 4.0
    };
  }
}

// Get QuickSwap top bond/pool rate on Polygon
async function getQuickSwapAPY(): Promise<number> {
  try {
    const response = await fetch('https://yields.llama.fi/pools');
    if (response.ok) {
      const data = await response.json();
      // Find all QuickSwap pools on Polygon and get the top APY
      const quickswapPools = data.data.filter((pool: {
        project: string;
        chain: string;
        symbol: string;
        apy: number;
        tvlUsd: number;
      }) => (pool.project === 'quickswap-v3' || pool.project === 'quickswap-dex' || pool.project === 'quickswap') 
           && pool.chain === 'Polygon' 
           && pool.tvlUsd > 100000 // Only consider pools with decent TVL
           && pool.apy > 0);
      
      if (quickswapPools.length > 0) {
        // Sort by APY descending and get the top one
        quickswapPools.sort((a: { apy: number }, b: { apy: number }) => b.apy - a.apy);
        return quickswapPools[0].apy;
      }
      
      // Fallback: look for any high-yield Polygon pool
      const polygonPools = data.data.filter((pool: {
        chain: string;
        apy: number;
        tvlUsd: number;
      }) => pool.chain === 'Polygon' && pool.tvlUsd > 500000 && pool.apy > 0);
      
      if (polygonPools.length > 0) {
        polygonPools.sort((a: { apy: number }, b: { apy: number }) => b.apy - a.apy);
        return Math.min(polygonPools[0].apy, 25); // Cap at 25% for reasonable display
      }
      
      return 12.5; // Default fallback
    }
    throw new Error('API call failed');
  } catch (error) {
    console.error("Error fetching QuickSwap Rate:", error);
    return 12.5;
  }
}

// Get live Bitcoin price
async function getBitcoinPrice(): Promise<number> {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
    if (response.ok) {
      const data = await response.json();
      return data.bitcoin.usd;
    }
    throw new Error('API call failed');
  } catch (error) {
    console.error("Error fetching Bitcoin price:", error);
    return 95000;
  }
}

// Get member allocation data from contract
async function getMemberAllocation(): Promise<unknown[]> {
  return [];
}

// Calculate simple averaged effective APY from 3 strand APYs
function calculateAveragedAPY(apy1: number, apy2: number, apy3: number): number {
  // Weighted average based on allocation: 10% Strand 1, 60% Strand 2, 30% Strand 3
  const weightedAPY = (apy1 * 0.10) + (apy2 * 0.60) + (apy3 * 0.30);
  return weightedAPY;
}

// Deposit amount (in ether) to vault contract
async function depositToVault(amountEther: number): Promise<boolean> {
  if (typeof window === 'undefined' || !window.ethereum) {
    alert("MetaMask is required to use this app.");
    return false;
  }
  try {
    console.log(`Depositing ${amountEther} to vault...`);
    alert(`Demo mode: Automated deposit of ${amountEther} successful!`);
    return true;
  } catch (error) {
    console.error("Deposit failed:", error);
    alert("Deposit transaction failed.");
    return false;
  }
}
const VaultClubWebsiteInner: React.FC<{
  onWalletStateChange?: (connected: boolean) => void;
}> = ({
  onWalletStateChange
}) => {
  const [activeModal, setActiveModal] = useState(null);
  const [activeStrand, setActiveStrand] = useState(null);
  const [currentPage, setCurrentPage] = useState('home');
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState(null);
  const [vaultBalance, setVaultBalance] = useState("0");
  const [depositAmount, setDepositAmount] = useState('');

  // Tutorial refs for navigation elements
  const navWalletRef = useRef<HTMLButtonElement>(null);
  const navContractsRef = useRef<HTMLButtonElement>(null);
  const navDataRef = useRef<HTMLButtonElement>(null);
  const navFutureRef = useRef<HTMLButtonElement>(null);
  const navHomeRef = useRef<HTMLButtonElement>(null);
  const connectAccountRef = useRef<HTMLButtonElement>(null);
  const futurePageIntroRef = useRef<HTMLDivElement>(null);
  const sequenceTheoryBtnRef = useRef<HTMLAnchorElement>(null);
  const contractsDirectoryRef = useRef<HTMLDivElement>(null);
  const homeContractSectionRef = useRef<HTMLDivElement>(null);

  // Tutorial hook
  const tutorial = useTutorial();

  // Sync wallet state to parent for tutorial provider
  useEffect(() => {
    onWalletStateChange?.(walletConnected);
  }, [walletConnected, onWalletStateChange]);
  // Club creation states
  const [clubCreationData, setClubCreationData] = useState<ClubCreationData>({
    lockupPeriod: 5,
    rigorLevel: 'medium',
    riskLevel: 'medium',
    maxMembers: 1,
    isPrivate: true,
    isChargedContract: false,
    customDepositFrequency: 'weekly',
    customWeeklyAmount: 75,
    customSchedule: [{
      yearStart: 1,
      yearEnd: 3,
      amount: 75
    }, {
      yearStart: 4,
      yearEnd: 6,
      amount: 100
    }, {
      yearStart: 7,
      yearEnd: 10,
      amount: 150
    }, {
      yearStart: 11,
      yearEnd: 20,
      amount: 200
    }],
    phase2TriggerType: 'both',
    phase2TimePercent: 50,
    phase2ValueThreshold: 1000000
  });
  
  // Template selection state
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [templateCarouselIndex, setTemplateCarouselIndex] = useState(0);
  const [showCustomControls, setShowCustomControls] = useState(false);
  
  // Strands modal state
  const [showStrandsModal, setShowStrandsModal] = useState(false);
  
  // More Details dropdown state for Future page
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  
  // Earnings timeline state
  const [earningsTimeline, setEarningsTimeline] = useState<'1W' | '1M' | '1Y' | 'All'>('1W');

  // Dynamic data states - accurate initial values reflecting empty state
  const [vaultStats, setVaultStats] = useState({
    totalMembers: 0,
    totalDeposits: "0",
    systemHealth: 100,
    transactions: 0,
    strand1Balance: "0",
    strand2Balance: "0",
    strand3Balance: "0"
  });
  const [memberAllocation, setMemberAllocation] = useState([]);
  const [apyStrand1, setApyStrand1] = useState(3.5);
  const [apyStrand2, setApyStrand2] = useState(7.5);
  const [apyStrand3, setApyStrand3] = useState(12.5);
  const [btcPrice, setBtcPrice] = useState(95000);
  const [aaveRates, setAaveRates] = useState({
    liquidityRate: 3.5,
    aavePolygonRate: 7.5
  });
  const [quickSwapAPY, setQuickSwapAPY] = useState(12.5);
  const [selectedContract, setSelectedContract] = useState(null);
  const [showExtendedLockup, setShowExtendedLockup] = useState(false);
  const [simulationYears, setSimulationYears] = useState(15);
  const [simulationRigor, setSimulationRigor] = useState('heavy');
  const [customSimulationAmount, setCustomSimulationAmount] = useState(75);
  const [chartData, setChartData] = useState([]);

  // Subclub management
  const [deployedSubclubs, setDeployedSubclubs] = useState([]);
  const [lastDepositTime, setLastDepositTime] = useState(null);
  const [showCopiedBanner, setShowCopiedBanner] = useState(false);

  // Auth modal states
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  
  // ToS modal states
  const [showToSModal, setShowToSModal] = useState(false);
  const [showToSViewer, setShowToSViewer] = useState(false);
  const [pendingSignupData, setPendingSignupData] = useState<{ email: string; password: string } | null>(null);

  // Sync auth modal state with tutorial system
  useEffect(() => {
    tutorial.setAuthModalOpen(showAuthModal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAuthModal]);

  // Sync current page with tutorial system on mount and changes
  useEffect(() => {
    tutorial.setCurrentPage(currentPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  useEffect(() => {
    const {
      data: {
        subscription
      }
    } = authStateChange((event, session) => {
      console.log('[VaultClub] Auth state changed:', event);
      setSession(session);
      if (session?.user) {
        setWalletConnected(true);
        // Defer wallet fetch to avoid deadlock
        setTimeout(async () => {
          try {
            // First try to fetch existing wallet
            const existingWallet = await fetchExistingWallet(session.user.id);
            if (existingWallet.success && existingWallet.walletAddress) {
              setWalletAddress(existingWallet.walletAddress);
              console.log('[VaultClub] Existing wallet found:', existingWallet.walletAddress);
            } else {
              // Trigger wallet creation via Sequence Theory's Turnkey function
              console.log('[VaultClub] No wallet found, triggering creation...');
              const walletResult = await triggerWalletCreation(session.access_token);
              if (walletResult.success && walletResult.walletAddress) {
                setWalletAddress(walletResult.walletAddress);
                console.log('[VaultClub] Wallet created:', walletResult.walletAddress);
              } else {
                console.warn('[VaultClub] Wallet creation failed:', walletResult.error);
                setWalletAddress(session.user.email || session.user.id.slice(0, 10));
              }
            }
            // Trigger tutorial advancement for "Connect Account" action completion
            tutorial.checkAdvancement('action');
          } catch (err) {
            console.error('[VaultClub] Error in wallet handling:', err);
            setWalletAddress(session.user.email || session.user.id.slice(0, 10));
          }
        }, 0);
        setShowAuthModal(false);
        tutorial.setAuthModalOpen(false); // Re-enable tutorials after auth
      } else {
        setWalletConnected(false);
        setWalletAddress('');
      }
    });
    
    // Check for existing session on mount
    supabase.auth.getSession().then(async ({
      data: {
        session
      }
    }) => {
      setSession(session);
      if (session?.user) {
        setWalletConnected(true);
        // Fetch wallet address using service
        const walletResult = await fetchExistingWallet(session.user.id);
        if (walletResult.success && walletResult.walletAddress) {
          setWalletAddress(walletResult.walletAddress);
        } else {
          setWalletAddress(session.user.email || session.user.id.slice(0, 10));
        }
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Handle URL-based contract joining
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const joinContractId = urlParams.get('join');
    if (joinContractId && walletConnected) {
      // Find the contract to join
      const contractToJoin = deployedSubclubs.find(club => club.contractAddress === joinContractId && !club.isPrivate && club.currentMembers < club.maxMembers && (!club.members || !club.members.includes(walletAddress)));
      if (contractToJoin) {
        // Auto-join the contract
        const updatedContract = {
          ...contractToJoin,
          currentMembers: contractToJoin.currentMembers + 1,
          members: [...(contractToJoin.members || []), walletAddress]
        };
        setDeployedSubclubs(prev => prev.map(club => club.contractAddress === joinContractId ? updatedContract : club));
        alert(`✅ Successfully joined contract!\n\n${contractToJoin.lockupPeriod} ${contractToJoin.isChargedContract ? 'Month' : 'Year'} Lockup • ${contractToJoin.rigorLevel.charAt(0).toUpperCase() + contractToJoin.rigorLevel.slice(1)} Rigor\n\nYou can now start making deposits according to the contract schedule.`);

        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (joinContractId) {
        // Contract not found, full, private, or user already a member
        const existingContract = deployedSubclubs.find(club => club.contractAddress === joinContractId);
        if (existingContract) {
          if (existingContract.isPrivate) {
            alert('❌ This is a private contract. You need a direct invitation from the contract owner.');
          } else if (existingContract.currentMembers >= existingContract.maxMembers) {
            alert('❌ This contract is full. No more members can join.');
          } else if (existingContract.members && existingContract.members.includes(walletAddress)) {
            alert('ℹ️ You are already a member of this contract.');
          }
        } else {
          alert('❌ Contract not found. The link may be invalid or the contract may not be deployed yet.');
        }

        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [walletConnected, walletAddress, deployedSubclubs]);

  // Load dynamic data
  useEffect(() => {
    const loadDynamicData = async () => {
      try {
        // Load Spark & AAVE Polygon rates for Strand 1 and 2
        const aaveData = await getAaveRates();
        setAaveRates(aaveData);
        setApyStrand1(aaveData.liquidityRate);
        setApyStrand2(aaveData.aavePolygonRate);

        // Load QuickSwap Rate for Strand 3
        const quickSwapData = await getQuickSwapAPY();
        setQuickSwapAPY(quickSwapData);
        setApyStrand3(quickSwapData);

        // Load Bitcoin price
        const bitcoinPrice = await getBitcoinPrice();
        setBtcPrice(bitcoinPrice);

        // Load vault stats
        const stats = await getVaultStats();
        setVaultStats(stats);

        // Load member allocation
        const members = await getMemberAllocation();
        setMemberAllocation(members);
      } catch (error) {
        console.error("Error loading dynamic data:", error);
      }
    };
    loadDynamicData();

    // Set up periodic updates
    const interval = setInterval(loadDynamicData, 300000); // Update every 5 minutes
    return () => clearInterval(interval);
  }, []);

  // Removed automatic wallet initialization to prevent auto-connection

  // Calculate simulation data using simplified allocation model
  const calculateSimulation = () => {
    const data = [];
    let V1 = 0,
      V2 = 0,
      V3 = 0,
      wBTC = 0; // Starting balances including wBTC
    let totalDeposited = 0; // Track cumulative deposits without compounding
    const weeksPerYear = 52;
    const totalWeeks = simulationYears * weeksPerYear;

    // Convert APY to weekly rates using dynamic data
    const r1 = Math.pow(1 + apyStrand1 / 100, 1 / weeksPerYear) - 1;
    const r2 = Math.pow(1 + apyStrand2 / 100, 1 / weeksPerYear) - 1;
    const r3 = Math.pow(1 + apyStrand3 / 100, 1 / weeksPerYear) - 1;

    // Gas fee estimates (in USD) - these could also be made dynamic
    const gasFeesPerWeek = {
      harvestYield: 0.175,
      executeRRLCycle: 0.315,
      chainlinkUpkeep: 0.085,
      weeklyTotal: 0.575
    };

    // Utility fee: $1/week/user
    const utilityFeePerWeek = (vaultStats.totalMembers || 1) * 1;
    for (let week = 0; week <= totalWeeks; week++) {
      const year = Math.floor(week / weeksPerYear) + 1;
      const progressPercent = week / totalWeeks;

      // Phase 2 trigger: 50% completion OR ~$1M vault value
      const phase2Triggered = progressPercent >= 0.5 || V1 + V2 + V3 + wBTC >= 1000000;

      // Calculate weekly deposit based on selected rigor
      let weeklyDeposit;
      if (simulationRigor === 'light') {
        // Light rigor: monthly deposits converted to weekly
        if (year <= 1) weeklyDeposit = 100 / 4.33; // $100/month
        else if (year <= 2) weeklyDeposit = 150 / 4.33; // $150/month
        else if (year <= 3) weeklyDeposit = 200 / 4.33; // $200/month
        else weeklyDeposit = 250 / 4.33; // $250/month
      } else if (simulationRigor === 'medium') {
        // Medium rigor deposit schedule
        if (year <= 3) weeklyDeposit = 50;else if (year <= 6) weeklyDeposit = 100;else if (year <= 10) weeklyDeposit = 200;else weeklyDeposit = 250;
      } else if (simulationRigor === 'heavy') {
        // Heavy rigor deposit schedule
        if (year <= 3) weeklyDeposit = 100;else if (year <= 6) weeklyDeposit = 200;else if (year <= 10) weeklyDeposit = 300;else weeklyDeposit = 400;
      } else {
        // Custom rigor - use user-defined amount
        weeklyDeposit = customSimulationAmount;
      }

      // Track total deposits
      totalDeposited += weeklyDeposit;
      if (week > 0) {
        if (!phase2Triggered) {
          // PHASE 1: Simple allocation with compound interest
          // Split deposits: 15% Strand 1, 50% Strand 2, 25% Strand 3
          const D1 = weeklyDeposit * 0.15;
          const D2 = weeklyDeposit * 0.50;
          const D3 = weeklyDeposit * 0.25;

          // Apply compound interest to each strand
          V1 = V1 * (1 + r1) + D1;
          V2 = V2 * (1 + r2) + D2;
          V3 = V3 * (1 + r3) + D3;
        } else {
          // PHASE 2: Transition to wBTC
          // All new deposits go to Strand 1 (AAVE Reserve)
          V1 = V1 * (1 + r1) + weeklyDeposit;
          V2 = V2 * (1 + r2);
          V3 = V3 * (1 + r3);

          // Weekly 5% migration from Strands 2&3 to Strand 1, then to wBTC
          const migrationFromV2 = V2 * 0.05;
          const migrationFromV3 = V3 * 0.05;
          V2 -= migrationFromV2;
          V3 -= migrationFromV3;
          V1 += migrationFromV2 + migrationFromV3;

          // Weekly wBTC DCA purchases from Strand 1
          let weeklyDCA;
          if (simulationRigor === 'light') weeklyDCA = Math.min(V1 * 0.1, 1000);else if (simulationRigor === 'medium') weeklyDCA = Math.min(V1 * 0.1, 5000);else if (simulationRigor === 'heavy') weeklyDCA = Math.min(V1 * 0.1, 10000);else weeklyDCA = Math.min(V1 * 0.1, 2000); // Custom

          V1 -= weeklyDCA;
          wBTC += weeklyDCA;
        }

        // Subtract weekly gas fees and utility fees from the vault (proportionally distributed)
        const totalBeforeGas = V1 + V2 + V3 + wBTC;
        if (totalBeforeGas > 0) {
          const gasReduction = gasFeesPerWeek.weeklyTotal;
          const utilityReduction = utilityFeePerWeek;
          const totalReduction = gasReduction + utilityReduction;
          const gasRatio = totalReduction / totalBeforeGas;
          V1 -= V1 * gasRatio;
          V2 -= V2 * gasRatio;
          V3 -= V3 * gasRatio;
          wBTC -= wBTC * gasRatio;
        }
      } else {
        // Initial deposits
        const D1 = weeklyDeposit * 0.15;
        const D2 = weeklyDeposit * 0.50;
        const D3 = weeklyDeposit * 0.25;
        V1 = D1;
        V2 = D2;
        V3 = D3;
      }
      const totalValue = V1 + V2 + V3 + wBTC;

      // Add data point for each year
      if (week % weeksPerYear === 0) {
        data.push({
          year: Math.floor(week / weeksPerYear),
          total: Math.round(totalValue),
          strand1: Math.round(V1),
          strand2: Math.round(V2),
          strand3: Math.round(V3),
          wbtc: Math.round(wBTC),
          phase: phase2Triggered ? 2 : 1,
          initialDeposits: Math.round(totalDeposited),
          cumulativeGasFees: Math.round(gasFeesPerWeek.weeklyTotal * week),
          cumulativeUtilityFees: Math.round(utilityFeePerWeek * week)
        });
      }
    }

    // Final conversion: dump remaining strands into wBTC at contract conclusion
    if (data.length > 0) {
      const finalData = data[data.length - 1];
      const remainingStrands = finalData.strand1 + finalData.strand2 + finalData.strand3;
      finalData.wbtc += remainingStrands;
      finalData.strand1 = 0;
      finalData.strand2 = 0;
      finalData.strand3 = 0;
      finalData.total = finalData.wbtc;
    }
    setChartData(data);
  };
  useEffect(() => {
    calculateSimulation();
  }, [apyStrand1, apyStrand2, apyStrand3, btcPrice, simulationYears, simulationRigor, customSimulationAmount, vaultStats.totalMembers]);
  const closeModal = () => {
    setActiveModal(null);
    setActiveStrand(null);
  };
  const navigateTo = page => {
    setCurrentPage(page);
    tutorial.setCurrentPage(page); // Sync with tutorial system
  };
  const calculateWeeklyDepositAmount = () => {
    if (!walletConnected || !walletAddress) {
      console.log("Debug: Wallet not connected");
      return 0;
    }

    // Get all subclubs user is a member of
    const userSubclubs = deployedSubclubs.filter(club => club.members && club.members.includes(walletAddress));
    console.log("Debug calculateWeeklyDepositAmount:");
    console.log("- Deployed contracts:", deployedSubclubs.length);
    console.log("- User contracts:", userSubclubs.length);
    console.log("- Wallet address:", walletAddress);
    if (userSubclubs.length === 0) {
      console.log("Debug: No user contracts found");
      return 0;
    }

    // Weekly deposit amounts by rigor level (corrected from documents)
    const rigorAmounts = {
      light: 25,
      // Will be calculated based on contract age: $100-$250/month
      medium: 50,
      // Years 1-3: $50/week, 4-6: $100/week, 7-10: $200/week, 11+: $250/week
      heavy: 100,
      // Years 1-3: $100/week, 4-6: $200/week, 7-10: $300/week, 11+: $400/week
      custom: 0 // Will be calculated from custom schedule
    };

    // Sum up weekly deposits for all contracts user is in
    const totalAmount = userSubclubs.reduce((total, subclub) => {
      let amount = rigorAmounts[subclub.rigorLevel] || 0;

      // For light rigor, calculate based on contract age
      if (subclub.rigorLevel === 'light') {
        const contractStartDate = new Date(subclub.createdAt).getTime();
        const now = Date.now();
        const yearsElapsed = (now - contractStartDate) / (365.25 * 24 * 60 * 60 * 1000);
        if (yearsElapsed < 1) {
          amount = 100 / 4.33;
        } else if (yearsElapsed < 2) {
          amount = 150 / 4.33;
        } else if (yearsElapsed < 3) {
          amount = 200 / 4.33;
        } else {
          amount = 250 / 4.33;
        }
      }
      // For custom rigor, calculate based on custom schedule
      else if (subclub.rigorLevel === 'custom') {
        const freq = subclub.customDepositFrequency || 'weekly';
        if (subclub.customSchedule) {
          const contractStartDate = new Date(subclub.createdAt).getTime();
          const now = Date.now();
          const yearsElapsed = (now - contractStartDate) / (365.25 * 24 * 60 * 60 * 1000);
          const currentPeriod = subclub.customSchedule.find(period => yearsElapsed >= period.yearStart - 1 && yearsElapsed < period.yearEnd);
          const rawAmount = currentPeriod ? currentPeriod.amount : subclub.customWeeklyAmount || 0;
          amount = toWeeklyAmount(rawAmount, freq);
        } else {
          amount = toWeeklyAmount(subclub.customWeeklyAmount || 0, freq);
        }
      }
      // For heavy rigor, calculate based on contract age
      else if (subclub.rigorLevel === 'heavy') {
        const contractStartDate = new Date(subclub.createdAt).getTime();
        const now = Date.now();
        const yearsElapsed = (now - contractStartDate) / (365.25 * 24 * 60 * 60 * 1000);
        if (yearsElapsed < 3) {
          amount = 100;
        } else if (yearsElapsed < 6) {
          amount = 200;
        } else if (yearsElapsed < 10) {
          amount = 300;
        } else {
          amount = 400;
        }
      }

      // For medium rigor, calculate based on contract age
      if (subclub.rigorLevel === 'medium') {
        const contractStartDate = new Date(subclub.createdAt).getTime();
        const now = Date.now();
        const yearsElapsed = (now - contractStartDate) / (365.25 * 24 * 60 * 60 * 1000);
        if (yearsElapsed < 3) {
          amount = 50;
        } else if (yearsElapsed < 6) {
          amount = 100;
        } else if (yearsElapsed < 10) {
          amount = 200;
        } else {
          amount = 250;
        }
      }
      console.log(`- Contract ${subclub.contractAddress.slice(0, 8)}: ${subclub.rigorLevel} = ${amount}/week`);
      return total + amount;
    }, 0);
    console.log("Debug: Total weekly deposit amount:", totalAmount);
    return totalAmount;
  };
  const canDeposit = () => {
    if (!lastDepositTime) return true;
    const now = Date.now();
    const lastDeposit = new Date(lastDepositTime).getTime();
    const daysDifference = (now - lastDeposit) / (1000 * 60 * 60 * 24);
    return daysDifference >= 5;
  };
  const getDaysUntilNextDeposit = () => {
    if (!lastDepositTime) return 0;
    const now = Date.now();
    const lastDeposit = new Date(lastDepositTime).getTime();
    const daysDifference = (now - lastDeposit) / (1000 * 60 * 60 * 24);
    return Math.max(0, Math.ceil(5 - daysDifference));
  };
  const handleConnectWallet = async () => {
    setShowAuthModal(true);
    tutorial.setAuthModalOpen(true); // Suppress tutorials during auth
  };
  
  // Handle initial form submission - intercepts signup to show ToS
  const handleAuthSubmit = async () => {
    if (authMode === 'signup' && authPassword !== authConfirmPassword) {
      setAuthError('Passwords do not match!');
      return;
    }
    if (!authEmail || !authPassword) {
      setAuthError('Please fill in all fields');
      return;
    }
    
    // For signup, show ToS modal first instead of creating account
    if (authMode === 'signup') {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(authEmail)) {
        setAuthError('Please enter a valid email address');
        return;
      }
      if (authPassword.length < 6) {
        setAuthError('Password must be at least 6 characters');
        return;
      }
      
      // Store credentials and show ToS modal
      setPendingSignupData({ email: authEmail, password: authPassword });
      setShowToSModal(true);
      setAuthError('');
      return;
    }
    
    // For login, proceed directly
    setAuthLoading(true);
    setAuthError('');
    setAuthSuccess('');
    try {
      console.log('[VaultClub] Starting sign in...');
      const result = await signInUser(authEmail, authPassword);
      
      if (!result.success) {
        throw new Error(result.error || 'Sign in failed');
      }

      if (result.walletAddress) {
        setWalletAddress(result.walletAddress);
        console.log('[VaultClub] Sign in complete with wallet:', result.walletAddress);
      }
      
      setVaultBalance("0");
      setAuthEmail('');
      setAuthPassword('');
      setAuthConfirmPassword('');
    } catch (error: any) {
      setAuthError(error.message || 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };
  
  // Handle ToS acceptance - actually create the account
  const handleToSAccept = async () => {
    if (!pendingSignupData) return;
    
    setAuthLoading(true);
    setAuthError('');
    setAuthSuccess('');
    
    try {
      console.log('[VaultClub] ToS accepted, creating account...');
      const result = await registerUser(
        pendingSignupData.email, 
        pendingSignupData.password, 
        `${window.location.origin}/`
      );
      
      if (!result.success) {
        throw new Error(result.error || 'Registration failed');
      }

      if (result.requiresEmailConfirmation) {
        setAuthSuccess('Check your email for confirmation link!');
      } else if (result.walletAddress) {
        setWalletAddress(result.walletAddress);
        console.log('[VaultClub] Registration complete with wallet:', result.walletAddress);
      }
      
      // Clear form and close modals
      setAuthEmail('');
      setAuthPassword('');
      setAuthConfirmPassword('');
      setPendingSignupData(null);
      setShowToSModal(false);
      setShowAuthModal(false);
    } catch (error: any) {
      setAuthError(error.message || 'Registration failed');
      setShowToSModal(false); // Close ToS modal to show error in auth modal
    } finally {
      setAuthLoading(false);
    }
  };
  
  // Handle ToS modal close (cancel)
  const handleToSClose = () => {
    setShowToSModal(false);
    setPendingSignupData(null);
    // Keep auth modal open so user can try again or switch to login
  };
  
  const handleSignOut = async () => {
    console.log('[VaultClub] Signing out...');
    await signOutUser();
    setWalletConnected(false);
    setWalletAddress('');
    setVaultBalance("0");
    setSelectedContract(null);
    setActiveStrand(null);
  };
  const getContractColor = subclub => {
    // Use the color assigned when the contract was created
    return subclub.borderColor || 'border-gray-500'; // fallback color
  };
  const goHome = () => {
    setCurrentPage('home');
    tutorial.setCurrentPage('home'); // Sync with tutorial system
  };
  const handleDeposit = async () => {
    const weeklyAmount = calculateWeeklyDepositAmount();
    console.log("Debug deposit - Weekly amount:", weeklyAmount);
    console.log("Debug deposit - User contracts:", deployedSubclubs.filter(club => club.members && club.members.includes(walletAddress)));
    if (weeklyAmount === 0) {
      alert("You must join at least one contract before depositing.");
      return;
    }
    if (!canDeposit()) {
      const daysLeft = getDaysUntilNextDeposit();
      alert(`You can deposit again in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`);
      return;
    }
    const success = await depositToVault(weeklyAmount);
    if (success) {
      console.log("Deposit successful, updating balances...");

      // Update individual strand balances for each contract the user is in
      const userContracts = deployedSubclubs.filter(club => club.members && club.members.includes(walletAddress));
      console.log("User contracts found:", userContracts.length);
      if (userContracts.length === 0) {
        alert("Error: No contracts found for user. Please create or join a contract first.");
        return;
      }

      // Split the deposit proportionally across all user's contracts
      const amountPerContract = weeklyAmount / userContracts.length;
      const strand1PerContract = amountPerContract * 0.10;
      const strand2PerContract = amountPerContract * 0.60;
      const strand3PerContract = amountPerContract * 0.30;
      console.log("Amount per contract:", amountPerContract);
      console.log("Strand allocations:", {
        strand1PerContract,
        strand2PerContract,
        strand3PerContract
      });

      // Update each contract's balances proportionally based on their rigor requirements
      setDeployedSubclubs(prev => {
        const updated = prev.map(club => {
          if (club.members && club.members.includes(walletAddress)) {
            // Calculate this contract's weekly deposit amount
            let contractWeeklyAmount = rigorAmounts[club.rigorLevel] || 0;

            // For light rigor, calculate based on contract age
            if (club.rigorLevel === 'light') {
              const contractStartDate = new Date(club.createdAt).getTime();
              const now = Date.now();
              const yearsElapsed = (now - contractStartDate) / (365.25 * 24 * 60 * 60 * 1000);
              if (yearsElapsed < 1) {
                contractWeeklyAmount = 100 / 4.33;
              } else if (yearsElapsed < 2) {
                contractWeeklyAmount = 150 / 4.33;
              } else if (yearsElapsed < 3) {
                contractWeeklyAmount = 200 / 4.33;
              } else {
                contractWeeklyAmount = 250 / 4.33;
              }
            }
            // For custom rigor, calculate based on custom schedule
            else if (club.rigorLevel === 'custom') {
              const freq = club.customDepositFrequency || 'weekly';
              if (club.customSchedule) {
                const contractStartDate = new Date(club.createdAt).getTime();
                const now = Date.now();
                const yearsElapsed = (now - contractStartDate) / (365.25 * 24 * 60 * 60 * 1000);
                const currentPeriod = club.customSchedule.find(period => yearsElapsed >= period.yearStart - 1 && yearsElapsed < period.yearEnd);
                const rawAmount = currentPeriod ? currentPeriod.amount : club.customWeeklyAmount || 0;
                contractWeeklyAmount = toWeeklyAmount(rawAmount, freq);
              } else {
                contractWeeklyAmount = toWeeklyAmount(club.customWeeklyAmount || 0, freq);
              }
            }
            // For heavy rigor, calculate based on contract age
            else if (club.rigorLevel === 'heavy') {
              const contractStartDate = new Date(club.createdAt).getTime();
              const now = Date.now();
              const yearsElapsed = (now - contractStartDate) / (365.25 * 24 * 60 * 60 * 1000);
              if (yearsElapsed < 3) {
                contractWeeklyAmount = 100;
              } else if (yearsElapsed < 6) {
                contractWeeklyAmount = 200;
              } else if (yearsElapsed < 10) {
                contractWeeklyAmount = 300;
              } else {
                contractWeeklyAmount = 400;
              }
            }

            // For medium rigor, calculate based on contract age  
            else if (club.rigorLevel === 'medium') {
              const contractStartDate = new Date(club.createdAt).getTime();
              const now = Date.now();
              const yearsElapsed = (now - contractStartDate) / (365.25 * 24 * 60 * 60 * 1000);
              if (yearsElapsed < 3) {
                contractWeeklyAmount = 50;
              } else if (yearsElapsed < 6) {
                contractWeeklyAmount = 100;
              } else if (yearsElapsed < 10) {
                contractWeeklyAmount = 200;
              } else {
                contractWeeklyAmount = 250;
              }
            }

            // Split according to strand allocation (10%, 60%, 30%)
            const strand1Addition = contractWeeklyAmount * 0.10;
            const strand2Addition = contractWeeklyAmount * 0.60;
            const strand3Addition = contractWeeklyAmount * 0.30;
            const newClub = {
              ...club,
              strand1Balance: (parseFloat(club.strand1Balance || "0") + strand1Addition).toString(),
              strand2Balance: (parseFloat(club.strand2Balance || "0") + strand2Addition).toString(),
              strand3Balance: (parseFloat(club.strand3Balance || "0") + strand3Addition).toString(),
              totalContractBalance: (parseFloat(club.totalContractBalance || "0") + contractWeeklyAmount).toString()
            };
            console.log(`Updated club ${newClub.contractAddress.slice(0, 8)} (${club.rigorLevel}):`, {
              weeklyAmount: contractWeeklyAmount,
              strand1: strand1Addition,
              strand2: strand2Addition,
              strand3: strand3Addition,
              newTotal: newClub.totalContractBalance
            });
            return newClub;
          }
          return club;
        });
        return updated;
      });

      // Update user's total balance
      setVaultBalance(prev => {
        const currentTotal = parseFloat(prev);
        const newTotal = (currentTotal + weeklyAmount).toString();
        console.log("Updated vault balance:", newTotal);
        return newTotal;
      });
      setLastDepositTime(new Date().toISOString());
      setVaultStats(prev => {
        const updated = {
          ...prev,
          totalMembers: prev.totalMembers === 0 ? 1 : prev.totalMembers,
          totalDeposits: (parseFloat(prev.totalDeposits) + weeklyAmount).toString(),
          transactions: prev.transactions + 1
        };
        console.log("Updated vault stats:", updated);
        return updated;
      });
      console.log("All state updates completed");
    }
  };
  const handleCreateClub = async () => {
    if (!walletConnected) {
      alert("Please connect your wallet first");
      return;
    }

    // Generate a realistic contract address
    const contractAddress = `0x${Math.random().toString(16).substr(2, 40)}`;

    // Assign a random color when creating the contract
    const colors = ['border-yellow-500', 'border-green-500', 'border-blue-500', 'border-red-500', 'border-purple-500', 'border-orange-500', 'border-pink-500', 'border-indigo-500'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    // Create new subclub object with assigned color
    const newSubclub = {
      id: Date.now(),
      contractAddress,
      creator: walletAddress,
      maxMembers: clubCreationData.maxMembers,
      lockupPeriod: clubCreationData.lockupPeriod,
      rigorLevel: clubCreationData.rigorLevel,
      isPrivate: clubCreationData.isPrivate,
      isChargedContract: clubCreationData.isChargedContract,
      currentMembers: 1,
      // Creator is first member
      createdAt: new Date().toISOString(),
      status: 'active',
      totalDeposits: 0,
      members: [walletAddress],
      borderColor: randomColor,
      // Store the color with the contract
      customDepositFrequency: clubCreationData.rigorLevel === 'custom' ? clubCreationData.customDepositFrequency : undefined,
      customWeeklyAmount: clubCreationData.rigorLevel === 'custom' ? clubCreationData.customWeeklyAmount : undefined,
      customSchedule: clubCreationData.rigorLevel === 'custom' ? clubCreationData.customSchedule : undefined,
      // Contract-specific strand balances
      strand1Balance: "0",
      strand2Balance: "0",
      strand3Balance: "0",
      totalContractBalance: "0"
    };

    // Add to deployed subclubs
    setDeployedSubclubs(prev => [...prev, newSubclub]);

    // Success notification
    alert(`✅ Contract Deployed Successfully!

Contract Address: ${contractAddress}
Contract Type: ${clubCreationData.isChargedContract ? 'Charged Contract' : 'Traditional Contract'}
Max Members: ${clubCreationData.maxMembers}
Lockup Period: ${clubCreationData.lockupPeriod} ${clubCreationData.isChargedContract ? 'month' : 'year'}${clubCreationData.lockupPeriod === 1 ? '' : 's'}
Investment Rigor: ${clubCreationData.rigorLevel.charAt(0).toUpperCase() + clubCreationData.rigorLevel.slice(1)}
Privacy: ${clubCreationData.isPrivate ? 'Private (invitation only)' : 'Public (visible to all)'}
Utility Fee: ${clubCreationData.isChargedContract ? '$1.25' : '$1.00'}/user/week

Your contract is now live and ready for members to join!`);
    setActiveModal(null);
    setSelectedTemplate(null);
    setShowCustomControls(false);
  };
  
  // Contract Templates Definition
  const CONTRACT_TEMPLATES = [
    {
      id: 'beta',
      name: 'Beta',
      tagline: 'Early access testing mode',
      description: 'Designed for early stage usage and testing. Perfect for exploring the platform while we refine the experience.',
      icon: <TestTube className="w-8 h-8" />,
      gradient: 'from-yellow-500 to-amber-600',
      tags: [
        { label: 'Early Access', color: 'bg-yellow-100 text-yellow-700' },
        { label: 'Testing', color: 'bg-amber-100 text-amber-700' },
        { label: 'Active', color: 'bg-green-100 text-green-700' }
      ],
      settings: {
        lockupPeriod: 1,
        rigorLevel: 'light',
        riskLevel: 'low',
        isChargedContract: true,
        phase2TimePercent: 50,
        phase2ValueThreshold: 100000
      },
      highlights: ['1-month trial', 'Light commitment', 'Full feature access'],
      disabled: false
    },
    {
      id: 'foundation',
      name: 'The Foundation',
      tagline: 'A balanced start for your wealth journey',
      description: 'The most popular choice. Steady growth with manageable commitments that fit into everyday life.',
      icon: <Shield className="w-8 h-8" />,
      gradient: 'from-blue-500 to-indigo-600',
      tags: [
        { label: 'Balanced', color: 'bg-blue-100 text-blue-700' },
        { label: 'Long-term', color: 'bg-purple-100 text-purple-700' },
        { label: 'Recommended', color: 'bg-green-100 text-green-700' }
      ],
      settings: {
        lockupPeriod: 5,
        rigorLevel: 'medium',
        riskLevel: 'medium',
        isChargedContract: false,
        phase2TimePercent: 50,
        phase2ValueThreshold: 500000
      },
      highlights: ['5-year commitment', '$50/week to start', 'Grows with you over time'],
      disabled: true
    },
    {
      id: 'steady-builder',
      name: 'Steady Builder',
      tagline: 'Slow and steady wins the race',
      description: 'Perfect for those who prefer a gentler approach. Lower weekly amounts that gradually increase as you grow.',
      icon: <TrendingUp className="w-8 h-8" />,
      gradient: 'from-emerald-500 to-teal-600',
      tags: [
        { label: 'Safe', color: 'bg-green-100 text-green-700' },
        { label: 'Long-term', color: 'bg-purple-100 text-purple-700' },
        { label: 'Beginner', color: 'bg-blue-100 text-blue-700' }
      ],
      settings: {
        lockupPeriod: 7,
        rigorLevel: 'light',
        riskLevel: 'low',
        isChargedContract: false,
        phase2TimePercent: 60,
        phase2ValueThreshold: 300000
      },
      highlights: ['7-year journey', '$100/month to start', 'Gentle increases over time'],
      disabled: true
    },
    {
      id: 'extreme-wealth',
      name: 'Extreme Wealth',
      tagline: 'Maximum commitment, maximum potential',
      description: 'For the serious wealth builder. Longer timelines mean more compounding power. Time and discipline are your greatest allies.',
      icon: <Crown className="w-8 h-8" />,
      gradient: 'from-amber-500 to-orange-600',
      tags: [
        { label: 'Moderate', color: 'bg-yellow-100 text-yellow-700' },
        { label: 'Long-term', color: 'bg-purple-100 text-purple-700' },
        { label: 'High Reward', color: 'bg-amber-100 text-amber-700' }
      ],
      settings: {
        lockupPeriod: 15,
        rigorLevel: 'heavy',
        riskLevel: 'medium',
        isChargedContract: false,
        phase2TimePercent: 50,
        phase2ValueThreshold: 1000000
      },
      highlights: ['15-year commitment', '$100/week to start', 'Scales up significantly'],
      disabled: true
    },
    {
      id: 'compounder',
      name: 'The Compounder',
      tagline: 'Let time do the heavy lifting',
      description: 'A decade-long journey focused on steady compounding. Watch your wealth grow while you live your life.',
      icon: <Sparkles className="w-8 h-8" />,
      gradient: 'from-violet-500 to-purple-600',
      tags: [
        { label: 'Balanced', color: 'bg-blue-100 text-blue-700' },
        { label: 'Long-term', color: 'bg-purple-100 text-purple-700' },
        { label: 'Set & Forget', color: 'bg-indigo-100 text-indigo-700' }
      ],
      settings: {
        lockupPeriod: 10,
        rigorLevel: 'medium',
        riskLevel: 'low',
        isChargedContract: false,
        phase2TimePercent: 50,
        phase2ValueThreshold: 750000
      },
      highlights: ['10-year horizon', '$50/week steady', 'Reliable growth path'],
      disabled: true
    },
    {
      id: 'test-drive',
      name: 'Quick Test Drive',
      tagline: 'Try it out, no long commitment',
      description: 'Want to see how it works first? Start with a shorter timeline to get comfortable with the system.',
      icon: <TestTube className="w-8 h-8" />,
      gradient: 'from-cyan-500 to-blue-600',
      tags: [
        { label: 'Safe', color: 'bg-green-100 text-green-700' },
        { label: 'Short-term', color: 'bg-cyan-100 text-cyan-700' },
        { label: 'Trial', color: 'bg-gray-100 text-gray-700' }
      ],
      settings: {
        lockupPeriod: 3,
        rigorLevel: 'light',
        riskLevel: 'low',
        isChargedContract: true,
        phase2TimePercent: 70,
        phase2ValueThreshold: 50000
      },
      highlights: ['3-month trial', 'Light commitments', 'Learn the ropes'],
      disabled: true
    },
    {
      id: 'sprinter',
      name: 'The Sprinter',
      tagline: 'Medium-term with momentum',
      description: 'A 3-year sprint towards your goals. Balanced approach for those who want meaningful results in a reasonable timeframe.',
      icon: <Zap className="w-8 h-8" />,
      gradient: 'from-sky-500 to-blue-600',
      tags: [
        { label: 'Moderate', color: 'bg-yellow-100 text-yellow-700' },
        { label: 'Medium-term', color: 'bg-sky-100 text-sky-700' },
        { label: 'Active', color: 'bg-blue-100 text-blue-700' }
      ],
      settings: {
        lockupPeriod: 3,
        rigorLevel: 'medium',
        riskLevel: 'medium',
        isChargedContract: false,
        phase2TimePercent: 50,
        phase2ValueThreshold: 200000
      },
      highlights: ['3-year focus', '$50/week consistent', 'Quick Phase 2 transition'],
      disabled: true
    },
    {
      id: 'accelerator',
      name: 'Growth Accelerator',
      tagline: 'Aggressive growth for the ambitious',
      description: 'Push the pace with higher contributions. More in means more potential out. For those ready to commit seriously.',
      icon: <Rocket className="w-8 h-8" />,
      gradient: 'from-rose-500 to-pink-600',
      tags: [
        { label: 'Aggressive', color: 'bg-red-100 text-red-700' },
        { label: 'Medium-term', color: 'bg-sky-100 text-sky-700' },
        { label: 'High Growth', color: 'bg-pink-100 text-pink-700' }
      ],
      settings: {
        lockupPeriod: 5,
        rigorLevel: 'heavy',
        riskLevel: 'medium',
        isChargedContract: false,
        phase2TimePercent: 40,
        phase2ValueThreshold: 400000
      },
      highlights: ['5-year accelerated', '$100/week to start', 'Faster wealth building'],
      disabled: true
    },
    {
      id: 'extreme-degen',
      name: 'Extreme Degen',
      tagline: 'High risk, high potential rewards',
      description: 'Not for the faint of heart. Maximum exposure to growth strategies. You understand the risks and embrace them.',
      icon: <Flame className="w-8 h-8" />,
      gradient: 'from-red-500 to-orange-600',
      tags: [
        { label: 'High Risk', color: 'bg-red-100 text-red-700' },
        { label: 'Medium-term', color: 'bg-sky-100 text-sky-700' },
        { label: 'Aggressive', color: 'bg-orange-100 text-orange-700' }
      ],
      settings: {
        lockupPeriod: 5,
        rigorLevel: 'heavy',
        riskLevel: 'high',
        isChargedContract: false,
        phase2TimePercent: 35,
        phase2ValueThreshold: 500000
      },
      highlights: ['5-year intense', 'Heavy contributions', 'Maximum growth mode'],
      disabled: true
    },
    {
      id: 'yolo',
      name: 'YOLO Mode',
      tagline: 'All in, nothing held back',
      description: 'The most aggressive option available. Highest risk settings with heavy commitments. Only for those who truly understand what they\'re signing up for.',
      icon: <Target className="w-8 h-8" />,
      gradient: 'from-fuchsia-500 to-purple-600',
      tags: [
        { label: 'Max Risk', color: 'bg-red-100 text-red-700' },
        { label: 'Long-term', color: 'bg-purple-100 text-purple-700' },
        { label: 'All In', color: 'bg-fuchsia-100 text-fuchsia-700' }
      ],
      settings: {
        lockupPeriod: 10,
        rigorLevel: 'heavy',
        riskLevel: 'high',
        isChargedContract: false,
        phase2TimePercent: 30,
        phase2ValueThreshold: 750000
      },
      highlights: ['10-year marathon', 'Maximum contributions', 'Highest growth potential'],
      disabled: true
    },
    {
      id: 'custom',
      name: 'Custom',
      tagline: 'Full control over every detail',
      description: 'Design your own contract with complete flexibility. Set your own timeline, contribution schedule, and risk level. Great for group contracts too!',
      icon: <Settings className="w-8 h-8" />,
      gradient: 'from-slate-500 to-gray-600',
      tags: [
        { label: 'Flexible', color: 'bg-gray-100 text-gray-700' },
        { label: 'Any Timeline', color: 'bg-slate-100 text-slate-700' },
        { label: 'Groups OK', color: 'bg-indigo-100 text-indigo-700' }
      ],
      settings: null, // Uses current clubCreationData
      highlights: ['Any lockup period', 'Custom contributions', 'Multi-member groups'],
      disabled: true
    }
  ];
  
  const applyTemplate = (template: typeof CONTRACT_TEMPLATES[0]) => {
    setSelectedTemplate(template.id);
    if (template.settings) {
      setClubCreationData(prev => ({
        ...prev,
        lockupPeriod: template.settings!.lockupPeriod,
        rigorLevel: template.settings!.rigorLevel,
        riskLevel: template.settings!.riskLevel,
        isChargedContract: template.settings!.isChargedContract,
        maxMembers: 1,
        isPrivate: true,
        phase2TimePercent: template.settings!.phase2TimePercent,
        phase2ValueThreshold: template.settings!.phase2ValueThreshold,
        phase2TriggerType: 'both'
      }));
      setShowCustomControls(false);
    } else {
      setShowCustomControls(true);
    }
  };

  const CreateClubModal = () => {
    const currentTemplate = CONTRACT_TEMPLATES[templateCarouselIndex];
    
    return <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-up" role="dialog" aria-modal="true" aria-labelledby="create-club-title">
        <div className="bg-slate-900 rounded-2xl max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-hidden ring-1 ring-white/10">
          {/* Header */}
          <div className={`bg-gradient-to-r ${currentTemplate.gradient} p-6 rounded-t-2xl text-white relative overflow-hidden`}>
            <div className="absolute inset-0 bg-black/10"></div>
            <div className="relative flex justify-between items-start">
              <div>
                <h3 id="create-club-title" className="text-2xl font-bold">Create Your Contract</h3>
                <p className="text-white/80 mt-1">Choose a template that fits your goals</p>
              </div>
              <button onClick={() => { closeModal(); setSelectedTemplate(null); setShowCustomControls(false); setTemplateCarouselIndex(0); }} className="text-white/80 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10" aria-label="Close modal">
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
          
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(90vh - 100px)' }}>
            {/* Key Message */}
            <div className="px-6 pt-5 pb-3">
              <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-4 text-center">
                <p className="text-amber-200 text-sm font-medium">
                  💡 Time and discipline are your greatest wealth-building tools. Longer commitments = more compounding power.
                </p>
                <p className="text-amber-200/70 text-xs mt-2">
                  Want to create a group contract? Choose "Custom" for multi-member options.
                </p>
              </div>
            </div>
            
            {/* Template Carousel */}
            <div className="px-6 py-4">
              {/* Carousel Navigation */}
              <div className="flex items-center justify-between mb-4">
                <button 
                  onClick={() => setTemplateCarouselIndex(prev => prev > 0 ? prev - 1 : CONTRACT_TEMPLATES.length - 1)}
                  className="p-3 rounded-full bg-white/5 hover:bg-white/10 transition-all duration-300 text-white/70 hover:text-white hover:scale-110 active:scale-95"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <div className="flex items-center gap-2">
                  {CONTRACT_TEMPLATES.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setTemplateCarouselIndex(idx)}
                      className={`h-2 rounded-full transition-all duration-500 ${idx === templateCarouselIndex ? 'bg-white w-8' : 'bg-white/30 hover:bg-white/50 w-2'}`}
                    />
                  ))}
                </div>
                <button 
                  onClick={() => setTemplateCarouselIndex(prev => prev < CONTRACT_TEMPLATES.length - 1 ? prev + 1 : 0)}
                  className="p-3 rounded-full bg-white/5 hover:bg-white/10 transition-all duration-300 text-white/70 hover:text-white hover:scale-110 active:scale-95"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </div>
              
              {/* Card Stack Container */}
              <div className="relative h-[340px] perspective-1000">
                {CONTRACT_TEMPLATES.map((template, idx) => {
                  const offset = idx - templateCarouselIndex;
                  const isActive = offset === 0;
                  const isPrev = offset === -1 || (templateCarouselIndex === 0 && idx === CONTRACT_TEMPLATES.length - 1);
                  const isNext = offset === 1 || (templateCarouselIndex === CONTRACT_TEMPLATES.length - 1 && idx === 0);
                  const isDisabled = template.disabled;
                  
                  // Only render nearby cards for performance
                  if (Math.abs(offset) > 2 && !isPrev && !isNext) return null;
                  
                  return (
                    <div
                      key={template.id}
                      className={`absolute inset-0 transition-all duration-500 ease-out ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                      style={{
                        transform: isActive 
                          ? 'translateX(0) rotateY(0deg) scale(1)' 
                          : isPrev 
                            ? 'translateX(-85%) rotateY(25deg) scale(0.85)' 
                            : isNext 
                              ? 'translateX(85%) rotateY(-25deg) scale(0.85)'
                              : offset < 0 
                                ? 'translateX(-150%) rotateY(45deg) scale(0.7)'
                                : 'translateX(150%) rotateY(-45deg) scale(0.7)',
                        opacity: isActive ? 1 : (isPrev || isNext) ? 0.6 : 0,
                        zIndex: isActive ? 30 : (isPrev || isNext) ? 20 : 10,
                        pointerEvents: isActive ? 'auto' : 'none',
                      }}
                      onClick={() => isActive && !isDisabled && applyTemplate(template)}
                    >
                      <div 
                        className={`h-full bg-gradient-to-br ${template.gradient} rounded-2xl p-6 text-white shadow-2xl relative overflow-hidden ${selectedTemplate === template.id ? 'ring-4 ring-white/50' : ''}`}
                      >
                        {/* Disabled Overlay */}
                        {isDisabled && (
                          <div className="absolute inset-0 bg-gray-900/70 backdrop-blur-[2px] rounded-2xl z-10 flex flex-col items-center justify-center">
                            <div className="bg-gray-800/90 px-6 py-3 rounded-xl border border-gray-600/50 shadow-xl">
                              <span className="text-xl font-bold text-gray-200">Coming Soon</span>
                            </div>
                            <p className="text-gray-400 text-sm mt-3">This template is not yet available</p>
                          </div>
                        )}
                        
                        {selectedTemplate === template.id && !isDisabled && (
                          <div className="absolute top-4 right-4 bg-white rounded-full p-1 shadow-lg z-20">
                            <Check className="w-5 h-5 text-green-600" />
                          </div>
                        )}
                        
                        <div className="flex items-start gap-4 mb-4">
                          <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm shadow-inner">
                            {template.icon}
                          </div>
                          <div className="flex-1">
                            <h4 className="text-xl font-bold">{template.name}</h4>
                            <p className="text-white/80 text-sm">{template.tagline}</p>
                          </div>
                        </div>
                        
                        <p className="text-white/90 text-sm mb-4 leading-relaxed">
                          {template.description}
                        </p>
                        
                        {/* Tags */}
                        <div className="flex flex-wrap gap-2 mb-4">
                          {template.tags.map((tag, tagIdx) => (
                            <span key={tagIdx} className={`px-3 py-1 rounded-full text-xs font-medium ${tag.color} shadow-sm`}>
                              {tag.label}
                            </span>
                          ))}
                        </div>
                        
                        {/* Highlights */}
                        <div className="grid grid-cols-3 gap-2">
                          {template.highlights.map((highlight, hIdx) => (
                            <div key={hIdx} className="bg-white/10 backdrop-blur-sm rounded-lg p-2 text-center">
                              <span className="text-xs text-white/90">{highlight}</span>
                            </div>
                          ))}
                        </div>
                        
                        {/* Selection hint */}
                        <div className="mt-4 text-center">
                          <span className={`text-xs transition-all duration-300 ${selectedTemplate === template.id ? 'text-white font-medium' : 'text-white/60'}`}>
                            {isDisabled ? '' : selectedTemplate === template.id ? '✓ Selected' : 'Click to select'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Template counter */}
              <div className="text-center mt-4">
                <span className="text-white/50 text-sm">{templateCarouselIndex + 1} / {CONTRACT_TEMPLATES.length}</span>
              </div>
            </div>
            
            {/* Custom Controls (shown only for Custom template) */}
            {showCustomControls && (
              <div className="px-6 pb-4 space-y-4 animate-fade-up">
                <div className="border-t border-white/10 pt-4">
                  <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    Custom Settings
                  </h4>
                  
                  {/* Contract Type Toggle */}
                  <div className="mb-4">
                    <label className="text-sm text-white/70 mb-2 block">Contract Type</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setClubCreationData(prev => ({ ...prev, isChargedContract: false, lockupPeriod: 5 }))}
                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${!clubCreationData.isChargedContract ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
                      >
                        Traditional (Years)
                      </button>
                      <button
                        onClick={() => setClubCreationData(prev => ({ ...prev, isChargedContract: true, lockupPeriod: 3 }))}
                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${clubCreationData.isChargedContract ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
                      >
                        Charged (Months)
                      </button>
                    </div>
                  </div>
                  
                  {/* Lockup Period - Full options */}
                  <div className="mb-4">
                    <label className="text-sm text-white/70 mb-2 block">
                      Lockup Period ({clubCreationData.isChargedContract ? 'Months' : 'Years'})
                    </label>
                    {clubCreationData.isChargedContract ? (
                      <div className="grid grid-cols-6 gap-2">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(num => (
                          <button
                            key={num}
                            onClick={() => setClubCreationData(prev => ({ ...prev, lockupPeriod: num }))}
                            className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${clubCreationData.lockupPeriod === num ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
                          >
                            {num}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-6 gap-2">
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(num => (
                            <button
                              key={num}
                              onClick={() => setClubCreationData(prev => ({ ...prev, lockupPeriod: num }))}
                              className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${clubCreationData.lockupPeriod === num ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
                            >
                              {num}
                            </button>
                          ))}
                          <button
                            onClick={() => setShowExtendedLockup(!showExtendedLockup)}
                            className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${showExtendedLockup || clubCreationData.lockupPeriod > 11 ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
                          >
                            More
                          </button>
                        </div>
                        {showExtendedLockup && (
                          <div className="grid grid-cols-5 gap-2 mt-2">
                            {[12, 13, 14, 15, 16, 17, 18, 19, 20].map(num => (
                              <button
                                key={num}
                                onClick={() => setClubCreationData(prev => ({ ...prev, lockupPeriod: num }))}
                                className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${clubCreationData.lockupPeriod === num ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
                              >
                                {num}
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  
                  {/* Rigor Level */}
                  <div className="mb-4">
                    <label className="text-sm text-white/70 mb-2 block">Contribution Level</label>
                    <div className="grid grid-cols-4 gap-2">
                      {['light', 'medium', 'heavy', 'custom'].map(level => (
                        <button
                          key={level}
                          onClick={() => setClubCreationData(prev => ({ ...prev, rigorLevel: level }))}
                          className={`py-2 px-3 rounded-lg text-sm font-medium transition-all capitalize ${clubCreationData.rigorLevel === level ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Risk Level */}
                  <div className="mb-4">
                    <label className="text-sm text-white/70 mb-2 block">Risk Level</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['low', 'medium', 'high'].map(level => (
                        <button
                          key={level}
                          onClick={() => setClubCreationData(prev => ({ ...prev, riskLevel: level }))}
                          className={`py-2 px-3 rounded-lg text-sm font-medium transition-all capitalize ${
                            clubCreationData.riskLevel === level 
                              ? level === 'low' ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
                                : level === 'medium' ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-white'
                                : 'bg-gradient-to-r from-red-500 to-rose-500 text-white'
                              : 'bg-white/10 text-white/70 hover:bg-white/20'
                          }`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Members */}
                  <div className="mb-4">
                    <label className="text-sm text-white/70 mb-2 block">Maximum Members</label>
                    <div className="grid grid-cols-8 gap-2">
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(num => (
                        <button
                          key={num}
                          onClick={() => setClubCreationData(prev => ({ ...prev, maxMembers: num }))}
                          className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${clubCreationData.maxMembers === num ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Privacy */}
                  <div className="mb-4">
                    <label className="text-sm text-white/70 mb-2 block">Privacy</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setClubCreationData(prev => ({ ...prev, isPrivate: true }))}
                        className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${clubCreationData.isPrivate ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
                      >
                        Private
                      </button>
                      <button
                        onClick={() => setClubCreationData(prev => ({ ...prev, isPrivate: false }))}
                        className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${!clubCreationData.isPrivate ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
                      >
                        Public
                      </button>
                    </div>
                  </div>
                  
                  {/* Phase 2 Settings - Only in Custom */}
                  <div className="border-t border-white/10 pt-4 mt-4">
                    <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Phase 2 Trigger Settings
                    </h4>
                    <p className="text-white/50 text-xs mb-4">
                      Phase 2 transitions your strategy to wealth preservation. Set when this happens.
                    </p>
                    
                    <div className="grid grid-cols-2 gap-4">
                      {/* Time-based trigger */}
                      <div className="bg-white/5 rounded-xl p-4">
                        <label className="text-sm text-white/70 mb-2 block">Time-Based</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min="20"
                            max="80"
                            value={clubCreationData.phase2TimePercent}
                            onChange={(e) => setClubCreationData(prev => ({ ...prev, phase2TimePercent: Number(e.target.value) }))}
                            className="flex-1 accent-blue-500"
                          />
                          <span className="text-white font-medium text-sm w-12 text-right">{clubCreationData.phase2TimePercent}%</span>
                        </div>
                        <p className="text-white/40 text-xs mt-2">Trigger at {clubCreationData.phase2TimePercent}% completion</p>
                      </div>
                      
                      {/* Value-based trigger */}
                      <div className="bg-white/5 rounded-xl p-4">
                        <label className="text-sm text-white/70 mb-2 block">Value-Based</label>
                        <div className="flex items-center gap-2">
                          <span className="text-white/50">$</span>
                          <input
                            type="number"
                            min="10000"
                            max="10000000"
                            step="50000"
                            value={clubCreationData.phase2ValueThreshold}
                            onChange={(e) => setClubCreationData(prev => ({ ...prev, phase2ValueThreshold: Number(e.target.value) }))}
                            className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <p className="text-white/40 text-xs mt-2">Trigger when vault reaches this value</p>
                      </div>
                    </div>
                    
                    <p className="text-white/50 text-xs mt-3 text-center">
                      Phase 2 triggers when <span className="text-white">either</span> condition is met (whichever comes first)
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Summary & Deploy */}
            {selectedTemplate && (
              <div className="px-6 pb-6 animate-fade-up">
                <div className="bg-white/5 rounded-xl p-4 mb-4">
                  <div className="text-xs font-semibold text-white/50 mb-2 uppercase tracking-wider">Contract Summary</div>
                  <div className="text-white text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-white/70">Template:</span>
                      <span className="font-medium">{CONTRACT_TEMPLATES.find(t => t.id === selectedTemplate)?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/70">Duration:</span>
                      <span>{clubCreationData.lockupPeriod} {clubCreationData.isChargedContract ? 'month' : 'year'}{clubCreationData.lockupPeriod !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/70">Contribution:</span>
                      <span className="capitalize">{clubCreationData.rigorLevel}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/70">Risk:</span>
                      <span className="capitalize">{clubCreationData.riskLevel}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/70">Members:</span>
                      <span>{clubCreationData.maxMembers} ({clubCreationData.isPrivate ? 'Private' : 'Public'})</span>
                    </div>
                    {selectedTemplate === 'custom' && (
                      <div className="flex justify-between">
                        <span className="text-white/70">Phase 2:</span>
                        <span>{clubCreationData.phase2TimePercent}% or ${(clubCreationData.phase2ValueThreshold / 1000).toFixed(0)}K</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <button 
                  onClick={handleCreateClub} 
                  className={`w-full bg-gradient-to-r ${CONTRACT_TEMPLATES.find(t => t.id === selectedTemplate)?.gradient || 'from-blue-600 to-indigo-600'} hover:opacity-90 text-white py-4 rounded-xl font-semibold text-lg transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2`}
                >
                  <Rocket className="w-5 h-5" />
                  Deploy Contract
                </button>
              </div>
            )}
            
            {/* Prompt to select if none selected */}
            {!selectedTemplate && (
              <div className="px-6 pb-6 text-center">
                <p className="text-white/50 text-sm">
                  ↑ Swipe through templates and click one to select ↑
                </p>
              </div>
            )}
          </div>
        </div>
      </div>;
  };
  const strandData = {
    1: {
      title: "Capital Strand",
      subtitle: "Spark Protocol • 10% Allocation",
      apy: `${apyStrand1.toFixed(1)}% APY`,
      description: "Stablecoin lending that tracks ownership and holds emergency reserves",
      features: ["Spark Protocol stablecoin lending (≈3-5% APY)", "Tracks ownership and holds emergency reserves", "Provides capital for wBTC purchases in Phase 2", "Lowest risk, steady returns from lending"],
      color: "from-pink-500 to-rose-600",
      icon: <Shield className="w-6 h-6" />
    },
    2: {
      title: "Yield Strand",
      subtitle: "AAVE Protocol Polygon • 60% Allocation",
      apy: `${apyStrand2.toFixed(1)}% APY`,
      description: "AAVE Protocol lending with enhanced yield compounding",
      features: ["AAVE Protocol Polygon lending (≈7-10% APY)", "Supply APY enhanced by smart compounding", "Core lending engine of the system", "Medium risk, optimized returns"],
      color: "from-purple-500 to-indigo-600",
      icon: <DollarSign className="w-6 h-6" />
    },
    3: {
      title: "Momentum Strand",
      subtitle: "QuickSwap V3 LP • 30% Allocation",
      apy: `${apyStrand3.toFixed(1)}% APY`,
      description: "Concentrated liquidity farming on QuickSwap V3 wETH/USDC",
      features: ["QuickSwap V3 LP Farming wETH/USDC (≈12-15% APY)", "High-velocity fee generation engine", "Concentrated liquidity maximizes returns", "Highest APY from trading fees"],
      color: "from-cyan-500 to-blue-600",
      icon: <Zap className="w-6 h-6" />
    },
    4: {
      title: "Bitcoin Strategy",
      subtitle: "wBTC Phase 2 • Future Allocation",
      apy: `${btcPrice.toLocaleString()}`,
      description: "Wrapped Bitcoin accumulation via weekly DCA for wealth preservation",
      features: ["Automatic pivot to wBTC accumulation in Phase 2", "Weekly Dollar Cost Averaging (DCA) purchases", "100% wBTC allocation by contract conclusion", "Preserves wealth in world's premier digital store of value"],
      color: "from-orange-400 to-orange-600",
      icon: <Bitcoin className="w-6 h-6" />
    }
  };
  const StrandModal = ({
    strand,
    onClose
  }) => {
    const data = strandData[strand];
    if (!data) return null;
    return <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-up" role="dialog" aria-modal="true" aria-labelledby="strand-modal-title">
        <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl ring-1 ring-black/5">
          <div className={`bg-gradient-to-r ${data.color} p-6 rounded-t-2xl text-white`}>
            <div className="flex justify-between items-start">
              <div className="flex items-center space-x-3">
                {data.icon}
                <div>
                  <h3 id="strand-modal-title" className="text-xl font-bold">{data.title}</h3>
                  <p className="text-white/80">{data.subtitle}</p>
                </div>
              </div>
              <button onClick={onClose} className="text-white/80 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10" aria-label="Close modal">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-bold">{data.apy}</div>
              {strand !== 4 && <div className="text-white/80">Current Market Rate</div>}
              {strand === 4 && <div className="text-white/80">Live Bitcoin Price</div>}
            </div>
          </div>
          
          <div className="p-6">
            <p className="text-gray-700 mb-6">{data.description}</p>
            
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-900">Key Features:</h4>
              {data.features.map((feature, index) => <div key={index} className="flex items-center space-x-3">
                  <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${data.color}`}></div>
                  <span className="text-gray-700">{feature}</span>
                </div>)}
            </div>

            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600">Current Balance in {data.title}</div>
              <div className="text-2xl font-bold text-gray-900">
                {strand === 1 && `${parseFloat(selectedContract ? selectedContract.strand1Balance || "0" : vaultStats.strand1Balance || "0").toFixed(2)}`}
                {strand === 2 && `${parseFloat(selectedContract ? selectedContract.strand2Balance || "0" : vaultStats.strand2Balance || "0").toFixed(2)}`}
                {strand === 3 && `${parseFloat(selectedContract ? selectedContract.strand3Balance || "0" : vaultStats.strand3Balance || "0").toFixed(2)}`}
                {strand === 4 && `$0.00`}
              </div>
              <div className="text-sm text-gray-500">
                {strand === 4 ? "Not active yet (Phase 2)" : parseFloat(selectedContract ? strand === 1 ? selectedContract.strand1Balance || "0" : strand === 2 ? selectedContract.strand2Balance || "0" : selectedContract.strand3Balance || "0" : strand === 1 ? vaultStats.strand1Balance || "0" : strand === 2 ? vaultStats.strand2Balance || "0" : vaultStats.strand3Balance || "0") > 0 ? selectedContract ? "Contract strand balance" : "Active strand balance" : "No deposits yet"}
              </div>
            </div>
          </div>
        </div>
      </div>;
  };
  
  // Calculate earnings for different time periods (real data from contracts)
  const calculateEarnings = (period: '1W' | '1M' | '1Y' | 'All') => {
    if (!selectedContract) return { deposits: 0, earnings: 0 };
    const balance = parseFloat(selectedContract.totalContractBalance || "0");
    const avgAPY = (apyStrand1 + apyStrand2 + apyStrand3) / 3 / 100;
    
    // Calculate actual time elapsed since contract creation
    const startDate = new Date(selectedContract.createdAt);
    const now = new Date();
    const msElapsed = now.getTime() - startDate.getTime();
    const daysElapsed = msElapsed / (1000 * 60 * 60 * 24);
    
    // Calculate deposits and earnings based on period
    switch (period) {
      case '1W': {
        const daysInPeriod = Math.min(daysElapsed, 7);
        const periodDeposits = balance * (daysInPeriod / Math.max(daysElapsed, 1));
        const periodEarnings = periodDeposits * avgAPY * (daysInPeriod / 365);
        return { deposits: periodDeposits, earnings: periodEarnings };
      }
      case '1M': {
        const daysInPeriod = Math.min(daysElapsed, 30);
        const periodDeposits = balance * (daysInPeriod / Math.max(daysElapsed, 1));
        const periodEarnings = periodDeposits * avgAPY * (daysInPeriod / 365);
        return { deposits: periodDeposits, earnings: periodEarnings };
      }
      case '1Y': {
        const daysInPeriod = Math.min(daysElapsed, 365);
        const periodDeposits = balance * (daysInPeriod / Math.max(daysElapsed, 1));
        const periodEarnings = periodDeposits * avgAPY * (daysInPeriod / 365);
        return { deposits: periodDeposits, earnings: periodEarnings };
      }
      case 'All': {
        const totalEarnings = balance * avgAPY * (daysElapsed / 365);
        return { deposits: balance, earnings: totalEarnings };
      }
      default: return { deposits: 0, earnings: 0 };
    }
  };
  
  // Generate curve chart data for homepage (real data based on contract)
  const generateCurveChartData = () => {
    const dataPoints = 12;
    const data = [];
    
    if (!selectedContract) {
      // Return empty data when no contract
      for (let i = 0; i < dataPoints; i++) {
        data.push({ deposits: 0, earnings: 0, label: '' });
      }
      return data;
    }
    
    const balance = parseFloat(selectedContract.totalContractBalance || "0");
    const avgAPY = (apyStrand1 + apyStrand2 + apyStrand3) / 3 / 100;
    const startDate = new Date(selectedContract.createdAt);
    const now = new Date();
    const totalDays = Math.max((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24), 1);
    
    // Generate data points based on timeline
    const periodDays = earningsTimeline === '1W' ? 7 : earningsTimeline === '1M' ? 30 : earningsTimeline === '1Y' ? 365 : totalDays;
    const relevantDays = Math.min(totalDays, periodDays);
    
    for (let i = 0; i < dataPoints; i++) {
      const dayFraction = (i + 1) / dataPoints;
      const daysAtPoint = relevantDays * dayFraction;
      const depositsAtPoint = balance * (daysAtPoint / Math.max(totalDays, 1));
      const earningsAtPoint = depositsAtPoint * avgAPY * (daysAtPoint / 365);
      
      // Generate label based on period
      let label = '';
      if (earningsTimeline === '1W') {
        label = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', '', '', '', '', ''][i] || '';
      } else if (earningsTimeline === '1M') {
        label = i % 3 === 0 ? `W${Math.floor(i / 3) + 1}` : '';
      } else if (earningsTimeline === '1Y') {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        label = months[i] || '';
      } else {
        label = i === 0 ? 'Start' : i === dataPoints - 1 ? 'Now' : '';
      }
      
      data.push({
        deposits: depositsAtPoint,
        earnings: earningsAtPoint,
        label
      });
    }
    
    return data;
  };
  
  const curveChartData = generateCurveChartData();
  
  const HomePage = () => <div className="relative z-10 px-6 py-10 pb-36 max-w-7xl mx-auto">
      {/* Hero Section - Clean Fintech Style */}
      <div ref={homeContractSectionRef} className={`text-center mb-12 animate-fade-up ${tutorial.currentStepData?.target === 'home-contract-section' ? 'tutorial-highlight' : ''}`}>
        {selectedContract && <div className="inline-flex items-center space-x-3 px-5 py-2.5 glass-card mb-6">
            <div className="w-2 h-2 rounded-full bg-secondary animate-pulse"></div>
            <div className="text-xs font-bold text-secondary tracking-widest uppercase">
              Active Contract
            </div>
          </div>}
        
        {/* Giant stat display - Soft & Friendly */}
        <div className="text-6xl md:text-7xl font-black text-foreground mb-4 tracking-tight">
          ${selectedContract ? parseFloat(selectedContract.totalContractBalance || "0").toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : parseFloat(vaultStats.totalDeposits || "0").toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        
        {/* Earnings Display with Timeline - Similar to reference image */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-2 h-2 rounded-full bg-secondary"></div>
          <span className="text-secondary font-bold text-lg">
            ${calculateEarnings(earningsTimeline).earnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Earned
          </span>
          <span className="text-muted-foreground">
            {earningsTimeline === '1W' ? 'This Week' : 
             earningsTimeline === '1M' ? 'This Month' : 
             earningsTimeline === '1Y' ? 'This Year' : 
             'All Time'}
          </span>
        </div>
        
        {selectedContract && <div className="text-base text-muted-foreground font-medium">
            <span className="text-foreground">
              {selectedContract.lockupPeriod} {selectedContract.isChargedContract ? 'Month' : 'Year'} Contract 
            </span>
            <span className="mx-2 text-muted-foreground/50">•</span> 
            <span className="text-secondary">{selectedContract.rigorLevel.charAt(0).toUpperCase() + selectedContract.rigorLevel.slice(1)} Rigor</span>
          </div>}
      </div>
      
      {/* Smooth Curve Chart Visualization - Real Earnings Data */}
      <div className="glass-card p-6 mb-8 animate-fade-up stagger-1">
        {/* Chart Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary/80"></div>
              <span className="text-sm text-muted-foreground font-medium">Deposits</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-secondary"></div>
              <span className="text-sm text-muted-foreground font-medium">Earnings</span>
            </div>
          </div>
          {!selectedContract && (
            <span className="text-xs text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">No contract selected</span>
          )}
        </div>
        
        {/* SVG Curve Chart */}
        <div className="h-48 relative">
          <svg viewBox="0 0 400 150" className="w-full h-full" preserveAspectRatio="none">
            {/* Grid lines */}
            <defs>
              <linearGradient id="depositGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.05" />
              </linearGradient>
              <linearGradient id="earningsGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="hsl(var(--secondary))" stopOpacity="0.3" />
                <stop offset="100%" stopColor="hsl(var(--secondary))" stopOpacity="0.05" />
              </linearGradient>
            </defs>
            
            {/* Horizontal grid lines */}
            {[0, 1, 2, 3].map(i => (
              <line key={i} x1="0" y1={i * 37.5} x2="400" y2={i * 37.5} stroke="hsl(var(--border))" strokeWidth="0.5" strokeDasharray="4,4" opacity="0.5" />
            ))}
            
            {(() => {
              const maxValue = Math.max(...curveChartData.map(d => Math.max(d.deposits, d.earnings)), 1);
              const points = curveChartData.map((d, i) => ({
                x: (i / (curveChartData.length - 1)) * 400,
                yDeposits: 140 - (d.deposits / maxValue) * 120,
                yEarnings: 140 - (d.earnings / maxValue) * 120
              }));
              
              // Create smooth curve paths using quadratic bezier
              const createSmoothPath = (pts: {x: number, y: number}[]) => {
                if (pts.length < 2) return '';
                let path = `M ${pts[0].x} ${pts[0].y}`;
                for (let i = 1; i < pts.length; i++) {
                  const prev = pts[i - 1];
                  const curr = pts[i];
                  const cpX = (prev.x + curr.x) / 2;
                  path += ` Q ${prev.x + (curr.x - prev.x) * 0.5} ${prev.y}, ${cpX} ${(prev.y + curr.y) / 2}`;
                  if (i === pts.length - 1) {
                    path += ` T ${curr.x} ${curr.y}`;
                  }
                }
                return path;
              };
              
              const depositPoints = points.map(p => ({ x: p.x, y: p.yDeposits }));
              const earningsPoints = points.map(p => ({ x: p.x, y: p.yEarnings }));
              
              const depositPath = createSmoothPath(depositPoints);
              const earningsPath = createSmoothPath(earningsPoints);
              
              // Create fill area paths
              const depositFillPath = depositPath + ` L 400 140 L 0 140 Z`;
              const earningsFillPath = earningsPath + ` L 400 140 L 0 140 Z`;
              
              return (
                <>
                  {/* Fill areas */}
                  <path d={depositFillPath} fill="url(#depositGradient)" />
                  <path d={earningsFillPath} fill="url(#earningsGradient)" />
                  
                  {/* Deposit line - thicker, bold */}
                  <path 
                    d={depositPath} 
                    fill="none" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth="3" 
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.8"
                  />
                  
                  {/* Earnings line - thicker, bold, different shade */}
                  <path 
                    d={earningsPath} 
                    fill="none" 
                    stroke="hsl(var(--secondary))" 
                    strokeWidth="3.5" 
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  
                  {/* End point indicators */}
                  {points.length > 0 && (
                    <>
                      <circle cx={points[points.length - 1].x} cy={points[points.length - 1].yDeposits} r="5" fill="hsl(var(--primary))" opacity="0.8" />
                      <circle cx={points[points.length - 1].x} cy={points[points.length - 1].yEarnings} r="6" fill="hsl(var(--secondary))" />
                      <circle cx={points[points.length - 1].x} cy={points[points.length - 1].yEarnings} r="3" fill="white" />
                    </>
                  )}
                </>
              );
            })()}
          </svg>
          
          {/* X-axis labels */}
          <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2">
            {curveChartData.filter((_, i) => i % 2 === 0 || i === curveChartData.length - 1).map((point, i) => (
              point.label && <span key={i} className="text-xs text-muted-foreground font-medium">{point.label}</span>
            ))}
          </div>
          
          {/* Empty state overlay */}
          {!selectedContract && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-[2px] rounded-xl">
              <div className="text-center">
                <div className="text-3xl mb-2">📊</div>
                <p className="text-muted-foreground text-sm font-medium">Select a contract to view earnings</p>
              </div>
            </div>
          )}
        </div>
        
        {/* Timeline Tabs */}
        <div className="flex justify-center gap-2 mt-6">
          {(['1W', '1M', '1Y', 'All'] as const).map((period) => (
            <button
              key={period}
              onClick={() => setEarningsTimeline(period)}
              className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-300 ${
                earningsTimeline === period 
                  ? 'bg-foreground text-background shadow-lg scale-105' 
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {period}
            </button>
          ))}
        </div>
      </div>

      {/* Contract Progress Bars - Clicking opens modal */}
      {walletConnected && deployedSubclubs.filter(club => club.creator === walletAddress || club.members && club.members.includes(walletAddress)).length > 0 && <div className="mb-12 animate-fade-up stagger-2">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-foreground mb-2">Your Contracts</h2>
            <p className="text-sm text-muted-foreground">Tap a contract to view strand details</p>
          </div>
          <div className="space-y-4 max-w-3xl mx-auto">
            {deployedSubclubs.filter(club => club.creator === walletAddress || club.members && club.members.includes(walletAddress)).map(subclub => {
          const startDate = new Date(subclub.createdAt);
          const endDate = new Date(startDate.getTime() + subclub.lockupPeriod * 365 * 24 * 60 * 60 * 1000);
          const now = new Date();
          const totalDuration = endDate.getTime() - startDate.getTime();
          const elapsed = now.getTime() - startDate.getTime();
          const progress = Math.min(Math.max(elapsed / totalDuration * 100, 0), 100);
          const timeRemaining = endDate.getTime() - now.getTime();
          const daysRemaining = Math.max(0, Math.ceil(timeRemaining / (1000 * 60 * 60 * 24)));
          const yearsRemaining = Math.floor(daysRemaining / 365);
          const remainingDays = daysRemaining % 365;
          return <div 
                key={subclub.id} 
                className={`glass-card p-6 cursor-pointer border-l-4 ${getContractColor(subclub)} ${selectedContract?.id === subclub.id ? 'ring-2 ring-secondary/50 shadow-glow-emerald' : ''} hover:scale-[1.01] active:scale-[0.99] transition-all duration-300`} 
                onClick={() => {
                  setSelectedContract(subclub);
                  setShowStrandsModal(true);
                }}
              >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="font-bold text-foreground text-lg">
                        {subclub.lockupPeriod} {subclub.isChargedContract ? 'Month' : 'Year'} Contract
                        <span className="ml-2 text-sm font-semibold text-secondary">
                          {subclub.rigorLevel.charAt(0).toUpperCase() + subclub.rigorLevel.slice(1)}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground font-mono mt-1">
                        {subclub.contractAddress.slice(0, 10)}...{subclub.contractAddress.slice(-8)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-black text-secondary">{progress.toFixed(1)}%</div>
                      <div className="text-xs text-muted-foreground font-medium">Complete</div>
                    </div>
                  </div>
                  
                  {/* Progress Bar - Softer */}
                  <div className="progress-premium h-3 mb-4">
                    <div className={`bar ${progress >= 100 ? 'bg-gradient-to-r from-secondary via-secondary/80 to-secondary' : 'bg-gradient-to-r from-primary via-accent to-secondary'}`} style={{
                width: `${progress}%`
              }}></div>
                  </div>
                  
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground font-medium">{startDate.toLocaleDateString()}</span>
                    <span className="text-secondary font-bold">
                      {progress >= 100 ? '✓ Complete!' : yearsRemaining > 0 ? `${yearsRemaining}y ${remainingDays}d left` : `${remainingDays}d left`}
                    </span>
                    <span className="text-muted-foreground font-medium">{endDate.toLocaleDateString()}</span>
                  </div>
                </div>;
        })}
          </div>
        </div>}

      {/* Message when no contracts */}
      {walletConnected && deployedSubclubs.filter(club => club.creator === walletAddress || club.members && club.members.includes(walletAddress)).length === 0 && <div className="text-center mb-8 glass-card p-8 max-w-md mx-auto animate-fade-up">
          <div className="text-5xl mb-4">🚀</div>
          <div className="text-foreground font-bold text-lg mb-2">Ready to Start?</div>
          <div className="text-sm text-muted-foreground mb-4">Create your first contract to begin building wealth</div>
          <button 
            onClick={() => setActiveModal('createClub')}
            className="btn-premium text-white"
          >
            Create Contract
          </button>
        </div>}
      
      {/* Strands Modal - Triggered by clicking on a contract */}
      {showStrandsModal && selectedContract && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-up" onClick={() => setShowStrandsModal(false)}>
          <div className="glass-card max-w-lg w-full p-6 space-y-6" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold text-foreground">Contract Details</h3>
                <p className="text-sm text-muted-foreground font-mono mt-1">
                  {selectedContract.contractAddress.slice(0, 12)}...{selectedContract.contractAddress.slice(-8)}
                </p>
              </div>
              <button 
                onClick={() => setShowStrandsModal(false)}
                className="p-2 rounded-xl hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            
            {/* Contract Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="soft-card p-4 text-center">
                <div className="text-2xl font-black text-foreground">${parseFloat(selectedContract.totalContractBalance || "0").toLocaleString()}</div>
                <div className="text-xs text-muted-foreground font-medium">Total Balance</div>
              </div>
              <div className="soft-card p-4 text-center">
                <div className="text-2xl font-black text-secondary">{selectedContract.lockupPeriod}</div>
                <div className="text-xs text-muted-foreground font-medium">{selectedContract.isChargedContract ? 'Month' : 'Year'} Lockup</div>
              </div>
            </div>
            
            {/* DNA Strand Section */}
            <div className="space-y-4">
              <h4 className="font-bold text-foreground flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-secondary animate-pulse"></div>
                DNA Strands
              </h4>
              
              {/* Strand 1 - Capital */}
              <button 
                onClick={() => { setActiveStrand(1); setShowStrandsModal(false); }}
                className="w-full soft-card p-4 hover:border-pink-500/50 transition-all duration-300 group text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <Shield className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="font-bold text-foreground">Capital Strand</div>
                      <div className="text-xs text-muted-foreground">Spark Protocol • {apyStrand1.toFixed(1)}% APY</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-foreground">${parseFloat(selectedContract.strand1Balance || "0").toLocaleString()}</div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground inline" />
                  </div>
                </div>
              </button>
              
              {/* Strand 2 - Yield */}
              <button 
                onClick={() => { setActiveStrand(2); setShowStrandsModal(false); }}
                className="w-full soft-card p-4 hover:border-primary/50 transition-all duration-300 group text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <TrendingUp className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="font-bold text-foreground">Yield Strand</div>
                      <div className="text-xs text-muted-foreground">AAVE Polygon • {apyStrand2.toFixed(1)}% APY</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-foreground">${parseFloat(selectedContract.strand2Balance || "0").toLocaleString()}</div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground inline" />
                  </div>
                </div>
              </button>
              
              {/* Strand 3 - Momentum */}
              <button 
                onClick={() => { setActiveStrand(3); setShowStrandsModal(false); }}
                className="w-full soft-card p-4 hover:border-accent/50 transition-all duration-300 group text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-blue-500 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <Zap className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="font-bold text-foreground">Momentum Strand</div>
                      <div className="text-xs text-muted-foreground">QuickSwap V3 • {apyStrand3.toFixed(1)}% APY</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-foreground">${parseFloat(selectedContract.strand3Balance || "0").toLocaleString()}</div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground inline" />
                  </div>
                </div>
              </button>
              
              {/* Phase 2 - wBTC */}
              <button 
                onClick={() => { setActiveStrand(4); setShowStrandsModal(false); }}
                className="w-full soft-card p-4 hover:border-orange-500/50 transition-all duration-300 group text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <Bitcoin className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="font-bold text-foreground">Phase 2 • wBTC</div>
                      <div className="text-xs text-muted-foreground">Bitcoin accumulation</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-orange-500">Pending</div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground inline" />
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>;
  const DatasetPage = () => <div className="relative z-10 px-6 py-8 pb-32">
      <div className="flex items-center mb-8 animate-fade-up">
        <button onClick={goHome} className="mr-4 p-2.5 glass-card hover:border-primary/30 rounded-xl transition-all duration-300 group">
          <ArrowLeft className="w-5 h-5 text-foreground/70 group-hover:text-primary transition-colors" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Backend Dataset</h1>
          <p className="text-muted-foreground text-sm mt-1">Real-time protocol metrics & market data</p>
        </div>
      </div>
      
      <div className="space-y-6">
        <div className="glass-card p-6 animate-fade-up stagger-1">
          <h2 className="text-xl font-semibold text-foreground mb-5 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-secondary animate-pulse"></div>
            System Metrics
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 rounded-2xl bg-muted/50 border border-border/50 hover:border-primary/30 transition-all duration-300 hover:bg-muted/70">
              <div className="text-3xl font-bold text-primary tabular-nums mb-1">{vaultStats.totalMembers || 0}</div>
              <div className="text-sm text-muted-foreground">Active Members</div>
            </div>
            <div className="text-center p-4 rounded-2xl bg-muted/50 border border-border/50 hover:border-secondary/30 transition-all duration-300 hover:bg-muted/70">
              <div className="text-3xl font-bold text-secondary tabular-nums mb-1">${parseFloat(vaultStats.totalDeposits || "0").toFixed(0)}</div>
              <div className="text-sm text-muted-foreground">Total Deposits</div>
            </div>
            <div className="text-center p-4 rounded-2xl bg-muted/50 border border-border/50 hover:border-accent/30 transition-all duration-300 hover:bg-muted/70">
              <div className="text-3xl font-bold text-accent tabular-nums mb-1">{vaultStats.systemHealth || 100}%</div>
              <div className="text-sm text-muted-foreground">System Health</div>
            </div>
            <div className="text-center p-4 rounded-2xl bg-muted/50 border border-border/50 hover:border-orange-400/30 transition-all duration-300 hover:bg-muted/70">
              <div className="text-3xl font-bold text-orange-400 tabular-nums mb-1">{vaultStats.transactions || 0}</div>
              <div className="text-sm text-muted-foreground">Transactions</div>
            </div>
          </div>
        </div>

        <div className="glass-card p-6 animate-fade-up stagger-2">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-accent animate-pulse"></div>
              Live Market Data
            </h2>
            <div className="text-sm text-muted-foreground">
              <span className="text-foreground/70">Averaged Earnings Rate: </span>
              <span className="text-secondary font-semibold">{calculateRRLAveragedAPY(aaveRates.liquidityRate, apyStrand2, quickSwapAPY).toFixed(2)}%</span>
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 bg-muted/40 rounded-2xl border border-border/40 hover:border-red-500/30 transition-all duration-300">
              <div className="text-sm text-muted-foreground mb-2">Spark USDC Lending</div>
              <div className="text-2xl font-bold text-red-500 mb-3">{aaveRates.liquidityRate.toFixed(2)}%</div>
              <div className="h-12 bg-gradient-to-r from-red-500/10 to-orange-500/5 rounded-lg p-2">
                <svg viewBox="0 0 200 40" className="w-full h-full">
                  <polyline points="10,25 30,28 50,24 70,26 90,23 110,25 130,22 150,24 170,21 190,23" fill="none" stroke="hsl(12 90% 55%)" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </div>
            </div>
            
            <div className="p-5 bg-muted/40 rounded-2xl border border-border/40 hover:border-violet-300/30 transition-all duration-300">
              <div className="text-sm text-muted-foreground mb-2">AAVE Lending Rate</div>
              <div className="text-2xl font-bold text-violet-300 mb-3">{apyStrand2.toFixed(2)}%</div>
              <div className="h-12 bg-gradient-to-r from-violet-300/10 to-violet-300/5 rounded-lg p-2">
                <svg viewBox="0 0 200 40" className="w-full h-full">
                  <polyline points="10,20 30,18 50,22 70,19 90,21 110,17 130,20 150,16 170,19 190,15" fill="none" stroke="hsl(270 70% 75%)" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </div>
            </div>
            
            <div className="p-5 bg-muted/40 rounded-2xl border border-border/40 hover:border-cyan-400/30 transition-all duration-300">
              <div className="text-sm text-muted-foreground mb-2">QuickSwap Rate</div>
              <div className="text-2xl font-bold text-cyan-400 mb-3">{quickSwapAPY.toFixed(2)}%</div>
              <div className="h-12 bg-gradient-to-r from-cyan-400/10 to-cyan-400/5 rounded-lg p-2">
                <svg viewBox="0 0 200 40" className="w-full h-full">
                  <polyline points="10,30 30,25 50,28 70,22 90,26 110,20 130,24 150,18 170,22 190,16" fill="none" stroke="hsl(190 90% 55%)" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </div>
            </div>
            
            <div className="p-5 bg-muted/40 rounded-2xl border border-border/40 hover:border-orange-400/30 transition-all duration-300">
              <div className="flex justify-between items-start mb-2">
                <div className="text-sm text-muted-foreground">Bitcoin Price</div>
                <div className="text-xs text-secondary font-medium px-2 py-0.5 bg-secondary/10 rounded-full">+2.4%</div>
              </div>
              <div className="text-2xl font-bold text-orange-400 mb-3">${btcPrice.toLocaleString()}</div>
              <div className="h-12 bg-gradient-to-r from-orange-500/10 to-orange-500/5 rounded-lg p-2">
                <svg viewBox="0 0 200 40" className="w-full h-full">
                  <polyline points="10,30 30,20 50,25 70,15 90,20 110,10 130,15 150,25 170,15 190,20" fill="none" stroke="hsl(30 95% 58%)" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-card p-6 animate-fade-up stagger-3">
          <h2 className="text-xl font-semibold text-foreground mb-2">Protocol Access & Resources</h2>
          <div className="text-sm text-muted-foreground mb-5">Direct links to DeFi protocols powering The Vault Club</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <a href="https://app.spark.fi" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 bg-muted/40 rounded-xl border border-border/40 hover:border-red-500/30 hover:bg-muted/60 transition-all duration-300 group">
              <div>
                <div className="font-semibold text-foreground group-hover:text-red-500 transition-colors">Spark Protocol</div>
                <div className="text-sm text-muted-foreground">Stablecoin Lending</div>
              </div>
              <ArrowLeft className="w-4 h-4 text-muted-foreground group-hover:text-red-500 rotate-[135deg] transition-all group-hover:translate-x-1 group-hover:-translate-y-1" />
            </a>

            <a href="https://app.aave.com/?marketName=proto_polygon_v3" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 bg-muted/40 rounded-xl border border-border/40 hover:border-violet-300/30 hover:bg-muted/60 transition-all duration-300 group">
              <div>
                <div className="font-semibold text-foreground group-hover:text-violet-300 transition-colors">AAVE Polygon</div>
                <div className="text-sm text-muted-foreground">V3 Lending Market</div>
              </div>
              <ArrowLeft className="w-4 h-4 text-muted-foreground group-hover:text-violet-300 rotate-[135deg] transition-all group-hover:translate-x-1 group-hover:-translate-y-1" />
            </a>

            <a href="https://quickswap.exchange/#/pools/v3" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 bg-muted/40 rounded-xl border border-border/40 hover:border-cyan-400/30 hover:bg-muted/60 transition-all duration-300 group">
              <div>
                <div className="font-semibold text-foreground group-hover:text-cyan-400 transition-colors">QuickSwap V3</div>
                <div className="text-sm text-muted-foreground">Liquidity Pools</div>
              </div>
              <ArrowLeft className="w-4 h-4 text-muted-foreground group-hover:text-cyan-400 rotate-[135deg] transition-all group-hover:translate-x-1 group-hover:-translate-y-1" />
            </a>

            <a href="https://defillama.com/yields?chain=Polygon&project=quickswap-dex" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 bg-muted/40 rounded-xl border border-border/40 hover:border-blue-900/30 hover:bg-muted/60 transition-all duration-300 group">
              <div>
                <div className="font-semibold text-foreground group-hover:text-blue-800 dark:group-hover:text-blue-400 transition-colors">DeFiLlama</div>
                <div className="text-sm text-muted-foreground">Live APY Data Source</div>
              </div>
              <ArrowLeft className="w-4 h-4 text-muted-foreground group-hover:text-blue-800 dark:group-hover:text-blue-400 rotate-[135deg] transition-all group-hover:translate-x-1 group-hover:-translate-y-1" />
            </a>

            <a href="https://www.coingecko.com/en/coins/bitcoin" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 bg-muted/40 rounded-xl border border-border/40 hover:border-emerald-400/30 hover:bg-muted/60 transition-all duration-300 group">
              <div>
                <div className="font-semibold text-foreground group-hover:text-emerald-400 transition-colors">CoinGecko</div>
                <div className="text-sm text-muted-foreground">Bitcoin Price Data</div>
              </div>
              <ArrowLeft className="w-4 h-4 text-muted-foreground group-hover:text-emerald-400 rotate-[135deg] transition-all group-hover:translate-x-1 group-hover:-translate-y-1" />
            </a>

            <a href="https://polygon.technology" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 bg-muted/40 rounded-xl border border-border/40 hover:border-purple-700/30 hover:bg-muted/60 transition-all duration-300 group">
              <div>
                <div className="font-semibold text-foreground group-hover:text-purple-700 dark:group-hover:text-purple-500 transition-colors">Polygon Network</div>
                <div className="text-sm text-muted-foreground">Layer 2 Infrastructure</div>
              </div>
              <ArrowLeft className="w-4 h-4 text-muted-foreground group-hover:text-purple-700 dark:group-hover:text-purple-500 rotate-[135deg] transition-all group-hover:translate-x-1 group-hover:-translate-y-1" />
            </a>
          </div>
        </div>

        <div className="glass-card p-6 animate-fade-up stagger-4">
          <h2 className="text-xl font-semibold text-foreground mb-2">Educational Resources</h2>
          <div className="text-sm text-muted-foreground mb-5">Learn more about DeFi and cryptocurrency fundamentals</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <a href="https://www.coinbase.com/learn" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 bg-muted/40 rounded-xl border border-border/40 hover:border-blue-700/30 hover:bg-muted/60 transition-all duration-300 group">
              <div>
                <div className="font-semibold text-foreground group-hover:text-blue-700 dark:group-hover:text-blue-500 transition-colors">Coinbase Learn</div>
                <div className="text-sm text-muted-foreground">Crypto Education</div>
              </div>
              <ArrowLeft className="w-4 h-4 text-muted-foreground group-hover:text-blue-700 dark:group-hover:text-blue-500 rotate-[135deg] transition-all group-hover:translate-x-1 group-hover:-translate-y-1" />
            </a>

            <a href="https://docs.aave.com/hub/" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 bg-muted/40 rounded-xl border border-border/40 hover:border-accent/30 hover:bg-muted/60 transition-all duration-300 group">
              <div>
                <div className="font-semibold text-foreground group-hover:text-accent transition-colors">AAVE Documentation</div>
                <div className="text-sm text-muted-foreground">Protocol Deep Dive</div>
              </div>
              <ArrowLeft className="w-4 h-4 text-muted-foreground group-hover:text-accent rotate-[135deg] transition-all group-hover:translate-x-1 group-hover:-translate-y-1" />
            </a>

            <a href="https://www.investopedia.com/terms/c/compoundinterest.asp" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 bg-muted/40 rounded-xl border border-border/40 hover:border-secondary/30 hover:bg-muted/60 transition-all duration-300 group">
              <div>
                <div className="font-semibold text-foreground group-hover:text-secondary transition-colors">Compound Interest</div>
                <div className="text-sm text-muted-foreground">The Math Behind Growth</div>
              </div>
              <ArrowLeft className="w-4 h-4 text-muted-foreground group-hover:text-secondary rotate-[135deg] transition-all group-hover:translate-x-1 group-hover:-translate-y-1" />
            </a>
          </div>
        </div>
        
        {/* Terms of Service Link */}
        <div className="glass-card p-6 animate-fade-up stagger-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-primary" />
              <div>
                <h3 className="font-semibold text-foreground">Legal Documents</h3>
                <p className="text-sm text-muted-foreground">Review our terms and policies</p>
              </div>
            </div>
            <button 
              onClick={() => setShowToSViewer(true)}
              className="px-4 py-2 rounded-xl bg-muted/50 hover:bg-muted border border-border/50 hover:border-primary/30 text-foreground font-medium transition-all duration-300"
            >
              Terms of Service
            </button>
          </div>
        </div>
      </div>
    </div>;
  const PersonalPage = () => <div className="relative z-10 px-6 py-8 pb-32">
      <div className="flex items-center mb-8 animate-fade-up">
        <button onClick={goHome} className="mr-4 p-2.5 glass-card hover:border-primary/30 rounded-xl transition-all duration-300 group">
          <ArrowLeft className="w-5 h-5 text-foreground/70 group-hover:text-primary transition-colors" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Personal Wallet</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your connection & deposits</p>
        </div>
      </div>
      
      <div className="space-y-6">
        <div className="glass-card p-6 animate-fade-up stagger-1">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-semibold text-foreground">Wallet Connection</h2>
            <Wallet className="w-6 h-6 text-primary" />
          </div>
          {!walletConnected ? <div className="text-center py-10">
              <div className="text-muted-foreground mb-5">No wallet connected</div>
              <button ref={connectAccountRef} onClick={handleConnectWallet} className={`btn-premium text-white ${tutorial.currentStepData?.target === 'connect-account' ? 'tutorial-highlight' : ''}`}>
                Connect Account
              </button>
            </div> : <div className="text-center py-4">
              <div className="inline-flex items-center space-x-3 bg-secondary/15 text-secondary px-4 py-2.5 rounded-xl mb-4 border border-secondary/20">
                <div className="w-2.5 h-2.5 bg-secondary rounded-full animate-pulse"></div>
                <span className="font-medium">Connected: {walletAddress ? walletAddress.slice(0, 6) + "..." + walletAddress.slice(-4) : "N/A"}</span>
              </div>
              <div className="text-sm text-muted-foreground mb-5">Turnkey • Polygon Network</div>
              
              <div className="flex flex-wrap justify-center gap-3 mt-6">
                <button onClick={handleDeposit} disabled={!canDeposit() || calculateWeeklyDepositAmount() === 0} className={`px-5 py-3 rounded-xl font-medium transition-all duration-300 ${!canDeposit() || calculateWeeklyDepositAmount() === 0 ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-gradient-to-r from-secondary to-emerald-500 hover:shadow-lg hover:shadow-secondary/25 text-white hover:-translate-y-0.5'}`}>
                  {calculateWeeklyDepositAmount() === 0 ? 'Join/Create a Contract' : !canDeposit() ? `Deposit in ${getDaysUntilNextDeposit()}d` : `Deposit ${calculateWeeklyDepositAmount()}`}
                </button>
                <button onClick={async () => {
              await supabase.auth.signOut();
              setWalletConnected(false);
              setWalletAddress(null);
              setVaultBalance("0");
              setSelectedContract(null);
              setActiveStrand(null);
            }} className="px-5 py-3 rounded-xl font-medium transition-all duration-300 bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20">
                  Sign Out
                </button>
              </div>
            </div>}
        </div>

        <div className="glass-card p-6 animate-fade-up stagger-2">
          <h2 className="text-xl font-semibold text-foreground mb-5">Your Position</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="text-center p-5 rounded-2xl bg-muted/50 border border-border/50">
              <div className="text-3xl font-bold text-foreground tabular-nums mb-1">${parseFloat(vaultBalance).toFixed(2)}</div>
              <div className="text-sm text-muted-foreground">Total Contributed</div>
            </div>
            <div className="text-center p-5 rounded-2xl bg-muted/50 border border-border/50">
              <div className="text-3xl font-bold text-primary tabular-nums mb-1">
                {parseFloat(vaultStats.totalDeposits || "0") > 0 && parseFloat(vaultBalance) > 0 ? (parseFloat(vaultBalance) / parseFloat(vaultStats.totalDeposits) * 100).toFixed(1) : 0}%
              </div>
              <div className="text-sm text-muted-foreground">Ownership Share</div>
            </div>
            <div className="text-center p-5 rounded-2xl bg-muted/50 border border-border/50">
              <div className="text-3xl font-bold text-secondary tabular-nums mb-1">${parseFloat(vaultBalance).toFixed(2)}</div>
              <div className="text-sm text-muted-foreground">Current Value</div>
            </div>
          </div>
        </div>

        {walletConnected && <div className="glass-card p-6 animate-fade-up stagger-3">
            <h2 className="text-xl font-semibold text-foreground mb-4">Recent Activity</h2>
            <div className="text-center py-8 text-muted-foreground">
              {(vaultStats.transactions || 0) > 0 ? `${vaultStats.transactions} transaction${vaultStats.transactions === 1 ? '' : 's'} recorded` : "No transactions yet - make your first deposit to get started"}
            </div>
          </div>}
      </div>
    </div>;
  const GroupInfoPage = () => <div className="relative z-10 px-6 py-8 pb-32">
      <div className="flex items-center mb-8 animate-fade-up">
        <button onClick={goHome} className="mr-4 p-2.5 glass-card hover:border-primary/30 rounded-xl transition-all duration-300 group">
          <ArrowLeft className="w-5 h-5 text-foreground/70 group-hover:text-primary transition-colors" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Contracts</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage & join investment contracts</p>
        </div>
      </div>
      
      <div className="space-y-6">
        {/* Contract Directory - First (Create/Join) */}
        <div ref={contractsDirectoryRef} className={`glass-card p-6 animate-fade-up stagger-1 ${tutorial.currentStepData?.target === 'contracts-directory' ? 'tutorial-highlight' : ''}`}>
          <h2 className="text-xl font-semibold text-foreground mb-5 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse"></div>
            Contract Directory
          </h2>
          
          {/* Create Contract Section */}
          <div className="text-center py-6 border-b border-border/20 mb-6">
            <div className="mb-4">
              <div className="text-sm text-foreground/80 mb-2">
                {!walletConnected ? "Connect Account First" : deployedSubclubs.length === 0 ? "No contracts have been created yet" : `${deployedSubclubs.length} contract${deployedSubclubs.length === 1 ? '' : 's'} deployed`}
              </div>
              {walletConnected && <div className="text-xs text-muted-foreground">
                  {deployedSubclubs.length === 0 ? "" : "Create another contract or join existing ones"}
                </div>}
            </div>
            <button onClick={() => setActiveModal('createClub')} className={`btn-premium ${!walletConnected ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={!walletConnected}>
              Create New Contract
            </button>
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Available Contracts</h3>
              <div className="text-sm text-muted-foreground">{deployedSubclubs.filter(club => !club.isPrivate).length} public</div>
            </div>
            
            {deployedSubclubs.filter(club => !club.isPrivate).length === 0 ? <div className="text-center py-12 text-muted-foreground">
                <div className="text-muted-foreground mb-2">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                </div>
                <div className="font-medium">No public contracts available</div>
                <div className="text-sm">Create a public contract or get invited to a private one</div>
              </div> : <div className="grid md:grid-cols-2 gap-4">
                {deployedSubclubs.filter(club => !club.isPrivate).map(subclub => {
              const isUserMember = walletConnected && subclub.members && subclub.members.includes(walletAddress);
              const canJoin = !isUserMember && subclub.currentMembers < subclub.maxMembers;
              const isFull = subclub.currentMembers >= subclub.maxMembers;
              return <div key={subclub.id} className="p-4 bg-background/30 backdrop-blur-sm rounded-xl border border-border/20 hover:border-primary/30 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="font-semibold text-foreground">
                            {subclub.lockupPeriod} {subclub.isChargedContract ? 'Month' : 'Year'} Lockup
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Members: {subclub.currentMembers}/{subclub.maxMembers}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Contract: {subclub.contractAddress.slice(0, 8)}...{subclub.contractAddress.slice(-6)}
                          </div>
                        </div>
                        <div className="flex flex-col items-end space-y-1">
                          {isUserMember ? <span className="text-xs px-3 py-1 rounded-full bg-primary/20 text-primary">
                              Member
                            </span> : canJoin ? <button className="text-xs px-3 py-1 rounded-full transition-colors bg-defi-emerald hover:bg-defi-emerald/80 text-background font-medium" onClick={() => {
                      // Join contract logic here
                      alert(`Joining contract ${subclub.contractAddress.slice(0, 8)}...`);
                    }}>
                              Join
                            </button> : isFull ? <span className="text-xs px-3 py-1 rounded-full bg-muted text-muted-foreground">
                              Full
                            </span> : <span className="text-xs px-3 py-1 rounded-full bg-muted text-muted-foreground">
                              Connect Wallet
                            </span>}
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Rigor: <span className="font-medium text-foreground capitalize">{subclub.rigorLevel}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-2">
                        Created: {new Date(subclub.createdAt).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Concludes: {new Date(new Date(subclub.createdAt).getTime() + subclub.lockupPeriod * 365 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                      </div>
                    </div>;
            })}
              </div>}
          </div>
        </div>

        {/* My Contracts - Second */}
        <div className="glass-card p-6 animate-fade-up stagger-2">
          <h2 className="text-xl font-semibold text-foreground mb-5 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-secondary animate-pulse"></div>
            My Contracts
          </h2>
          
          {!walletConnected ? <div className="text-center py-8 text-muted-foreground">
              <div className="text-muted-foreground mb-2">
                <Wallet className="w-8 h-8 mx-auto mb-2 opacity-50" />
              </div>
              <div className="font-medium">Connect wallet to view your contracts</div>
            </div> : deployedSubclubs.filter(club => club.creator === walletAddress || club.members && club.members.includes(walletAddress)).length === 0 ? <div className="text-center py-8 text-muted-foreground">
              <div className="text-muted-foreground mb-2">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
              </div>
              <div className="font-medium">No contracts yet</div>
              <div className="text-sm">Create or join your first contract above</div>
            </div> : <div className="grid md:grid-cols-2 gap-4">
              {deployedSubclubs.filter(club => club.creator === walletAddress || club.members && club.members.includes(walletAddress)).map(subclub => <div key={subclub.id} className="p-4 bg-background/30 backdrop-blur-sm rounded-xl border border-border/20 hover:border-primary/30 transition-colors relative">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-semibold text-foreground">
                        {subclub.lockupPeriod} {subclub.isChargedContract ? 'Month' : 'Year'} Lockup
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Members: {subclub.currentMembers}/{subclub.maxMembers}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Contract: {subclub.contractAddress.slice(0, 8)}...{subclub.contractAddress.slice(-6)}
                      </div>
                    </div>
                    <div className="flex flex-col items-end space-y-1">
                      <span className={`text-xs px-2 py-1 rounded-full ${subclub.isPrivate ? 'bg-defi-purple/20 text-defi-purple' : 'bg-defi-emerald/20 text-defi-emerald'}`}>
                        {subclub.isPrivate ? 'Private' : 'Public'}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full ${subclub.creator === walletAddress ? 'bg-primary/20 text-primary' : 'bg-defi-orange/20 text-defi-orange'}`}>
                        {subclub.creator === walletAddress ? 'Owner' : 'Member'}
                      </span>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Rigor: <span className="font-medium text-foreground capitalize">{subclub.rigorLevel}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">
                    {subclub.creator === walletAddress ? 'Created' : 'Joined'}: {new Date(subclub.createdAt).toLocaleDateString()}
                  </div>
                  
                  {/* Share Button */}
                  <button onClick={() => {
              // Generate shareable URL using your domain
              const baseUrl = 'https://thevaultclub.sequencetheoryinc.com';
              const shareUrl = `${baseUrl}?join=${subclub.contractAddress}`;

              // Copy to clipboard
              navigator.clipboard.writeText(shareUrl).then(() => {
                // Show copied banner
                setShowCopiedBanner(true);
                setTimeout(() => setShowCopiedBanner(false), 2000);
              }).catch(() => {
                // Fallback for older browsers
                const shareText = `Join my VaultClub investment contract!\n\n${subclub.lockupPeriod} ${subclub.isChargedContract ? 'Month' : 'Year'} Lockup • ${subclub.rigorLevel.charAt(0).toUpperCase() + subclub.rigorLevel.slice(1)} Rigor\n\nJoin here: ${shareUrl}`;

                // Try to use the Web Share API if available
                if (navigator.share) {
                  navigator.share({
                    title: 'Join VaultClub Investment Contract',
                    text: shareText,
                    url: shareUrl
                  });
                } else {
                  // Final fallback - show the URL in an alert
                  alert(`Share this link:\n\n${shareUrl}\n\nOr copy this message:\n\n${shareText}`);
                }
              });
            }} className="absolute bottom-3 right-3 p-1.5 bg-background/50 hover:bg-background/70 rounded-full transition-colors opacity-70 hover:opacity-100 border border-border/20" title="Share contract link">
                    <Share2 className="w-3 h-3 text-muted-foreground" />
                  </button>
                </div>)}
            </div>}
        </div>

        {/* Member Directory - Third */}
        <div className="glass-card p-6 animate-fade-up stagger-3">
          <h2 className="text-xl font-semibold text-foreground mb-5">Member Directory</h2>
          
          {walletConnected ? <div className="space-y-6">
              {deployedSubclubs.filter(club => club.creator === walletAddress || club.members && club.members.includes(walletAddress)).map(subclub => <div key={subclub.id} className={`p-4 bg-white/10 rounded-lg border-l-4 ${getContractColor(subclub)}`}>
                  <h3 className="font-semibold text-white mb-3">
                    {subclub.lockupPeriod} Year Lockup - {subclub.rigorLevel.charAt(0).toUpperCase() + subclub.rigorLevel.slice(1)} Rigor
                  </h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="p-3 bg-white/10 rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="font-semibold text-white">Me ({walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)})</div>
                          <div className="text-sm text-slate-300">Penalties: 0/15</div>
                        </div>
                        <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800">
                          Active
                        </span>
                      </div>
                      <div className="text-sm text-slate-300">
                        Contributed: <span className="font-medium text-white">${parseFloat(vaultBalance).toFixed(2)}</span>
                      </div>
                      <div className="text-xs text-slate-300 mt-1">
                        Role: {subclub.creator === walletAddress ? 'Owner' : 'Member'}
                      </div>
                    </div>
                  </div>
                </div>)}
              {deployedSubclubs.filter(club => club.creator === walletAddress || club.members && club.members.includes(walletAddress)).length === 0 && <div className="text-center py-8 text-slate-300">
                  <div className="font-medium">No contracts yet</div>
                  <div className="text-sm">Join a contract to see member information</div>
                </div>}
            </div> : <div className="text-center py-8 text-slate-300">
              Connect wallet to view member information
            </div>}
        </div>
      </div>
    </div>;
  const FutureSimulationPage = () => {
    return <div className="relative z-10 px-6 py-8 pb-32">
        <div ref={futurePageIntroRef} className={`flex items-center mb-8 animate-fade-up ${tutorial.currentStepData?.target === 'future-page-intro' ? 'tutorial-highlight' : ''}`}>
          <button onClick={goHome} className="mr-4 p-2.5 glass-card hover:border-primary/30 rounded-xl transition-all duration-300 group">
            <ArrowLeft className="w-5 h-5 text-foreground/70 group-hover:text-primary transition-colors" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Future Projections</h1>
            <p className="text-muted-foreground text-sm mt-1">Simulate your investment growth</p>
          </div>
        </div>
        
        <div className="space-y-6">
          {/* Interactive Controls */}
          <div className="glass-card p-6 animate-fade-up stagger-1">
            <h2 className="text-xl font-semibold text-foreground mb-5 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
              Simulation Parameters
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-semibold text-muted-foreground mb-2">
                  Strand 1 APY (%) - Spark Protocol: {aaveRates.liquidityRate.toFixed(2)}%
                </label>
                <input type="range" min="1" max="20" value={apyStrand1} onChange={e => setApyStrand1(Number(e.target.value))} className="w-full" />
                <div className="text-center text-foreground font-bold">{apyStrand1.toFixed(1)}%</div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-muted-foreground mb-2">
                  Strand 2 APY (%) - AAVE Polygon Lending
                </label>
                <input type="range" min="1" max="25" value={apyStrand2} onChange={e => setApyStrand2(Number(e.target.value))} className="w-full" />
                <div className="text-center text-foreground font-bold">{apyStrand2.toFixed(1)}%</div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-muted-foreground mb-2">
                  Strand 3 APY (%) - QuickSwap V3 LP: {quickSwapAPY.toFixed(2)}%
                </label>
                <input type="range" min="1" max="30" value={apyStrand3} onChange={e => setApyStrand3(Number(e.target.value))} className="w-full" />
                <div className="text-center text-foreground font-bold">{apyStrand3.toFixed(1)}%</div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-muted-foreground mb-2">
                  wBTC Price ($) - Live: ${btcPrice.toLocaleString()}
                </label>
                <input type="number" min="10000" max="500000" step="1000" value={btcPrice} onChange={e => setBtcPrice(Number(e.target.value))} className="input-premium" placeholder="Enter BTC price" />
                <div className="text-center text-foreground font-bold text-sm mt-1">${btcPrice.toLocaleString()}</div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-muted-foreground mb-2">Simulation Length</label>
                <select value={simulationYears >= 1 ? simulationYears : 'months'} onChange={e => {
                const value = e.target.value;
                if (value === 'months') {
                  setSimulationYears(0.5); // 6 months
                } else {
                  setSimulationYears(Number(value));
                }
              }} className="select-premium">
                  <option value="0.083">1 month</option>
                  <option value="0.25">3 months</option>
                  <option value="0.5">6 months</option>
                  <option value="1">1 year</option>
                  <option value="2">2 years</option>
                  <option value="3">3 years</option>
                  <option value="5">5 years</option>
                  <option value="10">10 years</option>
                  <option value="15">15 years</option>
                  <option value="20">20 years</option>
                  <option value="25">25 years</option>
                </select>
                <div className="text-center text-foreground font-bold text-sm mt-1">
                  {simulationYears < 1 ? `${Math.round(simulationYears * 12)} month${Math.round(simulationYears * 12) === 1 ? '' : 's'}` : `${simulationYears} year${simulationYears === 1 ? '' : 's'}`}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-muted-foreground mb-2">Investment Rigor</label>
                <select value={simulationRigor} onChange={e => setSimulationRigor(e.target.value)} className="select-premium">
                  <option value="light">Light</option>
                  <option value="medium">Medium</option>
                  <option value="heavy">Heavy</option>
                  <option value="custom">Custom</option>
                </select>
                <div className="text-center text-foreground font-bold text-sm mt-1">
                  {simulationRigor === 'light' && '$100-250/month scaling'}
                  {simulationRigor === 'medium' && '$50-250/week scaling'}
                  {simulationRigor === 'heavy' && '$100-400/week scaling'}
                  {simulationRigor === 'custom' && `Fixed ${customSimulationAmount}/week`}
                </div>
                
                {/* Custom Amount Input */}
                {simulationRigor === 'custom' && <div className="mt-3">
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">
                      Weekly Deposit Amount ($)
                    </label>
                    <input type="number" min="1" max="1000" value={customSimulationAmount} onChange={e => setCustomSimulationAmount(Number(e.target.value))} className="input-premium text-sm" placeholder="Enter weekly amount" />
                    <div className="text-xs text-muted-foreground mt-1">
                      Annual total: ${(customSimulationAmount * 52).toLocaleString()}
                    </div>
                  </div>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-muted-foreground mb-2">Participants</label>
                <input type="range" min="1" max="8" value={vaultStats.totalMembers || 1} onChange={e => setVaultStats(prev => ({
                ...prev,
                totalMembers: Number(e.target.value)
              }))} className="w-full" />
                <div className="text-center text-foreground font-bold">{vaultStats.totalMembers || 1} members</div>
              </div>
            </div>
          </div>

          {/* Interactive Growth Chart - Beautiful Bar Chart Style */}
          <div className="glass-card p-6 animate-fade-up stagger-2">
            <h2 className="text-xl font-bold text-foreground mb-5 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-secondary animate-pulse"></div>
              Growth Visualization
            </h2>
            
            {/* Bar Chart Container */}
            <div className="h-72 bg-background/30 backdrop-blur-sm rounded-2xl p-6 border border-border/20">
              <div className="h-full flex items-end justify-around gap-2 relative">
                {/* Y-axis labels */}
                <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-muted-foreground -ml-2 pointer-events-none">
                  <span className="bg-background/50 px-1 rounded">${chartData.length > 0 ? (Math.max(...chartData.map(d => d.total)) / 1000000).toFixed(1) : 0}M</span>
                  <span className="bg-background/50 px-1 rounded">${chartData.length > 0 ? (Math.max(...chartData.map(d => d.total)) / 2000000).toFixed(1) : 0}M</span>
                  <span className="bg-background/50 px-1 rounded">$0</span>
                </div>
                
                {/* Bars */}
                {chartData.length > 0 && chartData.map((point, index) => {
                  const maxTotal = Math.max(...chartData.map(d => d.total));
                  const heightPercent = maxTotal > 0 ? (point.total / maxTotal) * 100 : 10;
                  const wbtcPercent = maxTotal > 0 ? (point.wbtc / maxTotal) * 100 : 0;
                  
                  return (
                    <div key={index} className="flex flex-col items-center flex-1 h-full justify-end group">
                      {/* Tooltip */}
                      <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 bg-foreground text-background text-xs px-3 py-2 rounded-xl shadow-xl whitespace-nowrap z-10 pointer-events-none">
                        <div className="font-bold">${point.total.toLocaleString()}</div>
                        <div className="text-background/70">Year {point.year}</div>
                      </div>
                      
                      {/* Bar with gradient */}
                      <div 
                        className="w-full rounded-t-2xl relative overflow-hidden transition-all duration-500 group-hover:shadow-lg"
                        style={{ 
                          height: `${Math.max(heightPercent, 5)}%`,
                          background: point.phase === 2 
                            ? 'linear-gradient(to top, rgba(249, 115, 22, 0.6), rgba(249, 115, 22, 0.9))' 
                            : 'linear-gradient(to top, rgba(139, 92, 246, 0.5), rgba(139, 92, 246, 0.9))',
                          minHeight: '12px'
                        }}
                      >
                        {/* Inner glow effect */}
                        <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/10 to-white/20 rounded-t-2xl"></div>
                        
                        {/* wBTC overlay for Phase 2 */}
                        {wbtcPercent > 5 && (
                          <div 
                            className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-orange-500/80 to-orange-400/60 rounded-t-xl"
                            style={{ height: `${(wbtcPercent / heightPercent) * 100}%` }}
                          ></div>
                        )}
                      </div>
                      
                      {/* Year label */}
                      <span className="text-xs text-muted-foreground mt-2 font-semibold">
                        {point.year === 0 ? 'Start' : `Y${point.year}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Chart Legend - Cleaner */}
            <div className="mt-6 flex flex-wrap justify-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-lg bg-gradient-to-t from-primary/50 to-primary"></div>
                <span className="text-muted-foreground font-medium">Total Value</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-lg bg-gradient-to-t from-orange-500/50 to-orange-400"></div>
                <span className="text-muted-foreground font-medium">wBTC Holdings</span>
              </div>
            </div>
            
            {/* Key metrics - Softer cards */}
            {chartData.length > 0 && <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="soft-card text-center p-4">
                  <div className="text-xl font-black text-foreground">
                    ${chartData.length > 0 && chartData[chartData.length - 1]?.total ? chartData[chartData.length - 1].total.toLocaleString() : '0'}
                  </div>
                  <div className="text-sm text-muted-foreground font-medium">Total Value</div>
                </div>
                <div className="soft-card text-center p-4">
                  <div className="text-xl font-black text-foreground">
                    ${chartData.length > 0 && chartData[chartData.length - 1]?.initialDeposits ? chartData[chartData.length - 1].initialDeposits.toLocaleString() : '0'}
                  </div>
                  <div className="text-sm text-muted-foreground font-medium">Deposited</div>
                </div>
                <div className="soft-card text-center p-4">
                  <div className="text-xl font-black text-secondary">
                    {chartData.length > 0 && chartData[chartData.length - 1]?.total && chartData[chartData.length - 1]?.initialDeposits ? ((chartData[chartData.length - 1].total / chartData[chartData.length - 1].initialDeposits - 1) * 100).toFixed(0) : 0}%
                  </div>
                  <div className="text-sm text-muted-foreground font-medium">ROI</div>
                </div>
                <div className="soft-card text-center p-4">
                  <div className="text-xl font-black text-orange-500">
                    {chartData.length > 0 && chartData[chartData.length - 1]?.wbtc ? (chartData[chartData.length - 1].wbtc / btcPrice).toFixed(3) : 0}₿
                  </div>
                  <div className="text-sm text-muted-foreground font-medium">Final wBTC</div>
                </div>
                <div className="soft-card text-center p-4">
                  <div className="text-xl font-black text-destructive">
                    ${chartData.length > 0 && chartData[chartData.length - 1]?.cumulativeGasFees ? chartData[chartData.length - 1].cumulativeGasFees.toLocaleString() : '0'}
                  </div>
                  <div className="text-sm text-muted-foreground font-medium">Gas Fees</div>
                </div>
                <div className="soft-card text-center p-4">
                  <div className="text-xl font-black text-primary">
                    ${chartData.length > 0 && chartData[chartData.length - 1]?.cumulativeUtilityFees ? chartData[chartData.length - 1].cumulativeUtilityFees.toLocaleString() : '0'}
                  </div>
                  <div className="text-sm text-muted-foreground font-medium">Utility Fees</div>
                </div>
              </div>}
          </div>

          {/* More Details Dropdown - Peak Strand Distribution */}
          <div className="glass-card p-6 animate-fade-up stagger-3">
            <button 
              onClick={() => setShowMoreDetails(!showMoreDetails)}
              className="w-full flex items-center justify-between text-left"
            >
              <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-accent animate-pulse"></div>
                More Details
              </h2>
              <ChevronRight className={`w-5 h-5 text-muted-foreground transition-transform duration-300 ${showMoreDetails ? 'rotate-90' : ''}`} />
            </button>
            
            {showMoreDetails && <div className="mt-5 pt-5 border-t border-border/30 animate-fade-up">
              <h3 className="text-lg font-medium text-foreground mb-3">Peak Strand Distribution</h3>
              <div className="text-sm text-muted-foreground mb-4">
                Maximum strand values during Phase 1 before Phase 2 transition to wBTC
              </div>
              {chartData.length > 0 && <div className="space-y-4">
                  <div className="bg-background/30 backdrop-blur-sm p-4 rounded-xl border border-defi-pink/30 hover:border-defi-pink/50 transition-colors">
                    <h3 className="font-semibold text-defi-pink mb-1">Capital Strand (Spark) - {apyStrand1.toFixed(1)}% APY</h3>
                    <div className="text-2xl font-bold text-foreground">
                      ${Math.max(...chartData.map(d => d.strand1)).toLocaleString()}
                    </div>
                    <div className="text-muted-foreground text-sm">
                      Peak value during Phase 1 accumulation
                    </div>
                  </div>
                  
                  <div className="bg-background/30 backdrop-blur-sm p-4 rounded-xl border border-defi-purple/30 hover:border-defi-purple/50 transition-colors">
                    <h3 className="font-semibold text-defi-purple mb-1">Yield Strand (AAVE Polygon) - {apyStrand2.toFixed(1)}% APY</h3>
                    <div className="text-2xl font-bold text-foreground">
                      ${Math.max(...chartData.map(d => d.strand2)).toLocaleString()}
                    </div>
                    <div className="text-muted-foreground text-sm">
                      Peak value during Phase 1 accumulation
                    </div>
                  </div>
                  
                  <div className="bg-background/30 backdrop-blur-sm p-4 rounded-xl border border-defi-cyan/30 hover:border-defi-cyan/50 transition-colors">
                    <h3 className="font-semibold text-defi-cyan mb-1">Momentum Strand (QuickSwap V3) - {apyStrand3.toFixed(1)}% APY</h3>
                    <div className="text-2xl font-bold text-foreground">
                      ${Math.max(...chartData.map(d => d.strand3)).toLocaleString()}
                    </div>
                    <div className="text-muted-foreground text-sm">
                      Peak value during Phase 1 accumulation
                    </div>
                  </div>
                  
                  <div className="bg-background/30 backdrop-blur-sm p-4 rounded-xl border border-defi-orange/30 hover:border-defi-orange/50 transition-colors">
                    <h3 className="font-semibold text-defi-orange mb-1">wBTC Accumulation - Phase 2</h3>
                    <div className="text-2xl font-bold text-foreground">
                      {chartData[chartData.length - 1]?.wbtc ? (chartData[chartData.length - 1].wbtc / btcPrice).toFixed(3) : 0}₿
                    </div>
                    <div className="text-muted-foreground text-sm">
                      Final Bitcoin holdings (${chartData[chartData.length - 1]?.wbtc?.toLocaleString() || 0})
                    </div>
                  </div>
                </div>}
            </div>}
          </div>
        </div>
      </div>;
  };
  return <div className="min-h-screen bg-background relative overflow-x-hidden overflow-y-auto mesh-gradient">
      <VaultBackground />
      
      {/* Copied Banner */}
      {showCopiedBanner && <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in-out">
          <div className="bg-green-500 text-white px-6 py-3 rounded-full shadow-lg flex items-center space-x-2">
            <span className="font-medium">Share link copied!</span>
          </div>
        </div>}
      
      {/* Header */}
      <header className="relative z-20 glass-dark border-b border-border/30 px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-gradient-to-br from-primary to-secondary rounded-xl shadow-glow-purple animate-pulse-glow">
                <svg width="28" height="28" viewBox="0 0 100 100" className="flex-shrink-0">
                  {/* Vault safe outline */}
                  <rect x="5" y="15" width="90" height="75" rx="8" ry="8" fill="hsl(230 25% 15%)" stroke="hsl(230 25% 8%)" strokeWidth="2" />
                  <rect x="10" y="20" width="80" height="65" rx="4" ry="4" fill="hsl(210 40% 96%)" />
                  
                  {/* Vault door handle/wheel */}
                  <circle cx="30" cy="45" r="18" fill="hsl(230 25% 15%)" />
                  <circle cx="30" cy="45" r="6" fill="none" stroke="hsl(45 90% 55%)" strokeWidth="3" />
                  <line x1="18" y1="45" x2="42" y2="45" stroke="hsl(45 90% 55%)" strokeWidth="3" />
                  <line x1="30" y1="33" x2="30" y2="57" stroke="hsl(45 90% 55%)" strokeWidth="3" />
                  
                  {/* Keypad grid */}
                  {[0, 1, 2, 3].map(row => [0, 1, 2].map(col => <rect key={`${row}-${col}`} x={55 + col * 9} y={30 + row * 9} width="6" height="6" rx="1" fill="hsl(45 90% 55%)" />))}
                  
                  {/* Vault hinges */}
                  <rect x="85" y="25" width="6" height="12" rx="1" fill="hsl(230 25% 15%)" />
                  <rect x="88" y="27" width="2" height="8" fill="hsl(45 90% 55%)" />
                  <rect x="85" y="63" width="6" height="12" rx="1" fill="hsl(230 25% 15%)" />
                  <rect x="88" y="65" width="2" height="8" fill="hsl(45 90% 55%)" />
                  
                  {/* Vault feet */}
                  <rect x="15" y="85" width="8" height="6" rx="2" fill="hsl(230 25% 15%)" />
                  <rect x="77" y="85" width="8" height="6" rx="2" fill="hsl(230 25% 15%)" />
                </svg>
              </div>
              <div>
                <div className="text-xl font-bold text-gradient-hero flex items-center gap-1.5">
                  The Vault Club
                  <span className="px-2 py-0.5 text-[8px] font-semibold bg-primary/15 text-primary/90 border border-primary/25 rounded-sm uppercase tracking-wider leading-none">Beta</span>
                </div>
                <div className="text-xs text-secondary/80 font-medium tracking-wide">Investment Contracts into Digital Assets</div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Theme Toggle */}
            <ThemeToggle />
            
            {/* Sequence Theory Logo */}
            <a ref={sequenceTheoryBtnRef} href="https://sequencetheoryinc.com" target="_blank" rel="noopener noreferrer" className={`flex items-center glass px-4 py-2.5 rounded-xl hover:border-primary/40 hover:shadow-glow-purple transition-all duration-300 cursor-pointer group ${tutorial.currentStepData?.target === 'sequence-theory-btn' ? 'tutorial-highlight' : ''}`}>
              <div className="text-sm font-semibold">
                <span className="text-accent group-hover:text-accent/80 transition-colors">SEQUENCE</span>
                <span className="ml-1 text-primary group-hover:text-primary/80 transition-colors">THEORY</span>
              </div>
            </a>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar - Bigger & More Touch-Friendly */}
      <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 glass-dark border border-border/30 rounded-3xl px-3 py-3 safe-area-pb" aria-label="Main navigation">
        <div className="flex items-center gap-2">
          <button ref={navHomeRef} onClick={() => {
          navigateTo('home');
          tutorial.checkAdvancement('navigation', 'home');
        }} className={`flex flex-col items-center transition-all duration-300 py-2 px-4 rounded-2xl group ${tutorial.currentStepData?.target === 'nav-home' ? 'tutorial-highlight' : ''}`}>
            <div className={`p-3 rounded-2xl transition-all duration-300 ${currentPage === 'home' ? 'bg-gradient-to-br from-primary to-secondary text-white shadow-glow-purple' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
              <Home className="w-5 h-5" />
            </div>
            <span className={`text-xs font-semibold mt-1.5 transition-colors ${currentPage === 'home' ? 'text-secondary' : 'text-muted-foreground group-hover:text-foreground'}`}>Home</span>
          </button>
          
          <button ref={navWalletRef} onClick={() => {
          navigateTo('personal');
          tutorial.checkAdvancement('navigation', 'personal');
        }} className={`flex flex-col items-center transition-all duration-300 py-2 px-4 rounded-2xl group ${tutorial.currentStepData?.target === 'nav-wallet' ? 'tutorial-highlight' : ''}`}>
            <div className={`p-3 rounded-2xl transition-all duration-300 ${currentPage === 'personal' ? 'bg-gradient-to-br from-primary to-secondary text-white shadow-glow-purple' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
              <User className="w-5 h-5" />
            </div>
            <span className={`text-xs font-semibold mt-1.5 transition-colors ${currentPage === 'personal' ? 'text-secondary' : 'text-muted-foreground group-hover:text-foreground'}`}>Wallet</span>
          </button>
          
          <button ref={navContractsRef} onClick={() => {
          navigateTo('group');
          tutorial.checkAdvancement('navigation', 'group');
        }} className={`flex flex-col items-center transition-all duration-300 py-2 px-4 rounded-2xl group ${tutorial.currentStepData?.target === 'nav-contracts' ? 'tutorial-highlight' : ''}`}>
            <div className={`p-3 rounded-2xl transition-all duration-300 ${currentPage === 'group' ? 'bg-gradient-to-br from-primary to-secondary text-white shadow-glow-purple' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
              <Users className="w-5 h-5" />
            </div>
            <span className={`text-xs font-semibold mt-1.5 transition-colors ${currentPage === 'group' ? 'text-secondary' : 'text-muted-foreground group-hover:text-foreground'}`}>Contracts</span>
          </button>
          
          <button ref={navDataRef} onClick={() => {
          navigateTo('dataset');
          tutorial.checkAdvancement('navigation', 'dataset');
        }} className={`flex flex-col items-center transition-all duration-300 py-2 px-4 rounded-2xl group ${tutorial.currentStepData?.target === 'nav-data' ? 'tutorial-highlight' : ''}`}>
            <div className={`p-3 rounded-2xl transition-all duration-300 ${currentPage === 'dataset' ? 'bg-gradient-to-br from-primary to-secondary text-white shadow-glow-purple' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
              <Database className="w-5 h-5" />
            </div>
            <span className={`text-xs font-semibold mt-1.5 transition-colors ${currentPage === 'dataset' ? 'text-secondary' : 'text-muted-foreground group-hover:text-foreground'}`}>Data</span>
          </button>

          <button ref={navFutureRef} onClick={() => {
          navigateTo('simulation');
          tutorial.checkAdvancement('navigation', 'simulation');
        }} className={`flex flex-col items-center transition-all duration-300 py-2 px-4 rounded-2xl group ${tutorial.currentStepData?.target === 'nav-future' ? 'tutorial-highlight' : ''}`}>
            <div className={`p-3 rounded-2xl transition-all duration-300 ${currentPage === 'simulation' ? 'bg-gradient-to-br from-primary to-secondary text-white shadow-glow-purple' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
              <TrendingUp className="w-5 h-5" />
            </div>
            <span className={`text-xs font-semibold mt-1.5 transition-colors ${currentPage === 'simulation' ? 'text-secondary' : 'text-muted-foreground group-hover:text-foreground'}`}>Future</span>
          </button>
        </div>
      </nav>

      {/* Tutorial Bubbles */}
      {tutorial.isActive && tutorial.currentStepData?.target === 'nav-wallet' && <TutorialBubble targetRef={navWalletRef} />}
      {tutorial.isActive && tutorial.currentStepData?.target === 'nav-contracts' && <TutorialBubble targetRef={navContractsRef} />}
      {tutorial.isActive && tutorial.currentStepData?.target === 'nav-data' && <TutorialBubble targetRef={navDataRef} />}
      {tutorial.isActive && tutorial.currentStepData?.target === 'nav-future' && <TutorialBubble targetRef={navFutureRef} />}
      {tutorial.isActive && tutorial.currentStepData?.target === 'nav-home' && <TutorialBubble targetRef={navHomeRef} />}
      {tutorial.isActive && tutorial.currentStepData?.target === 'connect-account' && <TutorialBubble targetRef={connectAccountRef} />}
      {tutorial.isActive && tutorial.currentStepData?.target === 'future-page-intro' && <TutorialBubble targetRef={futurePageIntroRef} />}
      {tutorial.isActive && tutorial.currentStepData?.target === 'sequence-theory-btn' && <TutorialBubble targetRef={sequenceTheoryBtnRef} />}
      {tutorial.isActive && tutorial.currentStepData?.target === 'contracts-directory' && <TutorialBubble targetRef={contractsDirectoryRef} />}
      {tutorial.isActive && tutorial.currentStepData?.target === 'home-contract-section' && <TutorialBubble targetRef={homeContractSectionRef} />}

      {/* Main Content */}
      <main className="relative">
        {currentPage === 'home' && HomePage()}
        {currentPage === 'dataset' && DatasetPage()}
        {currentPage === 'personal' && PersonalPage()}
        {currentPage === 'group' && GroupInfoPage()}
        {currentPage === 'simulation' && FutureSimulationPage()}
      </main>

      {/* Strand Modal */}
      {activeStrand && StrandModal({
      strand: activeStrand,
      onClose: closeModal
    })}

      {/* Create Club Modal */}
      {activeModal === 'createClub' && CreateClubModal()}
      
      {/* Auth Modal */}
      {showAuthModal && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-up" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full shadow-2xl ring-1 ring-black/5 dark:ring-white/10">
            <div className="bg-gradient-to-r from-purple-500 to-indigo-600 p-6 rounded-t-2xl text-white">
              <div className="flex justify-between items-start">
                <div>
                  <h3 id="auth-modal-title" className="text-xl font-bold">{authMode === 'login' ? 'Log In' : 'Sign Up'}</h3>
                  <p className="text-white/80">Access The Vault Club.</p>
                  <p className="text-white/60 text-sm">(Sequence Theory, Inc. Credentials)</p>
                </div>
                <button onClick={() => {
                  setShowAuthModal(false);
                  tutorial.setAuthModalOpen(false);
                }} className="text-white/80 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10" aria-label="Close modal">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6 bg-white dark:bg-slate-900 rounded-b-2xl">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Email Address
                </label>
                <input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="your@email.com" className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-white bg-white dark:bg-slate-800 placeholder-gray-400 dark:placeholder-gray-500" />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Password
                </label>
                <input type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="••••••••" className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-white bg-white dark:bg-slate-800 placeholder-gray-400 dark:placeholder-gray-500" />
              </div>
              
              {authMode === 'signup' && <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    Confirm Password
                  </label>
                  <input type="password" value={authConfirmPassword} onChange={e => setAuthConfirmPassword(e.target.value)} placeholder="••••••••" className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-white bg-white dark:bg-slate-800 placeholder-gray-400 dark:placeholder-gray-500" />
                </div>}
              
              {authError && <div className="p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-400 text-sm">
                  {authError}
                </div>}
              
              {authSuccess && <div className="p-3 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg text-green-700 dark:text-green-400 text-sm">
                  {authSuccess}
                </div>}
              
              <button onClick={handleAuthSubmit} disabled={authLoading} className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white py-3 rounded-lg font-medium transition-all duration-300 shadow-md hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed">
                {authLoading ? 'Please wait...' : authMode === 'login' ? 'Log In' : 'Create Account'}
              </button>
              
              <div className="text-center">
                <button onClick={() => {
              setAuthMode(authMode === 'login' ? 'signup' : 'login');
              setAuthEmail('');
              setAuthPassword('');
              setAuthConfirmPassword('');
              setAuthError('');
              setAuthSuccess('');
            }} className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium">
                  {authMode === 'login' ? "Don't have an account? Sign Up" : "Already have an account? Log In"}
                </button>
              </div>
            </div>
          </div>
        </div>}
      
      {/* ToS Agreement Modal - appears during signup */}
      <ToSAgreementModal
        isOpen={showToSModal}
        onClose={handleToSClose}
        onAccept={handleToSAccept}
        isLoading={authLoading}
      />
      
      {/* ToS Viewer Modal - for viewing ToS from Data page */}
      <ToSViewer
        isOpen={showToSViewer}
        onClose={() => setShowToSViewer(false)}
      />
    </div>;
};

// Wrapper that tracks wallet state for tutorial provider
const VaultClubWebsite = () => {
  const [walletState, setWalletState] = useState(false);
  return <TutorialProvider walletConnected={walletState}>
      <VaultClubWebsiteInner onWalletStateChange={setWalletState} />
    </TutorialProvider>;
};
export default VaultClubWebsite;