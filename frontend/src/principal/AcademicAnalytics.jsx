import React, { useEffect, useState } from 'react';
import { 
  BookOpen, 
  TrendingUp, 
  Award, 
  Calendar,
  Users,
  FileText,
  BarChart3,
  PieChart,
  Target,
  ArrowUp,
  ArrowDown,
  Eye,
  Filter,
  Download,
  Loader,
  AlertCircle
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL;

const AcademicAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [analytics, setAnalytics] = useState(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState('current_term');
  const [selectedGrade, setSelectedGrade] = useState('all');

  useEffect(() => {
    const fetchAcademicAnalytics = async () => {
      setLoading(true);
      setError('');
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE}/api/principal/academic/analytics`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            authorization: `Bearer ${token}`
          }
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error || 'Failed to load academic analytics');
        }
        setAnalytics(data);
      } catch (err) {
        console.error('Academic analytics error:', err);
        setError(err.message || 'Unable to load academic analytics');
      } finally {
        setLoading(false);
      }
    };

    fetchAcademicAnalytics();
  }, []);

  const academicOverview = analytics?.academicOverview || {
    averageGPA: '0%',
    passRate: 0,
    honorsStudents: 0,
    improvementRate: 0,
    attendanceRate: 0,
    homeworkCompletion: 0
  };

  const gradeDistribution = analytics?.gradeDistribution || [];
  const subjectPerformance = analytics?.subjectPerformance || [];
  const classAnalytics = analytics?.classAnalytics || [];
  const examSchedule = analytics?.examSchedule || [];

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="bg-slate-950 rounded-2xl p-8 text-white shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Academic Analytics</h1>
            <p className="text-slate-300">Comprehensive academic performance insights from your database</p>
          </div>
          <div className="flex items-center gap-4">
            <select 
              value={selectedTimeframe}
              onChange={(e) => setSelectedTimeframe(e.target.value)}
              className="bg-white/20 border border-white/30 rounded-lg px-4 py-2 text-white placeholder-white/70"
            >
              <option value="current_term">Current Term</option>
              <option value="last_term">Last Term</option>
              <option value="academic_year">Academic Year</option>
            </select>
          </div>
        </div>
      </div>

      {loading && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 flex items-center justify-center">
          <Loader className="w-6 h-6 animate-spin text-slate-600 mr-2" />
          <span className="text-gray-600">Loading academic analytics...</span>
        </div>
      )}

      {!loading && error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-center gap-2 text-red-700">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Academic Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-slate-100 rounded-lg">
                  <Award className="w-6 h-6 text-slate-600" />
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-slate-900">{academicOverview.averageGPA}</div>
                  <div className="text-sm text-slate-600">Average Percentage</div>
                </div>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div 
                  className="bg-slate-500 h-2 rounded-full" 
                  style={{ width: `${academicOverview.averageGPA}` }}
                />
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-slate-100 rounded-lg">
                  <Target className="w-6 h-6 text-slate-600" />
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-slate-900">{academicOverview.passRate}%</div>
                  <div className="text-sm text-slate-600">Pass Rate</div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-slate-600 text-sm">
                <ArrowUp className="w-4 h-4" />
                <span>Live from data</span>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Users className="w-6 h-6 text-purple-600" />
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-slate-900">{academicOverview.honorsStudents}</div>
                  <div className="text-sm text-slate-600">Honor Students</div>
                </div>
              </div>
              <div className="text-xs text-slate-600">A/A+ Performers</div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Calendar className="w-6 h-6 text-blue-600" />
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-slate-900">{academicOverview.attendanceRate}%</div>
                  <div className="text-sm text-slate-600">Avg Attendance</div>
                </div>
              </div>
              <div className="text-xs text-slate-600">Academic session</div>
            </div>
          </div>

          {/* Grade Distribution & Subject Performance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Grade Distribution */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100">
              <div className="p-6 border-b border-slate-100">
                <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-slate-500" />
                  Grade Distribution
                </h3>
              </div>
              <div className="p-6">
                <div className="space-y-3">
                  {gradeDistribution.length > 0 ? gradeDistribution.map((item, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-full ${
                          item.color === 'emerald' ? 'bg-emerald-500' :
                          item.color === 'green' ? 'bg-green-500' :
                          item.color === 'blue' ? 'bg-blue-500' :
                          item.color === 'yellow' ? 'bg-yellow-500' :
                          item.color === 'orange' ? 'bg-orange-500' :
                          item.color === 'red' ? 'bg-red-500' :
                          'bg-gray-500'
                        }`}></div>
                        <span className="font-medium text-gray-900">{item.grade}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-sm font-medium text-gray-900">{item.count} students</div>
                          <div className="text-xs text-gray-500">{item.percentage}%</div>
                        </div>
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${
                              item.color === 'emerald' ? 'bg-emerald-500' :
                              item.color === 'green' ? 'bg-green-500' :
                              item.color === 'blue' ? 'bg-blue-500' :
                              item.color === 'yellow' ? 'bg-yellow-500' :
                              item.color === 'orange' ? 'bg-orange-500' :
                              item.color === 'red' ? 'bg-red-500' :
                              'bg-gray-500'
                            }`}
                            style={{ width: `${item.percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )) : (
                    <p className="text-gray-500 text-center py-4">No grade distribution data available</p>
                  )}
                </div>
              </div>
            </div>

            {/* Subject Performance */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="p-6 border-b border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-green-500" />
                  Subject Performance
                </h3>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {subjectPerformance.length > 0 ? subjectPerformance.slice(0, 4).map((subject, index) => (
                    <div key={index} className="border border-gray-100 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-900">{subject.subject}</h4>
                        <div className={`flex items-center gap-1 text-sm ${
                          subject.trend === 'up' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {subject.trend === 'up' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                          Live
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-gray-500">Average Score</div>
                          <div className="font-bold text-gray-900">{subject.avgScore}%</div>
                        </div>
                        <div>
                          <div className="text-gray-500">Above 80%</div>
                          <div className="font-bold text-gray-900">{subject.studentsAbove80}/{subject.totalStudents}</div>
                        </div>
                      </div>
                      <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-500 h-2 rounded-full"
                          style={{ width: `${subject.avgScore}%` }}
                        />
                      </div>
                    </div>
                  )) : (
                    <p className="text-gray-500 text-center py-4">No subject performance data available</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Class Analytics */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100">
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-purple-500" />
                  Grade-wise Analytics
                </h3>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-800">Grade</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-800">Total Students</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-800">Average Score</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-800">Top Performers</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-800">Needs Support</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {classAnalytics.length > 0 ? classAnalytics.map((classData, index) => (
                    <tr key={index} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-medium text-slate-900">{classData.grade}</td>
                      <td className="px-6 py-4 text-slate-700">{classData.totalStudents}</td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-slate-900">{classData.avgGPA}</span>
                        <div className="w-16 bg-slate-200 rounded-full h-1 mt-1">
                          <div 
                            className="bg-slate-500 h-1 rounded-full"
                            style={{ width: `${(classData.avgGPA / 4.0) * 100}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                          {classData.topPerformers} students
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs font-medium">
                          {classData.needsSupport} students
                        </span>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="5" className="px-6 py-8 text-center text-gray-500">No class-wise analytics available</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Upcoming Exams */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-slate-500" />
                Examination Schedule
              </h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {examSchedule.length > 0 ? examSchedule.map((exam, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-900">{exam.exam}</h4>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        exam.status === 'upcoming' ? 'bg-orange-100 text-orange-700' :
                        exam.status === 'completed' ? 'bg-green-100 text-green-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {exam.status}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(exam.date).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4" />
                        {exam.subjects} subjects
                      </div>
                    </div>
                  </div>
                )) : (
                  <p className="text-gray-500 col-span-2 text-center py-4">No examination schedule data available</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AcademicAnalytics;
