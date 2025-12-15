import { useState, useEffect, useCallback, useRef } from 'react';
import { a100Api, HealthResponse } from '@/lib/a100-api';

export function useA100Status() {
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const hasChecked = useRef(false);

  const checkStatus = useCallback(async () => {
    setIsChecking(true);
    const healthData = await a100Api.checkHealth();
    setHealth(healthData);
    setIsOnline(healthData?.status === 'online' && healthData?.models_loaded === true);
    setIsChecking(false);
  }, []);

  useEffect(() => {
    // Only check once on mount
    if (!hasChecked.current) {
      hasChecked.current = true;
      checkStatus();
    }
    
    // Check every 60 seconds instead of 30
    const interval = setInterval(checkStatus, 60000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  return {
    isOnline,
    isChecking,
    health,
    retry: checkStatus,
  };
}
