<?php
// =====================================================
// Anne's Fashion Line — Chat: Poll New Messages & Status
// =====================================================
header('Content-Type: application/json');
require_once __DIR__ . '/../../backend/config/cors.php';
require_once __DIR__ . '/../../backend/config/database.php';
require_once __DIR__ . '/../../backend/utils/response.php';

try {
    $db = Database::getInstance()->getConnection();

    $conversationId = isset($_GET['conversation_id']) ? trim($_GET['conversation_id']) : '';
    $lastMsgId = isset($_GET['last_message_id']) ? (int)$_GET['last_message_id'] : 0;

    if (empty($conversationId)) {
        Response::error('Conversation ID is required');
    }

    // Get conversation current status
    $stmt = $db->prepare("SELECT * FROM chat_conversations WHERE id = :id");
    $stmt->execute([':id' => $conversationId]);
    $conversation = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$conversation) {
        Response::error('Conversation not found');
    }

    // Fetch new messages
    $msgStmt = $db->prepare("
        SELECT * FROM chat_messages 
        WHERE conversation_id = :conv_id AND id > :last_id 
        ORDER BY id ASC
    ");
    $msgStmt->execute([
        ':conv_id' => $conversationId,
        ':last_id' => $lastMsgId
    ]);
    $newMessages = $msgStmt->fetchAll(PDO::FETCH_ASSOC);

    Response::success([
        'conversation' => $conversation,
        'new_messages' => $newMessages
    ], 'Poll successful');

} catch (Exception $e) {
    Response::error('Polling failed: ' . $e->getMessage());
}
