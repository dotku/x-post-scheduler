export const TIERS = {
  wood: {
    label: "Wood",
    labelZh: "木头",
    priceMonthly: 300,
    priceYearly: 3000,
    accountLimit: 1,
    color: "green",
  },
  bronze: {
    label: "Bronze",
    labelZh: "青铜",
    priceMonthly: 500,
    priceYearly: 5000,
    accountLimit: 2,
    color: "amber",
  },
  iron: {
    label: "Iron",
    labelZh: "钢铁",
    priceMonthly: 800,
    priceYearly: 8000,
    accountLimit: 3,
    color: "slate",
  },
  silver: {
    label: "Silver",
    labelZh: "白银",
    priceMonthly: 1800,
    priceYearly: 18000,
    accountLimit: 5,
    color: "blue",
  },
  gold: {
    label: "Gold",
    labelZh: "黄金",
    priceMonthly: 18800,
    priceYearly: 188000,
    accountLimit: 10,
    color: "yellow",
  },
} as const;

export type TierKey = keyof typeof TIERS;

export const TIER_ORDER: TierKey[] = [
  "wood",
  "bronze",
  "iron",
  "silver",
  "gold",
];

export function normalizeTier(tier?: string | null): TierKey | null {
  if (!tier) return null;
  const normalized = tier.toLowerCase().trim();
  if (normalized === "air" || normalized === "woods") return "wood";
  if (normalized in TIERS) return normalized as TierKey;
  return null;
}

export function getAccountLimit(tier?: string | null): number {
  const normalizedTier = normalizeTier(tier);
  if (!normalizedTier) return 0; // Free/pay-as-you-go: 0 accounts
  return TIERS[normalizedTier].accountLimit;
}

export function isVerifiedMember(
  tier?: string | null,
  status?: string | null,
): boolean {
  return !!normalizeTier(tier) && status === "active";
}

export function getTierInfo(tier?: string | null) {
  const normalizedTier = normalizeTier(tier);
  return normalizedTier ? TIERS[normalizedTier] : null;
}

/** Hourly frequency options and their tier requirements */
export const HOURLY_FREQUENCIES: Record<
  string,
  { hours: number; minTier: TierKey }
> = {
  every_2h: { hours: 2, minTier: "gold" },
  every_4h: { hours: 4, minTier: "silver" },
  every_6h: { hours: 6, minTier: "iron" },
  every_12h: { hours: 12, minTier: "bronze" },
};

/** 检查用户等级是否达到最低要求 */
export function isTierAtLeast(
  userTier: string | null | undefined,
  minTier: TierKey,
): boolean {
  const normalizedTier = normalizeTier(userTier);
  if (!normalizedTier) return false;
  return TIER_ORDER.indexOf(normalizedTier) >= TIER_ORDER.indexOf(minTier);
}
