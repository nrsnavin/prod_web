import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import "./index.css";
import { startPwa } from "./pwa/registerServiceWorker";
import { installFormMessages } from "./core/forms/formMessages";

startPwa();

// What a field says when it is wrong and has no message of its own.
installFormMessages();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
