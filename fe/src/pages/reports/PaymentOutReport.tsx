import { useState, useEffect, useMemo } from "react";
import ReportLayout from "@/components/reports/ReportLayout";
import { paymentsOutAPI, suppliersAPI } from "@/services/api";
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

const supplierName = (payment: any) =>
  payment.supplier?.name || payment.supplier?.supplier_name || "";

const PaymentOutReport = () => {
  const [paymentsOut, setPaymentsOut] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(getFinancialYearStart());
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [partySearch, setPartySearch] = useState("");
  const [resultSearch, setResultSearch] = useState("");

  useEffect(() => {
    fetchSuppliers();
    fetchPaymentsOut();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const data = await suppliersAPI.getAll();
      setSuppliers(data || []);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      toast({
        title: "Error",
        description: "Failed to fetch supplier data",
        variant: "destructive",
      });
    }
  };

  const fetchPaymentsOut = async () => {
    try {
      setLoading(true);
      const response = await paymentsOutAPI.getAll();
      setPaymentsOut(response.data || []);
    } catch (error) {
      console.error("Error fetching payments out:", error);
      toast({
        title: "Error",
        description: "Failed to fetch payments out data",
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

    return paymentsOut.filter((payment) => {
      const date = new Date(paymentDate(payment));
      if (Number.isNaN(date.getTime()) || date < start || date > end) return false;

      if (
        selectedSuppliers.length > 0 &&
        !selectedSuppliers.includes(payment.supplier_id)
      ) {
        return false;
      }

      if (!q) return true;

      const haystack = [
        supplierName(payment),
        payment.type,
        payment.description,
        payment.purchase?.purchase_no,
        String(payment.amount ?? ""),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [paymentsOut, startDate, endDate, selectedSuppliers, resultSearch]);

  const getSortValue = useMemo(
    () => (payment: any, key: string) => {
      switch (key) {
        case "date":
          return paymentDate(payment) ? new Date(paymentDate(payment)) : null;
        case "supplier":
          return supplierName(payment);
        case "amount":
          return payment.amount ?? 0;
        case "type":
          return payment.type || "";
        case "description":
          return payment.description || "";
        case "cheque_date":
          return payment.cheque_date ? new Date(payment.cheque_date) : null;
        case "ref":
          return payment.purchase?.purchase_no || "";
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

  const totalAmount = rows.reduce((sum, p) => sum + (p.amount || 0), 0);

  const selectedSupplierNames =
    selectedSuppliers.length > 0
      ? suppliers
          .filter((s) => selectedSuppliers.includes(s.id))
          .map((s) => s.name)
          .join(", ")
      : "All Suppliers";

  const filteredSuppliers = suppliers.filter(
    (supplier) =>
      supplier.name.toLowerCase().includes(partySearch.toLowerCase()) ||
      supplier.phone?.toLowerCase().includes(partySearch.toLowerCase()) ||
      supplier.city?.toLowerCase().includes(partySearch.toLowerCase())
  );

  const exportToPDF = () => {
    downloadReportPdf({
      title: "Payment Out Report",
      filename: `payment_out_report_${format(new Date(startDate), "yyyyMMdd")}_to_${format(new Date(endDate), "yyyyMMdd")}.pdf`,
      orientation: "landscape",
      meta: [
        { label: "Suppliers", value: selectedSupplierNames },
        { label: "Period", value: formatPdfPeriod(startDate, endDate) },
        { label: "Entries", value: String(rows.length) },
      ],
      summary: [
        {
          label: "Total Paid",
          value: formatPdfAmount(totalAmount),
          emphasize: true,
        },
        { label: "Payments", value: String(rows.length) },
      ],
      columns: [
        { header: "Date", width: 26, align: "center" },
        { header: "Supplier", align: "left" },
        { header: "Amount", width: 30, align: "right" },
        { header: "Type", width: 28, align: "center" },
        { header: "Description" },
        { header: "Cheque Date", width: 28, align: "center" },
        { header: "Bill / Ref", width: 28, align: "center" },
      ],
      rows: rows.map((payment) => [
        formatPdfDate(paymentDate(payment)),
        supplierName(payment) || "—",
        formatPdfAmount(payment.amount, { prefix: false }),
        payment.type || "—",
        payment.description || "—",
        payment.cheque_date ? formatPdfDate(payment.cheque_date) : "—",
        payment.purchase?.purchase_no || "—",
      ]),
      foot: [
        "",
        "Total",
        formatPdfAmount(totalAmount, { prefix: false }),
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
      "Supplier",
      "Amount",
      "Type",
      "Description",
      "Cheque Date",
      "Bill / Ref",
    ];
    const csvContent = [
      headers.join(","),
      ...rows.map((payment) =>
        [
          format(new Date(paymentDate(payment)), "yyyy-MM-dd"),
          `"${supplierName(payment)}"`,
          payment.amount ?? 0,
          `"${payment.type || ""}"`,
          `"${(payment.description || "").replace(/"/g, '""')}"`,
          payment.cheque_date
            ? format(new Date(payment.cheque_date), "yyyy-MM-dd")
            : "",
          `"${payment.purchase?.purchase_no || ""}"`,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `payment_out_report_${format(new Date(), "yyyy-MM-dd")}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <ReportLayout
      title="Payment Out Report"
      description="Payments made to suppliers"
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
            <Popover open={supplierOpen} onOpenChange={setSupplierOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={supplierOpen}
                  className="w-[240px] justify-between"
                >
                  {selectedSuppliers.length > 0
                    ? `${selectedSuppliers.length} supplier(s) selected`
                    : "All suppliers"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[240px] p-0">
                <Command>
                  <CommandInput
                    placeholder="Search suppliers..."
                    value={partySearch}
                    onValueChange={setPartySearch}
                  />
                  <CommandEmpty>No suppliers found.</CommandEmpty>
                  <CommandGroup className="max-h-64 overflow-auto">
                    {filteredSuppliers.map((supplier) => (
                      <CommandItem
                        key={supplier.id}
                        onSelect={() => {
                          setSelectedSuppliers((prev) =>
                            prev.includes(supplier.id)
                              ? prev.filter((id) => id !== supplier.id)
                              : [...prev, supplier.id]
                          );
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedSuppliers.includes(supplier.id)
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

        {selectedSuppliers.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedSuppliers.map((supplierId) => {
              const supplier = suppliers.find((s) => s.id === supplierId);
              return supplier ? (
                <Badge
                  key={supplierId}
                  variant="secondary"
                  className="flex items-center gap-1"
                >
                  {supplier.name}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() =>
                      setSelectedSuppliers((prev) =>
                        prev.filter((id) => id !== supplierId)
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
              <div className="bg-sidebar/5 rounded-lg p-4 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex justify-between items-center md:flex-col md:items-start md:gap-1">
                  <span className="text-sm text-muted-foreground">
                    Total Paid
                  </span>
                  <span className="font-semibold text-red-600">
                    {formatAmount(totalAmount)}
                  </span>
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
                      label="Supplier"
                      sortKey="supplier"
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
                      label="Description"
                      sortKey="description"
                      sort={sort}
                      onSort={toggleSort}
                      className={sortableHeadClass}
                    />
                    <SortableHeader
                      label="Cheque Date"
                      sortKey="cheque_date"
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
                            {supplierName(payment) || "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatAmount(payment.amount)}
                          </TableCell>
                          <TableCell className="capitalize">
                            {payment.type || "—"}
                          </TableCell>
                          <TableCell className="max-w-[220px] truncate">
                            {payment.description || "—"}
                          </TableCell>
                          <TableCell>
                            {payment.cheque_date
                              ? format(
                                  new Date(payment.cheque_date),
                                  "dd MMM yyyy"
                                )
                              : "—"}
                          </TableCell>
                          <TableCell>
                            {payment.purchase?.purchase_no || "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="border-t-2 border-sidebar/20">
                        <TableCell
                          colSpan={2}
                          className="text-right font-medium"
                        >
                          Total
                        </TableCell>
                        <TableCell className="text-right font-semibold text-red-600">
                          {formatAmount(totalAmount)}
                        </TableCell>
                        <TableCell colSpan={4}></TableCell>
                      </TableRow>
                    </>
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        No payment out data found
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

export default PaymentOutReport;
