const prisma = require('../prisma/client');
const transactionService = require('./transactions');
const watavSettlementService = require('./watavSettlementService');
const {
    SETTLEMENT_STATUS,
    decoratePayment,
    outstandingWhereFilter,
    addAmounts,
    compareAmounts,
    summarizeVendor,
} = require('./watavAllocation');

const PAYMENT_CATEGORY = {
    NORMAL: 'NORMAL',
    VATAV: 'VATAV',
};

const ENTRY_TYPE = {
    CUSTOMER_PAYMENT: 'CUSTOMER_PAYMENT',
    STANDALONE: 'STANDALONE',
};

const COLLECTION_STATUS = {
    PENDING: SETTLEMENT_STATUS.PENDING,
    PARTIALLY_SETTLED: SETTLEMENT_STATUS.PARTIALLY_SETTLED,
    COMPLETED: SETTLEMENT_STATUS.COMPLETED,
};

const PAYMENT_INCLUDE = watavSettlementService.PAYMENT_INCLUDE;

/**
 * Amount credited to the customer's ledger for a payment.
 * Cash/watav money received + discount settles the customer account.
 * NORMAL example: receive 9500 + discount 500 → credit 10000
 * VATAV customer example: gross 9000 + discount 500 → credit 9500
 *   (vendor charges do not reduce customer credit)
 * Standalone → 0 (no customer).
 * Vendor receipts never call this — they must not reduce customer balance again.
 */
function customerCreditAmount(payment) {
    if (!payment.actual_id) return 0;
    if (
        payment.payment_category === PAYMENT_CATEGORY.VATAV &&
        payment.entry_type === ENTRY_TYPE.STANDALONE
    ) {
        return 0;
    }
    const received = Number(payment.received_amount) || 0;
    const discount = Number(payment.discount) || 0;
    return received + discount;
}

function normalizePaymentPayload(paymentInData, { isCreate = false, existing = null } = {}) {
    const category = (paymentInData.payment_category || PAYMENT_CATEGORY.NORMAL).toUpperCase();
    const received = Number(paymentInData.received_amount) || 0;
    const charges = Number(paymentInData.charges) || 0;
    let discount = Number(paymentInData.discount) || 0;

    if (received <= 0) {
        throw new Error('Gross / received amount must be greater than 0');
    }
    if (charges < 0) {
        throw new Error('Charges cannot be negative');
    }
    if (discount < 0) {
        throw new Error('Discount cannot be negative');
    }
    if (charges > received) {
        throw new Error('Charges cannot exceed the gross amount');
    }

    if (category === PAYMENT_CATEGORY.NORMAL) {
        const customerId = paymentInData.actual_id || paymentInData.receive_id;
        if (!customerId) {
            throw new Error('Customer is required for a normal payment');
        }
        const saleId = paymentInData.sale_id || null;
        return {
            payment_category: PAYMENT_CATEGORY.NORMAL,
            entry_type: null,
            collection_status: null,
            collection_date: null,
            receive_id: customerId,
            actual_id: customerId,
            received_amount: received,
            charges: 0,
            discount,
            actual_amount: received,
            type: paymentInData.type,
            description: paymentInData.description || '',
            payment_date: paymentInData.payment_date,
            sale_id: saleId,
        };
    }

    if (category !== PAYMENT_CATEGORY.VATAV) {
        throw new Error('payment_category must be NORMAL or VATAV');
    }

    const entryType = (paymentInData.entry_type || ENTRY_TYPE.CUSTOMER_PAYMENT).toUpperCase();
    if (![ENTRY_TYPE.CUSTOMER_PAYMENT, ENTRY_TYPE.STANDALONE].includes(entryType)) {
        throw new Error('entry_type must be CUSTOMER_PAYMENT or STANDALONE for VATAV');
    }

    const vendorId = paymentInData.receive_id;
    if (!vendorId) {
        throw new Error('Watav vendor is required for a VATAV entry');
    }

    let actualId = paymentInData.actual_id || null;
    if (entryType === ENTRY_TYPE.CUSTOMER_PAYMENT) {
        if (!actualId) {
            throw new Error('Customer is required for a VATAV customer payment');
        }
        if (actualId === vendorId) {
            throw new Error('Customer and Watav vendor must be different');
        }
    } else {
        actualId = null;
        discount = 0;
    }

    // Settlement status is derived from vendor receipts, never from the payment form.
    let collectionStatus = SETTLEMENT_STATUS.PENDING;
    let collectionDate = null;
    if (!isCreate && existing) {
        const decorated = decoratePayment(existing);
        collectionStatus = decorated.settlementStatus;
        collectionDate = existing.collection_date || null;
        if (compareAmounts(decorated.totalSettledAmount, received) > 0) {
            throw new Error(
                'Cannot reduce the Watav amount below what has already been settled from the vendor'
            );
        }
        if (
            existing.watav_allocations?.length > 0 &&
            existing.receive_id &&
            existing.receive_id !== vendorId
        ) {
            throw new Error('Cannot change Watav vendor after settlement allocations exist');
        }
    }

    const saleId =
        entryType === ENTRY_TYPE.CUSTOMER_PAYMENT ? paymentInData.sale_id || null : null;

    return {
        payment_category: PAYMENT_CATEGORY.VATAV,
        entry_type: entryType,
        collection_status: collectionStatus,
        collection_date: collectionDate,
        receive_id: vendorId,
        actual_id: actualId,
        received_amount: received,
        charges,
        discount,
        actual_amount: received - charges,
        type: paymentInData.type || 'other',
        description: paymentInData.description || '',
        payment_date: paymentInData.payment_date,
        sale_id: saleId,
    };
}

