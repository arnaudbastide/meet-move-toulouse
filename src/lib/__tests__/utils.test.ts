import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatDateTime, formatPrice, getFunctionsBaseUrl } from '../utils';

describe('formatPrice', () => {
  it('should format price in euros correctly', () => {
    expect(formatPrice(1500)).toBe('15,00 €');
    expect(formatPrice(0)).toBe('0,00 €');
    expect(formatPrice(100)).toBe('1,00 €');
    expect(formatPrice(123456)).toBe('1 234,56 €');
  });

  it('should handle negative values', () => {
    expect(formatPrice(-1000)).toBe('-10,00 €');
  });

  it('should handle undefined/null by converting to 0', () => {
    expect(formatPrice(undefined as any)).toBe('0,00 €');
    expect(formatPrice(null as any)).toBe('0,00 €');
  });

  it('should support different currencies', () => {
    expect(formatPrice(1000, 'USD')).toBe('10,00 $US');
    expect(formatPrice(1000, 'GBP')).toBe('10,00 £GB');
  });
});

describe('getFunctionsBaseUrl', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_FUNCTIONS_URL', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should return default localhost URL when env is not set', () => {
    vi.stubEnv('VITE_FUNCTIONS_URL', '');
    expect(getFunctionsBaseUrl()).toBe('http://localhost:8787');
  });

  it('should return the env URL when set', () => {
    vi.stubEnv('VITE_FUNCTIONS_URL', 'https://api.example.com');
    expect(getFunctionsBaseUrl()).toBe('https://api.example.com');
  });

  it('should remove trailing slash from URL', () => {
    vi.stubEnv('VITE_FUNCTIONS_URL', 'https://api.example.com/');
    expect(getFunctionsBaseUrl()).toBe('https://api.example.com');
  });

  it('should handle URLs with multiple trailing slashes', () => {
    vi.stubEnv('VITE_FUNCTIONS_URL', 'https://api.example.com///');
    expect(getFunctionsBaseUrl()).toBe('https://api.example.com');
  });
});

describe('formatDateTime', () => {
  it('returns an empty string for falsy values', () => {
    expect(formatDateTime(undefined)).toBe('');
    expect(formatDateTime(null)).toBe('');
  });

  it('formats ISO strings in French locale', () => {
    const formatted = formatDateTime('2024-05-20T14:30:00Z');
    expect(formatted).toMatch(/20 mai 2024/);
  });

  it('respects Date instances', () => {
    const date = new Date('2024-05-20T14:30:00Z');
    expect(formatDateTime(date)).toEqual(formatDateTime(date.toISOString()));
  });
});

