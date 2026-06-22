# Security Overview — Stvor AI Security

Production-ready PQC transport layer with offensive and defensive safeguards for autonomous agent commerce.

## Security Guarantees

- **Production-ready PQC transport layer**
  - ML-KEM-768 (NIST FIPS 203) + P-256 X3DH hybrid key exchange
  - Double Ratchet per-message forward-secrecy
  - AES-256-GCM AEAD symmetric encryption with associated data binding

- **AEAD metadata binding**
  - Every job transition records a SHA-256 payload hash
  - `taskPayloadHash` bound to FUNDED state; `deliverableHash` bound to SUBMITTED
  - Hash mismatch triggers automatic job abort with security alert

- **Replay protection**
  - Per-message Double Ratchet key rotation prevents ciphertext replay
  - Timestamp validation on challenge-response authentication tokens
  - Expired challenges are rejected automatically

- **Per-agent challenge-response authentication**
  - P-256 signed challenges with RFC 3339 expiry (`5m` default)
  - Persistent challenge store (`STVOR_CHALLENGE_STORE`, default `./data/challenges.json`)
  - Used for authorization on `/api/transport/*` and Bearer auth enforcement

- **Rate limiting on relay and API**
  - In-memory sliding window (10 req/min per agent) in development
  - File-backed rate-limit store (`STVOR_RATE_LIMIT_STORE`) for persistence
  - Redis-ready for multi-instance production deployments

- **Offline relay resilience**
  - In-process mock relay fallback ensures dev and Dockerized nodes remain runnable without external connectivity
  - Explicit opt-in via `STVOR_ALLOW_MOCK=true`

- **Environment defaults**
  - Safe defaults for boot-critical variables in `src/core/settings.ts`:
    - `STVOR_MODE`, `STVOR_PORT`, `STVOR_LOG_LEVEL`, `STVOR_DB_PATH`
    - `STVOR_PQC_ENABLED`, `STVOR_AGENT_ID`, `STVOR_RELAY_URL`
    - `STVOR_API_KEY`, `STVOR_APP_TOKEN`
  - All secret values must be provided via environment variables or configuration files. No hardcoded credentials are present in the source code.

- **API authorization**
  - `Authorization: Bearer <key>` enforcement for `/api/transport/*` endpoints.
  - `STVOR_API_KEY` must be explicitly configured; there is no hardcoded default.
  - Added test coverage for authenticated transport API access.

- **Docker build and CI smoke test**
  - The `Dockerfile` runs `bun test --timeout 30000` during build.
  - This catches integration regressions and layer order problems early.

## Running securely

- Use a custom API key in production: `STVOR_API_KEY=super-secret-key`
- Use a real relay URL in production: `STVOR_RELAY_URL=https://relay.example.com`
- For development, `STVOR_RELAY_URL=local` is safe and supported.
