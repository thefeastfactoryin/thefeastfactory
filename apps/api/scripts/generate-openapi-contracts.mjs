import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import openapiTS, { astToString } from 'openapi-typescript';

const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(here, '../.env'), quiet: true });

const require = createRequire(import.meta.url);
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module.js');
const { createOpenApiDocument } = require('../dist/swagger.js');

const app = await NestFactory.create(AppModule, {
  abortOnError: false,
  logger: false,
  rawBody: true,
});

try {
  const document = createOpenApiDocument(app);
  const output = astToString(
    await openapiTS(document, {
      alphabetize: true,
      immutable: true,
    }),
  );
  const target = resolve(
    here,
    '../../../packages/shared-types/src/generated-api.ts',
  );
  const generated = `/* eslint-disable */\n/* This file is generated from the Nest OpenAPI document. Do not edit. */\n${output}`;
  if (process.argv.includes('--check')) {
    const current = await readFile(target, 'utf8').catch(() => '');
    if (current !== generated) {
      throw new Error(
        'Generated API contracts are stale. Run `npm run contracts:generate`.',
      );
    }
  } else {
    await writeFile(target, generated, 'utf8');
  }
} finally {
  await app.close();
}
