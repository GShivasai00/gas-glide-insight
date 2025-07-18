import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, Wifi, WifiOff } from 'lucide-react';
import { useGasStore } from '@/store/gasStore';
import type { ChainData } from '@/store/gasStore';

interface GasWidgetProps {
  chainKey: 'ethereum' | 'polygon' | 'arbitrum';
  chainData: ChainData;
}

export const GasWidget: React.FC<GasWidgetProps> = ({ chainKey, chainData }) => {
  const { ethUsdPrice } = useGasStore();
  
  // Calculate USD cost for standard transfer (21000 gas)
  const standardGasLimit = 21000;
  const gasCostETH = (chainData.gasPrice * standardGasLimit) / 1e9;
  const gasCostUSD = gasCostETH * ethUsdPrice;
  
  // Determine trend based on recent history
  const getTrend = () => {
    if (chainData.history.length < 2) return 'neutral';
    const recent = chainData.history.slice(-2);
    const current = recent[1]?.totalFee || 0;
    const previous = recent[0]?.totalFee || 0;
    
    if (current > previous * 1.05) return 'up';
    if (current < previous * 0.95) return 'down';
    return 'neutral';
  };
  
  const trend = getTrend();
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'crypto-danger' : trend === 'down' ? 'crypto-success' : 'muted-foreground';
  
  const getChainColor = () => {
    switch (chainKey) {
      case 'ethereum':
        return 'crypto-primary';
      case 'polygon':
        return 'crypto-warning';
      case 'arbitrum':
        return 'crypto-success';
      default:
        return 'crypto-primary';
    }
  };

  return (
    <Card className="relative overflow-hidden transition-all duration-300 hover:shadow-card border-border/50 bg-card/50 backdrop-blur-sm">
      {/* Connection Status Indicator */}
      <div className="absolute top-3 right-3">
        {chainData.isConnected ? (
          <Wifi className="h-4 w-4 text-crypto-success" />
        ) : (
          <WifiOff className="h-4 w-4 text-crypto-danger" />
        )}
      </div>
      
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full bg-${getChainColor()}`} />
            {chainData.name}
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            Block #{chainData.blockNumber.toLocaleString()}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Main Gas Price */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-3xl font-bold">{chainData.gasPrice.toFixed(1)}</span>
            <span className="text-sm text-muted-foreground">gwei</span>
            <TrendIcon className={`h-5 w-5 text-${trendColor}`} />
          </div>
          <p className="text-sm text-muted-foreground">Current Gas Price</p>
        </div>
        
        {/* Gas Breakdown */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="text-center p-2 rounded-lg bg-muted/30">
            <p className="font-medium">{chainData.baseFee.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">Base Fee</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/30">
            <p className="font-medium">{chainData.priorityFee.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">Priority Fee</p>
          </div>
        </div>
        
        {/* Cost Estimates */}
        <div className="border-t border-border/50 pt-3 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Transfer Cost:</span>
            <div className="text-right">
              <p className="font-medium">${gasCostUSD.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">
                {gasCostETH.toFixed(6)} {chainData.symbol}
              </p>
            </div>
          </div>
        </div>
        
        {/* Last Update */}
        <div className="text-xs text-muted-foreground text-center">
          {chainData.lastUpdate ? (
            <>Updated {Math.round((Date.now() - chainData.lastUpdate) / 1000)}s ago</>
          ) : (
            'Waiting for data...'
          )}
        </div>
      </CardContent>
    </Card>
  );
};