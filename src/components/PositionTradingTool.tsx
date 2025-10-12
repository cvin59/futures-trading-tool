import { useState, useMemo, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  Target, 
  PieChart,
  BarChart3,
  Bell,
  Zap,
  Settings,
  Cloud,
  CloudOff,
  LogOut,
  User
} from 'lucide-react';
import type { 
  PositionTradingData, 
  TradeLog, 
  Asset, 
  TakeProfitLevel, 
  DCALevel, 
  Alert,
  PortfolioMetrics 
} from '../types/positionTrading';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  savePositionTradingToFirestore, 
  loadPositionTradingFromFirestore, 
  subscribeToPositionTradingFirestore,
  signIn, 
  signUp, 
  signOut, 
  auth,
  getCurrentUser,
  type PositionTradingFirestoreData 
} from '../lib/firebase';
import { AuthModal } from './AuthModal';
import type { AuthMode, AuthForm } from '../types/trading';

// Import tab components
import DashboardTab from './positionTrading/DashboardTab';
import TradeLogTab from './positionTrading/TradeLogTab';
import PortfolioTab from './positionTrading/PortfolioTab';
import TakeProfitTab from './positionTrading/TakeProfitTab';
import SmartDCATab from './positionTrading/SmartDCATab';
import DCAAnalysisTab from './positionTrading/DCAAnalysisTab';
import CapitalManagementTab from './positionTrading/CapitalManagementTab';

// Trading Rules Configuration
const TRADING_RULES = {
  takeProfitRules: {
    tp1: { percent: 50, sellPercent: 20 },
    tp2: { percent: 100, sellPercent: 20 },
    tp3: { percent: 200, sellPercent: 20 },
    tp4: { percent: 300, sellPercent: 20 },
    hold: { percent: 20 }
  },
  dcaRules: {
    dca1: { percent: -10, capitalPercent: 15 },
    dca2: { percent: -20, capitalPercent: 20 },
    dca3: { percent: -30, capitalPercent: 25 },
    dca4: { percent: -40, capitalPercent: 40 }
  },
  alertRules: {
    rebalanceThreshold: 40,
    highGainThresholds: [50, 100, 200],
    highLossThreshold: 20,
    rsiOversold: 30,
    rsiOverbought: 70
  }
};

