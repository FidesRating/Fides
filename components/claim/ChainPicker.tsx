'use client';

import { useState } from 'react';

// Logos live in /public/chains. A chain without a logo file shows a letter badge instead.
export const CHAINS: { key: string; name: string; logo: string | null; kind: 'evm' | 'solana' }[] = [
  { key: 'robinhood', name: 'Robinhood Chain', logo: '/chains/robinhood-logo.png', kind: 'evm' },
  { key: 'ethereum', name: 'Ethereum', logo: '/chains/ethereum-logo.png', kind: 'evm' },
  { key: 'base', name: 'Base', logo: '/chains/base-logo.png', kind: 'evm' },
  { key: 'arbitrum', name: 'Arbitrum', logo: '/chains/arbitrum-logo.png', kind: 'evm' },
  { key: 'optimism', name: 'Optimism', logo: '/chains/optimism-logo.png', kind: 'evm' },
  { key: 'polygon', name: 'Polygon', logo: '/chains/polygon-logo.png', kind: 'evm' },
  { key: 'bnb', name: 'BNB Chain', logo: '/chains/bnb-logo.png', kind: 'evm' },
  { key: 'avalanche', name: 'Avalanche', logo: '/chains/avalanche-logo.png', kind: 'evm' },
  { key: 'berachain', name: 'Berachain', logo: '/chains/berachain-logo.png', kind: 'evm' },
  { key: 'solana', name: 'Solana', logo: '/chains/solana-logo.png', kind: 'solana' },
];

/** The wallet kind that signs for a chain. */
export const chainKind = (key: string): 'evm' | 'solana' => CHAINS.find((c) => c.key === key)?.kind ?? 'evm';

/**
 * Chain choice with logos. Submits the chain key through a hidden input named `name`.
 * `show` limits the list to EVM chains, to Solana, or shows everything.
 */
export default function ChainPicker({ name = 'chain', show = 'all' }: { name?: string; show?: 'evm' | 'solana' | 'all' }) {
  const list = CHAINS.filter((c) => show === 'all' || c.kind === show);
  const [value, setValue] = useState(list[0]?.key ?? 'robinhood');
  return (
    <div role="radiogroup" aria-label="Chain" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 10 }}>
      <input type="hidden" name={name} value={value} />
      {list.map((c) => {
        const on = c.key === value;
        return (
          <button
            key={c.key}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => setValue(c.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', textAlign: 'left', cursor: 'pointer',
              borderRadius: 12, background: on ? 'var(--paper-3)' : 'var(--paper)', color: 'inherit', font: 'inherit',
              border: `1px solid ${on ? 'var(--brass)' : 'var(--line-2)'}`, boxShadow: on ? '0 0 0 2px var(--brass)' : 'none',
            }}
          >
            {c.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.logo} alt="" width={36} height={36} style={{ flex: 'none', borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <span aria-hidden="true" style={{ width: 36, height: 36, flex: 'none', borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--ink-deep)', color: 'var(--paper)', fontWeight: 700 }}>
                {c.name[0]}
              </span>
            )}
            <span style={{ fontSize: 14, fontWeight: on ? 600 : 400 }}>{c.name}</span>
          </button>
        );
      })}
    </div>
  );
}
