# FIDES On-Chain Registries are live on Robinhood Chain Mainnet

Published ratings. Anchored evidence. Verifiable On-Chain.

Our registry contracts are deployed on Robinhood Chain Mainnet. They store hashes only, so anyone can check that a published FIDES rating was not silently changed, without exposing any private data. Ownership sits in a 2-of-3 Safe multisig from the first block.

Chain ID: 4663
RatingRegistry Deployment Block: 122,406,594
EvidenceAnchor Deployment Block: 122,406,627
CommitteeLog Deployment Block: 122,406,659

## CORE INFRASTRUCTURE

RatingRegistry: tamper-evident registry of published rating actions; stores a hash of the public rating, a timestamp, and a transparent revoke status
https://robinhoodchain.blockscout.com/address/0xefCC658aea6cc8F86eb834754e20948Df7a198EC
Deploy Tx, Block 122,406,594
https://robinhoodchain.blockscout.com/tx/0x0ceae4e86693b5710308725feef3d99611536c0ba7019725f73b439ce3370865

EvidenceAnchor: anchors the content hash of verified, public evidence so the audit trail can be checked without opening the evidence itself
https://robinhoodchain.blockscout.com/address/0xeD2fa309731dDaee0C22E13977F41216cd3C3B0E
Deploy Tx, Block 122,406,627
https://robinhoodchain.blockscout.com/tx/0x6e479a1e728742a084cfad9b9a599198bc5c7a0708c1ceb11cd3750f6eb9c4f2

CommitteeLog: logs the final Rating Committee outcome as a salted hash plus the rationale hash; individual votes and member identities are never written
https://robinhoodchain.blockscout.com/address/0xff45B0379F167Cc58816224E6eA2190187596512
Deploy Tx, Block 122,406,659
https://robinhoodchain.blockscout.com/tx/0x63cd1a9d6048f685d55fed7a15c147dc7019d51841b41c88866f9983ddc3e152

## GOVERNANCE & TRUST BOUNDARIES

Owner: FIDES Registry Owner, a 2-of-3 Safe multisig (Safe v1.5.0)
https://robinhoodchain.blockscout.com/address/0x6BEb3A9634F9cab0bB0C225053A1bb6025eeD9f4
The Safe can only add or remove publishers and transfer ownership (two-step). It cannot write records.

Publisher: dedicated backend wallet, authorised by the Safe on all three contracts
https://robinhoodchain.blockscout.com/address/0x474C511871b5C98a3d8861fD5616c54033261EdF
Authorisation Tx, Block 122,416,477
https://robinhoodchain.blockscout.com/tx/0xf935a9c562f0603cc3d74331604622feca2ffa436485db4e24baee82a8a61021
The publisher can only write and revoke records. It cannot change roles. A stolen backend key therefore cannot take over the contracts.

Deployer: a one-time wallet that only paid gas. It holds no privileges.

Trust Boundaries:
- Only hashes are written. No raw ids, evidence, votes, member identities, or wallets.
- Records are write-once. A hash can be revoked once (for a takedown) but never edited or deleted.
- Writes happen only after the human Rating Committee has finalised and published a rating. AI has no write path.
- Pending or unverified evidence is never anchored.
- Holding the $FIDES token has no role in these contracts and does NOT, and CANNOT, influence any rating, score, or committee decision.

## HOW TO VERIFY A RATING

Recompute the keccak256 hash of the canonical text of the public rating page and compare it with the record stored under the rating id. The canonical format and id derivation are in the repository (backend/src/chain/anchor-hash.ts).

## CANONICAL / NETWORK DEPENDENCIES

Robinhood Chain Mainnet RPC:
https://rpc.mainnet.chain.robinhood.com

Robinhood Chain Block Explorer:
https://robinhoodchain.blockscout.com

Source verification: all three contracts are verified on the Blockscout explorer (Solidity 0.8.24, EVM paris, optimizer 200 runs, MIT). The match type is partial because the source was submitted as a single flattened file.
