
const { Worker } = require("node:worker_threads");
const path = require("node:path");

async function run() {
  console.log("Spawning worker...");
  const workerPath = path.resolve(__dirname, "src/infrastructure/pty/pty-worker.cjs");
  const worker = new Worker(workerPath);

  worker.on("message", (msg) => {
    console.log("Received message:", msg);
  });

  worker.on("error", (err) => {
    console.error("Worker error:", err);
    process.exit(1);
  });

  worker.on("exit", (code) => {
    console.log("Worker exited with code:", code);
  });

  console.log("Sending spawn request...");
  worker.postMessage({
    type: "spawn",
    payload: {
      driverType: "simulation",
      options: {}
    },
    id: "1"
  });

  // Wait a bit and then terminate
  setTimeout(() => {
    console.log("Terminating worker...");
    worker.terminate();
  }, 1000);
}

run().catch(console.error);
