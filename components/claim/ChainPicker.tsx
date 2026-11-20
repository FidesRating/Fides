'use client';

import { useState } from 'react';

// Logos live in /public/chains. Robinhood Chain has no logo file yet, so it shows a letter badge instead.
const CHAINS: { key: string; name: string; logo: string | null }[] = [
  { key: 'robinhood', name: 'Robinhood Chain', logo: null },
  { key: 'ethereum', name: 'Ethereum', logo: '/chains/ethereum.svg' },
  { key: 'base', name: 'Base', logo: '/chains/base.svg' },
  { key: 'arbitrum', name: 'Arbitrum', logo: '/chains/arbitrum.svg' },
  { key: 'optimism', name: 'Optimism', logo: '/chains/optimism.svg' },
  { key: 'polygon', name: 'Polygon', logo: '/chains/polygon.svg' },
  { key: 'bnb', name: 'BNB Chain', logo: '/chains/bnb.svg' },
  { key: 'avalanche', name: 'Avalanche', logo: '/chains/avalanche.svg' },
  { key: 'berachain', name: 'Berachain', logo: '/chains/berachain.svg' },
];

/** Chain choice with logos. Submits the chain key through a hidden input named `name`. */
export default function ChainPicker({ name = 'chain', defaultValue = 'robinhood' }: { name?: string; defaultValue?: string }) {
  const [value, setValue] = useState(defaultValue);
  return (
    <div role="radiogroup" aria-label="Chain" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10 }}>
      <input type="hidden" name={name} value={value} />
      {CHAINS.map((c) => {
        const on = c.key === value;
        return (
          <button
            key={c.key}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => setValue(c.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', textAlign: 'left', cursor: 'pointer',
              borderRadius: 10, background: on ? 'var(--paper-3)' : 'var(--paper)', color: 'inherit', font: 'inherit',
              border: `1px solid ${on ? 'var(--brass)' : 'var(--line-2)'}`, boxShadow: on ? '0 0 0 2px var(--brass)' : 'none',
            }}
          >
            {c.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.logo} alt="" width={28} height={28} style={{ borderRadius: '50%', flex: 'none' }} />
            ) : (
              <span aria-hidden="true" style={{ width: 28, height: 28, flex: 'none', borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--ink-deep)', color: 'var(--paper)', fontWeight: 700, fontSize: 13 }}>
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
