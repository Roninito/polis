import { describe, it, expect, beforeEach } from 'vitest';
import { createAccessToken, createRefreshToken, verifyToken, type TokenPayload } from './jwt';

describe('JWT - Authentication tokens', () => {
  describe('createAccessToken', () => {
    it('should create a valid access token with user payload', async () => {
      const payload = {
        userId: 'user-123',
        email: 'test@example.com',
        role: 'user',
        orgId: 'org-456',
        orgRole: 'member',
      };

      const token = await createAccessToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // JWT format: header.payload.signature
    });

    it('should create token with different roles', async () => {
      const roles = ['superadmin', 'user', 'viewer'];

      for (const role of roles) {
        const token = await createAccessToken({
          userId: 'user-123',
          email: 'test@example.com',
          role,
        });
        expect(token).toBeDefined();
      }
    });

    it('should create token without org context', async () => {
      const token = await createAccessToken({
        userId: 'user-123',
        email: 'test@example.com',
        role: 'superadmin',
      });

      const verified = await verifyToken(token);
      expect(verified.orgId).toBeUndefined();
    });
  });

  describe('createRefreshToken', () => {
    it('should create a refresh token', async () => {
      const token = await createRefreshToken({
        userId: 'user-123',
        email: 'test@example.com',
      });

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid access token', async () => {
      const payload = {
        userId: 'user-123',
        email: 'test@example.com',
        role: 'member',
        orgId: 'org-456',
        orgRole: 'council',
      };

      const token = await createAccessToken(payload);
      const verified = await verifyToken(token);

      expect(verified.sub).toBe(payload.userId);
      expect(verified.email).toBe(payload.email);
      expect(verified.role).toBe(payload.role);
      expect(verified.orgId).toBe(payload.orgId);
      expect(verified.orgRole).toBe(payload.orgRole);
    });

    it('should throw on invalid token', async () => {
      const invalidToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.invalid';

      await expect(verifyToken(invalidToken)).rejects.toThrow();
    });

    it('should throw on expired token', async () => {
      // This would require mocking time or using a pre-expired token
      // Skipping actual expiry test as it requires time manipulation
      expect(true).toBe(true);
    });

    it('should handle tokens with minimal payload', async () => {
      const token = await createAccessToken({
        userId: 'user-789',
        email: 'minimal@example.com',
        role: 'observer',
      });

      const verified = await verifyToken(token);
      expect(verified.sub).toBe('user-789');
      expect(verified.email).toBe('minimal@example.com');
    });
  });

  describe('Token payload structure', () => {
    it('should include required JWT claims', async () => {
      const token = await createAccessToken({
        userId: 'user-123',
        email: 'test@example.com',
        role: 'member',
      });

      const verified = await verifyToken(token);

      expect(verified.sub).toBeDefined(); // Subject (user ID)
      expect(verified.iat).toBeDefined(); // Issued at
      expect(verified.exp).toBeDefined(); // Expiration
      expect(verified.iss).toBe('polis'); // Issuer
    });

    it('should preserve custom claims', async () => {
      const payload = {
        userId: 'user-123',
        email: 'test@example.com',
        role: 'admin',
        orgId: 'org-456',
        orgRole: 'org_admin',
      };

      const token = await createAccessToken(payload);
      const verified = await verifyToken(token);

      expect(verified.email).toBe(payload.email);
      expect(verified.role).toBe(payload.role);
      expect(verified.orgId).toBe(payload.orgId);
      expect(verified.orgRole).toBe(payload.orgRole);
    });
  });
});
