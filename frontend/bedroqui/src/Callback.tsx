// src/Callback.tsx
import { useEffect, useState } from "react";
import { handleCallback } from "./auth";

export default function Callback() {
  const [status, setStatus] = useState("Exchanging code for tokens…");

  useEffect(() => {
    (async () => {
      try {
        await handleCallback();
        setStatus("Success. Redirecting…");
        window.location.replace("/"); // send them back home
      } catch (e: any) {
        setStatus(`Auth error: ${e?.message || e}`);
      }
    })();
  }, []);

  return <div style={{ padding: 24 }}>{status}</div>;
}
