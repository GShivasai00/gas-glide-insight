import { create } from 'zustand';
import { ethers } from 'ethers';

export interface GasPoint {
  timestamp: number;
  baseFee: number;
  priorityFee: number;
  totalFee: number;
  usdPrice?: number;
}

export interface ChainData {
  name: string;
  symbol: string;
  rpcUrl: string;
  baseFee: number;
  priorityFee: number;
  gasPrice: number;
  blockNumber: number;
  history: GasPoint[];
  isConnected: boolean;
  lastUpdate: number;
}

export interface SimulationData {
  amount: string;
  gasLimit: number;
  chain: string;
}

export interface GasState {
  // Mode management
  mode: 'live' | 'simulation';
  setMode: (mode: 'live' | 'simulation') => void;

  // Chain data
  chains: {
    ethereum: ChainData;
    polygon: ChainData;
    arbitrum: ChainData;
  };
  updateChainData: (chain: keyof GasState['chains'], data: Partial<ChainData>) => void;
  addGasPoint: (chain: keyof GasState['chains'], point: GasPoint) => void;

  // USD pricing from Uniswap V3
  ethUsdPrice: number;
  setEthUsdPrice: (price: number) => void;

  // Simulation
  simulation: SimulationData;
  setSimulation: (data: Partial<SimulationData>) => void;
  
  // WebSocket providers
  providers: Record<string, ethers.WebSocketProvider | null>;
  setProvider: (chain: string, provider: ethers.WebSocketProvider | null) => void;

  // UI state
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;

  // Chart data aggregation
  getChartData: (chain: keyof GasState['chains'], interval?: number) => GasPoint[];
  calculateTransactionCost: (chain: keyof GasState['chains'], gasLimit: number, amount: number) => {
    gasCostETH: number;
    gasCostUSD: number;
    totalCostETH: number;
    totalCostUSD: number;
  };
}

const initialChainData: ChainData = {
  name: '',
  symbol: '',
  rpcUrl: '',
  baseFee: 0,
  priorityFee: 0,
  gasPrice: 0,
  blockNumber: 0,
  history: [],
  isConnected: false,
  lastUpdate: 0,
};

export const useGasStore = create<GasState>((set, get) => ({
  // Mode management
  mode: 'live',
  setMode: (mode) => set({ mode }),

  // Chain data
  chains: {
    ethereum: {
      ...initialChainData,
      name: 'Ethereum',
      symbol: 'ETH',
      rpcUrl: 'wss://eth-mainnet.g.alchemy.com/v2/demo',
    },
    polygon: {
      ...initialChainData,
      name: 'Polygon',
      symbol: 'MATIC',
      rpcUrl: 'wss://polygon-mainnet.g.alchemy.com/v2/demo',
    },
    arbitrum: {
      ...initialChainData,
      name: 'Arbitrum',
      symbol: 'ETH',
      rpcUrl: 'wss://arb-mainnet.g.alchemy.com/v2/demo',
    },
  },

  updateChainData: (chain, data) =>
    set((state) => ({
      chains: {
        ...state.chains,
        [chain]: { ...state.chains[chain], ...data, lastUpdate: Date.now() },
      },
    })),

  addGasPoint: (chain, point) =>
    set((state) => {
      const chainData = state.chains[chain];
      const newHistory = [...chainData.history, point].slice(-100); // Keep last 100 points
      return {
        chains: {
          ...state.chains,
          [chain]: { ...chainData, history: newHistory },
        },
      };
    }),

  // USD pricing
  ethUsdPrice: 0,
  setEthUsdPrice: (price) => set({ ethUsdPrice: price }),

  // Simulation
  simulation: {
    amount: '0.1',
    gasLimit: 21000,
    chain: 'ethereum',
  },
  setSimulation: (data) =>
    set((state) => ({ simulation: { ...state.simulation, ...data } })),

  // Providers
  providers: {},
  setProvider: (chain, provider) =>
    set((state) => ({ providers: { ...state.providers, [chain]: provider } })),

  // UI state
  isLoading: false,
  setLoading: (loading) => set({ isLoading: loading }),
  error: null,
  setError: (error) => set({ error }),

  // Chart data aggregation (15-minute intervals)
  getChartData: (chain, interval = 15 * 60 * 1000) => {
    const { chains } = get();
    const history = chains[chain].history;
    
    if (history.length === 0) return [];

    const now = Date.now();
    const intervalStart = now - (24 * 60 * 60 * 1000); // Last 24 hours
    
    const filteredHistory = history.filter(point => point.timestamp >= intervalStart);
    
    // Aggregate data into intervals
    const aggregated: GasPoint[] = [];
    for (let time = intervalStart; time <= now; time += interval) {
      const intervalPoints = filteredHistory.filter(
        point => point.timestamp >= time && point.timestamp < time + interval
      );
      
      if (intervalPoints.length > 0) {
        const avg = intervalPoints.reduce(
          (acc, point) => ({
            baseFee: acc.baseFee + point.baseFee,
            priorityFee: acc.priorityFee + point.priorityFee,
            totalFee: acc.totalFee + point.totalFee,
          }),
          { baseFee: 0, priorityFee: 0, totalFee: 0 }
        );
        
        aggregated.push({
          timestamp: time,
          baseFee: avg.baseFee / intervalPoints.length,
          priorityFee: avg.priorityFee / intervalPoints.length,
          totalFee: avg.totalFee / intervalPoints.length,
        });
      }
    }
    
    return aggregated;
  },

  // Transaction cost calculation
  calculateTransactionCost: (chain, gasLimit, amount) => {
    const { chains, ethUsdPrice } = get();
    const chainData = chains[chain];
    
    const totalGasPrice = chainData.baseFee + chainData.priorityFee;
    const gasCostETH = (totalGasPrice * gasLimit) / 1e9; // Convert gwei to ETH
    const gasCostUSD = gasCostETH * ethUsdPrice;
    const totalCostETH = gasCostETH + amount;
    const totalCostUSD = totalCostETH * ethUsdPrice;
    
    return {
      gasCostETH,
      gasCostUSD,
      totalCostETH,
      totalCostUSD,
    };
  },
}));