
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReportLayoutProps {
  title: string;
  description: string;
  children: React.ReactNode;
  onDateChange?: (startDate: Date | undefined, endDate: Date | undefined) => void;
  onExport?: () => void;
}

export default function ReportLayout({ 
  title, 
  description, 
  children, 
  onDateChange,
  onExport
}: ReportLayoutProps) {
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState<Date | undefined>(
    new Date(new Date().setDate(1)) // First day of current month
  );
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const handleStartDateSelect = (date: Date | undefined) => {
    setStartDate(date);
    if (endDate && date && date > endDate) {
      setEndDate(date);
    }
    if (date && endDate) {
      if (onDateChange) onDateChange(date, endDate);
      setDatePickerOpen(false);
    }
  };

  const handleEndDateSelect = (date: Date | undefined) => {
    setEndDate(date);
    if (date && startDate) {
      if (onDateChange) onDateChange(startDate, date);
      setDatePickerOpen(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
            <p className="text-gray-600">{description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            
            {onExport && (
              <Button onClick={onExport} variant="outline">
                Export
              </Button>
            )}
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            {children}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
