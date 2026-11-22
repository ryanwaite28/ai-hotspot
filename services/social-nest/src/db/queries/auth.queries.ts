import type { DbRow, QueryParam } from './query.types';

export interface QueryExecutor {
  query<T extends DbRow>(sql: string, params: QueryParam[]): Promise<{ rows: T[] }>;
}

export interface UserRow extends DbRow {
  id: string;
  handle: string;
  email: string;
  display_name: string;
  password_hash: string;
  status: 'pending_verification' | 'active' | 'suspended' | 'deactivated' | 'deleted';
  role: 'user' | 'moderator' | 'admin';
  flagged_for_review: boolean;
  flagged_reason: string | null;
  trial_activated_once: boolean;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  export_requested_at: string | null;
  deactivated_at: string | null;
}

export interface AuthSessionRow extends DbRow {
  user_id: string;
  revoked_at: string | null;
  expires_at: string;
}

export interface VerificationSessionLookupRow extends DbRow {
  id: string;
  user_id: string;
  status: 'pending' | 'in_review' | 'approved' | 'rejected' | 'expired';
}

export interface VerificationSessionInsertRow extends DbRow {
  id: string;
  status: 'pending' | 'in_review' | 'approved' | 'rejected' | 'expired';
  provider_session_ref: string | null;
}

export interface PasskeyCredentialRow extends DbRow {
  user_id: string;
  credential_id: string;
  sign_count: string | number;
  revoked_at: string | null;
}

export interface OutboxInsertRow extends DbRow {
  id: string;
}

