<?php
// =====================================================
// Get Single Sale Detail API (Staff & Admin)
// Anne's Fashion Line
// Returns full sale + all items for a given sale ID
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

// Require sale ID
$saleId = isset($_GET['id']) ? (int)$_GET['id'] : 0;
if ($saleId <= 0) {
    Response::error('A valid sale ID is required', 400);
}

try {
    $db = Database::getInstance()->getConnection();

    // Fetch the sale record
    $saleStmt = $db->prepare("
        SELECT 
            s.*,
            u.first_name  AS staff_first_name,
            u.last_name   AS staff_last_name
        FROM sales s
        LEFT JOIN users u ON s.staff_id = u.id
        WHERE s.id = :id
        LIMIT 1
    ");
    $saleStmt->execute(['id' => $saleId]);
    $sale = $saleStmt->fetch(PDO::FETCH_ASSOC);

    if (!$sale) {
        Response::notFound('Sale not found');
    }

    // Staff (non-admin) can only view their own in-store sales
    // Online sales (sale_type = 'online') are visible to all staff
    if ($user['role'] === 'staff' && $sale['sale_type'] !== 'online') {
        if ((int)$sale['staff_id'] !== (int)$user['user_id']) {
            Response::forbidden('You do not have permission to view this sale');
        }
    }

    // Fetch all line items for this sale
    $itemsStmt = $db->prepare("
        SELECT
            si.id,
            si.product_id,
            si.product_title,
            si.quantity,
            si.unit_price,
            si.total_price,
            (SELECT image_url FROM product_images WHERE product_id = si.product_id AND is_main = 1 LIMIT 1) AS product_image
        FROM sale_items si
        WHERE si.sale_id = :sale_id
        ORDER BY si.id ASC
    ");
    $itemsStmt->execute(['sale_id' => $saleId]);
    $items = $itemsStmt->fetchAll(PDO::FETCH_ASSOC);

    // Parse delivery location and notes from the notes field
    // Format stored: "Online Order | Location: Westlands | Notes: Leave at gate"
    $deliveryLocation = null;
    $deliveryNotes    = null;
    if (!empty($sale['notes'])) {
        $parts = explode(' | ', $sale['notes']);
        foreach ($parts as $part) {
            if (str_starts_with($part, 'Location:')) {
                $deliveryLocation = trim(str_replace('Location:', '', $part));
            } elseif (str_starts_with($part, 'Notes:')) {
                $deliveryNotes = trim(str_replace('Notes:', '', $part));
            }
        }
    }

    // Attach parsed fields + items to the sale object
    $sale['items']             = $items;
    $sale['items_count']       = count($items);
    $sale['delivery_location'] = $deliveryLocation;
    $sale['delivery_notes']    = $deliveryNotes;
    $sale['total_formatted']   = 'KES ' . number_format((float)$sale['total_amount'], 2);

    Response::success($sale, 'Sale details retrieved successfully');

} catch (PDOException $e) {
    Response::error('Failed to retrieve sale details: ' . $e->getMessage(), 500);
}
