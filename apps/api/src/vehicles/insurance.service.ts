import { Injectable } from '@nestjs/common';
import { InsurancePolicy, InsuranceScope, InsuranceType, Prisma } from '@prisma/client';
import {
  BUSINESS_INSURANCE_TYPES,
  INSURANCE_END_AFTER_START,
  msg,
  type BusinessInsuranceCreate,
  type InsuranceCreate,
  type InsuranceQuery,
  type InsuranceUpdate,
} from '@renawi/shared';
import { Clock } from '../common/clock';
import { dbDate, isoOf } from '../common/dates';
import { AppException } from '../common/errors/app-exception';
import { toDbMoneyOrNull } from '../prisma/prisma.decimal';
import { PrismaService } from '../prisma/prisma.service';
import { VehiclesService } from './vehicles.service';

/** `GET /insurance` item: the policy + a compact vehicle reference (VEHICLE scope). */
export type InsuranceListItem = InsurancePolicy & {
  vehicle: { id: string; plateNo: string; make: string; model: string } | null;
};

const VEHICLE_REF = { select: { id: true, plateNo: true, make: true, model: true } } as const;

const ORDER: Prisma.InsurancePolicyOrderByWithRelationInput[] = [
  { startDate: 'desc' },
  { createdAt: 'desc' },
];

interface MergedPolicy {
  scope: InsuranceScope;
  type: InsuranceType;
  startDate: string;
  endDate: string;
}

/**
 * Cross-field rules on the final values: end strictly after start; TRADE / LOT policies are
 * business-level and business policies are TRADE / LOT.
 */
function validatePolicy(p: MergedPolicy): void {
  if (p.endDate <= p.startDate) {
    throw AppException.fieldError('endDate', INSURANCE_END_AFTER_START);
  }
  const businessType = BUSINESS_INSURANCE_TYPES.includes(p.type);
  if (p.scope === 'VEHICLE' && businessType) {
    throw AppException.fieldError('type', msg.businessPolicyType);
  }
  if (p.scope === 'BUSINESS' && !businessType) {
    throw AppException.fieldError('type', msg.invalidOption);
  }
}

/** The taxi extension only exists on comprehensive policies; anything else stores false. */
function taxiExtension(type: InsuranceType, requested: boolean): boolean {
  return type === 'COMPREHENSIVE' && requested;
}

@Injectable()
export class InsuranceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vehicles: VehiclesService,
    private readonly clock: Clock,
  ) {}

  async listForVehicle(vehicleId: string): Promise<InsurancePolicy[]> {
    await this.vehicles.getRow(vehicleId);
    return this.prisma.insurancePolicy.findMany({ where: { vehicleId }, orderBy: ORDER });
  }

  /** All policies (newest first), e.g. `?scope=BUSINESS&activeOnly=true`. */
  async list(query: InsuranceQuery): Promise<InsuranceListItem[]> {
    const where: Prisma.InsurancePolicyWhereInput = {};
    if (query.scope) where.scope = query.scope;
    if (query.vehicleId) where.vehicleId = query.vehicleId;
    if (query.type?.length) where.type = { in: query.type };
    const endDate: Prisma.DateTimeFilter = {};
    if (query.endingBefore) endDate.lte = dbDate(query.endingBefore);
    if (query.activeOnly) {
      const today = dbDate(this.clock.today());
      where.startDate = { lte: today };
      endDate.gte = today;
    }
    if (Object.keys(endDate).length) where.endDate = endDate;
    return this.prisma.insurancePolicy.findMany({
      where,
      orderBy: ORDER,
      include: { vehicle: VEHICLE_REF },
    });
  }

  async get(id: string): Promise<InsurancePolicy> {
    const row = await this.prisma.insurancePolicy.findUnique({ where: { id } });
    if (!row) throw AppException.notFound();
    return row;
  }

  /** `POST /vehicles/:id/insurance`: a VEHICLE-scope policy of that vehicle. */
  async createForVehicle(vehicleId: string, dto: InsuranceCreate): Promise<InsurancePolicy> {
    await this.vehicles.getRow(vehicleId);
    if (dto.scope !== 'VEHICLE') throw AppException.fieldError('scope', msg.invalidOption);
    validatePolicy({ ...dto, scope: 'VEHICLE' });
    return this.prisma.insurancePolicy.create({
      data: this.createData(dto, 'VEHICLE', vehicleId),
    });
  }

  /** `POST /insurance`: a BUSINESS-scope policy (TRADE / LOT, no vehicle). */
  async createBusiness(dto: BusinessInsuranceCreate): Promise<InsurancePolicy> {
    if (dto.vehicleId) throw AppException.fieldError('vehicleId', msg.businessScopeNoVehicle);
    validatePolicy(dto);
    return this.prisma.insurancePolicy.create({ data: this.createData(dto, 'BUSINESS', null) });
  }

  /** Partial update validated on the merged values; the scope cannot change. */
  async update(id: string, dto: InsuranceUpdate): Promise<InsurancePolicy> {
    const current = await this.get(id);
    if (dto.scope !== undefined && dto.scope !== current.scope) {
      throw AppException.fieldError('scope', msg.invalidValue);
    }
    let vehicleId: string | null | undefined;
    if (dto.vehicleId !== undefined && dto.vehicleId !== current.vehicleId) {
      if (current.scope === 'BUSINESS') {
        throw AppException.fieldError('vehicleId', msg.businessScopeNoVehicle);
      }
      if (!dto.vehicleId) throw AppException.fieldError('vehicleId', msg.vehicleScopeNeedsVehicle);
      await this.vehicles.getRow(dto.vehicleId, 'vehicleId');
      vehicleId = dto.vehicleId;
    }
    const merged: MergedPolicy = {
      scope: current.scope,
      type: dto.type ?? current.type,
      startDate: dto.startDate ?? isoOf(current.startDate),
      endDate: dto.endDate ?? isoOf(current.endDate),
    };
    validatePolicy(merged);
    return this.prisma.insurancePolicy.update({
      where: { id },
      data: {
        vehicleId,
        type: dto.type,
        insurer: dto.insurer,
        policyNo: dto.policyNo,
        startDate: dto.startDate ? dbDate(dto.startDate) : undefined,
        endDate: dto.endDate ? dbDate(dto.endDate) : undefined,
        premium: dto.premium === undefined ? undefined : toDbMoneyOrNull(dto.premium),
        paidBy: dto.paidBy,
        hasTaxiExtension: taxiExtension(
          merged.type,
          dto.hasTaxiExtension ?? current.hasTaxiExtension,
        ),
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.get(id);
    await this.prisma.insurancePolicy.delete({ where: { id } });
  }

  private createData(
    dto: InsuranceCreate | BusinessInsuranceCreate,
    scope: InsuranceScope,
    vehicleId: string | null,
  ): Prisma.InsurancePolicyUncheckedCreateInput {
    return {
      scope,
      vehicleId,
      type: dto.type,
      insurer: dto.insurer,
      policyNo: dto.policyNo ?? null,
      startDate: dbDate(dto.startDate),
      endDate: dbDate(dto.endDate),
      premium: toDbMoneyOrNull(dto.premium),
      paidBy: dto.paidBy,
      hasTaxiExtension: taxiExtension(dto.type, dto.hasTaxiExtension),
    };
  }
}
