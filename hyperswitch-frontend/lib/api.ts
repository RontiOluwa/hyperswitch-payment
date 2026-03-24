const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

const apiFetch = async <T>(
  path: string,
  token: string,
  options: RequestInit = {}
): Promise<T> => {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message ?? 'Request failed');
  }

  return data;
};

export const createPaymentIntent = async (
  token: string,
  payload: {
    orderId: string;
    amount: number;
    currency: string;
  }
) => {
  // No customerId here — Gateway extracts it from JWT
  return apiFetch<{
    success: boolean;
    data: {
      id: string;
      clientSecret: string;
      hyperswitchPaymentId: string;
      amount: number;
      currency: string;
      status: string;
    };
  }>('/api/v1/payments', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const getPaymentIntent = async (token: string, id: string) => {
  return apiFetch<{
    success: boolean;
    data: {
      id: string;
      status: string;
      amount: number;
      currency: string;
      orderId: string;
    };
  }>(`/api/v1/payments/${id}`, token);
};

export const listOrders = async (token: string) => {
  return apiFetch<{
    orders: Array<{
      id: string;
      status: string;
      payment_status: string;
      total: number;
      currency_code: string;
      created_at: string;
      items: Array<{
        id: string;
        title: string;
        quantity: number;
        unit_price: number;
      }>;
    }>;
    count: number;
    offset: number;
    limit: number;
  }>('/api/v1/orders', token);
};

export const getOrder = async (token: string, id: string) => {
  return apiFetch<{
    order: {
      id: string;
      status: string;
      payment_status: string;
      fulfillment_status: string;
      total: number;
      currency_code: string;
      created_at: string;
      items: Array<{
        id: string;
        title: string;
        quantity: number;
        unit_price: number;
        total: number;
      }>;
      shipping_address: {
        first_name: string;
        last_name: string;
        address_1: string;
        city: string;
        country_code: string;
      };
    };
  }>(`/api/v1/orders/${id}`, token);
};