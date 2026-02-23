export const TIERS = {
  bronze: {
    label: "Bronze",
    labelZh: "青铜",
    priceMonthly: 100,
    priceYearly: 1000,
    accountLimit: 1,
    color: "amber",
  },
  iron: {
    label: "Iron",
    labelZh: "钢铁",
    priceMonthly: 300,
    priceYearly: 3000,
    accountLimit: 3,
    color: "slate",
  },
  silver: {
    label: "Silver",
    labelZh: "白银",
    priceMonthly: 800,
    priceYearly: 8000,
    accountLimit: 100,
    color: "blue",
  },
  gold: {
    label: "Gold",
    labelZh: "黄金",
    priceMonthly: 10000,
    priceYearly: 99900,
    accountLimit: Infinity,
    color: "yellow",
  },
} as const;

export type TierKey = keyof typeof TIERS;

export const TIER_ORDER: TierKey[] = ["bronze", "iron", "silver", "gold"];

export function getAccountLimit(tier?: string | null): number {
  if (!tier || !(tier in TIERS)) return 1;
  return TIERS[tier as TierKey].accountLimit;
}

export function isVerifiedMember(
  tier?: string | null,
  status?: string | null,
): boolean {
  return !!tier && status === "active";
}

export function getTierInfo(tier: string) {
  return TIERS[tier as TierKey] ?? null;
}
