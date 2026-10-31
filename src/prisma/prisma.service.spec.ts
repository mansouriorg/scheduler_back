import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  // The address that prisma.service.ts read from .env, put back after each test.
  const savedUrl = process.env.DATABASE_URL;

  afterEach(() => {
    if (savedUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = savedUrl;
    }
  });

  it('stops with a clear message when DATABASE_URL is missing', () => {
    delete process.env.DATABASE_URL;

    expect(() => new PrismaService()).toThrow('DATABASE_URL is undefined');
  });
});
