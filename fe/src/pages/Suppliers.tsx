import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { CurrencyInput } from "@/components/ui/currency-input";
import { SortableHeader } from "@/components/ui/sortable-header";
import { TableToolbar } from "@/components/ui/table-toolbar";
import { FileText, Plus, Phone, MapPin, Edit, Trash, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { suppliersAPI } from "@/services/api";
import { useTableControls, uniqueOptions } from "@/hooks/useTableControls";

// Supplier type definition
type Supplier = {
  id: string;
  name: string;
  phone: string | null;
  description: string | null;
  city: string | null;
  opening_balance: number;
  opening_balance_date: string | null;
  credit_days: number;
  created_at: string;
  updated_at: string;
};

// Supplier form schema
const supplierFormSchema = z.object({
  name: z.string().min(1, "Supplier name is required"),
  phone: z.string().nullable(),
  description: z.string().nullable(),
  city: z.string().nullable(),
  opening_balance: z.coerce.number().default(0),
  opening_balance_date: z.string().nullable(),
  credit_days: z.coerce.number().int().min(0).default(0),
}).refine(
  (data) => data.opening_balance === 0 || (data.opening_balance_date && data.opening_balance_date.length > 0),
  {
    message: "Opening balance date is required when opening balance is set",
    path: ["opening_balance_date"],
  }
);

type SupplierFormValues = z.infer<typeof supplierFormSchema>;

const Suppliers = () => {
  const { user } = useAuth();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierFormSchema),
    defaultValues: {
      name: "",
      phone: "",
      description: "",
      city: "",
      opening_balance: 0,
      opening_balance_date: "",
      credit_days: 0,
    },
  });

  const editForm = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierFormSchema),
    defaultValues: {
      name: "",
      phone: "",
      description: "",
      city: "",
      opening_balance: 0,
      opening_balance_date: "",
      credit_days: 0,
    },
  });

  useEffect(() => {
    if (!isAddDialogOpen) {
      form.reset();
    }
  }, [isAddDialogOpen, form]);

  useEffect(() => {
    if (selectedSupplier && isEditDialogOpen) {
      editForm.reset({
        name: selectedSupplier.name,
        phone: selectedSupplier.phone,
        description: selectedSupplier.description,
        city: selectedSupplier.city,
        opening_balance: selectedSupplier.opening_balance ?? 0,
        opening_balance_date: selectedSupplier.opening_balance_date
          ? selectedSupplier.opening_balance_date.slice(0, 10)
          : "",
        credit_days: selectedSupplier.credit_days ?? 0,
      });
    }
  }, [selectedSupplier, isEditDialogOpen, editForm]);

  const {
    data: suppliers,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      if (!user) {
        throw new Error("User not authenticated");
      }
      return suppliersAPI.getAll();
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (error) {
      toast({
        title: "Error fetching suppliers",
        description: (error as Error).message,
        variant: "destructive",
      });
    }
  }, [error, toast]);

  const searchFns = useMemo(
    () => [
      (item: Supplier) => item.name,
      (item: Supplier) => item.phone,
      (item: Supplier) => item.city,
      (item: Supplier) => item.description,
    ],
    []
  );

  const getSortValue = useMemo(
    () => (item: Supplier, key: string) => {
      switch (key) {
        case "name":
          return item.name;
        case "phone":
          return item.phone;
        case "city":
          return item.city;
        case "opening_balance":
          return item.opening_balance;
        case "credit_days":
          return item.credit_days;
        default:
          return null;
      }
    },
    []
  );

  const filters = useMemo(
    () => [
      {
        key: "city",
        label: "City",
        options: uniqueOptions(suppliers?.map((i) => i.city) || []),
        predicate: (item: Supplier, value: string) => item.city === value,
      },
    ],
    [suppliers]
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
    data: suppliers,
    searchFns,
    getSortValue,
    filters,
    defaultSort: { key: "name", direction: "asc" },
  });

  const onSubmit = async (values: SupplierFormValues) => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "You must be logged in to perform this action",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const backendData = {
        supplier_name: values.name,
        supplier_phone: values.phone,
        supplier_description: values.description,
        supplier_city: values.city,
        opening_balance: values.opening_balance,
        opening_balance_date: values.opening_balance_date || null,
        credit_days: values.credit_days || 0,
      };
      await suppliersAPI.create(backendData);
      toast({
        title: "Supplier added",
        description: "The supplier has been added successfully.",
      });
      setIsAddDialogOpen(false);
      refetch();
    } catch (error) {
      toast({
        title: "Error adding supplier",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const onEditSubmit = async (values: SupplierFormValues) => {
    if (!selectedSupplier || !user) {
      toast({
        title: "Error",
        description: "Invalid supplier selected or authentication required",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const backendData = {
        supplier_name: values.name,
        supplier_phone: values.phone,
        supplier_description: values.description,
        supplier_city: values.city,
        opening_balance: values.opening_balance,
        opening_balance_date: values.opening_balance_date || null,
        credit_days: values.credit_days || 0,
      };
      await suppliersAPI.update(selectedSupplier.id, backendData);
      toast({
        title: "Supplier updated",
        description: "The supplier has been updated successfully.",
      });
      setIsEditDialogOpen(false);
      setSelectedSupplier(null);
      refetch();
    } catch (error) {
      toast({
        title: "Error updating supplier",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedSupplier || !user) {
      toast({
        title: "Error",
        description: "Invalid supplier selected or authentication required",
        variant: "destructive",
      });
      return;
    }

    setIsDeleting(true);
    try {
      await suppliersAPI.delete(selectedSupplier.id);
      toast({
        title: "Supplier deleted",
        description: "The supplier has been deleted successfully.",
      });
      setIsDeleteDialogOpen(false);
      setSelectedSupplier(null);
      refetch();
    } catch (error) {
      toast({
        title: "Error deleting supplier",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center">
            <FileText className="mr-2" /> Suppliers
          </h1>
          <Button
            className="bg-brand-teal hover:bg-teal-700"
            onClick={() => setIsAddDialogOpen(true)}
          >
            <Plus className="mr-1 h-4 w-4" /> Add Supplier
          </Button>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm">
          <TableToolbar
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder="Search suppliers..."
            filters={filterDefs}
            onFilterChange={setFilter}
            onClear={clearFilters}
            hasActiveFilters={hasActiveFilters}
          />

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader label="Name" sortKey="name" sort={sort} onSort={toggleSort} />
                  <SortableHeader label="Phone" sortKey="phone" sort={sort} onSort={toggleSort} />
                  <SortableHeader label="City" sortKey="city" sort={sort} onSort={toggleSort} />
                  <SortableHeader label="Opening Balance" sortKey="opening_balance" sort={sort} onSort={toggleSort} />
                  <SortableHeader label="Credit Days" sortKey="credit_days" sort={sort} onSort={toggleSort} />
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      Loading suppliers...
                    </TableCell>
                  </TableRow>
                ) : rows.length > 0 ? (
                  rows.map((supplier) => (
                    <TableRow key={supplier.id}>
                      <TableCell className="font-medium">
                        {supplier.name}
                      </TableCell>
                      <TableCell>
                        {supplier.phone ? (
                          <div className="flex items-center">
                            <Phone className="h-3 w-3 mr-1 text-gray-500" />
                            {supplier.phone}
                          </div>
                        ) : (
                          "N/A"
                        )}
                      </TableCell>
                      <TableCell>
                        {supplier.city ? (
                          <div className="flex items-center">
                            <MapPin className="h-3 w-3 mr-1 text-gray-500" />
                            {supplier.city}
                          </div>
                        ) : (
                          "N/A"
                        )}
                      </TableCell>
                      <TableCell>
                        {supplier.opening_balance ? (
                          <div className="text-sm">
                            <div>
                              {new Intl.NumberFormat('en-IN', {
                                style: 'currency',
                                currency: 'INR',
                                maximumFractionDigits: 0,
                              }).format(supplier.opening_balance)}
                            </div>
                            {supplier.opening_balance_date && (
                              <div className="text-xs text-muted-foreground">
                                as on {supplier.opening_balance_date.slice(0, 10)}
                              </div>
                            )}
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>{supplier.credit_days ?? 0}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {supplier.description || "N/A"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8"
                            onClick={() => {
                              setSelectedSupplier(supplier);
                              setIsEditDialogOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4 mr-1" /> Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-red-500 border-red-200 hover:bg-red-50"
                            onClick={() => {
                              setSelectedSupplier(supplier);
                              setIsDeleteDialogOpen(true);
                            }}
                          >
                            <Trash className="h-4 w-4 mr-1" /> Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      No suppliers found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Supplier</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplier Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter supplier name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter phone number" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter city" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="opening_balance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Opening Balance (₹)</FormLabel>
                    <FormControl>
                      <CurrencyInput
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                        placeholder="0"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="opening_balance_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Opening Balance Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="credit_days"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Credit Days</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        {...field}
                        placeholder="0"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Enter description"
                        className="resize-none"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline" disabled={isSubmitting}>
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Supplier</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form
              onSubmit={editForm.handleSubmit(onEditSubmit)}
              className="space-y-4"
            >
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplier Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter supplier name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter phone number" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter city" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="opening_balance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Opening Balance (₹)</FormLabel>
                    <FormControl>
                      <CurrencyInput
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                        placeholder="0"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="opening_balance_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Opening Balance Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="credit_days"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Credit Days</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        {...field}
                        placeholder="0"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Enter description"
                        className="resize-none"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline" disabled={isSubmitting}>
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Supplier</DialogTitle>
          </DialogHeader>
          <p>
            Are you sure you want to delete the supplier "
            {selectedSupplier?.name}"? This action cannot be undone.
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isDeleting}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Suppliers;
