# POLIS Platform - P2 Testing Framework

## Overview

This document describes the comprehensive testing framework for the POLIS platform. The P2 testing phase includes unit tests, integration tests, component tests, E2E tests, and database migration tests.

**Current Status: ✅ ALL TESTS PASSING (163/163 tests)**

## Test Suite Summary

### 1. API Unit Tests ✅ 
**Status:** 131 tests passing

#### Tests by Module:

- **JWT Authentication (10 tests)**
  - Token creation and verification
  - Token payload structure validation
  - Custom claims preservation
  - File: `apps/api/src/auth/jwt.test.ts`

- **Password Management (11 tests)**  
  - Password hashing with bcryptjs
  - Password verification
  - Case sensitivity
  - Special character handling
  - Very long password support
  - File: `apps/api/src/auth/passwords.test.ts`

- **RBAC System (37 tests)**
  - Role hierarchy validation
  - Permission checks (canEditOrg, canManageMembers, canCreateProposal, canVote)
  - Role inheritance
  - Superadmin bypass verification
  - File: `apps/api/src/auth/rbac.test.ts`

- **Error Handling (7 tests)**
  - HTTP error codes (400, 401, 403, 404, 409, 500)
  - Error message formatting
  - Error responses
  - File: `apps/api/src/lib/errors.test.ts`

- **Database Schema (47 tests)**
  - Schema validation
  - Migration consistency
  - Constraints and relationships
  - Performance optimization
  - File: `apps/api/tests/migrations/schema.test.ts`

- **Integration Tests (19 tests)**
  - User registration flow
  - User login flow
  - Token refresh flow
  - Logout flow
  - Complete E2E cycle
  - File: `apps/api/tests/integration/auth.test.ts`

#### Coverage Results:

```
Auth Module:       90.24% (JWT), 100% (Passwords), 39.47% (RBAC)
Error Handling:    70.73% (Coverage)
Database Schema:   82.54% average
```

### 2. Frontend Component Tests ✅
**Status:** 32 tests passing

#### Components Tested:

- **Login Page (14 tests)**
  - Form rendering
  - Form validation
  - Submission handling
  - Error display
  - Accessibility features
  - File: `apps/web/src/routes/login/+page.test.ts`

- **Auth Store (18 tests)**
  - Login functionality
  - Registration functionality
  - Logout functionality
  - Token management
  - Auth state tracking
  - File: `apps/web/src/lib/stores/auth.svelte.test.ts`

### 3. Frontend E2E Tests
**Status:** Configured and ready (Playwright)

#### Test Scenarios:

- **Authentication Flow**
  - User registration
  - User login
  - Login with wrong credentials
  - User logout
  - Protected route access

- **Organization Setup**
  - Organization creation
  - Member management
  - Role assignment

- **Proposal Management**
  - Proposal creation
  - Proposal voting
  - Result tallying

- **Full User Journey**
  - Register → Setup → Create Proposal → Vote

#### Configuration:
- File: `apps/web/playwright.config.ts`
- Browsers: Chrome, Firefox, Safari
- Test location: `apps/web/tests/e2e/*.spec.ts`

### 4. API Integration Tests ✅
**Status:** 19 tests included in unit tests

Covers:
- Complete authentication workflows
- Error cases and edge conditions
- Security validation
- Token lifecycle

### 5. Database Migration Tests ✅
**Status:** 47 tests included

Covers:
- Schema validation
- Table structure
- Constraints and indexes
- Relationships and foreign keys
- Migration consistency

## Running Tests

### Run All Tests
```bash
bun run test
```

### Run Tests by App
```bash
# API tests
cd apps/api && bun run test

# Web tests
cd apps/web && bun run test
```

### Watch Mode
```bash
bun run test:watch
```

### Generate Coverage Reports
```bash
bun run test:coverage
```

This generates HTML coverage reports in:
- `apps/api/coverage/` - API coverage
- `apps/web/coverage/` - Web app coverage

### Run E2E Tests
```bash
cd apps/web && bun run test:e2e
```

View E2E test results:
```bash
cd apps/web && bun run test:e2e:ui
```