function paymentCreateData(normalized) {
    return {
        received_amount: normalized.received_amount,
        actual_amount: normalized.actual_amount,
        charges: normalized.charges,
        discount: normalized.discount || 0,
        type: normalized.type,
        description: normalized.description,
        payment_date: normalized.payment_date,
        payment_category: normalized.payment_category,
        entry_type: normalized.entry_type,
        collection_status: normalized.collection_status,
        collection_date: normalized.collection_date,
        ...(normalized.receive_id
            ? { receive_customer: { connect: { id: normalized.receive_id } } }
            : {}),
        ...(normalized.actual_id
            ? { actual_customer: { connect: { id: normalized.actual_id } } }
            : {}),
        ...(normalized.sale_id
            ? { sale: { connect: { id: normalized.sale_id } } }
            : {}),
    };
}

async function validateSaleBillLink({ saleId, customerId, creditAmount, excludePaymentId = null }) {
    if (!saleId) return;

    if (!customerId) {
        throw new Error('Customer is required for a full bill payment');
    }

    const sale = await prisma.sale.findUnique({ where: { id: saleId } });
    if (!sale) {
        throw new Error('Sale bill not found');
    }
    if (sale.customer_id !== customerId) {
        throw new Error('Selected bill does not belong to this customer');
    }

    const existingLink = await prisma.paymentIn.findFirst({
        where: {
            sale_id: saleId,
            ...(excludePaymentId ? { id: { not: excludePaymentId } } : {}),
        },
    });
    if (existingLink) {
        throw new Error('This bill already has a full bill payment');
    }

    const { allocateSaleOutstanding } = require('../utils/saleOutstanding');
    const [sales, payments, saleReturns, customer] = await Promise.all([
        prisma.sale.findMany({ where: { customer_id: customerId } }),
        prisma.paymentIn.findMany({
            where: {
                actual_id: customerId,
                NOT: {
                    payment_category: PAYMENT_CATEGORY.VATAV,
                    entry_type: ENTRY_TYPE.STANDALONE,
                },
                ...(excludePaymentId ? { id: { not: excludePaymentId } } : {}),
            },
        }),
        prisma.saleReturn.findMany({ where: { customer_id: customerId } }),
        prisma.customer.findUnique({ where: { id: customerId } }),
    ]);

    const remainingById = allocateSaleOutstanding({
        sales,
        payments,
        saleReturns,
        customers: customer ? [customer] : [],
    });
    const remaining =
        remainingById.get(saleId)?.remaining_amount ?? (Number(sale.total) || 0);
    if (remaining <= 0) {
        throw new Error('Selected bill is already fully paid');
    }
    if (compareAmounts(creditAmount, remaining) < 0) {
        throw new Error(
            `Full bill payment must cover the remaining amount of ${remaining.toFixed(2)}`
        );
    }
}

