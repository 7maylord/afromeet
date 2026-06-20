// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";

/// @title FractionalVault
/// @notice Classic Tessera / fractional.art vault: locks one ERC-721 work and mints a fixed
///         supply of fungible ERC-20 shares. Per-access USDC revenue sent to this vault is
///         distributed pro-rata to share holders via a pull-based cumulative accumulator.
/// @dev    One vault == one ERC-20 share token == one locked ERC-721. Deployed by the factory,
///         which transfers the NFT in immediately after construction. No admin keys.
contract FractionalVault is ERC20, IERC721Receiver, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using SafeCast for uint256;

    /// @dev Fixed-point magnitude for the per-share accumulator. 2**128 keeps precision well
    ///      above realistic share supplies while leaving headroom against uint256 overflow.
    uint256 internal constant MAGNITUDE = 2 ** 128;

    IERC721 public immutable nft;
    uint256 public immutable tokenId;
    address public immutable curator;
    IERC20 public immutable revenueToken; // USDC on Arc

    /// @notice True once the NFT has been redeemed and the vault dissolved.
    bool public redeemed;

    // --- Primary share sale ---------------------------------------------------
    /// @notice Price in revenueToken (USDC, 6dp) per share unit, set by the curator.
    uint256 public saleSharePrice;
    /// @notice Remaining shares the curator has offered for primary sale.
    uint256 public sharesForSale;

    // --- Revenue accounting ---------------------------------------------------
    uint256 internal magnifiedRevenuePerShare; // cumulative revenue per share, scaled by MAGNITUDE
    uint256 internal accountedRevenue; // revenue already folded into the accumulator
    uint256 public totalWithdrawn;
    mapping(address holder => int256 correction) internal magnifiedCorrections;
    mapping(address holder => uint256 amount) internal withdrawnRevenue;

    event RevenueAccrued(uint256 amount, uint256 perShare);
    event RevenueClaimed(address indexed holder, uint256 amount);
    event Redeemed(address indexed redeemer);
    event SaleConfigured(uint256 sharesForSale, uint256 pricePerShare);
    event SharesPurchased(address indexed buyer, uint256 shares, uint256 cost);

    /// @param _curator     Receives the full share supply; the work's creator.
    /// @param _nft         The ERC-721 collection being fractionalised.
    /// @param _tokenId     The token id within that collection.
    /// @param _revenueToken USDC (or other ERC-20) in which per-access revenue arrives.
    /// @param _totalShares Fixed share supply (e.g. 1_000_000e18).
    constructor(
        address _curator,
        IERC721 _nft,
        uint256 _tokenId,
        IERC20 _revenueToken,
        uint256 _totalShares,
        string memory name_,
        string memory symbol_
    ) ERC20(name_, symbol_) {
        require(_curator != address(0), "curator=0");
        require(address(_revenueToken) != address(0), "revenueToken=0");
        require(_totalShares > 0, "shares=0");
        curator = _curator;
        nft = _nft;
        tokenId = _tokenId;
        revenueToken = _revenueToken;
        _mint(_curator, _totalShares);
    }

    // --- Revenue distribution -------------------------------------------------

    /// @notice Folds any USDC that has arrived since the last interaction into the per-share
    ///         accumulator. Called automatically before any balance change or claim, so the
    ///         settlement layer can simply `transfer` USDC to this vault with no callback.
    function _sync() internal {
        uint256 supply = totalSupply();
        if (supply == 0) return;
        uint256 balance = revenueToken.balanceOf(address(this));
        // Invariant: balance == accountedRevenue - totalWithdrawn + unaccounted.
        uint256 unaccounted = balance + totalWithdrawn - accountedRevenue;
        if (unaccounted == 0) return;
        uint256 perShareDelta = (unaccounted * MAGNITUDE) / supply;
        if (perShareDelta == 0) return; // dust below 1-wei-per-share; carries forward
        magnifiedRevenuePerShare += perShareDelta;
        // Only account the exactly-folded amount; remainder stays unaccounted to avoid drift.
        uint256 folded = (perShareDelta * supply) / MAGNITUDE;
        accountedRevenue += folded;
        emit RevenueAccrued(folded, magnifiedRevenuePerShare);
    }

    /// @notice Permissionless trigger to fold pending revenue without claiming.
    function syncRevenue() external {
        _sync();
    }

    /// @notice Pull the caller's accrued, unclaimed revenue.
    function claimRevenue() external nonReentrant returns (uint256 amount) {
        _sync();
        amount = _withdrawableOf(msg.sender);
        require(amount > 0, "nothing to claim");
        withdrawnRevenue[msg.sender] += amount;
        totalWithdrawn += amount;
        revenueToken.safeTransfer(msg.sender, amount);
        emit RevenueClaimed(msg.sender, amount);
    }

    /// @notice Revenue claimable by `holder` as of the last sync (view simulates a fresh sync).
    function withdrawableRevenueOf(address holder) public view returns (uint256) {
        uint256 perShare = _syncedPerShare();
        uint256 accumulative = _accumulativeAt(holder, perShare);
        return accumulative - withdrawnRevenue[holder];
    }

    function _withdrawableOf(address holder) internal view returns (uint256) {
        return _accumulativeAt(holder, magnifiedRevenuePerShare) - withdrawnRevenue[holder];
    }

    function _accumulativeAt(address holder, uint256 perShare) internal view returns (uint256) {
        int256 raw = (perShare * balanceOf(holder)).toInt256() + magnifiedCorrections[holder];
        return uint256(raw) / MAGNITUDE;
    }

    function _syncedPerShare() internal view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return magnifiedRevenuePerShare;
        uint256 balance = revenueToken.balanceOf(address(this));
        uint256 unaccounted = balance + totalWithdrawn - accountedRevenue;
        return magnifiedRevenuePerShare + (unaccounted * MAGNITUDE) / supply;
    }

    /// @dev Keep each holder's accrued revenue invariant across share transfers, mints and burns.
    ///      Fold pending revenue first so the sender keeps revenue earned while holding the shares.
    function _update(address from, address to, uint256 value) internal override {
        _sync();
        super._update(from, to, value);
        int256 magnifiedValue = (magnifiedRevenuePerShare * value).toInt256();
        if (from != address(0)) magnifiedCorrections[from] += magnifiedValue;
        if (to != address(0)) magnifiedCorrections[to] -= magnifiedValue;
    }

    // --- Redemption -----------------------------------------------------------

    /// @notice A holder owning 100% of shares burns them to withdraw the underlying NFT.
    function redeem() external nonReentrant {
        require(!redeemed, "redeemed");
        uint256 supply = totalSupply();
        require(supply > 0 && balanceOf(msg.sender) == supply, "need 100%");

        _sync();
        // Pay out any accrued revenue before burning so it is not stranded.
        uint256 amount = _withdrawableOf(msg.sender);
        if (amount > 0) {
            withdrawnRevenue[msg.sender] += amount;
            totalWithdrawn += amount;
            revenueToken.safeTransfer(msg.sender, amount);
            emit RevenueClaimed(msg.sender, amount);
        }

        redeemed = true;
        _burn(msg.sender, supply);
        nft.safeTransferFrom(address(this), msg.sender, tokenId);

        // Sweep any residual dust revenue to the redeemer.
        uint256 dust = revenueToken.balanceOf(address(this));
        if (dust > 0) revenueToken.safeTransfer(msg.sender, dust);

        emit Redeemed(msg.sender);
    }

    // --- Primary share sale ---------------------------------------------------

    /// @notice Curator offers up to `shares` of their holding for sale at `pricePerShare`
    ///         (USDC per share unit). Fans and the Patron Agent buy from this allocation.
    function configureSale(uint256 shares, uint256 pricePerShare) external {
        require(msg.sender == curator, "not curator");
        require(!redeemed, "redeemed");
        sharesForSale = shares;
        saleSharePrice = pricePerShare;
        emit SaleConfigured(shares, pricePerShare);
    }

    /// @notice Buy `shareAmount` shares from the curator's sale allocation, paying USDC to the
    ///         curator. The buyer immediately becomes a pro-rata revenue holder.
    function buyShares(uint256 shareAmount) external nonReentrant {
        require(!redeemed, "redeemed");
        require(saleSharePrice > 0 && shareAmount > 0, "not for sale");
        require(shareAmount <= sharesForSale, "exceeds allocation");
        require(balanceOf(curator) >= shareAmount, "curator lacks shares");

        uint256 cost = shareAmount * saleSharePrice;
        sharesForSale -= shareAmount; // effects before interactions

        revenueToken.safeTransferFrom(msg.sender, curator, cost);
        _transfer(curator, msg.sender, shareAmount);

        emit SharesPurchased(msg.sender, shareAmount, cost);
    }

    // --- ERC-721 receiver -----------------------------------------------------

    function onERC721Received(address, address, uint256 _tokenId, bytes calldata)
        external
        view
        returns (bytes4)
    {
        require(msg.sender == address(nft) && _tokenId == tokenId, "wrong nft");
        return IERC721Receiver.onERC721Received.selector;
    }
}
