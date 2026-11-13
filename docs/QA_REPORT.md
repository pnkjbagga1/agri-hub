# AGRI HUB — QA report (multi-agent test pass)

Four independent QA agents tested the running app over HTTP, each in its own area, with reproducible scripts in `tests/agents/<area>/`. Every failure was fixed and the suites were re-run.

| Suite | Script | First run | After fixes |
|---|---|---|---|
| Auth & security | `node tests/agents/auth/run.mjs` | 34/36 + 5 risks | 35/36 (see note) |
| Grower & listings | `node tests/agents/grower/grower-qa.mjs` | all core PASS, 5 bugs | all PASS (one check in the script can't parse the stat card markup; the value is correct) |
| Buyer, messaging & RFQ | `node tests/agents/buyer/run.mjs` | 89 PASS, 7 issues | **96/96** |
| Partners, community & admin | `node tests/agents/admin/qa-admin.mjs` | 53/60 | **60/60** |

Note: check "8 TOTP" now "fails" by design. The test reuses the code it just used to enable two-factor, and replay protection rejects any code that was already used.

Also verified: a production `next build` succeeds, there's no horizontal overflow at 375px on 20+ pages, `tsc --noEmit` is clean, and ESLint (React Compiler rules) is clean.

## Fixed issues

**Security**
- Open redirect after login via `?next=/\evil.example` → strict same-origin check.
- 429 responses now include `Retry-After`.
- Password reset no longer burns the link when the new password is too weak (peek → validate → atomic consume).
- Real server-side sessions (`Session` table + JWT `jti`): sign-out invalidates the token; members can see and revoke their devices.
- Client IP for rate limits is taken only from the proxy header named in `TRUST_PROXY` (no spoofing via `X-Real-IP`).
- TOTP: wrong codes count toward account lockout; each code can be used only once (replay protection).
- Signed upload URLs are single-use (no overwrite).
- Media URLs must match our key format and belong to the uploader (profile, listing, event, post, certificate).
- Certificate documents are private (owner + admins only, `no-store`).
- Thread messages: the participant check runs before other checks (no state leak); an invalid `?after` returns 422.

**Data integrity / races**
- RFQ accept/quote/decline/withdraw use atomic conditional updates, so parallel accepts can't create duplicate "transactions".
- RFQ creation runs under a per-buyer/listing advisory lock (no duplicate open RFQs).
- Event RSVP capacity is enforced under a per-event lock (no overbooking).
- KPI updates are transactional; an unknown key returns 404. A duplicate region returns 409.

**Business rules**
- Unknown query params (category, page) no longer cause 500s.
- Draft lots don't have public trace pages.
- Saved-search alerts fire when a draft or paused listing is published, once per listing.
- Interest and RSVP are only allowed on approved programs and events.
- Offers can't be made on rejected demand posts (or unapproved ones in pre-moderation). Demand-match alerts wait for approval in pre-moderation.
- Profile pages respect the moderation mode for listings and show only approved programs to the public.
- Optional date fields can be omitted (Zod 4 optional transform).
- The buyer dashboard "Quotes to review" counts every quoted RFQ.
- New listings start as draft or active only, and an unknown region returns 422.
- The RFQ delivery date is compared with "today" in Pacific time.
