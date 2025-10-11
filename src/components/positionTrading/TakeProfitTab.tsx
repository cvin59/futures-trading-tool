import { useState } from 'react';
import { Target, CheckCircle, Clock, AlertTriangle, Edit2 } from 'lucide-react';
import type { PositionTradingData, TakeProfitLevel } from '../../types/positionTrading';

interface TakeProfitTabProps {
  data: PositionTradingData;
  onUpdateData: (newData: PositionTradingData) => void;
}

export default function TakeProfitTab({ data, onUpdateData }: TakeProfitTabProps) {
  const [editingLevel, setEditingLevel] = useState<TakeProfitLevel | null>(null);

  const groupedByAsset = data.takeProfitLevels.reduce((acc, level) => {
    if (!acc[level.ticker]) {
      acc[level.ticker] = [];
    }
    acc[level.ticker].push(level);
    return acc;
  }, {} as Record<string, TakeProfitLevel[]>);

  const updateTakeProfitLevel = (levelId: string, updates: Partial<TakeProfitLevel>) => {
    const updatedLevels = data.takeProfitLevels.map(level =>
      level.id === levelId ? { ...level, ...updates } : level
    );
    
    onUpdateData({
      ...data,
      takeProfitLevels: updatedLevels
    });
  };

  const toggleLevelCompletion = (levelId: string) => {
    const level = data.takeProfitLevels.find(l => l.id === levelId);
    if (level) {
      updateTakeProfitLevel(levelId, {
        status: level.status === 'PENDING' ? 'COMPLETED' : 'PENDING',
        isChecked: !level.isChecked
      });
    }
  };

  const checkTPReached = (level: TakeProfitLevel) => {
    const asset = data.assets.find(a => a.id === level.assetId);
    return asset && asset.currentMarketPrice >= level.targetPrice;
  };


  const getLevelBgColor = (level: TakeProfitLevel) => {
    if (level.status === 'COMPLETED') return 'bg-green-900/20 border-green-500/30';
    if (checkTPReached(level)) return 'bg-yellow-900/20 border-yellow-500/30';
    return 'bg-gray-800 border-gray-700';
  };

  const totalPendingLevels = data.takeProfitLevels.filter(l => l.status === 'PENDING').length;
  const totalCompletedLevels = data.takeProfitLevels.filter(l => l.status === 'COMPLETED').length;
  const totalReadyLevels = data.takeProfitLevels.filter(l => l.status === 'PENDING' && checkTPReached(l)).length;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-gray-400 text-sm mb-1">Tổng TP Levels</div>
          <div className="text-2xl font-bold text-blue-400">{data.takeProfitLevels.length}</div>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-gray-400 text-sm mb-1">Đang chờ</div>
          <div className="text-2xl font-bold text-yellow-400">{totalPendingLevels}</div>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-gray-400 text-sm mb-1">Sẵn sàng chốt</div>
          <div className="text-2xl font-bold text-green-400">{totalReadyLevels}</div>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-gray-400 text-sm mb-1">Đã hoàn thành</div>
          <div className="text-2xl font-bold text-purple-400">{totalCompletedLevels}</div>
        </div>
      </div>

      {/* Alert for ready TPs */}
      {totalReadyLevels > 0 && (
        <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={20} className="text-yellow-400" />
            <span className="text-yellow-400 font-semibold">
              {totalReadyLevels} TP level(s) sẵn sàng để chốt!
            </span>
          </div>
          <p className="text-yellow-300 text-sm">
            Các mức Take Profit đã đạt target price. Hãy kiểm tra và thực hiện chốt lời.
          </p>
        </div>
      )}

      {/* Take Profit Levels by Asset */}
      <div className="space-y-6">
        {Object.entries(groupedByAsset).map(([ticker, levels]) => {
          const asset = data.assets.find(a => a.ticker === ticker);
          if (!asset) return null;

          const sortedLevels = levels.sort((a, b) => a.priceIncrease - b.priceIncrease);

          return (
            <div key={ticker} className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
              <div className="p-4 border-b border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold flex items-center gap-2">
                      <Target size={20} />
                      {ticker} Take Profit Plan
                    </h3>
                    <div className="text-sm text-gray-400 mt-1">
                      Current Price: ${asset.currentMarketPrice.toFixed(2)} • 
                      Avg Buy: ${asset.averageBuyPrice.toFixed(2)} • 
                      Holdings: {asset.currentQuantity.toFixed(6)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-lg font-semibold ${asset.unrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {asset.unrealizedPnL >= 0 ? '+' : ''}{asset.unrealizedPnLPercent.toFixed(1)}%
                    </div>
                    <div className="text-sm text-gray-400">
                      {levels.filter(l => l.status === 'COMPLETED').length}/{levels.length} completed
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {sortedLevels.map(level => {
                    const isReached = checkTPReached(level);
                    const progressPercent = Math.min((asset.currentMarketPrice / level.targetPrice) * 100, 100);

                    return (
                      <div
                        key={level.id}
                        className={`rounded-lg p-4 border transition-all ${getLevelBgColor(level)}`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-lg">{level.level}</span>
                            {level.status === 'COMPLETED' ? (
                              <CheckCircle size={16} className="text-green-400" />
                            ) : isReached ? (
                              <AlertTriangle size={16} className="text-yellow-400" />
                            ) : (
                              <Clock size={16} className="text-gray-400" />
                            )}
                          </div>
                          <button
                            onClick={() => setEditingLevel(level)}
                            className="text-gray-400 hover:text-gray-200 transition-colors"
                          >
                            <Edit2 size={14} />
                          </button>
                        </div>

                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Target:</span>
                            <span className="font-semibold">${level.targetPrice.toFixed(2)}</span>
                          </div>
                          
                          <div className="flex justify-between">
                            <span className="text-gray-400">Gain:</span>
                            <span className="font-semibold text-green-400">+{level.priceIncrease}%</span>
                          </div>
                          
                          <div className="flex justify-between">
                            <span className="text-gray-400">Sell:</span>
                            <span className="font-semibold">{level.sellPercentage}%</span>
                          </div>
                          
                          <div className="flex justify-between">
                            <span className="text-gray-400">Quantity:</span>
                            <span className="font-semibold">{level.quantityToSell.toFixed(6)}</span>
                          </div>
                          
                          <div className="flex justify-between">
                            <span className="text-gray-400">Value:</span>
                            <span className="font-semibold">${level.expectedValue.toFixed(0)}</span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="mt-3">
                          <div className="flex justify-between text-xs text-gray-400 mb-1">
                            <span>Progress</span>
                            <span>{progressPercent.toFixed(1)}%</span>
                          </div>
                          <div className="w-full bg-gray-600 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                progressPercent >= 100 ? 'bg-green-400' : 
                                progressPercent >= 80 ? 'bg-yellow-400' : 'bg-blue-400'
                              }`}
                              style={{ width: `${Math.min(progressPercent, 100)}%` }}
                            ></div>
                          </div>
                        </div>

                        {/* Action Button */}
                        <div className="mt-3">
                          {level.status === 'COMPLETED' ? (
                            <button
                              onClick={() => toggleLevelCompletion(level.id)}
                              className="w-full bg-green-600 text-white px-3 py-2 rounded text-sm font-semibold"
                            >
                              ✓ Đã chốt
                            </button>
                          ) : isReached ? (
                            <button
                              onClick={() => toggleLevelCompletion(level.id)}
                              className="w-full bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-2 rounded text-sm font-semibold transition-colors"
                            >
                              Chốt ngay!
                            </button>
                          ) : (
                            <button
                              disabled
                              className="w-full bg-gray-600 text-gray-400 px-3 py-2 rounded text-sm cursor-not-allowed"
                            >
                              Chờ đạt target
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Asset Summary */}
                <div className="mt-4 p-3 bg-gray-700/50 rounded border border-gray-600">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">Remaining:</span>
                      <div className="font-semibold">
                        {(asset.currentQuantity * 0.2).toFixed(6)} ({ticker})
                      </div>
                      <div className="text-xs text-gray-400">20% hold forever</div>
                    </div>
                    
                    <div>
                      <span className="text-gray-400">Total Sold:</span>
                      <div className="font-semibold">
                        {levels.filter(l => l.status === 'COMPLETED').length * 20}%
                      </div>
                    </div>
                    
                    <div>
                      <span className="text-gray-400">Est. Total Value:</span>
                      <div className="font-semibold">
                        ${levels.reduce((sum, l) => sum + l.expectedValue, 0).toFixed(0)}
                      </div>
                    </div>
                    
                    <div>
                      <span className="text-gray-400">Next Target:</span>
                      <div className="font-semibold">
                        {levels.find(l => l.status === 'PENDING')?.targetPrice.toFixed(2) || 'N/A'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {Object.keys(groupedByAsset).length === 0 && (
          <div className="text-center text-gray-400 py-12">
            <Target size={64} className="mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">Chưa có Take Profit Plan</h3>
            <p>Take Profit levels sẽ được tự động tạo khi bạn thêm giao dịch BUY mới</p>
          </div>
        )}
      </div>

      {/* Edit Level Modal */}
      {editingLevel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-700">
            <h3 className="text-lg font-semibold mb-4">
              Edit {editingLevel.level} - {editingLevel.ticker}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Target Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editingLevel.targetPrice}
                  onChange={(e) => setEditingLevel({ 
                    ...editingLevel, 
                    targetPrice: parseFloat(e.target.value) || 0,
                    expectedValue: (parseFloat(e.target.value) || 0) * editingLevel.quantityToSell
                  })}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-purple-500"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">Sell Percentage (%)</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={editingLevel.sellPercentage}
                  onChange={(e) => {
                    const percentage = parseFloat(e.target.value) || 0;
                    const asset = data.assets.find(a => a.id === editingLevel.assetId);
                    const quantity = asset ? (asset.currentQuantity * percentage / 100) : 0;
                    setEditingLevel({ 
                      ...editingLevel, 
                      sellPercentage: percentage,
                      quantityToSell: quantity,
                      expectedValue: editingLevel.targetPrice * quantity
                    });
                  }}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-purple-500"
                />
              </div>
              
              <div className="text-sm text-gray-400 bg-gray-700/50 p-3 rounded">
                <div>Quantity to sell: {editingLevel.quantityToSell.toFixed(6)}</div>
                <div>Expected value: ${editingLevel.expectedValue.toFixed(2)}</div>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  updateTakeProfitLevel(editingLevel.id, editingLevel);
                  setEditingLevel(null);
                }}
                className="flex-1 bg-green-600 hover:bg-green-700 px-4 py-2 rounded font-semibold transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => setEditingLevel(null)}
                className="flex-1 bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded font-semibold transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}