import { useState, useEffect } from 'react';
import { calculateLevels, calculateFee, calculateAllocation } from '../utils/calculations';
import type { Position, FormData } from '../types/trading';

export const usePositions = (wallet: number, tradingFee: number) => {
  const [positions, setPositions] = useState<Position[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('futures-positions');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          return parsed.map((pos: Position) => ({
            ...pos,
            autoUpdate: false,
            editingMargin: false,
            editingLeverage: false,
            currentPrice: pos.currentPrice || pos.avgEntry || pos.entry,
            leverage: pos.leverage || 10,
          }));
        } catch (e) {
          console.error('Error loading positions:', e);
        }
      }
    }
    return [];
  });

  const [tempMarginValues, setTempMarginValues] = useState<Map<number, string>>(new Map());
  const [tempTPValues, setTempTPValues] = useState<Map<string, string>>(new Map()); // key: `${posId}-tp${level}`
  const [tempDCAValues, setTempDCAValues] = useState<Map<string, string>>(new Map()); // key: `${posId}-dca${level}`

  const allocation = calculateAllocation(wallet);

  // Save to localStorage whenever positions change
  useEffect(() => {
    if (typeof window !== 'undefined' && positions.length >= 0) {
      localStorage.setItem('futures-positions', JSON.stringify(positions));
    }
  }, [positions]);

  const addPosition = (formData: FormData) => {
    if (!formData.symbol || !formData.entryPrice) return false;

    const levels = calculateLevels(formData.entryPrice, formData.direction);
    if (!levels) return false;

    const customMargin = formData.initialMargin ? parseFloat(formData.initialMargin) : null;
    const baseMargin = customMargin || allocation.perTradeInitial;
    const leverage = formData.leverage || 10;
    const positionValue = baseMargin * leverage;
    const openFee = calculateFee(positionValue, tradingFee);
    const actualMargin = baseMargin - openFee;

    const newPosition: Position = {
      id: Date.now(),
      symbol: formData.symbol.toUpperCase(),
      direction: formData.direction,
      ...levels,
      currentPrice: levels.entry,
      avgEntry: levels.entry,
      initialMargin: actualMargin,
      positionSize: actualMargin * leverage,
      leverage,
      dca1Executed: false,
      dca2Executed: false,
      tp1Closed: false,
      tp2Closed: false,
      tp3Closed: false,
      unrealizedPNL: 0,
      remainingPercent: 100,
      autoUpdate: true,
      totalFees: openFee,
      editingMargin: false,
      editingLeverage: false,
    };

    setPositions(prev => [...prev, newPosition]);
    return true;
  };

  const executeDCA = (posId: number, dcaLevel: 1 | 2, customMargin?: number) => {
    setPositions(positions.map(pos => {
      if (pos.id !== posId) return pos;

      const isFirst = dcaLevel === 1;
      if ((isFirst && pos.dca1Executed) || (!isFirst && pos.dca2Executed)) return pos;

      const dcaPrice = isFirst ? pos.dca1 : pos.dca2;
      // Use custom margin if provided, otherwise use defaults
      const baseDcaMargin = customMargin !== undefined ? customMargin : (isFirst ? allocation.perTradeDCA1 : allocation.perTradeDCA2);
      
      const dcaPositionValue = baseDcaMargin * pos.leverage;
      const dcaFee = calculateFee(dcaPositionValue, tradingFee);
      const actualDcaMargin = baseDcaMargin - dcaFee;
      const dcaPosition = actualDcaMargin * pos.leverage;

      const totalPosition = pos.positionSize + dcaPosition;
      const avgEntry = (pos.positionSize * pos.avgEntry + dcaPosition * dcaPrice) / totalPosition;
      
      const newR = Math.abs(avgEntry - pos.sl);
      const newTP1 = pos.direction === 'LONG' ? avgEntry + newR : avgEntry - newR;
      const newTP2 = pos.direction === 'LONG' ? avgEntry + 2*newR : avgEntry - 2*newR;
      const newTP3 = pos.direction === 'LONG' ? avgEntry + 3*newR : avgEntry - 3*newR;

      return {
        ...pos,
        avgEntry,
        positionSize: totalPosition,
        initialMargin: pos.initialMargin + actualDcaMargin,
        totalFees: pos.totalFees + dcaFee,
        R: newR,
        tp1: newTP1,
        tp2: newTP2,
        tp3: newTP3,
        [isFirst ? 'dca1Executed' : 'dca2Executed']: true,
      };
    }));
  };

  const closeTP = (posId: number, tpLevel: 1 | 2 | 3, customPercent?: number) => {
    setPositions(positions.map(pos => {
      if (pos.id !== posId) return pos;

      // Use custom percentage if provided, otherwise use defaults
      let closePercent = customPercent;
      if (closePercent === undefined) {
        closePercent = 40;
        if (tpLevel === 2) closePercent = 30;
        if (tpLevel === 3) closePercent = 30;
      }

      const newRemaining = Math.max(0, pos.remainingPercent - closePercent);
      
      return {
        ...pos,
        remainingPercent: newRemaining,
        [`tp${tpLevel}Closed`]: true,
      };
    }));
  };

  const updatePrice = (posId: number, newPrice: number) => {
    setPositions(positions.map(pos => {
      if (pos.id !== posId) return pos;

      const priceChange = pos.direction === 'LONG'
        ? (newPrice - pos.avgEntry) / pos.avgEntry
        : (pos.avgEntry - newPrice) / pos.avgEntry;

      const pnl = pos.positionSize * priceChange * (pos.remainingPercent / 100);

      return {
        ...pos,
        currentPrice: newPrice,
        unrealizedPNL: pnl,
      };
    }));
  };

  const updateStopLoss = (posId: number, newSL: number) => {
    setPositions(positions.map(pos => {
      if (pos.id !== posId) return pos;

      const newR = Math.abs(pos.avgEntry - newSL);
      const newTP1 = pos.direction === 'LONG' ? pos.avgEntry + newR : pos.avgEntry - newR;
      const newTP2 = pos.direction === 'LONG' ? pos.avgEntry + 2*newR : pos.avgEntry - 2*newR;
      const newTP3 = pos.direction === 'LONG' ? pos.avgEntry + 3*newR : pos.avgEntry - 3*newR;

      return {
        ...pos,
        sl: newSL,
        R: newR,
        tp1: newTP1,
        tp2: newTP2,
        tp3: newTP3,
      };
    }));
  };

  const removePosition = (posId: number) => {
    setPositions(positions.filter(pos => pos.id !== posId));
  };

  const updateMargin = (posId: number, newMargin: number) => {
    setPositions(positions.map(pos => {
      if (pos.id !== posId) return pos;
      return {
        ...pos,
        initialMargin: newMargin,
        positionSize: newMargin * pos.leverage,
        editingMargin: false,
      };
    }));
  };

  const toggleAutoUpdate = (posId: number) => {
    setPositions(positions.map(pos => 
      pos.id === posId ? { ...pos, autoUpdate: !pos.autoUpdate } : pos
    ));
  };

  const toggleEditingMargin = (posId: number) => {
    setPositions(positions.map(pos =>
      pos.id === posId ? { ...pos, editingMargin: !pos.editingMargin } : pos
    ));
  };

  const updateLeverage = (posId: number, newLeverage: number) => {
    setPositions(positions.map(pos => {
      if (pos.id !== posId) return pos;
      return {
        ...pos,
        leverage: newLeverage,
        positionSize: pos.initialMargin * newLeverage,
        editingLeverage: false,
      };
    }));
  };

  const toggleEditingLeverage = (posId: number) => {
    setPositions(positions.map(pos =>
      pos.id === posId ? { ...pos, editingLeverage: !pos.editingLeverage } : pos
    ));
  };

  // TP Helper Functions
  const updateTempTP = (posId: number, tpLevel: 1 | 2 | 3, value: string) => {
    setTempTPValues(prev => new Map(prev).set(`${posId}-tp${tpLevel}`, value));
  };

  const executeTpWithInput = (posId: number, tpLevel: 1 | 2 | 3) => {
    const key = `${posId}-tp${tpLevel}`;
    const value = tempTPValues.get(key);
    if (value) {
      closeTP(posId, tpLevel, parseFloat(value));
      setTempTPValues(prev => {
        const newMap = new Map(prev);
        newMap.delete(key);
        return newMap;
      });
    }
  };

  // DCA Helper Functions
  const updateTempDCA = (posId: number, dcaLevel: 1 | 2, value: string) => {
    setTempDCAValues(prev => new Map(prev).set(`${posId}-dca${dcaLevel}`, value));
  };

  const executeDcaWithInput = (posId: number, dcaLevel: 1 | 2) => {
    const key = `${posId}-dca${dcaLevel}`;
    const value = tempDCAValues.get(key);
    if (value) {
      executeDCA(posId, dcaLevel, parseFloat(value));
      setTempDCAValues(prev => {
        const newMap = new Map(prev);
        newMap.delete(key);
        return newMap;
      });
    }
  };

  return {
    positions,
    setPositions,
    tempMarginValues,
    setTempMarginValues,
    addPosition,
    executeDCA,
    closeTP,
    updatePrice,
    updateStopLoss,
    removePosition,
    updateMargin,
    toggleAutoUpdate,
    toggleEditingMargin,
    updateLeverage,
    toggleEditingLeverage,
    tempTPValues,
    setTempTPValues,
    tempDCAValues,
    setTempDCAValues,
    updateTempTP,
    executeTpWithInput,
    updateTempDCA,
    executeDcaWithInput,
  };
};