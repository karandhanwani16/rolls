import { useState, useEffect, useMemo } from "react";
import ReportLayout from "@/components/reports/ReportLayout";
import { suppliersAPI } from "@/services/api";
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

const SupplierReport = () => {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [selectedSupplier, setSelectedSupplier] = useState<string>("");
  const [transactions, setTransactions] = useState<{ data: any[]; summary?: any }>({ data: [] });
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchSuppliers();
    // Pre-load data for all suppliers
    fetchTransactions([]);
  }, []);

  useEffect(() => {
    if (selectedSupplier) {
      fetchTransactions([selectedSupplier]);
    }
  }, [selectedSupplier, startDate, endDate]);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const data = await suppliersAPI.getAll();
      setSuppliers(data);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      toast({
        title: "Error",
        description: "Failed to fetch supplier data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async (supplierIds: string[]) => {
    try {
      setLoading(true);
      const data = await suppliersAPI.getPurchasesAndPayments({
        supplierIds,
        startDate,
        endDate
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
        (item.discount || 0) +
        (item.purchaseReturn || 0),
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

  const getTotalPurchaseReturn = () =>
    transactions.summary?.totalPurchaseReturn ??
    transactions.data.reduce((sum, item) => sum + (item.purchaseReturn || 0), 0);

  const exportToCSV = () => {
    const headers = ["Sr. No.", "Date", "Particulars", "Voucher No.", "Debit", "Credit", "Discount", "Purchase Return", "Balance"];
    const csvContent = [
      headers.join(","),
      ...transactions.data.map((item) => {
        return [
          item.srno,
          format(new Date(item.date), "yyyy-MM-dd"),
          `"${item.particulars}"`,
          `"${item.voucherNo}"`,
          formatAmount(item.debit),
          formatAmount(item.credit),
          formatAmount(item.discount || 0),
          formatAmount(item.purchaseReturn || 0),
          formatAmount(item.balance ?? 0),
        ].join(",");
      }),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `supplier_transactions_${format(new Date(), "yyyy-MM-dd")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = () => {
    const supplierName = suppliers.find(s => s.id === selectedSupplier)?.name || "All Suppliers";
    const totalDebit = getTotalDebit();
    const totalCredit = getTotalCredit();
    const totalDiscount = getTotalDiscount();
    const totalPurchaseReturn = getTotalPurchaseReturn();
    const openingBalance = getOpeningBalance();
    const balance = getClosingBalance();

    downloadReportPdf({
      title: "Supplier Transactions Report",
      filename: `${supplierName.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_transactions_${format(new Date(startDate), "yyyyMMdd")}_to_${format(new Date(endDate), "yyyyMMdd")}.pdf`,
      orientation: "landscape",
      meta: [
        { label: "Supplier", value: supplierName },
        { label: "Period", value: formatPdfPeriod(startDate, endDate) },
        { label: "Entries", value: String(transactions.data.length) },
      ],
      summary: [
        { label: "Opening Balance", value: formatPdfAmount(openingBalance) },
        { label: "Total Debit", value: formatPdfAmount(totalDebit) },
        { label: "Total Credit", value: formatPdfAmount(totalCredit) },
        { label: "Total Discount", value: formatPdfAmount(totalDiscount) },
        { label: "Total Purchase Return", value: formatPdfAmount(totalPurchaseReturn) },
        { label: "Closing Balance", value: formatPdfAmount(balance), emphasize: true },
      ],
      columns: [
        { header: "Sr.", width: 12, align: "center" },
        { header: "Date", width: 24, align: "center" },
        { header: "Particulars", align: "left" },
        { header: "Voucher No.", width: 36, overflow: "ellipsize" },
        { header: "Debit", width: 28, align: "right" },
        { header: "Credit", width: 28, align: "right" },
        { header: "Discount", width: 28, align: "right" },
        { header: "Purchase Return", width: 32, align: "right" },
        { header: "Balance", width: 30, align: "right" },
      ],
      rows: transactions.data.map((item) => [
        item.srno,
        formatPdfDate(item.date),
        item.particulars || "—",
        item.voucherNo || "—",
        formatPdfAmount(item.debit, { blankZero: true, prefix: false }),
        formatPdfAmount(item.credit, { blankZero: true, prefix: false }),
        formatPdfAmount(item.discount || 0, { blankZero: true, prefix: false }),
        formatPdfAmount(item.purchaseReturn || 0, { blankZero: true, prefix: false }),
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
        formatPdfAmount(totalPurchaseReturn, { prefix: false }),
        formatPdfAmount(balance, { prefix: false }),
      ],
    });
  };

  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    supplier.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    supplier.city?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedSupplierName = suppliers.find(s => s.id === selectedSupplier)?.name || "Select supplier...";

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
      title="Supplier Transactions Report"
      description="View and export supplier transaction information"
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
            <Popover open={supplierOpen} onOpenChange={setSupplierOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={supplierOpen}
                  className="w-[240px] justify-between"
                >
                  {selectedSupplierName}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[240px] p-0">
                <Command>
                  <CommandInput
                    placeholder="Search suppliers..."
                    value={searchQuery}
                    onValueChange={setSearchQuery}
                  />
                  <CommandEmpty>No suppliers found.</CommandEmpty>
                  <CommandGroup>
                    {filteredSuppliers.map((supplier) => (
                      <CommandItem
                        key={supplier.id}
                        onSelect={() => {
                          setSelectedSupplier(supplier.id);
                          setSupplierOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedSupplier === supplier.id
                              ? "opacity-100"
                              : "opacity-0"
                          )}
                        />
                        {supplier.name}
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
                    <span className="text-sm text-muted-foreground">Total Purchase Return</span>
                    <span className="font-medium">
                      {formatAmount(getTotalPurchaseReturn())}
                    </span>
                  </div>
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
                    <TableHead className={amountHeadClass}>Purchase Return</TableHead>
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
                          <TableCell>{item.particulars}</TableCell>
                          <TableCell>{item.voucherNo}</TableCell>
                          <TableCell className={amountCellClass}>{formatAmount(item.debit)}</TableCell>
                          <TableCell className={amountCellClass}>{formatAmount(item.credit)}</TableCell>
                          <TableCell className={amountCellClass}>{formatAmount(item.discount || 0)}</TableCell>
                          <TableCell className={amountCellClass}>{formatAmount(item.purchaseReturn || 0)}</TableCell>
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
                          {formatAmount(getTotalPurchaseReturn())}
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

export default SupplierReport;
