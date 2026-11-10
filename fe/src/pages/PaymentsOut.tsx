import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DialogTrigger,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Checkbox } from "@/components/ui/checkbox";
import { SortableHeader } from "@/components/ui/sortable-header";
import { TableToolbar } from "@/components/ui/table-toolbar";
import { CreditCard, Plus, Edit, Trash2 } from "lucide-react";
import { paymentsOutAPI, suppliersAPI, purchasesAPI } from "@/services/api";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Calendar as CalendarIcon } from "lucide-react";
import { useTableControls, uniqueOptions } from "@/hooks/useTableControls";

// Form schema
const paymentOutSchema = z
  .object({
    supplier_id: z.string().min(1, "Supplier is required"),
    amount: z.coerce.number().min(1, "Amount is required"),
    description: z.string().optional().nullable(),
    type: z.string().min(1, "Payment type is required"),
    cheque_date: z.date().optional().nullable(),
    payment_date: z.date({
      required_error: "Payment date is required",
    }),
    pay_full_bill: z.boolean().optional(),
    purchase_id: z.string().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.pay_full_bill && !data.purchase_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select a bill to pay in full",
        path: ["purchase_id"],
      });
    }
  });

type PaymentOutFormValues = z.infer<typeof paymentOutSchema>;

function toPaymentOutPayload(data: PaymentOutFormValues) {
  return {
    supplier_id: data.supplier_id,
    amount: data.amount,
    description: data.description || null,
    type: data.type,
    cheque_date: data.cheque_date,
    payment_date: data.payment_date,
    purchase_id: data.pay_full_bill ? data.purchase_id || null : null,
  };
}

// Payment types
const paymentTypes = [
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "upi", label: "UPI" },
  { value: "other", label: "Other" }
];

