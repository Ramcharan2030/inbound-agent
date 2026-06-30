import React from 'react';
import { 
  PhoneIncoming, 
  CalendarCheck, 
  Clock, 
  BarChart3, 
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  PhoneForwarded,
  Database
} from 'lucide-react';
import { Card, Badge, cn } from '../components/ui';
import { useStats } from '../hooks/useStats';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend?: number;
  description?: string;
}

const StatCard = ({ title, value, icon: Icon, trend, description }: StatCardProps) => (
  <Card className="p-6">
    <div className="flex items-center justify-between">
      <div className="p-2 bg-zinc-900 rounded-lg border border-zinc-800">
        <Icon size={20} className="text-zinc-400" />
      </div>
      {trend !== undefined && (
        <div className={cn(
          "flex items-center gap-1 text-sm font-medium",
          trend > 0 ? "text-emerald-500" : trend < 0 ? "text-rose-500" : "text-zinc-500"
        )}>
          {trend > 0 ? <ArrowUpRight size={16} /> : trend < 0 ? <ArrowDownRight size={16} /> : null}
          {Math.abs(trend)}%
        </div>
      )}
    </div>
    <div className="mt-4">
      <p className="text-sm text-zinc-400">{title}</p>
      <h3 className="text-2xl font-bold text-white mt-1">{value}</h3>
      <p className="text-xs text-zinc-500 mt-1">{description}</p>
    </div>
  </Card>
);

export const Overview = () => {
  const { stats, loading } = useStats();

  if (loading && !stats) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-48 bg-zinc-900 animate-pulse rounded-md" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-40 bg-zinc-900 animate-pulse rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-white">Dashboard</h2>
        <p className="text-zinc-400 mt-1">Operational metrics and system health overview.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Calls" 
          value={stats?.total_calls || 0} 
          icon={PhoneIncoming}
          trend={12}
          description="vs last 7d"
        />
        <StatCard 
          title="Total Bookings" 
          value={stats?.total_bookings || 0} 
          icon={CalendarCheck}
          trend={8}
          description="completed"
        />
        <StatCard 
          title="Avg. Duration" 
          value={`${stats?.avg_duration || 0}s`} 
          icon={Clock}
          trend={-5}
          description="per call"
        />
        <StatCard 
          title="Booking Rate" 
          value={`${stats?.booking_rate || 0}%`} 
          icon={BarChart3}
          trend={3}
          description="conversion"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-white">System Activity</h3>
            <Badge variant="info">Live Feed</Badge>
          </div>
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-sm font-medium">Gemini Runtime</span>
              </div>
              <span className="text-xs text-zinc-500">Latency: 240ms</span>
            </div>
            <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-sm font-medium">LiveKit SIP Gateway</span>
              </div>
              <span className="text-xs text-zinc-500">Active Channels: 0/20</span>
            </div>
            <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-sm font-medium">Knowledge Base Worker</span>
              </div>
              <span className="text-xs text-zinc-500">Idle</span>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Quick Actions</h3>
          <div className="space-y-3">
            <button className="w-full text-left p-3 rounded-lg border border-zinc-800 hover:bg-zinc-800 transition-colors group">
              <div className="flex items-center gap-3">
                <PhoneForwarded className="text-blue-500 group-hover:scale-110 transition-transform" size={18} />
                <span className="text-sm font-medium">Dispatch Single Call</span>
              </div>
            </button>
            <button className="w-full text-left p-3 rounded-lg border border-zinc-800 hover:bg-zinc-800 transition-colors group">
              <TrendingUp className="inline mr-3 text-emerald-500 group-hover:scale-110 transition-transform" size={18} />
              <span className="text-sm font-medium">View Detailed Analytics</span>
            </button>
            <button className="w-full text-left p-3 rounded-lg border border-zinc-800 hover:bg-zinc-800 transition-colors group">
              <Database className="inline mr-3 text-amber-500 group-hover:scale-110 transition-transform" size={18} />
              <span className="text-sm font-medium">Update Knowledge Base</span>
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
};
