import React from 'react';
import { User, LogOut } from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';

interface HeaderProps {
  user: FirebaseUser | null;
  wallet: number;
  editingWallet: boolean;
  tempWallet: string;
  setTempWallet: (value: string) => void;
  onStartEditWallet: () => void;
  onSaveWallet: () => void;
  onCancelWalletEdit: () => void;
  tradingFee: number;
  setTradingFee: (fee: number) => void;
  showFeeSettings: boolean;
  setShowFeeSettings: (show: boolean) => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  wallet,
  editingWallet,
  tempWallet,
  setTempWallet,
  onStartEditWallet,
  onSaveWallet,
  onCancelWalletEdit,
  tradingFee,
  setTradingFee,
  showFeeSettings,
  setShowFeeSettings,
  onLogout,
}) => {
  return (
    <div className="text-center space-y-2 py-4">
      <div className="flex flex-col lg:flex-row items-center justify-between gap-3 mb-2">
        <div className="hidden lg:block flex-1"></div>
        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent flex-1">
          Futures Trading Manager
        </h1>
        <div className="flex-1 flex justify-center lg:justify-end">
          {user && (
            <div className="flex items-center gap-2 flex-wrap justify-center">
              <div className="flex items-center gap-1 bg-gray-800 border border-gray-700 rounded px-2 sm:px-3 py-1">
                <User size={14} className="text-blue-400" />
                <span className="text-xs text-gray-400 truncate max-w-[150px]">{user.email || 'Anonymous'}</span>
              </div>
              <button
                onClick={onLogout}
                className="flex items-center gap-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded px-2 sm:px-3 py-1 text-xs text-red-400"
                title="Logout"
              >
                <LogOut size={14} />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
      <p className="text-gray-400">10X Leverage • 45/40/15 Strategy</p>
      
      {/* Wallet Balance Editor */}
      <div className="flex items-center justify-center gap-2 mt-4">
        <span className="text-gray-400">Wallet Balance:</span>
        {editingWallet ? (
          <div className="flex items-center gap-2">
            <span className="text-gray-400">$</span>
            <input
              type="number"
              step="0.01"
              value={tempWallet}
              onChange={(e) => setTempWallet(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSaveWallet()}
              className="bg-gray-700 border border-blue-500 rounded px-3 py-1 w-32 font-mono text-lg focus:outline-none"
              autoFocus
            />
            <button
              onClick={onSaveWallet}
              className="bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-sm font-semibold"
            >
              ✓
            </button>
            <button
              onClick={onCancelWalletEdit}
              className="bg-gray-600 hover:bg-gray-700 px-3 py-1 rounded text-sm font-semibold"
            >
              ✕
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-blue-400">${wallet.toFixed(2)}</span>
            <button
              onClick={onStartEditWallet}
              className="bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-xs"
            >
              Edit
            </button>
          </div>
        )}
      </div>
      
      {/* Trading Fee Settings */}
      <div className="flex items-center justify-center gap-2 mt-2">
        <button
          onClick={() => setShowFeeSettings(!showFeeSettings)}
          className="text-sm text-gray-400 hover:text-gray-200 underline"
        >
          Trading Fee: {tradingFee}%
        </button>
        {showFeeSettings && (
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={tradingFee}
              onChange={(e) => setTradingFee(parseFloat(e.target.value) || 0)}
              className="bg-gray-700 border border-gray-600 rounded px-2 py-1 w-20 text-sm focus:outline-none focus:border-blue-500"
            />
            <span className="text-xs text-gray-400">%</span>
          </div>
        )}
      </div>
    </div>
  );
};