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
        uint256 pricePerAccess; // DISCRETE: flat unlock price (USDC, 6 decimals)
        uint256 discoveryPrice; // USDC per sample by a non-holder (flat, x402)
        uint256 ratePerSecond; // TIMED: USDC per second of playback — the nanopayment rate
        AccessMode mode;
        uint256 minAccessSeconds; // TIMED: skip-gate threshold
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
        uint256 ratePerSecond,
        AccessMode mode,
        uint256 minAccessSeconds
    ) external {
        require(msg.sender == nft.creatorOf(tokenId), "not creator");
        if (mode == AccessMode.TIMED) {
            // Metered per second: needs a positive rate and a skip-gate threshold.
            require(ratePerSecond > 0, "rate=0");
            require(minAccessSeconds > 0, "minAccess=0");
        } else {
            // Discrete unlock (artwork / article): needs a flat price.
            require(pricePerAccess > 0, "price=0");
        }
        configs[tokenId] = AccessConfig({
            pricePerAccess: pricePerAccess,
            discoveryPrice: discoveryPrice,
            ratePerSecond: ratePerSecond,
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
