import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ServicesService } from './services.service';

@ApiTags('services')
@Controller('services')
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  @ApiOperation({ summary: 'Search the x402 paid-API marketplace' })
  @Get('search')
  search(@Query('q') q: string, @Query('category') category?: string) {
    return this.services.search(q ?? '', category);
  }

  @ApiOperation({ summary: 'Inspect an x402 service (pricing, schema, health)' })
  @Get('inspect')
  inspect(@Query('url') url: string) {
    return this.services.inspect(url);
  }

  @ApiOperation({ summary: 'Pay an x402 endpoint from the agent BASE wallet and return its response' })
  @Post('pay')
  pay(@Body() body: { url: string; data?: unknown; method?: string }) {
    return this.services.pay(body.url, body.data, body.method);
  }
}
