/// JWT Authentication Middleware for Axum
use axum::{
    extract::{Request, State},
    middleware::Next,
    response::Response,
};
use std::sync::Arc;
use tracing::{debug, warn};

use crate::{
    auth::jwt::{Claims, JwtValidator},
    context::ApiContext,
    error::ApiError,
};

/// Extension type to carry user claims through request
#[derive(Debug, Clone)]
pub struct UserClaims(pub Claims);

/// JWT authentication middleware
///
/// Validates JWT token from Authorization header and adds user claims to request extensions.
/// Returns 401 Unauthorized if token is missing or invalid.
pub async fn auth_middleware(
    State(ctx): State<Arc<ApiContext>>,
    mut request: Request,
    next: Next,
) -> Result<Response, ApiError> {
    // Extract Authorization header
    let auth_header = request
        .headers()
        .get("Authorization")
        .and_then(|h| h.to_str().ok());

    debug!("Processing authentication for request: {}", request.uri());

    // Extract token
    let token = JwtValidator::extract_token(auth_header).map_err(|e| {
        warn!("Failed to extract token: {}", e);
        ApiError::Unauthorized(e)
    })?;

    // Validate token
    let claims = ctx
        .jwt_validator
        .validate(&token, &ctx.jwt_issuer)
        .map_err(|e| {
            warn!("JWT validation failed: {}", e);
            ApiError::Unauthorized(format!("Invalid token: {}", e))
        })?;

    debug!("JWT validated for user: {} ({})", claims.email, claims.sub);

    // Add claims to request extensions
    request.extensions_mut().insert(UserClaims(claims));

    // Continue to next handler
    Ok(next.run(request).await)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_middleware_missing_token() {
        // This test verifies the middleware rejects requests without Authorization header
        // We can't create a full ApiContext without AWS credentials, so this is a basic test

        // Test that extract_token returns error for missing header
        let result = JwtValidator::extract_token(None);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Missing Authorization header");
    }

    #[tokio::test]
    async fn test_middleware_invalid_format() {
        // Test that extract_token returns error for invalid format
        let result = JwtValidator::extract_token(Some("InvalidFormat"));
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Bearer"));
    }

    #[tokio::test]
    async fn test_middleware_extracts_token() {
        // Test that extract_token correctly extracts the token
        let result = JwtValidator::extract_token(Some("Bearer test-token-123"));
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "test-token-123");
    }
}
