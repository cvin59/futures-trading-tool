import { PieChart, TrendingUp, TrendingDown, DollarSign, Target, AlertTriangle } from 'lucide-react';
import type { PositionTradingData, PortfolioMetrics } from '../../types/positionTrading';

interface DashboardTabProps {
  data: PositionTradingData;
  portfolioMetrics: PortfolioMetrics;
}

export default function DashboardTab({ data, portfolioMetrics }: DashboardTabProps) {
  // Portfolio allocation for pie chart
  const portfolioAllocation = data.assets.map(asset => ({
    name: asset.ticker,
    value: asset.portfolioWeight,
    amount: asset.currentValue,
    color: asset.status === 'PROFIT' ? '#10b981' : asset.status === 'LOSS' ? '#ef4444' : '#6b7280'
  }));

  return (
    <div className="space-y-6">
      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-gray-400 text-sm mb-1">Tổng Vốn Ban Đầu</div>
              <div className="text-2xl font-bold text-blue-400">
                ${portfolioMetrics.totalInitialCapital.toLocaleString()}
              </div>
            </div>
            <DollarSign size={24} className="text-blue-400" />
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-gray-400 text-sm mb-1">Giá Trị Hiện Tại</div>
              <div className="text-2xl font-bold text-green-400">
                ${portfolioMetrics.totalCurrentValue.toLocaleString()}
              </div>
            </div>
            <TrendingUp size={24} className="text-green-400" />
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-gray-400 text-sm mb-1">Tổng P&L</div>
              <div className={`text-2xl font-bold ${portfolioMetrics.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {portfolioMetrics.totalPnL >= 0 ? '+' : ''}${portfolioMetrics.totalPnL.toLocaleString()}
              </div>
              <div className={`text-sm ${portfolioMetrics.totalPnLPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {portfolioMetrics.totalPnLPercent >= 0 ? '+' : ''}{portfolioMetrics.totalPnLPercent.toFixed(2)}%
              </div>
            </div>
            {portfolioMetrics.totalPnL >= 0 ? 
              <TrendingUp size={24} className="text-green-400" /> : 
              <TrendingDown size={24} className="text-red-400" />
            }
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-gray-400 text-sm mb-1">Tiền Mặt Còn</div>
              <div className="text-2xl font-bold text-yellow-400">
                ${portfolioMetrics.availableCash.toLocaleString()}
              </div>
              <div className="text-sm text-gray-400">
                Đã đầu tư: ${portfolioMetrics.totalInvested.toLocaleString()}
              </div>
            </div>
            <DollarSign size={24} className="text-yellow-400" />
          </div>
        </div>
      </div>

      {/* Portfolio Allocation & Performance Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Portfolio Allocation */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 h-[400px] flex flex-col">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <PieChart size={20} />
            Phân Bổ Portfolio
          </h3>
          
          {data.assets.length > 0 ? (
            <div className="space-y-3 flex-1 overflow-y-auto">
              {portfolioAllocation.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: item.color }}
                    ></div>
                    <span className="font-medium">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{item.value.toFixed(1)}%</div>
                    <div className="text-sm text-gray-400">${item.amount.toLocaleString()}</div>
                  </div>
                </div>
              ))}
              
              {/* Rebalance Warning */}
              {portfolioAllocation.some(item => item.value > 40) && (
                <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-500/30 rounded flex items-center gap-2">
                  <AlertTriangle size={16} className="text-yellow-400 flex-shrink-0" />
                  <span className="text-yellow-300 text-sm">
                    Có tài sản chiếm {'>'}40% portfolio. Cân nhắc rebalance!
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-gray-400 py-8">
              <PieChart size={48} className="mx-auto mb-2 opacity-50" />
              <p>Chưa có tài sản nào</p>
              <p className="text-sm">Thêm giao dịch đầu tiên để bắt đầu</p>
            </div>
          )}
        </div>

        {/* Quick Performance Summary */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 h-[400px] flex flex-col">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Target size={20} />
            Tóm Tắt Hiệu Suất
          </h3>
          
          <div className="space-y-4 flex-1 overflow-y-auto">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Win Rate</span>
              <span className="font-semibold text-green-400">{portfolioMetrics.winRate.toFixed(1)}%</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Tổng Số Giao Dịch</span>
              <span className="font-semibold">{portfolioMetrics.totalTrades}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Số Tài Sản Đang Nắm</span>
              <span className="font-semibold">{data.assets.length}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Assets Lãi</span>
              <span className="font-semibold text-green-400">
                {data.assets.filter(a => a.status === 'PROFIT').length}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Assets Lỗ</span>
              <span className="font-semibold text-red-400">
                {data.assets.filter(a => a.status === 'LOSS').length}
              </span>
            </div>
            
            <div className="pt-3 border-t border-gray-700">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">ROI Tổng</span>
                <span className={`font-semibold text-lg ${portfolioMetrics.totalPnLPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {portfolioMetrics.totalPnLPercent >= 0 ? '+' : ''}{portfolioMetrics.totalPnLPercent.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Current Holdings Quick View */}
      {data.assets.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h3 className="text-lg font-semibold mb-4">Top Holdings</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-gray-400 text-sm">
                  <th className="pb-2">Asset</th>
                  <th className="pb-2">Quantity</th>
                  <th className="pb-2">Avg Price</th>
                  <th className="pb-2">Current Price</th>
                  <th className="pb-2">Value</th>
                  <th className="pb-2">P&L</th>
                  <th className="pb-2">Weight</th>
                </tr>
              </thead>
              <tbody>
                {data.assets
                  .sort((a, b) => b.currentValue - a.currentValue)
                  .slice(0, 5)
                  .map(asset => (
                  <tr key={asset.id} className="border-t border-gray-700">
                    <td className="py-2 font-semibold">{asset.ticker}</td>
                    <td className="py-2">{asset.currentQuantity.toFixed(6)}</td>
                    <td className="py-2">${asset.averageBuyPrice.toFixed(2)}</td>
                    <td className="py-2">
                      <input
                        type="number"
                        step="0.01"
                        value={asset.currentMarketPrice}
                        onChange={() => {
                          // This would update the current market price
                          // Implementation would go here
                        }}
                        className="bg-gray-700 border border-gray-600 rounded px-2 py-1 w-20 text-sm"
                      />
                    </td>
                    <td className="py-2">${asset.currentValue.toLocaleString()}</td>
                    <td className={`py-2 font-semibold ${asset.unrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {asset.unrealizedPnL >= 0 ? '+' : ''}${asset.unrealizedPnL.toLocaleString()}
                      <div className="text-xs">
                        ({asset.unrealizedPnLPercent >= 0 ? '+' : ''}{asset.unrealizedPnLPercent.toFixed(1)}%)
                      </div>
                    </td>
                    <td className="py-2">{asset.portfolioWeight.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {data.assets.length > 5 && (
            <div className="text-center mt-3">
              <span className="text-sm text-gray-400">
                Showing top 5 of {data.assets.length} assets
              </span>
            </div>
          )}
        </div>
      )}

      {/* Strategy Rules Reference */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h3 className="text-lg font-semibold mb-4">Strategy Rules</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          <div>
            <h4 className="font-semibold text-green-400 mb-2">Take Profit Rules</h4>
            <div className="space-y-1 text-sm">
              <div>• TP1 @ +50%: Chốt 20%</div>
              <div>• TP2 @ +100%: Chốt 20%</div>
              <div>• TP3 @ +200%: Chốt 20%</div>
              <div>• TP4 @ +300%: Chốt 20%</div>
              <div>• Hold: 20%</div>
            </div>
          </div>
          
          <div>
            <h4 className="font-semibold text-blue-400 mb-2">DCA Rules</h4>
            <div className="space-y-1 text-sm">
              <div>• DCA1 @ -10%: 15% vốn dự phòng</div>
              <div>• DCA2 @ -20%: 20% vốn dự phòng</div>
              <div>• DCA3 @ -30%: 25% vốn dự phòng</div>
              <div>• DCA4 @ -40%: 40% vốn dự phòng</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}