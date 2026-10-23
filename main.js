import { CodeJar } from "./vendor/codejar-4.2.0.js";
import htm from "./vendor/htm-3.1.1.js";
import { examples } from "./examples.js?v=2d911f26";

const { createElement, useCallback, useEffect, useRef, useState } = React;
const html = htm.bind(createElement);

const unavailableHint = "Kotlin/Wasm needs a browser with WebAssembly GC, such as Chrome 119, Firefox 120 or Safari 18.2.";
const idleHint = "Ctrl+Enter runs the code.";

// The script windows are dragged by their title bars and resized by their other edges with interact.js, like desktop windows;
// a window comes to the front when it is pressed, and a double-click on a bar puts its window back at its original place and size
const visibleWhileDragged = 80;
const minimumSize = { width: 280, height: 120 };
let topLayer = 1;

const dockedHeight = () => document.querySelector(".console")?.offsetHeight ?? 0;

function useWindowFrame() {
  const frame = useRef(null);
  const bar = useRef(null);

  useEffect(() => {
    const element = frame.current;
    const header = bar.current;
    const state = { offset: { x: 0, y: 0 }, home: null, dragged: null };
    const raise = () => {
      if (element.style.zIndex !== String(topLayer)) {
        topLayer += 1;
        element.style.zIndex = topLayer;
      }
    };
    const move = (x, y) => {
      state.offset = { x, y };
      element.style.transform = x || y ? `translate(${x}px, ${y}px)` : "";
    };
    element.addEventListener("pointerdown", raise);
    const interact = globalThis.interact;
    if (!interact) {
      return () => element.removeEventListener("pointerdown", raise);
    }
    const dragging = interact(header)
      .styleCursor(false)
      .draggable({
        ignoreFrom: "button, select",
        listeners: {
          start() {
            const rect = element.getBoundingClientRect();
            state.home = { left: rect.left - state.offset.x, top: rect.top - state.offset.y, width: rect.width };
            state.dragged = { ...state.offset };
            raise();
            element.classList.add("dragging");
          },
          move(event) {
            state.dragged = { x: state.dragged.x + event.dx, y: state.dragged.y + event.dy };
            const { home, dragged } = state;
            const x = Math.min(Math.max(dragged.x, visibleWhileDragged - home.left - home.width), innerWidth - visibleWhileDragged - home.left);
            const y = Math.min(Math.max(dragged.y, -home.top), innerHeight - dockedHeight() - header.offsetHeight - home.top);
            move(x, y);
          },
          end() {
            element.classList.remove("dragging");
          },
        },
      })
      .on("doubletap", (event) => {
        if (!event.target.closest("button, select")) {
          element.style.width = "";
          element.style.height = "";
          element.classList.remove("resized");
          move(0, 0);
        }
      });
    const resizing = interact(element).resizable({
      edges: { left: true, right: true, bottom: true },
      margin: 8,
      modifiers: [interact.modifiers.restrictSize({ min: minimumSize })],
      listeners: {
        start() {
          raise();
          element.classList.add("resized", "resizing");
        },
        move(event) {
          element.style.width = `${event.rect.width}px`;
          element.style.height = `${event.rect.height}px`;
          // the page centers the windows, so a change of width also moves a window by half of it
          move(state.offset.x + event.deltaRect.left + event.deltaRect.width / 2, state.offset.y + event.deltaRect.top);
        },
        end() {
          element.classList.remove("resizing");
        },
      },
    });
    return () => {
      element.removeEventListener("pointerdown", raise);
      dragging.unset();
      resizing.unset();
    };
  }, []);

  return { frame, bar };
}

// a window with an onClose gets a close button in place of the red dot of its title bar
function Window({ className, header, children, onClose, onActivate }) {
  const { frame, bar } = useWindowFrame();
  const close = onClose ? html`<button className="close-button" title="Close" aria-label="Close" onClick=${onClose}></button>` : html`<span></span>`;
  return html`
    <div className=${`window ${className ?? ""}`} ref=${frame} onPointerDown=${onActivate} onFocus=${onActivate}>
      <div className="window-header" ref=${bar}>
        <div className="action-buttons">${close}<span></span><span></span></div>
        ${header}
      </div>
      ${children}
    </div>
  `;
}

