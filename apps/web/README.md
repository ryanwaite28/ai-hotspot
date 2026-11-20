# HotSpot Web MVP

## Scope

The initial Next.js/React frontend provides accessible route shells for:

- authentication and email verification
- chronological feed and compose
- media and stories
- subscriptions and Stripe Checkout entry points
- campaigns
- live streaming
- notification/privacy settings

## Server authority

The UI never grants tiers, entitlements, checkout success, moderation resolution, or live room access from browser state. Every privileged state is returned by server APIs and signed provider events.

## Validation

JavaScript/TypeScript dependencies are declared in `apps/web/package.json`. Runtime validation requires `npm install` and Node 22+.

```bash
npm --prefix apps/web install
npm --prefix apps/web run typecheck
npm --prefix apps/web run build
```

Verified on 2026-11-20:
- strict TypeScript check passed
- Next.js production build passed
- 13 static routes generated
- npm audit reported 0 vulnerabilities after upgrading to Next.js 16.4.6
