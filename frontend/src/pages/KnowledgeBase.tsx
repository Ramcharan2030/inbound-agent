import React, { useState } from 'react';
import {
  Globe, FileText, Upload, RefreshCw, Trash2, Search,
  ExternalLink, Database, CheckCircle2, Clock, Plus, AlertTriangle
} from 'lucide-react';
import { Card, Table, Th, Td, Badge, Button, Input, Modal, PageHeader, EmptyState, Tabs, cn } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { useKB } from '../hooks/useKB';
import { format } from 'date-fns';

const SOURCE_TABS = [
  { id: 'sources', label: 'Sources' },
  { id: 'jobs',    label: 'Ingest Jobs' },
  { id: 'search',  label: 'Search Playground' },
];

const StatusBadge = ({ status }: { status: string }) => {
  if (status === 'ready')   return <Badge variant="success">Ready</Badge>;
  if (status === 'error')   return <Badge variant="danger">Error</Badge>;
  return <Badge variant="warning" className="animate-pulse">Processing</Badge>;
};

export const KnowledgeBase = () => {
  const { status, sources, jobs, loading, createSource, deleteSource, syncSource, uploadFile, searchKB } = useKB();
  const { success, error: toastError, info } = useToast();
  const [activeTab, setActiveTab] = useState('sources');
  const [isUrlModalOpen, setIsUrlModalOpen] = useState(false);
  const [urlData, setUrlData] = useState({ title: '', url: '' });
  const [urlSubmitting, setUrlSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [syncingId, setSyncingId] = useState<number | null>(null);

  const handleUrlSubmit = async () => {
    if (!urlData.title.trim() || !urlData.url.trim()) {
      toastError('Missing Fields', 'Please provide a title and URL.');
      return;
    }
    setUrlSubmitting(true);
    try {
      await createSource({ source_type: 'web_url', title: urlData.title, source_url: urlData.url, enabled: true });
      success('Source Added', `"${urlData.title}" has been queued for ingestion.`);
      setIsUrlModalOpen(false);
      setUrlData({ title: '', url: '' });
    } catch (err: any) {
      toastError('Failed to Add Source', err.message);
    } finally {
      setUrlSubmitting(false);
    }
  };

  const handleDelete = async (id: number, title: string) => {
    setDeletingId(id);
    try {
      await deleteSource(id);
      success('Source Deleted', `"${title}" has been removed.`);
    } catch (err: any) {
      toastError('Delete Failed', err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleSync = async (id: number) => {
    setSyncingId(id);
    try {
      await syncSource(id);
      info('Sync Queued', 'The source has been queued for re-ingestion.');
    } catch (err: any) {
      toastError('Sync Failed', err.message);
    } finally {
      setSyncingId(null);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadFile(file);
      success('File Uploaded', `"${file.name}" has been queued for processing.`);
    } catch (err: any) {
      toastError('Upload Failed', err.message);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await searchKB(searchQuery);
      setSearchResults(res.result);
    } catch (err: any) {
      toastError('Search Failed', err.message);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Knowledge Base"
        subtitle="Manage data sources and verify agent grounding."
        icon={Database}
        iconColor="text-blue-400"
        actions={
          <div className="flex gap-3">
            <Button variant="outline" size="sm" onClick={() => setIsUrlModalOpen(true)} className="gap-2">
              <Globe size={14} />
              Add Website
            </Button>
            <div>
              <input type="file" id="file-upload" className="hidden" accept=".pdf,.txt" onChange={handleFileUpload} />
              <Button size="sm" onClick={() => document.getElementById('file-upload')?.click()} className="gap-2">
                <Upload size={14} />
                Upload PDF
              </Button>
            </div>
          </div>
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: Database,      color: 'text-blue-400',   bg: 'bg-blue-500/10',   label: 'Total Chunks',   value: status?.counts.chunks  ?? 0 },
          { icon: CheckCircle2,  color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Active Sources', value: status?.counts.sources ?? 0 },
          { icon: Clock,         color: 'text-amber-400',  bg: 'bg-amber-500/10',  label: 'Last Rebuild',   value: status?.last_rebuild_at ? format(new Date(status.last_rebuild_at), 'MMM d, HH:mm') : 'Never' },
        ].map(({ icon: Icon, color, bg, label, value }) => (
          <Card key={label} className="p-4 flex items-center gap-4">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', bg)}>
              <Icon size={20} className={color} />
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{label}</p>
              <p className="text-xl font-bold text-white tabular-nums mt-0.5">{value}</p>
            </div>
          </Card>
        ))}
      </div>

      <Tabs tabs={SOURCE_TABS} activeTab={activeTab} onChange={setActiveTab} />

      {/* Sources Tab */}
      {activeTab === 'sources' && (
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>Source</Th>
                <Th>Type</Th>
                <Th>Status</Th>
                <Th>Last Synced</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [1, 2, 3].map((i) => (
                  <tr key={i}>
                    <Td><div className="h-4 skeleton w-40" /></Td>
                    <Td><div className="h-5 skeleton w-16 rounded-full" /></Td>
                    <Td><div className="h-5 skeleton w-16 rounded-full" /></Td>
                    <Td><div className="h-4 skeleton w-24" /></Td>
                    <Td><div className="h-8 skeleton w-16 ml-auto" /></Td>
                  </tr>
                ))
              ) : sources.length === 0 ? (
                <tr>
                  <Td colSpan={5}>
                    <EmptyState
                      icon={Database}
                      title="No sources yet"
                      description="Add a website URL or upload a PDF to get started."
                      action={
                        <Button size="sm" onClick={() => setIsUrlModalOpen(true)} className="gap-2">
                          <Plus size={14} />
                          Add First Source
                        </Button>
                      }
                    />
                  </Td>
                </tr>
              ) : (
                sources.map((source) => (
                  <tr key={source.id} className="hover:bg-[#0e0f14]/60 transition-colors">
                    <Td>
                      <div className="font-medium text-white">{source.title}</div>
                      {source.source_url && (
                        <a
                          href={source.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-zinc-600 hover:text-blue-400 flex items-center gap-1 mt-0.5 w-fit transition-colors"
                        >
                          <span className="truncate max-w-[280px]">{source.source_url}</span>
                          <ExternalLink size={10} />
                        </a>
                      )}
                    </Td>
                    <Td>
                      <Badge variant="default" className="gap-1.5">
                        {source.source_type === 'web_url' ? <Globe size={11} /> : <FileText size={11} />}
                        {source.source_type.replace('_', ' ')}
                      </Badge>
                    </Td>
                    <Td><StatusBadge status={source.status} /></Td>
                    <Td>
                      <span className="text-zinc-500 text-xs">
                        {source.last_synced_at ? format(new Date(source.last_synced_at), 'MMM d, HH:mm') : 'Pending'}
                      </span>
                    </Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleSync(source.id)}
                          isLoading={syncingId === source.id}
                          title="Sync Source"
                        >
                          <RefreshCw size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(source.id, source.title)}
                          isLoading={deletingId === source.id}
                          className="text-red-500 hover:text-red-400 hover:bg-red-500/10"
                          title="Delete Source"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </Card>
      )}

      {/* Jobs Tab */}
      {activeTab === 'jobs' && (
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>Job ID</Th>
                <Th>Type</Th>
                <Th>Source</Th>
                <Th>Status</Th>
                <Th>Created</Th>
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 ? (
                <tr>
                  <Td colSpan={5}>
                    <EmptyState icon={Clock} title="No jobs yet" description="Jobs appear when sources are synced or uploaded." />
                  </Td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-[#0e0f14]/60 transition-colors">
                    <Td className="font-mono text-xs text-zinc-500">{job.id}</Td>
                    <Td className="capitalize text-zinc-300">{job.job_type}</Td>
                    <Td className="text-zinc-400">{job.source_id}</Td>
                    <Td>
                      {job.status === 'completed' && <Badge variant="success">Completed</Badge>}
                      {job.status === 'failed'    && <Badge variant="danger">Failed</Badge>}
                      {job.status === 'running'   && <Badge variant="warning" className="animate-pulse">Running</Badge>}
                      {job.status === 'pending'   && <Badge variant="default">Pending</Badge>}
                    </Td>
                    <Td className="text-zinc-500 text-xs">{format(new Date(job.created_at), 'MMM d, HH:mm:ss')}</Td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </Card>
      )}

      {/* Search Tab */}
      {activeTab === 'search' && (
        <div className="space-y-6">
          <Card className="p-5">
            <form onSubmit={handleSearch} className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                <Input
                  placeholder="Ask the knowledge base anything…"
                  className="pl-11 h-12 text-base"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button type="submit" isLoading={isSearching} className="h-12 px-8">
                Search
              </Button>
            </form>
          </Card>

          {searchResults && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in-up">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                  <FileText size={15} className="text-blue-400" />
                  Top Chunk Hits
                </h3>
                {searchResults.chunk_hits?.map((hit: any, i: number) => (
                  <Card key={i} className="p-4 border-l-2 border-l-blue-600 space-y-2">
                    <div className="flex justify-between items-start gap-3">
                      <h4 className="font-medium text-white text-sm">{hit.title}</h4>
                      <Badge variant="info">Score: {hit.score.toFixed(2)}</Badge>
                    </div>
                    <p className="text-xs text-zinc-400 line-clamp-4 leading-relaxed">{hit.content}</p>
                    {hit.source_url && (
                      <p className="text-[10px] text-zinc-700 truncate">{hit.source_url}</p>
                    )}
                  </Card>
                ))}
              </div>
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                  <Database size={15} className="text-emerald-400" />
                  Grounding Preview
                </h3>
                <Card className="p-5 bg-[#0a0b0f]">
                  <p className="text-zinc-600 text-xs italic mb-3">
                    The following will be provided to the agent as context:
                  </p>
                  <div className="p-4 rounded-lg bg-[#0e0f14] border border-[#1c1e27] font-mono text-xs text-zinc-500 leading-relaxed whitespace-pre-wrap max-h-[400px] overflow-y-auto">
                    {searchResults.chunk_hits?.map((h: any) => h.content).join('\n\n')}
                  </div>
                </Card>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add URL Modal */}
      <Modal isOpen={isUrlModalOpen} onClose={() => setIsUrlModalOpen(false)} title="Add Website Source">
        <div className="space-y-5">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-blue-500/5 border border-blue-500/15">
            <AlertTriangle size={16} className="text-blue-400 mt-0.5 shrink-0" />
            <p className="text-xs text-zinc-400">Only publicly accessible pages or sitemap.xml URLs are supported.</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Source Title</label>
            <Input
              placeholder="e.g. Help Center"
              value={urlData.title}
              onChange={(e) => setUrlData((p) => ({ ...p, title: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">URL or Sitemap</label>
            <Input
              placeholder="https://example.com/docs"
              value={urlData.url}
              onChange={(e) => setUrlData((p) => ({ ...p, url: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setIsUrlModalOpen(false)}>Cancel</Button>
            <Button onClick={handleUrlSubmit} isLoading={urlSubmitting}>Add Source</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
