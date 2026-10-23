// Runs KoPy off the main thread with the Kotlin/Wasm build, which publishes self["kotlin-python"] as a promise of the module exports,
// including runPython(source, stdout), that resolves once the module is instantiated
try {
  importScripts("kopy-wasm.js?v=2d911f26");
  Promise.resolve(self["kotlin-python"]).then(
    (kopy) => {
      self.onmessage = (event) => {
        const started = performance.now();
        const error = kopy.runPython(event.data.source, (text) => {
          self.postMessage({ type: "stdout", text });
        });
        self.postMessage({ type: "done", error, millis: performance.now() - started });
      };
      self.postMessage({ type: "ready" });
    },
    (error) => self.postMessage({ type: "failed", error: String(error) }),
  );
} catch (error) {
  self.postMessage({ type: "failed", error: String(error) });
}
