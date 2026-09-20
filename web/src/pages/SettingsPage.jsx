import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getSettings, updateSettings } from '../services/api';
import { toastMessage } from '../utils/format';

const inputClass =
  'w-full bg-bg-raised border border-border rounded-input px-4 py-3 text-white text-sm outline-none focus:border-primary transition-colors duration-200 placeholder:text-muted';

const field = (label, value, onChange, suffix) => (
  <div>
    <label className="block text-muted text-xs font-bold uppercase tracking-wider mb-2">
      {label}
    </label>
    <div className="flex items-center gap-2">
      <input
        value={value}
        onChange={onChange}
        type="number"
        min="0"
        step="any"
        className={inputClass}
      />
      {suffix ? <span className="text-muted text-xs font-bold whitespace-nowrap">{suffix}</span> : null}
    </div>
  </div>
);

const SettingsPage = () => {
  const { admin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clientFeeRate, setClientFeeRate] = useState('');
  const [commissionRate, setCommissionRate] = useState('');
  const [minJobAmount, setMinJobAmount] = useState('');
  const [serviceRadius, setServiceRadius] = useState('');

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getSettings();
      const s = res.data || {};
      setClientFeeRate(s.clientFeeRate ?? '');
      setCommissionRate(s.commissionRate ?? '');
      setMinJobAmount(s.minJobAmount ?? '');
      setServiceRadius(s.serviceRadius ?? '');
    } catch {
      toastMessage('Unable to load platform settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings({
        clientFeeRate: Number(clientFeeRate),
        commissionRate: Number(commissionRate),
        minJobAmount: Number(minJobAmount),
        serviceRadius: Number(serviceRadius),
      });
      toastMessage('Platform pricing updated.');
    } catch (err) {
      toastMessage(err.response?.data?.message || 'Unable to save settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-white text-xl font-black">Settings</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-bg-card border border-border rounded-card p-5 shadow-card">
          <h2 className="text-white font-bold text-base mb-4">Admin Profile</h2>
          <div className="space-y-4">
            <div><label className="block text-muted text-xs font-bold uppercase tracking-wider mb-2">Name</label><input value={admin?.name || 'Admin User'} readOnly className="w-full bg-bg-raised border border-border rounded-input px-4 py-3 text-white text-sm outline-none focus:border-primary transition-colors duration-200 placeholder:text-muted" /></div>
            <div><label className="block text-muted text-xs font-bold uppercase tracking-wider mb-2">Email</label><input value={admin?.email || 'admin@ufundi.ug'} readOnly className="w-full bg-bg-raised border border-border rounded-input px-4 py-3 text-white text-sm outline-none focus:border-primary transition-colors duration-200 placeholder:text-muted" /></div>
          </div>
        </div>
        <div className="bg-bg-card border border-border rounded-card p-5 shadow-card">
          <h2 className="text-white font-bold text-base mb-4">Platform Controls</h2>
          <div className="space-y-3">
            {['Manual fundi verification', 'Escrow release approval', 'Booking status notifications'].map((item) => <label key={item} className="flex items-center justify-between bg-bg-raised rounded-input p-3 text-white text-sm"><span>{item}</span><input type="checkbox" defaultChecked className="accent-primary" /></label>)}
          </div>
        </div>
      </div>

      <div className="bg-bg-card border border-border rounded-card p-5 shadow-card">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-white font-bold text-base">Platform Pricing</h2>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="bg-primary text-bg-card font-bold text-sm px-4 py-2 rounded-input disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Pricing'}
          </button>
        </div>
        <p className="text-muted text-xs mb-4">
          The client pays the service price plus a client platform fee. The fundi earns the service price
          minus the commission. Both amounts are set below.
        </p>
        {loading ? (
          <p className="text-muted text-sm py-6 text-center">Loading settings…</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {field('Client platform fee', clientFeeRate, (e) => setClientFeeRate(e.target.value), '%')}
            {field('Fundi commission', commissionRate, (e) => setCommissionRate(e.target.value), '%')}
            {field('Minimum job amount', minJobAmount, (e) => setMinJobAmount(e.target.value), 'UGX')}
            {field('Service radius', serviceRadius, (e) => setServiceRadius(e.target.value), 'km')}
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;
