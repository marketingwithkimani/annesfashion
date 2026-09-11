<?php
// =====================================================
// Anne's Fashion Line — Chat: Start or Get Conversation
// =====================================================
header('Content-Type: application/json');
require_once __DIR__ . '/../../backend/config/cors.php';
require_once __DIR__ . '/../../backend/config/database.php';
require_once __DIR__ . '/../../backend/utils/response.php';

try {
    $db = Database::getInstance()->getConnection();

    // Input data from GET or POST
    $input = json_decode(file_get_contents('php://input'), true) ?: $_REQUEST;

    $sessionId = isset($input['session_id']) ? trim($input['session_id']) : '';
    if (empty($sessionId)) {
        Response::error('Session ID is required');
    }

    $customerName = isset($input['customer_name']) ? trim($input['customer_name']) : 'Guest Customer';
    $productId = isset($input['product_id']) && is_numeric($input['product_id']) ? (int)$input['product_id'] : null;
    $productTitle = isset($input['product_title']) ? trim($input['product_title']) : null;
    $page = isset($input['page']) ? trim($input['page']) : null;

    // Check if active conversation exists for session
    $stmt = $db->prepare("SELECT * FROM chat_conversations WHERE session_id = :session_id AND status != 'CLOSED' ORDER BY created_at DESC LIMIT 1");
    $stmt->execute([':session_id' => $sessionId]);
    $conversation = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$conversation) {
        $convId = 'conv_' . bin2hex(random_bytes(8));
        $status = 'AI_ACTIVE';

        $insert = $db->prepare("
            INSERT INTO chat_conversations 
            (id, session_id, customer_name, current_product_id, current_product_title, current_page, status, created_at, updated_at) 
            VALUES (:id, :session_id, :customer_name, :product_id, :product_title, :page, :status, NOW(), NOW())
        ");
        $insert->execute([
            ':id' => $convId,
            ':session_id' => $sessionId,
            ':customer_name' => $customerName,
            ':product_id' => $productId,
            ':product_title' => $productTitle,
            ':page' => $page,
            ':status' => $status
        ]);

        $stmt = $db->prepare("SELECT * FROM chat_conversations WHERE id = :id");
        $stmt->execute([':id' => $convId]);
        $conversation = $stmt->fetch(PDO::FETCH_ASSOC);
    } else {
        // Update product or page context if provided
        if ($productId || $productTitle || $page) {
            $update = $db->prepare("
                UPDATE chat_conversations 
                SET current_product_id = COALESCE(:product_id, current_product_id),
                    current_product_title = COALESCE(:product_title, current_product_title),
                    current_page = COALESCE(:page, current_page),
                    updated_at = NOW()
                WHERE id = :id
            ");
            $update->execute([
                ':product_id' => $productId,
                ':product_title' => $productTitle,
                ':page' => $page,
                ':id' => $conversation['id']
            ]);
        }
    }

    // Fetch conversation messages
    $msgStmt = $db->prepare("SELECT * FROM chat_messages WHERE conversation_id = :conv_id ORDER BY id ASC");
    $msgStmt->execute([':conv_id' => $conversation['id']]);
    $messages = $msgStmt->fetchAll(PDO::FETCH_ASSOC);

    Response::success([
        'conversation' => $conversation,
        'messages' => $messages
    ], 'Conversation retrieved successfully');

} catch (Exception $e) {
    Response::error('Failed to initialize conversation: ' . $e->getMessage());
}
