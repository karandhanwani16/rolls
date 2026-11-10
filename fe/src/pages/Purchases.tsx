
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
} from "lucide-react";
import { toast as sonnerToast } from "sonner";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { purchasesAPI } from "@/services/api";
import { useTableControls } from "@/hooks/useTableControls";
import { SortableHeader } from "@/components/ui/sortable-header";
import { TableToolbar } from "@/components/ui/table-toolbar";

const formatInr = (value: number, maxFractionDigits = 2) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: maxFractionDigits,
  }).format(value || 0);

type Purchase = {
  id: string;
  supplier_id: string;
  supplier_name: string;
  date: string;
  purchase_no: string;
  total: number;
  description?: string;
  godown?: string;
  transport?: string;
  transport_charges?: number;
  received_by?: string;
  credit_days?: number;
  remaining_amount?: number;
  payment_status?: string;
  overdue_days?: number;
  items?: unknown[];
  created_at: string;
  updated_at: string;
};

const Purchases = () => {
  const navigate = useNavigate();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [purchaseToDelete, setPurchaseToDelete] = useState<string | null>(null);
  const [selectedPurchase, setSelectedPurchase] = useState<any>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);

  // Fetch purchases data
  const { 
    data: purchasesData, 
    isLoading, 
    error, 
    refetch 
  } = useQuery({
    queryKey: ['purchases'],
    queryFn: async () => {
      const response = await purchasesAPI.getAll();
      return response.data;
    }
  });

  const searchFns = useMemo(
    () => [
      (purchase: Purchase) => purchase.purchase_no,
      (purchase: Purchase) => purchase.supplier_name,
      (purchase: Purchase) => purchase.description,
    ],
    []
  );

  const getSortValue = useMemo(
    () => (purchase: Purchase, key: string) => {
      switch (key) {
        case "purchase_no":
          return purchase.purchase_no;
        case "supplier_name":
          return purchase.supplier_name;
        case "date":
          return purchase.date ? new Date(purchase.date) : null;
        case "total":
          return purchase.total;
        case "remaining_amount":
          return (
            purchase.remaining_amount ??
            (purchase.payment_status === "FULL" ? 0 : purchase.total)
          );
        case "overdue_days":
          return purchase.overdue_days ?? 0;
        case "rolls":
          return purchase.items?.length ?? 0;
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
        predicate: (purchase: Purchase, value: string) => {
          if (value === "paid") return purchase.payment_status === "FULL";
          if (value === "outstanding") return purchase.payment_status !== "FULL";
          return true;
        },
      },
      {
        key: "overdue",
        label: "Overdue",
        options: [{ value: "overdue", label: "Overdue" }],
        predicate: (purchase: Purchase, value: string) => {
          if (value === "overdue") {
            return (
              (purchase.overdue_days || 0) > 0 &&
              purchase.payment_status !== "FULL"
            );
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
    data: purchasesData,
    searchFns,
    getSortValue,
    filters,
    defaultSort: { key: "date", direction: "desc" },
  });

  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    if (!purchaseToDelete) return;
    
    try {
      await purchasesAPI.delete(purchaseToDelete);
      toast({
        title: "Purchase deleted",
        description: "The purchase has been successfully deleted.",
      });
      refetch();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete the purchase. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setPurchaseToDelete(null);
    }
  };

  const handleDelete = (id: string) => {
    setPurchaseToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleViewPurchase = async (id: string) => {
    try {
      const purchase = await purchasesAPI.getById(id);
      setSelectedPurchase(purchase);
      setViewDialogOpen(true);
    } catch (error) {
      console.error("Error fetching purchase details:", error);
      sonnerToast.error("Failed to fetch purchase details");
    }
  };

  if (error) {
    return (
      <DashboardLayout>
        <div className="p-4">
          <p className="text-red-500">Error loading purchases data. Please try again.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold mb-1">Purchases</h1>
            <p className="text-muted-foreground">Manage your purchase records</p>
          </div>
          <Button 
            className="mt-4 md:mt-0" 
            onClick={() => navigate("/purchases/new")}
          >
            <Plus className="mr-2 h-4 w-4" /> New Purchase
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Purchase Records</CardTitle>
              <CardDescription>
                {isLoading ? 'Loading...' : `${rows.length} purchases found`}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <TableToolbar
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              searchPlaceholder="Search purchases..."
              filters={filterDefs}
              onFilterChange={setFilter}
              onClear={clearFilters}
              hasActiveFilters={hasActiveFilters}
            />
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHeader
                      label="Purchase #"
                      sortKey="purchase_no"
                      sort={sort}
                      onSort={toggleSort}
                    />
                    <SortableHeader
                      label="Supplier"
                      sortKey="supplier_name"
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
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-6">
                        Loading purchases data...
                      </TableCell>
                    </TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-6">
                        No purchases found. Create your first purchase by clicking "New Purchase" above.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((purchase: Purchase) => (
                      <TableRow key={purchase.id}>
                        <TableCell className="font-medium">
                          {purchase.purchase_no}
                        </TableCell>
                        <TableCell>{purchase.supplier_name}</TableCell>
                        <TableCell>
                          {format(new Date(purchase.date), 'dd MMM yyyy')}
                        </TableCell>
                        <TableCell className="text-right">
                          {purchase.items?.length ?? 0}
                        </TableCell>
                        <TableCell className="text-right">
                          ₹{purchase.total.toLocaleString('en-IN')}
                        </TableCell>
                        <TableCell className="text-right">
                          {purchase.payment_status === "FULL" ? (
                            <span className="text-green-600">Paid</span>
                          ) : (
                            `₹${(purchase.remaining_amount ?? purchase.total).toLocaleString('en-IN')}`
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {purchase.payment_status === "FULL" ? (
                            "—"
                          ) : (purchase.overdue_days || 0) > 0 ? (
                            <span className="text-red-600 font-medium">
                              {purchase.overdue_days} days
                            </span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate">
                          {purchase.description || '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              title="View"
                              onClick={() => handleViewPurchase(purchase.id)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              title="Edit"
                              onClick={() => navigate(`/purchases/edit/${purchase.id}`)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              title="Delete"
                              onClick={() => handleDelete(purchase.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Purchase</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this purchase? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteConfirm}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* View Purchase Dialog */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 top-[5vh] translate-y-0 data-[state=open]:slide-in-from-top-[5%] data-[state=closed]:slide-out-to-top-[5%]">
            <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0 pr-12">
              <DialogTitle>
                Purchase Details — {selectedPurchase?.purchase_no || ""}
              </DialogTitle>
            </DialogHeader>
            {selectedPurchase && (
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Supplier</p>
                    <p className="font-medium">{selectedPurchase.supplier_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Date</p>
                    <p className="font-medium">
                      {format(new Date(selectedPurchase.date), "dd MMM yyyy")}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Unit</p>
                    <p className="font-medium uppercase">
                      {selectedPurchase.unit || selectedPurchase.items?.[0]?.unit || "m"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Transport</p>
                    <p className="font-medium">
                      {formatInr(selectedPurchase.transport_charges || 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Discount</p>
                    <p className="font-medium">
                      {formatInr(selectedPurchase.discount || 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Credit Days</p>
                    <p className="font-medium">{selectedPurchase.credit_days ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Overdue Days</p>
                    <p
                      className={`font-medium ${
                        (selectedPurchase.overdue_days || 0) > 0 ? "text-red-600" : ""
                      }`}
                    >
                      {selectedPurchase.payment_status === "FULL"
                        ? "—"
                        : `${selectedPurchase.overdue_days || 0} days`}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Outstanding</p>
                    <p className="font-medium">
                      {selectedPurchase.payment_status === "FULL"
                        ? "Fully Paid"
                        : formatInr(
                            selectedPurchase.remaining_amount ?? selectedPurchase.total
                          )}
                    </p>
                  </div>
                  {selectedPurchase.godown && (
                    <div>
                      <p className="text-sm text-muted-foreground">Godown</p>
                      <p className="font-medium">{selectedPurchase.godown}</p>
                    </div>
                  )}
                  {selectedPurchase.received_by && (
                    <div>
                      <p className="text-sm text-muted-foreground">Received By</p>
                      <p className="font-medium">{selectedPurchase.received_by}</p>
                    </div>
                  )}
                  {selectedPurchase.description && (
                    <div className="col-span-2 md:col-span-3">
                      <p className="text-sm text-muted-foreground">Description</p>
                      <p className="font-medium">{selectedPurchase.description}</p>
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
                        {selectedPurchase.items && selectedPurchase.items.length > 0 ? (
                          selectedPurchase.items.map((item: any) => (
                            <TableRow key={item.id || `${item.product_id}-${item.roll_no}`}>
                              <TableCell className="font-medium">
                                {item.product_name}
                              </TableCell>
                              <TableCell>{item.roll_no || "—"}</TableCell>
                              <TableCell>{item.shade || "—"}</TableCell>
                              <TableCell>{item.width || "—"}</TableCell>
                              <TableCell className="text-right whitespace-nowrap">
                                {(Number(item.meters) || 0).toFixed(2)}{" "}
                                {item.unit || selectedPurchase.unit || "m"}
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
                            <TableCell colSpan={7} className="text-center py-4">
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
            {selectedPurchase && (() => {
              const grossTotal = (selectedPurchase.items || []).reduce(
                (sum: number, item: any) =>
                  sum + (Number(item.total_price ?? item.total) || 0),
                0
              );
              const transportCharges = Number(selectedPurchase.transport_charges) || 0;
              const discount = Number(selectedPurchase.discount) || 0;
              const actualTotal = grossTotal + transportCharges - discount;
              const roundOff = Number(
                (Math.round(actualTotal) - actualTotal).toFixed(2)
              );
              const netTotal = Number(selectedPurchase.total) || Math.round(actualTotal);

              return (
                <div className="shrink-0 border-t px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-background">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-1">
                    <div>
                      <p className="text-sm text-muted-foreground">Gross Total</p>
                      <p className="text-base font-semibold">{formatInr(grossTotal)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Discount</p>
                      <p className="text-base font-semibold">{formatInr(discount)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Round Off</p>
                      <p className="text-base font-semibold">{formatInr(roundOff)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Net Total</p>
                      <p className="text-xl font-bold">{formatInr(netTotal, 0)}</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setViewDialogOpen(false);
                      navigate(`/purchases/edit/${selectedPurchase.id}`);
                    }}
                  >
                    <Edit className="mr-1 h-4 w-4" /> Edit Purchase
                  </Button>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Purchases;
