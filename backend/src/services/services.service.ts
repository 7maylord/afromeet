import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

export interface ServiceListing {
  resource: string;
  metadata?: { description?: string; category?: string; provider?: { name?: string } };
  accepts?: { network?: string; asset?: string; amount?: string }[];
}

/**
 * x402 services leg — wraps the Circle CLI (`circle services search|inspect|pay`) so the Patron
 * Agent can autonomously discover, evaluate, and pay for external paywalled APIs (RFB-01).
 * The CLI signs with the agent's BASE wallet; the marketplace settles in USDC on BASE.
 */
@Injectable()
export class ServicesService {
  private readonly logger = new Logger(ServicesService.name);

  constructor(private readonly config: ConfigService) {}

  /** Configured only when a BASE services wallet is set. */
  isEnabled(): boolean {
    return !!this.config.get<string>('services.walletAddress');
  }

  private async circle(args: string[]): Promise<unknown> {
    const { stdout } = await exec('circle', args, { maxBuffer: 10 * 1024 * 1024 });
    return JSON.parse(stdout);
  }

  /** Search the x402 marketplace. */
  async search(query: string, category?: string, limit = 5): Promise<ServiceListing[]> {
    const args = ['services', 'search', query, '--output', 'json', '--limit', String(limit)];
    if (category) args.push('--category', category);
    const res = (await this.circle(args)) as { data?: { items?: ServiceListing[] } };
    return res.data?.items ?? [];
  }

  /** Inspect a service's pricing/schema/health. */
  async inspect(url: string): Promise<unknown> {
    return this.circle(['services', 'inspect', url, '--output', 'json']);
  }

  /** Pay an x402 endpoint and return its response. Refuses to overpay via --max-amount. */
  async pay(url: string, data?: unknown, method = 'POST'): Promise<unknown> {
    const wallet = this.config.get<string>('services.walletAddress');
    const chain = this.config.get<string>('services.chain')!;
    const maxUsdc = this.config.get<number>('services.maxUsdc')!;
    if (!wallet) throw new Error('CIRCLE_SERVICES_WALLET not configured');

    const args = [
      'services', 'pay', url,
      '--address', wallet,
      '--chain', chain,
      '--max-amount', String(maxUsdc),
      '--output', 'json',
    ];
    if (data !== undefined) args.push('-X', method, '-d', JSON.stringify(data));
    return this.circle(args);
  }

  /**
   * Convenience for the agent: find a web-research service within budget and pay it to research a
   * query. Best-effort — returns null (never throws into the loop) if nothing usable or payment fails.
   */
  async research(query: string): Promise<unknown | null> {
    if (!this.isEnabled()) return null;
    try {
      const maxRaw = BigInt(Math.floor(this.config.get<number>('services.maxUsdc')! * 1e6));
      // Only pick services that accept on our configured chain (avoids a chain-mismatch payment).
      const caip2: Record<string, string> = { BASE: 'eip155:8453', 'BASE-SEPOLIA': 'eip155:84532' };
      const network = caip2[this.config.get<string>('services.chain')!];
      // Prefer dedicated web research; fall back to any affordable on-chain service.
      const items = [
        ...(await this.search('web search', 'WEB_SEARCH_RESEARCH', 5)),
        ...(await this.search(query, undefined, 10)),
      ];
      const affordable = items.find((i) =>
        i.accepts?.some(
          (a) => a.network === network && a.amount !== undefined && BigInt(a.amount) <= maxRaw,
        ),
      );
      if (!affordable) {
        this.logger.warn('No affordable research service found');
        return null;
      }
      this.logger.log(`Paying research service ${affordable.resource}`);
      return await this.pay(affordable.resource, { query });
    } catch (err) {
      this.logger.warn(`research failed: ${(err as Error).message}`);
      return null;
    }
  }
}
