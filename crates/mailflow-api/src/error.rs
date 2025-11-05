/// API Error types
use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde_json::json;
use tracing::error;

/// API Error
#[derive(Debug, thiserror::Error)]
pub enum ApiError {
    #[error("Unauthorized: {0}")]
    Unauthorized(String),

    #[error("Forbidden: {0}")]
    Forbidden(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Bad request: {0}")]
    BadRequest(String),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Conflict: {0}")]
    Conflict(String),

    #[error("Too many requests: {0}")]
    TooManyRequests(String),

    #[error("Service unavailable: {0}")]
    ServiceUnavailable(String),

    #[error("Internal server error: {0}")]
    Internal(String),

    #[error("AWS error: {0}")]
    Aws(String),
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, error_message, error_code) = match &self {
            ApiError::Unauthorized(msg) => (StatusCode::UNAUTHORIZED, msg.clone(), "UNAUTHORIZED"),
            ApiError::Forbidden(msg) => (StatusCode::FORBIDDEN, msg.clone(), "FORBIDDEN"),
            ApiError::NotFound(msg) => (StatusCode::NOT_FOUND, msg.clone(), "NOT_FOUND"),
            ApiError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg.clone(), "BAD_REQUEST"),
            ApiError::Validation(msg) => (
                StatusCode::UNPROCESSABLE_ENTITY,
                msg.clone(),
                "VALIDATION_ERROR",
            ),
            ApiError::Conflict(msg) => (StatusCode::CONFLICT, msg.clone(), "CONFLICT"),
            ApiError::TooManyRequests(msg) => (
                StatusCode::TOO_MANY_REQUESTS,
                msg.clone(),
                "TOO_MANY_REQUESTS",
            ),
            ApiError::ServiceUnavailable(msg) => (
                StatusCode::SERVICE_UNAVAILABLE,
                msg.clone(),
                "SERVICE_UNAVAILABLE",
            ),
            ApiError::Internal(msg) => {
                // Log the actual error but return generic message
                error!(error = %msg, "Internal error");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "An internal error occurred".to_string(),
                    "INTERNAL_ERROR",
                )
            }
            ApiError::Aws(msg) => {
                // Log the actual AWS error but return generic message
                error!(error = %msg, "AWS service error");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "A service error occurred. Please try again.".to_string(),
                    "SERVICE_ERROR",
                )
            }
        };

        let body = Json(json!({
            "error": error_message,
            "code": error_code,
            "timestamp": chrono::Utc::now().to_rfc3339(),
        }));

        (status, body).into_response()
    }
}

/// Convert mailflow-core errors to API errors
impl From<mailflow_core::MailflowError> for ApiError {
    fn from(err: mailflow_core::MailflowError) -> Self {
        ApiError::Internal(err.to_string())
    }
}
