import { describe, expect, it } from 'bun:test';

import {
  REQUEST_ID_PREFIX,
  generateRequestId,
  isWellFormedRequestId,
  resolveRequestId,
} from './request-id';

describe('request id', () => {
  it('generates a prefixed, opaque id', () => {
    const id = generateRequestId();
    expect(id.startsWith(REQUEST_ID_PREFIX)).toBe(true);
    expect(isWellFormedRequestId(id)).toBe(true);
    expect(generateRequestId()).not.toBe(id);
  });

  it('accepts a well-formed inbound id', () => {
    const resolved = resolveRequestId({ 'x-request-id': 'req_0123456789abcdef' });
    expect(resolved).toEqual({ requestId: 'req_0123456789abcdef', inbound: true });
  });

  it('accepts the correlation-id header as an alternative', () => {
    expect(resolveRequestId({ 'x-correlation-id': 'trace-abc-123' }).inbound).toBe(true);
  });

  it('generates a fresh id when the inbound value is malformed', () => {
    for (const value of [
      '',
      'short',
      'has space in it',
      'inject\ninto-logs',
      '<script>x</script>',
    ]) {
      const resolved = resolveRequestId({ 'x-request-id': value });
      expect(resolved.inbound).toBe(false);
      expect(resolved.requestId.startsWith(REQUEST_ID_PREFIX)).toBe(true);
    }
  });

  it('rejects an over-long inbound id', () => {
    expect(isWellFormedRequestId('a'.repeat(129))).toBe(false);
    expect(isWellFormedRequestId('a'.repeat(128))).toBe(true);
  });

  it('takes the first value of a repeated header', () => {
    const resolved = resolveRequestId({ 'x-request-id': ['req_first_value', 'req_second_value'] });
    expect(resolved.requestId).toBe('req_first_value');
  });
});
