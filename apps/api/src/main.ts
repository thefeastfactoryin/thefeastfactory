import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { RequestLoggingInterceptor } from './common/interceptors/request-logging.interceptor';
import {
  apiSecurityHeaders,
  shouldEnableSwagger,
} from './config/api-hardening';
import { createOpenApiDocument } from './swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const config = app.get(ConfigService);
  const origins = config
    .getOrThrow<string>('API_CORS_ORIGINS')
    .split(',')
    .map((origin) => origin.trim());

  app.enableCors({ origin: origins, credentials: true });
  const swaggerEnabled = shouldEnableSwagger(
    config.get<string>('NODE_ENV'),
    config.get<boolean>('API_SWAGGER_ENABLED', false),
  );
  app.use((request: Request, response: Response, next: NextFunction) => {
    const headers = apiSecurityHeaders(
      swaggerEnabled && request.path.startsWith('/docs'),
    );
    for (const [name, value] of Object.entries(headers)) {
      response.setHeader(name, value);
    }
    next();
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new RequestLoggingInterceptor());

  if (swaggerEnabled) {
    const document = createOpenApiDocument(app);
    SwaggerModule.setup('docs', app, document);
  }

  await app.listen(config.get<number>('API_PORT', 4000));
}

void bootstrap();
