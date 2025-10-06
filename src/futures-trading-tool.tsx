import { useState, useMemo, useEffect, useRef } from 'react';
import { Wifi, WifiOff, Cloud, CloudOff, RefreshCw, DollarSign, LogOut, User, ChevronUp, ChevronDown, TrendingUp } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { saveToFirestore, loadFromFirestore, subscribeToFirestore, type TradingData, signIn, signUp, signOut, auth } from './lib/firebase';

// TypeScript interfaces
interface Position {
  id: number;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  entry: number;
  currentPrice: number;
  avgEntry: number;
  expectedPrice: number;
  sl: number;
  dca1: number;
  dca2: number;
  R: number;
  tp1: number;
  tp2: number;
  tp3: number;
  initialMargin: number;
  positionSize: number;
  leverage: number;
  dca1Executed: boolean;
  dca2Executed: boolean;
  tp1Closed: boolean;
  tp2Closed: boolean;
  tp3Closed: boolean;
  unrealizedPNL: number;
  remainingPercent: number;
  autoUpdate: boolean;
  totalFees: number;
  editingMargin: boolean;
  editingLeverage: boolean;
}

interface FormData {
  symbol: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: string;
  leverage: number;
  initialMargin: string;
}

interface BinanceTickerData {
  c: string;
  s: string;
}