function mapWatavReportRow(payment, index) {
    const decorated = decoratePayment(payment);
    const isStandalone = payment.entry_type === ENTRY_TYPE.STANDALONE || !payment.actual_id;
    return {
        srno: index + 1,
        id: payment.id,
        date: payment.payment_date || payment.created_at,
        watavCustomerId: payment.receive_id,
        watavCustomerName: payment.receive_customer?.name || 'Unknown',
        actualCustomerId: payment.actual_id,
        actualCustomerName: isStandalone
            ? null
            : payment.actual_customer?.name || 'Unknown',
        entryType: isStandalone ? ENTRY_TYPE.STANDALONE : ENTRY_TYPE.CUSTOMER_PAYMENT,
        collectionStatus: decorated.settlementStatus,
        collectionDate: payment.collection_date,
        originalAmount: decorated.originalAmount,
        totalSettledAmount: decorated.totalSettledAmount,
        remainingAmount: decorated.remainingAmount,
        receivedAmount: payment.received_amount || 0,
        paidToWatav: payment.charges || 0,
        vendorCharges: payment.charges || 0,
        discount: payment.discount || 0,
        customerSettled: isStandalone
            ? 0
            : (payment.received_amount || 0) + (payment.discount || 0),
        actualAmount: payment.actual_amount || 0,
        netAmount: payment.actual_amount || 0,
        type: payment.type,
        description: payment.description || '',
        allocations: (payment.watav_allocations || []).map((row) => ({
            id: row.id,
            allocatedAmount: row.allocated_amount,
            receiptId: row.receipt_id,
            receiptDate: row.receipt?.receipt_date || null,
            receiptAmount: row.receipt?.amount || null,
            receiptReference: row.receipt?.reference || null,
            unallocatedAmount: row.receipt?.unallocated_amount || 0,
        })),
    };
}

class PaymentInService {
    async getAllPaymentsIn() {
        try {
            const paymentsIn = await prisma.paymentIn.findMany({
                include: PAYMENT_INCLUDE,
                orderBy: {
                    created_at: 'desc',
                },
            });
            return paymentsIn.map(decoratePayment);
        } catch (error) {
            throw new Error(`Failed to fetch payments in: ${error.message}`);
        }
    }

    async getPaymentInById(id) {
        try {
            const paymentIn = await prisma.paymentIn.findUnique({
                where: { id },
                include: PAYMENT_INCLUDE,
            });

            if (!paymentIn) {
                throw new Error(`Payment in with ID ${id} not found`);
            }

            return decoratePayment(paymentIn);
        } catch (error) {
            throw new Error(`Failed to fetch payment in: ${error.message}`);
        }
    }

    async createPaymentIn(paymentInData) {
        try {
            const normalized = normalizePaymentPayload(paymentInData, { isCreate: true });
            const creditPreview = customerCreditAmount(normalized);
            await validateSaleBillLink({
                saleId: normalized.sale_id,
                customerId: normalized.actual_id,
                creditAmount: creditPreview,
            });

            const newPaymentIn = await prisma.paymentIn.create({
                data: paymentCreateData(normalized),
                include: PAYMENT_INCLUDE,
            });

            const credit = customerCreditAmount(newPaymentIn);
            if (credit > 0 && newPaymentIn.actual_id) {
                const billLabel = newPaymentIn.sale?.sales_no
                    ? ` for bill ${newPaymentIn.sale.sales_no}`
                    : '';
                const label =
                    newPaymentIn.payment_category === PAYMENT_CATEGORY.VATAV
                        ? `Watav payment from ${newPaymentIn.actual_customer?.name || 'Customer'}${billLabel}`
                        : `Payment received from ${newPaymentIn.actual_customer?.name || 'Customer'}${billLabel}`;
                await transactionService.createTransactionRecord(
                    'incoming',
                    label,
                    newPaymentIn.actual_id,
                    null,
                    credit
                );
            }

            return decoratePayment(newPaymentIn);
        } catch (error) {
            throw new Error(`Failed to create payment in: ${error.message}`);
        }
    }

