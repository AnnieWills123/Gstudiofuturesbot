import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import ccxt from 'ccxt';
import { Telegraf } from 'telegraf';
import { createObjectCsvWriter } from 'csv-writer';
import { EMA, RSI } from 'technicalindicators';
import pino from 'pino';
import { format } from 'date-fns';
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- CONFIGURATION ---
const CONFIG = {
  LEVERAGE: 5,
  TIMEFRAME_ENTRY: '15m',
  TIMEFRAME_CONFIRM: '1h',
  STOP_LOSS_PCT: 0.01,
  TAKE_PROFIT_PCT: 0.015,
  RISK_PER_TRADE: 0.02,
  MAX_TRADES_PER_DAY: 5,
  MAX_DAILY_LOSS_PCT: 0.05,
  MAX_LOSS_STREAK: 2,
  SYMBOLS: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT'],
  MIN_SCORE: 7,
  VOLUME_AVG_PERIOD: 20,
  CHECK_INTERVAL_MS: 60000 * 5, // Check every 5 minutes
};

// --- STATE ---
interface BotState {
  isRunning: boolean;
  dailyTrades: number;
  dailyLoss: number;
  lossStreak: number;
  lastTradeDate: string;
  activePositions: Set<string>;
}

let state: BotState = {
  isRunning: true,
  dailyTrades: 0,
  dailyLoss: 0,
  lossStreak: 0,
  lastTradeDate: format(new Date(), 'yyyy-MM-dd'),
  activePositions: new Set(),
};

// --- LOGGING ---
const csvWriter = createObjectCsvWriter({
  path: 'trades.csv',
  header: [
    { id: 'timestamp', title: 'TIMESTAMP' },
    { id: 'symbol', title: 'SYMBOL' },
    { id: 'side', title: 'SIDE' },
    { id: 'entryPrice', title: 'ENTRY' },
    { id: 'stopLoss', title: 'SL' },
    { id: 'takeProfit', title: 'TP' },
    { id: 'score', title: 'SCORE' }
  ],
  append: true
});

// --- AI INTELLIGENCE ---
let ai: any;
if (process.env.GEMINI_API_KEY) {
  const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  ai = genAI.models;
}

const getAiSentiment = async (symbol: string, price: number, rsi: number, trend: string) => {
  if (!ai) return 0;
  try {
    const prompt = `As a crypto trading analyst, evaluate ${symbol} given: Price: ${price}, RSI: ${rsi}, Trend: ${trend}. Is the market structure high-probability for a trade? Reply with SCALE 1-3 (1: Weak, 2: Neutral, 3: Strong). Just the number.`;
    const result = await ai.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt
    });
    const scoreText = result.text?.trim() || "0";
    const score = parseInt(scoreText) || 0;
    return score;
  } catch (e) {
    return 0;
  }
};

// --- BINANCE & TELEGRAM ---
let exchange: any;
let bot: any;

try {
  exchange = new ccxt.binance({
    apiKey: process.env.BINANCE_API_KEY,
    secret: process.env.BINANCE_SECRET,
    options: { defaultType: 'future' }
  });

  if (process.env.TELEGRAM_BOT_TOKEN) {
    bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
  }
} catch (e: any) {
  logger.error({ err: e }, 'Failed to initialize APIs');
}

const sendAlert = async (msg: string) => {
  logger.info(`Alert: ${msg}`);
  if (bot && process.env.TELEGRAM_CHAT_ID) {
    bot.telegram.sendMessage(process.env.TELEGRAM_CHAT_ID, msg).catch((err: any) => logger.error({ err }, 'Telegram error'));
  }
};

// --- ENGINE LOGIC ---
const fetchOHLCV = async (symbol: string, timeframe: string, limit: number) => {
  return await exchange.fetchOHLCV(symbol, timeframe, undefined, limit);
};

