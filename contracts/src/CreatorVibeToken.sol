// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";

/// @title CreatorVibeToken
/// @notice Per-creator ERC-20 governance token with on-chain voting power. One token contract is
///         auto-deployed per creator by AfroMeetNFT; fans holding it vote only in that creator's DAO.
/// @dev    Minting is restricted to the controller (the AfroMeetNFT contract), which distributes a
///         fixed reward per work mint.
contract CreatorVibeToken is ERC20, ERC20Permit, ERC20Votes {
    address public immutable controller;

    event TokensDistributed(address indexed to, uint256 amount, string reason);

    modifier onlyController() {
        require(msg.sender == controller, "not controller");
        _;
    }

    constructor(string memory name_, string memory symbol_, address controller_)
        ERC20(name_, symbol_)
        ERC20Permit(name_)
    {
        require(controller_ != address(0), "controller=0");
        controller = controller_;
    }

    function distributeTokens(address to, uint256 amount, string calldata reason) external onlyController {
        _mint(to, amount);
        emit TokensDistributed(to, amount, reason);
    }

    // --- Required overrides (ERC20Votes + ERC20Permit) ------------------------

    function _update(address from, address to, uint256 value) internal override(ERC20, ERC20Votes) {
        super._update(from, to, value);
    }

    function nonces(address owner) public view override(ERC20Permit, Nonces) returns (uint256) {
        return super.nonces(owner);
    }
}
