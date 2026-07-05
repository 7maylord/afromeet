// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {CreatorDAOFactory} from "../src/CreatorDAOFactory.sol";
import {AfroMeetNFT} from "../src/AfroMeetNFT.sol";
import {SplitResolver} from "../src/SplitResolver.sol";
import {IAfroMeetNFT} from "../src/interfaces/IAfroMeetNFT.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

contract SplitResolverTest is Test {
    AfroMeetNFT nft;
    SplitResolver resolver;

    address creator = makeAddr("creator");
    address producer = makeAddr("producer");
    address label = makeAddr("label");
    address escrow = makeAddr("escrow");
    uint256 tokenId;

    function setUp() public {
        MockUSDC usdc = new MockUSDC();
        nft = new AfroMeetNFT(usdc, new CreatorDAOFactory());
        resolver = new SplitResolver(IAfroMeetNFT(address(nft)));
        resolver.setEscrow(escrow);
        vm.prank(creator);
        tokenId = nft.mintWork("ipfs://w");
    }

    function _split(uint256 a, uint256 b) internal view returns (address[] memory r, uint256[] memory bps) {
        r = new address[](2);
        bps = new uint256[](2);
        r[0] = creator;
        r[1] = producer;
        bps[0] = a;
        bps[1] = b;
    }

    function test_SetSplits_StoresTuples() public {
        (address[] memory r, uint256[] memory bps) = _split(7000, 3000);
        vm.prank(creator);
        resolver.setSplits(tokenId, r, bps);

        SplitResolver.Split[] memory s = resolver.getSplits(tokenId);
        assertEq(s.length, 2);
        assertEq(s[0].recipient, creator);
        assertEq(s[0].basisPoints, 7000);
        assertEq(s[1].basisPoints, 3000);
    }

    function test_SetSplits_RevertWhenNotCreator() public {
        (address[] memory r, uint256[] memory bps) = _split(7000, 3000);
        vm.prank(label);
        vm.expectRevert("not creator");
        resolver.setSplits(tokenId, r, bps);
    }

    function test_SetSplits_RevertWhenSumNot10000() public {
        (address[] memory r, uint256[] memory bps) = _split(7000, 2000); // 9000
        vm.prank(creator);
        vm.expectRevert("sum!=10000");
        resolver.setSplits(tokenId, r, bps);
    }

    function test_SetSplits_RevertWhenLocked() public {
        (address[] memory r, uint256[] memory bps) = _split(7000, 3000);
        vm.prank(creator);
        resolver.setSplits(tokenId, r, bps);

        vm.prank(escrow);
        resolver.lockSplits(tokenId);
        assertTrue(resolver.locked(tokenId));

        vm.prank(creator);
        vm.expectRevert("locked");
        resolver.setSplits(tokenId, r, bps);
    }

    function test_LockSplits_OnlyEscrow() public {
        vm.prank(creator);
        vm.expectRevert("not escrow");
        resolver.lockSplits(tokenId);
    }

    function test_SetEscrow_OnlyOnce() public {
        vm.expectRevert("escrow set");
        resolver.setEscrow(makeAddr("other"));
    }

    function test_SetEscrow_OnlyAdmin() public {
        SplitResolver fresh = new SplitResolver(IAfroMeetNFT(address(nft)));
        vm.prank(label);
        vm.expectRevert("not admin");
        fresh.setEscrow(escrow);
    }

    function test_SetEscrow_RevertOnZero() public {
        SplitResolver fresh = new SplitResolver(IAfroMeetNFT(address(nft)));
        vm.expectRevert("escrow=0");
        fresh.setEscrow(address(0));
    }

    function test_SetSplits_RevertOnBadLength() public {
        address[] memory r = new address[](2);
        uint256[] memory bps = new uint256[](1);
        r[0] = creator;
        r[1] = producer;
        bps[0] = 10000;
        vm.prank(creator);
        vm.expectRevert("bad length");
        resolver.setSplits(tokenId, r, bps);
    }

    function test_SetSplits_RevertOnZeroRecipient() public {
        (address[] memory r, uint256[] memory bps) = _split(7000, 3000);
        r[0] = address(0);
        vm.prank(creator);
        vm.expectRevert("recipient=0");
        resolver.setSplits(tokenId, r, bps);
    }

    function test_SetSplits_RevertOnZeroBps() public {
        (address[] memory r, uint256[] memory bps) = _split(0, 10000);
        vm.prank(creator);
        vm.expectRevert("bps=0");
        resolver.setSplits(tokenId, r, bps);
    }

    function test_SplitCount() public {
        (address[] memory r, uint256[] memory bps) = _split(7000, 3000);
        vm.prank(creator);
        resolver.setSplits(tokenId, r, bps);
        assertEq(resolver.splitCount(tokenId), 2);
    }
}
