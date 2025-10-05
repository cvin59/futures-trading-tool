import React from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { formatCurrency, formatPercentage, getPNLColor } from '../utils/calculations';
import type { Position, ViewMode } from '../types/trading';

interface PositionListProps {
  positions: Position[];
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  tempMarginValues: Map<number, string>;
  setTempMarginValues: React.Dispatch<React.SetStateAction<Map<number, string>>>;
  onExecuteDCA?: (posId: number, dcaLevel: 1 | 2) => void;
  onCloseTP?: (posId: number, tpLevel: 1 | 2 | 3) => void;
  onUpdateStopLoss?: (posId: number, newSL: number) => void;
  onRemovePosition: (posId: number) => void;
  onUpdateMargin?: (posId: number, newMargin: number) => void;
  onToggleAutoUpdate: (posId: number) => void;
  onToggleEditingMargin?: (posId: number) => void;
}

export const PositionList: React.FC<PositionListProps> = ({
  positions,
  viewMode,
  setViewMode,
  tempMarginValues: _tempMarginValues,
  setTempMarginValues: _setTempMarginValues,
  onExecuteDCA: _onExecuteDCA,
  onCloseTP: _onCloseTP,
  onUpdateStopLoss: _onUpdateStopLoss,
  onRemovePosition,
  onUpdateMargin: _onUpdateMargin,
  onToggleAutoUpdate,
  onToggleEditingMargin: _onToggleEditingMargin,
}) => {
  if (positions.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h3 className="text-xl font-semibold">Active Positions (0/10)</h3>
        </div>
        <div className="bg-gray-800 rounded-lg p-8 border border-gray-700 text-center text-gray-400">
          No active positions. Add your first position above.
        </div>
      </div>
    );
  }

  // Placeholder functions for future implementation
  // const handleMarginKeyDown = (e: React.KeyboardEvent, posId: number) => {
  //   if (e.key === 'Enter') {
  //     const newValue = tempMarginValues.get(posId);
  //     if (newValue && onUpdateMargin) {
  //       const newMargin = parseFloat(newValue);
  //       if (!isNaN(newMargin) && newMargin > 0) {
  //         onUpdateMargin(posId, newMargin);
  //       }
  //     }
  //   }
  // };

  // const updateTempMargin = (posId: number, value: string) => {
  //   const newMap = new Map(tempMarginValues);
  //   newMap.set(posId, value);
  //   setTempMarginValues(newMap);
  // };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h3 className="text-xl font-semibold">Active Positions ({positions.length}/10)</h3>
        
        {/* View Mode Toggle */}
        <div className="flex gap-2 bg-gray-800 rounded-lg p-1 border border-gray-700 w-full sm:w-auto">
          <button
            onClick={() => setViewMode('cards')}
            className={`px-3 sm:px-4 py-2 rounded font-semibold text-xs sm:text-sm transition-colors flex-1 sm:flex-initial ${
              viewMode === 'cards' 
                ? 'bg-blue-600 text-white' 
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            📋 Cards
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`px-3 sm:px-4 py-2 rounded font-semibold text-xs sm:text-sm transition-colors flex-1 sm:flex-initial ${
              viewMode === 'table' 
                ? 'bg-blue-600 text-white' 
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            📊 Table
          </button>
        </div>
      </div>

      {viewMode === 'cards' ? (
        /* CARDS VIEW */
        <div className="grid gap-4 md:gap-6">
          {positions.map(pos => {
            const priceChangePercent = pos.direction === 'LONG'
              ? ((pos.currentPrice - pos.avgEntry) / pos.avgEntry * 100)
              : ((pos.avgEntry - pos.currentPrice) / pos.avgEntry * 100);
            const roi = (pos.unrealizedPNL / pos.initialMargin) * 100;

            return (
              <div key={pos.id} className="bg-gray-800 rounded-lg p-4 md:p-6 border border-gray-700">
                {/* Card content would be implemented here */}
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-3">
                    <h4 className="text-xl font-bold">{pos.symbol}</h4>
                    <span className={`px-2 py-1 rounded text-sm font-semibold ${
                      pos.direction === 'LONG' ? 'bg-green-600' : 'bg-red-600'
                    }`}>
                      {pos.direction}
                    </span>
                    <button
                      onClick={() => onToggleAutoUpdate(pos.id)}
                      className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                        pos.autoUpdate 
                          ? 'bg-green-600/20 text-green-400 border border-green-600/30' 
                          : 'bg-gray-700 text-gray-400 border border-gray-600'
                      }`}
                      title={pos.autoUpdate ? 'Auto-update ON' : 'Auto-update OFF'}
                    >
                      {pos.autoUpdate ? <Wifi size={12} /> : <WifiOff size={12} />}
                      {pos.autoUpdate ? 'Live' : 'Manual'}
                    </button>
                  </div>
                  <button
                    onClick={() => onRemovePosition(pos.id)}
                    className="text-red-400 hover:text-red-300 text-sm font-semibold"
                  >
                    ✕ Close
                  </button>
                </div>

                {/* Basic position info */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-gray-400">Entry/Avg</div>
                    <div className="font-mono">{formatCurrency(pos.entry, 6)}</div>
                    <div className="font-mono text-blue-400">{formatCurrency(pos.avgEntry, 6)}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Current Price</div>
                    <div className="font-mono">{formatCurrency(pos.currentPrice, 6)}</div>
                    <div className={`font-mono text-xs ${priceChangePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatPercentage(priceChangePercent)}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400">P&L</div>
                    <div className={`font-mono font-bold ${getPNLColor(pos.unrealizedPNL)}`}>
                      ${formatCurrency(pos.unrealizedPNL)}
                    </div>
                    <div className={`font-mono text-xs ${getPNLColor(roi)}`}>
                      {formatPercentage(roi)}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400">Position Size</div>
                    <div className="font-mono">${formatCurrency(pos.positionSize)}</div>
                    <div className="text-xs text-gray-400">{pos.remainingPercent}% remaining</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW - Simplified for now */
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-900/50 border-b border-gray-700">
                <tr className="text-left">
                  <th className="p-3 font-semibold">Symbol</th>
                  <th className="p-3 font-semibold">Type</th>
                  <th className="p-3 font-semibold">Entry</th>
                  <th className="p-3 font-semibold">Current</th>
                  <th className="p-3 font-semibold">P&L</th>
                  <th className="p-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {positions.map(pos => {
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
                        {formatCurrency(pos.avgEntry, 6)}
                      </td>
                      <td className="p-3 font-mono text-xs">
                        {formatCurrency(pos.currentPrice, 6)}
                      </td>
                      <td className="p-3">
                        <div className={`font-mono font-bold ${getPNLColor(pos.unrealizedPNL)}`}>
                          ${formatCurrency(pos.unrealizedPNL)}
                        </div>
                        <div className={`font-mono text-xs ${getPNLColor(roi)}`}>
                          {formatPercentage(roi)}
                        </div>
                      </td>
                      <td className="p-3">
                        <button
                          onClick={() => onRemovePosition(pos.id)}
                          className="text-red-400 hover:text-red-300 text-xs"
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
        </div>
      )}
    </div>
  );
};