import { useState } from 'react';
import { format } from 'date-fns';
import { FileText, Download, Play, Search, Zap, RefreshCw, PhoneCall, ChevronDown, ChevronRight } from 'lucide-react';
import { Card, Table, Th, Td, Badge, Button, Input, Modal, PageHeader, EmptyState, cn } from '../components/ui';
import { useLogs } from '../hooks/useLogs';
import { useToast } from '../context/ToastContext';
import type { CallLog } from '../api/types';

const OutcomeBadge = ({ log }: { log: CallLog }) => {
  if (log.was_booked) return <Badge variant="success">Booked</Badge>;
  if (log.sentiment === 'negative') return <Badge variant="danger">Negative</Badge>;
  return <Badge variant="default">Completed</Badge>;
};

export const CallLogs = () => {
  const { logs, loading, getTranscript, fetchLogs } = useLogs();
  const { error: toastError } = useToast();
  const [search, setSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState<CallLog | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [loadingTranscript, setLoadingTranscript] = useState(false);

  // Inline expandable transcript states
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [expandedTranscripts, setExpandedTranscripts] = useState<Record<string, string>>({});
  const [loadingExpanded, setLoadingExpanded] = useState<Record<string, boolean>>({});

  const filteredLogs = logs.filter(
    (log) =>
      log.phone_number.includes(search) ||
      log.caller_name?.toLowerCase().includes(search.toLowerCase()) ||
      log.summary?.toLowerCase().includes(search.toLowerCase())
  );

  const handleToggleExpand = async (e: React.MouseEvent, log: CallLog) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a')) {
      return;
    }

    if (expandedLogId === log.id) {
      setExpandedLogId(null);
      return;
    }
    setExpandedLogId(log.id);

    if (!expandedTranscripts[log.id]) {
      setLoadingExpanded((prev) => ({ ...prev, [log.id]: true }));
      try {
        const text = await getTranscript(log.id);
        setExpandedTranscripts((prev) => ({ ...prev, [log.id]: text }));
      } catch {
        setExpandedTranscripts((prev) => ({ ...prev, [log.id]: 'No transcript available.' }));
      } finally {
        setLoadingExpanded((prev) => ({ ...prev, [log.id]: false }));
      }
    }
  };

  const handleViewTranscript = async (log: CallLog) => {
    setSelectedLog(log);
    setLoadingTranscript(true);
    setTranscript(null);
    try {
      const text = await getTranscript(log.id);
      setTranscript(text);
    } catch {
      setTranscript(null);
      toastError('Failed to load transcript', 'The transcript could not be retrieved.');
    } finally {
      setLoadingTranscript(false);
    }
  };

  const downloadTranscript = () => {
    if (!transcript || !selectedLog) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([transcript], { type: 'text/plain' }));
    a.download = `transcript-${selectedLog.id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Call Logs"
        subtitle="Review call history, transcripts, and agent performance."
        icon={PhoneCall}
        iconColor="text-blue-400"
        actions={
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
              <Input
                placeholder="Search caller or summary..."
                className="pl-9 w-60 h-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button variant="outline" size="sm" onClick={fetchLogs} className="gap-2">
              <RefreshCw size={14} />
              Refresh
            </Button>
          </div>
        }
      />

      <Card>
        <Table>
          <thead>
            <tr>
              <Th className="w-10"></Th>
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
              [1, 2, 3, 4, 5].map((i) => (
                <tr key={i}>
                  <Td></Td>
                  <Td><div className="h-4 skeleton w-28" /></Td>
                  <Td><div className="h-4 skeleton w-24" /></Td>
                  <Td><div className="h-4 skeleton w-12" /></Td>
                  <Td><div className="h-4 skeleton w-16" /></Td>
                  <Td><div className="h-4 skeleton w-16" /></Td>
                  <Td><div className="h-4 skeleton w-12" /></Td>
                  <Td><div className="h-8 skeleton w-8 ml-auto" /></Td>
                </tr>
              ))
            ) : filteredLogs.length === 0 ? (
              <tr>
                <Td colSpan={8}>
                  <EmptyState
                    icon={PhoneCall}
                    title="No call logs found"
                    description={search ? 'Try a different search term.' : 'Calls made through the AI agent will appear here.'}
                  />
                </Td>
              </tr>
            ) : (
              filteredLogs.map((log) => {
                const isExpanded = expandedLogId === log.id;
                return (
                  <tr
                    key={log.id}
                    onClick={(e) => handleToggleExpand(e, log)}
                    className="hover:bg-[#0e0f14]/60 transition-colors group cursor-pointer"
                  >
                    <Td className="text-zinc-500">
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </Td>
                    <Td>
                      <div className="font-medium text-white text-sm">
                        {format(new Date(log.created_at), 'MMM d, HH:mm')}
                      </div>
                      <div className="text-[11px] text-zinc-600 font-mono mt-0.5">#{log.id}</div>
                    </Td>
                    <Td>
                      <div className="font-medium text-zinc-100">{log.caller_name || 'Unknown'}</div>
                      <div className="text-xs text-zinc-600 mt-0.5">{log.phone_number}</div>
                    </Td>
                    <Td>
                      <span className="tabular-nums text-zinc-300">
                        {Math.floor(log.duration_seconds / 60)}m {log.duration_seconds % 60}s
                      </span>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <OutcomeBadge log={log} />
                        {log.summary && (
                          <span className="text-xs text-zinc-600 truncate max-w-[160px]" title={log.summary}>
                            {log.summary}
                          </span>
                        )}
                      </div>
                    </Td>
                    <Td>
                      {log.latency_summary ? (
                        <div className="flex items-center gap-1.5">
                          <Zap size={13} className="text-amber-500" />
                          <span className="text-zinc-400 tabular-nums text-xs">
                            {Math.round(log.latency_summary.total_turn_ms)}ms
                          </span>
                        </div>
                      ) : (
                        <span className="text-zinc-700">—</span>
                      )}
                    </Td>
                    <Td>
                      {log.cost_total_inr != null ? (
                        <span className="text-emerald-400 font-semibold tabular-nums">
                          ₹{Number(log.cost_total_inr).toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-zinc-700">—</span>
                      )}
                    </Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-1">
                        {log.recording_url && (
                          <Button variant="ghost" size="icon" title="Listen to recording">
                            <Play size={15} />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleViewTranscript(log)}
                          title="View Details Modal"
                        >
                          <FileText size={15} />
                        </Button>
                      </div>
                    </Td>
                  </tr>
                );
              }).reduce<React.ReactNode[]>((acc, logRow, index) => {
                const log = filteredLogs[index];
                const isExpanded = expandedLogId === log.id;

                acc.push(logRow);

                if (isExpanded) {
                  acc.push(
                    <tr key={`${log.id}-expanded`} className="bg-[#0a0b0f]/60">
                      <Td colSpan={8} className="p-4 border-b border-[#1c1e27]">
                        <div className="space-y-3 animate-fade-in-up">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                              Transcript Preview
                            </span>
                            <div className="flex items-center gap-2">
                              {log.recording_url && (
                                <a
                                  href={log.recording_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
                                >
                                  Download Recording
                                </a>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewTranscript(log)}
                                className="h-7 text-xs"
                              >
                                Full Details & Metrics
                              </Button>
                            </div>
                          </div>
                          <div className="bg-[#08090c] p-4 rounded-xl border border-[#1c1e27] font-mono text-xs leading-relaxed text-zinc-300 max-h-[300px] overflow-y-auto whitespace-pre-wrap">
                            {loadingExpanded[log.id] ? (
                              <div className="flex items-center gap-2 text-zinc-600 py-4 justify-center">
                                <RefreshCw className="animate-spin" size={16} />
                                Loading conversation transcript…
                              </div>
                            ) : (
                              expandedTranscripts[log.id] || 'No transcript available.'
                            )}
                          </div>
                        </div>
                      </Td>
                    </tr>
                  );
                }
                return acc;
              }, [])
            )}
          </tbody>
        </Table>
      </Card>

      {/* Transcript Modal */}
      <Modal
        isOpen={!!selectedLog}
        onClose={() => { setSelectedLog(null); setTranscript(null); }}
        title={`Transcript — ${selectedLog?.caller_name || selectedLog?.phone_number || ''}`}
        className="max-w-3xl"
      >
        <div className="space-y-4">
          {/* Meta info */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Duration', value: `${selectedLog?.duration_seconds}s` },
              { label: 'Booked',   value: selectedLog?.was_booked ? 'Yes' : 'No', color: selectedLog?.was_booked ? 'text-emerald-400' : 'text-zinc-400' },
              { label: 'Cost',     value: selectedLog?.cost_total_inr != null ? `₹${Number(selectedLog.cost_total_inr).toFixed(2)}` : '—', color: 'text-emerald-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="p-3 rounded-xl bg-[#0a0b0f] border border-[#1c1e27] text-center">
                <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">{label}</p>
                <p className={cn('text-base font-bold mt-1', color || 'text-white')}>{value}</p>
              </div>
            ))}
          </div>

          {/* Cost breakdown */}
          {selectedLog?.cost_total_inr != null && (
            <div className="p-4 rounded-xl bg-[#0a0b0f] border border-[#1c1e27]">
              <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-3">Cost Breakdown</p>
              <div className="flex gap-6 text-sm">
                <div><p className="text-zinc-600 text-xs">Vobiz (SIP)</p><p className="text-white font-medium">₹{Number(selectedLog.cost_vobiz_inr).toFixed(2)}</p></div>
                <div><p className="text-zinc-600 text-xs">LiveKit</p><p className="text-white font-medium">₹{Number(selectedLog.cost_livekit_inr).toFixed(2)}</p></div>
                <div><p className="text-zinc-600 text-xs">Gemini AI</p><p className="text-white font-medium">₹{Number(selectedLog.cost_gemini_inr).toFixed(2)}</p></div>
                <div className="ml-auto"><p className="text-zinc-600 text-xs">Total</p><p className="text-emerald-400 font-bold">₹{Number(selectedLog.cost_total_inr).toFixed(2)}</p></div>
              </div>
            </div>
          )}

          {/* Download button */}
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={downloadTranscript} className="gap-2" disabled={!transcript}>
              <Download size={14} />
              Download .txt
            </Button>
          </div>

          {/* Transcript text */}
          <div className="bg-[#0a0b0f] p-5 rounded-xl border border-[#1c1e27] min-h-[280px] max-h-[440px] overflow-y-auto font-mono text-sm leading-relaxed text-zinc-300 whitespace-pre-wrap">
            {loadingTranscript ? (
              <div className="flex flex-col items-center justify-center h-48 gap-3 text-zinc-600">
                <RefreshCw className="animate-spin" size={22} />
                <span className="text-sm">Parsing transcript…</span>
              </div>
            ) : transcript ? (
              transcript
            ) : (
              <span className="text-zinc-700 italic">No transcript available.</span>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};
