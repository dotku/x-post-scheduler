"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface DataPoint {
  date: string;
  newUsers: number;
  totalUsers: number;
}

export default function AdminUserGrowthChart({
  data,
  newUsersLabel,
  totalUsersLabel,
}: {
  data: DataPoint[];
  newUsersLabel: string;
  totalUsersLabel: string;
}) {
  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12 }}
          stroke="#9ca3af"
        />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: 12 }}
          stroke="#9ca3af"
          allowDecimals={false}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 12 }}
          stroke="#9ca3af"
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "rgba(31, 41, 55, 0.95)",
            border: "1px solid #4b5563",
            borderRadius: "8px",
            color: "#f9fafb",
          }}
        />
        <Legend />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="newUsers"
          name={newUsersLabel}
          stroke="#3b82f6"
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="totalUsers"
          name={totalUsersLabel}
          stroke="#10b981"
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
