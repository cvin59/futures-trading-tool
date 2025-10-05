import React from 'react';
import { calculateLevels, calculateFee, calculateAllocation } from '../utils/calculations';
import type { FormData } from '../types/trading';

interface AddPositionFormProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  wallet: number;
  tradingFee: number;
  onAddPosition: () => void;
}

export const AddPositionForm: React.FC<AddPositionFormProps> = ({
  formData,
  setFormData,
  wallet,
  tradingFee,
  onAddPosition,
}) => {
  const allocation = calculateAllocation(wallet);

  const preview = formData.entryPrice ? calculateLevels(formData.entryPrice, formData.direction) : null;
  const customMargin = formData.initialMargin ? parseFloat(formData.initialMargin) : null;
  const baseMargin = customMargin || allocation.perTradeInitial;
  const positionValue = baseMargin * (formData.leverage || 10);
  const openFee = calculateFee(positionValue, tradingFee);
  const actualMargin = baseMargin - openFee;

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <h3 className="text-lg font-semibold mb-4">Open New Position</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
        <input
          type="text"
          placeholder="Symbol (e.g. XPL)"
          value={formData.symbol}
          onChange={(e) => setFormData({...formData, symbol: e.target.value})}
          className="bg-gray-700 border border-gray-600 rounded px-4 py-2 focus:outline-none focus:border-blue-500 w-full"
        />
        
        <select
          value={formData.direction}
          onChange={(e) => setFormData({...formData, direction: e.target.value as 'LONG' | 'SHORT'})}
          className="bg-gray-700 border border-gray-600 rounded px-4 py-2 focus:outline-none focus:border-blue-500 w-full"
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
          className="bg-gray-700 border border-gray-600 rounded px-4 py-2 focus:outline-none focus:border-blue-500 w-full"
        />

        <input
          type="number"
          min="1"
          max="100"
          placeholder="Leverage (1-100x)"
          value={formData.leverage}
          onChange={(e) => setFormData({...formData, leverage: parseInt(e.target.value) || 10})}
          className="bg-gray-700 border border-gray-600 rounded px-4 py-2 focus:outline-none focus:border-blue-500 w-full"
        />

        <input
          type="number"
          step="0.01"
          min="0.01"
          placeholder={`Initial Margin ($${allocation.perTradeInitial.toFixed(2)})`}
          value={formData.initialMargin}
          onChange={(e) => setFormData({...formData, initialMargin: e.target.value})}
          className="bg-gray-700 border border-gray-600 rounded px-4 py-2 focus:outline-none focus:border-blue-500 w-full"
        />

        <button
          onClick={onAddPosition}
          disabled={!formData.symbol || !formData.entryPrice}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded px-4 py-2 font-semibold transition-colors w-full"
        >
          Add Position
        </button>
      </div>

      {/* Preview calculation */}
      {preview && (
        <div className="mt-4 p-3 md:p-4 bg-gray-700/50 rounded border border-gray-600">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4 text-sm">
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
              <div className="font-mono">${(actualMargin * (formData.leverage || 10)).toFixed(2)}</div>
            </div>
            <div>
              <div className="text-gray-400">Margin / Fee</div>
              <div className="font-mono text-blue-400">${actualMargin.toFixed(2)}</div>
              <div className="font-mono text-orange-400 text-xs">-${openFee.toFixed(2)}</div>
              {customMargin && <div className="text-xs text-purple-400">Custom</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};