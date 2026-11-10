import { useState, useEffect, useMemo } from "react";
import ReportLayout from "@/components/reports/ReportLayout";
import { salesAPI, customersAPI } from "@/services/api";
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
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTableControls } from "@/hooks/useTableControls";
import { SortableHeader } from "@/components/ui/sortable-header";

const sortableHeadClass =
  "text-white [&_button]:text-white [&_button]:hover:text-white";

const formatAmount = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const getFinancialYearStart = () => {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-04-01`;
};

const OutstandingReport = () => {
  const [sales, setSales] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(getFinancialYearStart());
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [customerOpen, setCustomerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"all" | "overdue">("all");

  useEffect(() => {
    fetchCustomers();
    fetchSales();
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

  const fetchSales = async () => {
    try {
      setLoading(true);
      const response = await salesAPI.getAll();
      setSales(response.data || []);
    } catch (error) {
      console.error("Error fetching sales:", error);
      toast({
        title: "Error",
        description: "Failed to fetch outstanding data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const outstandingSales = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    return sales.filter((sale) => {
      const remaining = sale.remaining_amount ?? sale.total;
      if (sale.payment_status === "FULL" || remaining <= 0) return false;

      const saleDate = new Date(sale.date);
      const inDateRange = saleDate >= start && saleDate <= end;
      const customerMatch =
        selectedCustomers.length === 0 ||
        selectedCustomers.includes(sale.customer_id);
      const overdueMatch =
        viewMode === "all" || (sale.overdue_days || 0) > 0;

      return inDateRange && customerMatch && overdueMatch;
    });
  }, [sales, startDate, endDate, selectedCustomers, viewMode]);

  const getSortValue = useMemo(
    () => (sale: any, key: string) => {
      switch (key) {
        case "sales_no":
          return sale.sales_no;
        case "customer":
          return sale.customer_name;
        case "date":
          return sale.date ? new Date(sale.date) : null;
        case "credit_days":
          return sale.credit_days ?? 0;
        case "total":
          return sale.total;
        case "outstanding":
          return sale.remaining_amount ?? sale.total;
        case "elapsed_days":
          return sale.elapsed_days ?? 0;
        case "status":
          return sale.payment_status || "UNPAID";
        default:
          return null;
      }
    },
    []
  );

  const { sort, toggleSort, rows } = useTableControls({
    data: outstandingSales,
    getSortValue,
    defaultSort: { key: "elapsed_days", direction: "desc" },
  });

  const totalOutstanding = rows.reduce(
    (sum, sale) => sum + (sale.remaining_amount ?? sale.total),
    0
  );
  const overdueCount = rows.filter(
    (sale) => (sale.overdue_days || 0) > 0
  ).length;

  const exportToCSV = () => {
    const headers = [
      "Sales No",
      "Customer Name",
      "Date",
      "Credit Days",
      "Due Date",
      "Bill Total",
      "Outstanding",
      "Elapsed Days",
      "Status",
    ];
    const csvContent = [
      headers.join(","),
      ...rows.map((sale) =>
        [
          `"${sale.sales_no || ""}"`,
          `"${sale.customer_name || ""}"`,
          format(new Date(sale.date), "yyyy-MM-dd"),
          sale.credit_days || 0,
          sale.due_date
            ? format(new Date(sale.due_date), "yyyy-MM-dd")
            : "",
          sale.total,
          sale.remaining_amount ?? sale.total,
          sale.elapsed_days || 0,
          `"${sale.payment_status || "UNPAID"}"`,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `outstanding_report_${format(new Date(), "yyyy-MM-dd")}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = () => {
    const selectedCustomerNames = selectedCustomers.length > 0
      ? customers.filter((c) => selectedCustomers.includes(c.id)).map((c) => c.name).join(", ")
      : "All Customers";

    downloadReportPdf({
      title: "Outstanding Report",
      filename: `outstanding_report_${format(new Date(startDate), "yyyyMMdd")}_to_${format(new Date(endDate), "yyyyMMdd")}.pdf`,
      orientation: "landscape",
      meta: [
        { label: "Customers", value: selectedCustomerNames },
        { label: "Period", value: formatPdfPeriod(startDate, endDate) },
        { label: "View", value: viewMode === "overdue" ? "Overdue Only" : "All Outstanding" },
      ],
      summary: [
        { label: "Total Outstanding", value: formatPdfAmount(totalOutstanding), emphasize: true },
        { label: "Unpaid / Partial Bills", value: String(rows.length) },
        { label: "Overdue Bills", value: String(overdueCount) },
      ],
      columns: [
        { header: "Sales No", width: 28, align: "center" },
        { header: "Customer", align: "left" },
        { header: "Date", width: 26, align: "center" },
        { header: "Credit Days", width: 24, align: "center" },
        { header: "Outstanding", width: 36, align: "right" },
        { header: "Elapsed", width: 22, align: "center" },
        { header: "Status", width: 28, align: "center" },
      ],
      rows: rows.map((sale) => [
        sale.sales_no || "—",
        sale.customer_name || "—",
        formatPdfDate(sale.date),
        String(sale.credit_days || 0),
        formatPdfAmount(sale.remaining_amount ?? sale.total, { prefix: false }),
        String(sale.elapsed_days || 0),
        sale.payment_status || "UNPAID",
      ]),
      foot: ["", "", "", "Total", formatPdfAmount(totalOutstanding, { prefix: false }), "", ""],
    });
  };

  const filteredCustomers = customers.filter(
    (customer) =>
      customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.city?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <ReportLayout
      title="Outstanding Report"
      description="Unpaid and partially paid bills with days elapsed since sale date"
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
            <Select
              value={viewMode}
              onValueChange={(value: "all" | "overdue") => setViewMode(value)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="View" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Outstanding</SelectItem>
                <SelectItem value="overdue">Overdue Only</SelectItem>
              </SelectContent>
            </Select>
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
                    value={searchQuery}
                    onValueChange={setSearchQuery}
                  />
                  <CommandEmpty>No customers found.</CommandEmpty>
                  <CommandGroup>
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
                    Total Outstanding
                  </span>
                  <span className="font-semibold text-red-600">
                    {formatAmount(totalOutstanding)}
                  </span>
                </div>
                <div className="flex justify-between items-center md:flex-col md:items-start md:gap-1">
                  <span className="text-sm text-muted-foreground">
                    Outstanding Bills
                  </span>
                  <span className="font-medium">{rows.length}</span>
                </div>
                <div className="flex justify-between items-center md:flex-col md:items-start md:gap-1">
                  <span className="text-sm text-muted-foreground">
                    Overdue Bills
                  </span>
                  <span className="font-medium text-red-600">{overdueCount}</span>
                </div>
              </div>
            </div>

            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader className="bg-sidebar">
                  <TableRow>
                    <SortableHeader
                      label="Sales No"
                      sortKey="sales_no"
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
                      label="Bill Date"
                      sortKey="date"
                      sort={sort}
                      onSort={toggleSort}
                      className={sortableHeadClass}
                    />
                    <SortableHeader
                      label="Credit Days"
                      sortKey="credit_days"
                      sort={sort}
                      onSort={toggleSort}
                      align="right"
                      className={`text-right ${sortableHeadClass}`}
                    />
                    <SortableHeader
                      label="Bill Total"
                      sortKey="total"
                      sort={sort}
                      onSort={toggleSort}
                      align="right"
                      className={`text-right ${sortableHeadClass}`}
                    />
                    <SortableHeader
                      label="Outstanding"
                      sortKey="outstanding"
                      sort={sort}
                      onSort={toggleSort}
                      align="right"
                      className={`text-right ${sortableHeadClass}`}
                    />
                    <SortableHeader
                      label="Elapsed Days"
                      sortKey="elapsed_days"
                      sort={sort}
                      onSort={toggleSort}
                      align="right"
                      className={`text-right ${sortableHeadClass}`}
                    />
                    <SortableHeader
                      label="Status"
                      sortKey="status"
                      sort={sort}
                      onSort={toggleSort}
                      className={`rounded-tr-lg ${sortableHeadClass}`}
                    />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length > 0 ? (
                    <>
                      {rows.map((sale) => (
                        <TableRow key={sale.id} className="hover:bg-sidebar/10">
                          <TableCell className="font-medium">
                            {sale.sales_no}
                          </TableCell>
                          <TableCell>{sale.customer_name}</TableCell>
                          <TableCell>
                            {format(new Date(sale.date), "dd MMM yyyy")}
                          </TableCell>
                          <TableCell className="text-right">
                            {sale.credit_days ?? 0}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatAmount(sale.total)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatAmount(sale.remaining_amount ?? sale.total)}
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={
                                (sale.overdue_days || 0) > 0
                                  ? "text-red-600 font-medium"
                                  : "text-green-600 font-medium"
                              }
                            >
                              {sale.elapsed_days ?? 0}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                sale.payment_status === "PARTIAL"
                                  ? "secondary"
                                  : "destructive"
                              }
                            >
                              {sale.payment_status || "UNPAID"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="border-t-2 border-sidebar/20">
                        <TableCell
                          colSpan={5}
                          className="text-right font-medium"
                        >
                          Total Outstanding
                        </TableCell>
                        <TableCell className="text-right font-semibold text-red-600">
                          {formatAmount(totalOutstanding)}
                        </TableCell>
                        <TableCell colSpan={2}></TableCell>
                      </TableRow>
                    </>
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        No outstanding bills found
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

export default OutstandingReport;
