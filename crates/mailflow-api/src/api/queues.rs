/// Queue endpoints
use axum::{
    Json,
    extract::{Path, Query, State},
};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::sync::Arc;
use tracing::{error, info, warn};

use crate::{constants::*, context::ApiContext, error::ApiError};

#[derive(Debug, Serialize)]
pub struct QueuesResponse {
    pub queues: Vec<QueueInfo>,
}

#[derive(Debug, Serialize)]
pub struct QueueInfo {
    pub name: String,
    pub url: String,
    #[serde(rename = "type")]
    pub queue_type: String,
    #[serde(rename = "messageCount")]
    pub message_count: i32,
    #[serde(rename = "messagesInFlight")]
    pub messages_in_flight: i32,
    #[serde(rename = "oldestMessageAge")]
    pub oldest_message_age: Option<i32>,
    #[serde(rename = "lastActivity")]
    pub last_activity: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct MessagesQuery {
    pub limit: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct MessagesResponse {
    #[serde(rename = "queueName")]
    pub queue_name: String,
    pub messages: Vec<MessageInfo>,
    #[serde(rename = "totalCount")]
    pub total_count: i32,
    #[serde(rename = "queueInfo")]
    pub queue_info: Option<QueueInfo>,
}

#[derive(Debug, Serialize)]
pub struct MessageInfo {
    #[serde(rename = "messageId")]
    pub message_id: String,
    #[serde(rename = "receiptHandle")]
    pub receipt_handle: String,
    pub body: String,
    pub attributes: serde_json::Value,
    pub preview: String,
}

pub async fn list(State(ctx): State<Arc<ApiContext>>) -> Result<Json<QueuesResponse>, ApiError> {
    info!("Listing all queues");

    // List all queues
    let list_result = ctx
        .sqs_client
        .list_queues()
        .send()
        .await
        .map_err(|e| ApiError::Aws(e.to_string()))?;

    let mut queues = Vec::new();

    for queue_url in list_result.queue_urls() {
        // Get queue attributes
        let attrs_result = ctx
            .sqs_client
            .get_queue_attributes()
            .queue_url(queue_url)
            .attribute_names(aws_sdk_sqs::types::QueueAttributeName::All)
            .send()
            .await;

        let queue_name = queue_url
            .split('/')
            .next_back()
            .unwrap_or("unknown")
            .to_string();

        let (message_count, messages_in_flight, oldest_message_age) = match attrs_result {
            Ok(attrs) => {
                let attributes = attrs.attributes();
                let msg_count = attributes
                    .and_then(|m| {
                        m.get(&aws_sdk_sqs::types::QueueAttributeName::ApproximateNumberOfMessages)
                    })
                    .and_then(|v| v.parse().ok())
                    .unwrap_or(0);
                let in_flight = attributes
                    .and_then(|m| {
                        m.get(&aws_sdk_sqs::types::QueueAttributeName::ApproximateNumberOfMessagesNotVisible)
                    })
                    .and_then(|v| v.parse().ok())
                    .unwrap_or(0);
                // Note: ApproximateAgeOfOldestMessage not available in this SDK version
                let oldest_age: Option<i32> = None;

                (msg_count, in_flight, oldest_age)
            }
            Err(e) => {
                warn!("Failed to get attributes for queue {}: {}", queue_name, e);
                (0, 0, None)
            }
        };

        // Determine queue type from name
        let queue_type = determine_queue_type(&queue_name);

        queues.push(QueueInfo {
            name: queue_name,
            url: queue_url.to_string(),
            queue_type: queue_type.to_string(),
            message_count,
            messages_in_flight,
            oldest_message_age,
            last_activity: None, // Would need CloudWatch metrics for this
        });
    }

    Ok(Json(QueuesResponse { queues }))
}

pub async fn messages(
    State(ctx): State<Arc<ApiContext>>,
    Path(queue_name): Path<String>,
    Query(query): Query<MessagesQuery>,
) -> Result<Json<MessagesResponse>, ApiError> {
    let limit = query
        .limit
        .unwrap_or(DEFAULT_MESSAGE_LIMIT)
        .min(MAX_SQS_MESSAGES_PER_REQUEST);

    info!(
        queue_name = %queue_name,
        limit = limit,
        "Fetching messages from queue"
    );

    // Get queue URL from name
    let queue_url = get_queue_url(&ctx, &queue_name).await?;

    // Get queue attributes to get total message count and queue info
    let attrs_result = ctx
        .sqs_client
        .get_queue_attributes()
        .queue_url(&queue_url)
        .attribute_names(aws_sdk_sqs::types::QueueAttributeName::All)
        .send()
        .await
        .map_err(|e| ApiError::Aws(e.to_string()))?;

    let attributes = attrs_result.attributes();

    let total_count = attributes
        .and_then(|m| m.get(&aws_sdk_sqs::types::QueueAttributeName::ApproximateNumberOfMessages))
        .and_then(|v| v.parse().ok())
        .unwrap_or(0);

    let messages_in_flight = attributes
        .and_then(|m| {
            m.get(&aws_sdk_sqs::types::QueueAttributeName::ApproximateNumberOfMessagesNotVisible)
        })
        .and_then(|v| v.parse().ok())
        .unwrap_or(0);

    let oldest_message_age: Option<i32> = None; // SQS doesn't provide this directly

    // Determine queue type from name
    let queue_type = determine_queue_type(&queue_name);

    let queue_info = QueueInfo {
        name: queue_name.clone(),
        url: queue_url.clone(),
        queue_type: queue_type.to_string(),
        message_count: total_count,
        messages_in_flight,
        oldest_message_age,
        last_activity: None,
    };

    // Receive messages in batches (peek without deleting)
    // Fetch multiple batches to get up to 50 messages for pagination
    // Use proper visibility timeout to prevent same message being received multiple times
    let mut all_messages = Vec::new();
    let mut seen_message_ids = HashSet::new();

    // Determine how many batches to fetch
    let batch_count = if total_count > MAX_SQS_MESSAGES_PER_REQUEST {
        DASHBOARD_BATCH_COUNT
    } else {
        1 // Only one batch if queue has fewer messages
    };

    for _batch in 0..batch_count {
        let receive_result = ctx
            .sqs_client
            .receive_message()
            .queue_url(&queue_url)
            .max_number_of_messages(MAX_SQS_MESSAGES_PER_REQUEST)
            .visibility_timeout(SQS_VISIBILITY_TIMEOUT_PEEK)
            .message_system_attribute_names(aws_sdk_sqs::types::MessageSystemAttributeName::All)
            .send()
            .await
            .map_err(|e| ApiError::Aws(e.to_string()))?;

        let batch_messages = receive_result.messages();

        // Add messages, deduplicating by message ID
        for msg in batch_messages.iter() {
            if let Some(msg_id) = msg.message_id()
                && !seen_message_ids.contains(msg_id)
            {
                seen_message_ids.insert(msg_id.to_string());
                all_messages.push(msg.clone());
            }
        }

        // Stop if we got fewer messages than requested (queue exhausted)
        if batch_messages.len() < MAX_SQS_MESSAGES_PER_REQUEST as usize {
            break;
        }

        // Stop if we've collected enough messages
        if all_messages.len() >= DASHBOARD_MESSAGE_LIMIT as usize {
            break;
        }
    }

    let messages: Vec<MessageInfo> = all_messages
        .iter()
        .map(|msg| {
            let message_id = msg.message_id().unwrap_or("").to_string();
            let receipt_handle = msg.receipt_handle().unwrap_or("").to_string();
            let body = msg.body().unwrap_or("").to_string();

            // Create preview (first 200 chars)
            let preview = create_message_preview(&body);

            // Convert attributes to JSON
            let attributes = msg
                .attributes()
                .map(|attrs| {
                    serde_json::json!(
                        attrs
                            .iter()
                            .map(|(k, v)| (format!("{:?}", k), v.clone()))
                            .collect::<std::collections::HashMap<_, _>>()
                    )
                })
                .unwrap_or_else(|| serde_json::json!({}));

            MessageInfo {
                message_id,
                receipt_handle,
                body,
                attributes,
                preview,
            }
        })
        .collect();

    Ok(Json(MessagesResponse {
        queue_name,
        messages,
        total_count,
        queue_info: Some(queue_info),
    }))
}

/// Helper: Get queue URL from queue name
async fn get_queue_url(ctx: &ApiContext, queue_name: &str) -> Result<String, ApiError> {
    let result = ctx
        .sqs_client
        .get_queue_url()
        .queue_name(queue_name)
        .send()
        .await
        .map_err(|e| {
            error!("Failed to get queue URL for {}: {}", queue_name, e);
            ApiError::NotFound(format!("Queue not found: {}", queue_name))
        })?;

    result
        .queue_url()
        .map(|u| u.to_string())
        .ok_or_else(|| ApiError::NotFound(format!("Queue URL not found for {}", queue_name)))
}

/// Purge all messages from a queue
pub async fn purge(
    State(ctx): State<Arc<ApiContext>>,
    Path(queue_name): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    warn!(
        queue_name = %queue_name,
        "Purging queue - all messages will be deleted"
    );

    // Get queue URL from name
    let queue_url = get_queue_url(&ctx, &queue_name).await?;

    // Purge the queue
    ctx.sqs_client
        .purge_queue()
        .queue_url(&queue_url)
        .send()
        .await
        .map_err(|e| {
            // Use Debug formatting to get full error details from AWS SDK
            let error_msg = format!("{:?}", e);
            error!(
                queue_name = %queue_name,
                error = %error_msg,
                "Failed to purge queue"
            );
            ApiError::Aws(format!("Failed to purge queue: {}", error_msg))
        })?;

    info!(
        queue_name = %queue_name,
        "Queue purged successfully"
    );

    Ok(Json(serde_json::json!({
        "success": true,
        "message": format!("Queue '{}' has been purged successfully", queue_name)
    })))
}

#[derive(Debug, Deserialize)]
pub struct DeleteMessageRequest {
    #[serde(rename = "receiptHandle")]
    pub receipt_handle: String,
}

/// Delete a specific message from a queue
pub async fn delete_message(
    State(ctx): State<Arc<ApiContext>>,
    Path(queue_name): Path<String>,
    Json(request): Json<DeleteMessageRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    info!(
        queue_name = %queue_name,
        receipt_handle_prefix = %request.receipt_handle.chars().take(20).collect::<String>(),
        "Deleting message from queue"
    );

    // Get queue URL from name
    let queue_url = get_queue_url(&ctx, &queue_name).await?;

    // Delete the message
    ctx.sqs_client
        .delete_message()
        .queue_url(&queue_url)
        .receipt_handle(&request.receipt_handle)
        .send()
        .await
        .map_err(|e| ApiError::Aws(e.to_string()))?;

    Ok(Json(serde_json::json!({
        "success": true,
        "message": "Message deleted successfully"
    })))
}

#[derive(Debug, Deserialize)]
pub struct RedriveMessageRequest {
    #[serde(rename = "receiptHandle")]
    pub receipt_handle: String,
    pub body: String,
    #[serde(rename = "targetQueueName")]
    pub target_queue_name: String,
}

/// Re-drive a message from DLQ to the main queue
pub async fn redrive_message(
    State(ctx): State<Arc<ApiContext>>,
    Path(queue_name): Path<String>,
    Json(request): Json<RedriveMessageRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    info!(
        source_queue = %queue_name,
        target_queue = %request.target_queue_name,
        "Re-driving message from DLQ to main queue"
    );

    // Get source (DLQ) queue URL
    let source_queue_url = get_queue_url(&ctx, &queue_name).await?;

    // Get target (main) queue URL
    let target_queue_url = get_queue_url(&ctx, &request.target_queue_name).await?;

    // Send message to target queue
    ctx.sqs_client
        .send_message()
        .queue_url(&target_queue_url)
        .message_body(&request.body)
        .send()
        .await
        .map_err(|e| ApiError::Aws(format!("Failed to send message to target queue: {}", e)))?;

    // Delete message from source (DLQ) queue
    ctx.sqs_client
        .delete_message()
        .queue_url(&source_queue_url)
        .receipt_handle(&request.receipt_handle)
        .send()
        .await
        .map_err(|e| ApiError::Aws(format!("Failed to delete message from DLQ: {}", e)))?;

    Ok(Json(serde_json::json!({
        "success": true,
        "message": format!("Message moved from {} to {}", queue_name, request.target_queue_name)
    })))
}

/// Helper: Create a preview of a message body
fn create_message_preview(body: &str) -> String {
    // Try to parse as JSON
    if let Ok(json) = serde_json::from_str::<serde_json::Value>(body) {
        // Strategy 1: Try to extract email-specific info
        if let Some(email) = json.get("email") {
            let from = email
                .get("from")
                .and_then(|f| f.get("address"))
                .and_then(|a| a.as_str())
                .unwrap_or("unknown");
            let subject = email
                .get("subject")
                .and_then(|s| s.as_str())
                .unwrap_or("(no subject)");
            return format!("Email from: {}, Subject: {}", from, subject);
        }

        // Strategy 2: Try common message fields (messageType, eventType, etc.)
        if let Some(msg_type) = json
            .get("messageType")
            .or(json.get("type"))
            .or(json.get("eventType"))
            && let Some(type_str) = msg_type.as_str()
        {
            // Try to get an ID field
            let id = json
                .get("id")
                .or(json.get("messageId"))
                .or(json.get("eventId"))
                .and_then(|v| v.as_str())
                .unwrap_or("");

            if !id.is_empty() {
                return format!("Message type: {}, ID: {}", type_str, id);
            } else {
                return format!("Message type: {}", type_str);
            }
        }

        // Strategy 3: Try to extract subject or description fields
        if let Some(subject) = json
            .get("subject")
            .or(json.get("description"))
            .or(json.get("message"))
            && let Some(subject_str) = subject.as_str()
        {
            let truncated = if subject_str.len() > MAX_SUBJECT_PREVIEW_LENGTH {
                format!("{}...", &subject_str[..MAX_SUBJECT_PREVIEW_LENGTH])
            } else {
                subject_str.to_string()
            };
            return format!("Subject: {}", truncated);
        }

        // Strategy 4: Show the top-level keys for generic JSON
        if let Some(obj) = json.as_object() {
            let keys: Vec<String> = obj
                .keys()
                .take(MAX_JSON_KEYS_IN_PREVIEW)
                .map(|k| k.to_string())
                .collect();
            return format!("JSON with keys: {}", keys.join(", "));
        }
    }

    // Fallback: just truncate plain text
    if body.len() > MAX_PREVIEW_LENGTH {
        format!("{}...", &body[..MAX_PREVIEW_LENGTH])
    } else {
        body.to_string()
    }
}

/// Helper: Determine queue type from queue name
fn determine_queue_type(queue_name: &str) -> &'static str {
    let name_lower = queue_name.to_lowercase();
    if name_lower.contains(QUEUE_TYPE_DLQ_SUFFIX) || name_lower.starts_with(QUEUE_TYPE_DLQ_PREFIX) {
        QUEUE_TYPE_DLQ
    } else if name_lower.contains(QUEUE_TYPE_OUTBOUND) {
        QUEUE_TYPE_OUTBOUND
    } else {
        QUEUE_TYPE_INBOUND
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_queue_type_detection() {
        let test_cases = vec![
            ("mailflow-app1", QUEUE_TYPE_INBOUND),
            ("mailflow-app1-outbound", QUEUE_TYPE_OUTBOUND),
            ("mailflow-app1-dlq", QUEUE_TYPE_DLQ),
            ("mailflow-DLQ-app2", QUEUE_TYPE_DLQ),
            ("dlq-mailflow-app3", QUEUE_TYPE_DLQ),
            ("outbound-queue", QUEUE_TYPE_OUTBOUND),
        ];

        for (queue_name, expected_type) in test_cases {
            let queue_type = determine_queue_type(queue_name);
            assert_eq!(
                queue_type, expected_type,
                "Failed for queue: {}",
                queue_name
            );
        }
    }

    #[test]
    fn test_message_preview_with_email() {
        let json_body =
            r#"{"email":{"from":{"address":"test@example.com"},"subject":"Test Subject"}}"#;
        let preview = create_message_preview(json_body);
        assert_eq!(
            preview,
            "Email from: test@example.com, Subject: Test Subject"
        );
    }

    #[test]
    fn test_message_preview_with_message_type() {
        let json_body = r#"{"messageType":"ORDER_CREATED","id":"order-123"}"#;
        let preview = create_message_preview(json_body);
        assert_eq!(preview, "Message type: ORDER_CREATED, ID: order-123");
    }

    #[test]
    fn test_message_preview_with_type_only() {
        let json_body = r#"{"type":"NOTIFICATION"}"#;
        let preview = create_message_preview(json_body);
        assert_eq!(preview, "Message type: NOTIFICATION");
    }

    #[test]
    fn test_message_preview_with_subject() {
        let json_body = r#"{"subject":"This is a test subject"}"#;
        let preview = create_message_preview(json_body);
        assert_eq!(preview, "Subject: This is a test subject");
    }

    #[test]
    fn test_message_preview_with_long_subject() {
        let long_subject = "a".repeat(150);
        let json_body = format!(r#"{{"subject":"{}"}}"#, long_subject);
        let preview = create_message_preview(&json_body);
        assert!(preview.starts_with("Subject: "));
        assert!(preview.ends_with("..."));
        // Should be truncated to MAX_SUBJECT_PREVIEW_LENGTH + "Subject: " + "..."
        assert!(preview.len() <= MAX_SUBJECT_PREVIEW_LENGTH + 20);
    }

    #[test]
    fn test_message_preview_with_json_keys() {
        let json_body = r#"{"key1":"value1","key2":"value2","key3":"value3"}"#;
        let preview = create_message_preview(json_body);
        assert!(preview.starts_with("JSON with keys:"));
        assert!(preview.contains("key1"));
        assert!(preview.contains("key2"));
        assert!(preview.contains("key3"));
    }

    #[test]
    fn test_message_preview_truncation() {
        let long_text = "a".repeat(300);
        let preview = create_message_preview(&long_text);
        assert_eq!(preview.len(), MAX_PREVIEW_LENGTH + 3); // + "..."
        assert!(preview.ends_with("..."));
    }

    #[test]
    fn test_message_preview_short_text() {
        let short_text = "Short message";
        let preview = create_message_preview(short_text);
        assert_eq!(preview, short_text);
    }

    #[test]
    fn test_messages_query_limit() {
        let limits = vec![
            (Some(5), 5),
            (Some(15), MAX_SQS_MESSAGES_PER_REQUEST),
            (None, DEFAULT_MESSAGE_LIMIT),
            (Some(1), 1),
            (Some(100), MAX_SQS_MESSAGES_PER_REQUEST),
        ];
        for (input, expected) in limits {
            let limit = input
                .unwrap_or(DEFAULT_MESSAGE_LIMIT)
                .min(MAX_SQS_MESSAGES_PER_REQUEST);
            assert_eq!(limit, expected, "Failed for input: {:?}", input);
        }
    }

    #[test]
    #[allow(clippy::assertions_on_constants)]
    fn test_constants_validity() {
        // Ensure constants are reasonable (these are compile-time checks)
        assert!(MAX_SQS_MESSAGES_PER_REQUEST > 0);
        assert!(MAX_SQS_MESSAGES_PER_REQUEST <= 10); // SQS limit
        assert!(DEFAULT_MESSAGE_LIMIT <= MAX_SQS_MESSAGES_PER_REQUEST);
        assert!(MAX_PREVIEW_LENGTH > 0);
        assert!(MAX_PREVIEW_LENGTH < 1000); // Reasonable limit
        assert!(MAX_SUBJECT_PREVIEW_LENGTH < MAX_PREVIEW_LENGTH);
        assert!(MAX_JSON_KEYS_IN_PREVIEW > 0);
        assert!(MAX_JSON_KEYS_IN_PREVIEW <= 10); // Reasonable limit
    }
}
