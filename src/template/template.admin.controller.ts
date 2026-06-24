import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/auth/roles.decorator.js';
import { RolesGuard } from '../common/auth/roles.guard.js';
import { Role } from '../common/auth/roles.js';
import { UserContextGuard } from '../common/auth/user-context.guard.js';
import { CreateTemplateDto } from './dto/create-template.dto.js';
import { UpdateTemplateDto } from './dto/update-template.dto.js';
import { TemplateService } from './template.service.js';

@ApiTags('template')
@UseGuards(UserContextGuard, RolesGuard)
@Roles([Role.ADMIN])
@Controller('private/admin/template')
export class TemplateAdminController {
  constructor(private readonly templateService: TemplateService) {}

  @Get()
  findAll() {
    return this.templateService.findAll();
  }

  @Get(':id')
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.templateService.findById(id);
  }

  @Post()
  create(@Body() dto: CreateTemplateDto) {
    return this.templateService.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTemplateDto,
  ) {
    return this.templateService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.templateService.remove(id);
  }
}
