import { PhoneIncoming, CalendarCheck, Clock, BarChart3, PhoneForwarded, Database, TrendingUp, Zap, Activity } from 'lucide-react';
import { Card, Badge, StatCard, PageHeader } from '../components/ui';
import { useStats } from '../hooks/useStats';

const SystemStatusRow = ({
  name,
  status,
  detail,
}: {
  name: string;
  status: 'online' | 'idle' | 'offline';
  detail: string;
}) => {
  const colors = {
    online: 'bg-emerald-400',
    idle: 'bg-amber-400',
    offline: 'bg-red-400',
  };
  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-[#0a0b0f] border border-[#1c1e27] hover:border-[#252833] transition-colors">
      <div className="flex items-center gap-3">
        <span className={`w-2 h-2 rounded-full shrink-0 ${colors[status]} ${status === 'online' ? 'animate-pulse' : ''}`} />
        <span className="text-sm font-medium text-zinc-300">{name}</span>
      </div>
      <span className="text-xs text-zinc-600 font-mono">{detail}</span>
    </div>
  );
};

export const Overview = () => {
  const { stats, loading } = useStats();

  if (loading && !stats) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div className="h-12 w-56 skeleton" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-36 skeleton rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-64 skeleton rounded-2xl" />
          <div className="h-64 skeleton rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        subtitle="Live operational metrics and system health."
        icon={Activity}
        iconColor="text-blue-400"
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
        <StatCard
          title="Total Calls"
          value={stats?.total_calls ?? 0}
          icon={PhoneIncoming}
          iconColor="text-blue-400"
          iconBg="bg-blue-500/10"
          trend={12}
          trendLabel="vs last 7 days"
        />
        <StatCard
          title="Site Visits"
          value={stats?.total_bookings ?? 0}
          icon={CalendarCheck}
          iconColor="text-emerald-400"
          iconBg="bg-emerald-500/10"
          trend={8}
          trendLabel="booked total"
        />
        <StatCard
          title="Avg. Duration"
          value={`${stats?.avg_duration ?? 0}s`}
          icon={Clock}
          iconColor="text-amber-400"
          iconBg="bg-amber-500/10"
          trend={-5}
          trendLabel="per call"
        />
        <StatCard
          title="Conversion Rate"
          value={`${stats?.booking_rate ?? 0}%`}
          icon={BarChart3}
          iconColor="text-purple-400"
          iconBg="bg-purple-500/10"
          trend={3}
          trendLabel="call → visit"
        />
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* System Activity */}
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <Zap size={18} className="text-amber-400" />
              <h3 className="text-base font-semibold text-white">System Status</h3>
            </div>
            <Badge variant="success">All Systems Nominal</Badge>
          </div>
          <div className="space-y-2">
            <SystemStatusRow name="Gemini Live Runtime" status="online" detail="Latency: ~240ms" />
            <SystemStatusRow name="LiveKit SIP Gateway" status="online" detail="Channels: 0 / 20" />
            <SystemStatusRow name="Knowledge Base Worker" status="idle"   detail="Idle — last rebuild OK" />
            <SystemStatusRow name="Supabase Backend"     status="online" detail="Connected" />
          </div>
        </Card>

        {/* Quick Actions */}
        <Card className="p-6">
          <h3 className="text-base font-semibold text-white mb-5">Quick Actions</h3>
          <div className="space-y-2">
            {[
              { icon: PhoneForwarded, label: 'Dispatch Single Call',     color: 'text-blue-400',   bg: 'bg-blue-500/10',   href: '/outbound' },
              { icon: TrendingUp,     label: 'View Detailed Analytics',  color: 'text-emerald-400', bg: 'bg-emerald-500/10', href: '/logs' },
              { icon: Database,       label: 'Update Knowledge Base',    color: 'text-amber-400',  bg: 'bg-amber-500/10',  href: '/kb' },
            ].map(({ icon: Icon, label, color, bg, href }) => (
              <a
                key={label}
                href={href}
                className="flex items-center gap-3 p-3 rounded-xl border border-[#1c1e27] hover:border-[#252833] hover:bg-[#13141a] transition-all group"
              >
                <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform`}>
                  <Icon size={16} className={color} />
                </div>
                <span className="text-sm font-medium text-zinc-300 group-hover:text-white transition-colors">{label}</span>
              </a>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};
