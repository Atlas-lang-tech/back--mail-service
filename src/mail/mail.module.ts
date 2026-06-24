import { Module } from '@nestjs/common';
import { PrismaModule } from '../modules/Prisma/prisma.module.js';
import { TemplateModule } from '../template/template.module.js';
import { MailAdminController } from './mail.admin.controller.js';
import { MailPrivateController } from './mail.private.controller.js';
import { MailService } from './mail.service.js';

@Module({
  imports: [PrismaModule, TemplateModule],
  controllers: [MailPrivateController, MailAdminController],
  providers: [MailService],
})
export class MailModule {}
