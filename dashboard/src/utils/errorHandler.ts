import { message as antMessage } from 'antd';

export interface ApiError {
  status?: number;
  message: string;
  data?: any;
}

/**
 * Centralized error handler for API responses
 * @param error - The error object from API call
 * @param customMessage - Optional custom message to display
 * @returns The error message that was displayed
 */
export const handleApiError = (error: any, customMessage?: string): string => {
  // Extract error details
  const statusCode = error.response?.status;
  const errorMessage = error.response?.data?.message || error.message || 'An unknown error occurred';
  const errorData = error.response?.data;

  // Determine the appropriate user-friendly message
  let displayMessage: string;

  if (customMessage) {
    displayMessage = customMessage;
  } else if (statusCode === 401) {
    displayMessage = 'Your session has expired. Please login again.';
    // Optionally redirect to login
    setTimeout(() => {
      window.location.href = '/login';
    }, 2000);
  } else if (statusCode === 403) {
    displayMessage = 'You do not have permission to perform this action.';
  } else if (statusCode === 404) {
    displayMessage = 'The requested resource was not found.';
  } else if (statusCode === 429) {
    displayMessage = 'Too many requests. Please try again later.';
  } else if (statusCode >= 500) {
    displayMessage = 'Server error. Please try again or contact support.';
  } else {
    // Use the error message from the API if available
    displayMessage = errorMessage;
  }

  // Display the error message
  antMessage.error(displayMessage);

  // Log the full error for debugging (only in development)
  if (import.meta.env.DEV) {
    console.error('API Error:', {
      status: statusCode,
      message: errorMessage,
      data: errorData,
      fullError: error,
    });
  }

  return displayMessage;
};

/**
 * Wrapper for API calls with automatic error handling
 * @param apiCall - The API call function to execute
 * @param errorMessage - Optional custom error message
 * @returns Promise that resolves with the API response or rejects with handled error
 */
export const withErrorHandling = async <T>(
  apiCall: () => Promise<T>,
  errorMessage?: string
): Promise<T> => {
  try {
    return await apiCall();
  } catch (error) {
    handleApiError(error, errorMessage);
    throw error;
  }
};

/**
 * Show success message
 * @param msg - The success message to display
 */
export const showSuccess = (msg: string): void => {
  antMessage.success(msg);
};

/**
 * Show info message
 * @param msg - The info message to display
 */
export const showInfo = (msg: string): void => {
  antMessage.info(msg);
};

/**
 * Show warning message
 * @param msg - The warning message to display
 */
export const showWarning = (msg: string): void => {
  antMessage.warning(msg);
};
