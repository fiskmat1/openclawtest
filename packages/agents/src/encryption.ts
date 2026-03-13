import crypto from 'crypto';
import {
  DecryptCommand,
  GenerateDataKeyCommand,
  KMSClient
} from '@aws-sdk/client-kms';

import { keys } from '../keys';

const AES_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

type LocalEnvelope = {
  mode: 'local';
  iv: string;
  tag: string;
  ciphertext: string;
};

type AwsKmsEnvelope = {
  mode: 'aws-kms';
  keyId: string;
  wrappedKey: string;
  iv: string;
  tag: string;
  ciphertext: string;
};

export type SecretEnvelope = LocalEnvelope | AwsKmsEnvelope;

function getLocalMasterKey(): Buffer {
  const env = keys();
  const rawKey = env.AGENTS_ENCRYPTION_KEY ?? process.env.AUTH_SECRET;
  if (!rawKey) {
    throw new Error(
      'Missing AGENTS_ENCRYPTION_KEY (or AUTH_SECRET fallback) for local encryption'
    );
  }

  return crypto.createHash('sha256').update(rawKey).digest();
}

function encryptWithKey(secret: string, key: Buffer): Omit<LocalEnvelope, 'mode'> {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(AES_ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(secret, 'utf8'),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();

  return {
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: encrypted.toString('base64')
  };
}

function decryptWithKey(
  envelope: Omit<LocalEnvelope, 'mode'>,
  key: Buffer
): string {
  const decipher = crypto.createDecipheriv(
    AES_ALGORITHM,
    key,
    Buffer.from(envelope.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
    decipher.final()
  ]);

  return decrypted.toString('utf8');
}

function createKmsClient(): KMSClient {
  const env = keys();
  return new KMSClient({
    region: env.AWS_REGION
  });
}

export async function encryptSecret(secret: string): Promise<string> {
  const env = keys();

  if (env.AGENTS_ENCRYPTION_MODE === 'aws-kms') {
    if (!env.AGENTS_AWS_KMS_KEY_ID) {
      throw new Error('Missing AGENTS_AWS_KMS_KEY_ID for aws-kms encryption');
    }

    const kms = createKmsClient();
    const result = await kms.send(
      new GenerateDataKeyCommand({
        KeyId: env.AGENTS_AWS_KMS_KEY_ID,
        KeySpec: 'AES_256'
      })
    );

    if (!result.Plaintext || !result.CiphertextBlob) {
      throw new Error('AWS KMS did not return a data key');
    }

    const encrypted = encryptWithKey(
      secret,
      Buffer.from(result.Plaintext as Uint8Array)
    );

    const envelope: AwsKmsEnvelope = {
      mode: 'aws-kms',
      keyId: env.AGENTS_AWS_KMS_KEY_ID,
      wrappedKey: Buffer.from(result.CiphertextBlob as Uint8Array).toString(
        'base64'
      ),
      ...encrypted
    };

    return JSON.stringify(envelope);
  }

  const envelope: LocalEnvelope = {
    mode: 'local',
    ...encryptWithKey(secret, getLocalMasterKey())
  };

  return JSON.stringify(envelope);
}

export async function decryptSecret(serializedEnvelope: string): Promise<string> {
  const envelope = JSON.parse(serializedEnvelope) as SecretEnvelope;

  if (envelope.mode === 'aws-kms') {
    const kms = createKmsClient();
    const response = await kms.send(
      new DecryptCommand({
        CiphertextBlob: Buffer.from(envelope.wrappedKey, 'base64'),
        KeyId: envelope.keyId
      })
    );

    if (!response.Plaintext) {
      throw new Error('AWS KMS could not decrypt the data key');
    }

    return decryptWithKey(
      {
        iv: envelope.iv,
        tag: envelope.tag,
        ciphertext: envelope.ciphertext
      },
      Buffer.from(response.Plaintext as Uint8Array)
    );
  }

  return decryptWithKey(
    {
      iv: envelope.iv,
      tag: envelope.tag,
      ciphertext: envelope.ciphertext
    },
    getLocalMasterKey()
  );
}
