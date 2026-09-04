<?php
// =====================================================
// Get All Products API
// =====================================================

require_once __DIR__ . '/../../backend/config/cors.php';
require_once __DIR__ . '/../../backend/config/database.php';
require_once __DIR__ . '/../../backend/utils/response.php';
require_once __DIR__ . '/../../backend/utils/supabase.php';

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
    
    // Check if preorder_only is requested
    if (isset($_GET['preorder_only'])) {
        $preorderMode = 'off';
        try {
            // Check Supabase first for real-time toggle from mobile app
            $sup = SupabaseClient::getInstance();
            $supRes = $sup->request('GET', 'settings?setting_key=eq.pre_order_mode&select=setting_value');
            if (!empty($supRes['data'][0]['setting_value'])) {
                $preorderMode = strtolower($supRes['data'][0]['setting_value']);
            }
        } catch (Throwable $e) {}

        if ($preorderMode === 'off') {
            // Fallback to local DB
            try {
                $setStmt = $db->query("SELECT setting_value FROM settings WHERE setting_key = 'pre_order_mode'");
                $setRow = $setStmt->fetch();
                if ($setRow && strtolower($setRow['setting_value']) === 'on') {
                    $preorderMode = 'on';
                }
            } catch (Throwable $e) {}
        }

        // If pre-order mode is disabled globally, return empty immediately
        if ($preorderMode !== 'on') {
            Response::success([], 'Pre-order mode is currently disabled');
            exit;
        }
    }

    // Build query
    $sql = "
        SELECT 
            p.*,
            COALESCE(SUM(i.quantity), 0) as total_stock
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
        // When pre_order_mode is ON: check if specific products are flagged
        $countExplicit = (int)$db->query("SELECT COUNT(*) FROM products WHERE allow_preorder = 1 AND is_active = 1")->fetchColumn();
        if ($countExplicit > 0) {
            $sql .= " AND p.allow_preorder = 1 AND p.is_active = 1";
        } else {
            // If none explicitly marked, show active products in the pre-order showcase
            $sql .= " AND p.is_active = 1";
        }
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
