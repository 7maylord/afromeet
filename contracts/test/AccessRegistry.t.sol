// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {CreatorDAOFactory} from "../src/CreatorDAOFactory.sol";
import {AfroMeetNFT} from "../src/AfroMeetNFT.sol";
import {AccessRegistry} from "../src/AccessRegistry.sol";
import {IAfroMeetNFT} from "../src/interfaces/IAfroMeetNFT.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

contract AccessRegistryTest is Test {
    AfroMeetNFT nft;
    AccessRegistry registry;

    address creator = makeAddr("creator");
    address other = makeAddr("other");
    uint256 tokenId;

    function setUp() public {
        MockUSDC usdc = new MockUSDC();
        nft = new AfroMeetNFT(usdc, new CreatorDAOFactory());
        registry = new AccessRegistry(IAfroMeetNFT(address(nft)));
        vm.prank(creator);
        tokenId = nft.mintWork("ipfs://w");
    }

    function test_SetConfig_Timed() public {
        vm.prank(creator);
        registry.setConfig(tokenId, 1000, 2000, AccessRegistry.AccessMode.TIMED, 30);
        AccessRegistry.AccessConfig memory c = registry.getConfig(tokenId);
        assertEq(c.pricePerAccess, 1000);
        assertEq(c.discoveryPrice, 2000);
        assertEq(uint8(c.mode), uint8(AccessRegistry.AccessMode.TIMED));
        assertEq(c.minAccessSeconds, 30);
        // DAO treasury is resolved from the creator's ecosystem, not supplied by the caller.
        assertEq(c.daoTreasury, nft.treasuryOf(creator));
        assertTrue(c.active);
    }

    function test_SetConfig_Discrete_AllowsZeroMinAccess() public {
        vm.prank(creator);
        registry.setConfig(tokenId, 500, 1000, AccessRegistry.AccessMode.DISCRETE, 0);
        assertEq(registry.getConfig(tokenId).minAccessSeconds, 0);
    }

    function test_SetConfig_RevertWhenNotCreator() public {
        vm.prank(other);
        vm.expectRevert("not creator");
        registry.setConfig(tokenId, 1000, 2000, AccessRegistry.AccessMode.DISCRETE, 0);
    }

    function test_SetConfig_RevertWhenPriceZero() public {
        vm.prank(creator);
        vm.expectRevert("price=0");
        registry.setConfig(tokenId, 0, 2000, AccessRegistry.AccessMode.DISCRETE, 0);
    }

    function test_SetConfig_RevertWhenTimedWithoutMinAccess() public {
        vm.prank(creator);
        vm.expectRevert("minAccess=0");
        registry.setConfig(tokenId, 1000, 2000, AccessRegistry.AccessMode.TIMED, 0);
    }
}
