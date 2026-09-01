<?php
// =====================================================
// Anne's Fashion Line — Chat: Staff Actions
// =====================================================
header('Content-Type: application/json');
require_once __DIR__ . '/../../backend/config/cors.php';
require_once __DIR__ . '/../../backend/config/database.php';
require_once __DIR__ . '/../../backend/utils/response.php';

try {
    $db = Database::getInstance()->getConnection();

    $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;

    $action = isset($input['action']) ? trim($input['action']) : '';
    $conversationId = isset($input['conversation_id']) ? trim($input['conversation_id']) : '';
    $staffName = isset($input['staff_name']) ? trim($input['staff_name']) : 'Staff Agent';
    $staffId = isset($input['staff_id']) ? (int)$input['staff_id'] : null;

    if (empty($conversationId) || empty($action)) {
        Response::error('Conversation ID and Action are required');
    }

    $stmt = $db->prepare("SELECT * FROM chat_conversations WHERE id = :id");
    $stmt->execute([':id' => $conversationId]);
    $conversation = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$conversation) {
        Response::error('Conversation not found');
    }

    if ($action === 'accept' || $action === 'assign') {
        $update = $db->prepare("
            UPDATE chat_conversations 
            SET status = 'HUMAN_ACTIVE', 
                assigned_staff_id = :staff_id, 
                assigned_staff_name = :staff_name,
                updated_at = NOW()
            WHERE id = :id
        ");
        $update->execute([
            ':staff_id' => $staffId,
            ':staff_name' => $staffName,
            ':id' => $conversationId
        ]);

        $sysMsg = "{$staffName} from Anne's Fashion Line joined the chat.";
        $ins = $db->prepare("INSERT INTO chat_messages (conversation_id, sender_type, sender_name, content, created_at) VALUES (:conv_id, 'system', 'System', :content, NOW())");
        $ins->execute([':conv_id' => $conversationId, ':content' => $sysMsg]);

        Response::success(['conversation_id' => $conversationId, 'status' => 'HUMAN_ACTIVE'], 'Chat assigned to staff');

    } else if ($action === 'send_message') {
        $content = isset($input['content']) ? trim($input['content']) : '';
        if (empty($content)) {
            Response::error('Content is required for send_message');
        }

        $ins = $db->prepare("
            INSERT INTO chat_messages (conversation_id, sender_type, sender_name, content, created_at) 
            VALUES (:conv_id, 'staff', :sender_name, :content, NOW())
        ");
        $ins->execute([
            ':conv_id' => $conversationId,
            ':sender_name' => $staffName,
            ':content' => $content
        ]);

        $update = $db->prepare("UPDATE chat_conversations SET last_message = :last_msg, last_message_at = NOW(), updated_at = NOW() WHERE id = :id");
        $update->execute([':last_msg' => mb_substr($content, 0, 250), ':id' => $conversationId]);

        Response::success(['conversation_id' => $conversationId, 'content' => $content], 'Staff message sent');

    } else if ($action === 'resolve') {
        $update = $db->prepare("UPDATE chat_conversations SET status = 'RESOLVED', updated_at = NOW() WHERE id = :id");
        $update->execute([':id' => $conversationId]);

        $sysMsg = "Conversation marked as resolved by staff.";
        $ins = $db->prepare("INSERT INTO chat_messages (conversation_id, sender_type, sender_name, content, created_at) VALUES (:conv_id, 'system', 'System', :content, NOW())");
        $ins->execute([':conv_id' => $conversationId, ':content' => $sysMsg]);

        Response::success(['conversation_id' => $conversationId, 'status' => 'RESOLVED'], 'Conversation resolved');

    } else if ($action === 'resume_ai') {
        $update = $db->prepare("UPDATE chat_conversations SET status = 'AI_ACTIVE', updated_at = NOW() WHERE id = :id");
        $update->execute([':id' => $conversationId]);

        $sysMsg = "Anne's AI Shopping Assistant has resumed control of this conversation.";
        $ins = $db->prepare("INSERT INTO chat_messages (conversation_id, sender_type, sender_name, content, created_at) VALUES (:conv_id, 'system', 'System', :content, NOW())");
        $ins->execute([':conv_id' => $conversationId, ':content' => $sysMsg]);

        Response::success(['conversation_id' => $conversationId, 'status' => 'AI_ACTIVE'], 'AI Assistant resumed');

    } else {
        Response::error('Invalid action specified');
    }

} catch (Exception $e) {
    Response::error('Staff action failed: ' . $e->getMessage());
}
