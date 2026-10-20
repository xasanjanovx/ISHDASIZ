import { VacancyPromotion } from '@/components/promotion/vacancy-promotion';
export default async function PromotionPage({ params }: { params: Promise<{ id: string }> }) {
  return <VacancyPromotion id={(await params).id} />;
}
