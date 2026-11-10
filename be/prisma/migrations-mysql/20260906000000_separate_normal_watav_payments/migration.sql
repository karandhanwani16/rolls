-- Separate NORMAL payments from VATAV (Watav) flows with entry type + collection status

ALTER TABLE `paymentin` ADD COLUMN `payment_category` VARCHAR(191) NOT NULL DEFAULT 'NORMAL';
ALTER TABLE `paymentin` ADD COLUMN `entry_type` VARCHAR(191) NULL;
ALTER TABLE `paymentin` ADD COLUMN `collection_status` VARCHAR(191) NULL;
ALTER TABLE `paymentin` ADD COLUMN `collection_date` DATETIME(3) NULL;

CREATE INDEX `paymentin_payment_category_idx` ON `paymentin`(`payment_category`);
CREATE INDEX `paymentin_collection_status_idx` ON `paymentin`(`collection_status`);

-- Backfill legacy Watav pattern: receive party differs from actual (paying) customer
UPDATE `paymentin`
SET
  `payment_category` = 'VATAV',
  `entry_type` = 'CUSTOMER_PAYMENT',
  `collection_status` = 'PENDING'
WHERE
  `receive_id` IS NOT NULL
  AND `actual_id` IS NOT NULL
  AND `receive_id` <> `actual_id`;
