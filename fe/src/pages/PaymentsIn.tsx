import { useState, useEffect, useMemo } from "react";
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
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Checkbox } from "@/components/ui/checkbox";
import { SortableHeader } from "@/components/ui/sortable-header";
import { TableToolbar } from "@/components/ui/table-toolbar";
import { CreditCard, Plus, Edit, Trash2 } from "lucide-react";
import { paymentsInAPI, customersAPI, salesAPI } from "@/services/api";
import { getRegularCustomers, getWatavVendors } from "@/lib/partyTypes";
import {
  normalizeSettlementStatus,
  settlementClassName,
  settlementLabel,
} from "@/lib/watavSettlement";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useTableControls } from "@/hooks/useTableControls";

const instrumentTypes = [
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "upi", label: "UPI" },
  { value: "other", label: "Other" },
];

const paymentInSchema = z
  .object({
    payment_category: z.enum(["NORMAL", "VATAV"]),
    entry_type: z.enum(["CUSTOMER_PAYMENT", "STANDALONE"]).optional().nullable(),
    receive_id: z.string().optional().nullable(),
    actual_id: z.string().optional().nullable(),
    received_amount: z.coerce.number().min(0.01, "Gross amount is required"),
    actual_amount: z.coerce.number().min(0).optional(),
    charges: z.coerce.number().min(0).optional().nullable(),
    discount: z.coerce.number().min(0).optional().nullable(),
    type: z.string().min(1, "Payment instrument is required"),
    description: z.string().optional().nullable(),
    payment_date: z.date(),
    pay_full_bill: z.boolean().optional(),
    sale_id: z.string().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.payment_category === "NORMAL") {
      if (!data.actual_id) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Customer is required", path: ["actual_id"] });
      }
    } else {
      if (!data.receive_id) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Watav vendor is required", path: ["receive_id"] });
      }
      if (data.entry_type === "CUSTOMER_PAYMENT" && !data.actual_id) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Customer is required", path: ["actual_id"] });
      }
      if (
        data.entry_type === "CUSTOMER_PAYMENT" &&
        data.actual_id &&
        data.receive_id &&
        data.actual_id === data.receive_id
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Customer and Watav vendor must be different",
          path: ["actual_id"],
        });
      }
    }
    const canPayBill =
      data.payment_category === "NORMAL" ||
      (data.payment_category === "VATAV" && data.entry_type === "CUSTOMER_PAYMENT");
    if (data.pay_full_bill && canPayBill && !data.sale_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select a bill to pay in full",
        path: ["sale_id"],
      });
    }
  });

type PaymentInFormValues = z.infer<typeof paymentInSchema>;

const defaultFormValues: PaymentInFormValues = {
  payment_category: "NORMAL",
  entry_type: "CUSTOMER_PAYMENT",
  receive_id: "",
  actual_id: "",
  received_amount: 0,
  actual_amount: 0,
  charges: 0,
  discount: 0,
  type: "",
  description: "",
  payment_date: new Date(),
  pay_full_bill: false,
  sale_id: "",
};

