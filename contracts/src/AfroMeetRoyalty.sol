// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IAfroMeetNFT} from "./interfaces/IAfroMeetNFT.sol";

/// @title AfroMeetRoyalty
/// @notice Secondary-sale royalty registry (EIP-2981-shaped). The creator sets a royalty receiver
///         and rate per work; the marketplace queries `royaltyInfo` and routes the royalty on resale.
contract AfroMeetRoyalty {
    struct Royalty {
        address receiver;
        uint96 bps; // out of 10000
    }

    /// @notice Maximum royalty a creator can set (10%).
    uint96 public constant MAX_BPS = 1000;

    IAfroMeetNFT public immutable nft;
    mapping(uint256 tokenId => Royalty) public royalties;

    event RoyaltySet(uint256 indexed tokenId, address receiver, uint96 bps);

    constructor(IAfroMeetNFT nft_) {
        nft = nft_;
    }

    function setRoyalty(uint256 tokenId, address receiver, uint96 bps) external {
        require(msg.sender == nft.creatorOf(tokenId), "not creator");
        require(receiver != address(0), "receiver=0");
        require(bps <= MAX_BPS, "bps too high");
        royalties[tokenId] = Royalty({receiver: receiver, bps: bps});
        emit RoyaltySet(tokenId, receiver, bps);
    }

    /// @notice Royalty owed on a sale of `tokenId` at `salePrice`. Defaults to the creator with 0
    ///         royalty if unset.
    function royaltyInfo(uint256 tokenId, uint256 salePrice)
        external
        view
        returns (address receiver, uint256 amount)
    {
        Royalty memory r = royalties[tokenId];
        if (r.receiver == address(0)) {
            return (nft.creatorOf(tokenId), 0);
        }
        return (r.receiver, (salePrice * r.bps) / 10000);
    }
}
