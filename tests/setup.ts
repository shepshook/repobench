import child_process from 'child_process';

/**
 * Monkey-patch to silence 'AttachConsole failed' noise from node-pty's background agent on Windows.
 * node-pty spawns a detached side-process (conpty_console_list_agent.js) to track process trees.
 * This agent crashes frequently when shells terminate abruptly, dumping raw Win32 errors to stderr.
 */
const originalFork = child_process.fork;

child_process.fork = function (modulePath, args, options) {
  if (modulePath && (typeof modulePath === 'string' && modulePath.includes('conpty_console_list_agent'))) {
    const customizedOptions = { ...options, silent: true };
    
    const child = originalFork.call(this, modulePath, args, customizedOptions);

    child.stderr?.on('data', (data) => {
      const errorMessage = data.toString();
      if (!errorMessage.includes('AttachConsole failed')) {
        process.stderr.write(data);
      }
    });

    return child;
  }

  return originalFork.apply(this, arguments);
};

/**
 * Global handler to silence EPIPE errors during PTY stress tests.
 * EPIPE occurs when writes are attempted on a pipe that the OS has already closed,
 * often due to race conditions during rapid process termination in node-pty on Windows.
 */
process.on('uncaughtException', (err: any) => {
  if (err.code === 'EPIPE') {
    // Silence broken pipe errors during stress tests
    return;
  }
  // Propagate all other exceptions
  console.error('Uncaught Exception:', err);
  process.exit(1);
});
