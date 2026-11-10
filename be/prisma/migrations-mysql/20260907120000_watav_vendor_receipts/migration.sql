-- Watav vendor receipts with FIFO allocation history (partial settlement)

CREATE TABLE `watav_vendor_receipts` (
  `receipt_id` VARCHAR(191) NOT NULL,
  `vendor_id` VARCHAR(191) NOT NULL,
  `receipt_date` DATETIME(3) NOT NULL,
  `receipt_amount` DOUBLE NOT NULL,
  `unallocated_amount` DOUBLE NOT NULL DEFAULT 0,
  `receipt_type` VARCHAR(191) NOT NULL,
  `receipt_reference` VARCHAR(191) NULL,
  `receipt_description` VARCHAR(191) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`receipt_id`),
  INDEX `watav_vendor_receipts_vendor_id_idx` (`vendor_id`),
  INDEX `watav_vendor_receipts_receipt_date_idx` (`receipt_date`),
  CONSTRAINT `watav_vendor_receipts_vendor_id_fkey`
    FOREIGN KEY (`vendor_id`) REFERENCES `customers` (`customer_id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `watav_settlement_allocations` (
  `allocation_id` VARCHAR(191) NOT NULL,
  `receipt_id` VARCHAR(191) NOT NULL,
  `payment_in_id` VARCHAR(191) NOT NULL,
  `allocated_amount` DOUBLE NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`allocation_id`),
  INDEX `watav_settlement_allocations_receipt_id_idx` (`receipt_id`),
  INDEX `watav_settlement_allocations_payment_in_id_idx` (`payment_in_id`),
  CONSTRAINT `watav_settlement_allocations_receipt_id_fkey`
    FOREIGN KEY (`receipt_id`) REFERENCES `watav_vendor_receipts` (`receipt_id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `watav_settlement_allocations_payment_in_id_fkey`
    FOREIGN KEY (`payment_in_id`) REFERENCES `paymentin` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Preserve historical collected entries as COMPLETED without inventing receipt rows
UPDATE `paymentin`
SET `collection_status` = 'COMPLETED'
WHERE `payment_category` = 'VATAV'
  AND `collection_status` = 'COLLECTED';
