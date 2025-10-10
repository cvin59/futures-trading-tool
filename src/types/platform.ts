export enum Platform {
  BINANCE = 'binance',
  BINGX = 'bingx'
}

export interface PlatformConfig {
  name: string;
  getWebSocketUrl: (symbol: string) => string;
  parsePriceData: (data: any) => { price: number; symbol: string };
  defaultTradingFee: number;
}