import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md rounded-2xl bg-slate-900/70 p-8 shadow-xl">
        <h1 className="text-3xl font-semibold">Welcome back</h1>
        <p className="text-sm text-slate-400">Sign in to continue collaborating</p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-sm text-slate-300">Email</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-slate-100 focus:border-primary focus:outline-none"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={form.email}
              onChange={handleChange}
            />
          </div>
          <div>
            <label className="text-sm text-slate-300">Password</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-slate-100 focus:border-primary focus:outline-none"
              name="password"
              type="password"
              required
              value={form.password}
              onChange={handleChange}
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-primary px-4 py-2 font-medium text-white transition hover:bg-primary/80 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? 'Signing in…' : 'Login'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-400">
          No account?{' '}
          <Link to="/register" className="text-primary underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;

