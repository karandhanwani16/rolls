import axios from 'axios';

const API_URL =
  window.electronAPI?.getApiUrl?.() ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:3000';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth-token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Add response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestUrl = error.config?.url || '';
    const isAuthRequest = requestUrl.includes('/auth/login') || requestUrl.includes('/auth/register');

    // A full page load of /login 404s on Vercel unless SPA rewrites exist.
    // Skip login/register so a failed sign-in does not bounce the user.
    if (error.response?.status === 401 && !isAuthRequest) {
      localStorage.removeItem('auth-token');
      localStorage.removeItem('user-data');
      const hashRouter =
        window.location.protocol === 'file:' || Boolean(window.electronAPI);
      if (hashRouter) {
        if (!window.location.hash.startsWith('#/login')) {
          window.location.hash = '#/login';
        }
      } else if (window.location.pathname !== '/login') {
        window.location.assign('/login');
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },
  logout: async () => {
    const response = await api.post('/auth/logout');
    return response.data;
  },
  changePassword: async (newPassword: string) => {
    const response = await api.post('/auth/change-password', { newPassword });
    return response.data;
  },
};

// Profile API
export const profileAPI = {
  getProfile: async () => {
    const response = await api.get('/profile');
    return response.data;
  },
};

// Customers API
export const customersAPI = {
  getAll: async () => {
    const response = await api.get('/customers');
    return response.data.data;
  },
  create: async (data: any) => {
    const response = await api.post('/customers', data);
    return response.data;
  },
  update: async (id: string, data: any) => {
    const response = await api.put(`/customers/${id}`, data);
    return response.data;
  },
  delete: async (id: string) => {
    const response = await api.delete(`/customers/${id}`);
    return response.data;
  },
  getSalesAndPayments: async ({ customerIds, startDate, endDate, customerType }: { customerIds: string[], startDate: string, endDate: string, customerType: string }) => {
    const response = await api.get(`/customers/sales-and-payments`, {
      params: {
        customerIds: customerIds.join(','),
        startDate,
        endDate,
        customerType
      }
    });
    return response.data;
  }

};

// Suppliers API
export const suppliersAPI = {
  getPurchasesAndPayments: async ({ supplierIds, startDate, endDate }: { supplierIds: string[], startDate: string, endDate: string }) => {
    const response = await api.get('/suppliers/purchases-and-payments', {
      params: {
        supplierIds: supplierIds.join(','),
        startDate,
        endDate
      }
    });
    return response.data;
  },

  getAll: async () => {
    const response = await api.get('/suppliers');
    return response.data.data;
  },
  create: async (data: any) => {
    const response = await api.post('/suppliers', data);
    return response.data;
  },
  update: async (id: string, data: any) => {
    const response = await api.put(`/suppliers/${id}`, data);
    return response.data;
  },
  delete: async (id: string) => {
    const response = await api.delete(`/suppliers/${id}`);
    return response.data;
  },
};

// Godowns API
export const godownsAPI = {
  getAll: async () => {
    const response = await api.get('/godowns');
    return response.data.data;
  },
  create: async (data: any) => {
    const response = await api.post('/godowns', data);
    return response.data;
  },
  update: async (id: string, data: any) => {
    const response = await api.put(`/godowns/${id}`, data);
    return response.data;
  },
  delete: async (id: string) => {
    const response = await api.delete(`/godowns/${id}`);
    return response.data;
  },
};

// Dashboard API
export const dashboardAPI = {
  getData: async (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const response = await api.get(`/dashboard?${params.toString()}`);
    return response.data;
  },
};

// Sales API
export const salesAPI = {
  getAll: async (params?: { customer_id?: string }) => {
    const response = await api.get('/sales', { params });
    return response.data;
  },
  getById: async (id: string) => {
    const response = await api.get(`/sales/${id}`);
    return response.data.data;
  },
  // getInvoice: async (id: string) => {
  //   const response = await api.get(`/sales/invoice/${id}`);
  //   return response.data;
  // },
  getInvoice: async (id: string) => {
    const response = await api.get(`/sales/invoice/${id}`, {
      responseType: 'arraybuffer',
      headers: {
        'Accept': 'application/pdf',
      }
    });
    return response.data;
  },
  getInvoiceHTML: async (
    id: string,
    type: "bill" | "challan" = "bill",
    options?: { showInterestNote?: boolean }
  ) => {
    const response = await api.get(`/sales/invoice-html/${id}`, {
      params: {
        type,
        ...(options?.showInterestNote ? { showInterestNote: "true" } : {}),
      },
    });
    return response.data;
  },
  getNextSalesNumber: async (date: string) => {
    const response = await api.get(`/sales/next-number?date=${date}`);
    return response.data;
  },

  create: async (data: any) => {
    const response = await api.post('/sales', data);
    return response.data;
  },
  update: async (id: string, data: any) => {
    const response = await api.put(`/sales/${id}`, data);
    return response.data;
  },
  delete: async (id: string) => {
    const response = await api.delete(`/sales/${id}`);
    return response.data;
  },
};

