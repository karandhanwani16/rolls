-- AlterTable
ALTER TABLE `customers` ADD COLUMN `customer_credit_days` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `sales` ADD COLUMN `sales_credit_days` INTEGER NOT NULL DEFAULT 0;
