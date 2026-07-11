import { useApiWithParams } from './useApi';
import type { Order } from '../types/admin';

export function useOrders(status?: string) {
  return useApiWithParams<{ orders: Order[]; total: number; totalPages: number }>(
    'orders-list',
    { ...(status && status !== 'all' ? { status } : {}) }
  );
}
