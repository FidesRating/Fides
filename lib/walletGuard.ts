'use client';

import { useEffect, useRef } from 'react';
import { readSessionKind, readSessionWallet, solanaProvider } from './session';

interface WalletEvents {
  on?(event: 'accountsChanged', handler: (accounts: string[]) => void): void;
  removeListener?(event: 'accountsChanged', handler: (accounts: string[]) => void): void;
}

/**
 * Signs the page out when the wallet no longer matches the session: the wallet was locked or disconnected,
 * or another account was selected. The session itself belongs to the wallet it was signed with.
 * Sessions created before this guard have no stored wallet and are left alone.
 */
export function useWalletGuard(signedIn: boolean, onMismatch: () => void) {
  const handler = useRef(onMismatch);
  handler.current = onMismatch;

  useEffect(() => {
    if (!signedIn) return;
    if (readSessionKind() === 'solana') {
      const phantom = solanaProvider();
      if (!phantom?.on) return;
      // Phantom reports the new public key, or nothing when the wallet was disconnected or locked.
      const onKey = (key?: { toString(): string } | null) => {
        const expected = readSessionWallet();
        if (!expected) return;
        if (!key || key.toString() !== expected) handler.current();
      };
      const onDisconnect = () => handler.current();
      phantom.on('accountChanged', onKey);
      phantom.on('disconnect', onDisconnect);
      return () => { phantom.removeListener?.('accountChanged', onKey); phantom.removeListener?.('disconnect', onDisconnect); };
    }
    const wallet = (window as unknown as { ethereum?: WalletEvents }).ethereum;
    if (!wallet?.on) return;
    const onAccounts = (accounts: string[]) => {
      const expected = readSessionWallet();
      if (!expected) return;
      const current = accounts[0]?.toLowerCase();
      if (!current || current !== expected) handler.current();
    };
    wallet.on('accountsChanged', onAccounts);
    return () => wallet.removeListener?.('accountsChanged', onAccounts);
  }, [signedIn]);
}
