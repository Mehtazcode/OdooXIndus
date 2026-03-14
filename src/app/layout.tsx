import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CoreInventory',
  description: 'Modular Inventory Management System',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
