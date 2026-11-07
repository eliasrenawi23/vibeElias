import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators';
import { Audited } from '../common/audit/audit.decorator';
import { SettingsUpdateDto } from './dto';
import { SETTINGS_ID, SettingsService, SettingsView } from './settings.service';

@ApiTags('settings')
@ApiCookieAuth()
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Business settings (shared SettingsResponseSchema)' })
  get(): Promise<SettingsView> {
    return this.settings.get();
  }

  @Patch()
  @Roles('ADMIN')
  @Audited('Settings', { entityId: SETTINGS_ID })
  @ApiOperation({ summary: 'Partial update; nested objects are replaced whole' })
  update(@Body() dto: SettingsUpdateDto): Promise<SettingsView> {
    return this.settings.update(dto);
  }
}
