import { Module } from '@nestjs/common';
import { ManualPriceProvider, PRICE_PROVIDER } from './price.provider';

@Module({
  providers: [{ provide: PRICE_PROVIDER, useClass: ManualPriceProvider }],
  exports: [PRICE_PROVIDER],
})
export class ProvidersModule {}
