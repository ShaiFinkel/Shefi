import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App.tsx";
import { EmployeeApp } from "./EmployeeApp.tsx";
import "./index.css";
import { registerSW } from "virtual:pwa-register";

// Simple route split: anything under /me is the Employee PWA, everything
// else is the CEO dashboard. This avoids pulling in react-router for what
// is effectively a binary decision.
const path = window.location.pathname;
const isEmployeePortal = path === "/me" || path.startsWith("/me/");

const Root = isEmployeePortal ? <EmployeeApp /> : <App />;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>{Root}</React.StrictMode>,
);

// Register the PWA service worker (no-op in dev unless devOptions enabled).
registerSW({ immediate: true });
