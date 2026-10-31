// Web addresses that may call this API from a browser (CORS).
// They come from the CORS_ORIGIN setting, separated by commas, for example:
//   CORS_ORIGIN=http://localhost:3000,https://admin.example.edu
// When the setting is missing or empty, only the local Next.js app is allowed.

export const DEFAULT_CORS_ORIGIN = 'http://localhost:3000';

export function parseCorsOrigins(value: string | undefined): string[] {
  const origins = (value ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter((origin) => origin.length > 0);
  return origins.length > 0 ? origins : [DEFAULT_CORS_ORIGIN];
}
