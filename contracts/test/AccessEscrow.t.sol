// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {CreatorDAOFactory} from "../src/CreatorDAOFactory.sol";
import {AfroMeetNFT} from "../src/AfroMeetNFT.sol";
import {AccessRegistry} from "../src/AccessRegistry.sol";
import {SplitResolver} from "../src/SplitResolver.sol";
import {AccessEscrow} from "../src/AccessEscrow.sol";
import {FractionalVaultFactory} from "../src/FractionalVaultFactory.sol";
import {IAfroMeetNFT} from "../src/interfaces/IAfroMeetNFT.sol";
import {IFractionalVaultFactory} from "../src/interfaces/IFractionalVaultFactory.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

contract AccessEscrowTest is Test {
    AfroMeetNFT nft;
    AccessRegistry registry;
    SplitResolver splits;
    AccessEscrow escrow;
    FractionalVaultFactory vaultFactory;
    MockUSDC usdc;

    address operator = makeAddr("operator");
    address creator = makeAddr("creator");
    address producer = makeAddr("producer");
    address listener = makeAddr("listener");
    address treasury; // resolved from the creator's ecosystem in setUp

    uint256 tokenId;
    uint256 constant PRICE = 1_000; // session budget (USDC, 6dp)
    uint256 constant RATE = 100; // USDC per second
    uint256 constant ELAPSED = 10; // metered seconds → RATE*ELAPSED = 1000 = PRICE
    uint256 constant MIN_SECONDS = 5; // skip-gate threshold

    function setUp() public {
        usdc = new MockUSDC();
        nft = new AfroMeetNFT(usdc, new CreatorDAOFactory());
        registry = new AccessRegistry(IAfroMeetNFT(address(nft)));
        splits = new SplitResolver(IAfroMeetNFT(address(nft)));
        vaultFactory = new FractionalVaultFactory();
        escrow = new AccessEscrow(
            usdc, registry, splits, IFractionalVaultFactory(address(vaultFactory)), operator
        );
        splits.setEscrow(address(escrow));

        vm.prank(creator);
        tokenId = nft.mintWork("ipfs://song");
        treasury = nft.treasuryOf(creator); // resolved ecosystem treasury (receives the 1% cut)

        // 70/30 creator/producer split.
        address[] memory r = new address[](2);
        uint256[] memory bps = new uint256[](2);
        r[0] = creator;
        r[1] = producer;
        bps[0] = 7000;
        bps[1] = 3000;
        vm.prank(creator);
        splits.setSplits(tokenId, r, bps);

        vm.prank(creator);
        registry.setConfig(tokenId, PRICE, 2 * PRICE, RATE, AccessRegistry.AccessMode.TIMED, MIN_SECONDS);

        // Listener funds + pre-authorises the escrow (models EIP-3009 spend authorisation).
        usdc.mint(listener, 1e6);
        vm.prank(listener);
        usdc.approve(address(escrow), type(uint256).max);
    }

    function _settle(bytes32 id) internal {
        vm.startPrank(operator);
        escrow.openSession(id, listener, tokenId, PRICE);
        escrow.settle(id, ELAPSED); // 10s * 100 = 1000
        vm.stopPrank();
    }

    function test_Settle_DistributesDaoCutAndSplits() public {
        _settle("s1");

        // 1% to DAO treasury, remaining 99% split 70/30.
        uint256 daoCut = PRICE / 100; // 10
        uint256 remainder = PRICE - daoCut; // 990
        assertEq(usdc.balanceOf(treasury), daoCut);
        assertEq(usdc.balanceOf(creator), (remainder * 7000) / 10000); // 693
        assertEq(usdc.balanceOf(producer), remainder - (remainder * 7000) / 10000); // 297
        // Nothing stranded in the escrow.
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    function test_Settle_LocksSplitsOnFirstSettlement() public {
        assertFalse(splits.locked(tokenId));
        _settle("s1");
        assertTrue(splits.locked(tokenId));
    }

    function test_Settle_RevertOnDoubleSettle() public {
        vm.startPrank(operator);
        escrow.openSession("s1", listener, tokenId, PRICE);
        escrow.settle("s1", ELAPSED);
        vm.expectRevert("already settled");
        escrow.settle("s1", ELAPSED);
        vm.stopPrank();
    }

    function test_Settle_PerSecondMetering() public {
        // Pay for exactly what is consumed: 20s costs 20 * RATE.
        vm.startPrank(operator);
        escrow.openSession("s1", listener, tokenId, 10_000);
        escrow.settle("s1", 20);
        vm.stopPrank();
        assertEq(
            usdc.balanceOf(treasury) + usdc.balanceOf(creator) + usdc.balanceOf(producer), 20 * RATE
        );
    }

    function test_Settle_CapsAtAuthorisedBudget() public {
        // 10s * RATE = 1000, but only 500 authorised → the charge is capped at the budget.
        vm.startPrank(operator);
        escrow.openSession("s1", listener, tokenId, 500);
        escrow.settle("s1", ELAPSED);
        vm.stopPrank();
        assertEq(usdc.balanceOf(treasury) + usdc.balanceOf(creator) + usdc.balanceOf(producer), 500);
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    function test_Settle_RevertBelowMinSeconds() public {
        vm.startPrank(operator);
        escrow.openSession("s1", listener, tokenId, PRICE);
        vm.expectRevert("below min");
        escrow.settle("s1", MIN_SECONDS - 1); // skip-gate
        vm.stopPrank();
    }

    function test_OpenSession_OnlyOperator() public {
        vm.prank(listener);
        vm.expectRevert(); // Ownable
        escrow.openSession("s1", listener, tokenId, PRICE);
    }

    function test_Settle_RevertWhenNoSession() public {
        vm.prank(operator);
        vm.expectRevert("no session");
        escrow.settle("missing", ELAPSED);
    }

    function test_Settle_DaoCutGoesToEcosystemTreasury() public {
        // M-1: the treasury is resolved from the creator's ecosystem, not chosen by the caller,
        // so the 1% cut always reaches the real DAO treasury and nothing is stranded.
        assertEq(registry.getConfig(tokenId).daoTreasury, nft.treasuryOf(creator));

        _settle("s1");

        assertEq(usdc.balanceOf(treasury), PRICE / 100); // 1% to the real ecosystem treasury
        assertEq(usdc.balanceOf(address(escrow)), 0); // no stranded funds
    }

    function test_OpenSession_RevertOnDuplicateId() public {
        vm.startPrank(operator);
        escrow.openSession("s1", listener, tokenId, PRICE);
        vm.expectRevert("session exists");
        escrow.openSession("s1", listener, tokenId, PRICE);
        vm.stopPrank();
    }

    function test_OpenSession_RevertOnZeroListener() public {
        vm.prank(operator);
        vm.expectRevert("listener=0");
        escrow.openSession("s1", address(0), tokenId, PRICE);
    }

    function test_Settle_RevertWhenInactiveConfig() public {
        vm.prank(creator);
        uint256 t2 = nft.mintWork("ipfs://unconfigured"); // minted but never configured → inactive
        vm.startPrank(operator);
        escrow.openSession("s2", listener, t2, PRICE);
        vm.expectRevert("inactive");
        escrow.settle("s2", ELAPSED);
        vm.stopPrank();
    }

    function test_Settle_RevertWhenNoSplits() public {
        vm.prank(creator);
        uint256 t2 = nft.mintWork("ipfs://nosplits");
        vm.prank(creator);
        registry.setConfig(t2, PRICE, PRICE, RATE, AccessRegistry.AccessMode.TIMED, MIN_SECONDS);
        vm.startPrank(operator);
        escrow.openSession("s2", listener, t2, PRICE);
        vm.expectRevert("no splits"); // configured but no split recipients set
        escrow.settle("s2", ELAPSED);
        vm.stopPrank();
    }

    function test_Constructor_RevertOnZeroFactory() public {
        vm.expectRevert("factory=0");
        new AccessEscrow(usdc, registry, splits, IFractionalVaultFactory(address(0)), operator);
    }

    function test_Settle_DiscreteRevertWhenExceedsAuthorised() public {
        vm.prank(creator);
        registry.setConfig(tokenId, PRICE, PRICE, 0, AccessRegistry.AccessMode.DISCRETE, 0);
        vm.startPrank(operator);
        escrow.openSession("s1", listener, tokenId, PRICE - 1); // authorised below the flat price
        vm.expectRevert("exceeds authorised");
        escrow.settle("s1", 0);
        vm.stopPrank();
    }

    function test_Settle_RevertWhenCappedToZero() public {
        // authorised = 0 caps the metered charge to 0, which the amount>0 guard then rejects.
        vm.startPrank(operator);
        escrow.openSession("s1", listener, tokenId, 0);
        vm.expectRevert("amount=0");
        escrow.settle("s1", ELAPSED);
        vm.stopPrank();
    }

    function test_Settle_NoDaoCutWhenAmountBelowHundred() public {
        // A flat price under 100 makes the 1% DAO cut round to zero, so the DAO transfer is skipped
        // and the whole amount flows to the split recipients.
        vm.prank(creator);
        registry.setConfig(tokenId, 50, 50, 0, AccessRegistry.AccessMode.DISCRETE, 0);
        vm.startPrank(operator);
        escrow.openSession("s1", listener, tokenId, 50);
        escrow.settle("s1", 0);
        vm.stopPrank();
        assertEq(usdc.balanceOf(treasury), 0); // daoCut rounded to 0
        assertEq(usdc.balanceOf(creator) + usdc.balanceOf(producer), 50);
    }

    function test_Settle_RoundingDustGoesToLastRecipient() public {
        // A DISCRETE flat price that does not divide cleanly by the split exposes dust handling.
        vm.prank(creator);
        registry.setConfig(tokenId, 777, 1000, 0, AccessRegistry.AccessMode.DISCRETE, 0);

        vm.startPrank(operator);
        escrow.openSession("s1", listener, tokenId, 777);
        escrow.settle("s1", 0); // elapsed ignored for DISCRETE
        vm.stopPrank();

        uint256 price = 777;
        uint256 daoCut = price / 100; // 7
        uint256 remainder = price - daoCut; // 770
        uint256 creatorAmt = (remainder * 7000) / 10000; // 539
        // Producer (last) absorbs the rounding remainder so the full amount is distributed.
        assertEq(usdc.balanceOf(creator), creatorAmt);
        assertEq(usdc.balanceOf(producer), remainder - creatorAmt);
        assertEq(usdc.balanceOf(treasury) + usdc.balanceOf(creator) + usdc.balanceOf(producer), 777);
    }
}
