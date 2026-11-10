import { useState, useEffect, useMemo } from "react";
import ReportLayout from "@/components/reports/ReportLayout";
import { customersAPI, paymentsInAPI } from "@/services/api";
import { getWatavVendors } from "@/lib/partyTypes";
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
import {
  Loader2,
  Download,
  FileText,
  FileSpreadsheet,
  Check,
  ChevronsUpDown,
} from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  settlementClassName,
  settlementLabel,
} from "@/lib/watavSettlement";
import { useTableControls } from "@/hooks/useTableControls";
import { SortableHeader } from "@/components/ui/sortable-header";

const sortableHeadClass =
  "text-white [&_button]:text-white [&_button]:hover:text-white";

const formatAmount = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);

const emptySummary = {
  totalEntries: 0,
  totalReceived: 0,
  totalPaidToWatav: 0,
  totalActualAmount: 0,
  totalVendorCharges: 0,
  totalNetAmount: 0,
  totalReceivable: 0,
  totalSettled: 0,
  currentPending: 0,
  unallocatedAmount: 0,
  vendorReceiptsTotal: 0,
  partiallySettledCount: 0,
  pending: {
    entries: 0,
    gross: 0,
    net: 0,
    remaining: 0,
    charges: 0,
    customerLinkedGross: 0,
    standaloneGross: 0,
  },
  collected: {
    entries: 0,
    gross: 0,
    net: 0,
    charges: 0,
    customerLinkedGross: 0,
    standaloneGross: 0,
  },
  customerLinked: { entries: 0, gross: 0, net: 0, charges: 0 },
  standalone: { entries: 0, gross: 0, net: 0, charges: 0 },
  partial: { entries: 0, remaining: 0, settled: 0 },
};

