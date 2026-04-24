import { test, expect } from '@playwright/test';

test.describe('Authentication E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should register a new user', async ({ page }) => {
    // Navigate to register page
    await page.goto('/register');
    
    // Fill registration form
    await page.fill('input[type="email"]', `user-${Date.now()}@example.com`);
    await page.fill('input[name="name"]', 'Test User');
    await page.fill('input[type="password"]', 'Password123!');
    await page.fill('input[name="confirmPassword"]', 'Password123!');
    
    // Submit form
    await page.click('button:has-text("Register")');
    
    // Should redirect to setup or dashboard
    await expect(page).toHaveURL(/\/(setup|dashboard|org)/);
  });

  test('should login with valid credentials', async ({ page }) => {
    // Navigate to login
    await page.goto('/login');
    
    // Fill login form
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'Password123!');
    
    // Submit
    await page.click('button:has-text("Login")');
    
    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/(dashboard|org)/);
  });

  test('should reject login with wrong password', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'WrongPassword123!');
    await page.click('button:has-text("Login")');
    
    // Should show error message
    await expect(page.locator('text=Invalid credentials')).toBeVisible();
  });

  test('should logout user', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button:has-text("Login")');
    
    // Wait for redirect
    await page.waitForURL(/\/(dashboard|org)/);
    
    // Click logout
    await page.click('button:has-text("Logout")');
    
    // Should redirect to login
    await expect(page).toHaveURL('/login');
  });

  test('should prevent access to protected pages without auth', async ({ page }) => {
    // Try to access dashboard without login
    await page.goto('/org/123/proposals');
    
    // Should redirect to login
    await expect(page).toHaveURL('/login');
  });

  test('should complete full user flow: register -> setup -> create proposal -> vote', async ({ page }) => {
    const newUserEmail = `flow-test-${Date.now()}@example.com`;
    
    // 1. Register
    await page.goto('/register');
    await page.fill('input[type="email"]', newUserEmail);
    await page.fill('input[name="name"]', 'Flow Test User');
    await page.fill('input[type="password"]', 'FlowTest123!');
    await page.fill('input[name="confirmPassword"]', 'FlowTest123!');
    await page.click('button:has-text("Register")');
    
    // 2. Setup organization
    await expect(page).toHaveURL(/setup/);
    await page.fill('input[name="orgName"]', 'Test Organization');
    await page.fill('textarea[name="constitution"]', 'Test constitution');
    await page.click('button:has-text("Create")');
    
    // 3. Create proposal
    await page.goto('/org/*/proposals');
    await page.click('button:has-text("New Proposal")');
    await page.fill('textarea[name="title"]', 'Test Proposal');
    await page.fill('textarea[name="description"]', 'Test proposal description');
    await page.click('button:has-text("Submit")');
    
    // 4. Vote on proposal
    await page.click('button:has-text("Vote")');
    await page.click('input[value="yes"]');
    await page.click('button:has-text("Confirm")');
    
    // Should show confirmation
    await expect(page.locator('text=Vote recorded')).toBeVisible();
  });
});

test.describe('Organization Setup Flow', () => {
  test('should complete organization setup', async ({ page }) => {
    // Login and navigate to setup
    await page.goto('/setup');
    
    // Fill org details
    await page.fill('input[name="orgName"]', 'Test Org');
    await page.fill('input[name="slug"]', `org-${Date.now()}`);
    await page.fill('textarea[name="constitution"]', 'Our constitution');
    
    // Submit
    await page.click('button:has-text("Create")');
    
    // Should navigate to org dashboard
    await expect(page).toHaveURL(/org\//);
  });

  test('should add members to organization', async ({ page }) => {
    // Assume logged in and on org page
    await page.goto('/org/test-org/members');
    
    // Add member
    await page.click('button:has-text("Add Member")');
    await page.fill('input[type="email"]', 'member@example.com');
    await page.selectOption('select[name="role"]', 'member');
    await page.click('button:has-text("Invite")');
    
    // Should show success message
    await expect(page.locator('text=Invitation sent')).toBeVisible();
  });
});

test.describe('Proposal Creation and Voting', () => {
  test('should create a proposal', async ({ page }) => {
    await page.goto('/org/test-org/proposals');
    
    await page.click('button:has-text("New Proposal")');
    await page.fill('input[name="title"]', 'Test Proposal');
    await page.fill('textarea[name="description"]', 'Test description');
    await page.click('button:has-text("Submit")');
    
    await expect(page.locator('text=Proposal created')).toBeVisible();
  });

  test('should vote on a proposal', async ({ page }) => {
    await page.goto('/org/test-org/proposals/prop-123');
    
    // Vote
    await page.click('button:has-text("Vote")');
    await page.click('input[value="yes"]');
    await page.click('button:has-text("Submit")');
    
    // Should show confirmation
    await expect(page.locator('text=Vote recorded')).toBeVisible();
    
    // Vote should be visible
    await expect(page.locator('text=Your vote: Yes')).toBeVisible();
  });

  test('should view tally results', async ({ page }) => {
    await page.goto('/org/test-org/proposals/prop-123');
    
    // Click on results/tally
    await page.click('button:has-text("Results")');
    
    // Should show vote counts
    await expect(page.locator('text=Yes:')).toBeVisible();
    await expect(page.locator('text=No:')).toBeVisible();
  });
});
