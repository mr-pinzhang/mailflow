/**
 * Suppress known console warnings from third-party libraries
 * These warnings are cosmetic and come from libraries we don't control
 */

const originalWarn = console.warn;
const originalError = console.error;

const suppressedWarnings = [
  // Ant Design Menu deprecation from Refine library
  '[antd: Menu] `children` is deprecated',
  // Ant Design Input.Search deprecation
  '[antd: Input] `addonAfter` is deprecated',
  // React 19 compatibility warning (Ant Design officially supports 16-18)
  'antd v5 support React is 16 ~ 18',
  // Ant Design message static function warning (fixed by AntApp wrapper, but may still appear)
  'Static function can not consume context',
];

// Suppress specific warnings during development
if (import.meta.env.DEV) {
  console.warn = (...args: any[]) => {
    const message = args.join(' ');
    const shouldSuppress = suppressedWarnings.some(pattern =>
      message.includes(pattern)
    );

    if (!shouldSuppress) {
      originalWarn.apply(console, args);
    }
  };

  console.error = (...args: any[]) => {
    const message = args.join(' ');

    // Don't suppress actual errors, only warning-level console.errors
    const isDeprecationWarning = message.includes('deprecated') ||
                                  message.includes('Warning:');

    const shouldSuppress = isDeprecationWarning && suppressedWarnings.some(pattern =>
      message.includes(pattern)
    );

    if (!shouldSuppress) {
      originalError.apply(console, args);
    }
  };
}

export const restoreWarnings = () => {
  console.warn = originalWarn;
  console.error = originalError;
};
