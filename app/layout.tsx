import "./globals.css";

export const metadata = {
  title: "PaperWorkz — by WorkzApp AI",
  description: "Edit, convert and transform documents in one workspace.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
