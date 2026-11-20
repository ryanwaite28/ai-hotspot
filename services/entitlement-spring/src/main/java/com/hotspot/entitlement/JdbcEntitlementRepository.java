package com.hotspot.entitlement;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public class JdbcEntitlementRepository implements EntitlementRepository {
    private final JdbcTemplate jdbcTemplate;

    public JdbcEntitlementRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    @Transactional
    public boolean grantOnce(EntitlementGrant grant, UUID eventId) {
        Integer existing = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM entitlement_audit_events WHERE event_id = ?",
            Integer.class,
            eventId.toString()
        );
        if (existing != null && existing > 0) {
            return false;
        }

        int inserted = jdbcTemplate.update("""
            INSERT INTO entitlements (
              user_id, entitlement_key, source, source_ref, starts_at, ends_at,
              entitlement_status, grant_event_id, source_version
            ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)
            """,
            grant.userId(), grant.entitlementKey().name(), grant.source().name(),
            grant.sourceRef(), Timestamp.from(grant.startsAt()),
            grant.endsAt() == null ? null : Timestamp.from(grant.endsAt()),
            eventId.toString(), grant.sourceVersion()
        );

        if (inserted != 1) {
            return false;
        }

        jdbcTemplate.update("""
            INSERT INTO entitlement_audit_events (
              event_id, user_id, entitlement_key, action, source, source_ref,
              starts_at, ends_at, reason, occurred_at
            ) VALUES (?, ?, ?, 'granted', ?, ?, ?, ?, NULL, NOW())
            """,
            eventId.toString(), grant.userId(), grant.entitlementKey().name(),
            grant.source().name(), grant.sourceRef(), Timestamp.from(grant.startsAt()),
            grant.endsAt() == null ? null : Timestamp.from(grant.endsAt())
        );

        jdbcTemplate.update("""
            INSERT INTO domain_event_outbox (
              event_id, aggregate_type, aggregate_id, aggregate_version,
              event_type, payload, headers, occurred_at
            ) VALUES (?, 'entitlement', ?, NULL, 'entitlement.granted',
              jsonb_build_object(
                'eventId', ?, 'userId', ?::text,
                'entitlementKey', ?, 'source', ?, 'sourceRef', ?,
                'startsAt', ?, 'endsAt', ?
              ),
              jsonb_build_object('schemaVersion', 1, 'producer', 'hotspot-entitlement'),
              NOW())
            """,
            eventId.toString(), grant.userId(), eventId.toString(), grant.userId().toString(),
            grant.entitlementKey().name(), grant.source().name(), grant.sourceRef(),
            Timestamp.from(grant.startsAt()).toInstant().toString(),
            grant.endsAt() == null ? null : Timestamp.from(grant.endsAt()).toInstant().toString()
        );

        return true;
    }

    @Override
    @Transactional
    public boolean revoke(EntitlementGrant grant, String reason, UUID eventId) {
        Integer existing = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM entitlement_audit_events WHERE event_id = ?",
            Integer.class,
            eventId.toString()
        );
        if (existing != null && existing > 0) {
            return false;
        }

        int updated = jdbcTemplate.update("""
            UPDATE entitlements
            SET revoked_at = NOW(), entitlement_status = 'revoked', revoked_reason = ?
            WHERE user_id = ?
              AND entitlement_key = ?
              AND source = ?
              AND (? IS NULL OR source_ref = ?)
              AND revoked_at IS NULL
            """,
            reason, grant.userId(), grant.entitlementKey().name(),
            grant.source().name(), grant.sourceRef(), grant.sourceRef()
        );

        if (updated == 0) {
            return false;
        }

        jdbcTemplate.update("""
            INSERT INTO entitlement_audit_events (
              event_id, user_id, entitlement_key, action, source, source_ref,
              starts_at, ends_at, reason, occurred_at
            ) VALUES (?, ?, ?, 'revoked', ?, ?, NULL, NULL, ?, NOW())
            """,
            eventId.toString(), grant.userId(), grant.entitlementKey().name(),
            grant.source().name(), grant.sourceRef(), reason
        );

        return true;
    }

    @Override
    public List<EffectiveEntitlement> findEffective(UUID userId, Instant now) {
        return jdbcTemplate.query("""
            SELECT user_id, entitlement_key, source, source_ref, starts_at, ends_at
            FROM entitlements
            WHERE user_id = ?
              AND revoked_at IS NULL
              AND starts_at <= ?
              AND (ends_at IS NULL OR ends_at > ?)
            """,
            (row, rowNumber) -> new EffectiveEntitlement(
                UUID.fromString(row.getString("user_id")),
                EntitlementKey.valueOf(row.getString("entitlement_key")),
                EntitlementSource.valueOf(row.getString("source")),
                row.getString("source_ref"),
                row.getTimestamp("starts_at").toInstant(),
                row.getTimestamp("ends_at") == null ? null : row.getTimestamp("ends_at").toInstant()
            ),
            userId, Timestamp.from(now), Timestamp.from(now)
        );
    }
}
