<?php
// =====================================================
// Create Product API (Admin Only)
// =====================================================

require_once __DIR__ . '/../../backend/config/cors.php';
require_once __DIR__ . '/../../backend/config/database.php';
require_once __DIR__ . '/../../backend/utils/response.php';
require_once __DIR__ . '/../../backend/utils/supabase.php';
require_once __DIR__ . '/../../backend/middleware/auth.php';

// Only accept POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method not allowed', 405);
}

// Verify admin access
$user = Auth::requireAdmin();

// Get POST data
$data = json_decode(file_get_contents('php://input'), true);

// Validate required fields
$required = ['title', 'price', 'category'];
foreach ($required as $field) {
    if (!isset($data[$field]) || empty($data[$field])) {
        Response::error("Field '{$field}' is required");
    }
}

try {
    $db = Database::getInstance()->getConnection();
    
    // Generate SKU if not provided
    $sku = isset($data['sku']) ? $data['sku'] : 'PROD-' . strtoupper(substr(md5(time()), 0, 8));
    
    // Insert product
    $stmt = $db->prepare("
        INSERT INTO products (title, description, price, category, sku, image_url, is_featured, allow_preorder, is_active)
        VALUES (:title, :description, :price, :category, :sku, :image_url, :is_featured, :allow_preorder, 1)
    ");
    
    // Use the first image in the array as the primary image_url if provided
    $primaryImage = null;
    if (isset($data['images']) && is_array($data['images']) && !empty($data['images'])) {
        $primaryImage = $data['images'][0];
    } elseif (isset($data['image_url'])) {
        $primaryImage = $data['image_url'];
    }

    $stmt->execute([
        'title' => $data['title'],
        'description' => $data['description'] ?? '',
        'price' => $data['price'],
        'category' => $data['category'],
        'sku' => $sku,
        'image_url' => $primaryImage,
        'is_featured' => isset($data['is_featured']) ? (int)$data['is_featured'] : 0,
        'allow_preorder' => isset($data['allow_preorder']) ? (int)$data['allow_preorder'] : 0
    ]);
    
    $productId = $db->lastInsertId();
    
    // Save images to product_images table
    if (isset($data['images']) && is_array($data['images'])) {
        $imgStmt = $db->prepare("INSERT INTO product_images (product_id, image_url, is_main) VALUES (:product_id, :image_url, :is_main)");
        foreach ($data['images'] as $index => $url) {
            $imgStmt->execute([
                'product_id' => $productId,
                'image_url' => $url,
                'is_main' => ($index === 0) ? 1 : 0
            ]);
        }
    } elseif ($primaryImage) {
        $imgStmt = $db->prepare("INSERT INTO product_images (product_id, image_url, is_main) VALUES (:product_id, :image_url, 1)");
        $imgStmt->execute([
            'product_id' => $productId,
            'image_url' => $primaryImage
        ]);
    }

    // Create initial inventory record
    $invStmt = $db->prepare("
        INSERT INTO inventory (product_id, quantity)
        VALUES (:product_id, :quantity)
    ");
    $invStmt->execute([
        'product_id' => $productId,
        'quantity' => $data['initial_stock'] ?? 0
    ]);
    
    // Get the created product
    $getStmt = $db->prepare("SELECT * FROM products WHERE id = :id");
    $getStmt->execute(['id' => $productId]);
    $product = $getStmt->fetch();

    // Sync to Supabase in background/REST
    try {
        $images = isset($data['images']) && is_array($data['images']) ? $data['images'] : ($primaryImage ? [$primaryImage] : []);
        $stock = isset($data['initial_stock']) ? (int)$data['initial_stock'] : 0;
        SupabaseClient::getInstance()->syncFullProduct($product, $images, $stock);
    } catch (Throwable $syncEx) {
        error_log("[ProductCreate] Supabase sync error: " . $syncEx->getMessage());
    }
    
    Response::success($product, 'Product created successfully', 201);
    
} catch (PDOException $e) {
    if ($e->getCode() == 23000) {
        Response::error('Product with this SKU already exists', 409);
    }
    Response::error('Failed to create product: ' . $e->getMessage(), 500);
}
