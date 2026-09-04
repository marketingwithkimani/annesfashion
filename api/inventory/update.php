<?php
// =====================================================
// Update Inventory API (Admin Only)
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

// Get PUT data
$data = json_decode(file_get_contents('php://input'), true);

// Validate required fields
if (!isset($data['product_id']) || !isset($data['quantity_change'])) {
    Response::error('product_id and quantity_change are required');
}

$productId = (int)$data['product_id'];
$quantityChange = (int)$data['quantity_change'];
$actionType = $data['action_type'] ?? 'adjustment';
$reason = $data['reason'] ?? 'Manual adjustment';

try {
    $db = Database::getInstance()->getConnection();
    
    $db->beginTransaction();
    
    // Check if product exists
    $checkStmt = $db->prepare("SELECT id, title FROM products WHERE id = :id");
    $checkStmt->execute(['id' => $productId]);
    $product = $checkStmt->fetch();
    
    if (!$product) {
        $db->rollBack();
        Response::notFound('Product not found');
    }
    
    // Check if inventory record exists
    $invCheck = $db->prepare("SELECT * FROM inventory WHERE product_id = :product_id");
    $invCheck->execute(['product_id' => $productId]);
    $inventory = $invCheck->fetch();
    
    if ($inventory) {
        // Update existing inventory
        $newQuantity = $inventory['quantity'] + $quantityChange;
        
        if ($newQuantity < 0) {
            $db->rollBack();
            Response::error('Cannot reduce stock below zero');
        }
        
        $updateStmt = $db->prepare("
            UPDATE inventory 
            SET quantity = :quantity
            WHERE product_id = :product_id
        ");
        $updateStmt->execute([
            'quantity' => $newQuantity,
            'product_id' => $productId
        ]);
    } else {
        // Create new inventory record
        if ($quantityChange < 0) {
            $db->rollBack();
            Response::error('Cannot create inventory with negative quantity');
        }
        
        $createStmt = $db->prepare("
            INSERT INTO inventory (product_id, quantity)
            VALUES (:product_id, :quantity)
        ");
        $createStmt->execute([
            'product_id' => $productId,
            'quantity' => $quantityChange
        ]);
    }
    
    // Log the inventory change
    $logStmt = $db->prepare("
        INSERT INTO inventory_logs (
            product_id, quantity_change, action_type, user_id, reason
        ) VALUES (
            :product_id, :quantity_change, :action_type, :user_id, :reason
        )
    ");
    $logStmt->execute([
        'product_id' => $productId,
        'quantity_change' => $quantityChange,
        'action_type' => $actionType,
        'user_id' => $user['user_id'],
        'reason' => $reason
    ]);
    
    $db->commit();
    
    // Get updated inventory
    $getStmt = $db->prepare("
        SELECT p.*, i.quantity as stock, i.reorder_point
        FROM products p
        LEFT JOIN inventory i ON p.id = i.product_id
        WHERE p.id = :id
    ");
    $getStmt->execute(['id' => $productId]);
    $result = $getStmt->fetch();
    
    // Sync stock to Supabase
    try {
        $newStock = isset($result['stock']) ? (int)$result['stock'] : 0;
        SupabaseClient::getInstance()->setProductStock($productId, $newStock);
    } catch (Throwable $syncEx) {
        error_log("[InventoryUpdate] Supabase sync error: " . $syncEx->getMessage());
    }

    Response::success($result, 'Inventory updated successfully');
    
} catch (PDOException $e) {
    $db->rollBack();
    Response::error('Failed to update inventory: ' . $e->getMessage(), 500);
}
