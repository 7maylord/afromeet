// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Governor} from "@openzeppelin/contracts/governance/Governor.sol";
import {GovernorSettings} from "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";
import {GovernorCountingSimple} from "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import {GovernorVotes} from "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import {GovernorVotesQuorumFraction} from
    "@openzeppelin/contracts/governance/extensions/GovernorVotesQuorumFraction.sol";
import {IVotes} from "@openzeppelin/contracts/governance/utils/IVotes.sol";

/// @title CreatorDAO
/// @notice Per-creator, isolated on-chain DAO. Fans holding the creator's CreatorVibeToken vote
///         only here. Quorum is 4% of the creator's token supply. Proposals drive treasury
///         disbursements (DAOTreasury) funded by 1% of access revenue.
contract CreatorDAO is
    Governor,
    GovernorSettings,
    GovernorCountingSimple,
    GovernorVotes,
    GovernorVotesQuorumFraction
{
    /// @param token_ The creator's CreatorVibeToken (must implement IVotes).
    constructor(IVotes token_)
        Governor("CreatorDAO")
        GovernorSettings(
            1 /* voting delay: 1 block */,
            50_400 /* voting period: ~1 week */,
            1e18 /* proposal threshold: must hold >= 1 token to propose (anti-spam) */
        )
        GovernorVotes(token_)
        GovernorVotesQuorumFraction(4)
    {}

    // --- Required overrides ---------------------------------------------------

    function votingDelay() public view override(Governor, GovernorSettings) returns (uint256) {
        return super.votingDelay();
    }

    function votingPeriod() public view override(Governor, GovernorSettings) returns (uint256) {
        return super.votingPeriod();
    }

    function proposalThreshold() public view override(Governor, GovernorSettings) returns (uint256) {
        return super.proposalThreshold();
    }

    function quorum(uint256 timepoint)
        public
        view
        override(Governor, GovernorVotesQuorumFraction)
        returns (uint256)
    {
        return super.quorum(timepoint);
    }
}
