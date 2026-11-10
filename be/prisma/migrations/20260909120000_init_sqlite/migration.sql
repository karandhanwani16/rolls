-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "full_name" TEXT,
    "avatar_url" TEXT,
    "role" TEXT DEFAULT 'user',
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "customers" (
    "customer_id" TEXT NOT NULL PRIMARY KEY,
    "customer_name" TEXT NOT NULL,
    "customer_phone" TEXT,
    "customer_description" TEXT,
    "customer_city" TEXT,
    "customer_type" TEXT,
    "customer_opening_balance" REAL NOT NULL DEFAULT 0,
    "customer_opening_balance_date" DATETIME,
    "customer_credit_days" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "suppliers" (
    "supplier_id" TEXT NOT NULL PRIMARY KEY,
    "supplier_name" TEXT NOT NULL,
    "supplier_phone" TEXT,
    "supplier_description" TEXT,
    "supplier_city" TEXT,
    "supplier_opening_balance" REAL NOT NULL DEFAULT 0,
    "supplier_opening_balance_date" DATETIME,
    "supplier_credit_days" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "godowns" (
    "godown_id" TEXT NOT NULL PRIMARY KEY,
    "godown_name" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "paymentin" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "payment_date" DATETIME,
    "receive_id" TEXT,
    "actual_id" TEXT,
    "received_amount" REAL NOT NULL,
    "actual_amount" REAL NOT NULL,
    "charges" REAL,
    "payment_discount" REAL DEFAULT 0,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "payment_category" TEXT NOT NULL DEFAULT 'NORMAL',
    "entry_type" TEXT,
    "collection_status" TEXT,
    "collection_date" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "paymentin_receive_id_fkey" FOREIGN KEY ("receive_id") REFERENCES "customers" ("customer_id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "paymentin_actual_id_fkey" FOREIGN KEY ("actual_id") REFERENCES "customers" ("customer_id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "watav_vendor_receipts" (
    "receipt_id" TEXT NOT NULL PRIMARY KEY,
    "vendor_id" TEXT NOT NULL,
    "receipt_date" DATETIME NOT NULL,
    "receipt_amount" REAL NOT NULL,
    "unallocated_amount" REAL NOT NULL DEFAULT 0,
    "receipt_type" TEXT NOT NULL,
    "receipt_reference" TEXT,
    "receipt_description" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "watav_vendor_receipts_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "customers" ("customer_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "watav_settlement_allocations" (
    "allocation_id" TEXT NOT NULL PRIMARY KEY,
    "receipt_id" TEXT NOT NULL,
    "payment_in_id" TEXT NOT NULL,
    "allocated_amount" REAL NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "watav_settlement_allocations_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "watav_vendor_receipts" ("receipt_id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "watav_settlement_allocations_payment_in_id_fkey" FOREIGN KEY ("payment_in_id") REFERENCES "paymentin" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "payments_out" (
    "payment_out_id" TEXT NOT NULL PRIMARY KEY,
    "payment_out_date" DATETIME,
    "supplier_id" TEXT NOT NULL,
    "payment_out_amount" REAL NOT NULL,
    "payment_out_description" TEXT,
    "payment_out_type" TEXT NOT NULL,
    "payment_out_cheque_date" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payments_out_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers" ("supplier_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "purchases" (
    "purchase_id" TEXT NOT NULL PRIMARY KEY,
    "supplier_id" TEXT NOT NULL,
    "supplier_name" TEXT NOT NULL,
    "purchase_date" DATETIME NOT NULL,
    "purchase_total" REAL NOT NULL,
    "purchase_no" TEXT NOT NULL,
    "purchase_description" TEXT,
    "purchase_godown" TEXT,
    "purchase_transport" TEXT,
    "purchase_transport_charges" REAL DEFAULT 0,
    "purchase_discount" REAL DEFAULT 0,
    "purchase_credit_days" INTEGER NOT NULL DEFAULT 0,
    "purchase_unit" TEXT NOT NULL DEFAULT 'm',
    "purchase_received_by" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "purchases_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers" ("supplier_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "purchase_items" (
    "purchase_items_id" TEXT NOT NULL PRIMARY KEY,
    "purchase_id" TEXT NOT NULL,
    "product_id" TEXT,
    "product_name" TEXT NOT NULL,
    "purchase_items_roll_no" TEXT,
    "purchase_items_shade" TEXT,
    "purchase_items_width" TEXT,
    "purchase_items_meters" REAL NOT NULL,
    "purchase_items_unit" TEXT NOT NULL DEFAULT 'm',
    "purchase_items_price" REAL NOT NULL,
    "purchase_items_total" REAL NOT NULL,
    "purchase_items_status" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "purchase_items_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases" ("purchase_id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sales" (
    "sales_id" TEXT NOT NULL PRIMARY KEY,
    "sales_date" DATETIME NOT NULL,
    "sales_no" TEXT NOT NULL,
    "sales_godown_id" TEXT,
    "customer_id" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "sales_total" REAL NOT NULL,
    "sales_description" TEXT,
    "sales_hamaal" TEXT,
    "sales_challan_no" TEXT,
    "sales_maker" TEXT,
    "sales_by" TEXT,
    "sales_transport_charges" REAL DEFAULT 0,
    "sales_discount" REAL DEFAULT 0,
    "sales_credit_days" INTEGER NOT NULL DEFAULT 0,
    "sales_unit" TEXT NOT NULL DEFAULT 'm',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sales_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("customer_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "sales_sales_godown_id_fkey" FOREIGN KEY ("sales_godown_id") REFERENCES "godowns" ("godown_id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sales_items" (
    "sales_items_id" TEXT NOT NULL PRIMARY KEY,
    "sales_id" TEXT NOT NULL,
    "product_id" TEXT,
    "product_name" TEXT NOT NULL,
    "purchase_item_id" TEXT,
    "sales_items_roll_no" TEXT,
    "sales_items_shade" TEXT,
    "sales_items_width" TEXT,
    "sales_items_meters" REAL NOT NULL,
    "sales_items_unit" TEXT NOT NULL DEFAULT 'm',
    "sales_items_price" REAL NOT NULL,
    "sales_items_total" REAL NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sales_items_sales_id_fkey" FOREIGN KEY ("sales_id") REFERENCES "sales" ("sales_id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sales_returns" (
    "sales_return_id" TEXT NOT NULL PRIMARY KEY,
    "sales_return_date" DATETIME NOT NULL,
    "sales_return_no" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "sales_return_sale_id" TEXT,
    "sales_return_total" REAL NOT NULL,
    "sales_return_description" TEXT,
    "sales_return_transport_charges" REAL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sales_returns_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("customer_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "sales_returns_sales_return_sale_id_fkey" FOREIGN KEY ("sales_return_sale_id") REFERENCES "sales" ("sales_id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sales_return_items" (
    "sales_return_items_id" TEXT NOT NULL PRIMARY KEY,
    "sales_return_id" TEXT NOT NULL,
    "product_id" TEXT,
    "product_name" TEXT NOT NULL,
    "purchase_item_id" TEXT,
    "sales_return_items_roll_no" TEXT,
    "sales_return_items_meters" REAL NOT NULL,
    "sales_return_items_unit" TEXT NOT NULL DEFAULT 'm',
    "sales_return_items_price" REAL NOT NULL,
    "sales_return_items_total" REAL NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sales_return_items_sales_return_id_fkey" FOREIGN KEY ("sales_return_id") REFERENCES "sales_returns" ("sales_return_id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "purchase_returns" (
    "purchase_return_id" TEXT NOT NULL PRIMARY KEY,
    "purchase_return_date" DATETIME NOT NULL,
    "purchase_return_no" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "supplier_name" TEXT NOT NULL,
    "purchase_return_purchase_id" TEXT,
    "purchase_return_total" REAL NOT NULL,
    "purchase_return_description" TEXT,
    "purchase_return_transport_charges" REAL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "purchase_returns_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers" ("supplier_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "purchase_returns_purchase_return_purchase_id_fkey" FOREIGN KEY ("purchase_return_purchase_id") REFERENCES "purchases" ("purchase_id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "purchase_return_items" (
    "purchase_return_items_id" TEXT NOT NULL PRIMARY KEY,
    "purchase_return_id" TEXT NOT NULL,
    "product_id" TEXT,
    "product_name" TEXT NOT NULL,
    "purchase_item_id" TEXT,
    "purchase_return_items_roll_no" TEXT,
    "purchase_return_items_meters" REAL NOT NULL,
    "purchase_return_items_unit" TEXT NOT NULL DEFAULT 'm',
    "purchase_return_items_price" REAL NOT NULL,
    "purchase_return_items_total" REAL NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "purchase_return_items_purchase_return_id_fkey" FOREIGN KEY ("purchase_return_id") REFERENCES "purchase_returns" ("purchase_return_id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "bill_to_bill_payments" (
    "bill_to_bill_payment_id" TEXT NOT NULL PRIMARY KEY,
    "customer_id" TEXT NOT NULL,
    "bill_clear_date" DATETIME NOT NULL,
    "bill_overflow_amount" REAL NOT NULL DEFAULT 0,
    "bill_latest_clear_date" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bill_to_bill_payments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("customer_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "bill_to_bill_payment_details" (
    "bill_detail_id" TEXT NOT NULL PRIMARY KEY,
    "bill_payment_id" TEXT NOT NULL,
    "sale_id" TEXT NOT NULL,
    "cleared_amount" REAL NOT NULL,
    "payment_status" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bill_to_bill_payment_details_bill_payment_id_fkey" FOREIGN KEY ("bill_payment_id") REFERENCES "bill_to_bill_payments" ("bill_to_bill_payment_id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "bill_to_bill_payment_details_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales" ("sales_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "bill_settlements" (
    "settlement_id" TEXT NOT NULL PRIMARY KEY,
    "bill_payment_id" TEXT NOT NULL,
    "settlement_date" DATETIME NOT NULL,
    "total_amount" REAL NOT NULL,
    "overflow_amount" REAL NOT NULL DEFAULT 0,
    "settlement_description" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bill_settlements_bill_payment_id_fkey" FOREIGN KEY ("bill_payment_id") REFERENCES "bill_to_bill_payments" ("bill_to_bill_payment_id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "products" (
    "product_id" TEXT NOT NULL PRIMARY KEY,
    "product_name" TEXT NOT NULL,
    "product_description" TEXT,
    "product_price" REAL NOT NULL,
    "product_color" TEXT,
    "product_width" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "transactions" (
    "transaction_id" TEXT NOT NULL PRIMARY KEY,
    "transaction_type" TEXT NOT NULL,
    "transaction_description" TEXT,
    "transaction_customer_id" TEXT,
    "transaction_supplier_id" TEXT,
    "transaction_amount" REAL NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "transactions_transaction_customer_id_fkey" FOREIGN KEY ("transaction_customer_id") REFERENCES "customers" ("customer_id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "transactions_transaction_supplier_id_fkey" FOREIGN KEY ("transaction_supplier_id") REFERENCES "suppliers" ("supplier_id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "paymentin_receive_id_idx" ON "paymentin"("receive_id");

-- CreateIndex
CREATE INDEX "paymentin_actual_id_idx" ON "paymentin"("actual_id");

-- CreateIndex
CREATE INDEX "paymentin_payment_category_idx" ON "paymentin"("payment_category");

-- CreateIndex
CREATE INDEX "paymentin_collection_status_idx" ON "paymentin"("collection_status");

-- CreateIndex
CREATE INDEX "watav_vendor_receipts_vendor_id_idx" ON "watav_vendor_receipts"("vendor_id");

-- CreateIndex
CREATE INDEX "watav_vendor_receipts_receipt_date_idx" ON "watav_vendor_receipts"("receipt_date");

-- CreateIndex
CREATE INDEX "watav_settlement_allocations_receipt_id_idx" ON "watav_settlement_allocations"("receipt_id");

-- CreateIndex
CREATE INDEX "watav_settlement_allocations_payment_in_id_idx" ON "watav_settlement_allocations"("payment_in_id");

