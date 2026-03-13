import assert from 'node:assert/strict';
import test from 'node:test';

import { decryptSecret, encryptSecret } from './encryption';

test('encryptSecret and decryptSecret round-trip in local mode', async () => {
  const originalMode = process.env.AGENTS_ENCRYPTION_MODE;
  const originalKey = process.env.AGENTS_ENCRYPTION_KEY;

  process.env.AGENTS_ENCRYPTION_MODE = 'local';
  process.env.AGENTS_ENCRYPTION_KEY = 'test-local-encryption-key';

  try {
    const encrypted = await encryptSecret('super-secret-token');
    const decrypted = await decryptSecret(encrypted);

    assert.notEqual(encrypted, 'super-secret-token');
    assert.equal(decrypted, 'super-secret-token');
  } finally {
    process.env.AGENTS_ENCRYPTION_MODE = originalMode;
    process.env.AGENTS_ENCRYPTION_KEY = originalKey;
  }
});
