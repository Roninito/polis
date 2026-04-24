/**
 * Database Query Optimization Strategies
 *
 * This file documents best practices for optimizing database queries
 * in the POLIS platform, including:
 * - Index usage and strategies
 * - N+1 query prevention
 * - Query batching and caching
 * - Connection pool management
 */

/**
 * INDEX STRATEGIES
 *
 * Primary Keys (automatic indexes):
 * - id (UUID) — all tables
 *
 * Foreign Key Indexes (performance):
 * - org_id — on members, proposals, laws, treasuries, api_keys, etc.
 * - user_id — on members, refresh_tokens, api_keys
 * - member_id — on votes, proposals (proposed_by)
 * - proposal_id — on votes, laws
 *
 * Search/Filter Indexes:
 * - status — on proposals, laws, members (for querying by state)
 * - created_at — on most tables (for sorting/date range queries)
 * - email — on users (for authentication lookups)
 * - org_id + status — composite for "get active proposals in org"
 *
 * Example Query Patterns Optimized:
 * - SELECT * FROM members WHERE org_id = ? AND status = 'active'
 * - SELECT * FROM proposals WHERE org_id = ? AND status = 'voting'
 * - SELECT * FROM votes WHERE proposal_id = ?
 * - SELECT * FROM users WHERE email = ?
 */

/**
 * N+1 QUERY PREVENTION
 *
 * Pattern: Do NOT fetch entities then their relations one-by-one
 *
 * ❌ Bad:
 * const proposals = await db.select().from(proposals).where(eq(proposals.orgId, orgId));
 * const voteCounts = {};
 * for (const p of proposals) {
 *   voteCounts[p.id] = await db.select().from(votes).where(eq(votes.proposalId, p.id));
 * }
 *
 * ✅ Good:
 * const proposals = await db.select().from(proposals)
 *   .where(eq(proposals.orgId, orgId))
 *   .leftJoin(votes, eq(votes.proposalId, proposals.id));
 *
 * ✅ Or use batch loading:
 * const proposalIds = proposals.map(p => p.id);
 * const voteCounts = await db.select()
 *   .from(votes)
 *   .where(inArray(votes.proposalId, proposalIds));
 */

/**
 * QUERY BATCHING
 *
 * When loading multiple resources, use IN clauses instead of multiple queries:
 *
 * ❌ Bad (N queries):
 * for (const memberId of memberIds) {
 *   const member = await db.select().from(members).where(eq(members.id, memberId));
 * }
 *
 * ✅ Good (1 query):
 * const members = await db.select().from(members)
 *   .where(inArray(members.id, memberIds));
 */

/**
 * QUERY CACHING
 *
 * Cache frequently-accessed, slow-changing data:
 *
 * - Organization settings (rarely change)
 * - Member lists (cache with 5-minute TTL)
 * - Completed proposals (immutable)
 * - Treasury balances (cache for 1 minute)
 *
 * Use Redis for distributed caching in multi-instance deployments.
 */

/**
 * CONNECTION POOL CONFIGURATION
 *
 * PostgreSQL:
 * - Pool size: 10-20 for small deployments, 30-50 for production
 * - Connection timeout: 30 seconds
 * - Idle timeout: 30 seconds
 * - Max connections: Leave 2-3 reserved for management
 *
 * SQLite:
 * - Supports one writer at a time (WAL mode mitigates)
 * - Use connection pooling with 1-5 connections
 * - Enable WAL mode for concurrent reads
 */

/**
 * QUERY PROFILING
 *
 * To identify slow queries:
 *
 * 1. Enable Drizzle query logging:
 *    const db = drizzle(sql, { logger: true });
 *
 * 2. Use EXPLAIN ANALYZE in PostgreSQL:
 *    EXPLAIN ANALYZE SELECT * FROM proposals WHERE org_id = ? AND status = 'voting';
 *
 * 3. Monitor with Prometheus metrics:
 *    - db_queries_total
 *    - db_query_duration_seconds
 *    - Filter by table, operation
 */

/**
 * COMMON SLOW QUERY PATTERNS TO AVOID
 *
 * 1. Aggregate without GROUP BY:
 *    ❌ SELECT COUNT(*) FROM votes; -- Scans entire table
 *    ✅ SELECT COUNT(*) FROM votes WHERE proposal_id = ?; -- Uses index
 *
 * 2. LIKE without leading character:
 *    ❌ SELECT * FROM users WHERE email LIKE '%example.com'; -- Full table scan
 *    ✅ SELECT * FROM users WHERE email = ?; -- Use exact match
 *
 * 3. Functions in WHERE clause:
 *    ❌ SELECT * FROM users WHERE DATE(created_at) = '2024-04-23'; -- Can't use index
 *    ✅ SELECT * FROM users WHERE created_at >= '2024-04-23' AND created_at < '2024-04-24';
 *
 * 4. OR with unindexed columns:
 *    ❌ SELECT * FROM proposals WHERE org_id = ? OR status = ?; -- May not use index
 *    ✅ Use compound indexes or separate queries with UNION
 */

export const queryOptimizationDoc = {
  indexStrategy: "See comments above",
  preventN1Queries: "Use joins or batch loading",
  enableQueryCaching: "Use Redis for distributed cache",
  configureConnectionPool: "See PostgreSQL/SQLite settings above",
  profileQueries: "Enable Drizzle logging and use EXPLAIN ANALYZE",
};
