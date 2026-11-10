import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/use-toast";
import {
  purchasesAPI,
  suppliersAPI,
  productsAPI,
  godownsAPI,
} from "@/services/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save } from "lucide-react";
import PurchaseDetails from "./PurchaseDetails";
import PurchaseItems from "./PurchaseItems";
import PurchaseActions from "./PurchaseActions";
import BulkProductAdder from "./BulkProductAdder";
import { DEFAULT_QUANTITY_UNIT, formatQuantity, normalizeUnit } from "@/lib/quantityUnits";

interface PurchaseItem {
  purchase_item_id: string;
  purchase_id: string;
  product_id: string;
  product_name: string;
  roll_no: string;
  shade?: string;
  width?: string;
  meters: number;
  unit?: string;
  price: number;
  total_price: number;
  created_at: string;
  updated_at: string;
}

interface PurchaseFormData {
  purchase_no: string;
  purchase_date: string;
  supplier_id: string;
  supplier_name: string;
  total_amount: number;
  description?: string;
  godown_no?: string;
  transport?: string;
  transport_charges?: number;
  discount?: number;
  credit_days?: number;
  unit?: string;
  received_by?: string;
  items: PurchaseItem[];
}

const PurchaseForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<PurchaseFormData>({
    purchase_no: "",
    purchase_date: new Date().toISOString().split("T")[0],
    supplier_id: "",
    supplier_name: "",
    total_amount: 0,
    transport_charges: 0,
    discount: 0,
    credit_days: 0,
    unit: DEFAULT_QUANTITY_UNIT,
    items: [],
  });

  // Fetch suppliers data
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      setLoading(true);
      const response = await suppliersAPI.getAll();
      setLoading(false);
      return response;
    },
  });

  // Fetch godowns data
  const { data: godowns = [] } = useQuery({
    queryKey: ["godowns"],
    queryFn: async () => {
      setLoading(true);
      const response = await godownsAPI.getAll();
      setLoading(false);
      return response;
    },
  });

  // Fetch products data
  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      setLoading(true);
      const response = await productsAPI.getAll();
      setLoading(false);
      return response;
    },
  });

  // Fetch purchase data if editing
  const { data: purchase } = useQuery({
    queryKey: ["purchase", id],
    queryFn: () => purchasesAPI.getById(id!),
    enabled: !!id,
  });

  // Create/Update purchase mutation
  const purchaseMutation = useMutation({
    mutationFn: (data: PurchaseFormData) => {
      return id ? purchasesAPI.update(id, data) : purchasesAPI.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      toast({
        title: "Success",
        description: `Purchase ${id ? "updated" : "created"} successfully`,
      });
      navigate("/purchases");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to ${id ? "update" : "create"} purchase`,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (id) {
      const loadData = async () => {
        setLoading(true);
        let response = await purchasesAPI.getById(id);
        setLoading(false);
        const items = response.items.map((item: PurchaseItem) => ({
          ...item,
          shade: item.shade || "",
          width: item.width || "",
          total_price: parseFloat((item.meters * item.price).toFixed(2)),
        }));

        setFormData((prev) => ({
          ...prev,
          purchase_no: response.purchase_no,
          purchase_date: response.date
            ? response.date.split("T")[0]
            : new Date().toISOString().split("T")[0],
          supplier_id: response.supplier.id,
          supplier_name: response.supplier.name,
          total_amount: response.total,
          description: response.description,
          godown_no: response.godown,
          transport: response.transport,
          transport_charges: response.transport_charges || 0,
          discount: response.discount || 0,
          credit_days: response.credit_days || 0,
          unit: normalizeUnit(response.unit || response.items?.[0]?.unit),
          received_by: response.received_by,
          items: items || [],
        }));
      };
      loadData();
    }
  }, [id]);

  // Calculate total price for each item when meters, price, or transport charges change
  useEffect(() => {
    if (formData.items.length > 0) {
      const updatedItems = formData.items.map((item) => ({
        ...item,
        total_price: parseFloat((item.meters * item.price).toFixed(2)),
      }));
      const itemsTotal = updatedItems.reduce(
        (sum, item) => sum + item.total_price,
        0
      );
      const transportCharges = formData.transport_charges || 0;
      const discount = formData.discount || 0;

      setFormData((prev) => ({
        ...prev,
        items: updatedItems,
        total_amount: Math.round(itemsTotal + transportCharges - discount),
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        total_amount: Math.round(
          (prev.transport_charges || 0) - (prev.discount || 0)
        ),
      }));
    }
  }, [
    formData.items.map((item) => `${item.meters}-${item.price}`).join(","),
    formData.transport_charges,
    formData.discount,
  ]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    purchaseMutation.mutate(formData);
  };

  const handleItemChange = (
    index: number,
    field: keyof PurchaseItem,
    value: any
  ) => {
    const newItems = [...formData.items];

    if (field === "price" || field === "width") {
      // Price and width are shared across all rolls of the same product
      const currentItem = newItems[index];
      newItems.forEach((item, idx) => {
        if (item.product_id === currentItem.product_id) {
          if (field === "price") {
            newItems[idx] = {
              ...item,
              price: value,
              total_price: parseFloat((item.meters * value).toFixed(2)),
            };
          } else {
            newItems[idx] = {
              ...item,
              width: value,
            };
          }
        }
      });
    } else {
      // For other fields, just update the specific item
      newItems[index] = {
        ...newItems[index],
        [field]: value,
      };
    }

    setFormData({
      ...formData,
      items: newItems,
    });
  };

  const handleProductChange = (index: number, productId: string) => {
    const product = products.find((p) => p.id === productId);
    const existingSameProduct = formData.items.find(
      (item, idx) => idx !== index && item.product_id === productId
    );

    if (product?.price != null) {
      formData.items[index].price = parseFloat(Number(product.price).toFixed(2));
    }
    formData.items[index].product_id = product?.id || "";
    formData.items[index].product_name = product?.name || "";
    formData.items[index].width =
      existingSameProduct?.width || product?.width || "";
    setFormData({
      ...formData,
      items: formData.items,
    });
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        {
          purchase_item_id: "",
          purchase_id: id || "",
          product_id: "",
          product_name: "",
          roll_no: "",
          shade: "",
          width: "",
          meters: 0,
          unit: formData.unit || DEFAULT_QUANTITY_UNIT,
          price: 0,
          total_price: 0,
          created_at: "",
          updated_at: "",
        },
      ],
    });
  };

  const removeItem = (index: number) => {
    const newItems = [...formData.items];
    newItems.splice(index, 1);
    setFormData({
      ...formData,
      items: newItems,
    });
  };

  const handleBulkAdd = (productId: string, count: number) => {
    console.log(productId, count);
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    const newItems = Array(count)
      .fill(null)
      .map(() => ({
        purchase_item_id: "",
        purchase_id: id || "",
        product_id: product.id,
        product_name: product.name,
        roll_no: "",
        shade: "",
        width:
          formData.items.find((item) => item.product_id === product.id)?.width ||
          product.width ||
          "",
        meters: 0,
        unit: formData.unit || DEFAULT_QUANTITY_UNIT,
        price: product.price || 0,
        total_price: 0,
        created_at: "",
        updated_at: "",
      }));

    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, ...newItems],
    }));

    toast({
      title: "Success",
      description: `Added ${count} rolls of ${product.name}`,
    });
  };

  const getGroupedMeters = () => {
    const billUnit = formData.unit || DEFAULT_QUANTITY_UNIT;
    const groupMap = new Map<string, { product_name: string; qty: number }>();

    formData.items.forEach((item) => {
      const key = item.product_id;
      const current = groupMap.get(key);
      const qty = item.meters || 0;

      if (current) {
        current.qty += qty;
      } else {
        groupMap.set(key, {
          product_name: item.product_name,
          qty,
        });
      }
    });

    return {
      billUnit,
      groups: Array.from(groupMap.values()),
      totalQty: formData.items.reduce((sum, item) => sum + (item.meters || 0), 0),
    };
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/purchases")}
            className="rounded-full"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold text-gray-800">
            {id ? "Edit Purchase" : "New Purchase"}
          </h1>
          {id && (
            <Badge variant="outline" className="ml-2 text-sm">
              {formData.purchase_no}
            </Badge>
          )}
        </div>
        <Button
          type="submit"
          form="purchase-form"
          className="bg-brand-teal hover:bg-teal-700 text-white"
          disabled={purchaseMutation.isPending || loading}
        >
          <Save className="h-4 w-4 mr-2" />
          {purchaseMutation.isPending || loading
            ? id
              ? "Updating..."
              : "Creating..."
            : id
            ? "Update Purchase"
            : "Create Purchase"}
        </Button>
      </div>

      <form id="purchase-form" onSubmit={handleSubmit} className="space-y-8">
        <PurchaseDetails
          formData={formData}
          setFormData={setFormData}
          suppliers={suppliers}
          godowns={godowns}
        />

        <PurchaseItems
          formData={formData}
          setFormData={setFormData}
          products={products}
          handleItemChange={handleItemChange}
          handleProductChange={handleProductChange}
          addItem={addItem}
          removeItem={removeItem}
          handleBulkAdd={handleBulkAdd}
        />

        <div className="flex justify-end items-center gap-4 text-lg font-semibold">
          <div className="mt-6 border-t pt-4">
            <h3 className="text-lg font-semibold text-gray-800">
              Total Quantity by Product
            </h3>
            <ul className="text-sm text-gray-700 space-y-1">
              {(() => {
                const { billUnit, groups } = getGroupedMeters();
                return groups.map((group, idx) => (
                  <li key={idx}>
                    {group.product_name}: {formatQuantity(group.qty, billUnit)}
                  </li>
                ));
              })()}
            </ul>
            <h3 className="text-lg font-semibold text-gray-800 mt-4">
              Total Quantity
            </h3>
            <p className="text-sm text-gray-700">
              {(() => {
                const { billUnit, totalQty } = getGroupedMeters();
                return formatQuantity(totalQty, billUnit);
              })()}
            </p>
          </div>
        </div>

        <PurchaseActions
          formData={formData}
          setFormData={setFormData}
          isPending={purchaseMutation.isPending}
          id={id}
          navigate={navigate}
        />
      </form>
    </div>
  );
};

export default PurchaseForm;
