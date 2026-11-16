import { IsString, MaxLength } from 'class-validator';

export class NonceDto {
  @IsString() walletAddress: string;
}

export class VerifyDto {
  @IsString() walletAddress: string;
  @IsString() nonce: string;
  @IsString() signature: string;
}

export class CreateApiKeyDto {
  @IsString() @MaxLength(40) label: string;
}
