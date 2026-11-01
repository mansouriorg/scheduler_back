import { Injectable, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from 'generated/prisma/client';
import * as dotenv from 'dotenv';

// 1. Force load the .env file BEFORE anything else happens!
dotenv.config();

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    // 2. Grab the URL. If it's still missing, it will throw a helpful error
    // instead of secretly connecting to the wrong database.
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL is undefined! Check your .env file.');
    }

    // 3. Create the Pool and Adapter properly
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);

    // 4. Pass the adapter to satisfy the "client" engine requirement
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }
}
