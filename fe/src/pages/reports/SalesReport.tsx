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
import { useTableControls } from "@/hooks/useTableControls";
import { SortableHeader } from "@/components/ui/sortable-header";

const sortableHeadClass =
  "text-white [&_button]:text-white [&_button]:hover:text-white";

const formatAmount = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

const SalesReport = () => {
  const [sales, setSales] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [customerOpen, setCustomerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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
        description: "Failed to fetch sales data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredSales = useMemo(() => {
    if (selectedCustomers.length === 0) return sales;
    return sales.filter((sale) => {
      const saleDate = new Date(sale.date);
      const isInDateRange = saleDate >= new Date(startDate) && saleDate <= new Date(endDate);
      const isSelectedCustomer = selectedCustomers.includes(sale.customer_id);
      return isInDateRange && isSelectedCustomer;
    });
  }, [sales, selectedCustomers, startDate, endDate]);

  const getSortValue = useMemo(
    () => (sale: any, key: string) => {
      switch (key) {
        case "sales_no":
          return sale.sales_no;
        case "customer":
          return sale.customer_name;
        case "date":
          return sale.date ? new Date(sale.date) : null;
        case "total":
          return sale.total;
        case "outstanding":
          return sale.payment_status === "FULL"
            ? 0
            : (sale.remaining_amount ?? sale.total);
        case "credit_days":
          return sale.credit_days ?? 0;
        case "overdue_days":
          return sale.overdue_days ?? 0;
        default:
          return null;
      }
    },
    []
  );

  const { sort, toggleSort, rows } = useTableControls({
    data: filteredSales,
    getSortValue,
    defaultSort: { key: "date", direction: "desc" },
  });

  const exportToCSV = () => {
    const headers = [
      "Sales No", 
      "Customer Name", 
      "Date", 
      "Total", 
      "Description",
      "Transport Charges",
      "Discount",
      "Credit Days",
      "Outstanding",
      "Overdue Days"
    ];
    const csvContent = [
      headers.join(","),
      ...rows.map((sale) => {
        return [
          `"${sale.sales_no || ''}"`,
          `"${sale.customer_name || ''}"`,
          format(new Date(sale.date), "yyyy-MM-dd"),
          sale.total,
          `"${sale.description || ''}"`,
          sale.transport_charges || 0,
          sale.discount || 0,
          sale.credit_days || 0,
          sale.remaining_amount ?? sale.total,
          sale.overdue_days || 0,
        ].join(",");
      }),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `sales_report_${format(new Date(), "yyyy-MM-dd")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = () => {
    const selectedCustomerNames = selectedCustomers.length > 0
      ? customers.filter(c => selectedCustomers.includes(c.id)).map(c => c.name).join(", ")
      : "All Customers";
    const totalAmount = rows.reduce((sum, sale) => sum + sale.total, 0);
    const totalOutstanding = rows.reduce((sum, sale) => sum + (sale.remaining_amount ?? sale.total), 0);

    downloadReportPdf({
      title: "Sales Report",
      filename: `sales_report_${format(new Date(startDate), "yyyyMMdd")}_to_${format(new Date(endDate), "yyyyMMdd")}.pdf`,
      orientation: "landscape",
      meta: [
        { label: "Customers", value: selectedCustomerNames },
        { label: "Period", value: formatPdfPeriod(startDate, endDate) },
        { label: "Bills", value: String(rows.length) },
      ],
      summary: [
        { label: "Total Sales", value: formatPdfAmount(totalAmount) },
        { label: "Number of Sales", value: String(rows.length) },
        { label: "Outstanding", value: formatPdfAmount(totalOutstanding), emphasize: true },
      ],
      columns: [
        { header: "Sales No", width: 28, align: "center" },
        { header: "Customer", align: "left" },
        { header: "Date", width: 26, align: "center" },
        { header: "Total", width: 34, align: "right" },
        { header: "Outstanding", width: 34, align: "right" },
        { header: "Overdue", width: 22, align: "center" },
        { header: "Credit Days", width: 24, align: "center" },
      ],
      rows: rows.map((sale) => [
        sale.sales_no || "—",
        sale.customer_name || "—",
        formatPdfDate(sale.date),
        formatPdfAmount(sale.total, { prefix: false }),
        formatPdfAmount(sale.remaining_amount ?? sale.total, { prefix: false }),
        String(sale.overdue_days || 0),
        String(sale.credit_days || 0),
      ]),
      foot: ["", "", "Total", formatPdfAmount(totalAmount, { prefix: false }), formatPdfAmount(totalOutstanding, { prefix: false }), "", ""],
    });
  };

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.city?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <ReportLayout
      title="Sales Report"
      description="View and export sales information"
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
                    : "Select customers..."}
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
                          setSelectedCustomers(prev =>
                            prev.includes(customer.id)
                              ? prev.filter(id => id !== customer.id)
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
              const customer = customers.find(c => c.id === customerId);
              return customer ? (
                <Badge
                  key={customerId}
                  variant="secondary"
                  className="flex items-center gap-1"
                >
                  {customer.name}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => setSelectedCustomers(prev => prev.filter(id => id !== customerId))}
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
            {rows.length > 0 && (
              <div className="sticky top-0 z-10 bg-background pb-4">
                <div className="bg-sidebar/5 rounded-lg p-4 shadow-sm">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-muted-foreground">Total Sales</span>
                    <span className="font-medium">
                      {formatAmount(rows.reduce((sum, sale) => sum + sale.total, 0))}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Number of Sales</span>
                    <span className="font-medium">{rows.length}</span>
                  </div>
                </div>
              </div>
            )}

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
                      label="Date"
                      sortKey="date"
                      sort={sort}
                      onSort={toggleSort}
                      className={sortableHeadClass}
                    />
                    <SortableHeader
                      label="Total"
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
                      label="Credit Days"
                      sortKey="credit_days"
                      sort={sort}
                      onSort={toggleSort}
                      align="right"
                      className={`text-right ${sortableHeadClass}`}
                    />
                    <SortableHeader
                      label="Overdue Days"
                      sortKey="overdue_days"
                      sort={sort}
                      onSort={toggleSort}
                      align="right"
                      className={`rounded-tr-lg text-right ${sortableHeadClass}`}
                    />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length > 0 ? (
                    <>
                      {rows.map((sale) => (
                        <TableRow key={sale.id} className="hover:bg-sidebar/10">
                          <TableCell className="font-medium">{sale.sales_no}</TableCell>
                          <TableCell>{sale.customer_name}</TableCell>
                          <TableCell>{format(new Date(sale.date), "dd MMM yyyy")}</TableCell>
                          <TableCell className="text-right">
                            {formatAmount(sale.total)}
                          </TableCell>
                          <TableCell className="text-right">
                            {sale.payment_status === "FULL"
                              ? "Paid"
                              : formatAmount(sale.remaining_amount ?? sale.total)}
                          </TableCell>
                          <TableCell className="text-right">{sale.credit_days ?? 0}</TableCell>
                          <TableCell className="text-right">
                            {sale.payment_status === "FULL" ? (
                              "—"
                            ) : (sale.overdue_days || 0) > 0 ? (
                              <span className="text-red-600 font-medium">{sale.overdue_days}</span>
                            ) : (
                              0
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="border-t-2 border-sidebar/20">
                        <TableCell colSpan={3} className="text-right font-medium">Total</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatAmount(rows.reduce((sum, sale) => sum + sale.total, 0))}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatAmount(
                            rows.reduce(
                              (sum, sale) =>
                                sum + (sale.payment_status === "FULL" ? 0 : (sale.remaining_amount ?? sale.total)),
                              0
                            )
                          )}
                        </TableCell>
                        <TableCell colSpan={2}></TableCell>
                      </TableRow>
                    </>
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        No sales data found
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

export default SalesReport;
