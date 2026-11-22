const { buildAuthComposition } = require('./auth.composition');

function createQueryExecutor(dbClient) {
  return {
    async query(sql, params) {
      const result = await dbClient.query(sql, params);
      return { rows: result.rows };
    },
  };
}

async function createRuntimeAuthHarness() {
  if (!process.env.POSTGRES_URL) {
    throw new Error('POSTGRES_URL is required for runtime integration harness');
  }

  const { Client } = require('pg');
  const client = new Client({ connectionString: process.env.POSTGRES_URL });
  await client.connect();

  const composition = buildAuthComposition(createQueryExecutor(client), {
    emailVerificationSecret: process.env.EMAIL_VERIFICATION_SECRET || 'runtime-email-secret',
    jwtSigningSecret: process.env.JWT_SIGNING_SECRET || 'runtime-jwt-secret',
    verificationCallbackSecret: process.env.VERIFICATION_CALLBACK_SECRET || 'runtime-callback-secret',
    identityVerificationProviderDefault: process.env.IDENTITY_VERIFICATION_PROVIDER || 'persona',
    identityVerificationSessionTtlSeconds: Number(process.env.IDENTITY_VERIFICATION_SESSION_TTL_SECONDS || 600),
  });

  return {
    dbClient: client,
    ...composition,
    async listOutboxEventTypesForAggregate(userId) {
      const rows = await client.query(
        `SELECT event_type FROM domain_event_outbox WHERE aggregate_type = 'user' AND aggregate_id = $1 ORDER BY created_at ASC`,
        [userId],
      );
      return rows.rows.map((row) => row.event_type);
    },
  };
}

async function destroyRuntimeAuthHarness(harness) {
  if (harness?.dbClient) {
    await harness.dbClient.end();
  }
}

module.exports = {
  createRuntimeAuthHarness,
  destroyRuntimeAuthHarness,
};
