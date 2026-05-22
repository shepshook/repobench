export function mapSpawnErrorToRca(e: unknown): string {
  const err = e as { message?: string } | null | undefined;
  const msg = err?.message || String(e);
  const prefix = 'PtySession failed to spawn: ';
  const lowerMsg = msg.toLowerCase();

  if (lowerMsg.includes('access is denied')) {
    return `${prefix}Windows privilege requirements (please run as administrator)`;
  } else if (lowerMsg.includes('invalid handle')) {
    return `${prefix}environmental configurations issue (Invalid handle)`;
  } else if (lowerMsg.includes('internal windows error')) {
    return `${prefix}node-pty dependency limitations (Internal Windows error)`;
  } else if (lowerMsg.includes('containerid is required')) {
    return `${prefix}Docker driver was requested but no containerId was provided by the sandbox`;
  } else if (lowerMsg.includes('epipe')) {
    return `${prefix}Broken pipe (the PTY process likely crashed or closed unexpectedly)`;
  } else if (lowerMsg.includes('econnreset')) {
    return `${prefix}Connection reset by peer (the PTY process likely crashed or closed unexpectedly)`;
  } else if (lowerMsg.includes('pty session is closed')) {
    return `${prefix}PTY session was closed`;
  }
  return `${prefix}${msg}`;
}
