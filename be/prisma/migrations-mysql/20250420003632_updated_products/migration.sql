/*
  Warnings:

  - Added the required column `product_price` to the `products` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `products` ADD COLUMN `product_color` VARCHAR(191) NULL,
    ADD COLUMN `product_grade_id` VARCHAR(191) NULL,
    ADD COLUMN `product_grade_name` VARCHAR(191) NULL,
    ADD COLUMN `product_price` DOUBLE NOT NULL;
