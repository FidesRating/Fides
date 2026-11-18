export type AddressFormat = 'evm_hex' | 'solana_base58' | 'move_hex' | 'ton';

export interface ChainConfig {
  chainKey: string;
  displayName: string;
  addressUrlTemplate: string;
  txUrlTemplate: string;
  addressFormat: AddressFormat;
  /** Default public RPC; override with env RPC_<CHAINKEY>, for example RPC_BASE. */
  rpcUrl?: string;
  logo: string;
}

/** 12 chains whose logos live in /public/chains. */
export const CHAIN_REGISTRY: Record<string, ChainConfig> = {
  ethereum: { chainKey: 'ethereum', displayName: 'Ethereum', addressUrlTemplate: 'https://etherscan.io/address/{address}', txUrlTemplate: 'https://etherscan.io/tx/{tx}', addressFormat: 'evm_hex', rpcUrl: 'https://eth.llamarpc.com', logo: '/chains/ethereum.svg' },
  base: { chainKey: 'base', displayName: 'Base', addressUrlTemplate: 'https://basescan.org/address/{address}', txUrlTemplate: 'https://basescan.org/tx/{tx}', addressFormat: 'evm_hex', rpcUrl: 'https://mainnet.base.org', logo: '/chains/base.svg' },
  arbitrum: { chainKey: 'arbitrum', displayName: 'Arbitrum', addressUrlTemplate: 'https://arbiscan.io/address/{address}', txUrlTemplate: 'https://arbiscan.io/tx/{tx}', addressFormat: 'evm_hex', rpcUrl: 'https://arb1.arbitrum.io/rpc', logo: '/chains/arbitrum.svg' },
  optimism: { chainKey: 'optimism', displayName: 'Optimism', addressUrlTemplate: 'https://optimistic.etherscan.io/address/{address}', txUrlTemplate: 'https://optimistic.etherscan.io/tx/{tx}', addressFormat: 'evm_hex', rpcUrl: 'https://mainnet.optimism.io', logo: '/chains/optimism.svg' },
  polygon: { chainKey: 'polygon', displayName: 'Polygon', addressUrlTemplate: 'https://polygonscan.com/address/{address}', txUrlTemplate: 'https://polygonscan.com/tx/{tx}', addressFormat: 'evm_hex', rpcUrl: 'https://polygon-rpc.com', logo: '/chains/polygon.svg' },
  bnb: { chainKey: 'bnb', displayName: 'BNB Chain', addressUrlTemplate: 'https://bscscan.com/address/{address}', txUrlTemplate: 'https://bscscan.com/tx/{tx}', addressFormat: 'evm_hex', rpcUrl: 'https://bsc-dataseed.bnbchain.org', logo: '/chains/bnb.svg' },
  avalanche: { chainKey: 'avalanche', displayName: 'Avalanche', addressUrlTemplate: 'https://snowtrace.io/address/{address}', txUrlTemplate: 'https://snowtrace.io/tx/{tx}', addressFormat: 'evm_hex', rpcUrl: 'https://api.avax.network/ext/bc/C/rpc', logo: '/chains/avalanche.svg' },
  berachain: { chainKey: 'berachain', displayName: 'Berachain', addressUrlTemplate: 'https://berascan.com/address/{address}', txUrlTemplate: 'https://berascan.com/tx/{tx}', addressFormat: 'evm_hex', rpcUrl: 'https://rpc.berachain.com', logo: '/chains/berachain.svg' },
  // Chain ID 4663. The public RPC is rate-limited; set RPC_ROBINHOOD to a dedicated provider in production.
  robinhood: { chainKey: 'robinhood', displayName: 'Robinhood Chain', addressUrlTemplate: 'https://robinhoodchain.blockscout.com/address/{address}', txUrlTemplate: 'https://robinhoodchain.blockscout.com/tx/{tx}', addressFormat: 'evm_hex', rpcUrl: 'https://rpc.mainnet.chain.robinhood.com', logo: '/chains/robinhood.svg' },
  solana: { chainKey: 'solana', displayName: 'Solana', addressUrlTemplate: 'https://solscan.io/account/{address}', txUrlTemplate: 'https://solscan.io/tx/{tx}', addressFormat: 'solana_base58', rpcUrl: 'https://api.mainnet-beta.solana.com', logo: '/chains/solana.svg' },
  sui: { chainKey: 'sui', displayName: 'Sui', addressUrlTemplate: 'https://suiscan.xyz/mainnet/account/{address}', txUrlTemplate: 'https://suiscan.xyz/mainnet/tx/{tx}', addressFormat: 'move_hex', logo: '/chains/sui.svg' },
  aptos: { chainKey: 'aptos', displayName: 'Aptos', addressUrlTemplate: 'https://explorer.aptoslabs.com/account/{address}', txUrlTemplate: 'https://explorer.aptoslabs.com/txn/{tx}', addressFormat: 'move_hex', logo: '/chains/aptos.svg' },
  ton: { chainKey: 'ton', displayName: 'TON', addressUrlTemplate: 'https://tonviewer.com/{address}', txUrlTemplate: 'https://tonviewer.com/transaction/{tx}', addressFormat: 'ton', logo: '/chains/ton.svg' },
};

export function rpcFor(chainKey: string): string | undefined {
  return process.env[`RPC_${chainKey.toUpperCase()}`] || CHAIN_REGISTRY[chainKey]?.rpcUrl;
}

export function isValidAddressForChain(address: string, format: AddressFormat): boolean {
  const a = address.trim();
  switch (format) {
    case 'evm_hex':
      return /^0x[0-9a-fA-F]{40}$/.test(a);
    case 'solana_base58':
      return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a);
    case 'move_hex':
      return /^0x[0-9a-fA-F]{1,64}$/.test(a);
    case 'ton':
      return /^[A-Za-z0-9_-]{48}$/.test(a) || /^-?\d:[0-9a-fA-F]{64}$/.test(a);
  }
}

export function explorerUrl(chainKey: string, address: string) {
  return CHAIN_REGISTRY[chainKey]?.addressUrlTemplate.replace('{address}', address) ?? null;
}
