import { useState } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import FuturesTradingTool from '../futures-trading-tool';
import SpotTradingTool from './SpotTradingTool';

type TabType = 'futures' | 'spot';

export default function TradingApp() {
  const [activeTab, setActiveTab] = useState<TabType>('futures');

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      {/* Tab Navigation */}
      <div className="border-b border-gray-700 bg-gray-800">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 xl:px-8">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('futures')}
              className={`flex items-center gap-2 py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'futures'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-300'
              }`}
            >
              <TrendingUp size={16} />
              Futures Trading
            </button>
            <button
              onClick={() => setActiveTab('spot')}
              className={`flex items-center gap-2 py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'spot'
                  ? 'border-green-500 text-green-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-300'
              }`}
            >
              <TrendingDown size={16} />
              Spot Trading
            </button>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'futures' && <FuturesTradingTool />}
        {activeTab === 'spot' && <SpotTradingTool />}
      </div>
    </div>
  );
}