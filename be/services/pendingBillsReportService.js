const prisma = require('../prisma/client');
const {
    allocateSaleOutstanding,
    attachSaleOutstanding,
} = require('../utils/saleOutstanding');
const {
    allocatePurchaseOutstanding,
    attachPurchaseOutstanding,
} = require('../utils/purchaseOutstanding');

function round2(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
}

function parsePartyIds(partyIds) {
    if (!partyIds) return [];
    if (Array.isArray(partyIds)) {
        return partyIds.map(String).filter(Boolean);
    }
    return String(partyIds)
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
}

const customerPaymentFilter = {
    NOT: {
        payment_category: 'VATAV',
        entry_type: 'STANDALONE',
    },
};

function sortByDateAsc(a, b) {
    const aTime = new Date(a.date || 0).getTime();
    const bTime = new Date(b.date || 0).getTime();
    return aTime - bTime;
}

function buildSummary(groups) {
    return groups.reduce(
        (acc, group) => {
            acc.party_count += 1;
            acc.bill_count += group.bill_count;
            acc.total_bill_amount = round2(acc.total_bill_amount + group.total_bill_amount);
            acc.total_paid = round2(acc.total_paid + group.total_paid);
            acc.total_outstanding = round2(
                acc.total_outstanding + group.total_outstanding
            );
            return acc;
        },
        {
            party_count: 0,
            bill_count: 0,
            total_bill_amount: 0,
            total_paid: 0,
            total_outstanding: 0,
        }
    );
}

class PendingBillsReportService {
    async getCustomerPendingBills({ partyIds } = {}) {
        const selectedPartyIds = parsePartyIds(partyIds);
        const customerWhere =
            selectedPartyIds.length > 0 ? { id: { in: selectedPartyIds } } : {};
        const saleWhere =
            selectedPartyIds.length > 0
                ? { customer_id: { in: selectedPartyIds } }
                : {};
        const paymentWhere =
            selectedPartyIds.length > 0
                ? {
                      AND: [
                          customerPaymentFilter,
                          { actual_id: { in: selectedPartyIds } },
                      ],
                  }
                : customerPaymentFilter;
        const returnWhere =
            selectedPartyIds.length > 0
                ? { customer_id: { in: selectedPartyIds } }
                : {};

        const [sales, payments, saleReturns, customers] = await Promise.all([
            prisma.sale.findMany({
                where: saleWhere,
                orderBy: [{ date: 'asc' }, { created_at: 'asc' }],
            }),
            prisma.paymentIn.findMany({
                where: paymentWhere,
                orderBy: [{ payment_date: 'asc' }, { created_at: 'asc' }],
            }),
            prisma.saleReturn.findMany({ where: returnWhere }),
            prisma.customer.findMany({ where: customerWhere }),
        ]);

        const regularCustomers = customers.filter(
            (customer) => (customer.type || '').toLowerCase() !== 'watav'
        );

        const remainingById = allocateSaleOutstanding({
            sales,
            payments,
            saleReturns,
            customers: regularCustomers,
        });

        const customerById = new Map(
            regularCustomers.map((customer) => [customer.id, customer])
        );
        const groupsMap = new Map();

        for (const sale of sales) {
            const allocation = remainingById.get(sale.id);
            if (!allocation || allocation.remaining_amount <= 0) continue;
            if (allocation.payment_status === 'FULL') continue;

            const customer = customerById.get(sale.customer_id);
            if (!customer) continue;

            const enriched = attachSaleOutstanding(sale, allocation);
            if (!groupsMap.has(customer.id)) {
                groupsMap.set(customer.id, {
                    party_id: customer.id,
                    party_name: customer.name,
                    party_phone: customer.phone || null,
                    party_city: customer.city || null,
                    bill_count: 0,
                    total_bill_amount: 0,
                    total_paid: 0,
                    total_outstanding: 0,
                    bills: [],
                });
            }

            const group = groupsMap.get(customer.id);
            const billTotal = round2(sale.total);
            const paid = round2(enriched.cleared_amount);
            const outstanding = round2(enriched.remaining_amount);

            group.bill_count += 1;
            group.total_bill_amount = round2(group.total_bill_amount + billTotal);
            group.total_paid = round2(group.total_paid + paid);
            group.total_outstanding = round2(group.total_outstanding + outstanding);
            group.bills.push({
                id: sale.id,
                bill_no: sale.sales_no,
                date: sale.date,
                credit_days: sale.credit_days || 0,
                due_date: enriched.due_date,
                elapsed_days: enriched.elapsed_days,
                overdue_days: enriched.overdue_days,
                bill_total: billTotal,
                paid_amount: paid,
                outstanding_amount: outstanding,
                payment_status: enriched.payment_status,
                applications: (allocation.applications || []).slice().sort(sortByDateAsc),
            });
        }

        const groups = [...groupsMap.values()]
            .map((group) => ({
                ...group,
                bills: group.bills.sort(sortByDateAsc),
            }))
            .sort((a, b) => a.party_name.localeCompare(b.party_name));

        return { summary: buildSummary(groups), groups };
    }

