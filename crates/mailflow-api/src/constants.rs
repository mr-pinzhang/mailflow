/// API constants and configuration values
// SQS Configuration
pub const MAX_SQS_MESSAGES_PER_REQUEST: i32 = 10; // SQS hard limit per receive_message call
pub const SQS_VISIBILITY_TIMEOUT_PEEK: i32 = 300; // 5 minutes - prevents same message being received multiple times
pub const DEFAULT_MESSAGE_LIMIT: i32 = 10;
pub const DASHBOARD_MESSAGE_LIMIT: i32 = 50; // Total messages to fetch for dashboard
pub const DASHBOARD_BATCH_COUNT: i32 = 5; // Number of batches to fetch (5 × 10 = 50 messages)

// CloudWatch Logs Configuration
pub const DEFAULT_LOG_LIMIT: i32 = 100;
pub const MAX_LOG_LIMIT: i32 = 10_000;

// S3 Storage Configuration
pub const DEFAULT_STORAGE_OBJECT_LIMIT: i32 = 20;
pub const MAX_STORAGE_OBJECT_LIMIT: i32 = 100;
pub const MAX_STORAGE_OBJECTS_FOR_STATS: i32 = 1000;
pub const PRESIGNED_URL_EXPIRATION_DAYS: u64 = 7;

// Message Preview Configuration
pub const MAX_PREVIEW_LENGTH: usize = 200;
pub const MAX_SUBJECT_PREVIEW_LENGTH: usize = 100;
pub const MAX_JSON_KEYS_IN_PREVIEW: usize = 5;

// Metrics Configuration
pub const METRICS_NAMESPACE: &str = "Mailflow";
pub const DEFAULT_METRICS_PERIOD_HOURS: i64 = 24;

// Queue Type Detection
pub const QUEUE_TYPE_DLQ_SUFFIX: &str = "-dlq";
pub const QUEUE_TYPE_DLQ_PREFIX: &str = "dlq-";
pub const QUEUE_TYPE_OUTBOUND: &str = "outbound";
pub const QUEUE_TYPE_INBOUND: &str = "inbound";
pub const QUEUE_TYPE_DLQ: &str = "dlq";

// HTTP Configuration
pub const API_VERSION: &str = "v1";
pub const MAX_REQUEST_BODY_SIZE_BYTES: usize = 10 * 1024 * 1024; // 10 MB (API Gateway max)

// Attachment Configuration
pub const MAX_ATTACHMENT_SIZE_BYTES: usize = 7 * 1024 * 1024; // 7 MB for base64 overhead

// Auto-refresh intervals (frontend)
pub const AUTO_REFRESH_INTERVAL_QUEUE_LIST_MS: u32 = 30_000; // 30 seconds
pub const AUTO_REFRESH_INTERVAL_QUEUE_DETAIL_MS: u32 = 15_000; // 15 seconds
pub const AUTO_REFRESH_INTERVAL_DASHBOARD_MS: u32 = 30_000; // 30 seconds

// Receive count thresholds for UI coloring
pub const RECEIVE_COUNT_THRESHOLD_INFO: i32 = 1;
pub const RECEIVE_COUNT_THRESHOLD_WARNING: i32 = 3;
pub const RECEIVE_COUNT_THRESHOLD_CRITICAL: i32 = 5;

// Message age thresholds (seconds)
pub const MESSAGE_AGE_THRESHOLD_MODERATE: i64 = 3600; // 1 hour
pub const MESSAGE_AGE_THRESHOLD_OLD: i64 = 86400; // 1 day
pub const MESSAGE_AGE_THRESHOLD_VERY_OLD: i64 = 604800; // 7 days
