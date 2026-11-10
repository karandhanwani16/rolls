import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from 'lucide-react';
import { useFormSectionNavigation } from '@/lib/formKeyboardNavigation';
import QuantityUnitSelect from '@/components/ui/quantity-unit-select';
import { DEFAULT_QUANTITY_UNIT } from '@/lib/quantityUnits';

interface SalesDetailsProps {
    formData: any;
    setFormData: (data: any) => void;
    customers: any[];
    godowns: any[];
}

const SalesDetails = ({
    formData,
    setFormData,
    customers,
    godowns,
}: SalesDetailsProps) => {
    const { containerRef, onKeyDownCapture } = useFormSectionNavigation();

    const handleChange = (field: string, value: any) => {
        setFormData((prev: any) => ({
            ...prev,
            [field]: value,
        }));
    };

    const handleUnitChange = (unit: string) => {
        setFormData((prev: any) => ({
            ...prev,
            unit,
            items: (prev.items || []).map((item: any) => ({ ...item, unit })),
        }));
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-brand-teal" />
                    Sale Details
                </CardTitle>
            </CardHeader>
            <CardContent
                ref={containerRef}
                onKeyDownCapture={onKeyDownCapture}
                className="space-y-6"
            >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label htmlFor="sales_no">Sale No</Label>
                        <Input
                            id="sales_no"
                            value={formData.sales_no}
                            readOnly
                            className="bg-gray-50"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="sales_date">Date</Label>
                        <Input
                            id="sales_date"
                            type="date"
                            value={formData.sales_date}
                            onChange={(e) => handleChange('sales_date', e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="customer_id">Customer</Label>
                        <Select
                            value={formData.customer_id}
                            onValueChange={(value) => {
                                const customer = customers.find(c => c.id === value);
                                setFormData((prev: any) => ({
                                    ...prev,
                                    customer_id: value,
                                    customer_name: customer?.name || '',
                                    credit_days: customer?.credit_days ?? prev.credit_days ?? 0,
                                }));
                            }}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select Customer" />
                            </SelectTrigger>
                            <SelectContent>
                                {customers?.map((customer) => (
                                    <SelectItem key={customer.id} value={customer.id}>
                                        {customer.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="godown_no">Godown</Label>
                        <Select
                            value={formData.godown_no}
                            onValueChange={(value) => handleChange('godown_no', value)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select Godown" />
                            </SelectTrigger>
                            <SelectContent>
                                {godowns.map((godown) => (
                                    <SelectItem key={godown.id} value={godown.id}>
                                        {godown.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Quantity Unit</Label>
                        <QuantityUnitSelect
                            value={formData.unit || DEFAULT_QUANTITY_UNIT}
                            onChange={handleUnitChange}
                            size="md"
                        />
                        <p className="text-xs text-muted-foreground">
                            Applies to all rolls on this bill
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="maker">Maker</Label>
                        <Input
                            id="maker"
                            value={formData.maker}
                            onChange={(e) => handleChange('maker', e.target.value)}
                            placeholder="Enter maker name"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => handleChange('description', e.target.value)}
                        placeholder="Enter any additional details"
                        rows={3}
                    />
                </div>
            </CardContent>
        </Card>
    );
};

export default SalesDetails; 