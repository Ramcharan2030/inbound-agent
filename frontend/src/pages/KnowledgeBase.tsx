import React, { useState } from 'react';
import { 
  Globe, 
  FileText, 
  Upload, 
  RefreshCw, 
  Trash2, 
  Search, 
  ExternalLink, 
  Database,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { Card, Table, Th, Td, Badge, Button, Input, Modal, cn } from '../components/ui';
import { useKB } from '../hooks/useKB';
import { format } from 'date-fns';

export const KnowledgeBase = () => {
  const { status, sources, jobs, loading, createSource, deleteSource, syncSource, uploadFile, searchKB } = useKB();
  const [activeTab, setActiveTab] = useState<'sources' | 'jobs' | 'search'>('sources');
  const [isUrlModalOpen, setIsUrlModalOpen] = useState(false);
  const [urlData, setUrlData] = useState({ title: '', url: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);

  const handleUrlSubmit = async () => {
    try {
      await createSource({
        source_type: 'web_url',
        title: urlData.title,
        source_url: urlData.url,
        enabled: true
      });
      setIsUrlModalOpen(false);
      setUrlData({ title: '', url: '' });
    } catch (err) {
      alert("Error: " + (err as Error).message);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadFile(file);
    } catch (err) {
      alert("Upload failed: " + (err as Error).message);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await searchKB(searchQuery);
      setSearchResults(res.result);
    } catch (err) {
      alert("Search failed");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white">Knowledge Base</h2>
          <p className="text-zinc-400 mt-1">Manage data sources and verify agent grounding.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setIsUrlModalOpen(true)} className="gap-2">
            <Globe size={18} />
            Add Website
          </Button>
          <div className="relative">
            <input 
              type="file" 
              id="file-upload" 
              className="hidden" 
              accept=".pdf,.txt" 
              onChange={handleFileUpload}
            />
            <Button 
              variant="primary" 
              onClick={() => document.getElementById('file-upload')?.click()} 
              className="gap-2"
            >
              <Upload size={18} />
              Upload PDF
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 bg-blue-600/10 rounded-xl text-blue-500">
            <Database size={24} />
          </div>
          <div>
            <p className="text-sm text-zinc-500">Total Chunks</p>
            <p className="text-2xl font-bold text-white">{status?.counts.chunks || 0}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-500">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="text-sm text-zinc-500">Active Sources</p>
            <p className="text-2xl font-bold text-white">{status?.counts.sources || 0}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 bg-amber-500/10 rounded-xl text-amber-500">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-sm text-zinc-500">Last Rebuild</p>
            <p className="text-sm font-medium text-white">
              {status?.last_rebuild_at ? format(new Date(status.last_rebuild_at), 'MMM d, HH:mm') : 'Never'}
            </p>
          </div>
        </Card>
      </div>

      <div className="flex gap-1 p-1 bg-zinc-900 rounded-lg w-fit">
        <button 
          onClick={() => setActiveTab('sources')}
          className={cn("px-4 py-2 text-sm font-medium rounded-md transition-all", activeTab === 'sources' ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300")}
        >
          Sources
        </button>
        <button 
          onClick={() => setActiveTab('jobs')}
          className={cn("px-4 py-2 text-sm font-medium rounded-md transition-all", activeTab === 'jobs' ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300")}
        >
          Ingest Jobs
        </button>
        <button 
          onClick={() => setActiveTab('search')}
          className={cn("px-4 py-2 text-sm font-medium rounded-md transition-all", activeTab === 'search' ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300")}
        >
          Search Playground
        </button>
      </div>

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
              {sources.map(source => (
                <tr key={source.id} className="hover:bg-zinc-900/50 transition-colors">
                  <Td>
                    <div className="font-medium text-white">{source.title}</div>
                    <div className="text-xs text-zinc-500 flex items-center gap-1">
                      {source.source_url && (
                        <a href={source.source_url} target="_blank" rel="noreferrer" className="hover:text-blue-500 flex items-center gap-1">
                          {source.source_url} <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                  </Td>
                  <Td>
                    <Badge variant="default" className="gap-1.5">
                      {source.source_type === 'web_url' ? <Globe size={12} /> : <FileText size={12} />}
                      {source.source_type.replace('_', ' ')}
                    </Badge>
                  </Td>
                  <Td>
                    {source.status === 'ready' ? (
                      <Badge variant="success">Ready</Badge>
                    ) : source.status === 'error' ? (
                      <Badge variant="danger">Error</Badge>
                    ) : (
                      <Badge variant="warning" className="animate-pulse">Processing</Badge>
                    )}
                  </Td>
                  <Td className="text-zinc-500 italic">
                    {source.last_synced_at ? format(new Date(source.last_synced_at), 'MMM d, HH:mm') : 'Pending'}
                  </Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => syncSource(source.id)} title="Sync Source">
                        <RefreshCw size={18} />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteSource(source.id)} className="text-red-500 hover:text-red-400">
                        <Trash2 size={18} />
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      {activeTab === 'jobs' && (
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>Job ID</Th>
                <Th>Type</Th>
                <Th>Source ID</Th>
                <Th>Status</Th>
                <Th>Started At</Th>
              </tr>
            </thead>
            <tbody>
              {jobs.map(job => (
                <tr key={job.id}>
                  <Td className="font-mono text-xs">{job.id}</Td>
                  <Td className="capitalize">{job.job_type}</Td>
                  <Td>{job.source_id}</Td>
                  <Td>
                    {job.status === 'completed' && <Badge variant="success">Completed</Badge>}
                    {job.status === 'failed' && <Badge variant="danger">Failed</Badge>}
                    {job.status === 'running' && <Badge variant="warning" className="animate-spin-slow">Running</Badge>}
                    {job.status === 'pending' && <Badge variant="default">Pending</Badge>}
                  </Td>
                  <Td>{format(new Date(job.created_at), 'MMM d, HH:mm:ss')}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      {activeTab === 'search' && (
        <div className="space-y-6">
          <Card className="p-6">
            <form onSubmit={handleSearch} className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
                <Input 
                  placeholder="Ask the knowledge base anything..." 
                  className="pl-11 h-12 text-lg"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button type="submit" isLoading={isSearching} className="px-8 h-12">Search</Button>
            </form>
          </Card>

          {searchResults && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <FileText size={18} className="text-blue-500" />
                  Top Chunk Hits
                </h3>
                {searchResults.chunk_hits.map((hit: any, i: number) => (
                  <Card key={i} className="p-4 space-y-2 border-l-2 border-l-blue-600">
                    <div className="flex justify-between items-start">
                      <h4 className="font-medium text-white">{hit.title}</h4>
                      <Badge variant="info">Score: {hit.score.toFixed(2)}</Badge>
                    </div>
                    <p className="text-sm text-zinc-400 line-clamp-4 leading-relaxed">{hit.content}</p>
                    <div className="text-xs text-zinc-600 truncate">{hit.source_url}</div>
                  </Card>
                ))}
              </div>
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Database size={18} className="text-emerald-500" />
                  Grounding Preview
                </h3>
                <Card className="p-6 bg-zinc-950 min-h-[300px]">
                  <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap italic">
                    "The following information will be provided to the agent as context..."
                  </p>
                  <div className="mt-4 p-4 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-500 leading-normal">
                    {searchResults.chunk_hits.map((h: any) => h.content).join('\n\n')}
                  </div>
                </Card>
              </div>
            </div>
          )}
        </div>
      )}

      {/* URL Source Modal */}
      <Modal isOpen={isUrlModalOpen} onClose={() => setIsUrlModalOpen(false)} title="Add Website Source">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-400">Source Title</label>
            <Input 
              placeholder="e.g. Help Center" 
              value={urlData.title}
              onChange={(e) => setUrlData(prev => ({ ...prev, title: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-400">URL or Sitemap</label>
            <Input 
              placeholder="https://example.com/docs" 
              value={urlData.url}
              onChange={(e) => setUrlData(prev => ({ ...prev, url: e.target.value }))}
            />
            <p className="text-xs text-zinc-500">Accepts normal pages or public sitemap.xml URLs.</p>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setIsUrlModalOpen(false)}>Cancel</Button>
            <Button onClick={handleUrlSubmit}>Add Source</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
