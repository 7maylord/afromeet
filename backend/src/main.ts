import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('AfroMeet API')
    .setDescription(
      'Backend for AfroMeet — per-access nanopayments, fractional ownership, and the autonomous Patron Agent (Euterpe), settled in USDC on Arc.\n\n' +
      '**Settlement chain:** Arc Testnet (chainId 5042002) · USDC `0x3600…0000`\n\n' +
      '**Agent:** ERC-8004 #839408 · Circle developer-controlled wallet on Arc + CLI wallet for x402 services',
    )
    .setVersion('1.0')
    .addTag('health', 'Liveness and readiness')
    .addTag('access', 'x402 discovery + metered streaming sessions')
    .addTag('agent', 'Euterpe — autonomous Patron Agent + ERC-8004 identity')
    .addTag('works', 'Upload, encrypt, pin, and link works to IPFS')
    .addTag('creator', 'Creator earnings and revenue data')
    .addTag('dao', 'Creator DAO governance — treasury, proposals, voting')
    .addTag('services', 'x402 paid-API marketplace — search, inspect, pay')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));

  app.enableCors({ origin: app.get(ConfigService).get<string[]>('corsOrigins') });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
