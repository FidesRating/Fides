import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { assertProductionConfig } from './common/production-config';
import { assertMethodology } from './rating/methodology';

async function bootstrap() {
  assertMethodology();
  assertProductionConfig(process.env);
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');

  // Explicit allowlist. Outside production an empty list allows every origin (local development only).
  const origins = process.env.CORS_ORIGINS?.split(',').map((o) => o.trim()).filter(Boolean);
  app.enableCors({
    origin: origins?.length ? origins : true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });
  app.getHttpAdapter().getInstance().set('trust proxy', 1); // real client IP behind Railway/Vercel, used for throttling
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }));
  app.enableShutdownHooks();

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  new Logger('Bootstrap').log(`FIDES backend running on port ${port}`);
}
bootstrap();
