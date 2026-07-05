import { useState } from 'react';
import { Search, Phone, History, Calendar, Users, RefreshCw } from 'lucide-react';
import { Card, Table, Th, Td, Badge, Button, Input, PageHeader, EmptyState } from '../components/ui';
import { useContacts } from '../hooks/useContacts';
import { format } from 'date-fns';

export const Contacts = () => {
  const { contacts, loading, refresh } = useContacts();
  const [search, setSearch] = useState('');

  const filteredContacts = contacts.filter(
    (c) =>
      c.phone_number.includes(search) ||
      c.caller_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contacts"
        subtitle="Leads discovered through call history and site visit bookings."
        icon={Users}
        iconColor="text-blue-400"
        actions={
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
              <Input
                placeholder="Search contacts..."
                className="pl-9 w-56 h-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button variant="outline" size="sm" onClick={refresh} className="gap-2">
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
              <Th>Customer</Th>
              <Th>Total Calls</Th>
              <Th>Site Visits</Th>
              <Th>Status</Th>
              <Th>Last Seen</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [1, 2, 3, 4].map((i) => (
                <tr key={i}>
                  <Td><div className="space-y-1"><div className="h-4 skeleton w-28" /><div className="h-3 skeleton w-20" /></div></Td>
                  <Td><div className="h-4 skeleton w-8" /></Td>
                  <Td><div className="h-4 skeleton w-8" /></Td>
                  <Td><div className="h-5 skeleton w-20 rounded-full" /></Td>
                  <Td><div className="h-4 skeleton w-24" /></Td>
                  <Td><div className="h-8 skeleton w-16 ml-auto" /></Td>
                </tr>
              ))
            ) : filteredContacts.length === 0 ? (
              <tr>
                <Td colSpan={6}>
                  <EmptyState
                    icon={Users}
                    title="No contacts yet"
                    description={search ? 'Try a different search term.' : 'Contacts are created automatically from call logs.'}
                  />
                </Td>
              </tr>
            ) : (
              filteredContacts.map((contact) => (
                <tr key={contact.phone_number} className="hover:bg-[#0e0f14]/60 transition-colors group">
                  <Td>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/20 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-blue-400">
                          {(contact.caller_name || '?')[0].toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium text-white">{contact.caller_name || 'Unknown'}</div>
                        <div className="text-xs text-zinc-600">{contact.phone_number}</div>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <span className="tabular-nums font-semibold text-zinc-300">{contact.total_calls}</span>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <Calendar size={13} className="text-blue-400" />
                      <span className="tabular-nums text-zinc-300">{contact.appointment_count}</span>
                    </div>
                  </Td>
                  <Td>
                    {contact.is_booked ? (
                      <Badge variant="success">Visit Booked</Badge>
                    ) : (
                      <Badge variant="info">Lead</Badge>
                    )}
                  </Td>
                  <Td>
                    <span className="text-zinc-400">{format(new Date(contact.last_seen), 'MMM d, yyyy')}</span>
                  </Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" title="Call Back">
                        <Phone size={15} />
                      </Button>
                      <Button variant="ghost" size="icon" title="View History">
                        <History size={15} />
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  );
};
