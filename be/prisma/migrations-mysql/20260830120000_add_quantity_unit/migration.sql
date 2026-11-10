-- AlterTable: quantity unit on item tables (m = meters, yd = yards, kg = kilograms)
ALTER TABLE `purchase_items` ADD COLUMN `purchase_items_unit` VARCHAR(10) NOT NULL DEFAULT 'm';
ALTER TABLE `sales_items` ADD COLUMN `sales_items_unit` VARCHAR(10) NOT NULL DEFAULT 'm';
ALTER TABLE `sales_return_items` ADD COLUMN `sales_return_items_unit` VARCHAR(10) NOT NULL DEFAULT 'm';
ALTER TABLE `purchase_return_items` ADD COLUMN `purchase_return_items_unit` VARCHAR(10) NOT NULL DEFAULT 'm';
