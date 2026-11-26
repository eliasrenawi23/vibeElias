-- Taxi -> private conversion: plate history, customs expense category, conversion fields on the
-- vehicle and the VAT-margin setting. Purely additive.
-- The new ExpenseCategory value is not used by any statement of this migration (Postgres refuses
-- to use a value added in the same transaction).

-- CreateEnum
CREATE TYPE "PlateChangeReason" AS ENUM ('TAXI_TO_PRIVATE', 'OTHER');

-- AlterEnum
ALTER TYPE "ExpenseCategory" ADD VALUE 'CONVERSION_TAX';

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "vatMarginIncludesConversionTax" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "convertedAt" DATE,
ADD COLUMN     "expectedConversionTax" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "VehiclePlateChange" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "oldPlateNo" TEXT NOT NULL,
    "newPlateNo" TEXT NOT NULL,
    "changedAt" DATE NOT NULL,
    "reason" "PlateChangeReason" NOT NULL,
    "conversionTax" DECIMAL(12,2),
    "expenseId" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehiclePlateChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VehiclePlateChange_expenseId_key" ON "VehiclePlateChange"("expenseId");

-- CreateIndex
CREATE INDEX "VehiclePlateChange_oldPlateNo_idx" ON "VehiclePlateChange"("oldPlateNo");

-- CreateIndex
CREATE INDEX "VehiclePlateChange_vehicleId_changedAt_idx" ON "VehiclePlateChange"("vehicleId", "changedAt");

-- AddForeignKey
ALTER TABLE "VehiclePlateChange" ADD CONSTRAINT "VehiclePlateChange_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehiclePlateChange" ADD CONSTRAINT "VehiclePlateChange_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "VehicleExpense"("id") ON DELETE SET NULL ON UPDATE CASCADE;
