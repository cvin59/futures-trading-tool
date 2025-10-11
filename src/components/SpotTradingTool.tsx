import { useState, useMemo, useEffect, useRef } from 'react';
import { Wifi, WifiOff, User, TrendingDown } from 'lucide-react';
import { Platform, PLATFORM_CONFIGS } from '../platforms';

// TypeScript interfaces for Spot Trading
interface SpotPosition {
  id: number;
  symbol: string;
  type: 'BUY' | 'SELL';
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  value: number;
  totalCost: number;
  unrealizedPNL: number;
  autoUpdate: boolean;
  totalFees: number;
  timestamp: number;
}

interface SpotFormData {
  symbol: string;
  type: 'BUY' | 'SELL';
  entryPrice: string;
  quantity: string;
}

export default function SpotTradingTool() {
  const [positions, setPositions] = useState<SpotPosition[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem('spot-positions');
      if (stored) {
        const data = JSON.parse(stored);
        return data.map((pos: SpotPosition) => ({
          ...pos,
          autoUpdate: false,
          currentPrice: pos.currentPrice || pos.entryPrice,
        }));
      }
    } catch (error) {
      console.error('Error loading spot positions from localStorage:', error);
    }
    return [];
  });

  const [wallet, setWallet] = useState<number>(() => {
    if (typeof window === 'undefined') return 1000;
    const stored = localStorage.getItem('spot-wallet');
    return stored ? parseFloat(stored) : 1000;
  });

  const [formData, setFormData] = useState<SpotFormData>({
    symbol: '',
    type: 'BUY',
    entryPrice: '',
    quantity: '',
  });

  const [tradingFee, setTradingFee] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('spot-fee');
      return saved ? parseFloat(saved) : 0.1;
    }
    return 0.1;
  });

  // Platform state using enum
  const [platform, setPlatform] = useState<Platform>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('spot-platform');
      return (saved as Platform) || Platform.BINANCE;
    }
    return Platform.BINANCE;
  });

  const [showFeeSettings, setShowFeeSettings] = useState<boolean>(false);
  const [showPlatformSettings, setShowPlatformSettings] = useState<boolean>(false);
  const [editingWallet, setEditingWallet] = useState<boolean>(false);
  const [tempWallet, setTempWallet] = useState<string>('1000');

  // For now, simplified without auth - can be added later
  const user = null;

  const wsConnections = useRef<Map<number, WebSocket>>(new Map());
  const autoUpdateStatus = useRef<Map<number, boolean>>(new Map());

  // Get platform configuration
  const platformConfig = PLATFORM_CONFIGS[platform];

  // Calculate portfolio stats
  const stats = useMemo(() => {
    const totalValue = positions.reduce((sum, pos) => sum + pos.value, 0);
    const totalCost = positions.reduce((sum, pos) => sum + pos.totalCost, 0);
    const totalPNL = positions.reduce((sum, pos) => sum + (pos.unrealizedPNL || 0), 0);
    const availableBalance = wallet - totalCost;
    const totalPortfolioValue = wallet + totalPNL;

    return {
      totalValue,
      totalCost,
      totalPNL,
      availableBalance,
      totalPortfolioValue,
      totalFund: wallet,
    };
  }, [positions, wallet]);

  // Save to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && positions.length >= 0) {
      localStorage.setItem('spot-positions', JSON.stringify(positions));
    }
  }, [positions]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('spot-wallet', wallet.toString());
    }
  }, [wallet]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('spot-fee', tradingFee.toString());
    }
  }, [tradingFee]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('spot-platform', platform);
    }
  }, [platform]);

  // WebSocket setup for price updates
  useEffect(() => {
    positions.forEach(pos => {
      const prevAutoUpdate = autoUpdateStatus.current.get(pos.id);
      const autoUpdateChanged = prevAutoUpdate !== pos.autoUpdate;
      
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
        }

        const wsUrl = platformConfig.getWebSocketUrl(pos.symbol);
        const ws = new WebSocket(wsUrl);

        ws.onmessage = (event) => {
          try {
            const rawData = JSON.parse(event.data);
            const { price } = platformConfig.parsePriceData(rawData);
            
            if (!isNaN(price) && price > 0) {
              setPositions(prevPositions => {
                return prevPositions.map(p => {
                  if (p.id === pos.id && p.autoUpdate) {
                    const newValue = p.quantity * price;
                    const pnl = newValue - p.totalCost;

                    return {
                      ...p,
                      currentPrice: price,
                      value: newValue,
                      unrealizedPNL: pnl,
                    };
                  }
                  return p;
                });
              });
            }
          } catch (error) {
            console.error('Error parsing WebSocket data:', error);
          }
        };

        ws.onerror = (error) => {
          console.error(`${platformConfig.name} WebSocket error for ${pos.symbol}:`, error);
        };

        ws.onclose = () => {
          wsConnections.current.delete(pos.id);
        };

        wsConnections.current.set(pos.id, ws);
      }
    });

    return () => {
      wsConnections.current.forEach(ws => ws.close());
      wsConnections.current.clear();
      autoUpdateStatus.current.clear();
    };
  }, [positions, platform, platformConfig]);

  const calculateFee = (value: number): number => {
    return value * (tradingFee / 100);
  };

  const addPosition = () => {
    if (!formData.symbol || !formData.entryPrice || !formData.quantity) return;

    const entryPrice = parseFloat(formData.entryPrice);
    const quantity = parseFloat(formData.quantity);
    const value = quantity * entryPrice;
    const fee = calculateFee(value);
    const totalCost = value + fee;

    if (totalCost > stats.availableBalance) {
      alert('Insufficient balance!');
      return;
    }

    const newPosition: SpotPosition = {
      id: Date.now(),
      symbol: formData.symbol.toUpperCase(),
      type: formData.type,
      entryPrice,
      currentPrice: entryPrice,
      quantity,
      value,
      totalCost,
      unrealizedPNL: 0,
      autoUpdate: true,
      totalFees: fee,
      timestamp: Date.now(),
    };

    setPositions([...positions, newPosition]);
    setFormData({ symbol: '', type: 'BUY', entryPrice: '', quantity: '' });
  };

  const closePosition = (posId: number) => {
    const position = positions.find(p => p.id === posId);
    if (position) {
      // Add the current value back to wallet (minus fees)
      const saleValue = position.value;
      const saleFee = calculateFee(saleValue);
      const netProceeds = saleValue - saleFee;
      
      setWallet(prev => prev + netProceeds);
      setPositions(positions.filter(pos => pos.id !== posId));
    }
  };

  const toggleAutoUpdate = (posId: number) => {
    setPositions(positions.map(pos => 
      pos.id === posId ? { ...pos, autoUpdate: !pos.autoUpdate } : pos
    ));
  };

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

  return (
    <div className="bg-gray-900 text-gray-100">
      <div className="max-w-[1600px] mx-auto space-y-4 sm:space-y-6 px-4 lg:px-6 xl:px-8 py-4 lg:py-6">
        
        {/* Header */}
        <div className="text-center space-y-2 py-4">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-3 mb-2">
            <div className="hidden lg:block flex-1"></div>
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent flex-1">
              Spot Trading Manager
            </h1>
            <div className="flex-1 flex justify-center lg:justify-end">
              {user && (
                <div className="flex items-center gap-2 flex-wrap justify-center">
                  <div className="flex items-center gap-1 bg-gray-800 border border-gray-700 rounded px-2 sm:px-3 py-1">
                    <User size={14} className="text-blue-400" />
                    <span className="text-xs text-gray-400 truncate max-w-[150px]">{user.email || 'Anonymous'}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
          <p className="text-gray-400">Spot Trading • Buy & Hold Strategy</p>
          
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
                <span className="text-2xl font-bold text-green-400">${wallet.toFixed(2)}</span>
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
            
            <span className="text-gray-600">|</span>
            
            <button
              onClick={() => setShowPlatformSettings(!showPlatformSettings)}
              className="text-sm text-gray-400 hover:text-gray-200 underline"
            >
              Platform: {platformConfig.name}
            </button>
            {showFeeSettings && (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  value={tradingFee}
                  onChange={(e) => setTradingFee(parseFloat(e.target.value) || 0.1)}
                  className="bg-gray-700 border border-gray-600 rounded px-2 py-1 w-20 text-sm focus:outline-none"
                />
                <span className="text-sm text-gray-400">%</span>
              </div>
            )}
            
            {showPlatformSettings && (
              <div className="flex items-center gap-2">
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value as Platform)}
                  className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm focus:outline-none"
                >
                  <option value={Platform.BINANCE}>Binance</option>
                  <option value={Platform.BINGX}>BingX</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Portfolio Overview */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h3 className="text-lg font-semibold mb-3">Portfolio Overview</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-lg p-4 border border-gray-700">
              <div className="text-gray-400 text-sm mb-1">Available Balance</div>
              <div className="text-2xl font-bold text-green-400">${stats.availableBalance.toFixed(2)}</div>
            </div>
            
            <div className="rounded-lg p-4 border border-gray-700">
              <div className="text-gray-400 text-sm mb-1">Portfolio Value</div>
              <div className="text-2xl font-bold text-blue-400">${stats.totalValue.toFixed(2)}</div>
            </div>
            
            <div className="rounded-lg p-4 border border-gray-700">
              <div className="text-gray-400 text-sm mb-1">Total P&L</div>
              <div className={`text-2xl font-bold ${stats.totalPNL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {stats.totalPNL >= 0 ? '+' : ''}${stats.totalPNL.toFixed(2)}
              </div>
            </div>
            
            <div className="rounded-lg p-4 border border-gray-700">
              <div className="text-gray-400 text-sm mb-1">Total Value</div>
              <div className="text-2xl font-bold text-yellow-400">${stats.totalPortfolioValue.toFixed(2)}</div>
            </div>
          </div>
        </div>

        {/* Add Position Form */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h3 className="text-lg font-semibold mb-3">Add New Position</h3>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Symbol</label>
              <input
                type="text"
                value={formData.symbol}
                onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
                placeholder="BTC, ETH, SOL"
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-1">Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as 'BUY' | 'SELL' })}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-blue-500"
              >
                <option value="BUY">BUY</option>
                <option value="SELL">SELL</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-1">Price ($)</label>
              <input
                type="number"
                step="0.000001"
                value={formData.entryPrice}
                onChange={(e) => setFormData({ ...formData, entryPrice: e.target.value })}
                placeholder="Entry price"
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-1">Quantity</label>
              <input
                type="number"
                step="0.000001"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                placeholder="Amount to buy"
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-blue-500"
              />
            </div>
            
            <div className="flex items-end">
              <button
                onClick={addPosition}
                disabled={!formData.symbol || !formData.entryPrice || !formData.quantity}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-2 rounded font-semibold transition-colors"
              >
                Add Position
              </button>
            </div>
          </div>
          
          {formData.entryPrice && formData.quantity && (
            <div className="mt-4 p-3 bg-gray-700/50 rounded border border-gray-600">
              <div className="text-sm text-gray-300">
                Total Value: ${(parseFloat(formData.entryPrice || '0') * parseFloat(formData.quantity || '0')).toFixed(2)} • 
                Fee: ${calculateFee(parseFloat(formData.entryPrice || '0') * parseFloat(formData.quantity || '0')).toFixed(2)} • 
                Total Cost: ${(parseFloat(formData.entryPrice || '0') * parseFloat(formData.quantity || '0') + calculateFee(parseFloat(formData.entryPrice || '0') * parseFloat(formData.quantity || '0'))).toFixed(2)}
              </div>
            </div>
          )}
        </div>

        {/* Positions Table */}
        {positions.length > 0 && (
          <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-700">
              <h3 className="text-lg font-semibold">Current Positions ({positions.length})</h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-700/50">
                  <tr>
                    <th className="text-left p-3 text-sm font-medium text-gray-300">Symbol</th>
                    <th className="text-left p-3 text-sm font-medium text-gray-300">Type</th>
                    <th className="text-left p-3 text-sm font-medium text-gray-300">Quantity</th>
                    <th className="text-left p-3 text-sm font-medium text-gray-300">Entry Price</th>
                    <th className="text-left p-3 text-sm font-medium text-gray-300">Current Price</th>
                    <th className="text-left p-3 text-sm font-medium text-gray-300">Value</th>
                    <th className="text-left p-3 text-sm font-medium text-gray-300">P&L</th>
                    <th className="text-left p-3 text-sm font-medium text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((pos) => (
                    <tr key={pos.id} className="border-b border-gray-700 hover:bg-gray-700/30">
                      <td className="p-3">
                        <div className="font-bold">{pos.symbol}</div>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          pos.type === 'BUY' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
                        }`}>
                          {pos.type}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="text-sm">{pos.quantity}</div>
                      </td>
                      <td className="p-3">
                        <div className="text-sm">${pos.entryPrice.toFixed(6)}</div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">${pos.currentPrice.toFixed(6)}</span>
                          <button
                            onClick={() => toggleAutoUpdate(pos.id)}
                            className={`transition-colors ${
                              pos.autoUpdate ? 'text-green-400' : 'text-gray-500'
                            }`}
                            title={pos.autoUpdate ? `Auto (${platformConfig.name})` : 'Manual'}
                          >
                            {pos.autoUpdate ? <Wifi size={14} /> : <WifiOff size={14} />}
                          </button>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="text-sm">${pos.value.toFixed(2)}</div>
                      </td>
                      <td className="p-3">
                        <div className={`text-sm font-semibold ${pos.unrealizedPNL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {pos.unrealizedPNL >= 0 ? '+' : ''}${pos.unrealizedPNL.toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-400">
                          {((pos.unrealizedPNL / pos.totalCost) * 100).toFixed(2)}%
                        </div>
                      </td>
                      <td className="p-3">
                        <button
                          onClick={() => closePosition(pos.id)}
                          className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-xs font-semibold transition-colors"
                        >
                          Sell
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Quick Reference */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h3 className="text-lg font-semibold mb-3">Quick Reference</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-300">
            <div>
              <div className="flex items-center gap-2 text-green-400 font-semibold mb-1">
                <TrendingDown size={16} />
                <span>Spot Trading Features</span>
              </div>
              <div className="text-xs text-gray-300">
                Buy and hold cryptocurrency assets with real-time price tracking from {platformConfig.name}.
              </div>
            </div>
            
            <div>
              <div className="text-xs text-gray-300 space-y-1">
                <div>• Trading fee is <strong>auto-deducted</strong> on buy and sell transactions</div>
                <div>• Default: <strong>{tradingFee}%</strong> ({platformConfig.name} spot trading fee)</div>
                <div>• Click the <Wifi size={12} className="inline" /> icon to enable/disable real-time price updates</div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}