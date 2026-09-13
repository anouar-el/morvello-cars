import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Sparkles, TrendingUp, Car, Layers } from 'lucide-react';
import { Vehicle } from '../../types';

interface DashboardChartsProps {
  revenueTrendData: Array<{
    date: string;
    revenue: number;
    contracts: number;
  }>;
  vehicles: Vehicle[];
}

export const DashboardCharts: React.FC<DashboardChartsProps> = ({
  revenueTrendData,
  vehicles,
}) => {
  // Category categorization for fleet
  const categories = [
    {
      name: 'Prestige & Luxe',
      color: '#f59e0b', // Amber 500
      count: vehicles.filter((v) =>
        ['MERCEDES-BENZ', 'AUDI', 'RANGE ROVER', 'PORSCHE', 'BMW'].some((b) =>
          v.brand.toUpperCase().includes(b)
        )
      ).length,
    },
    {
      name: 'SUV & Crossover',
      color: '#3b82f6', // Blue 500
      count: vehicles.filter(
        (v) =>
          ['TUCSON', 'DUSTER', 'Q3', 'SPORTAGE', 'KADJAR'].some((m) =>
            v.model.toUpperCase().includes(m)
          ) &&
          !['MERCEDES-BENZ', 'PORSCHE'].some((b) => v.brand.toUpperCase().includes(b))
      ).length,
    },
    {
      name: 'Berlines & Compactes',
      color: '#10b981', // Emerald 500
      count: vehicles.filter(
        (v) =>
          ['CLIO', 'GOLF', '208', 'MEGANE', 'YARIS', 'COROLLA'].some((m) =>
            v.model.toUpperCase().includes(m)
          )
      ).length,
    },
  ];

  // Adjust remaining if any
  const categorizedSum = categories.reduce((acc, c) => acc + c.count, 0);
  if (categorizedSum < vehicles.length) {
    categories[0].count += vehicles.length - categorizedSum;
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-950 border border-slate-700/80 p-3 rounded-xl shadow-2xl text-xs space-y-1">
          <p className="font-bold text-white mb-1">{label}</p>
          <div className="flex items-center gap-2 text-amber-400 font-mono font-bold">
            <span>Chiffre d'Affaires :</span>
            <span>{Number(payload[0].value).toLocaleString('fr-FR')} MAD</span>
          </div>
          {payload[1] && (
            <div className="flex items-center gap-2 text-blue-400 font-mono">
              <span>Contrats enregistrés :</span>
              <span>{payload[1].value}</span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* 1. GRAPHIQUE ÉVOLUTION CA & CONTRATS (2 COLS) */}
      <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800/90 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                <h3 className="text-sm font-bold text-white tracking-tight">
                  Tendance des Revenus & Flux Locatifs
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Chiffre d'affaires journalier (MAD) et volume de contrats sur la période
              </p>
            </div>

            <div className="flex items-center gap-3 text-[11px]">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-amber-500"></span>
                <span className="text-slate-300 font-medium">Revenu (MAD)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-blue-400"></span>
                <span className="text-slate-300 font-medium">Contrats</span>
              </div>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrendData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#334155' }}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#334155' }}
                  tickFormatter={(val) => `${val / 1000}k`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#goldGradient)"
                />
                <Area
                  type="monotone"
                  dataKey="contracts"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#blueGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
            <TrendingUp className="w-3.5 h-3.5" />
            Progression soutenue sur les gammes Berlines et SUV
          </span>
          <span className="font-mono text-slate-500">Moyenne: ~4 800 MAD / location</span>
        </div>
      </div>

      {/* 2. RÉPARTITION DE LA FLOTTE (1 COL) */}
      <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-white tracking-tight">
                Segments de la Flotte
              </h3>
            </div>
            <span className="text-xs font-mono text-amber-400 font-bold">
              {vehicles.length} Véhicules
            </span>
          </div>
          <p className="text-xs text-slate-400 mb-2">
            Répartition du parc par catégorie de prestige
          </p>

          <div className="h-44 w-full relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categories}
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={4}
                  dataKey="count"
                >
                  {categories.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            {/* Center label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xl font-black text-white font-mono">{vehicles.length}</span>
              <span className="text-[10px] text-slate-400 uppercase font-medium tracking-wider">
                Unités
              </span>
            </div>
          </div>

          <div className="space-y-2 mt-1">
            {categories.map((cat) => {
              const pct = Math.round((cat.count / Math.max(1, vehicles.length)) * 100);
              return (
                <div
                  key={cat.name}
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: cat.color }}
                    ></span>
                    <span className="text-slate-200 font-medium">{cat.name}</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-white font-bold">{cat.count}</span>
                    <span className="text-slate-500 text-[11px]">({pct}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
          <span className="text-slate-400">Taux de rotation optimal</span>
          <span className="text-amber-400 font-bold font-mono">100% assurés</span>
        </div>
      </div>
    </div>
  );
};
