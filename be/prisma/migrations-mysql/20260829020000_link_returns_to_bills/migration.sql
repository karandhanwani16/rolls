-- AlterTable
ALTER TABLE `sales_returns` ADD COLUMN `sales_return_sale_id` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `purchase_returns` ADD COLUMN `purchase_return_purchase_id` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `sales_returns` ADD CONSTRAINT `sales_returns_sales_return_sale_id_fkey` FOREIGN KEY (`sales_return_sale_id`) REFERENCES `sales`(`sales_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_returns` ADD CONSTRAINT `purchase_returns_purchase_return_purchase_id_fkey` FOREIGN KEY (`purchase_return_purchase_id`) REFERENCES `purchases`(`purchase_id`) ON DELETE SET NULL ON UPDATE CASCADE;