export default function PositionTradingTool() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'tradelog' | 'portfolio' | 'takeprofit' | 'smartdca' | 'dcaanalysis' | 'capital' | 'alerts' | 'performance'>('dashboard');
  
  // Firebase Auth States
  const [user, setUser] = useState(getCurrentUser());
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [authForm, setAuthForm] = useState<AuthForm>({ email: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'connected' | 'disconnected' | 'syncing'>('disconnected');
  
  // Initialize state from localStorage
  const [data, setData] = useState<PositionTradingData>(() => {
    if (typeof window === 'undefined') return getInitialData();
    try {
      const stored = localStorage.getItem('position-trading-data');
      return stored ? JSON.parse(stored) : getInitialData();
    } catch (error) {
      console.error('Error loading position trading data:', error);
      return getInitialData();
    }
  });

  // Debounced localStorage save to prevent conflicts
  const [saveTimeoutId, setSaveTimeoutId] = useState<number | null>(null);

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('🔐 Auth state changed:', user?.uid || 'No user');
      setUser(user);
      if (user) {
        setCloudSyncStatus('connected');
        setShowAuthModal(false);
        setAuthError('');
        // Load data from Firestore when user logs in
        loadDataFromFirestore();
      } else {
        setCloudSyncStatus('disconnected');
      }
    });

    return () => unsubscribe();
  }, []);

  // Cloud sync subscription
  useEffect(() => {
    if (!user) return;

    console.log('👂 Setting up Firestore subscription for position trading...');
    const unsubscribe = subscribeToPositionTradingFirestore((firestoreData) => {
      if (firestoreData) {
        console.log('📡 Received position trading data from Firestore');
        setData({
          tradeLogs: firestoreData.tradeLogs || [],
          assets: firestoreData.assets || [],
          takeProfitLevels: firestoreData.takeProfitLevels || [],
          dcaLevels: firestoreData.dcaLevels || [],
          portfolioMetrics: firestoreData.portfolioMetrics || getInitialData().portfolioMetrics,
          alerts: firestoreData.alerts || [],
          initialCapital: firestoreData.initialCapital || 10000,
          availableCash: firestoreData.availableCash || 10000
        });
      }
    });

    return () => {
      console.log('🛑 Cleaning up Firestore subscription');
      unsubscribe();
    };
  }, [user]);

  // Save to localStorage with debouncing to prevent conflicts during batch updates
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Clear existing timeout
    if (saveTimeoutId) {
      clearTimeout(saveTimeoutId);
    }

    // Set new timeout for saving
    const timeoutId = setTimeout(() => {
      console.log('💾 Saving to localStorage after debounce...');
      localStorage.setItem('position-trading-data', JSON.stringify(data));
      console.log('✅ localStorage save completed');
      
      // Also save to Firestore if user is logged in
      if (user) {
        saveDataToFirestore();
      }
    }, 500); // 500ms debounce

    setSaveTimeoutId(timeoutId);

    // Cleanup
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [data, user]);

  // Form states
  const [showAddTrade, setShowAddTrade] = useState(false);
  const [newTrade, setNewTrade] = useState<Partial<TradeLog>>({
    ticker: '',
    action: 'BUY',
    price: 0,
    quantity: 0,
    fees: 0,
    notes: ''
  });

  // Calculate portfolio metrics
  const portfolioMetrics = useMemo(() => {
    const totalCurrentValue = data.assets.reduce((sum, asset) => sum + asset.currentValue, 0);
    const totalInvested = data.assets.reduce((sum, asset) => sum + asset.totalInvested, 0);
    const totalPnL = data.assets.reduce((sum, asset) => sum + asset.unrealizedPnL, 0);
    const totalPnLPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;
    
    const completedTrades = data.tradeLogs.filter(trade => trade.action === 'SELL');
    const profitableTrades = completedTrades.filter(trade => trade.totalValue > 0);
    const winRate = completedTrades.length > 0 ? (profitableTrades.length / completedTrades.length) * 100 : 0;

    return {
      totalInitialCapital: data.initialCapital,
      totalCurrentValue,
      totalPnL,
      totalPnLPercent,
      availableCash: data.availableCash,
      totalInvested,
      winRate,
      averageGain: 0, // Would need more complex calculation
      averageLoss: 0,
      bestTrade: 0,
      worstTrade: 0,
      totalTrades: data.tradeLogs.length,
      sharpeRatio: undefined
    } as PortfolioMetrics;
  }, [data]);

  // Generate alerts
  const alerts = useMemo(() => {
    const newAlerts: Alert[] = [];
    
    data.assets.forEach(asset => {
      // High gain alerts
      TRADING_RULES.alertRules.highGainThresholds.forEach(threshold => {
        if (asset.unrealizedPnLPercent >= threshold) {
          newAlerts.push({
            id: `gain-${asset.id}-${threshold}`,
            type: 'HIGH_GAIN',
            message: `${asset.ticker} đã tăng ${threshold}%! Cân nhắc chốt lời.`,
            ticker: asset.ticker,
            timestamp: Date.now(),
            isRead: false,
            severity: 'MEDIUM'
          });
        }
      });

      // High loss alert
      if (asset.unrealizedPnLPercent <= -TRADING_RULES.alertRules.highLossThreshold) {
        newAlerts.push({
          id: `loss-${asset.id}`,
          type: 'HIGH_LOSS',
          message: `${asset.ticker} đang lỗ ${Math.abs(asset.unrealizedPnLPercent).toFixed(1)}%! Cần review chiến lược.`,
          ticker: asset.ticker,
          timestamp: Date.now(),
          isRead: false,
          severity: 'HIGH'
        });
      }

      // Rebalance alert
      if (asset.portfolioWeight > TRADING_RULES.alertRules.rebalanceThreshold) {
        newAlerts.push({
          id: `rebalance-${asset.id}`,
          type: 'REBALANCE_NEEDED',
          message: `${asset.ticker} chiếm ${asset.portfolioWeight.toFixed(1)}% portfolio. Cần rebalance!`,
          ticker: asset.ticker,
          timestamp: Date.now(),
          isRead: false,
          severity: 'MEDIUM'
        });
      }

      // TP level alerts
      data.takeProfitLevels.filter(tp => tp.assetId === asset.id && tp.status === 'PENDING').forEach(tp => {
        if (asset.currentMarketPrice >= tp.targetPrice) {
          newAlerts.push({
            id: `tp-${tp.id}`,
            type: 'TP_REACHED',
            message: `${asset.ticker} đã đạt ${tp.level} tại ${tp.targetPrice}! Chốt ${tp.sellPercentage}%.`,
            ticker: asset.ticker,
            level: tp.level,
            timestamp: Date.now(),
            isRead: false,
            severity: 'HIGH'
          });
        }
      });

      // DCA alerts
      data.dcaLevels.filter(dca => dca.assetId === asset.id && dca.status === 'WAITING').forEach(dca => {
        if (asset.currentMarketPrice <= dca.triggerPrice) {
          newAlerts.push({
            id: `dca-${dca.id}`,
            type: 'DCA_ZONE',
            message: `${asset.ticker} đã về vùng ${dca.level} tại ${dca.triggerPrice}! Cân nhắc DCA.`,
            ticker: asset.ticker,
            level: dca.level,
            timestamp: Date.now(),
            isRead: false,
            severity: 'MEDIUM'
          });
        }
      });
    });

    return newAlerts;
  }, [data]);

  function getInitialData(): PositionTradingData {
    return {
      tradeLogs: [],
      assets: [],
      takeProfitLevels: [],
      dcaLevels: [],
      portfolioMetrics: {
        totalInitialCapital: 10000,
        totalCurrentValue: 0,
        totalPnL: 0,
        totalPnLPercent: 0,
        availableCash: 10000,
        totalInvested: 0,
        winRate: 0,
        averageGain: 0,
        averageLoss: 0,
        bestTrade: 0,
        worstTrade: 0,
        totalTrades: 0
      },
      alerts: [],
      initialCapital: 10000,
      availableCash: 10000
    };
  }

  const saveDataToFirestore = async () => {
    if (!user) return;

    setCloudSyncStatus('syncing');
    console.log('☁️ Saving position trading data to Firestore...');
    
    const firestoreData: PositionTradingFirestoreData = {
      tradeLogs: data.tradeLogs,
      assets: data.assets,
      takeProfitLevels: data.takeProfitLevels,
      dcaLevels: data.dcaLevels,
      portfolioMetrics: data.portfolioMetrics,
      alerts: data.alerts,
      initialCapital: data.initialCapital,
      availableCash: data.availableCash,
      lastUpdated: Date.now()
    };

    const success = await savePositionTradingToFirestore(firestoreData);
    if (success) {
      console.log('✅ Position trading data saved to Firestore');
      setCloudSyncStatus('connected');
    } else {
      console.error('❌ Failed to save position trading data to Firestore');
      setCloudSyncStatus('disconnected');
    }
  };

  const loadDataFromFirestore = async () => {
    if (!user) return;

    console.log('📥 Loading position trading data from Firestore...');
    const firestoreData = await loadPositionTradingFromFirestore();
    
    if (firestoreData) {
      console.log('✅ Position trading data loaded from Firestore');
      setData({
        tradeLogs: firestoreData.tradeLogs || [],
        assets: firestoreData.assets || [],
        takeProfitLevels: firestoreData.takeProfitLevels || [],
        dcaLevels: firestoreData.dcaLevels || [],
        portfolioMetrics: firestoreData.portfolioMetrics || getInitialData().portfolioMetrics,
        alerts: firestoreData.alerts || [],
        initialCapital: firestoreData.initialCapital || 10000,
        availableCash: firestoreData.availableCash || 10000
      });
    }
  };

  // Auth functions
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');

    try {
      let result;
      if (authMode === 'login') {
        result = await signIn(authForm.email, authForm.password);
      } else {
        result = await signUp(authForm.email, authForm.password);
      }

      if (result.success) {
        setShowAuthModal(false);
        setAuthForm({ email: '', password: '' });
      } else {
        setAuthError(result.error || 'Authentication failed');
      }
    } catch (error) {
      setAuthError('An unexpected error occurred');
      console.error('Auth error:', error);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    console.log('👋 Signing out...');
    const result = await signOut();
    if (result.success) {
      console.log('✅ Signed out successfully');
      // Clear local data on logout
      setData(getInitialData());
      localStorage.removeItem('position-trading-data');
    }
  };

  const addTrade = () => {
    if (!newTrade.ticker || !newTrade.price || !newTrade.quantity) return;

    const trade: TradeLog = {
      id: Date.now().toString(),
      date: new Date().toISOString().split('T')[0],
      ticker: newTrade.ticker!.toUpperCase(),
      action: newTrade.action as 'BUY' | 'SELL' | 'DCA',
      price: newTrade.price!,
      quantity: newTrade.quantity!,
      totalValue: newTrade.price! * newTrade.quantity!,
      fees: newTrade.fees || 0,
      notes: newTrade.notes || '',
      timestamp: Date.now()
    };

    // Check if user has enough cash for BUY/DCA trades
    if ((trade.action === 'BUY' || trade.action === 'DCA') && data.availableCash < (trade.totalValue + trade.fees)) {
      alert(`Không đủ tiền mặt! Cần: $${(trade.totalValue + trade.fees).toLocaleString()}, Có: $${data.availableCash.toLocaleString()}`);
      return;
    }

    // Update both trade logs and assets in a single state update
    setData(prev => {
      const newData = updateAssetFromTradeData(prev, trade);
      
      // Update available cash based on trade action
      let newAvailableCash = prev.availableCash;
      if (trade.action === 'BUY' || trade.action === 'DCA') {
        newAvailableCash -= (trade.totalValue + trade.fees);
      } else if (trade.action === 'SELL') {
        newAvailableCash += (trade.totalValue - trade.fees);
      }

      return {
        ...newData,
        tradeLogs: [...prev.tradeLogs, trade],
        availableCash: Math.max(0, newAvailableCash)
      };
    });

    // Reset form
    setNewTrade({
      ticker: '',
      action: 'BUY',
      price: 0,
      quantity: 0,
      fees: 0,
      notes: ''
    });
    setShowAddTrade(false);
  };

  const updateAssetFromTradeData = (prevData: PositionTradingData, trade: TradeLog): PositionTradingData => {
    const existingAssetIndex = prevData.assets.findIndex(asset => asset.ticker === trade.ticker);
    const updatedAssets = [...prevData.assets];
    let newTakeProfitLevels = [...prevData.takeProfitLevels];
    let newDCALevels = [...prevData.dcaLevels];

    if (existingAssetIndex >= 0) {
      // Update existing asset
      const asset = { ...updatedAssets[existingAssetIndex] };
      
      if (trade.action === 'BUY' || trade.action === 'DCA') {
        const totalValue = asset.averageBuyPrice * asset.currentQuantity + trade.totalValue;
        const totalQuantity = asset.currentQuantity + trade.quantity;
        asset.averageBuyPrice = totalValue / totalQuantity;
        asset.currentQuantity = totalQuantity;
        asset.totalInvested += trade.totalValue + trade.fees;
      } else if (trade.action === 'SELL') {
        asset.currentQuantity -= trade.quantity;
        if (asset.currentQuantity <= 0) {
          // Remove asset if fully sold
          updatedAssets.splice(existingAssetIndex, 1);
          // Also remove related TP and DCA levels
          newTakeProfitLevels = newTakeProfitLevels.filter(tp => tp.assetId !== asset.id);
          newDCALevels = newDCALevels.filter(dca => dca.assetId !== asset.id);
          
          // Recalculate portfolio weights
          const totalValue = updatedAssets.reduce((sum, a) => sum + a.currentValue, 0);
          updatedAssets.forEach(a => {
            a.portfolioWeight = totalValue > 0 ? (a.currentValue / totalValue) * 100 : 0;
          });

          return { 
            ...prevData, 
            assets: updatedAssets,
            takeProfitLevels: newTakeProfitLevels,
            dcaLevels: newDCALevels
          };
        }
      }

      // Recalculate metrics
      asset.currentValue = asset.currentQuantity * asset.currentMarketPrice;
      asset.unrealizedPnL = asset.currentValue - (asset.averageBuyPrice * asset.currentQuantity);
      asset.unrealizedPnLPercent = ((asset.currentMarketPrice - asset.averageBuyPrice) / asset.averageBuyPrice) * 100;
      asset.status = asset.unrealizedPnL > 0 ? 'PROFIT' : asset.unrealizedPnL < 0 ? 'LOSS' : 'BREAKEVEN';
      asset.lastUpdated = Date.now();

      updatedAssets[existingAssetIndex] = asset;
    } else if (trade.action === 'BUY') {
      // Create new asset
      const newAsset: Asset = {
        id: Date.now().toString(),
        ticker: trade.ticker,
        averageBuyPrice: trade.price,
        currentQuantity: trade.quantity,
        currentMarketPrice: trade.price,
        currentValue: trade.totalValue,
        unrealizedPnL: 0,
        unrealizedPnLPercent: 0,
        portfolioWeight: 0,
        status: 'BREAKEVEN',
        totalInvested: trade.totalValue + trade.fees,
        lastUpdated: Date.now()
      };
      updatedAssets.push(newAsset);
      
      // Auto-generate TP and DCA levels
      newTakeProfitLevels = [...newTakeProfitLevels, ...generateTPLevelsData(newAsset)];
      newDCALevels = [...newDCALevels, ...generateDCALevelsData(newAsset, prevData.availableCash)];
    }

    // Recalculate portfolio weights
    const totalValue = updatedAssets.reduce((sum, asset) => sum + asset.currentValue, 0);
    updatedAssets.forEach(asset => {
      asset.portfolioWeight = totalValue > 0 ? (asset.currentValue / totalValue) * 100 : 0;
    });

    return { 
      ...prevData, 
      assets: updatedAssets,
      takeProfitLevels: newTakeProfitLevels,
      dcaLevels: newDCALevels
    };
  };

  const generateTPLevelsData = (asset: Asset): TakeProfitLevel[] => {
    return [
      {
        id: `tp1-${asset.id}`,
        assetId: asset.id,
        ticker: asset.ticker,
        level: 'TP1',
        targetPrice: asset.averageBuyPrice * 1.5,
        sellPercentage: 20,
        quantityToSell: asset.currentQuantity * 0.2,
        expectedValue: asset.averageBuyPrice * 1.5 * asset.currentQuantity * 0.2,
        status: 'PENDING',
        isChecked: false,
        priceIncrease: 50
      },
      {
        id: `tp2-${asset.id}`,
        assetId: asset.id,
        ticker: asset.ticker,
        level: 'TP2',
        targetPrice: asset.averageBuyPrice * 2,
        sellPercentage: 20,
        quantityToSell: asset.currentQuantity * 0.2,
        expectedValue: asset.averageBuyPrice * 2 * asset.currentQuantity * 0.2,
        status: 'PENDING',
        isChecked: false,
        priceIncrease: 100
      },
      {
        id: `tp3-${asset.id}`,
        assetId: asset.id,
        ticker: asset.ticker,
        level: 'TP3',
        targetPrice: asset.averageBuyPrice * 3,
        sellPercentage: 20,
        quantityToSell: asset.currentQuantity * 0.2,
        expectedValue: asset.averageBuyPrice * 3 * asset.currentQuantity * 0.2,
        status: 'PENDING',
        isChecked: false,
        priceIncrease: 200
      },
      {
        id: `tp4-${asset.id}`,
        assetId: asset.id,
        ticker: asset.ticker,
        level: 'TP4',
        targetPrice: asset.averageBuyPrice * 4,
        sellPercentage: 20,
        quantityToSell: asset.currentQuantity * 0.2,
        expectedValue: asset.averageBuyPrice * 4 * asset.currentQuantity * 0.2,
        status: 'PENDING',
        isChecked: false,
        priceIncrease: 300
      }
    ];
  };

  const generateDCALevelsData = (asset: Asset, availableCash: number): DCALevel[] => {
    return [
      {
        id: `dca1-${asset.id}`,
        assetId: asset.id,
        ticker: asset.ticker,
        level: 'DCA1',
        triggerPrice: asset.averageBuyPrice * 0.9,
        priceDecrease: 10,
        dcaAmount: availableCash * 0.15,
        quantityToBuy: (availableCash * 0.15) / (asset.averageBuyPrice * 0.9),
        status: 'WAITING',
        capitalAllocation: 15
      },
      {
        id: `dca2-${asset.id}`,
        assetId: asset.id,
        ticker: asset.ticker,
        level: 'DCA2',
        triggerPrice: asset.averageBuyPrice * 0.8,
        priceDecrease: 20,
        dcaAmount: availableCash * 0.2,
        quantityToBuy: (availableCash * 0.2) / (asset.averageBuyPrice * 0.8),
        status: 'WAITING',
        capitalAllocation: 20
      },
      {
        id: `dca3-${asset.id}`,
        assetId: asset.id,
        ticker: asset.ticker,
        level: 'DCA3',
        triggerPrice: asset.averageBuyPrice * 0.7,
        priceDecrease: 30,
        dcaAmount: availableCash * 0.25,
        quantityToBuy: (availableCash * 0.25) / (asset.averageBuyPrice * 0.7),
        status: 'WAITING',
        capitalAllocation: 25
      },
      {
        id: `dca4-${asset.id}`,
        assetId: asset.id,
        ticker: asset.ticker,
        level: 'DCA4',
        triggerPrice: asset.averageBuyPrice * 0.6,
        priceDecrease: 40,
        dcaAmount: availableCash * 0.4,
        quantityToBuy: (availableCash * 0.4) / (asset.averageBuyPrice * 0.6),
        status: 'WAITING',
        capitalAllocation: 40
      }
    ];
  };

  return (
    <div className="bg-gray-900 text-gray-100 min-h-screen">
      <div className="max-w-[1600px] mx-auto space-y-4 sm:space-y-6 px-4 lg:px-6 xl:px-8 py-4 lg:py-6">
        
        {/* Header */}
        <div className="flex justify-between items-start py-4">
          <div className="text-center flex-1 space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
              Position Trading Manager
            </h1>
            <p className="text-gray-400">Long-term Investment • DCA Strategy • Take Profit Planning</p>
          </div>
          
          {/* Cloud Sync Status */}
          <div className="flex items-center gap-3">
            {/* Cloud Status Indicator */}
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
              cloudSyncStatus === 'connected' ? 'border-green-500/30 bg-green-900/20' :
              cloudSyncStatus === 'syncing' ? 'border-yellow-500/30 bg-yellow-900/20' :
              'border-gray-500/30 bg-gray-800'
            }`}>
              {cloudSyncStatus === 'connected' ? (
                <>
                  <Cloud size={16} className="text-green-400" />
                  <span className="text-green-400 text-sm">Synced</span>
                </>
              ) : cloudSyncStatus === 'syncing' ? (
                <>
                  <Cloud size={16} className="text-yellow-400 animate-pulse" />
                  <span className="text-yellow-400 text-sm">Syncing...</span>
                </>
              ) : (
                <>
                  <CloudOff size={16} className="text-gray-400" />
                  <span className="text-gray-400 text-sm">Local</span>
                </>
              )}
            </div>

            {/* User Auth */}
            {user ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-2 bg-purple-900/20 border border-purple-500/30 rounded-lg">
                  <User size={16} className="text-purple-400" />
                  <span className="text-purple-400 text-sm">
                    {user.email?.split('@')[0] || 'User'}
                  </span>
                </div>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-2 px-3 py-2 bg-red-900/20 border border-red-500/30 rounded-lg hover:bg-red-900/30 transition-colors"
                >
                  <LogOut size={16} className="text-red-400" />
                  <span className="text-red-400 text-sm">Sign Out</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                <Cloud size={16} />
                <span className="text-sm">Sign In to Sync</span>
              </button>
            )}
          </div>
        </div>

        {/* Alert Bar */}
        {alerts.length > 0 && (
          <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Bell size={16} className="text-yellow-400" />
              <span className="text-yellow-400 font-semibold">Alerts ({alerts.length})</span>
            </div>
            <div className="space-y-1">
              {alerts.slice(0, 3).map(alert => (
                <div key={alert.id} className="text-sm text-yellow-300">
                  • {alert.message}
                </div>
              ))}
              {alerts.length > 3 && (
                <div className="text-xs text-yellow-400">
                  +{alerts.length - 3} more alerts...
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="border-b border-gray-700">
          <div className="flex flex-wrap gap-4">
            {[
              { key: 'dashboard', label: 'Dashboard', icon: PieChart },
              { key: 'tradelog', label: 'Trade Log', icon: BarChart3 },
              { key: 'portfolio', label: 'Portfolio', icon: TrendingUp },
              { key: 'takeprofit', label: 'Take Profit', icon: Target },
              { key: 'smartdca', label: 'Smart DCA', icon: Zap },
              { key: 'dcaanalysis', label: 'DCA Analysis', icon: TrendingDown },
              { key: 'capital', label: 'Capital', icon: Settings },
              { key: 'alerts', label: 'Alerts', icon: Bell },
              { key: 'performance', label: 'Performance', icon: BarChart3 }
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`flex items-center gap-2 py-3 px-4 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.key
                      ? 'border-purple-500 text-purple-400'
                      : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Add Trade Button */}
        <div className="flex justify-end">
          <button
            onClick={() => setShowAddTrade(!showAddTrade)}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg font-semibold transition-colors"
          >
            <Plus size={16} />
            Add Trade
          </button>
        </div>

        {/* Add Trade Form */}
        {showAddTrade && (
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-semibold mb-3">Add New Trade</h3>
            <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Ticker</label>
                <input
                  type="text"
                  value={newTrade.ticker || ''}
                  onChange={(e) => setNewTrade({ ...newTrade, ticker: e.target.value.toUpperCase() })}
                  placeholder="BTC, ETH..."
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-purple-500"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">Action</label>
                <select
                  value={newTrade.action || 'BUY'}
                  onChange={(e) => setNewTrade({ ...newTrade, action: e.target.value as 'BUY' | 'SELL' | 'DCA' })}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-purple-500"
                >
                  <option value="BUY">BUY</option>
                  <option value="SELL">SELL</option>
                  <option value="DCA">DCA</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">Price ($)</label>
                <input
                  type="number"
                  step="0.000001"
                  value={newTrade.price || ''}
                  onChange={(e) => setNewTrade({ ...newTrade, price: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-purple-500"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">Quantity</label>
                <input
                  type="number"
                  step="0.000001"
                  value={newTrade.quantity || ''}
                  onChange={(e) => setNewTrade({ ...newTrade, quantity: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-purple-500"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">Fees ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={newTrade.fees || ''}
                  onChange={(e) => setNewTrade({ ...newTrade, fees: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-purple-500"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">Notes</label>
                <input
                  type="text"
                  value={newTrade.notes || ''}
                  onChange={(e) => setNewTrade({ ...newTrade, notes: e.target.value })}
                  placeholder="Reason..."
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-purple-500"
                />
              </div>
              
              <div className="flex items-end">
                <button
                  onClick={addTrade}
                  disabled={!newTrade.ticker || !newTrade.price || !newTrade.quantity}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-2 rounded font-semibold transition-colors"
                >
                  Add
                </button>
              </div>
            </div>
            
            {newTrade.price && newTrade.quantity && (
              <div className="mt-3 p-3 bg-gray-700/50 rounded border border-gray-600">
                <div className="text-sm text-gray-300 space-y-1">
                  <div className="flex justify-between">
                    <span>Total Value:</span>
                    <span className="font-semibold">${((newTrade.price || 0) * (newTrade.quantity || 0)).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>With Fees:</span>
                    <span className="font-semibold">${((newTrade.price || 0) * (newTrade.quantity || 0) + (newTrade.fees || 0)).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t border-gray-600 pt-1">
                    <span>Available Cash:</span>
                    <span className="font-semibold text-green-400">${data.availableCash.toLocaleString()}</span>
                  </div>
                  {(newTrade.action === 'BUY' || newTrade.action === 'DCA') && (
                    <div className="flex justify-between">
                      <span>After Trade:</span>
                      <span className={`font-semibold ${
                        data.availableCash - ((newTrade.price || 0) * (newTrade.quantity || 0) + (newTrade.fees || 0)) >= 0
                          ? 'text-green-400' 
                          : 'text-red-400'
                      }`}>
                        ${(data.availableCash - ((newTrade.price || 0) * (newTrade.quantity || 0) + (newTrade.fees || 0))).toLocaleString()}
                      </span>
                    </div>
                  )}
                  {(newTrade.action === 'BUY' || newTrade.action === 'DCA') && 
                   data.availableCash < ((newTrade.price || 0) * (newTrade.quantity || 0) + (newTrade.fees || 0)) && (
                    <div className="text-red-400 text-xs font-semibold">
                      ⚠️ Không đủ tiền mặt để thực hiện giao dịch này!
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab Content */}
        {activeTab === 'dashboard' && (
          <DashboardTab data={data} portfolioMetrics={portfolioMetrics} />
        )}
        
        {activeTab === 'tradelog' && (
          <TradeLogTab data={data} onUpdateData={setData} />
        )}
        
        {activeTab === 'portfolio' && (
          <PortfolioTab data={data} onUpdateData={setData} />
        )}
        
        {activeTab === 'takeprofit' && (
          <TakeProfitTab data={data} onUpdateData={setData} />
        )}
        
        {activeTab === 'smartdca' && (
          <SmartDCATab data={data} onUpdateData={setData} />
        )}
        
        {activeTab === 'dcaanalysis' && (
          <DCAAnalysisTab data={data} />
        )}
        
        {activeTab === 'capital' && (
          <CapitalManagementTab data={data} onUpdateData={setData} />
        )}
        
        {activeTab === 'alerts' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Alerts & Notifications</h3>
            {alerts.length > 0 ? (
              <div className="space-y-3">
                {alerts.map(alert => (
                  <div key={alert.id} className={`p-4 rounded-lg border ${
                    alert.severity === 'HIGH' ? 'bg-red-900/20 border-red-500/30' :
                    alert.severity === 'MEDIUM' ? 'bg-yellow-900/20 border-yellow-500/30' :
                    'bg-blue-900/20 border-blue-500/30'
                  }`}>
                    <div className="flex items-start gap-3">
                      <Bell size={16} className={
                        alert.severity === 'HIGH' ? 'text-red-400' :
                        alert.severity === 'MEDIUM' ? 'text-yellow-400' :
                        'text-blue-400'
                      } />
                      <div className="flex-1">
                        <div className="font-medium">{alert.message}</div>
                        <div className="text-sm text-gray-400 mt-1">
                          {new Date(alert.timestamp).toLocaleString('vi-VN')}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-400 py-12">
                <Bell size={64} className="mx-auto mb-4 opacity-50" />
                <p>No alerts at the moment</p>
                <p className="text-sm">Alerts will appear when TP/DCA levels are reached or conditions are met</p>
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'performance' && (
          <div className="text-center text-gray-400 py-12">
            <BarChart3 size={64} className="mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">Performance Analytics</h3>
            <p>Coming soon... Detailed performance metrics and charts</p>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="bg-gray-800 rounded p-3 border border-gray-700">
                <div>Win Rate</div>
                <div className="text-lg font-bold text-green-400">{portfolioMetrics.winRate.toFixed(1)}%</div>
              </div>
              <div className="bg-gray-800 rounded p-3 border border-gray-700">
                <div>Total Trades</div>
                <div className="text-lg font-bold">{portfolioMetrics.totalTrades}</div>
              </div>
              <div className="bg-gray-800 rounded p-3 border border-gray-700">
                <div>Assets</div>
                <div className="text-lg font-bold text-blue-400">{data.assets.length}</div>
              </div>
              <div className="bg-gray-800 rounded p-3 border border-gray-700">
                <div>Total ROI</div>
                <div className={`text-lg font-bold ${portfolioMetrics.totalPnLPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {portfolioMetrics.totalPnLPercent >= 0 ? '+' : ''}{portfolioMetrics.totalPnLPercent.toFixed(2)}%
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Auth Modal */}
      <AuthModal
        show={showAuthModal}
        authMode={authMode}
        setAuthMode={setAuthMode}
        authForm={authForm}
        setAuthForm={setAuthForm}
        authError={authError}
        authLoading={authLoading}
        onSubmit={handleAuthSubmit}
      />
    </div>
  );
}