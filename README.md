# CloudLinkedIn Agent

An autonomous AI agent that plans, writes, validates, and publishes one
Cloud Computing / Virtualization / DevOps LinkedIn post per day - fully on
free-tier infrastructure. Configure it once; it independently avoids
repeating itself, keeps a full history, and posts to your personal LinkedIn
profile every day without further input.

## 1. Overview

After one-time setup, every scheduled run does this, automatically:

```
Load configuration + history
        v
Select a topic (avoiding cooldowns & recent duplicates)
        v
Generate a post with Gemini
        v
Validate quality (length, hashtags, forbidden phrases, fabricated experience)
        v
Check for duplicates (hash + semantic similarity)
        v
Publish to LinkedIn (current Posts API)
        v
Save post / topic / run history back to the repository
```

If generation or validation fails after retries, **nothing is published**.
The system is designed to fail closed, not to spam your profile.

## 2. Architecture

```
cloud-linkedin-agent/
├── .github/workflows/     GitHub Actions: daily-post.yml, manual-post.yml
├── config/                content-strategy.json (the ONE file you edit to change strategy)
├── data/                  posts.json, topics.json, runs.json - the repo IS the database
├── src/
│   ├── ai/                Gemini client (+ mock), prompt builder, generation/regeneration loop
│   ├── config/            env + strategy loading and validation
│   ├── content/           topic catalog, topic engine, dedup, quality checker, content rules
│   ├── linkedin/          OAuth helper, current Posts API client, publisher, mock
│   ├── storage/           JSON-file repositories for posts/topics/runs
│   ├── utils/             logger, retry, hashing
│   ├── workflow.ts        orchestrates the full daily pipeline
│   └── index.ts           CLI entrypoint
└── tests/                 vitest unit tests
```

No database server, no hosting bill, no queue - the git repository itself
is the source of truth (SQLite was considered but dropped in favor of plain
JSON files, since GitHub Actions runners are ephemeral and JSON + git
commit is simpler to keep in sync than a binary SQLite file).

**Deviation from the original spec:** the spec listed both
`config/content-strategy.json` and `src/config/strategy.json`. Only
`config/content-strategy.json` is implemented; it is the single source of
truth for strategy configuration, referenced directly by
`src/config/config.ts`.

## 3. Features

- One post/day, fully automatic topic selection (FR-01–FR-04)
- Topic cooldown (default 30 days) + Jaccard-similarity semantic dedup (FR-06/07)
- Content-type and category rotation so the account doesn't post the same
  shape of content every day
- Learning-progression difficulty (beginner → intermediate → advanced, then mixed)
- Quality gate: length, hashtag count, forbidden "AI filler" phrases,
  fabricated-experience detection, opening-sentence repetition
- SHA-256 content-hash duplicate protection, checked before every publish
- Full persisted history: every generated post, every run, every LinkedIn
  post ID (FR-10–FR-12)
- Retry with backoff, error classification, and **fail-closed** behavior:
  a post that fails validation is never published (FR-13/14, NFR-04)
- Dry-run mode and mock AI/LinkedIn clients for safe local development
- Secrets only ever come from environment variables / GitHub Secrets, never
  from source (FR-15)
- Editing your content strategy (topics, tone, hashtags, thresholds) never
  requires touching application code (FR-16)

## 4. Technology stack

