import "./globals.css";
import NavigationShell from "./components/NavigationShell";

export const metadata = {
  title: "Focus OS",
  description: "A dynamic learning operating system.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Both HTML and Body tags need suppressHydrationWarning to block extensions
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <NavigationShell>{children}</NavigationShell>
      </body>
    </html>
  );
}