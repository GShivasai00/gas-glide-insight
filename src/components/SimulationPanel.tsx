import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calculator, ArrowRight } from 'lucide-react';
import { useGasStore } from '@/store/gasStore';

export const SimulationPanel: React.FC = () => {
  const { 
    simulation, 
    setSimulation, 
    calculateTransactionCost, 
    chains, 
    ethUsdPrice,
    mode,
    setMode 
  } = useGasStore();
  
  const handleAmountChange = (value: string) => {
    // Validate numeric input
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setSimulation({ amount: value });
    }
  };
  
  const handleGasLimitChange = (value: string) => {
    const numValue = parseInt(value) || 21000;
    setSimulation({ gasLimit: numValue });
  };
  
  const getTransactionCosts = () => {
    const amount = parseFloat(simulation.amount) || 0;
    const gasLimit = simulation.gasLimit;
    
    return {
      ethereum: calculateTransactionCost('ethereum', gasLimit, amount),
      polygon: calculateTransactionCost('polygon', gasLimit, amount),
      arbitrum: calculateTransactionCost('arbitrum', gasLimit, amount),
    };
  };
  
  const costs = getTransactionCosts();
  const selectedChain = simulation.chain as keyof typeof costs;
  const selectedCost = costs[selectedChain];
  
  const getChainSymbol = (chain: string) => {
    const symbols = {
      ethereum: 'ETH',
      polygon: 'MATIC',
      arbitrum: 'ETH',
    };
    return symbols[chain as keyof typeof symbols] || 'ETH';
  };
  
  const getCheapestChain = () => {
    const costEntries = Object.entries(costs);
    return costEntries.reduce((cheapest, [chain, cost]) => 
      cost.gasCostUSD < cheapest.cost.gasCostUSD ? { chain, cost } : cheapest,
      { chain: costEntries[0][0], cost: costEntries[0][1] }
    );
  };
  
  const cheapest = getCheapestChain();
  
  return (
    <div className="space-y-6">
      {/* Mode Toggle */}
      <div className="flex gap-2">
        <Button
          variant={mode === 'live' ? 'default' : 'outline'}
          onClick={() => setMode('live')}
          className="flex-1"
        >
          Live Mode
        </Button>
        <Button
          variant={mode === 'simulation' ? 'default' : 'outline'}
          onClick={() => setMode('simulation')}
          className="flex-1"
        >
          <Calculator className="w-4 h-4 mr-2" />
          Simulation
        </Button>
      </div>
      
      {mode === 'simulation' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="w-5 h-5" />
              Transaction Simulator
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Input Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount to Send</Label>
                <div className="relative">
                  <Input
                    id="amount"
                    type="text"
                    placeholder="0.1"
                    value={simulation.amount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    className="pr-12"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    {getChainSymbol(simulation.chain)}
                  </span>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="gasLimit">Gas Limit</Label>
                <Input
                  id="gasLimit"
                  type="number"
                  placeholder="21000"
                  value={simulation.gasLimit}
                  onChange={(e) => handleGasLimitChange(e.target.value)}
                />
              </div>
            </div>
            
            {/* Chain Selection */}
            <div className="space-y-2">
              <Label>Blockchain</Label>
              <Select value={simulation.chain} onValueChange={(value) => setSimulation({ chain: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ethereum">Ethereum</SelectItem>
                  <SelectItem value="polygon">Polygon</SelectItem>
                  <SelectItem value="arbitrum">Arbitrum</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Cost Breakdown */}
            <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
              <h4 className="font-semibold">Cost Breakdown</h4>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Gas Cost</p>
                  <p className="font-medium">${selectedCost.gasCostUSD.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedCost.gasCostETH.toFixed(6)} {getChainSymbol(simulation.chain)}
                  </p>
                </div>
                
                <div>
                  <p className="text-muted-foreground">Total Cost</p>
                  <p className="font-medium">${selectedCost.totalCostUSD.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedCost.totalCostETH.toFixed(6)} {getChainSymbol(simulation.chain)}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Cross-Chain Comparison */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Cross-Chain Comparison</h4>
                <Badge variant="outline" className="text-crypto-success">
                  Cheapest: {cheapest.chain.charAt(0).toUpperCase() + cheapest.chain.slice(1)}
                </Badge>
              </div>
              
              <div className="space-y-2">
                {Object.entries(costs).map(([chain, cost]) => (
                  <div
                    key={chain}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      chain === cheapest.chain 
                        ? 'border-crypto-success bg-crypto-success/10' 
                        : 'border-border bg-muted/10'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${
                        chain === 'ethereum' ? 'bg-crypto-primary' :
                        chain === 'polygon' ? 'bg-crypto-warning' :
                        'bg-crypto-success'
                      }`} />
                      <span className="font-medium capitalize">{chain}</span>
                    </div>
                    
                    <div className="text-right">
                      <p className="font-medium">${cost.gasCostUSD.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">
                        Gas: {chains[chain as keyof typeof chains].gasPrice.toFixed(1)} gwei
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* ETH Price Info */}
            <div className="text-center text-sm text-muted-foreground border-t pt-3">
              ETH/USD: ${ethUsdPrice.toFixed(2)} • Last updated: {new Date().toLocaleTimeString()}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};