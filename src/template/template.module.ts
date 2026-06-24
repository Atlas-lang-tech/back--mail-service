import { Module } from '@nestjs/common';
import { PrismaModule } from '../modules/Prisma/prisma.module.js';
import { TemplateAdminController } from './template.admin.controller.js';
import { TemplatePublicController } from './template.public.controller.js';
import { TemplateService } from './template.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [TemplateAdminController, TemplatePublicController],
  providers: [TemplateService],
  exports: [TemplateService],
})
export class TemplateModule {}
