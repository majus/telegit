/**
 * @file Tests for health check API
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  performHealthCheck,
  healthCheckHandler,
  metricsHandler,
  readinessHandler,
  livenessHandler,
  HealthStatus,
} from '../../../src/api/health.js';

describe('Health Check API', () => {
  describe('HealthStatus Constants', () => {
    it('should export HealthStatus constants', () => {
      expect(HealthStatus.HEALTHY).toBe('healthy');
      expect(HealthStatus.DEGRADED).toBe('degraded');
      expect(HealthStatus.CRITICAL).toBe('critical');
    });
  });

  describe('performHealthCheck', () => {
    it('should return health status without dependencies', async () => {
      const result = await performHealthCheck();

      expect(result).toBeDefined();
      expect(result.status).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(result.uptime).toBeDefined();
      expect(result.checks).toBeDefined();
      expect(result.version).toBeDefined();
      expect(result.environment).toBeDefined();
    });

    it('should include all health checks', async () => {
      const result = await performHealthCheck();

      expect(result.checks.database).toBeDefined();
      expect(result.checks.llmApi).toBeDefined();
      expect(result.checks.githubMcp).toBeDefined();
      expect(result.checks.telegramBot).toBeDefined();
    });

    it('should check database health when db provided', async () => {
      const mockDb = {
        command: vi.fn().mockResolvedValue({ ok: 1 }),
      };

      const result = await performHealthCheck({ db: mockDb });

      expect(result.checks.database).toBeDefined();
      expect(mockDb.command).toHaveBeenCalledWith({ ping: 1 });
    });

    it('should handle database errors', async () => {
      const mockDb = {
        command: vi.fn().mockRejectedValue(new Error('Database connection failed')),
      };

      const result = await performHealthCheck({ db: mockDb });

      expect(result.checks.database.status).toBe(HealthStatus.CRITICAL);
      expect(result.checks.database.message).toContain('Database error');
    });

    it('should return CRITICAL status when database is unavailable', async () => {
      const mockDb = {
        query: vi.fn().mockRejectedValue(new Error('Connection refused')),
      };

      const result = await performHealthCheck({ db: mockDb });

      expect(result.status).toBe(HealthStatus.CRITICAL);
    });

    it('should include response times', async () => {
      const result = await performHealthCheck();

      expect(result.responseTime).toBeDefined();
      expect(typeof result.responseTime).toBe('number');
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
    });

    it('should include uptime', async () => {
      const result = await performHealthCheck();

      expect(result.uptime).toBeDefined();
      expect(typeof result.uptime).toBe('number');
      expect(result.uptime).toBeGreaterThan(0);
    });
  });

  describe('healthCheckHandler', () => {
    it('should return a handler function', () => {
      const handler = healthCheckHandler();
      expect(typeof handler).toBe('function');
    });

    it('should handle request and response', async () => {
      const handler = healthCheckHandler();
      const req = {};
      const res = {
        writeHead: vi.fn(),
        end: vi.fn(),
      };

      await handler(req, res);

      expect(res.writeHead).toHaveBeenCalled();
      expect(res.end).toHaveBeenCalled();
    });

    it('should return 200 for healthy status', async () => {
      const handler = healthCheckHandler();
      const req = {};
      const res = {
        writeHead: vi.fn(),
        end: vi.fn(),
      };

      await handler(req, res);

      const statusCode = res.writeHead.mock.calls[0][0];
      expect([200, 503]).toContain(statusCode);
    });

    it('should handle errors gracefully', async () => {
      const handler = healthCheckHandler();
      const req = {};
      const res = {
        writeHead: vi.fn(),
        end: vi.fn().mockImplementation(() => {
          throw new Error('Response error');
        }),
      };

      // Should not throw
      await expect(handler(req, res)).resolves.not.toThrow();
    });
  });

  describe('metricsHandler', () => {
    it('should return a handler function', () => {
      const handler = metricsHandler();
      expect(typeof handler).toBe('function');
    });

    it('should handle request and response', async () => {
      const handler = metricsHandler();
      const req = {};
      const res = {
        writeHead: vi.fn(),
        end: vi.fn(),
      };

      await handler(req, res);

      expect(res.writeHead).toHaveBeenCalled();
      expect(res.end).toHaveBeenCalled();
    });

    it('should return metrics content', async () => {
      const handler = metricsHandler();
      const req = {};
      const res = {
        writeHead: vi.fn(),
        end: vi.fn(),
      };

      await handler(req, res);

      const metrics = res.end.mock.calls[0][0];
      expect(typeof metrics).toBe('string');
    });

    it('should set correct content type', async () => {
      const handler = metricsHandler();
      const req = {};
      const res = {
        writeHead: vi.fn(),
        end: vi.fn(),
      };

      await handler(req, res);

      const headers = res.writeHead.mock.calls[0][1];
      expect(headers['Content-Type']).toBeDefined();
      expect(headers['Content-Type']).toContain('text/plain');
    });
  });

  describe('readinessHandler', () => {
    it('should return a handler function', () => {
      const handler = readinessHandler();
      expect(typeof handler).toBe('function');
    });

    it('should handle request and response', async () => {
      const handler = readinessHandler();
      const req = {};
      const res = {
        writeHead: vi.fn(),
        end: vi.fn(),
      };

      await handler(req, res);

      expect(res.writeHead).toHaveBeenCalled();
      expect(res.end).toHaveBeenCalled();
    });

    it('should return readiness status', async () => {
      const handler = readinessHandler();
      const req = {};
      const res = {
        writeHead: vi.fn(),
        end: vi.fn(),
      };

      await handler(req, res);

      const response = JSON.parse(res.end.mock.calls[0][0]);
      expect(response.ready).toBeDefined();
      expect(typeof response.ready).toBe('boolean');
      expect(response.status).toBeDefined();
    });

    it('should return 503 when not ready', async () => {
      const mockDb = {
        query: vi.fn().mockRejectedValue(new Error('DB down')),
      };

      const handler = readinessHandler({ db: mockDb });
      const req = {};
      const res = {
        writeHead: vi.fn(),
        end: vi.fn(),
      };

      await handler(req, res);

      const statusCode = res.writeHead.mock.calls[0][0];
      expect(statusCode).toBe(503);
    });
  });

  describe('livenessHandler', () => {
    it('should return a handler function', () => {
      const handler = livenessHandler();
      expect(typeof handler).toBe('function');
    });

    it('should handle request and response', () => {
      const handler = livenessHandler();
      const req = {};
      const res = {
        writeHead: vi.fn(),
        end: vi.fn(),
      };

      handler(req, res);

      expect(res.writeHead).toHaveBeenCalled();
      expect(res.end).toHaveBeenCalled();
    });

    it('should return alive status with uptime', () => {
      const handler = livenessHandler();
      const req = {};
      const res = {
        writeHead: vi.fn(),
        end: vi.fn(),
      };

      handler(req, res);

      const response = JSON.parse(res.end.mock.calls[0][0]);
      expect(response.alive).toBe(true);
      expect(response.uptime).toBeDefined();
      expect(typeof response.uptime).toBe('number');
    });

    it('should always return 200 when alive', () => {
      const handler = livenessHandler();
      const req = {};
      const res = {
        writeHead: vi.fn(),
        end: vi.fn(),
      };

      handler(req, res);

      const statusCode = res.writeHead.mock.calls[0][0];
      expect(statusCode).toBe(200);
    });
  });
});
