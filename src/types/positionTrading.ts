// Position Trading System Types

export interface TradeLog {
  id: string;
  date: string;
  ticker: string;
  action: 'BUY' | 'SELL' | 'DCA';
  price: number;
  quantity: number;
  totalValue: number;
  fees: number;
  notes: string;
  timestamp: number;
}

export interface Asset {
  id: string;
  ticker: string;
  averageBuyPrice: number;
  currentQuantity: number;
  currentMarketPrice: number;
  currentValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  portfolioWeight: number;
  status: 'PROFIT' | 'LOSS' | 'BREAKEVEN';
  totalInvested: number;
  lastUpdated: number;
}

export interface TakeProfitLevel {
  id: string;
  assetId: string;
  ticker: string;
  level: 'TP1' | 'TP2' | 'TP3' | 'TP4';
  targetPrice: number;
  sellPercentage: number;
  quantityToSell: number;
  expectedValue: number;
  status: 'PENDING' | 'COMPLETED';
  isChecked: boolean;
  priceIncrease: number; // % increase from entry
}

export interface DCALevel {
  id: string;
  assetId: string;
  ticker: string;
  level: 'DCA1' | 'DCA2' | 'DCA3' | 'DCA4';
  triggerPrice: number;
  priceDecrease: number; // % decrease from entry
  dcaAmount: number;
  quantityToBuy: number;
  status: 'WAITING' | 'EXECUTED';
  additionalConditions?: string;
  capitalAllocation: number; // % of reserve capital
}

export interface PortfolioMetrics {
  totalInitialCapital: number;
  totalCurrentValue: number;
  totalPnL: number;
  totalPnLPercent: number;
  availableCash: number;
  totalInvested: number;
  winRate: number;
  averageGain: number;
  averageLoss: number;
  bestTrade: number;
  worstTrade: number;
  totalTrades: number;
  sharpeRatio?: number;
}

export interface Alert {
  id: string;
  type: 'TP_REACHED' | 'DCA_ZONE' | 'REBALANCE_NEEDED' | 'HIGH_GAIN' | 'HIGH_LOSS' | 'RSI_SIGNAL';
  message: string;
  ticker?: string;
  level?: string;
  timestamp: number;
  isRead: boolean;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface TradingRules {
  takeProfitRules: {
    tp1: { percent: 50; sellPercent: 20 };
    tp2: { percent: 100; sellPercent: 20 };
    tp3: { percent: 200; sellPercent: 20 };
    tp4: { percent: 300; sellPercent: 20 };
    hold: { percent: 20 };
  };
  dcaRules: {
    dca1: { percent: -10; capitalPercent: 15 };
    dca2: { percent: -20; capitalPercent: 20 };
    dca3: { percent: -30; capitalPercent: 25 };
    dca4: { percent: -40; capitalPercent: 40 };
  };
  alertRules: {
    rebalanceThreshold: 40; // % portfolio weight
    highGainThresholds: [50, 100, 200]; // % gains
    highLossThreshold: 20; // % loss
    rsiOversold: 30;
    rsiOverbought: 70;
  };
}

export interface PositionTradingData {
  tradeLogs: TradeLog[];
  assets: Asset[];
  takeProfitLevels: TakeProfitLevel[];
  dcaLevels: DCALevel[];
  portfolioMetrics: PortfolioMetrics;
  alerts: Alert[];
  initialCapital: number;
  availableCash: number;
}