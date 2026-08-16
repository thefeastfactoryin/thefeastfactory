import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  API_PORT: z.coerce.number().default(4000),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  API_PUBLIC_URL: z.string().url().default('http://localhost:4000'),
  API_CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000,http://localhost:3001'),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  BCRYPT_SALT_ROUNDS: z.coerce.number().default(12),
  MSG91_AUTH_KEY: z.string().optional().default(''),
  MSG91_TEMPLATE_ID: z.string().optional().default(''),
  MSG91_FLOW_ID: z.string().optional().default(''),
  MSG91_SENDER_ID: z.string().optional().default(''),
  MSG91_OTP_EXPIRY_SECONDS: z.coerce.number().default(300),
  TEST_LOGIN_OTP_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  TEST_LOGIN_MOBILE: z
    .string()
    .regex(/^$|^[6-9]\d{9}$/, 'Must be an empty value or a valid Indian mobile number')
    .default(''),
  TEST_LOGIN_OTP: z
    .string()
    .regex(/^$|^\d{4,6}$/, 'Must be an empty value or a 4 to 6 digit OTP')
    .default(''),
  RAZORPAY_KEY_ID: z.string().optional().default(''),
  RAZORPAY_KEY_SECRET: z.string().optional().default(''),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional().default(''),
  RAZORPAY_CURRENCY: z.string().default('INR'),
  R2_ACCOUNT_ID: z.string().optional().default(''),
  R2_ACCESS_KEY_ID: z.string().optional().default(''),
  R2_SECRET_ACCESS_KEY: z.string().optional().default(''),
  R2_BUCKET_NAME: z.string().optional().default(''),
  R2_PUBLIC_BASE_URL: z.union([z.literal(''), z.string().url()]).default(''),
}).superRefine((env, context) => {
  if (
    env.TEST_LOGIN_OTP_ENABLED &&
    (!env.TEST_LOGIN_MOBILE || !env.TEST_LOGIN_OTP)
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['TEST_LOGIN_OTP_ENABLED'],
      message:
        'TEST_LOGIN_MOBILE and TEST_LOGIN_OTP are required when test login is enabled',
    });
  }

  const r2Values = [
    env.R2_ACCOUNT_ID,
    env.R2_ACCESS_KEY_ID,
    env.R2_SECRET_ACCESS_KEY,
    env.R2_BUCKET_NAME,
    env.R2_PUBLIC_BASE_URL,
  ];
  if (r2Values.some(Boolean) && !r2Values.every(Boolean)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['R2_ACCOUNT_ID'],
      message: 'All Cloudflare R2 environment variables must be provided together',
    });
  }
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>) {
  const parsed = envSchema.safeParse(config);

  if (!parsed.success) {
    throw new Error(`Invalid environment variables: ${parsed.error.message}`);
  }

  return parsed.data;
}