    async getSupplierPendingBills({ partyIds } = {}) {
        const selectedPartyIds = parsePartyIds(partyIds);
        const supplierWhere =
            selectedPartyIds.length > 0 ? { id: { in: selectedPartyIds } } : {};
        const purchaseWhere =
            selectedPartyIds.length > 0
                ? { supplier_id: { in: selectedPartyIds } }
                : {};
        const paymentWhere =
            selectedPartyIds.length > 0
                ? { supplier_id: { in: selectedPartyIds } }
                : {};
        const returnWhere =
            selectedPartyIds.length > 0
                ? { supplier_id: { in: selectedPartyIds } }
                : {};

        const [purchases, payments, purchaseReturns, suppliers] = await Promise.all([
            prisma.purchase.findMany({
                where: purchaseWhere,
                orderBy: [{ date: 'asc' }, { created_at: 'asc' }],
            }),
            prisma.paymentOut.findMany({
                where: paymentWhere,
                orderBy: [{ payment_date: 'asc' }, { created_at: 'asc' }],
            }),
            prisma.purchaseReturn.findMany({ where: returnWhere }),
            prisma.supplier.findMany({ where: supplierWhere }),
        ]);

        const remainingById = allocatePurchaseOutstanding({
            purchases,
            payments,
            purchaseReturns,
            suppliers,
        });

        const supplierById = new Map(suppliers.map((supplier) => [supplier.id, supplier]));
        const groupsMap = new Map();

        for (const purchase of purchases) {
            const allocation = remainingById.get(purchase.id);
            if (!allocation || allocation.remaining_amount <= 0) continue;
            if (allocation.payment_status === 'FULL') continue;

            const supplier = supplierById.get(purchase.supplier_id);
            if (!supplier) continue;

            const enriched = attachPurchaseOutstanding(purchase, allocation);
            if (!groupsMap.has(supplier.id)) {
                groupsMap.set(supplier.id, {
                    party_id: supplier.id,
                    party_name: supplier.name,
                    party_phone: supplier.phone || null,
                    party_city: supplier.city || null,
                    bill_count: 0,
                    total_bill_amount: 0,
                    total_paid: 0,
                    total_outstanding: 0,
                    bills: [],
                });
            }

            const group = groupsMap.get(supplier.id);
            const billTotal = round2(purchase.total);
            const paid = round2(enriched.cleared_amount);
            const outstanding = round2(enriched.remaining_amount);

            group.bill_count += 1;
            group.total_bill_amount = round2(group.total_bill_amount + billTotal);
            group.total_paid = round2(group.total_paid + paid);
            group.total_outstanding = round2(group.total_outstanding + outstanding);
            group.bills.push({
                id: purchase.id,
                bill_no: purchase.purchase_no,
                date: purchase.date,
                credit_days: purchase.credit_days || 0,
                due_date: enriched.due_date,
                elapsed_days: enriched.elapsed_days,
                overdue_days: enriched.overdue_days,
                bill_total: billTotal,
                paid_amount: paid,
                outstanding_amount: outstanding,
                payment_status: enriched.payment_status,
                applications: (allocation.applications || []).slice().sort(sortByDateAsc),
            });
        }

        const groups = [...groupsMap.values()]
            .map((group) => ({
                ...group,
                bills: group.bills.sort(sortByDateAsc),
            }))
            .sort((a, b) => a.party_name.localeCompare(b.party_name));

        return { summary: buildSummary(groups), groups };
    }
}

module.exports = new PendingBillsReportService();
