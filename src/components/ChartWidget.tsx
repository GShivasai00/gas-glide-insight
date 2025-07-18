import React, { useEffect, useRef } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, LineData } from 'lightweight-charts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGasStore } from '@/store/gasStore';

interface ChartWidgetProps {
  selectedChain: 'ethereum' | 'polygon' | 'arbitrum';
  onChainChange: (chain: 'ethereum' | 'polygon' | 'arbitrum') => void;
}

export const ChartWidget: React.FC<ChartWidgetProps> = ({ selectedChain, onChainChange }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const lineSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  
  const { chains, getChartData, ethUsdPrice } = useGasStore();
  
  useEffect(() => {
    if (!chartContainerRef.current) return;
    
    // Create chart with proper color format for lightweight-charts
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 400,
      layout: {
        background: { color: 'transparent' },
        textColor: '#d4d4d8', // Convert from hsl(213 31% 91%) to hex
      },
      grid: {
        vertLines: { color: 'rgba(64, 64, 64, 0.5)' },
        horzLines: { color: 'rgba(64, 64, 64, 0.5)' },
      },
      timeScale: {
        borderColor: '#404040',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: '#404040',
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: 'rgba(0, 212, 255, 0.5)', // Convert crypto-primary with transparency
          width: 1,
          style: 2,
        },
        horzLine: {
          color: 'rgba(0, 212, 255, 0.5)', // Convert crypto-primary with transparency
          width: 1,
          style: 2,
        },
      },
    });
    
    // Add candlestick series for gas prices with compatible colors
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#22c55e', // Convert from hsl(142 76% 36%) to hex
      downColor: '#ef4444', // Convert from hsl(0 84% 60%) to hex
      borderUpColor: '#16a34a', // Convert from hsl(142 76% 46%) to hex
      borderDownColor: '#dc2626', // Convert from hsl(0 84% 70%) to hex
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });
    
    // Add line series for USD values with compatible color
    const lineSeries = chart.addLineSeries({
      color: '#00d4ff', // Convert from hsl(195 100% 50%) to hex
      lineWidth: 2,
      priceScaleId: 'right',
      title: 'USD Value',
    });
    
    chartRef.current = chart;
    seriesRef.current = candlestickSeries;
    lineSeriesRef.current = lineSeries;
    
    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
      }
    };
  }, []);
  
  // Update chart data when chain or data changes
  useEffect(() => {
    if (!seriesRef.current || !lineSeriesRef.current) return;
    
    const chartData = getChartData(selectedChain);
    
    if (chartData.length === 0) return;
    
    // Convert gas points to candlestick data
    const candlestickData: CandlestickData[] = [];
    const lineData: LineData[] = [];
    
    // Group data into 15-minute intervals for candlesticks
    const interval = 15 * 60 * 1000; // 15 minutes
    const now = Date.now();
    
    for (let i = 0; i < chartData.length - 4; i += 4) {
      const intervalData = chartData.slice(i, i + 4);
      if (intervalData.length === 0) continue;
      
      const open = intervalData[0].totalFee;
      const close = intervalData[intervalData.length - 1].totalFee;
      const high = Math.max(...intervalData.map(d => d.totalFee));
      const low = Math.min(...intervalData.map(d => d.totalFee));
      const time = intervalData[0].timestamp / 1000; // Convert to seconds
      
      candlestickData.push({
        time: time as any,
        open,
        high,
        low,
        close,
      });
      
      // Add USD value point
      const usdValue = close * 21000 / 1e9 * ethUsdPrice; // Standard transfer cost in USD
      lineData.push({
        time: time as any,
        value: usdValue,
      });
    }
    
    // Update series data
    seriesRef.current.setData(candlestickData);
    lineSeriesRef.current.setData(lineData);
    
  }, [selectedChain, chains, getChartData, ethUsdPrice]);
  
  const getChainDisplayName = (chain: string) => {
    const chainMap = {
      ethereum: 'Ethereum',
      polygon: 'Polygon',
      arbitrum: 'Arbitrum',
    };
    return chainMap[chain as keyof typeof chainMap] || chain;
  };
  
  return (
    <Card className="col-span-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Gas Price History</CardTitle>
          <Select value={selectedChain} onValueChange={onChainChange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ethereum">Ethereum</SelectItem>
              <SelectItem value="polygon">Polygon</SelectItem>
              <SelectItem value="arbitrum">Arbitrum</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="text-sm text-muted-foreground">
          15-minute intervals • {getChainDisplayName(selectedChain)} gas prices in gwei
        </p>
      </CardHeader>
      <CardContent>
        <div ref={chartContainerRef} className="w-full h-[400px]" />
      </CardContent>
    </Card>
  );
};