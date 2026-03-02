import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Terraform Plan Explainer',
  description: 'Paste your Terraform plan output and get a plain-English risk summary powered by Claude.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
