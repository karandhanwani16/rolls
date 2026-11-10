import { useState, useEffect, useMemo } from "react";
import ReportLayout from "@/components/reports/ReportLayout";
import { purchaseReturnsAPI, suppliersAPI } from "@/services/api";
import { useToast } from "@/components/ui/use-toast";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { Loader2, Download, FileText, FileSpreadsheet, Check, ChevronsUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { downloadReportPdf, formatPdfAmount, formatPdfDate, formatPdfPeriod } from "@/lib/reportPdf";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTableControls } from "@/hooks/useTableControls";
import { SortableHeader } from "@/components/ui/sortable-header";

const sortableHeadClass =
  "text-white [&_button]:text-white [&_button]:hover:text-white";

const formatAmount = (amount: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(amount);

const PurchaseReturnReport = () => {
  const [returns, setReturns] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    suppliersAPI.getAll().then(setSuppliers).catch(() =>
      toast({ title: "Error", description: "Failed to fetch suppliers", variant: "destructive" })
    );
    fetchReturns();
  }, []);

  const fetchReturns = async () => {
    try {
      setLoading(true);
      const response = await purchaseReturnsAPI.getAll();
      setReturns(response.data || []);
    } catch {
      toast({ title: "Error", description: "Failed to fetch purchase returns", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(
    () =>
      returns.filter((row) => {
        const d = new Date(row.date);
        const inRange = d >= new Date(startDate) && d <= new Date(endDate + "T23:59:59");
        const matchSupplier = selectedSuppliers.length === 0 || selectedSuppliers.includes(row.supplier_id);
        return inRange && matchSupplier;
      }),
    [returns, selectedSuppliers, startDate, endDate]
  );

  const getSortValue = useMemo(
    () => (row: any, key: string) => {
      switch (key) {
        case "return_no":
          return row.return_no;
        case "party":
          return row.supplier_name;
        case "date":
          return row.date ? new Date(row.date) : null;
        case "total":
          return row.total;
        default:
          return null;
      }
    },
    []
  );

  const { sort, toggleSort, rows } = useTableControls({
    data: filtered,
    getSortValue,
    defaultSort: { key: "date", direction: "desc" },
  });

  const exportToCSV = () => {
    const csv = [
      ["Return No", "Supplier", "Date", "Total", "Description"].join(","),
      ...rows.map((row) =>
        [`"${row.return_no}"`, `"${row.supplier_name}"`, format(new Date(row.date), "yyyy-MM-dd"), row.total, `"${row.description || ""}"`].join(",")
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `purchase_return_report_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  };

  const filteredSuppliers = suppliers.filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const total = rows.reduce((sum, row) => sum + (row.total || 0), 0);

  const exportToPDF = () => {
    const selectedSupplierNames = selectedSuppliers.length > 0
      ? suppliers.filter((s) => selectedSuppliers.includes(s.id)).map((s) => s.name).join(", ")
      : "All Suppliers";

    downloadReportPdf({
      title: "Purchase Return Report",
      filename: `purchase_return_report_${format(new Date(), "yyyy-MM-dd")}.pdf`,
      meta: [
        { label: "Suppliers", value: selectedSupplierNames },
        { label: "Period", value: formatPdfPeriod(startDate, endDate) },
        { label: "Returns", value: String(rows.length) },
      ],
      summary: [
        { label: "Total Returns", value: formatPdfAmount(total), emphasize: true },
        { label: "Number of Returns", value: String(rows.length) },
      ],
      columns: [
        { header: "Return No", width: 32, align: "center" },
        { header: "Supplier", align: "left" },
        { header: "Date", width: 28, align: "center" },
        { header: "Total", width: 36, align: "right" },
      ],
      rows: rows.map((row) => [
        row.return_no || "—",
        row.supplier_name || "—",
        formatPdfDate(row.date),
        formatPdfAmount(row.total, { prefix: false }),
      ]),
      foot: ["", "", "Total", formatPdfAmount(total, { prefix: false })],
    });
  };

  return (
    <ReportLayout title="Purchase Return Report" description="View and export purchase returns">
      <div className="flex flex-col space-y-4">
        <div className="flex flex-wrap gap-4">
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-[180px]" />
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-[180px]" />
          <Popover open={supplierOpen} onOpenChange={setSupplierOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" className="w-[240px] justify-between">
                {selectedSuppliers.length > 0 ? `${selectedSuppliers.length} supplier(s)` : "Select suppliers..."}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[240px] p-0">
              <Command>
                <CommandInput placeholder="Search suppliers..." value={searchQuery} onValueChange={setSearchQuery} />
                <CommandEmpty>No suppliers found.</CommandEmpty>
                <CommandGroup>
                  {filteredSuppliers.map((supplier) => (
                    <CommandItem
                      key={supplier.id}
                      onSelect={() =>
                        setSelectedSuppliers((prev) =>
                          prev.includes(supplier.id) ? prev.filter((id) => id !== supplier.id) : [...prev, supplier.id]
                        )
                      }
                    >
                      <Check className={cn("mr-2 h-4 w-4", selectedSuppliers.includes(supplier.id) ? "opacity-100" : "opacity-0")} />
                      {supplier.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" /> Export</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportToPDF}><FileText className="mr-2 h-4 w-4" /> PDF</DropdownMenuItem>
              <DropdownMenuItem onClick={exportToCSV}><FileSpreadsheet className="mr-2 h-4 w-4" /> CSV</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {selectedSuppliers.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedSuppliers.map((id) => {
              const supplier = suppliers.find((s) => s.id === id);
              return supplier ? (
                <Badge key={id} variant="secondary" className="flex items-center gap-1">
                  {supplier.name}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedSuppliers((prev) => prev.filter((s) => s !== id))} />
                </Badge>
              ) : null;
            })}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
        ) : (
          <>
            <div className="bg-sidebar/5 rounded-lg p-4 flex justify-between">
              <span className="text-sm text-muted-foreground">Total Purchase Returns</span>
              <span className="font-medium">{formatAmount(total)}</span>
            </div>
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader className="bg-sidebar">
                  <TableRow>
                    <SortableHeader label="Return No" sortKey="return_no" sort={sort} onSort={toggleSort} className={sortableHeadClass} />
                    <SortableHeader label="Supplier" sortKey="party" sort={sort} onSort={toggleSort} className={sortableHeadClass} />
                    <SortableHeader label="Date" sortKey="date" sort={sort} onSort={toggleSort} className={sortableHeadClass} />
                    <SortableHeader label="Total" sortKey="total" sort={sort} onSort={toggleSort} className={sortableHeadClass} />
                    <TableHead className="text-white">Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length > 0 ? (
                    <>
                      {rows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">{row.return_no}</TableCell>
                          <TableCell>{row.supplier_name}</TableCell>
                          <TableCell>{format(new Date(row.date), "dd MMM yyyy")}</TableCell>
                          <TableCell>{formatAmount(row.total)}</TableCell>
                          <TableCell>{row.description || "-"}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="border-t-2">
                        <TableCell colSpan={3} className="text-right font-medium">Total</TableCell>
                        <TableCell className="font-medium">{formatAmount(total)}</TableCell>
                        <TableCell />
                      </TableRow>
                    </>
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">No purchase returns found</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>
    </ReportLayout>
  );
};

export default PurchaseReturnReport;
