export function getInvokeErrorMessage(err: unknown): string {
  const fallback = err instanceof Error ? err.message : 'Request failed';

  // Supabase Functions errors sometimes include a `context` with the raw body.
  const anyErr = err as any;
  const ctxBody = anyErr?.context?.body;

  if (typeof ctxBody === 'string') {
    try {
      const parsed = JSON.parse(ctxBody);
      if (typeof parsed?.error === 'string') return parsed.error;
      if (typeof parsed?.message === 'string') return parsed.message;
    } catch {
      // ignore
    }
  }

  // Friendly mapping when status bubbles up in message
  const msg = String(fallback || '');
  if (msg.includes('402')) return 'Usage limit reached. Please add credits to continue.';
  if (msg.includes('429')) return 'Rate limit exceeded. Please try again in a moment.';

  return fallback;
}
