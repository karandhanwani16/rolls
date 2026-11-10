import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { 
  CalendarIcon, 
  ArrowUpRight,
  ArrowDownRight,
  Download,
  DollarSign,
  CreditCard,
  Package,
  Users,
  Activity,
  TrendingUp,
  TrendingDown,
  ChevronDown
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { dashboardAPI } from "@/services/api";
import { DateRange } from "react-day-picker";
import { Progress } from "@/components/ui/progress";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  ChartTooltip,
  Legend,
  ArcElement
);

const months = [
  { value: "0", label: "January" },
  { value: "1", label: "February" },
  { value: "2", label: "March" },
  { value: "3", label: "April" },
  { value: "4", label: "May" },
  { value: "5", label: "June" },
  { value: "6", label: "July" },
  { value: "7", label: "August" },
  { value: "8", label: "September" },
  { value: "9", label: "October" },
  { value: "10", label: "November" },
  { value: "11", label: "December" },
];

const years = Array.from({ length: 5 }, (_, i) => {
  const year = new Date().getFullYear() - i;
  return { value: year.toString(), label: year.toString() };
});

const Dashboard = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [previousMonthData, setPreviousMonthData] = useState<any>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().getMonth().toString());
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());

  useEffect(() => {
    fetchDashboardData();
  }, [selectedMonth, selectedYear]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const currentDate = new Date(parseInt(selectedYear), parseInt(selectedMonth));
      const startDate = startOfMonth(currentDate);
      const endDate = endOfMonth(currentDate);
      const previousStartDate = startOfMonth(subMonths(currentDate, 1));
      const previousEndDate = endOfMonth(subMonths(currentDate, 1));

      const [currentData, previousData] = await Promise.all([
        dashboardAPI.getData(
          format(startDate, 'yyyy-MM-dd'),
          format(endDate, 'yyyy-MM-dd')
        ),
        dashboardAPI.getData(
          format(previousStartDate, 'yyyy-MM-dd'),
          format(previousEndDate, 'yyyy-MM-dd')
        )
      ]);

      setDashboardData(currentData.data);
      setPreviousMonthData(previousData.data);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const calculatePercentageChange = (current: number, previous: number) => {
    if (previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  };

  const getTrendIcon = (value: number) => {
    return value >= 0 ? (
      <ArrowUpRight className="h-4 w-4 text-emerald-500" />
    ) : (
      <ArrowDownRight className="h-4 w-4 text-rose-500" />
    );
  };

  const getPaymentChartData = () => {
    if (!dashboardData) return null;
    
    return {
      labels: ['Online', 'Cash', 'Cheque'],
      datasets: [
        {
          data: [
            dashboardData.summary.onlineTransfers || 0,
            dashboardData.summary.cashPayments || 0,
            dashboardData.summary.chequePayments || 0,
          ],
          backgroundColor: [
            'rgba(16, 185, 129, 0.2)',
            'rgba(59, 130, 246, 0.2)',
            'rgba(245, 158, 11, 0.2)',
          ],
          borderColor: [
            'rgb(16, 185, 129)',
            'rgb(59, 130, 246)',
            'rgb(245, 158, 11)',
          ],
          borderWidth: 1,
        },
      ],
    };
  };

  const getSalesTrendData = () => {
    if (!dashboardData) return null;
    
    return {
      labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
      datasets: [
        {
          label: 'Sales',
          data: [12000, 19000, 15000, 25000],
          borderColor: 'rgb(16, 185, 129)',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.1,
          fill: true,
        },
      ],
    };
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">Overview of your business performance</p>
          </div>
          <div className="flex gap-2">
            <div className="flex gap-2">
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month) => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year.value} value={year.value}>
                      {year.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        ) : dashboardData && previousMonthData ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(dashboardData.summary.totalSales)}</div>
                  <div className="flex items-center gap-1 mt-2">
                    {getTrendIcon(calculatePercentageChange(
                      dashboardData.summary.totalSales,
                      previousMonthData.summary.totalSales
                    ))}
                    <span className="text-sm text-muted-foreground">
                      {Math.abs(calculatePercentageChange(
                        dashboardData.summary.totalSales,
                        previousMonthData.summary.totalSales
                      )).toFixed(1)}% from last month
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Purchases</CardTitle>
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(dashboardData.summary.totalPurchases)}</div>
                  <div className="flex items-center gap-1 mt-2">
                    {getTrendIcon(calculatePercentageChange(
                      dashboardData.summary.totalPurchases,
                      previousMonthData.summary.totalPurchases
                    ))}
                    <span className="text-sm text-muted-foreground">
                      {Math.abs(calculatePercentageChange(
                        dashboardData.summary.totalPurchases,
                        previousMonthData.summary.totalPurchases
                      )).toFixed(1)}% from last month
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(dashboardData.summary.netProfit)}</div>
                  <div className="flex items-center gap-1 mt-2">
                    {getTrendIcon(calculatePercentageChange(
                      dashboardData.summary.netProfit,
                      previousMonthData.summary.netProfit
                    ))}
                    <span className="text-sm text-muted-foreground">
                      {Math.abs(calculatePercentageChange(
                        dashboardData.summary.netProfit,
                        previousMonthData.summary.netProfit
                      )).toFixed(1)}% from last month
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Cash Flow</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(
                      dashboardData.summary.totalPaymentsIn - dashboardData.summary.totalPaymentsOut
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-2">
                    {getTrendIcon(calculatePercentageChange(
                      dashboardData.summary.totalPaymentsIn - dashboardData.summary.totalPaymentsOut,
                      previousMonthData.summary.totalPaymentsIn - previousMonthData.summary.totalPaymentsOut
                    ))}
                    <span className="text-sm text-muted-foreground">
                      {Math.abs(calculatePercentageChange(
                        dashboardData.summary.totalPaymentsIn - dashboardData.summary.totalPaymentsOut,
                        previousMonthData.summary.totalPaymentsIn - previousMonthData.summary.totalPaymentsOut
                      )).toFixed(1)}% from last month
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Sales</CardTitle>
                  <CardDescription>Latest transactions</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice No.</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dashboardData.recentSales.map((sale: any) => (
                        <TableRow key={sale.id}>
                          <TableCell>{sale.sales_no}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={sale.customer?.avatar} />
                                <AvatarFallback>{sale.customer?.name?.charAt(0)}</AvatarFallback>
                              </Avatar>
                              <span>{sale.customer?.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(sale.total)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Purchases</CardTitle>
                  <CardDescription>Latest supplier transactions</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Purchase No.</TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dashboardData.recentPurchases.map((purchase: any) => (
                        <TableRow key={purchase.id}>
                          <TableCell>{purchase.purchase_no}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={purchase.supplier?.avatar} />
                                <AvatarFallback>{purchase.supplier?.name?.charAt(0)}</AvatarFallback>
                              </Avatar>
                              <span>{purchase.supplier?.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(purchase.total)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

          </>
        ) : null}
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
