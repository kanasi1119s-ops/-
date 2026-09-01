import React, { useState, useMemo } from 'react';
import { Transaction } from '../types';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Area,
  AreaChart,
} from 'recharts';
import { TrendingUp, TrendingDown, Calendar, BarChart3, ArrowUpRight, DollarSign, Activity } from 'lucide-react';

interface CashflowTrendChartProps {
  transactions: Transaction[];
}

type ChartViewMode = 'daily' | 'cumulative';

interface DailyDataPoint {
  date: string; // MM/DD
  fullDate: string; // YYYY-MM-DD
  dayOfWeek: string;
  sales: number;
  expenses: number;
  profit: number;
  cumulativeSales: number;
  cumulativeExpenses: number;
  cumulativeProfit: number;
}

export const CashflowTrendChart: React.FC<CashflowTrendChartProps> = ({ transactions }) => {
  const [viewMode, setViewMode] = useState<ChartViewMode>('daily');
  const [showProfitLine, setShowProfitLine] = useState(true);

  // Generate 30 days data
  const chartData = useMemo(() => {
    // Determine the reference date (either the latest transaction date or today, whichever is more recent)
    let refDate = new Date();
    if (transactions.length > 0) {
      const dates = transactions.map((t) => new Date(t.date).getTime()).filter((t) => !isNaN(t));
      if (dates.length > 0) {
        const maxTxDate = new Date(Math.max(...dates));
        if (maxTxDate > refDate) {
          refDate = maxTxDate;
        }
      }
    }

    const days: DailyDataPoint[] = [];
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];

    // Map transaction totals by YYYY-MM-DD
    const salesByDate: Record<string, number> = {};
    const expensesByDate: Record<string, number> = {};

    transactions.forEach((t) => {
      if (!t.date) return;
      const d = t.date.slice(0, 10);
      if (t.type === 'income') {
        salesByDate[d] = (salesByDate[d] || 0) + (t.amount || 0);
      } else if (t.type === 'expense') {
        expensesByDate[d] = (expensesByDate[d] || 0) + (t.amount || 0);
      }
    });

    let runningSales = 0;
    let runningExpenses = 0;

    // Generate last 30 days in chronological order
    for (let i = 29; i >= 0; i--) {
      const d = new Date(refDate);
      d.setDate(refDate.getDate() - i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const fullDate = `${yyyy}-${mm}-${dd}`;
      const shortDate = `${d.getMonth() + 1}/${d.getDate()}`;
      const dayOfWeek = dayNames[d.getDay()];

      const dailySale = Math.round(salesByDate[fullDate] || 0);
      const dailyExp = Math.round(expensesByDate[fullDate] || 0);
      const dailyProfit = dailySale - dailyExp;

      runningSales += dailySale;
      runningExpenses += dailyExp;
      const runningProfit = runningSales - runningExpenses;

      days.push({
        date: shortDate,
        fullDate,
        dayOfWeek,
        sales: dailySale,
        expenses: dailyExp,
        profit: dailyProfit,
        cumulativeSales: runningSales,
        cumulativeExpenses: runningExpenses,
        cumulativeProfit: runningProfit,
      });
    }

    return days;
  }, [transactions]);

  // 30-day Totals & Stats
  const stats = useMemo(() => {
    const totalSales = chartData.reduce((acc, d) => acc + d.sales, 0);
    const totalExpenses = chartData.reduce((acc, d) => acc + d.expenses, 0);
    const totalProfit = totalSales - totalExpenses;
    const avgDailySales = Math.round(totalSales / 30);
    const activeDays = chartData.filter((d) => d.sales > 0 || d.expenses > 0).length;

    return {
      totalSales,
      totalExpenses,
      totalProfit,
      avgDailySales,
      activeDays,
    };
  }, [chartData]);

  // Custom Japanese currency formatter for Y-axis
  const formatYAxis = (val: number) => {
    if (Math.abs(val) >= 1000000) {
      return `¥${(val / 1000000).toFixed(1)}M`;
    }
    if (Math.abs(val) >= 10000) {
      return `¥${Math.round(val / 10000)}万`;
    }
    if (Math.abs(val) >= 1000) {
      return `¥${Math.round(val / 1000)}k`;
    }
    return `¥${val}`;
  };

  // Custom Interactive Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload as DailyDataPoint;
      return (
        <div className="bg-slate-900/95 backdrop-blur-md text-white p-3.5 rounded-2xl shadow-xl border border-slate-700 text-xs min-w-[200px] space-y-2 animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between border-b border-slate-700/80 pb-1.5 font-bold">
            <span className="text-slate-200">
              {dataPoint.fullDate} ({dataPoint.dayOfWeek})
            </span>
            <span className="text-[10px] text-amber-400 font-mono">
              {viewMode === 'daily' ? '日別集計' : '累計'}
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                売上:
              </span>
              <span className="font-extrabold text-emerald-300 font-mono">
                ¥{' '}
                {(viewMode === 'daily'
                  ? dataPoint.sales
                  : dataPoint.cumulativeSales
                ).toLocaleString()}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-rose-400">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                経費:
              </span>
              <span className="font-extrabold text-rose-300 font-mono">
                ¥{' '}
                {(viewMode === 'daily'
                  ? dataPoint.expenses
                  : dataPoint.cumulativeExpenses
                ).toLocaleString()}
              </span>
            </div>

            <div className="pt-1.5 border-t border-slate-700 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-indigo-300">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 inline-block" />
                利益 (差引):
              </span>
              <span
                className={`font-black font-mono ${
                  (viewMode === 'daily' ? dataPoint.profit : dataPoint.cumulativeProfit) >= 0
                    ? 'text-indigo-300'
                    : 'text-rose-400'
                }`}
              >
                ¥{' '}
                {(viewMode === 'daily'
                  ? dataPoint.profit
                  : dataPoint.cumulativeProfit
                ).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-5">
      {/* Chart Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                過去30日間の売上・経費 推移グラフ
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {chartData[0]?.fullDate} 〜 {chartData[chartData.length - 1]?.fullDate}
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                日々の売上入金と経費支出のバランスを折れ線グラフで視覚化します。
              </p>
            </div>
          </div>
        </div>

        {/* View Mode Switcher & Filter Toggle */}
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
          {/* Daily vs Cumulative Toggle */}
          <div className="flex items-center bg-slate-100/90 p-1 rounded-xl text-xs font-semibold">
            <button
              type="button"
              id="trend-chart-daily-btn"
              onClick={() => setViewMode('daily')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'daily'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              日別推移
            </button>
            <button
              type="button"
              id="trend-chart-cumulative-btn"
              onClick={() => setViewMode('cumulative')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'cumulative'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              累計推移
            </button>
          </div>

          {/* Toggle Profit Line */}
          <button
            type="button"
            onClick={() => setShowProfitLine(!showProfitLine)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              showProfitLine
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                showProfitLine ? 'bg-indigo-600' : 'bg-slate-300'
              }`}
            />
            <span>利益ライン {showProfitLine ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>

      {/* 30-Day Quick Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-100/80">
          <div className="text-[11px] font-semibold text-emerald-800 flex items-center justify-between">
            <span>30日間 売上計</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-lg font-extrabold text-emerald-900 mt-1">
            ¥ {stats.totalSales.toLocaleString()}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-rose-50/60 border border-rose-100/80">
          <div className="text-[11px] font-semibold text-rose-800 flex items-center justify-between">
            <span>30日間 経費計</span>
            <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <div className="text-lg font-extrabold text-rose-900 mt-1">
            ¥ {stats.totalExpenses.toLocaleString()}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-indigo-50/60 border border-indigo-100/80">
          <div className="text-[11px] font-semibold text-indigo-800 flex items-center justify-between">
            <span>30日間 差引利益</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <div
            className={`text-lg font-extrabold mt-1 ${
              stats.totalProfit >= 0 ? 'text-indigo-900' : 'text-rose-700'
            }`}
          >
            ¥ {stats.totalProfit.toLocaleString()}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
          <div className="text-[11px] font-semibold text-slate-600 flex items-center justify-between">
            <span>1日平均売上</span>
            <BarChart3 className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-lg font-extrabold text-slate-800 mt-1">
            ¥ {stats.avgDailySales.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Recharts Line Chart Canvas */}
      <div className="w-full h-[320px] sm:h-[360px] pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 15, left: -10, bottom: 5 }}
          >
            <defs>
              <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={{ stroke: '#cbd5e1' }}
              tick={{ fill: '#64748b', fontSize: 11 }}
              interval="preserveStartEnd"
              minTickGap={20}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#64748b', fontSize: 11 }}
              tickFormatter={formatYAxis}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="top"
              height={36}
              wrapperStyle={{ paddingBottom: '10px', fontSize: '12px', fontWeight: 600 }}
              formatter={(value) => {
                if (value === 'sales' || value === 'cumulativeSales') return '売上 (¥)';
                if (value === 'expenses' || value === 'cumulativeExpenses') return '経費 (¥)';
                if (value === 'profit' || value === 'cumulativeProfit') return '差引事業利益 (¥)';
                return value;
              }}
            />

            {/* Sales Line */}
            <Line
              type="monotone"
              dataKey={viewMode === 'daily' ? 'sales' : 'cumulativeSales'}
              name={viewMode === 'daily' ? 'sales' : 'cumulativeSales'}
              stroke="#10b981"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#10b981', strokeWidth: 1, stroke: '#ffffff' }}
              activeDot={{ r: 6, fill: '#10b981', stroke: '#ffffff', strokeWidth: 2 }}
            />

            {/* Expenses Line */}
            <Line
              type="monotone"
              dataKey={viewMode === 'daily' ? 'expenses' : 'cumulativeExpenses'}
              name={viewMode === 'daily' ? 'expenses' : 'cumulativeExpenses'}
              stroke="#f43f5e"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#f43f5e', strokeWidth: 1, stroke: '#ffffff' }}
              activeDot={{ r: 6, fill: '#f43f5e', stroke: '#ffffff', strokeWidth: 2 }}
            />

            {/* Profit Line (Optional) */}
            {showProfitLine && (
              <Line
                type="monotone"
                dataKey={viewMode === 'daily' ? 'profit' : 'cumulativeProfit'}
                name={viewMode === 'daily' ? 'profit' : 'cumulativeProfit'}
                stroke="#6366f1"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={{ r: 2.5, fill: '#6366f1', strokeWidth: 1, stroke: '#ffffff' }}
                activeDot={{ r: 5, fill: '#6366f1', stroke: '#ffffff', strokeWidth: 2 }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart Footer description */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 pt-2 border-t border-slate-100">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-emerald-500 inline-block" />
            <span className="text-slate-600 font-medium">緑線: 売上高</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-rose-500 inline-block" />
            <span className="text-slate-600 font-medium">赤線: 経費支出</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 border-t border-dashed border-indigo-500 inline-block" />
            <span className="text-slate-600 font-medium">破線: 差引利益</span>
          </span>
        </div>
        <span>※ グラフの点をホバー/タップすると該当日付の詳細明細が表示されます</span>
      </div>
    </div>
  );
};
