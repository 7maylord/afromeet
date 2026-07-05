// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice The setup surface AfroMeetNFT calls during a single-signature mint. These functions are
///         gated to the NFT contract, which is the on-chain authority on who a token's creator is —
///         so it can configure a freshly-minted work on the creator's behalf without a second signature.
interface IAccessRegistrySetup {
    function setConfigFrom(
        uint256 tokenId,
        address creator,
        uint256 pricePerAccess,
        uint256 discoveryPrice,
        uint256 ratePerSecond,
        uint8 mode,
        uint256 minAccessSeconds
    ) external;
}

interface ISplitResolverSetup {
    function setSplitsFrom(uint256 tokenId, address[] calldata recipients, uint256[] calldata bps) external;
}
