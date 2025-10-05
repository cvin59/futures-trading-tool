export interface Position {
  id: number;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  entry: number;
  currentPrice: number;
  avgEntry: number;
  sl: number;
  dca1: number;
  dca2: number;
  R: number;
  tp1: number;
  tp2: number;
  tp3: number;
  initialMargin: number;
  positionSize: number;
  dca1Executed: boolean;
  dca2Executed: boolean;
  tp1Closed: boolean;
  tp2Closed: boolean;
  tp3Closed: boolean;
  unrealizedPNL: number;
  remainingPercent: number;
  autoUpdate: boolean;
  totalFees: number;
  editingMargin: boolean;
}

export interface FormData {
  symbol: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: string;
}

export interface BinanceTickerData {
  c: string;
  s: string;
}

export type ViewMode = 'cards' | 'table';
export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error';
export type AuthMode = 'login' | 'signup';

export interface AuthForm {
  email: string;
  password: string;
}