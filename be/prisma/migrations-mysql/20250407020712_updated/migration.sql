-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `profiles` (
    `id` VARCHAR(191) NOT NULL,
    `full_name` VARCHAR(191) NULL,
    `avatar_url` VARCHAR(191) NULL,
    `role` VARCHAR(191) NULL DEFAULT 'user',
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customers` (
    `customer_id` VARCHAR(191) NOT NULL,
    `customer_name` VARCHAR(191) NOT NULL,
    `customer_phone` VARCHAR(191) NULL,
    `customer_description` VARCHAR(191) NULL,
    `customer_city` VARCHAR(191) NULL,
    `customer_type` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`customer_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `suppliers` (
    `supplier_id` VARCHAR(191) NOT NULL,
    `supplier_name` VARCHAR(191) NOT NULL,
    `supplier_phone` VARCHAR(191) NULL,
    `supplier_description` VARCHAR(191) NULL,
    `supplier_city` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`supplier_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `grades` (
    `grade_id` VARCHAR(191) NOT NULL,
    `grade_name` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`grade_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `godowns` (
    `godown_id` VARCHAR(191) NOT NULL,
    `godown_name` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`godown_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments_in` (
    `payment_in_id` VARCHAR(191) NOT NULL,
    `payment_in_customer_type` VARCHAR(191) NOT NULL,
    `payment_in_receive_id` VARCHAR(191) NULL,
    `payment_in_actual_id` VARCHAR(191) NULL,
    `payment_in_received_amount` DOUBLE NOT NULL,
    `payment_in_actual_amount` DOUBLE NOT NULL,
    `payment_in_charges` DOUBLE NULL DEFAULT 0,
    `payment_in_type` VARCHAR(191) NOT NULL,
    `payment_in_description` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `customer_id` VARCHAR(191) NULL,

    PRIMARY KEY (`payment_in_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments_out` (
    `payment_out_id` VARCHAR(191) NOT NULL,
    `supplier_id` VARCHAR(191) NOT NULL,
    `payment_out_amount` DOUBLE NOT NULL,
    `payment_out_description` VARCHAR(191) NULL,
    `payment_out_type` VARCHAR(191) NOT NULL,
    `payment_out_cheque_date` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`payment_out_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchases` (
    `purchase_id` VARCHAR(191) NOT NULL,
    `supplier_id` VARCHAR(191) NOT NULL,
    `supplier_name` VARCHAR(191) NOT NULL,
    `purchase_date` DATETIME(3) NOT NULL,
    `purchase_total` DOUBLE NOT NULL,
    `purchase_no` VARCHAR(191) NOT NULL,
    `purchase_description` VARCHAR(191) NULL,
    `purchase_godown` VARCHAR(191) NULL,
    `purchase_transport` VARCHAR(191) NULL,
    `purchase_received_by` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`purchase_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_items` (
    `purchase_items_id` VARCHAR(191) NOT NULL,
    `purchase_id` VARCHAR(191) NOT NULL,
    `product_id` VARCHAR(191) NULL,
    `product_name` VARCHAR(191) NOT NULL,
    `product_grade_id` VARCHAR(191) NULL,
    `product_grade_name` VARCHAR(191) NULL,
    `purchase_items_roll_no` VARCHAR(191) NULL,
    `purchase_items_meters` DOUBLE NOT NULL,
    `purchase_items_price` DOUBLE NOT NULL,
    `purchase_items_total` DOUBLE NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`purchase_items_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sales` (
    `sales_id` VARCHAR(191) NOT NULL,
    `sales_date` DATETIME(3) NOT NULL,
    `sales_no` VARCHAR(191) NOT NULL,
    `customer_id` VARCHAR(191) NOT NULL,
    `customer_name` VARCHAR(191) NOT NULL,
    `sales_total` DOUBLE NOT NULL,
    `sales_description` VARCHAR(191) NULL,
    `sales_hamaal` VARCHAR(191) NULL,
    `sales_challan_no` VARCHAR(191) NULL,
    `sales_by` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`sales_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sales_items` (
    `sales_items_id` VARCHAR(191) NOT NULL,
    `sales_id` VARCHAR(191) NOT NULL,
    `product_id` VARCHAR(191) NULL,
    `product_name` VARCHAR(191) NOT NULL,
    `grade_id` VARCHAR(191) NULL,
    `sales_items_roll_no` VARCHAR(191) NULL,
    `sales_items_meters` DOUBLE NOT NULL,
    `sales_items_price` DOUBLE NOT NULL,
    `sales_items_total` DOUBLE NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`sales_items_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bill_to_bill_payments` (
    `bill_to_bill_payment_id` VARCHAR(191) NOT NULL,
    `customer_id` VARCHAR(191) NOT NULL,
    `bill_clear_date` DATETIME(3) NOT NULL,
    `bill_overflow_amount` DOUBLE NOT NULL DEFAULT 0,
    `bill_latest_clear_date` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`bill_to_bill_payment_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bill_to_bill_payment_details` (
    `bill_detail_id` VARCHAR(191) NOT NULL,
    `bill_payment_id` VARCHAR(191) NOT NULL,
    `sale_id` VARCHAR(191) NOT NULL,
    `cleared_amount` DOUBLE NOT NULL,
    `payment_status` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`bill_detail_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `profiles` ADD CONSTRAINT `profiles_id_fkey` FOREIGN KEY (`id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments_in` ADD CONSTRAINT `payments_in_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`customer_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments_out` ADD CONSTRAINT `payments_out_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`supplier_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchases` ADD CONSTRAINT `purchases_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`supplier_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_items` ADD CONSTRAINT `purchase_items_purchase_id_fkey` FOREIGN KEY (`purchase_id`) REFERENCES `purchases`(`purchase_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales` ADD CONSTRAINT `sales_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`customer_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_items` ADD CONSTRAINT `sales_items_sales_id_fkey` FOREIGN KEY (`sales_id`) REFERENCES `sales`(`sales_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bill_to_bill_payments` ADD CONSTRAINT `bill_to_bill_payments_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`customer_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bill_to_bill_payment_details` ADD CONSTRAINT `bill_to_bill_payment_details_bill_payment_id_fkey` FOREIGN KEY (`bill_payment_id`) REFERENCES `bill_to_bill_payments`(`bill_to_bill_payment_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bill_to_bill_payment_details` ADD CONSTRAINT `bill_to_bill_payment_details_sale_id_fkey` FOREIGN KEY (`sale_id`) REFERENCES `sales`(`sales_id`) ON DELETE RESTRICT ON UPDATE CASCADE;
