import { useState } from 'react';
import { Search, Phone, History, Calendar } from 'lucide-react';
import { Card, Table, Th, Td, Badge, Button, Input } from '../components/ui';
import { useContacts } from '../hooks/useContacts';
import { format } from 'date-fns';

export const Contacts = () => {
  const { contacts, loading, refresh } = useContacts();
  const [search, setSearch] = useState('');

  const filteredContacts = contacts.filter(c => 
    c.phone_number.includes(search) || 
    c.caller_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white">Contacts</h2>
          <p className="text-zinc-400 mt-1">Customers discovered through call history and bookings.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
            <Input 
              placeholder="Search contacts..." 
              className="pl-10 w-64"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={refresh}>Refresh</Button>
        </div>
      </div>

      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Customer</Th>
              <Th>Total Calls</Th>
              <Th>Appointments</Th>
              <Th>Status</Th>
              <Th>Last Seen</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [1, 2, 3].map(i => <tr key={i} className="animate-pulse"><Td colSpan={6}><div className="h-12 bg-zinc-800 rounded" /></Td></tr>)
            ) : filteredContacts.length === 0 ? (
              <tr><Td colSpan={6} className="text-center py-12 text-zinc-500">No contacts found.</Td></tr>
            ) : (
              filteredContacts.map(contact => (
                <tr key={contact.phone_number} className="hover:bg-zinc-900/50 transition-colors">
                  <Td>
                    <div className="font-medium text-white">{contact.caller_name || 'Unknown'}</div>
                    <div className="text-xs text-zinc-500">{contact.phone_number}</div>
                  </Td>
                  <Td>{contact.total_calls}</Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-blue-500" />
                      {contact.appointment_count}
                    </div>
                  </Td>
                  <Td>
                    {contact.is_booked ? (
                      <Badge variant="success">Booked Customer</Badge>
                    ) : (
                      <Badge variant="default">Lead</Badge>
                    )}
                  </Td>
                  <Td>{format(new Date(contact.last_seen), 'MMM d, yyyy')}</Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" title="Call Back">
                        <Phone size={18} />
                      </Button>
                      <Button variant="ghost" size="icon" title="View History">
                        <History size={18} />
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
