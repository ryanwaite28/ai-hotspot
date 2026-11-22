import type { QueryExecutor } from '../../db/queries/auth.queries';
import { PostgresAuthRepository } from './postgres-auth.repository';
import { PostgresPasskeyRepository } from './postgres-passkey.repository';
import { AuthService } from './auth.service';
import { StaticIdentityVerificationProviderAdapter } from './identity-verification.provider';
import { PasskeyService } from './passkey.service.js';

export interface AuthRuntimeConfig {
  emailVerificationSecret: string;
  jwtSigningSecret: string;
  verificationCallbackSecret: string;
  identityVerificationProviderDefault: string;
  identityVerificationSessionTtlSeconds: number;
}

export interface AuthComposition {
  service: AuthService;
  repository: PostgresAuthRepository;
  passkeyService: PasskeyService;
  passkeyRepository: PostgresPasskeyRepository;
}

export function buildAuthComposition(db: QueryExecutor, config: AuthRuntimeConfig): AuthComposition {
  const repository = new PostgresAuthRepository(db);
  const passkeyRepository = new PostgresPasskeyRepository(db);
  const identityVerificationProvider = new StaticIdentityVerificationProviderAdapter({
    defaultProvider: config.identityVerificationProviderDefault,
    sessionTtlSeconds: config.identityVerificationSessionTtlSeconds,
    initialStatus: 'pending',
  });
  const service = new AuthService(
    repository,
    config.emailVerificationSecret,
    config.jwtSigningSecret,
    config.verificationCallbackSecret,
  );
  const passkeyService = new PasskeyService(passkeyRepository, service);

  return {
    service,
    repository,
    passkeyService,
    passkeyRepository,
  };
}
