// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IVotes} from "@openzeppelin/contracts/governance/utils/IVotes.sol";
import {CreatorDAO} from "./CreatorDAO.sol";

/// @title CreatorDAOFactory
/// @notice Deploys CreatorDAO (OpenZeppelin Governor) instances on behalf of AfroMeetNFT.
/// @dev    Extracted so AfroMeetNFT stays under the EIP-170 24KB code-size limit — the Governor's
///         creation bytecode is too large to embed in the NFT contract via inline `new`.
contract CreatorDAOFactory {
    function createDAO(IVotes token) external returns (address) {
        return address(new CreatorDAO(token));
    }
}
