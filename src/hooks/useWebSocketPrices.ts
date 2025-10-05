import { useRef, useEffect } from 'react';
import type { Position, BinanceTickerData } from '../types/trading';

export const useWebSocketPrices = (
  positions: Position[],
  onPriceUpdate: (posId: number, newPrice: number) => void
) => {
  const wsConnections = useRef<Map<number, WebSocket>>(new Map());
  const autoUpdateStatus = useRef<Map<number, boolean>>(new Map());

  useEffect(() => {
    // Setup WebSocket for price updates
    positions.forEach(pos => {
      const wasAutoUpdate = autoUpdateStatus.current.get(pos.id);
      const autoUpdateChanged = wasAutoUpdate !== pos.autoUpdate;
      autoUpdateStatus.current.set(pos.id, pos.autoUpdate);

      if (!pos.autoUpdate) {
        const existingWs = wsConnections.current.get(pos.id);
        if (existingWs) {
          existingWs.close();
          wsConnections.current.delete(pos.id);
        }
        return;
      }

      if (!wsConnections.current.has(pos.id) || autoUpdateChanged) {
        const existingWs = wsConnections.current.get(pos.id);
        if (existingWs) {
          existingWs.close();
          wsConnections.current.delete(pos.id);
        }

        const binanceSymbol = pos.symbol.toLowerCase();
        const ws = new WebSocket(`wss://fstream.binance.com/ws/${binanceSymbol}@ticker`);

        ws.onmessage = (event) => {
          try {
            const data: BinanceTickerData = JSON.parse(event.data);
            const newPrice = parseFloat(data.c);
            
            if (!isNaN(newPrice) && newPrice > 0) {
              onPriceUpdate(pos.id, newPrice);
            }
          } catch (error) {
            console.error('Error parsing WebSocket data:', error);
          }
        };

        ws.onerror = (error) => {
          console.error(`WebSocket error for ${pos.symbol}:`, error);
        };

        ws.onclose = () => {
          wsConnections.current.delete(pos.id);
        };

        wsConnections.current.set(pos.id, ws);
      }
    });

    // Clean up connections for removed positions
    wsConnections.current.forEach((ws, posId) => {
      if (!positions.find(p => p.id === posId)) {
        ws.close();
        wsConnections.current.delete(posId);
        autoUpdateStatus.current.delete(posId);
      }
    });

    return () => {
      wsConnections.current.forEach(ws => ws.close());
      wsConnections.current.clear();
      autoUpdateStatus.current.clear();
    };
  }, [positions, onPriceUpdate]);

  const closeAllConnections = () => {
    wsConnections.current.forEach(ws => ws.close());
    wsConnections.current.clear();
    autoUpdateStatus.current.clear();
  };

  return {
    closeAllConnections,
  };
};