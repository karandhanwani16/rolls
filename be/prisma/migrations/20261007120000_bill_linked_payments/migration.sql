-- AlterTable
ALTER TABLE "paymentin" ADD COLUMN "sale_id" TEXT;

-- AlterTable
ALTER TABLE "payments_out" ADD COLUMN "purchase_id" TEXT;

-- CreateTable
CREATE TABLE "supplier_bill_to_bill_payments" (
    "supplier_bill_to_bill_payment_id" TEXT NOT NULL PRIMARY KEY,
    "supplier_id" TEXT NOT NULL,
    "bill_clear_date" DATETIME NOT NULL,
    "bill_overflow_amount" REAL NOT NULL DEFAULT 0,
    "bill_latest_clear_date" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "supplier_bill_to_bill_payments_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers" ("supplier_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "supplier_bill_to_bill_payment_details" (
    "supplier_bill_detail_id" TEXT NOT NULL PRIMARY KEY,
    "bill_payment_id" TEXT NOT NULL,
    "purchase_id" TEXT NOT NULL,
    "cleared_amount" REAL NOT NULL,
    "payment_status" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "supplier_bill_to_bill_payment_details_bill_payment_id_fkey" FOREIGN KEY ("bill_payment_id") REFERENCES "supplier_bill_to_bill_payments" ("supplier_bill_to_bill_payment_id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "supplier_bill_to_bill_payment_details_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases" ("purchase_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "supplier_bill_settlements" (
    "supplier_settlement_id" TEXT NOT NULL PRIMARY KEY,
    "bill_payment_id" TEXT NOT NULL,
    "settlement_date" DATETIME NOT NULL,
    "total_amount" REAL NOT NULL,
    "overflow_amount" REAL NOT NULL DEFAULT 0,
    "settlement_description" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "supplier_bill_settlements_bill_payment_id_fkey" FOREIGN KEY ("bill_payment_id") REFERENCES "supplier_bill_to_bill_payments" ("supplier_bill_to_bill_payment_id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "paymentin_sale_id_idx" ON "paymentin"("sale_id");

-- CreateIndex
CREATE INDEX "payments_out_purchase_id_idx" ON "payments_out"("purchase_id");
