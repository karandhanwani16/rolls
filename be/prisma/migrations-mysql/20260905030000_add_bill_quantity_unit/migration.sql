-- AlterTable
ALTER TABLE `sales` ADD COLUMN `sales_unit` VARCHAR(10) NOT NULL DEFAULT 'm';

-- AlterTable
ALTER TABLE `purchases` ADD COLUMN `purchase_unit` VARCHAR(10) NOT NULL DEFAULT 'm';

-- Backfill sale unit from majority item unit
UPDATE `sales` s
SET s.`sales_unit` = COALESCE((
  SELECT si.`sales_items_unit`
  FROM `sales_items` si
  WHERE si.`sales_id` = s.`sales_id`
  GROUP BY si.`sales_items_unit`
  ORDER BY COUNT(*) DESC
  LIMIT 1
), 'm');

-- Backfill purchase unit from majority item unit
UPDATE `purchases` p
SET p.`purchase_unit` = COALESCE((
  SELECT pi.`purchase_items_unit`
  FROM `purchase_items` pi
  WHERE pi.`purchase_id` = p.`purchase_id`
  GROUP BY pi.`purchase_items_unit`
  ORDER BY COUNT(*) DESC
  LIMIT 1
), 'm');

-- Align item units with bill unit
UPDATE `sales_items` si
INNER JOIN `sales` s ON s.`sales_id` = si.`sales_id`
SET si.`sales_items_unit` = s.`sales_unit`;

UPDATE `purchase_items` pi
INNER JOIN `purchases` p ON p.`purchase_id` = pi.`purchase_id`
SET pi.`purchase_items_unit` = p.`purchase_unit`;
