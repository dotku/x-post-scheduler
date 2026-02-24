declare module "google-trends-api" {
  interface DailyTrendsOptions {
    trendDate?: Date;
    geo?: string;
    hl?: string;
    timezone?: number;
    category?: number;
  }

  interface RealTimeTrendsOptions {
    geo: string;
    hl?: string;
    timezone?: number;
    category?: string;
  }

  function dailyTrends(options: DailyTrendsOptions): Promise<string>;
  function realTimeTrends(options: RealTimeTrendsOptions): Promise<string>;
  function interestOverTime(options: object): Promise<string>;
  function interestByRegion(options: object): Promise<string>;
  function relatedTopics(options: object): Promise<string>;
  function relatedQueries(options: object): Promise<string>;
  function autoComplete(options: object): Promise<string>;

  export {
    dailyTrends,
    realTimeTrends,
    interestOverTime,
    interestByRegion,
    relatedTopics,
    relatedQueries,
    autoComplete,
  };
}
