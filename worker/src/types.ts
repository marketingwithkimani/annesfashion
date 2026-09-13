export interface Env {
  DB: D1Database;
  IMAGES?: R2Bucket;       // client-production-images — used for ALL media (images + videos + posters)
  FILES?: R2Bucket;        // client-production-files
  BACKUPS?: R2Bucket;      // client-production-backups
  // NOTE: STREAM binding intentionally removed — Cloudflare Stream is inactive.
  // Videos are stored directly in R2 (IMAGES bucket) under products/{id}/video/
  ENVIRONMENT: string;
  CLOUDFLARE_ACCOUNT_ID: string;
  R2_PUBLIC_DOMAIN?: string;
  API_BASE_URL?: string;
  IMAGES_BASE_URL?: string;
  CORS_ORIGINS?: string;
  // R2 S3-compatible credentials for presigned URL generation (set as Worker secrets)
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
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
  media_reference: string | null;   // R2 key or legacy URL
  poster_reference: string | null;  // R2 poster key or legacy URL
  // R2 video metadata columns (added in migration 0003)
  video_key: string | null;          // R2 object key e.g. products/123/video/v1.mp4
  video_url: string | null;          // Resolved public URL
  video_mime_type: string | null;
  video_size_bytes: number | null;
  video_duration_seconds: number | null;
  video_poster_key: string | null;   // R2 poster key
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
  media_reference: string;   // R2 object key or URL
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
