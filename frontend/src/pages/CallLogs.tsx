import { useState } from 'react';
import { format } from 'date-fns';
import { FileText, Download, Play, Search, Clock, Zap, RefreshCw } from 'lucide-react';
import { Card, Table, Th, Td, Badge, Button, Input, Modal } from '../components/ui';
import { useLogs } from '../hooks/useLogs';
import type { CallLog } from '../api/types';

export const CallLogs = () => {
  const { logs, loading, getTranscript, fetchLogs } = useLogs();
  const [search, setSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState<CallLog | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [loadingTranscript, setLoadingTranscript] = useState(false);

  const filteredLogs = logs.filter(log => 
    log.phone_number.includes(search) || 
    log.caller_name?.toLowerCase().includes(search.toLowerCase()) ||
    log.summary?.toLowerCase().includes(search.toLowerCase())
  );

  const handleViewTranscript = async (log: CallLog) => {
    setSelectedLog(log);
    setLoadingTranscript(true);
    try {
      const text = await getTranscript(log.id);
      setTranscript(text);
    } catch (err) {
      setTranscript("Failed to load transcript.");
    } finally {
      setLoadingTranscript(false);
    }
  };

  const downloadTranscript = () => {
    if (!transcript || !selectedLog) return;
    const element = document.createElement("a");
    const file = new Blob([transcript], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `transcript-${selectedLog.id}.txt`;
    document.body.appendChild(element);
    element.click();
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white">Call Logs</h2>
          <p className="text-zinc-400 mt-1">Review call history, transcripts, and agent performance.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
            <Input 
              placeholder="Search caller or summary..." 
              className="pl-10 w-64"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={fetchLogs}><Clock size={18} /></Button>
        </div>
      </div>

      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Date & Time</Th>
              <Th>Caller</Th>
              <Th>Duration</Th>
              <Th>Outcome</Th>
              <Th>Latency</Th>
              <Th>Cost</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [1, 2, 3, 4, 5].map(i => (
                <tr key={i} className="animate-pulse">
                  <Td><div className="h-4 w-32 bg-zinc-800 rounded" /></Td>
                  <Td><div className="h-4 w-24 bg-zinc-800 rounded" /></Td>
                  <Td><div className="h-4 w-12 bg-zinc-800 rounded" /></Td>
                  <Td><div className="h-4 w-40 bg-zinc-800 rounded" /></Td>
                  <Td><div className="h-4 w-16 bg-zinc-800 rounded" /></Td>
                  <Td><div className="h-4 w-12 bg-zinc-800 rounded" /></Td>
                  <Td><div className="h-8 w-8 bg-zinc-800 rounded ml-auto" /></Td>
                </tr>
              ))
            ) : filteredLogs.length === 0 ? (
              <tr>
                <Td colSpan={7} className="text-center py-12 text-zinc-500">No call logs found.</Td>
              </tr>
            ) : (
              filteredLogs.map(log => (
                <tr key={log.id} className="hover:bg-zinc-900/50 transition-colors group">
                  <Td>
                    <div className="font-medium text-white">{format(new Date(log.created_at), 'MMM d, HH:mm')}</div>
                    <div className="text-xs text-zinc-500">{log.id}</div>
                  </Td>
                  <Td>
                    <div className="font-medium text-zinc-100">{log.caller_name || 'Unknown'}</div>
                    <div className="text-xs text-zinc-500">{log.phone_number}</div>
                  </Td>
                  <Td>{Math.floor(log.duration_seconds / 60)}m {log.duration_seconds % 60}s</Td>
                  <Td>
                    <div className="max-w-xs truncate" title={log.summary}>
                      {log.was_booked && <Badge variant="success" className="mr-2">Booked</Badge>}
                      {log.summary || 'No summary available'}
                    </div>
                  </Td>
                  <Td>
                    {log.latency_summary ? (
                      <div className="flex items-center gap-1.5 text-zinc-400">
                        <Zap size={14} className="text-amber-500" />
                        <span>{Math.round(log.latency_summary.total_turn_ms)}ms</span>
                      </div>
                    ) : '-'}
                  </Td>
                  <Td>
                    {log.cost_total_inr !== undefined && log.cost_total_inr !== null ? (
                      <span className="text-emerald-400 font-medium">₹{Number(log.cost_total_inr).toFixed(2)}</span>
                    ) : '-'}
                  </Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-2">
                      {log.recording_url && (
                        <Button variant="ghost" size="icon" title="Listen to recording">
                          <Play size={18} />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => handleViewTranscript(log)} title="View Transcript">
                        <FileText size={18} />
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </Card>

      <Modal 
        isOpen={!!selectedLog} 
        onClose={() => { setSelectedLog(null); setTranscript(null); }} 
        title={`Transcript: ${selectedLog?.caller_name || selectedLog?.phone_number}`}
        className="max-w-3xl"
      >
        <div className="space-y-6">
          <div className="flex flex-col gap-4 bg-zinc-950 p-4 rounded-lg border border-zinc-800">
            <div className="flex justify-between items-start">
              <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                <span className="text-zinc-500">Call ID:</span> <span className="text-white">{selectedLog?.id}</span>
                <span className="text-zinc-500">Duration:</span> <span className="text-white">{selectedLog?.duration_seconds}s</span>
                <span className="text-zinc-500">Booked:</span> <span className={selectedLog?.was_booked ? "text-emerald-500" : "text-zinc-400"}>{selectedLog?.was_booked ? 'Yes' : 'No'}</span>
              </div>
              <Button variant="outline" size="sm" onClick={downloadTranscript} className="gap-2">
                <Download size={16} />
                Download
              </Button>
            </div>
            
            {selectedLog?.cost_total_inr !== undefined && selectedLog?.cost_total_inr !== null && (
              <div className="border-t border-zinc-800 pt-4 mt-2">
                <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Cost Breakdown</div>
                <div className="flex gap-6 text-sm">
                  <div className="flex flex-col">
                    <span className="text-zinc-500 text-xs">Vobiz (SIP)</span>
                    <span className="text-white">₹{Number(selectedLog.cost_vobiz_inr).toFixed(2)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-zinc-500 text-xs">LiveKit</span>
                    <span className="text-white">₹{Number(selectedLog.cost_livekit_inr).toFixed(2)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-zinc-500 text-xs">Gemini AI</span>
                    <span className="text-white">₹{Number(selectedLog.cost_gemini_inr).toFixed(2)}</span>
                  </div>
                  <div className="flex flex-col border-l border-zinc-800 pl-6 ml-2">
                    <span className="text-zinc-500 text-xs">Total Consumed</span>
                    <span className="text-emerald-400 font-bold">₹{Number(selectedLog.cost_total_inr).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-zinc-950 p-6 rounded-lg border border-zinc-800 min-h-[300px] max-h-[500px] overflow-y-auto whitespace-pre-wrap font-mono text-sm leading-relaxed text-zinc-300">
            {loadingTranscript ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-zinc-500">
                <RefreshCw className="animate-spin" size={24} />
                Parsing transcript...
              </div>
            ) : (
              transcript
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};
