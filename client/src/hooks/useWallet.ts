"use client";

import { useState, useEffect, useCallback } from "react";
import {
  isConnected,
  requestAccess,
  getAddress,
  isAllowed,
} from "@stellar/freighter-api";

export interface WalletState {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  debug: string | null; // internal debug info
}

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    address: null,
    isConnected: false,
    isConnecting: false,
    error: null,
    debug: null,
  });

  const addDebug = useCallback((msg: string) => {
    console.log("[Freighter Debug]", msg);
    setState((prev) => ({ ...prev, debug: msg }));
  }, []);

  const checkConnection = useCallback(async () => {
    try {
      addDebug("Checking Freighter connection...");
      const conn = await isConnected();
      addDebug(`isConnected result: ${JSON.stringify(conn)}`);

      if (conn.isConnected) {
        // Check if we already have access
        const allowed = await isAllowed();
        addDebug(`isAllowed result: ${JSON.stringify(allowed)}`);

        if (allowed.isAllowed) {
          const addr = await getAddress();
          addDebug(`getAddress result: ${JSON.stringify(addr)}`);
          if (addr.address) {
            setState((prev) => ({
              ...prev,
              address: addr.address,
              isConnected: true,
              error: null,
              debug: `Connected: ${addr.address.slice(0, 8)}...`,
            }));
          }
        }
      }
    } catch (err: any) {
      addDebug(`checkConnection error: ${err?.message || "unknown"}`);
    }
  }, [addDebug]);

  useEffect(() => {
    (async () => {
      // Small delay to let Freighter inject its script
      await new Promise((r) => setTimeout(r, 500));
      await checkConnection();
    })();
  }, [checkConnection]);

  const connect = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      isConnecting: true,
      error: null,
      debug: "Connecting...",
    }));

    try {
      // Step 1: Check if Freighter extension exists
      addDebug("Step 1: Checking Freighter installation...");
      const conn = await isConnected();
      addDebug(`isConnected: ${JSON.stringify(conn)}`);

      if (!conn.isConnected) {
        addDebug("Freighter not detected");
        setState((prev) => ({
          ...prev,
          isConnecting: false,
          error:
            "Freighter wallet not detected. Please install the Freighter browser extension from https://freighter.app",
          debug: "Freighter not installed",
        }));
        return;
      }

      // Step 2: Request access — this triggers the Freighter popup
      addDebug("Step 2: Requesting access (popup should appear)...");
      const access = await requestAccess();
      addDebug(`requestAccess result: ${JSON.stringify(access)}`);

      if (access.error) {
        const errMsg =
          typeof access.error === "string"
            ? access.error
            : access.error.message || "Unknown error";

        addDebug(`requestAccess failed: ${errMsg}`);

        // If the extension says "not allowed" or "unauthorized", try a different approach:
        // Detected pattern: the extension may return "unidentified is allowed" or similar errors
        if (
          errMsg.toLowerCase().includes("not allowed") ||
          errMsg.toLowerCase().includes("unidentified") ||
          errMsg.toLowerCase().includes("denied")
        ) {
          setState((prev) => ({
            ...prev,
            isConnecting: false,
            error:
              "Freighter access was denied or blocked. Please:\n" +
              "1. Check for popup blockers and allow popups from this site\n" +
              "2. Open Freighter extension and approve this site in Settings\n" +
              "3. Make sure Freighter is unlocked",
            debug: `Error: ${errMsg}`,
          }));
        } else {
          setState((prev) => ({
            ...prev,
            isConnecting: false,
            error: `Freighter error: ${errMsg}`,
            debug: `Error: ${errMsg}`,
          }));
        }
        return;
      }

      // Step 3: Got the address
      if (access.address) {
        addDebug(`Connected! Address: ${access.address.slice(0, 8)}...`);
        setState({
          address: access.address,
          isConnected: true,
          isConnecting: false,
          error: null,
          debug: `Connected: ${access.address.slice(0, 8)}...`,
        });
      } else {
        // Fallback: try getAddress
        addDebug("No address from requestAccess, trying getAddress...");
        const addr = await getAddress();
        addDebug(`getAddress result: ${JSON.stringify(addr)}`);

        if (addr.address) {
          setState({
            address: addr.address,
            isConnected: true,
            isConnecting: false,
            error: null,
            debug: `Connected: ${addr.address.slice(0, 8)}...`,
          });
        } else {
          addDebug("getAddress also returned empty");
          setState((prev) => ({
            ...prev,
            isConnecting: false,
            error:
              "Could not retrieve wallet address. Make sure Freighter is unlocked and has an account.",
            debug: "No address returned",
          }));
        }
      }
    } catch (err: any) {
      const errMsg = err?.message || err?.toString() || "Unknown error";
      addDebug(`Unexpected error: ${errMsg}`);
      setState((prev) => ({
        ...prev,
        isConnecting: false,
        error: `Failed to connect: ${errMsg}`,
        debug: `Error: ${errMsg}`,
      }));
    }
  }, [addDebug]);

  const disconnect = useCallback(() => {
    setState({
      address: null,
      isConnected: false,
      isConnecting: false,
      error: null,
      debug: null,
    });
  }, []);

  return { ...state, connect, disconnect, checkConnection };
}
