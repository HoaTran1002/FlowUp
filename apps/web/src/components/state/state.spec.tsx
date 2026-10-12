import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api';
import { Empty } from './empty';
import { RootErrorBoundary } from './error-boundary';
import { ErrorState } from './error-state';
import { Loading } from './loading';

function apiError(overrides: Partial<ConstructorParameters<typeof ApiError>[0]> = {}): ApiError {
  return new ApiError({
    kind: 'server',
    message: 'FlowUp could not complete the request.',
    status: 503,
    code: 'internal_error',
    requestId: 'req_support0001',
    details: {},
    retryAfterSeconds: null,
    ...overrides,
  });
}

describe('Loading', () => {
  it('is announced to assistive technology', () => {
    render(<Loading label="Loading deliveries" />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent('Loading deliveries');
  });
});

describe('Empty', () => {
  it('renders a fact, not an error', () => {
    render(<Empty title="No events yet" description="Publish one with the producer API." />);

    expect(screen.getByTestId('state-empty')).toHaveTextContent('No events yet');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('ErrorState', () => {
  it('is announced and shows the support reference', () => {
    render(<ErrorState error={apiError()} />);

    expect(screen.getByRole('alert')).toHaveTextContent('FlowUp could not complete the request.');
    expect(screen.getByRole('alert')).toHaveTextContent('req_support0001');
  });

  it('offers retry for a transient failure and calls back', async () => {
    const onRetry = vi.fn();
    render(<ErrorState error={apiError()} onRetry={onRetry} />);

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('does not offer retry for a rejected request', () => {
    render(<ErrorState error={apiError({ kind: 'unprocessable', status: 422 })} onRetry={vi.fn()} />);

    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });

  it('falls back to safe copy and never prints a raw thrown value', () => {
    render(<ErrorState error={new Error('ECONNREFUSED 10.0.0.5:5432 stack trace')} />);

    expect(screen.getByRole('alert')).not.toHaveTextContent('ECONNREFUSED');
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
  });
});

function Boom({ error }: { error: unknown }): React.JSX.Element {
  // eslint-disable-next-line @typescript-eslint/only-throw-error -- exercising the boundary with any value
  throw error;
}

describe('RootErrorBoundary', () => {
  it('catches a render error and shows a safe fallback', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <RootErrorBoundary>
        <Boom error={new Error('internal detail at /src/secret/path.ts:42')} />
      </RootErrorBoundary>,
    );

    const fallback = screen.getByTestId('root-error-boundary');
    expect(fallback).toHaveAttribute('role', 'alert');
    expect(fallback).not.toHaveTextContent('internal detail');
    expect(fallback).not.toHaveTextContent('secret/path');
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
  });

  it('shows the request_id when the failure came from the API', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <RootErrorBoundary>
        <Boom error={apiError({ requestId: 'req_boundary01' })} />
      </RootErrorBoundary>,
    );

    expect(screen.getByTestId('root-error-boundary')).toHaveTextContent('req_boundary01');
  });

  it('renders children when nothing throws', () => {
    render(
      <RootErrorBoundary>
        <p>fine</p>
      </RootErrorBoundary>,
    );

    expect(screen.getByText('fine')).toBeInTheDocument();
  });
});
