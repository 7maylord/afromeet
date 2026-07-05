// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AfroMeetNFT} from "../src/AfroMeetNFT.sol";
import {CreatorDAOFactory} from "../src/CreatorDAOFactory.sol";
import {SplitResolver} from "../src/SplitResolver.sol";
import {AccessRegistry} from "../src/AccessRegistry.sol";
import {AccessEscrow} from "../src/AccessEscrow.sol";
import {AfroMeetRoyalty} from "../src/AfroMeetRoyalty.sol";
import {AfroMeetMarketplace} from "../src/AfroMeetMarketplace.sol";
import {FractionalVaultFactory} from "../src/FractionalVaultFactory.sol";
import {IAfroMeetNFT} from "../src/interfaces/IAfroMeetNFT.sol";
import {IFractionalVaultFactory} from "../src/interfaces/IFractionalVaultFactory.sol";

/// @notice Deploys and wires the full AfroMeet contract suite.
/// @dev    Env: USDC_ADDRESS (required), OPERATOR_ADDRESS and CULTURAL_POOL_ADDRESS (optional,
///         default to the broadcaster). DAOTreasury/CreatorVibeToken/CreatorDAO are not deployed
///         here — AfroMeetNFT auto-deploys one set per creator on their first mint.
///
///         Deploy order is dependency-driven: AfroMeetNFT first (the split/registry/royalty layers
///         take its address), then the access layer, then marketplace and the fractional factory.
contract DeployAfroMeet is Script {
    /// @dev Arc's system USDC token, used as the default settlement/revenue token.
    address constant ARC_USDC = 0x3600000000000000000000000000000000000000;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);

        address usdc = vm.envOr("USDC_ADDRESS", ARC_USDC);
        address operator = vm.envOr("OPERATOR_ADDRESS", deployer);
        address culturalPool = vm.envOr("CULTURAL_POOL_ADDRESS", deployer);

        vm.startBroadcast(pk);

        CreatorDAOFactory daoFactory = new CreatorDAOFactory();
        AfroMeetNFT nft = new AfroMeetNFT(IERC20(usdc), daoFactory);
        SplitResolver splits = new SplitResolver(IAfroMeetNFT(address(nft)));
        AccessRegistry registry = new AccessRegistry(IAfroMeetNFT(address(nft)));
        AfroMeetRoyalty royalty = new AfroMeetRoyalty(IAfroMeetNFT(address(nft)));
        // Vault factory is deployed before the escrow so the escrow can route curators' splits to
        // their vaults at settlement (the factory has no dependency back on the escrow).
        FractionalVaultFactory vaultFactory = new FractionalVaultFactory();
        AccessEscrow escrow = new AccessEscrow(
            IERC20(usdc), registry, splits, IFractionalVaultFactory(address(vaultFactory)), operator
        );
        splits.setEscrow(address(escrow));
        AfroMeetMarketplace marketplace =
            new AfroMeetMarketplace(nft, IERC20(usdc), royalty, culturalPool);

        vm.stopBroadcast();

        console2.log("USDC            ", usdc);
        console2.log("AfroMeetNFT     ", address(nft));
        console2.log("SplitResolver   ", address(splits));
        console2.log("AccessRegistry  ", address(registry));
        console2.log("AfroMeetRoyalty ", address(royalty));
        console2.log("AccessEscrow    ", address(escrow));
        console2.log("Marketplace     ", address(marketplace));
        console2.log("VaultFactory    ", address(vaultFactory));
        console2.log("Operator        ", operator);
        console2.log("CulturalPool    ", culturalPool);
    }
}
