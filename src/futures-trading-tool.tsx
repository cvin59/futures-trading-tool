import { useState, useMemo, useEffect, useRef } from 'react';
import { Wifi, WifiOff } from 'lucide-react';

// TypeScript interfaces
interface Position {
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
  totalFees: number; // Track total fees paid
  editingMargin: boolean; // Toggle margin editing
}

interface FormData {
  symbol: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: string;
}

interface BinanceTickerData {
  c: string; // Current price
  s: string; // Symbol
}

const FuturesTradingTool = () => {
  const [wallet, setWallet] = useState<number>(906.3);
  const [editingWallet, setEditingWallet] = useState<boolean>(false);
  const [tempWallet, setTempWallet] = useState<string>('906.3');
  const [positions, setPositions] = useState<Position[]>([]);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [formData, setFormData] = useState<FormData>({
    symbol: '',
    direction: 'LONG',
    entryPrice: '',
  });

  // Trading fee settings (Binance Futures default)
  const [tradingFee, setTradingFee] = useState<number>(0.05); // 0.05% taker fee
  const [showFeeSettings, setShowFeeSettings] = useState<boolean>(false);

  // WebSocket connections
  const wsConnections = useRef<Map<number, WebSocket>>(new Map());

  // Setup WebSocket for price updates
  useEffect(() => {
    positions.forEach(pos => {
      if (!pos.autoUpdate) {
        // Close existing connection if auto-update is off
        const existingWs = wsConnections.current.get(pos.id);
        if (existingWs) {
          existingWs.close();
          wsConnections.current.delete(pos.id);
        }
        return;
      }

      // Don't create duplicate connections
      if (wsConnections.current.has(pos.id)) return;

      // Format symbol for Binance (e.g., BTCUSDT)
      const binanceSymbol = `${pos.symbol.toLowerCase()}usdt`;
      
      // Binance Futures WebSocket
      const ws = new WebSocket(`wss://fstream.binance.com/ws/${binanceSymbol}@ticker`);

      ws.onmessage = (event) => {
        try {
          const data: BinanceTickerData = JSON.parse(event.data);
          const price = parseFloat(data.c);
          
          if (!isNaN(price) && price > 0) {
            updatePrice(pos.id, price);
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
    });

    // Cleanup removed positions
    wsConnections.current.forEach((ws, posId) => {
      const positionExists = positions.find(p => p.id === posId);
      if (!positionExists) {
        ws.close();
        wsConnections.current.delete(posId);
      }
    });

    // Cleanup on unmount
    return () => {
      wsConnections.current.forEach(ws => ws.close());
      wsConnections.current.clear();
    };
  }, [positions]);

  // Toggle auto-update for a position
  const toggleAutoUpdate = (posId: number) => {
    setPositions(positions.map(pos => 
      pos.id === posId ? { ...pos, autoUpdate: !pos.autoUpdate } : pos
    ));
  };

  // Calculate trading fee
  const calculateFee = (positionValue: number): number => {
    return positionValue * (tradingFee / 100);
  };

  // Update margin for a position
  const updateMargin = (posId: number, newMargin: number) => {
    setPositions(positions.map(pos => {
      if (pos.id !== posId) return pos;
      
      // Recalculate position size based on new margin
      const newPositionSize = newMargin * 10;
      
      return {
        ...pos,
        initialMargin: newMargin,
        positionSize: newPositionSize,
        editingMargin: false,
      };
    }));
  };

  // Toggle margin editing
  const toggleMarginEdit = (posId: number) => {
    setPositions(positions.map(pos => 
      pos.id === posId ? { ...pos, editingMargin: !pos.editingMargin } : pos
    ));
  };

  // Tính phân bổ vốn
  const allocation = useMemo(() => ({
    initial: wallet * 0.45,
    dca: wallet * 0.40,
    emergency: wallet * 0.15,
    perTradeInitial: wallet * 0.045,
    perTradeDCA1: wallet * 0.024,
    perTradeDCA2: wallet * 0.016,
  }), [wallet]);

  // Tính margin level và PNL
  const stats = useMemo(() => {
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
  }, [positions, wallet, allocation]);

  // Tính SL, TP, DCA cho position mới
  const calculateLevels = (entry: string, direction: 'LONG' | 'SHORT') => {
    const entryNum = parseFloat(entry);
    if (!entryNum || isNaN(entryNum)) return null;

    const sl = direction === 'LONG' 
      ? entryNum * 0.93 
      : entryNum * 1.07;
    
    const dca1 = direction === 'LONG'
      ? entryNum * 0.97
      : entryNum * 1.03;
    
    const dca2 = direction === 'LONG'
      ? entryNum * 0.94
      : entryNum * 1.06;

    const R = Math.abs(entryNum - sl);
    
    const tp1 = direction === 'LONG' ? entryNum + R : entryNum - R;
    const tp2 = direction === 'LONG' ? entryNum + 2*R : entryNum - 2*R;
    const tp3 = direction === 'LONG' ? entryNum + 3*R : entryNum - 3*R;

    return { sl, dca1, dca2, R, tp1, tp2, tp3, entry: entryNum };
  };

  // Thêm position mới
  const addPosition = () => {
    if (!formData.symbol || !formData.entryPrice) return;

    const levels = calculateLevels(formData.entryPrice, formData.direction);
    if (!levels) return;

    // Calculate margin after fee
    const baseMargin = allocation.perTradeInitial;
    const positionValue = baseMargin * 10;
    const openFee = calculateFee(positionValue);
    const actualMargin = baseMargin - openFee;

    const newPosition: Position = {
      id: Date.now(),
      symbol: formData.symbol.toUpperCase(),
      direction: formData.direction,
      ...levels,
      currentPrice: levels.entry,
      avgEntry: levels.entry,
      initialMargin: actualMargin,
      positionSize: actualMargin * 10,
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
    };

    setPositions([...positions, newPosition]);
    setFormData({ symbol: '', direction: 'LONG', entryPrice: '' });
  };

  // Execute DCA
  const executeDCA = (posId: number, dcaLevel: 1 | 2) => {
    setPositions(positions.map(pos => {
      if (pos.id !== posId) return pos;

      const isFirst = dcaLevel === 1;
      if ((isFirst && pos.dca1Executed) || (!isFirst && pos.dca2Executed)) return pos;

      const dcaPrice = isFirst ? pos.dca1 : pos.dca2;
      const baseDcaMargin = isFirst ? allocation.perTradeDCA1 : allocation.perTradeDCA2;
      
      // Calculate DCA fee
      const dcaPositionValue = baseDcaMargin * 10;
      const dcaFee = calculateFee(dcaPositionValue);
      const actualDcaMargin = baseDcaMargin - dcaFee;
      const dcaPosition = actualDcaMargin * 10;

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

  // Close TP level
  const closeTP = (posId: number, tpLevel: 1 | 2 | 3) => {
    setPositions(positions.map(pos => {
      if (pos.id !== posId) return pos;

      let closePercent = 40;
      if (tpLevel === 2) closePercent = 30;
      if (tpLevel === 3) closePercent = 30;

      const newRemaining = pos.remainingPercent - closePercent;
      
      return {
        ...pos,
        remainingPercent: newRemaining,
        [`tp${tpLevel}Closed`]: true,
      };
    }));
  };

  // Update current price và tính PNL
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

  // Update Stop Loss và recalculate R, TP
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

  // Update Stop Loss by percentage
  const updateStopLossByPercent = (posId: number, percent: string) => {
    setPositions(positions.map(pos => {
      if (pos.id !== posId) return pos;

      const percentNum = parseFloat(percent);
      if (!percentNum || isNaN(percentNum)) return pos;

      const newSL = pos.avgEntry * (1 + percentNum / 100);

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

  // Close position
  const closePosition = (posId: number) => {
    setPositions(positions.filter(pos => pos.id !== posId));
  };

  // Update wallet
  const updateWallet = () => {
    const newWallet = parseFloat(tempWallet);
    if (newWallet && newWallet > 0 && !isNaN(newWallet)) {
      setWallet(newWallet);
      setEditingWallet(false);
    }
  };

  const cancelWalletEdit = () => {
    setTempWallet(wallet.toString());
    setEditingWallet(false);
  };

  // Margin level color
  const getMarginColor = (level: number) => {
    if (level >= 200) return 'text-green-400';
    if (level >= 150) return 'text-green-300';
    if (level >= 130) return 'text-yellow-400';
    if (level >= 110) return 'text-orange-400';
    return 'text-red-400';
  };

  const getMarginBg = (level: number) => {
    if (level >= 200) return 'bg-green-500/10';
    if (level >= 150) return 'bg-green-500/10';
    if (level >= 130) return 'bg-yellow-500/10';
    if (level >= 110) return 'bg-orange-500/10';
    return 'bg-red-500/10';
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-2 py-4">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Futures Trading Manager
          </h1>
          <p className="text-gray-400">10X Leverage • 45/40/15 Strategy</p>
          
          {/* Wallet Balance Editor */}
          <div className="flex items-center justify-center gap-2 mt-4">
            <span className="text-gray-400">Wallet Balance:</span>
            {editingWallet ? (
              <div className="flex items-center gap-2">
                <span className="text-gray-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={tempWallet}
                  onChange={(e) => setTempWallet(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && updateWallet()}
                  className="bg-gray-700 border border-blue-500 rounded px-3 py-1 w-32 font-mono text-lg focus:outline-none"
                  autoFocus
                />
                <button
                  onClick={updateWallet}
                  className="bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-sm font-semibold"
                >
                  ✓
                </button>
                <button
                  onClick={cancelWalletEdit}
                  className="bg-gray-600 hover:bg-gray-700 px-3 py-1 rounded text-sm font-semibold"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-blue-400">${wallet.toFixed(2)}</span>
                <button
                  onClick={() => {
                    setTempWallet(wallet.toString());
                    setEditingWallet(true);
                  }}
                  className="bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-xs"
                >
                  Edit
                </button>
              </div>
            )}
          </div>
          
          {/* Trading Fee Settings */}
          <div className="flex items-center justify-center gap-2 mt-2">
            <button
              onClick={() => setShowFeeSettings(!showFeeSettings)}
              className="text-sm text-gray-400 hover:text-gray-200 underline"
            >
              Trading Fee: {tradingFee}%
            </button>
            {showFeeSettings && (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  value={tradingFee}
                  onChange={(e) => setTradingFee(parseFloat(e.target.value) || 0.05)}
                  className="bg-gray-700 border border-gray-600 rounded px-2 py-1 w-20 text-sm focus:outline-none"
                />
                <span className="text-sm text-gray-400">%</span>
              </div>
            )}
          </div>
        </div>

        {/* Dashboard Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="text-gray-400 text-sm mb-1">Total Equity</div>
            <div className="text-2xl font-bold">${stats.equity.toFixed(2)}</div>
            <div className={`text-sm ${stats.totalPNL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {stats.totalPNL >= 0 ? '+' : ''}{stats.totalPNL.toFixed(2)} ({((stats.totalPNL/wallet)*100).toFixed(2)}%)
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="text-gray-400 text-sm mb-1">Used Margin</div>
            <div className="text-2xl font-bold">${stats.totalUsedMargin.toFixed(2)}</div>
            <div className="text-sm text-gray-400">{stats.usedMarginPercent.toFixed(1)}% of wallet</div>
          </div>

          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="text-gray-400 text-sm mb-1">Free Margin</div>
            <div className="text-2xl font-bold">${stats.freeMargin.toFixed(2)}</div>
            <div className="text-sm text-gray-400">{((stats.freeMargin/wallet)*100).toFixed(1)}%</div>
          </div>

          <div className={`rounded-lg p-4 border ${getMarginBg(stats.marginLevel)} border-gray-700`}>
            <div className="text-gray-400 text-sm mb-1">Margin Level</div>
            <div className={`text-2xl font-bold ${getMarginColor(stats.marginLevel)}`}>
              {stats.marginLevel > 0 ? stats.marginLevel.toFixed(0) : '∞'}%
            </div>
            <div className="text-sm text-gray-400">
              {stats.marginLevel >= 200 ? '🟢 Excellent' :
               stats.marginLevel >= 150 ? '🟢 Safe' :
               stats.marginLevel >= 130 ? '🟡 Caution' :
               stats.marginLevel >= 110 ? '🟠 Warning' : '🔴 Danger'}
            </div>
          </div>
        </div>

        {/* Fund Allocation */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h3 className="text-lg font-semibold mb-3">Fund Allocation (45/40/15)</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-gray-400">Initial Fund (45%)</div>
              <div className="font-bold text-blue-400">${allocation.initial.toFixed(2)}</div>
              <div className="text-xs text-gray-500">${allocation.perTradeInitial.toFixed(2)}/trade</div>
            </div>
            <div>
              <div className="text-gray-400">DCA Reserve (40%)</div>
              <div className="font-bold text-purple-400">${allocation.dca.toFixed(2)}</div>
              <div className="text-xs text-gray-500">DCA1: ${allocation.perTradeDCA1.toFixed(2)} | DCA2: ${allocation.perTradeDCA2.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-gray-400">Emergency (15%)</div>
              <div className="font-bold text-red-400">${allocation.emergency.toFixed(2)}</div>
              <div className="text-xs text-gray-500">Do not touch</div>
            </div>
          </div>
        </div>

        {/* Add Position Form */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-lg font-semibold mb-4">Open New Position</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input
              type="text"
              placeholder="Symbol (e.g. XPL)"
              value={formData.symbol}
              onChange={(e) => setFormData({...formData, symbol: e.target.value})}
              className="bg-gray-700 border border-gray-600 rounded px-4 py-2 focus:outline-none focus:border-blue-500"
            />
            
            <select
              value={formData.direction}
              onChange={(e) => setFormData({...formData, direction: e.target.value as 'LONG' | 'SHORT'})}
              className="bg-gray-700 border border-gray-600 rounded px-4 py-2 focus:outline-none focus:border-blue-500"
            >
              <option value="LONG">LONG 📈</option>
              <option value="SHORT">SHORT 📉</option>
            </select>

            <input
              type="number"
              step="any"
              placeholder="Entry Price"
              value={formData.entryPrice}
              onChange={(e) => setFormData({...formData, entryPrice: e.target.value})}
              className="bg-gray-700 border border-gray-600 rounded px-4 py-2 focus:outline-none focus:border-blue-500"
            />

            <button
              onClick={addPosition}
              disabled={!formData.symbol || !formData.entryPrice}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded px-4 py-2 font-semibold transition-colors"
            >
              Add Position
            </button>
          </div>

          {/* Preview calculation */}
          {formData.entryPrice && (() => {
            const preview = calculateLevels(formData.entryPrice, formData.direction);
            if (!preview) return null;
            return (
              <div className="mt-4 p-4 bg-gray-700/50 rounded border border-gray-600">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-gray-400">Stop Loss</div>
                    <div className="font-mono text-red-400">{preview.sl.toFixed(6)}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">DCA Levels</div>
                    <div className="font-mono text-yellow-400">{preview.dca1.toFixed(6)} / {preview.dca2.toFixed(6)}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Take Profits</div>
                    <div className="font-mono text-green-400">{preview.tp1.toFixed(6)}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Position Size</div>
                    <div className="font-mono">${(allocation.perTradeInitial * 10).toFixed(2)}</div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Active Positions */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold">Active Positions ({positions.length}/10)</h3>
            
            {/* View Mode Toggle */}
            <div className="flex gap-2 bg-gray-800 rounded-lg p-1 border border-gray-700">
              <button
                onClick={() => setViewMode('cards')}
                className={`px-4 py-2 rounded font-semibold text-sm transition-colors ${
                  viewMode === 'cards' 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                📋 Cards View
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-4 py-2 rounded font-semibold text-sm transition-colors ${
                  viewMode === 'table' 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                📊 Table View
              </button>
            </div>
          </div>
          
          {positions.length === 0 ? (
            <div className="bg-gray-800 rounded-lg p-8 border border-gray-700 text-center text-gray-400">
              No active positions. Add your first position above.
            </div>
          ) : viewMode === 'table' ? (
            /* TABLE VIEW */
            <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-900/50 border-b border-gray-700">
                  <tr className="text-left">
                    <th className="p-3 font-semibold">Symbol</th>
                    <th className="p-3 font-semibold">Type</th>
                    <th className="p-3 font-semibold">Entry/Avg</th>
                    <th className="p-3 font-semibold">Current</th>
                    <th className="p-3 font-semibold">Stop Loss</th>
                    <th className="p-3 font-semibold">TP1/TP2/TP3</th>
                    <th className="p-3 font-semibold">Position</th>
                    <th className="p-3 font-semibold">P&L</th>
                    <th className="p-3 font-semibold">ROI</th>
                    <th className="p-3 font-semibold">DCA</th>
                    <th className="p-3 font-semibold">TP Status</th>
                    <th className="p-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map(pos => {
                    const priceChangePercent = pos.direction === 'LONG'
                      ? ((pos.currentPrice - pos.avgEntry) / pos.avgEntry * 100)
                      : ((pos.avgEntry - pos.currentPrice) / pos.avgEntry * 100);
                    const roi = (pos.unrealizedPNL / pos.initialMargin) * 100;
                    
                    return (
                      <tr key={pos.id} className="border-b border-gray-700 hover:bg-gray-700/30">
                        <td className="p-3">
                          <div className="font-bold">{pos.symbol}</div>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            pos.direction === 'LONG' ? 'bg-green-600' : 'bg-red-600'
                          }`}>
                            {pos.direction}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-xs">
                          <div>{pos.entry.toFixed(6)}</div>
                          <div className="text-blue-400">{pos.avgEntry.toFixed(6)}</div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step="any"
                              value={pos.currentPrice}
                              onChange={(e) => updatePrice(pos.id, parseFloat(e.target.value) || 0)}
                              disabled={pos.autoUpdate}
                              className={`bg-gray-700 border border-gray-600 rounded px-2 py-1 font-mono text-xs w-24 focus:outline-none focus:border-blue-500 ${
                                pos.autoUpdate ? 'opacity-50' : ''
                              }`}
                            />
                            <button
                              onClick={() => toggleAutoUpdate(pos.id)}
                              className={`p-1 rounded ${
                                pos.autoUpdate ? 'text-green-400' : 'text-gray-500'
                              }`}
                              title={pos.autoUpdate ? 'Auto (Binance)' : 'Manual'}
                            >
                              {pos.autoUpdate ? <Wifi size={14} /> : <WifiOff size={14} />}
                            </button>
                          </div>
                          <div className={`text-xs mt-1 ${priceChangePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {priceChangePercent >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%
                          </div>
                        </td>
                        <td className="p-3 font-mono text-xs text-red-400">
                          {pos.sl.toFixed(6)}
                        </td>
                        <td className="p-3 font-mono text-xs text-green-400">
                          <div>{pos.tp1.toFixed(6)}</div>
                          <div>{pos.tp2.toFixed(6)}</div>
                          <div>{pos.tp3.toFixed(6)}</div>
                        </td>
                        <td className="p-3 text-xs">
                          <div>${pos.positionSize.toFixed(0)}</div>
                          
                          {/* Margin with edit */}
                          {pos.editingMargin ? (
                            <div className="flex items-center gap-1">
                              <span className="text-gray-500">$</span>
                              <input
                                type="number"
                                step="0.01"
                                defaultValue={pos.initialMargin.toFixed(2)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const input = e.target as HTMLInputElement;
                                    updateMargin(pos.id, parseFloat(input.value) || pos.initialMargin);
                                  }
                                }}
                                className="bg-gray-700 border border-blue-500 rounded px-1 py-0.5 w-14 text-xs"
                                autoFocus
                              />
                              <button
                                onClick={() => toggleMarginEdit(pos.id)}
                                className="text-gray-400 hover:text-gray-200"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-gray-400">
                              <span>${pos.initialMargin.toFixed(0)}</span>
                              <button
                                onClick={() => toggleMarginEdit(pos.id)}
                                className="text-blue-400 hover:text-blue-300"
                              >
                                ✎
                              </button>
                            </div>
                          )}
                          
                          <div className="text-purple-400">{pos.remainingPercent}%</div>
                          <div className="text-orange-400">Fee: ${pos.totalFees.toFixed(2)}</div>
                        </td>
                        <td className="p-3">
                          <div className={`font-bold ${pos.unrealizedPNL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {pos.unrealizedPNL >= 0 ? '+' : ''}${pos.unrealizedPNL.toFixed(2)}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className={`font-bold ${roi >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {roi >= 0 ? '+' : ''}{roi.toFixed(1)}%
                          </div>
                        </td>
                        <td className="p-3 text-xs">
                          <div className={pos.dca1Executed ? 'text-yellow-400' : 'text-gray-500'}>
                            {pos.dca1Executed ? '✓ DCA1' : '○ DCA1'}
                          </div>
                          <div className={pos.dca2Executed ? 'text-yellow-400' : 'text-gray-500'}>
                            {pos.dca2Executed ? '✓ DCA2' : '○ DCA2'}
                          </div>
                        </td>
                        <td className="p-3 text-xs">
                          <div className={pos.tp1Closed ? 'text-green-400' : 'text-gray-500'}>
                            {pos.tp1Closed ? '✓ TP1' : '○ TP1'}
                          </div>
                          <div className={pos.tp2Closed ? 'text-green-400' : 'text-gray-500'}>
                            {pos.tp2Closed ? '✓ TP2' : '○ TP2'}
                          </div>
                          <div className={pos.tp3Closed ? 'text-green-400' : 'text-gray-500'}>
                            {pos.tp3Closed ? '✓ TP3' : '○ TP3'}
                          </div>
                        </td>
                        <td className="p-3">
                          <button
                            onClick={() => {
                              setViewMode('cards');
                              setTimeout(() => {
                                document.getElementById(`pos-${pos.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              }, 100);
                            }}
                            className="bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded text-xs mb-1 w-full"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => closePosition(pos.id)}
                            className="bg-red-600 hover:bg-red-700 px-2 py-1 rounded text-xs w-full"
                          >
                            Close
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* CARDS VIEW */
            positions.map(pos => (
              <div key={pos.id} id={`pos-${pos.id}`} className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                {/* Position Header */}
                <div className={`p-4 ${pos.direction === 'LONG' ? 'bg-green-900/20' : 'bg-red-900/20'} border-b border-gray-700`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-bold">{pos.symbol}</span>
                        <span className={`px-2 py-1 rounded text-sm font-semibold ${
                          pos.direction === 'LONG' ? 'bg-green-600' : 'bg-red-600'
                        }`}>
                          {pos.direction === 'LONG' ? '📈 LONG' : '📉 SHORT'}
                        </span>
                      </div>
                      <div className="text-sm text-gray-400 mt-1">
                        Entry: {pos.entry.toFixed(6)} → Avg: {pos.avgEntry.toFixed(6)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-2xl font-bold ${pos.unrealizedPNL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {pos.unrealizedPNL >= 0 ? '+' : ''}${pos.unrealizedPNL.toFixed(2)}
                      </div>
                      <div className="text-sm text-gray-400">
                        ROI: {((pos.unrealizedPNL/pos.initialMargin)*100).toFixed(2)}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* Position Details */}
                <div className="p-4 space-y-4">
                  {/* Current Price Input */}
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-400 w-32">Current Price:</label>
                    <input
                      type="number"
                      step="any"
                      value={pos.currentPrice}
                      onChange={(e) => updatePrice(pos.id, parseFloat(e.target.value) || 0)}
                      disabled={pos.autoUpdate}
                      className={`bg-gray-700 border border-gray-600 rounded px-3 py-1 font-mono flex-1 focus:outline-none focus:border-blue-500 ${
                        pos.autoUpdate ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    />
                    <div className="text-sm text-gray-400 w-24">
                      {pos.direction === 'LONG' 
                        ? `${((pos.currentPrice - pos.avgEntry) / pos.avgEntry * 100).toFixed(2)}%`
                        : `${((pos.avgEntry - pos.currentPrice) / pos.avgEntry * 100).toFixed(2)}%`
                      }
                    </div>
                    <button
                      onClick={() => toggleAutoUpdate(pos.id)}
                      className={`px-3 py-1 rounded text-sm font-semibold transition-colors ${
                        pos.autoUpdate 
                          ? 'bg-green-600 hover:bg-green-700 text-white' 
                          : 'bg-gray-600 hover:bg-gray-700 text-gray-300'
                      }`}
                      title={pos.autoUpdate ? 'Auto-update ON (Binance)' : 'Auto-update OFF (Manual)'}
                    >
                      {pos.autoUpdate ? <Wifi size={16} /> : <WifiOff size={16} />}
                    </button>
                  </div>

                  {/* Stop Loss Input */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-400 w-32">Stop Loss (Price):</label>
                      <input
                        type="number"
                        step="any"
                        value={pos.sl}
                        onChange={(e) => updateStopLoss(pos.id, parseFloat(e.target.value) || 0)}
                        className="bg-gray-700 border border-red-600/50 rounded px-3 py-1 font-mono flex-1 focus:outline-none focus:border-red-500"
                      />
                      <div className="text-sm text-red-400 w-24">
                        {pos.direction === 'LONG'
                          ? `${((pos.sl - pos.avgEntry) / pos.avgEntry * 100).toFixed(2)}%`
                          : `${((pos.sl - pos.avgEntry) / pos.avgEntry * 100).toFixed(2)}%`
                        }
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-400 w-32">Stop Loss (%):</label>
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="number"
                          step="0.1"
                          placeholder={pos.direction === 'LONG' ? '-7' : '+7'}
                          onChange={(e) => {
                            if (e.target.value) {
                              updateStopLossByPercent(pos.id, e.target.value);
                            }
                          }}
                          className="bg-gray-700 border border-red-600/50 rounded px-3 py-1 font-mono flex-1 focus:outline-none focus:border-red-500"
                        />
                        <span className="text-gray-500">%</span>
                      </div>
                      <div className="text-xs text-gray-500 w-24">
                        {pos.direction === 'LONG' ? 'e.g., -7' : 'e.g., +7'}
                      </div>
                    </div>
                  </div>

                  {/* Levels Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div className="bg-red-900/20 p-2 rounded border border-red-600/30">
                      <div className="text-gray-400 text-xs">Stop Loss (Editable)</div>
                      <div className="font-mono text-red-400">{pos.sl.toFixed(6)}</div>
                      <div className="text-xs text-gray-500">Risk: -70% ROI</div>
                    </div>

                    <div className="bg-yellow-900/20 p-2 rounded">
                      <div className="text-gray-400 text-xs">DCA Levels</div>
                      <div className="font-mono text-yellow-400 text-xs">
                        {pos.dca1.toFixed(6)}
                      </div>
                      <div className="font-mono text-yellow-400 text-xs">
                        {pos.dca2.toFixed(6)}
                      </div>
                    </div>

                    <div className="bg-green-900/20 p-2 rounded">
                      <div className="text-gray-400 text-xs">Take Profits</div>
                      <div className="font-mono text-green-400 text-xs">
                        TP1: {pos.tp1.toFixed(6)}
                      </div>
                      <div className="font-mono text-green-400 text-xs">
                        TP2: {pos.tp2.toFixed(6)}
                      </div>
                      <div className="font-mono text-green-400 text-xs">
                        TP3: {pos.tp3.toFixed(6)}
                      </div>
                    </div>

                    <div className="bg-blue-900/20 p-2 rounded">
                      <div className="text-gray-400 text-xs">Position</div>
                      <div className="font-mono">${pos.positionSize.toFixed(2)}</div>
                      
                      {/* Margin Editor */}
                      {pos.editingMargin ? (
                        <div className="flex items-center gap-1 mt-1">
                          <input
                            type="number"
                            step="0.01"
                            defaultValue={pos.initialMargin.toFixed(2)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const input = e.target as HTMLInputElement;
                                updateMargin(pos.id, parseFloat(input.value) || pos.initialMargin);
                              }
                            }}
                            className="bg-gray-700 border border-blue-500 rounded px-1 py-0.5 w-16 text-xs focus:outline-none"
                            autoFocus
                          />
                          <button
                            onClick={() => toggleMarginEdit(pos.id)}
                            className="text-xs text-gray-400 hover:text-gray-200"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <div className="text-xs text-gray-400">Margin: ${pos.initialMargin.toFixed(2)}</div>
                          <button
                            onClick={() => toggleMarginEdit(pos.id)}
                            className="text-xs text-blue-400 hover:text-blue-300"
                          >
                            ✎
                          </button>
                        </div>
                      )}
                      
                      <div className="text-xs text-purple-400">Remaining: {pos.remainingPercent}%</div>
                      <div className="text-xs text-orange-400">Fees: ${pos.totalFees.toFixed(2)}</div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2">
                    {/* DCA Buttons */}
                    <button
                      onClick={() => executeDCA(pos.id, 1)}
                      disabled={pos.dca1Executed}
                      className={`px-3 py-1 rounded text-sm font-semibold ${
                        pos.dca1Executed 
                          ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                          : 'bg-yellow-600 hover:bg-yellow-700'
                      }`}
                    >
                      {pos.dca1Executed ? '✓ DCA1 Done' : 'Execute DCA1 ($22)'}
                    </button>

                    <button
                      onClick={() => executeDCA(pos.id, 2)}
                      disabled={pos.dca2Executed}
                      className={`px-3 py-1 rounded text-sm font-semibold ${
                        pos.dca2Executed 
                          ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                          : 'bg-yellow-600 hover:bg-yellow-700'
                      }`}
                    >
                      {pos.dca2Executed ? '✓ DCA2 Done' : 'Execute DCA2 ($14)'}
                    </button>

                    {/* TP Buttons */}
                    <button
                      onClick={() => closeTP(pos.id, 1)}
                      disabled={pos.tp1Closed}
                      className={`px-3 py-1 rounded text-sm font-semibold ${
                        pos.tp1Closed 
                          ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                          : 'bg-green-600 hover:bg-green-700'
                      }`}
                    >
                      {pos.tp1Closed ? '✓ TP1 Closed' : 'Close TP1 (40%)'}
                    </button>

                    <button
                      onClick={() => closeTP(pos.id, 2)}
                      disabled={pos.tp2Closed}
                      className={`px-3 py-1 rounded text-sm font-semibold ${
                        pos.tp2Closed 
                          ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                          : 'bg-green-600 hover:bg-green-700'
                      }`}
                    >
                      {pos.tp2Closed ? '✓ TP2 Closed' : 'Close TP2 (30%)'}
                    </button>

                    <button
                      onClick={() => closeTP(pos.id, 3)}
                      disabled={pos.tp3Closed}
                      className={`px-3 py-1 rounded text-sm font-semibold ${
                        pos.tp3Closed 
                          ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                          : 'bg-green-600 hover:bg-green-700'
                      }`}
                    >
                      {pos.tp3Closed ? '✓ TP3 Closed' : 'Close TP3 (30%)'}
                    </button>

                    {/* Close Position */}
                    <button
                      onClick={() => closePosition(pos.id)}
                      className="px-3 py-1 rounded text-sm font-semibold bg-red-600 hover:bg-red-700 ml-auto"
                    >
                      Close Position
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Quick Reference */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h3 className="text-lg font-semibold mb-3">Quick Reference</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="font-semibold text-blue-400 mb-2">LONG Setup</div>
              <div className="space-y-1 text-gray-300">
                <div>• SL: Entry × 0.93 (-7%)</div>
                <div>• DCA1: Entry × 0.97 (-3%)</div>
                <div>• DCA2: Entry × 0.94 (-6%)</div>
                <div>• TP: Entry + R, +2R, +3R</div>
              </div>
            </div>
            <div>
              <div className="font-semibold text-red-400 mb-2">SHORT Setup</div>
              <div className="space-y-1 text-gray-300">
                <div>• SL: Entry × 1.07 (+7%)</div>
                <div>• DCA1: Entry × 1.03 (+3%)</div>
                <div>• DCA2: Entry × 1.06 (+6%)</div>
                <div>• TP: Entry - R, -2R, -3R</div>
              </div>
            </div>
            <div>
              <div className="font-semibold text-purple-400 mb-2">Golden Rules</div>
              <div className="space-y-1 text-gray-300">
                <div>• Keep Margin Level &gt; 150%</div>
                <div>• TP: 40% @ TP1, 30% @ TP2, 30% @ TP3</div>
                <div>• Close 40% @ TP1 → Move SL to BE</div>
                <div>• Max 3 full DCA positions</div>
                <div>• Never move SL down</div>
              </div>
            </div>
          </div>
          <div className="mt-4 p-3 bg-blue-900/20 border border-blue-600/30 rounded">
            <div className="flex items-center gap-2 text-blue-400 font-semibold mb-1">
              <Wifi size={16} />
              <span>Auto Price Update (Binance)</span>
            </div>
            <div className="text-xs text-gray-300">
              Click the <Wifi size={12} className="inline" /> icon to enable/disable real-time price updates from Binance Futures. 
              Symbol format: BTCUSDT, ETHUSDT, etc.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default FuturesTradingTool;