// The console is docked to the bottom of the page like the tool windows of an IDE: it stays above the script windows, is resized by its
// top edge, and a double-click on its bar gives it back its default height. Its height is the --console-height property of the page, which
// also keeps room for it below the script windows
const consoleMinimumHeight = 80;
const consoleSpareAbove = 120;

function Console({ header, children }) {
  const panel = useRef(null);
  const root = document.documentElement;

  useEffect(() => {
    const interact = globalThis.interact;
    if (!interact) {
      return undefined;
    }
    const element = panel.current;
    const resizing = interact(element).resizable({
      edges: { top: true },
      margin: 8,
      listeners: {
        start() {
          element.classList.add("resizing");
        },
        move(event) {
          const height = Math.min(Math.max(event.rect.height, consoleMinimumHeight), innerHeight - consoleSpareAbove);
          root.style.setProperty("--console-height", `${height}px`);
        },
        end() {
          element.classList.remove("resizing");
        },
      },
    });
    return () => resizing.unset();
  }, []);

  return html`
    <section className="console" ref=${panel} aria-label="Console">
      <div className="console-header" onDoubleClick=${() => root.style.removeProperty("--console-height")}>${header}</div>
      ${children}
    </section>
  `;
}

// CodeJar edits the code in place; without highlight.js the code stays plain text
function CodeEditor({ code, onEditor }) {
  const element = useRef(null);
  const jar = useRef(null);
  const [lines, setLines] = useState(1);

  useEffect(() => {
    jar.current = CodeJar(
      element.current,
      (editor) => {
        editor.textContent = editor.textContent;
        delete editor.dataset.highlighted;
        globalThis.hljs?.highlightElement(editor);
        setLines(editor.textContent.replace(/\n$/, "").split("\n").length);
      },
      { tab: "    " },
    );
    onEditor(jar.current);
    return () => {
      onEditor(null);
      jar.current.destroy();
    };
  }, []);

  useEffect(() => {
    jar.current?.updateCode(code);
  }, [code]);

  return html`
    <div className="editor">
      <div className="line-numbers" aria-hidden="true">${Array.from({ length: lines }, (_, index) => index + 1).join("\n")}</div>
      <div className="code-editor language-python" spellCheck="false" data-gramm="false" ref=${element}></div>
    </div>
  `;
}

// output arrives in many small chunks, so it is buffered and rendered once per frame, merging chunks of the same kind
function useOutput() {
  const [chunks, setChunks] = useState([]);
  const pending = useRef([]);
  const frame = useRef(0);

  const flush = useCallback(() => {
    frame.current = 0;
    const added = pending.current;
    pending.current = [];
    setChunks((current) => {
      const merged = [...current];
      for (const chunk of added) {
        const last = merged[merged.length - 1];
        if (last && last.className === chunk.className) {
          merged[merged.length - 1] = { ...last, text: last.text + chunk.text };
        } else {
          merged.push(chunk);
        }
      }
      return merged;
    });
  }, []);

  const append = useCallback((text, className = "") => {
    pending.current.push({ text, className });
    if (!frame.current) {
      frame.current = requestAnimationFrame(flush);
    }
  }, [flush]);

  const clear = useCallback(() => {
    pending.current = [];
    setChunks([]);
  }, []);

  return { chunks, append, clear };
}

const exampleNames = Object.keys(examples);
let scriptCount = 0;

function newScript() {
  scriptCount += 1;
  return { id: scriptCount, example: exampleNames[0] };
}

