// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {RatingRegistry} from "../src/RatingRegistry.sol";
import {EvidenceAnchor} from "../src/EvidenceAnchor.sol";
import {CommitteeLog} from "../src/CommitteeLog.sol";
import {HashRegistry} from "../src/HashRegistry.sol";
import {Owned2Step} from "../src/Owned2Step.sol";

contract RegistryTest is Test {
    address safe = address(0xA11CE);
    address publisher = address(0xB0B);
    address stranger = address(0xBAD);
    RatingRegistry rating;
    EvidenceAnchor evidence;
    CommitteeLog committee;

    bytes32 constant ID = keccak256("rating-1");
    bytes32 constant H = keccak256("payload");

    function setUp() public {
        rating = new RatingRegistry(safe);
        evidence = new EvidenceAnchor(safe);
        committee = new CommitteeLog(safe);
        vm.startPrank(safe);
        rating.setPublisher(publisher, true);
        evidence.setPublisher(publisher, true);
        committee.setPublisher(publisher, true);
        vm.stopPrank();
    }

    function test_publishStoresHashAndTime() public {
        vm.warp(1000);
        vm.prank(publisher);
        rating.publish(ID, H);
        HashRegistry.Record memory r = rating.getRecord(ID);
        assertEq(r.contentHash, H);
        assertEq(r.publishedAt, 1000);
        assertEq(r.revokedAt, 0);
        assertTrue(rating.isActive(ID));
    }

    function test_cannotOverwrite() public {
        vm.startPrank(publisher);
        rating.publish(ID, H);
        vm.expectRevert(HashRegistry.AlreadyAnchored.selector);
        rating.publish(ID, keccak256("other"));
        vm.stopPrank();
    }

    function test_onlyPublisherCanWrite() public {
        vm.prank(stranger);
        vm.expectRevert(HashRegistry.NotPublisher.selector);
        rating.publish(ID, H);
        vm.prank(safe); // the owner alone cannot write either
        vm.expectRevert(HashRegistry.NotPublisher.selector);
        rating.publish(ID, H);
    }

    function test_rejectsEmptyHash() public {
        vm.startPrank(publisher);
        vm.expectRevert(HashRegistry.EmptyHash.selector);
        rating.publish(ID, bytes32(0));
        vm.expectRevert(HashRegistry.EmptyHash.selector);
        rating.publish(bytes32(0), H);
        vm.stopPrank();
    }

    function test_revokeKeepsRecordAndIsOneShot() public {
        vm.startPrank(publisher);
        rating.publish(ID, H);
        vm.warp(5000);
        rating.revoke(ID, keccak256("takedown"));
        assertFalse(rating.isActive(ID));
        assertEq(rating.getRecord(ID).contentHash, H);
        assertEq(rating.getRecord(ID).revokedAt, 5000);
        vm.expectRevert(HashRegistry.AlreadyRevoked.selector);
        rating.revoke(ID, keccak256("again"));
        vm.stopPrank();
    }

    function test_revokeUnknownReverts() public {
        vm.prank(publisher);
        vm.expectRevert(HashRegistry.UnknownRecord.selector);
        rating.revoke(ID, bytes32(0));
    }

    function test_revokedIdCannotBeReused() public {
        vm.startPrank(publisher);
        rating.publish(ID, H);
        rating.revoke(ID, bytes32(0));
        vm.expectRevert(HashRegistry.AlreadyAnchored.selector);
        rating.publish(ID, H);
        vm.stopPrank();
    }

    function test_publisherManagementOnlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert(Owned2Step.NotOwner.selector);
        rating.setPublisher(stranger, true);
        vm.prank(safe);
        rating.setPublisher(publisher, false);
        vm.prank(publisher);
        vm.expectRevert(HashRegistry.NotPublisher.selector);
        rating.publish(ID, H);
    }

    function test_twoStepOwnership() public {
        address newSafe = address(0x5AFE);
        vm.prank(safe);
        rating.transferOwnership(newSafe);
        assertEq(rating.owner(), safe);
        vm.prank(stranger);
        vm.expectRevert(Owned2Step.NotPendingOwner.selector);
        rating.acceptOwnership();
        vm.prank(newSafe);
        rating.acceptOwnership();
        assertEq(rating.owner(), newSafe);
        assertEq(rating.pendingOwner(), address(0));
    }

    function test_zeroAddressGuards() public {
        vm.expectRevert(Owned2Step.ZeroAddress.selector);
        new RatingRegistry(address(0));
        vm.prank(safe);
        vm.expectRevert(Owned2Step.ZeroAddress.selector);
        rating.transferOwnership(address(0));
    }

    function test_evidenceAnchorAndRevoke() public {
        vm.startPrank(publisher);
        evidence.anchor(ID, H);
        assertTrue(evidence.isActive(ID));
        evidence.revoke(ID, keccak256("removed"));
        assertFalse(evidence.isActive(ID));
        vm.stopPrank();
    }

    function test_committeeLogEmitsDecision() public {
        bytes32 rationale = keccak256("why");
        vm.expectEmit(true, true, false, true);
        emit CommitteeLog.DecisionLogged(ID, keccak256("r"), rationale);
        vm.prank(publisher);
        committee.logDecision(ID, keccak256("r"), H, rationale);
        assertTrue(committee.isActive(ID));
    }

    function testFuzz_anyHashOnce(bytes32 id, bytes32 h) public {
        vm.assume(id != bytes32(0) && h != bytes32(0));
        vm.startPrank(publisher);
        rating.publish(id, h);
        vm.expectRevert(HashRegistry.AlreadyAnchored.selector);
        rating.publish(id, h);
        vm.stopPrank();
    }
}
