import { createRoot } from "react-dom/client";
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css';
import App from "./App.tsx";
import "./index.css";

const rootEl = document.getElementById("root")!;
rootEl.textContent = "Carregando aplicação...";
console.log("Bootstrapping React app...");
createRoot(rootEl).render(<App />);
