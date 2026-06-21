import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('AfroMeet API')
    .setDescription(
      'Backend for AfroMeet — per-access nanopayments, fractional ownership, and the autonomous Patron Agent, settled in USDC on Arc.',
    )
    .setVersion('1.0')
    .addTag('health')
    .addTag('access', 'x402 discovery + metered streaming sessions')
    .addTag('agent', 'Autonomous Patron Agent + ERC-8004 identity')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
