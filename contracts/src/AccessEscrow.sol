// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {AccessRegistry} from "./AccessRegistry.sol";
import {SplitResolver} from "./SplitResolver.sol";

/// @title AccessEscrow
/// @notice Settles per-access payments. The operator (backend) opens a session against a listener's
///         pre-authorised USDC allowance (modelling Circle Gateway / EIP-3009), then settles it: 1%
///         to the work's DAO treasury and the remainder split per SplitResolver. On-chain this pulls
///         USDC via the listener's allowance; on Arc the same calls are fed by Gateway batch settlement.
contract AccessEscrow is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice DAO treasury cut, in basis points (1%).
    uint256 public constant DAO_BPS = 100;

    IERC20 public immutable usdc;
    AccessRegistry public immutable registry;
    SplitResolver public immutable splits;

    struct Session {
        address listener;
        uint256 tokenId;
        uint256 authorisedAmount;
        bool settled;
    }

    mapping(bytes32 sessionId => Session) public sessions;

    event SessionOpened(bytes32 indexed sessionId, address indexed listener, uint256 indexed tokenId, uint256 authorised);
    event Settled(bytes32 indexed sessionId, uint256 indexed tokenId, uint256 amount, uint256 daoCut);

    constructor(IERC20 usdc_, AccessRegistry registry_, SplitResolver splits_, address operator)
        Ownable(operator)
    {
        usdc = usdc_;
        registry = registry_;
        splits = splits_;
    }

    /// @notice Open a metered session. Operator-only. The listener must have approved this escrow
    ///         for at least `authorisedAmount` USDC.
    function openSession(bytes32 sessionId, address listener, uint256 tokenId, uint256 authorisedAmount)
        external
        onlyOwner
    {
        require(sessions[sessionId].listener == address(0), "session exists");
        require(listener != address(0), "listener=0");
        sessions[sessionId] = Session({
            listener: listener,
            tokenId: tokenId,
            authorisedAmount: authorisedAmount,
            settled: false
        });
        emit SessionOpened(sessionId, listener, tokenId, authorisedAmount);
    }

    /// @notice Settle a session: charge the holder rate and distribute it. Operator-only.
    /// @dev    The TIMED min-duration threshold is enforced by the operator (it only calls settle
    ///         once met); the contract enforces the economic invariants.
    function settle(bytes32 sessionId) external onlyOwner nonReentrant {
        Session storage s = sessions[sessionId];
        require(s.listener != address(0), "no session");
        require(!s.settled, "already settled");

        AccessRegistry.AccessConfig memory cfg = registry.getConfig(s.tokenId);
        require(cfg.active, "inactive");
        uint256 price = cfg.pricePerAccess;
        require(price > 0, "price=0");
        require(price <= s.authorisedAmount, "exceeds authorised");

        SplitResolver.Split[] memory recipients = splits.getSplits(s.tokenId);
        require(recipients.length > 0, "no splits");

        s.settled = true;

        // Lock splits on first settlement for this work.
        if (!splits.locked(s.tokenId)) {
            splits.lockSplits(s.tokenId);
        }

        // Pull the listener's pre-authorised USDC into the escrow.
        usdc.safeTransferFrom(s.listener, address(this), price);

        // 1% to the DAO treasury — only skimmed when one is configured, otherwise the full price
        // flows to the split recipients (never left stranded in the escrow).
        uint256 daoCut;
        if (cfg.daoTreasury != address(0)) {
            daoCut = (price * DAO_BPS) / 10000;
            if (daoCut > 0) usdc.safeTransfer(cfg.daoTreasury, daoCut);
        }

        // Remainder split per basis points; the last recipient absorbs rounding dust.
        uint256 remainder = price - daoCut;
        uint256 distributed;
        uint256 last = recipients.length - 1;
        for (uint256 i; i <= last; ++i) {
            uint256 amount =
                i == last ? remainder - distributed : (remainder * recipients[i].basisPoints) / 10000;
            distributed += amount;
            usdc.safeTransfer(recipients[i].recipient, amount);
        }

        emit Settled(sessionId, s.tokenId, price, daoCut);
    }
}
