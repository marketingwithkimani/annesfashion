<?php
// =====================================================
// Get Sales List API (Staff & Admin)
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
    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
    $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;
    $sale_type = isset($_GET['type']) ? $_GET['type'] : null;
    $from_date = isset($_GET['from_date']) ? $_GET['from_date'] : null;
    $to_date = isset($_GET['to_date']) ? $_GET['to_date'] : null;
    
    // Build query
    $sql = "
        SELECT s.*,
               u.first_name as staff_first_name,
               u.last_name as staff_last_name,
               (SELECT COUNT(*) FROM sale_items WHERE sale_id = s.id) as items_count
        FROM sales s
        LEFT JOIN users u ON s.staff_id = u.id
        WHERE 1=1
    ";
    
    $params = [];
    
    if ($sale_type) {
        $sql .= " AND s.sale_type = :sale_type";
        $params['sale_type'] = $sale_type;
    }
    
    if ($from_date) {
        $sql .= " AND DATE(s.created_at) >= :from_date";
        $params['from_date'] = $from_date;
    }
    
    if ($to_date) {
        $sql .= " AND DATE(s.created_at) <= :to_date";
        $params['to_date'] = $to_date;
    }
    
    // If user is staff (not admin), only show their own sales
    if ($user['role'] === 'staff') {
        $sql .= " AND s.staff_id = :staff_id";
        $params['staff_id'] = $user['user_id'];
    }
    
    $sql .= " ORDER BY s.created_at DESC LIMIT :limit OFFSET :offset";
    
    $stmt = $db->prepare($sql);
    
    // Bind limit and offset separately as they must be integers
    foreach ($params as $key => $value) {
        $stmt->bindValue(":$key", $value);
    }
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    
    $stmt->execute();
    $sales = $stmt->fetchAll();
    
    // Get total count
    $countSql = str_replace("SELECT s.*,", "SELECT COUNT(*) as total", $sql);
    $countSql = preg_replace('/ORDER BY.*/', '', $countSql);
    $countSql = preg_replace('/LIMIT.*/', '', $countSql);
    
    $countStmt = $db->prepare($countSql);
    foreach ($params as $key => $value) {
        $countStmt->bindValue(":$key", $value);
    }
    $countStmt->execute();
    $total = $countStmt->fetch()['total'];
    
    Response::success([
        'sales' => $sales,
        'total' => (int)$total,
        'limit' => $limit,
        'offset' => $offset
    ], 'Sales retrieved successfully');
    
} catch (PDOException $e) {
    Response::error('Failed to retrieve sales: ' . $e->getMessage(), 500);
}
