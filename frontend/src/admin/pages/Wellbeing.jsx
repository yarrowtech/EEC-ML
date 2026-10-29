import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Heart,
  AlertCircle,
  Calendar,
  Smile,
  Frown,
  Meh,
  TrendingUp,
  Brain,
  Users,
  MessageCircle,
  Star,
  X,
  Filter,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';

const Wellbeing = ({ setShowAdminHeader }) => {
  const [studentData, setStudentData]       = useState([]);
  const [searchTerm, setSearchTerm]         = useState('');
  const [showWellbeingModal, setShowWellbeingModal] = useState(false);
  const [selectedStudent, setSelectedStudent]       = useState(null);
  const [wellbeingData, setWellbeingData]   = useState({});
  const [filterStatus, setFilterStatus]     = useState('');
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingWellbeing, setLoadingWellbeing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 12;

  // Returns stored wellbeing data for a student, or null if none
  const getWellbeingStatus = (studentId) => wellbeingData[studentId] || null;

  const getMoodIcon = (mood) => {
    const moodIcons = {
      excellent: { icon: Smile,        color: 'text-green-600',  bg: 'bg-green-100'  },
      good:      { icon: Smile,        color: 'text-blue-600',   bg: 'bg-blue-100'   },
      neutral:   { icon: Meh,          color: 'text-yellow-600', bg: 'bg-yellow-100' },
      concerning:{ icon: Frown,        color: 'text-orange-600', bg: 'bg-orange-100' },
      critical:  { icon: AlertCircle,  color: 'text-red-600',    bg: 'bg-red-100'    },
    };
    return moodIcons[mood] || moodIcons.neutral;
  };

  const updateWellbeingData = (studentId, updates) => {
    setWellbeingData(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {}),
        ...updates,
        lastAssessment: new Date().toISOString().split('T')[0],
      },
    }));
  };

  const openWellbeingModal = (student) => {
    setSelectedStudent(student);
    setShowWellbeingModal(true);
    setLoadingWellbeing(true);
    fetch(`${import.meta.env.VITE_API_URL}/api/wellbeing/${student.id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    })
      .then(res => {
        if (!res.ok) throw new Error('No data');
        return res.json();
      })
      .then(data => {
        if (data && typeof data === 'object' && Object.keys(data).length > 0) {
          setWellbeingData(prev => ({ ...prev, [student.id]: data }));
        }
      })
      .catch(() => {
        // No wellbeing data for this student — leave as null
      })
      .finally(() => setLoadingWellbeing(false));
  };

  // Fetch students
  useEffect(() => {
    setShowAdminHeader?.(false);
    setLoadingStudents(true);
    fetch(`${import.meta.env.VITE_API_URL}/api/admin/users/get-students`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch students');
        return res.json();
      })
      .then(data => {
        const list = Array.isArray(data) ? data : [];
        const normalized = list.map(s => ({
          id:      s._id || s.id,
          name:    s.name || '—',
          roll:    s.rollNumber || s.roll || '—',
          grade:   s.grade || s.class || '—',
          section: s.section || '—',
          email:   s.email || '—',
        }));
        setStudentData(normalized);
      })
      .catch(err => console.error('Error fetching students:', err))
      .finally(() => setLoadingStudents(false));
  }, [setShowAdminHeader]);

  const filteredStudents = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return studentData.filter(student => {
      const matchesSearch =
        student.name.toLowerCase().includes(q) ||
        String(student.roll).includes(searchTerm) ||
        student.email.toLowerCase().includes(q);
      if (!filterStatus) return matchesSearch;
      const wellbeing = getWellbeingStatus(student.id);
      return matchesSearch && wellbeing?.mood === filterStatus;
    });
  }, [studentData, searchTerm, filterStatus, wellbeingData]);

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / ITEMS_PER_PAGE));
  // Async wellbeing-data fetches can shrink `filteredStudents` after the
  // page was set — clamp back instead of rendering an out-of-range page.
  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredStudents.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredStudents, currentPage]);
  const startItem = filteredStudents.length > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0;
  const endItem   = Math.min(currentPage * ITEMS_PER_PAGE, filteredStudents.length);

  const handleSearchChange     = (val) => { setSearchTerm(val);   setCurrentPage(1); };
  const handleFilterChange     = (val) => { setFilterStatus(val); setCurrentPage(1); };

  // Only count students that have actual wellbeing data
  const wellbeingStats = {
    total:      studentData.length,
    excellent:  studentData.filter(s => getWellbeingStatus(s.id)?.mood === 'excellent').length,
    good:       studentData.filter(s => getWellbeingStatus(s.id)?.mood === 'good').length,
    neutral:    studentData.filter(s => getWellbeingStatus(s.id)?.mood === 'neutral').length,
    concerning: studentData.filter(s => getWellbeingStatus(s.id)?.mood === 'concerning').length,
    critical:   studentData.filter(s => getWellbeingStatus(s.id)?.mood === 'critical').length,
  };

  const handleSaveAssessment = () => {
    if (!selectedStudent) return;
    const studentWellbeing = wellbeingData[selectedStudent.id];
    if (!studentWellbeing) return;

    fetch(`${import.meta.env.VITE_API_URL}/api/wellbeing/${selectedStudent.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify(studentWellbeing),
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to save assessment');
        return res.json();
      })
      .then(() => setShowWellbeingModal(false))
      .catch(err => console.error('Error saving assessment:', err));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-purple-100 to-indigo-100 p-8">
      <div className="max-w-7xl mx-auto bg-white/90 rounded-2xl shadow-2xl p-8 border border-purple-200">

        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-purple-700">Student Wellbeing Dashboard</h1>
            <p className="text-gray-600 mt-2">Monitor and assess student emotional wellbeing and mental health</p>
          </div>
          <Brain className="w-12 h-12 text-purple-500" />
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow-sm border border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-600">Total Students</h3>
                <p className="text-2xl font-bold text-gray-900">{wellbeingStats.total}</p>
              </div>
              <Users className="w-8 h-8 text-gray-500" />
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-600">Excellent</h3>
                <p className="text-2xl font-bold text-green-600">{wellbeingStats.excellent}</p>
              </div>
              <Smile className="w-8 h-8 text-green-500" />
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-600">Good</h3>
                <p className="text-2xl font-bold text-blue-600">{wellbeingStats.good}</p>
              </div>
              <Smile className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-yellow-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-600">Neutral</h3>
                <p className="text-2xl font-bold text-yellow-600">{wellbeingStats.neutral}</p>
              </div>
              <Meh className="w-8 h-8 text-yellow-500" />
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-orange-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-600">Concerning</h3>
                <p className="text-2xl font-bold text-orange-600">{wellbeingStats.concerning}</p>
              </div>
              <Frown className="w-8 h-8 text-orange-500" />
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-red-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-600">Critical</h3>
                <p className="text-2xl font-bold text-red-600">{wellbeingStats.critical}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[240px] relative">
            <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search students..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-400" />
            <select
              className="border border-gray-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
              value={filterStatus}
              onChange={(e) => handleFilterChange(e.target.value)}
            >
              <option value="">All Wellbeing Status</option>
              <option value="excellent">Excellent</option>
              <option value="good">Good</option>
              <option value="neutral">Neutral</option>
              <option value="concerning">Concerning</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>

        {/* Students Grid */}
        {loadingStudents ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-100 border-t-purple-600" />
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
            <Users className="w-12 h-12" />
            <p className="text-sm font-medium">No students found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginatedStudents.map((student) => {
              const wellbeing = getWellbeingStatus(student.id);
              const moodConfig = wellbeing?.mood ? getMoodIcon(wellbeing.mood) : null;
              const Icon = moodConfig?.icon;

              return (
                <div
                  key={student.id}
                  className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-all border border-gray-200 cursor-pointer"
                  onClick={() => openWellbeingModal(student)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-purple-200 flex items-center justify-center font-semibold text-purple-700">
                        {student.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{student.name}</h3>
                        <p className="text-sm text-gray-500">Roll: {student.roll}</p>
                        <p className="text-xs text-gray-400">{student.grade} {student.section !== '—' ? `· ${student.section}` : ''}</p>
                      </div>
                    </div>
                    {moodConfig ? (
                      <div className={`p-2 rounded-full ${moodConfig.bg}`}>
                        <Icon size={20} className={moodConfig.color} />
                      </div>
                    ) : (
                      <div className="p-2 rounded-full bg-gray-100">
                        <ClipboardList size={20} className="text-gray-400" />
                      </div>
                    )}
                  </div>

                  {wellbeing ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Overall Mood</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${moodConfig.bg} ${moodConfig.color}`}>
                          {wellbeing.mood.charAt(0).toUpperCase() + wellbeing.mood.slice(1)}
                        </span>
                      </div>

                      {wellbeing.academicStress != null && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Academic Stress</span>
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-gray-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${wellbeing.academicStress > 7 ? 'bg-red-500' : wellbeing.academicStress > 4 ? 'bg-yellow-500' : 'bg-green-500'}`}
                                style={{ width: `${(wellbeing.academicStress / 10) * 100}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500">{wellbeing.academicStress}/10</span>
                          </div>
                        </div>
                      )}

                      {wellbeing.socialEngagement != null && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Social Engagement</span>
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-gray-200 rounded-full h-2">
                              <div
                                className="h-2 bg-blue-500 rounded-full"
                                style={{ width: `${(wellbeing.socialEngagement / 10) * 100}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500">{wellbeing.socialEngagement}/10</span>
                          </div>
                        </div>
                      )}

                      {wellbeing.behaviorChanges && (
                        <div className="flex items-center gap-2 text-orange-600 text-sm">
                          <AlertCircle size={16} />
                          <span>Behavior changes noted</span>
                        </div>
                      )}

                      <div className="flex justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
                        {wellbeing.lastAssessment && <span>Last: {wellbeing.lastAssessment}</span>}
                        {wellbeing.counselingSessions != null && <span>Sessions: {wellbeing.counselingSessions}</span>}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-gray-400 text-sm pt-2 border-t border-gray-100">
                      <ClipboardList size={15} />
                      <span>No assessment yet</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {!loadingStudents && filteredStudents.length > 0 && (
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-purple-100 pt-4">
            <p className="text-gray-500 text-xs">
              Showing {startItem}–{endItem} of {filteredStudents.length} students
            </p>

            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                {/* First */}
                <button
                  className="p-1.5 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  title="First page"
                >
                  <ChevronsLeft size={14} />
                </button>

                {/* Prev */}
                <button
                  className="p-1.5 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  title="Previous page"
                >
                  <ChevronLeft size={14} />
                </button>

                {/* Page numbers with smart truncation */}
                {(() => {
                  const pages = [];
                  const showMax = 5;

                  if (totalPages <= showMax + 2) {
                    for (let i = 1; i <= totalPages; i++) pages.push(i);
                  } else {
                    pages.push(1);
                    let rangeStart = Math.max(2, currentPage - 1);
                    let rangeEnd   = Math.min(totalPages - 1, currentPage + 1);

                    if (currentPage <= 3) {
                      rangeStart = 2;
                      rangeEnd   = Math.min(showMax, totalPages - 1);
                    } else if (currentPage >= totalPages - 2) {
                      rangeStart = Math.max(2, totalPages - showMax + 1);
                      rangeEnd   = totalPages - 1;
                    }

                    if (rangeStart > 2) pages.push('start-ellipsis');
                    for (let i = rangeStart; i <= rangeEnd; i++) pages.push(i);
                    if (rangeEnd < totalPages - 1) pages.push('end-ellipsis');
                    pages.push(totalPages);
                  }

                  return pages.map((page) => {
                    if (typeof page === 'string') {
                      return (
                        <span key={page} className="px-1 text-gray-400 text-xs select-none">&hellip;</span>
                      );
                    }
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`min-w-[28px] h-7 rounded-md text-xs font-medium transition ${
                          page === currentPage
                            ? 'bg-amber-500 text-white shadow-sm'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  });
                })()}

                {/* Next */}
                <button
                  className="p-1.5 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  title="Next page"
                >
                  <ChevronRight size={14} />
                </button>

                {/* Last */}
                <button
                  className="p-1.5 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  title="Last page"
                >
                  <ChevronsRight size={14} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Wellbeing Assessment Modal */}
        {showWellbeingModal && selectedStudent && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Emotional Wellbeing Assessment</h2>
                    <p className="text-gray-600 mt-1">
                      {selectedStudent.name}
                      {selectedStudent.roll !== '—' && ` · Roll: ${selectedStudent.roll}`}
                      {selectedStudent.grade !== '—' && ` · Class: ${selectedStudent.grade}`}
                      {selectedStudent.section !== '—' && `-${selectedStudent.section}`}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowWellbeingModal(false)}
                    className="text-gray-400 hover:text-gray-600 p-2"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">

                {/* Loading state */}
                {loadingWellbeing ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-100 border-t-purple-600" />
                  </div>
                ) : (
                  <>
                    {/* Current Status Overview */}
                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Status</h3>
                      {wellbeingData[selectedStudent.id] ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {(() => {
                            const wellbeing = wellbeingData[selectedStudent.id];
                            const moodConfig = getMoodIcon(wellbeing.mood);
                            const MoodIcon = moodConfig.icon;
                            return (
                              <>
                                <div className="text-center">
                                  <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full ${moodConfig.bg} mb-2`}>
                                    <MoodIcon className={`w-8 h-8 ${moodConfig.color}`} />
                                  </div>
                                  <h4 className="font-medium text-gray-900">Overall Mood</h4>
                                  <p className={`text-sm font-medium ${moodConfig.color}`}>
                                    {wellbeing.mood.charAt(0).toUpperCase() + wellbeing.mood.slice(1)}
                                  </p>
                                </div>
                                {wellbeing.socialEngagement != null && (
                                  <div className="text-center">
                                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-2">
                                      <Users className="w-8 h-8 text-blue-600" />
                                    </div>
                                    <h4 className="font-medium text-gray-900">Social Engagement</h4>
                                    <p className="text-sm font-medium text-blue-600">{wellbeing.socialEngagement}/10</p>
                                  </div>
                                )}
                                {wellbeing.academicStress != null && (
                                  <div className="text-center">
                                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-orange-100 mb-2">
                                      <TrendingUp className="w-8 h-8 text-orange-600" />
                                    </div>
                                    <h4 className="font-medium text-gray-900">Academic Stress</h4>
                                    <p className="text-sm font-medium text-orange-600">{wellbeing.academicStress}/10</p>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 text-gray-400">
                          <ClipboardList className="w-6 h-6" />
                          <p className="text-sm">No assessment data available for this student.</p>
                        </div>
                      )}
                    </div>

                    {/* Assessment Form */}
                    <div className="bg-white border border-gray-200 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Update Assessment</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Mood Rating</label>
                          <select
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                            value={wellbeingData[selectedStudent.id]?.mood || ''}
                            onChange={(e) => updateWellbeingData(selectedStudent.id, { mood: e.target.value })}
                          >
                            <option value="" disabled>Select mood</option>
                            <option value="excellent">Excellent</option>
                            <option value="good">Good</option>
                            <option value="neutral">Neutral</option>
                            <option value="concerning">Concerning</option>
                            <option value="critical">Critical</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Social Engagement (1–10)
                          </label>
                          <input
                            type="range"
                            min="1"
                            max="10"
                            className="w-full"
                            value={wellbeingData[selectedStudent.id]?.socialEngagement ?? 5}
                            onChange={(e) => updateWellbeingData(selectedStudent.id, { socialEngagement: parseInt(e.target.value) })}
                          />
                          <div className="text-center text-sm text-gray-600 mt-1">
                            {wellbeingData[selectedStudent.id]?.socialEngagement ?? 5}/10
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Academic Stress (1–10)
                          </label>
                          <input
                            type="range"
                            min="1"
                            max="10"
                            className="w-full"
                            value={wellbeingData[selectedStudent.id]?.academicStress ?? 5}
                            onChange={(e) => updateWellbeingData(selectedStudent.id, { academicStress: parseInt(e.target.value) })}
                          />
                          <div className="text-center text-sm text-gray-600 mt-1">
                            {wellbeingData[selectedStudent.id]?.academicStress ?? 5}/10
                          </div>
                        </div>
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            id="behaviorChanges"
                            className="h-4 w-4 text-purple-600 border-gray-300 rounded"
                            checked={wellbeingData[selectedStudent.id]?.behaviorChanges || false}
                            onChange={(e) => updateWellbeingData(selectedStudent.id, { behaviorChanges: e.target.checked })}
                          />
                          <label htmlFor="behaviorChanges" className="ml-2 text-sm text-gray-700">
                            Behavior changes observed
                          </label>
                        </div>
                      </div>
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                        <textarea
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                          rows="3"
                          placeholder="Add any observations, concerns, or notes..."
                          value={wellbeingData[selectedStudent.id]?.notes || ''}
                          onChange={(e) => updateWellbeingData(selectedStudent.id, { notes: e.target.value })}
                        />
                      </div>
                    </div>

                    {/* Support Actions — only shown when data exists */}
                    {wellbeingData[selectedStudent.id] && (
                      <div className="bg-white border border-gray-200 rounded-xl p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Support & Interventions</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                          <div className="text-center p-4 bg-blue-50 rounded-lg">
                            <MessageCircle className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                            <h4 className="font-medium text-gray-900">Counseling Sessions</h4>
                            <p className="text-2xl font-bold text-blue-600">
                              {wellbeingData[selectedStudent.id]?.counselingSessions ?? 0}
                            </p>
                          </div>
                          <div className="text-center p-4 bg-yellow-50 rounded-lg">
                            <Users className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
                            <h4 className="font-medium text-gray-900">Parent Meetings</h4>
                            <p className="text-2xl font-bold text-yellow-600">
                              {wellbeingData[selectedStudent.id]?.parentNotifications ?? 0}
                            </p>
                          </div>
                          <div className="text-center p-4 bg-green-50 rounded-lg">
                            <Star className="w-8 h-8 text-green-600 mx-auto mb-2" />
                            <h4 className="font-medium text-gray-900">Interventions</h4>
                            <p className="text-2xl font-bold text-green-600">
                              {wellbeingData[selectedStudent.id]?.interventions?.length ?? 0}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowWellbeingModal(false)}
                    className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveAssessment}
                    disabled={!wellbeingData[selectedStudent.id]}
                    className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Save Assessment
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Wellbeing;
