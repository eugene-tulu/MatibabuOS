import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ClinicProvider } from '@/contexts/ClinicContext';
import { Navbar } from './components/Navbar';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'MatibabuOS - Pharmacy Patient Ledger',
  description: 'A multi-tenant patient ledger system for small African pharmacies',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ClinicProvider>
          <div className="min-h-screen bg-gray-50">
            <Navbar />
            {children}
          </div>
        </ClinicProvider>
      </body>
    </html>
  );
}