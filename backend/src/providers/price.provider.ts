import { Injectable } from '@nestjs/common';

/** Price inputs for one call, in the form the analyst or an automated provider supplies them. */
export interface CallPriceInput {
  priceAtCall?: number;
  btcAtCall?: number;
  price7d?: number;
  price30d?: number;
  price90d?: number;
  btc7d?: number;
  btc30d?: number;
  btc90d?: number;
  /** Free text: exchange, pool or document the analyst used. */
  priceSourceRef?: string;
}

export interface PriceQuote extends CallPriceInput {
  /** Where the numbers came from. "manual" for analyst input. */
  priceSource: string;
}

/**
 * Adapter for token and BTC prices. The MVP only has the manual provider (analyst input).
 * A market-data provider can replace it later without touching the rating engine.
 */
export interface PriceProvider {
  quote(input: CallPriceInput): Promise<PriceQuote>;
}

export const PRICE_PROVIDER = Symbol('PRICE_PROVIDER');

@Injectable()
export class ManualPriceProvider implements PriceProvider {
  async quote(input: CallPriceInput): Promise<PriceQuote> {
    return { ...input, priceSource: 'manual' };
  }
}
