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
      // Initialize WebSocket providers for each chain
      await this.setupProvider('ethereum', store.chains.ethereum.rpcUrl);
      await this.setupProvider('polygon', store.chains.polygon.rpcUrl);
      await this.setupProvider('arbitrum', store.chains.arbitrum.rpcUrl);
      
      // Start listening for new blocks
      this.startBlockListeners();
      
      // Initialize ETH/USD price
      await this.updateEthPrice();
      
      // Setup price update interval
      setInterval(() => this.updateEthPrice(), 30000); // Update every 30 seconds
      
      this.isInitialized = true;
      store.setLoading(false);
      store.setError(null);
    } catch (error) {
      console.error('Failed to initialize blockchain service:', error);
      store.setError(error instanceof Error ? error.message : 'Failed to initialize');
      store.setLoading(false);
    }
  }

  private async setupProvider(chainName: string, rpcUrl: string) {
    try {
      const provider = new ethers.WebSocketProvider(rpcUrl);
      
      // Test connection
      await provider.getNetwork();
      
      this.providers.set(chainName, provider);
      
      const store = useGasStore.getState();
      store.setProvider(chainName, provider);
      store.updateChainData(chainName as keyof typeof store.chains, { isConnected: true });
      
      console.log(`✅ Connected to ${chainName}`);
    } catch (error) {
      console.error(`❌ Failed to connect to ${chainName}:`, error);
      
      const store = useGasStore.getState();
      store.updateChainData(chainName as keyof typeof store.chains, { isConnected: false });
    }
  }

  private startBlockListeners() {
    this.providers.forEach((provider, chainName) => {
      provider.on('block', async (blockNumber) => {
        await this.handleNewBlock(chainName, blockNumber, provider);
      });
    });
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