// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {CreatorDAOFactory} from "../src/CreatorDAOFactory.sol";
import {AfroMeetNFT} from "../src/AfroMeetNFT.sol";
import {AfroMeetRoyalty} from "../src/AfroMeetRoyalty.sol";
import {AfroMeetMarketplace} from "../src/AfroMeetMarketplace.sol";
import {IAfroMeetNFT} from "../src/interfaces/IAfroMeetNFT.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

contract AfroMeetMarketplaceTest is Test {
    AfroMeetNFT nft;
    AfroMeetRoyalty royalty;
    AfroMeetMarketplace market;
    MockUSDC usdc;

    address creator = makeAddr("creator");
    address buyer = makeAddr("buyer");
    address buyer2 = makeAddr("buyer2");
    address culturalPool = makeAddr("culturalPool");
    uint256 tokenId;
    uint256 constant PRICE = 100e6;

    function setUp() public {
        usdc = new MockUSDC();
        nft = new AfroMeetNFT(usdc, new CreatorDAOFactory());
        royalty = new AfroMeetRoyalty(IAfroMeetNFT(address(nft)));
        market = new AfroMeetMarketplace(nft, usdc, royalty, culturalPool);

        vm.prank(creator);
        tokenId = nft.mintWork("ipfs://w");

        usdc.mint(buyer, 1_000e6);
        usdc.mint(buyer2, 1_000e6);
    }

    function _list(address seller, uint256 price) internal {
        vm.startPrank(seller);
        nft.approve(address(market), tokenId);
        market.list(tokenId, price);
        vm.stopPrank();
    }

    function test_PrimarySale_CulturalCutNoRoyalty() public {
        _list(creator, PRICE);

        vm.startPrank(buyer);
        usdc.approve(address(market), PRICE);
        market.buy(tokenId);
        vm.stopPrank();

        uint256 culturalCut = (PRICE * 200) / 10000; // 2 USDC
        assertEq(nft.ownerOf(tokenId), buyer);
        assertEq(usdc.balanceOf(culturalPool), culturalCut);
        assertEq(usdc.balanceOf(creator), PRICE - culturalCut); // seller==creator, no royalty
    }

    function test_SecondarySale_PaysCreatorRoyalty() public {
        // Creator sets a 10% royalty, sells to buyer (primary), buyer resells to buyer2 (secondary).
        vm.prank(creator);
        royalty.setRoyalty(tokenId, creator, 1000);

        _list(creator, PRICE);
        vm.startPrank(buyer);
        usdc.approve(address(market), PRICE);
        market.buy(tokenId);
        vm.stopPrank();

        uint256 creatorBalanceAfterPrimary = usdc.balanceOf(creator);

        // Secondary sale at the same price.
        _list(buyer, PRICE);
        vm.startPrank(buyer2);
        usdc.approve(address(market), PRICE);
        market.buy(tokenId);
        vm.stopPrank();

        uint256 culturalCut = (PRICE * 200) / 10000; // 2
        uint256 royaltyAmt = (PRICE * 1000) / 10000; // 10
        assertEq(nft.ownerOf(tokenId), buyer2);
        // Creator earns the royalty on the resale on top of their primary proceeds.
        assertEq(usdc.balanceOf(creator), creatorBalanceAfterPrimary + royaltyAmt);
        assertEq(usdc.balanceOf(culturalPool), 2 * culturalCut); // both sales
        // Reseller (buyer): started 1000, spent PRICE on the primary, nets sale minus cuts on resale.
        assertEq(usdc.balanceOf(buyer), 1_000e6 - PRICE + (PRICE - culturalCut - royaltyAmt));
    }

    function test_List_RevertWhenNotOwner() public {
        vm.prank(buyer);
        vm.expectRevert("not owner");
        market.list(tokenId, PRICE);
    }

    function test_Buy_RevertWhenNotListed() public {
        vm.prank(buyer);
        vm.expectRevert("not listed");
        market.buy(tokenId);
    }

    function test_Cancel_RemovesListing() public {
        _list(creator, PRICE);
        vm.prank(creator);
        market.cancel(tokenId);

        vm.prank(buyer);
        vm.expectRevert("not listed");
        market.buy(tokenId);
    }
}
