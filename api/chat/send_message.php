<?php
// =====================================================
// Anne's Fashion Line — Chat: Send Message
// =====================================================
header('Content-Type: application/json');
require_once __DIR__ . '/../../backend/config/cors.php';
require_once __DIR__ . '/../../backend/config/database.php';
require_once __DIR__ . '/../../backend/utils/response.php';

try {
    $db = Database::getInstance()->getConnection();

    $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;

    $conversationId = isset($input['conversation_id']) ? trim($input['conversation_id']) : '';
    $senderType = isset($input['sender_type']) ? trim($input['sender_type']) : 'customer';
    $senderName = isset($input['sender_name']) ? trim($input['sender_name']) : ($senderType === 'ai' ? "Anne's Assistant" : 'Customer');
    $content = isset($input['content']) ? trim($input['content']) : '';
    $metadata = isset($input['metadata']) ? (is_string($input['metadata']) ? $input['metadata'] : json_encode($input['metadata'])) : null;

    if (empty($conversationId) || empty($content)) {
        Response::error('Conversation ID and Content are required');
    }

    // Verify conversation exists
    $stmt = $db->prepare("SELECT * FROM chat_conversations WHERE id = :id");
    $stmt->execute([':id' => $conversationId]);
    $conversation = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$conversation) {
        Response::error('Conversation not found');
    }

    // Insert message
    $insertMsg = $db->prepare("
        INSERT INTO chat_messages (conversation_id, sender_type, sender_name, content, metadata, created_at)
        VALUES (:conv_id, :sender_type, :sender_name, :content, :metadata, NOW())
    ");
    $insertMsg->execute([
        ':conv_id' => $conversationId,
        ':sender_type' => $senderType,
        ':sender_name' => $senderName,
        ':content' => $content,
        ':metadata' => $metadata
    ]);

    $messageId = $db->lastInsertId();

    // Update conversation last message & timestamp
    $updateConv = $db->prepare("
        UPDATE chat_conversations 
        SET last_message = :last_msg, last_message_at = NOW(), updated_at = NOW()
        WHERE id = :id
    ");
    $updateConv->execute([
        ':last_msg' => mb_substr($content, 0, 250),
        ':id' => $conversationId
    ]);

    Response::success([
        'id' => $messageId,
        'conversation_id' => $conversationId,
        'sender_type' => $senderType,
        'sender_name' => $senderName,
        'content' => $content,
        'metadata' => $metadata,
        'created_at' => date('Y-m-d H:i:s')
    ], 'Message sent successfully');

} catch (Exception $e) {
    Response::error('Failed to send message: ' . $e->getMessage());
}
