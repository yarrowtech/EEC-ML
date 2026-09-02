import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Award, 
  Medal, 
  Trophy, 
  Download, 
  Calendar, 
  Star, 
  Users, 
  Loader2, 
  AlertCircle,
  TrendingUp,
  User,
  Search,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import { parentApiJson } from './parentApi';
import ChildSwitcher, { useSharedChildSelection } from './ChildSwitcher';

const AchievementsView = () => {
  const navigate = useNavigate();
  const [childrenReports, setChildrenReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const childOptions = useMemo(
    () => childrenReports.map((c) => ({ id: String(c.studentId || ''), name: c.studentName || 'Student' })),
    [childrenReports],
  );
  const [childKey, setChildKey, selectedOption] = useSharedChildSelection(childOptions);
  const selectedStudentId = selectedOption?.id || '';

  useEffect(() => {
    const fetchRealAchievements = async () => {
      if (!localStorage.getItem('token')) {
        setError('Please login to view student achievements.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');
      try {
        const data = await parentApiJson('/api/parent/auth/achievements', {}, navigate);

        const children = (Array.isArray(data.children) ? data.children : []).map((c) => ({
          ...c,
          achievements: Array.isArray(c.achievements) ? c.achievements : [],
        }));
        setChildrenReports(children);
      } catch (err) {
        setError(err.message || 'Unable to load achievements');
      } finally {
        setLoading(false);
      }
    };

    fetchRealAchievements();
  }, []);

  const selectedChild = useMemo(
    () => childrenReports.find((child) => String(child.studentId) === String(selectedStudentId)) || null,
    [childrenReports, selectedStudentId]
  );

  const ActivityIcon = ({ className }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'Academic':
        return <Medal className="w-5 h-5" />;
      case 'Extra-Curricular':
        return <Trophy className="w-5 h-5" />;
      case 'Sports':
        return <ActivityIcon className="w-5 h-5" />;
      default:
        return <Star className="w-5 h-5" />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header Section */}
      <header className="relative overflow-hidden bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm group transition-all hover:shadow-md">
        <div className="absolute top-0 right-0 w-64 h-64 bg-violet-50 rounded-full -mr-32 -mt-32 transition-transform group-hover:scale-110 duration-700" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 bg-violet-100 text-violet-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
              <Award size={14} className="fill-yellow-500" />
              <span>Wall of Fame</span>
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Student Achievements</h1>
            <p className="text-slate-600 max-w-2xl text-sm sm:text-base leading-relaxed">
              Celebrate your child's success. View official awards, medals, and certifications earned throughout the academic year.
            </p>
          </div>
        </div>
      </header>

      {error && (
        <div role="alert" className="flex items-center gap-3 text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-xl p-4 animate-in fade-in slide-in-from-top-1">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="font-medium">{error}</p>
        </div>
      )}

      {/* Control Panel */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-6">
        <div className="space-y-2">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 ml-1">
            <Users size={14} />
            Child
          </p>
          {childOptions.length === 0
            ? <p className="text-sm text-slate-400">No children found</p>
            : <ChildSwitcher options={childOptions} value={childKey} onChange={setChildKey} label="Child" />}
        </div>
      </section>

      {/* Stats Summary */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {[
          { 
            label: 'Total Awards', 
            value: selectedChild ? selectedChild.achievements.length : '0', 
            icon: Trophy, 
            color: 'bg-yellow-50 text-yellow-600',
            trend: 'All time accomplishments'
          },
          { 
            label: 'Academic', 
            value: selectedChild ? selectedChild.achievements.filter(a => a.category === 'Academic').length : '0', 
            icon: Medal, 
            color: 'bg-blue-50 text-blue-600',
            trend: 'Scholastic excellence'
          },
          { 
            label: 'Extra-Curricular', 
            value: selectedChild ? selectedChild.achievements.filter(a => a.category === 'Extra-Curricular' || a.category === 'Sports').length : '0', 
            icon: Star, 
            color: 'bg-emerald-50 text-emerald-600',
            trend: 'Talent & Sports'
          },
          { 
            label: 'Recent Wins', 
            value: selectedChild ? selectedChild.achievements.filter(a => {
              const date = new Date(a.date);
              const thirtyDaysAgo = new Date();
              thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
              return date >= thirtyDaysAgo;
            }).length : '0', 
            icon: TrendingUp, 
            color: 'bg-indigo-50 text-indigo-600',
            trend: 'Last 30 days'
          },
        ].map((stat) => (
          <div key={stat.label} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow group">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-xl ${stat.color} transition-transform group-hover:scale-110`}>
                <stat.icon size={20} />
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
              <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
              <p className="text-[10px] font-medium text-slate-500 mt-2">{stat.trend}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Main Content */}
      <section className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col min-h-[400px]">
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white">
              <Trophy size={16} />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Achievement Timeline</h2>
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 space-y-4">
              <Loader2 className="w-10 h-10 text-violet-500 animate-spin" />
              <p className="text-sm font-medium text-slate-500 tracking-wide">Loading achievements…</p>
            </div>
          ) : !selectedChild || selectedChild.achievements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
              <div className="p-6 bg-slate-50 rounded-full text-slate-200">
                <Search size={48} />
              </div>
              <div className="max-w-xs mx-auto">
                <h3 className="text-lg font-bold text-slate-900">No achievements yet</h3>
                <p className="text-sm text-slate-500">Official awards and certificates will be listed here once they are recorded by the administration.</p>
              </div>
            </div>
          ) : (
            <div className="grid gap-6">
              {selectedChild.achievements.map((achievement, idx) => (
                <div 
                  key={idx} 
                  className="group relative flex flex-col sm:flex-row gap-6 border border-slate-100 rounded-3xl p-6 transition-all hover:bg-slate-50/50 hover:border-violet-200 hover:shadow-xl hover:shadow-violet-500/5"
                >
                  <div className="flex-shrink-0">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform ${
                      achievement.category === 'Academic' ? 'bg-blue-100 text-blue-600' :
                      achievement.category === 'Extra-Curricular' ? 'bg-emerald-100 text-emerald-600' :
                      'bg-yellow-100 text-yellow-600'
                    }`}>
                      {getCategoryIcon(achievement.category)}
                    </div>
                  </div>

                  <div className="flex-1 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold text-slate-900 group-hover:text-violet-700 transition-colors">
                            {achievement.title}
                          </h3>
                          <ShieldCheck size={16} className="text-blue-500" />
                        </div>
                        <div className="flex items-center gap-3 text-xs font-bold text-slate-400 uppercase tracking-wider">
                          <div className="flex items-center gap-1.5">
                            <Calendar size={12} />
                            <span>{new Date(achievement.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                          </div>
                          <span>•</span>
                          <span className={achievement.category === 'Academic' ? 'text-blue-500' : 'text-emerald-500'}>
                            {achievement.category}
                          </span>
                        </div>
                      </div>
                      
                      {achievement.certificateUrl && (
                        <a 
                          href={achievement.certificateUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all shadow-sm"
                        >
                          <Download size={14} />
                          VIEW CERTIFICATE
                        </a>
                      )}
                    </div>

                    <p className="text-sm text-slate-600 leading-relaxed">
                      {achievement.description || 'Recognized for outstanding contribution and performance in the specified category.'}
                    </p>

                    <div className="pt-2 flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-2 px-3 py-1 bg-white border border-slate-100 rounded-full shadow-sm">
                        <Award size={12} className="text-yellow-500" />
                        <span className="text-[10px] font-bold text-slate-500 uppercase">{achievement.awardType || 'Official Award'}</span>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1 bg-white border border-slate-100 rounded-full shadow-sm">
                        <User size={12} className="text-slate-400" />
                        <span className="text-[10px] font-bold text-slate-500 uppercase">
                          Uploaded By: {achievement.issuer || 'Academy Administration'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default AchievementsView;
