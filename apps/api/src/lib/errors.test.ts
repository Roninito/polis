import { describe, it, expect } from 'vitest';
import { Errors } from './errors';

describe('Error handling', () => {
  describe('Errors.badRequest', () => {
    it('should create a bad request error', () => {
      const error = Errors.badRequest('Missing email');
      expect(error.statusCode).toBe(400);
      expect(error.message).toContain('Missing email');
    });
  });

  describe('Errors.unauthorized', () => {
    it('should create an unauthorized error', () => {
      const error = Errors.unauthorized();
      expect(error.statusCode).toBe(401);
    });

    it('should accept custom message', () => {
      const error = Errors.unauthorized('Invalid token');
      expect(error.message).toContain('Invalid token');
    });
  });

  describe('Errors.forbidden', () => {
    it('should create a forbidden error', () => {
      const error = Errors.forbidden('Access denied');
      expect(error.statusCode).toBe(403);
      expect(error.message).toContain('Access denied');
    });
  });

  describe('Errors.notFound', () => {
    it('should create a not found error', () => {
      const error = Errors.notFound('User not found');
      expect(error.statusCode).toBe(404);
      expect(error.message).toContain('User not found');
    });
  });

  describe('Errors.conflict', () => {
    it('should create a conflict error', () => {
      const error = Errors.conflict('Email already exists');
      expect(error.statusCode).toBe(409);
      expect(error.message).toContain('Email already exists');
    });
  });

  describe('Errors.internal', () => {
    it('should create an internal server error', () => {
      const error = Errors.internal('Database failed');
      expect(error.statusCode).toBe(500);
      expect(error.message).toContain('Database failed');
    });
  });
});
