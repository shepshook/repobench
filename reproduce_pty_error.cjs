const pty = require('node-pty');

async function test() {
  try {
    console.log('Testing with TERM=xterm');
    pty.spawn('cmd.exe', [], { env: { TERM: 'xterm' } });
    console.log('Success with xterm');
  } catch (e) {
    console.error('Error with xterm:', e);
  }

  try {
    console.log('Testing with TERM=undefined');
    pty.spawn('cmd.exe', [], { env: { TERM: undefined } });
    console.log('Success with undefined');
  } catch (e) {
    console.error('Error with undefined:', e);
  }

  try {
    console.log('Testing with TERM=');
    pty.spawn('cmd.exe', [], { env: { TERM: '' } });
    console.log('Success with empty');
  } catch (e) {
    console.error('Error with empty:', e);
  }
}

test();