export const authQueries = {
  selectUserById: `
    SELECT id, handle, email, display_name, password_hash, status, role, flagged_for_review, flagged_reason,
      trial_activated_once, trial_started_at, trial_ends_at, export_requested_at, deactivated_at
    FROM users
    WHERE id = $1
    LIMIT 1
  `,
  selectUserByEmail: `
    SELECT id, handle, email, display_name, password_hash, status, role, flagged_for_review, flagged_reason,
      trial_activated_once, trial_started_at, trial_ends_at, export_requested_at, deactivated_at
    FROM users
    WHERE lower(email) = lower($1)
    LIMIT 1
  `,
  insertPendingUserWithOutbox: `
    WITH inserted_user AS (
      INSERT INTO users (handle, display_name, email, password_hash, status, role)
      VALUES ($1, $2, $3, $4, 'pending_verification', 'user')
      RETURNING id, handle, email, display_name, password_hash, status, role, flagged_for_review, flagged_reason,
        trial_activated_once, trial_started_at, trial_ends_at, export_requested_at, deactivated_at
    ),
    inserted_outbox AS (
      INSERT INTO domain_event_outbox (
        event_id,
        aggregate_type,
        aggregate_id,
        aggregate_version,
        event_type,
        payload,
        headers,
        occurred_at
      )
      SELECT
        $5,
        'user',
        iu.id,
        1,
        'user.created',
        jsonb_build_object(
          'userId', iu.id,
          'handle', iu.handle,
          'email', iu.email,
          'status', iu.status,
          'role', iu.role
        ),
        jsonb_build_object(
          'schemaVersion', 1,
          'producer', 'hotspot-api'
        ),
        to_timestamp($6)
      FROM inserted_user iu
      RETURNING id
    )
    SELECT id, handle, email, display_name, password_hash, status, role, flagged_for_review, flagged_reason,
      trial_activated_once, trial_started_at, trial_ends_at, export_requested_at, deactivated_at
    FROM inserted_user
  `,
  insertUserEmailResetRequestedOutbox: `
    INSERT INTO domain_event_outbox (
      event_id,
      aggregate_type,
      aggregate_id,
      aggregate_version,
      event_type,
      payload,
      headers,
      occurred_at
    )
    VALUES (
      $1,
      'user',
      $2,
      NULL,
      'user.email-reset-requested',
      jsonb_build_object(
        'userId', $2,
        'email', $3
      ),
      jsonb_build_object(
        'schemaVersion', 1,
        'producer', 'hotspot-api'
      ),
      to_timestamp($4)
    )
    ON CONFLICT (event_id) DO NOTHING
    RETURNING id
  `,
  insertAuthSession: `
    INSERT INTO auth_sessions (user_id, refresh_token_id, expires_at)
    VALUES ($1, $2, to_timestamp($3))
  `,
  selectAuthSessionByRefreshTokenId: `
    SELECT user_id, revoked_at, expires_at
    FROM auth_sessions
    WHERE refresh_token_id = $1
    LIMIT 1
  `,
  revokeAuthSessionByRefreshTokenId: `
    UPDATE auth_sessions
    SET revoked_at = NOW()
    WHERE refresh_token_id = $1
  `,
  activateUserByVerification: `
    WITH matched AS (
      SELECT id, handle, email, display_name, password_hash, status
      , role, flagged_for_review, flagged_reason, trial_activated_once, trial_started_at, trial_ends_at, export_requested_at, deactivated_at
      FROM users
      WHERE id = $1 AND lower(email) = lower($2)
    ),
    updated AS (
      UPDATE users
      SET status = 'active', updated_at = NOW()
      WHERE id IN (SELECT id FROM matched WHERE status = 'pending_verification')
      RETURNING id, handle, email, display_name, password_hash, status, role, flagged_for_review, flagged_reason,
        trial_activated_once, trial_started_at, trial_ends_at, export_requested_at, deactivated_at
    )
    SELECT id, handle, email, display_name, password_hash, status, role, flagged_for_review, flagged_reason,
      trial_activated_once, trial_started_at, trial_ends_at, export_requested_at, deactivated_at FROM updated
    UNION ALL
    SELECT id, handle, email, display_name, password_hash, status, role, flagged_for_review, flagged_reason,
      trial_activated_once, trial_started_at, trial_ends_at, export_requested_at, deactivated_at
    FROM matched
    WHERE status = 'active' AND NOT EXISTS (SELECT 1 FROM updated)
    LIMIT 1
  `,
  insertVerificationCallbackEvent: `
    INSERT INTO verification_callback_events (
      provider,
      event_id,
      user_id,
      provider_session_ref,
      status,
      payload_hash
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (provider, event_id) DO NOTHING
    RETURNING id
  `,
  selectVerificationSessionByProviderRef: `
    SELECT id, user_id, status
    FROM verification_sessions
    WHERE provider = $1 AND provider_session_ref = $2 AND user_id = $3
    LIMIT 1
  `,
  updateVerificationSessionStatus: `
    UPDATE verification_sessions
    SET status = $2, failure_code = $3, updated_at = NOW()
    WHERE id = $1
  `,
  updateUserIdentityVerificationStatus: `
    UPDATE users
    SET
      identity_verification_status = $2,
      identity_verification_ref = $3,
      status = CASE
        WHEN $2 = 'approved' AND status = 'pending_verification' THEN 'active'
        ELSE status
      END,
      updated_at = NOW()
    WHERE id = $1
    RETURNING id, handle, email, display_name, password_hash, status, role, flagged_for_review, flagged_reason,
      trial_activated_once, trial_started_at, trial_ends_at, export_requested_at, deactivated_at
  `,
  updateUserProfileWithOutbox: `
    WITH updated_user AS (
      UPDATE users
      SET
        handle = COALESCE($2, handle),
        display_name = COALESCE($3, display_name),
        updated_at = NOW()
      WHERE id = $1
      RETURNING id, handle, email, display_name, password_hash, status, role, flagged_for_review, flagged_reason,
        trial_activated_once, trial_started_at, trial_ends_at, export_requested_at, deactivated_at
    ),
    inserted_outbox AS (
      INSERT INTO domain_event_outbox (
        event_id,
        aggregate_type,
        aggregate_id,
        aggregate_version,
        event_type,
        payload,
        headers,
        occurred_at
      )
      SELECT
        $4,
        'user',
        uu.id,
        NULL,
        'user.updated',
        jsonb_build_object(
          'userId', uu.id,
          'handle', uu.handle,
          'displayName', uu.display_name,
          'status', uu.status,
          'role', uu.role,
          'flaggedForReview', uu.flagged_for_review,
          'flaggedReason', uu.flagged_reason
        ),
        jsonb_build_object(
          'schemaVersion', 1,
          'producer', 'hotspot-api'
        ),
        to_timestamp($5)
      FROM updated_user uu
      RETURNING id
    )
    SELECT id, handle, email, display_name, password_hash, status, role, flagged_for_review, flagged_reason,
      trial_activated_once, trial_started_at, trial_ends_at, export_requested_at, deactivated_at
    FROM updated_user
  `,
  suspendUserWithOutbox: `
    WITH updated_user AS (
      UPDATE users
      SET status = 'suspended', deactivated_at = NOW(), updated_at = NOW()
      WHERE id = $1
      RETURNING id, handle, email, display_name, password_hash, status, role, flagged_for_review, flagged_reason,
        trial_activated_once, trial_started_at, trial_ends_at, export_requested_at, deactivated_at
    ),
    inserted_outbox AS (
      INSERT INTO domain_event_outbox (
        event_id,
        aggregate_type,
        aggregate_id,
        aggregate_version,
        event_type,
        payload,
        headers,
        occurred_at
      )
      SELECT
        $2,
        'user',
        uu.id,
        NULL,
        'user.suspended',
        jsonb_build_object(
          'userId', uu.id,
          'status', uu.status
        ),
        jsonb_build_object(
          'schemaVersion', 1,
          'producer', 'hotspot-api'
        ),
        to_timestamp($3)
      FROM updated_user uu
      RETURNING id
    )
    SELECT id, handle, email, display_name, password_hash, status, role, flagged_for_review, flagged_reason,
      trial_activated_once, trial_started_at, trial_ends_at, export_requested_at, deactivated_at
    FROM updated_user
  `,
  flagUserForReviewWithOutbox: `
    WITH updated_user AS (
      UPDATE users
      SET flagged_for_review = TRUE, flagged_reason = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING id, handle, email, display_name, password_hash, status, role, flagged_for_review, flagged_reason,
        trial_activated_once, trial_started_at, trial_ends_at, export_requested_at, deactivated_at
    ),
    inserted_outbox AS (
      INSERT INTO domain_event_outbox (
        event_id,
        aggregate_type,
        aggregate_id,
        aggregate_version,
        event_type,
        payload,
        headers,
        occurred_at
      )
      SELECT
        $3,
        'user',
        uu.id,
        NULL,
        'user.flagged',
        jsonb_build_object(
          'userId', uu.id,
          'flaggedForReview', uu.flagged_for_review,
          'flaggedReason', uu.flagged_reason
        ),
        jsonb_build_object(
          'schemaVersion', 1,
          'producer', 'hotspot-api'
        ),
        to_timestamp($4)
      FROM updated_user uu
      RETURNING id
    )
    SELECT id, handle, email, display_name, password_hash, status, role, flagged_for_review, flagged_reason,
      trial_activated_once, trial_started_at, trial_ends_at, export_requested_at, deactivated_at
    FROM updated_user
  `,
  activateTrialEntitlementOnceWithOutbox: `
    WITH updated_user AS (
      UPDATE users
      SET
        trial_activated_once = TRUE,
        trial_started_at = NOW(),
        trial_ends_at = NOW() + make_interval(secs => $2),
        updated_at = NOW()
      WHERE id = $1 AND trial_activated_once = FALSE AND status = 'active'
      RETURNING id, handle, email, display_name, password_hash, status, role, flagged_for_review, flagged_reason,
        trial_activated_once, trial_started_at, trial_ends_at, export_requested_at, deactivated_at
    ),
    inserted_outbox AS (
      INSERT INTO domain_event_outbox (
        event_id,
        aggregate_type,
        aggregate_id,
        aggregate_version,
        event_type,
        payload,
        headers,
        occurred_at
      )
      SELECT
        $3,
        'user',
        uu.id,
        NULL,
        'user.trial-activated',
        jsonb_build_object(
          'userId', uu.id,
          'trialStartedAt', uu.trial_started_at,
          'trialEndsAt', uu.trial_ends_at
        ),
        jsonb_build_object(
          'schemaVersion', 1,
          'producer', 'hotspot-api'
        ),
        to_timestamp($4)
      FROM updated_user uu
      RETURNING id
    )
    SELECT id, handle, email, display_name, password_hash, status, role, flagged_for_review, flagged_reason,
      trial_activated_once, trial_started_at, trial_ends_at, export_requested_at, deactivated_at
    FROM updated_user
  `,
  requestAccountExportWithOutbox: `
    WITH updated_user AS (
      UPDATE users
      SET export_requested_at = COALESCE(export_requested_at, NOW()), updated_at = NOW()
      WHERE id = $1
      RETURNING id, handle, email, display_name, password_hash, status, role, flagged_for_review, flagged_reason,
        trial_activated_once, trial_started_at, trial_ends_at, export_requested_at, deactivated_at
    ),
    inserted_outbox AS (
      INSERT INTO domain_event_outbox (
        event_id,
        aggregate_type,
        aggregate_id,
        aggregate_version,
        event_type,
        payload,
        headers,
        occurred_at
      )
      SELECT
        $2,
        'user',
        uu.id,
        NULL,
        'user.export-requested',
        jsonb_build_object(
          'userId', uu.id,
          'exportRequestedAt', uu.export_requested_at
        ),
        jsonb_build_object(
          'schemaVersion', 1,
          'producer', 'hotspot-api'
        ),
        to_timestamp($3)
      FROM updated_user uu
      RETURNING id
    )
    SELECT id, handle, email, display_name, password_hash, status, role, flagged_for_review, flagged_reason,
      trial_activated_once, trial_started_at, trial_ends_at, export_requested_at, deactivated_at
    FROM updated_user
  `,
  deactivateUserWithOutbox: `
    WITH updated_user AS (
      UPDATE users
      SET status = 'deactivated', deactivated_at = NOW(), updated_at = NOW()
      WHERE id = $1
      RETURNING id, handle, email, display_name, password_hash, status, role, flagged_for_review, flagged_reason,
        trial_activated_once, trial_started_at, trial_ends_at, export_requested_at, deactivated_at
    ),
    inserted_outbox AS (
      INSERT INTO domain_event_outbox (
        event_id,
        aggregate_type,
        aggregate_id,
        aggregate_version,
        event_type,
        payload,
        headers,
        occurred_at
      )
      SELECT
        $2,
        'user',
        uu.id,
        NULL,
        'user.deactivated',
        jsonb_build_object(
          'userId', uu.id,
          'status', uu.status,
          'deactivatedAt', uu.deactivated_at
        ),
        jsonb_build_object(
          'schemaVersion', 1,
          'producer', 'hotspot-api'
        ),
        to_timestamp($3)
      FROM updated_user uu
      RETURNING id
    )
    SELECT id, handle, email, display_name, password_hash, status, role, flagged_for_review, flagged_reason,
      trial_activated_once, trial_started_at, trial_ends_at, export_requested_at, deactivated_at
    FROM updated_user
  `,
  markUserDeletedWithOutbox: `
    WITH updated_user AS (
      UPDATE users
      SET status = 'deleted', deleted_at = COALESCE(deleted_at, NOW()), updated_at = NOW()
      WHERE id = $1
      RETURNING id, handle, email, display_name, password_hash, status, role, flagged_for_review, flagged_reason,
        trial_activated_once, trial_started_at, trial_ends_at, export_requested_at, deactivated_at
    ),
    inserted_outbox AS (
      INSERT INTO domain_event_outbox (
        event_id,
        aggregate_type,
        aggregate_id,
        aggregate_version,
        event_type,
        payload,
        headers,
        occurred_at
      )
      SELECT
        $2,
        'user',
        uu.id,
        NULL,
        'user.deleted',
        jsonb_build_object(
          'userId', uu.id,
          'status', uu.status
        ),
        jsonb_build_object(
          'schemaVersion', 1,
          'producer', 'hotspot-api'
        ),
        to_timestamp($3)
      FROM updated_user uu
      RETURNING id
    )
    SELECT id, handle, email, display_name, password_hash, status, role, flagged_for_review, flagged_reason,
      trial_activated_once, trial_started_at, trial_ends_at, export_requested_at, deactivated_at
    FROM updated_user
  `,
  insertVerificationSession: `
    INSERT INTO verification_sessions (
      user_id,
      provider,
      provider_session_ref,
      status,
      expires_at
    )
    VALUES ($1, $2, $3, $4, to_timestamp($5))
    RETURNING id, status, provider_session_ref
  `,
  insertPasskeyChallenge: `
    INSERT INTO passkey_challenges (user_id, challenge_type, challenge, expires_at)
    VALUES ($1, $2, $3, to_timestamp($4))
  `,
  consumePasskeyChallenge: `
    UPDATE passkey_challenges
    SET consumed_at = NOW()
    WHERE user_id = $1
      AND challenge_type = $2
      AND challenge = $3
      AND consumed_at IS NULL
      AND expires_at > to_timestamp($4)
    RETURNING id
  `,
  insertPasskeyCredential: `
    INSERT INTO passkey_credentials (user_id, credential_id, public_key, sign_count)
    VALUES ($1, $2, $3, $4)
  `,
  selectPasskeyCredentialByCredentialId: `
    SELECT user_id, credential_id, sign_count, revoked_at
    FROM passkey_credentials
    WHERE credential_id = $1
    LIMIT 1
  `,
  updatePasskeyCredentialSignCount: `
    UPDATE passkey_credentials
    SET sign_count = $2, updated_at = NOW()
    WHERE credential_id = $1
  `,
};
