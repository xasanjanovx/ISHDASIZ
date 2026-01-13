import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { LanguageProvider } from '@/contexts/language-context';
import { AuthProvider } from '@/contexts/auth-context';
import { UserAuthProvider } from '@/contexts/user-auth-context';
import Header from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Toaster } from '@/components/ui/sonner';
import { RoleSelectionWrapper } from '@/components/home/role-selection-wrapper';
import { AuthModalProvider } from '@/contexts/auth-modal-context';
import { AuthModal } from '@/components/auth/auth-modal';
import { AdminViewBanner } from '@/components/admin/AdminViewBanner';
import { MobileNav } from '@/components/layout/mobile-nav';

const inter = Inter({ subsets: ['latin', 'cyrillic'] });

export const metadata: Metadata = {
  metadataBase: new URL('https://ishdasiz.uz'),
  title: {
    template: '%s | ISHDASIZ',
    default: "ISHDASIZ - O'zbekiston ish joylari portali",
  },
  description: "O'zbekistondagi barcha vakansiyalar. Rasmiy ish joylari portali.",
  keywords: 'ish, vakansiya, Andijon, Ozbekiston, ishga joylashish, работа, вакансии, Андижан',
  authors: [{ name: 'ISHDASIZ' }],
  openGraph: {
    title: "ISHDASIZ - O'zbekiston ish joylari portali",
    description: "O'zbekistondagi barcha vakansiyalar. Rasmiy ish joylari portali.",
    url: 'https://ishdasiz.uz',
    siteName: 'ISHDASIZ',
    locale: 'uz_UZ',
    type: 'website',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: "ISHDASIZ - O'zbekiston ish joylari portali",
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: "ISHDASIZ - O'zbekiston ish joylari portali",
    description: "O'zbekistondagi barcha vakansiyalar. Rasmiy ish joylari portali.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="uz" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen flex flex-col bg-slate-50`}>
        <AuthProvider>
          <UserAuthProvider>
            <LanguageProvider>
              <AuthModalProvider>
                <Header />
                <AdminViewBanner />
                <main className="flex-1 pt-16">
                  {children}
                </main>
                <Footer />
                <Toaster position="top-center" />
                <RoleSelectionWrapper />
                <MobileNav />
                <AuthModal />
              </AuthModalProvider>
            </LanguageProvider>
          </UserAuthProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

