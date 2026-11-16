import { Global, Module } from '@nestjs/common';
import { MemberGuard, OptionalMemberGuard, SessionGuard, StaffGuard } from './auth.guards';
import { TokenGateService } from './token-gate.service';

@Global()
@Module({
  providers: [TokenGateService, StaffGuard, MemberGuard, OptionalMemberGuard, SessionGuard],
  exports: [TokenGateService, StaffGuard, MemberGuard, OptionalMemberGuard, SessionGuard],
})
export class CommonModule {}
