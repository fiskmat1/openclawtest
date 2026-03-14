import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

const encryptionModeSchema = z.enum(['local', 'aws-kms']).default('local');

export const keys = () =>
  createEnv({
    server: {
      AGENTS_ENCRYPTION_MODE: encryptionModeSchema,
      AGENTS_ENCRYPTION_KEY: z.string().optional(),
      AGENTS_AWS_KMS_KEY_ID: z.string().optional(),
      AGENTS_KILO_API_KEY: z.string().optional(),
      AGENTS_E2B_API_KEY: z.string().optional(),
      AGENTS_E2B_TEMPLATE: z.string().optional(),
      AGENTS_E2B_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
      AGENTS_KILO_API_BASE_URL: z
        .url()
        .optional()
        .default('https://api-aggregator.k1x.io'),
      AGENTS_KERNEL_API_KEY: z.string().optional(),
      AGENTS_KERNEL_API_BASE_URL: z
        .url()
        .optional()
        .default('https://api.kernel.sh'),
      AGENTS_WEBHOOK_SECRET: z.string().optional(),
      AGENTS_OPENCLAW_RPC_ENDPOINT: z.url().optional(),
      AGENTS_OPENCLAW_SHARED_PASSWORD: z.string().optional(),
      AGENTS_TIKTOK_CLIENT_KEY: z.string().optional(),
      AGENTS_TIKTOK_CLIENT_SECRET: z.string().optional(),
      AGENTS_TIKTOK_REDIRECT_URI: z.string().optional(),
      AWS_REGION: z.string().optional()
    },
    runtimeEnv: {
      AGENTS_ENCRYPTION_MODE: process.env.AGENTS_ENCRYPTION_MODE,
      AGENTS_ENCRYPTION_KEY: process.env.AGENTS_ENCRYPTION_KEY,
      AGENTS_AWS_KMS_KEY_ID: process.env.AGENTS_AWS_KMS_KEY_ID,
      AGENTS_KILO_API_KEY: process.env.AGENTS_KILO_API_KEY,
      AGENTS_E2B_API_KEY: process.env.AGENTS_E2B_API_KEY,
      AGENTS_E2B_TEMPLATE: process.env.AGENTS_E2B_TEMPLATE,
      AGENTS_E2B_TIMEOUT_MS: process.env.AGENTS_E2B_TIMEOUT_MS,
      AGENTS_KILO_API_BASE_URL: process.env.AGENTS_KILO_API_BASE_URL,
      AGENTS_KERNEL_API_KEY: process.env.AGENTS_KERNEL_API_KEY,
      AGENTS_KERNEL_API_BASE_URL: process.env.AGENTS_KERNEL_API_BASE_URL,
      AGENTS_WEBHOOK_SECRET: process.env.AGENTS_WEBHOOK_SECRET,
      AGENTS_OPENCLAW_RPC_ENDPOINT: process.env.AGENTS_OPENCLAW_RPC_ENDPOINT,
      AGENTS_OPENCLAW_SHARED_PASSWORD:
        process.env.AGENTS_OPENCLAW_SHARED_PASSWORD,
      AGENTS_TIKTOK_CLIENT_KEY: process.env.AGENTS_TIKTOK_CLIENT_KEY,
      AGENTS_TIKTOK_CLIENT_SECRET: process.env.AGENTS_TIKTOK_CLIENT_SECRET,
      AGENTS_TIKTOK_REDIRECT_URI: process.env.AGENTS_TIKTOK_REDIRECT_URI,
      AWS_REGION: process.env.AWS_REGION
    }
  });
