import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';

@Injectable()
export class OperatorGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('operatorApiKey');
    const supplied = context.switchToHttp().getRequest<{ headers: Record<string, string> }>()
      .headers['x-operator-key'];
    if (!expected || !supplied) throw new UnauthorizedException('operator key required');
    const a = Buffer.from(expected);
    const b = Buffer.from(supplied);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new UnauthorizedException('invalid operator key');
    return true;
  }
}
