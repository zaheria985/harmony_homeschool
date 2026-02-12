# Environment Variables

This project reads configuration from `.env`.

## Required

- `DATABASE_URL`
  - PostgreSQL connection string.
  - Example: `postgresql://harmony:changeme@localhost:5432/harmony`

- `NEXTAUTH_SECRET`
  - Secret used to sign auth tokens/cookies.
  - Generate with:
    ```bash
    openssl rand -base64 32
    ```

- `NEXTAUTH_URL`
  - Canonical app URL used by NextAuth callback handling.
  - Local example: `http://localhost:3000`

## Optional

- `POSTGRES_PASSWORD`
  - Used by local Docker Postgres setup.
  - Not required if your `DATABASE_URL` points to an existing DB.

- `CRON_SECRET`
  - Shared secret for `/api/cron/bump-lessons`.
  - Send either:
    - `x-cron-secret: <value>` header, or
    - `authorization: Bearer <value>` header

## LLM Integration (Optional)

- `LLM_PROVIDER`
  - Supported: `openai`, `claude`, `openai_compatible`

- `LLM_API_KEY`
  - API key for selected provider.

- `LLM_BASE_URL`
  - Base URL for API requests.
  - Default OpenAI: `https://api.openai.com/v1`
  - For `openai_compatible`, set to your provider endpoint.

- `LLM_MODEL`
  - Model identifier for provider.
  - Examples:
    - OpenAI: `gpt-4o`
    - Anthropic (claude mode): `claude-sonnet-4-5-20250929`

## FileRun Integration (Optional)

- `FILERUN_BASE_URL`
  - Base URL used for FileRun link handling.
  - Example: `http://localhost:8080`

## Recommended Baseline .env

```env
DATABASE_URL=postgresql://harmony:changeme@localhost:5432/harmony
POSTGRES_PASSWORD=changeme

NEXTAUTH_SECRET=replace-with-generated-secret
NEXTAUTH_URL=http://localhost:3000

LLM_PROVIDER=openai
LLM_API_KEY=your-api-key
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o

FILERUN_BASE_URL=http://localhost:8080
CRON_SECRET=replace-with-a-long-random-secret
```
