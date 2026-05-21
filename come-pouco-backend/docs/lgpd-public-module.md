# LGPD - public module

This document covers the public Alli conversion module exposed under `/api/public/*`.

## Data collected

The conversion flow stores one `Conversion` row per conversion attempt:

| Field                                             | Purpose                                                                      |
| ------------------------------------------------- | ---------------------------------------------------------------------------- |
| `companyId`                                       | Associates the conversion with the public landing owner.                     |
| `employeeId`                                      | Attributes the conversion to an employee public slug when present.           |
| `originalUrl`                                     | Keeps the submitted Shopee URL for troubleshooting and auditability.         |
| `normalizedUrl`                                   | Stores the cleaned Shopee URL used for conversion/cache keys.                |
| `affiliateUrl`                                    | Stores the generated affiliate URL or configured fallback URL.               |
| `itemId`, `shopId`, `productName`                 | Product analytics and dashboard grouping.                                    |
| `status`, `errorReason`, `mode`, `responseTimeMs` | Operational diagnostics and conversion analytics.                            |
| `ipHash`                                          | HMAC hash of requester IP using `PUBLIC_IP_HASH_SALT`; raw IP is not stored. |
| `userAgent`                                       | Sanitized browser/client metadata for diagnostics and abuse analysis.        |
| `referrer`                                        | Sanitized source page when sent by the browser.                              |

The public rate-limit flow may also create `AuditLog` rows for abuse events such as `PUBLIC_RATE_LIMIT_HIT`, using hashed IP metadata.

## Legal basis

The module processes this data under legitimate interest and contract execution:

- Legitimate interest: fraud prevention, rate limiting, abuse investigation, observability, reliability, and affiliate attribution diagnostics.
- Contract execution: generating affiliate links and attributing conversions to a company or employee when the landing owner has configured that public experience.

Sensitive personal data is not intentionally collected by this module. Submitted URLs are expected to be Shopee product URLs; clients should not send personal data inside query parameters.

## Retention

`CONVERSION_RETENTION_DAYS` controls the default retention window for identifiable conversion metadata. The default is `180` days.

At `03:30` server time, `conversion-retention.job.ts` anonymizes conversions older than the configured window:

- `ipHash` is set to an empty string.
- `userAgent` is set to an empty string.
- `referrer` is set to `null`.

The admin endpoint `DELETE /api/admin/conversions/anonymize?olderThan=YYYY-MM-DD` runs the same anonymization logic on demand for all conversions older than the provided date.

Conversion rows are not deleted by this policy because aggregated business metrics depend on historical counts, statuses, product identifiers, and employee attribution. The retained fields should be reviewed if future requirements treat product URLs or employee attribution as data that must also expire.

## Data subject rights

Operational handling for LGPD requests:

- Confirmation/access: identify whether public conversion rows exist for the requester only when there is a reliable correlation key. IP hashes cannot be reversed.
- Correction: public conversion metadata is event data and is normally not corrected; incorrect company/employee attribution should be documented and, if needed, handled with a targeted database fix.
- Anonymization/deletion: use the admin anonymization endpoint or a direct database operation scoped by company/date when a verified request requires earlier anonymization.
- Portability: export only fields needed for the verified request and avoid exposing internal secrets, raw hashes, or unrelated tenant data.
- Revocation/opposition: stop future processing by disabling the public landing, changing slugs, adjusting rate limits, or removing the public entry point as applicable.

## Observability

Public conversion logs use the `[public-convert]` message prefix and include structured JSON fields such as `requestId`, `conversionId`, `companySlug`, `employeeSlug`, `status`, `mode`, `cacheHit`, and `responseTimeMs`.

Admins can inspect lightweight module metrics at `GET /api/admin/metrics/public-module`, including cache hit ratio, conversions per minute, fallback ratio, and 24-hour status counts.
