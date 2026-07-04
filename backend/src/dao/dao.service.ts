import { Injectable, NotFoundException } from '@nestjs/common';
import { ethers } from 'ethers';
import { BlockchainService } from '../blockchain/blockchain.service';

// IGovernor.ProposalState → client-facing status.
function mapState(state: number): string {
  switch (state) {
    case 1:
      return 'Active';
    case 3:
      return 'Defeated';
    case 4:
    case 5:
      return 'Succeeded';
    case 7:
      return 'Executed';
    default:
      return 'Active';
  }
}

/**
 * Reads a creator's DAO (treasury + proposals) from chain, and builds the unsigned governance
 * transactions for the client to sign with the *voter's* wallet (so votes use their VIBE power —
 * the backend never votes on a user's behalf).
 */
@Injectable()
export class DaoService {
  constructor(private readonly blockchain: BlockchainService) {}

  async treasury(creator: string) {
    const eco = await this.blockchain.ecosystemOf(creator);
    if (!eco.exists) return { dao: null, treasury: null, token: null, balance: '0' };
    const balance = await this.blockchain.usdcBalanceOf(eco.treasury);
    // eco.token is the creator's VIBE governance token — the client reads the voter's balance from it.
    return { dao: eco.dao, treasury: eco.treasury, token: eco.token, balance: balance.toString() };
  }

  async proposals(creator: string) {
    const eco = await this.blockchain.ecosystemOf(creator);
    if (!eco.exists) return [];
    const raw = await this.blockchain.getProposals(eco.dao);
    return raw.map((p) => ({
      id: p.proposalId,
      title: p.description.split('\n')[0],
      description: p.description,
      status: mapState(p.state),
      votesFor: Number(ethers.formatUnits(p.forVotes, 18)),
      votesAgainst: Number(ethers.formatUnits(p.againstVotes, 18)),
      endTime: `block ${p.deadline}`,
    }));
  }

  /** Unsigned castVote tx for the client to sign with the voter's wallet. */
  async voteTx(creator: string, proposalId: string, support: number) {
    const eco = await this.blockchain.ecosystemOf(creator);
    if (!eco.exists) throw new NotFoundException('No DAO for this creator');
    return { to: eco.dao, data: this.blockchain.encodeCastVote(proposalId, support) };
  }

  /** Unsigned propose tx (a sample 1-USDC treasury disbursement to the proposer). */
  async proposeTx(creator: string, title: string, description: string, proposer: string) {
    const eco = await this.blockchain.ecosystemOf(creator);
    if (!eco.exists) throw new NotFoundException('No DAO for this creator');
    const fullDescription = `${title}\n\n${description}`;
    const disburse = this.blockchain.encodeQueueDisbursement(proposer, 1_000_000n); // 1 USDC sample
    const data = this.blockchain.encodePropose([eco.treasury], [0n], [disburse], fullDescription);
    return { to: eco.dao, data };
  }
}
