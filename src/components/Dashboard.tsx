import React from 'react';
import { Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { calculateAllocation, getMarginLevelColor } from '../utils/calculations';
import type { SyncStatus } from '../types/trading';

interface DashboardStats {
  totalUsedMargin: number;
  totalPNL: number;
  equity: number;
  freeMargin: number;
  marginLevel: number;
  usedMarginPercent: number;
}

interface DashboardProps {
  wallet: number;
  stats: DashboardStats;
  syncStatus: SyncStatus;
  lastSyncTime: number;
  onManualSync: () => void;
  onExportData: () => void;
  onImportData: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearAllData: () => void;
}

const getMarginColor = (level: number) => {
  if (level >= 150) return 'text-green-400';
  if (level >= 130) return 'text-yellow-400';
  if (level >= 110) return 'text-orange-400';
  return 'text-red-400';
};

const getMarginStatus = (level: number) => {
  if (level >= 200) return '🟢 Excellent';
  if (level >= 150) return '🟢 Safe';
  if (level >= 130) return '🟡 Caution';
  if (level >= 110) return '🟠 Warning';
  return '🔴 Danger';
};

export const Dashboard: React.FC<DashboardProps> = ({
  wallet,
  stats,
  syncStatus,
  lastSyncTime,
  onManualSync,
  onExportData,
  onImportData,
  onClearAllData,
}) => {
  const allocation = calculateAllocation(wallet);

  return (
    <>
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-center gap-3 text-sm mb-4">
        <button
          onClick={onExportData}
          className="text-blue-400 hover:text-blue-300 underline"
          title="Download your data as JSON"
        >
          📥 Export Data
        </button>
        
        <label className="text-blue-400 hover:text-blue-300 underline cursor-pointer" title="Import data from JSON file">
          📤 Import Data
          <input
            type="file"
            accept=".json"
            onChange={onImportData}
            className="hidden"
          />
        </label>
        
        <button
          onClick={onClearAllData}
          className="text-red-400 hover:text-red-300 underline"
          title="Clear all positions and reset"
        >
          🗑️ Clear All
        </button>
        
        <div className="h-4 w-px bg-gray-600"></div>
        
        {/* Firebase Sync Status */}
        <button
          onClick={onManualSync}
          disabled={syncStatus === 'syncing'}
          className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors ${
            syncStatus === 'synced' ? 'text-green-400 hover:text-green-300' :
            syncStatus === 'syncing' ? 'text-blue-400 cursor-wait' :
            syncStatus === 'error' ? 'text-red-400 hover:text-red-300' :
            'text-gray-400 hover:text-gray-300'
          }`}
          title={
            syncStatus === 'synced' ? `Last synced: ${new Date(lastSyncTime).toLocaleTimeString()}` :
            syncStatus === 'syncing' ? 'Syncing to cloud...' :
            syncStatus === 'error' ? 'Sync error - click to retry' :
            'Cloud sync offline'
          }
        >
          {syncStatus === 'syncing' ? (
            <RefreshCw size={12} className="animate-spin" />
          ) : syncStatus === 'synced' ? (
            <Cloud size={12} />
          ) : (
            <CloudOff size={12} />
          )}
          <span>
            {syncStatus === 'synced' ? 'Synced' :
             syncStatus === 'syncing' ? 'Syncing...' :
             syncStatus === 'error' ? 'Sync Error' :
             'Offline'}
          </span>
        </button>
      </div>

      {/* Dashboard Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-gray-400 text-sm mb-1">Total Equity</div>
          <div className="text-2xl font-bold">${stats.equity.toFixed(2)}</div>
          <div className={`text-sm ${stats.totalPNL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {stats.totalPNL >= 0 ? '+' : ''}{stats.totalPNL.toFixed(2)} ({((stats.totalPNL/wallet)*100).toFixed(2)}%)
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-gray-400 text-sm mb-1">Used Margin</div>
          <div className="text-2xl font-bold">${stats.totalUsedMargin.toFixed(2)}</div>
          <div className="text-sm text-gray-400">{stats.usedMarginPercent.toFixed(1)}% of wallet</div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-gray-400 text-sm mb-1">Free Margin</div>
          <div className="text-2xl font-bold">${stats.freeMargin.toFixed(2)}</div>
          <div className="text-sm text-gray-400">{((stats.freeMargin/wallet)*100).toFixed(1)}%</div>
        </div>

        <div className={`rounded-lg p-4 border ${getMarginLevelColor(stats.marginLevel)} border-gray-700`}>
          <div className="text-gray-400 text-sm mb-1">Margin Level</div>
          <div className={`text-2xl font-bold ${getMarginColor(stats.marginLevel)}`}>
            {stats.marginLevel > 0 ? stats.marginLevel.toFixed(0) : '∞'}%
          </div>
          <div className="text-sm text-gray-400">
            {getMarginStatus(stats.marginLevel)}
          </div>
        </div>
      </div>

      {/* Fund Allocation */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h3 className="text-lg font-semibold mb-3">Fund Allocation (45/40/15)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 text-sm">
          <div>
            <div className="text-gray-400">Initial Fund (45%)</div>
            <div className="font-bold text-blue-400">${allocation.initial.toFixed(2)}</div>
            <div className="text-xs text-gray-500">${allocation.perTradeInitial.toFixed(2)}/trade</div>
          </div>
          <div>
            <div className="text-gray-400">DCA Reserve (40%)</div>
            <div className="font-bold text-purple-400">${allocation.dca.toFixed(2)}</div>
            <div className="text-xs text-gray-500">DCA1: ${allocation.perTradeDCA1.toFixed(2)} | DCA2: ${allocation.perTradeDCA2.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-gray-400">Emergency (15%)</div>
            <div className="font-bold text-red-400">${allocation.emergency.toFixed(2)}</div>
            <div className="text-xs text-gray-500">Keep for emergencies</div>
          </div>
        </div>
      </div>
    </>
  );
};