    async updatePaymentIn(id, paymentInData) {
        try {
            const existing = await prisma.paymentIn.findUnique({
                where: { id },
                include: { watav_allocations: true },
            });
            if (!existing) {
                throw new Error(`Payment in with ID ${id} not found`);
            }

            const normalized = normalizePaymentPayload(
                {
                    ...existing,
                    ...paymentInData,
                },
                { isCreate: false, existing }
            );

            if (
                existing.payment_category === PAYMENT_CATEGORY.VATAV &&
                normalized.payment_category === PAYMENT_CATEGORY.NORMAL &&
                existing.watav_allocations?.length > 0
            ) {
                throw new Error('Cannot convert a settled Watav payment to a normal payment');
            }

            await validateSaleBillLink({
                saleId: normalized.sale_id,
                customerId: normalized.actual_id,
                creditAmount: customerCreditAmount(normalized),
                excludePaymentId: id,
            });

            const updatedPaymentIn = await prisma.paymentIn.update({
                where: { id },
                data: {
                    received_amount: normalized.received_amount,
                    actual_amount: normalized.actual_amount,
                    charges: normalized.charges,
                    discount: normalized.discount || 0,
                    type: normalized.type,
                    description: normalized.description,
                    payment_date: normalized.payment_date,
                    payment_category: normalized.payment_category,
                    entry_type: normalized.entry_type,
                    collection_status: normalized.collection_status,
                    collection_date: normalized.collection_date,
                    receive_id: normalized.receive_id,
                    actual_id: normalized.actual_id,
                    sale_id: normalized.sale_id || null,
                },
                include: PAYMENT_INCLUDE,
            });

            if (updatedPaymentIn.payment_category === PAYMENT_CATEGORY.VATAV) {
                await watavSettlementService.recalcPaymentStatus(prisma, updatedPaymentIn.id);
            }

            const refreshed = await prisma.paymentIn.findUnique({
                where: { id },
                include: PAYMENT_INCLUDE,
            });

            const credit = customerCreditAmount(refreshed);
            if (credit > 0 && refreshed.actual_id) {
                await transactionService.createTransactionRecord(
                    'incoming',
                    `Payment updated for ${refreshed.actual_customer?.name || 'Customer'}`,
                    refreshed.actual_id,
                    null,
                    credit
                );
            }

            return decoratePayment(refreshed);
        } catch (error) {
            throw new Error(`Failed to update payment in: ${error.message}`);
        }
    }

    async deletePaymentIn(id) {
        try {
            const paymentIn = await prisma.paymentIn.findUnique({
                where: { id },
                include: {
                    actual_customer: true,
                    watav_allocations: true,
                },
            });

            if (!paymentIn) {
                throw new Error(`Payment in with ID ${id} not found`);
            }

            if (paymentIn.watav_allocations?.length > 0) {
                throw new Error(
                    'Cannot delete a Watav payment that has vendor settlement allocations. Delete the vendor receipt first.'
                );
            }

            const credit = customerCreditAmount(paymentIn);
            if (credit > 0 && paymentIn.actual_id) {
                await transactionService.createTransactionRecord(
                    'outgoing',
                    `Payment deleted for ${paymentIn.actual_customer?.name || 'Customer'}`,
                    paymentIn.actual_id,
                    null,
                    credit
                );
            }

            await prisma.paymentIn.delete({
                where: { id },
            });
            return { success: true, message: 'Payment in deleted successfully' };
        } catch (error) {
            throw new Error(`Failed to delete payment in: ${error.message}`);
        }
    }

    async createWatavVendorReceipt(data) {
        return watavSettlementService.createVendorReceipt(data);
    }

    async getWatavVendorReceipts(filters) {
        return watavSettlementService.getReceipts(filters);
    }

    async getWatavVendorReceiptById(id) {
        return watavSettlementService.getReceiptById(id);
    }

    async deleteWatavVendorReceipt(id) {
        return watavSettlementService.deleteVendorReceipt(id);
    }

