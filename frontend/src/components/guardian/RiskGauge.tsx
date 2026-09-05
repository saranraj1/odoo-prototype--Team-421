import React from 'react';
import { RiskSeverity } from '../../types';

interface RiskGaugeProps {
  score: number;
  severity: RiskSeverity;
  size?: 'sm' | 'md' | 'lg';
}

export const RiskGauge: React.FC<RiskGaugeProps> = ({ score, severity, size = 'md' }) => {
  const radius = size === 'sm' ? 24 : size === 'md' ? 36 : 48;
  const strokeWidth = size === 'sm' ? 4 : size === 'md' ? 6 : 8;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const colorConfig = {
    LOW: { stroke: '#10b981', text: 'text-emerald-700', bg: 'bg-emerald-50', label: 'SAFE' },
    MEDIUM: { stroke: '#f59e0b', text: 'text-amber-700', bg: 'bg-amber-50', label: 'WATCH' },
    HIGH: { stroke: '#f43f5e', text: 'text-rose-700', bg: 'bg-rose-50', label: 'ACTION REQUIRED' },
    CRITICAL: { stroke: '#e11d48', text: 'text-rose-900', bg: 'bg-rose-100', label: 'CRITICAL' },
  }[severity];

  const dimension = (radius + strokeWidth) * 2;

  return (
    <div className="flex items-center gap-3.5">
      <div className="relative flex items-center justify-center shrink-0">
        <svg width={dimension} height={dimension} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={radius + strokeWidth}
            cy={radius + strokeWidth}
            r={radius}
            stroke="#e2e8f0"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Progress circle */}
          <circle
            cx={radius + strokeWidth}
            cy={radius + strokeWidth}
            r={radius}
            stroke={colorConfig.stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-500 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className={`font-mono font-bold tracking-tight tabular-nums ${
            size === 'sm' ? 'text-xs' : size === 'md' ? 'text-lg' : 'text-2xl'
          } ${colorConfig.text}`}>
            {score}
          </span>
          <span className="text-[9px] text-slate-400 font-medium uppercase leading-none">
            / 100
          </span>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${
            severity === 'LOW' ? 'bg-emerald-500' :
            severity === 'MEDIUM' ? 'bg-amber-500' : 'bg-rose-600 animate-pulse'
          }`}></span>
          <span className={`text-xs font-bold uppercase tracking-wider ${colorConfig.text}`}>
            {colorConfig.label}
          </span>
        </div>
        <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
          Deterministic Governance Score
        </p>
      </div>
    </div>
  );
};
