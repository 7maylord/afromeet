// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {CreatorDAOFactory} from "../src/CreatorDAOFactory.sol";
import {AfroMeetNFT} from "../src/AfroMeetNFT.sol";
import {AfroMeetRoyalty} from "../src/AfroMeetRoyalty.sol";
import {IAfroMeetNFT} from "../src/interfaces/IAfroMeetNFT.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

contract AfroMeetRoyaltyTest is Test {
    AfroMeetNFT nft;
    AfroMeetRoyalty royalty;

    address creator = makeAddr("creator");
    address other = makeAddr("other");
    uint256 tokenId;

    function setUp() public {
        MockUSDC usdc = new MockUSDC();
        nft = new AfroMeetNFT(usdc, new CreatorDAOFactory());
        royalty = new AfroMeetRoyalty(IAfroMeetNFT(address(nft)));
        vm.prank(creator);
        tokenId = nft.mintWork("ipfs://w");
    }

    function test_RoyaltyInfo_DefaultsToCreatorWithZero() public view {
        (address receiver, uint256 amount) = royalty.royaltyInfo(tokenId, 1_000e6);
        assertEq(receiver, creator);
        assertEq(amount, 0);
    }

    function test_SetRoyalty_AppliesToInfo() public {
        vm.prank(creator);
        royalty.setRoyalty(tokenId, creator, 500); // 5%
        (address receiver, uint256 amount) = royalty.royaltyInfo(tokenId, 1_000e6);
        assertEq(receiver, creator);
        assertEq(amount, 50e6);
    }

    function test_SetRoyalty_OnlyCreator() public {
        vm.prank(other);
        vm.expectRevert("not creator");
        royalty.setRoyalty(tokenId, other, 500);
    }

    function test_SetRoyalty_RevertAboveMax() public {
        uint96 tooHigh = royalty.MAX_BPS() + 1;
        vm.prank(creator);
        vm.expectRevert("bps too high");
        royalty.setRoyalty(tokenId, creator, tooHigh);
    }
}
