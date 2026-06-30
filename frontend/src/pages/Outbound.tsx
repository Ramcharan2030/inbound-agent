import React, { useState } from 'react';
import { PhoneForwarded, Users, AlertCircle, Info, Trash2 } from 'lucide-react';
import { Card, Button, Input, Table, Th, Td, Badge, cn } from '../components/ui';
import { useOutbound } from '../hooks/useOutbound';

export const Outbound = () => {
  const { dispatchSingle, dispatchBulk, loading } = useOutbound();
  const [activeTab, setActiveTab] = useState<'single' | 'bulk'>('single');
  
  // Single Call State
  const [singleData, setSingleData] = useState({ phone: '', name: '' });
  
  // Bulk Call State
  const [bulkInput, setBulkInput] = useState('');
  const [bulkResults, setBulkResults] = useState<any[] | null>(null);

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await dispatchSingle(singleData.phone, singleData.name);
      if (res.status === 'ok') {
        alert("Call dispatched successfully!");
        setSingleData({ phone: '', name: '' });
      } else {
        alert("Error: " + res.message);
      }
    } catch (err) {
      alert("Failed to dispatch call");
    }
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await dispatchBulk({ phone_numbers: bulkInput });
      setBulkResults(res.results);
    } catch (err) {
      alert("Bulk dispatch failed");
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-white">Outbound Dispatch</h2>
        <p className="text-zinc-400 mt-1">Initiate voice agent calls to single or multiple contacts.</p>
      </div>

      <div className="flex gap-1 p-1 bg-zinc-900 rounded-lg w-fit">
        <button 
          onClick={() => setActiveTab('single')}
          className={cn("px-4 py-2 text-sm font-medium rounded-md transition-all", activeTab === 'single' ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300")}
        >
          Single Call
        </button>
        <button 
          onClick={() => setActiveTab('bulk')}
          className={cn("px-4 py-2 text-sm font-medium rounded-md transition-all", activeTab === 'bulk' ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300")}
        >
          Bulk Dispatch
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="p-8 h-fit">
          {activeTab === 'single' ? (
            <form onSubmit={handleSingleSubmit} className="space-y-6">
              <div className="flex items-center gap-3 text-blue-500 mb-2">
                <PhoneForwarded size={20} />
                <h3 className="text-lg font-semibold text-white">Single Dispatch</h3>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-400">Recipient Name</label>
                  <Input 
                    placeholder="Customer Name" 
                    value={singleData.name}
                    onChange={(e) => setSingleData(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-400">Phone Number (E.164)</label>
                  <Input 
                    placeholder="+919999999999" 
                    value={singleData.phone}
                    onChange={(e) => setSingleData(prev => ({ ...prev, phone: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <Button type="submit" isLoading={loading} className="w-full h-12 text-lg">Dispatch Agent</Button>
              <div className="p-4 bg-blue-500/5 rounded-lg border border-blue-500/10 flex gap-3">
                <Info className="text-blue-500 shrink-0" size={18} />
                <p className="text-xs text-zinc-500 leading-relaxed">
                  The agent will greet the user with the configured "First Line" and follow the primary system instructions.
                </p>
              </div>
            </form>
          ) : (
            <form onSubmit={handleBulkSubmit} className="space-y-6">
              <div className="flex items-center gap-3 text-emerald-500 mb-2">
                <Users size={20} />
                <h3 className="text-lg font-semibold text-white">Bulk Dispatch</h3>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-400">Phone Numbers (one per line)</label>
                  <textarea 
                    className="w-full h-48 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="+919999999999&#10;+918888888888"
                    value={bulkInput}
                    onChange={(e) => setBulkInput(e.target.value)}
                    required
                  />
                </div>
              </div>
              <Button type="submit" isLoading={loading} className="w-full h-12 text-lg">Launch Bulk Dispatch</Button>
              <div className="p-4 bg-amber-500/5 rounded-lg border border-amber-500/10 flex gap-3">
                <AlertCircle className="text-amber-500 shrink-0" size={18} />
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Bulk dispatching uses a round-robin channel allocation. Ensure your SIP trunk has enough concurrent capacity.
                </p>
              </div>
            </form>
          )}
        </Card>

        <div>
          {bulkResults ? (
            <Card className="overflow-hidden">
              <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
                <h4 className="font-semibold text-white">Dispatch Results</h4>
                <Button variant="ghost" size="sm" onClick={() => setBulkResults(null)}><Trash2 size={16} /></Button>
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
                    <tr key={i}>
                      <Td className="font-mono">{res.phone}</Td>
                      <Td>
                        {res.status === 'ok' ? (
                          <Badge variant="success">Dispatched</Badge>
                        ) : (
                          <Badge variant="danger">Failed</Badge>
                        )}
                      </Td>
                      <Td className="text-xs text-zinc-500">
                        {res.status === 'ok' ? `Room: ${res.room.slice(0, 12)}...` : res.message}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-zinc-600 space-y-4 p-12 border-2 border-dashed border-zinc-900 rounded-xl">
              <PhoneForwarded size={48} className="opacity-20" />
              <p className="text-center text-sm max-w-[200px]">Enter recipient details to begin a dispatch.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
