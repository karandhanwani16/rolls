require('dotenv').config();
const { applyDatabaseEnv, describeDatabaseTarget } = require('./config/database');

const databaseUrl = applyDatabaseEnv();
if (!databaseUrl) {
    console.error('DATABASE_PATH, USB_ROOT, or a file DATABASE_URL is required');
    process.exit(1);
}

const express = require('express');
const cors = require('cors');

// Import routes
const authRoutes = require('./routes/authRoutes');
const customerRoutes = require('./routes/customerRoutes');
const supplierRoutes = require('./routes/supplierRoutes');
const godownRoutes = require('./routes/godownRoutes');
const paymentInRoutes = require('./routes/paymentInRoutes');
const paymentOutRoutes = require('./routes/paymentOutRoutes');
const purchaseRoutes = require('./routes/purchaseRoutes');
const saleRoutes = require('./routes/saleRoutes');
const saleReturnRoutes = require('./routes/saleReturnRoutes');
const purchaseReturnRoutes = require('./routes/purchaseReturnRoutes');
const profileRoutes = require('./routes/profileRoutes');
const billToBillPaymentRoutes = require('./routes/billToBillPaymentRoutes');
const supplierBillToBillPaymentRoutes = require('./routes/supplierBillToBillPaymentRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const productRoutes = require('./routes/productRoutes');
const transactionRoutes = require('./routes/transactionsRoutes');
const stockReportRoutes = require('./routes/stockReportRoutes');
const pendingBillsReportRoutes = require('./routes/pendingBillsReportRoutes');
// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Check for required environment variables
if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET environment variable is required');
    process.exit(1);
}

const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:8080')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

app.use(cors({
    origin(origin, callback) {
        if (!origin || origin === 'null' || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 'X-Client-Info']
}));

app.use(express.json());

// Simple logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/godowns', godownRoutes);
app.use('/api/payments-in', paymentInRoutes);
app.use('/api/payments-out', paymentOutRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/sales-returns', saleReturnRoutes);
app.use('/api/purchase-returns', purchaseReturnRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/bill-payments', billToBillPaymentRoutes);
app.use('/api/supplier-bill-payments', supplierBillToBillPaymentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/products', productRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/stock-report', stockReportRoutes);
app.use('/api/pending-bills', pendingBillsReportRoutes);

const prisma = require('./prisma/client');
const { ensureDefaultOwner } = require('./prisma/seed');

let server = null;
let shuttingDown = false;

function listen() {
    server = app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`Database: ${describeDatabaseTarget(databaseUrl)}`);
    });
}

async function start() {
    try {
        await ensureDefaultOwner(prisma);
    } catch (error) {
        console.error('Default owner seed failed:', error.message);
    }
    listen();
}

async function gracefulShutdown(signal) {
    if (shuttingDown) {
        return;
    }
    shuttingDown = true;
    console.log(`${signal}: stopping HTTP server and disconnecting Prisma`);

    const forceTimer = setTimeout(() => {
        console.error('Graceful shutdown timed out, exiting');
        process.exit(1);
    }, 8000);
    if (typeof forceTimer.unref === 'function') {
        forceTimer.unref();
    }

    if (server) {
        if (typeof server.closeIdleConnections === 'function') {
            server.closeIdleConnections();
        }
        await new Promise((resolve) => {
            server.close(() => resolve());
        });
        server = null;
    }

    try {
        await prisma.$disconnect();
        console.log('Prisma disconnected');
    } catch (error) {
        console.error('Prisma disconnect failed:', error);
    }

    clearTimeout(forceTimer);
    process.exit(0);
}

process.on('SIGTERM', () => {
    gracefulShutdown('SIGTERM');
});
process.on('SIGINT', () => {
    gracefulShutdown('SIGINT');
});

start();