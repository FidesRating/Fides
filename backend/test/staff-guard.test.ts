import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { StaffGuard, StaffRoles } from '../src/common/auth.guards';

const ADMIN = '0x88b8792bbb75ea611b1eadc2708ea63fc097b57a';
const COMMITTEE = '0xce03fb06ea28ff76ce6fc6e1297dcd5c3a44f0b7';

// Minimal stand-ins for the database: one session per wallet, and a staff row that follows the allowlist role.
function guardFor(wallet: string, role: string) {
  process.env.STAFF_WALLETS = `${ADMIN}:admin,${COMMITTEE}:committee`;
  const prisma: any = {
    memberSession: { findUnique: async () => ({ expiresAt: new Date(Date.now() + 60_000), member: { walletAddress: wallet } }) },
    user: { findUnique: async () => ({ id: 'u1', role, walletAddress: wallet }), create: async () => ({ id: 'u1', role, walletAddress: wallet }), update: async () => ({ id: 'u1', role, walletAddress: wallet }) },
  };
  return new StaffGuard(prisma, new Reflector());
}

function ctxFor(handlerRoles: string[]) {
  class Controller { handler() {} }
  StaffRoles(...(handlerRoles as any))(Controller.prototype, 'handler', Object.getOwnPropertyDescriptor(Controller.prototype, 'handler')!);
  const req: any = { headers: { authorization: 'Bearer test-token' } };
  return { switchToHttp: () => ({ getRequest: () => req }), getHandler: () => Controller.prototype.handler, getClass: () => Controller } as any;
}

test('staff guard: an admin may use analyst routes', async () => {
  assert.equal(await guardFor(ADMIN, 'admin').canActivate(ctxFor(['analyst'])), true);
});

test('staff guard: an admin cannot use committee-only routes', async () => {
  await assert.rejects(guardFor(ADMIN, 'admin').canActivate(ctxFor(['committee'])), ForbiddenException);
});

test('staff guard: a committee member cannot use analyst-only routes', async () => {
  await assert.rejects(guardFor(COMMITTEE, 'committee').canActivate(ctxFor(['analyst'])), ForbiddenException);
});

test('staff guard: a committee member may use committee routes', async () => {
  assert.equal(await guardFor(COMMITTEE, 'committee').canActivate(ctxFor(['committee'])), true);
});

test('staff guard: a wallet off the allowlist is refused', async () => {
  await assert.rejects(guardFor('0x0000000000000000000000000000000000000001', 'analyst').canActivate(ctxFor(['analyst'])), ForbiddenException);
});
