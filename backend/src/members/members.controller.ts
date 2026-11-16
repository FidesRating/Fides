import { Body, Controller, Delete, Get, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentMember, MemberContext, MemberGuard, SessionGuard } from '../common/auth.guards';
import { CreateApiKeyDto, NonceDto, VerifyDto } from './dto/members.dto';
import { MembersService } from './members.service';

@Controller()
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Post('auth/nonce')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  nonce(@Body() dto: NonceDto) {
    return this.members.createNonce(dto.walletAddress);
  }

  @Post('auth/verify')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  verify(@Body() dto: VerifyDto) {
    return this.members.verifyLogin(dto.walletAddress, dto.nonce, dto.signature);
  }

  @Post('auth/logout')
  @UseGuards(SessionGuard)
  logout(@Headers('authorization') auth: string) {
    return this.members.logout(auth.slice(7));
  }

  @Get('me')
  @UseGuards(SessionGuard)
  me(@CurrentMember() mc: MemberContext) {
    return this.members.me(mc.member.id);
  }

  @Get('me/api-keys')
  @UseGuards(MemberGuard)
  listKeys(@CurrentMember() mc: MemberContext) {
    return this.members.listApiKeys(mc.member.id);
  }

  @Post('me/api-keys')
  @UseGuards(MemberGuard)
  createKey(@CurrentMember() mc: MemberContext, @Body() dto: CreateApiKeyDto) {
    return this.members.createApiKey(mc.member.id, dto.label);
  }

  @Delete('me/api-keys/:id')
  @UseGuards(MemberGuard)
  revokeKey(@CurrentMember() mc: MemberContext, @Param('id') id: string) {
    return this.members.revokeApiKey(mc.member.id, id);
  }
}
