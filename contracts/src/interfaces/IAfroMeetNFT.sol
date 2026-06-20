// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Minimal view surface of AfroMeetNFT consumed by the access, split, royalty and
///         marketplace layers.
interface IAfroMeetNFT {
    function creatorOf(uint256 tokenId) external view returns (address);
    function treasuryOf(address creator) external view returns (address);
}
