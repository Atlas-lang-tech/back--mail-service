import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { setupApp } from './common/setup-app.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  setupApp(app);

  const config = new DocumentBuilder()
    .setTitle('Mail Service')
    .setDescription('Atlas mail microservice API')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
