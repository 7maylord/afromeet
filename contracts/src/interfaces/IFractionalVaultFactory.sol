// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Minimal view surface of the fractional-vault layer consumed by AccessEscrow, so a
///         curator's own access-revenue split can be routed into the vault that tokenises their
///         ownership — without AccessEscrow depending on the full vault/factory implementations.
interface IFractionalVaultFactory {
    function vaultOf(address nft, uint256 tokenId) external view returns (address);
}

interface IFractionalVault {
    function curator() external view returns (address);
    function redeemed() external view returns (bool);
}
