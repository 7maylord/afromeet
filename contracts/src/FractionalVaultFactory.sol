// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {FractionalVault} from "./FractionalVault.sol";

/// @title FractionalVaultFactory
/// @notice Deploys and tracks FractionalVault instances. One vault per (nft, tokenId).
contract FractionalVaultFactory {
    /// @notice nft => tokenId => vault. Zero address means not yet fractionalised.
    mapping(address nft => mapping(uint256 tokenId => address vault)) public vaultOf;
    address[] public allVaults;

    event WorkFractionalised(
        address indexed nft,
        uint256 indexed tokenId,
        address indexed curator,
        address vault,
        uint256 totalShares
    );

    /// @notice Lock `tokenId` of `nft` into a new vault and mint `totalShares` ERC-20 shares
    ///         to the caller. The caller must own the NFT and have approved this factory to
    ///         transfer it (`approve(factory, tokenId)` or `setApprovalForAll`).
    function fractionalise(
        IERC721 nft,
        uint256 tokenId,
        IERC20 revenueToken,
        uint256 totalShares,
        string calldata name_,
        string calldata symbol_
    ) external returns (address vault) {
        require(vaultOf[address(nft)][tokenId] == address(0), "already fractionalised");
        require(totalShares > 0, "shares=0");
        require(nft.ownerOf(tokenId) == msg.sender, "not owner");

        FractionalVault v =
            new FractionalVault(msg.sender, nft, tokenId, revenueToken, totalShares, name_, symbol_);
        vault = address(v);

        vaultOf[address(nft)][tokenId] = vault;
        allVaults.push(vault);

        nft.safeTransferFrom(msg.sender, vault, tokenId);

        emit WorkFractionalised(address(nft), tokenId, msg.sender, vault, totalShares);
    }

    function allVaultsLength() external view returns (uint256) {
        return allVaults.length;
    }
}
