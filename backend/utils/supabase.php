<?php
// =====================================================
// Supabase REST API Client
// Communicates with Supabase via HTTPS REST API (IPv4 compatible)
// =====================================================

class SupabaseClient {
    private static $instance = null;
    private $url;
    private $secretKey;
    private $publishableKey;

    private function __construct() {
        // Ensure .env is loaded
        $envFile = __DIR__ . '/../../.env';
        if (file_exists($envFile)) {
            $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            foreach ($lines as $line) {
                $line = trim($line);
                if (empty($line) || strpos($line, '#') === 0) continue;
                if (strpos($line, '=') !== false) {
                    list($name, $value) = explode('=', $line, 2);
                    $name = trim($name);
                    $value = trim($value);
                    if (!getenv($name)) {
                        putenv("$name=$value");
                        $_ENV[$name] = $value;
                    }
                }
            }
        }

        $this->url = rtrim(getenv('SUPABASE_URL') ?: '', '/');
        $this->secretKey = getenv('SUPABASE_SECRET_KEY') ?: '';
        $this->publishableKey = getenv('SUPABASE_PUBLISHABLE_KEY') ?: '';
    }

    public static function getInstance(): SupabaseClient {
        if (self::$instance === null) {
            self::$instance = new SupabaseClient();
        }
        return self::$instance;
    }

    public function isConfigured(): bool {
        return !empty($this->url) && !empty($this->secretKey);
    }

    /**
     * Send HTTP request to Supabase REST API
     */
    public function request(string $method, string $path, $data = null, array $customHeaders = []): array {
        if (!$this->isConfigured()) {
            return ['status' => 0, 'error' => 'Supabase URL or Secret Key not configured'];
        }

        $endpoint = $this->url . '/rest/v1/' . ltrim($path, '/');
        $ch = curl_init($endpoint);

        $headers = [
            'apikey: ' . $this->secretKey,
            'Authorization: Bearer ' . $this->secretKey,
            'Content-Type: application/json'
        ];

        foreach ($customHeaders as $h) {
            $headers[] = $h;
        }

        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, strtoupper($method));
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);

        if ($data !== null && in_array(strtoupper($method), ['POST', 'PUT', 'PATCH'])) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, is_string($data) ? $data : json_encode($data));
        }

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($curlError) {
            error_log("[SupabaseClient] cURL Error: " . $curlError);
            return ['status' => 0, 'error' => $curlError, 'data' => null];
        }

        $decoded = json_decode($response, true);
        return [
            'status' => $httpCode,
            'error' => ($httpCode >= 400) ? ($decoded['message'] ?? $response) : null,
            'data' => $decoded
        ];
    }

    /**
     * Upsert a product into public.products table
     */
    public function upsertProduct(array $product): ?array {
        $clean = [
            'title' => $product['title'] ?? '',
            'description' => $product['description'] ?? '',
            'price' => (float)($product['price'] ?? 0),
            'category' => $product['category'] ?? 'general',
            'sku' => $product['sku'] ?? null,
            'image_url' => $product['image_url'] ?? null,
            'is_active' => isset($product['is_active']) ? (bool)$product['is_active'] : true,
            'is_featured' => isset($product['is_featured']) ? (bool)$product['is_featured'] : false,
            'allow_preorder' => isset($product['allow_preorder']) ? (bool)$product['allow_preorder'] : false,
            'updated_at' => date('c')
        ];

        if (!empty($product['id'])) {
            $clean['id'] = (int)$product['id'];
        }

        // Use resolution=merge-duplicates on conflict (id or sku)
        $headers = [
            'Prefer: resolution=merge-duplicates,return=representation'
        ];

        $res = $this->request('POST', 'products', [$clean], $headers);
        if ($res['status'] >= 200 && $res['status'] < 300 && !empty($res['data'])) {
            return is_array($res['data']) && isset($res['data'][0]) ? $res['data'][0] : $res['data'];
        }

        error_log("[SupabaseClient] upsertProduct failed: " . json_encode($res));
        return null;
    }

    /**
     * Update an existing product by ID in public.products
     */
    public function updateProduct(int $productId, array $data): bool {
        $allowed = ['title', 'description', 'price', 'category', 'sku', 'image_url', 'is_active', 'is_featured', 'allow_preorder'];
        $payload = [];
        foreach ($allowed as $f) {
            if (isset($data[$f])) {
                if ($f === 'price') {
                    $payload[$f] = (float)$data[$f];
                } elseif (in_array($f, ['is_active', 'is_featured', 'allow_preorder'])) {
                    $payload[$f] = (bool)$data[$f];
                } else {
                    $payload[$f] = $data[$f];
                }
            }
        }
        $payload['updated_at'] = date('c');

        $headers = ['Prefer: return=representation'];
        $res = $this->request('PATCH', "products?id=eq.{$productId}", $payload, $headers);
        return ($res['status'] >= 200 && $res['status'] < 300);
    }

    /**
     * Sync inventory record for a product in public.inventory
     */
    public function setProductStock(int $productId, int $quantity): bool {
        // Delete existing stock record for product
        $this->request('DELETE', "inventory?product_id=eq.{$productId}");

        // Insert new stock
        $payload = [
            'product_id' => $productId,
            'quantity' => max(0, $quantity),
            'last_updated' => date('c')
        ];

        $res = $this->request('POST', 'inventory', [$payload]);
        return ($res['status'] >= 200 && $res['status'] < 300);
    }

    /**
     * Sync images for a product in public.product_images
     */
    public function setProductImages(int $productId, array $images): bool {
        // Delete existing image records for this product
        $this->request('DELETE', "product_images?product_id=eq.{$productId}");

        if (empty($images)) {
            return true;
        }

        $records = [];
        foreach ($images as $index => $url) {
            if (is_array($url)) {
                $url = $url['url'] ?? ($url['image_url'] ?? '');
            }
            if (!empty($url)) {
                $records[] = [
                    'product_id' => $productId,
                    'image_url' => $url,
                    'is_main' => ($index === 0) ? 1 : 0
                ];
            }
        }

        if (empty($records)) {
            return true;
        }

        $res = $this->request('POST', 'product_images', $records);
        return ($res['status'] >= 200 && $res['status'] < 300);
    }

    /**
     * Complete helper to sync a product, its images, and stock in one call
     */
    public function syncFullProduct(array $product, array $images = [], ?int $stock = null): bool {
        $saved = $this->upsertProduct($product);
        if (!$saved) {
            return false;
        }

        $targetId = $saved['id'] ?? ($product['id'] ?? null);
        if ($targetId) {
            if (!empty($images)) {
                $this->setProductImages($targetId, $images);
            }
            if ($stock !== null) {
                $this->setProductStock($targetId, $stock);
            }
        }

        return true;
    }
}