    /**
     * Backward-compatible collect: records a vendor receipt and FIFO-allocates.
     * Prefer createWatavVendorReceipt with vendor_id + amount.
     */
    async collectWatavEntries({ ids, collection_date, vendor_id, amount, ...rest }) {
        if (vendor_id && amount != null) {
            return watavSettlementService.createVendorReceipt({
                vendor_id,
                amount,
                receipt_date: collection_date,
                ...rest,
            });
        }

        if (!Array.isArray(ids) || ids.length === 0) {
            throw new Error('Watav vendor and amount are required');
        }

        const payments = await prisma.paymentIn.findMany({
            where: {
                id: { in: ids },
                payment_category: PAYMENT_CATEGORY.VATAV,
            },
            include: { watav_allocations: true },
        });

        if (payments.length === 0) {
            throw new Error('No Watav payments found for collection');
        }

        const vendorIds = [...new Set(payments.map((p) => p.receive_id).filter(Boolean))];
        if (vendorIds.length !== 1) {
            throw new Error('All entries must belong to the same Watav vendor');
        }

        const remainingTotal = payments
            .map(decoratePayment)
            .reduce((sum, p) => addAmounts(sum, p.remainingAmount), 0);

        if (remainingTotal <= 0) {
            throw new Error('Selected Watav entries have no remaining amount');
        }

        return watavSettlementService.createVendorReceipt({
            vendor_id: vendorIds[0],
            amount: remainingTotal,
            receipt_date: collection_date,
            type: rest.type || 'other',
            description: rest.description || 'Watav vendor collection',
            reference: rest.reference || null,
        });
    }

    /**
     * Undo legacy fully-settled rows that have no allocation history.
     * Allocated receipts must be deleted instead.
     */
    async uncollectWatavEntries({ ids }) {
        if (!Array.isArray(ids) || ids.length === 0) {
            throw new Error('At least one payment id is required');
        }

        const payments = await prisma.paymentIn.findMany({
            where: { id: { in: ids }, payment_category: PAYMENT_CATEGORY.VATAV },
            include: { watav_allocations: true },
        });

        const allocated = payments.filter((p) => (p.watav_allocations || []).length > 0);
        if (allocated.length > 0) {
            throw new Error(
                'Cannot uncollect Watav payments that have vendor receipts. Delete the receipt instead.'
            );
        }

        const result = await prisma.paymentIn.updateMany({
            where: {
                id: { in: ids },
                payment_category: PAYMENT_CATEGORY.VATAV,
            },
            data: {
                collection_status: SETTLEMENT_STATUS.PENDING,
                collection_date: null,
            },
        });

        return {
            updated: result.count,
            collection_status: SETTLEMENT_STATUS.PENDING,
        };
    }

