-- AlterTable
ALTER TABLE `purchases` ADD COLUMN `purchase_discount` DOUBLE NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `sales` ADD COLUMN `sales_discount` DOUBLE NULL DEFAULT 0;
