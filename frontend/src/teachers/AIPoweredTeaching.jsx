import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Trash2, FileText, Loader,
  BookOpen, Users, FileCheck, Zap, Grid, List as ListIcon, ClipboardList
} from 'lucide-react';
import RichTextMaterialEditor from './components/RichTextMaterialEditor';
import PracticePaperBuilder from './components/PracticePaperBuilder';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

const AIPoweredTeaching = () => {
  const navigate = useNavigate();
  const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

  // State
  const [loading, setLoading] = useState(true);
  const [allocations, setAllocations] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [papers, setPapers] = useState([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [viewMode, setViewMode] = useState('grid'); // grid or list

  const [activeTab, setActiveTab] = useState('materials'); // materials or papers
  const [showEditor, setShowEditor] = useState(false);
  const [showPaperBuilder, setShowPaperBuilder] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');

  // Get auth token
  const token = localStorage.getItem('token');
  const authHeaders = useMemo(() => ({
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }), [token]);

  // Fetch teacher allocations
  useEffect(() => {
    const fetchAllocations = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/teacher/dashboard/allocations`, {
          headers: authHeaders
        });
        if (!response.ok) throw new Error('Failed to fetch allocations');

        const data = await response.json();
        setAllocations(data.data || []);

        // Set default class and section
        if (data.data && data.data.length > 0) {
          const firstAllocation = data.data[0];
          const resolvedClassId = firstAllocation.classId?._id || firstAllocation.classId || '';
          const resolvedSectionId = firstAllocation.sectionId?._id || firstAllocation.sectionId || '';
          setSelectedClassId(resolvedClassId);
          setSelectedSectionId(resolvedSectionId);
        }
      } catch (err) {
        console.error('Error fetching allocations:', err);
        toast.error('Failed to load class allocations');
      }
    };

    fetchAllocations();
  }, [API_BASE, authHeaders]);

  // Fetch materials
  useEffect(() => {
    if (activeTab !== 'materials') return;

    const fetchMaterials = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (statusFilter !== 'all') params.append('status', statusFilter);
        if (subjectFilter !== 'all') params.append('subjectId', subjectFilter);
        if (searchQuery) params.append('search', searchQuery);

        const response = await fetch(`${API_BASE}/api/teaching-materials?${params}`, {
          headers: authHeaders
        });
        if (!response.ok) throw new Error('Failed to fetch materials');

        const data = await response.json();
        setMaterials(data.materials || []);
      } catch (err) {
        console.error('Error fetching materials:', err);
        toast.error('Failed to load materials');
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(fetchMaterials, 300);
    return () => clearTimeout(debounceTimer);
  }, [API_BASE, authHeaders, statusFilter, subjectFilter, searchQuery, activeTab]);

  // Fetch practice papers
  useEffect(() => {
    if (activeTab !== 'papers') return;

    const fetchPapers = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (statusFilter !== 'all') params.append('status', statusFilter);
        if (searchQuery) params.append('search', searchQuery);

        const response = await fetch(`${API_BASE}/api/practice-papers/teacher?${params}`, {
          headers: authHeaders
        });
        if (!response.ok) throw new Error('Failed to fetch papers');

        const data = await response.json();
        setPapers(data.papers || []);
      } catch (err) {
        console.error('Error fetching papers:', err);
        toast.error('Failed to load practice papers');
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(fetchPapers, 300);
    return () => clearTimeout(debounceTimer);
  }, [API_BASE, authHeaders, statusFilter, searchQuery, activeTab]);

  // Get unique subjects
  const subjects = useMemo(() => {
    const seen = new Set();
    return allocations
      .filter(a => {
        const id = a.subjectId?._id;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      })
      .map(a => ({
        id: a.subjectId?._id,
        name: a.subjectId?.name
      }));
  }, [allocations]);

  // Handle delete
  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this material?')) return;

    try {
      const response = await fetch(`${API_BASE}/api/teaching-materials/${id}`, {
        method: 'DELETE',
        headers: authHeaders
      });
      if (!response.ok) throw new Error('Failed to delete');

      setMaterials(prev => prev.filter(m => m._id !== id));
      toast.success('Material deleted');
    } catch (err) {
      console.error('Error deleting:', err);
      toast.error('Failed to delete material');
    }
  };

  // Handle publish
  const handlePublish = async (id) => {
    try {
      const response = await fetch(`${API_BASE}/api/teaching-materials/${id}/publish`, {
        method: 'POST',
        headers: authHeaders
      });
      if (!response.ok) throw new Error('Failed to publish');

      setMaterials(prev =>
        prev.map(m =>
          m._id === id ? { ...m, status: 'published', publishedAt: new Date() } : m
        )
      );
      toast.success('Material published');
    } catch (err) {
      console.error('Error publishing:', err);
      toast.error('Failed to publish material');
    }
  };

  // Handle delete paper
  const handleDeletePaper = async (id) => {
    if (!confirm('Are you sure you want to delete this practice paper?')) return;

    try {
      const response = await fetch(`${API_BASE}/api/practice-papers/${id}`, {
        method: 'DELETE',
        headers: authHeaders
      });
      if (!response.ok) throw new Error('Failed to delete');

      setPapers(prev => prev.filter(p => p._id !== id));
      toast.success('Practice paper deleted');
    } catch (err) {
      console.error('Error deleting:', err);
      toast.error('Failed to delete practice paper');
    }
  };

  // Handle publish paper
  const handlePublishPaper = async (id) => {
    try {
      const response = await fetch(`${API_BASE}/api/practice-papers/${id}/publish`, {
        method: 'POST',
        headers: authHeaders
      });
      if (!response.ok) throw new Error('Failed to publish');

      setPapers(prev =>
        prev.map(p =>
          p._id === id ? { ...p, status: 'published', publishedAt: new Date() } : p
        )
      );
      toast.success('Practice paper published');
    } catch (err) {
      console.error('Error publishing:', err);
      toast.error('Failed to publish practice paper');
    }
  };

  // Material card component
  const MaterialCard = ({ material }) => (
    <Card className="border-slate-200 transition-all hover:border-blue-200 hover:shadow-md">
      <CardContent className="p-4">
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-[15px] text-slate-900 line-clamp-2">{material.title}</h3>
        <div className="flex gap-2">
          {material.status === 'draft' && (
            <Button
              onClick={() => handlePublish(material._id)}
              size="icon-sm"
              variant="ghost"
              className="text-blue-700 hover:bg-blue-50"
              title="Publish"
            >
              <FileCheck className="w-4 h-4" />
            </Button>
          )}
          <Button
            onClick={() => handleDelete(material._id)}
            size="icon-sm"
            variant="ghost"
            className="text-red-600 hover:bg-red-50"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <p className="text-sm text-slate-600 line-clamp-2 mb-3">{material.content?.replace(/<[^>]*>/g, '')}</p>

      <div className="flex flex-wrap gap-2 mb-3">
        <Badge variant={material.status === 'published' ? 'success' : material.status === 'scheduled' ? 'secondary' : 'muted'}>
          {material.status}
        </Badge>
        {material.attachments?.length > 0 && (
          <Badge variant="warning">
            {material.attachments.length} file(s)
          </Badge>
        )}
      </div>

      <div className="text-xs text-slate-500 space-y-0.5">
        <p>{material.subjectName} • {material.className}-{material.sectionName}</p>
        <p>{new Date(material.createdAt).toLocaleDateString()}</p>
      </div>
      </CardContent>
    </Card>
  );

  // Practice paper card component
  const PaperCard = ({ paper }) => (
    <Card className="border-slate-200 transition-all hover:border-blue-200 hover:shadow-md">
      <CardContent className="p-4">
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-[15px] text-slate-900 line-clamp-2">{paper.title}</h3>
        <div className="flex gap-2">
          {paper.status === 'draft' && (
            <Button
              onClick={() => handlePublishPaper(paper._id)}
              size="icon-sm"
              variant="ghost"
              className="text-blue-700 hover:bg-blue-50"
              title="Publish"
            >
              <FileCheck className="w-4 h-4" />
            </Button>
          )}
          <Button
            onClick={() => handleDeletePaper(paper._id)}
            size="icon-sm"
            variant="ghost"
            className="text-red-600 hover:bg-red-50"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-3 text-sm">
        <span className="text-slate-600">{paper.totalQuestions} questions</span>
        <span className="text-slate-500">•</span>
        <span className="text-slate-600">{paper.totalMarks} marks</span>
        {paper.duration > 0 && (
          <>
            <span className="text-slate-500">•</span>
            <span className="text-slate-600">{paper.duration} min</span>
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <Badge variant={paper.status === 'published' ? 'success' : paper.status === 'draft' ? 'muted' : 'warning'}>
          {paper.status}
        </Badge>
        <Badge variant={paper.difficulty === 'hard' ? 'destructive' : paper.difficulty === 'easy' ? 'secondary' : 'warning'}>
          {paper.difficulty}
        </Badge>
      </div>

      <div className="text-xs text-slate-500 space-y-0.5">
        <p>{paper.className} - {paper.sectionName}</p>
        <p>{new Date(paper.createdAt).toLocaleDateString()}</p>
      </div>
      </CardContent>
    </Card>
  );

  // Render - Material Editor
  if (showEditor) {
    return (
      <div className="p-6">
        <Button
          variant="outline"
          onClick={() => {
            setShowEditor(false);
            setEditingMaterial(null);
          }}
          className="mb-4"
        >
          ← Back
        </Button>
        <RichTextMaterialEditor
          material={editingMaterial}
          classId={selectedClassId}
          sectionId={selectedSectionId}
          onSave={(material) => {
            setMaterials(prev => {
              const idx = prev.findIndex(m => m._id === material._id);
              if (idx >= 0) {
                const updated = [...prev];
                updated[idx] = material;
                return updated;
              }
              return [material, ...prev];
            });
            setShowEditor(false);
            setEditingMaterial(null);
            toast.success('Material saved!');
          }}
          onCancel={() => {
            setShowEditor(false);
            setEditingMaterial(null);
          }}
        />
      </div>
    );
  }

  // Render - Practice Paper Builder
  if (showPaperBuilder) {
    return (
      <div className="p-6">
        <Button
          variant="outline"
          onClick={() => setShowPaperBuilder(false)}
          className="mb-4"
        >
          ← Back
        </Button>
        <PracticePaperBuilder
          classId={selectedClassId}
          sectionId={selectedSectionId}
          onSave={(paper) => {
            setPapers(prev => [paper, ...prev]);
            setShowPaperBuilder(false);
            toast.success('Practice paper created!');
          }}
          onCancel={() => setShowPaperBuilder(false)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9ff] text-[#121c28] font-['Lexend']">
      <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-6 md:py-8">
        <div className="mb-7">
          <nav className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
            <span>Teaching Tools</span>
            <span>•</span>
            <span className="text-[#00288e]">Smart Teaching</span>
          </nav>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-semibold text-[#001453] flex items-center gap-2">
                <Zap className="w-7 h-7 text-[#1e40af]" />
                Smart Lesson Plan and Teaching
              </h1>
              <p className="text-sm md:text-base text-slate-600 mt-1">
                Create, organize and publish learning materials and practice papers.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                onClick={() => navigate('/teacher/smart-teaching/lesson-planner')}
                className="rounded-xl"
              >
                <BookOpen className="w-4 h-4" />
                Lesson Planner
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/teacher/smart-teaching/lesson-planner-wizard')}
                className="rounded-xl"
              >
                <BookOpen className="w-4 h-4" />
                Planner Wizard
              </Button>
              <Button
                onClick={() => {
                  if (activeTab === 'materials') {
                    setEditingMaterial(null);
                    setShowEditor(true);
                  } else {
                    setShowPaperBuilder(true);
                  }
                }}
                className="rounded-xl bg-[#00288e] hover:bg-[#001f6f]"
              >
                <Plus className="w-4 h-4" />
                {activeTab === 'materials' ? 'New Material' : 'New Paper'}
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {activeTab === 'materials' ? (
            <>
              <Card><CardContent className="p-4"><p className="text-xs text-slate-500 mb-2">Materials</p><p className="text-2xl font-semibold text-[#001453]">{materials.length}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-slate-500 mb-2">Published</p><p className="text-2xl font-semibold text-[#006c4a]">{materials.filter(m => m.status === 'published').length}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-slate-500 mb-2">Classes</p><p className="text-2xl font-semibold text-[#001453]">{allocations.length}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-slate-500 mb-2">Subjects</p><p className="text-2xl font-semibold text-[#001453]">{subjects.length}</p></CardContent></Card>
            </>
          ) : (
            <>
              <Card><CardContent className="p-4"><p className="text-xs text-slate-500 mb-2">Papers</p><p className="text-2xl font-semibold text-[#001453]">{papers.length}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-slate-500 mb-2">Published</p><p className="text-2xl font-semibold text-[#006c4a]">{papers.filter(p => p.status === 'published').length}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-slate-500 mb-2">Total Questions</p><p className="text-2xl font-semibold text-[#001453]">{papers.reduce((sum, p) => sum + (p.totalQuestions || 0), 0)}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-slate-500 mb-2">Total Marks</p><p className="text-2xl font-semibold text-[#001453]">{papers.reduce((sum, p) => sum + (p.totalMarks || 0), 0)}</p></CardContent></Card>
            </>
          )}
        </div>

        <Card className="border-slate-200 shadow-sm mb-6">
          <CardHeader className="p-4 md:p-5">
            <CardTitle className="text-base">Manage Content</CardTitle>
            <CardDescription>Filter and organize materials and practice papers.</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4 md:px-5 md:pb-5 pt-0">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="inline-flex items-center rounded-lg bg-[#eef4ff] p-1">
              <Button
                onClick={() => setActiveTab('materials')}
                variant={activeTab === 'materials' ? 'secondary' : 'ghost'}
                className={activeTab === 'materials' ? 'text-[#00288e]' : 'text-slate-600 hover:text-[#00288e]'}
              >
                <FileText className="w-4 h-4 inline mr-2" />
                Teaching Materials
              </Button>
              <Button
                onClick={() => setActiveTab('papers')}
                variant={activeTab === 'papers' ? 'secondary' : 'ghost'}
                className={activeTab === 'papers' ? 'text-[#00288e]' : 'text-slate-600 hover:text-[#00288e]'}
              >
                <ClipboardList className="w-4 h-4 inline mr-2" />
                Practice Papers
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setViewMode('grid')}
                size="icon-sm"
                variant={viewMode === 'grid' ? 'secondary' : 'outline'}
                className={viewMode === 'grid' ? 'text-[#00288e]' : 'text-slate-600'}
              >
                <Grid className="w-4 h-4" />
              </Button>
              <Button
                onClick={() => setViewMode('list')}
                size="icon-sm"
                variant={viewMode === 'list' ? 'secondary' : 'outline'}
                className={viewMode === 'list' ? 'text-[#00288e]' : 'text-slate-600'}
              >
                <ListIcon className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <Input
                type="text"
                placeholder={`Search ${activeTab === 'materials' ? 'materials' : 'papers'}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-slate-50 focus:bg-white"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:border-[#b8c4ff] focus:outline-none focus:ring-2 focus:ring-[#dde1ff]"
            >
              <option value="all">All Status</option>
              <option value="draft">Drafts</option>
              {activeTab === 'materials' && <option value="scheduled">Scheduled</option>}
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
            {activeTab === 'materials' && (
              <select
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:border-[#b8c4ff] focus:outline-none focus:ring-2 focus:ring-[#dde1ff]"
              >
                <option value="all">All Subjects</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
          </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader className="w-8 h-8 animate-spin text-[#1e40af]" />
          </div>
        ) : activeTab === 'materials' ? (
          materials.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-14 text-center">
              <FileText className="w-11 h-11 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 mb-4">No materials yet</p>
              <Button
                onClick={() => {
                  setEditingMaterial(null);
                  setShowEditor(true);
                }}
                className="bg-[#00288e] hover:bg-[#001f6f]"
              >
                Create First Material
              </Button>
            </div>
          ) : (
            <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4' : 'space-y-4'}>
              {materials.map(material => (
                <div key={material._id}>
                  <MaterialCard material={material} />
                </div>
              ))}
            </div>
          )
        ) : (
          papers.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-14 text-center">
              <ClipboardList className="w-11 h-11 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 mb-4">No practice papers yet</p>
              <Button
                onClick={() => setShowPaperBuilder(true)}
                className="bg-[#00288e] hover:bg-[#001f6f]"
              >
                Create First Paper
              </Button>
            </div>
          ) : (
            <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4' : 'space-y-4'}>
              {papers.map(paper => (
                <div key={paper._id}>
                  <PaperCard paper={paper} />
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default AIPoweredTeaching;
