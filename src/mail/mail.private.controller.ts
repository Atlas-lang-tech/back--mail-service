import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/auth/current-user.decorator.js';
import type { UserContext } from '../common/auth/roles.js';
import { UserContextGuard } from '../common/auth/user-context.guard.js';
import { MailService } from './mail.service.js';

@ApiTags('mail')
@UseGuards(UserContextGuard)
@Controller('private/me/mail')
export class MailPrivateController {
  constructor(private readonly mailService: MailService) {}

  @Get()
  findMine(@CurrentUser() user: UserContext) {
    return this.mailService.findForUser(user.id);
  }
}
