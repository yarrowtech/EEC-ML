import { createRoot } from "react-dom/client";
import { MotionConfig } from "framer-motion";
import "./index.css";
import App from "./App.jsx";
import { TenantProvider } from "./context/TenantContext.jsx";

createRoot(document.getElementById("root")).render(
  // `reducedMotion="user"` makes every Framer Motion animation honour the OS
  // "reduce motion" setting (transforms/opacity are replaced with instant cuts).
  <MotionConfig reducedMotion="user">
    <TenantProvider>
      <App />
    </TenantProvider>
  </MotionConfig>
);
