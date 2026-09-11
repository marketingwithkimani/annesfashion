export interface Env {
  DB: D1Database;
  IMAGES?: R2Bucket;
  FILES?: R2Bucket;
  BACKUPS?: R2Bucket;
  STREAM?: any;
  ENVIRONMENT: string;
  CLOUDFLARE_ACCOUNT_ID: string;
  R2_PUBLIC_DOMAIN?: string;
  API_BASE_URL?: string;
  IMAGES_BASE_URL?: string;
  CORS_ORIGINS?: string;
  STREAM_API_TOKEN?: string;
  JWT_SECRET?: string;
  ADMIN_AUTH_TOKEN?: string;
}

export interface Product {
  id: number;
  title: string;
  description: string | null;
  price: number;
  category: string;
  sku: string | null;
  image_url: string | null;
  media_type: 'image' | 'video';
  media_reference: string | null;
  poster_reference: string | null;
  is_active: number;
  is_archived: number;
  is_featured: number;
  allow_preorder: number;
  created_at: string;
  updated_at: string;
}

export interface ProductMedia {
  id: number;
  product_id: number;
  media_type: 'image' | 'video';
  media_reference: string;
  poster_reference: string | null;
  is_main: number;
  sort_order: number;
  created_at: string;
}

export interface ProductVariant {
  id: number;
  product_id: number;
  size: string | null;
  color: string | null;
  sku: string | null;
  is_active: number;
}

export interface InventoryItem {
  id: number;
  product_id: number;
  variant_id: number | null;
  quantity: number;
  reserved_quantity: number;
  reorder_point: number;
  last_updated: string;
}
