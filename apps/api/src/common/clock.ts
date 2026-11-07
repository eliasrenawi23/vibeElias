import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { todayInBusinessTz } from '@renawi/shared';
import type { Env } from '../config/env';

/** "Today" in the business time zone (Asia/Jerusalem) while the process runs in UTC. */
@Injectable()
export class Clock {
  readonly timeZone: string;

  constructor(config: ConfigService<Env, true>) {
    this.timeZone = config.get('BUSINESS_TZ', { infer: true });
  }

  /** Today's calendar date (`YYYY-MM-DD`) in the business time zone. */
  today(): string {
    return todayInBusinessTz(this.timeZone);
  }
}
