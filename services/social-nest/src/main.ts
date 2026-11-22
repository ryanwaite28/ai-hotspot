import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const requiredSecrets = [
    'POSTGRES_URL',
    'JWT_SIGNING_KEY',
    'EMAIL_VERIFICATION_SECRET',
    'VERIFICATION_CALLBACK_SECRET',
  ] as const;

  for (const secretName of requiredSecrets) {
    if (!process.env[secretName]) {
      throw new Error(`Missing required environment variable: ${secretName}`);
    }
  }

  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  const port = Number(process.env.SOCIAL_SERVICE_PORT ?? '3001');
  await app.listen(port, '127.0.0.1');
  console.log(`Social service listening on port ${port}`);
}

void bootstrap();
