'use client';

import { useEffect, useRef } from 'react';
import { readSessionWallet } from './session';

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
