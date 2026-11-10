import { useState, useEffect, useMemo } from "react";
import ReportLayout from "@/components/reports/ReportLayout";
import { customersAPI } from "@/services/api";
import { getRegularCustomers } from "@/lib/partyTypes";
import { useToast } from "@/components/ui/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { Loader2, Download, FileText, FileSpreadsheet } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { downloadReportPdf, formatPdfAmount, formatPdfDate, formatPdfPeriod } from "@/lib/reportPdf";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTableControls } from "@/hooks/useTableControls";
import { TableToolbar } from "@/components/ui/table-toolbar";

const formatAmount = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

const amountHeadClass = "text-white text-right";
const amountCellClass = "text-right tabular-nums";

/** Payments have no sale voucher; never show internal payment IDs in the report. */
const formatTransactionVoucherNo = (item: {
  voucherNo?: string;
  paymentCategory?: string | null;
}) => {
  if (item.paymentCategory) return "—";
  const voucher = item.voucherNo?.trim();
  if (!voucher || voucher === "-") return "—";
  if (/^c[a-z0-9]{8,}$/i.test(voucher)) return "—";
  return voucher;
};

/** jsPDF Helvetica cannot render ₹; normalize for consistent UI/PDF typography. */
const formatTransactionParticulars = (particulars?: string) => {
  if (!particulars) return "—";
  return particulars.replace(/\u20B9/g, "Rs. ");
};

