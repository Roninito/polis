# POLIS Contributing Guide

**Version:** 1.0  
**Last Updated:** 2025-04-23  
**Audience:** Developers, Contributors

## Table of Contents

1. [Getting Started](#getting-started)
2. [Project Structure](#project-structure)
3. [Local Development Setup](#local-development-setup)
4. [Development Workflow](#development-workflow)
5. [Testing Strategy](#testing-strategy)
6. [Code Style & Conventions](#code-style--conventions)
7. [Git Workflow & PR Process](#git-workflow--pr-process)
8. [Commit Message Guidelines](#commit-message-guidelines)
9. [Common Tasks](#common-tasks)
10. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Prerequisites

- **Bun 1.3+** ([Install](https://bun.sh/))
- **Git** (for version control)
- **PostgreSQL 16+** or Docker (for database)
- **Node.js** (optional; Bun provides this)
- **macOS, Linux, or WSL** (Windows users: use WSL2)

### Quick Start (5 minutes)

```bash
# 1. Clone the repository
git clone https://github.com/yourorg/polis.git
cd polis

# 2. Install dependencies
bun install

# 3. Start development environment
docker compose up -d

# 4. Initialize database
bun run db:migrate

# 5. Start development servers
bun run dev          # Frontend + embedded API at http://localhost:5173
# In another terminal:
bun run dev:api      # Standalone API at http://localhost:3143
```

✅ You're ready to develop!

---

## Project Structure

```
polis/
├── apps/
│   ├── api/                      # Backend API server
│   │   ├── src/
│   │   │   ├── index.ts          # Standalone entry point
│   │   │   ├── handler.ts        # HTTP handler (shared with SvelteKit)
│   │   │   ├── auth/
│   │   │   │   └── routes.ts     # Auth endpoints (register, login, logout)
│   │   │   ├── api/
│   │   │   │   ├── orgs/         # Organization management
│   │   │   │   ├── members/      # Membership operations
│   │   │   │   ├── proposals/    # Proposal CRUD and voting
│   │   │   │   └── treasury/     # Financial tracking
│   │   │   ├── db/
│   │   │   │   ├── schema/       # Drizzle ORM schema (PostgreSQL)
│   │   │   │   ├── schema-sqlite/# Drizzle ORM schema (SQLite)
│   │   │   │   └── migrations/   # Database migrations
│   │   │   ├── sar/              # SAR engine (AI analysis)
│   │   │   ├── ws/               # WebSocket handling
│   │   │   └── jobs/             # Background job processing
│   │   └── package.json
│   │
│   └── web/                      # Frontend SvelteKit app
│       ├── src/
│       │   ├── routes/           # SvelteKit routes (filesystem routing)
│       │   │   ├── +layout.svelte # Root layout
│       │   │   ├── +page.svelte  # Home page
│       │   │   ├── login/        # Login page
│       │   │   ├── register/     # Registration page
│       │   │   └── org/[id]/     # Organization pages
│       │   ├── lib/
│       │   │   ├── api.ts        # API client
│       │   │   ├── stores.ts     # Svelte stores (reactive state)
│       │   │   ├── auth.ts       # Auth utilities
│       │   │   └── components/   # Reusable Svelte components
│       │   └── app.css           # Global styles
│       ├── static/               # Static assets
│       └── package.json
│
├── packages/
│   └── sar/                      # SAR engine shared package
│       └── src/
│           └── engine.ts         # AI provider abstraction
│
├── deploy/                       # Deployment artifacts
│   ├── Dockerfile                # Multi-stage Docker build
│   ├── docker-compose.prod.yml   # Production Docker Compose
│   ├── Caddyfile                 # Caddy reverse proxy config
│   └── k8s/                      # Kubernetes manifests
│
├── data/                         # Development data
│   └── polis.db                  # SQLite database (dev)
│
├── docker-compose.yml            # Development Docker Compose
├── package.json                  # Root workspace package.json
├── bun.lock                       # Bun lockfile
├── bunfig.toml                   # Bun configuration
├── tsconfig.json                 # TypeScript configuration
└── README.md                     # Project README
```

### Key Files to Know

| File | Purpose |
|------|---------|
| `apps/api/src/index.ts` | Entry point for API server |
| `apps/api/src/handler.ts` | HTTP request handler (shared with SvelteKit) |
| `apps/api/src/db/schema/` | Database schema definitions |
| `apps/web/src/routes/` | Frontend routes (filesystem routing) |
| `docker-compose.yml` | Development environment setup |
| `docker-compose.prod.yml` | Production setup (in `deploy/`) |
| `package.json` | Workspace root; defines commands |

---

## Local Development Setup

### 1. Install Dependencies

```bash
# Install Bun (if not already installed)
curl -fsSL https://bun.sh/install | bash

# Verify Bun
bun --version
# Output: 1.3.x

# Install project dependencies
bun install

# Verify installation
bun run typecheck  # Should succeed
```

### 2. Set Up Environment

```bash
# Copy example environment
cp .env.example .env

# Edit .env with your settings (optional for development)
# Defaults in docker-compose.yml usually work fine
```

### 3. Start PostgreSQL and Redis

**Option A: Docker Compose (recommended)**

```bash
# Start all services
docker compose up -d

# Verify services are healthy
docker compose ps
```

**Option B: Manual installation (macOS)**

```bash
# Install PostgreSQL
brew install postgresql@16 redis

# Start services
brew services start postgresql@16
brew services start redis

# Create database
createdb -U postgres polis

# Create user
psql -U postgres -c "CREATE USER polis WITH PASSWORD 'polis';"
```

### 4. Initialize Database

```bash
# Generate schema from TypeScript definitions
bun run db:generate

# Apply migrations
bun run db:migrate

# Optional: Seed demo data
bun run db:seed-demo
```

### 5. Start Development Servers

**Terminal 1: Frontend + Embedded API**

```bash
bun run dev

# Output:
# ➜  Local:   http://localhost:5173/
# ➜  press h to show help
```

**Terminal 2: Standalone API (optional)**

```bash
bun run dev:api

# Output:
# [polis] Standalone API server at http://0.0.0.0:3143
```

✅ **Frontend:** http://localhost:5173  
✅ **API:** http://localhost:3143  
✅ **PostgreSQL:** localhost:5432  
✅ **Redis:** localhost:6379

---

## Development Workflow

### Creating a New Feature

**Step 1: Create a branch**

```bash
git checkout -b feature/my-new-feature
```

Branch naming convention:
- `feature/description` — New feature
- `fix/description` — Bug fix
- `docs/description` — Documentation
- `refactor/description` — Code refactoring
- `test/description` — Testing improvements

**Step 2: Understand the architecture**

For a voting feature:
- **API route:** `apps/api/src/api/proposals/routes.ts`
- **Database schema:** `apps/api/src/db/schema/governance.ts`
- **Frontend page:** `apps/web/src/routes/org/[id]/proposals/[pid]/`

**Step 3: Implement changes**

```bash
# Make your code changes
# Code will auto-reload via hot-reload (SvelteKit)

# Run typechecker to catch errors early
bun run typecheck

# Run tests (if they exist)
bun run test
```

**Step 4: Test locally**

```bash
# Test API manually
curl -X GET http://localhost:3143/api/orgs \
  -H "Authorization: Bearer <jwt-token>"

# Or test via frontend UI at http://localhost:5173

# Check database changes
docker compose exec db psql -U polis -d polis -c "SELECT * FROM proposals LIMIT 5;"
```

**Step 5: Commit changes**

```bash
git add .
git commit -m "feat(proposals): add voting interface"  # See commit conventions below
```

**Step 6: Push and create PR**

```bash
git push origin feature/my-new-feature

# GitHub will show a prompt to create a PR
# Open https://github.com/yourorg/polis/pulls
```

### Modifying the Database Schema

When you need to add a new table or column:

**Step 1: Update schema file**

```typescript
// apps/api/src/db/schema/governance.ts
import { pgTable, text, timestamp, integer } from 'drizzle-orm/pg-core';

export const proposals = pgTable('proposals', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  // NEW FIELD:
  votingEndAt: timestamp('voting_end_at'),
});
```

**Step 2: Generate migration**

```bash
bun run db:generate

# Output: Created drizzle/0009_voting_end_at.sql
```

**Step 3: Review and apply**

```bash
# Review the generated SQL
cat drizzle/0009_voting_end_at.sql

# Apply to your local database
bun run db:migrate

# Verify
docker compose exec db psql -U polis -d polis -c "\d proposals"
```

**Step 4: Commit migration**

```bash
git add apps/api/src/db/ drizzle/
git commit -m "feat(schema): add voting_end_at to proposals"
```

### Adding an API Endpoint

**Step 1: Add route handler**

```typescript
// apps/api/src/api/proposals/routes.ts
import { Hono } from 'hono';

const router = new Hono();

// GET /api/proposals/:id/results
router.get('/:id/results', async (c) => {
  const { id } = c.req.param();
  const { userId } = c.req.user;  // From auth middleware

  const results = await db.query.proposals.findFirst({
    where: eq(proposals.id, id),
    with: {
      votes: true,
    },
  });

  if (!results) {
    return c.json({ error: 'Not found' }, 404);
  }

  return c.json(results);
});

export default router;
```

**Step 2: Register route**

```typescript
// apps/api/src/handler.ts
import proposalRoutes from './api/proposals/routes';

const app = new Hono()
  .route('/api/proposals', proposalRoutes);
  // ... other routes
```

**Step 3: Test endpoint**

```bash
curl -X GET http://localhost:3143/api/proposals/prop123/results \
  -H "Authorization: Bearer <token>"
```

**Step 4: Add frontend component**

```svelte
<!-- apps/web/src/routes/org/[id]/proposals/[pid]/results.svelte -->
<script>
  import { onMount } from 'svelte';

  let results = null;
  let error = null;

  onMount(async () => {
    try {
      const response = await fetch(
        `/api/proposals/${pid}/results`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      results = await response.json();
    } catch (err) {
      error = err.message;
    }
  });
</script>

<div>
  {#if results}
    <h2>Voting Results</h2>
    <p>Yes: {results.yesCount}</p>
    <p>No: {results.noCount}</p>
  {/if}
  {#if error}
    <p class="error">{error}</p>
  {/if}
</div>

<style>
  .error { color: red; }
</style>
```

---

## Testing Strategy

### Approach: Manual Testing + Unit Tests (as needed)

Currently, POLIS uses **manual testing** and integration tests. For critical business logic, unit tests are recommended.

### Running Tests (If Available)

```bash
# Run all tests
bun test

# Run specific test file
bun test tests/auth.test.ts

# Run with coverage
bun test --coverage
```

### Manual Testing Checklist

When submitting a PR, manually test these scenarios:

**Authentication:**
- [ ] Can register with email + password
- [ ] Can login with correct credentials
- [ ] Cannot login with wrong password
- [ ] JWT token is valid and has correct claims

**Organization:**
- [ ] Can create organization
- [ ] Can view organization members
- [ ] Can invite members (if email configured)
- [ ] Can remove members

**Proposals:**
- [ ] Can create proposal
- [ ] Can see proposal in list
- [ ] Can vote on open proposal
- [ ] Cannot vote after voting period closed
- [ ] Cannot vote twice

**Real-time:**
- [ ] New member appears in members list (real-time)
- [ ] New proposal appears in list (real-time)
- [ ] Vote counts update (real-time)

### Testing WebSocket Updates

```bash
# Terminal 1: Watch WebSocket messages
curl -i -N -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  http://localhost:3143/ws?token=<jwt>

# Terminal 2: Make a change (e.g., add member)
curl -X POST http://localhost:3143/api/orgs/org123/members \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"email":"newuser@example.com"}'

# Terminal 1: Should receive WebSocket message
# Expected: { event: "member:added", data: {...} }
```

---

## Code Style & Conventions

### TypeScript

✅ **DO:**

```typescript
// Use strict types
function addMember(orgId: string, email: string): Promise<Member> {
  // ...
}

// Use const for immutable values
const MAX_MEMBERS = 1000;

// Use interfaces for contracts
interface CreateProposalRequest {
  title: string;
  description: string;
  type: 'vote' | 'poll';
}

// Use enums for fixed sets
enum ProposalStatus {
  OPEN = 'open',
  CLOSED = 'closed',
  EXECUTED = 'executed',
}
```

❌ **AVOID:**

```typescript
// Avoid `any`
function addMember(orgId: any, email: any) { }

// Avoid `var` (use `const` or `let`)
var members = [];

// Avoid implicit types
const status = 'open';  // Should be: const status: ProposalStatus = 'open';
```

### File Organization

```typescript
// 1. Imports
import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from './db/client';

// 2. Type definitions
interface Proposal {
  id: string;
  title: string;
}

// 3. Constants
const MAX_TITLE_LENGTH = 255;

// 4. Main function/class
export async function getProposal(id: string): Promise<Proposal> {
  // ...
}

// 5. Exports
export { getProposal };
```

### Naming Conventions

| What | Convention | Example |
|------|-----------|---------|
| File | lowercase-kebab-case | `routes.ts`, `db-client.ts` |
| Directory | lowercase | `api/`, `db/` |
| Constant | UPPER_SNAKE_CASE | `MAX_RETRIES`, `DEFAULT_TIMEOUT` |
| Variable | camelCase | `userId`, `memberCount` |
| Function | camelCase | `getProposal()`, `addMember()` |
| Class | PascalCase | `ProposalService`, `Database` |
| Interface | PascalCase (no `I` prefix) | `Proposal`, `Member` |
| Enum | PascalCase | `ProposalStatus` |

### Formatting

```bash
# Format code with Prettier (auto-runs on commit)
bun run format

# Or let it auto-run on save (configure in editor)
```

**Prettier config** (in `package.json`):
```json
{
  "prettier": {
    "semi": true,
    "singleQuote": true,
    "trailingComma": "es5",
    "printWidth": 100
  }
}
```

### Comments

✅ **Write comments for WHY, not WHAT:**

```typescript
// ✅ Good: Explains the business logic
// We use exponential backoff to avoid overwhelming the AI provider
// when it's temporarily unavailable (e.g., during maintenance)
async function callAIWithRetry(prompt: string, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await callAI(prompt);
    } catch (err) {
      const delay = Math.pow(2, i) * 1000;
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

// ❌ Bad: Explains what the code does (obvious from reading)
// Loop through retries
// Calculate exponential backoff
// Sleep for the delay
```

---

## Git Workflow & PR Process

### Branch Workflow

```
main (stable, production-ready)
  ↑
  │ ← feature/my-feature (your work)
  │   └─ unit tests ✓
  │   └─ manual testing ✓
  │   └─ code review ✓
  │   └─ merge
  └─ (merge)
```

### Creating a Pull Request

**Step 1: Push your branch**

```bash
git push origin feature/my-feature
```

**Step 2: Open PR on GitHub**

Go to https://github.com/yourorg/polis/pulls and click "New Pull Request"

**Step 3: Fill PR template**

```markdown
## Description
What does this PR do?

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation

## Testing
How did you test this?

## Checklist
- [ ] TypeScript compiles (`bun run typecheck`)
- [ ] Manual testing completed
- [ ] Code follows style guide
- [ ] No console.error or console.log left (except logging)
- [ ] Database migrations reviewed (if applicable)
```

**Step 4: Request review**

Add reviewers, link any related issues

### Code Review Checklist

Reviewers should check:

- ✅ Code follows TypeScript and style conventions
- ✅ Logic is correct and handles edge cases
- ✅ No N+1 database queries
- ✅ Security: No SQL injection, auth checks, rate limiting
- ✅ Performance: No unbounded loops, reasonable time complexity
- ✅ Tests pass, coverage is adequate
- ✅ Documentation updated (if public API changed)

### Merging

```bash
# Maintainers only: after approval, merge to main
# Usually done via GitHub "Squash and merge" button
# This keeps main history clean

# Or manually:
git checkout main
git pull origin main
git merge feature/my-feature
git push origin main
```

---

## Commit Message Guidelines

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Examples

```
feat(proposals): add voting deadline validation

- Validate that voting deadline is in the future
- Show error message to user if invalid
- Update API docs

Closes #123

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

```
fix(auth): prevent session hijacking via JWT expiration

- Reduce JWT TTL from 7 days to 1 day
- Add refresh token endpoint
- Audit trail for token refresh

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

### Types

| Type | When to use |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation changes |
| `refactor` | Code refactoring (no functionality change) |
| `test` | Adding or updating tests |
| `chore` | Build, dependencies, etc. |
| `perf` | Performance improvement |

### Scope

Scope should be the feature area:
- `proposals` — Proposal module
- `auth` — Authentication
- `members` — Member management
- `db` — Database changes
- `api` — General API
- `web` — Frontend

---

## Common Tasks

### Adding a New Environment Variable

```bash
# 1. Add to .env.example
echo "NEW_VAR=default_value" >> .env.example

# 2. Use in code
const newVar = process.env.NEW_VAR ?? 'default';

# 3. Document in .env (add comment)
echo "# NEW_VAR — what this variable does" >> .env.example

# 4. Update DEPLOYMENT.md if this is a user-facing config

# 5. Test
NEW_VAR=test_value bun run dev
```

### Debugging Database Issues

```bash
# Connect to database directly
docker compose exec db psql -U polis -d polis

# Common queries:
SELECT * FROM users LIMIT 5;
SELECT * FROM proposals WHERE org_id = 'org123';
SELECT COUNT(*) FROM votes WHERE proposal_id = 'prop456';

# Check schema
\d proposals
\d+ proposals  -- more detailed

# Exit
\q
```

### Inspecting API Responses

```bash
# Make an API call and pretty-print response
curl -s http://localhost:3143/api/orgs \
  -H "Authorization: Bearer <token>" | jq .

# Check response headers
curl -i http://localhost:3143/api/orgs

# Test WebSocket
websocat ws://localhost:3143/ws?token=<token>
```

### Restarting Services

```bash
# Restart just the API
docker compose restart polis

# Or restart database
docker compose restart db

# Or everything
docker compose restart

# Stop all
docker compose down
```

### Viewing Logs

```bash
# Stream API logs
docker compose logs -f polis

# View database logs
docker compose logs -f db

# View Redis logs
docker compose logs -f redis

# View last N lines
docker compose logs -f polis --tail=50
```

---

## Troubleshooting

### Issue: "Cannot find module" error

```bash
# Run install again
bun install

# Or clear cache and reinstall
rm -rf node_modules bun.lock
bun install
```

### Issue: Database migration fails

```bash
# Check migration status
bun run db:generate

# If schema is out of sync, you may need to reset (dev only):
docker compose down -v  # -v removes volumes (data deleted!)
docker compose up -d
bun run db:migrate
```

### Issue: TypeScript errors in IDE

```bash
# Update IDE TypeScript version to match project
# In VS Code: Cmd+Shift+P → "TypeScript: Select TypeScript Version"
# Choose "Use Workspace Version"

# Or run typecheck
bun run typecheck
```

### Issue: Hot reload not working

```bash
# Restart dev server
# Ctrl+C in terminal, then:
bun run dev
```

### Issue: Port already in use

```bash
# Find process using port 3143
lsof -i :3143

# Kill process
kill <PID>

# Or use different port
PORT=3144 bun run dev
```

---

## Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Hono Documentation](https://hono.dev/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [SvelteKit Documentation](https://kit.svelte.dev/)
- [Bun Documentation](https://bun.sh/docs/)

---

**Need help?** Open an issue or discuss in GitHub Discussions.

**Found a bug?** Please report it with reproduction steps.

**Have a feature idea?** Start a discussion before opening a PR.
