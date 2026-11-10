import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Calendar, Truck, Warehouse, User, FileText } from 'lucide-react';
import { useFormSectionNavigation } from '@/lib/formKeyboardNavigation';
import QuantityUnitSelect from '@/components/ui/quantity-unit-select';
import { DEFAULT_QUANTITY_UNIT } from '@/lib/quantityUnits';

interface PurchaseDetailsProps {
    formData: any;
    setFormData: (data: any) => void;
    suppliers: any[];
    godowns: any[];
}

const PurchaseDetails = ({ formData, setFormData, suppliers, godowns }: PurchaseDetailsProps) => {
    const { containerRef, onKeyDownCapture } = useFormSectionNavigation();

    const handleUnitChange = (unit: string) => {
        setFormData((prev: any) => ({
            ...prev,
            unit,
            items: (prev.items || []).map((item: any) => ({ ...item, unit })),
        }));
    };

    return (
        <Card className="shadow-sm border-gray-200">
            <CardHeader className="pb-3">
                <CardTitle className="text-xl flex items-center gap-2">
                    <FileText className="h-5 w-5 text-brand-teal" />
                    Purchase Details
                </CardTitle>
            </CardHeader>
            <CardContent ref={containerRef} onKeyDownCapture={onKeyDownCapture}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="space-y-2">
                        <Label htmlFor="purchase_no" className="text-sm font-medium">
                            Purchase No
                        </Label>
                        <Input
                            id="purchase_no"
                            value={formData.purchase_no}
                            onChange={(e) =>
                                setFormData({ ...formData, purchase_no: e.target.value })
                            }
                            placeholder="Enter purchase number"
                            className="focus-visible:ring-brand-teal"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="purchase_date" className="text-sm font-medium">
                            <span className="flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5 text-gray-500" />
                                Purchase Date
                            </span>
                        </Label>
                        <Input
                            id="purchase_date"
                            type="date"
                            value={formData.purchase_date}
                            onChange={(e) =>
                                setFormData({ ...formData, purchase_date: e.target.value })
                            }
                            className="focus-visible:ring-brand-teal"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="supplier" className="text-sm font-medium">
                            <span className="flex items-center gap-1">
                                <Truck className="h-3.5 w-3.5 text-gray-500" />
                                Supplier
                            </span>
                        </Label>
                        <Select
                            value={formData.supplier_id}
                            onValueChange={(value) => {
                                const supplier = suppliers.find((s) => s.id === value);
                                setFormData({
                                    ...formData,
                                    supplier_id: value,
                                    supplier_name: supplier?.name || '',
                                    credit_days: supplier?.credit_days ?? formData.credit_days ?? 0,
                                });
                            }}
                        >
                            <SelectTrigger className="w-full focus:ring-brand-teal">
                                <SelectValue placeholder="Select supplier..." />
                            </SelectTrigger>
                            <SelectContent>
                                {suppliers && Array.isArray(suppliers) && suppliers.length > 0 ?
                                    suppliers.map((supplier) => (
                                        <SelectItem key={supplier.id} value={supplier.id}>
                                            {supplier.name}
                                        </SelectItem>
                                    )) :
                                    <SelectItem value="none" disabled>No suppliers available</SelectItem>
                                }
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-sm font-medium">Quantity Unit</Label>
                        <QuantityUnitSelect
                            value={formData.unit || DEFAULT_QUANTITY_UNIT}
                            onChange={handleUnitChange}
                            size="md"
                        />
                        <p className="text-xs text-muted-foreground">
                            Applies to all rolls on this bill
                        </p>
                    </div>
                </div>

                <Separator className="my-6" />

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="space-y-2">
                        <Label htmlFor="godown_no" className="text-sm font-medium">
                            <span className="flex items-center gap-1">
                                <Warehouse className="h-3.5 w-3.5 text-gray-500" />
                                Godown No
                            </span>
                        </Label>
                        <Select
                            value={formData.godown_no}
                            onValueChange={(value) => setFormData({ ...formData, godown_no: value })}
                        >
                            <SelectTrigger className="w-full focus:ring-brand-teal">
                                <SelectValue placeholder="Select godown..." />
                            </SelectTrigger>
                            <SelectContent>
                                {godowns && Array.isArray(godowns) && godowns.length > 0 ?
                                    godowns.map((godown) => (
                                        <SelectItem key={godown.id} value={godown.id}>
                                            {godown.name}
                                        </SelectItem>
                                    )) :
                                    <SelectItem value="none" disabled>No godowns available</SelectItem>
                                }
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="transport" className="text-sm font-medium">
                            <span className="flex items-center gap-1">
                                <Truck className="h-3.5 w-3.5 text-gray-500" />
                                Transport
                            </span>
                        </Label>
                        <Input
                            id="transport"
                            value={formData.transport || ''}
                            onChange={(e) =>
                                setFormData({ ...formData, transport: e.target.value })
                            }
                            placeholder="Enter transport details"
                            className="focus-visible:ring-brand-teal"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="received_by" className="text-sm font-medium">
                            <span className="flex items-center gap-1">
                                <User className="h-3.5 w-3.5 text-gray-500" />
                                Received By
                            </span>
                        </Label>
                        <Input
                            id="received_by"
                            value={formData.received_by || ''}
                            onChange={(e) =>
                                setFormData({ ...formData, received_by: e.target.value })
                            }
                            placeholder="Enter receiver's name"
                            className="focus-visible:ring-brand-teal"
                        />
                    </div>

                    <div className="space-y-2 md:col-span-2 lg:col-span-4">
                        <Label htmlFor="description" className="text-sm font-medium">Description</Label>
                        <Textarea
                            id="description"
                            value={formData.description || ''}
                            onChange={(e) =>
                                setFormData({ ...formData, description: e.target.value })
                            }
                            placeholder="Enter purchase description"
                            className="focus-visible:ring-brand-teal"
                            rows={2}
                        />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default PurchaseDetails;
