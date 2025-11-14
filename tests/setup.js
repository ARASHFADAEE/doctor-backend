/**
 * Jest setup file
 * Runs before all tests
 */

require('dotenv').config({ path: '.env.test' });

// Set test environment variables
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';
process.env.DB_NAME = process.env.DB_NAME || 'medai_vision_test';
process.env.WORKER_ENABLED = 'false'; // Disable workers during tests

// Global test timeout
jest.setTimeout(10000);

// Suppress console logs during tests (optional)
if (process.env.SILENT_TESTS === 'true') {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  };
}
