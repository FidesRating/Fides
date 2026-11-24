// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {HashRegistry} from "./HashRegistry.sol";

/// @notice Logs the final committee decision as a salted hash plus the rationale hash.
/// Individual votes and member identities are never written. The decision hash must be salted
/// off-chain, otherwise a small set of possible outcomes could be guessed from the hash.
contract CommitteeLog is HashRegistry {
    event DecisionLogged(bytes32 indexed decisionId, bytes32 indexed ratingId, bytes32 rationaleHash);

    constructor(address initialOwner) HashRegistry(initialOwner) {}

    /// @param decisionHash salted hash of the final decision (rating, outlook, vote count).
    /// @param rationaleHash hash of the published rationale, or zero when the rating equals the scorecard.
    function logDecision(bytes32 decisionId, bytes32 ratingId, bytes32 decisionHash, bytes32 rationaleHash)
        external
        onlyPublisher
    {
        _anchor(decisionId, decisionHash);
        emit DecisionLogged(decisionId, ratingId, rationaleHash);
    }

    function revoke(bytes32 decisionId, bytes32 reasonHash) external onlyPublisher {
        _revoke(decisionId, reasonHash);
    }
}