    /**
     * Dedicated Watav report: receivable / settled / pending / unallocated.
     * Customer-linked Watav payments are already paid on the customer ledger.
     */
    async getWatavReport({ startDate, endDate, watavCustomerId, collectionStatus, entryType }) {
        try {
            const dateFilter = {};
            if (startDate) {
                dateFilter.gte = new Date(startDate + 'T00:00:00.000Z');
            }
            if (endDate) {
                dateFilter.lte = new Date(endDate + 'T23:59:59.999Z');
            }

            const where = {
                payment_category: PAYMENT_CATEGORY.VATAV,
                ...(Object.keys(dateFilter).length > 0 ? { payment_date: dateFilter } : {}),
                ...(watavCustomerId ? { receive_id: watavCustomerId } : { receive_id: { not: null } }),
                ...outstandingWhereFilter(collectionStatus),
                ...(entryType ? { entry_type: entryType.toUpperCase() } : {}),
            };

            const [payments, receipts] = await Promise.all([
                prisma.paymentIn.findMany({
                    where,
                    include: PAYMENT_INCLUDE,
                    orderBy: [
                        { payment_date: 'asc' },
                        { created_at: 'asc' },
                    ],
                }),
                watavSettlementService.getReceipts({
                    vendorId: watavCustomerId || undefined,
                    startDate,
                    endDate,
                }),
            ]);

            const transactions = payments.map((payment, index) => mapWatavReportRow(payment, index));
            const vendorSummary = summarizeVendor(payments, receipts, watavCustomerId || null);

            const emptyVendor = (id, name) => ({
                watavCustomerId: id,
                watavCustomerName: name,
                entries: 0,
                customerLinkedEntries: 0,
                standaloneEntries: 0,
                totalReceived: 0,
                totalPaidToWatav: 0,
                totalActualAmount: 0,
                totalReceivable: 0,
                totalSettled: 0,
                currentPending: 0,
                partiallySettledCount: 0,
                unallocatedAmount: 0,
                pendingGross: 0,
                pendingNet: 0,
                pendingCharges: 0,
                pendingEntries: 0,
                collectedGross: 0,
                collectedNet: 0,
                collectedCharges: 0,
                collectedEntries: 0,
                customerLinkedGross: 0,
                standaloneGross: 0,
            });

            const byWatav = {};
            for (const row of transactions) {
                if (!byWatav[row.watavCustomerId]) {
                    byWatav[row.watavCustomerId] = emptyVendor(
                        row.watavCustomerId,
                        row.watavCustomerName
                    );
                }
                const bucket = byWatav[row.watavCustomerId];
                bucket.entries += 1;
                bucket.totalReceived = addAmounts(bucket.totalReceived, row.receivedAmount);
                bucket.totalPaidToWatav = addAmounts(bucket.totalPaidToWatav, row.paidToWatav);
                bucket.totalActualAmount = addAmounts(bucket.totalActualAmount, row.actualAmount);
                bucket.totalReceivable = addAmounts(bucket.totalReceivable, row.originalAmount);
                bucket.totalSettled = addAmounts(bucket.totalSettled, row.totalSettledAmount);
                bucket.currentPending = addAmounts(bucket.currentPending, row.remainingAmount);

                if (row.entryType === ENTRY_TYPE.STANDALONE) {
                    bucket.standaloneEntries += 1;
                    bucket.standaloneGross = addAmounts(bucket.standaloneGross, row.receivedAmount);
                } else {
                    bucket.customerLinkedEntries += 1;
                    bucket.customerLinkedGross = addAmounts(
                        bucket.customerLinkedGross,
                        row.receivedAmount
                    );
                }

                if (row.collectionStatus === SETTLEMENT_STATUS.COMPLETED) {
                    bucket.collectedEntries += 1;
                    bucket.collectedGross = addAmounts(bucket.collectedGross, row.receivedAmount);
                    bucket.collectedNet = addAmounts(bucket.collectedNet, row.netAmount);
                    bucket.collectedCharges = addAmounts(bucket.collectedCharges, row.vendorCharges);
                } else {
                    bucket.pendingEntries += 1;
                    bucket.pendingGross = addAmounts(bucket.pendingGross, row.remainingAmount);
                    bucket.pendingNet = addAmounts(bucket.pendingNet, row.remainingAmount);
                    bucket.pendingCharges = addAmounts(bucket.pendingCharges, row.vendorCharges);
                    if (row.collectionStatus === SETTLEMENT_STATUS.PARTIALLY_SETTLED) {
                        bucket.partiallySettledCount += 1;
                    }
                }
            }

            for (const receipt of receipts) {
                if (!byWatav[receipt.vendor_id]) {
                    byWatav[receipt.vendor_id] = emptyVendor(
                        receipt.vendor_id,
                        receipt.vendor?.name || 'Unknown'
                    );
                }
                byWatav[receipt.vendor_id].unallocatedAmount = addAmounts(
                    byWatav[receipt.vendor_id].unallocatedAmount,
                    receipt.unallocated_amount || 0
                );
            }

            const sum = (fn) => transactions.reduce((s, row) => addAmounts(s, fn(row)), 0);
            const pending = transactions.filter(
                (r) => r.collectionStatus !== SETTLEMENT_STATUS.COMPLETED
            );
            const collected = transactions.filter(
                (r) => r.collectionStatus === SETTLEMENT_STATUS.COMPLETED
            );
            const partial = transactions.filter(
                (r) => r.collectionStatus === SETTLEMENT_STATUS.PARTIALLY_SETTLED
            );
            const customerLinked = transactions.filter(
                (r) => r.entryType === ENTRY_TYPE.CUSTOMER_PAYMENT
            );
            const standalone = transactions.filter(
                (r) => r.entryType === ENTRY_TYPE.STANDALONE
            );

            const summary = {
                totalEntries: transactions.length,
                totalReceived: sum((r) => r.receivedAmount),
                totalPaidToWatav: sum((r) => r.paidToWatav),
                totalActualAmount: sum((r) => r.actualAmount),
                totalVendorCharges: sum((r) => r.vendorCharges),
                totalNetAmount: sum((r) => r.netAmount),
                totalReceivable: vendorSummary.totalReceivable,
                totalSettled: vendorSummary.totalSettled,
                currentPending: vendorSummary.currentPending,
                unallocatedAmount: vendorSummary.unallocatedAmount,
                vendorReceiptsTotal: vendorSummary.totalReceived,
                partiallySettledCount: vendorSummary.partiallySettledCount,
                pending: {
                    entries: pending.length,
                    gross: pending.reduce((s, r) => addAmounts(s, r.remainingAmount), 0),
                    net: pending.reduce((s, r) => addAmounts(s, r.remainingAmount), 0),
                    remaining: pending.reduce((s, r) => addAmounts(s, r.remainingAmount), 0),
                    charges: pending.reduce((s, r) => addAmounts(s, r.vendorCharges), 0),
                    customerLinkedGross: pending
                        .filter((r) => r.entryType === ENTRY_TYPE.CUSTOMER_PAYMENT)
                        .reduce((s, r) => addAmounts(s, r.remainingAmount), 0),
                    standaloneGross: pending
                        .filter((r) => r.entryType === ENTRY_TYPE.STANDALONE)
                        .reduce((s, r) => addAmounts(s, r.remainingAmount), 0),
                },
                collected: {
                    entries: collected.length,
                    gross: collected.reduce((s, r) => addAmounts(s, r.receivedAmount), 0),
                    net: collected.reduce((s, r) => addAmounts(s, r.netAmount), 0),
                    charges: collected.reduce((s, r) => addAmounts(s, r.vendorCharges), 0),
                    customerLinkedGross: collected
                        .filter((r) => r.entryType === ENTRY_TYPE.CUSTOMER_PAYMENT)
                        .reduce((s, r) => addAmounts(s, r.receivedAmount), 0),
                    standaloneGross: collected
                        .filter((r) => r.entryType === ENTRY_TYPE.STANDALONE)
                        .reduce((s, r) => addAmounts(s, r.receivedAmount), 0),
                },
                customerLinked: {
                    entries: customerLinked.length,
                    gross: customerLinked.reduce((s, r) => addAmounts(s, r.receivedAmount), 0),
                    net: customerLinked.reduce((s, r) => addAmounts(s, r.netAmount), 0),
                    charges: customerLinked.reduce((s, r) => addAmounts(s, r.vendorCharges), 0),
                },
                standalone: {
                    entries: standalone.length,
                    gross: standalone.reduce((s, r) => addAmounts(s, r.receivedAmount), 0),
                    net: standalone.reduce((s, r) => addAmounts(s, r.netAmount), 0),
                    charges: standalone.reduce((s, r) => addAmounts(s, r.vendorCharges), 0),
                },
                partial: {
                    entries: partial.length,
                    remaining: partial.reduce((s, r) => addAmounts(s, r.remainingAmount), 0),
                    settled: partial.reduce((s, r) => addAmounts(s, r.totalSettledAmount), 0),
                },
            };

            return {
                transactions,
                receipts,
                byWatav: Object.values(byWatav).sort(
                    (a, b) => b.currentPending - a.currentPending || b.totalReceivable - a.totalReceivable
                ),
                summary,
            };
        } catch (error) {
            throw new Error(`Failed to fetch watav report: ${error.message}`);
        }
    }
}

module.exports = new PaymentInService();
module.exports.customerCreditAmount = customerCreditAmount;
module.exports.PAYMENT_CATEGORY = PAYMENT_CATEGORY;
module.exports.ENTRY_TYPE = ENTRY_TYPE;
module.exports.COLLECTION_STATUS = COLLECTION_STATUS;
module.exports.SETTLEMENT_STATUS = SETTLEMENT_STATUS;
module.exports.normalizePaymentPayload = normalizePaymentPayload;
