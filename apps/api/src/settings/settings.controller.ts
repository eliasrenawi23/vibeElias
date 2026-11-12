import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { BackupStatus } from '@renawi/shared';
import { Roles } from '../auth/decorators';
import { Audited } from '../common/audit/audit.decorator';
import type { Env } from '../config/env';
import { readBackupStatus } from './backup-status';
import { SettingsUpdateDto } from './dto';
import { SETTINGS_ID, SettingsService, SettingsView } from './settings.service';

@ApiTags('settings')
@ApiCookieAuth()
@Controller('settings')
export class SettingsController {
  constructor(
    private readonly settings: SettingsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Business settings (shared SettingsResponseSchema)' })
  get(): Promise<SettingsView> {
    return this.settings.get();
  }

  @Get('backup-status')
  @ApiOperation({
    summary:
      'Last successful nightly backup (shared BackupStatusSchema { lastSuccessAt, lastFile, ok, ' +
      'offsite, remote }) read from BACKUP_STATUS_FILE; ok = succeeded within the last 36 hours; ' +
      'offsite = also copied to the S3 bucket (false = local only, null = unknown: older status ' +
      'file); remote = s3:<bucket>/<prefix> when copied. A missing or malformed file reports ' +
      '{ lastSuccessAt: null, lastFile: null, ok: false, offsite: null, remote: null }.',
  })
  backupStatus(): Promise<BackupStatus> {
    return readBackupStatus(this.config.get('BACKUP_STATUS_FILE', { infer: true }));
  }

  @Patch()
  @Roles('ADMIN')
  @Audited('Settings', { entityId: SETTINGS_ID })
  @ApiOperation({ summary: 'Partial update; nested objects are replaced whole' })
  update(@Body() dto: SettingsUpdateDto): Promise<SettingsView> {
    return this.settings.update(dto);
  }
}
