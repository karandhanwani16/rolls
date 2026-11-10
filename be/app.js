const paymentInRoutes = require('./routes/paymentInRoutes');
const transactionsRoutes = require('./routes/transactionsRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

// Routes
app.use('/api/payments-in', paymentInRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/dashboard', dashboardRoutes);