const calculateIndicators = (ohlcv: any[]) => {
  const closes = ohlcv.map(x => x[4]);
  const volumes = ohlcv.map(x => x[5]);
  
  const ema50 = EMA.calculate({ period: 50, values: closes });
  const ema200 = EMA.calculate({ period: 200, values: closes });
  const rsi = RSI.calculate({ period: 14, values: closes });
  
  return { 
    ema50: ema50[ema50.length - 1] || 0, 
    ema200: ema200[ema200.length - 1] || 0, 
    rsi: rsi[rsi.length - 1] || 50,
    currentPrice: closes[closes.length - 1],
    avgVolume: volumes.slice(-CONFIG.VOLUME_AVG_PERIOD).reduce((a, b) => a + b, 0) / CONFIG.VOLUME_AVG_PERIOD,
    currentVolume: volumes[volumes.length - 1],
    lastCandleChange: Math.abs(closes[closes.length - 1] - closes[closes.length - 2]) / closes[closes.length - 2]
  };
};

const analyzeSymbol = async (symbol: string) => {
  try {
    const ohlcv1h = await fetchOHLCV(symbol, CONFIG.TIMEFRAME_CONFIRM, 210);
    const ohlcv15m = await fetchOHLCV(symbol, CONFIG.TIMEFRAME_ENTRY, 60);

    const data1h = calculateIndicators(ohlcv1h);
    const data15m = calculateIndicators(ohlcv15m);

    let score = 0;
    let side: 'long' | 'short' | null = null;

    // 1. Trend Confirmation (1h)
    const trendBullish = data1h.ema50 > data1h.ema200;
    const trendBearish = data1h.ema50 < data1h.ema200;
    
    // Sideways filter
    const sideways = Math.abs(data1h.ema50 - data1h.ema200) / data1h.ema200 < 0.001;
    if (sideways) return null;

    // 2. Entry Analysis (15m)
    if (trendBullish) {
      score += 3;
      if (data15m.currentPrice > data15m.ema50) score += 2;
      if (data15m.rsi >= 55 && data15m.rsi <= 65) score += 3;
      if (data15m.currentVolume > data15m.avgVolume * 1.5) score += 2;
      side = 'long';
    } else if (trendBearish) {
      score += 3;
      if (data15m.currentPrice < data15m.ema50) score += 2;
      if (data15m.rsi >= 35 && data15m.rsi <= 45) score += 3;
      if (data15m.currentVolume > data15m.avgVolume * 1.5) score += 2;
      side = 'short';
    }

    // 3. Filters
    if (data15m.lastCandleChange > 0.02) return null; 

    // 4. AI Sentiment (Bonus)
    if (side) {
      const aiBonus = await getAiSentiment(symbol, data15m.currentPrice, data15m.rsi, trendBullish ? 'Bullish' : 'Bearish');
      score += aiBonus;
    }

    logger.debug(`Analyzed ${symbol}: Score ${score}/13, Side: ${side}`);

    return { symbol, score, side, price: data15m.currentPrice };
  } catch (e: any) {
    logger.error({ err: e }, `Error analyzing ${symbol}`);
    return null;
  }
};

const checkAndExecute = async () => {
  if (!state.isRunning) return;

  const today = format(new Date(), 'yyyy-MM-dd');
  if (state.lastTradeDate !== today) {
    state.dailyTrades = 0;
    state.dailyLoss = 0;
    state.lastTradeDate = today;
  }

  if (state.dailyTrades >= CONFIG.MAX_TRADES_PER_DAY) return;
  if (state.dailyLoss >= CONFIG.MAX_DAILY_LOSS_PCT) {
    state.isRunning = false;
    sendAlert('🔴 STOPPED: Max daily loss reached.');
    return;
  }
  if (state.lossStreak >= CONFIG.MAX_LOSS_STREAK) {
    state.isRunning = false;
    sendAlert('🔴 STOPPED: Max loss streak reached.');
    return;
  }

  for (const symbol of CONFIG.SYMBOLS) {
    if (state.activePositions.has(symbol)) continue;

    const signal = await analyzeSymbol(symbol);
    if (signal && signal.score >= CONFIG.MIN_SCORE && signal.side) {
      await executeOrder(signal.symbol, signal.side, signal.score, signal.price);
    }
  }
};

