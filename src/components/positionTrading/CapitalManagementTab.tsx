import { useState } from 'react';
import { DollarSign, PlusCircle, MinusCircle, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import type { PositionTradingData } from '../../types/positionTrading';

interface CapitalManagementTabProps {
  data: PositionTradingData;
  onUpdateData: (data: PositionTradingData) => void;
}

interface CashFlow {
  id: string;
  date: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'TRADE_BUY' | 'TRADE_SELL';
  amount: number;
  description: string;
  relatedTradeId?: string;
}

export default function CapitalManagementTab({ data, onUpdateData }: CapitalManagementTabProps) {
  const [showAdjustCapital, setShowAdjustCapital] = useState(false);
  const [newCapitalAmount, setNewCapitalAmount] = useState(data.initialCapital);
  const [cashFlowAction, setCashFlowAction] = useState<'DEPOSIT' | 'WITHDRAWAL'>('DEPOSIT');
  const [cashFlowAmount, setCashFlowAmount] = useState(0);
  const [cashFlowDescription, setCashFlowDescription] = useState('');

  // Calculate cash flows from trade history
  const calculateCashFlows = (): CashFlow[] => {
    const flows: CashFlow[] = [];
    
    // Add initial capital as first entry
    flows.push({
      id: 'initial',
      date: data.tradeLogs.length > 0 ? data.tradeLogs[0].date : new Date().toISOString().split('T')[0],
      type: 'DEPOSIT',
      amount: data.initialCapital,
      description: 'Initial Capital'
    });

    // Add all trades as cash flows
    data.tradeLogs.forEach(trade => {
      if (trade.action === 'BUY' || trade.action === 'DCA') {
        flows.push({
          id: `trade-${trade.id}`,
          date: trade.date,
          type: 'TRADE_BUY',
          amount: -(trade.totalValue + trade.fees),
          description: `${trade.action} ${trade.quantity} ${trade.ticker} @ $${trade.price}`,
          relatedTradeId: trade.id
        });
      } else if (trade.action === 'SELL') {
        flows.push({
          id: `trade-${trade.id}`,
          date: trade.date,
          type: 'TRADE_SELL',
          amount: trade.totalValue - trade.fees,
          description: `SELL ${trade.quantity} ${trade.ticker} @ $${trade.price}`,
          relatedTradeId: trade.id
        });
      }
    });

    return flows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const cashFlows = calculateCashFlows();

  // Calculate current metrics
  const totalInvested = data.assets.reduce((sum, asset) => sum + asset.totalInvested, 0);
  const totalCurrentValue = data.assets.reduce((sum, asset) => sum + asset.currentValue, 0);

  const adjustInitialCapital = () => {
    if (newCapitalAmount <= 0) return;

    const updatedData = {
      ...data,
      initialCapital: newCapitalAmount,
      availableCash: newCapitalAmount - totalInvested
    };

    onUpdateData(updatedData);
    setShowAdjustCapital(false);
  };

  const addCashFlow = () => {
    if (cashFlowAmount <= 0 || !cashFlowDescription.trim()) return;

    const amount = cashFlowAction === 'DEPOSIT' ? cashFlowAmount : -cashFlowAmount;
    const newAvailableCash = data.availableCash + amount;

    if (newAvailableCash < 0) {
      alert('Không thể rút tiền nhiều hơn số dư hiện tại!');
      return;
    }

    const updatedData = {
      ...data,
      initialCapital: data.initialCapital + amount,
      availableCash: newAvailableCash
    };

    onUpdateData(updatedData);
    
    // Reset form
    setCashFlowAmount(0);
    setCashFlowDescription('');
  };

  const recalculateCash = () => {
    // Recalculate available cash based on actual trades
    const totalSpentOnTrades = data.tradeLogs
      .filter(trade => trade.action === 'BUY' || trade.action === 'DCA')
      .reduce((sum, trade) => sum + trade.totalValue + trade.fees, 0);
    
    const totalReceivedFromSells = data.tradeLogs
      .filter(trade => trade.action === 'SELL')
      .reduce((sum, trade) => sum + trade.totalValue - trade.fees, 0);

    const newAvailableCash = data.initialCapital - totalSpentOnTrades + totalReceivedFromSells;

    const updatedData = {
      ...data,
      availableCash: Math.max(0, newAvailableCash)
    };

    onUpdateData(updatedData);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-purple-400">Capital Management</h2>
          <p className="text-gray-400">Quản lý vốn ban đầu và theo dõi cash flow</p>
        </div>
        <button
          onClick={recalculateCash}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors"
        >
          <RefreshCw size={16} />
          Recalculate Cash
        </button>
      </div>

      {/* Capital Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-blue-400">Initial Capital</h3>
            <DollarSign size={20} className="text-blue-400" />
          </div>
          <div className="text-2xl font-bold">${data.initialCapital.toLocaleString()}</div>
          <button
            onClick={() => setShowAdjustCapital(!showAdjustCapital)}
            className="text-sm text-blue-400 hover:text-blue-300 mt-1"
          >
            Adjust Capital
          </button>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-green-400">Available Cash</h3>
            <TrendingUp size={20} className="text-green-400" />
          </div>
          <div className="text-2xl font-bold text-green-400">
            ${data.availableCash.toLocaleString()}
          </div>
          <div className="text-sm text-gray-400">
            {((data.availableCash / data.initialCapital) * 100).toFixed(1)}% of capital
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-yellow-400">Invested</h3>
            <TrendingDown size={20} className="text-yellow-400" />
          </div>
          <div className="text-2xl font-bold text-yellow-400">
            ${totalInvested.toLocaleString()}
          </div>
          <div className="text-sm text-gray-400">
            {((totalInvested / data.initialCapital) * 100).toFixed(1)}% deployed
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-purple-400">Portfolio Value</h3>
            <TrendingUp size={20} className="text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-purple-400">
            ${totalCurrentValue.toLocaleString()}
          </div>
          <div className={`text-sm ${totalCurrentValue >= totalInvested ? 'text-green-400' : 'text-red-400'}`}>
            {totalCurrentValue >= totalInvested ? '+' : ''}${(totalCurrentValue - totalInvested).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Adjust Initial Capital */}
      {showAdjustCapital && (
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h3 className="text-lg font-semibold mb-4">Adjust Initial Capital</h3>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm text-gray-400 mb-1">New Initial Capital ($)</label>
              <input
                type="number"
                value={newCapitalAmount}
                onChange={(e) => setNewCapitalAmount(parseFloat(e.target.value) || 0)}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-purple-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={adjustInitialCapital}
                className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded transition-colors"
              >
                Update
              </button>
              <button
                onClick={() => setShowAdjustCapital(false)}
                className="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
          <div className="mt-3 text-sm text-gray-400">
            Current: ${data.initialCapital.toLocaleString()} → New: ${newCapitalAmount.toLocaleString()}
          </div>
        </div>
      )}

      {/* Add/Remove Cash */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h3 className="text-lg font-semibold mb-4">Add/Remove Cash</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Action</label>
            <select
              value={cashFlowAction}
              onChange={(e) => setCashFlowAction(e.target.value as 'DEPOSIT' | 'WITHDRAWAL')}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-purple-500"
            >
              <option value="DEPOSIT">Deposit</option>
              <option value="WITHDRAWAL">Withdrawal</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm text-gray-400 mb-1">Amount ($)</label>
            <input
              type="number"
              value={cashFlowAmount || ''}
              onChange={(e) => setCashFlowAmount(parseFloat(e.target.value) || 0)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-purple-500"
            />
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-sm text-gray-400 mb-1">Description</label>
            <input
              type="text"
              value={cashFlowDescription}
              onChange={(e) => setCashFlowDescription(e.target.value)}
              placeholder="Additional deposit, profit taking, etc."
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-purple-500"
            />
          </div>
          
          <div className="flex items-end">
            <button
              onClick={addCashFlow}
              disabled={!cashFlowAmount || !cashFlowDescription.trim()}
              className={`w-full px-4 py-2 rounded font-semibold transition-colors ${
                cashFlowAction === 'DEPOSIT'
                  ? 'bg-green-600 hover:bg-green-700 disabled:bg-gray-600'
                  : 'bg-red-600 hover:bg-red-700 disabled:bg-gray-600'
              } disabled:cursor-not-allowed`}
            >
              {cashFlowAction === 'DEPOSIT' ? (
                <>
                  <PlusCircle size={16} className="inline mr-2" />
                  Add Cash
                </>
              ) : (
                <>
                  <MinusCircle size={16} className="inline mr-2" />
                  Remove Cash
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Cash Flow History */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h3 className="text-lg font-semibold mb-4">Cash Flow History</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-gray-400 text-sm border-b border-gray-700">
                <th className="pb-3">Date</th>
                <th className="pb-3">Type</th>
                <th className="pb-3">Amount</th>
                <th className="pb-3">Running Balance</th>
                <th className="pb-3">Description</th>
              </tr>
            </thead>
            <tbody>
              {cashFlows.map((flow, index) => {
                const runningBalance = cashFlows
                  .slice(0, index + 1)
                  .reduce((sum, f) => sum + f.amount, 0);
                
                return (
                  <tr key={flow.id} className="border-b border-gray-700/50">
                    <td className="py-3 text-sm">{flow.date}</td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        flow.type === 'DEPOSIT' ? 'bg-green-900/30 text-green-400' :
                        flow.type === 'WITHDRAWAL' ? 'bg-red-900/30 text-red-400' :
                        flow.type === 'TRADE_BUY' ? 'bg-blue-900/30 text-blue-400' :
                        'bg-yellow-900/30 text-yellow-400'
                      }`}>
                        {flow.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className={`py-3 font-semibold ${flow.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {flow.amount >= 0 ? '+' : ''}${flow.amount.toLocaleString()}
                    </td>
                    <td className="py-3 font-semibold">
                      ${runningBalance.toLocaleString()}
                    </td>
                    <td className="py-3 text-sm text-gray-400">{flow.description}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Capital Allocation Chart */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h3 className="text-lg font-semibold mb-4">Capital Allocation</h3>
        <div className="space-y-4">
          {/* Visual allocation bar */}
          <div className="w-full bg-gray-700 rounded-lg h-8 flex overflow-hidden">
            <div 
              className="bg-green-500 flex items-center justify-center text-white text-sm font-semibold"
              style={{ width: `${(data.availableCash / data.initialCapital) * 100}%` }}
            >
              {data.availableCash > 0 && `Cash ${((data.availableCash / data.initialCapital) * 100).toFixed(0)}%`}
            </div>
            <div 
              className="bg-blue-500 flex items-center justify-center text-white text-sm font-semibold"
              style={{ width: `${(totalInvested / data.initialCapital) * 100}%` }}
            >
              {totalInvested > 0 && `Invested ${((totalInvested / data.initialCapital) * 100).toFixed(0)}%`}
            </div>
          </div>

          {/* Allocation details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400">Available Cash:</span>
                <span className="font-semibold text-green-400">${data.availableCash.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Invested Amount:</span>
                <span className="font-semibold text-blue-400">${totalInvested.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-t border-gray-600 pt-2">
                <span className="text-gray-400">Total Capital:</span>
                <span className="font-semibold">${data.initialCapital.toLocaleString()}</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400">Cash Utilization:</span>
                <span className="font-semibold">{((totalInvested / data.initialCapital) * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Portfolio P&L:</span>
                <span className={`font-semibold ${totalCurrentValue >= totalInvested ? 'text-green-400' : 'text-red-400'}`}>
                  {totalCurrentValue >= totalInvested ? '+' : ''}${(totalCurrentValue - totalInvested).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between border-t border-gray-600 pt-2">
                <span className="text-gray-400">Total Portfolio Value:</span>
                <span className="font-semibold text-purple-400">
                  ${(data.availableCash + totalCurrentValue).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}