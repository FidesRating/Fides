import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Member, StaffRole, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { sha256 } from './crypto';
import { parseStaffWallets } from './staff-wallets';
import { TokenGateService } from './token-gate.service';

// ───────────── Staff (analyst / test_director / admin) ─────────────

export const STAFF_ROLES_KEY = 'staffRoles';
export const StaffRoles = (...roles: StaffRole[]) => SetMetadata(STAFF_ROLES_KEY, roles);

/**
 * Staff sign in with the same wallet session as members (Bearer token). The wallet must be on the
 * owner-managed STAFF_WALLETS allowlist, which is also the only source of the staff role.
 */
@Injectable()
export class StaffGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService, private readonly reflector: Reflector) {}

  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const auth: string | undefined = req.headers['authorization'];
    if (!auth?.startsWith('Bearer ')) throw new UnauthorizedException('Sign in with your wallet first');

    const session = await this.prisma.memberSession.findUnique({
      where: { tokenHash: sha256(auth.slice(7)) },
      include: { member: { select: { walletAddress: true } } },
    });
    if (!session || session.expiresAt < new Date()) throw new UnauthorizedException('Sign in with your wallet first');

    const wallet = session.member.walletAddress;
    const allowedRole = parseStaffWallets(process.env.STAFF_WALLETS).get(wallet);
    if (!allowedRole) throw new ForbiddenException('This wallet is not authorized for staff access');

    let staff = await this.prisma.user.findUnique({ where: { walletAddress: wallet } });
    if (!staff) {
      staff = await this.prisma.user.create({
        data: { walletAddress: wallet, email: `${wallet}@staff.fides.local`, name: `Staff ${wallet.slice(0, 6)}`, passwordHash: '!', role: allowedRole },
      });
    } else if (staff.role !== allowedRole) {
      staff = await this.prisma.user.update({ where: { id: staff.id }, data: { role: allowedRole } });
    }

    const roles = this.reflector.getAllAndOverride<StaffRole[]>(STAFF_ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    // An admin may do analyst work, but never committee-only work: the committee alone decides ratings.
    const adminMayPass = !!roles?.includes('analyst');
    if (roles?.length && !roles.includes(staff.role) && !(staff.role === 'admin' && adminMayPass)) {
      throw new ForbiddenException(`Requires role: ${roles.join(' or ')}`);
    }
    req.staff = staff;
    return true;
  }
}

export const CurrentStaff = createParamDecorator((_: unknown, ctx: ExecutionContext): User => ctx.switchToHttp().getRequest().staff);

// ───────────────────────────── Members ─────────────────────────────

export interface MemberContext {
  member: Member;
  isHolder: boolean; // saldo terakhir ≥ ambang
  via: 'session' | 'api_key';
}

async function resolveMember(prisma: PrismaService, gate: TokenGateService, req: any): Promise<MemberContext | null> {
  const auth: string | undefined = req.headers['authorization'];
  const apiKey: string | undefined = req.headers['x-api-key'];

  if (auth?.startsWith('Bearer ')) {
    const session = await prisma.memberSession.findUnique({
      where: { tokenHash: sha256(auth.slice(7)) },
      include: { member: true },
    });
    if (!session || session.expiresAt < new Date()) return null;
    return { member: session.member, isHolder: gate.isMember(Number(session.member.tokenBalance)), via: 'session' };
  }

  if (apiKey) {
    const key = await prisma.apiKey.findUnique({ where: { keyHash: sha256(apiKey) }, include: { member: true } });
    if (!key || key.revokedAt) return null;
    await prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });
    return { member: key.member, isHolder: gate.isMember(Number(key.member.tokenBalance)), via: 'api_key' };
  }
  return null;
}

/** Wajib login sebagai holder. */
@Injectable()
export class MemberGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService, private readonly gate: TokenGateService) {}

  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const mc = await resolveMember(this.prisma, this.gate, req);
    if (!mc) throw new UnauthorizedException('Sign in with your wallet first');
    if (!mc.isHolder) throw new ForbiddenException('Holding the minimum token balance is required');
    req.memberCtx = mc;
    return true;
  }
}

/** Optional login: public endpoints that show more data to holders. */
@Injectable()
export class OptionalMemberGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService, private readonly gate: TokenGateService) {}

  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    req.memberCtx = await resolveMember(this.prisma, this.gate, req);
    return true;
  }
}

/** A valid session with no balance requirement (for /me and linking an EVM wallet). */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService, private readonly gate: TokenGateService) {}

  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const mc = await resolveMember(this.prisma, this.gate, req);
    if (!mc || mc.via !== 'session') throw new UnauthorizedException('Sign in with your wallet first');
    req.memberCtx = mc;
    return true;
  }
}

export const CurrentMember = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): MemberContext | null => ctx.switchToHttp().getRequest().memberCtx ?? null,
);
