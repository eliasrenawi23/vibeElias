-- Milestone 3: free-text notes on lease contracts and explicit allocation targets on payments.
ALTER TABLE "LeaseContract" ADD COLUMN "notes" TEXT;
ALTER TABLE "LedgerEntry" ADD COLUMN "allocateTo" TEXT[] DEFAULT ARRAY[]::TEXT[];
