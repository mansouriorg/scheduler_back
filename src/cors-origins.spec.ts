import { DEFAULT_CORS_ORIGIN, parseCorsOrigins } from './cors-origins';

describe('parseCorsOrigins', () => {
  it('allows only the local web app when the setting is missing', () => {
    expect(parseCorsOrigins(undefined)).toEqual([DEFAULT_CORS_ORIGIN]);
  });

  it('allows only the local web app when the setting is empty', () => {
    expect(parseCorsOrigins('  ,  ')).toEqual([DEFAULT_CORS_ORIGIN]);
  });

  it('reads one address', () => {
    expect(parseCorsOrigins('https://admin.example.edu')).toEqual([
      'https://admin.example.edu',
    ]);
  });

  it('reads several addresses and removes spaces and trailing slashes', () => {
    expect(
      parseCorsOrigins(' http://localhost:3000/ , https://admin.example.edu '),
    ).toEqual(['http://localhost:3000', 'https://admin.example.edu']);
  });
});