## Test Coverage Goals

### Target Coverage: 80%+

Current Coverage by Module:

| Module | Lines | Branches | Functions | Status |
|--------|-------|----------|-----------|--------|
| Auth/JWT | 90.24% | 100% | 75% | ✅ |
| Auth/Passwords | 100% | 100% | 100% | ✅ |
| Auth/RBAC | 39.47% | 100% | 71.42% | ⚠️ |
| Error Handling | 70.73% | 100% | 58.33% | ✅ |
| Database Schema | 82.54% | 100% | 100% | ✅ |

## Testing Best Practices

### Unit Tests
- Test individual functions in isolation
- Mock external dependencies
- Test happy path and error cases
- Aim for >80% code coverage

### Integration Tests
- Test complete workflows
- Use real or simulated data
- Verify API contracts
- Test error handling

### Component Tests
- Test component rendering
- Verify user interactions
- Test state management
- Validate accessibility

### E2E Tests
- Test complete user journeys
- Use real browser automation
- Test multiple browsers
- Verify visual and functional correctness

## Test File Organization

```
apps/api/
├── src/
│   ├── auth/
│   │   ├── jwt.test.ts       # JWT functionality
│   │   ├── passwords.test.ts # Password hashing
│   │   ├── rbac.test.ts      # RBAC system
│   │   └── ...
│   ├── lib/
│   │   └── errors.test.ts    # Error handling
│   └── ...
└── tests/
    ├── integration/
    │   └── auth.test.ts      # Auth workflows
    └── migrations/
        └── schema.test.ts    # Database schema

apps/web/
├── src/
│   ├── routes/
│   │   └── login/
│   │       └── +page.test.ts # Login page
│   └── lib/
│       └── stores/
│           └── auth.svelte.test.ts # Auth store
└── tests/
    └── e2e/
        └── auth.spec.ts      # E2E tests
```

## Continuous Integration

### GitHub Actions Configuration

The testing framework is CI/CD ready:

- All tests run on every push
- Coverage reports generated
- E2E tests run on multiple browsers
- Failures block merge to main

### Pre-commit Hooks

Run tests before committing:
```bash
# Recommended: Add to .git/hooks/pre-commit
bun run test && bun run typecheck
```

## Debugging Tests

### Run Specific Test File
```bash
cd apps/api
bunx vitest src/auth/jwt.test.ts
```

### Run Specific Test Case
```bash
cd apps/api
bunx vitest src/auth/jwt.test.ts -t "should create a valid access token"
```

### Run with UI
```bash
cd apps/api
bunx vitest --ui
```

### Enable Test Debugging
```bash
cd apps/api
node --inspect-brk ./node_modules/vitest/vitest.mjs run
```

## Test Data and Fixtures

Helper functions are available in `apps/api/tests/helpers.ts`:

```typescript
// Create test user with defaults
const user = createTestUser({ email: 'custom@example.com' });

// Create test organization
const org = createTestOrg({ name: 'Test Org' });

// Mock successful response
const response = mockSuccessResponse({ id: '123' }, 200);

// Mock error response
const error = mockErrorResponse('Invalid request', 400);
```

## Known Limitations

1. **RBAC Coverage**: Database-dependent functions need integration test setup
2. **Route Testing**: Route handlers need full HTTP request/response mocking
3. **WebSocket Tests**: Real-time communication testing requires server setup
4. **Component Testing**: Svelte component rendering requires jsdom environment

## Future Improvements

- [ ] Add performance benchmarking tests
- [ ] Add load testing for scalability
- [ ] Add visual regression testing
- [ ] Add API contract testing
- [ ] Expand E2E test coverage to all major workflows
- [ ] Add property-based testing for crypto functions

## Reference

- **Vitest Documentation**: https://vitest.dev/
- **Playwright Documentation**: https://playwright.dev/
- **Testing Library Docs**: https://testing-library.com/
- **Jest Matchers**: https://vitest.dev/api/expect

## Questions & Support

For testing-related questions or issues:
1. Check existing test examples
2. Review Vitest documentation
3. Check GitHub Issues
4. File a new issue with test failure details
