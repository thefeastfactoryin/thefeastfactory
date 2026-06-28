import type { Metadata } from 'next';
import { Nunito_Sans } from 'next/font/google';
import './globals.css';
import { AdminShell } from '../components/admin-shell';

const nunitoSans = Nunito_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'The Feast Factory Admin',
  description: 'Operations dashboard for The Feast Factory catering orders.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${nunitoSans.variable} font-sans antialiased`}>
        <AdminShell>{children}</AdminShell>
      </body>
    </html>
  );
}