const PaymentsIn = () => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentPaymentIn, setCurrentPaymentIn] = useState<any>(null);
  const [historyPayment, setHistoryPayment] = useState<any>(null);

  const queryClient = useQueryClient();

  const { data: paymentsInData, isLoading: isLoadingPaymentsIn } = useQuery({
    queryKey: ["paymentsIn"],
    queryFn: async () => {
      const response = await paymentsInAPI.getAll();
      return response.data;
    },
  });

  const { data: customersData, isLoading: isLoadingCustomers } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      try {
        return await customersAPI.getAll();
      } catch (error) {
        console.error("Error fetching customers:", error);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  const watavVendors = useMemo(
    () => getWatavVendors(customersData || []),
    [customersData]
  );

  const regularCustomers = useMemo(
    () => getRegularCustomers(customersData || []),
    [customersData]
  );

  const vendorOptions = watavVendors;

  const addPaymentInMutation = useMutation({
    mutationFn: (data: PaymentInFormValues) => paymentsInAPI.create(toApiPayload(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["paymentsIn"] });
      toast({ title: "Payment In Added", description: "Payment has been successfully added." });
      setIsAddDialogOpen(false);
      addForm.reset(defaultFormValues);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.response?.data?.error || "Failed to add payment.",
        variant: "destructive",
      });
    },
  });

  const updatePaymentInMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: PaymentInFormValues }) =>
      paymentsInAPI.update(id, toApiPayload(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["paymentsIn"] });
      toast({ title: "Payment In Updated", description: "Payment has been successfully updated." });
      setIsEditDialogOpen(false);
      editForm.reset(defaultFormValues);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.response?.data?.error || "Failed to update payment.",
        variant: "destructive",
      });
    },
  });

  const deletePaymentInMutation = useMutation({
    mutationFn: (id: string) => paymentsInAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["paymentsIn"] });
      toast({ title: "Payment In Deleted", description: "Payment has been successfully deleted." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete payment.", variant: "destructive" });
    },
  });

  const addForm = useForm<PaymentInFormValues>({
    resolver: zodResolver(paymentInSchema),
    defaultValues: defaultFormValues,
  });

  const editForm = useForm<PaymentInFormValues>({
    resolver: zodResolver(paymentInSchema),
    defaultValues: defaultFormValues,
  });

  useNetAmountSync(addForm);
  useNetAmountSync(editForm);
  useNormalReceiveSync(addForm);
  useNormalReceiveSync(editForm);

  const searchFns = useMemo(
    () => [
      (p: any) => p.description,
      (p: any) => p.type,
      (p: any) => p.actual_customer?.name,
      (p: any) => p.receive_customer?.name,
      (p: any) => p.payment_category,
      (p: any) => p.entry_type,
    ],
    []
  );

  const getSortValue = useMemo(
    () => (p: any, key: string) => {
      switch (key) {
        case "payment_category":
          return p.payment_category || inferCategory(p);
        case "customer":
          return p.actual_customer?.name;
        case "vendor":
          return p.receive_customer?.name;
        case "received_amount":
          return p.received_amount ?? 0;
        case "discount":
          return p.discount ?? 0;
        case "settles": {
          const category = p.payment_category || inferCategory(p);
          const isStandalone =
            p.entry_type === "STANDALONE" || (category === "VATAV" && !p.actual_id);
          return isStandalone ? 0 : (p.received_amount || 0) + (p.discount || 0);
        }
        case "charges":
          return p.charges ?? 0;
        case "net":
          return p.actual_amount ?? 0;
        case "collection":
          return normalizeSettlementStatus(p.settlementStatus || p.collection_status);
        case "type":
          return p.type;
        case "payment_date":
          return p.payment_date ? new Date(p.payment_date) : null;
        default:
          return null;
      }
    },
    []
  );

  const filters = useMemo(
    () => [
      {
        key: "category",
        label: "Category",
        options: [
          { value: "NORMAL", label: "Normal" },
          { value: "VATAV", label: "Watav" },
        ],
        predicate: (p: any, value: string) =>
          (p.payment_category || inferCategory(p)) === value,
      },
      {
        key: "instrument",
        label: "Instrument",
        options: instrumentTypes,
        predicate: (p: any, value: string) => p.type === value,
      },
      {
        key: "collection",
        label: "Collection",
        options: [
          { value: "PENDING", label: "Pending" },
          { value: "PARTIALLY_SETTLED", label: "Partially settled" },
          { value: "COMPLETED", label: "Completed" },
        ],
        predicate: (p: any, value: string) =>
          normalizeSettlementStatus(p.settlementStatus || p.collection_status) === value,
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
    data: paymentsInData,
    searchFns,
    getSortValue,
    filters,
    defaultSort: { key: "payment_date", direction: "desc" },
  });

  const handleEdit = (payment: any) => {
    setCurrentPaymentIn(payment);
    const category = payment.payment_category || inferCategory(payment);
    editForm.reset({
      payment_category: category,
      entry_type:
        payment.entry_type ||
        (category === "VATAV"
          ? payment.actual_id
            ? "CUSTOMER_PAYMENT"
            : "STANDALONE"
          : "CUSTOMER_PAYMENT"),
      receive_id: payment.receive_id || "",
      actual_id: payment.actual_id || "",
      received_amount: payment.received_amount,
      actual_amount: payment.actual_amount,
      charges: payment.charges || 0,
      discount: payment.discount || 0,
      type: payment.type,
      description: payment.description || "",
      payment_date: payment.payment_date ? new Date(payment.payment_date) : new Date(),
      pay_full_bill: Boolean(payment.sale_id),
      sale_id: payment.sale_id || "",
    });
    setIsEditDialogOpen(true);
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount || 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center">
            <CreditCard className="mr-2" /> Payments In
          </h1>
          <Button
            onClick={() => {
              addForm.reset(defaultFormValues);
              setIsAddDialogOpen(true);
            }}
            className="bg-brand-teal hover:bg-teal-700"
          >
            <Plus className="mr-1 h-4 w-4" /> New Payment In
          </Button>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm">
          <TableToolbar
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder="Search by customer, vendor, type..."
            filters={filterDefs}
            onFilterChange={setFilter}
            onClear={clearFilters}
            hasActiveFilters={hasActiveFilters}
          />

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader label="Category" sortKey="payment_category" sort={sort} onSort={toggleSort} />
                  <SortableHeader label="Customer" sortKey="customer" sort={sort} onSort={toggleSort} />
                  <SortableHeader label="Watav Vendor" sortKey="vendor" sort={sort} onSort={toggleSort} />
                  <SortableHeader label="Received" sortKey="received_amount" sort={sort} onSort={toggleSort} />
                  <SortableHeader label="Discount" sortKey="discount" sort={sort} onSort={toggleSort} />
                  <SortableHeader label="Settles" sortKey="settles" sort={sort} onSort={toggleSort} />
                  <SortableHeader label="Charges" sortKey="charges" sort={sort} onSort={toggleSort} />
                  <SortableHeader label="Net" sortKey="net" sort={sort} onSort={toggleSort} />
                  <SortableHeader label="Collection" sortKey="collection" sort={sort} onSort={toggleSort} />
                  <SortableHeader label="Instrument" sortKey="type" sort={sort} onSort={toggleSort} />
                  <SortableHeader label="Date" sortKey="payment_date" sort={sort} onSort={toggleSort} />
                  <TableHead>Bill</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingPaymentsIn ? (
                  <TableRow>
                    <TableCell colSpan={13} className="h-24 text-center">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : rows.length > 0 ? (
                  rows.map((payment: any) => {
                    const category = payment.payment_category || inferCategory(payment);
                    const isVatav = category === "VATAV";
                    const isStandalone =
                      payment.entry_type === "STANDALONE" || (isVatav && !payment.actual_id);
                    const discount = payment.discount || 0;
                    const settles = isStandalone
                      ? 0
                      : (payment.received_amount || 0) + discount;
                    return (
                      <TableRow key={payment.id}>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium">{isVatav ? "Watav" : "Normal"}</span>
                            {isVatav && (
                              <span className="text-xs text-muted-foreground">
                                {isStandalone ? "Standalone" : "Customer payment"}
                              </span>
                            )}
                            {payment.sale_id && (
                              <span className="text-xs text-emerald-700">Full bill</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {isStandalone ? (
                            <span className="text-muted-foreground italic">None</span>
                          ) : (
                            payment.actual_customer?.name || "N/A"
                          )}
                        </TableCell>
                        <TableCell>
                          {isVatav
                            ? payment.receive_customer?.name || "N/A"
                            : "—"}
                        </TableCell>
                        <TableCell>{formatCurrency(payment.received_amount)}</TableCell>
                        <TableCell>
                          {discount > 0 ? formatCurrency(discount) : "—"}
                        </TableCell>
                        <TableCell className="font-medium">
                          {isStandalone ? "—" : formatCurrency(settles)}
                        </TableCell>
                        <TableCell>
                          {isVatav ? formatCurrency(payment.charges || 0) : "—"}
                        </TableCell>
                        <TableCell>{formatCurrency(payment.actual_amount)}</TableCell>
                        <TableCell>
                          {isVatav ? (
                            <button
                              type="button"
                              className="text-left"
                              onClick={() => setHistoryPayment(payment)}
                            >
                              <span className={settlementClassName(payment.settlementStatus || payment.collection_status)}>
                                {settlementLabel(payment.settlementStatus || payment.collection_status)}
                              </span>
                              {(payment.remainingAmount > 0 || payment.totalSettledAmount > 0) && (
                                <div className="text-xs text-muted-foreground">
                                  Remaining {formatCurrency(payment.remainingAmount || 0)}
                                </div>
                              )}
                            </button>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="capitalize">{payment.type}</TableCell>
                        <TableCell>
                          {payment.payment_date
                            ? format(new Date(payment.payment_date), "dd/MM/yyyy")
                            : "N/A"}
                        </TableCell>
                        <TableCell>
                          {payment.sale?.sales_no || (payment.sale_id ? "Linked bill" : "—")}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(payment)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (window.confirm("Are you sure you want to delete this payment?")) {
                                  deletePaymentInMutation.mutate(payment.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={13} className="h-24 text-center">
                      No payments found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <PaymentFormDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        title="Add New Payment In"
        form={addForm}
        onSubmit={(data) => addPaymentInMutation.mutate(data)}
        isPending={addPaymentInMutation.isPending}
        customersData={regularCustomers}
        vendorOptions={vendorOptions}
        isLoadingCustomers={isLoadingCustomers}
        submitLabel="Save"
      />

      <PaymentFormDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        title="Edit Payment In"
        form={editForm}
        onSubmit={(data) =>
          updatePaymentInMutation.mutate({ id: currentPaymentIn.id, data })
        }
        isPending={updatePaymentInMutation.isPending}
        customersData={regularCustomers}
        vendorOptions={vendorOptions}
        isLoadingCustomers={isLoadingCustomers}
        submitLabel="Save Changes"
      />

      <SettlementHistoryDialog
        payment={historyPayment}
        onClose={() => setHistoryPayment(null)}
      />
    </DashboardLayout>
  );
};

function inferCategory(payment: any) {
  if (
    payment.receive_id &&
    payment.actual_id &&
    payment.receive_id !== payment.actual_id
  ) {
    return "VATAV";
  }
  return "NORMAL";
}

function toApiPayload(data: PaymentInFormValues) {
  const isVatav = data.payment_category === "VATAV";
  const isStandalone = isVatav && data.entry_type === "STANDALONE";
  const canPayBill = !isStandalone;
  return {
    payment_category: data.payment_category,
    entry_type: isVatav ? data.entry_type : null,
    receive_id: isVatav ? data.receive_id : data.actual_id,
    actual_id: isStandalone ? null : data.actual_id,
    received_amount: data.received_amount,
    charges: isVatav ? data.charges || 0 : 0,
    discount: isStandalone ? 0 : data.discount || 0,
    type: data.type,
    description: data.description || "",
    payment_date: data.payment_date,
    sale_id: canPayBill && data.pay_full_bill ? data.sale_id || null : null,
  };
}

function useNetAmountSync(form: ReturnType<typeof useForm<PaymentInFormValues>>) {
  const received = form.watch("received_amount");
  const charges = form.watch("charges") || 0;
  const category = form.watch("payment_category");
  useEffect(() => {
    const net = category === "NORMAL" ? received : received - (charges || 0);
    form.setValue("actual_amount", net >= 0 ? net : 0);
  }, [received, charges, category]);
}

function useNormalReceiveSync(form: ReturnType<typeof useForm<PaymentInFormValues>>) {
  const category = form.watch("payment_category");
  const actualId = form.watch("actual_id");
  useEffect(() => {
    if (category === "NORMAL") {
      form.setValue("receive_id", actualId || "");
      form.setValue("charges", 0);
      form.setValue("entry_type", null);
    } else {
      if (!form.getValues("entry_type")) {
        form.setValue("entry_type", "CUSTOMER_PAYMENT");
      }
    }
  }, [category, actualId]);
}

function PaymentFormDialog({
  open,
  onOpenChange,
  title,
  form,
  onSubmit,
  isPending,
  customersData,
  vendorOptions,
  isLoadingCustomers,
  submitLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  form: ReturnType<typeof useForm<PaymentInFormValues>>;
  onSubmit: (data: PaymentInFormValues) => void;
  isPending: boolean;
  customersData: any[];
  vendorOptions: any[];
  isLoadingCustomers: boolean;
  submitLabel: string;
}) {
  const category = form.watch("payment_category");
  const entryType = form.watch("entry_type");
  const actualId = form.watch("actual_id");
  const payFullBill = form.watch("pay_full_bill");
  const saleId = form.watch("sale_id");
  const receivedAmount = Number(form.watch("received_amount")) || 0;
  const discountAmount = Number(form.watch("discount")) || 0;
  const isVatav = category === "VATAV";
  const isStandalone = isVatav && entryType === "STANDALONE";
  const canPayBill = !isStandalone;
  const settlesCustomer = !isStandalone ? receivedAmount + discountAmount : 0;

  const { data: customerSales = [], isLoading: isLoadingSales } = useQuery({
    queryKey: ["payment-in-bills", actualId],
    queryFn: async () => {
      if (!actualId) return [];
      const response = await salesAPI.getAll({ customer_id: actualId });
      const sales = Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response)
          ? response
          : [];
      return sales.filter(
        (sale: any) =>
          sale.payment_status !== "FULL" || sale.id === saleId
      );
    },
    enabled: open && canPayBill && Boolean(payFullBill) && Boolean(actualId),
  });

  useEffect(() => {
    if (!canPayBill || !payFullBill) {
      if (form.getValues("sale_id")) {
        form.setValue("sale_id", "");
      }
      return;
    }
    if (!saleId) return;
    const selected = customerSales.find((sale: any) => sale.id === saleId);
    if (!selected) return;
    const remaining = Number(selected.remaining_amount ?? selected.total) || 0;
    const discount = Number(form.getValues("discount")) || 0;
    const received = Math.max(0, remaining - discount);
    form.setValue("received_amount", received);
  }, [saleId, customerSales, canPayBill, payFullBill]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] sm:max-w-[820px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="grid gap-5 py-2">
              <FormField
                control={form.control}
                name="payment_category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Type</FormLabel>
                    <FormControl>
                      <Tabs
                        value={field.value}
                        onValueChange={(value) => {
                          field.onChange(value);
                          form.setValue("pay_full_bill", false);
                          form.setValue("sale_id", "");
                        }}
                        className="w-full"
                      >
                        <TabsList className="grid w-full grid-cols-2 h-11">
                          <TabsTrigger value="NORMAL" className="text-sm">
                            Normal Payment
                          </TabsTrigger>
                          <TabsTrigger value="VATAV" className="text-sm">
                            Watav
                          </TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isVatav && (
                <FormField
                  control={form.control}
                  name="entry_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Watav Entry Type</FormLabel>
                      <FormControl>
                        <Tabs
                          value={field.value || "CUSTOMER_PAYMENT"}
                          onValueChange={(v) => {
                            field.onChange(v);
                            if (v === "STANDALONE") {
                              form.setValue("actual_id", "");
                              form.setValue("discount", 0);
                            }
                          }}
                          className="w-full"
                        >
                          <TabsList className="grid w-full grid-cols-2 h-11">
                            <TabsTrigger value="CUSTOMER_PAYMENT" className="text-sm">
                              Customer Payment
                            </TabsTrigger>
                            <TabsTrigger value="STANDALONE" className="text-sm">
                              Standalone Vendor Entry
                            </TabsTrigger>
                          </TabsList>
                        </Tabs>
                      </FormControl>
                      {isStandalone && (
                        <FormDescription className="text-amber-700">
                          Standalone entries do not affect any customer balance. They only sit on the
                          Watav vendor account until the vendor settles.
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="payment_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        value={
                          field.value
                            ? format(field.value, "yyyy-MM-dd")
                            : format(new Date(), "yyyy-MM-dd")
                        }
                        onChange={(e) => field.onChange(new Date(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  {isVatav && (
                    <FormField
                      control={form.control}
                      name="receive_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Watav Vendor <span className="text-red-500">*</span>
                          </FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value || undefined}
                            disabled={isLoadingCustomers}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select watav vendor" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {vendorOptions?.length > 0 ? (
                                vendorOptions.map((customer: any) => (
                                  <SelectItem key={customer.id} value={customer.id}>
                                    {customer.name}
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem value="no-vendors" disabled>
                                  No Watav vendors — add them under Watav Vendors
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {!isStandalone && (
                    <FormField
                      control={form.control}
                      name="actual_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Customer <span className="text-red-500">*</span>
                          </FormLabel>
                          <Select
                            onValueChange={(value) => {
                              field.onChange(value);
                              form.setValue("sale_id", "");
                            }}
                            value={field.value || undefined}
                            disabled={isLoadingCustomers}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select customer" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {customersData?.length > 0 ? (
                                customersData.map((customer: any) => (
                                  <SelectItem key={customer.id} value={customer.id}>
                                    {customer.name}
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem value="no-customers" disabled>
                                  No customers found
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {canPayBill && (
                    <div className="space-y-3 rounded-md border p-3">
                      <FormField
                        control={form.control}
                        name="pay_full_bill"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={Boolean(field.value)}
                                onCheckedChange={(checked) => {
                                  field.onChange(Boolean(checked));
                                  if (!checked) {
                                    form.setValue("sale_id", "");
                                  }
                                }}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Pay full bill</FormLabel>
                              <FormDescription>
                                Links this payment to one invoice. That bill is marked paid in
                                bill-to-bill and the amount is excluded from the settlement pool.
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />

                      {payFullBill && (
                        <FormField
                          control={form.control}
                          name="sale_id"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                Bill <span className="text-red-500">*</span>
                              </FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                value={field.value || undefined}
                                disabled={!actualId || isLoadingSales}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue
                                      placeholder={
                                        !actualId
                                          ? "Select a customer first"
                                          : isLoadingSales
                                            ? "Loading bills..."
                                            : "Select unpaid bill"
                                      }
                                    />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {customerSales.length > 0 ? (
                                    customerSales.map((sale: any) => (
                                      <SelectItem key={sale.id} value={sale.id}>
                                        {sale.sales_no} ·{" "}
                                        {new Intl.NumberFormat("en-IN", {
                                          style: "currency",
                                          currency: "INR",
                                          maximumFractionDigits: 0,
                                        }).format(
                                          Number(sale.remaining_amount ?? sale.total) || 0
                                        )}{" "}
                                        due
                                      </SelectItem>
                                    ))
                                  ) : (
                                    <SelectItem value="no-bills" disabled>
                                      No unpaid bills for this customer
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
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="received_amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {isVatav ? "Gross Amount" : "Amount Received"}{" "}
                            <span className="text-red-500">*</span>
                          </FormLabel>
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

                    {!isStandalone && (
                      <FormField
                        control={form.control}
                        name="discount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Discount</FormLabel>
                            <FormControl>
                              <CurrencyInput
                                value={field.value ?? 0}
                                onChange={field.onChange}
                                onBlur={field.onBlur}
                                name={field.name}
                                ref={field.ref}
                              />
                            </FormControl>
                            <FormDescription>
                              Extra amount settled on customer books
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>

                  {!isStandalone && (
                    <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                      <div className="text-muted-foreground">Settles on customer account</div>
                      <div className="font-semibold text-base">
                        {new Intl.NumberFormat("en-IN", {
                          style: "currency",
                          currency: "INR",
                          maximumFractionDigits: 0,
                        }).format(settlesCustomer)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Received {receivedAmount.toLocaleString("en-IN")} + Discount{" "}
                        {discountAmount.toLocaleString("en-IN")}
                      </div>
                    </div>
                  )}

                  {isVatav && (
                    <>
                      <FormField
                        control={form.control}
                        name="charges"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Vendor Charges</FormLabel>
                            <FormControl>
                              <CurrencyInput
                                value={field.value ?? 0}
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
                        control={form.control}
                        name="actual_amount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Net Amount (from vendor)</FormLabel>
                            <FormControl>
                              <CurrencyInput
                                value={field.value}
                                onChange={field.onChange}
                                onBlur={field.onBlur}
                                name={field.name}
                                ref={field.ref}
                                readOnly
                              />
                            </FormControl>
                            <FormDescription>
                              Gross − Vendor Charges (discount does not affect this)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}
                </div>

                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Instrument <span className="text-red-500">*</span>
                        </FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || undefined}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select instrument" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {instrumentTypes.map((type) => (
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

                  {isVatav && (
                    <p className="text-sm text-muted-foreground rounded-md border bg-muted/40 px-3 py-2">
                      Vendor collection is recorded separately as a Watav vendor receipt. This customer
                      payment is treated as received immediately.
                    </p>
                  )}

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Enter notes"
                            {...field}
                            value={field.value || ""}
                            className="min-h-[100px]"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="mt-4">
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : submitLabel}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function SettlementHistoryDialog({
  payment,
  onClose,
}: {
  payment: any;
  onClose: () => void;
}) {
  if (!payment) return null;
  const allocations = payment.watav_allocations || payment.allocations || [];
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(amount || 0);

  return (
    <Dialog open={!!payment} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Watav settlement history</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <div className="text-muted-foreground">Original</div>
            <div className="font-semibold">
              {formatCurrency(payment.originalAmount ?? payment.received_amount)}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Settled</div>
            <div className="font-semibold text-green-700">
              {formatCurrency(payment.totalSettledAmount || 0)}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Remaining</div>
            <div className="font-semibold">
              {formatCurrency(payment.remainingAmount || 0)}
            </div>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          This is a completed customer payment. Vendor collection ({settlementLabel(payment.settlementStatus || payment.collection_status)}) does not change the customer balance.
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Receipt date</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead className="text-right">Allocated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allocations.length > 0 ? (
              allocations.map((row: any) => (
                <TableRow key={row.id}>
                  <TableCell>
                    {row.receipt?.receipt_date
                      ? format(new Date(row.receipt.receipt_date), "dd/MM/yyyy")
                      : row.receiptDate
                        ? format(new Date(row.receiptDate), "dd/MM/yyyy")
                        : "—"}
                  </TableCell>
                  <TableCell>
                    {row.receipt?.reference || row.receiptReference || "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(row.allocated_amount ?? row.allocatedAmount)}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  No vendor receipts allocated yet
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PaymentsIn;
