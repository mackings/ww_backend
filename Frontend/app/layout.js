import "./globals.css";
import { AuthProvider } from "@/features/auth/context/auth-context";

export const metadata = {
  title: "WoodWork | From material cost to completed order",
  description: "Manage materials, quotations, Bill of Materials, production, sales, inventory and invoices in one workspace."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
