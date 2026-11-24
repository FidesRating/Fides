// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {RatingRegistry} from "../src/RatingRegistry.sol";
import {EvidenceAnchor} from "../src/EvidenceAnchor.sol";
import {CommitteeLog} from "../src/CommitteeLog.sol";

/// Required env: OWNER (the Safe multisig address). The deployer key only pays gas: ownership is the
/// Safe from the first block, so no hand-over step is needed. The Safe then calls
/// setPublisher(<backend publisher wallet>, true) on each contract.
contract Deploy is Script {
    function run() external {
        address owner = vm.envAddress("OWNER");
        require(owner != address(0), "OWNER not set");

        vm.startBroadcast();
        RatingRegistry rating = new RatingRegistry(owner);
        EvidenceAnchor evidence = new EvidenceAnchor(owner);
        CommitteeLog committee = new CommitteeLog(owner);
        vm.stopBroadcast();

        console.log("RatingRegistry", address(rating));
        console.log("EvidenceAnchor", address(evidence));
        console.log("CommitteeLog", address(committee));
    }
}
