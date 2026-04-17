# Aegis Trading Bot Deployment Guide

This bot is built using a modern full-stack architecture (Express + React + CCXT). It is designed to run continuously on a VPS (like Ubuntu).

## Prerequisites
- Node.js 20+
- Binance account with Futures API enabled
- Telegram Bot Token (from @BotFather)

## Setup Instructions

1. **Environmental Configuration**
   Edit `.env` and provide your secrets:
   ```env
   BINANCE_API_KEY=your_key
   BINANCE_SECRET=your_secret
   TELEGRAM_BOT_TOKEN=your_token
   TELEGRAM_CHAT_ID=your_chat_id
   ```

2. **Installation**
   ```bash
   npm install
   ```

3. **Running the Bot**
   For production, it is recommended to use `pm2`:
   ```bash
   npm run build
   # Start the compiled server
   pm2 start server.ts --interpreter tsx --name aegis-bot
   ```

4. **Continuous Operation**
   The bot checks market conditions every 5 minutes (configurable in `server.ts`).

## Strategy Overview
- **Trend Confirmation**: 1H EMA 50 > EMA 200 (Bullish) or vice versa (Bearish).
- **Entry Points**: 15M timeframe.
- **RSI Filter**: Optimized for momentum (55-65 for longs).
- **Volume Filter**: At least 1.5x of the 20-period average.
- **Risk Management**: 5x leverage, 1% Stop Loss, 1.5% Take Profit.

## Telegram Commands
- `/start`: Activates the core engine.
- `/stop`: Deactivates the bot and halts scanning.
- `/status`: Returns live statistics and active position count.
