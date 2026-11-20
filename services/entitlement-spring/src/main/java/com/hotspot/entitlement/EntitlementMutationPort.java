package com.hotspot.entitlement;

import java.util.UUID;

public interface EntitlementMutationPort {
    boolean grantOnce(EntitlementGrant grant, UUID eventId);
    boolean revoke(EntitlementGrant grant, String reason, UUID eventId);
}
