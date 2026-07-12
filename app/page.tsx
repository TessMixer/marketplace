import MarketplaceApp from "./components/MarketplaceApp";
import { AuthProvider } from "./auth/AuthProvider";

export default function Home() {
  return <AuthProvider><MarketplaceApp /></AuthProvider>;
}
