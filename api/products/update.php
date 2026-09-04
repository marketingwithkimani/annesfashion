<?php
// =====================================================
// Update Product API (Admin Only)
// =====================================================

require_once __DIR__ . '/../../backend/config/cors.php';
require_once __DIR__ . '/../../backend/config/database.php';
require_once __DIR__ . '/../../backend/utils/response.php';
require_once __DIR__ . '/../../backend/utils/supabase.php';
require_once __DIR__ . '/../../backend/middleware/auth.php';

// Only accept PUT requests
if ($_SERVER['REQUEST_METHOD'] !== 'PUT') {
    Response::error('Method not allowed', 405);
}

// Verify admin access
$user = Auth::requireAdmin();

// Get product ID from query parameter
if (!isset($_GET['id'])) {
    Response::error('Product ID is required');
}

$productId = (int)$_GET['id'];

// Get PUT data
$data = json_decode(file_get_contents('php://input'), true);

if (empty($data)) {
    Response::error('No data provided');
}

try {
    $db = Database::getInstance()->getConnection();
    
    // Check if product exists
    $checkStmt = $db->prepare("SELECT id FROM products WHERE id = :id");
    $checkStmt->execute(['id' => $productId]);
    if (!$checkStmt->fetch()) {
        Response::notFound('Product not found');
    }
    
    // Build update query dynamically
    $updateFields = [];
    $params = ['id' => $productId];
    
    $allowedFields = ['title', 'description', 'price', 'category', 'sku', 'image_url', 'is_active', 'is_featured', 'allow_preorder'];
    
    foreach ($allowedFields as $field) {
        if (isset($data[$field])) {
            $updateFields[] = "{$field} = :{$field}";
            $params[$field] = $data[$field];
        }
    }
    
    if (empty($updateFields)) {
        Response::error('No valid fields to update');
    }
    
    $sql = "UPDATE products SET " . implode(', ', $updateFields) . " WHERE id = :id";
    
    $stmt = $db->prepare($sql);
    $stmt->execute($params);

    // Handle images update if provided
    if (isset($data['images']) && is_array($data['images'])) {
        // Delete old images (or we could be more surgical, but this is simpler for now)
        $db->prepare("DELETE FROM product_images WHERE product_id = :id")->execute(['id' => $productId]);
        
        $imgStmt = $db->prepare("INSERT INTO product_images (product_id, image_url, is_main) VALUES (:product_id, :image_url, :is_main)");
        foreach ($data['images'] as $index => $url) {
            $imgStmt->execute([
                'product_id' => $productId,
                'image_url' => $url,
                'is_main' => ($index === 0) ? 1 : 0
            ]);
        }

        // Sync products.image_url with the main image
        if (!empty($data['images'])) {
            $db->prepare("UPDATE products SET image_url = :url WHERE id = :id")->execute([
                'url' => $data['images'][0],
                'id' => $productId
            ]);
        }
    }
    
    // Get updated product
    $getStmt = $db->prepare("SELECT * FROM products WHERE id = :id");
    $getStmt->execute(['id' => $productId]);
    $product = $getStmt->fetch();
    
    // Sync updated product and images to Supabase
    try {
        $images = null;
        if (isset($data['images']) && is_array($data['images'])) {
            $images = $data['images'];
        }
        SupabaseClient::getInstance()->syncFullProduct($product, $images ?? [], null);
    } catch (Throwable $syncEx) {
        error_log("[ProductUpdate] Supabase sync error: " . $syncEx->getMessage());
    }

    Response::success($product, 'Product updated successfully');
    
} catch (PDOException $e) {
    Response::error('Failed to update product: ' . $e->getMessage(), 500);
}
