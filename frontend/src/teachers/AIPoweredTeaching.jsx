import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Trash2,
  FileText,
  Loader,
  BookOpen,
  FileCheck,
  Zap,
  Grid,
  List as ListIcon,
  ClipboardList,
  RefreshCw,
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

  const [loading, setLoading] = useState(true);
  const [allocationsLoading, setAllocationsLoading] = useState(false);
  const [allocations, setAllocations] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [papers, setPapers] = useState([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [viewMode, setViewMode] = useState('grid');

  const [activeTab, setActiveTab] = useState('materials');
  const [showEditor, setShowEditor] = useState(false);
  const [showPaperBuilder, setShowPaperBuilder] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);

  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [quickDraftTitle, setQuickDraftTitle] = useState('');

  const token = localStorage.getItem('token');
  const authHeaders = useMemo(() => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }), [token]);

  const allocationOptions = useMemo(() => {
    return allocations.map((a, idx) => ({
      key: `${a.classId?._id || a.classId || 'class'}:${a.sectionId?._id || a.sectionId || 'section'}:${a.subjectId?._id || a.subjectId || idx}`,
      classId: a.classId?._id || a.classId || '',
      sectionId: a.sectionId?._id || a.sectionId || '',
      subjectId: a.subjectId?._id || a.subjectId || '',
      className: a.classId?.name || a.className || 'Class',
      sectionName: a.sectionId?.name || a.sectionName || 'Section',
      subjectName: a.subjectId?.name || a.subjectName || 'Subject',
    }));
  }, [allocations]);

  const selectedAllocationKey = useMemo(() => {
    const selected = allocationOptions.find((opt) => (
      opt.classId === selectedClassId &&
      opt.sectionId === selectedSectionId &&
      opt.subjectId === selectedSubjectId
    ));
    return selected?.key || '';
  }, [allocationOptions, selectedClassId, selectedSectionId, selectedSubjectId]);

  const activeContextLabel = useMemo(() => {
    const active = allocationOptions.find((opt) => opt.key === selectedAllocationKey);
    return active ? `${active.className}-${active.sectionName} • ${active.subjectName}` : 'No allocation selected';
  }, [allocationOptions, selectedAllocationKey]);

  const subjects = useMemo(() => {
    const seen = new Set();
    return allocations
      .filter((a) => {
        const id = a.subjectId?._id;
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      })
      .map((a) => ({
        id: a.subjectId?._id,
        name: a.subjectId?.name,
      }));
  }, [allocations]);

  const onAllocationChange = (key) => {
    const next = allocationOptions.find((opt) => opt.key === key);
    if (!next) return;
    setSelectedClassId(next.classId);
    setSelectedSectionId(next.sectionId);
    setSelectedSubjectId(next.subjectId);
    setSubjectFilter(next.subjectId || 'all');
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setSubjectFilter(selectedSubjectId || 'all');
  };

  const fetchAllocations = async () => {
    try {
      setAllocationsLoading(true);
      const response = await fetch(`${API_BASE}/api/teacher/dashboard/allocations`, { headers: authHeaders });
      if (!response.ok) throw new Error('Failed to fetch allocations');

      const data = await response.json();
      const next = data.data || [];
      setAllocations(next);

      if (next.length > 0) {
        const first = next[0];
        setSelectedClassId(first.classId?._id || first.classId || '');
        setSelectedSectionId(first.sectionId?._id || first.sectionId || '');
        setSelectedSubjectId(first.subjectId?._id || first.subjectId || '');
        setSubjectFilter(first.subjectId?._id || 'all');
      }
    } catch (err) {
      console.error('Error fetching allocations:', err);
      toast.error('Failed to load class allocations');
    } finally {
      setAllocationsLoading(false);
    }
  };

  const fetchMaterials = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (subjectFilter !== 'all') params.append('subjectId', subjectFilter);
      if (selectedClassId) params.append('classId', selectedClassId);
      if (searchQuery) params.append('search', searchQuery);

      const response = await fetch(`${API_BASE}/api/teaching-materials?${params}`, { headers: authHeaders });
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

  const fetchPapers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (selectedClassId) params.append('classId', selectedClassId);
      if (searchQuery) params.append('search', searchQuery);

      const response = await fetch(`${API_BASE}/api/practice-papers/teacher?${params}`, { headers: authHeaders });
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

  useEffect(() => {
    fetchAllocations();
  }, [API_BASE, authHeaders]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (activeTab === 'materials') fetchMaterials();
      else fetchPapers();
    }, 250);
    return () => clearTimeout(debounceTimer);
  }, [API_BASE, authHeaders, activeTab, statusFilter, subjectFilter, selectedClassId, searchQuery]);

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this material?')) return;
    try {
      const response = await fetch(`${API_BASE}/api/teaching-materials/${id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      if (!response.ok) throw new Error('Failed to delete');
      setMaterials((prev) => prev.filter((m) => m._id !== id));
      toast.success('Material deleted');
    } catch {
      toast.error('Failed to delete material');
    }
  };

  const handlePublish = async (id) => {
    try {
      const response = await fetch(`${API_BASE}/api/teaching-materials/${id}/publish`, {
        method: 'POST',
        headers: authHeaders,
      });
      if (!response.ok) throw new Error('Failed to publish');
      setMaterials((prev) => prev.map((m) => (m._id === id ? { ...m, status: 'published', publishedAt: new Date() } : m)));
      toast.success('Material published');
    } catch {
      toast.error('Failed to publish material');
    }
  };

  const handleDeletePaper = async (id) => {
    if (!window.confirm('Are you sure you want to delete this practice paper?')) return;
    try {
      const response = await fetch(`${API_BASE}/api/practice-papers/${id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      if (!response.ok) throw new Error('Failed to delete');
      setPapers((prev) => prev.filter((p) => p._id !== id));
      toast.success('Practice paper deleted');
    } catch {
      toast.error('Failed to delete practice paper');
    }
  };

  const handlePublishPaper = async (id) => {
    try {
      const response = await fetch(`${API_BASE}/api/practice-papers/${id}/publish`, {
        method: 'POST',
        headers: authHeaders,
      });
      if (!response.ok) throw new Error('Failed to publish');
      setPapers((prev) => prev.map((p) => (p._id === id ? { ...p, status: 'published', publishedAt: new Date() } : p)));
      toast.success('Practice paper published');
    } catch {
      toast.error('Failed to publish practice paper');
    }
  };

  const openQuickCreateMaterial = () => {
    if (!selectedClassId || !selectedSectionId) {
      toast.error('Please select class context first');
      return;
    }
    setEditingMaterial({
      title: quickDraftTitle.trim(),
      typeLabel: 'Study Material',
      category: 'theory',
      priority: 'medium',
      difficulty: 'intermediate',
      tags: [],
      attachments: [],
      status: 'draft',
    });
    setShowEditor(true);
  };

  const MaterialCard = ({ material }) => (
    <Card className="border-slate-200 transition-all hover:border-blue-200 hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-[15px] text-slate-900 line-clamp-2">{material.title}</h3>
          <div className="flex gap-2">
            {material.status === 'draft' && (
              <Button onClick={() => handlePublish(material._id)} size="icon-sm" variant="ghost" className="text-blue-700 hover:bg-blue-50" title="Publish">
                <FileCheck className="w-4 h-4" />
              </Button>
            )}
            <Button onClick={() => handleDelete(material._id)} size="icon-sm" variant="ghost" className="text-red-600 hover:bg-red-50" title="Delete">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <p className="text-sm text-slate-600 line-clamp-2 mb-3">{material.content?.replace(/<[^>]*>/g, '')}</p>

        <div className="flex flex-wrap gap-2 mb-3">
          <Badge variant={material.status === 'published' ? 'success' : material.status === 'scheduled' ? 'secondary' : 'muted'}>{material.status}</Badge>
          {material.attachments?.length > 0 && <Badge variant="warning">{material.attachments.length} file(s)</Badge>}
        </div>

        <div className="text-xs text-slate-500 space-y-0.5">
          <p>{material.subjectName} • {material.className}-{material.sectionName}</p>
          <p>{new Date(material.createdAt).toLocaleDateString()}</p>
        </div>
      </CardContent>
    </Card>
  );

  const PaperCard = ({ paper }) => (
    <Card className="border-slate-200 transition-all hover:border-blue-200 hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-[15px] text-slate-900 line-clamp-2">{paper.title}</h3>
          <div className="flex gap-2">
            {paper.status === 'draft' && (
              <Button onClick={() => handlePublishPaper(paper._id)} size="icon-sm" variant="ghost" className="text-blue-700 hover:bg-blue-50" title="Publish">
                <FileCheck className="w-4 h-4" />
              </Button>
            )}
            <Button onClick={() => handleDeletePaper(paper._id)} size="icon-sm" variant="ghost" className="text-red-600 hover:bg-red-50" title="Delete">
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
          <Badge variant={paper.status === 'published' ? 'success' : paper.status === 'draft' ? 'muted' : 'warning'}>{paper.status}</Badge>
          <Badge variant={paper.difficulty === 'hard' ? 'destructive' : paper.difficulty === 'easy' ? 'secondary' : 'warning'}>{paper.difficulty}</Badge>
        </div>

        <div className="text-xs text-slate-500 space-y-0.5">
          <p>{paper.className}-{paper.sectionName}</p>
          <p>{new Date(paper.createdAt).toLocaleDateString()}</p>
        </div>
      </CardContent>
    </Card>
  );

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
            setMaterials((prev) => {
              const idx = prev.findIndex((m) => m._id === material._id);
              if (idx >= 0) {
                const updated = [...prev];
                updated[idx] = material;
                return updated;
              }
              return [material, ...prev];
            });
            setShowEditor(false);
            setEditingMaterial(null);
            setQuickDraftTitle('');
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

  if (showPaperBuilder) {
    return (
      <div className="p-6">
        <Button variant="outline" onClick={() => setShowPaperBuilder(false)} className="mb-4">
          ← Back
        </Button>
        <PracticePaperBuilder
          classId={selectedClassId}
          sectionId={selectedSectionId}
          onSave={(paper) => {
            setPapers((prev) => [paper, ...prev]);
            setShowPaperBuilder(false);
            toast.success('Practice paper created!');
          }}
          onCancel={() => setShowPaperBuilder(false)}
        />
      </div>
    );
  }

  const totalCount = activeTab === 'materials' ? materials.length : papers.length;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#eef4ff_0%,_#f8f9ff_55%,_#ffffff_100%)] text-[#121c28] font-['Lexend']">
      <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-6 md:py-8">
        <div className="mb-7 rounded-2xl border border-blue-100 bg-white/85 backdrop-blur p-5 md:p-6 shadow-sm">
          <nav className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
            <span>Teaching Tools</span>
            <span>•</span>
            <span className="text-[#00288e]">Smart Teaching</span>
          </nav>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-semibold text-[#001453] flex items-center gap-2">
                <Zap className="w-7 h-7 text-[#1e40af]" />
                Smart Teaching Workspace
              </h1>
              <p className="text-sm md:text-base text-slate-600 mt-1">
                Plan once, upload fast, publish confidently to the right student class.
              </p>
              <div className="mt-3 inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
                Active Context: {activeContextLabel}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={fetchAllocations} className="rounded-xl" disabled={allocationsLoading}>
                {allocationsLoading ? <Loader className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Refresh
              </Button>
              <Button variant="outline" onClick={() => navigate('/teacher/smart-teaching/lesson-planner-wizard')} className="rounded-xl">
                <BookOpen className="w-4 h-4" />
                Planner Wizard
              </Button>
            </div>
          </div>
        </div>

        <Card className="border-slate-200 shadow-sm mb-6">
          <CardHeader className="p-4 md:p-5">
            <CardTitle className="text-base">Teaching Context</CardTitle>
            <CardDescription>Select allocation once, then create and publish content in fewer steps.</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4 md:px-5 md:pb-5 pt-0">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-12 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Workflow: Select allocation → Quick add title → Create content → Publish.
              </div>
              <div className="md:col-span-4">
                <label className="block text-xs font-medium text-slate-600 mb-1">Class • Section • Subject</label>
                <select
                  value={selectedAllocationKey}
                  onChange={(e) => onAllocationChange(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:border-[#b8c4ff] focus:outline-none focus:ring-2 focus:ring-[#dde1ff]"
                >
                  <option value="">Select allocation</option>
                  {allocationOptions.map((opt) => (
                    <option key={opt.key} value={opt.key}>{opt.className}-{opt.sectionName} • {opt.subjectName}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-4">
                <label className="block text-xs font-medium text-slate-600 mb-1">Quick Material Title</label>
                <Input
                  type="text"
                  value={quickDraftTitle}
                  onChange={(e) => setQuickDraftTitle(e.target.value)}
                  placeholder="e.g., Algebra Revision Sheet"
                  className="bg-slate-50 focus:bg-white"
                />
              </div>
              <div className="md:col-span-4 grid grid-cols-2 gap-2 items-end">
                <Button onClick={openQuickCreateMaterial} disabled={!selectedClassId} className="w-full rounded-xl bg-[#00288e] hover:bg-[#001f6f] disabled:opacity-60">
                  <Plus className="w-4 h-4" />
                  Quick Material
                </Button>
                <Button onClick={() => setShowPaperBuilder(true)} disabled={!selectedClassId} variant="outline" className="w-full rounded-xl border-blue-200 text-blue-700">
                  <ClipboardList className="w-4 h-4" />
                  Quick Paper
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {activeTab === 'materials' ? (
            <>
              <Card><CardContent className="p-4"><p className="text-xs text-slate-500 mb-2">Materials</p><p className="text-2xl font-semibold text-[#001453]">{materials.length}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-slate-500 mb-2">Published</p><p className="text-2xl font-semibold text-[#006c4a]">{materials.filter((m) => m.status === 'published').length}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-slate-500 mb-2">Drafts</p><p className="text-2xl font-semibold text-[#92400e]">{materials.filter((m) => m.status === 'draft').length}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-slate-500 mb-2">Subjects</p><p className="text-2xl font-semibold text-[#001453]">{subjects.length}</p></CardContent></Card>
            </>
          ) : (
            <>
              <Card><CardContent className="p-4"><p className="text-xs text-slate-500 mb-2">Papers</p><p className="text-2xl font-semibold text-[#001453]">{papers.length}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-slate-500 mb-2">Published</p><p className="text-2xl font-semibold text-[#006c4a]">{papers.filter((p) => p.status === 'published').length}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-slate-500 mb-2">Total Questions</p><p className="text-2xl font-semibold text-[#001453]">{papers.reduce((sum, p) => sum + (p.totalQuestions || 0), 0)}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-slate-500 mb-2">Total Marks</p><p className="text-2xl font-semibold text-[#001453]">{papers.reduce((sum, p) => sum + (p.totalMarks || 0), 0)}</p></CardContent></Card>
            </>
          )}
        </div>

        <Card className="border-slate-200 shadow-sm mb-6">
          <CardHeader className="p-4 md:p-5">
            <CardTitle className="text-base">Manage Content</CardTitle>
            <CardDescription>Switch between materials and papers, then filter, search, and publish quickly.</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4 md:px-5 md:pb-5 pt-0">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="inline-flex items-center rounded-lg bg-[#eef4ff] p-1">
                <Button onClick={() => setActiveTab('materials')} variant={activeTab === 'materials' ? 'secondary' : 'ghost'} className={activeTab === 'materials' ? 'text-[#00288e]' : 'text-slate-600 hover:text-[#00288e]'}>
                  <FileText className="w-4 h-4 inline mr-2" />Teaching Materials
                </Button>
                <Button onClick={() => setActiveTab('papers')} variant={activeTab === 'papers' ? 'secondary' : 'ghost'} className={activeTab === 'papers' ? 'text-[#00288e]' : 'text-slate-600 hover:text-[#00288e]'}>
                  <ClipboardList className="w-4 h-4 inline mr-2" />Practice Papers
                </Button>
              </div>
              <div className="flex gap-2">
                <Button onClick={clearFilters} size="sm" variant="outline" className="text-slate-600">Reset Filters</Button>
                <Button onClick={() => setViewMode('grid')} size="icon-sm" variant={viewMode === 'grid' ? 'secondary' : 'outline'} className={viewMode === 'grid' ? 'text-[#00288e]' : 'text-slate-600'}>
                  <Grid className="w-4 h-4" />
                </Button>
                <Button onClick={() => setViewMode('list')} size="icon-sm" variant={viewMode === 'list' ? 'secondary' : 'outline'} className={viewMode === 'list' ? 'text-[#00288e]' : 'text-slate-600'}>
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
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:border-[#b8c4ff] focus:outline-none focus:ring-2 focus:ring-[#dde1ff]">
                <option value="all">All Status</option>
                <option value="draft">Drafts</option>
                {activeTab === 'materials' && <option value="scheduled">Scheduled</option>}
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
              {activeTab === 'materials' && (
                <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:border-[#b8c4ff] focus:outline-none focus:ring-2 focus:ring-[#dde1ff]">
                  <option value="all">All Subjects</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center py-16"><Loader className="w-8 h-8 animate-spin text-[#1e40af]" /></div>
        ) : totalCount === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-14 text-center">
            {activeTab === 'materials' ? <FileText className="w-11 h-11 text-slate-300 mx-auto mb-4" /> : <ClipboardList className="w-11 h-11 text-slate-300 mx-auto mb-4" />}
            <p className="text-slate-700 mb-2 font-medium">No {activeTab} found for current filters</p>
            <p className="text-slate-500 mb-4 text-sm">Try resetting filters or create new content for the selected class context.</p>
            <div className="flex items-center justify-center gap-2">
              <Button onClick={clearFilters} variant="outline">Reset Filters</Button>
              {activeTab === 'materials' ? (
                <Button onClick={openQuickCreateMaterial} className="bg-[#00288e] hover:bg-[#001f6f]">Create Material</Button>
              ) : (
                <Button onClick={() => setShowPaperBuilder(true)} className="bg-[#00288e] hover:bg-[#001f6f]">Create Paper</Button>
              )}
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {(activeTab === 'materials' ? materials : papers).map((item) => (
              <div key={item._id}>{activeTab === 'materials' ? <MaterialCard material={item} /> : <PaperCard paper={item} />}</div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
            {(activeTab === 'materials' ? materials : papers).map((item) => (
              <div key={item._id} className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{item.title}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {activeTab === 'materials'
                      ? `${item.subjectName || 'Subject'} • ${item.className || ''}-${item.sectionName || ''}`
                      : `${item.className || ''}-${item.sectionName || ''} • ${item.totalQuestions || 0} questions`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={item.status === 'published' ? 'success' : item.status === 'draft' ? 'muted' : 'secondary'}>{item.status}</Badge>
                  {item.status === 'draft' && (
                    <Button size="sm" variant="outline" onClick={() => activeTab === 'materials' ? handlePublish(item._id) : handlePublishPaper(item._id)}>
                      <FileCheck className="w-4 h-4" /> Publish
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="text-red-600 border-red-200" onClick={() => activeTab === 'materials' ? handleDelete(item._id) : handleDeletePaper(item._id)}>
                    <Trash2 className="w-4 h-4" /> Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AIPoweredTeaching;
