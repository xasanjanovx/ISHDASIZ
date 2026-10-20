export const PROMOTION_PLANS = [
  { id: 'standard_1', group: 'standard', days: 1, price: 50000 },
  { id: 'standard_2', group: 'standard', days: 2, price: 80000 },
  { id: 'standard_3', group: 'standard', days: 3, price: 100000 },
  { id: 'standard_7', group: 'standard', days: 7, price: 200000 },
  { id: 'vip_1', group: 'vip', days: 1, price: 100000 },
  { id: 'vip_3', group: 'vip', days: 3, price: 200000 },
  { id: 'vip_7', group: 'vip', days: 7, price: 400000 },
  { id: 'region_broadcast', group: 'broadcast', days: 1, price: 50000 },
  { id: 'monthly', group: 'monthly', days: 30, price: 500000 },
] as const;
export type PromotionPlanId = typeof PROMOTION_PLANS[number]['id'];
export const promotionPlan = (id: unknown) => PROMOTION_PLANS.find(plan => plan.id === id) || null;