export const salesReturnsAPI = {
  getAll: async () => {
    const response = await api.get('/sales-returns');
    return response.data;
  },
  getById: async (id: string) => {
    const response = await api.get(`/sales-returns/${id}`);
    return response.data.data;
  },
  getNextNumber: async (date: string) => {
    const response = await api.get(`/sales-returns/next-number?date=${date}`);
    return response.data;
  },
  create: async (data: any) => {
    const response = await api.post('/sales-returns', data);
    return response.data;
  },
  update: async (id: string, data: any) => {
    const response = await api.put(`/sales-returns/${id}`, data);
    return response.data;
  },
  delete: async (id: string) => {
    const response = await api.delete(`/sales-returns/${id}`);
    return response.data;
  },
};

export const purchaseReturnsAPI = {
  getAll: async () => {
    const response = await api.get('/purchase-returns');
    return response.data;
  },
  getById: async (id: string) => {
    const response = await api.get(`/purchase-returns/${id}`);
    return response.data.data;
  },
  getNextNumber: async (date: string) => {
    const response = await api.get(`/purchase-returns/next-number?date=${date}`);
    return response.data;
  },
  create: async (data: any) => {
    const response = await api.post('/purchase-returns', data);
    return response.data;
  },
  update: async (id: string, data: any) => {
    const response = await api.put(`/purchase-returns/${id}`, data);
    return response.data;
  },
  delete: async (id: string) => {
    const response = await api.delete(`/purchase-returns/${id}`);
    return response.data;
  },
};

// Purchases API
export const purchasesAPI = {
  getAll: async (params?: { supplier_id?: string }) => {
    const response = await api.get('/purchases', { params });
    return response.data;
  },
  getById: async (id: string) => {
    const response = await api.get(`/purchases/${id}`);
    return response.data.data;
  },
  getRollsByProductId: async (productId: string) => {
    const response = await api.get(`/purchases/rolls/${productId}`);
    return response.data.data;
  },
  getSoldRollsByProductId: async (productId: string) => {
    const response = await api.get(`/purchases/sold-rolls/${productId}`);
    return response.data.data;
  },
  getReport: async ({ supplierIds, startDate, endDate }: { supplierIds: string[], startDate: string, endDate: string }) => {
    const response = await api.get('/purchases/report', {
      params: {
        supplierIds: supplierIds.join(','),
        startDate,
        endDate
      }
    });
    return response.data;
  },
  create: async (data: any) => {
    const response = await api.post('/purchases', data);
    return response.data;
  },
  update: async (id: string, data: any) => {
    const response = await api.put(`/purchases/${id}`, data);
    return response.data;
  },
  delete: async (id: string) => {
    const response = await api.delete(`/purchases/${id}`);
    return response.data;
  },
};

// Purchase Items API
export const purchaseItemsAPI = {
  getByPurchaseId: async (purchaseId: string) => {
    const response = await api.get(`/purchase-items/purchase/${purchaseId}`);
    return response.data.data;
  },
  create: async (data: any) => {
    const response = await api.post('/purchase-items', data);
    return response.data;
  },
  update: async (id: string, data: any) => {
    const response = await api.put(`/purchase-items/${id}`, data);
    return response.data;
  },
  delete: async (id: string) => {
    const response = await api.delete(`/purchase-items/${id}`);
    return response.data;
  },
};

// Payments API
export const paymentsInAPI = {
  getAll: async () => {
    const response = await api.get('/payments-in');
    return response.data;
  },
  getWatavReport: async ({
    startDate,
    endDate,
    watavCustomerId,
    collectionStatus,
    entryType,
  }: {
    startDate?: string;
    endDate?: string;
    watavCustomerId?: string;
    collectionStatus?: string;
    entryType?: string;
  }) => {
    const response = await api.get('/payments-in/watav-report', {
      params: {
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
        ...(watavCustomerId ? { watavCustomerId } : {}),
        ...(collectionStatus ? { collectionStatus } : {}),
        ...(entryType ? { entryType } : {}),
      },
    });
    return response.data;
  },
  collect: async (data: { ids: string[]; collection_date?: string }) => {
    const response = await api.post('/payments-in/collect', data);
    return response.data;
  },
  uncollect: async (data: { ids: string[] }) => {
    const response = await api.post('/payments-in/uncollect', data);
    return response.data;
  },
  getWatavReceipts: async ({
    vendorId,
    startDate,
    endDate,
  }: {
    vendorId?: string;
    startDate?: string;
    endDate?: string;
  } = {}) => {
    const response = await api.get('/payments-in/watav-receipts', {
      params: {
        ...(vendorId ? { vendorId } : {}),
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
      },
    });
    return response.data;
  },
  getWatavReceipt: async (id: string) => {
    const response = await api.get(`/payments-in/watav-receipts/${id}`);
    return response.data;
  },
  createWatavReceipt: async (data: {
    vendor_id: string;
    amount: number;
    receipt_date?: string | Date;
    type?: string;
    reference?: string;
    description?: string;
  }) => {
    const response = await api.post('/payments-in/watav-receipts', data);
    return response.data;
  },
  deleteWatavReceipt: async (id: string) => {
    const response = await api.delete(`/payments-in/watav-receipts/${id}`);
    return response.data;
  },
  create: async (data: any) => {
    const response = await api.post('/payments-in', data);
    return response.data;
  },
  update: async (id: string, data: any) => {
    const response = await api.put(`/payments-in/${id}`, data);
    return response.data;
  },
  delete: async (id: string) => {
    const response = await api.delete(`/payments-in/${id}`);
    return response.data;
  },
};

