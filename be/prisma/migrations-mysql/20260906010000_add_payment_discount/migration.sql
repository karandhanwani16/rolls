-- Payment-in discount: settles customer books above cash/watav received amount

ALTER TABLE `paymentin` ADD COLUMN `payment_discount` DOUBLE NULL DEFAULT 0;
