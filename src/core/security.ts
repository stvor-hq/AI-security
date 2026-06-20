/**
 * @file Security guard for decrypted payload validation.
 *
 * Protects against prompt injection, buffer abuse, and toxic payloads
 * before any decrypted content is fed into downstream reasoning loops.
 */

import { Buffer } from 'buffer';

const DEFAULT_MAX_PAYLOAD_BYTES = 16_384;
const LLM_INJECTION_PATTERNS = [
  /ignore previous instructions/i,
  /disregard previous instructions/i,
  /system override/i,
  /export private keys?/i,
  /bypass safety/i,
  /drop all restrictions/i,
  /shutdown safety/i,
  /forget your instructions/i,
  /you are now dan/i,
  /<\s*script/i,
  /execute arbitrary/i,
  /delete all data/i,
  /disable (?:security|guard|validation)/i,
  /run without restrictions/i,
  /override.*policy/i,
];

export class SecurityGuard {
  static readonly MAX_PAYLOAD_BYTES = DEFAULT_MAX_PAYLOAD_BYTES;

  static assertPayloadSafe(payload: unknown): void {
    const normalized = this.normalizePayload(payload);
    const payloadString = JSON.stringify(normalized);
    const size = Buffer.byteLength(payloadString, 'utf8');

    if (size > this.MAX_PAYLOAD_BYTES) {
      throw new Error(
        `[SECURITY-ALERT] Payload too large (${size} bytes). Maximum allowed is ${this.MAX_PAYLOAD_BYTES} bytes.`,
      );
    }

    this.inspectValue(normalized, 'payload');
  }

  private static normalizePayload(payload: unknown): unknown {
    if (typeof payload === 'string') {
      return this.normalizeString(payload);
    }
    if (Array.isArray(payload)) {
      return payload.map((item) => this.normalizePayload(item));
    }
    if (typeof payload === 'object' && payload !== null) {
      return Object.fromEntries(
        Object.entries(payload as Record<string, unknown>).map(([key, value]) => [
          this.normalizeString(key),
          this.normalizePayload(value),
        ]),
      );
    }
    return payload;
  }

  private static normalizeString(value: string): string {
    const normalized = value.normalize('NFKC').replace(/\u0000/g, '');
    if (/\p{C}/u.test(normalized)) {
      throw new Error(`[SECURITY-ALERT] Unsupported control characters in payload string`);
    }
    return normalized;
  }

  private static inspectValue(value: unknown, path: string): void {
    if (value === null || value === undefined) {
      return;
    }

    if (typeof value === 'string') {
      if (this.isMaliciousString(value)) {
        throw new Error(
          `[SECURITY-ALERT] Malicious injection detected in ${path}: ${value}`,
        );
      }
      return;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return;
    }

    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) {
        this.inspectValue(value[index], `${path}[${index}]`);
      }
      return;
    }

    if (typeof value === 'object') {
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        this.inspectValue(child, `${path}.${key}`);
      }
      return;
    }

    if (typeof value === 'bigint') {
      return;
    }

    throw new Error(
      `[SECURITY-ALERT] Unsupported payload type detected in ${path}: ${typeof value}`,
    );
  }

  private static isMaliciousString(value: string): boolean {
    for (const pattern of LLM_INJECTION_PATTERNS) {
      if (pattern.test(value)) {
        return true;
      }
    }
    return false;
  }
}
