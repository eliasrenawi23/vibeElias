import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators';
import { PrismaService } from '../prisma/prisma.service';

export interface HealthStatus {
  status: 'ok';
  db: 'up' | 'down';
  time: string;
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness + database check (public)' })
  async check(): Promise<HealthStatus> {
    const dbUp = await this.prisma.isUp();
    return { status: 'ok', db: dbUp ? 'up' : 'down', time: new Date().toISOString() };
  }
}
