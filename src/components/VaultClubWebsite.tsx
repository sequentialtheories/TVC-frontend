import React, { useState, useEffect } from 'react';
import { Database, User, Users, TrendingUp, X, Bitcoin, DollarSign, Zap, Shield, ArrowLeft, Wallet, Home, Share2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Session } from '@supabase/supabase-js';
import { ThemeToggle } from './ThemeToggle';
import VaultBackground from './VaultBackground';

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
  maxMembers: number;
  isPrivate: boolean;
  isChargedContract: boolean;
  customWeeklyAmount: number;
  customSchedule: SchedulePeriod[];
}

interface Subclub {
  id: number;
  contractAddress: string;
  creator: string | null;
  maxMembers: number;
  lockupPeriod: number;
  rigorLevel: string;
  isPrivate: boolean;
  isChargedContract: boolean;
  currentMembers: number;
  createdAt: string;
  status: string;
  totalDeposits: number;
  members: string[];
  borderColor: string;
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

// Connect wallet and return address or null
async function connectWallet(): Promise<string | null> {
  if (typeof window === 'undefined' || !window.ethereum) {
    alert("MetaMask is required to use this app.");
    return null;
  }
  try {
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' }) as string[];
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

// Get Spark Protocol and AAVE Polygon lending rates
async function getAaveRates(): Promise<AaveRates> {
  try {
    const response = await fetch('https://yields.llama.fi/pools');
    if (response.ok) {
      const data = await response.json();
      
      const sparkPool = data.data.find((pool: { project: string; chain: string; symbol: string; apy: number }) => 
        pool.project === 'spark' && 
        pool.chain === 'Ethereum' &&
        pool.symbol.includes('USDC')
      );
      
      const aavePolygonPool = data.data.find((pool: { project: string; chain: string; symbol: string; apy: number }) => 
        pool.project === 'aave-v3' && 
        pool.chain === 'Polygon' &&
        pool.symbol.includes('USDC')
      );
      
      return {
        liquidityRate: sparkPool ? sparkPool.apy : 3.5,
        aavePolygonRate: aavePolygonPool ? aavePolygonPool.apy : 7.5
      };
    }
    throw new Error('API call failed');
  } catch (error) {
    console.error("Error fetching lending rates:", error);
    return { liquidityRate: 3.5, aavePolygonRate: 7.5 };
  }
}

// Get QuickSwap V3 APY data
async function getQuickSwapAPY(): Promise<number> {
  try {
    const response = await fetch('https://yields.llama.fi/pools');
    if (response.ok) {
      const data = await response.json();
      
      const quickswapPool = data.data.find((pool: { project: string; chain: string; symbol: string; apy: number }) => 
        pool.project === 'quickswap-dex' && 
        pool.chain === 'Polygon' &&
        (pool.symbol.includes('WETH') || pool.symbol.includes('ETH')) &&
        pool.symbol.includes('USDC')
      );
      
      return quickswapPool ? quickswapPool.apy : 12.5;
    }
    throw new Error('API call failed');
  } catch (error) {
    console.error("Error fetching QuickSwap APY:", error);
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

const VaultClubWebsite = () => {
  const [activeModal, setActiveModal] = useState(null);
  const [activeStrand, setActiveStrand] = useState(null);
  const [currentPage, setCurrentPage] = useState('home');
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState(null);
  const [autoRenewEnabled, setAutoRenewEnabled] = useState(false);
  const [vaultBalance, setVaultBalance] = useState("0");
  const [depositAmount, setDepositAmount] = useState('');
  
  // Club creation states
  const [clubCreationData, setClubCreationData] = useState({
    lockupPeriod: 5,
    rigorLevel: 'medium',
    maxMembers: 4,
    isPrivate: false,
    isChargedContract: false,
    customWeeklyAmount: 75,
    customSchedule: [
      { yearStart: 1, yearEnd: 3, amount: 75 },
      { yearStart: 4, yearEnd: 6, amount: 100 },
      { yearStart: 7, yearEnd: 10, amount: 150 },
      { yearStart: 11, yearEnd: 20, amount: 200 }
    ]
  });
  
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
  const [aaveRates, setAaveRates] = useState({ liquidityRate: 3.5, aavePolygonRate: 7.5 });
  const [quickSwapAPY, setQuickSwapAPY] = useState(12.5);
  
  const [selectedContract, setSelectedContract] = useState(null);
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



  // Auth state listener
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        if (session?.user) {
          setWalletConnected(true);
          setWalletAddress(session.user.email || session.user.id.slice(0, 10));
          setShowAuthModal(false);
        } else {
          setWalletConnected(false);
          setWalletAddress('');
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        setWalletConnected(true);
        setWalletAddress(session.user.email || session.user.id.slice(0, 10));
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
      const contractToJoin = deployedSubclubs.find(club => 
        club.contractAddress === joinContractId && 
        !club.isPrivate && 
        club.currentMembers < club.maxMembers &&
        (!club.members || !club.members.includes(walletAddress))
      );
      
      if (contractToJoin) {
        // Auto-join the contract
        const updatedContract = {
          ...contractToJoin,
          currentMembers: contractToJoin.currentMembers + 1,
          members: [...(contractToJoin.members || []), walletAddress]
        };
        
        setDeployedSubclubs(prev => 
          prev.map(club => 
            club.contractAddress === joinContractId ? updatedContract : club
          )
        );
        
        alert(`✅ Successfully joined subclub contract!\n\n${contractToJoin.lockupPeriod} ${contractToJoin.isChargedContract ? 'Month' : 'Year'} Lockup • ${contractToJoin.rigorLevel.charAt(0).toUpperCase() + contractToJoin.rigorLevel.slice(1)} Rigor\n\nYou can now start making deposits according to the contract schedule.`);
        
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

        // Load QuickSwap APY for Strand 3
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
    let V1 = 0, V2 = 0, V3 = 0, wBTC = 0; // Starting balances including wBTC
    let totalDeposited = 0; // Track cumulative deposits without compounding
    const weeksPerYear = 52;
    const totalWeeks = simulationYears * weeksPerYear;
    
    // Convert APY to weekly rates using dynamic data
    const r1 = Math.pow(1 + apyStrand1/100, 1/weeksPerYear) - 1;
    const r2 = Math.pow(1 + apyStrand2/100, 1/weeksPerYear) - 1;
    const r3 = Math.pow(1 + apyStrand3/100, 1/weeksPerYear) - 1;

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
      const phase2Triggered = progressPercent >= 0.5 || (V1 + V2 + V3 + wBTC) >= 1000000;
      
      // Calculate weekly deposit based on selected rigor
      let weeklyDeposit;
      
      if (simulationRigor === 'light') {
        // Light rigor: monthly deposits converted to weekly
        if (year <= 1) weeklyDeposit = 100 / 4.33;       // $100/month
        else if (year <= 2) weeklyDeposit = 150 / 4.33;  // $150/month
        else if (year <= 3) weeklyDeposit = 200 / 4.33;  // $200/month
        else weeklyDeposit = 250 / 4.33;                 // $250/month
      } else if (simulationRigor === 'medium') {
        // Medium rigor deposit schedule
        if (year <= 3) weeklyDeposit = 50;
        else if (year <= 6) weeklyDeposit = 100;
        else if (year <= 10) weeklyDeposit = 200;
        else weeklyDeposit = 250;
      } else if (simulationRigor === 'heavy') {
        // Heavy rigor deposit schedule
        if (year <= 3) weeklyDeposit = 100;
        else if (year <= 6) weeklyDeposit = 200;
        else if (year <= 10) weeklyDeposit = 300;
        else weeklyDeposit = 400;
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
          if (simulationRigor === 'light') weeklyDCA = Math.min(V1 * 0.1, 1000);
          else if (simulationRigor === 'medium') weeklyDCA = Math.min(V1 * 0.1, 5000);
          else if (simulationRigor === 'heavy') weeklyDCA = Math.min(V1 * 0.1, 10000);
          else weeklyDCA = Math.min(V1 * 0.1, 2000); // Custom
          
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

  const navigateTo = (page) => {
    setCurrentPage(page);
  };

  const calculateWeeklyDepositAmount = () => {
    if (!walletConnected || !walletAddress) {
      console.log("Debug: Wallet not connected");
      return 0;
    }
    
    // Get all subclubs user is a member of
    const userSubclubs = deployedSubclubs.filter(club => 
      club.members && club.members.includes(walletAddress)
    );
    
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
      light: 25,   // Will be calculated based on contract age: $100-$250/month
      medium: 50,  // Years 1-3: $50/week, 4-6: $100/week, 7-10: $200/week, 11+: $250/week
      heavy: 100,  // Years 1-3: $100/week, 4-6: $200/week, 7-10: $300/week, 11+: $400/week
      custom: 0    // Will be calculated from custom schedule
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
        if (subclub.customSchedule) {
          const contractStartDate = new Date(subclub.createdAt).getTime();
          const now = Date.now();
          const yearsElapsed = (now - contractStartDate) / (365.25 * 24 * 60 * 60 * 1000);
          
          const currentPeriod = subclub.customSchedule.find(period => 
            yearsElapsed >= (period.yearStart - 1) && yearsElapsed < period.yearEnd
          );
          amount = currentPeriod ? currentPeriod.amount : subclub.customWeeklyAmount || 0;
        } else {
          amount = subclub.customWeeklyAmount || 0;
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
      
      console.log(`- Contract ${subclub.contractAddress.slice(0,8)}: ${subclub.rigorLevel} = ${amount}/week`);
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
  };

  const handleAuthSubmit = async () => {
    if (authMode === 'signup' && authPassword !== authConfirmPassword) {
      setAuthError('Passwords do not match!');
      return;
    }
    
    if (!authEmail || !authPassword) {
      setAuthError('Please fill in all fields');
      return;
    }

    setAuthLoading(true);
    setAuthError('');
    setAuthSuccess('');

    try {
      if (authMode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
          options: {
            emailRedirectTo: `${window.location.origin}/`
          }
        });
        
        if (error) throw error;
        setAuthSuccess('Check your email for confirmation link!');
        setAuthEmail('');
        setAuthPassword('');
        setAuthConfirmPassword('');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword,
        });
        
        if (error) throw error;
        setVaultBalance("0");
        setAuthEmail('');
        setAuthPassword('');
        setAuthConfirmPassword('');
      }
    } catch (error: any) {
      setAuthError(error.message || 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setWalletConnected(false);
    setWalletAddress('');
    setVaultBalance("0");
  };

  const getContractColor = (subclub) => {
    // Use the color assigned when the contract was created
    return subclub.borderColor || 'border-gray-500'; // fallback color
  };

  const goHome = () => {
    setCurrentPage('home');
  };

  const handleDeposit = async () => {
    const weeklyAmount = calculateWeeklyDepositAmount();
    
    console.log("Debug deposit - Weekly amount:", weeklyAmount);
    console.log("Debug deposit - User contracts:", deployedSubclubs.filter(club => 
      club.members && club.members.includes(walletAddress)
    ));
    
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
      const userContracts = deployedSubclubs.filter(club => 
        club.members && club.members.includes(walletAddress)
      );
      
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
      console.log("Strand allocations:", { strand1PerContract, strand2PerContract, strand3PerContract });
      
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
              if (club.customSchedule) {
                const contractStartDate = new Date(club.createdAt).getTime();
                const now = Date.now();
                const yearsElapsed = (now - contractStartDate) / (365.25 * 24 * 60 * 60 * 1000);
                
                const currentPeriod = club.customSchedule.find(period => 
                  yearsElapsed >= (period.yearStart - 1) && yearsElapsed < period.yearEnd
                );
                contractWeeklyAmount = currentPeriod ? currentPeriod.amount : club.customWeeklyAmount || 0;
              } else {
                contractWeeklyAmount = club.customWeeklyAmount || 0;
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
            
            console.log(`Updated club ${newClub.contractAddress.slice(0,8)} (${club.rigorLevel}):`, {
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
    const colors = [
      'border-yellow-500',   
      'border-green-500',   
      'border-blue-500',    
      'border-red-500',     
      'border-purple-500',  
      'border-orange-500',  
      'border-pink-500',    
      'border-indigo-500'   
    ];
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
      currentMembers: 1, // Creator is first member
      createdAt: new Date().toISOString(),
      status: 'active',
      totalDeposits: 0,
      members: [walletAddress],
      borderColor: randomColor, // Store the color with the contract
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
  };

  const CreateClubModal = () => {    
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-up" role="dialog" aria-modal="true" aria-labelledby="create-club-title">
        <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl max-h-[90vh] overflow-hidden ring-1 ring-black/5">
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-6 rounded-t-2xl text-white">
            <div className="flex justify-between items-start">
              <div>
                <h3 id="create-club-title" className="text-xl font-bold">Create New SubClub Contract</h3>
                <p className="text-white/80">Deploy smart contract with mega vault system</p>
              </div>
              <button onClick={closeModal} className="text-white/80 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10" aria-label="Close modal">
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
          
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(90vh - 120px)' }}>
            <div className="p-6 space-y-6">
            
            {/* Charged Contract Toggle */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-gray-700">
                  Charged Contract
                </label>
                <button 
                  onClick={() => setClubCreationData(prev => ({...prev, isChargedContract: !prev.isChargedContract}))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    clubCreationData.isChargedContract 
                      ? 'bg-blue-600' 
                      : 'bg-gray-200'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    clubCreationData.isChargedContract ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
              <div className="text-xs text-gray-500">
                {clubCreationData.isChargedContract 
                  ? "Enables 1-12 month contracts with $1.25/user/week fee for timeline flexibility" 
                  : "Traditional contracts (1+ years) with standard $1/user/week utility fee"
                }
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Maximum Members
              </label>
              <select 
                value={clubCreationData.maxMembers}
                onChange={(e) => setClubCreationData(prev => ({...prev, maxMembers: Number(e.target.value)}))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg text-black"
              >
                <option value={1}>1 Member</option>
                <option value={2}>2 Members</option>
                <option value={3}>3 Members</option>
                <option value={4}>4 Members</option>
                <option value={5}>5 Members</option>
                <option value={6}>6 Members</option>
                <option value={7}>7 Members</option>
                <option value={8}>8 Members</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Lockup Consensus ({clubCreationData.isChargedContract ? 'Months' : 'Years'})
              </label>
              <select 
                value={clubCreationData.lockupPeriod}
                onChange={(e) => setClubCreationData(prev => ({...prev, lockupPeriod: Number(e.target.value)}))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg text-black"
              >
                {clubCreationData.isChargedContract ? (
                  // Charged contract options (1-12 months)
                  <>
                    <option value={1}>1 Month</option>
                    <option value={2}>2 Months</option>
                    <option value={3}>3 Months</option>
                    <option value={4}>4 Months</option>
                    <option value={5}>5 Months</option>
                    <option value={6}>6 Months</option>
                    <option value={7}>7 Months</option>
                    <option value={8}>8 Months</option>
                    <option value={9}>9 Months</option>
                    <option value={10}>10 Months</option>
                    <option value={11}>11 Months</option>
                    <option value={12}>12 Months</option>
                  </>
                ) : (
                  // Traditional contract options (1-20 years)
                  <>
                    <option value={1}>1 Year</option>
                    <option value={2}>2 Years</option>
                    <option value={3}>3 Years</option>
                    <option value={4}>4 Years</option>
                    <option value={5}>5 Years</option>
                    <option value={6}>6 Years</option>
                    <option value={7}>7 Years</option>
                    <option value={8}>8 Years</option>
                    <option value={9}>9 Years</option>
                    <option value={10}>10 Years</option>
                    <option value={11}>11 Years</option>
                    <option value={12}>12 Years</option>
                    <option value={13}>13 Years</option>
                    <option value={14}>14 Years</option>
                    <option value={15}>15 Years</option>
                    <option value={16}>16 Years</option>
                    <option value={17}>17 Years</option>
                    <option value={18}>18 Years</option>
                    <option value={19}>19 Years</option>
                    <option value={20}>20 Years</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Investment Rigor
              </label>
              <select 
                value={clubCreationData.rigorLevel}
                onChange={(e) => setClubCreationData(prev => ({...prev, rigorLevel: e.target.value}))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg text-black"
              >
                <option value="light">Light</option>
                <option value="medium">Medium</option>
                <option value="heavy">Heavy</option>
                <option value="custom">Custom</option>
              </select>
              
              {/* Custom Schedule Input */}
              {clubCreationData.rigorLevel === 'custom' && (
                <div className="mt-4">
                  <div className="flex justify-between items-center mb-3">
                    <label className="block text-sm font-medium text-gray-700">
                      Custom Deposit Schedule
                    </label>
                    <button 
                      onClick={() => {
                        const newSchedule = [...clubCreationData.customSchedule];
                        newSchedule.push({ 
                          yearStart: newSchedule.length > 0 ? newSchedule[newSchedule.length - 1].yearEnd + 1 : 1, 
                          yearEnd: newSchedule.length > 0 ? newSchedule[newSchedule.length - 1].yearEnd + 3 : 3, 
                          amount: 100 
                        });
                        setClubCreationData(prev => ({...prev, customSchedule: newSchedule}));
                      }}
                      className="text-xs px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
                    >
                      Add Period
                    </button>
                  </div>
                  
                  <div className="space-y-3 max-h-48 overflow-y-auto">
                    {clubCreationData.customSchedule.map((period, index) => (
                      <div key={index} className="p-3 bg-gray-50 rounded-lg flex items-center space-x-3">
                        <div className="flex-1 grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Start Year</label>
                            <input
                              type="number"
                              min="1"
                              max="50"
                              value={period.yearStart}
                              onChange={(e) => {
                                const newSchedule = [...clubCreationData.customSchedule];
                                newSchedule[index] = { ...period, yearStart: Number(e.target.value) };
                                setClubCreationData(prev => ({...prev, customSchedule: newSchedule}));
                              }}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-black"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">End Year</label>
                            <input
                              type="number"
                              min="1"
                              max="50"
                              value={period.yearEnd}
                              onChange={(e) => {
                                const newSchedule = [...clubCreationData.customSchedule];
                                newSchedule[index] = { ...period, yearEnd: Number(e.target.value) };
                                setClubCreationData(prev => ({...prev, customSchedule: newSchedule}));
                              }}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-black"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Weekly Amount ($)</label>
                            <input
                              type="number"
                              min="1"
                              max="1000"
                              value={period.amount}
                              onChange={(e) => {
                                e.preventDefault();
                                const newSchedule = [...clubCreationData.customSchedule];
                                newSchedule[index] = { ...period, amount: Number(e.target.value) };
                                setClubCreationData(prev => ({...prev, customSchedule: newSchedule}));
                              }}
                              onFocus={(e) => e.target.style.outline = 'none'}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-black"
                              style={{ outline: 'none' }}
                            />
                          </div>
                        </div>
                        {clubCreationData.customSchedule.length > 1 && (
                          <button 
                            onClick={() => {
                              const newSchedule = clubCreationData.customSchedule.filter((_, i) => i !== index);
                              setClubCreationData(prev => ({...prev, customSchedule: newSchedule}));
                            }}
                            className="text-red-500 hover:text-red-700 text-xs px-2 py-1"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  <div className="text-xs text-gray-500 mt-3">
                    Create your own escalation schedule with complete flexibility ($1-$1000 per week). No obligation to increase amounts.
                  </div>
                  <div className="text-xs text-gray-600 mt-2 font-medium">
                    Total over {Math.max(...clubCreationData.customSchedule.map(p => p.yearEnd))} years: ${clubCreationData.customSchedule.reduce((sum, period) => {
                      const years = period.yearEnd - period.yearStart + 1;
                      return sum + (period.amount * 52 * years);
                    }, 0).toLocaleString()}
                  </div>
                </div>
              )}
              
              {/* Rigor Level Descriptions */}
              <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                <div className="text-xs text-gray-600">
                  {clubCreationData.rigorLevel === 'light' && 
                    "Light Rigor: Monthly deposits that scale over time. Year 1: $100/month, Year 2: $150/month, Year 3: $200/month, Year 4+: $250/month. Perfect for beginners wanting gradual increases."
                  }
                  {clubCreationData.rigorLevel === 'medium' && 
                    "Medium Rigor: Starts at $50/week, scales up over time. Years 1-3: $50/week, 4-6: $100/week, 7-10: $200/week, 11+: $250/week."
                  }
                  {clubCreationData.rigorLevel === 'heavy' && 
                    "Heavy Rigor: Starts at $100/week, scales significantly. Years 1-3: $100/week, 4-6: $200/week, 7-10: $300/week, 11+: $400/week."
                  }
                  {clubCreationData.rigorLevel === 'custom' && 
                    `Custom Rigor: Fixed ${clubCreationData.customWeeklyAmount}/week throughout the entire contract duration. Total annual contribution: ${(clubCreationData.customWeeklyAmount * 52).toLocaleString()}.`
                  }
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Privacy Setting
              </label>
              <div className="flex space-x-2">
                <button 
                  onClick={() => setClubCreationData(prev => ({...prev, isPrivate: false}))}
                  className={`flex-1 py-3 px-4 rounded-lg text-lg font-medium transition-all duration-300 shadow-sm hover:shadow-md hover:scale-[1.02] ${
                    !clubCreationData.isPrivate 
                      ? 'bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-800 border-2 border-blue-300' 
                      : 'bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 text-gray-600 border-2 border-gray-200'
                  }`}
                >
                  Public
                </button>
                <button 
                  onClick={() => setClubCreationData(prev => ({...prev, isPrivate: true}))}
                  className={`flex-1 py-3 px-4 rounded-lg text-lg font-medium transition-all duration-300 shadow-sm hover:shadow-md hover:scale-[1.02] ${
                    clubCreationData.isPrivate 
                      ? 'bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-800 border-2 border-blue-300' 
                      : 'bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 text-gray-600 border-2 border-gray-200'
                  }`}
                >
                  Private
                </button>
              </div>
              <div className="text-xs text-gray-500 mt-2">
                {clubCreationData.isPrivate 
                  ? "Private subclubs are invitation-only and won't appear in public listings" 
                  : "Public subclubs are visible to all users and can be joined freely"
                }
              </div>
            </div>

            <div className="pt-6 border-t">
              <button 
                onClick={handleCreateClub}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-4 rounded-lg font-medium text-lg transition-all duration-300 shadow-md hover:shadow-xl hover:scale-[1.02]"
              >
                Deploy Contract
              </button>
            </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const strandData = {
    1: {
      title: "Capital Strand",
      subtitle: "Spark Protocol • 10% Allocation",
      apy: `${apyStrand1.toFixed(1)}% APY`,
      description: "Stablecoin lending that tracks ownership and holds emergency reserves",
      features: [
        "Spark Protocol stablecoin lending (≈3-5% APY)",
        "Tracks ownership and holds emergency reserves",
        "Provides capital for wBTC purchases in Phase 2",
        "Lowest risk, steady returns from lending"
      ],
      color: "from-pink-500 to-rose-600",
      icon: <Shield className="w-6 h-6" />
    },
    2: {
      title: "Yield Strand",
      subtitle: "AAVE Protocol Polygon • 60% Allocation",
      apy: `${apyStrand2.toFixed(1)}% APY`,
      description: "AAVE Protocol lending with RRL yield boost and SBB mechanisms",
      features: [
        "AAVE Protocol Polygon lending (≈7-10% APY)",
        "Supply APY enhanced by RRL yield boost",
        "Provides bedrock for Subscription Backed Borrowing",
        "Core compounding engine of the system"
      ],
      color: "from-purple-500 to-indigo-600",
      icon: <DollarSign className="w-6 h-6" />
    },
    3: {
      title: "Momentum Strand",
      subtitle: "QuickSwap V3 LP • 30% Allocation",
      apy: `${apyStrand3.toFixed(1)}% APY`,
      description: "Concentrated liquidity farming on QuickSwap V3 wETH/USDC",
      features: [
        "QuickSwap V3 LP Farming wETH/USDC (≈12-15% APY)",
        "High-velocity fee generation engine",
        "Concentrated liquidity maximizes returns",
        "Highest APY from trading fees"
      ],
      color: "from-cyan-500 to-blue-600",
      icon: <Zap className="w-6 h-6" />
    },
    4: {
      title: "Bitcoin Strategy",
      subtitle: "wBTC Phase 2 • Future Allocation",
      apy: `${btcPrice.toLocaleString()}`,
      description: "Wrapped Bitcoin accumulation via weekly DCA for wealth preservation",
      features: [
        "Automatic pivot to wBTC accumulation in Phase 2",
        "Weekly Dollar Cost Averaging (DCA) purchases",
        "100% wBTC allocation by contract conclusion",
        "Preserves wealth in world's premier digital store of value"
      ],
      color: "from-orange-400 to-orange-600",
      icon: <Bitcoin className="w-6 h-6" />
    }
  };

  const StrandModal = ({ strand, onClose }) => {
    const data = strandData[strand];
    
    if (!data) return null;

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-up" role="dialog" aria-modal="true" aria-labelledby="strand-modal-title">
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
              {data.features.map((feature, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${data.color}`}></div>
                  <span className="text-gray-700">{feature}</span>
                </div>
              ))}
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
                {strand === 4 ? "Not active yet (Phase 2)" : 
                 parseFloat(selectedContract ? 
                   (strand === 1 ? selectedContract.strand1Balance || "0" : 
                    strand === 2 ? selectedContract.strand2Balance || "0" : 
                    selectedContract.strand3Balance || "0") :
                   (strand === 1 ? vaultStats.strand1Balance || "0" : 
                    strand === 2 ? vaultStats.strand2Balance || "0" : 
                    vaultStats.strand3Balance || "0")) > 0 ? 
                 (selectedContract ? "Contract strand balance" : "Active strand balance") : "No deposits yet"}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const HomePage = () => (
    <div className="relative z-10 px-6 py-10 pb-36 max-w-7xl mx-auto">
      {/* Hero Section - Spark.fi inspired */}
      <div className="text-center mb-16 animate-fade-up">
        {selectedContract && (
          <div className="inline-flex items-center space-x-3 px-5 py-2.5 glass-card mb-6">
            <div className="w-2 h-2 rounded-full bg-secondary animate-pulse"></div>
            <div className="text-xs font-semibold text-secondary tracking-widest uppercase">
              Active Contract
            </div>
          </div>
        )}
        
        {/* Giant stat display - Sky.money style */}
        <div className="text-7xl md:text-8xl font-black text-white mb-6 tracking-tight hero-stat">
          ${selectedContract 
            ? parseFloat(selectedContract.totalContractBalance || "0").toLocaleString()
            : parseFloat(vaultStats.totalDeposits || "0").toLocaleString()
          }
        </div>
        
        <div className="text-lg text-muted-foreground font-medium">
          {selectedContract ? (
            <div className="space-y-2">
              <div className="text-foreground">
                {selectedContract.lockupPeriod} {selectedContract.isChargedContract ? 'Month' : 'Year'} Contract 
                <span className="mx-2 text-muted-foreground/50">•</span> 
                <span className="text-secondary">{selectedContract.rigorLevel.charAt(0).toUpperCase() + selectedContract.rigorLevel.slice(1)} Rigor</span>
              </div>
              <div className="text-sm font-mono text-muted-foreground">
                {selectedContract.contractAddress.slice(0, 10)}...{selectedContract.contractAddress.slice(-8)}
              </div>
            </div>
          ) : (
            <span className="text-muted-foreground">
              {parseFloat(vaultStats.totalDeposits || "0") > 0 ? "Investment Active" : "Ready for Investment"}
            </span>
          )}
        </div>
      </div>

      {/* Contract Progress Bars - Premium style */}
      {walletConnected && deployedSubclubs.filter(club => 
        club.creator === walletAddress || (club.members && club.members.includes(walletAddress))
      ).length > 0 && (
        <div className="mb-16 animate-fade-up stagger-1">
          <div className="text-center mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-2">Contract Progress</h2>
            <p className="text-sm text-muted-foreground">Time remaining until lockup expires</p>
          </div>
          <div className="space-y-4 max-w-3xl mx-auto">
            {deployedSubclubs.filter(club => 
              club.creator === walletAddress || (club.members && club.members.includes(walletAddress))
            ).map((subclub) => {
              const startDate = new Date(subclub.createdAt);
              const endDate = new Date(startDate.getTime() + (subclub.lockupPeriod * 365 * 24 * 60 * 60 * 1000));
              const now = new Date();
              const totalDuration = endDate.getTime() - startDate.getTime();
              const elapsed = now.getTime() - startDate.getTime();
              const progress = Math.min(Math.max((elapsed / totalDuration) * 100, 0), 100);
              const timeRemaining = endDate.getTime() - now.getTime();
              const daysRemaining = Math.max(0, Math.ceil(timeRemaining / (1000 * 60 * 60 * 24)));
              const yearsRemaining = Math.floor(daysRemaining / 365);
              const remainingDays = daysRemaining % 365;

              return (
                <div 
                  key={subclub.id} 
                  className={`glass-card p-6 cursor-pointer border-l-4 ${getContractColor(subclub)} ${
                    selectedContract?.id === subclub.id 
                      ? 'ring-2 ring-secondary/50 shadow-glow-emerald' 
                      : ''
                  }`}
                  onClick={() => setSelectedContract(subclub)}
                  onDoubleClick={() => setSelectedContract(null)}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="font-semibold text-foreground text-lg">
                        {subclub.lockupPeriod} {subclub.isChargedContract ? 'Month' : 'Year'} Contract
                        <span className="ml-2 text-sm font-normal text-secondary">
                          {subclub.rigorLevel.charAt(0).toUpperCase() + subclub.rigorLevel.slice(1)}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground font-mono mt-1">
                        {subclub.contractAddress.slice(0, 10)}...{subclub.contractAddress.slice(-8)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-secondary">{progress.toFixed(1)}%</div>
                      <div className="text-xs text-muted-foreground">Complete</div>
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="progress-premium h-3 mb-4">
                    <div 
                      className={`bar ${
                        progress >= 100 
                          ? 'bg-gradient-to-r from-secondary via-secondary/80 to-secondary' 
                          : 'bg-gradient-to-r from-primary via-accent to-secondary'
                      }`}
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{startDate.toLocaleDateString()}</span>
                    <span className="text-secondary font-medium">
                      {progress >= 100 
                        ? 'Complete!' 
                        : yearsRemaining > 0 
                          ? `${yearsRemaining}y ${remainingDays}d left`
                          : `${remainingDays}d left`
                      }
                    </span>
                    <span className="text-muted-foreground">{endDate.toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Message when no contract selected */}
      {walletConnected && deployedSubclubs.filter(club => 
        club.creator === walletAddress || (club.members && club.members.includes(walletAddress))
      ).length > 0 && !selectedContract && (
        <div className="text-center mb-8">
          <div className="text-white font-medium">Select a contract above to access strand details</div>
          <div className="text-sm text-slate-300">Click on any progress bar to focus on that contract</div>
        </div>
      )}

      {/* DNA Strand Visualization - Premium redesign */}
      <div className="relative flex justify-center items-center gap-10 mb-16 animate-fade-up stagger-2">
        {/* Locked overlay when no contract selected */}
        {!selectedContract && walletConnected && deployedSubclubs.filter(club => 
          club.creator === walletAddress || (club.members && club.members.includes(walletAddress))
        ).length > 0 && (
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <div className="glass-card px-6 py-4 text-center animate-pulse-slow">
              <div className="text-sm font-medium text-foreground mb-1">Select a Contract Above</div>
              <div className="text-xs text-muted-foreground">Click on a contract progress bar to unlock</div>
            </div>
          </div>
        )}
        
        {/* Phase 1 - DNA Helix */}
        <div className={`relative transition-all duration-300 ${!selectedContract ? 'opacity-40 pointer-events-none blur-[1px]' : ''}`}>
          <div className="w-40 h-72 relative">
            {/* Enhanced DNA SVG */}
            <svg viewBox="0 0 100 200" className="w-full h-full" style={{ overflow: 'visible' }}>
              <path d="M20 0 Q50 25 20 50 Q-10 75 20 100 Q50 125 20 150 Q-10 175 20 200" 
                    className="dna-strand dna-strand-pink"
                    strokeWidth="5" fill="none"/>
              <path d="M80 0 Q50 25 80 50 Q110 75 80 100 Q50 125 80 150 Q110 175 80 200" 
                    className="dna-strand dna-strand-cyan"
                    strokeWidth="5" fill="none"/>
              {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
                <line key={i} x1="20" y1={i * 25} x2="80" y2={i * 25} 
                      className="stroke-border/50" strokeWidth="2"/>
              ))}
            </svg>
          </div>
          
          {/* Strand Buttons - Premium pills */}
          <div className="absolute inset-0 flex flex-col justify-around items-center py-4">
            <button 
              type="button"
              onClick={(e) => { e.preventDefault(); if (selectedContract) setActiveStrand(1); }}
              disabled={!selectedContract}
              className={`btn-strand text-white ${
                selectedContract 
                  ? 'bg-gradient-to-r from-pink-500 to-rose-600 glow-pink'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              }`}
            >
              Capital
            </button>
            <button 
              type="button"
              onClick={(e) => { e.preventDefault(); if (selectedContract) setActiveStrand(2); }}
              disabled={!selectedContract}
              className={`btn-strand text-white ${
                selectedContract 
                  ? 'bg-gradient-to-r from-primary to-indigo-600 glow-purple'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              }`}
            >
              Yield
            </button>
            <button 
              type="button"
              onClick={(e) => { e.preventDefault(); if (selectedContract) setActiveStrand(3); }}
              disabled={!selectedContract}
              className={`btn-strand text-white ${
                selectedContract 
                  ? 'bg-gradient-to-r from-accent to-blue-500 glow-cyan'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              }`}
            >
              Momentum
            </button>
          </div>
        </div>

        {/* Phase 2 - wBTC Card */}
        <button 
          type="button"
          onClick={(e) => { e.preventDefault(); if (selectedContract) setActiveStrand(4); }}
          disabled={!selectedContract}
          className={`glass-card-glow px-8 py-6 transition-all duration-400 ${
            selectedContract 
              ? 'hover:glow-orange cursor-pointer group'
              : 'opacity-40 cursor-not-allowed blur-[1px]'
          }`}
        >
          <div className="flex items-center space-x-4">
            <div className={`p-3 rounded-2xl transition-all duration-300 ${
              selectedContract 
                ? 'bg-gradient-to-br from-orange-400 to-orange-600 group-hover:scale-110' 
                : 'bg-muted'
            }`}>
              <Bitcoin className="w-8 h-8 text-white" />
            </div>
            <div className="text-left">
              <div className={`font-bold text-xl ${selectedContract ? 'text-foreground' : 'text-muted-foreground'}`}>wBTC</div>
              <div className={`text-sm ${selectedContract ? 'text-orange-400' : 'text-muted-foreground'}`}>Phase 2</div>
            </div>
          </div>
        </button>
      </div>
    </div>
  );

  const DatasetPage = () => (
    <div className="relative z-10 px-6 py-8 pb-32">
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
          <h2 className="text-xl font-semibold text-foreground mb-5 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse"></div>
            Live Market Data
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 bg-muted/40 rounded-2xl border border-border/40 hover:border-purple-400/30 transition-all duration-300">
              <div className="text-sm text-muted-foreground mb-2">AAVE USDC Lending</div>
              <div className="text-2xl font-bold text-purple-400 mb-3">{aaveRates.liquidityRate.toFixed(2)}%</div>
              <div className="h-12 bg-gradient-to-r from-purple-500/10 to-purple-500/5 rounded-lg p-2">
                <svg viewBox="0 0 200 40" className="w-full h-full">
                  <polyline points="10,25 30,28 50,24 70,26 90,23 110,25 130,22 150,24 170,21 190,23" fill="none" stroke="hsl(258 75% 65%)" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              </div>
            </div>
            
            <div className="p-5 bg-muted/40 rounded-2xl border border-border/40 hover:border-indigo-400/30 transition-all duration-300">
              <div className="text-sm text-muted-foreground mb-2">AAVE Lending Rate</div>
              <div className="text-2xl font-bold text-indigo-400 mb-3">8.00%</div>
              <div className="h-12 bg-gradient-to-r from-indigo-500/10 to-indigo-500/5 rounded-lg p-2">
                <svg viewBox="0 0 200 40" className="w-full h-full">
                  <polyline points="10,20 30,18 50,22 70,19 90,21 110,17 130,20 150,16 170,19 190,15" fill="none" stroke="hsl(240 65% 60%)" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              </div>
            </div>
            
            <div className="p-5 bg-muted/40 rounded-2xl border border-border/40 hover:border-accent/30 transition-all duration-300">
              <div className="text-sm text-muted-foreground mb-2">QuickSwap LP APY</div>
              <div className="text-2xl font-bold text-accent mb-3">{quickSwapAPY.toFixed(2)}%</div>
              <div className="h-12 bg-gradient-to-r from-cyan-500/10 to-cyan-500/5 rounded-lg p-2">
                <svg viewBox="0 0 200 40" className="w-full h-full">
                  <polyline points="10,30 30,25 50,28 70,22 90,26 110,20 130,24 150,18 170,22 190,16" fill="none" stroke="hsl(190 90% 55%)" strokeWidth="2.5" strokeLinecap="round"/>
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
                  <polyline points="10,30 30,20 50,25 70,15 90,20 110,10 130,15 150,25 170,15 190,20" fill="none" stroke="hsl(30 95% 58%)" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-card p-6 animate-fade-up stagger-3">
          <h2 className="text-xl font-semibold text-foreground mb-2">Protocol Access & Resources</h2>
          <div className="text-sm text-muted-foreground mb-5">Direct links to DeFi protocols powering The Vault Club</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <a href="https://app.spark.fi" target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-between p-4 bg-muted/40 rounded-xl border border-border/40 hover:border-primary/30 hover:bg-muted/60 transition-all duration-300 group">
              <div>
                <div className="font-semibold text-foreground group-hover:text-primary transition-colors">Spark Protocol</div>
                <div className="text-sm text-muted-foreground">Stablecoin Lending</div>
              </div>
              <ArrowLeft className="w-4 h-4 text-muted-foreground group-hover:text-primary rotate-[135deg] transition-all group-hover:translate-x-1 group-hover:-translate-y-1" />
            </a>

            <a href="https://app.aave.com/?marketName=proto_polygon_v3" target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-between p-4 bg-muted/40 rounded-xl border border-border/40 hover:border-accent/30 hover:bg-muted/60 transition-all duration-300 group">
              <div>
                <div className="font-semibold text-foreground group-hover:text-accent transition-colors">AAVE Polygon</div>
                <div className="text-sm text-muted-foreground">V3 Lending Market</div>
              </div>
              <ArrowLeft className="w-4 h-4 text-muted-foreground group-hover:text-accent rotate-[135deg] transition-all group-hover:translate-x-1 group-hover:-translate-y-1" />
            </a>

            <a href="https://quickswap.exchange/#/pools/v3" target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-between p-4 bg-muted/40 rounded-xl border border-border/40 hover:border-secondary/30 hover:bg-muted/60 transition-all duration-300 group">
              <div>
                <div className="font-semibold text-foreground group-hover:text-secondary transition-colors">QuickSwap V3</div>
                <div className="text-sm text-muted-foreground">Liquidity Pools</div>
              </div>
              <ArrowLeft className="w-4 h-4 text-muted-foreground group-hover:text-secondary rotate-[135deg] transition-all group-hover:translate-x-1 group-hover:-translate-y-1" />
            </a>

            <a href="https://defillama.com/yields?chain=Polygon&project=quickswap-dex" target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-between p-4 bg-muted/40 rounded-xl border border-border/40 hover:border-primary/30 hover:bg-muted/60 transition-all duration-300 group">
              <div>
                <div className="font-semibold text-foreground group-hover:text-primary transition-colors">DeFiLlama</div>
                <div className="text-sm text-muted-foreground">Live APY Data Source</div>
              </div>
              <ArrowLeft className="w-4 h-4 text-muted-foreground group-hover:text-primary rotate-[135deg] transition-all group-hover:translate-x-1 group-hover:-translate-y-1" />
            </a>

            <a href="https://www.coingecko.com/en/coins/bitcoin" target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-between p-4 bg-muted/40 rounded-xl border border-border/40 hover:border-orange-400/30 hover:bg-muted/60 transition-all duration-300 group">
              <div>
                <div className="font-semibold text-foreground group-hover:text-orange-400 transition-colors">CoinGecko</div>
                <div className="text-sm text-muted-foreground">Bitcoin Price Data</div>
              </div>
              <ArrowLeft className="w-4 h-4 text-muted-foreground group-hover:text-orange-400 rotate-[135deg] transition-all group-hover:translate-x-1 group-hover:-translate-y-1" />
            </a>

            <a href="https://polygon.technology" target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-between p-4 bg-muted/40 rounded-xl border border-border/40 hover:border-purple-400/30 hover:bg-muted/60 transition-all duration-300 group">
              <div>
                <div className="font-semibold text-foreground group-hover:text-purple-400 transition-colors">Polygon Network</div>
                <div className="text-sm text-muted-foreground">Layer 2 Infrastructure</div>
              </div>
              <ArrowLeft className="w-4 h-4 text-muted-foreground group-hover:text-purple-400 rotate-[135deg] transition-all group-hover:translate-x-1 group-hover:-translate-y-1" />
            </a>
          </div>
        </div>

        <div className="glass-card p-6 animate-fade-up stagger-4">
          <h2 className="text-xl font-semibold text-foreground mb-2">Educational Resources</h2>
          <div className="text-sm text-muted-foreground mb-5">Learn more about DeFi and cryptocurrency fundamentals</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <a href="https://www.coinbase.com/learn" target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-between p-4 bg-muted/40 rounded-xl border border-border/40 hover:border-primary/30 hover:bg-muted/60 transition-all duration-300 group">
              <div>
                <div className="font-semibold text-foreground group-hover:text-primary transition-colors">Coinbase Learn</div>
                <div className="text-sm text-muted-foreground">Crypto Education</div>
              </div>
              <ArrowLeft className="w-4 h-4 text-muted-foreground group-hover:text-primary rotate-[135deg] transition-all group-hover:translate-x-1 group-hover:-translate-y-1" />
            </a>

            <a href="https://docs.aave.com/hub/" target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-between p-4 bg-muted/40 rounded-xl border border-border/40 hover:border-accent/30 hover:bg-muted/60 transition-all duration-300 group">
              <div>
                <div className="font-semibold text-foreground group-hover:text-accent transition-colors">AAVE Documentation</div>
                <div className="text-sm text-muted-foreground">Protocol Deep Dive</div>
              </div>
              <ArrowLeft className="w-4 h-4 text-muted-foreground group-hover:text-accent rotate-[135deg] transition-all group-hover:translate-x-1 group-hover:-translate-y-1" />
            </a>

            <a href="https://www.investopedia.com/terms/c/compoundinterest.asp" target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-between p-4 bg-muted/40 rounded-xl border border-border/40 hover:border-secondary/30 hover:bg-muted/60 transition-all duration-300 group">
              <div>
                <div className="font-semibold text-foreground group-hover:text-secondary transition-colors">Compound Interest</div>
                <div className="text-sm text-muted-foreground">The Math Behind Growth</div>
              </div>
              <ArrowLeft className="w-4 h-4 text-muted-foreground group-hover:text-secondary rotate-[135deg] transition-all group-hover:translate-x-1 group-hover:-translate-y-1" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );

  const PersonalPage = () => (
    <div className="relative z-10 px-6 py-8 pb-32">
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
          {!walletConnected ? (
            <div className="text-center py-10">
              <div className="text-muted-foreground mb-5">No wallet connected</div>
              <button onClick={handleConnectWallet} className="btn-premium text-white">
                Connect Account
              </button>
            </div>
          ) : (
            <div className="text-center py-4">
              <div className="inline-flex items-center space-x-3 bg-secondary/15 text-secondary px-4 py-2.5 rounded-xl mb-4 border border-secondary/20">
                <div className="w-2.5 h-2.5 bg-secondary rounded-full animate-pulse"></div>
                <span className="font-medium">Connected: {walletAddress ? walletAddress.slice(0,6) + "..." + walletAddress.slice(-4) : "N/A"}</span>
              </div>
              <div className="text-sm text-muted-foreground mb-5">MetaMask • Polygon Network</div>
              
              <div className="flex flex-wrap justify-center gap-3 mt-6">
                <button onClick={handleDeposit} disabled={!canDeposit() || calculateWeeklyDepositAmount() === 0}
                  className={`px-5 py-3 rounded-xl font-medium transition-all duration-300 ${
                    !canDeposit() || calculateWeeklyDepositAmount() === 0
                      ? 'bg-muted text-muted-foreground cursor-not-allowed'
                      : 'bg-gradient-to-r from-secondary to-emerald-500 hover:shadow-lg hover:shadow-secondary/25 text-white hover:-translate-y-0.5'
                  }`}>
                  {calculateWeeklyDepositAmount() === 0 ? 'Join/Create a Contract' : !canDeposit() ? `Deposit in ${getDaysUntilNextDeposit()}d` : `Deposit ${calculateWeeklyDepositAmount()}`}
                </button>
                <button onClick={() => setAutoRenewEnabled(!autoRenewEnabled)}
                  className={`px-5 py-3 rounded-xl font-medium transition-all duration-300 ${
                    autoRenewEnabled ? 'bg-gradient-to-r from-primary to-indigo-500 text-white hover:shadow-lg hover:shadow-primary/25' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}>
                  Auto-Renew
                </button>
                <button onClick={() => { setWalletConnected(false); setWalletAddress(null); setVaultBalance("0"); }}
                  className="px-5 py-3 rounded-xl font-medium transition-all duration-300 bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20">
                  Remove Wallet
                </button>
              </div>
            </div>
          )}
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
                {parseFloat(vaultStats.totalDeposits || "0") > 0 && parseFloat(vaultBalance) > 0 
                  ? ((parseFloat(vaultBalance) / parseFloat(vaultStats.totalDeposits)) * 100).toFixed(1) : 0}%
              </div>
              <div className="text-sm text-muted-foreground">Ownership Share</div>
            </div>
            <div className="text-center p-5 rounded-2xl bg-muted/50 border border-border/50">
              <div className="text-3xl font-bold text-secondary tabular-nums mb-1">${parseFloat(vaultBalance).toFixed(2)}</div>
              <div className="text-sm text-muted-foreground">Current Value</div>
            </div>
          </div>
        </div>

        {walletConnected && (
          <div className="glass-card p-6 animate-fade-up stagger-3">
            <h2 className="text-xl font-semibold text-foreground mb-4">Recent Activity</h2>
            <div className="text-center py-8 text-muted-foreground">
              {(vaultStats.transactions || 0) > 0 
                ? `${vaultStats.transactions} transaction${vaultStats.transactions === 1 ? '' : 's'} recorded` 
                : "No transactions yet - make your first deposit to get started"}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const GroupInfoPage = () => (
    <div className="relative z-10 px-6 py-8 pb-32">
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
        <div className="glass-card p-6 animate-fade-up stagger-1">
          <h2 className="text-xl font-semibold text-foreground mb-5">Member Directory</h2>
          
          {walletConnected ? (
            <div className="space-y-6">
              {deployedSubclubs.filter(club => 
                club.creator === walletAddress || (club.members && club.members.includes(walletAddress))
              ).map((subclub) => (
                <div key={subclub.id} className={`p-4 bg-white/10 rounded-lg border-l-4 ${getContractColor(subclub)}`}>
                  <h3 className="font-semibold text-white mb-3">
                    {subclub.lockupPeriod} Year Lockup - {subclub.rigorLevel.charAt(0).toUpperCase() + subclub.rigorLevel.slice(1)} Rigor
                  </h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="p-3 bg-white/10 rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="font-semibold text-white">Me ({walletAddress?.slice(0,6)}...{walletAddress?.slice(-4)})</div>
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
                </div>
              ))}
              {deployedSubclubs.filter(club => 
                club.creator === walletAddress || (club.members && club.members.includes(walletAddress))
              ).length === 0 && (
                <div className="text-center py-8 text-slate-300">
                  <div className="font-medium">No contracts yet</div>
                  <div className="text-sm">Join a subclub to see member information</div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-300">
              Connect wallet to view member information
            </div>
          )}
        </div>

        <div className="glass-card p-6 animate-fade-up stagger-2">
          <h2 className="text-xl font-semibold text-foreground mb-5 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-secondary animate-pulse"></div>
            My Contracts
          </h2>
          
          {!walletConnected ? (
            <div className="text-center py-8 text-muted-foreground">
              <div className="text-muted-foreground mb-2">
                <Wallet className="w-8 h-8 mx-auto mb-2 opacity-50" />
              </div>
              <div className="font-medium">Connect wallet to view your contracts</div>
            </div>
          ) : deployedSubclubs.filter(club => 
            club.creator === walletAddress || (club.members && club.members.includes(walletAddress))
          ).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <div className="text-muted-foreground mb-2">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
              </div>
              <div className="font-medium">No contracts yet</div>
              <div className="text-sm">Create or join your first subclub below</div>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {deployedSubclubs.filter(club => 
                club.creator === walletAddress || (club.members && club.members.includes(walletAddress))
              ).map((subclub) => (
                <div key={subclub.id} className="p-4 bg-background/30 backdrop-blur-sm rounded-xl border border-border/20 hover:border-primary/30 transition-colors relative">
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
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        subclub.isPrivate 
                          ? 'bg-defi-purple/20 text-defi-purple' 
                          : 'bg-defi-emerald/20 text-defi-emerald'
                      }`}>
                        {subclub.isPrivate ? 'Private' : 'Public'}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        subclub.creator === walletAddress 
                          ? 'bg-primary/20 text-primary' 
                          : 'bg-defi-orange/20 text-defi-orange'
                      }`}>
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
                  <button 
                    onClick={() => {
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
                    }}
                    className="absolute bottom-3 right-3 p-1.5 bg-background/50 hover:bg-background/70 rounded-full transition-colors opacity-70 hover:opacity-100 border border-border/20"
                    title="Share contract link"
                  >
                    <Share2 className="w-3 h-3 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-card p-6 animate-fade-up stagger-3">
          <h2 className="text-xl font-semibold text-foreground mb-5 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse"></div>
            Club Directory
          </h2>
          
          {/* Create Club Section */}
          <div className="text-center py-6 border-b border-border/20 mb-6">
            <div className="mb-4">
              <div className="text-sm text-foreground/80 mb-2">
                {deployedSubclubs.length === 0 ? "No contracts have been created yet" : `${deployedSubclubs.length} contract${deployedSubclubs.length === 1 ? '' : 's'} deployed`}
              </div>
              <div className="text-xs text-muted-foreground">
                {deployedSubclubs.length === 0 ? "Be the first to deploy a contract" : "Create another contract or join existing ones"}
              </div>
            </div>
            <button 
              onClick={() => setActiveModal('createClub')}
              className="btn-premium"
            >
              Create New Contract
            </button>
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Available Contracts</h3>
              <div className="text-sm text-muted-foreground">{deployedSubclubs.filter(club => !club.isPrivate).length} public</div>
            </div>
            
            {deployedSubclubs.filter(club => !club.isPrivate).length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <div className="text-muted-foreground mb-2">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                </div>
                <div className="font-medium">No public contracts available</div>
                <div className="text-sm">Create a public contract or get invited to a private one</div>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {deployedSubclubs.filter(club => !club.isPrivate).map((subclub) => {
                  const isUserMember = walletConnected && subclub.members && subclub.members.includes(walletAddress);
                  const canJoin = !isUserMember && subclub.currentMembers < subclub.maxMembers;
                  const isFull = subclub.currentMembers >= subclub.maxMembers;
                  
                  return (
                    <div key={subclub.id} className="p-4 bg-background/30 backdrop-blur-sm rounded-xl border border-border/20 hover:border-primary/30 transition-colors">
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
                          {isUserMember ? (
                            <span className="text-xs px-3 py-1 rounded-full bg-primary/20 text-primary">
                              Member
                            </span>
                          ) : canJoin ? (
                            <button 
                              className="text-xs px-3 py-1 rounded-full transition-colors bg-defi-emerald hover:bg-defi-emerald/80 text-background font-medium"
                              onClick={() => {
                                // Join contract logic here
                                alert(`Joining contract ${subclub.contractAddress.slice(0,8)}...`);
                              }}
                            >
                              Join
                            </button>
                          ) : isFull ? (
                            <span className="text-xs px-3 py-1 rounded-full bg-muted text-muted-foreground">
                              Full
                            </span>
                          ) : (
                            <span className="text-xs px-3 py-1 rounded-full bg-muted text-muted-foreground">
                              Connect Wallet
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Rigor: <span className="font-medium text-foreground capitalize">{subclub.rigorLevel}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-2">
                        Created: {new Date(subclub.createdAt).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Concludes: {new Date(new Date(subclub.createdAt).getTime() + (subclub.lockupPeriod * 365 * 24 * 60 * 60 * 1000)).toLocaleDateString()}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );



  const FutureSimulationPage = () => {
    return (
      <div className="relative z-10 px-6 py-8 pb-32">
        <div className="flex items-center mb-8 animate-fade-up">
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
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Strand 1 APY (%) - Spark Protocol: {aaveRates.liquidityRate.toFixed(2)}%
                </label>
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={apyStrand1}
                  onChange={(e) => setApyStrand1(Number(e.target.value))}
                  className="w-full"
                />
                <div className="text-center text-slate-200 font-medium">{apyStrand1.toFixed(1)}%</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Strand 2 APY (%) - AAVE Polygon Lending
                </label>
                <input
                  type="range"
                  min="1"
                  max="25"
                  value={apyStrand2}
                  onChange={(e) => setApyStrand2(Number(e.target.value))}
                  className="w-full"
                />
                <div className="text-center text-slate-200 font-medium">{apyStrand2.toFixed(1)}%</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Strand 3 APY (%) - QuickSwap V3 LP: {quickSwapAPY.toFixed(2)}%
                </label>
                <input
                  type="range"
                  min="1"
                  max="30"
                  value={apyStrand3}
                  onChange={(e) => setApyStrand3(Number(e.target.value))}
                  className="w-full"
                />
                <div className="text-center text-slate-200 font-medium">{apyStrand3.toFixed(1)}%</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  wBTC Price ($) - Live: ${btcPrice.toLocaleString()}
                </label>
                <input
                  type="number"
                  min="10000"
                  max="500000"
                  step="1000"
                  value={btcPrice}
                  onChange={(e) => setBtcPrice(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white/50"
                  placeholder="Enter BTC price"
                />
                <div className="text-center text-slate-200 font-medium text-sm mt-1">${btcPrice.toLocaleString()}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Simulation Length</label>
                <select
                  value={simulationYears >= 1 ? simulationYears : 'months'}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === 'months') {
                      setSimulationYears(0.5); // 6 months
                    } else {
                      setSimulationYears(Number(value));
                    }
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white/50"
                >
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
                <div className="text-center text-slate-200 font-medium text-sm mt-1">
                  {simulationYears < 1 
                    ? `${Math.round(simulationYears * 12)} month${Math.round(simulationYears * 12) === 1 ? '' : 's'}`
                    : `${simulationYears} year${simulationYears === 1 ? '' : 's'}`
                  }
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Investment Rigor</label>
                <select
                  value={simulationRigor}
                  onChange={(e) => setSimulationRigor(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white/50"
                >
                  <option value="light">Light</option>
                  <option value="medium">Medium</option>
                  <option value="heavy">Heavy</option>
                  <option value="custom">Custom</option>
                </select>
                <div className="text-center text-slate-200 font-medium text-sm mt-1">
                  {simulationRigor === 'light' && '$100-250/month scaling'}
                  {simulationRigor === 'medium' && '$50-250/week scaling'}
                  {simulationRigor === 'heavy' && '$100-400/week scaling'}
                  {simulationRigor === 'custom' && `Fixed ${customSimulationAmount}/week`}
                </div>
                
                {/* Custom Amount Input */}
                {simulationRigor === 'custom' && (
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Weekly Deposit Amount ($)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="1000"
                      value={customSimulationAmount}
                      onChange={(e) => setCustomSimulationAmount(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white/50 text-sm"
                      placeholder="Enter weekly amount"
                    />
                    <div className="text-xs text-slate-300 mt-1">
                      Annual total: ${(customSimulationAmount * 52).toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Participants</label>
                <input
                  type="range"
                  min="1"
                  max="8"
                  value={vaultStats.totalMembers || 1}
                  onChange={(e) => setVaultStats(prev => ({...prev, totalMembers: Number(e.target.value)}))}
                  className="w-full"
                />
                <div className="text-center text-slate-200 font-medium">{vaultStats.totalMembers || 1} members</div>
              </div>
            </div>
          </div>

          {/* Interactive Growth Chart */}
          <div className="glass-card p-6 animate-fade-up stagger-2">
            <h2 className="text-xl font-semibold text-foreground mb-5 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-secondary animate-pulse"></div>
              Growth Visualization
            </h2>
            <div className="h-80 bg-background/30 backdrop-blur-sm rounded-xl p-4 border border-border/20">
              <div className="h-full relative">
                {/* Simple chart visualization */}
                <svg viewBox="0 0 800 300" className="w-full h-full">
                  {/* Grid lines */}
                  {[0, 1, 2, 3, 4, 5, 6].map(i => (
                    <line key={i} x1="0" y1={i * 42.86} x2="800" y2={i * 42.86} stroke="hsl(var(--border))" strokeWidth="1" opacity="0.3"/>
                  ))}
                  {/* Chart lines */}
                  {chartData.length > 1 && (
                    <>
                      {/* Initial Deposits Line (no compounding) */}
                      <polyline
                        points={chartData.map((point, index) => 
                          `${(index / (chartData.length - 1)) * 800},${300 - (point.initialDeposits / Math.max(...chartData.map(d => d.total))) * 280}`
                        ).join(' ')}
                        fill="none"
                        stroke="#64748b"
                        strokeWidth="2"
                        strokeDasharray="3,3"
                      />
                      
                      {/* Total Value Line */}
                      <polyline
                        points={chartData.map((point, index) => 
                          `${(index / (chartData.length - 1)) * 800},${300 - (point.total / Math.max(...chartData.map(d => d.total))) * 280}`
                        ).join(' ')}
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth="3"
                      />
                      
                      {/* wBTC Line */}
                      <polyline
                        points={chartData.map((point, index) => 
                          `${(index / (chartData.length - 1)) * 800},${300 - (point.wbtc / Math.max(...chartData.map(d => d.total))) * 280}`
                        ).join(' ')}
                        fill="none"
                        stroke="#f97316"
                        strokeWidth="3"
                      />
                      
                      {/* Strand 1 Line */}
                      <polyline
                        points={chartData.map((point, index) => 
                          `${(index / (chartData.length - 1)) * 800},${300 - (point.strand1 / Math.max(...chartData.map(d => d.total))) * 280}`
                        ).join(' ')}
                        fill="none"
                        stroke="#ec4899"
                        strokeWidth="2"
                        strokeDasharray="5,5"
                      />
                      
                      {/* Strand 2 Line */}
                      <polyline
                        points={chartData.map((point, index) => 
                          `${(index / (chartData.length - 1)) * 800},${300 - (point.strand2 / Math.max(...chartData.map(d => d.total))) * 280}`
                        ).join(' ')}
                        fill="none"
                        stroke="#8b5cf6"
                        strokeWidth="2"
                        strokeDasharray="5,5"
                      />
                      
                      {/* Strand 3 Line */}
                      <polyline
                        points={chartData.map((point, index) => 
                          `${(index / (chartData.length - 1)) * 800},${300 - (point.strand3 / Math.max(...chartData.map(d => d.total))) * 280}`
                        ).join(' ')}
                        fill="none"
                        stroke="#06b6d4"
                        strokeWidth="2"
                        strokeDasharray="5,5"
                      />
                    </>
                  )}
                  {/* Data points for total value */}
                  {chartData.map((point, index) => (
                    <circle
                      key={index}
                      cx={(index / (chartData.length - 1)) * 800}
                      cy={300 - (point.total / Math.max(...chartData.map(d => d.total))) * 280}
                      r="4"
                      fill="#3b82f6"
                    />
                  ))}
                </svg>
                
                {/* Y-axis labels */}
                <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-slate-300 -ml-16">
                  <span>${chartData.length > 0 ? (Math.max(...chartData.map(d => d.total)) / 1000000).toFixed(1) : 0}M</span>
                  <span>${chartData.length > 0 ? (Math.max(...chartData.map(d => d.total)) / 2000000).toFixed(1) : 0}M</span>
                  <span>$0</span>
                </div>
              </div>
            </div>
            
            {/* Chart Legend */}
            <div className="mt-4 flex flex-wrap justify-center gap-4 text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-0.5 bg-muted-foreground border-dashed border-t-2"></div>
                <span className="text-muted-foreground">Initial Deposits</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-0.5 bg-primary"></div>
                <span className="text-muted-foreground">Total Value</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-0.5 bg-defi-orange"></div>
                <span className="text-muted-foreground">wBTC Holdings</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-0.5 bg-defi-pink border-dashed border-t-2"></div>
                <span className="text-muted-foreground">Capital Strand</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-0.5 bg-defi-purple border-dashed border-t-2"></div>
                <span className="text-muted-foreground">Yield Strand</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-0.5 bg-defi-cyan border-dashed border-t-2"></div>
                <span className="text-muted-foreground">Momentum Strand</span>
              </div>
            </div>
            
            {/* Key metrics */}
            {chartData.length > 0 && (
              <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="text-center p-3 bg-background/30 backdrop-blur-sm rounded-xl border border-border/20 hover:border-primary/30 transition-colors">
                  <div className="text-lg font-bold text-foreground">
                    ${chartData.length > 0 && chartData[chartData.length - 1]?.total ? chartData[chartData.length - 1].total.toLocaleString() : '0'}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Value</div>
                </div>
                <div className="text-center p-3 bg-background/30 backdrop-blur-sm rounded-xl border border-border/20 hover:border-primary/30 transition-colors">
                  <div className="text-lg font-bold text-foreground">
                    ${chartData.length > 0 && chartData[chartData.length - 1]?.initialDeposits ? chartData[chartData.length - 1].initialDeposits.toLocaleString() : '0'}
                  </div>
                  <div className="text-sm text-muted-foreground">Initial Deposits</div>
                </div>
                <div className="text-center p-3 bg-background/30 backdrop-blur-sm rounded-xl border border-border/20 hover:border-primary/30 transition-colors">
                  <div className="text-lg font-bold text-foreground">
                    {chartData.length > 0 && chartData[chartData.length - 1]?.total && chartData[chartData.length - 1]?.initialDeposits ? 
                      ((chartData[chartData.length - 1].total / chartData[chartData.length - 1].initialDeposits - 1) * 100).toFixed(0) : 0}%
                  </div>
                  <div className="text-sm text-muted-foreground">ROI</div>
                </div>
                <div className="text-center p-3 bg-background/30 backdrop-blur-sm rounded-xl border border-border/20 hover:border-defi-orange/30 transition-colors">
                  <div className="text-lg font-bold text-defi-orange">
                    {chartData.length > 0 && chartData[chartData.length - 1]?.wbtc ? 
                      (chartData[chartData.length - 1].wbtc / btcPrice).toFixed(3) : 0}₿
                  </div>
                  <div className="text-sm text-muted-foreground">Final wBTC Holdings</div>
                </div>
                <div className="text-center p-3 bg-background/30 backdrop-blur-sm rounded-xl border border-border/20 hover:border-destructive/30 transition-colors">
                  <div className="text-lg font-bold text-destructive">
                    ${chartData.length > 0 && chartData[chartData.length - 1]?.cumulativeGasFees ? chartData[chartData.length - 1].cumulativeGasFees.toLocaleString() : '0'}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Gas Fees</div>
                </div>
                <div className="text-center p-3 bg-background/30 backdrop-blur-sm rounded-xl border border-border/20 hover:border-defi-purple/30 transition-colors">
                  <div className="text-lg font-bold text-defi-purple">
                    ${chartData.length > 0 && chartData[chartData.length - 1]?.cumulativeUtilityFees ? chartData[chartData.length - 1].cumulativeUtilityFees.toLocaleString() : '0'}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Utility Fees</div>
                </div>
              </div>
            )}
          </div>

          {/* Peak Strand Distribution */}
          <div className="glass-card p-6 animate-fade-up stagger-3">
            <h2 className="text-xl font-semibold text-foreground mb-5 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-accent animate-pulse"></div>
              Peak Strand Distribution
            </h2>
            <div className="text-sm text-muted-foreground mb-4">
              Maximum strand values during Phase 1 before Phase 2 transition to wBTC
            </div>
            {chartData.length > 0 && (
              <div className="space-y-4">
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
                    {chartData[chartData.length - 1]?.wbtc ? 
                      (chartData[chartData.length - 1].wbtc / btcPrice).toFixed(3) : 0}₿
                  </div>
                  <div className="text-muted-foreground text-sm">
                    Final Bitcoin holdings (${chartData[chartData.length - 1]?.wbtc?.toLocaleString() || 0})
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background relative overflow-x-hidden overflow-y-auto mesh-gradient">
      <VaultBackground />
      
      {/* Copied Banner */}
      {showCopiedBanner && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in-out">
          <div className="bg-green-500 text-white px-6 py-3 rounded-full shadow-lg flex items-center space-x-2">
            <span className="font-medium">Share link copied!</span>
          </div>
        </div>
      )}
      
      {/* Header */}
      <header className="relative z-20 glass-dark border-b border-border/30 px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-gradient-to-br from-primary to-secondary rounded-xl shadow-glow-purple animate-pulse-glow">
                <svg width="28" height="28" viewBox="0 0 100 100" className="flex-shrink-0">
                  {/* Vault safe outline */}
                  <rect x="5" y="15" width="90" height="75" rx="8" ry="8" fill="hsl(230 25% 15%)" stroke="hsl(230 25% 8%)" strokeWidth="2"/>
                  <rect x="10" y="20" width="80" height="65" rx="4" ry="4" fill="hsl(210 40% 96%)"/>
                  
                  {/* Vault door handle/wheel */}
                  <circle cx="30" cy="45" r="18" fill="hsl(230 25% 15%)"/>
                  <circle cx="30" cy="45" r="6" fill="none" stroke="hsl(45 90% 55%)" strokeWidth="3"/>
                  <line x1="18" y1="45" x2="42" y2="45" stroke="hsl(45 90% 55%)" strokeWidth="3"/>
                  <line x1="30" y1="33" x2="30" y2="57" stroke="hsl(45 90% 55%)" strokeWidth="3"/>
                  
                  {/* Keypad grid */}
                  {[0,1,2,3].map(row => 
                    [0,1,2].map(col => (
                      <rect 
                        key={`${row}-${col}`}
                        x={55 + col * 9} 
                        y={30 + row * 9} 
                        width="6" 
                        height="6" 
                        rx="1" 
                        fill="hsl(45 90% 55%)"
                      />
                    ))
                  )}
                  
                  {/* Vault hinges */}
                  <rect x="85" y="25" width="6" height="12" rx="1" fill="hsl(230 25% 15%)"/>
                  <rect x="88" y="27" width="2" height="8" fill="hsl(45 90% 55%)"/>
                  <rect x="85" y="63" width="6" height="12" rx="1" fill="hsl(230 25% 15%)"/>
                  <rect x="88" y="65" width="2" height="8" fill="hsl(45 90% 55%)"/>
                  
                  {/* Vault feet */}
                  <rect x="15" y="85" width="8" height="6" rx="2" fill="hsl(230 25% 15%)"/>
                  <rect x="77" y="85" width="8" height="6" rx="2" fill="hsl(230 25% 15%)"/>
                </svg>
              </div>
              <div>
                <div className="text-xl font-bold text-gradient-hero">
                  The Vault Club
                </div>
                <div className="text-xs text-secondary/80 font-medium tracking-wide">Investment Contracts into Digital Assets</div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Theme Toggle */}
            <ThemeToggle />
            
            {/* Sequence Theory Logo */}
            <a 
              href="https://sequencetheoryinc.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center glass px-4 py-2.5 rounded-xl hover:border-primary/40 hover:shadow-glow-purple transition-all duration-300 cursor-pointer group"
            >
              <div className="text-sm font-semibold">
                <span className="text-accent group-hover:text-accent/80 transition-colors">SEQUENCE</span>
                <span className="ml-1 text-primary group-hover:text-primary/80 transition-colors">THEORY</span>
              </div>
            </a>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 glass-dark border-t border-border/30 px-4 py-3 safe-area-pb" aria-label="Main navigation">
        <div className="flex justify-around items-center max-w-lg mx-auto">
          <button 
            onClick={() => navigateTo('home')}
            className="flex flex-col items-center transition-all duration-300 py-1.5 px-4 rounded-xl group"
          >
            <div className={`p-2.5 rounded-xl transition-all duration-300 ${
              currentPage === 'home' 
                ? 'bg-gradient-to-br from-primary to-secondary text-white shadow-glow-purple' 
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}>
              <Home className="w-5 h-5" />
            </div>
            <span className={`text-[11px] font-medium mt-1.5 transition-colors ${
              currentPage === 'home' 
                ? 'text-secondary' 
                : 'text-muted-foreground group-hover:text-foreground'
            }`}>Home</span>
          </button>
          
          <button 
            onClick={() => navigateTo('personal')}
            className="flex flex-col items-center transition-all duration-300 py-1.5 px-4 rounded-xl group"
          >
            <div className={`p-2.5 rounded-xl transition-all duration-300 ${
              currentPage === 'personal' 
                ? 'bg-gradient-to-br from-primary to-secondary text-white shadow-glow-purple' 
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}>
              <User className="w-5 h-5" />
            </div>
            <span className={`text-[11px] font-medium mt-1.5 transition-colors ${
              currentPage === 'personal' 
                ? 'text-secondary' 
                : 'text-muted-foreground group-hover:text-foreground'
            }`}>Wallet</span>
          </button>
          
          <button 
            onClick={() => navigateTo('group')}
            className="flex flex-col items-center transition-all duration-300 py-1.5 px-4 rounded-xl group"
          >
            <div className={`p-2.5 rounded-xl transition-all duration-300 ${
              currentPage === 'group' 
                ? 'bg-gradient-to-br from-primary to-secondary text-white shadow-glow-purple' 
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}>
              <Users className="w-5 h-5" />
            </div>
            <span className={`text-[11px] font-medium mt-1.5 transition-colors ${
              currentPage === 'group' 
                ? 'text-secondary' 
                : 'text-muted-foreground group-hover:text-foreground'
            }`}>Contracts</span>
          </button>
          
          <button 
            onClick={() => navigateTo('dataset')}
            className="flex flex-col items-center transition-all duration-300 py-1.5 px-4 rounded-xl group"
          >
            <div className={`p-2.5 rounded-xl transition-all duration-300 ${
              currentPage === 'dataset' 
                ? 'bg-gradient-to-br from-primary to-secondary text-white shadow-glow-purple' 
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}>
              <Database className="w-5 h-5" />
            </div>
            <span className={`text-[11px] font-medium mt-1.5 transition-colors ${
              currentPage === 'dataset' 
                ? 'text-secondary' 
                : 'text-muted-foreground group-hover:text-foreground'
            }`}>Data</span>
          </button>

          <button 
            onClick={() => navigateTo('simulation')}
            className="flex flex-col items-center transition-all duration-300 py-1.5 px-4 rounded-xl group"
          >
            <div className={`p-2.5 rounded-xl transition-all duration-300 ${
              currentPage === 'simulation' 
                ? 'bg-gradient-to-br from-primary to-secondary text-white shadow-glow-purple' 
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}>
              <TrendingUp className="w-5 h-5" />
            </div>
            <span className={`text-[11px] font-medium mt-1.5 transition-colors ${
              currentPage === 'simulation' 
                ? 'text-secondary' 
                : 'text-muted-foreground group-hover:text-foreground'
            }`}>Future</span>
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative">
        {currentPage === 'home' && <HomePage />}
        {currentPage === 'dataset' && <DatasetPage />}
        {currentPage === 'personal' && <PersonalPage />}
        {currentPage === 'group' && <GroupInfoPage />}
        {currentPage === 'simulation' && <FutureSimulationPage />}
      </main>

      {/* Strand Modal */}
      {activeStrand && (
        <StrandModal strand={activeStrand} onClose={closeModal} />
      )}

      {/* Create Club Modal */}
      {activeModal === 'createClub' && <CreateClubModal />}
      
      {/* Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-up" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl ring-1 ring-black/5">
            <div className="bg-gradient-to-r from-purple-500 to-indigo-600 p-6 rounded-t-2xl text-white">
              <div className="flex justify-between items-start">
                <div>
                  <h3 id="auth-modal-title" className="text-xl font-bold">{authMode === 'login' ? 'Log In' : 'Sign Up'}</h3>
                  <p className="text-white/80">Access The Vault Club.</p>
                  <p className="text-white/60 text-sm">(Sequence Theory, Inc. Credentials)</p>
                </div>
                <button onClick={() => setShowAuthModal(false)} className="text-white/80 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10" aria-label="Close modal">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-black"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-black"
                />
              </div>
              
              {authMode === 'signup' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={authConfirmPassword}
                    onChange={(e) => setAuthConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-black"
                  />
                </div>
              )}
              
              {authError && (
                <div className="p-3 bg-red-100 border border-red-300 rounded-lg text-red-700 text-sm">
                  {authError}
                </div>
              )}
              
              {authSuccess && (
                <div className="p-3 bg-green-100 border border-green-300 rounded-lg text-green-700 text-sm">
                  {authSuccess}
                </div>
              )}
              
              <button
                onClick={handleAuthSubmit}
                disabled={authLoading}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white py-3 rounded-lg font-medium transition-all duration-300 shadow-md hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {authLoading ? 'Please wait...' : (authMode === 'login' ? 'Log In' : 'Create Account')}
              </button>
              
              <div className="text-center">
                <button
                  onClick={() => {
                    setAuthMode(authMode === 'login' ? 'signup' : 'login');
                    setAuthEmail('');
                    setAuthPassword('');
                    setAuthConfirmPassword('');
                    setAuthError('');
                    setAuthSuccess('');
                  }}
                  className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                >
                  {authMode === 'login' 
                    ? "Don't have an account? Sign Up" 
                    : "Already have an account? Log In"
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VaultClubWebsite;