// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Owned2Step} from "./Owned2Step.sol";

/// @notice Shared append-only registry of hash commitments with a revoke flag.
/// Only hashes are stored. Raw ids, evidence, votes and identities never go on-chain.
/// A record can be written once and revoked once. It can never be edited or deleted, so a
/// correction is a new id and a takedown is a revoke (the content itself stays off-chain).
abstract contract HashRegistry is Owned2Step {
    struct Record {
        bytes32 contentHash;
        uint64 publishedAt;
        uint64 revokedAt; // 0 while active
        bytes32 revokeReasonHash;
    }

    mapping(bytes32 id => Record) internal _records;
    mapping(address account => bool) public isPublisher;

    event PublisherSet(address indexed account, bool allowed);
    event Anchored(bytes32 indexed id, bytes32 contentHash, address indexed publisher);
    event Revoked(bytes32 indexed id, bytes32 reasonHash, address indexed publisher);

    error NotPublisher();
    error AlreadyAnchored();
    error EmptyHash();
    error UnknownRecord();
    error AlreadyRevoked();

    modifier onlyPublisher() {
        if (!isPublisher[msg.sender]) revert NotPublisher();
        _;
    }

    constructor(address initialOwner) Owned2Step(initialOwner) {}

    /// @notice Owner (Safe) grants or removes write access for the backend publisher wallet.
    function setPublisher(address account, bool allowed) external onlyOwner {
        if (account == address(0)) revert ZeroAddress();
        isPublisher[account] = allowed;
        emit PublisherSet(account, allowed);
    }

    function getRecord(bytes32 id) external view returns (Record memory) {
        return _records[id];
    }

    function isActive(bytes32 id) external view returns (bool) {
        Record storage r = _records[id];
        return r.publishedAt != 0 && r.revokedAt == 0;
    }

    function _anchor(bytes32 id, bytes32 contentHash) internal {
        if (contentHash == bytes32(0) || id == bytes32(0)) revert EmptyHash();
        if (_records[id].publishedAt != 0) revert AlreadyAnchored();
        _records[id] = Record(contentHash, uint64(block.timestamp), 0, bytes32(0));
        emit Anchored(id, contentHash, msg.sender);
    }

    function _revoke(bytes32 id, bytes32 reasonHash) internal {
        Record storage r = _records[id];
        if (r.publishedAt == 0) revert UnknownRecord();
        if (r.revokedAt != 0) revert AlreadyRevoked();
        r.revokedAt = uint64(block.timestamp);
        r.revokeReasonHash = reasonHash;
        emit Revoked(id, reasonHash, msg.sender);
    }
}
