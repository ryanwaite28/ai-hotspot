package com.hotspot.entitlement;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

public record PlatformCheckoutRequest(
    @NotBlank String tierKey,
    @Min(1) @Max(999) int tierVersion,
    @NotBlank String successUrl,
    @NotBlank String cancelUrl
) {
}
