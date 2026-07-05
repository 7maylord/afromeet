// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {CreatorDAOFactory} from "../src/CreatorDAOFactory.sol";
import {AfroMeetNFT} from "../src/AfroMeetNFT.sol";
import {AccessRegistry} from "../src/AccessRegistry.sol";
import {SplitResolver} from "../src/SplitResolver.sol";
import {AccessEscrow} from "../src/AccessEscrow.sol";
import {FractionalVault} from "../src/FractionalVault.sol";
import {FractionalVaultFactory} from "../src/FractionalVaultFactory.sol";
import {IAfroMeetNFT} from "../src/interfaces/IAfroMeetNFT.sol";
import {IFractionalVaultFactory} from "../src/interfaces/IFractionalVaultFactory.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

/// @notice Covers option-2 revenue routing: once a work is fractionalised, the *curator's own*
///         access-revenue split is paid into the vault and distributes pro-rata to shareholders —
///         including when the work is fractionalised *after* it has already started earning (splits
///         are locked by then). Also proves the routing cannot be hijacked by a third party.
contract AccessEscrowVaultRoutingTest is Test {
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
    address buyer = makeAddr("buyer");
    address attacker = makeAddr("attacker");
    address treasury;

    uint256 tokenId;
    uint256 constant PRICE = 1_000; // DISCRETE unlock price (USDC, 6dp)
    uint256 constant SHARES = 1_000_000;

    // With a 70/30 split and a 1% DAO cut on PRICE=1000:
    uint256 constant DAO_CUT = 10; // 1%
    uint256 constant REMAINDER = 990;
    uint256 constant CREATOR_PART = 693; // 70% of 990
    uint256 constant PRODUCER_PART = 297; // 30% of 990

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
        tokenId = nft.mintWork("ipfs://spoken-word");
        treasury = nft.treasuryOf(creator);

        // 70% creator, 30% producer (a collaborator who is NOT fractionalising).
        address[] memory r = new address[](2);
        uint256[] memory bps = new uint256[](2);
        r[0] = creator;
        r[1] = producer;
        bps[0] = 7000;
        bps[1] = 3000;
        vm.prank(creator);
        splits.setSplits(tokenId, r, bps);

        // DISCRETE flat-price work (a spoken-word one-off unlock).
        vm.prank(creator);
        registry.setConfig(tokenId, PRICE, PRICE, 0, AccessRegistry.AccessMode.DISCRETE, 0);

        usdc.mint(listener, 1e6);
        vm.prank(listener);
        usdc.approve(address(escrow), type(uint256).max);
    }

    // --- helpers --------------------------------------------------------------

    function _fractionaliseBy(address who) internal returns (FractionalVault vault) {
        vm.startPrank(who);
        nft.approve(address(vaultFactory), tokenId);
        address v = vaultFactory.fractionalise(nft, tokenId, usdc, SHARES, "Spoken Word Shares", "vSW");
        vm.stopPrank();
        return FractionalVault(v);
    }

    function _settle(bytes32 id) internal {
        vm.startPrank(operator);
        escrow.openSession(id, listener, tokenId, PRICE);
        escrow.settle(id, 0); // elapsed ignored for DISCRETE
        vm.stopPrank();
    }

    // --- tests ----------------------------------------------------------------

    /// The core property: after fractionalising, plays pay the creator's share into the vault
    /// (not the creator's EOA), while the collaborator and DAO are untouched — so shareholders
    /// actually earn from every play.
    function test_CuratorSplitRoutesToVault_CollaboratorAndDaoUntouched() public {
        FractionalVault vault = _fractionaliseBy(creator);

        _settle("s1");

        assertEq(usdc.balanceOf(address(vault)), CREATOR_PART, "creator's share must land in the vault");
        assertEq(usdc.balanceOf(creator), 0, "creator EOA must not be paid directly");
        assertEq(usdc.balanceOf(producer), PRODUCER_PART, "collaborator paid directly, unchanged");
        assertEq(usdc.balanceOf(treasury), DAO_CUT, "DAO 1% preserved");
        assertEq(usdc.balanceOf(address(escrow)), 0, "nothing stranded");
    }

    /// The whole point of option 2: a work that has ALREADY earned (so its splits are locked) can
    /// still be fractionalised afterwards, and every subsequent play routes to shareholders.
    function test_FractionaliseAfterEarning_RoutesSubsequentRevenue() public {
        // First play — before any vault exists. Pays the creator directly and locks the splits.
        _settle("s1");
        assertEq(usdc.balanceOf(creator), CREATOR_PART, "pre-fractionalise play pays creator directly");
        assertTrue(splits.locked(tokenId), "splits lock on first settlement");

        // Now fractionalise the already-earning work — no need to touch the (locked) splits.
        FractionalVault vault = _fractionaliseBy(creator);

        // Second play — now routed to the vault for the shareholders.
        _settle("s2");
        assertEq(usdc.balanceOf(address(vault)), CREATOR_PART, "post-fractionalise play routes to vault");
        assertEq(usdc.balanceOf(creator), CREATOR_PART, "creator keeps only the pre-fractionalise earnings");
    }

    /// Shareholders split the routed revenue pro-rata to their holdings. Creator keeps 60% of the
    /// shares, a fan buys 40%; a play then pays each of them ~their share of the creator's cut.
    function test_ShareholdersClaimProRata() public {
        FractionalVault vault = _fractionaliseBy(creator);

        // Curator offers 40% of supply at 1 USDC-unit per share; the fan buys it.
        uint256 forSale = (SHARES * 40) / 100; // 400_000 shares
        vm.prank(creator);
        vault.configureSale(forSale, 1);
        usdc.mint(buyer, forSale); // cost = forSale * 1
        vm.startPrank(buyer);
        usdc.approve(address(vault), forSale);
        vault.buyShares(forSale);
        vm.stopPrank();

        // A play routes the creator's 693 into the vault.
        _settle("s1");
        assertEq(usdc.balanceOf(address(vault)), CREATOR_PART);

        // Measure claim deltas: the creator's balance also holds the share-sale proceeds.
        uint256 buyerBefore = usdc.balanceOf(buyer);
        uint256 creatorBefore = usdc.balanceOf(creator);
        vm.prank(buyer);
        vault.claimRevenue();
        vm.prank(creator);
        vault.claimRevenue();

        // Buyer holds 40% → ~40% of 693 (277); creator holds 60% → ~416. Allow 1-wei accumulator dust.
        assertApproxEqAbs(usdc.balanceOf(buyer) - buyerBefore, (CREATOR_PART * 40) / 100, 1, "buyer pro-rata");
        assertApproxEqAbs(usdc.balanceOf(creator) - creatorBefore, (CREATOR_PART * 60) / 100, 1, "creator pro-rata");
    }

    /// Authorisation guard: a third party who buys the NFT and fractionalises it CANNOT divert the
    /// original creator's access-revenue split into their own vault. The redirect is gated on the
    /// vault curator matching the split recipient, so only your own share follows you into a vault.
    function test_ThirdPartyCannotDivertCreatorRevenue() public {
        // Creator sells the work NFT to an attacker (access splits stay as configured by the creator).
        vm.prank(creator);
        nft.transferFrom(creator, attacker, tokenId);

        // Attacker fractionalises the work they now own — they become the vault's curator.
        FractionalVault vault = _fractionaliseBy(attacker);
        assertEq(vault.curator(), attacker);

        _settle("s1");

        // The creator is still a split recipient but is NOT the curator, so their share is paid to
        // them directly — the attacker's vault captures nothing from the creator's split.
        assertEq(usdc.balanceOf(creator), CREATOR_PART, "creator's revenue is not divertible");
        assertEq(usdc.balanceOf(producer), PRODUCER_PART, "collaborator unaffected");
        assertEq(usdc.balanceOf(address(vault)), 0, "attacker vault receives nothing from access revenue");
    }

    /// A holder of 100% of shares can still redeem the underlying NFT and sweep the routed revenue.
    function test_RoutedRevenueIsClaimableThenRedeemable() public {
        FractionalVault vault = _fractionaliseBy(creator);
        _settle("s1");

        vm.prank(creator);
        vault.claimRevenue();
        assertApproxEqAbs(usdc.balanceOf(creator), CREATOR_PART, 1, "sole holder claims the routed revenue");

        vm.prank(creator);
        vault.redeem();
        assertEq(nft.ownerOf(tokenId), creator, "100% holder redeems the NFT");
    }

    /// After a redeem dissolves the vault, subsequent plays must pay the creator directly rather
    /// than routing to the dead (zero-supply) vault, where the funds would be permanently stranded.
    function test_RedeemedVault_RoutesBackToCreator_NotStranded() public {
        FractionalVault vault = _fractionaliseBy(creator);
        vm.prank(creator);
        vault.redeem(); // sole holder dissolves the vault; vaultOf still points at it
        assertTrue(vault.redeemed());

        _settle("s1");

        assertEq(usdc.balanceOf(creator), CREATOR_PART, "creator paid directly after redeem");
        assertEq(usdc.balanceOf(address(vault)), 0, "nothing stranded in the dead vault");
        assertEq(usdc.balanceOf(producer), PRODUCER_PART, "collaborator unaffected");
    }
}