const WatavReport = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedWatav, setSelectedWatav] = useState<string>("");
  const [watavOpen, setWatavOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState(
    format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd")
  );
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [collectionFilter, setCollectionFilter] = useState<string>("ALL");
  const [entryTypeFilter, setEntryTypeFilter] = useState<string>("ALL");
  const [transactions, setTransactions] = useState<any[]>([]);
  const [byWatav, setByWatav] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [summary, setSummary] = useState(emptySummary);

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    fetchReport();
  }, [startDate, endDate, selectedWatav, collectionFilter, entryTypeFilter]);

  const fetchCustomers = async () => {
    try {
      const data = await customersAPI.getAll();
      setCustomers(data || []);
    } catch (error) {
      console.error("Error fetching customers:", error);
    }
  };

  const fetchReport = async () => {
    try {
      setLoading(true);
      const data = await paymentsInAPI.getWatavReport({
        startDate,
        endDate,
        watavCustomerId: selectedWatav || undefined,
        collectionStatus: collectionFilter === "ALL" ? undefined : collectionFilter,
        entryType: entryTypeFilter === "ALL" ? undefined : entryTypeFilter,
      });
      setTransactions(data.data || []);
      setByWatav(data.byWatav || []);
      setReceipts(data.receipts || []);
      setSummary({ ...emptySummary, ...(data.summary || {}) });
    } catch (error) {
      console.error("Error fetching watav report:", error);
      toast({
        title: "Error",
        description: "Failed to fetch watav report",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const vendorList = getWatavVendors(customers);
  const selectedWatavName =
    customers.find((c) => c.id === selectedWatav)?.name || "All Watav vendors";

  const filteredCustomers = vendorList.filter(
    (customer) =>
      customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.city?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getTxnSortValue = useMemo(
    () => (item: any, key: string) => {
      switch (key) {
        case "date":
          return item.date ? new Date(item.date) : null;
        case "vendor":
          return item.watavCustomerName || "";
        case "customer":
          return item.actualCustomerName || "";
        case "entry":
          return item.entryType || "";
        case "status":
          return item.collectionStatus || "";
        case "original":
          return item.originalAmount ?? item.receivedAmount ?? 0;
        case "settled":
          return item.totalSettledAmount ?? 0;
        case "remaining":
          return item.remainingAmount ?? 0;
        default:
          return null;
      }
    },
    []
  );

  const {
    sort: txnSort,
    toggleSort: toggleTxnSort,
    rows: txnRows,
  } = useTableControls({
    data: transactions,
    getSortValue: getTxnSortValue,
    defaultSort: { key: "date", direction: "desc" },
  });

  const getReceiptSortValue = useMemo(
    () => (receipt: any, key: string) => {
      switch (key) {
        case "date":
          return receipt.receipt_date ? new Date(receipt.receipt_date) : null;
        case "vendor":
          return receipt.vendor?.name || "";
        case "received":
          return receipt.amount ?? 0;
        case "allocated":
          return receipt.allocatedAmount ?? (receipt.amount - (receipt.unallocated_amount || 0));
        case "unallocated":
          return receipt.unallocatedAmount ?? (receipt.unallocated_amount || 0);
        default:
          return null;
      }
    },
    []
  );

  const {
    sort: receiptSort,
    toggleSort: toggleReceiptSort,
    rows: receiptRows,
  } = useTableControls({
    data: receipts,
    getSortValue: getReceiptSortValue,
    defaultSort: { key: "date", direction: "desc" },
  });

  const exportToCSV = () => {
    const headers = [
      "Sr. No.",
      "Date",
      "Watav Vendor",
      "Customer",
      "Entry Type",
      "Settlement Status",
      "Original",
      "Settled",
      "Remaining",
      "Instrument",
      "Description",
    ];
    const csvContent = [
      headers.join(","),
      ...txnRows.map((item) =>
        [
          item.srno,
          format(new Date(item.date), "yyyy-MM-dd"),
          `"${item.watavCustomerName}"`,
          `"${item.actualCustomerName || "None"}"`,
          item.entryType,
          item.collectionStatus,
          item.originalAmount ?? item.receivedAmount,
          item.totalSettledAmount || 0,
          item.remainingAmount ?? 0,
          `"${item.type || ""}"`,
          `"${item.description || ""}"`,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `watav_report_${format(new Date(startDate), "yyyyMMdd")}_to_${format(new Date(endDate), "yyyyMMdd")}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = () => {
    downloadReportPdf({
      title: "Watav Report",
      filename: `watav_report_${format(new Date(startDate), "yyyyMMdd")}_to_${format(new Date(endDate), "yyyyMMdd")}.pdf`,
      orientation: "landscape",
      meta: [
        { label: "Vendor", value: selectedWatavName },
        { label: "Period", value: formatPdfPeriod(startDate, endDate) },
        { label: "Entries", value: String(txnRows.length) },
      ],
      summary: [
        { label: "Receivable", value: formatPdfAmount(summary.totalReceivable || summary.totalReceived) },
        { label: "Settled", value: formatPdfAmount(summary.totalSettled || 0) },
        { label: "Pending", value: formatPdfAmount(summary.currentPending || summary.pending?.remaining || summary.pending?.net || 0) },
        { label: "Unallocated", value: formatPdfAmount(summary.unallocatedAmount || 0), emphasize: true },
      ],
      columns: [
        { header: "Sr.", width: 12, align: "center" },
        { header: "Date", width: 24, align: "center" },
        { header: "Vendor", width: 38 },
        { header: "Customer", align: "left" },
        { header: "Type", width: 24, align: "center" },
        { header: "Status", width: 28, align: "center" },
        { header: "Original", width: 28, align: "right" },
        { header: "Settled", width: 28, align: "right" },
        { header: "Remaining", width: 30, align: "right" },
      ],
      rows: txnRows.map((item) => [
        item.srno,
        formatPdfDate(item.date),
        item.watavCustomerName || "—",
        item.actualCustomerName || "None",
        item.entryType === "STANDALONE" ? "Standalone" : "Customer",
        settlementLabel(item.collectionStatus),
        formatPdfAmount(item.originalAmount ?? item.receivedAmount, { prefix: false }),
        formatPdfAmount(item.totalSettledAmount || 0, { prefix: false }),
        formatPdfAmount(item.remainingAmount ?? 0, { prefix: false }),
      ]),
      foot: [
        "",
        "",
        "",
        "",
        "",
        "Total",
        formatPdfAmount(summary.totalReceivable || summary.totalReceived, { prefix: false }),
        formatPdfAmount(summary.totalSettled || 0, { prefix: false }),
        formatPdfAmount(summary.currentPending || summary.pending?.remaining || 0, { prefix: false }),
      ],
    });
  };

  return (
    <ReportLayout
      title="Watav Report"
      description="Vendor receivables from Watav payments — customer already paid; pending is collectible from the vendor"
    >
      <div className="flex flex-col space-y-4">
        <div className="flex flex-wrap gap-4 items-center">
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

          <Popover open={watavOpen} onOpenChange={setWatavOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={watavOpen}
                className="w-[260px] justify-between"
              >
                {selectedWatavName}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[260px] p-0">
              <Command>
                <CommandInput
                  placeholder="Search watav vendor..."
                  value={searchQuery}
                  onValueChange={setSearchQuery}
                />
                <CommandEmpty>No vendors found.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    onSelect={() => {
                      setSelectedWatav("");
                      setWatavOpen(false);
                    }}
                  >
                    <Check
                      className={cn("mr-2 h-4 w-4", !selectedWatav ? "opacity-100" : "opacity-0")}
                    />
                    All Watav vendors
                  </CommandItem>
                  {filteredCustomers.map((customer) => (
                    <CommandItem
                      key={customer.id}
                      onSelect={() => {
                        setSelectedWatav(customer.id);
                        setWatavOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedWatav === customer.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {customer.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>

          <Select value={collectionFilter} onValueChange={setCollectionFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Collection" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="PENDING">Outstanding</SelectItem>
              <SelectItem value="PARTIALLY_SETTLED">Partially settled</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={entryTypeFilter} onValueChange={setEntryTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Entry type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All entry types</SelectItem>
              <SelectItem value="CUSTOMER_PAYMENT">Customer-linked</SelectItem>
              <SelectItem value="STANDALONE">Standalone</SelectItem>
            </SelectContent>
          </Select>

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

        {loading ? (
          <div className="flex justify-center items-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="bg-sidebar/5 rounded-lg p-4 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Watav receivable</div>
                <div className="font-semibold text-lg">{formatAmount(summary.totalReceivable || summary.totalReceived)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Received / settled</div>
                <div className="font-semibold text-lg text-green-700">
                  {formatAmount(summary.totalSettled || 0)}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Current pending</div>
                <div className="font-bold text-lg text-amber-800">
                  {formatAmount(summary.currentPending || summary.pending?.remaining || summary.pending?.net || 0)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Customer {formatAmount(summary.pending?.customerLinkedGross || 0)} · Standalone{" "}
                  {formatAmount(summary.pending?.standaloneGross || 0)}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Partially settled</div>
                <div className="font-bold text-lg">
                  {summary.partiallySettledCount || summary.partial?.entries || 0}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Remaining {formatAmount(summary.partial?.remaining || 0)}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Unallocated receipts</div>
                <div className="font-bold text-lg">
                  {formatAmount(summary.unallocatedAmount || 0)}
                </div>
              </div>
            </div>

            {!selectedWatav && byWatav.length > 0 && (
              <div className="rounded-md border overflow-hidden">
                <div className="bg-sidebar px-4 py-2 text-white text-sm font-medium">
                  Vendor Account Summary
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendor</TableHead>
                      <TableHead className="text-right">Entries</TableHead>
                      <TableHead className="text-right">Customer / Standalone</TableHead>
                      <TableHead className="text-right">Receivable</TableHead>
                      <TableHead className="text-right">Settled</TableHead>
                      <TableHead className="text-right">Pending</TableHead>
                      <TableHead className="text-right">Unallocated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byWatav.map((row) => (
                      <TableRow key={row.watavCustomerId}>
                        <TableCell className="font-medium">{row.watavCustomerName}</TableCell>
                        <TableCell className="text-right">{row.entries}</TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {row.customerLinkedEntries} / {row.standaloneEntries}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatAmount(row.totalReceivable || row.totalReceived)}
                        </TableCell>
                        <TableCell className="text-right text-green-700">
                          {formatAmount(row.totalSettled || row.collectedNet || 0)}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-amber-800">
                          {formatAmount(row.currentPending || row.pendingNet)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatAmount(row.unallocatedAmount || 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {receipts.length > 0 && (
              <div className="rounded-md border overflow-hidden">
                <div className="bg-sidebar px-4 py-2 text-white text-sm font-medium">
                  Vendor receipts in period
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableHeader label="Date" sortKey="date" sort={receiptSort} onSort={toggleReceiptSort} />
                      <SortableHeader label="Vendor" sortKey="vendor" sort={receiptSort} onSort={toggleReceiptSort} />
                      <TableHead>Reference</TableHead>
                      <SortableHeader label="Received" sortKey="received" sort={receiptSort} onSort={toggleReceiptSort} align="right" className="text-right" />
                      <SortableHeader label="Allocated" sortKey="allocated" sort={receiptSort} onSort={toggleReceiptSort} align="right" className="text-right" />
                      <SortableHeader label="Unallocated" sortKey="unallocated" sort={receiptSort} onSort={toggleReceiptSort} align="right" className="text-right" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receiptRows.map((receipt) => (
                      <TableRow key={receipt.id}>
                        <TableCell>
                          {format(new Date(receipt.receipt_date), "yyyy-MM-dd")}
                        </TableCell>
                        <TableCell>{receipt.vendor?.name || "—"}</TableCell>
                        <TableCell>{receipt.reference || receipt.type || "—"}</TableCell>
                        <TableCell className="text-right">{formatAmount(receipt.amount)}</TableCell>
                        <TableCell className="text-right text-green-700">
                          {formatAmount(receipt.allocatedAmount ?? (receipt.amount - (receipt.unallocated_amount || 0)))}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatAmount(receipt.unallocatedAmount ?? (receipt.unallocated_amount || 0))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader className="bg-sidebar">
                  <TableRow>
                    <TableHead className="text-white">Sr.</TableHead>
                    <SortableHeader label="Date" sortKey="date" sort={txnSort} onSort={toggleTxnSort} className={sortableHeadClass} />
                    <SortableHeader label="Vendor" sortKey="vendor" sort={txnSort} onSort={toggleTxnSort} className={sortableHeadClass} />
                    <SortableHeader label="Customer" sortKey="customer" sort={txnSort} onSort={toggleTxnSort} className={sortableHeadClass} />
                    <SortableHeader label="Entry" sortKey="entry" sort={txnSort} onSort={toggleTxnSort} className={sortableHeadClass} />
                    <SortableHeader label="Status" sortKey="status" sort={txnSort} onSort={toggleTxnSort} className={sortableHeadClass} />
                    <SortableHeader label="Original" sortKey="original" sort={txnSort} onSort={toggleTxnSort} align="right" className={`text-right ${sortableHeadClass}`} />
                    <SortableHeader label="Settled" sortKey="settled" sort={txnSort} onSort={toggleTxnSort} align="right" className={`text-right ${sortableHeadClass}`} />
                    <SortableHeader label="Remaining" sortKey="remaining" sort={txnSort} onSort={toggleTxnSort} align="right" className={`text-right ${sortableHeadClass}`} />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {txnRows.length > 0 ? (
                    <>
                      {txnRows.map((item) => (
                          <TableRow key={item.id} className="hover:bg-sidebar/10">
                            <TableCell>{item.srno}</TableCell>
                            <TableCell>{format(new Date(item.date), "yyyy-MM-dd")}</TableCell>
                            <TableCell className="font-medium">{item.watavCustomerName}</TableCell>
                            <TableCell>
                              {item.actualCustomerName || (
                                <span className="italic text-muted-foreground">None</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {item.entryType === "STANDALONE" ? "Standalone" : "Customer"}
                            </TableCell>
                            <TableCell>
                              <span className={settlementClassName(item.collectionStatus)}>
                                {settlementLabel(item.collectionStatus)}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              {formatAmount(item.originalAmount ?? item.receivedAmount)}
                            </TableCell>
                            <TableCell className="text-right text-green-700">
                              {formatAmount(item.totalSettledAmount || 0)}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {formatAmount(item.remainingAmount ?? 0)}
                            </TableCell>
                          </TableRow>
                      ))}
                      <TableRow className="border-t-2 border-sidebar/20">
                        <TableCell colSpan={6} className="text-right font-medium">
                          Total
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatAmount(summary.totalReceivable || summary.totalReceived)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-green-700">
                          {formatAmount(summary.totalSettled || 0)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatAmount(summary.currentPending || summary.pending?.remaining || 0)}
                        </TableCell>
                      </TableRow>
                    </>
                  ) : (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8">
                        No watav entries found for this period
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

export default WatavReport;
