import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { salesAPI } from "@/services/api";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  ShoppingBag,
  Plus,
  MoreVertical,
  Eye,
  Trash2,
  Printer,
  FileText,
} from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { printSaleDocument } from "@/lib/downloadSalePdf";
import { InterestNotePrintDialog } from "@/components/sales/InterestNotePrintDialog";
import { useTableControls } from "@/hooks/useTableControls";
import { SortableHeader } from "@/components/ui/sortable-header";
import { TableToolbar } from "@/components/ui/table-toolbar";

const Sales = () => {
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast: toastNotification } = useToast();
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [interestDialogOpen, setInterestDialogOpen] = useState(false);
  const [pendingBillPrint, setPendingBillPrint] = useState<{
    id: string;
    salesNo: string;
    creditDays: number;
  } | null>(null);

  useEffect(() => {
    fetchSales();
  }, []);

  const fetchSales = async () => {
    try {
      setLoading(true);
      const response = await salesAPI.getAll();
      setSales(response.data || []);
    } catch (error) {
      console.error("Error fetching sales:", error);
      toastNotification({
        title: "Error",
        description: "Failed to fetch sales data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSale = async (id: string) => {
    try {
      await salesAPI.delete(id);
      toast.success("Sale deleted successfully");
      fetchSales();
    } catch (error) {
      console.error("Error deleting sale:", error);
      toast.error("Failed to delete sale");
    }
  };

  const handleViewSale = async (id: string) => {
    try {
      const response = await salesAPI.getById(id);
      setSelectedSale(response);
      setViewDialogOpen(true);
    } catch (error) {
      console.error("Error fetching sale details:", error);
      toast.error("Failed to fetch sale details");
    }
  };

  const handleDownloadDocument = async (
    id: string,
    type: "bill" | "challan"
  ) => {
    const sale = sales.find((s) => s.id === id) || selectedSale;
    if (!sale) {
      toast.error("Sale not found");
      return;
    }

    if (type === "bill") {
      setPendingBillPrint({
        id,
        salesNo: sale.sales_no,
        creditDays: sale.credit_days || sale.customer?.credit_days || 0,
      });
      setInterestDialogOpen(true);
      return;
    }

    try {
      toast.info("Opening challan print dialog...");
      await printSaleDocument(id, sale.sales_no, type);
    } catch (error) {
      console.error("Error printing document:", error);
      toast.error("Failed to print challan");
    }
  };

  const handleConfirmBillPrint = async (showInterestNote: boolean) => {
    if (!pendingBillPrint) return;
    const { id, salesNo } = pendingBillPrint;
    setInterestDialogOpen(false);
    setPendingBillPrint(null);

    try {
      toast.info("Opening sales bill print dialog...");
      await printSaleDocument(id, salesNo, "bill", { showInterestNote });
    } catch (error) {
      console.error("Error printing document:", error);
      toast.error("Failed to print sales bill");
    }
  };

  const searchFns = useMemo(
    () => [
      (sale: any) => sale.sales_no,
      (sale: any) => sale.customer_name,
      (sale: any) => sale.description,
    ],
    []
  );

  const getSortValue = useMemo(
    () => (sale: any, key: string) => {
      switch (key) {
        case "sales_no":
          return sale.sales_no;
        case "customer_name":
          return sale.customer_name;
        case "date":
          return sale.date ? new Date(sale.date) : null;
        case "total":
          return sale.total;
        case "remaining_amount":
          return (
            sale.remaining_amount ??
            (sale.payment_status === "FULL" ? 0 : sale.total)
          );
        case "overdue_days":
          return sale.overdue_days ?? 0;
        case "rolls":
          return sale.items?.length ?? 0;
        default:
          return null;
      }
    },
    []
  );

  const filters = useMemo(
    () => [
      {
        key: "payment_status",
        label: "Payment Status",
        options: [
          { value: "paid", label: "Paid" },
          { value: "outstanding", label: "Outstanding" },
        ],
        predicate: (sale: any, value: string) => {
          if (value === "paid") return sale.payment_status === "FULL";
          if (value === "outstanding") return sale.payment_status !== "FULL";
          return true;
        },
      },
      {
        key: "overdue",
        label: "Overdue",
        options: [{ value: "overdue", label: "Overdue" }],
        predicate: (sale: any, value: string) => {
          if (value === "overdue") {
            return (sale.overdue_days || 0) > 0 && sale.payment_status !== "FULL";
          }
          return true;
        },
      },
    ],
    []
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
    data: sales,
    searchFns,
    getSortValue,
    filters,
    defaultSort: { key: "date", direction: "desc" },
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center">
            <ShoppingBag className="mr-2" /> Sales
          </h1>
          <Button onClick={() => navigate("/sales/new")}>
            <Plus className="mr-1 h-4 w-4" /> New Sale
          </Button>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm">
          <TableToolbar
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder="Search sales..."
            filters={filterDefs}
            onFilterChange={setFilter}
            onClear={clearFilters}
            hasActiveFilters={hasActiveFilters}
          />

          {loading ? (
            <div className="flex justify-center items-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800"></div>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHeader
                      label="Sale No."
                      sortKey="sales_no"
                      sort={sort}
                      onSort={toggleSort}
                    />
                    <SortableHeader
                      label="Customer"
                      sortKey="customer_name"
                      sort={sort}
                      onSort={toggleSort}
                    />
                    <SortableHeader
                      label="Date"
                      sortKey="date"
                      sort={sort}
                      onSort={toggleSort}
                    />
                    <SortableHeader
                      label="Rolls"
                      sortKey="rolls"
                      sort={sort}
                      onSort={toggleSort}
                      align="right"
                      className="text-right"
                    />
                    <SortableHeader
                      label="Amount"
                      sortKey="total"
                      sort={sort}
                      onSort={toggleSort}
                      align="right"
                      className="text-right"
                    />
                    <SortableHeader
                      label="Outstanding"
                      sortKey="remaining_amount"
                      sort={sort}
                      onSort={toggleSort}
                      align="right"
                      className="text-right"
                    />
                    <SortableHeader
                      label="Overdue Days"
                      sortKey="overdue_days"
                      sort={sort}
                      onSort={toggleSort}
                      align="right"
                      className="text-right"
                    />
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length > 0 ? (
                    rows.map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell className="font-medium whitespace-nowrap">
                          {sale.sales_no}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {sale.customer_name}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(sale.date), "dd MMM yyyy")}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {sale.items?.length ?? 0}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {new Intl.NumberFormat("en-IN", {
                            style: "currency",
                            currency: "INR",
                            maximumFractionDigits: 0,
                          }).format(sale.total)}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {sale.payment_status === "FULL" ? (
                            <span className="text-green-600">Paid</span>
                          ) : (
                            new Intl.NumberFormat("en-IN", {
                              style: "currency",
                              currency: "INR",
                              maximumFractionDigits: 0,
                            }).format(sale.remaining_amount || sale.total)
                          )}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {sale.payment_status === "FULL" ? (
                            "—"
                          ) : (sale.overdue_days || 0) > 0 ? (
                            <span className="text-red-600 font-medium">
                              {sale.overdue_days} days
                            </span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[180px] truncate">
                          {sale.description || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() =>
                                    navigate(`/sales/edit/${sale.id}`)
                                  }
                                >
                                  <Eye className="mr-2 h-4 w-4" /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleViewSale(sale.id)}
                                >
                                  <Eye className="mr-2 h-4 w-4" /> View
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleDownloadDocument(sale.id, "challan")
                                  }
                                >
                                  <Printer className="mr-2 h-4 w-4" /> Print
                                  Challan
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleDownloadDocument(sale.id, "bill")
                                  }
                                >
                                  <FileText className="mr-2 h-4 w-4" /> Print
                                  Sales Bill
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDeleteSale(sale.id)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={9} className="h-24 text-center">
                        No sales found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      {/* View Sale Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 top-[5vh] translate-y-0 data-[state=open]:slide-in-from-top-[5%] data-[state=closed]:slide-out-to-top-[5%]">
          <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0 pr-12">
            <DialogTitle>
              Sale Details — {selectedSale?.sales_no || ""}
            </DialogTitle>
          </DialogHeader>
          {selectedSale && (
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Customer</p>
                  <p className="font-medium">{selectedSale.customer_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p className="font-medium">
                    {format(new Date(selectedSale.date), "dd MMM yyyy")}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Unit</p>
                  <p className="font-medium uppercase">
                    {selectedSale.unit || selectedSale.items?.[0]?.unit || "m"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Transport</p>
                  <p className="font-medium">
                    {new Intl.NumberFormat("en-IN", {
                      style: "currency",
                      currency: "INR",
                      maximumFractionDigits: 2,
                    }).format(selectedSale.transport_charges || 0)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Discount</p>
                  <p className="font-medium">
                    {new Intl.NumberFormat("en-IN", {
                      style: "currency",
                      currency: "INR",
                      maximumFractionDigits: 2,
                    }).format(selectedSale.discount || 0)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Credit Days</p>
                  <p className="font-medium">{selectedSale.credit_days ?? 0}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Overdue Days</p>
                  <p
                    className={`font-medium ${
                      (selectedSale.overdue_days || 0) > 0 ? "text-red-600" : ""
                    }`}
                  >
                    {selectedSale.payment_status === "FULL"
                      ? "—"
                      : `${selectedSale.overdue_days || 0} days`}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Outstanding</p>
                  <p className="font-medium">
                    {selectedSale.payment_status === "FULL"
                      ? "Fully Paid"
                      : new Intl.NumberFormat("en-IN", {
                          style: "currency",
                          currency: "INR",
                          maximumFractionDigits: 2,
                        }).format(
                          selectedSale.remaining_amount || selectedSale.total
                        )}
                  </p>
                </div>
                {selectedSale.description && (
                  <div className="col-span-2 md:col-span-3">
                    <p className="text-sm text-muted-foreground">Description</p>
                    <p className="font-medium">{selectedSale.description}</p>
                  </div>
                )}
              </div>

              <div>
                <h3 className="font-medium mb-2">Items</h3>
                <div className="border rounded-md overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Product</TableHead>
                        <TableHead>Roll No</TableHead>
                        <TableHead>Shade</TableHead>
                        <TableHead>Width</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead className="text-right">Rate</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedSale.items && selectedSale.items.length > 0 ? (
                        selectedSale.items.map((item: any) => (
                          <TableRow key={item.id || `${item.product_id}-${item.roll_no}`}>
                            <TableCell className="font-medium">
                              {item.product_name}
                            </TableCell>
                            <TableCell>{item.roll_no || "—"}</TableCell>
                            <TableCell>{item.shade || "—"}</TableCell>
                            <TableCell>{item.width || "—"}</TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              {(Number(item.meters) || 0).toFixed(2)}{" "}
                              {item.unit || selectedSale.unit || "m"}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              ₹{(Number(item.price) || 0).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              ₹
                              {(
                                Number(item.total_price ?? item.total) || 0
                              ).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-4">
                            No items found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
          {selectedSale && (
            <div className="shrink-0 border-t px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-background">
              <div>
                <p className="text-sm text-muted-foreground">Total Amount</p>
                <p className="text-xl font-bold">
                  {new Intl.NumberFormat("en-IN", {
                    style: "currency",
                    currency: "INR",
                    maximumFractionDigits: 0,
                  }).format(selectedSale.total)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() =>
                    handleDownloadDocument(selectedSale.id, "challan")
                  }
                >
                  <Printer className="mr-1 h-4 w-4" /> Print Challan
                </Button>
                <Button
                  onClick={() =>
                    handleDownloadDocument(selectedSale.id, "bill")
                  }
                >
                  <FileText className="mr-1 h-4 w-4" /> Print Sales Bill
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <InterestNotePrintDialog
        open={interestDialogOpen}
        onOpenChange={(open) => {
          setInterestDialogOpen(open);
          if (!open) setPendingBillPrint(null);
        }}
        creditDays={pendingBillPrint?.creditDays}
        onConfirm={handleConfirmBillPrint}
      />
    </DashboardLayout>
  );
};

export default Sales;
