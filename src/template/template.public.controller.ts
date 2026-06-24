import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TemplateService } from './template.service.js';

@ApiTags('template')
@Controller('public/template')
export class TemplatePublicController {
  constructor(private readonly templateService: TemplateService) {}

  @Get()
  findAll() {
    return this.templateService.findAll();
  }

  @Get(':id')
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.templateService.findById(id);
  }
}
