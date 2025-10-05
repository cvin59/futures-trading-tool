import { useState, useEffect } from 'react';

export const useLocalStorage = <T>(key: string, defaultValue: T) => {
  const [value, setValue] = useState<T>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(key);
      if (saved !== null) {
        try {
          return JSON.parse(saved);
        } catch {
          return saved as unknown as T;
        }
      }
    }
    return defaultValue;
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      localStorage.setItem(key, stringValue);
    }
  }, [key, value]);

  return [value, setValue] as const;
};

export const useWallet = () => {
  const [wallet, setWallet] = useLocalStorage('futures-wallet', 906.3);
  const [editingWallet, setEditingWallet] = useState(false);
  const [tempWallet, setTempWallet] = useState(() => wallet.toString());

  useEffect(() => {
    setTempWallet(wallet.toString());
  }, [wallet]);

  const saveWallet = () => {
    const newWallet = parseFloat(tempWallet);
    if (!isNaN(newWallet) && newWallet > 0) {
      setWallet(newWallet);
      setEditingWallet(false);
    }
  };

  const cancelWalletEdit = () => {
    setTempWallet(wallet.toString());
    setEditingWallet(false);
  };

  return {
    wallet,
    setWallet,
    editingWallet,
    setEditingWallet,
    tempWallet,
    setTempWallet,
    saveWallet,
    cancelWalletEdit,
  };
};

export const useTradingFee = () => {
  const [tradingFee, setTradingFee] = useLocalStorage('futures-fee', 0.05);
  const [showFeeSettings, setShowFeeSettings] = useState(false);

  return {
    tradingFee,
    setTradingFee,
    showFeeSettings,
    setShowFeeSettings,
  };
};