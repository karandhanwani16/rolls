import { useState, useEffect, useMemo } from "react";
import { useToast } from "@/components/ui/use-toast";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format as formatDate } from "date-fns";
import {
  Download,
  FileText
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover as CommandPopover,
  PopoverContent as CommandPopoverContent,
  PopoverTrigger as CommandPopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { stockReportAPI, productsAPI } from "@/services/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { downloadReportPdf } from "@/lib/reportPdf";
import { useTableControls, uniqueOptions } from "@/hooks/useTableControls";
import { SortableHeader } from "@/components/ui/sortable-header";
import { TableToolbar } from "@/components/ui/table-toolbar";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  color: string | null;
  width: string | null;
}

interface StockItem {
  srNo: number;
  product_name: string;
  roll_no: string;
  shade?: string;
  meters: number;
  unit?: string;
  price: number;
  godown: string;
}

const StockReport = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [stockData, setStockData] = useState<StockItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const [productOpen, setProductOpen] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    fetchStockData();
  }, [selectedProducts]);


  const fetchProducts = async () => {
    try {
      const response = await productsAPI.getAll();
      setProducts(response);
    } catch (error) {
      console.error("Error fetching products:", error);
      toast({
        title: "Error",
        description: "Failed to load products",
        variant: "destructive",
      });
    }
  };

  const fetchStockData = async () => {

    setLoading(true);
    try {
      const response = await stockReportAPI.getStockData(
        selectedProducts.map(p => p.id)
      );
      setStockData(response.data || []);
    } catch (error) {
      console.error("Error fetching stock data:", error);
      toast({
        title: "Error",
        description: "Failed to load stock data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const searchFns = useMemo(
    () => [
      (item: StockItem) => item.product_name,
      (item: StockItem) => item.roll_no,
      (item: StockItem) => item.shade,
      (item: StockItem) => item.godown,
      (item: StockItem) => item.meters,
    ],
    []
  );

  const getSortValue = useMemo(
    () => (item: StockItem, key: string) => {
      switch (key) {
        case "product_name":
          return item.product_name;
        case "roll_no":
          return item.roll_no;
        case "shade":
          return item.shade || "";
        case "meters":
          return item.meters;
        case "godown":
          return item.godown;
        default:
          return null;
      }
    },
    []
  );

  const filters = useMemo(
    () => [
      {
        key: "godown",
        label: "Godown",
        options: uniqueOptions(stockData.map((item) => item.godown)),
        predicate: (item: StockItem, value: string) => item.godown === value,
      },
    ],
    [stockData]
  );

  const {
    searchTerm,
    setSearchTerm,
    sort,
    toggleSort,
    setFilter,
    clearFilters,
    hasActiveFilters,
    filterDefs,
    rows,
  } = useTableControls({
    data: stockData,
    searchFns,
    getSortValue,
    filters,
    defaultSort: { key: "product_name", direction: "asc" },
  });

  const handleExport = async (format: 'pdf' | 'csv' | 'xlsx') => {

    try {
      if (format === 'pdf') {
        const productLabel = selectedProducts.length > 0
          ? selectedProducts.map((p) => p.name).join(", ")
          : "All Products";
        const exportRows = rows.length ? rows : stockData;

        downloadReportPdf({
          title: "Stock Report",
          filename: `stock-report-${formatDate(new Date(), "yyyy-MM-dd")}.pdf`,
          orientation: "landscape",
          meta: [
            { label: "Products", value: productLabel },
            { label: "As of", value: formatDate(new Date(), "dd/MM/yyyy") },
            { label: "Rolls", value: String(exportRows.length) },
          ],
          summary: [
            { label: "Total Rolls", value: String(exportRows.length), emphasize: true },
          ],
          columns: [
            { header: "Sr.", width: 16, align: "center" },
            { header: "Product Name", align: "left" },
            { header: "Roll No.", width: 32, align: "center" },
            { header: "Shade", width: 32 },
            { header: "Quantity", width: 32, align: "right" },
            { header: "Godown", width: 40 },
          ],
          rows: exportRows.map((item, index) => [
            index + 1,
            item.product_name || "—",
            item.roll_no || "—",
            item.shade || "—",
            `${item.meters} ${item.unit || "m"}`,
            item.godown || "—",
          ]),
        });
      } else {
        // Handle other export formats (CSV, XLSX)
        const response = await fetch(`/api/stock/export/${format}?${new URLSearchParams({
          productIds: selectedProducts.map(p => p.id).join(',')
        })}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error('Export failed');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `stock-report.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }

      toast({
        title: "Success",
        description: `Stock report exported as ${format.toUpperCase()}`,
      });
    } catch (error) {
      console.error('Error exporting data:', error);
      toast({
        title: 'Export Failed',
        description: 'Failed to export stock data. Please try again.',
        variant: 'destructive'
      });
    }
  };


  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Stock Report</h1>
            <p className="text-muted-foreground">View and analyze stock details</p>
          </div>

        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        ) : (
          <Card>
            <CardHeader>
              <TableToolbar
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                searchPlaceholder="Search by product, roll, shade, or godown"
                filters={filterDefs}
                onFilterChange={setFilter}
                onClear={clearFilters}
                hasActiveFilters={hasActiveFilters}
              >
                <CommandPopover open={productOpen} onOpenChange={setProductOpen}>
                  <CommandPopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={productOpen}
                      className="w-[240px] justify-between"
                    >
                      {selectedProducts.length > 0
                        ? `${selectedProducts.length} product(s) selected`
                        : "Select products..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </CommandPopoverTrigger>
                  <CommandPopoverContent className="w-[240px] p-0">
                    <Command>
                      <CommandInput placeholder="Search products..." />
                      <CommandEmpty>No products found.</CommandEmpty>
                      <CommandGroup>
                        {products && products.map((product) => (
                          <CommandItem
                            key={product.id}
                            onSelect={() => {
                              setSelectedProducts((current) =>
                                current.some((p) => p.id === product.id)
                                  ? current.filter((p) => p.id !== product.id)
                                  : [...current, product]
                              );
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedProducts.some((p) => p.id === product.id)
                                  ? "opacity-100"
                                  : "opacity-0"
                              )}
                            />
                            {product.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </CommandPopoverContent>
                </CommandPopover>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Download className="mr-2 h-4 w-4" />
                      Export
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleExport('pdf')}>
                      <FileText className="mr-2 h-4 w-4" />
                      Export as PDF
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableToolbar>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader className="bg-sidebar ">
                  <TableRow>
                    <TableHead className="text-white rounded-tl-lg rounded-bl-lg">Sr. No.</TableHead>
                    <SortableHeader
                      label="Product Name"
                      sortKey="product_name"
                      sort={sort}
                      onSort={toggleSort}
                      className="text-white [&_button]:text-white [&_button]:hover:text-white"
                    />
                    <SortableHeader
                      label="Roll No."
                      sortKey="roll_no"
                      sort={sort}
                      onSort={toggleSort}
                      className="text-white [&_button]:text-white [&_button]:hover:text-white"
                    />
                    <SortableHeader
                      label="Shade"
                      sortKey="shade"
                      sort={sort}
                      onSort={toggleSort}
                      className="text-white [&_button]:text-white [&_button]:hover:text-white"
                    />
                    <SortableHeader
                      label="Quantity"
                      sortKey="meters"
                      sort={sort}
                      onSort={toggleSort}
                      className="text-white [&_button]:text-white [&_button]:hover:text-white"
                    />
                    <SortableHeader
                      label="Godown"
                      sortKey="godown"
                      sort={sort}
                      onSort={toggleSort}
                      className="text-white rounded-tr-lg rounded-br-lg [&_button]:text-white [&_button]:hover:text-white"
                    />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((item, index) => (
                    <TableRow className="hover:bg-sidebar/10 hover:cursor-pointer" key={index}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{item.product_name}</TableCell>
                      <TableCell>{item.roll_no}</TableCell>
                      <TableCell>{item.shade || "-"}</TableCell>
                      <TableCell>{item.meters} {item.unit || "m"}</TableCell>
                      <TableCell>{item.godown}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default StockReport;
