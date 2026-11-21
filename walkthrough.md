# Security Summary

**Reviewed Files**: 22  
**Issues Resolved**: 11

### Issues Resolved
| Area | File | Line | What Was Happening | Impact | Status | How It Was Fixed |
|---|---|---|---|---|---|---|
| Unauthenticated Automation Trigger | `api/cron/automation.ts` | 214 | When `CRON_SECRET` was unset, a forged `x-vercel-cron` HTTP header bypassed authentication and allowed anyone to trigger automation runs and access admin-level database operations, with a fallback to the public anon key. | High | Fixed | Removed the `x-vercel-cron` bypass and anon key fallback; now strictly requires `SUPABASE_SERVICE_ROLE_KEY` and either a constant-time `CRON_SECRET` match or a verified `elanati_admins` user token. |
| Unauthenticated Webhook & Secret Fallback | `api/whatsapp/webhook.ts` | 110, 157, 331 | `GET` verification fell back to the hardcoded `'elanati_whatsapp_verify'` placeholder, `POST` requests accepted spoofed sender payloads without verifying webhook signatures or secrets, and personalized customer replies (`replyText`) were echoed back in the HTTP response. | High | Fixed | Removed the hardcoded verify token fallback (fails closed with HTTP 503 if unconfigured), enforced `POST` verification via HMAC `x-hub-signature-256` or constant-time webhook secret check (`401` otherwise), required `SUPABASE_SERVICE_ROLE_KEY`, and removed `replyText` from the JSON response. |
| Unvalidated Outbound Gateway Requests | `api/cron/automation.ts`, `api/whatsapp/webhook.ts` | 68, 75 | Configured WhatsApp gateway URLs were passed directly to server-side `fetch()` calls without verifying scheme or destination host, creating risk of requests reaching internal or metadata network addresses. | High | Fixed | Added `assertSafeExternalHttpsUrl()` and `isBlockedHostname()` to enforce HTTPS-only URLs, block loopback/private/link-local/metadata addresses, and apply a 10-second request timeout. |
| Database Privilege & Subscription Bypass | `supabase/schema.sql` | 270, 825, 965, 1012 | Anonymous users inserting directly through the public database API could supply pre-approved `status`, `featured: true`, `priority_rank`, or a valid `SUB-XXXXX` code without phone verification, bypass single-free-ad limits, or create package requests with manipulated prices and pre-activated `status`. | High | Fixed | Tightened `INSERT` row-level security policies and added server-side `BEFORE INSERT` database triggers (`enforce_elanati_ad_submission`, `enforce_elanati_package_request_submission`, `enforce_elanati_ticket_submission`) to compute status, dates, package eligibility, quotas, official EGP pricing, and `owner_pin` exclusively inside PostgreSQL. |
| Public Over-Exposure of Internal Ad Fields | `supabase/schema.sql`, `src/services/dataService.ts` | 1403, 594 | Anonymous `SELECT *` on `elanati_ads` exposed private fields (`client_name`, `subscription_code`, `admin_note`, `client_edits_count`) to any visitor inspecting network traffic. | High | Fixed | Replaced blanket `anon` table `SELECT` with explicit PostgreSQL column grants excluding sensitive fields and updated `fetchPublicAds()` to select `PUBLIC_AD_COLUMNS` only. |
| Unauthenticated Client Ad Modification & Portal Data Leakage | `supabase/schema.sql`, `src/components/ClientEditAdModal.tsx`, `src/services/dataService.ts` | 470, 592, 711 | Anyone knowing a merchant's public phone number on an approved listing could trigger the one-time client ad edit or inspect full unmasked `subscription_code`, `payment_reference`, and `api_key` values via `get_elanati_client_portal` or `check_elanati_ad_allowance`. | High | Fixed | Added an 8-character secret `owner_pin` generated per ad (displayed once after submission), updated `edit_elanati_ad_by_client` to require `owner_pin` or `subscription_code`, and masked secret codes/references/API keys in portal & allowance checks unless matched by secret `SUB-` code. |
| Browser Source Map Exposure & Admin Fallback Guard | `vite.config.ts`, `src/lib/supabase.ts`, `src/services/dataService.ts` | 10, 119, 1699 | Production Vite builds did not explicitly guarantee `sourcemap: false`, and if Supabase client env vars were accidentally omitted on a live domain, local preview fallback allowed client-side admin login (`isSupabaseConfigured === false`). | Medium | Fixed | Explicitly locked `build.sourcemap: false` in `vite.config.ts` (verified 0 `.map` files in `dist/`), and added `isPreviewAuthAllowed()` so local preview admin login only functions on localhost/preview domains and fails closed on live domains. |
| Unsafe External URLs & Phone Links | `src/lib/supabase.ts`, `src/services/dataService.ts`, `src/components/*` | 87, 105 | Image URLs (`image_url`, `extra_images`, `banner_url`) and `tel:` links did not validate protocols before rendering in `<img>` and `<a href>` tags. | Medium | Fixed | Added `sanitizeHttpUrl()` (allowing only `http://`, `https://`, or safe relative `/` paths) and `sanitizePhoneHref()` across database triggers, `dataService.ts`, ad cards, details modal, portal, and inbox/contact views. |
| Spreadsheet Formula Injection in CSV Exports | `src/lib/supabase.ts`, `src/components/ClientPortalView.tsx`, `src/components/admin/AdminPackagesManager.tsx` | 113, 225, 207 | Unsanitized user-entered text (`title`, `client_name`, `payment_reference`) starting with `=`, `+`, `-`, or `@` could execute formulas when admins or clients opened exported CSV reports in Excel. | Medium | Fixed | Added `escapeCsvCell()` to neutralize leading formula characters and escape quotes before joining CSV rows. |
| Missing Browser Security Headers & CSP | `vercel.json` | 14 | Production responses lacked security headers (`Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`, `Permissions-Policy`, `Referrer-Policy`). | Medium | Fixed | Added hardened response headers and strict CSP rules in `vercel.json`. |
| Hardcoded Verify Token Placeholder in Env Example & Live Config | `.env.example`, GitHub/Vercel Setup | 11 | `.env.example` listed a sample `elanati_whatsapp_verify` string; live Vercel secrets and GitHub repository visibility require owner verification outside code. | Medium | Needs Follow-Up | Removed the placeholder value from `.env.example`; owner must set strong random values in Vercel (`CRON_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_WEBHOOK_SECRET`), apply `supabase/schema.sql` in Supabase SQL Editor, and verify the GitHub repository is set to **Private**. |

