# xuntas.org — DNS Notes

_Last reviewed: 2026-08-26._ Managed in **cPanel Zone Editor** at BanaHosting (`bh7114.banahosting.com:2083`).

## Who hosts what

| Service | Where |
|---|---|
| Storefront (`xuntas.org`, `www`) | **Shopify** — root A `23.227.38.65`, `www` CNAME `shops.myshopify.com` |
| Inbound email | **Google Workspace** — 5 `ASPMX.L.GOOGLE.COM` MX |
| cPanel / hosting / `igpm.xuntas.org` | **BanaHosting** — `50.31.174.135` |
| Outbound app email | **Resend** — live as of 2026-08-26 |

Web and mail live on different providers. Changes to one must not clobber another.

## Adding Resend

Sending domain only. All four names checked against the live zone — unused, nothing got overwritten.

**Status: done.** All four records added 2026-08-26 and confirmed live on the
authoritative NS (`ns7115.banahosting.com`). Zone 98 → 102 records. Google MX verified unchanged.

| Type | Name | Value |
|---|---|---|
| TXT | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCytj6QKBuibdwvmy1b4yGAg6WN0tyuoAhjyTQvMT5SL7YiySaz2ZPL1UyaS3c4uti4BGlVY3uKwYdTqCMAM9sNQMA/+UuXxyPjKw6u2dDivBrvrRpJKYNAkSq885qGMy7lBaYqYDYdLB5SchhbcspQdpdR3SfiLjfTzFO83yP5rwIDAQAB` |
| CNAME | `rsend` | `rsend.forge.rmta.net` |
| CNAME | `send` | `send.forge.rmta.net` |
| TXT | `_dmarc` | `v=DMARC1; p=none;` (optional, monitor-only) |

- Selector `resend._domainkey` doesn't collide with `default._domainkey` (cPanel) or `google._domainkey` (Google) — selectors are namespaced.
- Resend labels the CNAMEs "SPF", but they're the bounce/return-path on the `send.` subdomain. They carry their own SPF and do **not** touch the root SPF TXT.

> **Gotcha — the DKIM key is per Resend domain entry.** Completing the Resend
> subscription created a new team, and the domain was re-added under a new ID
> (`d77863dc-…`, replacing `203b289b-…`) **with a different DKIM key**. The
> `resend._domainkey` TXT above is the new one; the record was updated in place.
> The two CNAMEs were identical across both entries.
>
> If more than one `xuntas.org` entry still exists in the Resend dashboard,
> **delete the stale one** — only one key can live at `resend._domainkey`, so the
> abandoned entry will never verify and is a trap for future debugging.

### Do NOT add: MX `@` → `inbound-smtp.us-east-1.amazonaws.com` pri `0`

Resend's "Enable Receiving" record. Priority `0` outranks Google's lowest (`1`), so **all** mail to `@xuntas.org` would leave Google Workspace and arrive as webhooks. Sending verifies without it.

If inbound is ever wanted: add `inbound.xuntas.org` as a *separate* Resend domain and put the MX there, leaving Google on the root. Resend's own recommendation when the root already has MX.

**Resend inbound = code reading email**, not humans (that's Google). Webhook carries metadata only (from, to, subject, attachment filenames); bodies/attachments fetched separately via the Received Emails / Attachments API, so large attachments don't blow serverless request-size limits. Useful for `support@` → tickets, reply-threading, emailed CSV ingest. Needs an app with an HTTP endpoint.

Sign-up mail (welcome, verification, magic link, OTP, password reset, double opt-in) is all **outbound** — covered by the four records above. Note: if sign-ups happen on the **Shopify storefront**, Shopify sends those from its own infrastructure and Resend isn't in the path at all.

## Outstanding issues

**1. SPF is wrong for Google Workspace — fix first.** Root TXT is `v=spf1 +a +mx +ip4:50.31.174.130 include:spf.jetsmtp.net ~all` with no `include:_spf.google.com`. `+mx` authorizes Google's *inbound* servers, not the outbound ones Gmail sends from, so Workspace mail likely soft-fails SPF. It survives on DKIM alignment via `google._domainkey` — fragile. Fix before raising DMARC `p=` above `none`. Add `rua=mailto:...` to actually get reports. Check whether Shopify needs to be in SPF too.

**2. 65 stale SSL validation records.** Of 98 records, 65 are CNAMEs shaped `_<32-hex>.mail.xuntas.org` → `<hash>.<hash>.comodoca.com` — Sectigo/Comodo DCV written by cPanel AutoSSL and never cleaned up. Only one is ever live. Root cause: all are under `mail.xuntas.org`, a CNAME to `xuntas.org` → Shopify, not the cPanel box; HTTP validation fails there, falls back to DNS DCV, writes a new CNAME, retries. Safe to delete, but they refill unless AutoSSL stops covering `mail.xuntas.org` (exclude it, or point it at cPanel).

**3. Duplicate TXT.** `google-site-verification=1zV1yoTjVnSBWDw7y3eO40-8h_zKg4m6zSvcHQISsic` appears twice on `xuntas.org.`.

## Inventory (98 total)

| Type | Count | Notes |
|---|---|---|
| CNAME | 67 | 65 stale comodoca DCV; 2 real (`mail`, `www`) |
| A | 16 | 8 root + 8 mirrored under `igpm` (cPanel service hostnames) |
| TXT | 10 | SPF ×2, DKIM ×3, google-site-verification ×2 (dupe), DCV test, `_acme-challenge`, `_jm` |
| MX | 5 | All Google Workspace |

~33 real records after cleanup.
