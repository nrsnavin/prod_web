import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import { PortalApp } from "@/portal/PortalApp";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PortalApp />
  </React.StrictMode>,
);
