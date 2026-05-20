const pty = require('node-pty');

async function test() {
  try {
    console.log('Testing with name=undefined');
    pty.spawn(undefined, [], {});
  } catch (e) {
    console.error('Error with name=undefined:', e);
  }

  try {
    console.log('Testing with args=undefined');
    pty.spawn('cmd.exe', undefined, {});
  } catch (e) {
    console.error('Error with args=undefined:', e);
  }

  try {
    console.log('Testing with options=undefined');
    pty.spawn('cmd.exe', [], undefined);
  } catch (e) {
    console.error('Error with options=undefined:', e);
  }
}

test();
