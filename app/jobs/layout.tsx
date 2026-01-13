import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Vakansiyalar',
    description: "O'zbekistondagi barcha vakansiyalar ro'yxati. Ish qidiruvchilar uchun eng so'nggi ish joylari.",
    openGraph: {
        title: 'Vakansiyalar | ISHDASIZ',
        description: "O'zbekistondagi barcha vakansiyalar ro'yxati. Rasmiy ish joylari portali.",
        type: 'website',
        images: ['/og.png'],
    },
};

export default function JobsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
