// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IAfroMeetNFT} from "./interfaces/IAfroMeetNFT.sol";

/// @title SplitResolver
/// @notice On-chain royalty-split registry. Stores (recipient, basisPoints) tuples per tokenId,
///         set by the work's creator and read by AccessEscrow on every settlement. Splits become
///         immutable once the first access has settled for that tokenId.
contract SplitResolver {
    struct Split {
        address recipient;
        uint256 basisPoints; // out of 10000
    }

    IAfroMeetNFT public immutable nft;
    address public immutable admin;
    /// @notice The AccessEscrow allowed to lock splits on first settlement.
    address public escrow;

    mapping(uint256 tokenId => Split[]) internal _splits;
    mapping(uint256 tokenId => bool) public locked;

    event SplitsSet(uint256 indexed tokenId, uint256 recipients);
    event SplitsLocked(uint256 indexed tokenId);

    constructor(IAfroMeetNFT nft_) {
        nft = nft_;
        admin = msg.sender;
    }

    /// @notice One-time wiring of the escrow that is permitted to lock splits.
    function setEscrow(address escrow_) external {
        require(msg.sender == admin, "not admin");
        require(escrow == address(0), "escrow set");
        require(escrow_ != address(0), "escrow=0");
        escrow = escrow_;
    }

    /// @notice Set or replace the split for a work. Only the creator, and only before lock.
    function setSplits(uint256 tokenId, address[] calldata recipients, uint256[] calldata bps) external {
        require(msg.sender == nft.creatorOf(tokenId), "not creator");
        _setSplits(tokenId, recipients, bps);
    }

    /// @notice Set a freshly-minted work's split on the creator's behalf. Callable only by the NFT
    ///         contract during its single-signature mint flow (the NFT has just recorded the creator).
    function setSplitsFrom(uint256 tokenId, address[] calldata recipients, uint256[] calldata bps) external {
        require(msg.sender == address(nft), "not nft");
        _setSplits(tokenId, recipients, bps);
    }

    function _setSplits(uint256 tokenId, address[] calldata recipients, uint256[] calldata bps) internal {
        require(!locked[tokenId], "locked");
        require(recipients.length == bps.length && recipients.length > 0, "bad length");

        delete _splits[tokenId];
        uint256 sum;
        for (uint256 i; i < recipients.length; ++i) {
            require(recipients[i] != address(0), "recipient=0");
            require(bps[i] > 0, "bps=0");
            sum += bps[i];
            _splits[tokenId].push(Split({recipient: recipients[i], basisPoints: bps[i]}));
        }
        require(sum == 10000, "sum!=10000");

        emit SplitsSet(tokenId, recipients.length);
    }

    /// @notice Lock a work's split. Only callable by the escrow on first settlement.
    function lockSplits(uint256 tokenId) external {
        require(msg.sender == escrow, "not escrow");
        if (!locked[tokenId]) {
            locked[tokenId] = true;
            emit SplitsLocked(tokenId);
        }
    }

    function getSplits(uint256 tokenId) external view returns (Split[] memory) {
        return _splits[tokenId];
    }

    function splitCount(uint256 tokenId) external view returns (uint256) {
        return _splits[tokenId].length;
    }
}
