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
            ApiError::Internal(msg) => {
                // Log the actual error but return generic message
                error!("Internal error: {}", msg);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "An internal error occurred".to_string(),
                    "INTERNAL_ERROR",
                )
            }
            ApiError::Aws(msg) => {
                // Log the actual AWS error but return generic message
                error!("AWS service error: {}", msg);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "A service error occurred".to_string(),
                    "SERVICE_ERROR",
                )
            }
        };

        let body = Json(json!({
            "error": error_message,
            "code": error_code,
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
