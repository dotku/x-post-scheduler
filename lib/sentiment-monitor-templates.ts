export interface DemoTemplate {
  name: string;
  nameZh: string;
  description: string;
  descriptionZh: string;
  keywords: string[];
  category: "election" | "finance";
}

export const DEMO_TEMPLATES: DemoTemplate[] = [
  // Election
  {
    name: "2026 US Midterm Elections",
    nameZh: "2026 美国中期选举",
    description: "Track public sentiment around the 2026 midterm elections",
    descriptionZh: "追踪2026年中期选举的公众舆论",
    keywords: ["midterm 2026", "#Election2026", "#Midterms2026", "Senate race", "House race"],
    category: "election",
  },
  {
    name: "US Political Figures",
    nameZh: "美国政治人物",
    description: "Compare sentiment between major political figures",
    descriptionZh: "对比主要政治人物的舆论情感",
    keywords: ["Trump", "Biden", "DeSantis", "#MAGA", "#Democrat"],
    category: "election",
  },
  // Finance
  {
    name: "Stock Market Sentiment",
    nameZh: "股市舆情",
    description: "Monitor investor sentiment on major stocks and indices",
    descriptionZh: "监控投资者对主要股票和指数的情感",
    keywords: ["$SPY", "$AAPL", "$TSLA", "#StockMarket", "Fed rate", "bull market", "bear market"],
    category: "finance",
  },
  {
    name: "Crypto Market Pulse",
    nameZh: "加密货币市场脉搏",
    description: "Track crypto community sentiment and trending narratives",
    descriptionZh: "追踪加密社区情感和热门叙事",
    keywords: ["$BTC", "$ETH", "#Bitcoin", "#Ethereum", "#Crypto", "DeFi", "altcoin"],
    category: "finance",
  },
  {
    name: "Tech Earnings Watch",
    nameZh: "科技财报观察",
    description: "Monitor reactions to tech company earnings and announcements",
    descriptionZh: "监控科技公司财报和公告的市场反应",
    keywords: ["NVIDIA earnings", "Apple earnings", "Microsoft earnings", "#TechEarnings", "AI stocks"],
    category: "finance",
  },
];
