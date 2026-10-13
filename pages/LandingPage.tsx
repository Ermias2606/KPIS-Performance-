import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PWAInstallButton } from '../components/pwa/PWAInstallButton';
import { PerspectiveCategory } from '../types';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, loginWithGoogle, isGoogleLoading, isOnline } = useAuth();
  const [activePerspective, setActivePerspective] = useState<PerspectiveCategory>(
    PerspectiveCategory.FINANCIAL
  );
  const [depositSlider, setDepositSlider] = useState(380); // Millions ETB
  const [digitalSlider, setDigitalSlider] = useState(4800); // Users
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setLoginError(null);
    try {
      const loggedUser = await loginWithGoogle();
      if (loggedUser) {
        navigate('/dashboard');
      }
    } catch (err: any) {
      console.error(err);
      setLoginError(err.message || 'Google Sign-In was cancelled or failed.');
    }
  };

  // Interactive calculated score based on sliders
  const depositScore = Math.min(100, Math.round((depositSlider / 450) * 100));
  const digitalScore = Math.min(100, Math.round((digitalSlider / 5000) * 100));
  const compositeScore = Math.round((depositScore * 0.6 + digitalScore * 0.4) * 0.92);

  const perspectiveInfo = {
    [PerspectiveCategory.FINANCIAL]: {
      title: 'Financial Perspective',
      weight: '40%',
      kpis: [
        { name: 'Total Branch Deposit Mobilization', target: '450M ETB', actual: `${depositSlider}M ETB`, achievement: `${depositScore}%` },
        { name: 'Foreign Currency & Remittance', target: '$1.2M USD', actual: '$1.08M USD', achievement: '90%' },
        { name: 'Branch Non-Interest Revenue', target: '18M ETB', actual: '16.5M ETB', achievement: '91.6%' },
      ],
      description: 'Drives sustainable balance sheet growth, low-cost deposit mobilization, and FX trade liquidity.',
    },
    [PerspectiveCategory.CUSTOMER]: {
      title: 'Customer Perspective',
      weight: '25%',
      kpis: [
        { name: 'Active Customer Base Growth', target: '24,000 Accounts', actual: '22,850 Accounts', achievement: '95.2%' },
        { name: 'High-Value Account Acquisition', target: '350 Accounts', actual: '315 Accounts', achievement: '90%' },
        { name: 'Customer Retention & CSAT', target: '92% Satisfaction', actual: '89.4%', achievement: '97.2%' },
      ],
      description: 'Strengthens customer stickiness, relationship banking, and net new customer acquisition.',
    },
    [PerspectiveCategory.INTERNAL_PROCESS]: {
      title: 'Internal Business Process',
      weight: '20%',
      kpis: [
        { name: 'Mobile Banking (CBEBirr / App)', target: '5,000 Users', actual: `${digitalSlider} Users`, achievement: `${digitalScore}%` },
        { name: 'ATM / Debit Card Issuance', target: '3,200 Cards', actual: '3,100 Cards', achievement: '96.8%' },
        { name: 'Account Opening Turnaround Time', target: '< 8 Minutes', actual: '6.5 Min', achievement: '100%' },
      ],
      description: 'Streamlines branch operational efficiency, digital channel migration, and service turnaround times.',
    },
    [PerspectiveCategory.LEARNING_GROWTH]: {
      title: 'Learning & Growth Perspective',
      weight: '15%',
      kpis: [
        { name: 'Staff Performance Accountability', target: '100% Assigned', actual: '100%', achievement: '100%' },
        { name: 'Digital Tools & Compliance Mastery', target: '40 Hours/Staff', actual: '38 Hours', achievement: '95%' },
        { name: 'Cross-selling Capability Index', target: '85 Index Score', actual: '81.2', achievement: '95.5%' },
      ],
      description: 'Empowers branch team members with skill development, motivation, and clear accountability.',
    },
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-sky-500 selection:text-white">
      {/* Top Utility Announcement Bar */}
      <div className="bg-slate-900 text-slate-300 text-xs py-2 px-4 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
            <span className="font-medium text-white">Raitu Branch Performance Operating System</span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-400">Offline-First PWA with Firestore Cloud Sync</span>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1.5">
              <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              <span className="text-slate-300 text-[11px]">{isOnline ? 'Firestore Online' : 'IndexedDB Offline'}</span>
            </div>
            <PWAInstallButton variant="compact" />
          </div>
        </div>
      </div>

      {/* Navigation Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-10 h-10 rounded-xl bg-sky-600 flex items-center justify-center text-white font-bold text-lg shadow-md shadow-sky-100">
              R
            </div>
            <div>
              <span className="text-base font-bold text-slate-900 block leading-tight">Raitu Branch</span>
              <span className="text-xs text-slate-500 font-medium">Performance Tracker & BSC</span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {user ? (
              <div className="flex items-center space-x-3">
                <span className="text-xs text-slate-600 hidden sm:inline">
                  Signed in as <strong className="text-slate-900">{user.name}</strong> ({user.role})
                </span>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
                >
                  Enter Dashboard &rarr;
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => navigate('/login')}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition"
                >
                  Staff PIN Login
                </button>
                <button
                  onClick={handleGoogleLogin}
                  disabled={isGoogleLoading}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition flex items-center space-x-2 disabled:opacity-75"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>{isGoogleLoading ? 'Connecting...' : 'Google Sign-In'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative overflow-hidden pt-12 pb-16 lg:pt-20 lg:pb-24 border-b border-slate-200 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              {/* Left Column: Vision & CTA */}
              <div className="lg:col-span-7 space-y-6">
                <div className="inline-flex items-center space-x-2 text-xs font-semibold text-sky-800 bg-sky-50 px-3 py-1 rounded-md border border-sky-200">
                  <span>Fiscal Year 2026 Strategic Execution</span>
                  <span>·</span>
                  <span>Balanced Scorecard</span>
                </div>

                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
                  High-Precision Branch Banking & Employee Performance.
                </h1>

                <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl">
                  Empowering <strong>Raitu Branch</strong> leadership and staff to map annual strategic objectives,
                  monitor monthly targets, clear backlog arrears, and dynamically evaluate BSC performance —
                  seamlessly offline with continuous Firestore cloud synchronization.
                </p>

                {loginError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
                    {loginError}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    onClick={handleGoogleLogin}
                    disabled={isGoogleLoading}
                    className="px-6 py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-sky-200 transition flex items-center space-x-2"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#fff"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#fff"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#fff"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#fff"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>{isGoogleLoading ? 'Signing In...' : 'Sign In with Google'}</span>
                  </button>

                  <button
                    onClick={() => navigate('/login')}
                    className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-sm font-semibold transition"
                  >
                    Quick PIN Access
                  </button>

                  <PWAInstallButton variant="button" />
                </div>

                {/* Key Metrics Summary Bar */}
                <div className="grid grid-cols-3 gap-4 pt-6 border-t border-slate-100">
                  <div>
                    <span className="block text-2xl font-black text-slate-900">4</span>
                    <span className="text-xs text-slate-500 font-medium">BSC Perspectives</span>
                  </div>
                  <div>
                    <span className="block text-2xl font-black text-slate-900">100%</span>
                    <span className="text-xs text-slate-500 font-medium">Offline Capable</span>
                  </div>
                  <div>
                    <span className="block text-2xl font-black text-sky-600">Firestore</span>
                    <span className="text-xs text-slate-500 font-medium">Real-Time Cloud DB</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Interactive Live Scorecard Simulator Card */}
              <div className="lg:col-span-5">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-6 relative overflow-hidden">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-sky-600">
                        Interactive Live Preview
                      </span>
                      <h3 className="text-lg font-bold text-slate-900">Branch BSC Simulator</h3>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-black text-sky-600">{compositeScore}%</span>
                      <span className="block text-[10px] text-slate-400 font-medium">Overall Index</span>
                    </div>
                  </div>

                  {/* Interactive Sliders */}
                  <div className="py-4 space-y-4">
                    <div>
                      <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                        <span>Deposit Mobilization:</span>
                        <span className="text-sky-700 font-bold">{depositSlider}M ETB / 450M Target</span>
                      </div>
                      <input
                        type="range"
                        min="200"
                        max="500"
                        value={depositSlider}
                        onChange={(e) => setDepositSlider(Number(e.target.value))}
                        className="w-full accent-sky-600 h-2 bg-slate-100 rounded-lg cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                        <span>200M (Base)</span>
                        <span>Achievement: {depositScore}%</span>
                        <span>500M (Stretch)</span>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                        <span>Mobile Banking Users:</span>
                        <span className="text-indigo-700 font-bold">{digitalSlider} / 5,000 Target</span>
                      </div>
                      <input
                        type="range"
                        min="2000"
                        max="6000"
                        value={digitalSlider}
                        onChange={(e) => setDigitalSlider(Number(e.target.value))}
                        className="w-full accent-indigo-600 h-2 bg-slate-100 rounded-lg cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                        <span>2,000 Users</span>
                        <span>Achievement: {digitalScore}%</span>
                        <span>6,000 Users</span>
                      </div>
                    </div>
                  </div>

                  {/* Live Mini Scorecard Breakdown */}
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-slate-700">
                      <span className="font-medium">Financial Perspective (40% Weight)</span>
                      <span className="font-bold text-slate-900">{depositScore}% Achieved</span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-sky-600 h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, depositScore)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-slate-700 pt-1">
                      <span className="font-medium">Internal Business Process (20% Weight)</span>
                      <span className="font-bold text-slate-900">{digitalScore}% Achieved</span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, digitalScore)}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span>Synchronized with IndexedDB & Firestore</span>
                    <button
                      onClick={() => navigate('/login')}
                      className="font-semibold text-sky-600 hover:text-sky-700"
                    >
                      Login to Save &rarr;
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section: Balanced Scorecard 4 Perspectives Explorer */}
        <section className="py-16 bg-slate-50 border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-10">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                Balanced Scorecard (BSC) Core Architecture
              </h2>
              <p className="text-sm text-slate-600 mt-2">
                Structured across the four classical banking dimensions with transparent weights and cascaded staff objectives.
              </p>
            </div>

            {/* Interactive Perspective Selector Tabs */}
            <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
              {Object.values(PerspectiveCategory).map((p) => {
                const isActive = activePerspective === p;
                return (
                  <button
                    key={p}
                    onClick={() => setActivePerspective(p)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-sky-600 text-white shadow-md shadow-sky-200'
                        : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>

            {/* Active Perspective Showcase Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 max-w-4xl mx-auto">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-100">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">
                    {perspectiveInfo[activePerspective].title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {perspectiveInfo[activePerspective].description}
                  </p>
                </div>
                <div className="bg-sky-50 text-sky-800 font-extrabold text-sm px-3.5 py-1.5 rounded-xl border border-sky-200">
                  Weight: {perspectiveInfo[activePerspective].weight}
                </div>
              </div>

              {/* Sample KPIs Table */}
              <div className="mt-6 space-y-4">
                {perspectiveInfo[activePerspective].kpis.map((kpi, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition"
                  >
                    <div className="space-y-1">
                      <span className="font-semibold text-sm text-slate-900 block">{kpi.name}</span>
                      <span className="text-xs text-slate-500">
                        Annual Target: <strong className="text-slate-700">{kpi.target}</strong> · Actual:{' '}
                        <strong className="text-slate-700">{kpi.actual}</strong>
                      </span>
                    </div>
                    <div className="mt-2 sm:mt-0 flex items-center space-x-3">
                      <span className="text-sm font-bold text-emerald-600">{kpi.achievement}</span>
                      <span className="text-xs text-slate-400">Score</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Section: Offline PWA & Cloud Synchronization */}
        <section className="py-16 bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
                  ⚡
                </div>
                <h3 className="text-base font-bold text-slate-900">Zero Interruption Offline Mode</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Engineered with IndexedDB caching and Service Worker precaching. Staff can enter daily numbers and
                  evaluate scores even in remote or offline branch conditions.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  ☁️
                </div>
                <h3 className="text-base font-bold text-slate-900">Firestore Cloud Sync</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Automatic bidirectional sync between local branch storage and Google Cloud Firestore. Changes sync
                  seamlessly when connectivity is detected.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  🛡️
                </div>
                <h3 className="text-base font-bold text-slate-900">Google Auth & Multi-Role RBAC</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Secure identification using Firebase Google Sign-In and role-based permissions (Branch Admin, Manager,
                  and Staff) with individual scorecards.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-10 border-t border-slate-800 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <span className="text-white font-bold text-sm block">Raitu Branch Performance Tracker</span>
            <span className="text-slate-500">Commercial Bank Performance Management System · FY 2026</span>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/login')}
              className="text-slate-300 hover:text-white transition"
            >
              Sign In
            </button>
            <span className="text-slate-600">·</span>
            <PWAInstallButton variant="compact" />
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
