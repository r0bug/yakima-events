import { json } from '@sveltejs/kit';
import { z } from 'zod';

export function apiError(message: string, status = 400) {
  return json({ success: false, error: message }, { status });
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
