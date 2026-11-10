-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_product_grade_id_fkey` FOREIGN KEY (`product_grade_id`) REFERENCES `grades`(`grade_id`) ON DELETE SET NULL ON UPDATE CASCADE;
