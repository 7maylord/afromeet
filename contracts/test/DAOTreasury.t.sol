// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {DAOTreasury} from "../src/DAOTreasury.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

/// @dev Treasury governance is exercised end-to-end (real Governor) in Governance.t.sol; here we
///      test the timelock/disbursement mechanics directly with `dao` as a plain owner address.
contract DAOTreasuryTest is Test {
    DAOTreasury treasury;
    MockUSDC usdc;

    address dao = makeAddr("dao");
    address recipient = makeAddr("recipient");

    function setUp() public {
        usdc = new MockUSDC();
        treasury = new DAOTreasury(usdc, dao);
        usdc.mint(address(treasury), 1_000e6);
    }

    function test_QueueDisbursement_OnlyOwner() public {
        vm.prank(recipient);
        vm.expectRevert(); // Ownable: caller is not the owner
        treasury.queueDisbursement(recipient, 100e6);
    }

    function test_Execute_RevertWhileTimelocked() public {
        vm.prank(dao);
        uint256 id = treasury.queueDisbursement(recipient, 100e6);
        vm.expectRevert("timelocked");
        treasury.executeDisbursement(id);
    }

    function test_Execute_AfterTimelock_PaysRecipient() public {
        vm.prank(dao);
        uint256 id = treasury.queueDisbursement(recipient, 100e6);

        vm.warp(block.timestamp + treasury.TIMELOCK());
        treasury.executeDisbursement(id); // permissionless after eta
        assertEq(usdc.balanceOf(recipient), 100e6);
        assertEq(treasury.balance(), 900e6);
    }

    function test_Execute_CannotRunTwice() public {
        vm.prank(dao);
        uint256 id = treasury.queueDisbursement(recipient, 100e6);
        vm.warp(block.timestamp + treasury.TIMELOCK());
        treasury.executeDisbursement(id);
        vm.expectRevert("not pending");
        treasury.executeDisbursement(id);
    }

    function test_Cancel_PreventsExecution() public {
        vm.startPrank(dao);
        uint256 id = treasury.queueDisbursement(recipient, 100e6);
        treasury.cancelDisbursement(id);
        vm.stopPrank();

        vm.warp(block.timestamp + treasury.TIMELOCK());
        vm.expectRevert("not pending");
        treasury.executeDisbursement(id);
    }

    function test_Execute_RevertWhenInsufficientBalance() public {
        vm.prank(dao);
        uint256 id = treasury.queueDisbursement(recipient, 2_000e6); // more than held
        vm.warp(block.timestamp + treasury.TIMELOCK());
        vm.expectRevert("insufficient balance");
        treasury.executeDisbursement(id);
    }
}
