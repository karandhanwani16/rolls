import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  salesReturnsAPI,
  purchaseReturnsAPI,
  customersAPI,
  suppliersAPI,
  productsAPI,
  salesAPI,
  purchasesAPI,
} from "@/services/api";
import { getRegularCustomers } from "@/lib/partyTypes";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save } from "lucide-react";
import ReturnDetails from "./ReturnDetails";
import ReturnItems from "./ReturnItems";
import SalesActions from "@/components/sales/SalesActions";
import { DEFAULT_QUANTITY_UNIT } from "@/lib/quantityUnits";

interface ReturnFormProps {
  mode: "sales" | "purchase";
}

const mapBillRolls = (
  billItems: any[] = [],
  savedItems: any[] = [],
  isPurchase: boolean
) => {
  return billItems.map((item: any, index: number) => {
    const purchaseItemId = isPurchase ? item.id : item.purchase_item_id || null;
    const saved = savedItems.find((row) => {
      if (purchaseItemId && row.purchase_item_id === purchaseItemId) return true;
      return (
        row.roll_no &&
        row.roll_no === item.roll_no &&
        row.product_id === item.product_id
      );
    });
    const meters = saved ? Number(saved.meters) || 0 : 0;
    const price = saved ? Number(saved.price) : Number(item.price) || 0;
    return {
      row_key: purchaseItemId || `bill-${item.id || index}`,
      sales_item_id: item.id || "",
      product_id: item.product_id || "",
      product_name: item.product_name || "",
      roll_no: item.roll_no || "",
      roll_id: purchaseItemId,
      purchase_item_id: purchaseItemId,
      original_meters: Number(item.meters) || 0,
      meters,
      unit: saved?.unit || item.unit || DEFAULT_QUANTITY_UNIT,
      price,
      total_price: parseFloat((meters * price).toFixed(2)),
      is_custom: false,
    };
  });
};

const extraCustomItems = (billItems: any[], savedItems: any[], isPurchase: boolean) => {
  if (!isPurchase) return [];
  const billKeys = new Set(
    billItems.map((item) => item.id || `${item.product_id}-${item.roll_no}`)
  );
  return savedItems
    .filter((item) => {
      if (!item.purchase_item_id) return true;
      return !billKeys.has(item.purchase_item_id);
    })
    .map((item, index) => ({
      row_key: `custom-${item.id || index}`,
      product_id: item.product_id || "",
      product_name: item.product_name || "",
      roll_no: item.roll_no || "",
      roll_id: null,
      purchase_item_id: null,
      original_meters: 0,
      meters: Number(item.meters) || 0,
      unit: item.unit || DEFAULT_QUANTITY_UNIT,
      price: Number(item.price) || 0,
      total_price: parseFloat(
        ((Number(item.meters) || 0) * (Number(item.price) || 0)).toFixed(2)
      ),
      is_custom: true,
    }));
};