const CustomerReport = () => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [customerType, setCustomerType] = useState<string>("all");
  const [transactions, setTransactions] = useState<{ data: any[]; summary?: any }>({ data: [] });
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [customerOpen, setCustomerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchCustomers();
    // Pre-load data for all customers
    fetchTransactions([]);
  }, []);

  useEffect(() => {
    if (selectedCustomer) {
      fetchTransactions([selectedCustomer]);
    }
  }, [selectedCustomer, startDate, endDate, customerType]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const data = await customersAPI.getAll();
      setCustomers(getRegularCustomers(data || []));
    } catch (error) {
      console.error("Error fetching customers:", error);
      toast({
        title: "Error",
        description: "Failed to fetch customer data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async (customerIds: string[]) => {
    try {
      setLoading(true);
      const data = await customersAPI.getSalesAndPayments({
        customerIds,
        startDate,
        endDate,
        customerType: customerType === "all" ? undefined : customerType
      });
      setTransactions({
        data: data.data || [],
        summary: data.summary,
      });
    } catch (error) {
      console.error("Error fetching transactions:", error);
      toast({
        title: "Error",
        description: "Failed to fetch transaction data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getClosingBalance = () => {
    if (transactions.summary?.closingBalance !== undefined) {
      return transactions.summary.closingBalance;
    }
    return transactions.data.reduce(
      (sum, item) =>
        sum +
        item.debit -
        item.credit -
        (item.discount || 0) -
        (item.salesReturn || 0),
      0
    );
  };

  const getOpeningBalance = () => transactions.summary?.openingBalance ?? 0;

  const getTotalDebit = () =>
    transactions.summary?.totalDebit ??
    transactions.data.reduce((sum, item) => sum + item.debit, 0);

  const getTotalCredit = () =>
    transactions.summary?.totalCredit ??
    transactions.data.reduce((sum, item) => sum + item.credit, 0);

  const getTotalDiscount = () =>
    transactions.summary?.totalDiscount ??
    transactions.data.reduce((sum, item) => sum + (item.discount || 0), 0);

  const getTotalSalesReturn = () =>
    transactions.summary?.totalSalesReturn ??
    transactions.data.reduce((sum, item) => sum + (item.salesReturn || 0), 0);

  const exportToCSV = () => {
    const headers = ["Sr. No.", "Date", "Particulars", "Voucher No.", "Debit", "Credit", "Discount", "Sales Return", "Balance"];
    const csvContent = [
      headers.join(","),
      ...transactions.data.map((item) => {
        return [
          item.srno,
          format(new Date(item.date), "yyyy-MM-dd"),
          `"${formatTransactionParticulars(item.particulars)}"`,
          `"${formatTransactionVoucherNo(item)}"`,
          formatAmount(item.debit),
          formatAmount(item.credit),
          formatAmount(item.discount || 0),
          formatAmount(item.salesReturn || 0),
          formatAmount(item.balance ?? 0),
        ].join(",");
      }),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `customer_transactions_${format(new Date(), "yyyy-MM-dd")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = () => {
    const customerName = customers.find(c => c.id === selectedCustomer)?.name || "All Customers";
    const totalDebit = getTotalDebit();
    const totalCredit = getTotalCredit();
    const totalDiscount = getTotalDiscount();
    const totalSalesReturn = getTotalSalesReturn();
    const openingBalance = getOpeningBalance();
    const balance = getClosingBalance();

    const summary: { label: string; value: string; emphasize?: boolean }[] = [
      { label: "Opening Balance", value: formatPdfAmount(openingBalance) },
      { label: "Total Debit", value: formatPdfAmount(totalDebit) },
      { label: "Total Credit", value: formatPdfAmount(totalCredit) },
      { label: "Total Discount", value: formatPdfAmount(totalDiscount) },
      { label: "Total Sales Return", value: formatPdfAmount(totalSalesReturn) },
      { label: "Closing Balance", value: formatPdfAmount(balance), emphasize: true },
    ];

    if (transactions.summary?.normalPayments != null || transactions.summary?.vatavPayments != null) {
      summary.splice(5, 0,
        { label: "Normal Payments", value: formatPdfAmount(transactions.summary?.normalPayments || 0) },
        { label: "Watav Payments", value: formatPdfAmount(transactions.summary?.vatavPayments || 0) },
      );
    }

    downloadReportPdf({
      title: "Customer Transactions Report",
      filename: `${customerName.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_transactions_${format(new Date(startDate), "yyyyMMdd")}_to_${format(new Date(endDate), "yyyyMMdd")}.pdf`,
      orientation: "landscape",
      meta: [
        { label: "Customer", value: customerName },
        { label: "Period", value: formatPdfPeriod(startDate, endDate) },
        { label: "Entries", value: String(transactions.data.length) },
      ],
      summary,
      columns: [
        { header: "Sr.", width: 12, align: "center" },
        { header: "Date", width: 24, align: "center" },
        { header: "Particulars", align: "left" },
        { header: "Voucher No.", width: 36, overflow: "ellipsize" },
        { header: "Debit", width: 28, align: "right" },
        { header: "Credit", width: 28, align: "right" },
        { header: "Discount", width: 28, align: "right" },
        { header: "Sales Return", width: 30, align: "right" },
        { header: "Balance", width: 30, align: "right" },
      ],
      rows: transactions.data.map((item) => [
        item.srno,
        formatPdfDate(item.date),
        formatTransactionParticulars(item.particulars),
        formatTransactionVoucherNo(item),
        formatPdfAmount(item.debit, { blankZero: true, prefix: false }),
        formatPdfAmount(item.credit, { blankZero: true, prefix: false }),
        formatPdfAmount(item.discount || 0, { blankZero: true, prefix: false }),
        formatPdfAmount(item.salesReturn || 0, { blankZero: true, prefix: false }),
        formatPdfAmount(item.balance ?? 0, { prefix: false }),
      ]),
      foot: [
        "",
        "",
        "",
        "Total",
        formatPdfAmount(totalDebit, { prefix: false }),
        formatPdfAmount(totalCredit, { prefix: false }),
        formatPdfAmount(totalDiscount, { prefix: false }),
        formatPdfAmount(totalSalesReturn, { prefix: false }),
        formatPdfAmount(balance, { prefix: false }),
      ],
    });
  };

  const filteredCustomers = customers.filter(customer => 
    customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.city?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedCustomerName = customers.find(c => c.id === selectedCustomer)?.name || "Select customer...";

  // Search only — keep chronological order for running balance
  const searchFns = useMemo(
    () => [
      (item: any) => item.particulars,
      (item: any) => item.voucherNo,
    ],
    []
  );

  const {
    searchTerm,
    setSearchTerm,
    clearFilters,
    hasActiveFilters,
    rows,
  } = useTableControls({
    data: transactions.data,
    searchFns,
    getSortValue: () => null,
    defaultSort: { key: null, direction: "asc" },
  });

  return (
    <ReportLayout
      title="Customer Transactions Report"
      description="View and export customer transaction information"
    >
      <div className="flex flex-col space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div className="flex flex-wrap gap-4">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-[180px]"
            />
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-[180px]"
            />
          {/* </div>

          <div className="flex items-center gap-4"> */}
            <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={customerOpen}
                  className="w-[240px] justify-between"
                >
                  {selectedCustomerName}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[240px] p-0">
                <Command>
                  <CommandInput 
                    placeholder="Search customers..." 
                    value={searchQuery}
                    onValueChange={setSearchQuery}
                  />
                  <CommandEmpty>No customers found.</CommandEmpty>
                  <CommandGroup>
                    {filteredCustomers.map((customer) => (
                      <CommandItem
                        key={customer.id}
                        onSelect={() => {
                          setSelectedCustomer(customer.id);
                          setCustomerOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedCustomer === customer.id
                              ? "opacity-100"
                              : "opacity-0"
                          )}
                        />
                        {customer.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportToPDF}>
                  <FileText className="mr-2 h-4 w-4" />
                  Export as PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportToCSV}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Export as CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {transactions.data.length > 0 && (
          <TableToolbar
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder="Search voucher or particulars..."
            onFilterChange={() => {}}
            onClear={clearFilters}
            hasActiveFilters={hasActiveFilters}
          />
        )}

        {loading ? (
          <div className="flex justify-center items-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {transactions.data.length > 0 && (
              <div className="sticky top-0 z-10 bg-background pb-4">
                <div className="bg-sidebar/5 rounded-lg p-4 shadow-sm">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-muted-foreground">Opening Balance</span>
                    <span className="font-medium">
                      {formatAmount(getOpeningBalance())}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-muted-foreground">Total Debit</span>
                    <span className="font-medium">
                      {formatAmount(getTotalDebit())}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-muted-foreground">Total Credit</span>
                    <span className="font-medium">
                      {formatAmount(getTotalCredit())}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-muted-foreground">Total Discount</span>
                    <span className="font-medium">
                      {formatAmount(getTotalDiscount())}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-muted-foreground">Total Sales Return</span>
                    <span className="font-medium">
                      {formatAmount(getTotalSalesReturn())}
                    </span>
                  </div>
                  {(transactions.summary?.normalPayments != null ||
                    transactions.summary?.vatavPayments != null) && (
                    <>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-muted-foreground">Normal Payments</span>
                        <span className="font-medium">
                          {formatAmount(transactions.summary?.normalPayments || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-muted-foreground">Watav Payments</span>
                        <span className="font-medium">
                          {formatAmount(transactions.summary?.vatavPayments || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-muted-foreground">Total Payments</span>
                        <span className="font-medium">
                          {formatAmount(transactions.summary?.totalPayments || 0)}
                        </span>
                      </div>
                    </>
                  )}
                  <div className="border-t border-sidebar/20 my-2" />
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Closing Balance</span>
                    <span className={cn(
                      "font-bold text-lg",
                      getClosingBalance() >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    )}>
                      {formatAmount(getClosingBalance())}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader className="bg-sidebar">
                  <TableRow>
                    <TableHead className="text-white rounded-tl-lg">Sr. No.</TableHead>
                    <TableHead className="text-white">Date</TableHead>
                    <TableHead className="text-white">Particulars</TableHead>
                    <TableHead className="text-white">Voucher No.</TableHead>
                    <TableHead className={amountHeadClass}>Debit</TableHead>
                    <TableHead className={amountHeadClass}>Credit</TableHead>
                    <TableHead className={amountHeadClass}>Discount</TableHead>
                    <TableHead className={amountHeadClass}>Sales Return</TableHead>
                    <TableHead className={cn(amountHeadClass, "rounded-tr-lg")}>Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length > 0 ? (
                    <>
                      {rows.map((item) => (
                        <TableRow
                          key={item.srno}
                          className={cn(
                            "hover:bg-sidebar/10",
                            (item.isOpeningBalance || item.isBroughtForward) && "bg-amber-50/50 font-medium"
                          )}
                        >
                          <TableCell>{item.srno}</TableCell>
                          <TableCell>{format(new Date(item.date), "yyyy-MM-dd")}</TableCell>
                          <TableCell>{formatTransactionParticulars(item.particulars)}</TableCell>
                          <TableCell>{formatTransactionVoucherNo(item)}</TableCell>
                          <TableCell className={amountCellClass}>{formatAmount(item.debit)}</TableCell>
                          <TableCell className={amountCellClass}>{formatAmount(item.credit)}</TableCell>
                          <TableCell className={amountCellClass}>{formatAmount(item.discount || 0)}</TableCell>
                          <TableCell className={amountCellClass}>{formatAmount(item.salesReturn || 0)}</TableCell>
                          <TableCell className={amountCellClass}>{formatAmount(item.balance ?? 0)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="border-t-2 border-sidebar/20">
                        <TableCell colSpan={4} className="text-right font-medium">Total</TableCell>
                        <TableCell className={cn(amountCellClass, "font-medium")}>
                          {formatAmount(getTotalDebit())}
                        </TableCell>
                        <TableCell className={cn(amountCellClass, "font-medium")}>
                          {formatAmount(getTotalCredit())}
                        </TableCell>
                        <TableCell className={cn(amountCellClass, "font-medium")}>
                          {formatAmount(getTotalDiscount())}
                        </TableCell>
                        <TableCell className={cn(amountCellClass, "font-medium")}>
                          {formatAmount(getTotalSalesReturn())}
                        </TableCell>
                        <TableCell className={cn(amountCellClass, "font-medium")}>
                          {formatAmount(getClosingBalance())}
                        </TableCell>
                      </TableRow>
                    </>
                  ) : (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8">
                        No data found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    </ReportLayout>
  );
};

export default CustomerReport;
