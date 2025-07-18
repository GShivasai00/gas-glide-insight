import { useEffect, useRef } from 'react';
import { useGasStore } from '@/store/gasStore';
import { blockchainService } from '@/services/blockchainService';

export const useBlockchainData = () => {
  const { mode, setLoading, setError } = useGasStore();
  const initializationRef = useRef(false);
  
  useEffect(() => {
    if (initializationRef.current) return;
    
    const initializeService = async () => {
      initializationRef.current = true;
      setLoading(true);
      
      try {
        await blockchainService.initialize();
        setError(null);
      } catch (error) {
        console.error('Failed to initialize blockchain service:', error);
        setError(error instanceof Error ? error.message : 'Failed to initialize blockchain service');
      } finally {
        setLoading(false);
      }
    };
    
    initializeService();
    
    // Cleanup function
    return () => {
      if (initializationRef.current) {
        blockchainService.disconnect();
        initializationRef.current = false;
      }
    };
  }, [setLoading, setError]);
  
  useEffect(() => {
    if (mode === 'simulation') {
      // In simulation mode, fetch data once for calculations
      blockchainService.fetchCurrentGasData();
    }
  }, [mode]);
  
  return {
    service: blockchainService,
  };
};