const FuturesTradingTool = () => {
  const [wallet, setWallet] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('futures-wallet');
      return saved ? parseFloat(saved) : 906.3;
    }
    return 906.3;
  });
  
  const [editingWallet, setEditingWallet] = useState<boolean>(false);
  
  const [tempWallet, setTempWallet] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('futures-wallet');
      return saved || '906.3';
    }
    return '906.3';
  });
  
  const [positions, setPositions] = useState<Position[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('futures-positions');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          return parsed.map((pos: Position) => ({
            ...pos,
            autoUpdate: true,
            editingMargin: false,
            currentPrice: pos.currentPrice || pos.avgEntry || pos.entry,
            expectedPrice: pos.expectedPrice || pos.tp1 || pos.avgEntry,
          }));
        } catch (e) {
          console.error('Error loading positions:', e);
        }
      }
    }
    return [];
  });
  
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');
  const [sortField, setSortField] = useState<'symbol' | 'pnl' | 'roi' | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [formData, setFormData] = useState<FormData>({
    symbol: '',
    direction: 'LONG',
    entryPrice: '',
    leverage: 10,
    initialMargin: '',
  });

  const [tradingFee, setTradingFee] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('futures-fee');
      return saved ? parseFloat(saved) : 0.05;
    }
    return 0.05;
  });
  
  const [showFeeSettings, setShowFeeSettings] = useState<boolean>(false);
  const [tempMarginValues, setTempMarginValues] = useState<Map<number, string>>(new Map());
  const [tempLeverageValues, setTempLeverageValues] = useState<Map<number, string>>(new Map());
  const [tempTPValues, setTempTPValues] = useState<Map<string, string>>(new Map()); // key: `${posId}-tp${level}`
  const [tempDCAValues, setTempDCAValues] = useState<Map<string, string>>(new Map()); // key: `${posId}-dca${level}`

  // Firebase sync state
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'offline' | 'error'>('offline');
  const [lastSyncTime, setLastSyncTime] = useState<number>(0);
  const syncTimeoutRef = useRef<number | null>(null);
  const isSyncingRef = useRef(false);

  // Authentication state
  const [user, setUser] = useState<any>(null);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authForm, setAuthForm] = useState({ email: '', password: '' });
  const [authError, setAuthError] = useState<string>('');
  const [authLoading, setAuthLoading] = useState<boolean>(false);

  const wsConnections = useRef<Map<number, WebSocket>>(new Map());
  const autoUpdateStatus = useRef<Map<number, boolean>>(new Map());

  // Save to localStorage whenever positions change
  useEffect(() => {
    if (typeof window !== 'undefined' && positions.length >= 0) {
      localStorage.setItem('futures-positions', JSON.stringify(positions));
    }
  }, [positions]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('futures-wallet', wallet.toString());
    }
  }, [wallet]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('futures-fee', tradingFee.toString());
    }
  }, [tradingFee]);

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setSyncStatus('offline');
        setShowAuthModal(true);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      let result;
      if (authMode === 'login') {
        result = await signIn(authForm.email, authForm.password);
      } else {
        result = await signUp(authForm.email, authForm.password);
      }

      if (result.success) {
        setShowAuthModal(false);
        setAuthForm({ email: '', password: '' });
      } else {
        setAuthError(result.error || 'Authentication failed');
      }
    } catch (error: any) {
      setAuthError(error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    if (confirm('🔒 Log out? Your data will sync back when you log in again.')) {
      await signOut();
      setShowAuthModal(true);
    }
  };

  // Load from Firebase on mount
  useEffect(() => {
    const loadFirebaseData = async () => {
      setSyncStatus('syncing');
      try {
        const data = await loadFromFirestore();
        if (data) {
          const localTimestamp = parseInt(localStorage.getItem('futures-timestamp') || '0');
          if (data.lastUpdated > localTimestamp) {
            setPositions(data.positions.map((pos: Position) => ({
              ...pos,
              autoUpdate: true,
              editingMargin: false,
              currentPrice: pos.currentPrice || pos.avgEntry || pos.entry,
              expectedPrice: pos.expectedPrice || pos.tp1 || pos.avgEntry,
            })));
            setWallet(data.wallet);
            setTradingFee(data.tradingFee);
            setLastSyncTime(data.lastUpdated);
            localStorage.setItem('futures-timestamp', data.lastUpdated.toString());
          }
        }
        setSyncStatus('synced');
      } catch (error) {
        setSyncStatus('error');
      }
    };

    loadFirebaseData();
  }, []); // Empty dependency array - only load once on mount

  // Firebase real-time subscription
  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToFirestore((data) => {
      if (data && !isSyncingRef.current) {
        const localTimestamp = parseInt(localStorage.getItem('futures-timestamp') || '0');
        if (data.lastUpdated > localTimestamp) {
          setPositions(data.positions.map((pos: Position) => ({
            ...pos,
            autoUpdate: true,
            editingMargin: false,
            editingLeverage: false,
            currentPrice: pos.currentPrice || pos.avgEntry || pos.entry,
            expectedPrice: pos.expectedPrice || pos.tp1 || pos.avgEntry,
          })));
          setWallet(data.wallet);
          setTradingFee(data.tradingFee);
          setLastSyncTime(data.lastUpdated);
          localStorage.setItem('futures-timestamp', data.lastUpdated.toString());
          setSyncStatus('synced');
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [user]); // Only depend on user changes

  // Save to Firebase (debounced)
  useEffect(() => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    syncTimeoutRef.current = setTimeout(async () => {
      if (positions.length >= 0) {
        isSyncingRef.current = true;
        setSyncStatus('syncing');
        
        const data: TradingData = {
          wallet,
          tradingFee,
          positions: positions.map(pos => ({
            ...pos,
            autoUpdate: false,
            editingMargin: false,
          })),
          lastUpdated: Date.now(),
        };

        const success = await saveToFirestore(data);
        
        if (success) {
          setLastSyncTime(data.lastUpdated);
          localStorage.setItem('futures-timestamp', data.lastUpdated.toString());
          setSyncStatus('synced');
        } else {
          setSyncStatus('error');
        }
        
        isSyncingRef.current = false;
      }
    }, 2000);

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [positions, wallet, tradingFee]);

  // Setup WebSocket for price updates
  useEffect(() => {
    positions.forEach(pos => {
      const prevAutoUpdate = autoUpdateStatus.current.get(pos.id);
      const autoUpdateChanged = prevAutoUpdate !== pos.autoUpdate;
      
      autoUpdateStatus.current.set(pos.id, pos.autoUpdate);
      
      if (!pos.autoUpdate) {
        const existingWs = wsConnections.current.get(pos.id);
        if (existingWs) {
          existingWs.close();
          wsConnections.current.delete(pos.id);
        }
        return;
      }

      if (!wsConnections.current.has(pos.id) || autoUpdateChanged) {
        const existingWs = wsConnections.current.get(pos.id);
        if (existingWs) {
          existingWs.close();
        }

        const binanceSymbol = `${pos.symbol.toLowerCase()}usdt`;
        const ws = new WebSocket(`wss://fstream.binance.com/ws/${binanceSymbol}@ticker`);

        ws.onmessage = (event) => {
          try {
            const data: BinanceTickerData = JSON.parse(event.data);
            const price = parseFloat(data.c);
            
            if (!isNaN(price) && price > 0) {
              setPositions(prevPositions => {
                return prevPositions.map(p => {
                  if (p.id === pos.id && p.autoUpdate) {
                    const priceChange = p.direction === 'LONG'
                      ? (price - p.avgEntry) / p.avgEntry
                      : (p.avgEntry - price) / p.avgEntry;

                    const pnl = p.positionSize * priceChange * (p.remainingPercent / 100);

                    return {
                      ...p,
                      currentPrice: price,
                      unrealizedPNL: pnl,
                    };
                  }
                  return p;
                });
              });
            }
          } catch (error) {
            console.error('Error parsing WebSocket data:', error);
          }
        };

        ws.onerror = (error) => {
          console.error(`WebSocket error for ${pos.symbol}:`, error);
        };

        ws.onclose = () => {
          wsConnections.current.delete(pos.id);
        };

        wsConnections.current.set(pos.id, ws);
      }
    });

    wsConnections.current.forEach((ws, posId) => {
      const positionExists = positions.find(p => p.id === posId);
      if (!positionExists) {
        ws.close();
        wsConnections.current.delete(posId);
        autoUpdateStatus.current.delete(posId);
      }
    });

    return () => {
      wsConnections.current.forEach(ws => ws.close());
      wsConnections.current.clear();
      autoUpdateStatus.current.clear();
    };
  }, [positions]);

  const toggleAutoUpdate = (posId: number) => {
    setPositions(positions.map(pos => 
      pos.id === posId ? { ...pos, autoUpdate: !pos.autoUpdate } : pos
    ));
  };

  const calculateFee = (positionValue: number): number => {
    return positionValue * (tradingFee / 100);
  };

  const updateMargin = async (posId: number, newMargin: number) => {
    // Sync from store before updating margin
    const syncSuccess = await syncBeforeUpdate();
    if (!syncSuccess) {
      console.error('Failed to sync before updating margin');
      return;
    }
    setPositions(positions.map(pos => {
      if (pos.id !== posId) return pos;
      
      const newPositionSize = newMargin * 10;
      
      return {
        ...pos,
        initialMargin: newMargin,
        positionSize: newPositionSize,
        editingMargin: false,
      };
    }));
    
    setTempMarginValues(prev => {
      const newMap = new Map(prev);
      newMap.delete(posId);
      return newMap;
    });
  };

  const toggleMarginEdit = (posId: number) => {
    const pos = positions.find(p => p.id === posId);
    if (!pos) return;
    
    if (!pos.editingMargin) {
      setTempMarginValues(prev => new Map(prev).set(posId, pos.initialMargin.toFixed(2)));
    } else {
      setTempMarginValues(prev => {
        const newMap = new Map(prev);
        newMap.delete(posId);
        return newMap;
      });
    }
    
    setPositions(positions.map(p => 
      p.id === posId ? { ...p, editingMargin: !p.editingMargin } : p
    ));
  };
  
  const updateTempMargin = (posId: number, value: string) => {
    setTempMarginValues(prev => new Map(prev).set(posId, value));
  };

  const updateLeverage = async (posId: number, newLeverage: number) => {
    // Sync from store before updating leverage
    const syncSuccess = await syncBeforeUpdate();
    if (!syncSuccess) {
      console.error('Failed to sync before updating leverage');
      return;
    }
    setPositions(positions.map(pos => {
      if (pos.id !== posId) return pos;
      return {
        ...pos,
        leverage: newLeverage,
        positionSize: pos.initialMargin * newLeverage,
        editingLeverage: false,
      };
    }));
    setTempLeverageValues(prev => {
      const newMap = new Map(prev);
      newMap.delete(posId);
      return newMap;
    });
  };

  const toggleEditingLeverage = (posId: number) => {
    const pos = positions.find(p => p.id === posId);
    if (!pos?.editingLeverage) {
      setTempLeverageValues(prev => new Map(prev).set(posId, pos?.leverage?.toString() || '10'));
    } else {
      setTempLeverageValues(prev => {
        const newMap = new Map(prev);
        newMap.delete(posId);
        return newMap;
      });
    }
    
    setPositions(positions.map(p => 
      p.id === posId ? { ...p, editingLeverage: !p.editingLeverage } : p
    ));
  };
  
  const updateTempLeverage = (posId: number, value: string) => {
    setTempLeverageValues(prev => new Map(prev).set(posId, value));
  };

  // TP Helper Functions
  const updateTempTP = (posId: number, tpLevel: 1 | 2 | 3, value: string) => {
    setTempTPValues(prev => new Map(prev).set(`${posId}-tp${tpLevel}`, value));
  };

  const executeTpWithInput = async (posId: number, tpLevel: 1 | 2 | 3) => {
    const key = `${posId}-tp${tpLevel}`;
    const value = tempTPValues.get(key);
    if (value) {
      await closeTP(posId, tpLevel, parseFloat(value));
      setTempTPValues(prev => {
        const newMap = new Map(prev);
        newMap.delete(key);
        return newMap;
      });
    }
  };

  // DCA Helper Functions
  const updateTempDCA = (posId: number, dcaLevel: 1 | 2, value: string) => {
    setTempDCAValues(prev => new Map(prev).set(`${posId}-dca${dcaLevel}`, value));
  };

  const executeDcaWithInput = async (posId: number, dcaLevel: 1 | 2) => {
    const key = `${posId}-dca${dcaLevel}`;
    const value = tempDCAValues.get(key);
    if (value) {
      await executeDCA(posId, dcaLevel, parseFloat(value));
      setTempDCAValues(prev => {
        const newMap = new Map(prev);
        newMap.delete(key);
        return newMap;
      });
    }
  };

  const allocation = useMemo(() => ({
    initial: wallet * 0.45,
    dca: wallet * 0.40,
    emergency: wallet * 0.15,
    perTradeInitial: wallet * 0.045,
    perTradeDCA1: wallet * 0.024,
    perTradeDCA2: wallet * 0.016,
  }), [wallet]);

  const stats = useMemo(() => {
    // Calculate actual used margin from positions' initialMargin (which includes all executed DCAs)
    const totalUsedMargin = positions.reduce((sum, pos) => {
      return sum + pos.initialMargin;
    }, 0);

    const totalPNL = positions.reduce((sum, pos) => sum + (pos.unrealizedPNL || 0), 0);
    const equity = wallet + totalPNL;
    const freeMargin = equity - totalUsedMargin;
    const marginLevel = totalUsedMargin > 0 ? (equity / totalUsedMargin) * 100 : 0;
    
    // Available fund for new positions (from original wallet, not including PNL)
    const availableFund = wallet - totalUsedMargin;

    return {
      totalUsedMargin,
      totalPNL,
      equity,
      freeMargin,
      marginLevel,
      usedMarginPercent: (totalUsedMargin / wallet) * 100,
      availableFund,
      totalFund: wallet,
    };
  }, [positions, wallet, allocation]);

  const sortedPositions = useMemo(() => {
    if (!sortField) return positions;
    
    return [...positions].sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'symbol':
          comparison = a.symbol.localeCompare(b.symbol);
          break;
        case 'pnl':
          comparison = (a.unrealizedPNL || 0) - (b.unrealizedPNL || 0);
          break;
        case 'roi': {
          const roiA = ((a.unrealizedPNL || 0) / a.initialMargin) * 100;
          const roiB = ((b.unrealizedPNL || 0) / b.initialMargin) * 100;
          comparison = roiA - roiB;
          break;
        }
        default:
          return 0;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [positions, sortField, sortOrder]);

  const handleSort = (field: 'symbol' | 'pnl' | 'roi') => {
    if (sortField === field) {
      if (sortOrder === 'asc') {
        setSortOrder('desc');
      } else {
        setSortField(null);
      }
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const getPriceProximity = (pos: Position) => {
    const current = pos.currentPrice;
    const tolerance = pos.avgEntry * 0.005; // 0.5% tolerance for "near"
    
    // Check if at exact levels first (within tolerance)
    if (Math.abs(current - pos.tp1) <= tolerance) return { status: 'At TP1', color: 'text-green-400' };
    if (Math.abs(current - pos.tp2) <= tolerance) return { status: 'At TP2', color: 'text-green-400' };
    if (Math.abs(current - pos.tp3) <= tolerance) return { status: 'At TP3', color: 'text-green-400' };
    if (Math.abs(current - pos.dca1) <= tolerance) return { status: 'At DCA1', color: 'text-yellow-400' };
    if (Math.abs(current - pos.dca2) <= tolerance) return { status: 'At DCA2', color: 'text-yellow-400' };
    if (Math.abs(current - pos.sl) <= tolerance) return { status: 'At SL', color: 'text-red-400' };
    
    // Check if near levels (within 2% for "near")
    const nearTolerance = pos.avgEntry * 0.02; // 2% tolerance for "near"
    
    if (pos.direction === 'LONG') {
      // For LONG: TP levels are above entry, DCA/SL below
      if (current > pos.avgEntry) {
        // Above entry - check TP levels
        if (Math.abs(current - pos.tp3) <= nearTolerance && current < pos.tp3) return { status: 'Near TP3', color: 'text-green-300' };
        if (Math.abs(current - pos.tp2) <= nearTolerance && current < pos.tp2) return { status: 'Near TP2', color: 'text-green-300' };
        if (Math.abs(current - pos.tp1) <= nearTolerance && current < pos.tp1) return { status: 'Near TP1', color: 'text-green-300' };
        if (current > pos.tp3) return { status: 'Above TP3', color: 'text-green-500' };
        if (current > pos.tp2) return { status: 'Above TP2', color: 'text-green-400' };
        if (current > pos.tp1) return { status: 'Above TP1', color: 'text-green-400' };
      } else {
        // Below entry - check DCA/SL levels
        if (Math.abs(current - pos.dca1) <= nearTolerance && current > pos.dca1) return { status: 'Near DCA1', color: 'text-yellow-300' };
        if (Math.abs(current - pos.dca2) <= nearTolerance && current > pos.dca2) return { status: 'Near DCA2', color: 'text-yellow-300' };
        if (Math.abs(current - pos.sl) <= nearTolerance && current > pos.sl) return { status: 'Near SL', color: 'text-red-300' };
        if (current < pos.sl) return { status: 'Below SL', color: 'text-red-500' };
      }
    } else {
      // For SHORT: TP levels are below entry, DCA/SL above
      if (current < pos.avgEntry) {
        // Below entry - check TP levels
        if (Math.abs(current - pos.tp3) <= nearTolerance && current > pos.tp3) return { status: 'Near TP3', color: 'text-green-300' };
        if (Math.abs(current - pos.tp2) <= nearTolerance && current > pos.tp2) return { status: 'Near TP2', color: 'text-green-300' };
        if (Math.abs(current - pos.tp1) <= nearTolerance && current > pos.tp1) return { status: 'Near TP1', color: 'text-green-300' };
        if (current < pos.tp3) return { status: 'Below TP3', color: 'text-green-500' };
        if (current < pos.tp2) return { status: 'Below TP2', color: 'text-green-400' };
        if (current < pos.tp1) return { status: 'Below TP1', color: 'text-green-400' };
      } else {
        // Above entry - check DCA/SL levels
        if (Math.abs(current - pos.dca1) <= nearTolerance && current < pos.dca1) return { status: 'Near DCA1', color: 'text-yellow-300' };
        if (Math.abs(current - pos.dca2) <= nearTolerance && current < pos.dca2) return { status: 'Near DCA2', color: 'text-yellow-300' };
        if (Math.abs(current - pos.sl) <= nearTolerance && current < pos.sl) return { status: 'Near SL', color: 'text-red-300' };
        if (current > pos.sl) return { status: 'Above SL', color: 'text-red-500' };
      }
    }
    
    return { status: 'In Range', color: 'text-gray-400' };
  };

  const calculateLevels = (entry: string, direction: 'LONG' | 'SHORT') => {
    const entryNum = parseFloat(entry);
    if (!entryNum || isNaN(entryNum)) return null;

    const sl = direction === 'LONG' ? entryNum * 0.95 : entryNum * 1.05;
    const dca1 = direction === 'LONG' ? entryNum * 0.97 : entryNum * 1.03;
    const dca2 = direction === 'LONG' ? entryNum * 0.94 : entryNum * 1.06;
    const R = Math.abs(entryNum - sl);
    const tp1 = direction === 'LONG' ? entryNum + R : entryNum - R;
    const tp2 = direction === 'LONG' ? entryNum + 2*R : entryNum - 2*R;
    const tp3 = direction === 'LONG' ? entryNum + 3*R : entryNum - 3*R;

    return { sl, dca1, dca2, R, tp1, tp2, tp3, entry: entryNum };
  };

  // Sync from store before making updates to ensure data consistency
  const syncBeforeUpdate = async (): Promise<boolean> => {
    try {
      setSyncStatus('syncing');
      const data = await loadFromFirestore();
      if (data) {
        const localTimestamp = parseInt(localStorage.getItem('futures-timestamp') || '0');
        if (data.lastUpdated > localTimestamp) {
          setPositions(data.positions.map((pos: Position) => ({
            ...pos,
            autoUpdate: true,
            editingMargin: false,
            editingLeverage: false,
            currentPrice: pos.currentPrice || pos.avgEntry || pos.entry,
            expectedPrice: pos.expectedPrice || pos.tp1 || pos.avgEntry,
          })));
          setWallet(data.wallet);
          setTradingFee(data.tradingFee);
          setLastSyncTime(data.lastUpdated);
          localStorage.setItem('futures-timestamp', data.lastUpdated.toString());
        }
      }
      setSyncStatus('synced');
      return true;
    } catch (error) {
      console.error('Error syncing before update:', error);
      setSyncStatus('error');
      return false;
    }
  };

  const addPosition = async () => {
    if (!formData.symbol || !formData.entryPrice) return;

    // Sync from store before adding position
    const syncSuccess = await syncBeforeUpdate();
    if (!syncSuccess) {
      console.error('Failed to sync before adding position');
      return;
    }

    const levels = calculateLevels(formData.entryPrice, formData.direction);
    if (!levels) return;

    const customMargin = formData.initialMargin ? parseFloat(formData.initialMargin) : null;
    const baseMargin = customMargin || allocation.perTradeInitial;
    const leverage = formData.leverage || 10;
    const positionValue = baseMargin * leverage;
    const openFee = calculateFee(positionValue);
    const actualMargin = baseMargin - openFee;

    const newPosition: Position = {
      id: Date.now(),
      symbol: formData.symbol.toUpperCase(),
      direction: formData.direction,
      ...levels,
      currentPrice: levels.entry,
      avgEntry: levels.entry,
      expectedPrice: levels.tp1,
      initialMargin: actualMargin,
      positionSize: actualMargin * leverage,
      leverage,
      dca1Executed: false,
      dca2Executed: false,
      tp1Closed: false,
      tp2Closed: false,
      tp3Closed: false,
      unrealizedPNL: 0,
      remainingPercent: 100,
      autoUpdate: true,
      totalFees: openFee,
      editingMargin: false,
      editingLeverage: false,
    };

    setPositions([...positions, newPosition]);
    setFormData({ symbol: '', direction: 'LONG', entryPrice: '', leverage: 10, initialMargin: '' });
  };

  const executeDCA = async (posId: number, dcaLevel: 1 | 2, customMargin?: number) => {
    // Sync from store before executing DCA
    const syncSuccess = await syncBeforeUpdate();
    if (!syncSuccess) {
      console.error('Failed to sync before executing DCA');
      return;
    }
    setPositions(positions.map(pos => {
      if (pos.id !== posId) return pos;

      const isFirst = dcaLevel === 1;
      if ((isFirst && pos.dca1Executed) || (!isFirst && pos.dca2Executed)) return pos;

      const dcaPrice = isFirst ? pos.dca1 : pos.dca2;
      // Use custom margin if provided, otherwise use defaults
      const baseDcaMargin = customMargin !== undefined ? customMargin : (isFirst ? allocation.perTradeDCA1 : allocation.perTradeDCA2);
      
      const dcaPositionValue = baseDcaMargin * pos.leverage;
      const dcaFee = calculateFee(dcaPositionValue);
      const actualDcaMargin = baseDcaMargin - dcaFee;
      const dcaPosition = actualDcaMargin * pos.leverage;

      const totalPosition = pos.positionSize + dcaPosition;
      const avgEntry = (pos.positionSize * pos.avgEntry + dcaPosition * dcaPrice) / totalPosition;
      
      const newR = Math.abs(avgEntry - pos.sl);
      const newTP1 = pos.direction === 'LONG' ? avgEntry + newR : avgEntry - newR;
      const newTP2 = pos.direction === 'LONG' ? avgEntry + 2*newR : avgEntry - 2*newR;
      const newTP3 = pos.direction === 'LONG' ? avgEntry + 3*newR : avgEntry - 3*newR;

      return {
        ...pos,
        avgEntry,
        positionSize: totalPosition,
        initialMargin: pos.initialMargin + actualDcaMargin,
        totalFees: pos.totalFees + dcaFee,
        R: newR,
        tp1: newTP1,
        tp2: newTP2,
        tp3: newTP3,
        [isFirst ? 'dca1Executed' : 'dca2Executed']: true,
      };
    }));
  };

  const closeTP = async (posId: number, tpLevel: 1 | 2 | 3, customPercent?: number) => {
    // Sync from store before closing TP
    const syncSuccess = await syncBeforeUpdate();
    if (!syncSuccess) {
      console.error('Failed to sync before closing TP');
      return;
    }
    setPositions(positions.map(pos => {
      if (pos.id !== posId) return pos;

      // Use custom percentage if provided, otherwise use defaults
      let closePercent = customPercent;
      if (closePercent === undefined) {
        closePercent = 40;
        if (tpLevel === 2) closePercent = 30;
        if (tpLevel === 3) closePercent = 30;
      }

      const newRemaining = Math.max(0, pos.remainingPercent - closePercent);
      
      return {
        ...pos,
        remainingPercent: newRemaining,
        [`tp${tpLevel}Closed`]: true,
      };
    }));
  };

  const calculateExpectedPnL = (pos: Position): number => {
    const priceChange = pos.direction === 'LONG'
      ? (pos.expectedPrice - pos.avgEntry) / pos.avgEntry
      : (pos.avgEntry - pos.expectedPrice) / pos.avgEntry;
    
    return pos.positionSize * priceChange * (pos.remainingPercent / 100);
  };

  const updateExpectedPrice = (posId: number, newExpectedPrice: number) => {
    setPositions(positions.map(pos => 
      pos.id === posId ? { ...pos, expectedPrice: newExpectedPrice } : pos
    ));
  };

  const updatePrice = (posId: number, newPrice: number) => {
    setPositions(positions.map(pos => {
      if (pos.id !== posId) return pos;

      const priceChange = pos.direction === 'LONG'
        ? (newPrice - pos.avgEntry) / pos.avgEntry
        : (pos.avgEntry - newPrice) / pos.avgEntry;

      const pnl = pos.positionSize * priceChange * (pos.remainingPercent / 100);

      return {
        ...pos,
        currentPrice: newPrice,
        unrealizedPNL: pnl,
      };
    }));
  };

  const updateStopLoss = (posId: number, newSL: number) => {
    setPositions(positions.map(pos => {
      if (pos.id !== posId) return pos;

      const newR = Math.abs(pos.avgEntry - newSL);
      const newTP1 = pos.direction === 'LONG' ? pos.avgEntry + newR : pos.avgEntry - newR;
      const newTP2 = pos.direction === 'LONG' ? pos.avgEntry + 2*newR : pos.avgEntry - 2*newR;
      const newTP3 = pos.direction === 'LONG' ? pos.avgEntry + 3*newR : pos.avgEntry - 3*newR;

      return {
        ...pos,
        sl: newSL,
        R: newR,
        tp1: newTP1,
        tp2: newTP2,
        tp3: newTP3,
      };
    }));
  };

  const updateStopLossByPercent = (posId: number, percent: string) => {
    setPositions(positions.map(pos => {
      if (pos.id !== posId) return pos;

      const percentNum = parseFloat(percent);
      if (!percentNum || isNaN(percentNum)) return pos;

      const newSL = pos.avgEntry * (1 + percentNum / 100);

      const newR = Math.abs(pos.avgEntry - newSL);
      const newTP1 = pos.direction === 'LONG' ? pos.avgEntry + newR : pos.avgEntry - newR;
      const newTP2 = pos.direction === 'LONG' ? pos.avgEntry + 2*newR : pos.avgEntry - 2*newR;
      const newTP3 = pos.direction === 'LONG' ? pos.avgEntry + 3*newR : pos.avgEntry - 3*newR;

      return {
        ...pos,
        sl: newSL,
        R: newR,
        tp1: newTP1,
        tp2: newTP2,
        tp3: newTP3,
      };
    }));
  };

  const closePosition = (posId: number) => {
    setPositions(positions.filter(pos => pos.id !== posId));
  };

  const updateWallet = () => {
    const newWallet = parseFloat(tempWallet);
    if (newWallet && newWallet > 0 && !isNaN(newWallet)) {
      setWallet(newWallet);
      setEditingWallet(false);
    }
  };

  const cancelWalletEdit = () => {
    setTempWallet(wallet.toString());
    setEditingWallet(false);
  };

  const clearAllData = () => {
    if (confirm('⚠️ Delete all positions and reset wallet? This cannot be undone!')) {
      setPositions([]);
      setWallet(906.3);
      setTradingFee(0.05);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('futures-positions');
        localStorage.removeItem('futures-wallet');
        localStorage.removeItem('futures-fee');
        localStorage.removeItem('futures-timestamp');
      }
      saveToFirestore({
        wallet: 906.3,
        tradingFee: 0.05,
        positions: [],
        lastUpdated: Date.now(),
      });
    }
  };

  const manualSync = async () => {
    setSyncStatus('syncing');
    try {
      const data: TradingData = {
        wallet,
        tradingFee,
        positions: positions.map(pos => ({
          ...pos,
          autoUpdate: false,
          editingMargin: false,
        })),
        lastUpdated: Date.now(),
      };

      const success = await saveToFirestore(data);
      
      if (success) {
        setLastSyncTime(data.lastUpdated);
        localStorage.setItem('futures-timestamp', data.lastUpdated.toString());
        setSyncStatus('synced');
      } else {
        setSyncStatus('error');
      }
    } catch (error) {
      console.error('Manual sync error:', error);
      setSyncStatus('error');
    }
  };

  const exportData = () => {
    const data = {
      wallet,
      tradingFee,
      positions: positions.map(pos => ({
        ...pos,
        autoUpdate: false,
        editingMargin: false,
      })),
      exportDate: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `futures-positions-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data.positions) {
          setPositions(data.positions.map((pos: Position) => ({
            ...pos,
            autoUpdate: false,
            editingMargin: false,
            editingLeverage: false,
            currentPrice: pos.currentPrice || pos.avgEntry || pos.entry,
            totalFees: pos.totalFees || 0,
            remainingPercent: pos.remainingPercent || 100,
          })));
        }
        if (data.wallet) setWallet(data.wallet);
        if (data.tradingFee) setTradingFee(data.tradingFee);
        alert('✅ Data imported successfully!');
      } catch (error) {
        alert('❌ Error importing data. Please check the file format.');
        console.error('Import error:', error);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const getMarginColor = (level: number) => {
    if (level >= 200) return 'text-green-400';
    if (level >= 150) return 'text-green-300';
    if (level >= 130) return 'text-yellow-400';
    if (level >= 110) return 'text-orange-400';
    return 'text-red-400';
  };

  const getMarginBg = (level: number) => {
    if (level >= 200) return 'bg-green-500/10';
    if (level >= 150) return 'bg-green-500/10';
    if (level >= 130) return 'bg-yellow-500/10';
    if (level >= 110) return 'bg-orange-500/10';
    return 'bg-red-500/10';
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      {/* Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full border border-gray-700">
            <h2 className="text-2xl font-bold mb-4 text-center bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              {authMode === 'login' ? '🔐 Login' : '📝 Sign Up'}
            </h2>
            
            <p className="text-sm text-gray-400 mb-4 text-center">
              {authMode === 'login' 
                ? 'Login to sync your positions across all devices' 
                : 'Create an account to sync your data everywhere'}
            </p>

            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Email</label>
                <input
                  type="email"
                  value={authForm.email}
                  onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-blue-500"
                  placeholder="your@email.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Password</label>
                <input
                  type="password"
                  value={authForm.password}
                  onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-blue-500"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
                <p className="text-xs text-gray-500 mt-1">Minimum 6 characters</p>
              </div>

              {authError && (
                <div className="bg-red-900/30 border border-red-600/50 rounded p-3 text-sm text-red-400">
                  {authError}
                </div>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded px-4 py-2 font-semibold transition-colors"
              >
                {authLoading ? 'Loading...' : authMode === 'login' ? 'Login' : 'Sign Up'}
              </button>
            </form>

            <div className="mt-4 text-center">
              <button
                onClick={() => {
                  setAuthMode(authMode === 'login' ? 'signup' : 'login');
                  setAuthError('');
                }}
                className="text-sm text-blue-400 hover:text-blue-300 underline"
              >
                {authMode === 'login' 
                  ? "Don't have an account? Sign up" 
                  : "Already have an account? Login"}
              </button>
            </div>

            <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-600/30 rounded text-xs text-gray-300">
              <strong>💡 Tip:</strong> Use the same email/password on all your devices to sync data everywhere!
            </div>
          </div>
        </div>
      )}

      <div className="max-w-[1600px] mx-auto space-y-4 sm:space-y-6 px-4 lg:px-6 xl:px-8 py-4 lg:py-6">
        
        {/* Header */}
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
                    onClick={handleLogout}
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
                  onKeyDown={(e) => e.key === 'Enter' && updateWallet()}
                  className="bg-gray-700 border border-blue-500 rounded px-3 py-1 w-32 font-mono text-lg focus:outline-none"
                  autoFocus
                />
                <button
                  onClick={updateWallet}
                  className="bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-sm font-semibold"
                >
                  ✓
                </button>
                <button
                  onClick={cancelWalletEdit}
                  className="bg-gray-600 hover:bg-gray-700 px-3 py-1 rounded text-sm font-semibold"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-blue-400">${wallet.toFixed(2)}</span>
                <button
                  onClick={() => {
                    setTempWallet(wallet.toString());
                    setEditingWallet(true);
                  }}
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
                  value={tradingFee}
                  onChange={(e) => setTradingFee(parseFloat(e.target.value) || 0.05)}
                  className="bg-gray-700 border border-gray-600 rounded px-2 py-1 w-20 text-sm focus:outline-none"
                />
                <span className="text-sm text-gray-400">%</span>
              </div>
            )}
          </div>

          {/* Data Management */}
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mt-3 text-xs sm:text-sm">
            <button
              onClick={exportData}
              className="text-blue-400 hover:text-blue-300 underline"
              title="Export all data as JSON"
            >
              📥 Export Data
            </button>
            
            <label className="text-green-400 hover:text-green-300 underline cursor-pointer">
              📤 Import Data
              <input
                type="file"
                accept=".json"
                onChange={importData}
                className="hidden"
              />
            </label>
            
            <button
              onClick={clearAllData}
              className="text-red-400 hover:text-red-300 underline"
              title="Clear all positions and reset"
            >
              🗑️ Clear All
            </button>
            
            <div className="h-4 w-px bg-gray-600"></div>
            
            {/* Firebase Sync Status */}
            <button
              onClick={manualSync}
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
            
            {/* Global WiFi Toggle */}
            <button
              onClick={() => {
                const allAutoUpdate = positions.every(pos => pos.autoUpdate);
                setPositions(positions.map(pos => ({ 
                  ...pos, 
                  autoUpdate: !allAutoUpdate 
                })));
              }}
              className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors ${
                positions.every(pos => pos.autoUpdate)
                  ? 'text-green-400 hover:text-green-300 bg-green-900/20' 
                  : 'text-gray-400 hover:text-gray-300 bg-gray-800'
              }`}
              title={
                positions.every(pos => pos.autoUpdate)
                  ? 'Turn OFF all WiFi auto-updates'
                  : 'Turn ON all WiFi auto-updates'
              }
            >
              {positions.every(pos => pos.autoUpdate) ? (
                <Wifi size={12} />
              ) : (
                <WifiOff size={12} />
              )}
              <span className="text-xs">
                {positions.every(pos => pos.autoUpdate) ? 'All WiFi ON' : 'All WiFi OFF'}
              </span>
            </button>
          </div>
        </div>

        {/* Dashboard Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-3 md:gap-4 lg:gap-6">
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="text-gray-400 text-sm mb-1">Total Equity</div>
            <div className="text-2xl font-bold">${stats.equity.toFixed(2)}</div>
            <div className={`text-sm ${stats.totalPNL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {stats.totalPNL >= 0 ? '+' : ''}{stats.totalPNL.toFixed(2)} ({((stats.totalPNL/wallet)*100).toFixed(2)}%)
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="text-gray-400 text-sm mb-1">Used Margin</div>
            <div className="text-2xl font-bold text-orange-400">${stats.totalUsedMargin.toFixed(2)}</div>
            <div className="text-sm text-gray-400">{stats.usedMarginPercent.toFixed(1)}% of ${stats.totalFund.toFixed(0)}</div>
          </div>

          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="text-gray-400 text-sm mb-1">Free Margin</div>
            <div className="text-2xl font-bold text-blue-400">${stats.availableFund.toFixed(2)}</div>
            <div className="text-sm text-gray-400">{((stats.availableFund/wallet)*100).toFixed(1)}% remaining</div>
          </div>

          <div className={`rounded-lg p-4 border ${getMarginBg(stats.marginLevel)} border-gray-700`}>
            <div className="text-gray-400 text-sm mb-1">Margin Level</div>
            <div className={`text-2xl font-bold ${getMarginColor(stats.marginLevel)}`}>
              {stats.marginLevel > 0 ? stats.marginLevel.toFixed(0) : '∞'}%
            </div>
            <div className="text-sm text-gray-400">
              {stats.marginLevel >= 200 ? '🟢 Excellent' :
               stats.marginLevel >= 150 ? '🟢 Safe' :
               stats.marginLevel >= 130 ? '🟡 Caution' :
               stats.marginLevel >= 110 ? '🟠 Warning' : '🔴 Danger'}
            </div>
          </div>
        </div>

        {/* Fund Allocation */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h3 className="text-lg font-semibold mb-3">Fund Allocation (45/40/15)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-3 gap-3 md:gap-4 lg:gap-6 text-sm">
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
              <div className="text-xs text-gray-500">Do not touch</div>
            </div>
          </div>
        </div>

        {/* Add Position Form */}
        <div className="bg-gray-800 rounded-lg p-4 md:p-6 border border-gray-700">
          <h3 className="text-lg font-semibold mb-4">Open New Position</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 md:gap-4 lg:gap-6">
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
              onClick={addPosition}
              disabled={!formData.symbol || !formData.entryPrice}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded px-4 py-2 font-semibold transition-colors w-full"
            >
              Add Position
            </button>
          </div>

          {/* Preview calculation */}
          {formData.entryPrice && (() => {
            const preview = calculateLevels(formData.entryPrice, formData.direction);
            if (!preview) return null;
            
            const baseMargin = allocation.perTradeInitial;
            const positionValue = baseMargin * 10;
            const openFee = calculateFee(positionValue);
            const actualMargin = baseMargin - openFee;
            
            return (
              <div className="mt-4 p-3 md:p-4 bg-gray-700/50 rounded border border-gray-600">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 xl:grid-cols-5 gap-3 md:gap-4 lg:gap-6 text-sm">
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
                    {formData.initialMargin && <div className="text-xs text-purple-400">Custom</div>}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Active Positions */}
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
          
          {positions.length === 0 ? (
            <div className="bg-gray-800 rounded-lg p-8 border border-gray-700 text-center text-gray-400">
              No active positions. Add your first position above.
            </div>
          ) : viewMode === 'table' ? (
            /* TABLE VIEW */
            <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm md:min-w-[1200px]">
                  <thead className="bg-gray-900/50 border-b border-gray-700 sticky top-0">
                    <tr className="text-left">
                      <th className="p-2 md:p-3 font-semibold whitespace-nowrap">
                        <button
                          onClick={() => handleSort('symbol')}
                          className="flex items-center gap-1 hover:text-blue-400 transition-colors"
                        >
                          Symbol
                          {sortField === 'symbol' && sortOrder === 'asc' && <ChevronUp size={14} />}
                          {sortField === 'symbol' && sortOrder === 'desc' && <ChevronDown size={14} />}
                        </button>
                      </th>
                      <th className="hidden md:table-cell p-2 md:p-3 font-semibold whitespace-nowrap">Type</th>
                      <th className="hidden md:table-cell p-2 md:p-3 font-semibold whitespace-nowrap">Entry/Avg</th>
                      <th className="hidden md:table-cell p-2 md:p-3 font-semibold whitespace-nowrap">Current</th>
                      <th className="hidden md:table-cell p-2 md:p-3 font-semibold whitespace-nowrap">Stop Loss</th>
                      <th className="hidden md:table-cell p-2 md:p-3 font-semibold whitespace-nowrap">TP1/TP2/TP3</th>
                      <th className="hidden md:table-cell p-2 md:p-3 font-semibold whitespace-nowrap">Position</th>
                      <th className="hidden md:table-cell p-2 md:p-3 font-semibold whitespace-nowrap">Leverage</th>
                      <th className="p-2 md:p-3 font-semibold whitespace-nowrap">
                        <button
                          onClick={() => handleSort('pnl')}
                          className="flex items-center gap-1 hover:text-blue-400 transition-colors"
                        >
                          P&L
                          {sortField === 'pnl' && sortOrder === 'asc' && <ChevronUp size={14} />}
                          {sortField === 'pnl' && sortOrder === 'desc' && <ChevronDown size={14} />}
                        </button>
                      </th>
                      <th className="p-2 md:p-3 font-semibold whitespace-nowrap">
                        <button
                          onClick={() => handleSort('roi')}
                          className="flex items-center gap-1 hover:text-blue-400 transition-colors"
                        >
                          ROI
                          {sortField === 'roi' && sortOrder === 'asc' && <ChevronUp size={14} />}
                          {sortField === 'roi' && sortOrder === 'desc' && <ChevronDown size={14} />}
                        </button>
                      </th>
                      <th className="p-2 md:p-3 font-semibold whitespace-nowrap">Price Status</th>
                      <th className="hidden md:table-cell p-2 md:p-3 font-semibold whitespace-nowrap">Expected</th>
                      <th className="hidden md:table-cell p-2 md:p-3 font-semibold whitespace-nowrap">DCA</th>
                      <th className="hidden md:table-cell p-2 md:p-3 font-semibold whitespace-nowrap">TP Status</th>
                      <th className="hidden md:table-cell p-2 md:p-3 font-semibold whitespace-nowrap sticky right-0 bg-gray-900/50 min-w-[120px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPositions.map(pos => {
                      const priceChangePercent = pos.direction === 'LONG'
                        ? ((pos.currentPrice - pos.avgEntry) / pos.avgEntry * 100)
                        : ((pos.avgEntry - pos.currentPrice) / pos.avgEntry * 100);
                      const roi = (pos.unrealizedPNL / pos.initialMargin) * 100;
                      
                      return (
                        <tr key={pos.id} className="border-b border-gray-700 hover:bg-gray-700/30">
                          <td className="p-2 md:p-3 whitespace-nowrap">
                            <div className="font-bold">{pos.symbol}</div>
                          </td>
                          <td className="hidden md:table-cell p-2 md:p-3 whitespace-nowrap">
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              pos.direction === 'LONG' ? 'bg-green-600' : 'bg-red-600'
                            }`}>
                              {pos.direction}
                            </span>
                          </td>
                          <td className="hidden md:table-cell p-2 md:p-3 font-mono text-xs whitespace-nowrap">
                            <div>{pos.entry.toFixed(6)}</div>
                            <div className="text-blue-400">{pos.avgEntry.toFixed(6)}</div>
                          </td>
                          <td className="hidden md:table-cell p-2 md:p-3 whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                step="any"
                                value={pos.currentPrice}
                                onChange={(e) => updatePrice(pos.id, parseFloat(e.target.value) || 0)}
                                disabled={pos.autoUpdate}
                                className={`bg-gray-700 border border-gray-600 rounded px-2 py-1 font-mono text-xs w-24 focus:outline-none focus:border-blue-500 ${
                                  pos.autoUpdate ? 'opacity-50' : ''
                                }`}
                              />
                              <button
                                onClick={() => toggleAutoUpdate(pos.id)}
                                className={`p-1 rounded ${
                                  pos.autoUpdate ? 'text-green-400' : 'text-gray-500'
                                }`}
                                title={pos.autoUpdate ? 'Auto (Binance)' : 'Manual'}
                              >
                                {pos.autoUpdate ? <Wifi size={14} /> : <WifiOff size={14} />}
                              </button>
                            </div>
                            <div className={`text-xs mt-1 ${priceChangePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {priceChangePercent >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%
                            </div>
                          </td>
                          <td className="hidden md:table-cell p-2 md:p-3 font-mono text-xs text-red-400 whitespace-nowrap">
                            {pos.sl.toFixed(6)}
                          </td>
                          <td className="hidden md:table-cell p-2 md:p-3 font-mono text-xs text-green-400 whitespace-nowrap">
                            <div>{pos.tp1.toFixed(6)}</div>
                            <div>{pos.tp2.toFixed(6)}</div>
                            <div>{pos.tp3.toFixed(6)}</div>
                          </td>
                          <td className="hidden md:table-cell p-2 md:p-3 text-xs whitespace-nowrap">
                            <div>${pos.positionSize.toFixed(0)}</div>
                            
                            {/* Margin with edit */}
                            {pos.editingMargin ? (
                              <div className="flex items-center gap-1">
                                <span className="text-gray-500">$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={tempMarginValues.get(pos.id) || pos.initialMargin.toFixed(2)}
                                  onChange={(e) => updateTempMargin(pos.id, e.target.value)}
                                  onKeyDown={async (e) => {
                                    if (e.key === 'Enter') {
                                      const value = tempMarginValues.get(pos.id);
                                      if (value) {
                                        await updateMargin(pos.id, parseFloat(value) || pos.initialMargin);
                                      }
                                    } else if (e.key === 'Escape') {
                                      toggleMarginEdit(pos.id);
                                    }
                                  }}
                                  className="bg-gray-700 border border-blue-500 rounded px-1 py-0.5 w-14 text-xs"
                                  autoFocus
                                />
                                <button
                                  onClick={async () => {
                                    const value = tempMarginValues.get(pos.id);
                                    if (value) {
                                      await updateMargin(pos.id, parseFloat(value) || pos.initialMargin);
                                    } else {
                                      toggleMarginEdit(pos.id);
                                    }
                                  }}
                                  className="text-green-400 hover:text-green-300 text-xs"
                                >
                                  ✓
                                </button>
                                <button
                                  onClick={() => toggleMarginEdit(pos.id)}
                                  className="text-gray-400 hover:text-gray-200 text-xs"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-gray-400">
                                <span>${pos.initialMargin.toFixed(0)}</span>
                                <button
                                  onClick={() => toggleMarginEdit(pos.id)}
                                  className="text-blue-400 hover:text-blue-300"
                                >
                                  ✎
                                </button>
                              </div>
                            )}
                            
                            <div className="text-purple-400">{pos.remainingPercent}%</div>
                            <div className="text-orange-400">Fee: ${pos.totalFees.toFixed(2)}</div>
                          </td>
                          
                          {/* Leverage Column */}
                          <td className="hidden md:table-cell p-2 md:p-3 whitespace-nowrap">
                            {pos.editingLeverage ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min="1"
                                  max="100"
                                  value={tempLeverageValues.get(pos.id) || pos.leverage.toString()}
                                  onChange={(e) => updateTempLeverage(pos.id, e.target.value)}
                                  onKeyDown={async (e) => {
                                    if (e.key === 'Enter') {
                                      const value = tempLeverageValues.get(pos.id);
                                      if (value) {
                                        await updateLeverage(pos.id, parseInt(value) || pos.leverage);
                                      }
                                    } else if (e.key === 'Escape') {
                                      toggleEditingLeverage(pos.id);
                                    }
                                  }}
                                  className="bg-gray-700 border border-blue-500 rounded px-1 py-0.5 w-14 text-xs"
                                  autoFocus
                                />
                                <span className="text-purple-400 text-xs">x</span>
                                <button
                                  onClick={async () => {
                                    const value = tempLeverageValues.get(pos.id);
                                    if (value) {
                                      await updateLeverage(pos.id, parseInt(value) || pos.leverage);
                                    } else {
                                      toggleEditingLeverage(pos.id);
                                    }
                                  }}
                                  className="text-green-400 hover:text-green-300 text-xs"
                                >
                                  ✓
                                </button>
                                <button
                                  onClick={() => toggleEditingLeverage(pos.id)}
                                  className="text-gray-400 hover:text-gray-200 text-xs"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                <span className="font-mono text-purple-400 font-bold">{pos.leverage || 10}x</span>
                                <button
                                  onClick={() => toggleEditingLeverage(pos.id)}
                                  className="text-blue-400 hover:text-blue-300 text-xs"
                                >
                                  ✎
                                </button>
                              </div>
                            )}
                          </td>
                          
                          <td className="p-2 md:p-3 whitespace-nowrap">
                            <div className={`font-bold ${pos.unrealizedPNL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {pos.unrealizedPNL >= 0 ? '+' : ''}${pos.unrealizedPNL.toFixed(2)}
                            </div>
                          </td>
                          <td className="p-2 md:p-3 whitespace-nowrap">
                            <div className={`font-bold ${roi >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {roi >= 0 ? '+' : ''}{roi.toFixed(1)}%
                            </div>
                          </td>
                          <td className="p-2 md:p-3 text-xs whitespace-nowrap">
                            {(() => {
                              const proximity = getPriceProximity(pos);
                              return (
                                <div className={`font-semibold ${proximity.color}`}>
                                  {proximity.status}
                                </div>
                              );
                            })()}
                          </td>
                          <td className="hidden md:table-cell p-2 md:p-3 text-xs whitespace-nowrap">
                            <input
                              type="number"
                              step="any"
                              value={pos.expectedPrice}
                              onChange={(e) => updateExpectedPrice(pos.id, parseFloat(e.target.value) || 0)}
                              className="bg-gray-700 border border-gray-600 rounded px-2 py-1 font-mono text-xs w-20 focus:outline-none focus:border-blue-500"
                            />
                            {(() => {
                              const expectedPnL = calculateExpectedPnL(pos);
                              return (
                                <div className={`mt-1 font-semibold ${expectedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                  {expectedPnL >= 0 ? '+' : ''}${expectedPnL.toFixed(2)}
                                </div>
                              );
                            })()}
                          </td>
                          <td className="hidden md:table-cell p-2 md:p-3 text-xs whitespace-nowrap">
                            <div className={pos.dca1Executed ? 'text-yellow-400' : 'text-gray-500'}>
                              {pos.dca1Executed ? '✓ DCA1' : '○ DCA1'}
                            </div>
                            <div className={pos.dca2Executed ? 'text-yellow-400' : 'text-gray-500'}>
                              {pos.dca2Executed ? '✓ DCA2' : '○ DCA2'}
                            </div>
                          </td>
                          <td className="hidden md:table-cell p-2 md:p-3 text-xs whitespace-nowrap">
                            <div className={pos.tp1Closed ? 'text-green-400' : 'text-gray-500'}>
                              {pos.tp1Closed ? '✓ TP1' : '○ TP1'}
                            </div>
                            <div className={pos.tp2Closed ? 'text-green-400' : 'text-gray-500'}>
                              {pos.tp2Closed ? '✓ TP2' : '○ TP2'}
                            </div>
                            <div className={pos.tp3Closed ? 'text-green-400' : 'text-gray-500'}>
                              {pos.tp3Closed ? '✓ TP3' : '○ TP3'}
                            </div>
                          </td>
                          <td className="hidden md:table-cell p-2 md:p-3 whitespace-nowrap sticky right-0 bg-gray-800 min-w-[120px]">
                            <div className="flex flex-col gap-1">
                              <button
                                onClick={() => {
                                  setViewMode('cards');
                                  setTimeout(() => {
                                    document.getElementById(`pos-${pos.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                  }, 100);
                                }}
                                className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-xs font-medium w-full"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => closePosition(pos.id)}
                                className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-xs font-medium w-full"
                              >
                                Close
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="p-3 bg-gray-700/30 text-xs text-gray-400 text-center border-t border-gray-700">
                💡 Tip: Scroll horizontally to see all columns on small screens
              </div>
            </div>
          ) : (
            /* CARDS VIEW */
            sortedPositions.map(pos => (
              <div key={pos.id} id={`pos-${pos.id}`} className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                {/* Position Header */}
                <div className={`p-4 ${pos.direction === 'LONG' ? 'bg-green-900/20' : 'bg-red-900/20'} border-b border-gray-700`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-bold">{pos.symbol}</span>
                        <span className={`px-2 py-1 rounded text-sm font-semibold ${
                          pos.direction === 'LONG' ? 'bg-green-600' : 'bg-red-600'
                        }`}>
                          {pos.direction === 'LONG' ? '📈 LONG' : '📉 SHORT'}
                        </span>
                      </div>
                      <div className="text-sm text-gray-400 mt-1">
                        Entry: {pos.entry.toFixed(6)} → Avg: {pos.avgEntry.toFixed(6)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-2xl font-bold ${pos.unrealizedPNL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {pos.unrealizedPNL >= 0 ? '+' : ''}${pos.unrealizedPNL.toFixed(2)}
                      </div>
                      <div className="text-sm text-gray-400">
                        ROI: {((pos.unrealizedPNL/pos.initialMargin)*100).toFixed(2)}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* Position Details */}
                <div className="p-4 space-y-4">
                  {/* Current Price Input */}
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-400 w-32">Current Price:</label>
                    <input
                      type="number"
                      step="any"
                      value={pos.currentPrice}
                      onChange={(e) => updatePrice(pos.id, parseFloat(e.target.value) || 0)}
                      disabled={pos.autoUpdate}
                      className={`bg-gray-700 border border-gray-600 rounded px-3 py-1 font-mono flex-1 focus:outline-none focus:border-blue-500 ${
                        pos.autoUpdate ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    />
                    <div className="text-sm text-gray-400 w-24">
                      {pos.direction === 'LONG' 
                        ? `${((pos.currentPrice - pos.avgEntry) / pos.avgEntry * 100).toFixed(2)}%`
                        : `${((pos.avgEntry - pos.currentPrice) / pos.avgEntry * 100).toFixed(2)}%`
                      }
                    </div>
                    <button
                      onClick={() => toggleAutoUpdate(pos.id)}
                      className={`px-3 py-1 rounded text-sm font-semibold transition-colors ${
                        pos.autoUpdate 
                          ? 'bg-green-600 hover:bg-green-700 text-white' 
                          : 'bg-gray-600 hover:bg-gray-700 text-gray-300'
                      }`}
                      title={pos.autoUpdate ? 'Auto-update ON (Binance)' : 'Auto-update OFF (Manual)'}
                    >
                      {pos.autoUpdate ? <Wifi size={16} /> : <WifiOff size={16} />}
                    </button>
                  </div>

                  {/* Expected Price Input */}
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-400 w-32">Expected Price:</label>
                    <input
                      type="number"
                      step="any"
                      value={pos.expectedPrice}
                      onChange={(e) => updateExpectedPrice(pos.id, parseFloat(e.target.value) || 0)}
                      className="bg-gray-700 border border-blue-600/50 rounded px-3 py-1 font-mono flex-1 focus:outline-none focus:border-blue-500"
                    />
                    <div className="text-sm w-24">
                      {(() => {
                        const expectedPnL = calculateExpectedPnL(pos);
                        return (
                          <div className={`font-semibold ${expectedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {expectedPnL >= 0 ? '+' : ''}${expectedPnL.toFixed(2)}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Stop Loss Input */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-400 w-32">Stop Loss (Price):</label>
                      <input
                        type="number"
                        step="any"
                        value={pos.sl}
                        onChange={(e) => updateStopLoss(pos.id, parseFloat(e.target.value) || 0)}
                        className="bg-gray-700 border border-red-600/50 rounded px-3 py-1 font-mono flex-1 focus:outline-none focus:border-red-500"
                      />
                      <div className="text-sm text-red-400 w-24">
                        {pos.direction === 'LONG'
                          ? `${((pos.sl - pos.avgEntry) / pos.avgEntry * 100).toFixed(2)}%`
                          : `${((pos.sl - pos.avgEntry) / pos.avgEntry * 100).toFixed(2)}%`
                        }
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-400 w-32">Stop Loss (%):</label>
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="number"
                          step="0.1"
                          placeholder={pos.direction === 'LONG' ? '-5' : '+5'}
                          onChange={(e) => {
                            if (e.target.value) {
                              updateStopLossByPercent(pos.id, e.target.value);
                            }
                          }}
                          className="bg-gray-700 border border-red-600/50 rounded px-3 py-1 font-mono flex-1 focus:outline-none focus:border-red-500"
                        />
                        <span className="text-gray-500">%</span>
                      </div>
                      <div className="text-xs text-gray-500 w-24">
                        {pos.direction === 'LONG' ? 'e.g., -5' : 'e.g., +5'}
                      </div>
                    </div>
                  </div>

                  {/* Levels Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-3 lg:gap-4 text-sm">
                    <div className="bg-red-900/20 p-2 rounded border border-red-600/30">
                      <div className="text-gray-400 text-xs">Stop Loss (Editable)</div>
                      <div className="font-mono text-red-400">{pos.sl.toFixed(6)}</div>
                      <div className="text-xs text-gray-500">Risk: -70% ROI</div>
                    </div>

                    <div className="bg-yellow-900/20 p-2 rounded">
                      <div className="text-gray-400 text-xs">DCA Levels</div>
                      <div className="font-mono text-yellow-400 text-xs">
                        {pos.dca1.toFixed(6)}
                      </div>
                      <div className="font-mono text-yellow-400 text-xs">
                        {pos.dca2.toFixed(6)}
                      </div>
                    </div>

                    <div className="bg-green-900/20 p-2 rounded">
                      <div className="text-gray-400 text-xs">Take Profits</div>
                      <div className="font-mono text-green-400 text-xs">
                        TP1: {pos.tp1.toFixed(6)}
                      </div>
                      <div className="font-mono text-green-400 text-xs">
                        TP2: {pos.tp2.toFixed(6)}
                      </div>
                      <div className="font-mono text-green-400 text-xs">
                        TP3: {pos.tp3.toFixed(6)}
                      </div>
                    </div>

                    <div className="bg-blue-900/20 p-2 rounded">
                      <div className="text-gray-400 text-xs">Position</div>
                      <div className="font-mono">${pos.positionSize.toFixed(2)}</div>
                      
                      {/* Margin Editor */}
                      {pos.editingMargin ? (
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-gray-400 text-xs">$</span>
                          <input
                            type="number"
                            step="0.01"
                            value={tempMarginValues.get(pos.id) || pos.initialMargin.toFixed(2)}
                            onChange={(e) => updateTempMargin(pos.id, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const value = tempMarginValues.get(pos.id);
                                if (value) {
                                  updateMargin(pos.id, parseFloat(value) || pos.initialMargin);
                                }
                              } else if (e.key === 'Escape') {
                                toggleMarginEdit(pos.id);
                              }
                            }}
                            className="bg-gray-700 border border-blue-500 rounded px-1 py-0.5 w-16 text-xs focus:outline-none"
                            autoFocus
                          />
                          <button
                            onClick={() => {
                              const value = tempMarginValues.get(pos.id);
                              if (value) {
                                updateMargin(pos.id, parseFloat(value) || pos.initialMargin);
                              } else {
                                toggleMarginEdit(pos.id);
                              }
                            }}
                            className="text-xs text-green-400 hover:text-green-300"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => toggleMarginEdit(pos.id)}
                            className="text-xs text-gray-400 hover:text-gray-200"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <div className="text-xs text-gray-400">Margin: ${pos.initialMargin.toFixed(2)}</div>
                          <button
                            onClick={() => toggleMarginEdit(pos.id)}
                            className="text-xs text-blue-400 hover:text-blue-300"
                          >
                            ✎
                          </button>
                        </div>
                      )}
                      
                      <div className="text-xs text-purple-400">Remaining: {pos.remainingPercent}%</div>
                      <div className="text-xs text-orange-400">Fees: ${pos.totalFees.toFixed(2)}</div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 xl:grid-cols-7 gap-2 lg:gap-3">
                    {/* DCA Inputs */}
                    <div className="flex flex-col gap-1">
                      <div className="text-xs text-gray-400">DCA1 Margin</div>
                      {pos.dca1Executed ? (
                        <div className="text-xs text-yellow-400">✓ DCA1 Done</div>
                      ) : (
                        <div className="flex gap-1">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder={`$${allocation.perTradeDCA1.toFixed(0)}`}
                            value={tempDCAValues.get(`${pos.id}-dca1`) || ''}
                            onChange={(e) => updateTempDCA(pos.id, 1, e.target.value)}
                            className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs w-16"
                          />
                          <button
                            onClick={() => executeDcaWithInput(pos.id, 1)}
                            className="bg-yellow-600 hover:bg-yellow-700 rounded px-2 py-1 text-xs"
                          >
                            ▶
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-1">
                      <div className="text-xs text-gray-400">DCA2 Margin</div>
                      {pos.dca2Executed ? (
                        <div className="text-xs text-yellow-400">✓ DCA2 Done</div>
                      ) : (
                        <div className="flex gap-1">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder={`$${allocation.perTradeDCA2.toFixed(0)}`}
                            value={tempDCAValues.get(`${pos.id}-dca2`) || ''}
                            onChange={(e) => updateTempDCA(pos.id, 2, e.target.value)}
                            className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs w-16"
                          />
                          <button
                            onClick={() => executeDcaWithInput(pos.id, 2)}
                            className="bg-yellow-600 hover:bg-yellow-700 rounded px-2 py-1 text-xs"
                          >
                            ▶
                          </button>
                        </div>
                      )}
                    </div>

                    {/* TP Inputs */}
                    <div className="flex flex-col gap-1">
                      <div className="text-xs text-gray-400">TP1 %</div>
                      {pos.tp1Closed ? (
                        <div className="text-xs text-green-400">✓ TP1 Closed</div>
                      ) : (
                        <div className="flex gap-1">
                          <input
                            type="number"
                            step="1"
                            min="1"
                            max="100"
                            placeholder="40"
                            value={tempTPValues.get(`${pos.id}-tp1`) || ''}
                            onChange={(e) => updateTempTP(pos.id, 1, e.target.value)}
                            className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs w-12"
                          />
                          <button
                            onClick={() => executeTpWithInput(pos.id, 1)}
                            className="bg-green-600 hover:bg-green-700 rounded px-2 py-1 text-xs"
                          >
                            ▶
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-1">
                      <div className="text-xs text-gray-400">TP2 %</div>
                      {pos.tp2Closed ? (
                        <div className="text-xs text-green-400">✓ TP2 Closed</div>
                      ) : (
                        <div className="flex gap-1">
                          <input
                            type="number"
                            step="1"
                            min="1"
                            max="100"
                            placeholder="30"
                            value={tempTPValues.get(`${pos.id}-tp2`) || ''}
                            onChange={(e) => updateTempTP(pos.id, 2, e.target.value)}
                            className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs w-12"
                          />
                          <button
                            onClick={() => executeTpWithInput(pos.id, 2)}
                            className="bg-green-600 hover:bg-green-700 rounded px-2 py-1 text-xs"
                          >
                            ▶
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-1">
                      <div className="text-xs text-gray-400">TP3 %</div>
                      {pos.tp3Closed ? (
                        <div className="text-xs text-green-400">✓ TP3 Closed</div>
                      ) : (
                        <div className="flex gap-1">
                          <input
                            type="number"
                            step="1"
                            min="1"
                            max="100"
                            placeholder="30"
                            value={tempTPValues.get(`${pos.id}-tp3`) || ''}
                            onChange={(e) => updateTempTP(pos.id, 3, e.target.value)}
                            className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs w-12"
                          />
                          <button
                            onClick={() => executeTpWithInput(pos.id, 3)}
                            className="bg-green-600 hover:bg-green-700 rounded px-2 py-1 text-xs"
                          >
                            ▶
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Close Position */}
                    <button
                      onClick={() => closePosition(pos.id)}
                      className="px-2 lg:px-3 py-1.5 rounded text-xs sm:text-sm font-semibold bg-red-600 hover:bg-red-700 lg:col-span-1"
                    >
                      Close Position
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Quick Reference */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h3 className="text-lg font-semibold mb-3">Quick Reference</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 lg:gap-6 text-sm">
            <div>
              <div className="font-semibold text-blue-400 mb-2">LONG Setup</div>
              <div className="space-y-1 text-gray-300">
                <div>• SL: Entry × 0.95 (-5%)</div>
                <div>• DCA1: Entry × 0.97 (-3%)</div>
                <div>• DCA2: Entry × 0.94 (-6%)</div>
                <div>• TP: Entry + R, +2R, +3R</div>
              </div>
            </div>
            <div>
              <div className="font-semibold text-red-400 mb-2">SHORT Setup</div>
              <div className="space-y-1 text-gray-300">
                <div>• SL: Entry × 1.05 (+5%)</div>
                <div>• DCA1: Entry × 1.03 (+3%)</div>
                <div>• DCA2: Entry × 1.06 (+6%)</div>
                <div>• TP: Entry - R, -2R, -3R</div>
              </div>
            </div>
            <div>
              <div className="font-semibold text-purple-400 mb-2">Golden Rules</div>
              <div className="space-y-1 text-gray-300">
                <div>• Keep Margin Level &gt; 150%</div>
                <div>• TP: 40% @ TP1, 30% @ TP2, 30% @ TP3</div>
                <div>• Close 40% @ TP1 → Move SL to BE</div>
                <div>• Max 3 full DCA positions</div>
                <div>• Never move SL down</div>
              </div>
            </div>
          </div>
          <div className="mt-4 p-3 bg-blue-900/20 border border-blue-600/30 rounded">
            <div className="flex items-center gap-2 text-blue-400 font-semibold mb-1">
              <Wifi size={16} />
              <span>Auto Price Update (Binance)</span>
            </div>
            <div className="text-xs text-gray-300">
              Click the <Wifi size={12} className="inline" /> icon to enable/disable real-time price updates from Binance Futures. 
              Symbol format: BTC, ETH, SOL (auto adds USDT).
            </div>
          </div>
          
          <div className="mt-3 p-3 bg-orange-900/20 border border-orange-600/30 rounded">
            <div className="flex items-center gap-2 text-orange-400 font-semibold mb-1">
              <span>💰 Trading Fees & Margin</span>
            </div>
            <div className="text-xs text-gray-300 space-y-1">
              <div>• Fee ({tradingFee}%) auto-deducted when opening positions and DCA</div>
              <div>• Click <span className="text-blue-400">✎</span> next to margin → type new value → press <kbd className="px-1 py-0.5 bg-gray-700 rounded">Enter</kbd> or click <span className="text-green-400">✓</span></div>
              <div>• Press <kbd className="px-1 py-0.5 bg-gray-700 rounded">Esc</kbd> or click <span className="text-gray-400">✕</span> to cancel editing</div>
              <div>• Total fees tracked and displayed for each position</div>
            </div>
          </div>
          
          <div className="mt-3 p-3 bg-purple-900/20 border border-purple-600/30 rounded">
            <div className="flex items-center gap-2 text-purple-400 font-semibold mb-1">
              <Cloud size={16} />
              <span>Multi-Device Cloud Sync</span>
            </div>
            <div className="text-xs text-gray-300 space-y-1">
              <div>• <strong>Email/Password Auth:</strong> Login with same account on all devices</div>
              <div>• <strong>Real-time sync:</strong> Changes appear instantly on all logged-in devices</div>
              <div>• <strong>Auto-sync:</strong> Saves to cloud every 2 seconds automatically</div>
              <div>• <strong>Offline-first:</strong> Works without internet, syncs when back online</div>
              <div>• <strong>Data safety:</strong> Your data is encrypted and stored securely in Firebase</div>
              <div>• <strong>How to sync:</strong> Just login with same email/password on any device!</div>
            </div>
          </div>
          
          <div className="mt-3 p-3 bg-orange-900/20 border border-orange-600/30 rounded">
            <div className="flex items-center gap-2 text-orange-400 font-semibold mb-1">
              <DollarSign size={16} />
              <span>Trading Fees & Margin Adjustment</span>
            </div>
            <div className="text-xs text-gray-300 space-y-1">
              <div>• Trading fee is <strong>auto-deducted</strong> from margin when opening positions and DCA</div>
              <div>• Default: <strong>{tradingFee}%</strong> (Binance Futures taker fee) - click "Trading Fee" in header to adjust</div>
              <div>• Click the <span className="text-blue-400">✎ edit icon</span> next to margin to manually adjust if needed</div>
              <div>• Total fees paid are tracked and displayed for each position</div>
            </div>
          </div>
          
          <div className="mt-3 p-3 bg-blue-900/20 border border-blue-600/30 rounded">
            <div className="flex items-center gap-2 text-blue-400 font-semibold mb-1">
              <TrendingUp size={16} />
              <span>Margin Level Explained</span>
            </div>
            <div className="text-xs text-gray-300 space-y-1">
              <div>• <strong>Formula:</strong> Margin Level = (Equity ÷ Used Margin) × 100</div>
              <div>• <strong>Equity:</strong> Wallet Balance + Unrealized PNL</div>
              <div>• <strong>Used Margin:</strong> Total margin allocated to open positions</div>
              <div>• <strong>🟢 200%+:</strong> Excellent - Very safe, low risk of liquidation</div>
              <div>• <strong>🟢 150%+:</strong> Safe - Good buffer against market volatility</div>
              <div>• <strong>🟡 130%+:</strong> Caution - Monitor closely, consider reducing risk</div>
              <div>• <strong>🟠 110%+:</strong> Warning - High risk, consider closing positions</div>
              <div>• <strong>🔴 &lt;110%:</strong> Danger - Very high liquidation risk</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default FuturesTradingTool;