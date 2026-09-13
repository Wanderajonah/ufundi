import { useEffect, useState } from 'react';
import { RiAddLine, RiDeleteBinLine, RiEyeLine, RiForbidLine } from 'react-icons/ri';
import Badge from '../components/Badge';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import { createUser, deleteUser, getClients, suspendClient } from '../services/api';
import { formatDate, formatUGX, getInitials, readList, toastMessage } from '../utils/format';

const inputClass =
  'w-full bg-bg-raised border border-border rounded-input px-4 py-3 text-white text-sm outline-none focus:border-primary transition-colors duration-200 placeholder:text-muted';

const ClientsPage = () => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const openAddModal = () => {
    setFormError('');
    setForm({ name: '', email: '', phone: '' });
    setAddOpen(true);
  };

  const handleAddClient = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) {
      setFormError('Name, email and phone are required.');
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      await createUser({ ...form, role: 'customer' });
      toastMessage('Client created successfully.');
      setAddOpen(false);
      loadClients();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Unable to create client.');
    } finally {
      setSubmitting(false);
    }
  };

  const loadClients = async () => {
    setLoading(true);
    try {
      const res = await getClients({ search });
      const items = readList(res.data, ['users', 'data']);
      setClients(items.map((c) => ({ ...c, location: c.district || c.locationLabel || 'N/A' })));
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load clients.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
  }, []);

  const filtered = clients.filter((client) => `${client.name || ''} ${client.phone || ''}`.toLowerCase().includes(search.toLowerCase()));

  const handleSuspend = async (client) => {
    if (!window.confirm('Suspend this client account?')) return;
    try {
      await suspendClient(client.id || client._id);
      toastMessage('Client suspended.');
      loadClients();
    } catch (err) {
      toastMessage(err.response?.data?.message || 'Unable to suspend client.');
    }
  };

  const handleDelete = async (client) => {
    if (!window.confirm('Delete this client permanently?')) return;
    try {
      await deleteUser(client.id || client._id);
      toastMessage('Client deleted.');
      loadClients();
    } catch (err) {
      toastMessage(err.response?.data?.message || 'Unable to delete client.');
    }
  };

  const columns = [
    { key: 'index', header: '#', render: (_, index) => index + 1 },
    { key: 'name', header: 'Avatar+Name+Phone', render: (client) => <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-primary/20 text-primary font-bold text-xs flex items-center justify-center">{getInitials(client.name)}</div><div><div className="font-semibold text-white">{client.name || 'Client'}</div><div className="text-muted text-xs">{client.phone || 'N/A'}</div></div></div> },
    { key: 'location', header: 'Location', render: (client) => client.location || client.district || 'N/A' },
    { key: 'bookings', header: 'Total Bookings', render: (client) => client.totalBookings || client.bookingsCount || 0 },
    { key: 'joined', header: 'Joined', render: (client) => formatDate(client.createdAt) },
    { key: 'status', header: 'Status', render: (client) => <Badge label={client.status || 'active'} type={(client.status || 'active') === 'suspended' ? 'danger' : 'success'} /> },
    { key: 'actions', header: 'Actions', render: (client) => <div className="flex gap-1"><button onClick={() => setSelected(client)} className="p-1.5 text-muted hover:text-info transition-colors" aria-label="View client"><RiEyeLine /></button><button onClick={() => handleSuspend(client)} className="p-1.5 text-muted hover:text-danger transition-colors" aria-label="Suspend client"><RiForbidLine /></button><button onClick={() => handleDelete(client)} className="p-1.5 text-muted hover:text-danger transition-colors" aria-label="Delete client"><RiDeleteBinLine /></button></div> },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-white text-xl font-black">Clients</h1>
        <div className="flex items-center gap-2">
          <span className="bg-primary/20 text-primary text-xs font-bold px-3 py-1 rounded-pill">{filtered.length} Clients</span>
          <button onClick={openAddModal} className="flex items-center gap-2 bg-primary text-primary-text rounded-input px-4 py-2 text-sm font-bold hover:bg-amber-400 transition-colors"><RiAddLine /> Add Client</button>
        </div>
      </div>
      {error && <div className="bg-red-500/10 border border-danger text-danger text-sm rounded-input px-4 py-3 mb-6">{error}</div>}
      <div className="flex items-center gap-3 mb-6 flex-wrap"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search clients" className="bg-bg-raised border border-border rounded-input px-4 py-2 text-white text-sm outline-none w-56 focus:border-primary placeholder:text-muted transition-colors duration-200" /></div>
      <DataTable columns={columns} data={filtered} loading={loading} emptyMessage="No clients found" />
      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Client Details" size="lg">
        {selected && <div className="space-y-4"><div className="flex items-center gap-3"><div className="w-14 h-14 rounded-full bg-primary/20 text-primary font-black flex items-center justify-center">{getInitials(selected.name)}</div><div><div className="text-white font-black">{selected.name}</div><div className="text-muted text-sm">{selected.phone} · {selected.location || 'N/A'}</div></div></div><div className="grid grid-cols-2 gap-3"><div className="bg-bg-raised p-4 rounded-input"><div className="text-white font-black">{selected.totalBookings || 0}</div><div className="text-muted text-xs">Total bookings</div></div><div className="bg-bg-raised p-4 rounded-input"><div className="text-primary font-black">{formatUGX(selected.amountSpent)}</div><div className="text-muted text-xs">Amount spent</div></div></div><div className="bg-bg-raised rounded-input p-4"><h3 className="text-white font-bold mb-3">Recent bookings</h3>{(selected.recentBookings || []).length === 0 ? <p className="text-muted text-sm">No recent bookings.</p> : selected.recentBookings.map((booking) => <div key={booking.id || booking._id} className="py-2 border-b border-border last:border-0 text-sm text-muted">{booking.service} · {formatDate(booking.date)}</div>)}</div></div>}
      </Modal>

      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title="Add Client">
        <div className="space-y-4">
          {formError && <div className="bg-red-500/10 border border-danger text-danger text-sm rounded-input px-4 py-3">{formError}</div>}
          <div>
            <label className="block text-muted text-xs font-bold uppercase tracking-wider mb-2">Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" className={inputClass} />
          </div>
          <div>
            <label className="block text-muted text-xs font-bold uppercase tracking-wider mb-2">Email</label>
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@email.com" type="email" className={inputClass} />
          </div>
          <div>
            <label className="block text-muted text-xs font-bold uppercase tracking-wider mb-2">Phone</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="7XX XXX XXX" className={inputClass} />
          </div>
          <button
            onClick={handleAddClient}
            disabled={submitting}
            className="w-full bg-primary text-primary-text rounded-input px-4 py-3 text-sm font-bold hover:bg-amber-400 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Creating…' : 'Create Account'}
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default ClientsPage;
