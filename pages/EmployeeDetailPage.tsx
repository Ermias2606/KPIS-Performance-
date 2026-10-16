import React, { useState, useEffect, useMemo, useContext } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { AuthContext } from '../context/AuthContext';
import { Employee, PerspectiveCategory, CalculatedKpi, Role, Kpi } from '../types';
import Card from '../components/ui/Card';

interface SocialPost {
  id: string;
  authorId: number;
  authorName: string;
  authorAvatar: string;
  title?: string;
  content: string;
  imageUrl?: string;
  type: 'article' | 'image' | 'update';
  timestamp: string;
  likes: number;
  likedBy: number[];
  comments: {
    id: string;
    authorId: number;
    authorName: string;
    text: string;
    timestamp: string;
  }[];
}

interface SocialNotification {
  id: string;
  employeeId: number; // recipient
  message: string;
  timestamp: string;
  read: boolean;
}

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
];

export const EmployeeDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useContext(AuthContext);
  const { employees, getEmployeeKpis, annualPlan, loading, branches } = useData();
  const [employee, setEmployee] = useState<Employee | null>(null);

  const [activeProfileTab, setActiveProfileTab] = useState<'scorecard' | 'social' | 'notifications'>('scorecard');

  // Bio state
  const [bio, setBio] = useState<string>('');
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [tempBio, setTempBio] = useState('');

  // Avatar selector dropdown state
  const [selectedAvatar, setSelectedAvatar] = useState<string>(PRESET_AVATARS[0]);
  const [showAvatarDropdown, setShowAvatarDropdown] = useState(false);

  // Social Posts state
  const [posts, setPosts] = useState<SocialPost[]>(() => {
    try {
      const saved = localStorage.getItem('raitu_social_posts');
      return saved ? JSON.parse(saved) : [
        {
          id: 'post-1',
          authorId: 2,
          authorName: 'Ermiyas Getachew',
          authorAvatar: PRESET_AVATARS[0],
          title: 'Q3 Branch Deposit Mobilization Strategy & Agricultural Co-ops',
          content: 'We successfully onboarded 12 new agricultural cooperative unions in West Hararghe, mobilizing over 14.5M ETB in low-cost savings accounts. Special thanks to the team spirit and rigorous field follow-ups!',
          imageUrl: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=800&auto=format&fit=crop&q=80',
          type: 'article',
          timestamp: '2026-10-15 14:30',
          likes: 8,
          likedBy: [1, 3],
          comments: [
            { id: 'c-1', authorId: 1, authorName: 'Admin HQ', text: 'Outstanding achievement Ermiyas! Keep up the momentum.', timestamp: '2026-10-15 15:00' }
          ]
        }
      ];
    } catch {
      return [];
    }
  });

  // Notifications state
  const [notifications, setNotifications] = useState<SocialNotification[]>(() => {
    try {
      const saved = localStorage.getItem('raitu_social_notifications');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // New Post form state
  const [newPostType, setNewPostType] = useState<'article' | 'image' | 'update'>('article');
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostImageUrl, setNewPostImageUrl] = useState('');
  const [newCommentTexts, setNewCommentTexts] = useState<{ [postId: string]: string }>({});

  useEffect(() => {
    if (id) {
      const foundEmployee = employees.find(e => e.id === parseInt(id, 10));
      setEmployee(foundEmployee || null);

      if (foundEmployee) {
        // Load bio and avatar from localStorage
        const savedBio = localStorage.getItem(`raitu_employee_bio_${foundEmployee.id}`);
        if (savedBio !== null) {
          setBio(savedBio);
          setTempBio(savedBio);
        } else {
          const defaultBio = `${foundEmployee.positionTitle || foundEmployee.role} at Raitu Branch. Passionate about commercial banking excellence, deposit mobilization, and customer service delivery.`;
          setBio(defaultBio);
          setTempBio(defaultBio);
        }

        const savedAvatar = localStorage.getItem(`raitu_employee_avatar_${foundEmployee.id}`);
        if (savedAvatar) {
          setSelectedAvatar(savedAvatar);
        } else {
          setSelectedAvatar(PRESET_AVATARS[foundEmployee.id % PRESET_AVATARS.length]);
        }
      }
    }
  }, [id, employees]);

  const employeeKpis = useMemo(() => {
    return employee ? getEmployeeKpis(employee.id) : [];
  }, [employee, getEmployeeKpis]);

  const totalScore = useMemo(() => {
    return employeeKpis.reduce((sum, kpi) => sum + kpi.score, 0);
  }, [employeeKpis]);

  const branchName = branches.find(b => b.id === employee?.branchId)?.name || 'Raitu Branch';
  const isAdmin = currentUser?.role === Role.ADMIN;
  const isOwner = currentUser?.id === employee?.id;

  const saveBio = () => {
    if (!employee) return;
    setBio(tempBio);
    localStorage.setItem(`raitu_employee_bio_${employee.id}`, tempBio);
    setIsEditingBio(false);
  };

  const changeAvatar = (url: string) => {
    if (!employee) return;
    setSelectedAvatar(url);
    localStorage.setItem(`raitu_employee_avatar_${employee.id}`, url);
    setShowAvatarDropdown(false);
  };

  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee || !newPostContent.trim()) return;

    const post: SocialPost = {
      id: 'post-' + Date.now(),
      authorId: employee.id,
      authorName: employee.name,
      authorAvatar: selectedAvatar,
      title: newPostType === 'article' ? newPostTitle.trim() : undefined,
      content: newPostContent.trim(),
      imageUrl: newPostType === 'image' || newPostType === 'article' ? newPostImageUrl.trim() || undefined : undefined,
      type: newPostType,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      likes: 0,
      likedBy: [],
      comments: [],
    };

    const updated = [post, ...posts];
    setPosts(updated);
    localStorage.setItem('raitu_social_posts', JSON.stringify(updated));

    setNewPostTitle('');
    setNewPostContent('');
    setNewPostImageUrl('');
  };

  const handleLikePost = (postId: string) => {
    if (!employee) return;
    const updated = posts.map(p => {
      if (p.id === postId) {
        const hasLiked = p.likedBy.includes(employee.id);
        const newLikedBy = hasLiked ? p.likedBy.filter(id => id !== employee.id) : [...p.likedBy, employee.id];
        const newLikes = hasLiked ? p.likes - 1 : p.likes + 1;

        if (!hasLiked && p.authorId !== employee.id) {
          // Notify author
          const notif: SocialNotification = {
            id: 'notif-' + Date.now(),
            employeeId: p.authorId,
            message: `${employee.name} liked your post "${p.title || p.content.substring(0, 25)}..."`,
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
            read: false,
          };
          const newNotifs = [notif, ...notifications];
          setNotifications(newNotifs);
          localStorage.setItem('raitu_social_notifications', JSON.stringify(newNotifs));
        }

        return { ...p, likes: newLikes, likedBy: newLikedBy };
      }
      return p;
    });

    setPosts(updated);
    localStorage.setItem('raitu_social_posts', JSON.stringify(updated));
  };

  const handleAddComment = (postId: string) => {
    const text = newCommentTexts[postId];
    if (!employee || !text || !text.trim()) return;

    const comment = {
      id: 'c-' + Date.now(),
      authorId: employee.id,
      authorName: employee.name,
      text: text.trim(),
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
    };

    const updated = posts.map(p => {
      if (p.id === postId) {
        if (p.authorId !== employee.id) {
          const notif: SocialNotification = {
            id: 'notif-' + Date.now(),
            employeeId: p.authorId,
            message: `${employee.name} commented on your post: "${text.trim()}"`,
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
            read: false,
          };
          const newNotifs = [notif, ...notifications];
          setNotifications(newNotifs);
          localStorage.setItem('raitu_social_notifications', JSON.stringify(newNotifs));
        }

        return { ...p, comments: [...p.comments, comment] };
      }
      return p;
    });

    setPosts(updated);
    localStorage.setItem('raitu_social_posts', JSON.stringify(updated));
    setNewCommentTexts({ ...newCommentTexts, [postId]: '' });
  };

  const myNotifications = useMemo(() => {
    if (!employee) return [];
    return notifications.filter(n => n.employeeId === employee.id);
  }, [notifications, employee]);

  const unreadNotifCount = myNotifications.filter(n => !n.read).length;

  const markNotificationsRead = () => {
    if (!employee) return;
    const updated = notifications.map(n => n.employeeId === employee.id ? { ...n, read: true } : n);
    setNotifications(updated);
    localStorage.setItem('raitu_social_notifications', JSON.stringify(updated));
  };

  const perspectiveOrder: PerspectiveCategory[] = [
    PerspectiveCategory.FINANCIAL,
    PerspectiveCategory.CUSTOMER,
    PerspectiveCategory.INTERNAL_PROCESS,
    PerspectiveCategory.LEARNING_GROWTH,
  ];

  const kpisByPerspective = useMemo(() => {
    const map: { [key: string]: CalculatedKpi[] } = {};
    perspectiveOrder.forEach(p => {
      map[p] = employeeKpis.filter(k => k.perspective === p);
    });
    return map;
  }, [employeeKpis, perspectiveOrder]);

  const canUpdateActual = isAdmin || isOwner;
  const deleteKpi = async (id: number) => {
    // optional handler
  };


  if (loading || !employee) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-xl font-semibold text-slate-600">Loading Employee Profile...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Employee Profile Header Card */}
      <Card className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <svg className="w-64 h-64 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
          </svg>
        </div>

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center space-x-5">
            {/* Avatar & Dropdown Selector */}
            <div className="relative">
              <img
                src={selectedAvatar}
                alt={employee.name}
                className="w-24 h-24 rounded-2xl object-cover border-4 border-white/20 shadow-xl"
              />
              {(isOwner || isAdmin) && (
                <button
                  onClick={() => setShowAvatarDropdown(!showAvatarDropdown)}
                  className="absolute -bottom-2 -right-2 bg-sky-600 hover:bg-sky-500 text-white text-[10px] font-bold px-2 py-1 rounded-lg shadow-md cursor-pointer"
                >
                  Change Photo
                </button>
              )}

              {/* Avatar Selector Dropdown */}
              {showAvatarDropdown && (
                <div className="absolute left-0 top-28 bg-white text-slate-800 p-3 rounded-2xl shadow-2xl border border-slate-200 z-30 w-64 space-y-2">
                  <p className="text-xs font-bold text-slate-700">Choose Profile Preset:</p>
                  <div className="grid grid-cols-5 gap-2">
                    {PRESET_AVATARS.map((url, idx) => (
                      <img
                        key={idx}
                        src={url}
                        alt="Preset"
                        onClick={() => changeAvatar(url)}
                        className="w-10 h-10 rounded-xl object-cover cursor-pointer hover:opacity-80 border-2 border-transparent hover:border-sky-500"
                      />
                    ))}
                  </div>
                  <input
                    type="text"
                    placeholder="Or paste image URL..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        changeAvatar((e.target as HTMLInputElement).value);
                      }
                    }}
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg outline-none"
                  />
                </div>
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-center space-x-3">
                <h1 className="text-2xl font-black">{employee.name}</h1>
                <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-sky-500/20 text-sky-300 border border-sky-400/30">
                  {employee.role}
                </span>
              </div>
              <p className="text-sm text-slate-300 font-medium">{employee.positionTitle || 'Staff Member'} • {branchName}</p>
              <div className="flex items-center space-x-4 text-xs text-slate-400 pt-1">
                <span>PIN: ••••</span>
                <span>•</span>
                <span>ID: #{employee.id}</span>
              </div>
            </div>
          </div>

          {/* Employee Directory Switcher */}
          <div className="flex items-center space-x-3">
            {(isOwner || isAdmin) && (
              <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/10 text-right">
                <p className="text-[11px] text-slate-400 font-semibold uppercase">Overall BSC Score</p>
                <p className="text-2xl font-black text-emerald-400">{totalScore.toFixed(2)}%</p>
              </div>
            )}

            <div>
              <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Visit Other Employee</label>
              <select
                onChange={(e) => {
                  if (e.target.value) navigate(`/employees/${e.target.value}`);
                }}
                defaultValue={employee.id}
                className="bg-slate-800 text-white text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-700 outline-none cursor-pointer"
              >
                {employees.filter(e => e.role !== Role.ADMIN).map(emp => (
                  <option key={emp.id} value={emp.id}>Visit {emp.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Bio Section */}
        <div className="mt-6 pt-4 border-t border-white/10">
          <div className="flex justify-between items-start gap-4">
            <div className="flex-1">
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Professional Bio</p>
              {isEditingBio ? (
                <div className="space-y-2 mt-2">
                  <textarea
                    rows={2}
                    value={tempBio}
                    onChange={(e) => setTempBio(e.target.value)}
                    className="w-full p-2.5 text-xs text-slate-900 bg-white rounded-xl outline-none"
                  />
                  <div className="flex space-x-2">
                    <button onClick={saveBio} className="px-3 py-1 bg-sky-600 text-white text-xs font-bold rounded-lg cursor-pointer">Save Bio</button>
                    <button onClick={() => setIsEditingBio(false)} className="px-3 py-1 bg-slate-700 text-slate-300 text-xs font-bold rounded-lg cursor-pointer">Cancel</button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-200 leading-relaxed italic">"{bio}"</p>
              )}
            </div>

            {(isOwner || isAdmin) && !isEditingBio && (
              <button
                onClick={() => setIsEditingBio(true)}
                className="text-xs font-semibold text-sky-400 hover:text-sky-300 underline cursor-pointer shrink-0"
              >
                Edit Bio
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Profile Navigation Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-2 overflow-x-auto">
        {(isOwner || isAdmin) && (
          <button
            onClick={() => setActiveProfileTab('scorecard')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
              activeProfileTab === 'scorecard' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Balanced Scorecard & KPIs ({employeeKpis.length})
          </button>
        )}
        <button
          onClick={() => setActiveProfileTab('social')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
            activeProfileTab === 'social' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Posts, Articles & Social Feed ({posts.filter(p => p.authorId === employee.id).length})
        </button>
        <button
          onClick={() => {
            setActiveProfileTab('notifications');
            markNotificationsRead();
          }}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition relative ${
            activeProfileTab === 'notifications' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Notifications
          {unreadNotifCount > 0 && (
            <span className="ml-1.5 px-1.5 py-0.2 bg-red-500 text-white text-[10px] font-bold rounded-full">
              {unreadNotifCount}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: SCORECARD */}
      {activeProfileTab === 'scorecard' && (isOwner || isAdmin) && (
        <div className="space-y-6">
          {perspectiveOrder.map(perspective => {
            const perspectiveKpis = kpisByPerspective[perspective] || [];
            if (perspectiveKpis.length === 0) return null;

            return (
              <Card key={perspective}>
                <div className="flex items-center space-x-3 mb-4 pb-2 border-b border-slate-100">
                  <PerspectiveIcon category={perspective} />
                  <h3 className="text-base font-bold text-slate-800">{perspective} Perspective</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {perspectiveKpis.map(kpi => (
                    <KpiCard
                      key={kpi.id}
                      kpi={kpi}
                      isAdmin={isAdmin}
                      canUpdateActual={canUpdateActual}
                      onDelete={isAdmin ? deleteKpi : undefined}
                    />
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* TAB 2: SOCIAL FEED, ARTICLES & POSTS */}
      {activeProfileTab === 'social' && (
        <div className="space-y-6">
          {/* Create Post / Article Box */}
          <Card className="border-sky-200">
            <h3 className="text-sm font-bold text-slate-900 mb-3">Share an Article, Image, or Update with Branch Team</h3>
            <form onSubmit={handleCreatePost} className="space-y-3">
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setNewPostType('article')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${newPostType === 'article' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-700'}`}
                >
                  Article / Blog
                </button>
                <button
                  type="button"
                  onClick={() => setNewPostType('image')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${newPostType === 'image' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-700'}`}
                >
                  Photo / Image Post
                </button>
                <button
                  type="button"
                  onClick={() => setNewPostType('update')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${newPostType === 'update' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-700'}`}
                >
                  Quick Update
                </button>
              </div>

              {newPostType === 'article' && (
                <input
                  type="text"
                  placeholder="Article Title..."
                  value={newPostTitle}
                  onChange={(e) => setNewPostTitle(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl outline-none font-semibold"
                />
              )}

              {(newPostType === 'article' || newPostType === 'image') && (
                <input
                  type="text"
                  placeholder="Image URL (optional)..."
                  value={newPostImageUrl}
                  onChange={(e) => setNewPostImageUrl(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl outline-none font-mono"
                />
              )}

              <textarea
                rows={3}
                placeholder="What's on your mind regarding branch performance, co-op mobilization, or client success?"
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                className="w-full text-xs p-3 border border-slate-300 rounded-xl outline-none"
              />

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!newPostContent.trim()}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
                >
                  Publish Post
                </button>
              </div>
            </form>
          </Card>

          {/* Social Feed List */}
          <div className="space-y-5">
            {posts.map(post => {
              const hasLiked = post.likedBy.includes(employee.id);
              return (
                <Card key={post.id} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div
                      onClick={() => navigate(`/employees/${post.authorId}`)}
                      className="flex items-center space-x-3 cursor-pointer group"
                    >
                      <img src={post.authorAvatar} alt={post.authorName} className="w-10 h-10 rounded-full object-cover" />
                      <div>
                        <h4 className="font-bold text-slate-900 group-hover:text-sky-600 text-sm">{post.authorName}</h4>
                        <p className="text-[10px] text-slate-400">{post.timestamp}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-slate-100 text-slate-600">
                      {post.type}
                    </span>
                  </div>

                  {post.title && <h3 className="text-base font-bold text-slate-900">{post.title}</h3>}
                  <p className="text-sm text-slate-700 leading-relaxed">{post.content}</p>

                  {post.imageUrl && (
                    <img src={post.imageUrl} alt="Post media" className="w-full h-64 object-cover rounded-xl border border-slate-200" />
                  )}

                  {/* Likes & Comments Action Bar */}
                  <div className="pt-3 border-t border-slate-100 flex items-center space-x-4 text-xs font-semibold text-slate-600">
                    <button
                      onClick={() => handleLikePost(post.id)}
                      className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                        hasLiked ? 'bg-red-50 text-red-600 font-bold' : 'hover:bg-slate-100'
                      }`}
                    >
                      <span>❤️</span>
                      <span>{post.likes} Likes</span>
                    </button>
                    <span className="text-slate-400">•</span>
                    <span>💬 {post.comments.length} Comments</span>
                  </div>

                  {/* Comments List */}
                  {post.comments.length > 0 && (
                    <div className="space-y-2 pt-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                      {post.comments.map(c => (
                        <div key={c.id} className="text-xs space-y-0.5">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800">{c.authorName}</span>
                            <span className="text-[10px] text-slate-400">{c.timestamp}</span>
                          </div>
                          <p className="text-slate-600">{c.text}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Comment Input */}
                  <div className="flex items-center space-x-2 pt-1">
                    <input
                      type="text"
                      placeholder="Write a comment..."
                      value={newCommentTexts[post.id] || ''}
                      onChange={(e) => setNewCommentTexts({ ...newCommentTexts, [post.id]: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddComment(post.id);
                      }}
                      className="flex-1 text-xs px-3 py-2 border border-slate-300 rounded-xl outline-none"
                    />
                    <button
                      onClick={() => handleAddComment(post.id)}
                      className="px-3 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition cursor-pointer"
                    >
                      Post
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: NOTIFICATIONS */}
      {activeProfileTab === 'notifications' && (
        <Card>
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-900">Notifications & Social Alerts</h3>
            <span className="text-xs text-slate-500 font-semibold">{myNotifications.length} Alerts</span>
          </div>

          {myNotifications.length > 0 ? (
            <div className="space-y-3">
              {myNotifications.map(n => (
                <div key={n.id} className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${n.read ? 'bg-white border-slate-200 text-slate-700' : 'bg-sky-50/70 border-sky-200 text-slate-900 font-bold'}`}>
                  <div>
                    <p>{n.message}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{n.timestamp}</p>
                  </div>
                  {!n.read && <span className="w-2.5 h-2.5 rounded-full bg-sky-600" />}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-slate-400 text-xs">
              <p className="font-semibold text-slate-600 mb-1">No notifications yet.</p>
              <p>When colleagues like or comment on your posts, alerts will appear here.</p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

const PerspectiveIcon: React.FC<{ category: PerspectiveCategory }> = ({ category }) => {
  return (
    <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold text-xs">
      {category[0]}
    </div>
  );
};

const KpiCard: React.FC<{
  kpi: CalculatedKpi;
  isAdmin: boolean;
  canUpdateActual: boolean;
  onDelete?: (id: number) => void;
}> = ({ kpi }) => {
  return (
    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col justify-between space-y-3">
      <div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-100 text-sky-800 uppercase">
            {kpi.perspective}
          </span>
          <span className="text-xs font-black text-slate-700">Weight: {kpi.weight}%</span>
        </div>
        <h4 className="font-bold text-slate-800 text-sm mt-2">{kpi.name}</h4>
      </div>

      <div className="grid grid-cols-2 gap-3 py-2 bg-white px-3 rounded-xl border border-slate-100 text-xs">
        <div>
          <p className="text-slate-400 font-semibold text-[10px]">Target</p>
          <p className="font-bold text-slate-800">{kpi.target.toLocaleString()} {kpi.objective?.unit || ''}</p>
        </div>
        <div>
          <p className="text-slate-400 font-semibold text-[10px]">Actual</p>
          <p className="font-bold text-slate-800">{kpi.actual.toLocaleString()} {kpi.objective?.unit || ''}</p>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs pt-1">
        <span className="text-slate-500 font-semibold">Achievement Rate</span>
        <span className={`font-black ${kpi.achievement >= 80 ? 'text-emerald-600' : 'text-amber-600'}`}>
          {Math.round(kpi.achievement)}% ({kpi.score.toFixed(1)} pts)
        </span>
      </div>
    </div>
  );
};

export default EmployeeDetailPage;