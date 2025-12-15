import { useState, useEffect, useCallback } from 'react';
import { a100Api, HealthResponse } from '@/lib/a100-api';

export function useA100Status() {
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [health, setHealth] = useState<HealthResponse | null>(null);

  const checkStatus = useCallback(async () => {
    setIsChecking(true);
    const healthData = await a100Api.checkHealth();
    setHealth(healthData);
    setIsOnline(a100Api.isOnline);
    setIsChecking(false);
  }, []);

  useEffect(() => {
    checkStatus();
    
    // Check every 30 seconds
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  return {
    isOnline,
    isChecking,
    health,
    retry: checkStatus,
  };
}
