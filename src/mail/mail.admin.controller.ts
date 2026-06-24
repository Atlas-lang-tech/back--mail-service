import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/auth/roles.decorator.js';
import { RolesGuard } from '../common/auth/roles.guard.js';
import { Role } from '../common/auth/roles.js';
import { UserContextGuard } from '../common/auth/user-context.guard.js';
import { MailService } from './mail.service.js';

@ApiTags('mail')
@UseGuards(UserContextGuard, RolesGuard)
@Roles([Role.ADMIN])
@Controller('private/admin/mail')
export class MailAdminController {
  constructor(private readonly mailService: MailService) {}

  @Get()
  findAll() {
    return this.mailService.findAll();
  }

  @Get(':id')
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.mailService.findById(id);
  }
}
