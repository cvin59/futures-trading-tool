import { useState, useMemo } from 'react';
import { 
  TrendingDown, 
  DollarSign, 
  Target, 
  AlertTriangle, 
  Calendar, 
  TrendingUp,
  Settings,
  BarChart3,
  CheckCircle,
  Clock,
  Zap
} from 'lucide-react';
import type { PositionTradingData } from '../../types/positionTrading';

interface SmartDCATabProps {
  data: PositionTradingData;
  onUpdateData: (data: PositionTradingData) => void;
}

interface SmartDCAConfig {
  totalCapital: number;
  duration: number; // months
  entryPrice: number;
  ticker: string;
  fixedDCAPercent: number; // 60% default
  dipBuyingPercent: number; // 40% default
  triggerLevels: {
    level1: number; // -15%
    level2: number; // -25%
    level3: number; // -35%
    level4: number; // -45%
  };
  dipAllocation: {
    level1: number; // 20%
    level2: number; // 25%
    level3: number; // 30%
    level4: number; // 25%
  };
}

interface DCAExecution {
  id: string;
  date: string;
  type: 'FIXED' | 'DIP';
  level?: string;
  amount: number;
  price: number;
  quantity: number;
  triggerCondition?: string;
  notes?: string;
}

export default function SmartDCATab({ data, onUpdateData }: SmartDCATabProps) {
  const [activeConfig, setActiveConfig] = useState<SmartDCAConfig>({
    totalCapital: 10000,
    duration: 12,
    entryPrice: 60000,
    ticker: 'BTC',
    fixedDCAPercent: 60,
    dipBuyingPercent: 40,
    triggerLevels: {
      level1: -15,
      level2: -25,
      level3: -35,
      level4: -45
    },
    dipAllocation: {
      level1: 20,
      level2: 25,
      level3: 30,
      level4: 25
    }
  });

  const [showConfig, setShowConfig] = useState(false);
  const [dcaExecutions, setDCAExecutions] = useState<DCAExecution[]>([]);
  const [currentPrice, setCurrentPrice] = useState(activeConfig.entryPrice);

  // Calculate DCA metrics
  const dcaMetrics = useMemo(() => {
    const fixedAmount = activeConfig.totalCapital * (activeConfig.fixedDCAPercent / 100);
    const dipAmount = activeConfig.totalCapital * (activeConfig.dipBuyingPercent / 100);
    const monthlyFixed = fixedAmount / activeConfig.duration;

    // Calculate trigger prices
    const triggerPrices = {
      level1: activeConfig.entryPrice * (1 + activeConfig.triggerLevels.level1 / 100),
      level2: activeConfig.entryPrice * (1 + activeConfig.triggerLevels.level2 / 100),
      level3: activeConfig.entryPrice * (1 + activeConfig.triggerLevels.level3 / 100),
      level4: activeConfig.entryPrice * (1 + activeConfig.triggerLevels.level4 / 100)
    };

    // Calculate dip amounts
    const dipAmounts = {
      level1: dipAmount * (activeConfig.dipAllocation.level1 / 100),
      level2: dipAmount * (activeConfig.dipAllocation.level2 / 100),
      level3: dipAmount * (activeConfig.dipAllocation.level3 / 100),
      level4: dipAmount * (activeConfig.dipAllocation.level4 / 100)
    };

    // Check which triggers are active
    const currentDropPercent = ((currentPrice - activeConfig.entryPrice) / activeConfig.entryPrice) * 100;
    const activeTriggers = {
      level1: currentDropPercent <= activeConfig.triggerLevels.level1,
      level2: currentDropPercent <= activeConfig.triggerLevels.level2,
      level3: currentDropPercent <= activeConfig.triggerLevels.level3,
      level4: currentDropPercent <= activeConfig.triggerLevels.level4
    };

    // Calculate total spent and holdings
    const totalSpent = dcaExecutions.reduce((sum, execution) => sum + execution.amount, 0);
    const totalQuantity = dcaExecutions.reduce((sum, execution) => sum + execution.quantity, 0);
    const avgPrice = totalQuantity > 0 ? totalSpent / totalQuantity : 0;
    const currentValue = totalQuantity * currentPrice;
    const pnl = currentValue - totalSpent;
    const pnlPercent = totalSpent > 0 ? (pnl / totalSpent) * 100 : 0;

    return {
      fixedAmount,
      dipAmount,
      monthlyFixed,
      triggerPrices,
      dipAmounts,
      activeTriggers,
      currentDropPercent,
      totalSpent,
      totalQuantity,
      avgPrice,
      currentValue,
      pnl,
      pnlPercent
    };
  }, [activeConfig, dcaExecutions, currentPrice]);

  const executeFixedDCA = () => {
    const execution: DCAExecution = {
      id: Date.now().toString(),
      date: new Date().toISOString().split('T')[0],
      type: 'FIXED',
      amount: dcaMetrics.monthlyFixed,
      price: currentPrice,
      quantity: dcaMetrics.monthlyFixed / currentPrice,
      notes: `Monthly Fixed DCA - Month ${dcaExecutions.filter(e => e.type === 'FIXED').length + 1}`
    };
    
    setDCAExecutions(prev => [...prev, execution]);
  };

  const executeDipBuy = (level: 'level1' | 'level2' | 'level3' | 'level4') => {
    const execution: DCAExecution = {
      id: Date.now().toString(),
      date: new Date().toISOString().split('T')[0],
      type: 'DIP',
      level: level.toUpperCase(),
      amount: dcaMetrics.dipAmounts[level],
      price: currentPrice,
      quantity: dcaMetrics.dipAmounts[level] / currentPrice,
      triggerCondition: `${activeConfig.triggerLevels[level]}% drop triggered`,
      notes: `Dip buying at ${level} - ${dcaMetrics.currentDropPercent.toFixed(1)}% from entry`
    };
    
    setDCAExecutions(prev => [...prev, execution]);
  };

  return (
    <div className="space-y-6">
      {/* Header & Config */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-purple-400">Smart DCA Strategy</h2>
          <p className="text-gray-400">60% Fixed DCA + 40% Opportunistic Dip Buying</p>
        </div>
        <button
          onClick={() => setShowConfig(!showConfig)}
          className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg transition-colors"
        >
          <Settings size={16} />
          Configure
        </button>
      </div>

      {/* Configuration Panel */}
      {showConfig && (
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-lg font-semibold mb-4">Strategy Configuration</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Total Capital ($)</label>
              <input
                type="number"
                value={activeConfig.totalCapital}
                onChange={(e) => setActiveConfig({
                  ...activeConfig,
                  totalCapital: parseFloat(e.target.value) || 0
                })}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-purple-500"
              />
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-1">Duration (Months)</label>
              <input
                type="number"
                value={activeConfig.duration}
                onChange={(e) => setActiveConfig({
                  ...activeConfig,
                  duration: parseFloat(e.target.value) || 0
                })}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-purple-500"
              />
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-1">Entry Price ($)</label>
              <input
                type="number"
                value={activeConfig.entryPrice}
                onChange={(e) => setActiveConfig({
                  ...activeConfig,
                  entryPrice: parseFloat(e.target.value) || 0
                })}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-purple-500"
              />
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-1">Ticker</label>
              <input
                type="text"
                value={activeConfig.ticker}
                onChange={(e) => setActiveConfig({
                  ...activeConfig,
                  ticker: e.target.value.toUpperCase()
                })}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-purple-500"
              />
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-1">Current Price ($)</label>
              <input
                type="number"
                value={currentPrice}
                onChange={(e) => setCurrentPrice(parseFloat(e.target.value) || 0)}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Strategy Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-blue-400">Fixed DCA (60%)</h3>
            <Calendar size={20} className="text-blue-400" />
          </div>
          <div className="text-2xl font-bold">${dcaMetrics.fixedAmount.toLocaleString()}</div>
          <div className="text-sm text-gray-400">
            ${dcaMetrics.monthlyFixed.toFixed(0)}/month × {activeConfig.duration} months
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-yellow-400">Dip Buying (40%)</h3>
            <Zap size={20} className="text-yellow-400" />
          </div>
          <div className="text-2xl font-bold">${dcaMetrics.dipAmount.toLocaleString()}</div>
          <div className="text-sm text-gray-400">
            4 levels • ${dcaMetrics.dipAmounts.level1.toFixed(0)} to ${dcaMetrics.dipAmounts.level3.toFixed(0)} each
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-green-400">Current Performance</h3>
            <BarChart3 size={20} className="text-green-400" />
          </div>
          <div className={`text-2xl font-bold ${dcaMetrics.pnlPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {dcaMetrics.pnlPercent >= 0 ? '+' : ''}{dcaMetrics.pnlPercent.toFixed(1)}%
          </div>
          <div className="text-sm text-gray-400">
            ${dcaMetrics.totalSpent.toLocaleString()} invested
          </div>
        </div>
      </div>

      {/* Current Market Status */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Target size={20} />
          Market Status & Triggers
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Current Price Info */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-400">Current Price</span>
              <span className="text-2xl font-bold">${currentPrice.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-400">Entry Price</span>
              <span className="font-semibold">${activeConfig.entryPrice.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Change from Entry</span>
              <span className={`font-semibold ${dcaMetrics.currentDropPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {dcaMetrics.currentDropPercent >= 0 ? '+' : ''}{dcaMetrics.currentDropPercent.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Trigger Levels */}
          <div>
            <h4 className="font-semibold mb-3">Dip Buying Triggers</h4>
            <div className="space-y-2">
              {Object.entries(dcaMetrics.triggerPrices).map(([level, price]) => {
                const isActive = dcaMetrics.activeTriggers[level as keyof typeof dcaMetrics.activeTriggers];
                const levelKey = level as keyof typeof activeConfig.triggerLevels;
                return (
                  <div key={level} className={`flex items-center justify-between p-2 rounded ${isActive ? 'bg-yellow-900/30 border border-yellow-500/30' : 'bg-gray-700/50'}`}>
                    <div className="flex items-center gap-2">
                      {isActive ? (
                        <AlertTriangle size={16} className="text-yellow-400" />
                      ) : (
                        <Clock size={16} className="text-gray-400" />
                      )}
                      <span className="font-medium">{level.toUpperCase()}</span>
                      <span className="text-sm text-gray-400">
                        ({activeConfig.triggerLevels[levelKey]}%)
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">${price.toLocaleString()}</div>
                      {isActive && (
                        <button
                          onClick={() => executeDipBuy(levelKey)}
                          className="text-xs bg-yellow-600 hover:bg-yellow-700 px-2 py-1 rounded mt-1 transition-colors"
                        >
                          Execute ${dcaMetrics.dipAmounts[levelKey].toFixed(0)}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          onClick={executeFixedDCA}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold transition-colors"
        >
          <Calendar size={16} />
          Execute Monthly DCA (${dcaMetrics.monthlyFixed.toFixed(0)})
        </button>
        
        <button
          className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 px-6 py-3 rounded-lg font-semibold transition-colors"
        >
          <TrendingUp size={16} />
          Update Current Price
        </button>
      </div>

      {/* Execution History */}
      {dcaExecutions.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h3 className="text-lg font-semibold mb-4">Execution History</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-gray-400 text-sm border-b border-gray-700">
                  <th className="pb-3">Date</th>
                  <th className="pb-3">Type</th>
                  <th className="pb-3">Level</th>
                  <th className="pb-3">Amount</th>
                  <th className="pb-3">Price</th>
                  <th className="pb-3">Quantity</th>
                  <th className="pb-3">Notes</th>
                </tr>
              </thead>
              <tbody>
                {dcaExecutions.map(execution => (
                  <tr key={execution.id} className="border-b border-gray-700/50">
                    <td className="py-3 text-sm">{execution.date}</td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        execution.type === 'FIXED' 
                          ? 'bg-blue-900/30 text-blue-400'
                          : 'bg-yellow-900/30 text-yellow-400'
                      }`}>
                        {execution.type}
                      </span>
                    </td>
                    <td className="py-3 text-sm">{execution.level || '-'}</td>
                    <td className="py-3 font-semibold">${execution.amount.toFixed(0)}</td>
                    <td className="py-3">${execution.price.toLocaleString()}</td>
                    <td className="py-3">{execution.quantity.toFixed(6)}</td>
                    <td className="py-3 text-sm text-gray-400">{execution.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Portfolio Summary */}
      {dcaExecutions.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h3 className="text-lg font-semibold mb-4">Portfolio Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-gray-400 text-sm">Total Invested</div>
              <div className="text-xl font-bold">${dcaMetrics.totalSpent.toLocaleString()}</div>
            </div>
            <div className="text-center">
              <div className="text-gray-400 text-sm">Holdings</div>
              <div className="text-xl font-bold">{dcaMetrics.totalQuantity.toFixed(6)} {activeConfig.ticker}</div>
            </div>
            <div className="text-center">
              <div className="text-gray-400 text-sm">Avg Price</div>
              <div className="text-xl font-bold">${dcaMetrics.avgPrice.toLocaleString()}</div>
            </div>
            <div className="text-center">
              <div className="text-gray-400 text-sm">Current Value</div>
              <div className="text-xl font-bold">${dcaMetrics.currentValue.toLocaleString()}</div>
            </div>
          </div>
        </div>
      )}

      {/* Strategy Rules Reference */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h3 className="text-lg font-semibold mb-4">Smart DCA Rules</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold text-blue-400 mb-2">Fixed DCA (60% Capital)</h4>
            <div className="space-y-1 text-sm">
              <div>• ${dcaMetrics.monthlyFixed.toFixed(0)} every month</div>
              <div>• Buy on schedule regardless of price</div>
              <div>• "Set and forget" approach</div>
              <div>• Removes emotional decisions</div>
            </div>
          </div>
          
          <div>
            <h4 className="font-semibold text-yellow-400 mb-2">Dip Buying (40% Capital)</h4>
            <div className="space-y-1 text-sm">
              <div>• Level 1 @ -15%: ${dcaMetrics.dipAmounts.level1.toFixed(0)} (20%)</div>
              <div>• Level 2 @ -25%: ${dcaMetrics.dipAmounts.level2.toFixed(0)} (25%)</div>
              <div>• Level 3 @ -35%: ${dcaMetrics.dipAmounts.level3.toFixed(0)} (30%)</div>
              <div>• Level 4 @ -45%: ${dcaMetrics.dipAmounts.level4.toFixed(0)} (25%)</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}