### Safeguards Verified
| Area | File | How It's Protected |
|---|---|---|
| Dependency Supply Chain | `package.json`, `bun.lock` | `bun audit` checked all 271 installed packages and reported zero known vulnerabilities. |
| Build & Static Type Integrity | `dist/`, `api/*`, `src/*` | `compile_applet`, `lint_applet` (`tsc --noEmit`), and standalone Node/Vercel typechecks on `api/cron/automation.ts` and `api/whatsapp/webhook.ts` passed with zero errors; `find dist -name "*.map"` returned zero files. |
| Admin Panel Visibility & Role Isolation | `src/App.tsx`, `src/pages/AdminPage.tsx`, `supabase/schema.sql` | Admin route (`/admin`) requires an active authenticated session verified against `public.is_elanati_admin()` (both `auth.uid()` and `elanati_admins.email`) before loading admin tables or actions; standard navigation hides admin controls from regular visitors. |
| Server-Only Secrets & Keys | `api/*`, `src/lib/supabase.ts`, `.gitignore` | `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `WHATSAPP_API_TOKEN`, and webhook secrets exist only in server environment variables (`process.env`), are rejected if placed in `VITE_SUPABASE_ANON_KEY`, and `.env` files are excluded from Git tracking. |

---

## PoC Verification

### 1. Unauthenticated Automation & Cron Bypass
#### Summary
| Field | Value |
|---|---|
| Issue Type | Missing Authentication Check on Serverless Endpoint |
| Impact | High |
| Affected File | `api/cron/automation.ts:213` |
| Test Scenario | `GET /api/cron/automation` with forged `x-vercel-cron: 1` header and no `Authorization: Bearer` token. |

#### How It Was Fixed
Removed the header-based bypass and anonymous key fallback; the handler now verifies a constant-time hash comparison against `process.env.CRON_SECRET` or validates a signed Supabase JWT belonging to a row in `elanati_admins`.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Request enters `handler()` at `api/cron/automation.ts:192` with forged `x-vercel-cron: 1` and empty `Authorization`. | Enters handler |
| 2 | `supabaseUrl` and `serviceKey` are verified at lines 197–203; `bearer` is `''` at line 206. | Credentials required |
| 3 | Auth check at lines 214–235 evaluates both `cronSecret && bearer && timingSafeEqualStr(...)` and `else if (bearer && anonKey)` as `false`. | Fails auth check |
| 4 | Line 237–239 returns HTTP `401` `{ error: 'غير مصرح بتشغيل الأتمتة' }` before loading config or dispatching messages. | **Blocked Safely** |

#### Conclusion
**Fix Verified** - Forged cron headers or missing bearer tokens can no longer trigger automation jobs or query privileged customer records.

---

### 2. Spoofed WhatsApp Webhook & Data Echo
#### Summary
| Field | Value |
|---|---|
| Issue Type | Unauthenticated Webhook Processing & Sensitive Data Exposure |
| Impact | High |
| Affected File | `api/whatsapp/webhook.ts:110` |
| Test Scenario | `GET /api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=elanati_whatsapp_verify` and unauthenticated `POST` with `{ "from": "201001234567" }`. |

#### How It Was Fixed
Removed the hardcoded `'elanati_whatsapp_verify'` fallback, added `verifyWebhookPostAuth()` to validate either Meta's `x-hub-signature-256` HMAC signature or a matching secret header/token using constant-time comparison, and removed personalized `replyText` from HTTP responses.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | `GET` verification hits `api/whatsapp/webhook.ts:153-174` using old placeholder `elanati_whatsapp_verify`. | Enters GET handler |
| 2 | If `WHATSAPP_VERIFY_TOKEN` is unset, line 159 returns HTTP `503`; if set to a real secret, `timingSafeEqualStr` at line 164 fails and returns HTTP `403`. | Placeholder rejected |
| 3 | Unauthenticated `POST` hits line 182 (`verifyWebhookPostAuth(req)`). Without valid `WHATSAPP_APP_SECRET` HMAC or `WHATSAPP_WEBHOOK_SECRET`, line 183 returns HTTP `401`. | Spoofed POST blocked |
| 4 | Even on authenticated `POST`, line 332 returns only `{ ok: true, processed: true }` without echoing customer data. | **Blocked Safely** |

#### Conclusion
**Fix Verified** - Attackers can no longer verify rogue webhook connections, trigger outbound WhatsApp messages, or harvest customer ad details via webhook responses.

---

### 3. Direct Database Manipulation via Public Anon Key
#### Summary
| Field | Value |
|---|---|
| Issue Type | Client-Side Privilege & Plan Bypass via Database API |
| Impact | High |
| Affected File | `supabase/schema.sql:825`, `supabase/schema.sql:965` |
| Test Scenario | Direct `POST /rest/v1/elanati_ads` using the public `anon` key supplying `{ status: 'approved', featured: true, package_name: 'المؤسسي', expires_at: null, subscription_code: 'SUB-99999' }`. |

#### How It Was Fixed
Added `BEFORE INSERT` `SECURITY DEFINER` triggers `enforce_elanati_ad_submission()` and `enforce_elanati_package_request_submission()` so PostgreSQL overwrites client-supplied status, timestamps, rank, paid features, and prices based on server settings and verified active subscriptions.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Direct anon `INSERT` passes column schema into `BEFORE INSERT` trigger `trg_elanati_ad_submission` (`supabase/schema.sql:959`). | Enters trigger |
| 2 | `is_elanati_admin()` evaluates to `false` for anon callers (line 857). | Non-admin path enforced |
| 3 | Trigger overwrites `NEW.status` from `elanati_site_settings.require_ad_approval` and resets `views_count`, `client_edits_count`, `admin_note`, and `starts_at` (lines 866–873). | Spoofed fields reset |
| 4 | Because `SUB-99999` is invalid or unlinked to `NEW.contact`, lines 875–889 raise a database exception and abort the insert (or for free ads, lines 924–951 verify single-free-ad rules and force `featured = false`). | **Blocked Safely** |

#### Conclusion
**Fix Verified** - Forging admin-level flags, free extra ads, or unauthorized paid tiers directly against the Supabase REST API is prevented at the database engine layer.

---

### 4. Unauthorized Ad Edit & Portal Secret Exposure via Public Phone Number
#### Summary
| Field | Value |
|---|---|
| Issue Type | Missing Ownership Proof on Public-Phone Operations |
| Impact | High |
| Affected File | `supabase/schema.sql:470`, `supabase/schema.sql:592`, `supabase/schema.sql:711` |
| Test Scenario | Calling `edit_elanati_ad_by_client` or `get_elanati_client_portal` with only a merchant's public phone number scraped from an approved listing. |

#### How It Was Fixed
Introduced a server-generated 8-character `owner_pin` per ad (`supabase/schema.sql:843`), removed `owner_pin` / `subscription_code` / `client_name` from `anon` column grants (`supabase/schema.sql:1402-1407`), updated `edit_elanati_ad_by_client` to require `owner_pin` or `subscription_code`, and masked sensitive codes in `get_elanati_client_portal` unless queried by the exact secret `SUB-XXXXX` code.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Public `SELECT` on `elanati_ads` only permits `PUBLIC_AD_COLUMNS` (`supabase/schema.sql:1403-1407`); `owner_pin` and `subscription_code` are excluded. | Secrets hidden |
| 2 | Attacker passes public phone `01001234567` as `p_query` into `edit_elanati_ad_by_client`. | Enters RPC |
| 3 | Lines 629–643 check `v_ad.owner_pin` and `subscription_code` only—not `v_ad.contact`—so `v_owns` is `false` and the RPC raises an exception. | Edit rejected |
| 4 | Calling `get_elanati_client_portal` with phone `01001234567` sets `v_by_code = false` (line 495), masking `subscription_code`, `payment_reference`, and `api_key` (lines 505–522). | **Handled Safely** |

#### Conclusion
**Fix Verified** - Public phone numbers on ads can no longer be used to hijack the one-time ad edit or extract full secret subscription/API credentials.

---

### 5. Unsafe External Gateway URL, Image Link & CSV Formula Inputs
#### Summary
| Field | Value |
|---|---|
| Issue Type | Unsafe Protocol Handling & Spreadsheet Formula Injection |
| Impact | Medium |
| Affected File | `api/cron/automation.ts:68`, `src/lib/supabase.ts:87`, `src/lib/supabase.ts:113` |
| Test Scenario | Gateway endpoint `http://169.254.169.254/latest/meta-data/`, image URL `javascript:alert(1)`, or ad title `=cmd|'/C calc'!A0` in CSV export. |

#### How It Was Fixed
Added `assertSafeExternalHttpsUrl()` on server WhatsApp requests, `sanitizeHttpUrl()` / `sanitizePhoneHref()` across database triggers and React components, and `escapeCsvCell()` on CSV export handlers.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | `http://169.254.169.254/...` reaches `assertSafeExternalHttpsUrl()` (`api/cron/automation.ts:68`) and is immediately rejected at line 75 (`protocol !== 'https:'`) and line 51 (link-local block). | Outbound request blocked |
| 2 | `javascript:alert(1)` reaches `sanitizeHttpUrl()` (`src/lib/supabase.ts:87`) and database trigger (`supabase/schema.sql:849`), returning `null`. | Unsafe link stripped |
| 3 | `=cmd|'/C calc'!A0` passes through `escapeCsvCell()` (`src/lib/supabase.ts:113`), prefixing an apostrophe `'=cmd...` inside escaped quotes. | **Handled Safely** |

#### Conclusion
**Fix Verified** - Internal metadata URLs, executable `javascript:` links, and Excel formula payloads are rejected or neutralized before execution.
