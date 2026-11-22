import { Module } from '@nestjs/common';
import { AUTH_SERVICE_BASE_URL, AuthServiceClient } from './clients/auth-service.client';
import { AuthController } from './handlers/auth/auth.controller';
import { HealthController } from './handlers/health/health.controller';

const authServiceUrl = process.env.AUTH_SERVICE_URL ?? process.env.SOCIAL_SERVICE_URL;
if (!authServiceUrl) {
  throw new Error('Missing required environment variable: AUTH_SERVICE_URL');
}

@Module({
  controllers: [AuthController, HealthController],
  providers: [
    {
      provide: AUTH_SERVICE_BASE_URL,
      useValue: authServiceUrl,
    },
    AuthServiceClient,
  ],
})
export class AppModule {}
