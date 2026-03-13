'use client';

import * as React from 'react';

// import { useCaptureError } from '@workspace/monitoring/hooks/use-capture-error';

export type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({
  error,
  reset
}: GlobalErrorProps): React.JSX.Element {
  // We don't monitor the marketing app, but you can enable it if users report errors.
  // useCaptureError(error);
  React.useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <html>
      <body>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            fontFamily: 'system-ui, sans-serif'
          }}
        >
          <h2>Something went wrong!</h2>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              cursor: 'pointer'
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
