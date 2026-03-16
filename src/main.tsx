import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const rootEl = document.getElementById("root")!;
rootEl.textContent = "Carregando aplicação...";
console.log("Bootstrapping React app...");
createRoot(rootEl).render(<App />);
