-- AlterTable
ALTER TABLE `suppliers` ADD COLUMN `supplier_credit_days` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `purchases` ADD COLUMN `purchase_credit_days` INTEGER NOT NULL DEFAULT 0;
