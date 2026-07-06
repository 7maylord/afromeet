import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ServicesService } from './services.service';
import { OperatorGuard } from '../config/operator.guard';

@ApiTags('services')
@Controller('services')
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  @ApiOperation({ summary: 'Search the x402 paid-API marketplace' })
  @ApiQuery({ name: 'q', description: 'Search query', example: 'weather', required: false })
  @ApiQuery({ name: 'category', description: 'Filter by category', example: 'data', required: false })
  @ApiResponse({ status: 200, description: 'Array of x402 service listings with url, price, and schema' })
  @Get('search')
  search(@Query('q') q: string, @Query('category') category?: string) {
    return this.services.search(q ?? '', category);
  }

  @ApiOperation({ summary: 'Inspect an x402 service (pricing, schema, health)' })
  @ApiQuery({ name: 'url', description: 'x402 service URL to inspect', example: 'https://api.example.com/data' })
  @ApiResponse({ status: 200, description: 'Service metadata: pricing, accepted tokens, schema, health status' })
  @ApiResponse({ status: 402, description: 'Service responded with 402 — pricing info extracted from headers' })
  @Get('inspect')
  inspect(@Query('url') url: string) {
    return this.services.inspect(url);
  }

  @ApiOperation({ summary: "Pay an x402 endpoint from Euterpe's BASE wallet and return its response" })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['url'],
      properties: {
        url: { type: 'string', example: 'https://api.example.com/data', description: 'x402-protected endpoint URL' },
        method: { type: 'string', example: 'GET', default: 'GET', description: 'HTTP method' },
        data: { description: 'Request body for POST/PUT endpoints' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Service response after payment settled, plus txHash of the x402 payment' })
  @Post('pay')
  @UseGuards(OperatorGuard)
  pay(@Body() body: { url: string; data?: unknown; method?: string }) {
    return this.services.pay(body.url, body.data, body.method);
  }
}
