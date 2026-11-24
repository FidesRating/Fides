# FIDES on-chain registries

Three small, separate contracts that commit **hashes only**. They do not replace the database: the
database stays the source of truth, the chain only proves that a published record was not silently changed.

| Contract | Purpose | Writes |
| --- | --- | --- |
| `RatingRegistry` | Hash of each published rating action | `publish`, `revoke` |
| `EvidenceAnchor` | Content hash of verified, public evidence | `anchor`, `revoke` |
| `CommitteeLog` | Salted hash of the final committee decision + rationale hash | `logDecision`, `revoke` |

They share `HashRegistry` (write-once records, one-shot revoke, no edit, no delete) and `Owned2Step`.

## Roles

- **Owner**: the Safe multisig. Can only add or remove publishers and transfer ownership. Cannot write records.
- **Publisher**: the backend publisher wallet. Can only `publish/anchor/log` and `revoke`. Cannot change roles.
- Splitting the two roles means a stolen backend key cannot take over the contracts.

## Privacy and product rules (must hold)

- Never write raw ids, evidence, votes, member identities, wallets, or any private data. Hashes only.
- Salt the committee decision hash off-chain, otherwise a few possible outcomes can be guessed.
- Never anchor pending or unverified evidence.
- Only write after the human Rating Committee has finalised and published. AI has no write path.
- Takedown returns 410 Gone on the site; on-chain it is a `revoke` (the record stays, the content never was there).
- Token holding has no role in these contracts.

## Local commands

```
forge install foundry-rs/forge-std --no-git
forge test
```

## Mainnet deployment checklist (owner approval is required at each step)

Open decisions, to be set by the owner (not guessed): **chain**, deployer wallet, Safe signers, publisher wallet.

1. Choose the chain and confirm the Safe v1.4.1 exists on it (see the multisig guide below).
2. Create the Safe (2-of-3 or 3-of-5) and record its address.
3. Create a fresh deployer wallet with only enough native gas, and a separate publisher wallet for the backend.
4. Deploy to the chain's testnet first and run the full flow (publish, revoke, role changes).
5. Get an independent review of the contracts before mainnet.
6. Deploy to mainnet with `OWNER=<Safe address>` so ownership is the Safe from block one:

```
OWNER=0xSAFE forge script script/Deploy.s.sol --rpc-url <RPC> --account <keystore-name> --broadcast --verify
```

7. Verify the source on the explorer and record addresses, deploy tx hashes, and blocks.
8. From the Safe, call `setPublisher(<publisher wallet>, true)` on each of the three contracts.
9. Store the publisher key as a server secret only (never in the repo), fund it with a little gas, and set the
   contract addresses in backend config. The backend integration is a separate, not yet approved, task.
10. Stop using the deployer wallet; it has no privileges.

Use a keystore (`cast wallet import`) or a hardware wallet for the deployer. Never put a private key in `.env` that is committed.

# Multisig wallet guide (Safe)

## What it is

A Safe is a smart-contract wallet that needs several approvals (for example 2 of 3 signers) before any action runs.
Here it owns the registries, so no single person or stolen key can change who may publish.

## 1. Pick the signers

- 3 signers with 2-of-3 is the minimum; 3-of-5 is better once the team grows.
- Each signer is a separate person with their own wallet. Never two keys held by the same person.
- Prefer a hardware wallet (Ledger or Trezor) for each signer.
- Do not use the deployer or the backend publisher wallet as a signer.
- Write down who the signers are and how to reach each of them. Committee identities are a separate, open decision.

## 2. Create the Safe

1. Open the Safe web app and connect a signer wallet.
2. Select the target chain. If the chain is not listed, check that Safe v1.4.1 contracts are deployed there. If they are not, do not use an unofficial fork without owner approval.
3. Create a new Safe, add every signer address, set the threshold (2 of 3).
4. Review the summary, confirm, and wait for the creation transaction.
5. Copy the Safe address and check it on the explorer.

## 3. Test with something harmless first

- Send a tiny amount of native token to the Safe, then send it back with a transaction that needs 2 approvals.
- Confirm every signer can see and approve the transaction queue.

## 4. Use it with the registries

- Deployment passes the Safe address as `OWNER`, so no ownership transfer is needed.
- To authorise the backend: in the Safe app open Transaction Builder, enter the contract address and ABI,
  choose `setPublisher(account, allowed)`, set the publisher wallet and `true`, then collect 2 approvals and execute. Repeat for each contract.
- To rotate or revoke the publisher: the same call with `allowed = false`, then add the new one.
- To change the owner: `transferOwnership(newOwner)` from the Safe, then the new owner calls `acceptOwnership()`.

## 5. Rules for operating it

- Always read the transaction details on the signer's hardware screen, not just the web page.
- Verify the target contract and function before approving. Reject anything unexpected.
- Never share seed phrases or private keys, and never type them into any site or chat.
- Keep seed phrases offline, on paper or metal, in separate places for each signer.
- Keep a written recovery plan: if one signer loses a key, the other signers add a new signer and remove the old one (needs the threshold).
- Review the signer list on a schedule and after any team change.
- Do not enable modules or guards you do not understand.
