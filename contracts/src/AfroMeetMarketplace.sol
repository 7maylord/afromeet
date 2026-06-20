// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IAfroMeetNFT} from "./interfaces/IAfroMeetNFT.sol";
import {AfroMeetRoyalty} from "./AfroMeetRoyalty.sol";

/// @title AfroMeetMarketplace
/// @notice Lists, buys, and resells work NFTs in USDC on Arc. Every sale routes 2% to the cultural
///         preservation pool. Resales additionally pay the creator royalty from AfroMeetRoyalty.
contract AfroMeetMarketplace is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Cultural preservation cut, in basis points (2%).
    uint256 public constant CULTURAL_BPS = 200;

    IERC721 public immutable nft;
    IAfroMeetNFT public immutable nftMeta;
    IERC20 public immutable usdc;
    AfroMeetRoyalty public immutable royalty;
    address public immutable culturalPool;

    struct Listing {
        address seller;
        uint256 price;
        bool active;
    }

    mapping(uint256 tokenId => Listing) public listings;

    event Listed(uint256 indexed tokenId, address indexed seller, uint256 price);
    event Bought(uint256 indexed tokenId, address indexed buyer, uint256 price);
    event Cancelled(uint256 indexed tokenId);

    constructor(IERC721 nft_, IERC20 usdc_, AfroMeetRoyalty royalty_, address culturalPool_) {
        require(culturalPool_ != address(0), "culturalPool=0");
        nft = nft_;
        nftMeta = IAfroMeetNFT(address(nft_));
        usdc = usdc_;
        royalty = royalty_;
        culturalPool = culturalPool_;
    }

    /// @notice List a work for sale. The seller must own it and have approved the marketplace.
    function list(uint256 tokenId, uint256 price) external {
        require(nft.ownerOf(tokenId) == msg.sender, "not owner");
        require(price > 0, "price=0");
        require(
            nft.getApproved(tokenId) == address(this) || nft.isApprovedForAll(msg.sender, address(this)),
            "not approved"
        );
        listings[tokenId] = Listing({seller: msg.sender, price: price, active: true});
        emit Listed(tokenId, msg.sender, price);
    }

    function cancel(uint256 tokenId) external {
        require(listings[tokenId].seller == msg.sender && listings[tokenId].active, "not seller");
        delete listings[tokenId];
        emit Cancelled(tokenId);
    }

    /// @notice Buy a listed work. The buyer must have approved the marketplace for `price` USDC.
    function buy(uint256 tokenId) external nonReentrant {
        Listing memory l = listings[tokenId];
        require(l.active, "not listed");
        require(nft.ownerOf(tokenId) == l.seller, "seller no longer owns");
        delete listings[tokenId];

        address creator = nftMeta.creatorOf(tokenId);
        uint256 culturalCut = (l.price * CULTURAL_BPS) / 10000;

        // Royalty applies only on secondary sales (seller is not the original creator).
        uint256 royaltyAmount;
        address royaltyReceiver;
        if (l.seller != creator) {
            (royaltyReceiver, royaltyAmount) = royalty.royaltyInfo(tokenId, l.price);
        }

        uint256 sellerProceeds = l.price - culturalCut - royaltyAmount;

        usdc.safeTransferFrom(msg.sender, culturalPool, culturalCut);
        if (royaltyAmount > 0) {
            usdc.safeTransferFrom(msg.sender, royaltyReceiver, royaltyAmount);
        }
        usdc.safeTransferFrom(msg.sender, l.seller, sellerProceeds);

        nft.safeTransferFrom(l.seller, msg.sender, tokenId);

        emit Bought(tokenId, msg.sender, l.price);
    }
}
