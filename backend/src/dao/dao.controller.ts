import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DaoService } from './dao.service';

@ApiTags('dao')
@Controller('dao')
export class DaoController {
  constructor(private readonly dao: DaoService) {}

  @ApiOperation({ summary: "A creator DAO's treasury address + USDC balance" })
  @Get(':creator/treasury')
  treasury(@Param('creator') creator: string) {
    return this.dao.treasury(creator);
  }

  @ApiOperation({ summary: "A creator DAO's proposals (state + votes), read from chain" })
  @Get(':creator/proposals')
  proposals(@Param('creator') creator: string) {
    return this.dao.proposals(creator);
  }

  @ApiOperation({ summary: 'Unsigned castVote tx for the voter to sign (uses their VIBE power)' })
  @Post(':creator/vote')
  vote(@Param('creator') creator: string, @Body() body: { proposalId: string; support: number }) {
    return this.dao.voteTx(creator, body.proposalId, body.support);
  }

  @ApiOperation({ summary: 'Unsigned propose tx for the proposer to sign' })
  @Post(':creator/propose')
  propose(
    @Param('creator') creator: string,
    @Body() body: { title: string; description: string; proposer: string },
  ) {
    return this.dao.proposeTx(creator, body.title, body.description, body.proposer);
  }
}
