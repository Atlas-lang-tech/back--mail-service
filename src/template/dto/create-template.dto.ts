import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateTemplateDto {
  @IsString()
  tid: string;

  @IsString()
  subject: string;

  @IsString()
  body: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
