// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {CreatorDAOFactory} from "../src/CreatorDAOFactory.sol";
import {IGovernor} from "@openzeppelin/contracts/governance/IGovernor.sol";
import {AfroMeetNFT} from "../src/AfroMeetNFT.sol";
import {CreatorVibeToken} from "../src/CreatorVibeToken.sol";
import {CreatorDAO} from "../src/CreatorDAO.sol";
import {DAOTreasury} from "../src/DAOTreasury.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

/// @notice End-to-end governance: a creator's DAO proposes, votes, and executes a treasury
///         disbursement funded by access revenue — the path described in PRD §5.3 / §5.6.
contract GovernanceTest is Test {
    AfroMeetNFT nft;
    MockUSDC usdc;
    CreatorVibeToken token;
    CreatorDAO dao;
    DAOTreasury treasury;

    address creator = makeAddr("creator");
    address grantee = makeAddr("grantee");

    function setUp() public {
        usdc = new MockUSDC();
        nft = new AfroMeetNFT(usdc, new CreatorDAOFactory());

        vm.prank(creator);
        nft.mintWork("ipfs://w"); // creator now holds 100 VIBE

        AfroMeetNFT.Ecosystem memory eco = nft.ecosystemOf(creator);
        token = CreatorVibeToken(eco.token);
        dao = CreatorDAO(payable(eco.dao));
        treasury = DAOTreasury(eco.treasury);

        // Activate voting power and let the snapshot land in the past.
        vm.prank(creator);
        token.delegate(creator);
        vm.roll(block.number + 1);

        // Treasury holds accrued access revenue.
        usdc.mint(address(treasury), 500e6);
    }

    function _proposalCalldata(uint256 amount)
        internal
        view
        returns (address[] memory targets, uint256[] memory values, bytes[] memory calldatas)
    {
        targets = new address[](1);
        values = new uint256[](1);
        calldatas = new bytes[](1);
        targets[0] = address(treasury);
        values[0] = 0;
        calldatas[0] = abi.encodeCall(DAOTreasury.queueDisbursement, (grantee, amount));
    }

    function test_FullCycle_ProposeVoteExecuteDisburse() public {
        string memory description = "Fund a music video grant";
        (address[] memory targets, uint256[] memory values, bytes[] memory calldatas) =
            _proposalCalldata(200e6);

        vm.prank(creator);
        uint256 proposalId = dao.propose(targets, values, calldatas, description);

        // Move past voting delay, cast a For vote, move past voting period.
        vm.roll(block.number + dao.votingDelay() + 1);
        assertEq(uint8(dao.state(proposalId)), uint8(IGovernor.ProposalState.Active));
        vm.prank(creator);
        dao.castVote(proposalId, 1); // 1 = For
        vm.roll(block.number + dao.votingPeriod() + 1);
        assertEq(uint8(dao.state(proposalId)), uint8(IGovernor.ProposalState.Succeeded));

        // Execute the proposal — the DAO (as treasury owner) queues the disbursement.
        dao.execute(targets, values, calldatas, keccak256(bytes(description)));
        assertEq(treasury.disbursementCount(), 1);

        // Treasury's own 24h timelock still applies before the grantee is paid.
        vm.expectRevert("timelocked");
        treasury.executeDisbursement(0);

        vm.warp(block.timestamp + treasury.TIMELOCK());
        treasury.executeDisbursement(0);
        assertEq(usdc.balanceOf(grantee), 200e6);
        assertEq(treasury.balance(), 300e6);
    }

    function test_Execute_RevertBeforeVotingEnds() public {
        string memory description = "Premature execution";
        (address[] memory targets, uint256[] memory values, bytes[] memory calldatas) =
            _proposalCalldata(100e6);

        vm.prank(creator);
        dao.propose(targets, values, calldatas, description);

        // Not yet succeeded — Governor rejects execution.
        vm.expectRevert();
        dao.execute(targets, values, calldatas, keccak256(bytes(description)));
    }

    function test_Treasury_QueueRevertWhenCallerNotDao() public {
        // The treasury owner is the DAO governor, not the creator.
        assertEq(treasury.owner(), address(dao));
        vm.prank(creator);
        vm.expectRevert();
        treasury.queueDisbursement(grantee, 100e6);
    }
}
