-- AlterEnum
ALTER TABLE `purchase_items` MODIFY COLUMN `purchase_items_status` ENUM('UNSOLD', 'SOLD', 'RETURNED') NOT NULL;

-- CreateTable
CREATE TABLE `sales_returns` (
    `sales_return_id` VARCHAR(191) NOT NULL,
    `sales_return_date` DATETIME(3) NOT NULL,
    `sales_return_no` VARCHAR(191) NOT NULL,
    `customer_id` VARCHAR(191) NOT NULL,
    `customer_name` VARCHAR(191) NOT NULL,
    `sales_return_total` DOUBLE NOT NULL,
    `sales_return_description` VARCHAR(191) NULL,
    `sales_return_transport_charges` DOUBLE NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`sales_return_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `sales_return_items` (
    `sales_return_items_id` VARCHAR(191) NOT NULL,
    `sales_return_id` VARCHAR(191) NOT NULL,
    `product_id` VARCHAR(191) NULL,
    `product_name` VARCHAR(191) NOT NULL,
    `purchase_item_id` VARCHAR(191) NULL,
    `sales_return_items_roll_no` VARCHAR(191) NULL,
    `sales_return_items_meters` DOUBLE NOT NULL,
    `sales_return_items_price` DOUBLE NOT NULL,
    `sales_return_items_total` DOUBLE NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`sales_return_items_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `purchase_returns` (
    `purchase_return_id` VARCHAR(191) NOT NULL,
    `purchase_return_date` DATETIME(3) NOT NULL,
    `purchase_return_no` VARCHAR(191) NOT NULL,
    `supplier_id` VARCHAR(191) NOT NULL,
    `supplier_name` VARCHAR(191) NOT NULL,
    `purchase_return_total` DOUBLE NOT NULL,
    `purchase_return_description` VARCHAR(191) NULL,
    `purchase_return_transport_charges` DOUBLE NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`purchase_return_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `purchase_return_items` (
    `purchase_return_items_id` VARCHAR(191) NOT NULL,
    `purchase_return_id` VARCHAR(191) NOT NULL,
    `product_id` VARCHAR(191) NULL,
    `product_name` VARCHAR(191) NOT NULL,
    `product_grade_id` VARCHAR(191) NULL,
    `product_grade_name` VARCHAR(191) NULL,
    `purchase_item_id` VARCHAR(191) NULL,
    `purchase_return_items_roll_no` VARCHAR(191) NULL,
    `purchase_return_items_meters` DOUBLE NOT NULL,
    `purchase_return_items_price` DOUBLE NOT NULL,
    `purchase_return_items_total` DOUBLE NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`purchase_return_items_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `sales_returns` ADD CONSTRAINT `sales_returns_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`customer_id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `sales_return_items` ADD CONSTRAINT `sales_return_items_sales_return_id_fkey` FOREIGN KEY (`sales_return_id`) REFERENCES `sales_returns`(`sales_return_id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `purchase_returns` ADD CONSTRAINT `purchase_returns_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`supplier_id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `purchase_return_items` ADD CONSTRAINT `purchase_return_items_purchase_return_id_fkey` FOREIGN KEY (`purchase_return_id`) REFERENCES `purchase_returns`(`purchase_return_id`) ON DELETE CASCADE ON UPDATE CASCADE;
