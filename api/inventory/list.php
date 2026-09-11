<?php
// =====================================================
// Get Inventory List API (Staff & Admin)
// =====================================================

require_once __DIR__ . '/../../backend/config/cors.php';
require_once __DIR__ . '/../../backend/config/database.php';
require_once __DIR__ . '/../../backend/utils/response.php';
require_once __DIR__ . '/../../backend/middleware/auth.php';

// Only accept GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    Response::error('Method not allowed', 405);
}

// Verify staff/admin access
$user = Auth::requireStaff();

try {
    $db = Database::getInstance()->getConnection();
    
    // Get query parameters
    $low_stock_only = isset($_GET['low_stock']) ? filter_var($_GET['low_stock'], FILTER_VALIDATE_BOOLEAN) : false;
    $category = isset($_GET['category']) ? $_GET['category'] : null;
    
    // Build query
    $sql = "
        SELECT 
            p.id,
            p.title,
            p.category,
            p.price,
            p.sku,
            p.image_url,
            i.quantity as stock,
            i.reorder_point,
            CASE 
                WHEN i.quantity <= i.reorder_point THEN true
                ELSE false
            END as is_low_stock
        FROM products p
        LEFT JOIN inventory i ON p.id = i.product_id
        WHERE p.is_active = 1
    ";
    
    $params = [];
    
    if ($category) {
        $sql .= " AND p.category = :category";
        $params['category'] = $category;
    }
    
    if ($low_stock_only) {
        $sql .= " HAVING is_low_stock = true";
    }
    
    $sql .= " ORDER BY i.quantity ASC, p.title ASC";
    
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $inventory = $stmt->fetchAll();
    
    Response::success($inventory, 'Inventory retrieved successfully');
    
} catch (PDOException $e) {
    Response::error('Failed to retrieve inventory: ' . $e->getMessage(), 500);
}
