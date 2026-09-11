<?php
// =====================================================
// Record Sale API (Staff Only)
// =====================================================

require_once __DIR__ . '/../../backend/config/cors.php';
require_once __DIR__ . '/../../backend/config/database.php';
require_once __DIR__ . '/../../backend/utils/response.php';
require_once __DIR__ . '/../../backend/middleware/auth.php';

// Only accept POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method not allowed', 405);
}

// Verify staff access
$user = Auth::requireStaff();

// Get POST data
$data = json_decode(file_get_contents('php://input'), true);

// Validate required fields
if (!isset($data['items']) || empty($data['items'])) {
    Response::error('Sale items are required');
}

if (!isset($data['payment_method'])) {
    Response::error('Payment method is required');
}

// For in-store sales, only cash and mpesa allowed
if (!in_array($data['payment_method'], ['cash', 'mpesa'])) {
    Response::error('Invalid payment method. Only cash and M-Pesa allowed for in-store sales');
}

try {
    $db = Database::getInstance()->getConnection();
    
    // Start transaction
    $db->beginTransaction();
    
    // Calculate total
    $totalAmount = 0;
    $saleItems = [];
    
    // Validate all items and check stock
    foreach ($data['items'] as $item) {
        if (!isset($item['product_id']) || !isset($item['quantity'])) {
            if ($db->inTransaction()) $db->rollBack();
            Response::error('Each item must have product_id and quantity');
        }
        
        // Get product details
        $stmt = $db->prepare("
            SELECT p.*, IFNULL(i.quantity, 0) as stock
            FROM products p
            LEFT JOIN inventory i ON p.id = i.product_id
            WHERE p.id = :id AND p.is_active = 1
        ");
        $stmt->execute(['id' => $item['product_id']]);
        $product = $stmt->fetch();
        
        if (!$product) {
            if ($db->inTransaction()) $db->rollBack();
            Response::error("Product ID {$item['product_id']} not found or inactive");
        }
        
        // Ensure inventory record exists (if missing from LEFT JOIN)
        $stock = $product['stock'];
        
        // Check stock availability
        if ($stock < $item['quantity']) {
            if ($db->inTransaction()) $db->rollBack();
            Response::error("Insufficient stock for {$product['title']}. Available: {$stock}");
        }
        
        $itemTotal = $product['price'] * $item['quantity'];
        $totalAmount += $itemTotal;
        
        $saleItems[] = [
            'product_id' => $product['id'],
            'product_title' => $product['title'],
            'quantity' => $item['quantity'],
            'unit_price' => $product['price'],
            'total_price' => $itemTotal
        ];
    }
    
    // Generate sale number
    $saleNumber = 'SALE-' . date('Ymd') . '-' . strtoupper(substr(md5(time() . $user['user_id']), 0, 6));
    
    // Insert sale record
    $saleStmt = $db->prepare("
        INSERT INTO sales (
            sale_number, sale_type, customer_name, total_amount, 
            payment_method, payment_status, transaction_reference, staff_id, notes
        ) VALUES (
            :sale_number, 'in-store', :customer_name, :total_amount,
            :payment_method, 'paid', :transaction_reference, :staff_id, :notes
        )
    ");
    
    $saleStmt->execute([
        'sale_number' => $saleNumber,
        'customer_name' => $data['customer_name'] ?? 'Walk-in Customer',
        'total_amount' => $totalAmount,
        'payment_method' => $data['payment_method'],
        'transaction_reference' => $data['transaction_reference'] ?? null,
        'staff_id' => $user['user_id'],
        'notes' => $data['notes'] ?? null
    ]);
    
    $saleId = $db->lastInsertId();
    
    // Insert sale items and update inventory
    foreach ($saleItems as $item) {
        // Insert sale item
        $itemStmt = $db->prepare("
            INSERT INTO sale_items (
                sale_id, product_id, product_title, quantity, unit_price, total_price
            ) VALUES (
                :sale_id, :product_id, :product_title, :quantity, :unit_price, :total_price
            )
        ");
        $itemStmt->execute([
            'sale_id' => $saleId,
            'product_id' => $item['product_id'],
            'product_title' => $item['product_title'],
            'quantity' => $item['quantity'],
            'unit_price' => $item['unit_price'],
            'total_price' => $item['total_price']
        ]);
        
        // Update inventory
        $invStmt = $db->prepare("
            UPDATE inventory 
            SET quantity = quantity - :quantity
            WHERE product_id = :product_id
        ");
        $invStmt->execute([
            'quantity' => $item['quantity'],
            'product_id' => $item['product_id']
        ]);
        
        // Log inventory change
        $logStmt = $db->prepare("
            INSERT INTO inventory_logs (
                product_id, quantity_change, action_type, user_id, sale_id, reason
            ) VALUES (
                :product_id, :quantity_change, 'sale', :user_id, :sale_id, :reason
            )
        ");
        $logStmt->execute([
            'product_id' => $item['product_id'],
            'quantity_change' => -$item['quantity'],
            'user_id' => $user['user_id'],
            'sale_id' => $saleId,
            'reason' => 'In-store sale'
        ]);
    }
    
    // Commit transaction
    $db->commit();
    
    // Get complete sale record
    $getSale = $db->prepare("SELECT * FROM sales WHERE id = :id");
    $getSale->execute(['id' => $saleId]);
    $sale = $getSale->fetch(PDO::FETCH_ASSOC);
    
    if ($sale) {
        $getItems = $db->prepare("SELECT product_title, quantity, unit_price, total_price FROM sale_items WHERE sale_id = :id");
        $getItems->execute(['id' => $saleId]);
        $sale['items'] = $getItems->fetchAll(PDO::FETCH_ASSOC);
    }
    
    Response::success($sale, 'Sale recorded successfully', 201);
    
} catch (PDOException $e) {
    if (isset($db) && $db->inTransaction()) {
        $db->rollBack();
    }
    Response::error('Failed to record sale: ' . $e->getMessage(), 500);
}
