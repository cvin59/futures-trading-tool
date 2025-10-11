export const Platform = {
  BINANCE: 'binance',
  BINGX: 'bingx'
} as const;

export type Platform = typeof Platform[keyof typeof Platform];

export interface PlatformConfig {
  name: string;
  getWebSocketUrl: (symbol: string) => string;
  parsePriceData: (data: any) => { price: number; symbol: string };
  defaultTradingFee: number;
}