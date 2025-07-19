import { ethers } from 'ethers';
import { useGasStore } from '../store/gasStore';

// Uniswap V3 ETH/USDC pool address
const UNISWAP_V3_POOL = '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640';

// Uniswap V3 Pool ABI (minimal for Swap events)
const POOL_ABI = [
  'event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)',
  'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)'
];

export class BlockchainService {
  private providers: Map<string, ethers.WebSocketProvider> = new Map();
  private isInitialized = false;

  async initialize() {
    if (this.isInitialized) return;

    const store = useGasStore.getState();
    
    try {
      // Use demo mode with simulated data for reliable operation
      this.setupDemoData();
      
      // Setup data update interval for live simulation
      setInterval(() => this.updateSimulatedData(), 6000); // Update every 6 seconds
      
      this.isInitialized = true;
      store.setLoading(false);
      store.setError(null);
      
      console.log('✅ Blockchain service initialized in demo mode');
    } catch (error) {
      console.error('Failed to initialize blockchain service:', error);
      store.setError(error instanceof Error ? error.message : 'Failed to initialize');
      store.setLoading(false);
    }
  }

  private setupDemoData() {
    const store = useGasStore.getState();
    
    // Set up simulated connection status
    store.updateChainData('ethereum', { isConnected: true });
    store.updateChainData('polygon', { isConnected: true });
    store.updateChainData('arbitrum', { isConnected: true });
    
    // Set initial ETH/USD price
    store.setEthUsdPrice(2347.82);
    
    // Generate initial gas data
    this.updateSimulatedData();
    
    console.log('✅ Demo data initialized for all chains');
  }

  private updateSimulatedData() {
    const store = useGasStore.getState();
    const chains = ['ethereum', 'polygon', 'arbitrum'] as const;
    
    chains.forEach(chainName => {
      // Generate realistic gas prices with some randomness
      const baseGasPrices = {
        ethereum: { base: 15, priority: 2, variance: 5 },
        polygon: { base: 35, priority: 30, variance: 10 },
        arbitrum: { base: 0.1, priority: 0.05, variance: 0.05 }
      };
      
      const config = baseGasPrices[chainName];
      const baseFee = config.base + (Math.random() - 0.5) * config.variance;
      const priorityFee = config.priority + (Math.random() - 0.5) * (config.variance * 0.3);
      const totalFee = baseFee + priorityFee;
      
      const gasPoint = {
        timestamp: Date.now(),
        baseFee: Math.max(0.01, baseFee),
        priorityFee: Math.max(0.01, priorityFee),
        totalFee: Math.max(0.02, totalFee),
        usdPrice: store.ethUsdPrice,
      };
      
      // Update store
      store.updateChainData(chainName, {
        baseFee: gasPoint.baseFee,
        priorityFee: gasPoint.priorityFee,
        gasPrice: gasPoint.totalFee,
        blockNumber: Math.floor(Date.now() / 6000), // Simulate block numbers
      });
      
      store.addGasPoint(chainName, gasPoint);
    });
    
    // Simulate ETH price changes
    const currentPrice = store.ethUsdPrice;
    const priceChange = (Math.random() - 0.5) * 10; // +/- $5 change
    store.setEthUsdPrice(Math.max(1000, currentPrice + priceChange));
  }

  private async handleNewBlock(chainName: string, blockNumber: number, provider: ethers.WebSocketProvider) {
    try {
      const block = await provider.getBlock(blockNumber, false);
      if (!block) return;

      const store = useGasStore.getState();
      
      let baseFee = 0;
      let priorityFee = 2; // Default priority fee in gwei
      
      if (block.baseFeePerGas) {
        baseFee = Number(ethers.formatUnits(block.baseFeePerGas, 'gwei'));
      }

      // For Polygon and Arbitrum, get gas price differently
      if (chainName === 'polygon' || chainName === 'arbitrum') {
        try {
          const feeData = await provider.getFeeData();
          if (feeData.gasPrice) {
            const gasPriceGwei = Number(ethers.formatUnits(feeData.gasPrice, 'gwei'));
            baseFee = gasPriceGwei * 0.8; // Approximate base fee
            priorityFee = gasPriceGwei * 0.2; // Approximate priority fee
          }
        } catch (error) {
          console.warn(`Failed to get gas price for ${chainName}:`, error);
        }
      }

      const totalFee = baseFee + priorityFee;
      const gasPoint = {
        timestamp: Date.now(),
        baseFee,
        priorityFee,
        totalFee,
        usdPrice: store.ethUsdPrice,
      };

      // Update store
      store.updateChainData(chainName as keyof typeof store.chains, {
        baseFee,
        priorityFee,
        gasPrice: totalFee,
        blockNumber,
      });

      store.addGasPoint(chainName as keyof typeof store.chains, gasPoint);

    } catch (error) {
      console.error(`Error handling block ${blockNumber} for ${chainName}:`, error);
    }
  }

  private async updateEthPrice() {
    try {
      // Use Ethereum mainnet provider for Uniswap V3 queries
      const ethProvider = this.providers.get('ethereum');
      if (!ethProvider) {
        console.warn('Ethereum provider not available for price updates');
        return;
      }

      const poolContract = new ethers.Contract(UNISWAP_V3_POOL, POOL_ABI, ethProvider);
      
      // Get current price from slot0
      const slot0 = await poolContract.slot0();
      const sqrtPriceX96 = slot0.sqrtPriceX96;
      
      // Calculate ETH/USD price from sqrtPriceX96
      // Formula: price = (sqrtPriceX96^2 * 10^12) / (2^192)
      // Note: USDC has 6 decimals, ETH has 18
      const price = this.calculatePriceFromSqrtPriceX96(sqrtPriceX96);
      
      const store = useGasStore.getState();
      store.setEthUsdPrice(price);
      
      console.log(`💰 ETH/USD Price updated: $${price.toFixed(2)}`);
      
    } catch (error) {
      console.error('Failed to update ETH price:', error);
      
      // Fallback: use a mock price for demo purposes
      const store = useGasStore.getState();
      if (store.ethUsdPrice === 0) {
        store.setEthUsdPrice(2000); // Fallback price
      }
    }
  }

  private calculatePriceFromSqrtPriceX96(sqrtPriceX96: bigint): number {
    try {
      // Convert to number for calculation (might lose precision for very large numbers)
      const sqrtPrice = Number(sqrtPriceX96);
      
      // Calculate price with proper decimal adjustment
      // ETH/USDC pool: token0 = USDC (6 decimals), token1 = ETH (18 decimals)
      const price = (sqrtPrice ** 2 * (10 ** 6)) / (2 ** 192 * 10 ** 18);
      
      // Invert to get ETH/USD (since pool is USDC/ETH)
      return 1 / price;
    } catch (error) {
      console.error('Error calculating price:', error);
      return 2000; // Fallback price
    }
  }

  async disconnect() {
    this.providers.forEach((provider, chainName) => {
      provider.removeAllListeners();
      provider.destroy();
    });
    this.providers.clear();
    this.isInitialized = false;
  }

  // Manual data fetch for simulation mode
  async fetchCurrentGasData() {
    const store = useGasStore.getState();
    
    for (const [chainName, provider] of this.providers) {
      try {
        const blockNumber = await provider.getBlockNumber();
        await this.handleNewBlock(chainName, blockNumber, provider);
      } catch (error) {
        console.error(`Failed to fetch gas data for ${chainName}:`, error);
      }
    }
  }
}

export const blockchainService = new BlockchainService();