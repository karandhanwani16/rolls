import { useState, useEffect, useMemo } from "react";
import ReportLayout from "@/components/reports/ReportLayout";
import { paymentsInAPI, customersAPI } from "@/services/api";
import { getRegularCustomers } from "@/lib/partyTypes";
import { useToast } from "@/components/ui/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { Loader2, Download, FileText, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  downloadReportPdf,
  formatPdfAmount,
  formatPdfDate,
  formatPdfPeriod,
} from "@/lib/reportPdf";
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
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
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

const getFinancialYearStart = () => {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-04-01`;
};

const paymentDate = (payment: any) =>
  payment.payment_date || payment.created_at;

const isStandaloneVatav = (payment: any) => {
  const category = (payment.payment_category || "NORMAL").toUpperCase();
  return (
    category === "VATAV" &&
    (payment.entry_type === "STANDALONE" || !payment.actual_id)
  );
};

const categoryLabel = (payment: any) => {
  const category = (payment.payment_category || "NORMAL").toUpperCase();
  return category === "VATAV" ? "Watav" : "Normal";
};

const isVatavPayment = (payment: any) =>
  (payment.payment_category || "NORMAL").toUpperCase() === "VATAV";

/** Watav vendor (receive party); em dash for Normal / missing. */
const watavVendorName = (payment: any) =>
  isVatavPayment(payment) ? payment.receive_customer?.name || "—" : "—";

const PaymentInReport = () => {
  const [paymentsIn, setPaymentsIn] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(getFinancialYearStart());
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [customerOpen, setCustomerOpen] = useState(false);
  const [partySearch, setPartySearch] = useState("");
  const [resultSearch, setResultSearch] = useState("");

  useEffect(() => {
    fetchCustomers();
    fetchPaymentsIn();
  }, []);

  const fetchCustomers = async () => {
    try {
      const data = await customersAPI.getAll();
      setCustomers(getRegularCustomers(data || []));
    } catch (error) {
      console.error("Error fetching customers:", error);
      toast({
        title: "Error",
        description: "Failed to fetch customer data",
        variant: "destructive",
      });
    }
  };

  const fetchPaymentsIn = async () => {
    try {
      setLoading(true);
      const response = await paymentsInAPI.getAll();
      setPaymentsIn(response.data || []);
    } catch (error) {
      console.error("Error fetching payments in:", error);
      toast({
        title: "Error",
        description: "Failed to fetch payments in data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredPayments = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    const q = resultSearch.trim().toLowerCase();

    return paymentsIn.filter((payment) => {
      // Ledger-relevant only: NORMAL + VATAV customer payments; exclude STANDALONE watav
      if (isStandaloneVatav(payment)) return false;

      const date = new Date(paymentDate(payment));
      if (Number.isNaN(date.getTime()) || date < start || date > end) return false;

      const customerId = payment.actual_id;
      if (
        selectedCustomers.length > 0 &&
        (!customerId || !selectedCustomers.includes(customerId))
      ) {
        return false;
      }

      if (!q) return true;

      const haystack = [
        payment.actual_customer?.name,
        payment.receive_customer?.name,
        payment.type,
        payment.description,
        payment.payment_category,
        payment.sale?.sales_no,
        String(payment.received_amount ?? ""),
        String(payment.actual_amount ?? ""),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [paymentsIn, startDate, endDate, selectedCustomers, resultSearch]);

  const getSortValue = useMemo(
    () => (payment: any, key: string) => {
      switch (key) {
        case "date":
          return paymentDate(payment) ? new Date(paymentDate(payment)) : null;
        case "customer":
          return payment.actual_customer?.name || "";
        case "amount":
          return payment.received_amount ?? 0;
        case "actual":
          return payment.actual_amount ?? 0;
        case "type":
          return payment.type || "";
        case "category":
          return categoryLabel(payment);
        case "vendor":
          return isVatavPayment(payment)
            ? payment.receive_customer?.name || ""
            : "";
        case "description":
          return payment.description || "";
        case "ref":
          return payment.sale?.sales_no || "";
        default:
          return null;
      }
    },
    []
  );

  const { sort, toggleSort, rows } = useTableControls({
    data: filteredPayments,
    getSortValue,
    defaultSort: { key: "date", direction: "desc" },
  });

  const totalReceived = rows.reduce(
    (sum, p) => sum + (p.received_amount || 0),
    0
  );
  const totalActual = rows.reduce((sum, p) => sum + (p.actual_amount || 0), 0);

  const selectedCustomerNames =
    selectedCustomers.length > 0
      ? customers
          .filter((c) => selectedCustomers.includes(c.id))
          .map((c) => c.name)
          .join(", ")
      : "All Customers";

  const filteredCustomers = customers.filter(
    (customer) =>
      customer.name.toLowerCase().includes(partySearch.toLowerCase()) ||
      customer.phone?.toLowerCase().includes(partySearch.toLowerCase()) ||
      customer.city?.toLowerCase().includes(partySearch.toLowerCase())
  );

  const exportToPDF = () => {
    downloadReportPdf({
      title: "Payment In Report",
      filename: `payment_in_report_${format(new Date(startDate), "yyyyMMdd")}_to_${format(new Date(endDate), "yyyyMMdd")}.pdf`,
      orientation: "landscape",
      meta: [
        { label: "Customers", value: selectedCustomerNames },
        { label: "Period", value: formatPdfPeriod(startDate, endDate) },
        { label: "Entries", value: String(rows.length) },
      ],
      summary: [
        {
          label: "Total Received",
          value: formatPdfAmount(totalReceived),
          emphasize: true,
        },
        { label: "Total Actual / Net", value: formatPdfAmount(totalActual) },
        { label: "Payments", value: String(rows.length) },
      ],
      columns: [
        { header: "Date", width: 26, align: "center" },
        { header: "Customer", align: "left" },
        { header: "Amount", width: 30, align: "right" },
        { header: "Type", width: 28, align: "center" },
        { header: "Category", width: 24, align: "center" },
        { header: "Watav Vendor", align: "left" },
        { header: "Description" },
        { header: "Bill / Ref", width: 28, align: "center" },
      ],
      rows: rows.map((payment) => [
        formatPdfDate(paymentDate(payment)),
        payment.actual_customer?.name || "—",
        formatPdfAmount(payment.received_amount, { prefix: false }),
        payment.type || "—",
        categoryLabel(payment),
        watavVendorName(payment),
        payment.description || "—",
        payment.sale?.sales_no || "—",
      ]),
      foot: [
        "",
        "Total",
        formatPdfAmount(totalReceived, { prefix: false }),
        "",
        "",
        "",
        "",
        "",
      ],
    });
  };

  const exportToCSV = () => {
    const headers = [
      "Date",
      "Customer",
      "Received Amount",
      "Actual Amount",
      "Type",
      "Category",
      "Watav Vendor",
      "Description",
      "Bill / Ref",
    ];
    const csvContent = [
      headers.join(","),
      ...rows.map((payment) =>
        [
          format(new Date(paymentDate(payment)), "yyyy-MM-dd"),
          `"${payment.actual_customer?.name || ""}"`,
          payment.received_amount ?? 0,
          payment.actual_amount ?? 0,
          `"${payment.type || ""}"`,
          `"${categoryLabel(payment)}"`,
          `"${isVatavPayment(payment) ? payment.receive_customer?.name || "" : ""}"`,
          `"${(payment.description || "").replace(/"/g, '""')}"`,
          `"${payment.sale?.sales_no || ""}"`,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `payment_in_report_${format(new Date(), "yyyy-MM-dd")}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <ReportLayout
      title="Payment In Report"
      description="Payments received from customers (normal and watav customer payments)"
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
            <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={customerOpen}
                  className="w-[240px] justify-between"
                >
                  {selectedCustomers.length > 0
                    ? `${selectedCustomers.length} customer(s) selected`
                    : "All customers"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[240px] p-0">
                <Command>
                  <CommandInput
                    placeholder="Search customers..."
                    value={partySearch}
                    onValueChange={setPartySearch}
                  />
                  <CommandEmpty>No customers found.</CommandEmpty>
                  <CommandGroup className="max-h-64 overflow-auto">
                    {filteredCustomers.map((customer) => (
                      <CommandItem
                        key={customer.id}
                        onSelect={() => {
                          setSelectedCustomers((prev) =>
                            prev.includes(customer.id)
                              ? prev.filter((id) => id !== customer.id)
                              : [...prev, customer.id]
                          );
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedCustomers.includes(customer.id)
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
            <Input
              placeholder="Search results..."
              value={resultSearch}
              onChange={(e) => setResultSearch(e.target.value)}
              className="w-[200px]"
            />
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

        {selectedCustomers.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedCustomers.map((customerId) => {
              const customer = customers.find((c) => c.id === customerId);
              return customer ? (
                <Badge
                  key={customerId}
                  variant="secondary"
                  className="flex items-center gap-1"
                >
                  {customer.name}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() =>
                      setSelectedCustomers((prev) =>
                        prev.filter((id) => id !== customerId)
                      )
                    }
                  />
                </Badge>
              ) : null;
            })}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="sticky top-0 z-10 bg-background pb-4">
              <div className="bg-sidebar/5 rounded-lg p-4 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex justify-between items-center md:flex-col md:items-start md:gap-1">
                  <span className="text-sm text-muted-foreground">
                    Total Received
                  </span>
                  <span className="font-semibold text-emerald-700">
                    {formatAmount(totalReceived)}
                  </span>
                </div>
                <div className="flex justify-between items-center md:flex-col md:items-start md:gap-1">
                  <span className="text-sm text-muted-foreground">
                    Total Actual / Net
                  </span>
                  <span className="font-medium">{formatAmount(totalActual)}</span>
                </div>
                <div className="flex justify-between items-center md:flex-col md:items-start md:gap-1">
                  <span className="text-sm text-muted-foreground">
                    Payments
                  </span>
                  <span className="font-medium">{rows.length}</span>
                </div>
              </div>
            </div>

            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader className="bg-sidebar">
                  <TableRow>
                    <SortableHeader
                      label="Date"
                      sortKey="date"
                      sort={sort}
                      onSort={toggleSort}
                      className={`rounded-tl-lg ${sortableHeadClass}`}
                    />
                    <SortableHeader
                      label="Customer"
                      sortKey="customer"
                      sort={sort}
                      onSort={toggleSort}
                      className={sortableHeadClass}
                    />
                    <SortableHeader
                      label="Amount"
                      sortKey="amount"
                      sort={sort}
                      onSort={toggleSort}
                      align="right"
                      className={`text-right ${sortableHeadClass}`}
                    />
                    <SortableHeader
                      label="Type"
                      sortKey="type"
                      sort={sort}
                      onSort={toggleSort}
                      className={sortableHeadClass}
                    />
                    <SortableHeader
                      label="Category"
                      sortKey="category"
                      sort={sort}
                      onSort={toggleSort}
                      className={sortableHeadClass}
                    />
                    <SortableHeader
                      label="Watav Vendor"
                      sortKey="vendor"
                      sort={sort}
                      onSort={toggleSort}
                      className={sortableHeadClass}
                    />
                    <SortableHeader
                      label="Description"
                      sortKey="description"
                      sort={sort}
                      onSort={toggleSort}
                      className={sortableHeadClass}
                    />
                    <SortableHeader
                      label="Bill / Ref"
                      sortKey="ref"
                      sort={sort}
                      onSort={toggleSort}
                      className={`rounded-tr-lg ${sortableHeadClass}`}
                    />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length > 0 ? (
                    <>
                      {rows.map((payment) => (
                        <TableRow
                          key={payment.id}
                          className="hover:bg-sidebar/10"
                        >
                          <TableCell>
                            {format(
                              new Date(paymentDate(payment)),
                              "dd MMM yyyy"
                            )}
                          </TableCell>
                          <TableCell className="font-medium">
                            {payment.actual_customer?.name || "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatAmount(payment.received_amount)}
                          </TableCell>
                          <TableCell className="capitalize">
                            {payment.type || "—"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                categoryLabel(payment) === "Watav"
                                  ? "secondary"
                                  : "outline"
                              }
                            >
                              {categoryLabel(payment)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {watavVendorName(payment)}
                          </TableCell>
                          <TableCell className="max-w-[220px] truncate">
                            {payment.description || "—"}
                          </TableCell>
                          <TableCell>{payment.sale?.sales_no || "—"}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="border-t-2 border-sidebar/20">
                        <TableCell
                          colSpan={2}
                          className="text-right font-medium"
                        >
                          Total
                        </TableCell>
                        <TableCell className="text-right font-semibold text-emerald-700">
                          {formatAmount(totalReceived)}
                        </TableCell>
                        <TableCell colSpan={5}></TableCell>
                      </TableRow>
                    </>
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        No payment in data found
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

export default PaymentInReport;
