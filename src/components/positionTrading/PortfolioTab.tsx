import { useState } from 'react';
import { RefreshCw, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import type { PositionTradingData, Asset } from '../../types/positionTrading';

interface PortfolioTabProps {
  data: PositionTradingData;
  onUpdateData: (newData: PositionTradingData) => void;
}

export default function PortfolioTab({ data, onUpdateData }: PortfolioTabProps) {
  const [updatingPrices, setUpdatingPrices] = useState(false);
  const [priceInputs, setPriceInputs] = useState<Record<string, string>>({});

  // Calculate totals
  const totalValue = data.assets.reduce((sum, asset) => sum + asset.currentValue, 0);
  const totalCost = data.assets.reduce((sum, asset) => sum + asset.totalInvested, 0);
  const totalPnL = data.assets.reduce((sum, asset) => sum + asset.unrealizedPnL, 0);
  const totalPnLPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

  const updateAssetPrice = (assetId: string, newPrice: number, clearInput: boolean = true) => {
    console.log('🔄 updateAssetPrice called:', { assetId, newPrice, clearInput });
    
    const updatedAssets = data.assets.map(asset => {
      if (asset.id === assetId) {
        const currentValue = asset.currentQuantity * newPrice;
        const unrealizedPnL = currentValue - asset.totalInvested;
        const unrealizedPnLPercent = asset.totalInvested > 0 ? (unrealizedPnL / asset.totalInvested) * 100 : 0;
        
        console.log('📊 Updating asset:', {
          ticker: asset.ticker,
          oldPrice: asset.currentMarketPrice,
          newPrice,
          currentQuantity: asset.currentQuantity,
          currentValue,
          unrealizedPnL,
          unrealizedPnLPercent
        });
        
        return {
          ...asset,
          currentMarketPrice: newPrice,
          currentValue,
          unrealizedPnL,
          unrealizedPnLPercent,
          status: unrealizedPnL > 0 ? 'PROFIT' as const : unrealizedPnL < 0 ? 'LOSS' as const : 'BREAKEVEN' as const,
          lastUpdated: Date.now()
        };
      }
      return asset;
    });

    // Recalculate portfolio weights (immutably)
    const newTotalValue = updatedAssets.reduce((sum, asset) => sum + asset.currentValue, 0);
    const finalAssets = updatedAssets.map(asset => ({
      ...asset,
      portfolioWeight: newTotalValue > 0 ? (asset.currentValue / newTotalValue) * 100 : 0
    }));

    console.log('💾 Before onUpdateData - Final updated assets:', finalAssets);

    const newData = {
      ...data,
      assets: finalAssets
    };

    console.log('💾 Calling onUpdateData with:', newData);
    
    // Call the parent update function
    onUpdateData(newData);

    console.log('✅ onUpdateData called successfully');

    // Clear the price input only if requested (manual updates)
    if (clearInput) {
      setPriceInputs(prev => ({ ...prev, [assetId]: '' }));
    }
  };

  const updateAllPrices = async () => {
    setUpdatingPrices(true);
    console.log('🔄 Starting to update all prices...');
    console.log('📊 Assets to update:', data.assets.map(a => ({ id: a.id, ticker: a.ticker })));
    
    if (data.assets.length === 0) {
      console.log('⚠️ No assets to update');
      setUpdatingPrices(false);
      return;
    }
    
    let successCount = 0;
    let errorCount = 0;
    
    // Test with one simple API call first
    try {
      console.log('🧪 Testing API connectivity...');
      const testResponse = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT');
      console.log('🧪 Test response status:', testResponse.status);
      if (testResponse.ok) {
        const testData = await testResponse.json();
        console.log('🧪 Test data:', testData);
      }
    } catch (testError) {
      console.error('❌ API test failed:', testError);
      alert('Cannot connect to Binance API. Please check your internet connection.');
      setUpdatingPrices(false);
      return;
    }
    
    // Collect all price updates first, then apply them in a single batch
    const priceUpdates: { assetId: string; newPrice: number }[] = [];
    
    // Process each asset sequentially to avoid rate limiting
    for (const asset of data.assets) {
      try {
        console.log(`💰 Fetching price for ${asset.ticker}...`);
        
        // Try different ticker formats
        const tickerFormats = [
          `${asset.ticker}USDT`,
          `${asset.ticker}USDC`, 
          `${asset.ticker}BUSD`,
          `${asset.ticker}USD`
        ];
        
        let priceFound = false;
        
        for (const ticker of tickerFormats) {
          try {
            console.log(`🔍 Trying ticker format: ${ticker}`);
            const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${ticker}`);
            console.log(`📡 Response for ${ticker}:`, response.status, response.ok);
            
            if (response.ok) {
              const priceData = await response.json();
              console.log(`📊 Price data for ${ticker}:`, priceData);
              const newPrice = parseFloat(priceData.price);
              
              if (newPrice && newPrice > 0) {
                console.log(`✅ Successfully fetched price for ${asset.ticker} (${ticker}): $${newPrice}`);
                priceUpdates.push({ assetId: asset.id, newPrice });
                successCount++;
                priceFound = true;
                break;
              } else {
                console.log(`⚠️ Invalid price data for ${ticker}:`, priceData);
              }
            } else {
              const errorText = await response.text();
              console.log(`❌ Failed to fetch ${ticker}:`, response.status, errorText);
            }
          } catch (formatError) {
            console.log(`❌ Error with format ${ticker}:`, formatError.message);
            continue;
          }
        }
        
        if (!priceFound) {
          console.warn(`⚠️ Could not fetch price for ${asset.ticker} with any format`);
          errorCount++;
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.error(`❌ Error fetching price for ${asset.ticker}:`, error);
        errorCount++;
      }
    }
    
    // Apply all price updates in a single batch to avoid state conflicts
    if (priceUpdates.length > 0) {
      console.log('🔄 Applying all price updates in a single batch:', priceUpdates);
      
      const updatedAssets = data.assets.map(asset => {
        const priceUpdate = priceUpdates.find(update => update.assetId === asset.id);
        if (priceUpdate) {
          const newPrice = priceUpdate.newPrice;
          const currentValue = asset.currentQuantity * newPrice;
          const unrealizedPnL = currentValue - asset.totalInvested;
          const unrealizedPnLPercent = asset.totalInvested > 0 ? (unrealizedPnL / asset.totalInvested) * 100 : 0;
          
          return {
            ...asset,
            currentMarketPrice: newPrice,
            currentValue,
            unrealizedPnL,
            unrealizedPnLPercent,
            status: unrealizedPnL > 0 ? 'PROFIT' as const : unrealizedPnL < 0 ? 'LOSS' as const : 'BREAKEVEN' as const,
            lastUpdated: Date.now()
          };
        }
        return asset;
      });

      // Recalculate portfolio weights
      const newTotalValue = updatedAssets.reduce((sum, asset) => sum + asset.currentValue, 0);
      const finalAssets = updatedAssets.map(asset => ({
        ...asset,
        portfolioWeight: newTotalValue > 0 ? (asset.currentValue / newTotalValue) * 100 : 0
      }));

      console.log('💾 Batch updating all assets at once:', finalAssets);
      
      // Single state update with all changes
      onUpdateData({
        ...data,
        assets: finalAssets
      });
    }
    
    console.log(`🏁 Price update completed: ${successCount} successful, ${errorCount} failed`);
    
    if (successCount === 0 && errorCount > 0) {
      alert(`Unable to fetch any prices. Check the console for details.`);
    } else if (successCount > 0) {
      console.log(`✅ Successfully updated ${successCount} asset prices!`);
    }
    
    setUpdatingPrices(false);
  };

  const getStatusIcon = (status: Asset['status']) => {
    switch (status) {
      case 'PROFIT':
        return <TrendingUp size={16} className="text-green-400" />;
      case 'LOSS':
        return <TrendingDown size={16} className="text-red-400" />;
      default:
        return <div className="w-4 h-4 bg-gray-400 rounded-full"></div>;
    }
  };

  const getStatusColor = (status: Asset['status']) => {
    switch (status) {
      case 'PROFIT': return 'text-green-400';
      case 'LOSS': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const sortedAssets = [...data.assets].sort((a, b) => b.currentValue - a.currentValue);

  return (
    <div className="space-y-6">
      {/* Portfolio Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-gray-400 text-sm mb-1">Tổng Giá Trị</div>
          <div className="text-2xl font-bold text-blue-400">${totalValue.toLocaleString()}</div>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-gray-400 text-sm mb-1">Tổng Đầu Tư</div>
          <div className="text-2xl font-bold text-yellow-400">${totalCost.toLocaleString()}</div>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-gray-400 text-sm mb-1">Tổng P&L</div>
          <div className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {totalPnL >= 0 ? '+' : ''}${totalPnL.toLocaleString()}
          </div>
          <div className={`text-sm ${totalPnLPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {totalPnLPercent >= 0 ? '+' : ''}{totalPnLPercent.toFixed(2)}%
          </div>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-gray-400 text-sm mb-1">Số Tài Sản</div>
          <div className="text-2xl font-bold text-purple-400">{data.assets.length}</div>
          <div className="text-sm text-gray-400">
            Lãi: {data.assets.filter(a => a.status === 'PROFIT').length} • 
            Lỗ: {data.assets.filter(a => a.status === 'LOSS').length}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={updateAllPrices}
            disabled={updatingPrices}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-4 py-2 rounded font-semibold transition-colors"
          >
            <RefreshCw size={16} className={updatingPrices ? 'animate-spin' : ''} />
            {updatingPrices ? 'Đang cập nhật...' : 'Cập nhật giá'}
          </button>
          
          <div className="text-sm text-gray-400">
            Auto-fetch from Binance + Manual updates • Position Trading Mode • Last: {new Date().toLocaleTimeString('vi-VN')}
          </div>
        </div>

        {/* Rebalance Alert */}
        {sortedAssets.some(asset => asset.portfolioWeight > 40) && (
          <div className="flex items-center gap-2 bg-yellow-900/20 border border-yellow-500/30 rounded px-3 py-2">
            <AlertTriangle size={16} className="text-yellow-400" />
            <span className="text-yellow-300 text-sm">Cần rebalance!</span>
          </div>
        )}
      </div>

      {/* Portfolio Table */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold">Portfolio Overview ({data.assets.length} assets)</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700/50">
              <tr>
                <th className="text-left p-3 text-sm font-medium text-gray-300">Status</th>
                <th className="text-left p-3 text-sm font-medium text-gray-300">Tài sản</th>
                <th className="text-left p-3 text-sm font-medium text-gray-300">Số lượng</th>
                <th className="text-left p-3 text-sm font-medium text-gray-300">Giá mua TB</th>
                <th className="text-left p-3 text-sm font-medium text-gray-300">Giá hiện tại</th>
                <th className="text-left p-3 text-sm font-medium text-gray-300">Giá trị hiện tại</th>
                <th className="text-left p-3 text-sm font-medium text-gray-300">Lãi/Lỗ ($)</th>
                <th className="text-left p-3 text-sm font-medium text-gray-300">Lãi/Lỗ (%)</th>
                <th className="text-left p-3 text-sm font-medium text-gray-300">% Portfolio</th>
                <th className="text-left p-3 text-sm font-medium text-gray-300">Cập nhật giá</th>
              </tr>
            </thead>
            <tbody>
              {sortedAssets.map(asset => (
                <tr key={asset.id} className="border-b border-gray-700 hover:bg-gray-700/30">
                  <td className="p-3">
                    {getStatusIcon(asset.status)}
                  </td>
                  <td className="p-3">
                    <div className="font-bold text-lg">{asset.ticker}</div>
                    <div className="text-xs text-gray-400">
                      Đầu tư: ${asset.totalInvested.toLocaleString()}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="font-mono text-sm">{asset.currentQuantity.toFixed(6)}</div>
                  </td>
                  <td className="p-3">
                    <div className="font-mono text-sm">${asset.averageBuyPrice.toFixed(2)}</div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="font-mono text-sm font-semibold">
                        ${asset.currentMarketPrice.toFixed(2)}
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">
                      {((asset.currentMarketPrice - asset.averageBuyPrice) / asset.averageBuyPrice * 100).toFixed(1)}%
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="font-semibold">${asset.currentValue.toLocaleString()}</div>
                  </td>
                  <td className="p-3">
                    <div className={`font-semibold ${getStatusColor(asset.status)}`}>
                      {asset.unrealizedPnL >= 0 ? '+' : ''}${asset.unrealizedPnL.toLocaleString()}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className={`font-semibold ${getStatusColor(asset.status)}`}>
                      {asset.unrealizedPnLPercent >= 0 ? '+' : ''}{asset.unrealizedPnLPercent.toFixed(2)}%
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="font-semibold">{asset.portfolioWeight.toFixed(1)}%</div>
                      {asset.portfolioWeight > 40 && (
                        <AlertTriangle size={12} className="text-yellow-400" />
                      )}
                    </div>
                    <div className="w-full bg-gray-600 rounded-full h-1.5 mt-1">
                      <div
                        className="bg-blue-400 h-1.5 rounded-full"
                        style={{ width: `${Math.min(asset.portfolioWeight, 100)}%` }}
                      ></div>
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="New price"
                        value={priceInputs[asset.id] || ''}
                        onChange={(e) => setPriceInputs(prev => ({ ...prev, [asset.id]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const newPrice = parseFloat(priceInputs[asset.id] || '0');
                            if (newPrice > 0) {
                              updateAssetPrice(asset.id, newPrice);
                            }
                          }
                        }}
                        className="bg-gray-700 border border-gray-600 rounded px-2 py-1 w-24 text-sm focus:outline-none focus:border-blue-500"
                      />
                      <button
                        onClick={() => {
                          const newPrice = parseFloat(priceInputs[asset.id] || '0');
                          if (newPrice > 0) {
                            updateAssetPrice(asset.id, newPrice);
                          }
                        }}
                        disabled={!priceInputs[asset.id] || parseFloat(priceInputs[asset.id]) <= 0}
                        className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-2 py-1 rounded text-xs font-semibold transition-colors"
                      >
                        Update
                      </button>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      Updated: {new Date(asset.lastUpdated).toLocaleTimeString('vi-VN')}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {data.assets.length === 0 && (
            <div className="text-center text-gray-400 py-8">
              <p>Chưa có tài sản nào</p>
              <p className="text-sm">Thêm giao dịch đầu tiên để bắt đầu</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}