// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {FractionalVault} from "../src/FractionalVault.sol";
import {FractionalVaultFactory} from "../src/FractionalVaultFactory.sol";
import {MockERC721} from "./mocks/MockERC721.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

contract FractionalVaultTest is Test {
    FractionalVaultFactory factory;
    MockERC721 nft;
    MockUSDC usdc;

    address curator = makeAddr("curator");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    uint256 constant TOKEN_ID = 1;
    // Supply chosen so per-share accumulator math is exact for the USDC amounts used below.
    uint256 constant SHARES = 1_000_000;

    function setUp() public {
        factory = new FractionalVaultFactory();
        nft = new MockERC721();
        usdc = new MockUSDC();
        nft.mint(curator, TOKEN_ID);
    }

    function _fractionalise() internal returns (FractionalVault vault) {
        vm.startPrank(curator);
        nft.approve(address(factory), TOKEN_ID);
        address v = factory.fractionalise(nft, TOKEN_ID, usdc, SHARES, "Vault Shares", "vSHARE");
        vm.stopPrank();
        return FractionalVault(v);
    }

    /// Sends USDC straight to the vault — exactly how the access-settlement layer pays a
    /// fractionalised work (vault is the split recipient; no callback).
    function _distribute(FractionalVault vault, uint256 amount) internal {
        usdc.mint(address(vault), amount);
    }

    // --- Fractionalisation ----------------------------------------------------

    function test_Fractionalise_LocksNftAndMintsShares() public {
        FractionalVault vault = _fractionalise();
        // NFT is custodied by the vault; curator holds the entire share supply.
        assertEq(nft.ownerOf(TOKEN_ID), address(vault));
        assertEq(vault.totalSupply(), SHARES);
        assertEq(vault.balanceOf(curator), SHARES);
        assertEq(vault.curator(), curator);
    }

    function test_Fractionalise_RecordsVaultMapping() public {
        FractionalVault vault = _fractionalise();
        assertEq(factory.vaultOf(address(nft), TOKEN_ID), address(vault));
        assertEq(factory.allVaultsLength(), 1);
    }

    function test_Fractionalise_RevertWhenAlreadyFractionalised() public {
        // After a redeem the NFT returns to its owner but keeps its vaultOf mapping, so it cannot
        // be silently re-fractionalised into a second vault — the original share holders' vault
        // record stays authoritative.
        FractionalVault vault = _fractionalise();
        vm.prank(curator);
        vault.redeem();
        assertEq(nft.ownerOf(TOKEN_ID), curator); // owns it again

        vm.startPrank(curator);
        nft.approve(address(factory), TOKEN_ID);
        vm.expectRevert("already fractionalised");
        factory.fractionalise(nft, TOKEN_ID, usdc, SHARES, "x", "x");
        vm.stopPrank();
    }

    function test_Fractionalise_RevertWhenNotOwner() public {
        vm.prank(alice);
        vm.expectRevert("not owner");
        factory.fractionalise(nft, TOKEN_ID, usdc, SHARES, "x", "x");
    }

    function test_Fractionalise_RevertWhenZeroShares() public {
        vm.startPrank(curator);
        nft.approve(address(factory), TOKEN_ID);
        vm.expectRevert("shares=0");
        factory.fractionalise(nft, TOKEN_ID, usdc, 0, "x", "x");
        vm.stopPrank();
    }

    // --- Revenue distribution -------------------------------------------------

    function test_Revenue_SingleHolderClaimsAll() public {
        FractionalVault vault = _fractionalise();
        _distribute(vault, 100e6); // $100 of per-access revenue

        assertEq(vault.withdrawableRevenueOf(curator), 100e6);

        vm.prank(curator);
        vault.claimRevenue();
        assertEq(usdc.balanceOf(curator), 100e6);
        assertEq(vault.withdrawableRevenueOf(curator), 0);
    }

    function test_Revenue_SplitProRataBetweenTwoHolders() public {
        FractionalVault vault = _fractionalise();
        // Curator sells 30% to alice before any revenue arrives.
        vm.prank(curator);
        vault.transfer(alice, (SHARES * 30) / 100);

        _distribute(vault, 100e6);

        // 70 / 30 split of $100.
        assertEq(vault.withdrawableRevenueOf(curator), 70e6);
        assertEq(vault.withdrawableRevenueOf(alice), 30e6);
    }

    /// Core correctness: a share transfer carries *future* revenue to the buyer but leaves
    /// *already-earned* revenue with the seller.
    function test_Revenue_TransferMovesFutureRevenueNotPast() public {
        FractionalVault vault = _fractionalise();

        _distribute(vault, 100e6); // earned entirely by curator (100% holder)

        // Now curator sells half to alice.
        vm.prank(curator);
        vault.transfer(alice, SHARES / 2);

        // The first $100 stays owed to the curator; alice is owed nothing yet.
        assertEq(vault.withdrawableRevenueOf(curator), 100e6);
        assertEq(vault.withdrawableRevenueOf(alice), 0);

        // A second $100 is split 50/50.
        _distribute(vault, 100e6);
        assertEq(vault.withdrawableRevenueOf(curator), 150e6);
        assertEq(vault.withdrawableRevenueOf(alice), 50e6);
    }

    function test_Revenue_ClaimTwiceYieldsNothing() public {
        FractionalVault vault = _fractionalise();
        _distribute(vault, 100e6);

        vm.startPrank(curator);
        vault.claimRevenue();
        vm.expectRevert("nothing to claim");
        vault.claimRevenue();
        vm.stopPrank();
    }

    function test_Revenue_AccrueAcrossMultipleDistributions() public {
        FractionalVault vault = _fractionalise();
        vm.prank(curator);
        vault.transfer(alice, SHARES / 2);

        _distribute(vault, 40e6);
        _distribute(vault, 60e6);

        assertEq(vault.withdrawableRevenueOf(curator), 50e6);
        assertEq(vault.withdrawableRevenueOf(alice), 50e6);

        vm.prank(alice);
        vault.claimRevenue();
        assertEq(usdc.balanceOf(alice), 50e6);
    }

    function test_Revenue_WithdrawableViewMatchesClaim() public {
        FractionalVault vault = _fractionalise();
        vm.prank(curator);
        vault.transfer(bob, (SHARES * 25) / 100);
        _distribute(vault, 80e6);

        uint256 quoted = vault.withdrawableRevenueOf(bob);
        vm.prank(bob);
        uint256 claimed = vault.claimRevenue();
        assertEq(claimed, quoted);
        assertEq(claimed, 20e6); // 25% of $80
    }

    function test_Revenue_SyncIsPermissionless() public {
        FractionalVault vault = _fractionalise();
        _distribute(vault, 100e6);
        // Anyone can fold pending revenue; it does not change who is owed what.
        vm.prank(alice);
        vault.syncRevenue();
        assertEq(vault.withdrawableRevenueOf(curator), 100e6);
    }

    // --- Redemption -----------------------------------------------------------

    function test_Redeem_FullHolderGetsNftAndBurnsShares() public {
        FractionalVault vault = _fractionalise();
        // Bob buys up 100% of the shares from the curator on the secondary market.
        vm.prank(curator);
        vault.transfer(bob, SHARES);

        vm.prank(bob);
        vault.redeem();

        assertEq(nft.ownerOf(TOKEN_ID), bob);
        assertTrue(vault.redeemed());
        assertEq(vault.totalSupply(), 0);
        assertEq(vault.balanceOf(bob), 0);
    }

    function test_Redeem_RevertWhenNotFullOwner() public {
        FractionalVault vault = _fractionalise();
        vm.prank(curator);
        vault.transfer(alice, 1); // curator no longer holds 100%

        vm.prank(curator);
        vm.expectRevert("need 100%");
        vault.redeem();
    }

    function test_Redeem_PaysOutAccruedRevenueBeforeBurn() public {
        FractionalVault vault = _fractionalise();
        _distribute(vault, 100e6); // owed to curator (sole holder)

        vm.prank(curator);
        vault.redeem();

        // Curator walks away with both the NFT and the accrued revenue.
        assertEq(nft.ownerOf(TOKEN_ID), curator);
        assertEq(usdc.balanceOf(curator), 100e6);
        assertEq(usdc.balanceOf(address(vault)), 0);
    }

    // --- Primary share sale ---------------------------------------------------

    function test_BuyShares_TransfersSharesAndPaysCurator() public {
        FractionalVault vault = _fractionalise();
        vm.prank(curator);
        vault.configureSale(400_000, 2); // 400k shares at 2 USDC-units each

        usdc.mint(alice, 1e6);
        vm.startPrank(alice);
        usdc.approve(address(vault), type(uint256).max);
        vault.buyShares(100_000);
        vm.stopPrank();

        assertEq(vault.balanceOf(alice), 100_000);
        assertEq(vault.balanceOf(curator), SHARES - 100_000);
        assertEq(usdc.balanceOf(curator), 200_000); // 100k * 2
        assertEq(vault.sharesForSale(), 300_000);
    }

    function test_BuyShares_BuyerEarnsRevenueProRata() public {
        FractionalVault vault = _fractionalise();
        vm.prank(curator);
        vault.configureSale(SHARES / 2, 1);

        usdc.mint(alice, 1e6);
        vm.startPrank(alice);
        usdc.approve(address(vault), type(uint256).max);
        vault.buyShares(SHARES / 2); // alice now holds 50%
        vm.stopPrank();

        _distribute(vault, 100e6);
        // Revenue earned only from the moment alice held shares — 50/50 split.
        assertEq(vault.withdrawableRevenueOf(alice), 50e6);
        assertEq(vault.withdrawableRevenueOf(curator), 50e6);
    }

    function test_ConfigureSale_OnlyCurator() public {
        FractionalVault vault = _fractionalise();
        vm.prank(alice);
        vm.expectRevert("not curator");
        vault.configureSale(100, 1);
    }

    function test_BuyShares_RevertWhenExceedsAllocation() public {
        FractionalVault vault = _fractionalise();
        vm.prank(curator);
        vault.configureSale(100, 1);

        usdc.mint(alice, 1e6);
        vm.startPrank(alice);
        usdc.approve(address(vault), type(uint256).max);
        vm.expectRevert("exceeds allocation");
        vault.buyShares(101);
        vm.stopPrank();
    }

    function test_BuyShares_RevertWhenNotForSale() public {
        FractionalVault vault = _fractionalise();
        vm.prank(alice);
        vm.expectRevert("not for sale");
        vault.buyShares(1);
    }
}
