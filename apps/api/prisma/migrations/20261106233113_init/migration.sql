-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'SALES', 'ACCOUNTANT');

-- CreateEnum
CREATE TYPE "ContactTag" AS ENUM ('BUYER', 'SELLER', 'DRIVER', 'LEAD', 'SUPPLIER', 'GARAGE', 'INSURER', 'CONSIGNOR');

-- CreateEnum
CREATE TYPE "DriverStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLACKLISTED');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('IN_STOCK', 'RESERVED', 'LEASED', 'SOLD', 'RETURNED', 'SCRAPPED', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "VehicleOwnership" AS ENUM ('OWNED', 'CONSIGNED', 'THIRD_PARTY');

-- CreateEnum
CREATE TYPE "Fuel" AS ENUM ('PETROL', 'DIESEL', 'HYBRID', 'PLUGIN_HYBRID', 'ELECTRIC', 'LPG');

-- CreateEnum
CREATE TYPE "Gearbox" AS ENUM ('AUTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "CycleKind" AS ENUM ('OWNED', 'CONSIGNED');

-- CreateEnum
CREATE TYPE "CycleEndReason" AS ENUM ('SOLD', 'RETURNED_TO_CONSIGNOR', 'SCRAPPED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CommissionMode" AS ENUM ('FIXED', 'PERCENT', 'SURPLUS');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('REPAIR', 'TEST', 'INSURANCE', 'FUEL', 'TOWING', 'PARTS', 'CLEANING', 'FINE', 'LICENSE_FEE', 'METER', 'OTHER');

-- CreateEnum
CREATE TYPE "InsuranceType" AS ENUM ('COMPULSORY', 'THIRD_PARTY', 'COMPREHENSIVE', 'TRADE', 'LOT');

-- CreateEnum
CREATE TYPE "InsuranceScope" AS ENUM ('VEHICLE', 'BUSINESS');

-- CreateEnum
CREATE TYPE "PaidBy" AS ENUM ('US', 'DRIVER', 'CONSIGNOR');

-- CreateEnum
CREATE TYPE "TaxiLicenseStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'TRANSFER_PENDING', 'SOLD');

-- CreateEnum
CREATE TYPE "LeaseType" AS ENUM ('NUMBER_ONLY', 'CAR_AND_NUMBER');

-- CreateEnum
CREATE TYPE "BillingPeriod" AS ENUM ('MONTHLY', 'WEEKLY');

-- CreateEnum
CREATE TYPE "LeaseStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ENDED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "LeaseEndReason" AS ENUM ('EXPIRED', 'RENEWED', 'TERMINATED_BY_US', 'TERMINATED_BY_DRIVER', 'OTHER');

-- CreateEnum
CREATE TYPE "DepositKind" AS ENUM ('CASH', 'CHECK', 'PROMISSORY_NOTE');

-- CreateEnum
CREATE TYPE "LedgerType" AS ENUM ('CHARGE', 'PAYMENT', 'CREDIT', 'DEPOSIT_IN', 'DEPOSIT_OUT', 'DEPOSIT_APPLIED');

-- CreateEnum
CREATE TYPE "ChargeKind" AS ENUM ('RENT', 'FINE', 'DAMAGE', 'INSURANCE', 'TEST', 'REPAIR', 'PENALTY', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'CHECK', 'BIT', 'CREDIT_CARD', 'TRADE_IN', 'OFFSET');

-- CreateEnum
CREATE TYPE "DealType" AS ENUM ('PURCHASE', 'SALE', 'CONSIGNMENT_SALE');

-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('DRAFT', 'PENDING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VatMode" AS ENUM ('NONE', 'FULL', 'MARGIN');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'DONE');

-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "FineStatus" AS ENUM ('NEW', 'REASSIGN_SUBMITTED', 'REASSIGNED', 'PAID_BY_US', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DocKind" AS ENUM ('CAR_LICENSE', 'INSURANCE', 'ID', 'DRIVER_LICENSE', 'TAXI_PERMIT', 'MEDICAL', 'TAXI_LICENSE', 'LICENSE_ASSIGNMENT_FORM', 'CONTRACT', 'AGREEMENT', 'DISCLOSURE_FORM', 'HANDOVER', 'PHOTO', 'RECEIPT', 'FORM', 'OTHER');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'ADMIN',
    "locale" TEXT NOT NULL DEFAULT 'he',
    "theme" TEXT NOT NULL DEFAULT 'system',
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "tags" "ContactTag"[],
    "firstName" TEXT,
    "lastName" TEXT,
    "companyName" TEXT,
    "idNumber" TEXT,
    "phones" TEXT[],
    "email" TEXT,
    "address" TEXT,
    "city" TEXT,
    "preferredLang" TEXT NOT NULL DEFAULT 'he',
    "source" TEXT,
    "notes" TEXT,
    "followUpAt" DATE,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Driver" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "licenseNo" TEXT,
    "licenseExpiry" DATE,
    "taxiPermitNo" TEXT,
    "taxiPermitExpiry" DATE,
    "medicalExpiry" DATE,
    "emergencyName" TEXT,
    "emergencyPhone" TEXT,
    "startedAt" DATE,
    "status" "DriverStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "plateNo" TEXT NOT NULL,
    "vin" TEXT,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "trim" TEXT,
    "year" INTEGER NOT NULL,
    "color" TEXT,
    "fuel" "Fuel",
    "gearbox" "Gearbox",
    "engineCc" INTEGER,
    "hand" INTEGER,
    "isTaxi" BOOLEAN NOT NULL DEFAULT false,
    "status" "VehicleStatus" NOT NULL DEFAULT 'IN_STOCK',
    "ownership" "VehicleOwnership" NOT NULL DEFAULT 'OWNED',
    "ownerDriverId" TEXT,
    "currentKm" INTEGER,
    "registrationExpiry" DATE,
    "dealerRegisteredAt" DATE,
    "meterSerial" TEXT,
    "meterSealedAt" DATE,
    "location" TEXT,
    "listingPrice" DECIMAL(12,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryCycle" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "kind" "CycleKind" NOT NULL,
    "startedAt" DATE NOT NULL,
    "endedAt" DATE,
    "endReason" "CycleEndReason",
    "purchaseDealId" TEXT,
    "saleDealId" TEXT,
    "consignorId" TEXT,
    "askingPrice" DECIMAL(12,2),
    "minNetToConsignor" DECIMAL(12,2),
    "commissionMode" "CommissionMode",
    "commissionValue" DECIMAL(12,2),
    "agreementEndsAt" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "dealNo" SERIAL NOT NULL,
    "type" "DealType" NOT NULL,
    "status" "DealStatus" NOT NULL DEFAULT 'DRAFT',
    "vehicleId" TEXT NOT NULL,
    "cycleId" TEXT,
    "counterpartyId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "listPrice" DECIMAL(12,2),
    "vatMode" "VatMode" NOT NULL DEFAULT 'MARGIN',
    "vatRate" DECIMAL(5,2) NOT NULL,
    "sellerIsVatBusiness" BOOLEAN NOT NULL DEFAULT false,
    "isTradeIn" BOOLEAN NOT NULL DEFAULT false,
    "tradeInDealId" TEXT,
    "commissionAmount" DECIMAL(12,2),
    "payoutAmount" DECIMAL(12,2),
    "warrantyText" TEXT,
    "disclosureSignedAt" TIMESTAMP(3),
    "transferStatus" "TransferStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "transferChecklist" JSONB,
    "transferDueAt" DATE,
    "transferredAt" DATE,
    "notes" TEXT,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealPayment" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "direction" "Direction" NOT NULL,
    "contactId" TEXT,
    "date" DATE NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleExpense" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "cycleId" TEXT,
    "category" "ExpenseCategory" NOT NULL,
    "date" DATE NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "vatIncluded" BOOLEAN NOT NULL DEFAULT true,
    "vatReclaimable" BOOLEAN NOT NULL DEFAULT false,
    "paidBy" "PaidBy" NOT NULL DEFAULT 'US',
    "vendorId" TEXT,
    "rebilledEntryId" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsurancePolicy" (
    "id" TEXT NOT NULL,
    "scope" "InsuranceScope" NOT NULL DEFAULT 'VEHICLE',
    "vehicleId" TEXT,
    "type" "InsuranceType" NOT NULL,
    "insurer" TEXT NOT NULL,
    "policyNo" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "premium" DECIMAL(12,2),
    "paidBy" "PaidBy" NOT NULL DEFAULT 'US',
    "hasTaxiExtension" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsurancePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OdometerLog" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "km" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "source" TEXT,

    CONSTRAINT "OdometerLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxiLicense" (
    "id" TEXT NOT NULL,
    "licenseNo" TEXT NOT NULL,
    "holderName" TEXT,
    "status" "TaxiLicenseStatus" NOT NULL DEFAULT 'ACTIVE',
    "acquiredAt" DATE,
    "acquisitionPrice" DECIMAL(12,2),
    "soldAt" DATE,
    "salePrice" DECIMAL(12,2),
    "annualFeeDueAt" DATE,
    "renewalAt" DATE,
    "registeredVehicleId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxiLicense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaseContract" (
    "id" TEXT NOT NULL,
    "contractNo" SERIAL NOT NULL,
    "driverId" TEXT NOT NULL,
    "type" "LeaseType" NOT NULL,
    "status" "LeaseStatus" NOT NULL DEFAULT 'DRAFT',
    "billingPeriod" "BillingPeriod" NOT NULL DEFAULT 'MONTHLY',
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "actualEndDate" DATE,
    "endReason" "LeaseEndReason",
    "paymentDay" INTEGER NOT NULL DEFAULT 1,
    "rentIncludesVat" BOOLEAN NOT NULL DEFAULT true,
    "earlyExitPenaltyMonths" DECIMAL(4,2) NOT NULL DEFAULT 1,
    "depositAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "depositKind" "DepositKind" NOT NULL DEFAULT 'CASH',
    "responsibilities" JSONB NOT NULL,
    "handoverChecklist" JSONB,
    "returnChecklist" JSONB,
    "terms" TEXT,
    "renewedFromId" TEXT,
    "signedAt" TIMESTAMP(3),
    "terminationNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaseContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaseSegment" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "taxiLicenseId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "monthlyRent" DECIMAL(12,2) NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaseSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "contractId" TEXT,
    "segmentId" TEXT,
    "type" "LedgerType" NOT NULL,
    "chargeKind" "ChargeKind",
    "rentPeriod" TEXT,
    "date" DATE NOT NULL,
    "dueDate" DATE,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "PaymentMethod",
    "reference" TEXT,
    "description" TEXT,
    "vehicleId" TEXT,
    "taxiLicenseId" TEXT,
    "autoGenerated" BOOLEAN NOT NULL DEFAULT false,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAllocation" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "chargeId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrafficFine" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "driverId" TEXT,
    "contractId" TEXT,
    "fineNo" TEXT,
    "authority" TEXT,
    "offenceAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" DATE NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "FineStatus" NOT NULL DEFAULT 'NEW',
    "reassignDeadline" DATE,
    "chargeEntryId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrafficFine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "kind" "DocKind" NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "hasThumb" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT,
    "lang" TEXT,
    "expiresAt" DATE,
    "vehicleId" TEXT,
    "driverId" TEXT,
    "contactId" TEXT,
    "dealId" TEXT,
    "contractId" TEXT,
    "taxiLicenseId" TEXT,
    "expenseId" TEXT,
    "ledgerEntryId" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dueAt" DATE NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "notes" TEXT,
    "doneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "businessName" JSONB NOT NULL,
    "legalId" TEXT,
    "dealerLicenseNo" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "logoDocumentId" TEXT,
    "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 18.00,
    "reminderLeadDays" JSONB NOT NULL,
    "defaultLeaseTerms" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "diff" JSONB,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Contact_lastName_firstName_idx" ON "Contact"("lastName", "firstName");

-- CreateIndex
CREATE INDEX "Contact_idNumber_idx" ON "Contact"("idNumber");

-- CreateIndex
CREATE INDEX "Contact_followUpAt_idx" ON "Contact"("followUpAt");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_contactId_key" ON "Driver"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_plateNo_key" ON "Vehicle"("plateNo");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_vin_key" ON "Vehicle"("vin");

-- CreateIndex
CREATE INDEX "Vehicle_status_ownership_idx" ON "Vehicle"("status", "ownership");

-- CreateIndex
CREATE INDEX "Vehicle_make_model_idx" ON "Vehicle"("make", "model");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryCycle_purchaseDealId_key" ON "InventoryCycle"("purchaseDealId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryCycle_saleDealId_key" ON "InventoryCycle"("saleDealId");

-- CreateIndex
CREATE INDEX "InventoryCycle_vehicleId_endedAt_idx" ON "InventoryCycle"("vehicleId", "endedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Deal_dealNo_key" ON "Deal"("dealNo");

-- CreateIndex
CREATE UNIQUE INDEX "Deal_tradeInDealId_key" ON "Deal"("tradeInDealId");

-- CreateIndex
CREATE INDEX "Deal_type_status_date_idx" ON "Deal"("type", "status", "date");

-- CreateIndex
CREATE INDEX "Deal_vehicleId_idx" ON "Deal"("vehicleId");

-- CreateIndex
CREATE INDEX "DealPayment_dealId_idx" ON "DealPayment"("dealId");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleExpense_rebilledEntryId_key" ON "VehicleExpense"("rebilledEntryId");

-- CreateIndex
CREATE INDEX "VehicleExpense_vehicleId_date_idx" ON "VehicleExpense"("vehicleId", "date");

-- CreateIndex
CREATE INDEX "VehicleExpense_cycleId_idx" ON "VehicleExpense"("cycleId");

-- CreateIndex
CREATE INDEX "InsurancePolicy_vehicleId_endDate_idx" ON "InsurancePolicy"("vehicleId", "endDate");

-- CreateIndex
CREATE INDEX "InsurancePolicy_endDate_idx" ON "InsurancePolicy"("endDate");

-- CreateIndex
CREATE INDEX "OdometerLog_vehicleId_date_idx" ON "OdometerLog"("vehicleId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "TaxiLicense_licenseNo_key" ON "TaxiLicense"("licenseNo");

-- CreateIndex
CREATE UNIQUE INDEX "TaxiLicense_registeredVehicleId_key" ON "TaxiLicense"("registeredVehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "LeaseContract_contractNo_key" ON "LeaseContract"("contractNo");

-- CreateIndex
CREATE UNIQUE INDEX "LeaseContract_renewedFromId_key" ON "LeaseContract"("renewedFromId");

-- CreateIndex
CREATE INDEX "LeaseContract_driverId_status_idx" ON "LeaseContract"("driverId", "status");

-- CreateIndex
CREATE INDEX "LeaseContract_status_endDate_idx" ON "LeaseContract"("status", "endDate");

-- CreateIndex
CREATE INDEX "LeaseSegment_contractId_startDate_idx" ON "LeaseSegment"("contractId", "startDate");

-- CreateIndex
CREATE INDEX "LeaseSegment_taxiLicenseId_endDate_idx" ON "LeaseSegment"("taxiLicenseId", "endDate");

-- CreateIndex
CREATE INDEX "LeaseSegment_vehicleId_endDate_idx" ON "LeaseSegment"("vehicleId", "endDate");

-- CreateIndex
CREATE INDEX "LedgerEntry_driverId_date_idx" ON "LedgerEntry"("driverId", "date");

-- CreateIndex
CREATE INDEX "LedgerEntry_type_dueDate_idx" ON "LedgerEntry"("type", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerEntry_segmentId_rentPeriod_key" ON "LedgerEntry"("segmentId", "rentPeriod");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAllocation_paymentId_chargeId_key" ON "PaymentAllocation"("paymentId", "chargeId");

-- CreateIndex
CREATE UNIQUE INDEX "TrafficFine_chargeEntryId_key" ON "TrafficFine"("chargeEntryId");

-- CreateIndex
CREATE INDEX "TrafficFine_status_reassignDeadline_idx" ON "TrafficFine"("status", "reassignDeadline");

-- CreateIndex
CREATE INDEX "Document_vehicleId_idx" ON "Document"("vehicleId");

-- CreateIndex
CREATE INDEX "Document_driverId_idx" ON "Document"("driverId");

-- CreateIndex
CREATE INDEX "Document_dealId_idx" ON "Document"("dealId");

-- CreateIndex
CREATE INDEX "Document_contractId_idx" ON "Document"("contractId");

-- CreateIndex
CREATE INDEX "Document_expiresAt_idx" ON "Document"("expiresAt");

-- CreateIndex
CREATE INDEX "Reminder_doneAt_dueAt_idx" ON "Reminder"("doneAt", "dueAt");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_at_idx" ON "AuditLog"("at");

-- AddForeignKey
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_ownerDriverId_fkey" FOREIGN KEY ("ownerDriverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCycle" ADD CONSTRAINT "InventoryCycle_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCycle" ADD CONSTRAINT "InventoryCycle_purchaseDealId_fkey" FOREIGN KEY ("purchaseDealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCycle" ADD CONSTRAINT "InventoryCycle_saleDealId_fkey" FOREIGN KEY ("saleDealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCycle" ADD CONSTRAINT "InventoryCycle_consignorId_fkey" FOREIGN KEY ("consignorId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "InventoryCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_counterpartyId_fkey" FOREIGN KEY ("counterpartyId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_tradeInDealId_fkey" FOREIGN KEY ("tradeInDealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealPayment" ADD CONSTRAINT "DealPayment_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealPayment" ADD CONSTRAINT "DealPayment_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleExpense" ADD CONSTRAINT "VehicleExpense_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleExpense" ADD CONSTRAINT "VehicleExpense_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "InventoryCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleExpense" ADD CONSTRAINT "VehicleExpense_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleExpense" ADD CONSTRAINT "VehicleExpense_rebilledEntryId_fkey" FOREIGN KEY ("rebilledEntryId") REFERENCES "LedgerEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsurancePolicy" ADD CONSTRAINT "InsurancePolicy_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OdometerLog" ADD CONSTRAINT "OdometerLog_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxiLicense" ADD CONSTRAINT "TaxiLicense_registeredVehicleId_fkey" FOREIGN KEY ("registeredVehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaseContract" ADD CONSTRAINT "LeaseContract_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaseContract" ADD CONSTRAINT "LeaseContract_renewedFromId_fkey" FOREIGN KEY ("renewedFromId") REFERENCES "LeaseContract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaseSegment" ADD CONSTRAINT "LeaseSegment_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "LeaseContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaseSegment" ADD CONSTRAINT "LeaseSegment_taxiLicenseId_fkey" FOREIGN KEY ("taxiLicenseId") REFERENCES "TaxiLicense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaseSegment" ADD CONSTRAINT "LeaseSegment_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "LeaseContract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "LeaseSegment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_taxiLicenseId_fkey" FOREIGN KEY ("taxiLicenseId") REFERENCES "TaxiLicense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "LedgerEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "LedgerEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrafficFine" ADD CONSTRAINT "TrafficFine_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrafficFine" ADD CONSTRAINT "TrafficFine_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrafficFine" ADD CONSTRAINT "TrafficFine_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "LeaseContract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrafficFine" ADD CONSTRAINT "TrafficFine_chargeEntryId_fkey" FOREIGN KEY ("chargeEntryId") REFERENCES "LedgerEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "LeaseContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_taxiLicenseId_fkey" FOREIGN KEY ("taxiLicenseId") REFERENCES "TaxiLicense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "VehicleExpense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_ledgerEntryId_fkey" FOREIGN KEY ("ledgerEntryId") REFERENCES "LedgerEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
