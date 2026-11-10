-- AlterTable
ALTER TABLE `purchases` ADD COLUMN `purchase_transport_charges` DOUBLE NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `sales` ADD COLUMN `sales_transport_charges` DOUBLE NULL DEFAULT 0;
