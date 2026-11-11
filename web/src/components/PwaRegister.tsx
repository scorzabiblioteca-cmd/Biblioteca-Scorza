"use client";

import { useEffect } from "react";

export default function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const esDesarrolloLocal = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
    if (esDesarrolloLocal) {
      void (async () => {
        try {
          const estabaControlada = navigator.serviceWorker.controller !== null;
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map((registration) => registration.unregister()));
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames
            .filter((name) => name.startsWith("biblioscorza-pwa-"))
            .map((name) => caches.delete(name)));
          if (estabaControlada) window.location.reload();
        } catch (error) {
          console.error("No se pudo limpiar la caché PWA del entorno local:", error);
        }
      })();
      return;
    }

    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error: unknown) => {
      console.error("No se pudo registrar el service worker de BiblioScorza:", error);
    });
  }, []);

  return null;
}