const ReturnForm = ({ mode }: ReturnFormProps) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isSales = mode === "sales";
  const listPath = isSales ? "/sales-returns" : "/purchase-returns";
  const api = isSales ? salesReturnsAPI : purchaseReturnsAPI;
  const [loading, setLoading] = useState(false);
  const [bills, setBills] = useState<any[]>([]);
  const [billsLoading, setBillsLoading] = useState(false);
  const [formData, setFormData] = useState<any>({
    return_no: "",
    return_date: new Date().toISOString().split("T")[0],
    customer_id: "",
    customer_name: "",
    supplier_id: "",
    supplier_name: "",
    sale_id: "",
    purchase_id: "",
    total_amount: 0,
    transport_charges: 0,
    items: [],
  });

  const { data: parties = [] } = useQuery({
    queryKey: [isSales ? "customers" : "suppliers"],
    queryFn: async () => {
      if (isSales) {
        return getRegularCustomers((await customersAPI.getAll()) || []);
      }
      return suppliersAPI.getAll();
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => productsAPI.getAll(),
  });

  const mutation = useMutation({
    mutationFn: (data: any) => (id ? api.update(id, data) : api.create(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [isSales ? "sales-returns" : "purchase-returns"],
      });
      if (!isSales) {
        queryClient.invalidateQueries({ queryKey: ["stock-report"] });
      }
      toast.success(
        `${isSales ? "Sales" : "Purchase"} return ${id ? "updated" : "created"} successfully`
      );
      navigate(listPath);
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.error ||
          `Failed to ${id ? "update" : "create"} ${isSales ? "sales" : "purchase"} return`
      );
    },
  });

  const calcTotal = (items: any[], transportCharges: number) => {
    const itemsTotal = items.reduce((sum, item) => sum + (item.total_price || 0), 0);
    return Math.round(itemsTotal + (Number(transportCharges) || 0));
  };

  const billOptions = bills.map((bill) => {
    const number = isSales ? bill.sales_no : bill.purchase_no;
    const dateLabel = bill.date ? format(new Date(bill.date), "dd/MM/yyyy") : "";
    const totalLabel = Number(bill.total || 0).toLocaleString("en-IN");
    return {
      id: bill.id,
      label: `${number} · ${dateLabel} · ₹${totalLabel}`,
    };
  });

  const loadBills = async (partyId: string) => {
    if (!partyId) {
      setBills([]);
      return [];
    }
    setBillsLoading(true);
    try {
      const response = isSales
        ? await salesAPI.getAll({ customer_id: partyId })
        : await purchasesAPI.getAll({ supplier_id: partyId });
      const list = response.data || [];
      setBills(list);
      return list;
    } catch (error) {
      toast.error("Failed to load bills");
      setBills([]);
      return [];
    } finally {
      setBillsLoading(false);
    }
  };

  const applyBillItems = (
    bill: any,
    savedItems: any[] = [],
    extras: any[] = []
  ) => {
    const rolls = mapBillRolls(bill?.items || [], savedItems, !isSales);
    return [...rolls, ...extras];
  };

  useEffect(() => {
    if (!id) return;
    const loadData = async () => {
      setLoading(true);
      try {
        const response = await api.getById(id);
        const partyId = isSales
          ? response.customer?.id || response.customer_id || ""
          : response.supplier?.id || response.supplier_id || "";
        const billId = isSales
          ? response.sale_id || response.sale?.id || ""
          : response.purchase_id || response.purchase?.id || "";
        const list = await loadBills(partyId);
        const bill =
          list.find((row: any) => row.id === billId) ||
          (billId
            ? isSales
              ? await salesAPI.getById(billId)
              : await purchasesAPI.getById(billId)
            : null);
        const extras = extraCustomItems(bill?.items || [], response.items || [], !isSales);
        const items = bill
          ? applyBillItems(bill, response.items || [], extras)
          : (response.items || []).map((item: any) => ({
              ...item,
              original_meters: item.meters,
              total_price: parseFloat((item.meters * item.price).toFixed(2)),
              is_custom: !item.purchase_item_id,
            }));

        setFormData((prev: any) => ({
          ...prev,
          return_no: response.return_no,
          return_date: response.date
            ? response.date.split("T")[0]
            : new Date().toISOString().split("T")[0],
          customer_id: response.customer?.id || response.customer_id || "",
          customer_name: response.customer_name || "",
          supplier_id: response.supplier?.id || response.supplier_id || "",
          supplier_name: response.supplier_name || "",
          sale_id: billId && isSales ? billId : "",
          purchase_id: billId && !isSales ? billId : "",
          total_amount: response.total,
          description: response.description,
          transport_charges: response.transport_charges || 0,
          items,
        }));
      } catch (error) {
        console.error(error);
        toast.error("Failed to load return data");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [id]);

  useEffect(() => {
    if (!id) {
      const fetchNext = async () => {
        try {
          const response = await api.getNextNumber(formData.return_date);
          setFormData((prev: any) => ({ ...prev, return_no: response.data }));
        } catch (error) {
          toast.error("Failed to generate return number");
        }
      };
      fetchNext();
    }
  }, [formData.return_date, id]);

  const handlePartyChange = async (partyId: string) => {
    const party = parties.find((row: any) => row.id === partyId);
    setFormData((prev: any) => ({
      ...prev,
      customer_id: isSales ? partyId : "",
      customer_name: isSales ? party?.name || "" : "",
      supplier_id: isSales ? "" : partyId,
      supplier_name: isSales ? "" : party?.name || "",
      sale_id: "",
      purchase_id: "",
      items: [],
      total_amount: calcTotal([], prev.transport_charges),
    }));
    await loadBills(partyId);
  };

  const handleBillChange = async (billId: string) => {
    const existingCustomItems = formData.items.filter((item: any) => item.is_custom);
    const fromList = bills.find((bill) => bill.id === billId);
    const bill =
      fromList?.items
        ? fromList
        : billId
          ? isSales
            ? await salesAPI.getById(billId)
            : await purchasesAPI.getById(billId)
          : null;
    const items = applyBillItems(bill, [], existingCustomItems);
    setFormData((prev: any) => ({
      ...prev,
      sale_id: isSales ? billId : "",
      purchase_id: isSales ? "" : billId,
      items,
      total_amount: calcTotal(items, prev.transport_charges),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const partyId = isSales ? formData.customer_id : formData.supplier_id;
    const billId = isSales ? formData.sale_id : formData.purchase_id;
    if (!partyId) {
      toast.error(`Select a ${isSales ? "customer" : "supplier"}`);
      return;
    }
    // Sales return still requires a bill. Purchase return can be custom-only (no bill).
    if (isSales && !billId) {
      toast.error("Select a sales bill");
      return;
    }
    if (!formData.items.some((item: any) => Number(item.meters) > 0)) {
      toast.error("Enter returned quantity for at least one roll");
      return;
    }
    if (
      !isSales &&
      !billId &&
      !formData.items.some((item: any) => item.is_custom && Number(item.meters) > 0)
    ) {
      toast.error("Add custom rolls or select a purchase bill");
      return;
    }
    const invalidCustom = formData.items.find(
      (item: any) =>
        item.is_custom &&
        Number(item.meters) > 0 &&
        (!item.product_id || !String(item.roll_no || "").trim())
    );
    if (invalidCustom) {
      toast.error("Custom rolls need a product and roll number");
      return;
    }
    mutation.mutate(formData);
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    setFormData((prev: any) => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      if (field === "meters" || field === "price") {
        newItems[index].total_price = parseFloat(
          ((newItems[index].meters || 0) * (newItems[index].price || 0)).toFixed(2)
        );
      }
      return {
        ...prev,
        items: newItems,
        total_amount: calcTotal(newItems, prev.transport_charges),
      };
    });
  };

  const handleProductChange = (index: number, productId: string) => {
    const product = products.find((row: any) => row.id === productId);
    if (!product) return;
    setFormData((prev: any) => {
      const newItems = [...prev.items];
      newItems[index] = {
        ...newItems[index],
        product_id: product.id,
        product_name: product.name,
        price: parseFloat((product.price || 0).toFixed(2)),
      };
      newItems[index].total_price = parseFloat(
        ((newItems[index].meters || 0) * (newItems[index].price || 0)).toFixed(2)
      );
      return {
        ...prev,
        items: newItems,
        total_amount: calcTotal(newItems, prev.transport_charges),
      };
    });
  };

  const addCustomItem = () => {
    setFormData((prev: any) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          row_key: `custom-${Date.now()}`,
          product_id: "",
          product_name: "",
          roll_no: "",
          roll_id: null,
          purchase_item_id: null,
          original_meters: 0,
          meters: 0,
          unit: DEFAULT_QUANTITY_UNIT,
          price: 0,
          total_price: 0,
          is_custom: true,
        },
      ],
    }));
  };

  const removeItem = (index: number) => {
    const newItems = [...formData.items];
    newItems.splice(index, 1);
    setFormData({
      ...formData,
      items: newItems,
      total_amount: calcTotal(newItems, formData.transport_charges),
    });
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(listPath)}
            className="rounded-full"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold text-gray-800">
            {id
              ? `Edit ${isSales ? "Sales" : "Purchase"} Return`
              : `New ${isSales ? "Sales" : "Purchase"} Return`}
          </h1>
          {id && (
            <Badge variant="outline" className="ml-2 text-sm">
              {formData.return_no}
            </Badge>
          )}
        </div>
        <Button
          disabled={loading || mutation.isPending}
          onClick={handleSubmit}
          className="bg-brand-teal hover:bg-teal-600"
        >
          <Save className="h-4 w-4 mr-2" />
          {id ? "Update Return" : "Create Return"}
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <ReturnDetails
          mode={mode}
          formData={formData}
          setFormData={setFormData}
          parties={parties}
          bills={billOptions}
          billsLoading={billsLoading}
          onPartyChange={handlePartyChange}
          onBillChange={handleBillChange}
        />
        <ReturnItems
          mode={mode}
          formData={formData}
          products={products}
          handleItemChange={handleItemChange}
          handleProductChange={handleProductChange}
          addCustomItem={addCustomItem}
          removeItem={removeItem}
        />
        <SalesActions
          formData={formData}
          showDiscount={false}
          showCreditDays={false}
          setFormData={(updater: any) => {
            setFormData((prev: any) => {
              const next = typeof updater === "function" ? updater(prev) : updater;
              return {
                ...next,
                total_amount: calcTotal(next.items || [], next.transport_charges || 0),
              };
            });
          }}
        />
      </form>
    </div>
  );
};

export default ReturnForm;
