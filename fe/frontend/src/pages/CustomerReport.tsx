import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    TextField,
    Button,
    Grid,
    Chip,
    IconButton,
    Tooltip
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { Download as DownloadIcon } from '@mui/icons-material';
import axios from 'axios';
import { format } from 'date-fns';

interface Customer {
    id: number;
    name: string;
    type: string;
}

interface Sale {
    id: number;
    invoice_number: string;
    date: string;
    total_amount: number;
    paid_amount: number;
    balance_amount: number;
    customer_name: string;
    customer_type: string;
}

interface Payment {
    id: number;
    date: string;
    amount: number;
    payment_method: string;
    reference_number: string;
    customer_name: string;
    customer_type: string;
}

const CustomerReport: React.FC = () => {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [selectedCustomers, setSelectedCustomers] = useState<number[]>([]);
    const [startDate, setStartDate] = useState<Date | null>(null);
    const [endDate, setEndDate] = useState<Date | null>(null);
    const [customerType, setCustomerType] = useState<string>('');
    const [sales, setSales] = useState<Sale[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchCustomers();
    }, []);

    const fetchCustomers = async () => {
        try {
            const response = await axios.get('/api/customers');
            setCustomers(response.data.data);
        } catch (error) {
            console.error('Error fetching customers:', error);
        }
    };

    const handleCustomerChange = (event: any) => {
        setSelectedCustomers(event.target.value);
    };

    const handleCustomerTypeChange = (event: any) => {
        setCustomerType(event.target.value);
    };

    const handleSearch = async () => {
        if (selectedCustomers.length === 0) return;

        setLoading(true);
        try {
            const params = new URLSearchParams({
                customerIds: selectedCustomers.join(','),
                ...(startDate && { startDate: format(startDate, 'yyyy-MM-dd') }),
                ...(endDate && { endDate: format(endDate, 'yyyy-MM-dd') }),
                ...(customerType && { customerType })
            });

            const response = await axios.get(`/api/customers/sales-and-payments?${params}`);
            setSales(response.data.data.sales);
            setPayments(response.data.data.payments);
        } catch (error) {
            console.error('Error fetching report data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadPDF = async () => {
        try {
            const params = new URLSearchParams({
                customerIds: selectedCustomers.join(','),
                ...(startDate && { startDate: format(startDate, 'yyyy-MM-dd') }),
                ...(endDate && { endDate: format(endDate, 'yyyy-MM-dd') }),
                ...(customerType && { customerType })
            });

            const response = await axios.get(`/api/customers/report-pdf?${params}`, {
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'customer-report.pdf');
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error('Error downloading PDF:', error);
        }
    };

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" gutterBottom>
                Customer Report
            </Typography>

            <Paper sx={{ p: 2, mb: 3 }}>
                <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} md={3}>
                        <FormControl fullWidth>
                            <InputLabel>Customers</InputLabel>
                            <Select
                                multiple
                                value={selectedCustomers}
                                onChange={handleCustomerChange}
                                renderValue={(selected) => (
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                        {selected.map((value) => (
                                            <Chip
                                                key={value}
                                                label={customers.find(c => c.id === value)?.name}
                                                size="small"
                                            />
                                        ))}
                                    </Box>
                                )}
                            >
                                {customers.map((customer) => (
                                    <MenuItem key={customer.id} value={customer.id}>
                                        {customer.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>

                    <Grid item xs={12} md={2}>
                        <FormControl fullWidth>
                            <InputLabel>Customer Type</InputLabel>
                            <Select
                                value={customerType}
                                onChange={handleCustomerTypeChange}
                                label="Customer Type"
                            >
                                <MenuItem value="">All</MenuItem>
                                <MenuItem value="retail">Retail</MenuItem>
                                <MenuItem value="wholesale">Wholesale</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>

                    <Grid item xs={12} md={2}>
                        <LocalizationProvider dateAdapter={AdapterDateFns}>
                            <DatePicker
                                label="Start Date"
                                value={startDate}
                                onChange={(newValue) => setStartDate(newValue)}
                                slotProps={{ textField: { fullWidth: true } }}
                            />
                        </LocalizationProvider>
                    </Grid>

                    <Grid item xs={12} md={2}>
                        <LocalizationProvider dateAdapter={AdapterDateFns}>
                            <DatePicker
                                label="End Date"
                                value={endDate}
                                onChange={(newValue) => setEndDate(newValue)}
                                slotProps={{ textField: { fullWidth: true } }}
                            />
                        </LocalizationProvider>
                    </Grid>

                    <Grid item xs={12} md={1}>
                        <Button
                            variant="contained"
                            onClick={handleSearch}
                            fullWidth
                            disabled={loading || selectedCustomers.length === 0}
                        >
                            Search
                        </Button>
                    </Grid>
                </Grid>
            </Paper>

            {sales.length > 0 && (
                <>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                        <Typography variant="h6">Sales</Typography>
                        <Tooltip title="Download PDF">
                            <IconButton onClick={handleDownloadPDF} color="primary">
                                <DownloadIcon />
                            </IconButton>
                        </Tooltip>
                    </Box>

                    <TableContainer component={Paper}>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Date</TableCell>
                                    <TableCell>Invoice</TableCell>
                                    <TableCell>Customer</TableCell>
                                    <TableCell>Type</TableCell>
                                    <TableCell align="right">Total Amount</TableCell>
                                    <TableCell align="right">Paid Amount</TableCell>
                                    <TableCell align="right">Balance</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {sales.map((sale) => (
                                    <TableRow key={sale.id}>
                                        <TableCell>{format(new Date(sale.date), 'dd/MM/yyyy')}</TableCell>
                                        <TableCell>{sale.invoice_number}</TableCell>
                                        <TableCell>{sale.customer_name}</TableCell>
                                        <TableCell>{sale.customer_type}</TableCell>
                                        <TableCell align="right">{sale.total_amount.toFixed(2)}</TableCell>
                                        <TableCell align="right">{sale.paid_amount.toFixed(2)}</TableCell>
                                        <TableCell align="right">{sale.balance_amount.toFixed(2)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </>
            )}

            {payments.length > 0 && (
                <>
                    <Typography variant="h6" sx={{ mt: 4, mb: 2 }}>
                        Payments
                    </Typography>

                    <TableContainer component={Paper}>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Date</TableCell>
                                    <TableCell>Customer</TableCell>
                                    <TableCell>Type</TableCell>
                                    <TableCell>Method</TableCell>
                                    <TableCell>Reference</TableCell>
                                    <TableCell align="right">Amount</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {payments.map((payment) => (
                                    <TableRow key={payment.id}>
                                        <TableCell>{format(new Date(payment.date), 'dd/MM/yyyy')}</TableCell>
                                        <TableCell>{payment.customer_name}</TableCell>
                                        <TableCell>{payment.customer_type}</TableCell>
                                        <TableCell>{payment.payment_method}</TableCell>
                                        <TableCell>{payment.reference_number}</TableCell>
                                        <TableCell align="right">{payment.amount.toFixed(2)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </>
            )}
        </Box>
    );
};

export default CustomerReport; 