export const paymentsOutAPI = {
  getAll: async () => {
    const response = await api.get('/payments-out');
    return response.data;
  },
  create: async (data: any) => {
    const response = await api.post('/payments-out', data);
    return response.data;
  },
  update: async (id: string, data: any) => {
    const response = await api.put(`/payments-out/${id}`, data);
    return response.data;
  },
  delete: async (id: string) => {
    const response = await api.delete(`/payments-out/${id}`);
    return response.data;
  },
};

// Pending Bills Report API
export const pendingBillsAPI = {
  getCustomerPendingBills: async ({
    partyIds = [],
  }: { partyIds?: string[] } = {}) => {
    const response = await api.get('/pending-bills/customers', {
      params: {
        partyIds: partyIds.length ? partyIds.join(',') : undefined,
      },
    });
    return response.data;
  },
  getSupplierPendingBills: async ({
    partyIds = [],
  }: { partyIds?: string[] } = {}) => {
    const response = await api.get('/pending-bills/suppliers', {
      params: {
        partyIds: partyIds.length ? partyIds.join(',') : undefined,
      },
    });
    return response.data;
  },
};

// Bill to Bill Payment API
export const billPaymentsAPI = {
  getCustomerPayments: async (customerId: string) => {
    const response = await api.get(`/bill-payments/customer/${customerId}`);
    return response.data;
  },
  processPayments: async (data: any) => {
    const response = await api.post('/bill-payments/process', data);
    return response.data;
  },
  getReconciliationData: async (customerId: string) => {
    const response = await api.get(`/bill-payments/reconcile/${customerId}`);
    return response.data;
  },
  getSettlements: async (customerId: string) => {
    const response = await api.get(`/bill-payments/settlements/${customerId}`);
    return response.data;
  }
};

// Supplier Bill to Bill Payment API
export const supplierBillPaymentsAPI = {
  getSupplierPayments: async (supplierId: string) => {
    const response = await api.get(`/supplier-bill-payments/supplier/${supplierId}`);
    return response.data;
  },
  processPayments: async (data: any) => {
    const response = await api.post('/supplier-bill-payments/process', data);
    return response.data;
  },
  getReconciliationData: async (supplierId: string) => {
    const response = await api.get(`/supplier-bill-payments/reconcile/${supplierId}`);
    return response.data;
  },
  getSettlements: async (supplierId: string) => {
    const response = await api.get(`/supplier-bill-payments/settlements/${supplierId}`);
    return response.data;
  },
};

export const productsAPI = {
  getAll: async () => {
    const response = await api.get('/products');
    return response.data.data;
  },
  create: async (data: { name: string; description?: string }) => {
    const response = await api.post('/products', data);
    return response.data;
  },
  update: async (id: string, data: { name: string; description?: string }) => {
    const response = await api.put(`/products/${id}`, data);
    return response.data;
  },
  delete: async (id: string) => {
    const response = await api.delete(`/products/${id}`);
    return response.data;
  },
  getById: async (id: string) => {
    const response = await api.get(`/products/${id}`);
    return response.data;
  },
};

// Rolls API
export const rollsAPI = {
  getByProduct: async (productId: string) => {
    const response = await api.get(`/rolls/product/${productId}`);
    return response.data;
  },
  getDetails: async (rollId: string) => {
    const response = await api.get(`/rolls/${rollId}`);
    return response.data;
  },
};


export const transactionsAPI = {
  getAll: async () => {
    const response = await api.get(`/transactions`);
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/transactions/${id}`);
    return response.data;
  },

  create: async (data: any) => {
    const response = await api.post(`/transactions`, data);
    return response.data;
  },

  update: async (id: string, data: any) => {
    const response = await api.put(`/transactions/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/transactions/${id}`);
    return response.data;
  }
};

export const stockReportAPI = {
  getCustomers: async () => {
    const response = await api.get('/stock-report/customers');
    return response;
  },

  getStockData: async (productIds: string[]) => {
    const response = await api.get('/stock-report/data', {
      params: {
        productIds: productIds.join(',')
      }
    });
    return response;
  },

  exportStockData: async (productIds: string[], format: 'pdf' | 'csv') => {
    const response = await api.get(`/stock-report/export/${format}`, {
      params: {
        productIds: productIds.join(',')
      },
      responseType: 'blob'
    });
    return response;
  }
};

export default api;
