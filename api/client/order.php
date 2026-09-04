<?php
// =====================================================
// Customer Order Fulfillment Endpoint
// Anne's Fashion Line
// =====================================================

require_once __DIR__ . '/../../backend/config/cors.php';
require_once __DIR__ . '/../../backend/config/database.php';
require_once __DIR__ . '/../../backend/utils/response.php';
require_once __DIR__ . '/../../backend/utils/supabase.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method not allowed', 405);
}

$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['items']) || empty($data['items'])) {
    Response::error('Your cart is feeling empty babe! 💕 Add some stunning pieces first.');
}

if (!isset($data['phone'])) {
    Response::error('Phone number is required so we know who to deliver to, honey! 📱');
}

$rawPhone = preg_replace('/[^0-9]/', '', (string)$data['phone']);
$phone = $rawPhone;
if (strpos($phone, '254') === 0 && strlen($phone) === 12) {
    $phone = '0' . substr($phone, 3);
}

$customerName = !empty($data['customer_name']) ? trim($data['customer_name']) : 'Queen';
$deliveryLocation = !empty($data['delivery_location']) ? trim($data['delivery_location']) : 'Nairobi';
$deliveryNotes = !empty($data['delivery_notes']) ? trim($data['delivery_notes']) : '';
$txRef = !empty($data['transaction_reference']) ? trim($data['transaction_reference']) : 'MPESA-' . strtoupper(substr(md5(time()), 0, 8));
$customerId = !empty($data['customer_id']) ? (int)$data['customer_id'] : null;

