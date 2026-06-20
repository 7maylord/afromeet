// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title DAOTreasury
/// @notice Per-creator treasury that receives 1% of every access settlement in USDC. Disbursements
///         are governed by the creator's DAO (the owner) and subject to a 24h timelock between
///         queueing and execution.
contract DAOTreasury is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @dev Delay between a governance-approved disbursement being queued and being executable.
    uint256 public constant TIMELOCK = 24 hours;

    IERC20 public immutable usdc;

    struct Disbursement {
        address to;
        uint256 amount;
        uint256 eta;
        bool executed;
        bool cancelled;
    }

    Disbursement[] public disbursements;

    event DisbursementQueued(uint256 indexed id, address indexed to, uint256 amount, uint256 eta);
    event DisbursementExecuted(uint256 indexed id);
    event DisbursementCancelled(uint256 indexed id);

    /// @param usdc_ Settlement token.
    /// @param dao_  The CreatorDAO governor; becomes owner and the only address that can queue.
    constructor(IERC20 usdc_, address dao_) Ownable(dao_) {
        require(address(usdc_) != address(0), "usdc=0");
        usdc = usdc_;
    }

    /// @notice Queue a disbursement. Only the DAO (owner) can call — in practice via a passed proposal.
    function queueDisbursement(address to, uint256 amount) external onlyOwner returns (uint256 id) {
        require(to != address(0), "to=0");
        require(amount > 0, "amount=0");
        uint256 eta = block.timestamp + TIMELOCK;
        id = disbursements.length;
        disbursements.push(Disbursement({to: to, amount: amount, eta: eta, executed: false, cancelled: false}));
        emit DisbursementQueued(id, to, amount, eta);
    }

    /// @notice Execute a queued disbursement once its timelock has elapsed. Permissionless.
    function executeDisbursement(uint256 id) external nonReentrant {
        Disbursement storage d = disbursements[id];
        require(!d.executed && !d.cancelled, "not pending");
        require(block.timestamp >= d.eta, "timelocked");
        require(usdc.balanceOf(address(this)) >= d.amount, "insufficient balance");
        d.executed = true;
        usdc.safeTransfer(d.to, d.amount);
        emit DisbursementExecuted(id);
    }

    /// @notice Cancel a queued disbursement before execution. Only the DAO.
    function cancelDisbursement(uint256 id) external onlyOwner {
        Disbursement storage d = disbursements[id];
        require(!d.executed && !d.cancelled, "not pending");
        d.cancelled = true;
        emit DisbursementCancelled(id);
    }

    function balance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    function disbursementCount() external view returns (uint256) {
        return disbursements.length;
    }
}
