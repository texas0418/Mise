// ---------------------------------------------------------------------------
// hooks/useNetworkStatus.ts — Tracks online/offline state
//
// Uses @react-native-community/netinfo if installed, otherwise falls back
// to a simple periodic check. Provides isOnline boolean and triggers
// sync when coming back online.
// ---------------------------------------------------------------------------

import { useEffect, useState, useRef, useCallback } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

let NetInfo: any = null;
try {
  NetInfo = require('@react-native-community/netinfo').default;
} catch {
  // NetInfo not installed — use fallback
}

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);
  const previousOnline = useRef(true);

  useEffect(() => {
    if (NetInfo) {
      // Use NetInfo if available
      const unsubscribe = NetInfo.addEventListener((state: any) => {
        const online = state.isConnected && state.isInternetReachable !== false;
        handleStatusChange(online);
      });
      return () => unsubscribe();
    } else {
      // Fallback: check connectivity via fetch every 30s
      const check = async () => {
        try {
          const response = await fetch('https://clients3.google.com/generate_204', {
            method: 'HEAD',
            cache: 'no-store',
          });
          handleStatusChange(response.ok);
        } catch {
          handleStatusChange(false);
        }
      };

      check(); // Initial check
      const interval = setInterval(check, 30000);
      return () => clearInterval(interval);
    }
  }, []);

  // Also check when app comes to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active' && !NetInfo) {
        // Re-check connectivity
        fetch('https://clients3.google.com/generate_204', { method: 'HEAD', cache: 'no-store' })
          .then(r => handleStatusChange(r.ok))
          .catch(() => handleStatusChange(false));
      }
    });
    return () => sub.remove();
  }, []);

  const handleStatusChange = useCallback((online: boolean) => {
    setIsOnline(online);

    // Track if we just came back online (was offline → now online)
    if (online && !previousOnline.current) {
      setWasOffline(true);
      // Reset after a short delay so consumers can react
      setTimeout(() => setWasOffline(false), 5000);
    }

    previousOnline.current = online;
  }, []);

  return {
    /** Whether the device currently has internet */
    isOnline,
    /** True briefly after coming back online (useful for triggering sync) */
    justReconnected: wasOffline,
  };
}
