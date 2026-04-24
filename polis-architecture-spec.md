# POLIS Governance Engine
## Multi-Tenant Architecture & Deployment Specification
**Version 1.0 · Draft**
*Classification: Confidential — Internal Product Specification*

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Deployment Modes](#2-deployment-modes)
3. [System Architecture](#3-system-architecture)
4. [AI Provider Configuration](#4-ai-provider-configuration)
5. [Data Models](#5-data-models)
6. [Multi-Tenant Billing & Plans](#6-multi-tenant-billing--plans)
7. [Security Architecture](#7-security-architecture)
8. [Deployment & Infrastructure](#8-deployment--infrastructure)
9. [API Design](#9-api-design)
10. [Monetization & Revenue Model](#10-monetization--revenue-model)
11. [Roadmap](#11-roadmap)
12. [Open Questions](#12-open-questions)

---

## 1. Executive Summary

POLIS is an AI-governed organization platform that enables any group — a family trust, town government, savings cooperative, church, or business — to establish transparent, democratic governance backed by a **SAR (Sense → Analyze → Respond) engine**.

This document specifies the **multi-tenant SaaS architecture** and the **self-hosted standalone deployment mode**, including the first-run configuration wizard that allows operators to choose between the two at install time.

The platform is designed to serve three distinct markets simultaneously:

- **End users** who access POLIS as a hosted SaaS product (`polis.app`)
- **Organizations** that want to self-host POLIS on their own infrastructure with their own AI keys
- **Enterprises** that want a private white-labeled instance for internal governance

### Key Design Principles

| Principle | Description |
|---|---|
| Mode is permanent | Deployment mode is a first-run decision, not a runtime toggle |
| Single codebase | Multi-tenant and standalone share all code — feature flags control behavior |
| Pluggable AI | Anthropic, OpenAI, Ollama (local), or any custom OpenAI-compatible endpoint |
| Strong isolation | Schema-per-tenant in PostgreSQL; row-level security at the DB layer |
| Constitutional AI | The SAR engine is bound to tenant-defined rules and cannot act outside them |
| No lock-in | Full data export in open JSON format on any plan, at any time |

---

## 2. Deployment Modes

POLIS supports two first-class deployment modes, selected **once at first boot** via the setup wizard. The mode affects routing, billing, tenant isolation, and AI configuration — but shares the same application codebase.

### 2.1 Mode A — Multi-Tenant SaaS

In multi-tenant mode, POLIS operates as a hosted service provider. Multiple organizations ("tenants") share the platform infrastructure but are fully isolated at the data layer. This is the model for `polis.app` as a commercial product.

| Attribute | Description |
|---|---|
| **Tenants** | Unlimited organizations, each with their own subdomain (`org.polis.app`) or custom domain |
| **Isolation** | Schema-per-tenant in PostgreSQL; no cross-tenant data access possible |
| **Billing** | Stripe integration; per-plan metering (member count, AI SAR passes, storage) |
| **AI** | Platform-managed API key; cost allocated per tenant by usage |
| **Ops** | Platform operator manages infrastructure; tenants manage their org only |
| **Auth** | Platform-level SSO + per-org member auth; superadmin panel for platform operators |

### 2.2 Mode B — Standalone (Self-Hosted)

In standalone mode, POLIS runs as a single-organization application on operator-owned infrastructure. The operator is also the org admin. This mode targets governments, enterprises, and privacy-conscious organizations.

| Attribute | Description |
|---|---|
| **Tenants** | Single organization only; no multi-tenancy UI or routing |
| **Isolation** | Not applicable — single-schema, single-org database |
| **Billing** | No Stripe integration; licensed per deployment (annual fee or OSS) |
| **AI** | Operator configures their own provider — Anthropic, OpenAI, Ollama, or custom endpoint |
| **Ops** | Operator manages all infrastructure; Docker Compose or Kubernetes |
| **Auth** | Standard JWT auth; optional LDAP/SAML integration for enterprise SSO |

### 2.3 Mode Selection — First-Run Wizard

When POLIS boots for the first time with no database initialized, it serves a **setup wizard** at the root URL. This is the only place where deployment mode is configured. It **cannot be changed post-setup** without a full database reset.

#### Wizard Flow

```
Step 1 — Welcome
         Explains the two modes with plain-language descriptions and a feature
         comparison table. Links to docs.

Step 2 — Mode Selection
         [ ◉ Multi-Tenant SaaS ]  [ ○ Standalone ]
         Radio selection with live feature diff shown below.

Step 3 — Database Setup
         PostgreSQL connection string input → test connection → run migrations.

Step 4 — AI Provider
         Select provider → enter API key → test with a live ping.
         [ Anthropic ]  [ OpenAI ]  [ Ollama ]  [ Custom ]

Step 5 — Admin Account
         Create the superadmin / org-owner account.
         Email, password, 2FA enrollment (optional at this step).

Step 6 — (SaaS only) Platform Config
         Stripe publishable + secret keys, platform domain, email provider (Resend/SMTP).

Step 7 — Review & Launch
         Config summary. "Found POLIS" button.
         On submit: writes polis.config.json, locks wizard route permanently.
```

#### Config File Written on Completion

```json
// polis.config.json — written once, never editable via UI
{
  "deploymentMode": "multitenant",
  "setupComplete": true,
  "setupDate": "2025-07-11T00:00:00Z",
  "ai": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514",
    "apiKeyRef": "env:POLIS_AI_KEY"
  },
  "db": {
    "url": "env:DATABASE_URL"
  },
  "platform": {
    "domain": "polis.app",
    "stripeKeyRef": "env:STRIPE_SECRET",
    "emailProvider": "resend",
    "emailKeyRef": "env:RESEND_API_KEY"
  }
}
```

> **Note:** API keys are never stored in the config file or database. They are always referenced as environment variable names. The config file is safe to commit to a private repo.

---

## 3. System Architecture

### 3.1 Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| **Runtime** | Bun.js | Fast JS/TS runtime; native SQLite for dev, PostgreSQL for prod |
| **Language** | TypeScript (strict) | End-to-end type safety; shared types between API and frontend |
| **Frontend** | Svelte 5 (runes) | Compiled, no virtual DOM, minimal bundle; server-side render capable |
| **API** | REST + WebSocket (Bun native) | Optional tRPC layer for type-safe client consumption |
| **ORM** | Drizzle ORM | TypeScript-native, schema-first, supports multi-schema PostgreSQL |
| **Primary DB** | PostgreSQL 16 | Schema-per-tenant isolation; row-level security |
| **Cache / Queue** | Redis + BullMQ | Session cache, SAR job queue, rate limiting, real-time pub/sub |
| **AI Integration** | Pluggable provider interface | Anthropic SDK, OpenAI SDK, Ollama HTTP client |
| **Auth** | JWT + refresh tokens | bcrypt passwords; TOTP 2FA; optional SAML/LDAP |
| **Billing** | Stripe (SaaS only) | Subscriptions, usage metering, webhooks, customer portal |
| **File Storage** | S3-compatible | AWS S3, Cloudflare R2, or MinIO for self-hosted |
| **Email** | Resend (hosted) / SMTP | Transactional email — invites, vote notifications, SAR digests |
| **Deployment** | Docker Compose / Helm | Compose for standalone; Kubernetes via Helm chart for SaaS |
| **CI/CD** | GitHub Actions | Test → lint → build → push image → deploy |

### 3.2 High-Level Architecture

#### Multi-Tenant Topology

```
┌────────────────────────────────────────────────────────────────┐
│                       INTERNET / CDN                           │
└────────────────────────┬───────────────────────────────────────┘
                         │
┌────────────────────────▼───────────────────────────────────────┐
│              INGRESS — nginx / Caddy                           │
│   *.polis.app  →  tenant routing by subdomain                  │
│   custom domains  →  cert auto-provision (Let's Encrypt)       │
└────────────────────────┬───────────────────────────────────────┘
                         │
┌────────────────────────▼───────────────────────────────────────┐
│              POLIS API CLUSTER (Bun.js)                        │
│                                                                │
│   ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│   │  Auth        │  │  Org API     │  │  SAR Worker        │  │
│   │  /auth/*     │  │  /api/v1/*   │  │  (BullMQ consumer) │  │
│   └──────────────┘  └──────────────┘  └────────────────────┘  │
│                                                                │
│   ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│   │  Billing     │  │  Admin Panel │  │  Setup Wizard      │  │
│   │  /billing/*  │  │  /platform/* │  │  (first-run only)  │  │
│   └──────────────┘  └──────────────┘  └────────────────────┘  │
└───────┬─────────────────────┬──────────────────┬──────────────┘
        │                     │                  │
   ┌────▼────┐          ┌──────▼──────┐    ┌─────▼──────────┐
   │  Redis  │          │  PostgreSQL │    │  AI Provider   │
   │sessions │          │  schema/    │    │  (pluggable)   │
   │queue    │          │  per tenant │    │                │
   │pub/sub  │          └─────────────┘    └────────────────┘
   └─────────┘
```

#### Standalone Topology

```
┌─────────────────────────────────────────────┐
│              POLIS (single org)             │
│                                             │
│   Bun API + Svelte frontend                 │
│   PostgreSQL (single schema)                │
│   Redis (local or managed)                  │
│   AI provider (operator's own key)          │
│   Caddy (auto TLS)                          │
│                                             │
│   No Stripe · No multi-tenant routing       │
│   No platform admin panel                   │
└─────────────────────────────────────────────┘
```

### 3.3 Tenant Isolation Model

Each tenant receives its own PostgreSQL **schema**. This provides strong data isolation without the overhead of separate databases, while keeping cross-tenant analytics available to the platform operator via the `platform` schema.

```sql
-- Schema naming convention: tenant_<slug>
CREATE SCHEMA tenant_maplewood_ohio;
CREATE SCHEMA tenant_ironwood_circle;
CREATE SCHEMA tenant_new_hope_church;

-- Each schema contains the full table set:
--   orgs, members, constitution, articles, laws,
--   proposals, votes, treasury, ledger, sar_log

-- Platform schema (multi-tenant only):
--   platform.tenants, platform.subscriptions,
--   platform.usage_events, platform.audit_log

-- Tenant context injected per request via middleware:
SET app.current_tenant = 'tenant_maplewood_ohio';

-- Row-level security enforced at DB layer:
CREATE POLICY tenant_isolation ON sar_log
  USING (org_id = current_setting('app.current_tenant')::uuid);
```

### 3.4 Feature Flag System

Deployment mode is enforced at boot via a feature flag singleton loaded from `polis.config.json`. No runtime toggling is possible.

```typescript
// src/config/features.ts
export const features = {
  multiTenant:    config.deploymentMode === 'multitenant',
  billing:        config.deploymentMode === 'multitenant',
  platformAdmin:  config.deploymentMode === 'multitenant',
  customDomain:   config.deploymentMode === 'multitenant',
  standaloneAuth: config.deploymentMode === 'standalone',
  ldapSync:       config.deploymentMode === 'standalone',
} as const;
```

---

## 4. AI Provider Configuration

POLIS decouples the SAR engine from any specific AI provider through a **unified provider interface**. In multi-tenant mode, the platform manages AI access and cost allocation. In standalone mode, the operator configures their own keys at setup time and can update them via the admin panel at any time.

### 4.1 Supported Providers

| Provider | Models | Best For |
|---|---|---|
| **Anthropic (Claude)** | claude-sonnet-4, claude-haiku-4-5 | Default hosted; best constitutional reasoning |
| **OpenAI** | gpt-4o, gpt-4o-mini | Operators already on OpenAI stack |
| **Ollama (Local)** | llama3, mistral, phi3, any GGUF | Air-gapped / private / no-cost deployments |
| **Custom Endpoint** | Any OpenAI-compatible API | Private fine-tuned models, Azure OpenAI |

### 4.2 Provider Interface

```typescript
// src/ai/provider.interface.ts

export interface AIProvider {
  name:     string;
  analyze(prompt: string, context: SARContext): Promise<SARAnalysis>;
  draft(prompt: string, type: DraftType): Promise<string>;
  classify(text: string, schema: ClassifySchema): Promise<Classification>;
  ping(): Promise<boolean>;  // used by setup wizard to test connection
}

export type ProviderType = 'anthropic' | 'openai' | 'ollama' | 'custom';

// Factory resolves at boot from polis.config.json
export function createProvider(config: AIConfig): AIProvider {
  switch (config.provider) {
    case 'anthropic': return new AnthropicProvider(config);
    case 'openai':    return new OpenAIProvider(config);
    case 'ollama':    return new OllamaProvider(config);
    case 'custom':    return new CustomProvider(config);
  }
}
```

### 4.3 SAR Engine AI Usage

The SAR engine makes AI calls for these tasks:

```typescript
// src/sar/tasks.ts

enum SARTask {
  PROPOSAL_INTAKE       = 'proposal_intake',        // analyze new proposal
  CONSTITUTIONAL_CHECK  = 'constitutional_check',    // detect charter conflicts
  CYCLE_MONITORING      = 'cycle_monitoring',        // routine deadline checks
  CHARTER_GENERATION    = 'charter_generation',      // founding wizard output
  VOTE_ANALYSIS         = 'vote_analysis',           // tally + quorum check
  LEDGER_AUDIT          = 'ledger_audit',            // monthly financial review
  HARDSHIP_REVIEW       = 'hardship_review',         // member hardship claims
}
```

### 4.4 Cost Routing Strategy (Multi-Tenant)

In hosted SaaS mode, AI costs are metered per tenant. The SAR engine uses a tiered routing strategy to minimize cost while preserving quality for critical governance decisions.

| SAR Task | Model Tier | Rationale |
|---|---|---|
| Cycle monitoring, deadline checks | Haiku / gpt-4o-mini | High frequency, low complexity |
| Proposal intake, basic analysis | Sonnet / gpt-4o | Balanced quality/cost |
| Constitutional conflict detection | Sonnet — always | Never cut quality on legal analysis |
| Charter generation (wizard) | Sonnet | Single high-value call |
| Batch audit reports | Batch API (-50% cost) | Async, non-urgent |

**Cost allocation in SaaS mode:**

- Each AI call tagged with `tenant_id` and billed to their usage bucket
- Community plan: 500 SAR passes/month cap
- Collective/Institution overages: $0.002 per SAR pass above plan limit
- Standalone: operator pays AI provider directly — POLIS has zero involvement

---

## 5. Data Models

### 5.1 Entity Relationships

```
Platform (multi-tenant only)
  └── Tenant
        ├── Organization
        │     ├── Constitution
        │     │     └── Articles[]
        │     ├── Laws[]
        │     ├── Members[]
        │     │     └── Votes[]
        │     ├── Proposals[]
        │     │     ├── AIAnalysis
        │     │     └── VoteTally
        │     ├── Treasury
        │     │     └── Ledger[]  ← append-only
        │     └── SARLog[]        ← append-only
        └── Subscription (multi-tenant only)
              └── UsageEvents[]
```

### 5.2 Core Table Definitions (Drizzle ORM / PostgreSQL)

```typescript
// src/db/schema.ts

// ── Members ──────────────────────────────────────────────────────
export const members = pgTable('members', {
  id:           uuid('id').primaryKey().defaultRandom(),
  orgId:        uuid('org_id').notNull().references(() => orgs.id),
  name:         text('name').notNull(),
  email:        text('email').unique(),
  role:         text('role').default('member'),     // founder | admin | member | observer
  status:       text('status').default('active'),   // active | late | suspended | left
  joinedAt:     timestamp('joined_at').defaultNow(),
  rotationPos:  integer('rotation_pos'),
  hasReceived:  boolean('has_received').default(false),
  metadata:     jsonb('metadata').default({}),
});

// ── Proposals ────────────────────────────────────────────────────
export const proposals = pgTable('proposals', {
  id:          uuid('id').primaryKey().defaultRandom(),
  orgId:       uuid('org_id').notNull().references(() => orgs.id),
  type:        text('type').notNull(),              // ordinance | charter | resolution | emergency
  title:       text('title').notNull(),
  body:        text('body').notNull(),
  proposedBy:  uuid('proposed_by').references(() => members.id),
  status:      text('status').default('draft'),     // draft | open | voting | passed | failed
  votesFor:    integer('votes_for').default(0),
  votesAgainst:integer('votes_against').default(0),
  abstain:     integer('abstain').default(0),
  votingEnds:  timestamp('voting_ends'),
  aiAnalysis:  jsonb('ai_analysis'),
  createdAt:   timestamp('created_at').defaultNow(),
});

// ── SAR Log (append-only — no UPDATE or DELETE ever issued) ──────
export const sarLog = pgTable('sar_log', {
  id:          uuid('id').primaryKey().defaultRandom(),
  orgId:       uuid('org_id').notNull().references(() => orgs.id),
  refId:       text('ref_id'),                      // ORD-2025-041, TX-0891, etc.
  sense:       text('sense').notNull(),
  analyze:     text('analyze').notNull(),
  respond:     text('respond').notNull(),
  status:      text('status').default('completed'),
  modelUsed:   text('model_used'),
  tokensUsed:  integer('tokens_used'),
  createdAt:   timestamp('created_at').defaultNow(),
});

// ── Ledger (append-only — signed on write) ───────────────────────
export const ledger = pgTable('ledger', {
  id:          uuid('id').primaryKey().defaultRandom(),
  orgId:       uuid('org_id').notNull().references(() => orgs.id),
  type:        text('type').notNull(),              // contribution | payout | reserve | penalty | fee
  memberId:    uuid('member_id').references(() => members.id),
  amount:      integer('amount').notNull(),         // in cents — never floats
  balance:     integer('balance').notNull(),        // running balance after tx
  note:        text('note'),
  hmac:        text('hmac').notNull(),             // integrity signature
  cycleRef:    integer('cycle_ref'),
  createdAt:   timestamp('created_at').defaultNow(),
});
```

### 5.3 Drizzle Multi-Schema Setup

```typescript
// src/db/tenant.ts

import { drizzle } from 'drizzle-orm/postgres-js';

export function getTenantDb(tenantSlug: string) {
  const schema = `tenant_${tenantSlug}`;
  return drizzle(pool, {
    schema: buildSchema(schema),   // all tables prefixed with this schema
  });
}

// Middleware injects tenant db instance per request
export async function tenantMiddleware(req: Request): Promise<void> {
  const slug = resolveTenantFromHost(req.headers.get('host'));
  req.db = getTenantDb(slug);
}
```

---

## 6. Multi-Tenant Billing & Plans

### 6.1 Plan Structure

| Feature | Community (Free) | Collective ($29/mo) | Institution ($99/mo) |
|---|---|---|---|
| Members | Up to 20 | Unlimited | Unlimited |
| Organizations | 1 | 5 | Unlimited |
| SAR passes / month | 500 | 10,000 | Unlimited |
| AI overage rate | Not available | $0.002 / pass | $0.001 / pass |
| Custom domain | No | Yes | Yes |
| White labeling | No | No | Full |
| API access | No | 1,000 calls/mo | Unlimited |
| Data export | JSON | JSON + CSV + PDF | All + streaming API |
| Ledger audit PDF | No | Yes | Yes |
| SLA | None | 99.5% uptime | 99.9% uptime |
| Support | Community | Email (48h SLA) | Dedicated + Slack |
| Civic / nonprofit | N/A | 50% off | 50% off |

> **Per-member pricing:** Available for orgs over 500 members at $0.50/member/month. Replaces flat plan fee for large cooperatives and municipal governments.

> **Self-hosted license:** $499/yr (small org, up to 100 members), $1,999/yr (unlimited members), free for OSS / personal use under the POLIS Community License.

### 6.2 Stripe Integration Architecture

```typescript
// src/billing/stripe.ts

// Subscription lifecycle
// Created:   user completes wizard → org created → Stripe customer + subscription
// Updated:   plan change → proration calculated by Stripe
// Cancelled: end of period → org downgraded to Community limits
// Failed:    payment fails → 7-day grace → suspension → 30-day data hold → deletion

// Usage metering — emitted per action, batched every 60s
interface UsageEvent {
  tenantId:   string;
  eventType:  'sar_pass' | 'api_call' | 'member_seat' | 'storage_gb';
  quantity:   number;
  metadata:   Record<string, unknown>;
  occurredAt: Date;
}

// Stripe meter update
await stripe.billing.meters.createEvent({
  event_name: 'sar_pass',
  payload: { stripe_customer_id: tenant.stripeCustomerId, value: '1' },
  timestamp: Math.floor(Date.now() / 1000),
});
```

### 6.3 Platform Admin Panel (SaaS Only)

The platform operator has a superadmin panel at `/platform/admin` (separate from any tenant org dashboard) with the following capabilities:

- View all tenants, subscription status, usage metrics
- Manually override plan limits (for trials, partnerships, civic discounts)
- Trigger SAR engine diagnostics across tenants
- View platform-level AI cost breakdown by tenant
- Export billing reports
- Suspend / reinstate tenants
- View immutable platform audit log of all admin actions

---

## 7. Security Architecture

### 7.1 Authentication & Authorization

| Concern | Implementation |
|---|---|
| **Passwords** | bcrypt cost factor 12; no plaintext ever stored or logged |
| **Sessions** | JWT (15min expiry) + refresh token (30 days) in httpOnly, SameSite=Strict cookie |
| **2FA** | TOTP via authenticator app; backup codes; enforced for org admins |
| **API Keys** | SHA-256 hashed at rest; prefix + secret pattern (`pk_live_xxxx`); org-scoped |
| **RBAC** | `superadmin > org_admin > council > member > observer` — enforced in middleware |
| **Tenant routing** | Tenant resolved from subdomain before every request; injected into DB context |
| **SSO (enterprise)** | SAML 2.0 + OIDC; LDAP sync for standalone deployments |

### 7.2 Data Security

- All data encrypted at rest (AES-256) and in transit (TLS 1.3 minimum)
- AI provider API keys stored **only as environment variable references** — never in database or config files
- SAR log is append-only — application DB user has no `UPDATE` or `DELETE` privileges on `sar_log`
- Ledger transactions are immutable — signed with HMAC-SHA256 on write, verified on read
- Tenant data exports generate signed download URLs with 15-minute TTL
- GDPR: Member deletion anonymizes PII fields rather than hard delete (preserves ledger integrity)
- PII fields (email, name) encrypted at column level using `pgcrypto` in production

### 7.3 SAR Engine Constitutional Constraints

The following constraints are **hardcoded in the SAR engine** and cannot be overridden by any tenant configuration, AI prompt, or platform operator action:

```
CONSTRAINT 1 — No autonomous spending
  The SAR engine cannot spend, transfer, or approve treasury funds
  without a ratified member vote on record. It prepares disbursements;
  it never executes them.

CONSTRAINT 2 — Append-only log
  The SAR engine cannot modify any existing SAR log entry.
  It can only append new entries. The log is a permanent public record.

CONSTRAINT 3 — No vote override
  The SAR engine cannot alter or override a completed member vote result,
  regardless of its own analysis or any external instruction.

CONSTRAINT 4 — No silent actions
  All SAR engine actions must produce a log entry before execution.
  Architecturally, there is no code path that executes an action
  without first writing to sar_log.

CONSTRAINT 5 — Prompt injection sandboxing
  All user-submitted content (proposals, comments, law text) is sanitized
  and role-tagged before entering any AI context window. The system prompt
  is always operator-controlled and cannot be modified by member input.

CONSTRAINT 6 — Member record immutability
  The SAR engine cannot add, remove, or modify member records.
  Only org admins can perform member management actions.
```

### 7.4 Rate Limiting

```typescript
// Per-route rate limits enforced via Redis sliding window

const RATE_LIMITS = {
  'POST /api/v1/orgs/:id/proposals':     { requests: 10,  window: '1h' },
  'POST /api/v1/orgs/:id/proposals/vote':{ requests: 100, window: '1h' },
  'POST /auth/login':                    { requests: 10,  window: '15m' },
  'GET  /api/v1/orgs/:id/sar':           { requests: 500, window: '1h' },
  'POST /api/v1/*':                      { requests: 200, window: '1m' },  // global
};
```

---

## 8. Deployment & Infrastructure

### 8.1 Standalone Deployment — Docker Compose

```yaml
# docker-compose.yml — standalone, single org

services:
  polis:
    image: ghcr.io/polis/polis:latest
    ports: ["3000:3000"]
    environment:
      - DATABASE_URL=postgres://polis:${DB_PASSWORD}@db:5432/polis
      - POLIS_AI_KEY=${POLIS_AI_KEY}
      - POLIS_SESSION_SECRET=${SESSION_SECRET}
    depends_on: [db, redis]
    volumes:
      - ./polis.config.json:/app/polis.config.json:ro
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    volumes: [pgdata:/var/lib/postgresql/data]
    environment:
      - POSTGRES_DB=polis
      - POSTGRES_USER=polis
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    restart: unless-stopped

  caddy:
    image: caddy:2-alpine
    ports: ["80:80", "443:443"]
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
    restart: unless-stopped

volumes:
  pgdata:
  caddy_data:
```

**Caddyfile (auto TLS):**
```
your-domain.com {
  reverse_proxy polis:3000
}
```

### 8.2 SaaS Deployment — Kubernetes / Helm

```bash
# Add POLIS Helm repo
helm repo add polis https://charts.polis.app

# Install multi-tenant
helm install polis polis/polis \
  --set mode=multitenant \
  --set domain=polis.app \
  --set ai.provider=anthropic \
  --set-secret ai.apiKey=$ANTHROPIC_KEY \
  --set stripe.secretKeyRef=stripe-secret \
  --set replicas.api=3 \
  --set replicas.worker=2
```

**Kubernetes services provisioned:**

| Service | Replicas | Notes |
|---|---|---|
| `polis-api` | 3 min → 20 (HPA) | Main API; horizontal scale on CPU + request rate |
| `polis-worker` | 2 | SAR engine BullMQ consumer; stateless |
| `polis-frontend` | Static / CDN | Svelte build served via Cloudflare or nginx |
| `postgres` | Managed | AWS RDS or GCP Cloud SQL recommended |
| `redis` | Managed | Upstash or ElastiCache; not self-managed in prod |
| `ingress` | 2 | nginx ingress + cert-manager for wildcard TLS |

### 8.3 Recommended Hosting by Use Case

| Use Case | Recommended Stack | Estimated Monthly Cost |
|---|---|---|
| Standalone — small org (< 50 members) | Hetzner CX21 VPS + managed PG | ~$12/month |
| Standalone — large org (< 500 members) | Hetzner CX41 or Fly.io | ~$40/month |
| Standalone — enterprise / government | On-prem or private cloud K8s | Variable |
| SaaS — startup (< 200 tenants) | Fly.io API + Neon PG + Upstash Redis | ~$80–200/month |
| SaaS — growth (200–2000 tenants) | AWS ECS + RDS + ElastiCache | ~$400–800/month |
| SaaS — scale (2000+ tenants) | AWS EKS + Aurora + managed Redis | $1,500+/month |

### 8.4 Environment Variables Reference

```bash
# Required — all modes
DATABASE_URL=postgres://user:pass@host:5432/dbname
POLIS_SESSION_SECRET=<32-byte random hex>
POLIS_AI_KEY=<api key for configured provider>

# Required — multi-tenant only
STRIPE_SECRET=<sk_live_...>
STRIPE_WEBHOOK_SECRET=<whsec_...>
RESEND_API_KEY=<re_...>
PLATFORM_DOMAIN=polis.app

# Optional — standalone
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASS=<password>
LDAP_URL=ldap://ldap.example.com:389

# Optional — all modes
POLIS_LOG_LEVEL=info          # debug | info | warn | error
POLIS_LOG_FORMAT=json         # json | pretty
POLIS_MAX_UPLOAD_MB=10
POLIS_RATE_LIMIT_ENABLED=true
S3_BUCKET=polis-uploads
S3_REGION=us-east-1
S3_ACCESS_KEY=<key>
S3_SECRET_KEY=<secret>
```

---

## 9. API Design

### 9.1 REST API — Endpoint Reference

```
Base URL (SaaS):        https://api.polis.app/v1
Base URL (standalone):  https://your-domain.com/api/v1

Authentication:
  Header:   Authorization: Bearer <jwt>
  API Key:  X-API-Key: pk_live_xxxx

All responses:  JSON  ·  Content-Type: application/json
Error format:   { "error": { "code": "string", "message": "string" } }
```

**Organizations**
```
GET    /orgs/:id                    Get org details + constitution summary
PATCH  /orgs/:id                    Update org settings (admin only)
GET    /orgs/:id/stats              Dashboard stats: members, treasury, open votes
```

**Members**
```
GET    /orgs/:id/members            List members (filterable by status, role)
POST   /orgs/:id/members            Invite member (triggers SAR + welcome email)
GET    /orgs/:id/members/:mid       Get member detail + voting history
PATCH  /orgs/:id/members/:mid       Update member (admin only)
DELETE /orgs/:id/members/:mid       Remove member (admin only — triggers SAR)
```

**Proposals & Voting**
```
GET    /orgs/:id/proposals          List proposals (filter: status, type, date)
POST   /orgs/:id/proposals          Submit proposal → triggers SAR analysis async
GET    /orgs/:id/proposals/:pid     Full proposal + AI analysis + current tally
PATCH  /orgs/:id/proposals/:pid     Update draft (proposer only, while in draft)
POST   /orgs/:id/proposals/:pid/vote  Cast vote (authenticated member)
GET    /orgs/:id/proposals/:pid/votes  Vote breakdown by member
```

**Constitution & Laws**
```
GET    /orgs/:id/constitution       Full constitution with version history
GET    /orgs/:id/constitution/diff/:v1/:v2  Diff between versions
GET    /orgs/:id/laws               All operating laws
POST   /orgs/:id/laws               Propose new law (creates proposal)
```

**Treasury & Ledger**
```
GET    /orgs/:id/treasury           Treasury summary: balance, pool, reserve, next payout
GET    /orgs/:id/ledger             Paginated ledger (cursor-based)
POST   /orgs/:id/ledger             Record transaction (admin only → triggers SAR)
GET    /orgs/:id/ledger/export      Generate signed export URL (JSON / CSV / PDF)
```

**SAR Log**
```
GET    /orgs/:id/sar                SAR log (paginated, filterable by status/date/ref)
GET    /orgs/:id/sar/:sid           Single SAR entry
GET    /orgs/:id/sar/export         Export full log
```

**Platform Admin (SaaS only)**
```
GET    /platform/tenants            List all tenants + subscription status
PATCH  /platform/tenants/:id        Override plan limits, apply discounts
POST   /platform/tenants/:id/suspend  Suspend tenant
GET    /platform/usage              Platform-wide usage metrics
GET    /platform/costs              AI cost breakdown by tenant
```

### 9.2 WebSocket Events

```
Endpoint:  ws://api.polis.app/v1/orgs/:id/stream
Auth:      ?token=<jwt>  (query param on upgrade)

Events pushed to subscribers:

{ "type": "proposal.created",        "data": { proposalId, title, type } }
{ "type": "proposal.vote.cast",      "data": { proposalId, tally } }
{ "type": "proposal.status.changed", "data": { proposalId, status } }
{ "type": "proposal.analysis.ready", "data": { proposalId, aiAnalysis } }
{ "type": "sar.entry.created",       "data": { sarEntry } }
{ "type": "treasury.transaction",    "data": { txId, amount, balance } }
{ "type": "member.status.changed",   "data": { memberId, status } }
{ "type": "constitution.amended",    "data": { version, articleId } }
```

### 9.3 Webhooks (SaaS / Standalone Admin)

Org admins can register webhook URLs to receive events for integration with external systems.

```typescript
// Webhook payload envelope
interface WebhookPayload {
  id:        string;       // unique delivery ID
  orgId:     string;
  event:     string;       // same types as WebSocket events
  data:      unknown;
  timestamp: string;       // ISO 8601
  signature: string;       // HMAC-SHA256 of payload with webhook secret
}
```

---

## 10. Monetization & Revenue Model

### 10.1 Revenue Streams

| Stream | Model | Target ARR Contribution |
|---|---|---|
| **SaaS Subscriptions** | Collective ($29/mo) + Institution ($99/mo) | Primary — 70% |
| **AI Overage Billing** | $0.002/pass above plan limit | ~10% |
| **Self-Hosted License** | $499–$1,999/yr per deployment | ~10% |
| **White-Label License** | $4,999+/yr for branded instances | ~5% |
| **Implementation Services** | Setup, migration, constitution drafting | ~5% |
| **Marketplace (future)** | Templates, modules, integrations | — |

### 10.2 Unit Economics (Projected, Year 1)

| Metric | Community | Collective | Institution |
|---|---|---|---|
| Monthly price | $0 | $29 | $99 |
| Avg AI cost/tenant/mo | ~$0 (capped) | ~$8 | ~$18 |
| Avg overage revenue | $0 | ~$4 | ~$12 |
| **Blended ARPU** | **$0** | **~$25 gross margin** | **~$93 gross margin** |
| Estimated gross margin | — | ~86% | ~94% |

### 10.3 Self-Hosted License Model

Self-hosted deployments are licensed under a dual model:

**POLIS Community License (free):**
- Single organization, up to 20 members
- Personal, educational, and nonprofit use
- No commercial resale
- Full source access, modifications permitted

**POLIS Commercial License ($499–$1,999/yr):**
- Unlimited members and full features
- Commercial and government use
- Annual support entitlement
- Software updates included

**POLIS Enterprise License (custom pricing):**
- White-label rights
- SLA with guaranteed response times
- Custom AI model integration support
- On-site implementation assistance

### 10.4 Go-to-Market Strategy

**Phase 1 — Community (Months 1–6)**
- Launch free tier, target fraternal circles and savings cooperatives
- Organic growth via word-of-mouth in diaspora communities, credit union networks
- Open-source the core SAR engine to build developer community

**Phase 2 — Civic (Months 6–18)**
- Target small-to-medium municipal governments, HOAs, school boards
- Partner with civic tech organizations (Code for America, ICMA)
- Publish case study: Town of Maplewood demo as reference implementation

**Phase 3 — Enterprise (Months 18–36)**
- White-label offering for governance software resellers
- Federal / state government procurement track
- International expansion: UK parish councils, African savings cooperative networks

---

## 11. Roadmap

### v1.0 — Foundation (Current)
- [x] Core POLIS dashboard (town gov, fraternal trust, susu cooperative demos)
- [x] SAR engine with full reasoning transparency
- [x] AI founding wizard
- [x] Landing page
- [ ] Bun.js API backend with Drizzle + PostgreSQL
- [ ] Svelte 5 frontend connected to live API
- [ ] First-run setup wizard (mode selection)
- [ ] JWT auth + member management
- [ ] Proposal + voting system (live)
- [ ] Treasury ledger (live)

### v1.1 — Multi-Tenant Core
- [ ] Schema-per-tenant PostgreSQL isolation
- [ ] Subdomain routing middleware
- [ ] Stripe subscription integration
- [ ] Usage metering + billing worker
- [ ] Platform admin panel
- [ ] Custom domain provisioning

### v1.2 — AI & SAR Engine
- [ ] Pluggable AI provider system (Anthropic, OpenAI, Ollama)
- [ ] SAR engine full implementation (all 7 task types)
- [ ] Constitutional conflict detection
- [ ] Automated cycle monitoring (cron-based)
- [ ] AI charter generation (founding wizard → live backend)
- [ ] Batch audit report generation

### v1.3 — Self-Hosted Distribution
- [ ] Docker Compose packaging + docs
- [ ] Helm chart for Kubernetes
- [ ] First-run wizard standalone flow
- [ ] LDAP/SAML integration
- [ ] Offline AI support (Ollama integration)
- [ ] License enforcement (community vs commercial)

### v2.0 — Scale & Ecosystem
- [ ] WebSocket real-time events
- [ ] Public API + webhook system
- [ ] Marketplace foundation (constitution templates)
- [ ] Mobile app (Svelte Native or React Native)
- [ ] Multi-language support (Spanish, French, Yoruba priority)
- [ ] Blockchain ledger option for maximum auditability

---

## 12. Open Questions

These decisions are deferred pending further research or stakeholder input.

| # | Question | Options | Priority |
|---|---|---|---|
| 1 | **AI cost billing model** — Should AI overages be billed at actual cost + margin, or flat rate per pass regardless of model? | Cost-plus vs flat rate | High |
| 2 | **Ollama in SaaS mode** — Should hosted SaaS tenants be able to bring their own Ollama endpoint? Creates complexity but is attractive to privacy-conscious orgs | Yes / No | Medium |
| 3 | **Ledger currency support** — Should the ledger support multiple currencies / crypto, or USD-only for v1? | USD-only first | Medium |
| 4 | **Mobile strategy** — Native app vs progressive web app vs Svelte Native? | PWA first | Medium |
| 5 | **OSS license** — AGPL (viral, protects against cloud competitors) vs MIT (permissive, better for adoption) vs BSL (business source)? | AGPL vs MIT | High |
| 6 | **Constitution templates marketplace** — First-party only vs open to community contributions? Moderation model? | First-party for v1 | Low |
| 7 | **Blockchain ledger** — Opt-in feature using a public chain for maximum auditability? Who pays gas fees? | Optional add-on | Low |
| 8 | **Data residency** — Do we need region-specific deployment options for EU/GDPR compliance from day one? | EU region v1.2 | High |

---

*POLIS Governance Engine — Multi-Tenant Architecture Specification*
*Version 1.0 · Draft · Confidential*
*Built on Bun.js · TypeScript · Svelte 5 · PostgreSQL · SAR Engine*
