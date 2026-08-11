# Deployment Checklist (2026-08-09)

This checklist is for the current wallet project state as of 2026-08-09.

## 1. Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`
- `WALLET_MASTER_MNEMONIC`
- `APP_AUTH_TOKEN_SECRET`
- `RESEND_API_KEY`
- `EMAIL_FROM`

## 2. Security Gates

- Verify `APP_AUTH_TOKEN_SECRET` is set in every deployed environment.
- Verify `APP_AUTH_TOKEN_SECRET` is different from `SUPABASE_SERVICE_ROLE_KEY`.
- Verify `ALLOW_MOCK_SUPABASE` is unset in production.
- Verify `WALLET_MASTER_MNEMONIC` is stored only in server-side secrets.
- Verify no client bundle exposes server secrets through `NEXT_PUBLIC_*`.

## 3. Database Readiness

- Confirm all Supabase migrations under [supabase/migrations](/D:/Projects/wallet/supabase/migrations:1) have been applied.
- Confirm `public.system_settings` contains or can create `wallet_derivation_index`.
- Confirm `public.user_wallets.derivation_index` remains unique.
- Confirm `public.user_wallets.address` remains unique.
- Confirm `public.users.nickname` unique constraint exists.
- Confirm RLS policies still allow the intended server-side flows.

## 4. Application Verification

- Run `npm run build` in [apps/admin](/D:/Projects/wallet/apps/admin:1).
- Run `npm run build` in [apps/user-web](/D:/Projects/wallet/apps/user-web:1).
- Run `npm run lint` in both apps and review warnings before release.
- Verify `proxy.ts` behavior in both apps after replacing deprecated `middleware.ts`.
- Verify login, register, email verification, reset password, deposit address generation, and admin settings flows manually.

## 5. Wallet and Funds Safety

- Test wallet generation with two near-simultaneous requests and confirm unique addresses are created.
- Confirm `wallet_derivation_index` increments correctly after each generated wallet.
- Confirm hot wallet and cold vault settings save correctly through admin settings.
- Confirm no production path depends on mock Supabase data.
- Confirm sweep and withdrawal routes use the intended production addresses.

## 6. Workers and Automation

- Build and start [workers/rpc-watcher](/D:/Projects/wallet/workers/rpc-watcher:1).
- Build and start [workers/settlement-cron](/D:/Projects/wallet/workers/settlement-cron:1).
- Confirm worker environments have `DATABASE_URL` and any chain/RPC credentials they need.
- Confirm cron timing and timezone assumptions match production expectations.

## 7. Email and Recovery Flows

- Send a real verification email from staging.
- Confirm the verification link reaches `/api/auth/verify-email`.
- Send a real password reset email from staging.
- Confirm reset tokens expire after 15 minutes.
- Confirm invalid or expired tokens are rejected.

## 8. Observability

- Confirm server logs capture auth token validation failures.
- Confirm wallet generation failures log the underlying database or transaction error.
- Confirm worker logs are retained somewhere outside ephemeral console output.
- Confirm there is an alerting path for failed sweep, withdrawal, or settlement jobs.

## 9. Current Status Snapshot

- `apps/admin` build: passing on 2026-08-09
- `apps/user-web` build: passing on 2026-08-09
- `workers/rpc-watcher` TypeScript build: previously passing on 2026-08-09
- `workers/settlement-cron` TypeScript build: previously passing on 2026-08-09
- `apps/admin` lint: no errors, warnings remain
- `apps/user-web` lint: no errors, warnings remain

## 10. Remaining Cleanup After Release Blockers

- Remove or fix unused variables reported by lint warnings.
- Replace raw `<img>` tags with `next/image` where appropriate.
- Review `react-hooks/exhaustive-deps` warnings in [apps/user-web/src/app/page.tsx](/D:/Projects/wallet/apps/user-web/src/app/page.tsx:724).
- Consider tightening ESLint rules again after the current backlog is reduced.
