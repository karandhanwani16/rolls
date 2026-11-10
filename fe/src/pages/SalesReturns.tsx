import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, Edit, Trash2, Undo2 } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/use-toast";
import { salesReturnsAPI } from "@/services/api";
import { useTableControls, uniqueOptions } from "@/hooks/useTableControls";
import { SortableHeader } from "@/components/ui/sortable-header";
import { TableToolbar } from "@/components/ui/table-toolbar";

const SalesReturns = () => {
  const navigate = useNavigate();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["sales-returns"],
    queryFn: async () => {
      const response = await salesReturnsAPI.getAll();
      return response.data;
    },
  });

  const searchFns = useMemo(
    () => [
      (item: any) => item.return_no,
      (item: any) => item.customer_name,
      (item: any) => item.description,
    ],
    []
  );

  const getSortValue = useMemo(
    () => (item: any, key: string) => {
      switch (key) {
        case "return_no":
          return item.return_no;
        case "customer_name":
          return item.customer_name;
        case "date":
          return item.date ? new Date(item.date) : null;
        case "total":
          return item.total;
        case "rolls":
          return item.items?.length ?? 0;
        default:
          return null;
      }
    },
    []
  );

  const filters = useMemo(
    () => [
      {
        key: "customer_name",
        label: "Customer",
        options: uniqueOptions((data || []).map((item: any) => item.customer_name)),
        predicate: (item: any, value: string) => item.customer_name === value,
      },
    ],
    [data]
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
    data,
    searchFns,
    getSortValue,
    filters,
    defaultSort: { key: "date", direction: "desc" },
  });

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await salesReturnsAPI.delete(deleteId);
      toast({ title: "Sales return deleted" });
      refetch();
    } catch {
      toast({ title: "Error", description: "Failed to delete sales return", variant: "destructive" });
    } finally {
      setDeleteId(null);
    }
  };

  if (error) {
    return (
      <DashboardLayout>
        <div className="p-4 text-red-500">Error loading sales returns.</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
              <Undo2 className="h-6 w-6" /> Sales Returns
            </h1>
            <p className="text-muted-foreground">Goods returned by customers</p>
          </div>
          <Button className="mt-4 md:mt-0" onClick={() => navigate("/sales-returns/new")}>
            <Plus className="mr-2 h-4 w-4" /> New Sales Return
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Sales Return Records</CardTitle>
              <CardDescription>
                {isLoading ? "Loading..." : `${rows.length} returns found`}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <TableToolbar
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              searchPlaceholder="Search returns..."
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
                      label="Return #"
                      sortKey="return_no"
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
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-6">Loading...</TableCell>
                    </TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-6">
                        No sales returns found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.return_no}</TableCell>
                        <TableCell>{item.customer_name}</TableCell>
                        <TableCell>{format(new Date(item.date), "dd MMM yyyy")}</TableCell>
                        <TableCell className="text-right">{item.items?.length ?? 0}</TableCell>
                        <TableCell className="text-right">₹{item.total.toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate">{item.description || "-"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="icon" onClick={() => navigate(`/sales-returns/edit/${item.id}`)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="icon" onClick={() => setDeleteId(item.id)}>
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

        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Sales Return</AlertDialogTitle>
              <AlertDialogDescription>
                This will put returned stock back to sold status. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
};

export default SalesReturns;
