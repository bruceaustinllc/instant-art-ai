export function getInvokeErrorMessage(err: unknown): string {
  const fallback = err instanceof Error ? err.message : 'Request failed';

  // Supabase Functions errors sometimes include a `context` with the raw body.
  const anyErr = err as any;

  // Check for Supabase FunctionsHttpError structure
  if (anyErr && typeof anyErr === 'object' && anyErr.name === 'FunctionsHttpError' && anyErr.context?.body) {
    const ctxBody = anyErr.context.body;
    if (typeof ctxBody === 'string') {
      try {
        const parsed = JSON.parse(ctxBody);
        if (typeof parsed?.error === 'string') return parsed.error;
        if (typeof parsed?.message === 'string') return parsed.message;
      } catch {
        // ignore JSON parsing errors
      }
    }
  } else if (anyErr && typeof anyErr === 'object' && anyErr.error) {
    // Sometimes the error is directly in the 'error' property of the object
    if (typeof anyErr.error === 'string') return anyErr.error;
    if (typeof anyErr.error === 'object' && anyErr.error.message) return anyErr.error.message;
  }


  // Friendly mapping when status bubbles up in message
  const msg = String(fallback || '');
  if (msg.includes('401')) return 'Invalid API key. Please check your OPENROUTER_API_KEY in Supabase secrets.';
  if (msg.includes('402')) return 'Usage limit reached. Please add credits to your OpenRouter account.';
  if (msg.includes('429')) return 'Rate limit exceeded. Please try again in a moment.';
  if (msg.includes('503')) return 'Model is currently loading or busy. Please try again in a moment.';

  return fallback;
}