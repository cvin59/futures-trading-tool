import { useMemo } from 'react';
import { TrendingDown, BarChart3, DollarSign, Target } from 'lucide-react';
import type { PositionTradingData } from '../../types/positionTrading';

interface DCAAnalysisTabProps {
  data: PositionTradingData;
}

interface DCAAnalysis {
  ticker: string;
  totalInvested: number;
  averagePrice: number;
  currentPrice: number;
  totalQuantity: number;
  numberOfBuys: number;
  firstBuyDate: string;
  lastBuyDate: string;
  buyPrices: number[];
  priceVariation: {
    min: number;
    max: number;
    range: number;
    standardDeviation: number;
  };
  dcaEffectiveness: {
    currentVsFirst: number;
    currentVsAverage: number;
    wouldBeLumpSum: number;
    dcaBenefit: number;
  };
}

export default function DCAAnalysisTab({ data }: DCAAnalysisTabProps) {
  const dcaAnalysis = useMemo(() => {
    const assetGroups = new Map<string, any[]>();
    
    // Group trades by ticker
    data.tradeLogs
      .filter(trade => trade.action === 'BUY' || trade.action === 'DCA')
      .forEach(trade => {
        if (!assetGroups.has(trade.ticker)) {
          assetGroups.set(trade.ticker, []);
        }
        assetGroups.get(trade.ticker)!.push(trade);
      });

    const analyses: DCAAnalysis[] = [];

    assetGroups.forEach((trades, ticker) => {
      if (trades.length < 2) return; // Need at least 2 buys for DCA analysis

      const sortedTrades = trades.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const buyPrices = sortedTrades.map(t => t.price);
      const totalInvested = sortedTrades.reduce((sum, t) => sum + t.totalValue, 0);
      const totalQuantity = sortedTrades.reduce((sum, t) => sum + t.quantity, 0);
      const averagePrice = totalInvested / totalQuantity;

      // Find current asset to get current price
      const currentAsset = data.assets.find(a => a.ticker === ticker);
      const currentPrice = currentAsset?.currentMarketPrice || sortedTrades[sortedTrades.length - 1].price;

      // Calculate price statistics
      const minPrice = Math.min(...buyPrices);
      const maxPrice = Math.max(...buyPrices);
      const mean = buyPrices.reduce((sum, price) => sum + price, 0) / buyPrices.length;
      const standardDeviation = Math.sqrt(
        buyPrices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / buyPrices.length
      );

      // Calculate DCA effectiveness
      const firstBuyPrice = sortedTrades[0].price;
      const wouldBeLumpSum = totalInvested / firstBuyPrice; // Quantity if bought all at first price
      const dcaBenefit = ((totalQuantity - wouldBeLumpSum) / wouldBeLumpSum) * 100;

      analyses.push({
        ticker,
        totalInvested,
        averagePrice,
        currentPrice,
        totalQuantity,
        numberOfBuys: sortedTrades.length,
        firstBuyDate: sortedTrades[0].date,
        lastBuyDate: sortedTrades[sortedTrades.length - 1].date,
        buyPrices,
        priceVariation: {
          min: minPrice,
          max: maxPrice,
          range: ((maxPrice - minPrice) / minPrice) * 100,
          standardDeviation
        },
        dcaEffectiveness: {
          currentVsFirst: ((currentPrice - firstBuyPrice) / firstBuyPrice) * 100,
          currentVsAverage: ((currentPrice - averagePrice) / averagePrice) * 100,
          wouldBeLumpSum,
          dcaBenefit
        }
      });
    });

    return analyses.sort((a, b) => b.totalInvested - a.totalInvested);
  }, [data]);

  if (dcaAnalysis.length === 0) {
    return (
      <div className="text-center text-gray-400 py-12">
        <TrendingDown size={64} className="mx-auto mb-4 opacity-50" />
        <h3 className="text-lg font-semibold mb-2">DCA Analysis</h3>
        <p>Thêm ít nhất 2 lần mua cùng 1 tài sản để xem phân tích DCA</p>
        <p className="text-sm mt-2">DCA hiệu quả khi mua đều đặn trong thời gian dài</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-purple-400">DCA Performance Analysis</h2>
        <p className="text-gray-400">Phân tích hiệu quả chiến lược Dollar Cost Averaging</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-blue-400">Total DCA Assets</h3>
            <BarChart3 size={20} className="text-blue-400" />
          </div>
          <div className="text-2xl font-bold">{dcaAnalysis.length}</div>
          <div className="text-sm text-gray-400">
            {dcaAnalysis.reduce((sum, a) => sum + a.numberOfBuys, 0)} total buys
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-green-400">Total DCA Investment</h3>
            <DollarSign size={20} className="text-green-400" />
          </div>
          <div className="text-2xl font-bold">
            ${dcaAnalysis.reduce((sum, a) => sum + a.totalInvested, 0).toLocaleString()}
          </div>
          <div className="text-sm text-gray-400">
            Across all DCA positions
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-yellow-400">Avg DCA Benefit</h3>
            <Target size={20} className="text-yellow-400" />
          </div>
          <div className={`text-2xl font-bold ${
            dcaAnalysis.reduce((sum, a) => sum + a.dcaEffectiveness.dcaBenefit, 0) / dcaAnalysis.length >= 0 
              ? 'text-green-400' : 'text-red-400'
          }`}>
            {dcaAnalysis.length > 0 
              ? `${((dcaAnalysis.reduce((sum, a) => sum + a.dcaEffectiveness.dcaBenefit, 0) / dcaAnalysis.length) >= 0 ? '+' : '')}${(dcaAnalysis.reduce((sum, a) => sum + a.dcaEffectiveness.dcaBenefit, 0) / dcaAnalysis.length).toFixed(1)}%`
              : '0%'
            }
          </div>
          <div className="text-sm text-gray-400">
            vs Lump Sum investing
          </div>
        </div>
      </div>

      {/* Individual Asset Analysis */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Chi Tiết Từng Tài Sản</h3>
        
        {dcaAnalysis.map(analysis => (
          <div key={analysis.ticker} className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h4 className="text-xl font-bold text-purple-400">{analysis.ticker}</h4>
                <div className="text-sm text-gray-400">
                  {analysis.numberOfBuys} lần mua • {analysis.firstBuyDate} đến {analysis.lastBuyDate}
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">{analysis.totalQuantity.toFixed(6)}</div>
                <div className="text-sm text-gray-400">Total Holdings</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              {/* Investment Summary */}
              <div className="bg-gray-700/50 rounded-lg p-3">
                <div className="text-sm text-gray-400 mb-1">Total Invested</div>
                <div className="font-bold">${analysis.totalInvested.toLocaleString()}</div>
                <div className="text-xs text-gray-500">
                  Avg: ${(analysis.totalInvested / analysis.numberOfBuys).toFixed(0)}/buy
                </div>
              </div>

              {/* Price Analysis */}
              <div className="bg-gray-700/50 rounded-lg p-3">
                <div className="text-sm text-gray-400 mb-1">Average Price</div>
                <div className="font-bold">${analysis.averagePrice.toLocaleString()}</div>
                <div className="text-xs text-gray-500">
                  Range: ${analysis.priceVariation.min.toLocaleString()} - ${analysis.priceVariation.max.toLocaleString()}
                </div>
              </div>

              {/* Current Performance */}
              <div className="bg-gray-700/50 rounded-lg p-3">
                <div className="text-sm text-gray-400 mb-1">Current Price</div>
                <div className="font-bold">${analysis.currentPrice.toLocaleString()}</div>
                <div className={`text-xs ${analysis.dcaEffectiveness.currentVsAverage >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {analysis.dcaEffectiveness.currentVsAverage >= 0 ? '+' : ''}{analysis.dcaEffectiveness.currentVsAverage.toFixed(1)}% vs avg
                </div>
              </div>

              {/* DCA Benefit */}
              <div className="bg-gray-700/50 rounded-lg p-3">
                <div className="text-sm text-gray-400 mb-1">DCA Benefit</div>
                <div className={`font-bold ${analysis.dcaEffectiveness.dcaBenefit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {analysis.dcaEffectiveness.dcaBenefit >= 0 ? '+' : ''}{analysis.dcaEffectiveness.dcaBenefit.toFixed(1)}%
                </div>
                <div className="text-xs text-gray-500">
                  vs Lump Sum
                </div>
              </div>
            </div>

            {/* Detailed Comparison */}
            <div className="bg-gray-700/30 rounded-lg p-4">
              <h5 className="font-semibold mb-3">DCA vs Lump Sum Comparison</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-400 mb-2">DCA Strategy (Actual)</div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Quantity:</span>
                      <span className="font-semibold">{analysis.totalQuantity.toFixed(6)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Avg Price:</span>
                      <span className="font-semibold">${analysis.averagePrice.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Current Value:</span>
                      <span className="font-semibold">${(analysis.totalQuantity * analysis.currentPrice).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <div className="text-sm text-gray-400 mb-2">Lump Sum (If bought all at first price)</div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Quantity:</span>
                      <span className="font-semibold">{analysis.dcaEffectiveness.wouldBeLumpSum.toFixed(6)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Price:</span>
                      <span className="font-semibold">${analysis.buyPrices[0].toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Current Value:</span>
                      <span className="font-semibold">${(analysis.dcaEffectiveness.wouldBeLumpSum * analysis.currentPrice).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-gray-600">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">DCA Extra Quantity:</span>
                  <span className={`font-bold ${analysis.dcaEffectiveness.dcaBenefit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {analysis.dcaEffectiveness.dcaBenefit >= 0 ? '+' : ''}{(analysis.totalQuantity - analysis.dcaEffectiveness.wouldBeLumpSum).toFixed(6)}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="font-semibold">Extra Value:</span>
                  <span className={`font-bold ${analysis.dcaEffectiveness.dcaBenefit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    ${((analysis.totalQuantity - analysis.dcaEffectiveness.wouldBeLumpSum) * analysis.currentPrice).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Price Chart Visualization */}
            <div className="mt-4">
              <h5 className="font-semibold mb-2">Buy Price History</h5>
              <div className="flex items-end gap-1 h-16">
                {analysis.buyPrices.map((price, index) => {
                  const height = ((price - analysis.priceVariation.min) / (analysis.priceVariation.max - analysis.priceVariation.min)) * 100;
                  const isAboveAvg = price > analysis.averagePrice;
                  return (
                    <div
                      key={index}
                      className={`flex-1 ${isAboveAvg ? 'bg-red-400/60' : 'bg-green-400/60'} rounded-t`}
                      style={{ height: `${Math.max(height, 10)}%` }}
                      title={`Buy ${index + 1}: $${price.toLocaleString()}`}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>Buy 1</span>
                <span>Average: ${analysis.averagePrice.toLocaleString()}</span>
                <span>Buy {analysis.numberOfBuys}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Strategy Recommendations */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Target size={20} />
          DCA Strategy Tips
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold text-green-400 mb-2">DCA Works Best When:</h4>
            <div className="space-y-1 text-sm">
              <div>• Thị trường biến động cao (volatility)</div>
              <div>• Đầu tư dài hạn (6+ tháng)</div>
              <div>• Mua đều đặn theo lịch</div>
              <div>• Tài sản có xu hướng tăng trưởng</div>
            </div>
          </div>
          
          <div>
            <h4 className="font-semibold text-yellow-400 mb-2">Optimization Tips:</h4>
            <div className="space-y-1 text-sm">
              <div>• Kết hợp với dip buying khi crash</div>
              <div>• Tăng tần suất khi thị trường giảm</div>
              <div>• Giảm tần suất khi ATH liên tiếp</div>
              <div>• Review strategy mỗi 3-6 tháng</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}