import { Module, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { Client } from 'pg';
import type { DbRow, QueryParam } from './db/queries/query.types';
import type { QueryExecutor } from './db/queries/auth.queries';
import { QUERY_EXECUTOR } from './db/query-executor.token';
import { AuthController } from './handlers/auth/auth.controller';
import { PostsController } from './handlers/posts/posts.controller';
import { buildAuthComposition } from './service/auth/auth.composition';
import { AuthService } from './service/auth/auth.service';
import { PostgresPostsRepository } from './service/posts/postgres-posts.repository';
import { PostsService } from './service/posts/posts.service';
import { POSTS_REPOSITORY } from './service/posts/posts.tokens';

const postgresUrl = process.env.POSTGRES_URL;
const jwtSigningSecret = process.env.JWT_SIGNING_KEY;
const emailVerificationSecret = process.env.EMAIL_VERIFICATION_SECRET;
const verificationCallbackSecret = process.env.VERIFICATION_CALLBACK_SECRET;

if (!postgresUrl || !jwtSigningSecret || !emailVerificationSecret || !verificationCallbackSecret) {
  throw new Error('Social service runtime configuration is incomplete');
}

const postgresClient = new Client({ connectionString: postgresUrl });
const queryExecutor: QueryExecutor = {
  async query<T extends DbRow>(sql: string, params: QueryParam[]): Promise<{ rows: T[] }> {
    const result = await postgresClient.query(sql, params);
    return { rows: result.rows as T[] };
  },
};

class DatabaseLifecycle implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await postgresClient.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await postgresClient.end();
  }
}

@Module({
  controllers: [AuthController, PostsController],
  providers: [
    DatabaseLifecycle,
    {
      provide: QUERY_EXECUTOR,
      useValue: queryExecutor,
    },
    {
      provide: AuthService,
      inject: [QUERY_EXECUTOR],
      useFactory: (db: QueryExecutor) => buildAuthComposition(db, {
        emailVerificationSecret,
        jwtSigningSecret,
        verificationCallbackSecret,
        identityVerificationProviderDefault: process.env.IDENTITY_VERIFICATION_PROVIDER ?? 'persona',
        identityVerificationSessionTtlSeconds: Number(process.env.IDENTITY_VERIFICATION_SESSION_TTL_SECONDS ?? 600),
      }).service,
    },
    PostgresPostsRepository,
    {
      provide: POSTS_REPOSITORY,
      useExisting: PostgresPostsRepository,
    },
    PostsService,
  ],
})
export class AppModule {}
