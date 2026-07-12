import { createRoot } from "react-dom/client";
import { AuthProvider } from "../app/auth/AuthProvider";
import MarketplaceApp from "../app/components/MarketplaceApp";
import "../app/globals.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("ไม่พบ root element สำหรับเริ่มแอป");
}

createRoot(root).render(
  <AuthProvider>
    <MarketplaceApp />
  </AuthProvider>,
);