try {
    $db = Database::getInstance()->getConnection();
    
    // If customer ID not provided, find by phone
    if (!$customerId) {
        $cStmt = $db->prepare("SELECT id, name FROM customers WHERE phone = :p LIMIT 1");
        $cStmt->execute(['p' => $phone]);
        $cRow = $cStmt->fetch(PDO::FETCH_ASSOC);
        if ($cRow) {
            $customerId = (int)$cRow['id'];
            if (empty($customerName) || $customerName === 'Queen') {
                $customerName = $cRow['name'] ?: 'Queen';
            }
        }
    }

    $totalAmount = 0;
    $validatedItems = [];

    foreach ($data['items'] as $it) {
        $prodId = isset($it['id']) ? (int)$it['id'] : (isset($it['product_id']) ? (int)$it['product_id'] : 0);
        $qty = max(1, isset($it['quantity']) ? (int)$it['quantity'] : 1);
        $title = isset($it['title']) ? trim($it['title']) : 'Fashion Item';
        $price = isset($it['price']) ? (float)$it['price'] : 0.00;
        
        // Ensure product exists in database to satisfy foreign key constraint
        $validProdId = null;
        if ($prodId > 0) {
            $pStmt = $db->prepare("SELECT id, title, price FROM products WHERE id = :id LIMIT 1");
            $pStmt->execute(['id' => $prodId]);
            $pRow = $pStmt->fetch(PDO::FETCH_ASSOC);
            if ($pRow) {
                $validProdId = (int)$pRow['id'];
                if ($price <= 0) $price = (float)$pRow['price'];
                if (empty($title) || $title === 'Fashion Item') $title = $pRow['title'];
            }
        }
        
        if (!$validProdId) {
            $fallback = $db->query("SELECT id, title, price FROM products WHERE is_active = 1 LIMIT 1")->fetch(PDO::FETCH_ASSOC);
            if ($fallback) {
                $validProdId = (int)$fallback['id'];
                if ($price <= 0) $price = (float)$fallback['price'];
            }
        }
        
        $itemTotal = $price * $qty;
        $totalAmount += $itemTotal;

        $validatedItems[] = [
            'product_id' => $validProdId,
            'product_title' => $title,
            'quantity' => $qty,
            'unit_price' => $price,
            'total_price' => $itemTotal
        ];
    }

    if ($totalAmount <= 0) {
        Response::error('Total amount cannot be zero, babe! ✨');
    }

    $saleNumber = 'SALE-' . date('Ymd') . '-' . strtoupper(substr(md5(uniqid(rand(), true)), 0, 5));
    $notes = "Online Order | Location: {$deliveryLocation}";
    if (!empty($deliveryNotes)) {
        $notes .= " | Notes: {$deliveryNotes}";
    }

    // 1. Insert into local MySQL `sales`
    $sStmt = $db->prepare("
        INSERT INTO sales (
            sale_number, sale_type, customer_id, customer_name, 
            total_amount, payment_method, payment_status, 
            transaction_reference, notes, created_at
        ) VALUES (
            :sale_number, 'online', :customer_id, :customer_name,
            :total_amount, 'mpesa', 'paid',
            :transaction_reference, :notes, NOW()
        )
    ");
    $sStmt->execute([
        'sale_number' => $saleNumber,
        'customer_id' => $customerId,
        'customer_name' => $customerName,
        'total_amount' => $totalAmount,
        'transaction_reference' => $txRef,
        'notes' => $notes
    ]);
    $saleId = (int)$db->lastInsertId();

    // 2. Insert items into local `sale_items`
    $siStmt = $db->prepare("
        INSERT INTO sale_items (
            sale_id, product_id, product_title, quantity, unit_price, total_price
        ) VALUES (
            :sale_id, :product_id, :product_title, :quantity, :unit_price, :total_price
        )
    ");

    foreach ($validatedItems as $item) {
        $siStmt->execute([
            'sale_id' => $saleId,
            'product_id' => $item['product_id'],
            'product_title' => $item['product_title'],
            'quantity' => $item['quantity'],
            'unit_price' => $item['unit_price'],
            'total_price' => $item['total_price']
        ]);
        
        // Deduct inventory if row exists
        try {
            $db->prepare("UPDATE inventory SET quantity = GREATEST(0, quantity - :q) WHERE product_id = :pid")
               ->execute(['q' => $item['quantity'], 'pid' => $item['product_id']]);
        } catch (Throwable $e) {}
    }

    // Update customer stats
    if ($customerId) {
        try {
            $db->prepare("UPDATE customers SET total_orders = total_orders + 1, total_spent = total_spent + :amt, updated_at = NOW() WHERE id = :id")
               ->execute(['amt' => $totalAmount, 'id' => $customerId]);
        } catch (Throwable $e) {}
    }

    // 3. Dual-write to Supabase via REST API
    $sup = SupabaseClient::getInstance();
    try {
        // Resolve customer_id in Supabase by phone
        $supCustId = null;
        try {
            $cCheck = $sup->request('GET', "customers?phone=eq.{$phone}&select=id&limit=1");
            if (!empty($cCheck['data'][0]['id'])) {
                $supCustId = (int)$cCheck['data'][0]['id'];
            }
        } catch (Throwable $e) {}

        $supSale = [
            'sale_number' => $saleNumber,
            'sale_type' => 'online',
            'customer_name' => $customerName,
            'total_amount' => $totalAmount,
            'payment_method' => 'mpesa',
            'payment_status' => 'paid',
            'transaction_reference' => $txRef,
            'notes' => $notes
        ];
        if ($supCustId) {
            $supSale['customer_id'] = $supCustId;
        }

        $supRes = $sup->request('POST', 'sales', $supSale, ['Prefer: return=representation']);
        $supSaleId = !empty($supRes['data'][0]['id']) ? $supRes['data'][0]['id'] : null;

        if ($supSaleId) {
            $supItems = [];
            foreach ($validatedItems as $it) {
                $supItems[] = [
                    'sale_id' => $supSaleId,
                    'product_id' => $it['product_id'],
                    'product_title' => $it['product_title'],
                    'quantity' => $it['quantity'],
                    'unit_price' => $it['unit_price'],
                    'total_price' => $it['total_price']
                ];
            }
            $sup->request('POST', 'sale_items', $supItems);
        }
    } catch (Throwable $e) {
        error_log("[Order] Supabase sync notice: " . $e->getMessage());
    }

    // Format WhatsApp confirmation text for Anne
    $itemsList = "";
    foreach ($validatedItems as $it) {
        $itemsList .= "- {$it['product_title']} (x{$it['quantity']})%0A";
    }
    $waText = "Hey Anne! 💕 I just placed order {$saleNumber} on the site for KES " . number_format($totalAmount, 2) . ".%0A%0AItems:%0A{$itemsList}%0ADelivery to: {$deliveryLocation}%0AM-Pesa Ref: {$txRef}";
    $waLink = "https://wa.me/254700000000?text=" . $waText;

    Response::success([
        'sale_number' => $saleNumber,
        'customer_name' => $customerName,
        'total_amount' => $totalAmount,
        'total_formatted' => 'KES ' . number_format($totalAmount, 2),
        'transaction_reference' => $txRef,
        'delivery_location' => $deliveryLocation,
        'items_count' => count($validatedItems),
        'whatsapp_link' => $waLink,
        'message' => "Order placed successfully, babe! 🥂✨ Your fit is being prepped with love from Nairobi. Get ready to turn heads!"
    ], "Order confirmed! You look stunning, babe 💕");

} catch (Throwable $e) {
    Response::error('Failed to complete order babe: ' . $e->getMessage(), 500);
}