const PaymentsOut = () => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentPaymentOut, setCurrentPaymentOut] = useState<any>(null);

  const queryClient = useQueryClient();

  // Load data
  const { data: paymentsOutData, isLoading: isLoadingPaymentsOut } = useQuery({
    queryKey: ['paymentsOut'],
    queryFn: async () => {
      const response = await paymentsOutAPI.getAll();
      return response.data;
    }
  });


  const { data: suppliersData, isLoading: isLoadingSuppliers, error: suppliersError } = useQuery({
    queryKey: ['suppliers-payments-out'],
    queryFn: async () => {
      const response = await suppliersAPI.getAll();
      return response;
    }
  });

  // Mutations
  const addPaymentOutMutation = useMutation({
    mutationFn: (data: PaymentOutFormValues) =>
      paymentsOutAPI.create(toPaymentOutPayload(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paymentsOut'] });
      toast({
        title: "Payment Out Added",
        description: "Payment out has been successfully added.",
      });
      setIsAddDialogOpen(false);
      addForm.reset({
        supplier_id: "",
        amount: 0,
        type: "",
        description: "",
        cheque_date: null,
        payment_date: new Date(),
        pay_full_bill: false,
        purchase_id: "",
      });
    },
    onError: (error: any) => {
      console.error("Error adding payment out:", error);
      toast({
        title: "Error",
        description: error?.response?.data?.error || "Failed to add payment out.",
        variant: "destructive",
      });
    },
  });

  const updatePaymentOutMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: PaymentOutFormValues }) =>
      paymentsOutAPI.update(id, toPaymentOutPayload(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paymentsOut'] });
      toast({
        title: "Payment Out Updated",
        description: "Payment out has been successfully updated.",
      });
      setIsEditDialogOpen(false);
    },
    onError: (error: any) => {
      console.error("Error updating payment out:", error);
      toast({
        title: "Error",
        description: error?.response?.data?.error || "Failed to update payment out.",
        variant: "destructive",
      });
    },
  });

  const deletePaymentOutMutation = useMutation({
    mutationFn: (id: string) => paymentsOutAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paymentsOut'] });
      toast({
        title: "Payment Out Deleted",
        description: "Payment out has been successfully deleted.",
      });
    },
    onError: (error) => {
      console.error("Error deleting payment out:", error);
      toast({
        title: "Error",
        description: "Failed to delete payment out.",
        variant: "destructive",
      });
    },
  });

  // Form
  const addForm = useForm<PaymentOutFormValues>({
    resolver: zodResolver(paymentOutSchema),
    defaultValues: {
      supplier_id: "",
      amount: 0,
      type: "",
      description: "",
      cheque_date: null,
      payment_date: new Date(),
      pay_full_bill: false,
      purchase_id: "",
    },
  });

  const editForm = useForm<PaymentOutFormValues>({
    resolver: zodResolver(paymentOutSchema),
    defaultValues: {
      supplier_id: "",
      amount: 0,
      type: "",
      description: "",
      cheque_date: null,
      payment_date: new Date(),
      pay_full_bill: false,
      purchase_id: "",
    },
  });

  // Watch form values to show/hide cheque date field
  const addFormType = addForm.watch("type");
  const editFormType = editForm.watch("type");
  const addSupplierId = addForm.watch("supplier_id");
  const editSupplierId = editForm.watch("supplier_id");
  const addPayFullBill = addForm.watch("pay_full_bill");
  const editPayFullBill = editForm.watch("pay_full_bill");
  const addPurchaseId = addForm.watch("purchase_id");
  const editPurchaseId = editForm.watch("purchase_id");

  const { data: addSupplierPurchases = [], isLoading: isLoadingAddPurchases } = useQuery({
    queryKey: ["payment-out-bills", addSupplierId],
    queryFn: async () => {
      if (!addSupplierId) return [];
      const response = await purchasesAPI.getAll({ supplier_id: addSupplierId });
      const purchases = Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response)
          ? response
          : [];
      return purchases.filter(
        (purchase: any) =>
          purchase.payment_status !== "FULL" || purchase.id === addPurchaseId
      );
    },
    enabled: isAddDialogOpen && Boolean(addPayFullBill) && Boolean(addSupplierId),
  });

  const { data: editSupplierPurchases = [], isLoading: isLoadingEditPurchases } = useQuery({
    queryKey: ["payment-out-bills-edit", editSupplierId],
    queryFn: async () => {
      if (!editSupplierId) return [];
      const response = await purchasesAPI.getAll({ supplier_id: editSupplierId });
      const purchases = Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response)
          ? response
          : [];
      return purchases.filter(
        (purchase: any) =>
          purchase.payment_status !== "FULL" || purchase.id === editPurchaseId
      );
    },
    enabled: isEditDialogOpen && Boolean(editPayFullBill) && Boolean(editSupplierId),
  });

  useEffect(() => {
    if (!addPayFullBill || !addPurchaseId) return;
    const selected = addSupplierPurchases.find((p: any) => p.id === addPurchaseId);
    if (!selected) return;
    addForm.setValue(
      "amount",
      Number(selected.remaining_amount ?? selected.total) || 0
    );
  }, [addPurchaseId, addSupplierPurchases, addPayFullBill]);

  useEffect(() => {
    if (!editPayFullBill || !editPurchaseId) return;
    const selected = editSupplierPurchases.find((p: any) => p.id === editPurchaseId);
    if (!selected) return;
    editForm.setValue(
      "amount",
      Number(selected.remaining_amount ?? selected.total) || 0
    );
  }, [editPurchaseId, editSupplierPurchases, editPayFullBill]);

  const searchFns = useMemo(
    () => [
      (p: any) => p.description,
      (p: any) => p.type,
      (p: any) => p.supplier?.name,
    ],
    []
  );

  const getSortValue = useMemo(
    () => (p: any, key: string) => {
      switch (key) {
        case "supplier":
          return p.supplier?.name;
        case "amount":
          return p.amount ?? 0;
        case "type":
          return p.type;
        case "payment_date":
          return p.payment_date ? new Date(p.payment_date) : null;
        case "cheque_date":
          return p.cheque_date ? new Date(p.cheque_date) : null;
        default:
          return null;
      }
    },
    []
  );

  const filters = useMemo(
    () => [
      {
        key: "type",
        label: "Payment Type",
        options: paymentTypes,
        predicate: (p: any, value: string) => p.type === value,
      },
      {
        key: "supplier",
        label: "Supplier",
        options: uniqueOptions(
          (paymentsOutData || []).map((p: any) => p.supplier?.name)
        ),
        predicate: (p: any, value: string) => p.supplier?.name === value,
      },
    ],
    [paymentsOutData]
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
    data: paymentsOutData,
    searchFns,
    getSortValue,
    filters,
    defaultSort: { key: "payment_date", direction: "desc" },
  });

  // Handle edit button click
  const handleEdit = (payment: any) => {
    setCurrentPaymentOut(payment);
    editForm.reset({
      supplier_id: payment.supplier_id,
      amount: payment.amount,
      type: payment.type,
      description: payment.description || "",
      cheque_date: payment.cheque_date ? new Date(payment.cheque_date) : null,
      payment_date: payment.payment_date ? new Date(payment.payment_date) : new Date(),
      pay_full_bill: Boolean(payment.purchase_id),
      purchase_id: payment.purchase_id || "",
    });
    setIsEditDialogOpen(true);
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center">
            <CreditCard className="mr-2" /> Payments Out
          </h1>
          <Button
            onClick={() => setIsAddDialogOpen(true)}
            className="bg-brand-teal hover:bg-teal-700"
          >
            <Plus className="mr-1 h-4 w-4" /> New Payment Out
          </Button>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm">
          <TableToolbar
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder="Search payments..."
            filters={filterDefs}
            onFilterChange={setFilter}
            onClear={clearFilters}
            hasActiveFilters={hasActiveFilters}
          />

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader label="Supplier" sortKey="supplier" sort={sort} onSort={toggleSort} />
                  <SortableHeader label="Amount" sortKey="amount" sort={sort} onSort={toggleSort} />
                  <SortableHeader label="Payment Type" sortKey="type" sort={sort} onSort={toggleSort} />
                  <SortableHeader label="Payment Date" sortKey="payment_date" sort={sort} onSort={toggleSort} />
                  <SortableHeader label="Cheque Date" sortKey="cheque_date" sort={sort} onSort={toggleSort} />
                  <TableHead>Bill</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingPaymentsOut ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : rows.length > 0 ? (
                  rows.map((payment: any) => (
                    <TableRow key={payment.id}>
                      <TableCell>{payment.supplier?.name || "N/A"}</TableCell>
                      <TableCell>{formatCurrency(payment.amount)}</TableCell>
                      <TableCell className="capitalize">{payment.type}</TableCell>
                      <TableCell>
                        {payment.payment_date
                          ? format(new Date(payment.payment_date), 'dd/MM/yyyy')
                          : "N/A"}
                      </TableCell>
                      <TableCell>
                        {payment.cheque_date
                          ? format(new Date(payment.cheque_date), 'dd/MM/yyyy')
                          : "N/A"}
                      </TableCell>
                      <TableCell>
                        {payment.purchase?.purchase_no ||
                          (payment.purchase_id ? "Linked bill" : "—")}
                      </TableCell>
                      <TableCell>{payment.description || "N/A"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(payment)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (window.confirm("Are you sure you want to delete this payment?")) {
                                deletePaymentOutMutation.mutate(payment.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center">
                      No payments found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Add Payment Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Payment Out</DialogTitle>
          </DialogHeader>

          <Form {...addForm}>
            <form onSubmit={addForm.handleSubmit((data) => addPaymentOutMutation.mutate(data))}>
              <div className="grid gap-4 py-4">
                <FormField
                  control={addForm.control}
                  name="supplier_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supplier <span className="text-red-500">*</span></FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          addForm.setValue("purchase_id", "");
                        }}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a supplier" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {isLoadingSuppliers ? (
                            <SelectItem value="loading">Loading...</SelectItem>
                          ) : suppliersError ? (
                            <SelectItem value="error">Error loading suppliers</SelectItem>
                          ) : (
                            suppliersData?.map((supplier: any) => (
                              <SelectItem key={supplier.id} value={supplier.id}>
                                {supplier.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-3 rounded-md border p-3">
                  <FormField
                    control={addForm.control}
                    name="pay_full_bill"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={Boolean(field.value)}
                            onCheckedChange={(checked) => {
                              field.onChange(Boolean(checked));
                              if (!checked) addForm.setValue("purchase_id", "");
                            }}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Pay full bill</FormLabel>
                          <FormDescription>
                            Links this payment to one purchase bill. That bill is marked paid in
                            bill-to-bill and excluded from the settlement pool.
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />

                  {addPayFullBill && (
                    <FormField
                      control={addForm.control}
                      name="purchase_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Bill <span className="text-red-500">*</span>
                          </FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value || undefined}
                            disabled={!addSupplierId || isLoadingAddPurchases}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue
                                  placeholder={
                                    !addSupplierId
                                      ? "Select a supplier first"
                                      : isLoadingAddPurchases
                                        ? "Loading bills..."
                                        : "Select unpaid bill"
                                  }
                                />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {addSupplierPurchases.length > 0 ? (
                                addSupplierPurchases.map((purchase: any) => (
                                  <SelectItem key={purchase.id} value={purchase.id}>
                                    {purchase.purchase_no} ·{" "}
                                    {formatCurrency(
                                      Number(purchase.remaining_amount ?? purchase.total) || 0
                                    )}{" "}
                                    due
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem value="no-bills" disabled>
                                  No unpaid bills for this supplier
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                <FormField
                  control={addForm.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount <span className="text-red-500">*</span></FormLabel>
                      <FormControl>
                        <CurrencyInput
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={addForm.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Type <span className="text-red-500">*</span></FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select payment type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {paymentTypes.map(type => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {addFormType === 'cheque' && (
                  <FormField
                    control={addForm.control}
                    name="cheque_date"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Cheque Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={
                                  "pl-3 text-left font-normal flex justify-between items-center"
                                }
                              >
                                {field.value ? (
                                  format(field.value, "PPP")
                                ) : (
                                  <span>Pick a date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent
                              mode="single"
                              selected={field.value || undefined}
                              onSelect={field.onChange}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={addForm.control}
                  name="payment_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Date <span className="text-red-500">*</span></FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          {...field} 
                          value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''}
                          onChange={(e) => field.onChange(new Date(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={addForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter payment description"
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={addPaymentOutMutation.isPending}>
                  {addPaymentOutMutation.isPending ? "Saving..." : "Save"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Payment Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Payment Out</DialogTitle>
          </DialogHeader>

          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit((data) =>
              updatePaymentOutMutation.mutate({ id: currentPaymentOut.id, data })
            )}>
              <div className="grid gap-4 py-4">
                <FormField
                  control={editForm.control}
                  name="supplier_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supplier <span className="text-red-500">*</span></FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          editForm.setValue("purchase_id", "");
                        }}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a supplier" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {isLoadingSuppliers ? (
                            <SelectItem value="loading">Loading...</SelectItem>
                          ) : suppliersError ? (
                            <SelectItem value="error">Error loading suppliers</SelectItem>
                          ) : (
                            suppliersData?.map((supplier: any) => (
                              <SelectItem key={supplier.id} value={supplier.id}>
                                {supplier.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-3 rounded-md border p-3">
                  <FormField
                    control={editForm.control}
                    name="pay_full_bill"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={Boolean(field.value)}
                            onCheckedChange={(checked) => {
                              field.onChange(Boolean(checked));
                              if (!checked) editForm.setValue("purchase_id", "");
                            }}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Pay full bill</FormLabel>
                          <FormDescription>
                            Links this payment to one purchase bill. That bill is marked paid in
                            bill-to-bill and excluded from the settlement pool.
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />

                  {editPayFullBill && (
                    <FormField
                      control={editForm.control}
                      name="purchase_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Bill <span className="text-red-500">*</span>
                          </FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value || undefined}
                            disabled={!editSupplierId || isLoadingEditPurchases}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue
                                  placeholder={
                                    !editSupplierId
                                      ? "Select a supplier first"
                                      : isLoadingEditPurchases
                                        ? "Loading bills..."
                                        : "Select unpaid bill"
                                  }
                                />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {editSupplierPurchases.length > 0 ? (
                                editSupplierPurchases.map((purchase: any) => (
                                  <SelectItem key={purchase.id} value={purchase.id}>
                                    {purchase.purchase_no} ·{" "}
                                    {formatCurrency(
                                      Number(purchase.remaining_amount ?? purchase.total) || 0
                                    )}{" "}
                                    due
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem value="no-bills" disabled>
                                  No unpaid bills for this supplier
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                <FormField
                  control={editForm.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount <span className="text-red-500">*</span></FormLabel>
                      <FormControl>
                        <CurrencyInput
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Type <span className="text-red-500">*</span></FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select payment type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {paymentTypes.map(type => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {editFormType === 'cheque' && (
                  <FormField
                    control={editForm.control}
                    name="cheque_date"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Cheque Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={
                                  "pl-3 text-left font-normal flex justify-between items-center"
                                }
                              >
                                {field.value ? (
                                  format(field.value, "PPP")
                                ) : (
                                  <span>Pick a date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent
                              mode="single"
                              selected={field.value || undefined}
                              onSelect={field.onChange}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={editForm.control}
                  name="payment_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Date <span className="text-red-500">*</span></FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          {...field} 
                          value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''}
                          onChange={(e) => field.onChange(new Date(e.target.value))}
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
                          placeholder="Enter payment description"
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={updatePaymentOutMutation.isPending}>
                  {updatePaymentOutMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default PaymentsOut;
