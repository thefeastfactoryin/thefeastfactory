import type { Metadata } from 'next';
import {
  Inter,
  Nunito_Sans,
  Playfair_Display,
  Zilla_Slab,
} from 'next/font/google';
import './globals.css';
import { CustomerShell } from '../components/customer-shell';
import { PublicSettingsProvider } from '../components/public-settings-provider';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600', '700'],
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-heading',
  weight: ['400', '500', '600', '700', '800', '900'],
  style: ['normal', 'italic'],
});

const nunitoSans = Nunito_Sans({
  subsets: ['latin'],
  variable: '--font-package-sans',
  weight: ['400', '600', '700', '800'],
});

const zillaSlab = Zilla_Slab({
  subsets: ['latin'],
  variable: '--font-package-heading',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'The Feast Factory',
  description:
    'Plan catering events, customize menus, and place orders with The Feast Factory.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${playfair.variable} ${nunitoSans.variable} ${zillaSlab.variable} font-sans antialiased`}
      >
        <PublicSettingsProvider>
          <CustomerShell>{children}</CustomerShell>
        </PublicSettingsProvider>
      </body>
    </html>
  );
}
