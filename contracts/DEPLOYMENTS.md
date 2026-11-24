# Deployments

Public addresses only. No keys, seed phrases or secrets belong in this file.

## Robinhood Chain mainnet (chain ID 4663)

### Owner Safe

- Address: `0x6BEb3A9634F9cab0bB0C225053A1bb6025eeD9f4`
- Name in Safe app: FIDES Registry Owner
- Safe version: 1.5.0 (proxy to singleton `0xedd160fEBBD92E350D4D398fb636302fccd67C7e`)
- Threshold: 2 of 3
- Signers (public addresses):
  - Signer A: `0x97Bb6Ec20236d6bd55B0a987f47F04B6aDf5649D`
  - Signer B: `0xec5568BA926670d69B249A2072053e6b7941A2ec`
  - Signer C: `0xb3779767AecAdea9565e239e2722bf8A90b6a732`
- Verified on-chain through the public RPC on 2026-11-25: proxy code present, `getThreshold()` = 2, `getOwners()` returns the three signers above, `nonce()` = 0.

### Registry contracts

Deployed from the deployer wallet. Ownership is the Safe above from the first block. Verified on-chain on 2026-11-25: code present, `owner()` = Safe, `pendingOwner()` = zero address.

| Contract | Address | Block | Deploy tx |
| --- | --- | --- | --- |
| RatingRegistry | `0xefCC658aea6cc8F86eb834754e20948Df7a198EC` | 122406594 | `0x0ceae4e86693b5710308725feef3d99611536c0ba7019725f73b439ce3370865` |
| EvidenceAnchor | `0xeD2fa309731dDaee0C22E13977F41216cd3C3B0E` | 122406627 | `0x6e479a1e728742a084cfad9b9a599198bc5c7a0708c1ceb11cd3750f6eb9c4f2` |
| CommitteeLog | `0xff45B0379F167Cc58816224E6eA2190187596512` | 122406659 | `0x63cd1a9d6048f685d55fed7a15c147dc7019d51841b41c88866f9983ddc3e152` |

Total deploy cost: 0.0000315 ETH.

### Source verification

All three contracts were verified by hand on Blockscout on 2026-11-25 (Solidity 0.8.24, EVM paris, optimizer 200, MIT, flattened single file, partial match). RatingRegistry was seen verified on its page; the owner confirmed the other two.

### Publisher

- Publisher wallet (backend): `0x474C511871b5C98a3d8861fD5616c54033261EdF` (plain wallet, no code).
- Authorised by the Safe in one multiSend batch: tx `0xf935a9c562f0603cc3d74331604622feca2ffa436485db4e24baee82a8a61021`, block 122416477 (0x74bed5d), status success, 2 of 3 signatures.
- Verified on-chain on 2026-11-25: `isPublisher(publisher)` = true on RatingRegistry, EvidenceAnchor and CommitteeLog.

### Backend anchoring (backend/src/chain)

- Written and unit-tested. Also exercised against a local anvil node with the three contracts deployed: anchor, repeat (no second write), changed content (refused as conflict), evidence anchor, evidence revoke, rating revoke.
- Not yet enabled on Railway. It needs six env vars (see backend/.env.example), including the publisher private key as a server secret. Owner approval is required for the remote change.
- Evidence is anchored only for a human-confirmed promotion, and revoked when it stops being confirmed or the account is taken down.
