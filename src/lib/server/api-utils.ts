import { json } from '@sveltejs/kit';
import { z } from 'zod';

export function apiError(message: string, status = 400) {
  return json({ success: false, error: message }, { status });
}

/**
 * The single definition of "admin" for this app: the `admin` and `moderator`
 * roles (the same pair the admin panel layout has always let in).
 */
export function isAdminUser(user: { role?: string | null } | null | undefined): boolean {
  return !!user && (user.role === 'admin' || user.role === 'moderator');
}

/**
 * Guard for admin-only API mutations. Returns an error response to send,
 * or null when the user is an admin/moderator.
 */
export function requireAdmin(locals: App.Locals): Response | null {
  if (!locals.user) {
    return apiError('Authentication required', 401);
  }
  if (!isAdminUser(locals.user)) {
    return apiError('Forbidden', 403);
  }
  return null;
}

/**
 * Parse a non-negative integer query parameter (limit/offset). Anything that
 * is not a plain non-negative integer is ignored rather than handed to SQL.
 */
export function parseNonNegativeInt(value: string | null, max = 10000): number | undefined {
  if (value === null || !/^\d{1,9}$/.test(value)) return undefined;
  return Math.min(parseInt(value, 10), max);
}

/** Parse a finite float query parameter, or undefined. */
export function parseFiniteFloat(value: string | null): number | undefined {
  if (value === null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export function apiSuccess(data: unknown, status = 200) {
  return json({ success: true, ...data as object }, { status });
}

export async function validateBody<T extends z.ZodType>(
  request: Request,
  schema: T
): Promise<{ data: z.infer<T> } | { error: Response }> {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);
    if (!result.success) {
      const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return { error: apiError(errors) };
    }
    return { data: result.data };
  } catch {
    return { error: apiError('Invalid JSON body') };
  }
}
