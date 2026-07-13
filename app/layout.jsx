import "./globals.css";

export const metadata = {
  title: "TeleSales Command Center",
  description: "Bigganbaksho EdTech — COO telesales dashboard",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
