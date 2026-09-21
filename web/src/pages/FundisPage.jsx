import { useCallback, useEffect, useRef, useState } from 'react';
import { RiAddLine, RiDeleteBinLine, RiEyeLine, RiShieldCheckLine, RiCloseCircleLine, RiFileLine, RiImageLine } from 'react-icons/ri';
import Badge from '../components/Badge';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import { API_BASE, createUser, deleteFundi, getFundis, getFundiReferees, rejectFundi, verifyFundi } from '../services/api';
import { formatDate, getInitials, readList, toastMessage } from '../utils/format';

const FundisPage = () => {
  const [fundis, setFundis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All');
  const [selected, setSelected] = useState(null);
  const [verdictAction, setVerdictAction] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [referees, setReferees] = useState([]);

  const openAddModal = () => {
    setFormError('');
    setForm({ name: '', email: '', phone: '' });
    setAddOpen(true);
  };

  const handleAddFundi = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) {
      setFormError('Name, email and phone are required.');
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      await createUser({ ...form, role: 'fundi' });
      toastMessage('Fundi created successfully.');
      setAddOpen(false);
      loadFundis();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Unable to create fundi.');
    } finally {
      setSubmitting(false);
    }
  };

  const loadFundis = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getFundis({ search, status: status === 'All' ? undefined : status.toLowerCase() });
      const items = readList(res.data, ['fundis', 'data']);
      setFundis(items.map(normalizeFundi));
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load fundis.');
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  const normalizeFundi = (f) => {
    const profile = f.fundiProfile || {};
    return {
      ...f,
      verificationStatus: profile.verificationStatus || 'unverified',
      verified: profile.verified || false,
      rating: profile.rating || 0,
      skills: profile.skills || [],
      experience: profile.experience || 0,
      completedJobs: f.completedJobs || 0,
      trade: (profile.skills || [])[0] || 'Skilled Artisan',
      category: (profile.skills || [])[0] || 'Skilled Artisan',
      location: f.district || f.locationLabel || 'N/A',
      district: f.district || f.locationLabel || 'N/A',
      verificationDocs: profile.verificationDocs || [],
      verificationNotes: profile.verificationNotes || '',
      verificationRequestedAt: profile.requestedAt || null,
    };
  };

  useEffect(() => {
    loadFundis();
  }, [status, loadFundis]);

  const q = search.toLowerCase();
  const filteredFundis = fundis.filter((fundi) => `${fundi.name || ''} ${fundi.trade || ''}`.toLowerCase().includes(q));

  const handleVerdict = async (id, action, notes) => {
    setVerdictAction(action);
    try {
      const fn = action === 'verify' ? verifyFundi : rejectFundi;
      await fn(id, notes);
      toastMessage(action === 'verify' ? 'Fundi verified.' : 'Fundi rejected.');
      setSelected(null);
      loadFundis();
    } catch (err) {
      toastMessage(err.response?.data?.message || 'Action failed.');
    } finally {
      setVerdictAction('');
    }
  };

  const handleDelete = async (fundi) => {
    if (!window.confirm('Delete this fundi permanently?')) return;
    try {
      await deleteFundi(fundi._id);
      toastMessage('Fundi deleted.');
      loadFundis();
    } catch (err) {
      toastMessage(err.response?.data?.message || 'Unable to delete fundi.');
    }
  };

  const stats = {
    verified: fundis.filter((f) => f.verificationStatus === 'verified').length,
    pending: fundis.filter((f) => f.verificationStatus === 'pending').length,
    rejected: fundis.filter((f) => f.verificationStatus === 'rejected').length,
  };

  const loadReferees = async (fundiId) => {
    try {
      const res = await getFundiReferees(fundiId);
      setReferees(Array.isArray(res.data) ? res.data : []);
    } catch {
      setReferees([]);
    }
  };

  const handleSelect = (fundi) => {
    setSelected(fundi);
    loadReferees(fundi._id);
  };

  const columns = [
    { key: 'index', header: '#', render: (_, index) => index + 1 },
    {
      key: 'name',
      header: 'Fundi',
      render: (fundi) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/20 text-primary font-bold text-xs flex items-center justify-center">{getInitials(fundi.name)}</div>
          <div>
            <div className="font-semibold text-white">{fundi.name}</div>
            <div className="text-muted text-xs">{fundi.trade}</div>
          </div>
        </div>
      ),
    },
    { key: 'phone', header: 'Phone', render: (fundi) => fundi.phone || 'N/A' },
    { key: 'location', header: 'Location', render: (fundi) => fundi.location },
    { key: 'rating', header: 'Rating', render: (fundi) => fundi.rating || '0.0' },
    { key: 'joined', header: 'Joined', render: (fundi) => formatDate(fundi.createdAt) },
    {
      key: 'status',
      header: 'Status',
      render: (fundi) => (
        <Badge
          label={fundi.verificationStatus}
          type={fundi.verificationStatus === 'verified' ? 'success' : fundi.verificationStatus === 'rejected' ? 'danger' : 'warning'}
        />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (fundi) => (
        <div className="flex items-center gap-1">
          <button onClick={() => handleSelect(fundi)} className="p-1.5 text-muted hover:text-info transition-colors" aria-label="View fundi"><RiEyeLine /></button>
          <button onClick={() => handleDelete(fundi)} className="p-1.5 text-muted hover:text-danger transition-colors" aria-label="Delete fundi"><RiDeleteBinLine /></button>
        </div>
      ),
    },
  ];

  const isImage = (url) => /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(url);

  const VerdictSection = ({ fundi }) => {
    const [notes, setNotes] = useState(fundi.verificationNotes || '');
    const isPending = fundi.verificationStatus === 'pending' || fundi.verificationStatus === 'unverified';

    return (
      <div className="bg-bg-raised rounded-input p-4 space-y-3">
        <h3 className="text-white font-bold">Verification Decision</h3>
        {fundi.verificationNotes && fundi.verificationStatus !== 'pending' && (
          <p className="text-muted text-sm">Previous notes: {fundi.verificationNotes}</p>
        )}
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add notes or remarks (optional)"
          rows={2}
          className="w-full bg-bg-primary border border-border rounded-input px-3 py-2 text-white text-sm outline-none focus:border-primary placeholder:text-muted resize-none"
        />
        {isPending && (
          <div className="flex gap-2">
            <button
              onClick={() => handleVerdict(fundi._id, 'verify', notes)}
              disabled={!!verdictAction}
              className="flex items-center gap-1.5 px-4 py-2 bg-success text-white text-sm font-bold rounded-pill hover:bg-green-500 disabled:opacity-50 transition-colors"
            >
              <RiShieldCheckLine /> {verdictAction === 'verify' ? 'Processing...' : 'Approve'}
            </button>
            <button
              onClick={() => handleVerdict(fundi._id, 'reject', notes)}
              disabled={!!verdictAction}
              className="flex items-center gap-1.5 px-4 py-2 bg-danger text-white text-sm font-bold rounded-pill hover:bg-red-500 disabled:opacity-50 transition-colors"
            >
              <RiCloseCircleLine /> {verdictAction === 'reject' ? 'Processing...' : 'Reject'}
            </button>
          </div>
        )}
        {!isPending && (
          <p className="text-muted text-xs">
            {fundi.verificationStatus === 'verified' ? 'Fundi is verified.' : 'Fundi verification was rejected.'}
          </p>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-white text-xl font-black">Fundis</h1>
        <div className="flex items-center gap-2">
          <span className="bg-primary/20 text-primary text-xs font-bold px-3 py-1 rounded-pill">{filteredFundis.length} Fundis</span>
          <button onClick={openAddModal} className="flex items-center gap-2 bg-primary text-primary-text rounded-input px-4 py-2 text-sm font-bold hover:bg-amber-400 transition-colors"><RiAddLine /> Add Fundi</button>
        </div>
      </div>
      {error && <div className="bg-red-500/10 border border-danger text-danger text-sm rounded-input px-4 py-3 mb-6">{error}</div>}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search fundis" className="bg-bg-raised border border-border rounded-input px-4 py-2 text-white text-sm outline-none w-56 focus:border-primary placeholder:text-muted transition-colors duration-200" />
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="bg-bg-raised border border-border rounded-input px-4 py-2 text-white text-sm outline-none focus:border-primary cursor-pointer">
          {['All', 'Verified', 'Pending', 'Rejected'].map((item) => <option key={item}>{item}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-bg-card border border-border rounded-card p-4 shadow-card"><div className="text-success text-2xl font-black">{stats.verified}</div><div className="text-muted text-xs">Verified</div></div>
        <div className="bg-bg-card border border-border rounded-card p-4 shadow-card"><div className="text-warning text-2xl font-black">{stats.pending}</div><div className="text-muted text-xs">Pending</div></div>
        <div className="bg-bg-card border border-border rounded-card p-4 shadow-card"><div className="text-danger text-2xl font-black">{stats.rejected}</div><div className="text-muted text-xs">Rejected</div></div>
      </div>
      <DataTable columns={columns} data={filteredFundis} loading={loading} emptyMessage="No fundis found" />
      <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-bg-card rounded-b-card">
        <span className="text-muted text-sm">Showing {filteredFundis.length} records</span>
        <div className="flex gap-2"><button className="px-3 py-1.5 bg-bg-raised border border-border rounded-input text-white text-sm hover:border-primary disabled:opacity-40 transition-colors">Prev</button><button className="px-3 py-1.5 bg-bg-raised border border-border rounded-input text-white text-sm hover:border-primary disabled:opacity-40 transition-colors">Next</button></div>
      </div>
      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Fundi Profile" size="xl">
        {selected && (
          <div className="space-y-5">
            <div className="bg-gradient-to-r from-primary/20 to-bg-raised rounded-card p-5 flex items-end gap-4">
              <div className="w-20 h-20 rounded-full border-2 border-primary bg-primary/20 text-primary font-black text-2xl flex items-center justify-center">{getInitials(selected.name)}</div>
              <div>
                <h2 className="text-white text-xl font-black">{selected.name}</h2>
                <p className="text-muted text-sm">{selected.trade} · {selected.location}</p>
                <Badge label={selected.verificationStatus} type={selected.verificationStatus === 'verified' ? 'success' : selected.verificationStatus === 'rejected' ? 'danger' : 'warning'} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-bg-raised rounded-input p-4"><div className="text-white font-black">{selected.rating}</div><div className="text-muted text-xs">Rating</div></div>
              <div className="bg-bg-raised rounded-input p-4"><div className="text-white font-black">{selected.completedJobs || 0}</div><div className="text-muted text-xs">Jobs</div></div>
              <div className="bg-bg-raised rounded-input p-4"><div className="text-white font-black">{selected.experience || 0}</div><div className="text-muted text-xs">Years</div></div>
            </div>
            <div className="bg-bg-raised rounded-input p-4"><h3 className="text-white font-bold mb-2">About</h3><p className="text-muted text-sm">{selected.about || selected.bio || 'No profile description provided.'}</p></div>
            <div className="flex flex-wrap gap-2">{(selected.skills || []).map((skill) => <span key={skill} className="bg-primary/20 text-primary text-xs font-bold px-3 py-1 rounded-pill">{skill}</span>)}</div>
            {selected.verificationDocs.length > 0 && (
              <div className="bg-bg-raised rounded-input p-4">
                <h3 className="text-white font-bold mb-3">Verification Documents</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {selected.verificationDocs.map((doc, i) => {
                    const docUrl = doc.startsWith('http') ? doc : `${API_BASE}${doc}`;
                    return (
                    <a
                      key={i}
                      href={docUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block bg-bg-primary border border-border rounded-input overflow-hidden hover:border-primary transition-colors group"
                    >
                      {isImage(doc) ? (
                        <div className="relative">
                          <img src={docUrl} alt={`Document ${i + 1}`} className="w-full h-32 object-cover" />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition-colors">
                            <RiEyeLine className="text-white opacity-0 group-hover:opacity-100 text-lg transition-opacity" />
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 p-3">
                          <RiFileLine className="text-primary text-xl shrink-0" />
                          <span className="text-muted text-xs truncate">{doc.split('/').pop()}</span>
                        </div>
                      )}
                    </a>
                    )})}
                </div>
              </div>
            )}
            <VerdictSection fundi={selected} />
            {referees.length > 0 && (
              <div className="bg-bg-raised rounded-input p-4">
                <h3 className="text-white font-bold mb-3">References ({referees.length})</h3>
                <div className="space-y-2">
                  {referees.map((ref) => (
                    <div key={ref._id} className="flex items-center gap-3 bg-bg-primary border border-border rounded-input px-4 py-3">
                      <div className="w-8 h-8 rounded-full bg-primary/20 text-primary font-bold text-xs flex items-center justify-center">{(ref.name || '?')[0].toUpperCase()}</div>
                      <div className="flex-1">
                        <div className="text-white text-sm font-semibold">{ref.name}</div>
                        <div className="text-muted text-xs">{ref.relationship} · {ref.phoneNumber}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title="Add Fundi">
        <div className="space-y-4">
          {formError && <div className="bg-red-500/10 border border-danger text-danger text-sm rounded-input px-4 py-3">{formError}</div>}
          <div>
            <label className="block text-muted text-xs font-bold uppercase tracking-wider mb-2">Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" className="w-full bg-bg-raised border border-border rounded-input px-4 py-3 text-white text-sm outline-none focus:border-primary transition-colors duration-200 placeholder:text-muted" />
          </div>
          <div>
            <label className="block text-muted text-xs font-bold uppercase tracking-wider mb-2">Email</label>
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@email.com" type="email" className="w-full bg-bg-raised border border-border rounded-input px-4 py-3 text-white text-sm outline-none focus:border-primary transition-colors duration-200 placeholder:text-muted" />
          </div>
          <div>
            <label className="block text-muted text-xs font-bold uppercase tracking-wider mb-2">Phone</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="7XX XXX XXX" className="w-full bg-bg-raised border border-border rounded-input px-4 py-3 text-white text-sm outline-none focus:border-primary transition-colors duration-200 placeholder:text-muted" />
          </div>
          <button
            onClick={handleAddFundi}
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

export default FundisPage;
