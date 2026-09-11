<?php
// =====================================================
// Analytics Dashboard API (Admin & Staff)
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
    
    $analytics = [];
    
    // 1. Total Sales Today
    $todaySales = $db->query("
        SELECT 
            COUNT(*) as count,
            IFNULL(SUM(total_amount), 0) as total
        FROM sales
        WHERE DATE(created_at) = CURDATE()
    ")->fetch();
    
    $analytics['today'] = [
        'sales_count' => (int)$todaySales['count'],
        'revenue' => (float)$todaySales['total']
    ];
    
    // 2. Total Sales This Month
    $monthSales = $db->query("
        SELECT 
            COUNT(*) as count,
            IFNULL(SUM(total_amount), 0) as total
        FROM sales
        WHERE MONTH(created_at) = MONTH(CURDATE()) 
        AND YEAR(created_at) = YEAR(CURDATE())
    ")->fetch();
    
    $analytics['this_month'] = [
        'sales_count' => (int)$monthSales['count'],
        'revenue' => (float)$monthSales['total']
    ];
    
    // 3. Low Stock Items
    $lowStock = $db->query("
        SELECT COUNT(*) as count
        FROM inventory i
        JOIN products p ON i.product_id = p.id
        WHERE i.quantity <= i.reorder_point
        AND p.is_active = 1
    ")->fetch();
    
    $analytics['low_stock_count'] = (int)$lowStock['count'];
    
    // 4. Total Products
    $totalProducts = $db->query("
        SELECT COUNT(*) as count
        FROM products
        WHERE is_active = 1
    ")->fetch();
    
    $analytics['total_products'] = (int)$totalProducts['count'];
    
    // 5. Recent Sales (Last 5)
    $recentSales = $db->query("
        SELECT id, sale_number, total_amount, payment_method, created_at
        FROM sales
        ORDER BY created_at DESC
        LIMIT 5
    ")->fetchAll();
    
    $analytics['recent_sales'] = $recentSales;
    
    // 6. Top Selling Products (This Month)
    $topProducts = $db->query("
        SELECT 
            p.id,
            p.title,
            p.image_url,
            SUM(si.quantity) as total_sold,
            SUM(si.total_price) as total_revenue
        FROM sale_items si
        JOIN products p ON si.product_id = p.id
        JOIN sales s ON si.sale_id = s.id
        WHERE MONTH(s.created_at) = MONTH(CURDATE())
        AND YEAR(s.created_at) = YEAR(CURDATE())
        GROUP BY p.id
        ORDER BY total_sold DESC
        LIMIT 5
    ")->fetchAll();
    
    $analytics['top_products'] = $topProducts;
    
    // 7. Sales by Payment Method (This Month)
    $paymentBreakdown = $db->query("
        SELECT 
            payment_method,
            COUNT(*) as count,
            SUM(total_amount) as total
        FROM sales
        WHERE MONTH(created_at) = MONTH(CURDATE())
        AND YEAR(created_at) = YEAR(CURDATE())
        GROUP BY payment_method
    ")->fetchAll();
    
    $analytics['payment_breakdown'] = $paymentBreakdown;
    
    // 8. Last 7 Days Sales Chart Data
    $chartData = $db->query("
        SELECT 
            DATE(created_at) as date,
            COUNT(*) as sales_count,
            SUM(total_amount) as revenue
        FROM sales
        WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        GROUP BY DATE(created_at)
        ORDER BY date ASC
    ")->fetchAll();
    
    $analytics['week_chart'] = $chartData;
    
    Response::success($analytics, 'Analytics retrieved successfully');
    
} catch (PDOException $e) {
    Response::error('Failed to retrieve analytics: ' . $e->getMessage(), 500);
}
