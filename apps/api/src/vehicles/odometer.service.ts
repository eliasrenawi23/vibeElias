import { Injectable } from '@nestjs/common';
import { OdometerLog, Prisma } from '@prisma/client';
import type { OdometerCreate, OdometerQuery } from '@renawi/shared';
import { dbDate } from '../common/dates';
import { AppException, FieldErrorKey } from '../common/errors/app-exception';
import { PrismaService } from '../prisma/prisma.service';
import { VehiclesService } from './vehicles.service';

@Injectable()
export class OdometerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vehicles: VehiclesService,
  ) {}

  /** Readings newest first (optionally within `from`..`to`); page/pageSize are ignored. */
  async list(vehicleId: string, query: OdometerQuery): Promise<OdometerLog[]> {
    await this.vehicles.getRow(vehicleId);
    const date: Prisma.DateTimeFilter = {};
    if (query.from) date.gte = dbDate(query.from);
    if (query.to) date.lte = dbDate(query.to);
    return this.prisma.odometerLog.findMany({
      where: { vehicleId, ...(Object.keys(date).length ? { date } : {}) },
      orderBy: [{ date: 'desc' }, { km: 'desc' }],
    });
  }

  /**
   * Records a reading. Readings must not decrease over time: km below the latest reading on or
   * before the date (or above the earliest later one) -> 400 `validation.odometerDecreasing`.
   * The latest reading by date becomes `Vehicle.currentKm`.
   */
  async create(vehicleId: string, dto: OdometerCreate): Promise<OdometerLog> {
    await this.vehicles.getRow(vehicleId);
    const date = dbDate(dto.date);
    return this.prisma.$transaction(async (tx) => {
      const previous = await tx.odometerLog.findFirst({
        where: { vehicleId, date: { lte: date } },
        orderBy: [{ date: 'desc' }, { km: 'desc' }],
      });
      const next = await tx.odometerLog.findFirst({
        where: { vehicleId, date: { gt: date } },
        orderBy: [{ date: 'asc' }, { km: 'asc' }],
      });
      if ((previous && dto.km < previous.km) || (next && dto.km > next.km)) {
        throw AppException.fieldError('km', FieldErrorKey.odometerDecreasing);
      }
      const log = await tx.odometerLog.create({
        data: { vehicleId, km: dto.km, date, source: dto.source ?? null },
      });
      if (!next) await tx.vehicle.update({ where: { id: vehicleId }, data: { currentKm: dto.km } });
      return log;
    });
  }
}
