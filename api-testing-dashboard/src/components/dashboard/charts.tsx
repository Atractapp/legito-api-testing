'use client';

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { HistoricalData, TestResult } from '@/types';

interface TrendChartProps {
  data: HistoricalData[];
  title?: string;
}

const COLORS = {
  passed: '#22c55e',
  failed: '#ef4444',
  skipped: '#eab308',
  primary: '#3b82f6',
  secondary: '#8b5cf6',
};

export function PassRateTrendChart({ data, title = 'Pass Rate Trend' }: TrendChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>Test pass rate over time</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="passRateGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.passed} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={COLORS.passed} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return `${date.getMonth() + 1}/${date.getDate()}`;
                }}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
                domain={[0, 100]}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
                formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Pass Rate']}
              />
              <Area
                type="monotone"
                dataKey="passRate"
                stroke={COLORS.passed}
                strokeWidth={2}
                fill="url(#passRateGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export function TestResultsChart({ data, title = 'Test Results' }: TrendChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>Passed vs failed tests over time</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return `${date.getMonth() + 1}/${date.getDate()}`;
                }}
              />
              <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Legend />
              <Bar dataKey="passed" name="Passed" fill={COLORS.passed} radius={[4, 4, 0, 0]} />
              <Bar dataKey="failed" name="Failed" fill={COLORS.failed} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export function DurationTrendChart({ data, title = 'Average Duration' }: TrendChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>Average test duration over time</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return `${date.getMonth() + 1}/${date.getDate()}`;
                }}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
                tickFormatter={(value) => `${(value / 1000).toFixed(1)}s`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
                formatter={(value) => [`${(Number(value) / 1000).toFixed(2)}s`, 'Avg Duration']}
              />
              <Line
                type="monotone"
                dataKey="avgDuration"
                stroke={COLORS.primary}
                strokeWidth={2}
                dot={{ fill: COLORS.primary, strokeWidth: 0, r: 4 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

interface ResultDistributionProps {
  passed: number;
  failed: number;
  skipped: number;
}

export function ResultDistributionChart({
  passed,
  failed,
  skipped,
}: ResultDistributionProps) {
  const total = passed + failed + skipped;
  const data = [
    { name: 'Passed', value: passed, color: COLORS.passed },
    { name: 'Failed', value: failed, color: COLORS.failed },
    { name: 'Skipped', value: skipped, color: COLORS.skipped },
  ].filter((d) => d.value > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Result Distribution</CardTitle>
        <CardDescription>Current test run breakdown</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                formatter={(value, name) => [
                  `${value} (${((Number(value) / total) * 100).toFixed(1)}%)`,
                  name,
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-6 mt-4">
          {data.map((item) => (
            <div key={item.name} className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-sm text-muted-foreground">
                {item.name}: {item.value}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface CategoryBreakdownProps {
  data: {
    category: string;
    passed: number;
    failed: number;
    total: number;
  }[];
}

export function CategoryBreakdownChart({ data }: CategoryBreakdownProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Category Breakdown</CardTitle>
        <CardDescription>Test results by category</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 10, right: 10, left: 80, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" tick={{ fontSize: 12 }} className="text-muted-foreground" />
              <YAxis
                type="category"
                dataKey="category"
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Legend />
              <Bar dataKey="passed" name="Passed" fill={COLORS.passed} stackId="a" />
              <Bar dataKey="failed" name="Failed" fill={COLORS.failed} stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// Combined chart view with tabs
interface ChartsDashboardProps {
  historicalData: HistoricalData[];
  currentResults?: {
    passed: number;
    failed: number;
    skipped: number;
  };
  categoryData?: CategoryBreakdownProps['data'];
}

export function ChartsDashboard({
  historicalData,
  currentResults,
  categoryData,
}: ChartsDashboardProps) {
  return (
    <Tabs defaultValue="trend" className="space-y-4">
      <TabsList>
        <TabsTrigger value="trend">Trend</TabsTrigger>
        <TabsTrigger value="results">Results</TabsTrigger>
        <TabsTrigger value="duration">Duration</TabsTrigger>
        {currentResults && <TabsTrigger value="distribution">Distribution</TabsTrigger>}
        {categoryData && <TabsTrigger value="categories">Categories</TabsTrigger>}
      </TabsList>

      <TabsContent value="trend">
        <PassRateTrendChart data={historicalData} />
      </TabsContent>

      <TabsContent value="results">
        <TestResultsChart data={historicalData} />
      </TabsContent>

      <TabsContent value="duration">
        <DurationTrendChart data={historicalData} />
      </TabsContent>

      {currentResults && (
        <TabsContent value="distribution">
          <ResultDistributionChart {...currentResults} />
        </TabsContent>
      )}

      {categoryData && (
        <TabsContent value="categories">
          <CategoryBreakdownChart data={categoryData} />
        </TabsContent>
      )}
    </Tabs>
  );
}
