import { describe, it, expect, beforeEach, afterEach } from 'vitest';

/**
 * Test helpers and utilities for API testing
 */

export interface TestUser {
  id: string;
  email: string;
  password: string;
  name: string;
}

export interface TestOrg {
  id: string;
  name: string;
  slug: string;
}

export interface TestProposal {
  id: string;
  title: string;
  description: string;
}

/**
 * Create a test user with defaults
 */
export function createTestUser(overrides?: Partial<TestUser>): TestUser {
  return {
    id: overrides?.id || `user-${Date.now()}`,
    email: overrides?.email || `test-${Date.now()}@example.com`,
    password: overrides?.password || 'TestPassword123!',
    name: overrides?.name || 'Test User',
  };
}

/**
 * Create a test organization
 */
export function createTestOrg(overrides?: Partial<TestOrg>): TestOrg {
  return {
    id: overrides?.id || `org-${Date.now()}`,
    name: overrides?.name || 'Test Organization',
    slug: overrides?.slug || `test-org-${Date.now()}`,
  };
}

/**
 * Create a test proposal
 */
export function createTestProposal(overrides?: Partial<TestProposal>): TestProposal {
  return {
    id: overrides?.id || `prop-${Date.now()}`,
    title: overrides?.title || 'Test Proposal',
    description: overrides?.description || 'Test proposal description',
  };
}

/**
 * Mock successful API response
 */
export function mockSuccessResponse<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Mock error API response
 */
export function mockErrorResponse(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Assert response is successful
 */
export async function assertSuccessResponse(response: Response) {
  expect(response.status).toBeLessThan(400);
  expect(response.headers.get('Content-Type')).toContain('application/json');
}

/**
 * Assert response is an error
 */
export async function assertErrorResponse(response: Response, expectedStatus: number) {
  expect(response.status).toBe(expectedStatus);
  expect(response.headers.get('Content-Type')).toContain('application/json');
}

/**
 * Extract JSON from response
 */
export async function getResponseJson<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

/**
 * Create an authenticated request
 */
export function createAuthenticatedRequest(
  url: string,
  token: string,
  options?: RequestInit
): Request {
  return new Request(url, {
    ...options,
    headers: {
      ...options?.headers,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Sleep helper for async operations
 */
export async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
