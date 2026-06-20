// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IAfroMeetNFT} from "./interfaces/IAfroMeetNFT.sol";

/// @title AccessRegistry
/// @notice Stores per-work access configuration: the holder rate, the discovery (non-holder) rate,
///         the access mode, the minimum access duration, and the DAO treasury that receives 1% of
///         each settlement. Configured by the work's creator. Split recipients live in SplitResolver.
contract AccessRegistry {
    enum AccessMode {
        TIMED, // audio / video — metered, min-duration threshold
        DISCRETE // writing / artwork / photography — settles on confirmed access
    }

    struct AccessConfig {
        uint256 pricePerAccess; // USDC (6 decimals) per qualifying access by a holder
        uint256 discoveryPrice; // USDC per access by a non-holder
        AccessMode mode;
        uint256 minAccessSeconds; // applies to TIMED only
        address daoTreasury; // receives 1% of each settlement
        bool active;
    }

    IAfroMeetNFT public immutable nft;
    mapping(uint256 tokenId => AccessConfig) public configs;

    event ConfigSet(
        uint256 indexed tokenId, uint256 pricePerAccess, uint256 discoveryPrice, AccessMode mode
    );

    constructor(IAfroMeetNFT nft_) {
        nft = nft_;
    }

    /// @notice Set or update access configuration for a work. Only the creator. The DAO treasury
    ///         is resolved from the creator's on-chain ecosystem — not supplied by the caller — so
    ///         the "1% to DAO" guarantee cannot be redirected.
    function setConfig(
        uint256 tokenId,
        uint256 pricePerAccess,
        uint256 discoveryPrice,
        AccessMode mode,
        uint256 minAccessSeconds
    ) external {
        require(msg.sender == nft.creatorOf(tokenId), "not creator");
        require(pricePerAccess > 0, "price=0");
        if (mode == AccessMode.TIMED) {
            require(minAccessSeconds > 0, "minAccess=0");
        }
        configs[tokenId] = AccessConfig({
            pricePerAccess: pricePerAccess,
            discoveryPrice: discoveryPrice,
            mode: mode,
            minAccessSeconds: minAccessSeconds,
            daoTreasury: nft.treasuryOf(msg.sender),
            active: true
        });
        emit ConfigSet(tokenId, pricePerAccess, discoveryPrice, mode);
    }

    function getConfig(uint256 tokenId) external view returns (AccessConfig memory) {
        return configs[tokenId];
    }
}
