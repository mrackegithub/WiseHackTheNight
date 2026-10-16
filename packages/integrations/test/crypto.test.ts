import { describe, expect, it } from 'vitest';
import { decryptUrl, encryptUrl } from '../src/neptun/crypto';

describe('AES-256-GCM URL encryption', () => {
  const sampleUrl = 'https://neptun.bme.hu/cal/secret_feed_token_123.ics';

  it('encrypts and decrypts URL correctly', () => {
    const encrypted = encryptUrl(sampleUrl);
    expect(encrypted).not.toBe(sampleUrl);
    expect(encrypted.split(':')).toHaveLength(3);

    const decrypted = decryptUrl(encrypted);
    expect(decrypted).toBe(sampleUrl);
  });

  it('produces different ciphertexts for the same URL due to random IV', () => {
    const enc1 = encryptUrl(sampleUrl);
    const enc2 = encryptUrl(sampleUrl);
    expect(enc1).not.toBe(enc2);

    expect(decryptUrl(enc1)).toBe(sampleUrl);
    expect(decryptUrl(enc2)).toBe(sampleUrl);
  });

  it('fails decryption when ciphertext is tampered with', () => {
    const encrypted = encryptUrl(sampleUrl);
    const parts = encrypted.split(':');
    const tamperedCiphertext =
      (parts[2][0] === 'a' ? 'b' : 'a') + parts[2].slice(1);
    const tampered = `${parts[0]}:${parts[1]}:${tamperedCiphertext}`;

    expect(() => decryptUrl(tampered)).toThrow();
  });

  it('fails decryption when auth tag is tampered with', () => {
    const encrypted = encryptUrl(sampleUrl);
    const parts = encrypted.split(':');
    const tamperedTag =
      (parts[1][0] === 'a' ? 'b' : 'a') + parts[1].slice(1);
    const tampered = `${parts[0]}:${tamperedTag}:${parts[2]}`;

    expect(() => decryptUrl(tampered)).toThrow();
  });

  it('rejects malformed encrypted strings', () => {
    expect(() => decryptUrl('not:valid')).toThrow(/invalid encrypted URL format/i);
    expect(() => decryptUrl('onlyonepart')).toThrow(/invalid encrypted URL format/i);
  });
});
