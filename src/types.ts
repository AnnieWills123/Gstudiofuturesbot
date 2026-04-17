export interface BotStats {
  status: 'running' | 'stopped';
  balance: number;
  dailyLoss: number;
  maxDailyLoss: number;
  tradesToday: number;
  maxTradesPerDay: number;
  lossStreak: number;
  maxLossStreak: number;
  activePositions: string[];
}

export interface TradeLog {
  timestamp: string;
  symbol: string;
  side: 'long' | 'short';
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  status: 'open' | 'closed';
  pnl?: number;
  score: number;
}
