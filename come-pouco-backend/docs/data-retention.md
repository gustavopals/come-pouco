# Data retention

The backend runs scheduled retention jobs from `src/jobs/`.

## Policies

| Table              | Retention source                               | Default                    |
| ------------------ | ---------------------------------------------- | -------------------------- |
| `affiliate_links`  | `companies.history_retention_days` per company | `30` days on new companies |
| `api_request_logs` | `API_REQUEST_LOG_RETENTION_DAYS`               | `90` days                  |
| `audit_logs`       | `AUDIT_LOG_RETENTION_DAYS`                     | `365` days                 |
| `conversions`      | `CONVERSION_RETENTION_DAYS`                    | `180` days                 |

Company history retention accepts the values defined in `ALLOWED_HISTORY_RETENTION_DAYS`.
API usage and audit retention env vars are normalized to at least 1 day.
Conversion retention is also normalized to at least 1 day.

## Runtime behavior

At `03:00`, `history-cleanup.job.ts`:

1. Skips execution if a previous run is still active.
2. Logs row count and relation size for each managed table before deletion.
3. Deletes expired rows from `affiliate_links`, `api_request_logs`, and `audit_logs` in sequence.
4. Logs deleted rows plus row count and relation size after each table cleanup.

The size metric uses PostgreSQL `pg_total_relation_size`, so it includes indexes and toast data.

At `03:30`, `conversion-retention.job.ts`:

1. Skips execution if a previous conversion retention run is still active.
2. Selects conversions older than `CONVERSION_RETENTION_DAYS`.
3. Anonymizes personal metadata by setting `ip_hash=''`, `user_agent=''`, and `referrer=NULL`.
4. Logs the cutoff date, configured retention, anonymized row count, and duration.

The admin endpoint `DELETE /api/admin/conversions/anonymize?olderThan=YYYY-MM-DD` runs the same anonymization logic manually.

## Operational notes

The current implementation uses single `DELETE` statements. This is simple and adequate for the current volume. If any table grows enough for cleanup to cause lock pressure, change the table cleanup to batched deletes with a small `LIMIT` loop.

The conversion retention implementation uses one `UPDATE` statement because it anonymizes rows instead of deleting them. If conversion volume grows enough to create lock pressure, move it to batched updates.

The cleanup job is not a replacement for backups. Backups should keep their own retention policy outside the application database.
