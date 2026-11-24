// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {HashRegistry} from "./HashRegistry.sol";

/// @notice Anchors the content hash of verified, public evidence so the audit trail is checkable
/// without exposing the evidence itself. Pending or unverified evidence must never be anchored.
contract EvidenceAnchor is HashRegistry {
    constructor(address initialOwner) HashRegistry(initialOwner) {}

    function anchor(bytes32 evidenceId, bytes32 contentHash) external onlyPublisher {
        _anchor(evidenceId, contentHash);
    }

    function revoke(bytes32 evidenceId, bytes32 reasonHash) external onlyPublisher {
        _revoke(evidenceId, reasonHash);
    }
}
