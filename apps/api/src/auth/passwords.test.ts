import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './passwords';

describe('Password hashing and verification', () => {
  describe('hashPassword', () => {
    it('should hash a password', async () => {
      const password = 'MySecurePassword123!';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(20); // bcrypt hashes are long
    });

    it('should produce different hashes for same password (salting)', async () => {
      const password = 'SamePassword123!';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2); // Different salts produce different hashes
    });

    it('should handle special characters in passwords', async () => {
      const passwords = [
        'P@ssw0rd!',
        'Pass "quoted" word',
        'Pass\twith\ttabs',
        '日本語パスワード',
        'мойпароль',
      ];

      for (const password of passwords) {
        const hash = await hashPassword(password);
        expect(hash).toBeDefined();
      }
    });

    it('should handle very long passwords', async () => {
      const longPassword = 'a'.repeat(256);
      const hash = await hashPassword(longPassword);
      expect(hash).toBeDefined();
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const password = 'CorrectPassword123!';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(password, hash);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'CorrectPassword123!';
      const wrongPassword = 'WrongPassword123!';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(wrongPassword, hash);

      expect(isValid).toBe(false);
    });

    it('should handle case-sensitive passwords', async () => {
      const password = 'MyPassword';
      const hash = await hashPassword(password);

      expect(await verifyPassword('MyPassword', hash)).toBe(true);
      expect(await verifyPassword('mypassword', hash)).toBe(false);
      expect(await verifyPassword('MYPASSWORD', hash)).toBe(false);
    });

    it('should handle empty passwords', async () => {
      const emptyPassword = '';
      const hash = await hashPassword(emptyPassword);
      const isValid = await verifyPassword(emptyPassword, hash);

      expect(isValid).toBe(true);
      expect(await verifyPassword('notEmpty', hash)).toBe(false);
    });

    it('should handle password with whitespace', async () => {
      const password = 'Pass word with spaces  ';
      const hash = await hashPassword(password);

      expect(await verifyPassword(password, hash)).toBe(true);
      expect(await verifyPassword('Pass word with spaces', hash)).toBe(false); // Extra spaces matter
    });
  });

  describe('Password security', () => {
    it('should not reveal password in hash', async () => {
      const password = 'SecretPassword123!';
      const hash = await hashPassword(password);

      expect(hash).not.toContain(password);
    });

    it('should not be reversible', async () => {
      const password = 'IrreversiblePassword123!';
      const hash = await hashPassword(password);

      // Hash should not contain the password
      expect(hash).not.toBe(password);
      expect(hash.includes(password)).toBe(false);
    });
  });
});
