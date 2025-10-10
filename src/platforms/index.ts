import { Platform, PlatformConfig } from '../types/platform';

class BinancePlatform implements PlatformConfig {
  name = 'Binance';
  defaultTradingFee = 0.04;

  getWebSocketUrl(symbol: string): string {
    const lowerSymbol = symbol.toLowerCase();
    return `wss://fstream.binance.com/ws/${lowerSymbol}usdt@ticker`;
  }

  parsePriceData(data: any): { price: number; symbol: string } {
    return {
      price: parseFloat(data.c || '0'),
      symbol: data.s || ''
    };
  }
}

class BingXPlatform implements PlatformConfig {
  name = 'BingX';
  defaultTradingFee = 0.04;

  getWebSocketUrl(symbol: string): string {
    return `wss://open-api-swap.bingx.com/swap-market?symbol=${symbol.toUpperCase()}-USDT`;
  }

  parsePriceData(data: any): { price: number; symbol: string } {
    return {
      price: parseFloat(data.price || data.lastPrice || '0'),
      symbol: data.symbol || ''
    };
  }
}

export const PLATFORM_CONFIGS: Record<Platform, PlatformConfig> = {
  [Platform.BINANCE]: new BinancePlatform(),
  [Platform.BINGX]: new BingXPlatform()
};

export { Platform } from '../types/platform';
export type { PlatformConfig } from '../types/platform';