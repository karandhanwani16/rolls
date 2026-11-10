import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  salesAPI,
  customersAPI,
  productsAPI,
  godownsAPI,
  purchasesAPI,
} from "@/services/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, Printer, FileText } from "lucide-react";
import SalesDetails from "./SalesDetails";
import SalesItems from "./SalesItems";
import SalesActions from "./SalesActions";
import { printSaleDocument } from "@/lib/downloadSalePdf";
import { InterestNotePrintDialog } from "@/components/sales/InterestNotePrintDialog";
import { DEFAULT_QUANTITY_UNIT, normalizeUnit } from "@/lib/quantityUnits";
import { getRegularCustomers } from "@/lib/partyTypes";

interface SalesItem {
  sales_item_id: string;
  sales_id: string;
  product_id: string;
  product_name: string;
  roll_no: string;
  shade?: string;
  width?: string;
  roll_id: string;
  purchase_item_id?: string;
  meters: number;
  unit?: string;
  price: number;
  total_price: number;
  created_at: string;
  updated_at: string;
  rolls?: Array<{
    id: string;
    roll_no: string;
    meters: number;
    unit?: string;
    price: number;
    shade?: string;
    width?: string;
  }>;
}

interface SalesFormData {
  sales_no: string;
  sales_date: string;
  customer_id: string;
  customer_name: string;
  total_amount: number;
  description?: string;
  godown_no?: string;
  challan_no?: string;
  maker?: string;
  transport_charges?: number;
  discount?: number;
  credit_days?: number;
  unit?: string;
  items: SalesItem[];
}

const SalesForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [interestDialogOpen, setInterestDialogOpen] = useState(false);
  const [allRollsPool, setAllRollsPool] = useState<Record<string, any[]>>({});
  const [formData, setFormData] = useState<SalesFormData>({
    sales_no: "",
    sales_date: new Date().toISOString().split("T")[0],
    customer_id: "",
    customer_name: "",
    total_amount: 0,
    maker: "",
    transport_charges: 0,
    discount: 0,
    credit_days: 0,
    unit: DEFAULT_QUANTITY_UNIT,
    items: [],
  });
  // Keep latest items for stable getAvailableRolls without depending on every field change
  const itemsRef = useRef(formData.items);
  itemsRef.current = formData.items;
  // Debounce product-wide width sync so typing stays responsive
  const widthSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingWidthSyncRef = useRef<{ index: number; productId: string } | null>(
    null
  );

  // Fetch customers data (exclude Watav vendors — managed separately)
  const { data: customers = [] } = useQuery({
    queryKey: ["customers", "for-sales"],
    queryFn: async () => {
      setLoading(true);
      const response = await customersAPI.getAll();
      setLoading(false);
      return getRegularCustomers(response || []);
    },
  });

  // Fetch sale data if editing
  const { data: sale } = useQuery({
    queryKey: ["sale", id],
    queryFn: () => salesAPI.getById(id!),
    enabled: !!id,
  });

  // Keep the sale's current customer in the dropdown even if filtered out (e.g. legacy watav)
  const customersForSelect = useMemo(() => {
    const list = [...(customers || [])];
    const currentId = formData.customer_id;
    if (currentId && !list.some((c: any) => c.id === currentId)) {
      if (sale?.customer?.id === currentId) {
        list.unshift(sale.customer);
      } else {
        list.unshift({
          id: currentId,
          name: formData.customer_name || "Current customer",
        });
      }
    }
    return list;
  }, [customers, formData.customer_id, formData.customer_name, sale]);

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

  // Create/Update sale mutation
  const saleMutation = useMutation({
    mutationFn: (data: SalesFormData) => {
      setLoading(true);
      return id ? salesAPI.update(id, data) : salesAPI.create(data);
    },
    onSuccess: async (response) => {
      setLoading(false);
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      toast.success(`Sale ${id ? "updated" : "created"} successfully`);
      navigate("/sales");
    },
    onError: (error: any) => {
      setLoading(false);
      const message =
        error?.response?.data?.error ||
        error?.message ||
        `Failed to ${id ? "update" : "create"} sale`;
      toast.error(message);
    },
  });

  useEffect(() => {
    if (id) {
      const loadData = async () => {
        setLoading(true);
        try {
          let response = await salesAPI.getById(id);
          console.log("Loading sale data:", response);

          // First, fetch all rolls for all products in the sale
          const productRolls = await Promise.all(
            response.items.map(async (item: SalesItem) => {
              const rolls = await purchasesAPI.getRollsByProductId(
                item.product_id
              );
              return {
                productId: item.product_id,
                rolls: rolls,
              };
            })
          );

          // Initialize roll pool with all rolls
          const initialRollPool = productRolls.reduce(
            (acc, { productId, rolls }) => {
              acc[productId] = rolls;
              return acc;
            },
            {} as Record<string, any[]>
          );

          setAllRollsPool(initialRollPool);

          // Process items with their rolls
          const itemsWithRolls = response.items.map((item: SalesItem) => {
            // Get all rolls for this product
            const allRolls = initialRollPool[item.product_id] || [];

            // Get all rolls that are already selected in other items for the same product
            const selectedStockRollIds = response.items
              .filter(
                (otherItem: any) =>
                  otherItem.sales_item_id !== item.sales_item_id &&
                  otherItem.product_id === item.product_id &&
                  (otherItem.purchase_item_id || otherItem.roll_id)
              )
              .map((otherItem: any) =>
                String(otherItem.purchase_item_id || otherItem.roll_id)
              );

            // Filter out already selected rolls
            let availableRolls = allRolls.filter(
              (roll: any) => !selectedStockRollIds.includes(String(roll.id))
            );

            // Add the current roll to available rolls if it's not already there
            // BUT only if it's a real stock roll (has purchase_item_id), not a custom roll
            if (item.roll_no && item.purchase_item_id) {
              const currentRoll = availableRolls.find(
                (r: any) =>
                  String(r.id) ===
                  String(item.purchase_item_id || item.roll_id)
              );
              if (!currentRoll) {
                const rollToAdd = {
                  id: item.roll_id,
                  roll_no: item.roll_no,
                  meters: item.meters,
                  unit: item.unit || DEFAULT_QUANTITY_UNIT,
                  price: item.price,
                };
                availableRolls.push(rollToAdd);
                // Also add to the roll pool
                initialRollPool[item.product_id] = [
                  ...initialRollPool[item.product_id],
                  rollToAdd,
                ];
              }
            }

            return {
              ...item,
              shade: item.shade || "",
              width: item.width || "",
              total_price: parseFloat((item.meters * item.price).toFixed(2)),
              roll_id: item.roll_id,
              purchase_item_id: item.purchase_item_id || item.roll_id,
              rolls: availableRolls,
            };
          });

          console.log("Processed items with rolls:", itemsWithRolls);
          console.log("Initial roll pool:", initialRollPool);

          setFormData((prev) => ({
            ...prev,
            sales_no: response.sales_no,
            sales_date: response.date
              ? response.date.split("T")[0]
              : new Date().toISOString().split("T")[0],
            customer_id: response.customer_id || response.customer?.id || "",
            customer_name: response.customer_name || response.customer?.name || "",
            total_amount: response.total,
            description: response.description,
            godown_no: response.godown?.id || "",
            challan_no: response.challan_no,
            maker: response.maker,
            transport_charges: response.transport_charges || 0,
            discount: response.discount || 0,
            credit_days: response.credit_days || 0,
            unit: normalizeUnit(response.unit || response.items?.[0]?.unit),
            items: itemsWithRolls || [],
          }));
        } catch (error) {
          console.error("Error loading sale data:", error);
          toast.error("Failed to load sale data");
        } finally {
          setLoading(false);
        }
      };

      loadData();
    }
  }, [id]);

  // Calculate total price for each item when meters or price changes
  useEffect(() => {
    if (formData.items.length > 0) {
      let hasChanges = false;
      const updatedItems = formData.items.map((item) => {
        const expectedTotal = parseFloat((item.meters * item.price).toFixed(2));
        if (Math.abs(item.total_price - expectedTotal) > 0.01) {
          hasChanges = true;
          return {
            ...item,
            total_price: expectedTotal,
          };
        }
        return item;
      });

      if (hasChanges) {
        const itemsTotal = updatedItems.reduce(
          (sum, item) => sum + item.total_price,
          0
        );
        const totalAmount = Math.round(
          itemsTotal + (formData.transport_charges || 0) - (formData.discount || 0)
        );
        
        setFormData((prev) => ({
          ...prev,
          items: updatedItems,
          total_amount: totalAmount,
        }));
      }
    }
  }, [formData.items.map((item) => `${item.meters}-${item.price}`).join(",")]);

  // Fetch next sales number when date changes
  useEffect(() => {
    if (!id) {
      // Only fetch for new sales
      const fetchNextSalesNumber = async () => {
        try {
          setLoading(true);
          const response = await salesAPI.getNextSalesNumber(
            formData.sales_date
          );
          setFormData((prev) => ({
            ...prev,
            sales_no: response.data,
          }));
        } catch (error) {
          console.error("Error fetching next sales number:", error);
          toast.error("Failed to generate sales number");
        } finally {
          setLoading(false);
        }
      };
      fetchNextSalesNumber();
    }
  }, [formData.sales_date, id]);

  // Fetch and store all rolls for a product; returns the rolls for immediate use
  const fetchAndStoreRolls = useCallback(
    async (productId: string) => {
      if (allRollsPool[productId]) {
        return allRollsPool[productId];
      }
      const rolls = await purchasesAPI.getRollsByProductId(productId);
      setAllRollsPool((prev) => ({ ...prev, [productId]: rolls }));
      return rolls;
    },
    [allRollsPool]
  );

  const syncWidthForProduct = useCallback((productId: string, width: string) => {
    if (!productId) return;
    setFormData((prev) => {
      let anyChanged = false;
      const newItems = prev.items.map((item) => {
        if (item.product_id !== productId || item.width === width) return item;
        anyChanged = true;
        return { ...item, width };
      });
      // Width does not affect totals — avoid unnecessary recalculation
      return anyChanged ? { ...prev, items: newItems } : prev;
    });
  }, []);

  const flushWidthSync = useCallback(() => {
    if (widthSyncTimerRef.current) {
      clearTimeout(widthSyncTimerRef.current);
      widthSyncTimerRef.current = null;
    }
    const pending = pendingWidthSyncRef.current;
    if (!pending) return;
    pendingWidthSyncRef.current = null;
    const item = itemsRef.current[pending.index];
    if (!item || item.product_id !== pending.productId) return;
    syncWidthForProduct(pending.productId, item.width || "");
  }, [syncWidthForProduct]);

  useEffect(() => {
    return () => {
      if (widthSyncTimerRef.current) {
        clearTimeout(widthSyncTimerRef.current);
      }
    };
  }, []);

  // Expose flush for width blur via stable ref on the change handler's companion
  const handleWidthBlur = useCallback(() => {
    flushWidthSync();
  }, [flushWidthSync]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customer_id) {
      toast.error("Please select a customer");
      return;
    }

    // Apply any pending product-wide width sync before save (debounce may not have fired)
    if (widthSyncTimerRef.current) {
      clearTimeout(widthSyncTimerRef.current);
      widthSyncTimerRef.current = null;
    }
    const pending = pendingWidthSyncRef.current;
    pendingWidthSyncRef.current = null;

    let submitItems = itemsRef.current;
    if (pending) {
      const edited = submitItems[pending.index];
      if (edited?.product_id === pending.productId) {
        const width = edited.width || "";
        submitItems = submitItems.map((item) =>
          item.product_id === pending.productId && item.width !== width
            ? { ...item, width }
            : item
        );
        setFormData((prev) => ({ ...prev, items: submitItems }));
      }
    }

    saleMutation.mutate({
      ...formData,
      items: submitItems,
    });
  };

  const handleItemChange = useCallback(
    (index: number, field: keyof SalesItem, value: any) => {
      if (field === "width") {
        // Update the edited row immediately so the input stays responsive
        setFormData((prev) => {
          const currentItem = prev.items[index];
          if (!currentItem || currentItem.width === value) return prev;
          const newItems = [...prev.items];
          newItems[index] = { ...currentItem, width: value };
          return { ...prev, items: newItems };
        });

        const productId = itemsRef.current[index]?.product_id;
        if (!productId) return;

        // Debounce syncing width to other rolls of the same product
        pendingWidthSyncRef.current = { index, productId };
        if (widthSyncTimerRef.current) {
          clearTimeout(widthSyncTimerRef.current);
        }
        widthSyncTimerRef.current = setTimeout(() => {
          widthSyncTimerRef.current = null;
          const pending = pendingWidthSyncRef.current;
          pendingWidthSyncRef.current = null;
          if (!pending) return;
          const item = itemsRef.current[pending.index];
          if (!item || item.product_id !== pending.productId) return;
          syncWidthForProduct(pending.productId, item.width || "");
        }, 120);
        return;
      }

      setFormData((prevFormData) => {
        const currentItem = prevFormData.items[index];
        if (!currentItem) return prevFormData;

        if (field === "price") {
          // Price is shared across all rolls of the same product
          const productId = currentItem.product_id;
          let anyChanged = false;
          const newItems = prevFormData.items.map((item) => {
            if (!productId || item.product_id !== productId) return item;
            const total_price = parseFloat((item.meters * value).toFixed(2));
            if (item.price === value && item.total_price === total_price) {
              return item;
            }
            anyChanged = true;
            return { ...item, price: value, total_price };
          });
          if (!anyChanged) return prevFormData;

          const itemsTotal = newItems.reduce(
            (sum, item) => sum + (item.total_price || 0),
            0
          );
          return {
            ...prevFormData,
            items: newItems,
            total_amount: Math.round(
              itemsTotal +
                (prevFormData.transport_charges || 0) -
                (prevFormData.discount || 0)
            ),
          };
        }

        if ((currentItem as any)[field] === value) return prevFormData;

        const newItems = [...prevFormData.items];
        newItems[index] = {
          ...currentItem,
          [field]: value,
        };

        if (field === "meters") {
          newItems[index].total_price = parseFloat(
            (value * newItems[index].price).toFixed(2)
          );
          const itemsTotal = newItems.reduce(
            (sum, item) => sum + (item.total_price || 0),
            0
          );
          return {
            ...prevFormData,
            items: newItems,
            total_amount: Math.round(
              itemsTotal +
                (prevFormData.transport_charges || 0) -
                (prevFormData.discount || 0)
            ),
          };
        }

        return {
          ...prevFormData,
          items: newItems,
        };
      });
    },
    [syncWidthForProduct]
  );

  const handleProductChange = useCallback(
    async (index: number, productId: string) => {
      const product = products.find((p) => p.id === productId);
      if (!product) return;

      setLoading(true);
      try {
        const poolRolls = await fetchAndStoreRolls(productId);

        setFormData((prev) => {
          const currentItem = prev.items[index];
          if (!currentItem) return prev;

          // Include current stock roll without mutating the pool
          let availableRolls = poolRolls || [];
          if (currentItem.roll_no && currentItem.purchase_item_id) {
            const hasCurrent = availableRolls.some(
              (r: any) =>
                String(r.id) ===
                String(currentItem.purchase_item_id || currentItem.roll_id)
            );
            if (!hasCurrent) {
              availableRolls = [
                ...availableRolls,
                {
                  id: currentItem.roll_id,
                  roll_no: currentItem.roll_no,
                  meters: currentItem.meters,
                  price: currentItem.price,
                },
              ];
            }
          }

          const existingSameProduct = prev.items.find(
            (item, idx) => idx !== index && item.product_id === productId
          );

          const newItems = [...prev.items];
          newItems[index] = {
            ...newItems[index],
            product_id: product.id,
            product_name: product.name,
            rolls: availableRolls,
            price: parseFloat(product.price.toFixed(2)),
            width:
              existingSameProduct?.width ||
              currentItem.width ||
              product.width ||
              "",
            roll_no: currentItem.roll_no || "",
            roll_id: currentItem.roll_id || "",
            meters: currentItem.meters || 0,
            total_price: currentItem.total_price || 0,
          };

          return { ...prev, items: newItems };
        });
      } catch (error) {
        console.error("Error fetching rolls:", error);
        toast.error("Failed to fetch available rolls");
      } finally {
        setLoading(false);
      }
    },
    [products, fetchAndStoreRolls]
  );

  const handleRollChange = useCallback(
    (index: number, stockRollId: string) => {
      setFormData((prev) => {
        const item = prev.items[index];
        if (!item) return prev;
        const selectedRoll = allRollsPool[item.product_id]?.find(
          (r) => String(r.id) === String(stockRollId)
        );
        if (!selectedRoll) return prev;

        const newItems = [...prev.items];

        // Prefer width already set on another roll of the same product in this sale
        const siblingWidth = newItems.find(
          (it, i) =>
            i !== index && it.product_id === item.product_id && it.width
        )?.width;

        newItems[index] = {
          ...newItems[index],
          roll_no: selectedRoll.roll_no,
          roll_id: selectedRoll.id,
          purchase_item_id: selectedRoll.id,
          shade: selectedRoll.shade || "",
          width:
            siblingWidth || selectedRoll.width || newItems[index].width || "",
          meters: selectedRoll.meters,
          unit: prev.unit || DEFAULT_QUANTITY_UNIT,
          price: selectedRoll.price,
          total_price: parseFloat(
            (selectedRoll.meters * selectedRoll.price).toFixed(2)
          ),
        };

        const itemsTotal = newItems.reduce(
          (sum, row) => sum + (row.total_price || 0),
          0
        );
        return {
          ...prev,
          items: newItems,
          total_amount: Math.round(
            itemsTotal + (prev.transport_charges || 0) - (prev.discount || 0)
          ),
        };
      });
    },
    [allRollsPool]
  );

  const addItem = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          sales_item_id: "",
          sales_id: id || "",
          product_id: "",
          product_name: "",
          roll_no: "",
          shade: "",
          width: "",
          roll_id: "",
          purchase_item_id: null, // Changed to null for custom rolls
          meters: 0,
          unit: prev.unit || DEFAULT_QUANTITY_UNIT,
          price: 0,
          total_price: 0,
          created_at: "",
          updated_at: "",
        },
      ],
    }));
  }, [id]);

  const removeItem = useCallback((index: number) => {
    setFormData((prev) => {
      const itemToRemove = prev.items[index];
      if (!itemToRemove) return prev;
      const newItems = [...prev.items];
      newItems.splice(index, 1);

      // If the removed item had a STOCK roll selected (has purchase_item_id), add it back to the pool
      // Don't add custom rolls back to the pool
      if (
        itemToRemove.roll_no &&
        itemToRemove.product_id &&
        itemToRemove.purchase_item_id
      ) {
        const rollToAddBack = {
          id: itemToRemove.roll_id,
          roll_no: itemToRemove.roll_no,
          meters: itemToRemove.meters,
          unit: itemToRemove.unit || DEFAULT_QUANTITY_UNIT,
          price: itemToRemove.price,
        };

        setAllRollsPool((poolPrev) => ({
          ...poolPrev,
          [itemToRemove.product_id]: [
            ...(poolPrev[itemToRemove.product_id] || []),
            rollToAddBack,
          ],
        }));

        newItems.forEach((item, idx) => {
          if (item.product_id === itemToRemove.product_id) {
            newItems[idx] = {
              ...item,
              rolls: [
                ...(allRollsPool[item.product_id] || []),
                rollToAddBack,
              ],
            };
          }
        });
      }

      const itemsTotal = newItems.reduce(
        (sum, item) => sum + (item.total_price || 0),
        0
      );
      return {
        ...prev,
        items: newItems,
        total_amount: Math.round(
          itemsTotal + (prev.transport_charges || 0) - (prev.discount || 0)
        ),
      };
    });
  }, [allRollsPool]);

  const handleBulkAdd = async (productId: string, count: number) => {
    const product = products.find((p: any) => p.id === productId);
    if (!product) return;

    setLoading(true);

    try {
      const availableRolls = await fetchAndStoreRolls(productId);

      // Inherit width from an existing line of the same product when present
      const existingWidth =
        itemsRef.current.find((item) => item.product_id === product.id)
          ?.width ||
        product.width ||
        "";

      const newItems = Array(count)
        .fill(null)
        .map(() => ({
          sales_item_id: "",
          sales_id: id || "",
          product_id: product.id,
          product_name: product.name,
          roll_no: "",
          shade: "",
          width: existingWidth,
          roll_id: "",
          purchase_item_id: null, // Changed to null for custom rolls
          meters: 0,
          unit: formData.unit || DEFAULT_QUANTITY_UNIT,
          price: product.price || 0,
          total_price: 0,
          created_at: "",
          updated_at: "",
          rolls: availableRolls,
        }));

      setFormData((prev: any) => ({
        ...prev,
        items: [...prev.items, ...newItems],
      }));

      toast.success(`Added ${count} rolls of ${product.name}`);
    } catch (error) {
      console.error("Error fetching rolls:", error);
      toast.error("Failed to fetch available rolls");
    } finally {
      setLoading(false);
    }
  };

  // Only roll-selection fields — width/price/shade edits must not invalidate this
  const rollSelectionKey = formData.items
    .map(
      (item) =>
        `${item.product_id}:${item.purchase_item_id || ""}:${item.roll_id || ""}:${item.roll_no || ""}`
    )
    .join("|");

  const availableRollsCacheRef = useRef<{
    key: string;
    byRow: Map<string, any[]>;
  }>({ key: "", byRow: new Map() });

  // Compute available rolls for a row (stable across width/price keystrokes)
  const getAvailableRolls = useCallback(
    (productId: string, currentIndex: number) => {
      if (!productId) return [];

      const poolKey = Object.keys(allRollsPool).join(",");
      const cacheKey = `${rollSelectionKey}::${poolKey}`;
      if (availableRollsCacheRef.current.key !== cacheKey) {
        availableRollsCacheRef.current = { key: cacheKey, byRow: new Map() };
      }

      const rowKey = `${currentIndex}:${productId}`;
      const cached = availableRollsCacheRef.current.byRow.get(rowKey);
      if (cached) return cached;

      const items = itemsRef.current;
      const allRolls = allRollsPool[productId] || [];
      const selectedStockRollIds = new Set(
        items
          .filter(
            (item, idx) =>
              idx !== currentIndex &&
              item.product_id === productId &&
              (item.purchase_item_id || item.roll_id)
          )
          .map((item) => String(item.purchase_item_id || item.roll_id))
      );

      // If editing and the current item has a stock roll, include it without mutating the pool
      let rolls = allRolls;
      const currentItem = items[currentIndex];
      if (currentItem?.roll_no && currentItem?.purchase_item_id) {
        const hasCurrent = allRolls.some(
          (r) =>
            String(r.id) ===
            String(currentItem.purchase_item_id || currentItem.roll_id)
        );
        if (!hasCurrent) {
          rolls = [
            ...allRolls,
            {
              id: currentItem.roll_id,
              roll_no: currentItem.roll_no,
              meters: currentItem.meters,
              price: currentItem.price,
            },
          ];
        }
      }

      const result = rolls.filter(
        (roll) => !selectedStockRollIds.has(String(roll.id))
      );
      availableRollsCacheRef.current.byRow.set(rowKey, result);
      return result;
    },
    [allRollsPool, rollSelectionKey]
  );

  const handlePrint = async (type: "bill" | "challan") => {
    if (!id) return;

    if (type === "bill") {
      setInterestDialogOpen(true);
      return;
    }

    try {
      toast.info("Opening challan print dialog...");
      await printSaleDocument(id, formData.sales_no, type);
    } catch (error) {
      console.error("Error printing document:", error);
      toast.error("Failed to print challan");
    }
  };

  const handleConfirmBillPrint = async (showInterestNote: boolean) => {
    if (!id) return;
    setInterestDialogOpen(false);

    try {
      toast.info("Opening sales bill print dialog...");
      await printSaleDocument(id, formData.sales_no, "bill", {
        showInterestNote,
      });
    } catch (error) {
      console.error("Error printing document:", error);
      toast.error("Failed to print sales bill");
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/sales")}
            className="rounded-full"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold text-gray-800">
            {id ? "Edit Sale" : "New Sale"}
          </h1>
          {id && (
            <Badge variant="outline" className="ml-2 text-sm">
              {formData.sales_no}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {id && (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={() => handlePrint("challan")}
              >
                <Printer className="h-4 w-4 mr-2" />
                Print Challan
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={() => handlePrint("bill")}
              >
                <FileText className="h-4 w-4 mr-2" />
                Print Sales Bill
              </Button>
            </>
          )}
          <Button
            disabled={loading}
            onClick={handleSubmit}
            className="bg-brand-teal hover:bg-teal-600"
          >
            <Save className="h-4 w-4 mr-2" />
            {id ? "Update Sale" : "Create Sale"}
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <SalesDetails
          formData={formData}
          setFormData={setFormData}
          customers={customersForSelect}
          godowns={godowns}
        />

        <SalesItems
          formData={formData}
          setFormData={setFormData}
          products={products}
          handleItemChange={handleItemChange}
          handleProductChange={handleProductChange}
          handleRollChange={handleRollChange}
          addItem={addItem}
          removeItem={removeItem}
          handleBulkAdd={handleBulkAdd}
          getAvailableRolls={getAvailableRolls}
          onWidthBlur={handleWidthBlur}
        />

        <SalesActions formData={formData} setFormData={setFormData} />
      </form>

      <InterestNotePrintDialog
        open={interestDialogOpen}
        onOpenChange={setInterestDialogOpen}
        creditDays={formData.credit_days}
        onConfirm={handleConfirmBillPrint}
      />
    </div>
  );
};

export default SalesForm;
