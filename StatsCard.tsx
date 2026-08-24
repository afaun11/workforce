import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color?: 'teal' | 'sky' | 'purple' | 'amber' | 'emerald' | 'rose';
  trend?: string;
}

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'teal',
  trend,
}) => {
  const colorMap = {
    teal: 'bg-teal-500/10 text-teal-600 border-teal-200',
    sky: 'bg-sky-500/10 text-sky-600 border-sky-200',
    purple: 'bg-purple-500/10 text-purple-600 border-purple-200',
    amber: 'bg-amber-500/10 text-amber-600 border-amber-200',
    emerald: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
    rose: 'bg-rose-500/10 text-rose-600 border-rose-200',
  };

  const iconBgMap = {
    teal: 'bg-teal-600 text-white',
    sky: 'bg-sky-600 text-white',
    purple: 'bg-purple-600 text-white',
    amber: 'bg-amber-600 text-white',
    emerald: 'bg-emerald-600 text-white',
    rose: 'bg-rose-600 text-white',
  };

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">{title}</p>
          <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
          {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-xl ${iconBgMap[color]} shadow-md`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      {trend && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center text-xs font-medium text-slate-600">
          {trend}
        </div>
      )}
    </div>
  );
};