const executeOrder = async (symbol: string, side: 'long' | 'short', score: number, price: number) => {
  try {
    logger.info(`🚨 EXECUTING ${side.toUpperCase()} on ${symbol} (Score: ${score})`);
    
    await exchange.setLeverage(CONFIG.LEVERAGE, symbol);

    const balance = await exchange.fetchBalance();
    const usdtBalance = balance.total.USDT || 0;
    const amountToRisk = usdtBalance * CONFIG.RISK_PER_TRADE;
    const qty = (amountToRisk * CONFIG.LEVERAGE) / price;

    const orderSide = side === 'long' ? 'buy' : 'sell';
    const entryOrder = await exchange.createMarketOrder(symbol, orderSide, qty);
    
    state.activePositions.add(symbol);
    state.dailyTrades++;

    const slPrice = side === 'long' ? price * (1 - CONFIG.STOP_LOSS_PCT) : price * (1 + CONFIG.STOP_LOSS_PCT);
    const tpPrice = side === 'long' ? price * (1 + CONFIG.TAKE_PROFIT_PCT) : price * (1 - CONFIG.TAKE_PROFIT_PCT);

    const closeSide = side === 'long' ? 'sell' : 'buy';
    
    await exchange.createOrder(symbol, 'STOP_MARKET', closeSide, qty, undefined, {
      stopPrice: exchange.priceToPrecision(symbol, slPrice),
      reduceOnly: true
    });
    
    await exchange.createOrder(symbol, 'TAKE_PROFIT_MARKET', closeSide, qty, undefined, {
      stopPrice: exchange.priceToPrecision(symbol, tpPrice),
      reduceOnly: true
    });

    await csvWriter.writeRecords([{
      timestamp: new Date().toISOString(),
      symbol,
      side,
      entryPrice: price,
      stopLoss: slPrice,
      takeProfit: tpPrice,
      score
    }]);

    sendAlert(`🟢 OPENED ${side.toUpperCase()} on ${symbol}\nEntry: ${price}\nSL: ${slPrice}\nTP: ${tpPrice}\nScore: ${score}/13`);

  } catch (e: any) {
    logger.error({ err: e }, 'Order execution failed');
    sendAlert(`❌ ERROR executing ${symbol}: ${e instanceof Error ? e.message : String(e)}`);
  }
};

const app = express();
app.use(express.json());

app.get('/api/stats', async (req, res) => {
  try {
    let balance = 0;
    if (exchange) {
      const bal = await exchange.fetchBalance();
      balance = bal.total.USDT || 0;
    }
    res.json({
      status: state.isRunning ? 'running' : 'stopped',
      balance,
      dailyLoss: state.dailyLoss,
      maxDailyLoss: CONFIG.MAX_DAILY_LOSS_PCT,
      tradesToday: state.dailyTrades,
      maxTradesPerDay: CONFIG.MAX_TRADES_PER_DAY,
      lossStreak: state.lossStreak,
      maxLossStreak: CONFIG.MAX_LOSS_STREAK,
      activePositions: Array.from(state.activePositions)
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed' });
  }
});

app.post('/api/control', (req, res) => {
  const { command } = req.body;
  if (command === 'start') state.isRunning = true;
  if (command === 'stop') state.isRunning = false;
  res.json({ status: state.isRunning ? 'running' : 'stopped' });
});

if (bot) {
  bot.command('start', (ctx: any) => {
    state.isRunning = true;
    ctx.reply('🚀 Aegis Bot Started');
  });
  bot.command('stop', (ctx: any) => {
    state.isRunning = false;
    ctx.reply('🛑 Aegis Bot Stopped');
  });
  bot.command('status', async (ctx: any) => {
    ctx.reply(`📊 Aegis Status: ${state.isRunning ? 'RUNNING' : 'STOPPED'}\nTrades Today: ${state.dailyTrades}\nActive: ${state.activePositions.size}`);
  });
  bot.launch().catch((err: any) => logger.error({ err }, 'Bot launch failed'));
}

async function start() {
  const PORT = 3000;

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    logger.info(`Server running on http://0.0.0.0:${PORT}`);
    setInterval(checkAndExecute, CONFIG.CHECK_INTERVAL_MS);
    setTimeout(checkAndExecute, 5000);
  });
}

start();
