import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. Enable CORS so Next.js (port 3000) can communicate with this API
  app.enableCors({
    origin: 'http://localhost:3000',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // 2. Automatically validate all incoming JSON payloads against your DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strips out extra properties not defined in the DTO
      transform: true, // Automatically converts strings to numbers/dates if the DTO requires it
    }),
  );

  // 3. Start the server on port 3001 (or whatever your environment variable dictates)
  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  
  console.log(`🚀 NestJS Backend is running on: http://localhost:${port}`);
}
bootstrap();