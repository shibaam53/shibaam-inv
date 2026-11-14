import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Prevent accidental number modifications when scrolling over number inputs across the entire app
if (typeof window !== "undefined") {
  window.addEventListener(
    "wheel",
    () => {
      if (
        document.activeElement instanceof HTMLInputElement &&
        document.activeElement.type === "number"
      ) {
        document.activeElement.blur();
      }
    },
    { passive: true },
  );
}

// Register PWA Service Worker for app shell caching
if (typeof window !== "undefined" && "serviceWorker" in navigator && window.location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        reg.onupdatefound = () => {
          const installingWorker = reg.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
                console.log("[PWA] New version ready.");
              }
            };
          }
        };
      })
      .catch((err) => {
        console.warn("[PWA] Service worker registration skipped:", err);
      });
  });
}
