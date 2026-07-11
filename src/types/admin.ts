export interface ShippingData {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: string;
  zip?: string;
  city?: string;
}

export interface OrderItem {
  id: number;
  product_name?: string;
  quantity: number;
  price: number;
}

export interface OrderNote {
  id: number;
  note: string;
  is_customer_note: boolean;
  created_by: string;
  created_at: string;
}

export type OrderStatus = 'pending' | 'processing' | 'completed' | 'cancelled';
export type DropshippingStatus = 'not_sent' | 'pending_bihr' | 'shipped' | 'cancelled';

export interface Order {
  id: number;
  status: OrderStatus;
  createdAt: string;
  paymentId?: string;
  stripe_charge_id?: string;
  refunded_amount?: number;
  invoiceNumber?: string;
  subtotal: number;
  shippingCost: number;
  discountAmount: number;
  total: number;
  dropshippingStatus: DropshippingStatus;
  trackingNumber?: string;
  trackingUrl?: string;
  bihrTicketId?: string;
  shippingData: ShippingData;
  items: OrderItem[];
}

export interface ProductImage {
  src: string;
  url?: string;
  alt?: string;
}

export interface ProductCompatibilityEntry {
  brand: string;
  model: string;
  year?: string;
}

export type ProductStatus = 'published' | 'draft' | 'out_of_stock';

export interface LinkedProduct {
  id: number;
  name: string;
  sku: string;
}

export interface Product {
  id: number;
  name: string;
  sku: string;
  description?: string;
  price: number;
  sale_price?: number;
  cost?: number;
  stock: number;
  status: ProductStatus;
  images: ProductImage[] | string;
  compatibility: ProductCompatibilityEntry[] | string;
  brand?: string;
  barcode?: string;
  supplier_code?: string;
  weight_g?: number;
  length_mm?: number;
  width_mm?: number;
  height_mm?: number;
  dropshipping: boolean;
  ondemand: boolean;
  delivery_plant?: string;
  category_id?: number;
  category2_id?: number;
  category3_id?: number;
  category2?: string;
  category3?: string;
  created_at?: string;
  type: 'simple' | 'variable';
  upsells?: LinkedProduct[];
  crossSells?: LinkedProduct[];
}

export interface VariationAttribute {
  attribute_id: number;
  term_id: number;
}

export interface Variation {
  id: number;
  sku?: string;
  price?: string;
  stock_quantity?: number;
  stock_status: 'instock' | 'outofstock';
  attributes: VariationAttribute[];
}

export type UserRole = 'customer' | 'admin';

export interface UserBilling {
  address_1?: string;
  city?: string;
  postcode?: string;
  phone?: string;
}

export interface User {
  id: number;
  firstName?: string;
  lastName?: string;
  email: string;
  role: UserRole;
  billing?: UserBilling | string;
  phone?: string;
  address?: string;
  city?: string;
  postcode?: string;
  createdAt?: string;
}

export type CouponType = 'percent' | 'fixed' | 'free_shipping';

export interface Coupon {
  id: number;
  code: string;
  type: CouponType;
  value: number;
  times_used: number;
  max_uses: number;
  expires_at?: string;
  active: boolean;
}

export interface CartItem {
  id: number;
  name?: string;
  title?: string;
  sku?: string;
  price: number;
  quantity: number;
}

export interface Cart {
  id: number;
  userId?: number;
  userEmail?: string;
  userFirstName?: string;
  userLastName?: string;
  userUsername?: string;
  sessionToken: string;
  updatedAt: string;
  isDeleted: 0 | 1;
  items: CartItem[];
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  parent_id?: number;
  depth: number;
  product_count?: number;
}

export interface VehicleBrand {
  id: number;
  name: string;
}

export interface VehicleModel {
  id: number;
  name: string;
  brand_name: string;
  brand_id: number;
}

export interface AttributeTerm {
  id: number;
  name: string;
}

export interface GlobalAttribute {
  id: number;
  name: string;
  terms: AttributeTerm[];
}

export interface SeoLink {
  id: number;
  keyword: string;
  url: string;
  active: boolean;
}

export interface AdminSession {
  user_id?: string;
  user_email?: string;
  wp_id?: string;
  email?: string;
  user?: {
    id?: string;
    emailAddresses?: { emailAddress: string }[];
    publicMetadata?: { wp_id?: string };
  };
}
