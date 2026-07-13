import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { TenantProvider } from "./context/TenantContext.jsx";

createRoot(document.getElementById("root")).render(
  <TenantProvider>
    <App />
  </TenantProvider>
);
