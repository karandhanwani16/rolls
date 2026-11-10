import { useState, useEffect, useMemo } from "react";
import ReportLayout from "@/components/reports/ReportLayout";
import { purchasesAPI, suppliersAPI } from "@/services/api";
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

const PurchaseOutstandingReport = () => {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(getFinancialYearStart());
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"all" | "overdue">("all");

  useEffect(() => {
    fetchSuppliers();
    fetchPurchases();
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

  const fetchPurchases = async () => {
    try {
      setLoading(true);
      const response = await purchasesAPI.getAll();
      setPurchases(response.data || []);
    } catch (error) {
      console.error("Error fetching purchases:", error);
      toast({
        title: "Error",
        description: "Failed to fetch outstanding data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const outstandingPurchases = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    return purchases.filter((purchase) => {
      const remaining = purchase.remaining_amount ?? purchase.total;
      if (purchase.payment_status === "FULL" || remaining <= 0) return false;

      const purchaseDate = new Date(purchase.date);
      const inDateRange = purchaseDate >= start && purchaseDate <= end;
      const supplierMatch =
        selectedSuppliers.length === 0 ||
        selectedSuppliers.includes(purchase.supplier_id);
      const overdueMatch =
        viewMode === "all" || (purchase.overdue_days || 0) > 0;

      return inDateRange && supplierMatch && overdueMatch;
    });
  }, [purchases, startDate, endDate, selectedSuppliers, viewMode]);

  const getSortValue = useMemo(
    () => (purchase: any, key: string) => {
      switch (key) {
        case "purchase_no":
          return purchase.purchase_no;
        case "supplier":
          return purchase.supplier_name;
        case "date":
          return purchase.date ? new Date(purchase.date) : null;
        case "credit_days":
          return purchase.credit_days ?? 0;
        case "total":
          return purchase.total;
        case "outstanding":
          return purchase.remaining_amount ?? purchase.total;
        case "elapsed_days":
          return purchase.elapsed_days ?? 0;
        case "status":
          return purchase.payment_status || "UNPAID";
        default:
          return null;
      }
    },
    []
  );

  const { sort, toggleSort, rows } = useTableControls({
    data: outstandingPurchases,
    getSortValue,
    defaultSort: { key: "elapsed_days", direction: "desc" },
  });

  const totalOutstanding = rows.reduce(
    (sum, purchase) => sum + (purchase.remaining_amount ?? purchase.total),
    0
  );
  const overdueCount = rows.filter(
    (purchase) => (purchase.overdue_days || 0) > 0
  ).length;

  const exportToCSV = () => {
    const headers = [
      "Purchase No",
      "Supplier Name",
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
      ...rows.map((purchase) =>
        [
          `"${purchase.purchase_no || ""}"`,
          `"${purchase.supplier_name || ""}"`,
          format(new Date(purchase.date), "yyyy-MM-dd"),
          purchase.credit_days || 0,
          purchase.due_date
            ? format(new Date(purchase.due_date), "yyyy-MM-dd")
            : "",
          purchase.total,
          purchase.remaining_amount ?? purchase.total,
          purchase.elapsed_days || 0,
          `"${purchase.payment_status || "UNPAID"}"`,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `purchase_outstanding_report_${format(new Date(), "yyyy-MM-dd")}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = () => {
    const selectedSupplierNames = selectedSuppliers.length > 0
      ? suppliers.filter((s) => selectedSuppliers.includes(s.id)).map((s) => s.name).join(", ")
      : "All Suppliers";

    downloadReportPdf({
      title: "Purchase Outstanding Report",
      filename: `purchase_outstanding_report_${format(new Date(startDate), "yyyyMMdd")}_to_${format(new Date(endDate), "yyyyMMdd")}.pdf`,
      orientation: "landscape",
      meta: [
        { label: "Suppliers", value: selectedSupplierNames },
        { label: "Period", value: formatPdfPeriod(startDate, endDate) },
        { label: "View", value: viewMode === "overdue" ? "Overdue Only" : "All Outstanding" },
      ],
      summary: [
        { label: "Total Outstanding", value: formatPdfAmount(totalOutstanding), emphasize: true },
        { label: "Unpaid / Partial Bills", value: String(rows.length) },
        { label: "Overdue Bills", value: String(overdueCount) },
      ],
      columns: [
        { header: "Purchase No", width: 28, align: "center" },
        { header: "Supplier", align: "left" },
        { header: "Date", width: 26, align: "center" },
        { header: "Credit Days", width: 24, align: "center" },
        { header: "Outstanding", width: 36, align: "right" },
        { header: "Elapsed", width: 22, align: "center" },
        { header: "Status", width: 28, align: "center" },
      ],
      rows: rows.map((purchase) => [
        purchase.purchase_no || "—",
        purchase.supplier_name || "—",
        formatPdfDate(purchase.date),
        String(purchase.credit_days || 0),
        formatPdfAmount(purchase.remaining_amount ?? purchase.total, { prefix: false }),
        String(purchase.elapsed_days || 0),
        purchase.payment_status || "UNPAID",
      ]),
      foot: ["", "", "", "Total", formatPdfAmount(totalOutstanding, { prefix: false }), "", ""],
    });
  };

  const filteredSuppliers = suppliers.filter(
    (supplier) =>
      supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      supplier.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      supplier.city?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <ReportLayout
      title="Purchase Outstanding Report"
      description="Unpaid and partially paid purchase bills with days elapsed since purchase date. Payments out and returns are applied oldest bill first."
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
                    value={searchQuery}
                    onValueChange={setSearchQuery}
                  />
                  <CommandEmpty>No suppliers found.</CommandEmpty>
                  <CommandGroup>
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
                      label="Purchase No"
                      sortKey="purchase_no"
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
                      {rows.map((purchase) => (
                        <TableRow key={purchase.id} className="hover:bg-sidebar/10">
                          <TableCell className="font-medium">
                            {purchase.purchase_no}
                          </TableCell>
                          <TableCell>{purchase.supplier_name}</TableCell>
                          <TableCell>
                            {format(new Date(purchase.date), "dd MMM yyyy")}
                          </TableCell>
                          <TableCell className="text-right">
                            {purchase.credit_days ?? 0}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatAmount(purchase.total)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatAmount(purchase.remaining_amount ?? purchase.total)}
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={
                                (purchase.overdue_days || 0) > 0
                                  ? "text-red-600 font-medium"
                                  : "text-green-600 font-medium"
                              }
                            >
                              {purchase.elapsed_days ?? 0}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                purchase.payment_status === "PARTIAL"
                                  ? "secondary"
                                  : "destructive"
                              }
                            >
                              {purchase.payment_status || "UNPAID"}
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

export default PurchaseOutstandingReport;
