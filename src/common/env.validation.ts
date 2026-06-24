import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';

export class EnvironmentVariables {
  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string;

  @IsString()
  @IsNotEmpty()
  REDIS_HOST: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  REDIS_PORT: number;

  @IsInt()
  @Min(0)
  REDIS_DB: number;

  @IsOptional()
  @IsString()
  REDIS_PASSWORD?: string;

  @IsString()
  @IsNotEmpty()
  RABBITMQ_URL: string;

  // ---- mail provider ----

  @IsString()
  @IsNotEmpty()
  RESEND_API_KEY: string;

  @IsString()
  @IsNotEmpty()
  MAIL_FROM: string;

  @IsOptional()
  @IsIn(['resend'])
  MAIL_PROVIDER?: string;

  // Base URL of the front-end, used to build verification / reset links.
  @IsString()
  @IsNotEmpty()
  APP_BASE_URL: string;

  // ---- worker rate limiting (optional, sensible defaults in code) ----

  @IsOptional()
  @IsInt()
  @Min(1)
  MAIL_RATE_MAX?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  MAIL_RATE_DURATION?: number;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validatedConfig;
}
