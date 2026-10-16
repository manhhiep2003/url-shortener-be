import { RequestMethod } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const prefix = configService.getOrThrow<string>('app.apiPrefix');

  app.setGlobalPrefix(prefix, {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });

  const port = configService.getOrThrow<number>('app.port');
  await app.listen(port);
}
void bootstrap();
