import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

/** Liveness probe for docker / k8s. Reachable at `GET /api/mail/health`. */
@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok' };
  }
}
