<?php
// =====================================================
// Get All Products API
// =====================================================

require_once __DIR__ . '/../../backend/config/cors.php';
require_once __DIR__ . '/../../backend/config/database.php';
require_once __DIR__ . '/../../backend/utils/response.php';

// Only accept GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    Response::error('Method not allowed', 405);
}

try {
    $db = Database::getInstance()->getConnection();
    
    // Get query parameters
    $category = isset($_GET['category']) ? $_GET['category'] : null;
    $search = isset($_GET['search']) ? $_GET['search'] : null;
    $active_only = isset($_GET['active_only']) ? filter_var($_GET['active_only'], FILTER_VALIDATE_BOOLEAN) : true;
    
    // Build query
    $sql = "
        SELECT 
            p.*,
            IFNULL(SUM(i.quantity), 0) as total_stock
        FROM products p
        LEFT JOIN inventory i ON p.id = i.product_id
        WHERE 1=1
    ";
    
    $params = [];
    
    if ($category) {
        $sql .= " AND p.category = :category";
        $params['category'] = $category;
    }
    
    if ($search) {
        $sql .= " AND (p.title LIKE :search OR p.description LIKE :search OR p.sku LIKE :search)";
        $params['search'] = '%' . $search . '%';
    }
    
    if ($active_only && !isset($_GET['preorder_only'])) {
        $sql .= " AND p.is_active = 1";
    }

    if (isset($_GET['preorder_only'])) {
        // Also enforce is_active so hidden products don't leak publicly
        $sql .= " AND p.allow_preorder = 1 AND p.is_active = 1";
    }
    
    $sql .= " GROUP BY p.id ORDER BY p.created_at DESC";
    
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $products = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (!empty($products)) {
        $productIds = array_column($products, 'id');
        $placeholders = implode(',', array_fill(0, count($productIds), '?'));
        
        $imgStmt = $db->prepare("SELECT id, product_id, image_url as url, is_main FROM product_images WHERE product_id IN ($placeholders)");
        $imgStmt->execute($productIds);
        $images = $imgStmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Map images to products
        $imageMap = [];
        foreach ($images as $img) {
            $productId = $img['product_id'];
            if (!isset($imageMap[$productId])) {
                $imageMap[$productId] = [];
            }
            $imageMap[$productId][] = $img;
        }
        
        foreach ($products as &$product) {
            $product['images'] = $imageMap[$product['id']] ?? [];
        }
    }
    
    Response::success($products, 'Products retrieved successfully');
    
} catch (PDOException $e) {
    Response::error('Failed to retrieve products: ' . $e->getMessage(), 500);
}
