// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {CreatorDAOFactory} from "../src/CreatorDAOFactory.sol";
import {AfroMeetNFT} from "../src/AfroMeetNFT.sol";
import {CreatorVibeToken} from "../src/CreatorVibeToken.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

contract AfroMeetNFTTest is Test {
    AfroMeetNFT nft;
    MockUSDC usdc;

    address kofi = makeAddr("kofi");
    address ama = makeAddr("ama");

    function setUp() public {
        usdc = new MockUSDC();
        nft = new AfroMeetNFT(usdc, new CreatorDAOFactory());
    }

    function test_MintWork_MintsToCreatorAndRecordsCreator() public {
        vm.prank(kofi);
        uint256 id = nft.mintWork("ipfs://work1");
        assertEq(id, 1);
        assertEq(nft.ownerOf(id), kofi);
        assertEq(nft.creatorOf(id), kofi);
        assertEq(nft.tokenURI(id), "ipfs://work1");
    }

    function test_FirstMint_CreatesEcosystem() public {
        vm.prank(kofi);
        nft.mintWork("ipfs://work1");
        AfroMeetNFT.Ecosystem memory eco = nft.ecosystemOf(kofi);
        assertTrue(eco.exists);
        assertTrue(eco.token != address(0));
        assertTrue(eco.dao != address(0));
        assertTrue(eco.treasury != address(0));
    }

    function test_FirstMint_DistributesVibeRewardToCreator() public {
        vm.prank(kofi);
        nft.mintWork("ipfs://work1");
        CreatorVibeToken token = CreatorVibeToken(nft.ecosystemOf(kofi).token);
        assertEq(token.balanceOf(kofi), nft.CREATOR_MINT_REWARD());
    }

    function test_SecondMint_ReusesEcosystemAndStacksReward() public {
        vm.startPrank(kofi);
        nft.mintWork("ipfs://work1");
        address tokenAfterFirst = nft.ecosystemOf(kofi).token;
        nft.mintWork("ipfs://work2");
        vm.stopPrank();

        // Same ecosystem token; reward distributed twice.
        assertEq(nft.ecosystemOf(kofi).token, tokenAfterFirst);
        CreatorVibeToken token = CreatorVibeToken(tokenAfterFirst);
        assertEq(token.balanceOf(kofi), 2 * nft.CREATOR_MINT_REWARD());
    }

    function test_DifferentCreators_GetIsolatedEcosystems() public {
        vm.prank(kofi);
        nft.mintWork("ipfs://kofi");
        vm.prank(ama);
        nft.mintWork("ipfs://ama");

        assertTrue(nft.ecosystemOf(kofi).dao != nft.ecosystemOf(ama).dao);
        assertTrue(nft.ecosystemOf(kofi).token != nft.ecosystemOf(ama).token);
    }

    function test_VibeReward_OnlyMintableByNftContract() public {
        vm.prank(kofi);
        nft.mintWork("ipfs://work1");
        CreatorVibeToken token = CreatorVibeToken(nft.ecosystemOf(kofi).token);
        vm.prank(kofi);
        vm.expectRevert("not controller");
        token.distributeTokens(kofi, 1e18, "hack");
    }
}
