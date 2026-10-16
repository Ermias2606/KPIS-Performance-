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

  // Interactive BSC Simulator states
  const [depositSlider, setDepositSlider] = useState(380); // Millions ETB
  const [digitalSlider, setDigitalSlider] = useState(4800); // Users
  const [loginError, setLoginError] = useState<string | null>(null);

  // Interactive June Baseline Deposit Increment Simulator states
  const [juneBaselineSlider, setJuneBaselineSlider] = useState(320); // 320M ETB baseline
  const [mobilizedIncrementSlider, setMobilizedIncrementSlider] = useState(12.5); // +12.5M ETB actual mobilized
  const targetAnnualIncrement = 14.6; // +14.6M ETB planned increment

  const currentTotalDepositBalance = parseFloat((juneBaselineSlider + mobilizedIncrementSlider).toFixed(2));
  const isUnderJuneBaseline = mobilizedIncrementSlider < 0;
  const incrementAchievementRate = Math.min(150, Math.round((Math.max(0, mobilizedIncrementSlider) / targetAnnualIncrement) * 100));

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
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50/70 to-amber-100/40 text-slate-900 flex flex-col font-sans selection:bg-orange-500 selection:text-white">
      {/* Top Utility Announcement Bar */}
      <div className="bg-slate-900 text-slate-300 text-xs py-2 px-4 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span className="inline-block w-2 h-2 rounded-full bg-orange-400" />
            <span className="font-medium text-white">Raitu Branch Performance Operating System</span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-400">Offline-First PWA • Firestore Cloud Sync • Auto-Backlog Engine</span>
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
      <header className="bg-white/80 backdrop-blur-md border-b border-orange-100 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-600 to-amber-600 flex items-center justify-center text-white font-bold text-lg shadow-md shadow-orange-200">
              R
            </div>
            <div>
              <span className="text-base font-bold text-slate-900 block leading-tight">Raitu Branch</span>
              <span className="text-xs text-orange-700 font-medium">Performance Tracker & BSC Portal</span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {user ? (
              <div className="flex items-center space-x-3">
                <span className="text-xs text-slate-600 hidden sm:inline">
                  Signed in as <strong className="text-slate-900">{user.name}</strong> ({user.positionTitle || user.role})
                </span>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="px-4 py-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-orange-500/20 transition cursor-pointer"
                >
                  Enter Dashboard &rarr;
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => navigate('/network')}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-sky-700 hover:text-sky-900 hover:bg-sky-50 rounded-xl transition cursor-pointer border border-sky-200"
                >
                  <svg className="w-3.5 h-3.5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                  </svg>
                  Branch LAN Hub
                </button>
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
                  <span>Google Sign-In</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-b from-white via-slate-50 to-slate-100 py-16 sm:py-24 border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              {/* Left Column: Brief and Headline */}
              <div className="lg:col-span-7 space-y-6">
                <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-sky-50 border border-sky-200 text-sky-800 text-xs font-semibold">
                  <span>🏛️</span>
                  <span>Raitu Branch Performance & BSC Operating System</span>
                </div>

                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-tight">
                  Commercial Banking Performance, <span className="text-sky-600">Reimagined.</span>
                </h1>

                <p className="text-base sm:text-lg text-slate-600 max-w-2xl leading-relaxed">
                  Precision performance management for Raitu Branch. Seamlessly track Annual Plans, quarterly & monthly targets, June baseline deposit mobilization, automated shortfall backlogs, and cascaded staff scorecards.
                </p>

                {loginError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium">
                    {loginError}
                  </div>
                )}

                {/* Primary Action Buttons */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    onClick={() => navigate(user ? '/dashboard' : '/login')}
                    className="px-6 py-3.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-sky-200 transition-all flex items-center space-x-2 cursor-pointer"
                  >
                    <span>{user ? 'Open Banking Dashboard' : 'Launch System with PIN'}</span>
                    <span>&rarr;</span>
                  </button>

                  <button
                    onClick={handleGoogleLogin}
                    disabled={isGoogleLoading}
                    className="px-5 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold shadow-md transition flex items-center space-x-2 cursor-pointer disabled:opacity-75"
                  >
                    <span>{isGoogleLoading ? 'Signing In...' : 'Sign In with Google'}</span>
                  </button>

                  <PWAInstallButton variant="button" />

                  <button
                    onClick={() => navigate('/network')}
                    className="px-4 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-sm font-semibold shadow-xs transition flex items-center space-x-2 cursor-pointer border border-slate-300"
                  >
                    <svg className="w-4 h-4 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                    </svg>
                    <span>Connect Branch Devices (LAN)</span>
                  </button>
                </div>

                {/* Key Metrics Summary Bar */}
                <div className="grid grid-cols-3 gap-4 pt-6 border-t border-slate-200">
                  <div>
                    <span className="block text-2xl font-black text-slate-900">4</span>
                    <span className="text-xs text-slate-500 font-medium">BSC Perspectives</span>
                  </div>
                  <div>
                    <span className="block text-2xl font-black text-slate-900">100%</span>
                    <span className="text-xs text-slate-500 font-medium">Offline Capable</span>
                  </div>
                  <div>
                    <span className="block text-2xl font-black text-sky-600">June Baseline</span>
                    <span className="text-xs text-slate-500 font-medium">Increment Tracking</span>
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
                        <span>500M (Max)</span>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                        <span>Digital Banking Users (CBEBirr / App):</span>
                        <span className="text-purple-700 font-bold">{digitalSlider} Users / 5,000 Target</span>
                      </div>
                      <input
                        type="range"
                        min="2000"
                        max="6000"
                        step="100"
                        value={digitalSlider}
                        onChange={(e) => setDigitalSlider(Number(e.target.value))}
                        className="w-full accent-purple-600 h-2 bg-slate-100 rounded-lg cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                        <span>2,000 Users</span>
                        <span>Achievement: {digitalScore}%</span>
                        <span>6,000 Users</span>
                      </div>
                    </div>
                  </div>

                  {/* Dynamic Simulation Highlights */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Financial Perspective (40%):</span>
                      <strong className="text-slate-800">{depositScore}% Achieved</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Internal Process (20%):</span>
                      <strong className="text-slate-800">{digitalScore}% Achieved</strong>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-slate-200">
                      <span className="font-semibold text-slate-700">Audit Classification:</span>
                      <strong className={`font-bold ${compositeScore >= 85 ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {compositeScore >= 85 ? 'Outstanding (Grade A)' : 'Satisfactory (Grade B)'}
                      </strong>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 text-center">
                    <button
                      onClick={() => navigate('/dashboard')}
                      className="text-xs text-sky-600 hover:text-sky-700 font-semibold inline-flex items-center space-x-1"
                    >
                      <span>Explore full interactive dashboard</span>
                      <span>&rarr;</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* NEW INTERACTIVE SECTION: JUNE BASELINE DEPOSIT MOBILIZATION SIMULATOR */}
        <section className="py-16 bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-10">
              <span className="text-xs font-bold uppercase tracking-wider text-sky-600 bg-sky-50 px-3 py-1 rounded-full border border-sky-200">
                Strategic Deposit Benchmark
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2">
                End of Previous Year (June) Closing Balance & Increment Simulator
              </h2>
              <p className="text-sm text-slate-600 mt-2">
                Evaluate true balance sheet growth by benchmarking against the audited June 30 closing balance. Dynamically simulate target increments, net deposit expansion, or under-June erosion.
              </p>
            </div>

            <div className="bg-gradient-to-br from-slate-50 via-white to-sky-50/30 rounded-2xl border border-slate-200 p-6 sm:p-8 max-w-4xl mx-auto shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                {/* Sliders */}
                <div className="space-y-5">
                  <div>
                    <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1.5">
                      <span>June Audited Closing Baseline:</span>
                      <span className="font-mono text-slate-900 font-bold">{juneBaselineSlider}M ETB</span>
                    </div>
                    <input
                      type="range"
                      min="200"
                      max="600"
                      step="10"
                      value={juneBaselineSlider}
                      onChange={(e) => setJuneBaselineSlider(Number(e.target.value))}
                      className="w-full accent-sky-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
                    />
                    <span className="text-[10px] text-slate-400">Baseline as of June 30 previous fiscal year</span>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1.5">
                      <span>Actual Net Increment Mobilized:</span>
                      <span className={`font-mono font-bold ${isUnderJuneBaseline ? 'text-red-600' : 'text-emerald-700'}`}>
                        {isUnderJuneBaseline ? '' : '+'}{mobilizedIncrementSlider}M ETB
                      </span>
                    </div>
                    <input
                      type="range"
                      min="-20"
                      max="40"
                      step="0.5"
                      value={mobilizedIncrementSlider}
                      onChange={(e) => setMobilizedIncrementSlider(Number(e.target.value))}
                      className="w-full accent-emerald-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>-20M (Erosion)</span>
                      <span>Target Increment: +{targetAnnualIncrement}M ETB</span>
                      <span>+40M (Expansion)</span>
                    </div>
                  </div>
                </div>

                {/* Live Output Card */}
                <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-md space-y-4">
                  <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Calculated Closing Balance
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      isUnderJuneBaseline ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {isUnderJuneBaseline ? 'Under June Baseline' : 'Above June Baseline'}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">June 30 Baseline Balance:</span>
                      <strong className="font-mono text-slate-800">{juneBaselineSlider}.00M ETB</strong>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Net Growth over June:</span>
                      <strong className={`font-mono ${isUnderJuneBaseline ? 'text-red-600' : 'text-emerald-600'}`}>
                        {isUnderJuneBaseline ? '' : '+'}{mobilizedIncrementSlider.toFixed(2)}M ETB
                      </strong>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Annual Target Increment:</span>
                      <strong className="font-mono text-sky-700">+{targetAnnualIncrement}M ETB</strong>
                    </div>
                    <div className="flex justify-between text-base pt-2 border-t border-slate-100 font-bold">
                      <span className="text-slate-900">Total Current Deposit:</span>
                      <span className="font-mono text-slate-900">{currentTotalDepositBalance}M ETB</span>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600">
                    Target Increment Achievement: <strong className="text-slate-900">{incrementAchievementRate}%</strong>
                    <div className="w-full bg-slate-200 h-2 rounded-full mt-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${isUnderJuneBaseline ? 'bg-red-500' : 'bg-emerald-500'}`}
                        style={{ width: `${Math.min(100, Math.max(0, incrementAchievementRate))}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION: 4 BSC PERSPECTIVES */}
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

        {/* Section: Features Highlights */}
        <section className="py-16 bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-lg">
                  ⚡
                </div>
                <h3 className="text-sm font-bold text-slate-900">Offline PWA</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Engineered with IndexedDB caching and Workbox service worker precaching. Works uninterrupted without internet connection.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-lg">
                  ☁️
                </div>
                <h3 className="text-sm font-bold text-slate-900">Firestore Cloud Sync</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Automatic bidirectional cloud sync between local branch storage and Google Cloud Firestore database.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-lg">
                  🎯
                </div>
                <h3 className="text-sm font-bold text-slate-900">Auto-Backlog Engine</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Scans period variations (Plan minus Actual). Alerts administrators of shortfalls and generates one-click recovery tasks.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-lg">
                  🏢
                </div>
                <h3 className="text-sm font-bold text-slate-900">Branch & Fiscal Cycles</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Create branches, configure custom Ethiopian / Gregorian fiscal years, and track previous June closing balance baselines.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-sky-50/70 border border-sky-200 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                  🌐
                </div>
                <h3 className="text-sm font-bold text-slate-900">Branch LAN & Devices</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Connect multiple tellers, managers, and mobile staff over branch LAN/Wi-Fi with instant QR code pairing and live peer sync.
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
            <span className="text-slate-500">Balanced Scorecard & Performance Management System · Offline-First PWA</span>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/login')}
              className="text-slate-300 hover:text-white transition"
            >
              Sign In
            </button>
            <span className="text-slate-600">·</span>
            <button
              onClick={() => navigate('/dashboard')}
              className="text-slate-300 hover:text-white transition"
            >
              Dashboard
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
