import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  FormDescription,
} from "@/components/ui/form";
import { CurrencyInput } from "@/components/ui/currency-input";
import { SortableHeader } from "@/components/ui/sortable-header";
import { TableToolbar } from "@/components/ui/table-toolbar";
import {
  Handshake,
  Plus,
  Edit,
  Trash,
  Loader2,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { customersAPI } from "@/services/api";
import { WATAV_CUSTOMER_TYPE, getWatavVendors } from "@/lib/partyTypes";
import { useTableControls, uniqueOptions } from "@/hooks/useTableControls";

type Vendor = {
  id: string;
  name: string;
  phone: string | null;
  description: string | null;
  city: string | null;
  type: string | null;
  opening_balance: number;
  opening_balance_date: string | null;
  created_at: string;
  updated_at: string;
};

const vendorFormSchema = z
  .object({
    name: z.string().min(1, "Vendor name is required"),
    phone: z.string().nullable(),
    description: z.string().nullable(),
    city: z.string().nullable(),
    opening_balance: z.coerce.number().default(0),
    opening_balance_date: z.string().nullable(),
  })
  .refine(
    (data) =>
      data.opening_balance === 0 ||
      (data.opening_balance_date && data.opening_balance_date.length > 0),
    {
      message: "Opening balance date is required when opening balance is set",
      path: ["opening_balance_date"],
    }
  );

type VendorFormValues = z.infer<typeof vendorFormSchema>;

const emptyValues: VendorFormValues = {
  name: "",
  phone: "",
  description: "",
  city: "",
  opening_balance: 0,
  opening_balance_date: "",
};

const WatavVendors = () => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const form = useForm<VendorFormValues>({
    resolver: zodResolver(vendorFormSchema),
    defaultValues: emptyValues,
  });

  const editForm = useForm<VendorFormValues>({
    resolver: zodResolver(vendorFormSchema),
    defaultValues: emptyValues,
  });

  const {
    data: vendors,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["watavVendors"],
    queryFn: async () => {
      const response = await customersAPI.getAll();
      return getWatavVendors((response as Vendor[]) || []);
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (error) {
      toast({
        title: "Error fetching Watav vendors",
        description: (error as Error).message,
        variant: "destructive",
      });
    }
  }, [error, toast]);

  const searchFns = useMemo(
    () => [
      (item: Vendor) => item.name,
      (item: Vendor) => item.phone,
      (item: Vendor) => item.city,
      (item: Vendor) => item.description,
    ],
    []
  );

  const getSortValue = useMemo(
    () => (item: Vendor, key: string) => {
      switch (key) {
        case "name":
          return item.name;
        case "phone":
          return item.phone;
        case "city":
          return item.city;
        case "opening_balance":
          return item.opening_balance;
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
        options: uniqueOptions(vendors?.map((i) => i.city) || []),
        predicate: (item: Vendor, value: string) => item.city === value,
      },
    ],
    [vendors]
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
    data: vendors,
    searchFns,
    getSortValue,
    filters,
    defaultSort: { key: "name", direction: "asc" },
  });

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount || 0);

  const toBackendPayload = (values: VendorFormValues) => ({
    customer_name: values.name,
    customer_phone: values.phone,
    customer_description: values.description,
    customer_city: values.city,
    customer_type: WATAV_CUSTOMER_TYPE,
    opening_balance: values.opening_balance,
    opening_balance_date: values.opening_balance_date || null,
    credit_days: 0,
  });

  const onSubmit = async (values: VendorFormValues) => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      await customersAPI.create(toBackendPayload(values));
      toast({
        title: "Watav vendor added",
        description: "The Watav vendor has been added successfully.",
      });
      setIsAddDialogOpen(false);
      form.reset(emptyValues);
      refetch();
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["watavVendors"] });
    } catch (err) {
      toast({
        title: "Error adding vendor",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const onEditSubmit = async (values: VendorFormValues) => {
    if (!selectedVendor || !user) return;
    setIsSubmitting(true);
    try {
      await customersAPI.update(selectedVendor.id, toBackendPayload(values));
      toast({
        title: "Watav vendor updated",
        description: "The Watav vendor has been updated successfully.",
      });
      setIsEditDialogOpen(false);
      setSelectedVendor(null);
      refetch();
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["watavVendors"] });
    } catch (err) {
      toast({
        title: "Error updating vendor",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedVendor || !user) return;
    setIsDeleting(true);
    try {
      await customersAPI.delete(selectedVendor.id);
      toast({
        title: "Watav vendor deleted",
        description: "The Watav vendor has been deleted successfully.",
      });
      setIsDeleteDialogOpen(false);
      setSelectedVendor(null);
      refetch();
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["watavVendors"] });
    } catch (err) {
      toast({
        title: "Error deleting vendor",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const openEdit = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    editForm.reset({
      name: vendor.name || "",
      phone: vendor.phone || "",
      description: vendor.description || "",
      city: vendor.city || "",
      opening_balance: vendor.opening_balance || 0,
      opening_balance_date: vendor.opening_balance_date
        ? String(vendor.opening_balance_date).slice(0, 10)
        : "",
    });
    setIsEditDialogOpen(true);
  };

  const VendorFormFields = ({
    formInstance,
  }: {
    formInstance: typeof form;
  }) => (
    <>
      <FormField
        control={formInstance.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Vendor Name</FormLabel>
            <FormControl>
              <Input {...field} placeholder="Enter Watav vendor name" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={formInstance.control}
        name="phone"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Phone Number</FormLabel>
            <FormControl>
              <Input {...field} value={field.value || ""} placeholder="Enter phone number" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={formInstance.control}
        name="city"
        render={({ field }) => (
          <FormItem>
            <FormLabel>City</FormLabel>
            <FormControl>
              <Input {...field} value={field.value || ""} placeholder="Enter city" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={formInstance.control}
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
        control={formInstance.control}
        name="opening_balance_date"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Opening Balance Date</FormLabel>
            <FormControl>
              <Input type="date" {...field} value={field.value || ""} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={formInstance.control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Notes</FormLabel>
            <FormControl>
              <Textarea
                {...field}
                value={field.value || ""}
                placeholder="Enter notes"
                className="resize-none"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center">
              <Handshake className="mr-2" /> Watav Vendors
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage parties who hold Watav money. Stored like customers in the system, shown
              separately here.
            </p>
          </div>
          <Button
            className="bg-brand-teal hover:bg-teal-700"
            onClick={() => {
              form.reset(emptyValues);
              setIsAddDialogOpen(true);
            }}
          >
            <Plus className="mr-1 h-4 w-4" /> Add Watav Vendor
          </Button>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm">
          <TableToolbar
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder="Search Watav vendors..."
            filters={filterDefs}
            onFilterChange={setFilter}
            onClear={clearFilters}
            hasActiveFilters={hasActiveFilters}
          />

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader label="Vendor Name" sortKey="name" sort={sort} onSort={toggleSort} />
                  <SortableHeader label="Phone" sortKey="phone" sort={sort} onSort={toggleSort} />
                  <SortableHeader label="City" sortKey="city" sort={sort} onSort={toggleSort} />
                  <SortableHeader label="Opening Balance" sortKey="opening_balance" sort={sort} onSort={toggleSort} />
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : rows.length > 0 ? (
                  rows.map((vendor) => (
                    <TableRow key={vendor.id}>
                      <TableCell className="font-medium">{vendor.name}</TableCell>
                      <TableCell>{vendor.phone || "—"}</TableCell>
                      <TableCell>{vendor.city || "—"}</TableCell>
                      <TableCell>{formatCurrency(vendor.opening_balance || 0)}</TableCell>
                      <TableCell className="max-w-[220px] truncate text-muted-foreground">
                        {vendor.description || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(vendor)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedVendor(vendor);
                              setIsDeleteDialogOpen(true);
                            }}
                          >
                            <Trash className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      No Watav vendors found. Add one to use in Watav payments.
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
            <DialogTitle>Add Watav Vendor</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormDescription>
                This creates a Watav vendor account used for pending collections.
              </FormDescription>
              <VendorFormFields formInstance={form} />
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
            <DialogTitle>Edit Watav Vendor</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <VendorFormFields formInstance={editForm} />
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
            <DialogTitle>Delete Watav Vendor</DialogTitle>
          </DialogHeader>
          <p>
            Are you sure you want to delete the Watav vendor &quot;{selectedVendor?.name}&quot;?
            Existing Watav entries linked to this vendor will keep the link.
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

export default WatavVendors;
