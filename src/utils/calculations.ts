import type { Position } from '../types/trading';

export const calculateAllocation = (wallet: number) => ({
  initial: wallet * 0.45,
  dca: wallet * 0.40,
  emergency: wallet * 0.15,
  perTradeInitial: wallet * 0.045,
  perTradeDCA1: wallet * 0.024,
  perTradeDCA2: wallet * 0.016,
});

export const calculateStats = (positions: Position[], wallet: number) => {
  const allocation = calculateAllocation(wallet);
  
  const totalUsedMargin = positions.reduce((sum, pos) => {
    let used = allocation.perTradeInitial;
    if (pos.dca1Executed) used += allocation.perTradeDCA1;
    if (pos.dca2Executed) used += allocation.perTradeDCA2;
    return sum + used;
  }, 0);

  const totalPNL = positions.reduce((sum, pos) => sum + (pos.unrealizedPNL || 0), 0);
  const equity = wallet + totalPNL;
  const freeMargin = equity - totalUsedMargin;
  const marginLevel = totalUsedMargin > 0 ? (equity / totalUsedMargin) * 100 : 0;

  return {
    totalUsedMargin,
    totalPNL,
    equity,
    freeMargin,
    marginLevel,
    usedMarginPercent: (totalUsedMargin / wallet) * 100,
  };
};

export const calculateLevels = (entry: string, direction: 'LONG' | 'SHORT') => {
  const entryNum = parseFloat(entry);
  if (!entryNum || isNaN(entryNum)) return null;

  const sl = direction === 'LONG' ? entryNum * 0.93 : entryNum * 1.07;
  const dca1 = direction === 'LONG' ? entryNum * 0.97 : entryNum * 1.03;
  const dca2 = direction === 'LONG' ? entryNum * 0.94 : entryNum * 1.06;
  const R = Math.abs(entryNum - sl);
  const tp1 = direction === 'LONG' ? entryNum + R : entryNum - R;
  const tp2 = direction === 'LONG' ? entryNum + 2*R : entryNum - 2*R;
  const tp3 = direction === 'LONG' ? entryNum + 3*R : entryNum - 3*R;

  return { sl, dca1, dca2, R, tp1, tp2, tp3, entry: entryNum };
};

export const calculateFee = (positionValue: number, tradingFee: number = 0.05) => {
  return (positionValue * tradingFee) / 100;
};

export const calculatePNL = (position: Position) => {
  const { direction, currentPrice, avgEntry, positionSize } = position;
  const priceDiff = direction === 'LONG' 
    ? currentPrice - avgEntry 
    : avgEntry - currentPrice;
  
  const pnlPercentage = (priceDiff / avgEntry) * 100;
  const pnl = (positionSize * pnlPercentage) / 100;
  
  return pnl;
};

export const getMarginLevelColor = (level: number) => {
  if (level >= 150) return 'bg-green-500/10';
  if (level >= 130) return 'bg-yellow-500/10';
  if (level >= 110) return 'bg-orange-500/10';
  return 'bg-red-500/10';
};

export const getPNLColor = (pnl: number) => {
  return pnl >= 0 ? 'text-green-400' : 'text-red-400';
};

export const formatCurrency = (value: number, decimals: number = 2) => {
  return value.toFixed(decimals);
};

export const formatPercentage = (value: number, decimals: number = 2) => {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
};