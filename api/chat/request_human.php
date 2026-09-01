<?php
// =====================================================
// Anne's Fashion Line — Chat: Request Human Agent
// =====================================================
header('Content-Type: application/json');
require_once __DIR__ . '/../../backend/config/cors.php';
require_once __DIR__ . '/../../backend/config/database.php';
require_once __DIR__ . '/../../backend/utils/response.php';

try {
    $db = Database::getInstance()->getConnection();

    $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;

    $conversationId = isset($input['conversation_id']) ? trim($input['conversation_id']) : '';
    $note = isset($input['note']) ? trim($input['note']) : 'Customer requested a human agent.';

    if (empty($conversationId)) {
        Response::error('Conversation ID is required');
    }

    $stmt = $db->prepare("SELECT * FROM chat_conversations WHERE id = :id");
    $stmt->execute([':id' => $conversationId]);
    $conversation = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$conversation) {
        Response::error('Conversation not found');
    }

    // Update status to HUMAN_REQUESTED
    $update = $db->prepare("
        UPDATE chat_conversations 
        SET status = 'HUMAN_REQUESTED', 
            last_message = :last_msg, 
            last_message_at = NOW(), 
            updated_at = NOW() 
        WHERE id = :id
    ");
    $update->execute([
        ':last_msg' => 'Human Agent requested by customer',
        ':id' => $conversationId
    ]);

    // System message record
    $sysMsg = "We've received your request. A member of our team will join the conversation shortly.";
    $insertMsg = $db->prepare("
        INSERT INTO chat_messages (conversation_id, sender_type, sender_name, content, created_at)
        VALUES (:conv_id, 'system', 'System', :content, NOW())
    ");
    $insertMsg->execute([
        ':conv_id' => $conversationId,
        ':content' => $sysMsg
    ]);

    Response::success([
        'conversation_id' => $conversationId,
        'status' => 'HUMAN_REQUESTED',
        'message' => $sysMsg
    ], 'Human agent requested successfully');

} catch (Exception $e) {
    Response::error('Failed to request human agent: ' . $e->getMessage());
}
