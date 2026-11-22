import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('/health/live')
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('/health/ready')
  ready(): { status: 'ready' } {
    return { status: 'ready' };
  }
}
