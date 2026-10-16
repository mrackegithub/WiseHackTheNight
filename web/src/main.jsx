import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

function App() {
  const [health, setHealth] = useState({ status: "checking", value: null });

  useEffect(() => {
    fetch("/api/health")
      .then(async (response) => {
        const body = await response.text();
        const contentType = response.headers.get("content-type") || "";

        if (contentType.includes("text/html") || body.trimStart().startsWith("<!doctype")) {
          throw new Error("API endpoint is not available");
        }

        if (!response.ok) {
          throw new Error(`${response.status} ${body || response.statusText}`);
        }
        return body;
      })
      .then((value) => setHealth({ status: "success", value }))
      .catch((error) => setHealth({ status: "error", value: error.message }));
  }, []);

  return (
    <main className="page">
      <h1>Wise Hack The Night</h1>
      <p className="muted">Work in progress.</p>

      <section className="status" aria-labelledby="status-title">
        <h2 id="status-title">System status</h2>
        <p aria-live="polite">
          API:{" "}
          {health.status === "checking"
            ? "checking..."
            : health.status === "success"
              ? `online (${health.value})`
              : `offline (${health.value})`}
        </p>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
