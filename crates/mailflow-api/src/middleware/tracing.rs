/// Request tracing middleware
use axum::{extract::Request, http::HeaderValue, middleware::Next, response::Response};
use uuid::Uuid;

pub const X_CORRELATION_ID: &str = "x-correlation-id";
pub const X_REQUEST_ID: &str = "x-request-id";

/// Middleware to add correlation ID and request ID to all requests
/// This allows tracking requests through the system
pub async fn tracing_middleware(mut req: Request, next: Next) -> Response {
    // Get or generate correlation ID from request header
    let correlation_id = req
        .headers()
        .get(X_CORRELATION_ID)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
        .unwrap_or_else(|| Uuid::new_v4().to_string());

    // Always generate a new request ID
    let request_id = Uuid::new_v4().to_string();

    // Store IDs in request extensions for use in handlers and other middleware
    req.extensions_mut().insert(TraceContext {
        correlation_id: correlation_id.clone(),
        request_id: request_id.clone(),
    });

    // Log request with trace IDs
    tracing::info!(
        correlation_id = %correlation_id,
        request_id = %request_id,
        method = %req.method(),
        uri = %req.uri(),
        "Incoming request"
    );

    // Call next middleware/handler
    let mut response = next.run(req).await;

    // Add trace IDs to response headers
    if let Ok(correlation_header) = HeaderValue::from_str(&correlation_id) {
        response
            .headers_mut()
            .insert(X_CORRELATION_ID, correlation_header);
    }
    if let Ok(request_header) = HeaderValue::from_str(&request_id) {
        response.headers_mut().insert(X_REQUEST_ID, request_header);
    }

    // Log response with trace IDs
    tracing::info!(
        correlation_id = %correlation_id,
        request_id = %request_id,
        status = %response.status(),
        "Outgoing response"
    );

    response
}

/// Trace context stored in request extensions
#[derive(Clone, Debug)]
pub struct TraceContext {
    pub correlation_id: String,
    pub request_id: String,
}

impl TraceContext {
    pub fn from_request(req: &Request) -> Option<Self> {
        req.extensions().get::<TraceContext>().cloned()
    }
}