// every script window has its own example and editor; they share one worker and the console, and Ctrl+Enter runs the window that
// was used last
function App() {
  const [scripts, setScripts] = useState(() => [newScript()]);
  const [phase, setPhase] = useState("loading");
  const [runningId, setRunningId] = useState(null);
  const [status, setStatus] = useState(idleHint);
  const output = useOutput();
  const editors = useRef(new Map());
  const worker = useRef(null);
  const activeId = useRef(null);
  const current = useRef({});
  current.current = { phase, runningId, scripts };

  const startWorker = useCallback(() => {
    setPhase("loading");
    setRunningId(null);
    const next = new Worker("worker.js?v=2d911f26");
    next.onmessage = (event) => {
      const message = event.data;
      if (message.type === "ready") {
        setPhase("ready");
      } else if (message.type === "failed") {
        output.append(`Kotlin/Wasm failed to load: ${message.error}\n`, "error");
        setStatus(unavailableHint);
        setPhase("unavailable");
      } else if (message.type === "stdout") {
        output.append(message.text);
      } else if (message.type === "done") {
        if (message.error) {
          output.append(message.error + "\n", "error");
        }
        setStatus(`Finished in ${message.millis.toFixed(0)} ms.`);
        setPhase("ready");
        setRunningId(null);
      }
    };
    next.onerror = (event) => {
      output.append(event.message + "\n", "error");
      setPhase("ready");
      setRunningId(null);
    };
    worker.current = next;
  }, [output.append]);

  useEffect(() => {
    startWorker();
    return () => worker.current?.terminate();
  }, [startWorker]);

  const stop = useCallback(() => {
    worker.current.terminate();
    output.append("Stopped.\n", "error");
    setStatus("Stopped.");
    startWorker();
  }, [startWorker, output.append]);

  const run = useCallback((id) => {
    const { phase, runningId } = current.current;
    if (phase === "running" && runningId === id) {
      stop();
    } else if (phase === "ready" && editors.current.has(id)) {
      output.clear();
      setStatus("Running...");
      setPhase("running");
      setRunningId(id);
      worker.current.postMessage({ source: editors.current.get(id).toString() });
    }
  }, [stop, output.clear]);

  const close = useCallback((id) => {
    const { phase, runningId } = current.current;
    if (phase === "running" && runningId === id) {
      stop();
    }
    setScripts((scripts) => scripts.filter((script) => script.id !== id));
  }, [stop]);

  const open = useCallback(() => {
    const script = newScript();
    activeId.current = script.id;
    setScripts((scripts) => [...scripts, script]);
  }, []);

  const chooseExample = useCallback((id, example) => {
    setScripts((scripts) => scripts.map((script) => (script.id === id ? { ...script, example } : script)));
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        const { phase, scripts } = current.current;
        const target = scripts.find((script) => script.id === activeId.current) ?? scripts[scripts.length - 1];
        if (phase !== "running" && target) {
          run(target.id);
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [run]);

  const scriptHeader = (script) => {
    const own = runningId === script.id;
    const text = { loading: "Loading", ready: "Run", running: own ? "Stop" : "Run", unavailable: "Unavailable" }[phase];
    const disabled = phase === "loading" || phase === "unavailable" || (phase === "running" && !own);
    return html`
      <span className="window-title">Script ${script.id}</span>
      <select value=${script.example} onChange=${(event) => chooseExample(script.id, event.target.value)}>
        ${exampleNames.map((name) => html`<option key=${name} value=${name}>${name}</option>`)}
      </select>
      <div className="spacer"></div>
      <button className=${own ? "run-button running" : "run-button"} disabled=${disabled} onClick=${() => run(script.id)}>${text}</button>
    `;
  };

  return html`
    <div className="page-controls">
      <button className="new-script" onClick=${open}>New script</button>
    </div>
    <h1>KoPy</h1>
    <div className="workspace">
    ${scripts.map((script) => html`
      <${Window}
        key=${script.id}
        className="script-window"
        header=${scriptHeader(script)}
        onClose=${() => close(script.id)}
        onActivate=${() => { activeId.current = script.id; }}
      >
        <${CodeEditor}
          code=${examples[script.example]}
          onEditor=${(jar) => (jar ? editors.current.set(script.id, jar) : editors.current.delete(script.id))}
        />
      <//>
    `)}
    </div>
    <${Console} header=${html`
      <span className="window-title">Output</span>
      <div className="spacer"></div>
      <button className="clear-button" onClick=${output.clear} onDoubleClick=${(event) => event.stopPropagation()}>Clear</button>
    `}>
      <pre id="output-wrapper"><span id="code-output">${output.chunks.map((chunk, index) => html`<span key=${index} className=${chunk.className}>${chunk.text}</span>`)}</span></pre>
      <div id="status">${status}</div>
    <//>
  `;
}

ReactDOM.createRoot(document.querySelector("#app")).render(html`<${App} />`);
