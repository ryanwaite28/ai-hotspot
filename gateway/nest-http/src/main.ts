import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  if (!process.env.AUTH_SERVICE_URL && !process.env.SOCIAL_SERVICE_URL) {
    throw new Error('Missing required environment variable: AUTH_SERVICE_URL');
  }

  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('v1');
  app.enableShutdownHooks();

  const port = Number(process.env.API_PORT ?? '3000');
  await app.listen(port, '0.0.0.0');
  console.log(`HotSpot API listening on port ${port}`);
}

void bootstrap();