- Node.js 20+ (22+ recommended), strict TypeScript
- AI: [`@google/genai`](https://www.npmjs.com/package/@google/genai) - the
  current, GA (May 2025+) Google Gen AI SDK. The legacy
  `@google/generative-ai` package is intentionally **not** used - it is no
  longer actively maintained.
- LinkedIn: the current **Posts API** (`POST /rest/posts`), which replaces
  the deprecated `/v2/ugcPosts` endpoint. Verified against LinkedIn's
  official documentation at implementation time - see [§10](#10-linkedin-setup).
- Storage: plain JSON files committed to the repository (no SQLite, no
  external DB - see [§2](#2-architecture))
- Testing: [vitest](https://vitest.dev)
- Zero other runtime dependencies beyond `dotenv` - native `fetch`, `node:crypto`,
  and `node:fs` are used everywhere else (see SPEC §74, "keep dependencies minimal").

## 5. Requirements

- Node.js >= 20 (the CI workflows use Node 22)
- A free [Google AI Studio](https://aistudio.google.com/app/apikey) Gemini API key
- A LinkedIn account + a LinkedIn Developer app (free)
- A GitHub repository (public or private) with Actions enabled

## 6. Local installation

```bash
git clone <your-repo-url>
cd cloud-linkedin-agent
npm install
cp .env.example .env
```

Edit `.env` and fill in the values described below. Leave `DRY_RUN=true`
until you've completed setup end-to-end.

## 7. Environment variables

See `.env.example` for the authoritative list. Summary:

| Variable | Required? | Notes |
| --- | --- | --- |
| `GEMINI_API_KEY` | Yes, unless `MOCK_GEMINI=true` | From Google AI Studio |
| `GEMINI_MODEL` | No (default `gemini-2.5-flash`) | Change the model without touching code |
| `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` | Only for `npm run linkedin:auth` | From your LinkedIn Developer app |
| `LINKEDIN_REDIRECT_URI` | Only for `npm run linkedin:auth` | Must match the app's registered redirect URL exactly |
| `LINKEDIN_ACCESS_TOKEN` | Yes, unless `DRY_RUN=true` or `MOCK_LINKEDIN=true` | Obtained once via `npm run linkedin:auth` |
| `LINKEDIN_API_VERSION` | No (default `202509`) | `Linkedin-Version` header, format `YYYYMM` - bump periodically |
| `POST_TIMEZONE` | No (default `America/Toronto`) | Used for the GitHub Actions cron schedule |
| `DRY_RUN` | No (default `true`) | When true, generates + validates but never publishes and never writes to `data/posts.json` / `data/topics.json` |
| `MOCK_LINKEDIN` | No (default `false`) | Simulates LinkedIn publication locally, no network call |
| `MOCK_GEMINI` | No (default `false`) | Simulates Gemini generation locally, no API key/quota used |
| `POSTS_PER_DAY` / `MAX_POSTS_PER_DAY` | No (default `1`) | Cost/volume guardrail |
| `MAX_AI_REQUESTS_PER_RUN` | No (default `3`) | Caps regeneration attempts per run |

**Never** commit a real `.env` file. `.gitignore` already excludes it.

## 8. Content strategy configuration

Everything about *what* the agent writes about and *how* it sounds lives in
[`config/content-strategy.json`](./config/content-strategy.json):
your profile/career framing, the topic categories in scope, style rules,
hashtag policy, quality thresholds (length, similarity thresholds, topic
cooldown days), and the difficulty-progression schedule.

**You can change your entire content strategy by editing this one JSON
file - no source code changes required** (FR-16). The candidate topics
themselves live in [`src/content/topicCatalog.ts`](./src/content/topicCatalog.ts)
(curated per SPEC §20); add entries there if you want to expand the pool of
topics within a category already listed in your strategy's `mainTopics`.

The forbidden-phrase blacklist (generic AI filler like "Let's dive into...",
"game changer", etc.) lives in
[`src/content/contentRules.ts`](./src/content/contentRules.ts) and can be
extended without touching the quality-checking logic itself.

## 9. Gemini setup

1. Go to <https://aistudio.google.com/app/apikey> and create a free API key.
2. Put it in `.env` as `GEMINI_API_KEY`.
3. Optionally change `GEMINI_MODEL` (default `gemini-2.5-flash`).
4. The Gemini free tier has model-specific rate limits. `MAX_AI_REQUESTS_PER_RUN`
   (default 3) caps how many generation attempts a single run can make, so a
   bad run can't silently burn through your quota.

The AI client (`src/ai/geminiClient.ts`) uses `@google/genai`'s structured
output mode (`responseMimeType: 'application/json'` + `responseSchema`) so
the model is constrained to return exactly the JSON shape the app expects.

## 10. LinkedIn setup

### 10.1 Create the app

1. Go to <https://www.linkedin.com/developers/apps> and create an app.
2. Under **Products**, add:
   - **Share on LinkedIn** (grants the `w_member_social` scope)
   - **Sign In with LinkedIn using OpenID Connect** (grants `openid`/`profile`,
     used only to resolve your member ID)
3. Under **Auth**, add an OAuth 2.0 redirect URL that matches
   `LINKEDIN_REDIRECT_URI` in your `.env` exactly (default
   `http://localhost:8181/callback`).
4. Copy the **Client ID** and **Client Secret** into `.env`.

### 10.2 Obtain an access token (one time, locally)

```bash
npm run linkedin:auth
```

This starts a temporary local HTTP server, prints an authorization URL for
you to open in your browser, waits for LinkedIn's redirect, exchanges the
code for an access token, and prints the token **once** to your terminal
along with your resolved `urn:li:person:...` author URN. Copy that token
into `LINKEDIN_ACCESS_TOKEN` (locally) and into your GitHub secret of the
same name (see [§11](#11-github-setup)). This script is a manual,
interactive, local-only tool - it is intentionally separate from the
automated pipeline, which never prints tokens (see `src/utils/logger.ts`
redaction).

LinkedIn access tokens expire (commonly after ~60 days); re-run
`npm run linkedin:auth` and update the secret when that happens.

### 10.3 API contract actually implemented

Verified against LinkedIn's current official documentation at
implementation time:

- `GET https://api.linkedin.com/v2/userinfo` → `{ "sub": "..." }` → author URN is `urn:li:person:{sub}`
- `POST https://api.linkedin.com/rest/posts`
  - Headers: `Authorization: Bearer <token>`, `Content-Type: application/json`,
    `X-Restli-Protocol-Version: 2.0.0`, `LinkedIn-Version: <YYYYMM>`
  - Body: `{ author, commentary, visibility: "PUBLIC", distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] }, lifecycleState: "PUBLISHED", isReshareDisabledByAuthor: false }`
  - Success: HTTP `201`, the created post's URN is returned in the
    `x-restli-id` response header (this is what gets stored as
    `linkedinPostId`).

This intentionally does **not** use the deprecated `/v2/ugcPosts` endpoint.
If LinkedIn changes this contract in the future, update
`src/linkedin/linkedinClient.ts` and this section together.

## 11. GitHub setup

### 11.1 Secrets (Settings → Secrets and variables → Actions → Secrets)

| Secret | Value |
| --- | --- |
| `GEMINI_API_KEY` | Your Gemini API key |
| `LINKEDIN_CLIENT_ID` | Your LinkedIn app client ID |
| `LINKEDIN_CLIENT_SECRET` | Your LinkedIn app client secret |
| `LINKEDIN_ACCESS_TOKEN` | The token from `npm run linkedin:auth` |

### 11.2 Variables (same page, "Variables" tab) - optional, non-secret

| Variable | Default if unset |
| --- | --- |
| `DRY_RUN` | `true` |
| `GEMINI_MODEL` | `gemini-2.5-flash` |
| `LINKEDIN_API_VERSION` | `202509` |
| `POST_TIMEZONE` | `America/Toronto` |
| `POSTS_PER_DAY` / `MAX_POSTS_PER_DAY` / `MAX_AI_REQUESTS_PER_RUN` | `1` / `1` / `3` |
| `MOCK_LINKEDIN` / `MOCK_GEMINI` | `false` |

### 11.3 Permissions

Both workflows request only `permissions: contents: write` (to commit
`data/*.json` history) and, for the daily workflow, `issues: write` (to
optionally open a failure issue). No broader permissions are requested.

## 12. Running locally

```bash
npm run dev            # watch mode, defaults to DRY_RUN from .env
npm run generate       # one run, respects DRY_RUN from .env
npm run generate:dry   # force dry-run regardless of .env (never publishes, never writes data/posts.json)
npm run publish        # force a real publish attempt (respects MOCK_LINKEDIN)
npm run test           # vitest
npm run lint           # eslint
npm run typecheck      # tsc --noEmit
npm run build          # tsc -p tsconfig.json
```

Local development without any credentials at all:

```bash
MOCK_GEMINI=true MOCK_LINKEDIN=true npm run publish
```

This exercises the entire pipeline - topic selection, generation,
validation, deduplication, "publishing", and history persistence - with
zero network calls and zero API keys.

> **Note on the mock Gemini client:** it rotates through five fixed writing
> templates so repeated local test runs don't all look identical. Because
> its vocabulary is still far more repetitive than a real LLM's, running
> `MOCK_GEMINI=true` many times in a row can occasionally trip the
> semantic-duplicate check (`post content is too semantically similar to a
> recently published post`) even for different topics. **This is the
> quality/dedup engine working as designed** - see `src/content/qualityChecker.ts`
> and `src/content/deduplication.ts`. It does not happen with the real
> Gemini API, whose output varies far more than a handful of templates.

## 13. Dry-run mode

```bash
npm run generate:dry
```

```
GENERATED POST

-------------------------

<hook>

<body>

Hashtags: #... #... #...

-------------------------

NOT PUBLISHED

Reason:
DRY_RUN=true
```

In dry-run mode, the post is generated and fully validated, but:
- LinkedIn is never called.
- `data/posts.json` and `data/topics.json` are **not** modified (so
  repeated test runs don't pollute your real content history or burn topic
  cooldowns).
- A `dry_run` entry **is** appended to `data/runs.json` for observability.

## 14. Manual publishing

```bash
npm run publish
```

Forces a real publish attempt regardless of the `DRY_RUN` env var (still
subject to `MOCK_LINKEDIN` if you want to test the full flow without
touching the real LinkedIn API). On success this updates `data/posts.json`,
`data/topics.json`, and `data/runs.json`.

In GitHub Actions, use the **Manual Test Run** workflow
(`.github/workflows/manual-post.yml`) via the Actions tab → "Run workflow",
choosing `dry-run` or `publish`.

## 15. Automated publishing

`.github/workflows/daily-post.yml` runs on a schedule (`0 9 * * *`,
`America/Toronto` by default - edit the `cron`/`timezone` in that file to
change it) and can also be triggered manually. It:

1. Checks out the repo, installs Node + dependencies, runs the test suite.
2. Runs `npm run generate` (respects the `DRY_RUN` repository variable) or,
   if manually dispatched with `publish: true`, `npm run publish`.
3. Commits `data/*.json` back to the repo **only if something changed**.
4. Opens a GitHub issue if the run failed (no secrets are ever included).

It deliberately does **not** trigger on `push`, to avoid the
commit → push → trigger → commit → ... infinite loop described in SPEC §49.

**First-time setup checklist:**

1. Create the GitHub repo, push this code.
2. Set the secrets/variables from [§11](#11-github-setup).
3. Leave the `DRY_RUN` repository variable at `true` (or unset).
4. Run **Manual Test Run** with `mode: dry-run` from the Actions tab and
   read the logs to confirm the generated post looks right.
5. Run **Manual Test Run** with `mode: publish` (optionally with
   `MOCK_LINKEDIN=true` set as a variable first, to test without touching
   your real profile) and confirm a post lands on LinkedIn / in
   `data/posts.json`.
6. Set the `DRY_RUN` repository variable to `false`.
7. Leave the **Daily LinkedIn Post** schedule enabled. You're done - the
   system now runs on its own.

## 16. Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| `ERROR: GEMINI_API_KEY is missing...` at startup | Set `GEMINI_API_KEY` in `.env`/secrets, or set `MOCK_GEMINI=true` for local testing |
| `ERROR: LINKEDIN_ACCESS_TOKEN is missing...` | Run `npm run linkedin:auth`, or keep `DRY_RUN=true` / `MOCK_LINKEDIN=true` |
| `LINKEDIN_AUTH_ERROR` (401/403) during publish | Token expired or scope missing - re-run `npm run linkedin:auth`; confirm "Share on LinkedIn" product is enabled |
| `Failed to generate a valid, non-duplicate post after N attempts` | Working as intended - see SPEC §35/36/38. Check the logged `errors` array for the specific reason (too short/long, too similar, forbidden phrase, etc.) |
| Repeated `MOCK_GEMINI` runs fail with "too semantically similar" | Expected mock limitation - see [§12](#12-running-locally) note above; not an issue with the real Gemini API |
| Scheduled workflow silently stopped running | Public repos disable scheduled workflows after 60 days of repository inactivity (SPEC §50) - push any commit or manually re-enable the workflow in the Actions tab |
| Workflow can't push history changes | Confirm `permissions: contents: write` is present (it is, by default, in both workflows) and that branch protection isn't blocking the bot's push |

## 17. Security

- `.env` is git-ignored; secrets only ever come from environment variables
  or GitHub Actions secrets - never from source code or `content-strategy.json`.
- `src/utils/logger.ts` redacts any log context key matching
  `token|secret|key|password|authorization` (case-insensitive) as a defensive
  backstop; application code additionally never passes raw tokens into log calls.
- `npm run linkedin:auth` is the **only** place a token is intentionally
  printed to the terminal - by design, since it's a one-time, local,
  interactive setup step, not part of the automated pipeline.
- GitHub workflow permissions are scoped to the minimum needed
  (`contents: write`, plus `issues: write` for the daily workflow's optional
  failure notification).
- AI output is always validated (`qualityChecker.ts`) before it's eligible
  for publication; LinkedIn responses are checked for the expected `201` /
  `x-restli-id` before a post ID is trusted.
- The AI is explicitly instructed - and additionally checked via regex
  patterns in `contentRules.ts` - not to fabricate certifications,
  employers, clients, or specific deployments (SPEC §59).

Security checklist status:

- [x] `.env` in `.gitignore`
- [x] API keys never committed (verify with `git log -p | grep -i` before
      your first push if you're paranoid - none are present in this repo)
- [x] tokens never logged by the automated pipeline
- [x] secrets stored in GitHub Secrets, non-sensitive config in GitHub Variables
- [x] GitHub Actions permissions minimized per workflow
- [x] OAuth redirect URI is validated by LinkedIn itself (must match the registered value exactly)
- [x] AI output validated (schema + quality checker) before publication
- [x] LinkedIn response validated (status code + required header) before trusting a post ID

## 18. Cost

Everything here runs on free tiers:

| Component | Cost |
| --- | --- |
| GitHub repository + Actions | $0 (public repos: generous free minutes; private repos: 2,000 min/month free) |
| Gemini API | $0 within the free tier's per-model rate limits |
| LinkedIn API | $0 for member posting via `w_member_social` |
| Node.js / TypeScript / storage | $0 (no servers, no database) |

Guardrails against accidental cost/abuse:

- `MAX_AI_REQUESTS_PER_RUN` (default 3) caps Gemini calls per run.
- `MAX_POSTS_PER_DAY` / `POSTS_PER_DAY` (default 1) cap LinkedIn publishes per day.
- The daily workflow only runs once per schedule trigger (no fan-out).

This project must never silently introduce a paid dependency. If you swap
in a different AI or LinkedIn client in the future, keep this guarantee.

## 19. Known limitations / V2 ideas (not implemented, by design)

- No web research / fact-checking pipeline (SPEC §39/40) - content comes
  from the model's own knowledge plus the curated topic catalog.
- No image generation (SPEC §63) - text-only posts, to keep the system free
  and simple.
- No weekly summary or email notifications (SPEC §52/53) - only the
  optional failure-issue notification is implemented.
- No `src/research/` module - the directory structure is intentionally left
  out of V1 since nothing currently uses it; add it when V2 research is implemented.
