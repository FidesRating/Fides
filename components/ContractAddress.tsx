'use client';

import { useState } from 'react';

// Contract address pill. Renders nothing until NEXT_PUBLIC_FIDES_CA is set.
const CA = process.env.NEXT_PUBLIC_FIDES_CA?.trim();
const EXPLORER_BASE = 'https://robinhoodchain.blockscout.com/address/';
const href = CA ? `${EXPLORER_BASE}${encodeURIComponent(CA)}` : null;

export default function ContractAddress({ className = '' }: { className?: string }) {
  const [copied, setCopied] = useState(false);
  if (!CA) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(CA);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (insecure context); the address stays selectable.
    }
  };

  return (
    <div className={`ca ${className}`.trim()}>
      <span className="ca-lbl">$FIDES CA</span>
      {href ? (
        <a className="ca-addr" href={href} target="_blank" rel="noopener noreferrer" title="Verify on Robinhood Chain explorer"><code>{CA}</code></a>
      ) : (
        <code className="ca-addr">{CA}</code>
      )}
      <button type="button" className="ca-copy" onClick={copy} aria-label={copied ? 'Copied' : 'Copy contract address'} title={copied ? 'Copied' : 'Copy'}>
        {copied ? (
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m3 8.5 3.2 3.2L13 4.8"/></svg>
        ) : (
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 5.5v-2a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2"/></svg>
        )}
      </button>
    </div>
  );
}
