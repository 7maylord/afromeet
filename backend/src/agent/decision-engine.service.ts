import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

export interface CandidateBrief {
  tokenId: string;
  creator: string;
  contentUri: string;
  /** Cumulative on-chain access revenue (USDC, 6dp) — momentum signal. */
  accessRevenueUsdc: number;
  /** Whether the work is fractionalised with shares for sale. */
  sharesAvailable: boolean;
  pricePerShareUsdc: number;
  /** Optional external research bought via an x402 service (RFB-01). */
  research?: string;
}

export interface PatronDecision {
  score: number; // 0..1
  back: boolean;
  allocationUsdc: number;
  reason: string;
}

/**
 * The judgment half of the Patron Agent. Claude scores a sampled work and decides whether — and how
 * much — to back it. All deterministic concerns (budget caps, share math, settlement) stay in code.
 */
@Injectable()
export class DecisionEngineService {
  private readonly logger = new Logger(DecisionEngineService.name);
  private readonly client: Anthropic | null;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('anthropic.apiKey');
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
    this.model = this.config.get<string>('agent.model')!;
  }

  isReady(): boolean {
    return !!this.client;
  }

  async evaluate(candidate: CandidateBrief, remainingBudgetUsdc: number): Promise<PatronDecision> {
    if (!this.client) {
      return { score: 0, back: false, allocationUsdc: 0, reason: 'ANTHROPIC_API_KEY not set' };
    }

    const maxPerWork = this.config.get<number>('agent.maxPerWorkUsdc') ?? 2;
    const prompt = `You are AfroMeet's autonomous Patron Agent, backing West African creators with a USDC budget.
Evaluate this work and decide whether to buy fractional shares.

Work:
- tokenId: ${candidate.tokenId}
- creator: ${candidate.creator}
- content: ${candidate.contentUri}
- on-chain access revenue so far: $${candidate.accessRevenueUsdc.toFixed(4)} USDC
- shares for sale: ${candidate.sharesAvailable ? `yes, $${candidate.pricePerShareUsdc} per share` : 'no'}
${candidate.research ? `- external research: ${candidate.research}` : ''}

Remaining budget: $${remainingBudgetUsdc.toFixed(2)} USDC. Max per work: $${maxPerWork}.
Favour creators with revenue momentum and room to grow. Only back works with shares for sale.

Respond ONLY with JSON: {"score": 0..1, "back": boolean, "allocationUsdc": number, "reason": "<=160 chars"}`;

    try {
      const res = await this.client.messages.create({
        model: this.model,
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      });
      const text = res.content[0]?.type === 'text' ? res.content[0].text : '';
      const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
      const parsed = JSON.parse(json) as PatronDecision;

      // Deterministic guardrails over the model's judgment.
      const cap = Math.min(maxPerWork, remainingBudgetUsdc);
      const allocationUsdc = candidate.sharesAvailable
        ? Math.max(0, Math.min(parsed.allocationUsdc ?? 0, cap))
        : 0;
      const back = !!parsed.back && candidate.sharesAvailable && allocationUsdc > 0;
      return { score: parsed.score ?? 0, back, allocationUsdc, reason: parsed.reason ?? '' };
    } catch (err) {
      this.logger.error(`evaluate failed: ${(err as Error).message}`);
      return { score: 0, back: false, allocationUsdc: 0, reason: 'evaluation error' };
    }
  }
}
