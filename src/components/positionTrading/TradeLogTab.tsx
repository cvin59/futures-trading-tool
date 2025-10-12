import { useState } from 'react';
import { Edit2, Trash2, Download, Filter, ArrowUpDown } from 'lucide-react';
import type { PositionTradingData, TradeLog } from '../../types/positionTrading';

interface TradeLogTabProps {
  data: PositionTradingData;
  onUpdateData: (newData: PositionTradingData) => void;
}

type SortField = 'date' | 'ticker' | 'action' | 'price' | 'quantity' | 'totalValue';
type SortOrder = 'asc' | 'desc';

export default function TradeLogTab({ data, onUpdateData }: TradeLogTabProps) {
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [filterAction, setFilterAction] = useState<'ALL' | 'BUY' | 'SELL' | 'DCA'>('ALL');
  const [filterTicker, setFilterTicker] = useState('');
  const [editingTrade, setEditingTrade] = useState<TradeLog | null>(null);

  // Get unique tickers for filter
  const uniqueTickers = Array.from(new Set(data.tradeLogs.map(trade => trade.ticker))).sort();

  // Filter and sort trades
  const filteredAndSortedTrades = data.tradeLogs
    .filter(trade => {
      if (filterAction !== 'ALL' && trade.action !== filterAction) return false;
      if (filterTicker && trade.ticker !== filterTicker) return false;
      return true;
    })
    .sort((a, b) => {
      let aValue: string | number = a[sortField];
      let bValue: string | number = b[sortField];
      
      if (sortField === 'date') {
        aValue = new Date(a.date).getTime();
        bValue = new Date(b.date).getTime();
      }
      
      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const deleteTrade = (tradeId: string) => {
    if (confirm('Bạn có chắc muốn xóa giao dịch này?')) {
      const tradeToDelete = data.tradeLogs.find(trade => trade.id === tradeId);
      if (!tradeToDelete) return;

      const updatedTradeLogs = data.tradeLogs.filter(trade => trade.id !== tradeId);
      
      // Find all trades for the same asset
      const assetTrades = updatedTradeLogs.filter(trade => trade.ticker === tradeToDelete.ticker);
      
      let updatedAssets = [...data.assets];
      let updatedTakeProfitLevels = [...data.takeProfitLevels];
      let updatedDcaLevels = [...data.dcaLevels];
      
      if (assetTrades.length === 0) {
        // Remove the entire asset if no more trades exist
        updatedAssets = data.assets.filter(asset => asset.ticker !== tradeToDelete.ticker);
        updatedTakeProfitLevels = data.takeProfitLevels.filter(tp => tp.ticker !== tradeToDelete.ticker);
        updatedDcaLevels = data.dcaLevels.filter(dca => dca.ticker !== tradeToDelete.ticker);
      } else {
        // Recalculate asset data based on remaining trades
        const assetIndex = data.assets.findIndex(asset => asset.ticker === tradeToDelete.ticker);
        if (assetIndex !== -1) {
          const buyTrades = assetTrades.filter(trade => trade.action === 'BUY' || trade.action === 'DCA');
          const sellTrades = assetTrades.filter(trade => trade.action === 'SELL');
          
          const totalBought = buyTrades.reduce((sum, trade) => sum + trade.quantity, 0);
          const totalSold = sellTrades.reduce((sum, trade) => sum + trade.quantity, 0);
          const currentQuantity = totalBought - totalSold;
          
          if (currentQuantity <= 0) {
            // Remove asset if quantity becomes 0 or negative
            updatedAssets = data.assets.filter(asset => asset.ticker !== tradeToDelete.ticker);
            updatedTakeProfitLevels = data.takeProfitLevels.filter(tp => tp.ticker !== tradeToDelete.ticker);
            updatedDcaLevels = data.dcaLevels.filter(dca => dca.ticker !== tradeToDelete.ticker);
          } else {
            // Recalculate average buy price and update asset
            const totalCost = buyTrades.reduce((sum, trade) => sum + (trade.quantity * trade.price), 0);
            const averageBuyPrice = totalCost / totalBought;
            
            const currentAsset = data.assets[assetIndex];
            const currentValue = currentQuantity * currentAsset.currentMarketPrice;
            const totalInvested = currentQuantity * averageBuyPrice;
            const unrealizedPnL = currentValue - totalInvested;
            const unrealizedPnLPercent = (unrealizedPnL / totalInvested) * 100;
            
            updatedAssets[assetIndex] = {
              ...currentAsset,
              currentQuantity,
              averageBuyPrice,
              totalInvested,
              currentValue,
              unrealizedPnL,
              unrealizedPnLPercent,
              status: unrealizedPnL >= 0 ? 'PROFIT' : 'LOSS'
            };
          }
        }
      }

      onUpdateData({
        ...data,
        tradeLogs: updatedTradeLogs,
        assets: updatedAssets,
        takeProfitLevels: updatedTakeProfitLevels,
        dcaLevels: updatedDcaLevels
      });
    }
  };;

  const updateTrade = (updatedTrade: TradeLog) => {
    const updatedTradeLogs = data.tradeLogs.map(trade =>
      trade.id === updatedTrade.id ? updatedTrade : trade
    );
    onUpdateData({
      ...data,
      tradeLogs: updatedTradeLogs
    });
    setEditingTrade(null);
  };

  const exportToCSV = () => {
    const headers = ['Ngày', 'Ticker', 'Hành Động', 'Giá', 'Số Lượng', 'Tổng Giá Trị', 'Phí', 'Ghi Chú'];
    const csvContent = [
      headers.join(','),
      ...filteredAndSortedTrades.map(trade =>
        [
          trade.date,
          trade.ticker,
          trade.action,
          trade.price,
          trade.quantity,
          trade.totalValue,
          trade.fees,
          `"${trade.notes}"`
        ].join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `trade-log-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case 'BUY': return 'bg-green-900 text-green-300';
      case 'SELL': return 'bg-red-900 text-red-300';
      case 'DCA': return 'bg-blue-900 text-blue-300';
      default: return 'bg-gray-900 text-gray-300';
    }
  };

  // Calculate summary stats
  const totalBuyValue = filteredAndSortedTrades
    .filter(t => t.action === 'BUY' || t.action === 'DCA')
    .reduce((sum, t) => sum + t.totalValue + t.fees, 0);
  
  const totalSellValue = filteredAndSortedTrades
    .filter(t => t.action === 'SELL')
    .reduce((sum, t) => sum + t.totalValue - t.fees, 0);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-gray-400 text-sm mb-1">Tổng Giao Dịch</div>
          <div className="text-2xl font-bold text-blue-400">{filteredAndSortedTrades.length}</div>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-gray-400 text-sm mb-1">Tổng Mua</div>
          <div className="text-2xl font-bold text-green-400">${totalBuyValue.toLocaleString()}</div>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-gray-400 text-sm mb-1">Tổng Bán</div>
          <div className="text-2xl font-bold text-red-400">${totalSellValue.toLocaleString()}</div>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-gray-400 text-sm mb-1">Net Flow</div>
          <div className={`text-2xl font-bold ${(totalSellValue - totalBuyValue) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            ${(totalSellValue - totalBuyValue).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Filters and Export */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-gray-400" />
              <span className="text-sm text-gray-400">Filters:</span>
            </div>
            
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value as 'ALL' | 'BUY' | 'SELL' | 'DCA')}
              className="bg-gray-700 border border-gray-600 rounded px-3 py-1 text-sm focus:outline-none focus:border-purple-500"
            >
              <option value="ALL">Tất cả hành động</option>
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
              <option value="DCA">DCA</option>
            </select>
            
            <select
              value={filterTicker}
              onChange={(e) => setFilterTicker(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded px-3 py-1 text-sm focus:outline-none focus:border-purple-500"
            >
              <option value="">Tất cả tài sản</option>
              {uniqueTickers.map(ticker => (
                <option key={ticker} value={ticker}>{ticker}</option>
              ))}
            </select>
            
            <button
              onClick={() => {
                setFilterAction('ALL');
                setFilterTicker('');
              }}
              className="text-sm text-gray-400 hover:text-gray-200 underline"
            >
              Clear filters
            </button>
          </div>
          
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-sm font-semibold transition-colors"
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Trade Log Table */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold">
            Trade Log ({filteredAndSortedTrades.length} giao dịch)
          </h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700/50">
              <tr>
                {[
                  { key: 'date', label: 'Ngày' },
                  { key: 'ticker', label: 'Ticker' },
                  { key: 'action', label: 'Hành Động' },
                  { key: 'price', label: 'Giá ($)' },
                  { key: 'quantity', label: 'Số Lượng' },
                  { key: 'totalValue', label: 'Tổng Giá Trị ($)' },
                  { key: 'fees', label: 'Phí ($)' },
                  { key: 'notes', label: 'Ghi Chú' },
                  { key: 'actions', label: 'Actions' }
                ].map(column => (
                  <th key={column.key} className="text-left p-3 text-sm font-medium text-gray-300">
                    {column.key !== 'notes' && column.key !== 'actions' ? (
                      <button
                        onClick={() => handleSort(column.key as SortField)}
                        className="flex items-center gap-1 hover:text-white transition-colors"
                      >
                        {column.label}
                        <ArrowUpDown size={12} />
                      </button>
                    ) : (
                      column.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedTrades.map(trade => (
                <tr key={trade.id} className="border-b border-gray-700 hover:bg-gray-700/30">
                  <td className="p-3 text-sm">{trade.date}</td>
                  <td className="p-3 font-semibold">{trade.ticker}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${getActionBadgeColor(trade.action)}`}>
                      {trade.action}
                    </span>
                  </td>
                  <td className="p-3 text-sm font-mono">${trade.price.toFixed(6)}</td>
                  <td className="p-3 text-sm font-mono">{trade.quantity.toFixed(6)}</td>
                  <td className="p-3 text-sm font-mono">${trade.totalValue.toFixed(2)}</td>
                  <td className="p-3 text-sm font-mono">${trade.fees.toFixed(2)}</td>
                  <td className="p-3 text-sm max-w-xs truncate" title={trade.notes}>
                    {trade.notes || '-'}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditingTrade(trade)}
                        className="text-blue-400 hover:text-blue-300 transition-colors"
                        title="Edit"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => deleteTrade(trade.id)}
                        className="text-red-400 hover:text-red-300 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredAndSortedTrades.length === 0 && (
            <div className="text-center text-gray-400 py-8">
              <p>Không có giao dịch nào phù hợp với filter</p>
            </div>
          )}
        </div>
      </div>

      {/* Edit Trade Modal */}
      {editingTrade && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-700">
            <h3 className="text-lg font-semibold mb-4">Chỉnh Sửa Giao Dịch</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Ngày</label>
                <input
                  type="date"
                  value={editingTrade.date}
                  onChange={(e) => setEditingTrade({ ...editingTrade, date: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-purple-500"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">Ticker</label>
                <input
                  type="text"
                  value={editingTrade.ticker}
                  onChange={(e) => setEditingTrade({ ...editingTrade, ticker: e.target.value.toUpperCase() })}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-purple-500"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">Hành Động</label>
                <select
                  value={editingTrade.action}
                  onChange={(e) => setEditingTrade({ ...editingTrade, action: e.target.value as 'BUY' | 'SELL' | 'DCA' })}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-purple-500"
                >
                  <option value="BUY">BUY</option>
                  <option value="SELL">SELL</option>
                  <option value="DCA">DCA</option>
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Giá ($)</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={editingTrade.price}
                    onChange={(e) => {
                      const price = parseFloat(e.target.value) || 0;
                      setEditingTrade({ 
                        ...editingTrade, 
                        price,
                        totalValue: price * editingTrade.quantity
                      });
                    }}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-purple-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Số Lượng</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={editingTrade.quantity}
                    onChange={(e) => {
                      const quantity = parseFloat(e.target.value) || 0;
                      setEditingTrade({ 
                        ...editingTrade, 
                        quantity,
                        totalValue: editingTrade.price * quantity
                      });
                    }}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">Phí ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editingTrade.fees}
                  onChange={(e) => setEditingTrade({ ...editingTrade, fees: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-purple-500"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">Ghi Chú</label>
                <textarea
                  value={editingTrade.notes}
                  onChange={(e) => setEditingTrade({ ...editingTrade, notes: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-purple-500 h-20 resize-none"
                  placeholder="Lý do mua/bán..."
                />
              </div>
              
              <div className="text-sm text-gray-400 bg-gray-700/50 p-2 rounded">
                Tổng giá trị: ${editingTrade.totalValue.toFixed(2)}
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => updateTrade(editingTrade)}
                className="flex-1 bg-green-600 hover:bg-green-700 px-4 py-2 rounded font-semibold transition-colors"
              >
                Lưu
              </button>
              <button
                onClick={() => setEditingTrade(null)}
                className="flex-1 bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded font-semibold transition-colors"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}