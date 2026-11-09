// What the chat shows when every model fails. The full error goes to the server log
// (Vercel → Logs); the user sees only its type and HTTP status, never the message.
export function agentErrorMessage(e) {
  console.error('[agent] model error:', e);
  const inner = e?.lastError || e;
  const code = [inner?.name || e?.name || 'Error', inner?.statusCode || e?.statusCode]
    .filter(Boolean)
    .join(' ');
  return `The assistant is unavailable right now. (${code})`;
}
