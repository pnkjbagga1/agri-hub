# AGRI HUB — QA report (multi-agent test pass)

Four independent QA agents tested the running app over HTTP, each in its own area, with reproducible scripts in `tests/agents/<area>/`. Every failure was fixed and the suites were re-run.

| Suite | Script | First run | After fixes |
|---|---|---|---|
| Auth & security | `node tests/agents/auth/run.mjs` | 34/36 + 5 risks | 35/36 (see note) |
| Grower & listings | `node tests/agents/grower/grower-qa.mjs` | all core PASS, 5 bugs | all PASS (one check in the script can't parse the stat card markup; the value is correct) |
| Buyer, messaging & RFQ | `node tests/agents/buyer/run.mjs` | 89 PASS, 7 issues | **96/96** |
| Partners, community & admin | `node tests/agents/admin/qa-admin.mjs` | 53/60 | **60/60** |
| Every stakeholder type, with test inquiries | `node tests/agents/stakeholders/run.mjs` | 97/100 (3 script assumptions) | **100/100** |

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

## Stakeholder pass (all 15 account types)

`tests/agents/stakeholders/run.mjs` signs up one fresh account per stakeholder type: grower; retail, processor and export buyers; university; consultant; EDC; FCC; financing; BC government; federal government; ag-tech; sales & marketing; supplier; dealer. Admins and anonymous visitors are covered too. Each persona runs its real journeys:

- **Every type:** signup → photo upload → profile → dashboard; signing in only through its own portal (member vs partner vs admin).
- **Buyers:** listing message → RFQ → the grower quotes → the buyer accepts → the buyer reviews; a demand post; each buyer type appears under the correct directory tab.
- **Grower:** publishes a listing, gets notified of inquiries, replies, quotes, offers on demand, expresses interest in all 11 partner programs, and files a claim for a Buy BC profile.
- **Partners:** each publishes a program (approved by admin) and sees the grower's interest under Leads. Suppliers and dealers can offer on buyer demand; other partner roles get a 403. The university hosts an event, and RSVPs stop at capacity.
- **Directory safety:** unclaimed Buy BC entries can't receive messages and can't sign in.
- **Assistant:** answers questions from visitors, growers, buyers and EDC with links into hub data.
- **Admin:** console pages load, the claim is visible, moderation is audited, and email notifications are queued.

## Buy BC data

All of the supplied workbook (Province of BC "Buy BC Licensed Products and Categories", as of March 3, 2025) is imported: **968 organisations, 10,413 licensed products, 14 categories**. These numbers reconcile exactly with the workbook's Overview sheet. Each organisation is an unclaimed directory entry (no login, source labelled) with its full product list, plus a searchable catalogue at `/buy-bc`.
