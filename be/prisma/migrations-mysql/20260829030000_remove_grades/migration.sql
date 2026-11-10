-- DropForeignKey
ALTER TABLE `products` DROP FOREIGN KEY `products_product_grade_id_fkey`;

-- AlterTable
ALTER TABLE `products` DROP COLUMN `product_grade_id`, DROP COLUMN `product_grade_name`;

-- AlterTable
ALTER TABLE `purchase_items` DROP COLUMN `product_grade_id`, DROP COLUMN `product_grade_name`;

-- AlterTable
ALTER TABLE `sales_items` DROP COLUMN `grade_id`;

-- AlterTable
ALTER TABLE `purchase_return_items` DROP COLUMN `product_grade_id`, DROP COLUMN `product_grade_name`;

-- DropTable
DROP TABLE `grades`;
