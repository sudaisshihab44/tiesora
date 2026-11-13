import { isSupabaseConfigured, supabase } from '../supabase';
import { isDemoSandboxActive } from '../demoSandbox';

/** Common shape of PostgREST and Storage errors. */
export interface ErrorLike {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
}

/**
 * Error thrown by the data layer. Wraps Supabase/PostgREST errors so the UI
 * can display a useful message and optional diagnostic code.
 */
export class DbError extends Error {
  readonly code?: string;
  readonly details?: string;
  readonly hint?: string;

  constructor(message: string, error?: ErrorLike | null) {
    super(error?.message ? `${message}: ${error.message}` : message);
    this.name = 'DbError';
    this.code = error?.code;
    this.details = error?.details;
    this.hint = error?.hint;
  }
}

/**
 * Returns the configured Supabase client or throws a clear error.
 * Demo mode must branch before calling the data layer.
 */
export function db() {
  if (isDemoSandboxActive()) {
    throw new DbError('The live demo is read-only. Create an account to edit a real family.');
  }
  if (!isSupabaseConfigured || !supabase) {
    throw new DbError(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.',
    );
  }
  return supabase;
}

type ThenableResult<T> = PromiseLike<{
  data: T;
  error: ErrorLike | null;
}>;

/** Awaits a query that returns a single object (or null). */
export async function queryOne<T>(
  promise: ThenableResult<T | null>,
  context: string,
): Promise<T> {
  const { data, error } = await promise;
  if (error) throw new DbError(context, error);
  if (data === null || data === undefined) {
    throw new DbError(`${context}: record not found`);
  }
  return data;
}

/** Awaits a query that returns an array. */
export async function queryMany<T>(
  promise: ThenableResult<T[] | null>,
  context: string,
): Promise<T[]> {
  const { data, error } = await promise;
  if (error) throw new DbError(context, error);
  return data ?? [];
}

/** Awaits a query where only success/failure matters (insert/delete). */
export async function execute(
  promise: ThenableResult<unknown>,
  context: string,
): Promise<void> {
  const { error } = await promise;
  if (error) throw new DbError(context, error);
}

/** Removes keys whose value is `undefined` so partial updates stay partial. */
export function defined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}
