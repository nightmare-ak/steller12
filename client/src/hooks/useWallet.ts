"use client";

import { useState, useEffect, useCallback } from "react";

export interface WalletState {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
}

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    address: null,
    isConnected: false,
    isConnecting: false,
    error: null,
  });

  const checkConnection = useCallback(async () => {
    try {
      const { isConnected } = await window.freighterApi.isConnected();
      if (isConnected) {
        const { address } = await window.freighterApi.getAddress();
        setState((prev) => ({
          ...prev,
          address,
          isConnected: true,
          error: null,
        }));
      }
    } catch {
      // Not connected, that's fine
    }
  }, []);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  const connect = useCallback(async () => {
    setState((prev) => ({ ...prev, isConnecting: true, error: null }));
    try {
      const { isAllowed } = await window.freighterApi.isAllowed();
      if (!isAllowed) {
        await window.freighterApi.setAllowed();
      }
      const { address } = await window.freighterApi.getAddress();
      setState({
        address,
        isConnected: true,
        isConnecting: false,
        error: null,
      });
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        isConnecting: false,
        error: err?.message || "Failed to connect Freighter wallet",
      }));
    }
  }, []);

  const disconnect = useCallback(() => {
    setState({
      address: null,
      isConnected: false,
      isConnecting: false,
      error: null,
    });
  }, []);

  return { ...state, connect, disconnect, checkConnection };
}
