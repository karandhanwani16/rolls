-- AlterTable
ALTER TABLE `customers` ADD COLUMN `customer_opening_balance` DOUBLE NOT NULL DEFAULT 0;
ALTER TABLE `customers` ADD COLUMN `customer_opening_balance_date` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `suppliers` ADD COLUMN `supplier_opening_balance` DOUBLE NOT NULL DEFAULT 0;
ALTER TABLE `suppliers` ADD COLUMN `supplier_opening_balance_date` DATETIME(3) NULL;
