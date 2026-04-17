/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { BotStats } from './types';
import { 
  Play, 
  Square, 
  Activity, 
  ShieldAlert, 
  TrendingUp, 
  AlertCircle,
  BarChart3,
  Bot,
  Zap,
  Terminal,
  RefreshCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [stats, setStats] = useState<BotStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats');
      if (!res.ok) throw new Error('Failed to fetch stats');
      const data = await res.json();
      setStats(data);
      setError(null);
    } catch (err) {
      setError('Connection with Aegis Engine lost.');
    } finally {
      setLoading(false);
    }
  };

  const controlBot = async (command: 'start' | 'stop') => {
    try {
      await fetch('/api/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      });
      fetchStats();
    } catch (err) {
      setError('Command failed.');
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0D0D0D] text-white">
        <div className="flex flex-col items-center gap-4">
          <RefreshCcw className="w-8 h-8 animate-spin text-yellow-400" />
          <p className="mono text-xs uppercase tracking-widest opacity-50">Initializing Mission Control...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0B0D] text-[#E1E1E1] p-4 font-sans flex flex-col gap-4">
      {/* HEADER */}
      <header className="h-[60px] flex justify-between items-center bg-[#15171C] border border-[#23272F] px-6 rounded-lg">
        <div className="flex items-center gap-3">
          <div className="w-[20px] h-[20px] bg-[#00FFA3] rounded-[2px] shadow-[0_0_10px_rgba(0,255,163,0.3)]"></div>
          <span className="font-bold tracking-widest text-[16px] uppercase italic">Aegis Core <span className="opacity-30">v4.2.1</span></span>
        </div>

        <div className="flex gap-8 text-[12px]">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${error ? 'bg-[#FF4B55]' : 'bg-[#00FFA3]'}`}></div>
            <span className="opacity-70 uppercase tracking-tight">{error ? 'API: ERROR' : 'API: CONNECTED'}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#00FFA3]"></div>
            <span className="opacity-70 uppercase tracking-tight">AI SENTIMENT: ACTIVE</span>
          </div>
        </div>

        <button 
          onClick={() => controlBot(stats?.status === 'running' ? 'stop' : 'start')}
          className={`px-4 py-1.5 rounded-md border text-[10px] font-bold tracking-widest uppercase transition-all ${
            stats?.status === 'running' 
            ? 'border-[#FF4B55] text-[#FF4B55] hover:bg-[#FF4B55] hover:text-white' 
            : 'border-[#00FFA3] text-[#00FFA3] hover:bg-[#00FFA3] hover:text-black'
          }`}
        >
          {stats?.status === 'running' ? 'Terminate Engagememt' : 'Initialize Engine'}
        </button>
      </header>

      {/* MAIN GRID */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[260px_1fr_260px] gap-4 min-h-0">
        
        {/* LEFT: SCANNER */}
        <aside className="panel flex flex-col">
          <div className="panel-header">Market Scanner</div>
          <div className="flex-1 overflow-y-auto p-2">
            {stats?.activePositions && stats.activePositions.length > 0 ? (
              <div className="space-y-1">
                {stats.activePositions.map(sym => (
                  <div key={sym} className="flex justify-between items-center p-3 border-b border-[#1F2229] last:border-0 group">
                    <span className="text-sm font-medium">{sym}</span>
                    <span className="mono text-[#00FFA3] text-xs">ACTIVE</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center opacity-30 gap-2">
                <Terminal className="w-6 h-6" />
                <span className="mono text-[10px] uppercase">Scanning...</span>
              </div>
            )}
          </div>
        </aside>

        {/* CENTER: SCORECARD */}
        <section className="panel flex flex-col">
          <div className="panel-header">Strategy Intelligence Scorecard</div>
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <motion.div 
              key={stats?.tradesToday}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-[120px] font-extralight leading-none text-[#E1E1E1]"
            >
              {String(stats?.tradesToday || 0).padStart(2, '0')}
            </motion.div>
            <div className="text-[14px] text-[#888B94] tracking-[2px] mt-2 uppercase">Trades Performed Today</div>
            <div className="mt-8 text-[12px] text-[#00FFA3] uppercase tracking-wider h-4">
              {stats?.status === 'running' ? 'Awaiting Momentum Signal' : 'Engine Idle'}
            </div>
          </div>
          
          <div className="metric-grid">
            <div className="metric-item">
              <span className="block text-[18px] font-semibold mb-1 text-[#00FFA3]">BULLISH</span>
              <span className="text-[10px] text-[#888B94] uppercase">Trend (1H)</span>
            </div>
            <div className="metric-item">
              <span className="block text-[18px] font-semibold mb-1">62.4</span>
              <span className="text-[10px] text-[#888B94] uppercase">RSI Index</span>
            </div>
            <div className="metric-item">
              <span className="block text-[18px] font-semibold mb-1">1.2x</span>
              <span className="text-[10px] text-[#888B94] uppercase">Volume Scale</span>
            </div>
            <div className="metric-item">
              <span className="block text-[18px] font-semibold mb-1">0.42%</span>
              <span className="text-[10px] text-[#888B94] uppercase">Instant Vol</span>
            </div>
          </div>
        </section>

        {/* RIGHT: RISK */}
        <aside className="panel flex flex-col">
          <div className="panel-header">Risk Configuration</div>
          <div className="p-4 flex flex-col gap-3">
            <div className="risk-card border-l-[#00A3FF]">
              <h4 className="text-[10px] text-[#888B94] uppercase mb-1">Leverage</h4>
              <p className="text-[16px] font-semibold">5.00x</p>
            </div>
            <div className="risk-card border-l-[#00A3FF]">
              <h4 className="text-[10px] text-[#888B94] uppercase mb-1">Exposure</h4>
              <p className="text-[16px] font-semibold">2.00% / Trade</p>
            </div>
            <div className="risk-card border-l-[#00A3FF]">
              <h4 className="text-[10px] text-[#888B94] uppercase mb-1">Limits (SL/TP)</h4>
              <p className="text-[16px] font-semibold">1.0% / 1.5%</p>
            </div>
            <div className="risk-card border-l-[#FF4B55]">
              <h4 className="text-[10px] text-[#888B94] uppercase mb-1">Stop-Loss Ceiling</h4>
              <p className="text-[16px] font-semibold">5.00% Total</p>
            </div>
          </div>
        </aside>
      </main>

      {/* FOOTER LOGS */}
      <footer className="panel h-[180px] flex flex-col bg-[#0A0B0D]">
        <div className="bg-[#15171C] px-4 py-2 border-b border-[#23272F] flex justify-between items-center">
          <span className="text-[10px] font-bold tracking-widest text-[#888B94] uppercase">System Execution Logs</span>
          <span className="mono text-[10px] text-[#888B94]">BALANCE: ${stats?.balance.toFixed(2)} USDT</span>
        </div>
        <div className="flex-1 p-4 mono text-[12px] overflow-y-auto leading-relaxed text-[#A9A9A9]">
          <div className="mb-1"><span className="tag opacity-50">INFO</span> Analyzing Market Clusters... Trend: Bullish | RSI: 61.2 | Score: 7/13</div>
          <div className="mb-1"><span className="tag opacity-50">SCAN</span> Potential entry detected. Volume 1.1x. Threshold gap identified. Skipping.</div>
          <div className="mb-1 flex items-center gap-2">
            <span className="tag !bg-[#00FFA3] !text-[#000] !opacity-100">LIVE</span> 
            <span className="text-[#00FFA3]">System operational. Monitoring {stats?.activePositions.length || 0} active deployments.</span>
          </div>
        </div>
      </footer>

      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-red-500 text-white px-6 py-3 mono text-[10px] uppercase tracking-widest flex items-center gap-3 shadow-2xl"
          >
            <ShieldAlert className="w-4 h-4" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatBox({ label, value, subValue, icon }: { label: string, value: string, subValue?: string, icon: React.ReactNode }) {
  return (
    <div className="bg-[#0D0D0D] p-6 flex flex-col gap-2">
      <div className="flex justify-between items-center opacity-40">
        <span className="uppercase text-[10px] font-bold tracking-widest">{label}</span>
        {icon}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="mono text-2xl font-bold tracking-tighter">{value}</span>
        {subValue && <span className="mono text-[10px] opacity-40">{subValue}</span>}
      </div>
    </div>
  );
}

function IntelligenceMetric({ label, status, description }: { label: string, status: 'active' | 'inactive', description: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-[#1A1A1A] pb-3 last:border-0">
      <div className="flex justify-between items-center">
        <span className="mono text-[11px] font-bold opacity-80">{label}</span>
        <span className={`text-[9px] uppercase px-1.5 py-0.5 font-bold ${status === 'active' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-500'}`}>
          {status}
        </span>
      </div>
      <p className="text-[10px] opacity-40">{description}</p>
    </div>
  );
}

