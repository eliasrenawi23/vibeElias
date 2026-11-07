-- Hand-written migration: at most one open inventory cycle (endedAt IS NULL) per vehicle.
-- Prisma cannot express partial indexes; like "ls_open_license" it is ignored by migrate dev.
CREATE UNIQUE INDEX "ic_open_vehicle" ON "InventoryCycle"("vehicleId") WHERE "endedAt" IS NULL;
