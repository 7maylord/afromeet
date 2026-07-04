import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DaoService } from './dao.service';

@ApiTags('dao')
@Controller('dao')
export class DaoController {
  constructor(private readonly dao: DaoService) {}

  @ApiOperation({ summary: "A creator DAO's treasury address + USDC balance" })
  @ApiParam({ name: 'creator', description: 'Creator wallet address (0x…)', example: '0xAbCd…' })
  @ApiResponse({
    status: 200,
    description: 'treasury: DAO treasury address, balance: USDC balance in raw units (6dp)',
  })
  @Get(':creator/treasury')
  treasury(@Param('creator') creator: string) {
    return this.dao.treasury(creator);
  }

  @ApiOperation({ summary: "A creator DAO's proposals (state + votes), read from chain" })
  @ApiParam({ name: 'creator', description: 'Creator wallet address (0x…)', example: '0xAbCd…' })
  @ApiResponse({
    status: 200,
    description: 'Array of proposals: id, title, description, state (Pending/Active/Succeeded/Executed/Defeated), forVotes, againstVotes',
  })
  @Get(':creator/proposals')
  proposals(@Param('creator') creator: string) {
    return this.dao.proposals(creator);
  }

  @ApiOperation({ summary: 'Unsigned castVote tx for the voter to sign (uses their VIBE governance power)' })
  @ApiParam({ name: 'creator', description: 'Creator wallet address (0x…)', example: '0xAbCd…' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['proposalId', 'support'],
      properties: {
        proposalId: { type: 'string', example: '1', description: 'Proposal ID (from proposals list)' },
        support: { type: 'number', example: 1, description: '0 = Against, 1 = For, 2 = Abstain' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Unsigned tx object — sign and broadcast from the voter\'s Privy wallet' })
  @Post(':creator/vote')
  vote(@Param('creator') creator: string, @Body() body: { proposalId: string; support: number }) {
    return this.dao.voteTx(creator, body.proposalId, body.support);
  }

  @ApiOperation({ summary: 'Unsigned propose tx for the proposer to sign' })
  @ApiParam({ name: 'creator', description: 'Creator wallet address (0x…)', example: '0xAbCd…' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['title', 'description', 'proposer'],
      properties: {
        title: { type: 'string', example: 'Raise royalty split to 90%' },
        description: { type: 'string', example: 'Proposal to update the creator royalty from 85% to 90%.' },
        proposer: { type: 'string', example: '0xAbCd…', description: 'Proposer wallet address (must hold VIBE above threshold)' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Unsigned tx object — sign and broadcast from the proposer\'s Privy wallet' })
  @Post(':creator/propose')
  propose(
    @Param('creator') creator: string,
    @Body() body: { title: string; description: string; proposer: string },
  ) {
    return this.dao.proposeTx(creator, body.title, body.description, body.proposer);
  }
}
