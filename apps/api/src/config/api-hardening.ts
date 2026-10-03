const productionEnvironment = 'production';

export function shouldEnableSwagger(
  nodeEnvironment: string | undefined,
  explicitlyEnabled: boolean,
) {
  return nodeEnvironment !== productionEnvironment && explicitlyEnabled;
}

export function apiSecurityHeaders(isSwaggerRequest: boolean) {
  return {
    'Content-Security-Policy': isSwaggerRequest
      ? "default-src 'self'; img-src 'self' data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'"
      : "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  } as const;
}
