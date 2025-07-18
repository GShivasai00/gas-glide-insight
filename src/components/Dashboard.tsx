import React, { useState } from 'react';
import { useGasStore } from '@/store/gasStore';
import { useBlockchainData } from '@/hooks/useBlockchainData';
import { GasWidget } from './GasWidget';
import { ChartWidget } from './ChartWidget';
import { SimulationPanel } from './SimulationPanel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Activity, DollarSign, TrendingUp, AlertCircle } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { 
    chains, 
    ethUsdPrice, 
    isLoading, 
    error, 
    mode 
  } = useGasStore();
  
  const [selectedChartChain, setSelectedChartChain] = useState<'ethereum' | 'polygon' | 'arbitrum'>('ethereum');
  
  // Initialize blockchain service
  useBlockchainData();
  
  // Calculate total gas costs across all chains
  const getTotalStats = () => {
    const totalChains = Object.keys(chains).length;
    const connectedChains = Object.values(chains).filter(chain => chain.isConnected).length;
    const avgGasPrice = Object.values(chains).reduce((sum, chain) => sum + chain.gasPrice, 0) / totalChains;
    
    return {
      totalChains,
      connectedChains,
      avgGasPrice,
    };
  };
  
  const stats = getTotalStats();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-crypto-primary" />
          <div>
            <h2 className="text-xl font-semibold">Initializing Gas Tracker</h2>
            <p className="text-muted-foreground">Connecting to blockchain networks...</p>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-card">
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <div className="p-3 rounded-full bg-gradient-primary">
              <Activity className="h-8 w-8 text-primary-foreground" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-crypto-primary to-crypto-primary-glow bg-clip-text text-transparent">
              Cross-Chain Gas Tracker
            </h1>
          </div>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Real-time gas price monitoring and transaction cost simulation across Ethereum, Polygon, and Arbitrum
          </p>
          
          {/* Status Bar */}
          <div className="flex items-center justify-center gap-4 text-sm">
            <Badge variant="outline" className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${stats.connectedChains === stats.totalChains ? 'bg-crypto-success' : 'bg-crypto-warning'}`} />
              {stats.connectedChains}/{stats.totalChains} Networks Connected
            </Badge>
            <Badge variant="outline" className="flex items-center gap-2">
              <DollarSign className="w-3 h-3" />
              ETH: ${ethUsdPrice.toFixed(2)}
            </Badge>
            <Badge variant="outline" className="flex items-center gap-2">
              <TrendingUp className="w-3 h-3" />
              Avg Gas: {stats.avgGasPrice.toFixed(1)} gwei
            </Badge>
          </div>
        </div>
        
        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Gas Widgets */}
          <div className="lg:col-span-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <GasWidget chainKey="ethereum" chainData={chains.ethereum} />
              <GasWidget chainKey="polygon" chainData={chains.polygon} />
              <GasWidget chainKey="arbitrum" chainData={chains.arbitrum} />
            </div>
            
            {/* Chart Widget */}
            <ChartWidget 
              selectedChain={selectedChartChain}
              onChainChange={setSelectedChartChain}
            />
          </div>
          
          {/* Simulation Panel */}
          <div className="lg:col-span-1">
            <SimulationPanel />
          </div>
        </div>
        
        {/* Live Data Indicator */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border/50">
            <div className="w-2 h-2 rounded-full bg-crypto-success animate-pulse" />
            <span className="text-sm text-muted-foreground">
              {mode === 'live' ? 'Live data streaming' : 'Simulation mode active'}
            </span>
          </div>
        </div>
        
        {/* Footer */}
        <footer className="text-center text-sm text-muted-foreground border-t border-border/50 pt-6">
          <p>
            Built with ethers.js • Real-time WebSocket connections • Uniswap V3 price feeds
          </p>
          <p className="mt-2">
            Gas prices update every ~6 seconds • ETH/USD from on-chain Uniswap V3 data
          </p>
        </footer>
      </div>
    </div>
  );
};