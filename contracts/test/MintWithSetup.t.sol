// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {CreatorDAOFactory} from "../src/CreatorDAOFactory.sol";
import {AfroMeetNFT} from "../src/AfroMeetNFT.sol";
import {AccessRegistry} from "../src/AccessRegistry.sol";
import {SplitResolver} from "../src/SplitResolver.sol";
import {IAfroMeetNFT} from "../src/interfaces/IAfroMeetNFT.sol";
import {IAccessRegistrySetup, ISplitResolverSetup} from "../src/interfaces/IAccessSetup.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

/// @notice Covers the single-signature mint: mintWorkWithSetup mints + configures access + sets
///         royalty splits in one transaction, and the NFT-gated setup functions cannot be abused.
contract MintWithSetupTest is Test {
    AfroMeetNFT nft;
    AccessRegistry registry;
    SplitResolver splits;
    MockUSDC usdc;

    address creator = makeAddr("creator");
    address producer = makeAddr("producer");
    address attacker = makeAddr("attacker");

    uint256 constant PRICE = 10_000; // 0.01 USDC flat unlock

    function setUp() public {
        usdc = new MockUSDC();
        nft = new AfroMeetNFT(usdc, new CreatorDAOFactory()); // deployer (this test) = admin
        registry = new AccessRegistry(IAfroMeetNFT(address(nft)));
        splits = new SplitResolver(IAfroMeetNFT(address(nft)));
        nft.setAccessLayer(
            IAccessRegistrySetup(address(registry)), ISplitResolverSetup(address(splits))
        );
    }

    function _recipients() internal view returns (address[] memory r, uint256[] memory bps) {
        r = new address[](2);
        bps = new uint256[](2);
        r[0] = creator;
        r[1] = producer;
        bps[0] = 7000;
        bps[1] = 3000;
    }

    /// One signature does all three: mint, configure, split — and the DAO treasury still resolves
    /// from the creator's own ecosystem (M-1 preserved through the combined path).
    function test_MintWithSetup_ConfiguresAndSplitsInOneCall() public {
        (address[] memory r, uint256[] memory bps) = _recipients();

        vm.prank(creator);
        uint256 tokenId =
            nft.mintWorkWithSetup("ipfs://work", PRICE, PRICE, 0, 1 /*DISCRETE*/, 0, r, bps);

        assertEq(nft.creatorOf(tokenId), creator, "minted to creator");

        AccessRegistry.AccessConfig memory cfg = registry.getConfig(tokenId);
        assertTrue(cfg.active, "config active");
        assertEq(cfg.pricePerAccess, PRICE);
        assertEq(uint256(cfg.mode), 1, "DISCRETE");
        assertEq(cfg.daoTreasury, nft.treasuryOf(creator), "treasury from creator's ecosystem");

        SplitResolver.Split[] memory s = splits.getSplits(tokenId);
        assertEq(s.length, 2);
        assertEq(s[0].recipient, creator);
        assertEq(s[0].basisPoints, 7000);
        assertEq(s[1].recipient, producer);
        assertEq(s[1].basisPoints, 3000);
    }

    /// A TIMED work configured the same way, in one signature.
    function test_MintWithSetup_TimedWork() public {
        address[] memory r = new address[](1);
        uint256[] memory bps = new uint256[](1);
        r[0] = creator;
        bps[0] = 10000;

        vm.prank(creator);
        uint256 tokenId = nft.mintWorkWithSetup("ipfs://song", 0, 5, 100, 0 /*TIMED*/, 30, r, bps);

        AccessRegistry.AccessConfig memory cfg = registry.getConfig(tokenId);
        assertEq(uint256(cfg.mode), 0, "TIMED");
        assertEq(cfg.ratePerSecond, 100);
        assertEq(cfg.minAccessSeconds, 30);
    }

    /// The NFT-gated setup functions reject any caller other than the NFT — so nobody can configure
    /// or re-split someone else's work directly.
    function test_SetConfigFrom_OnlyNft() public {
        vm.prank(attacker);
        vm.expectRevert("not nft");
        registry.setConfigFrom(1, creator, PRICE, PRICE, 0, AccessRegistry.AccessMode.DISCRETE, 0);
    }

    function test_SetSplitsFrom_OnlyNft() public {
        (address[] memory r, uint256[] memory bps) = _recipients();
        vm.prank(attacker);
        vm.expectRevert("not nft");
        splits.setSplitsFrom(1, r, bps);
    }

    /// The standalone setConfig/setSplits still enforce creator-only (unchanged by the refactor).
    function test_StandaloneSetters_StillCreatorGated() public {
        vm.prank(creator);
        uint256 tokenId = nft.mintWork("ipfs://plain");

        (address[] memory r, uint256[] memory bps) = _recipients();
        vm.prank(attacker);
        vm.expectRevert("not creator");
        splits.setSplits(tokenId, r, bps);

        vm.prank(attacker);
        vm.expectRevert("not creator");
        registry.setConfig(tokenId, PRICE, PRICE, 0, AccessRegistry.AccessMode.DISCRETE, 0);
    }

    // --- Access-layer wiring guards -------------------------------------------

    function test_SetAccessLayer_OnlyAdmin() public {
        AfroMeetNFT fresh = new AfroMeetNFT(usdc, new CreatorDAOFactory());
        vm.prank(attacker);
        vm.expectRevert("not admin");
        fresh.setAccessLayer(
            IAccessRegistrySetup(address(registry)), ISplitResolverSetup(address(splits))
        );
    }

    function test_SetAccessLayer_OnlyOnce() public {
        vm.expectRevert("already set");
        nft.setAccessLayer(
            IAccessRegistrySetup(address(registry)), ISplitResolverSetup(address(splits))
        );
    }

    function test_MintWithSetup_RevertWhenAccessLayerUnset() public {
        AfroMeetNFT fresh = new AfroMeetNFT(usdc, new CreatorDAOFactory());
        address[] memory r = new address[](1);
        uint256[] memory bps = new uint256[](1);
        r[0] = creator;
        bps[0] = 10000;

        vm.prank(creator);
        vm.expectRevert("access layer unset");
        fresh.mintWorkWithSetup("ipfs://x", PRICE, PRICE, 0, 1, 0, r, bps);
    }
}
