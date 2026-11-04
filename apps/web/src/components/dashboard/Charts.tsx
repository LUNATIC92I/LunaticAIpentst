'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const AXIS = { stroke: '#5c6b7e', fontSize: 11 };
const tooltipStyle = {
  background: '#101826',
  border: '1px solid #1e2b3c',
  borderRadius: 8,
  color: '#e6edf3',
  fontSize: 12,
};

export function FindingsBar({ data }: { data: { label: string; value: number; color: string }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
        <XAxis dataKey="label" tickLine={false} axisLine={false} {...AXIS} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} {...AXIS} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(56,189,248,0.06)' }} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((d) => (
            <Cell key={d.label} fill={d.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ActivityArea({ data }: { data: { label: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
        <defs>
          <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2dd4bf" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#2dd4bf" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="label" tickLine={false} axisLine={false} {...AXIS} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} {...AXIS} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: '#38bdf8', strokeOpacity: 0.3 }} />
        <Area type="monotone" dataKey="value" stroke="#2dd4bf" strokeWidth={2} fill="url(#activityFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
