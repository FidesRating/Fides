// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {HashRegistry} from "./HashRegistry.sol";

/// @notice Commitments to published FIDES rating actions, so a published rating cannot be silently changed.
/// id = keccak256 of the internal rating-action id. contentHash = hash of the canonical published rating payload.
/// Written only after the human Rating Committee has finalised and published; AI has no write path.
contract RatingRegistry is HashRegistry {
    constructor(address initialOwner) HashRegistry(initialOwner) {}

    function publish(bytes32 ratingId, bytes32 contentHash) external onlyPublisher {
        _anchor(ratingId, contentHash);
    }

    /// @notice Marks a rating action as withdrawn (takedown, correction or superseded).
    function revoke(bytes32 ratingId, bytes32 reasonHash) external onlyPublisher {
        _revoke(ratingId, reasonHash);
    }
}
