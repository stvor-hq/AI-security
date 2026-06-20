import { describe, it, expect } from 'bun:test';
import { HybridPQCTransport, PayloadHasher } from '../src/transport/pqc';

describe('HybridPQCTransport', () => {
  it('encrypts and decrypts a payload round-trip', () => {
    const aliceKeys = HybridPQCTransport.generateKeyPair();
    const bobKeys = HybridPQCTransport.generateKeyPair();

    const message = new TextEncoder().encode(JSON.stringify({
      jobId: 'job-test-001',
      task: 'Build ML pipeline'
    }));

    const encrypted = HybridPQCTransport.encrypt(
      message,
      bobKeys.classical.publicKey,
      bobKeys.pqc.publicKey
    );

    const decrypted = HybridPQCTransport.decrypt(
      encrypted,
      bobKeys.classical.privateKey,
      bobKeys.pqc.secretKey
    );

    expect(new TextDecoder().decode(decrypted)).toBe(new TextDecoder().decode(message));
  });

  it('produces different ciphertexts for same plaintext (IND-CPA)', () => {
    const keys = HybridPQCTransport.generateKeyPair();
    const msg = new TextEncoder().encode('same message');

    const enc1 = HybridPQCTransport.encrypt(msg, keys.classical.publicKey, keys.pqc.publicKey);
    const enc2 = HybridPQCTransport.encrypt(msg, keys.classical.publicKey, keys.pqc.publicKey);

    expect(Buffer.from(enc1.iv).toString('hex')).not.toBe(Buffer.from(enc2.iv).toString('hex'));
  });

  it('wrong key fails decryption', () => {
    const bobKeys = HybridPQCTransport.generateKeyPair();
    const eveKeys = HybridPQCTransport.generateKeyPair();
    const msg = new TextEncoder().encode('secret');

    const encrypted = HybridPQCTransport.encrypt(
      msg,
      bobKeys.classical.publicKey,
      bobKeys.pqc.publicKey
    );

    expect(() =>
      HybridPQCTransport.decrypt(encrypted, eveKeys.classical.privateKey, eveKeys.pqc.secretKey)
    ).toThrow();
  });
});

describe('PayloadHasher', () => {
  it('hashes deterministically', () => {
    const payload = { jobId: 'job-001', task: 'test' };
    expect(PayloadHasher.hashPayload(payload)).toBe(PayloadHasher.hashPayload(payload));
  });

  it('verifies correctly', () => {
    const payload = { jobId: 'job-001' };
    const hash = PayloadHasher.hashPayload(payload);
    expect(PayloadHasher.verifyHash(payload, hash)).toBe(true);
    expect(PayloadHasher.verifyHash({ jobId: 'job-002' }, hash)).toBe(false);
  });
});
