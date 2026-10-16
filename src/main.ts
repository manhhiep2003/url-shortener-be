import { RequestMethod } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const prefix = process.env.API_PREFIX ?? 'api/v1';
  app.setGlobalPrefix(prefix, {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
