import React, { useState } from 'react';
import { PhoneForwarded, Users, AlertCircle, Info, Trash2 } from 'lucide-react';
import { Card, Button, Input, Table, Th, Td, Badge, PageHeader, Tabs, EmptyState, cn } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { useOutbound } from '../hooks/useOutbound';

const DISPATCH_TABS = [
  { id: 'single', label: 'Single Call' },
  { id: 'bulk',   label: 'Bulk Dispatch' },
];

export const Outbound = () => {
  const { dispatchSingle, dispatchBulk, loading } = useOutbound();
  const { success, error: toastError } = useToast();
  const [activeTab, setActiveTab] = useState('single');
  const [singleData, setSingleData] = useState({ phone: '', name: '' });
  const [bulkInput, setBulkInput] = useState('');
  const [bulkResults, setBulkResults] = useState<any[] | null>(null);

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleData.phone.trim()) {
      toastError('Phone Required', 'Please enter a phone number in E.164 format.');
      return;
    }
    try {
      const res = await dispatchSingle(singleData.phone, singleData.name);
      if (res.status === 'ok') {
        success('Call Dispatched', `The agent is now calling ${singleData.name || singleData.phone}.`);
        setSingleData({ phone: '', name: '' });
      } else {
        toastError('Dispatch Failed', res.message);
      }
    } catch (err: any) {
      toastError('Dispatch Failed', err.message);
    }
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkInput.trim()) {
      toastError('No Numbers', 'Please enter at least one phone number.');
      return;
    }
    try {
      const res = await dispatchBulk({ phone_numbers: bulkInput });
      setBulkResults(res.results);
      const ok = res.results.filter((r: any) => r.status === 'ok').length;
      success('Bulk Dispatch Complete', `${ok} of ${res.results.length} calls dispatched.`);
    } catch (err: any) {
      toastError('Bulk Dispatch Failed', err.message);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Outbound Dispatch"
        subtitle="Initiate voice agent calls to single or multiple contacts."
        icon={PhoneForwarded}
        iconColor="text-blue-400"
      />

      <Tabs tabs={DISPATCH_TABS} activeTab={activeTab} onChange={setActiveTab} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form Card */}
        <Card className="p-7">
          {activeTab === 'single' ? (
            <form onSubmit={handleSingleSubmit} className="space-y-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <PhoneForwarded size={18} className="text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Single Call Dispatch</h3>
                  <p className="text-xs text-zinc-600">Call one contact right now</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Recipient Name</label>
                <Input
                  placeholder="Customer Name (optional)"
                  value={singleData.name}
                  onChange={(e) => setSingleData((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Phone Number <span className="text-blue-400 lowercase normal-case">(E.164 format)</span>
                </label>
                <Input
                  placeholder="+919999999999"
                  value={singleData.phone}
                  onChange={(e) => setSingleData((p) => ({ ...p, phone: e.target.value }))}
                  required
                  className="font-mono"
                />
              </div>

              <Button type="submit" isLoading={loading} className="w-full h-11 text-sm font-semibold">
                <PhoneForwarded size={16} />
                Dispatch Call
              </Button>

              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-blue-500/5 border border-blue-500/15">
                <Info size={15} className="text-blue-400 shrink-0 mt-0.5" />
                <p className="text-xs text-zinc-500 leading-relaxed">
                  The agent will greet the contact with the configured "First Line" and follow the primary system instructions.
                </p>
              </div>
            </form>
          ) : (
            <form onSubmit={handleBulkSubmit} className="space-y-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <Users size={18} className="text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Bulk Dispatch</h3>
                  <p className="text-xs text-zinc-600">Call multiple contacts simultaneously</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Phone Numbers (one per line)</label>
                <textarea
                  className="flex w-full h-44 rounded-lg border border-[#252833] bg-[#0e0f14] px-3 py-2.5 text-sm text-zinc-100 font-mono placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 resize-none"
                  placeholder={`+919999999999\n+918888888888\n+917777777777`}
                  value={bulkInput}
                  onChange={(e) => setBulkInput(e.target.value)}
                  required
                />
              </div>

              <Button type="submit" isLoading={loading} className="w-full h-11 text-sm font-semibold">
                <Users size={16} />
                Launch Bulk Dispatch
              </Button>

              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/15">
                <AlertCircle size={15} className="text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Bulk dispatching uses round-robin channel allocation. Ensure your SIP trunk has sufficient concurrent capacity.
                </p>
              </div>
            </form>
          )}
        </Card>

        {/* Results Panel */}
        <div>
          {bulkResults ? (
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-[#1c1e27] bg-[#0a0b0f]">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-emerald-400" />
                  <h4 className="font-semibold text-white text-sm">Dispatch Results</h4>
                  <span className="text-xs text-zinc-600">
                    {bulkResults.filter((r) => r.status === 'ok').length}/{bulkResults.length} succeeded
                  </span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setBulkResults(null)} title="Clear results">
                  <Trash2 size={14} />
                </Button>
              </div>
              <Table>
                <thead>
                  <tr>
                    <Th>Phone</Th>
                    <Th>Status</Th>
                    <Th>Details</Th>
                  </tr>
                </thead>
                <tbody>
                  {bulkResults.map((res, i) => (
                    <tr key={i} className="hover:bg-[#0e0f14]/60 transition-colors">
                      <Td className="font-mono text-xs">{res.phone}</Td>
                      <Td>
                        {res.status === 'ok' ? (
                          <Badge variant="success">Dispatched</Badge>
                        ) : (
                          <Badge variant="danger">Failed</Badge>
                        )}
                      </Td>
                      <Td className="text-xs text-zinc-600">
                        {res.status === 'ok'
                          ? `Room: ${String(res.room || '').slice(0, 16)}…`
                          : res.message}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          ) : (
            <div className="h-full min-h-[300px] flex items-center justify-center">
              <EmptyState
                icon={PhoneForwarded}
                title="No dispatch yet"
                description="Fill in the form and dispatch a call to see results here."
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
