import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MVP Simulator | WeLeap',
  description: 'Verify onboarding outputs: savings, allocations, net worth',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
