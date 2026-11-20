import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { assertProductionConfig, isPrelaunch } from './common/production-config';
import { assertDemoConfig } from './common/demo-config';
import { assertMethodology } from './rating/methodology';

async function bootstrap() {
  assertMethodology();
  assertProductionConfig(process.env);
  assertDemoConfig(process.env);
  if (process.env.X_OAUTH_MOCK === 'true') new Logger('Bootstrap').warn('X_OAUTH_MOCK is on: Login with X is replaced by a local demo login. Local demos only.');
  if (isPrelaunch()) {
    new Logger('Bootstrap').warn('PRELAUNCH_MODE is on: ratings can be published without the 48 hour notice. Remove PRELAUNCH_MODE before launch.');
  }
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
