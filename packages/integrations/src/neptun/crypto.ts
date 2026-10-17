import crypto from 'node:crypto';

/**
 * Resolves a 32-byte Buffer key for AES-256-GCM.
 * Supports 64-character hex strings or hashes raw strings via SHA-256.
 */
export function getEncryptionKey(keyString?: string): Buffer {
  const rawKey =
    keyString ||
    process.env.ICS_ENCRYPTION_KEY ||
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
    return Buffer.from(rawKey, 'hex');
  }

  return crypto.createHash('sha256').update(rawKey).digest();
}

/**
 * Encrypts a URL using AES-256-GCM with a random 12-byte IV.
 * Returns formatted string: "<iv_hex>:<tag_hex>:<ciphertext_hex>"
 */
export function encryptUrl(url: string, keyString?: string): string {
  const key = getEncryptionKey(keyString);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const encrypted = Buffer.concat([cipher.update(url, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts a URL string previously encrypted with encryptUrl.
 * Throws if authentication tag does not match or payload has been tampered with.
 */
export function decryptUrl(encryptedString: string, keyString?: string): string {
  const key = getEncryptionKey(keyString);
  const parts = encryptedString.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted URL format');
  }

  const [ivHex, tagHex, dataHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const encrypted = Buffer.from(dataHex, 'hex');

  if (tag.length !== 16) {
    throw new Error('Invalid authentication tag length');
  }

  const decipherWithKey = (key: Buffer): string => {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  };

  try {
    return decipherWithKey(getEncryptionKey(keyString));
  } catch (err) {
    if (!keyString) {
      const defaultKey = Buffer.from(
        '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        'hex',
      );
      return decipherWithKey(defaultKey);
    }
    throw err;
  }
}
