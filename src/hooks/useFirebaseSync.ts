import { useState, useRef } from 'react';
import { saveToFirestore, loadFromFirestore, subscribeToFirestore } from '../lib/firebase';
import type { Position, SyncStatus } from '../types/trading';

interface FirebaseSyncData {
  wallet: number;
  tradingFee: number;
  positions: Position[];
}

export const useFirebaseSync = () => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('offline');
  const [lastSyncTime, setLastSyncTime] = useState<number>(0);
  const syncTimeoutRef = useRef<number | null>(null);
  const isSyncingRef = useRef(false);

  const syncToFirebase = async (data: FirebaseSyncData) => {
    if (isSyncingRef.current) return;
    
    isSyncingRef.current = true;
    setSyncStatus('syncing');

    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    syncTimeoutRef.current = window.setTimeout(async () => {
      try {
        const success = await saveToFirestore({
          wallet: data.wallet,
          tradingFee: data.tradingFee,
          positions: data.positions,
          lastUpdated: Date.now(),
        });

        if (success) {
          setSyncStatus('synced');
          setLastSyncTime(Date.now());
          localStorage.setItem('futures-timestamp', Date.now().toString());
        } else {
          setSyncStatus('error');
        }
      } catch (error) {
        console.error('Sync error:', error);
        setSyncStatus('error');
      } finally {
        isSyncingRef.current = false;
      }
    }, 1000);
  };

  const loadFromFirebase = async (): Promise<FirebaseSyncData | null> => {
    setSyncStatus('syncing');
    try {
      const data = await loadFromFirestore();
      if (data) {
        const localTimestamp = parseInt(localStorage.getItem('futures-timestamp') || '0');
        if (data.lastUpdated > localTimestamp) {
          setSyncStatus('synced');
          setLastSyncTime(data.lastUpdated);
          localStorage.setItem('futures-timestamp', data.lastUpdated.toString());
          
          return {
            wallet: data.wallet,
            tradingFee: data.tradingFee,
            positions: data.positions.map((pos: Position) => ({
              ...pos,
              autoUpdate: false,
              editingMargin: false,
              currentPrice: pos.currentPrice || pos.avgEntry || pos.entry,
            })),
          };
        }
      }
      setSyncStatus('synced');
      return null;
    } catch (error) {
      setSyncStatus('error');
      return null;
    }
  };

  const subscribeToFirebaseChanges = (
    onDataReceived: (data: FirebaseSyncData) => void
  ) => {
    return subscribeToFirestore((data) => {
      if (data && !isSyncingRef.current) {
        const localTimestamp = parseInt(localStorage.getItem('futures-timestamp') || '0');
        if (data.lastUpdated > localTimestamp) {
          onDataReceived({
            wallet: data.wallet,
            tradingFee: data.tradingFee,
            positions: data.positions.map((pos: Position) => ({
              ...pos,
              autoUpdate: false,
              editingMargin: false,
              currentPrice: pos.currentPrice || pos.avgEntry || pos.entry,
            })),
          });
          setLastSyncTime(data.lastUpdated);
          localStorage.setItem('futures-timestamp', data.lastUpdated.toString());
        }
      }
    });
  };

  return {
    syncStatus,
    setSyncStatus,
    lastSyncTime,
    syncToFirebase,
    loadFromFirebase,
    subscribeToFirebaseChanges,
  };
};