import * as assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { TokenGateService } from '../src/common/token-gate.service';

const CONTRACT = '0x2222222222222222222222222222222222222222';
const WALLET = '0xAbCdEf0123456789aBcDeF0123456789AbCdEf01';
const realFetch = globalThis.fetch;
const keys = ['TOKEN_CONTRACT', 'TOKEN_RPC_URL', 'MEMBER_MIN_BALANCE', 'TOKEN_GATE_MOCK_BALANCE'] as const;
const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));

afterEach(() => {
  globalThis.fetch = realFetch;
  for (const k of keys) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
});

const configure = () => {
  process.env.TOKEN_CONTRACT = CONTRACT;
  process.env.TOKEN_RPC_URL = 'https://rpc.example.test';
  process.env.MEMBER_MIN_BALANCE = '100';
  delete process.env.TOKEN_GATE_MOCK_BALANCE;
};
const hex = (n: bigint) => '0x' + n.toString(16).padStart(64, '0');

test('token gate: closed while the contract, RPC URL or threshold is missing', async () => {
  for (const k of keys) delete process.env[k];
  const gate = new TokenGateService();
  assert.equal(gate.configured, false);
  assert.equal(await gate.getBalance(WALLET), null);
  assert.equal(gate.isMember(null), false);
  assert.equal(gate.isMember(1_000_000), false, 'an unset threshold means nobody is a holder');

  configure();
  delete process.env.TOKEN_RPC_URL;
  assert.equal(new TokenGateService().configured, false);
  configure();
  process.env.TOKEN_CONTRACT = 'not-an-address';
  assert.equal(new TokenGateService().configured, false);
});

test('token gate: reads an ERC-20 balance with eth_call and applies decimals', async () => {
  configure();
  const calls: { to: string; data: string }[] = [];
  globalThis.fetch = (async (_url: string, init: { body: string }) => {
    const { params } = JSON.parse(init.body);
    calls.push(params[0]);
    const result = params[0].data === '0x313ce567' ? hex(18n) : hex(250n * 10n ** 18n);
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result }), { status: 200 });
  }) as unknown as typeof fetch;

  const gate = new TokenGateService();
  const balance = await gate.getBalance(WALLET);
  assert.equal(balance, 250);
  assert.equal(gate.isMember(balance), true);
  assert.equal(calls[0].to, CONTRACT);
  assert.ok(calls[1].data.startsWith('0x70a08231') && calls[1].data.endsWith(WALLET.slice(2).toLowerCase()), 'balanceOf(address) call data');
});

test('token gate: an RPC failure returns null, never 0, so access is not revoked by mistake', async () => {
  configure();
  globalThis.fetch = (async () => new Response('{}', { status: 500 })) as unknown as typeof fetch;
  const gate = new TokenGateService();
  assert.equal(await gate.getBalance(WALLET), null);
  globalThis.fetch = (async () => { throw new Error('network down'); }) as unknown as typeof fetch;
  assert.equal(await gate.getBalance(WALLET), null);
});

test('token gate: a balance below the threshold is not a holder', async () => {
  configure();
  globalThis.fetch = (async (_url: string, init: { body: string }) => {
    const { params } = JSON.parse(init.body);
    return new Response(JSON.stringify({ result: params[0].data === '0x313ce567' ? hex(6n) : hex(99_000_000n) }), { status: 200 });
  }) as unknown as typeof fetch;
  const gate = new TokenGateService();
  const balance = await gate.getBalance(WALLET);
  assert.equal(balance, 99);
  assert.equal(gate.isMember(balance), false);
});
