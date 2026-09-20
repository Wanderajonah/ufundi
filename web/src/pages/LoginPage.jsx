import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RiLoginCircleLine } from 'react-icons/ri';
import { useAuth } from '../context/AuthContext';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/admin/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Check your credentials and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-bg-card border border-border rounded-card p-10 w-full max-w-md shadow-card">
        <div className="mb-8">
          <div className="text-primary text-3xl font-black">Ufundi</div>
          <div className="text-white text-sm">Uganda</div>
          <div className="text-muted text-xs uppercase tracking-widest mt-1">Admin Dashboard</div>
        </div>
        <a href="/" className="block mb-5 text-xs text-muted hover:text-primary transition-colors">
          &larr; Back to website
        </a>
        {error && <div className="bg-red-500/10 border border-danger text-danger text-sm rounded-input px-4 py-3 mb-5">{error}</div>}
        <label className="block text-muted text-xs font-bold uppercase tracking-wider mb-2" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          placeholder="admin@ufundi.ug"
          className="w-full bg-bg-raised border border-border rounded-input px-4 py-3 text-white text-sm outline-none focus:border-primary transition-colors duration-200 placeholder:text-muted mb-5"
        />
        <label className="block text-muted text-xs font-bold uppercase tracking-wider mb-2" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          placeholder="Enter password"
          className="w-full bg-bg-raised border border-border rounded-input px-4 py-3 text-white text-sm outline-none focus:border-primary transition-colors duration-200 placeholder:text-muted mb-6"
        />
        <button type="submit" disabled={submitting} className="w-full h-12 bg-primary text-primary-text font-black text-sm rounded-pill hover:bg-amber-400 transition-colors duration-200 flex items-center justify-center gap-2 disabled:opacity-60">
          <RiLoginCircleLine />
          <span>{submitting ? 'Signing in...' : 'Login'}</span>
        </button>
      </form>
    </div>
  );
};

export default LoginPage;
