import React, { useState } from 'react';
import { Upload, X, FileText, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import QuillEditor from '../../utils/quill';
import toast from 'react-hot-toast';

const RichTextMaterialEditor = ({ material, classId, sectionId, subjectId, chapterId, chapterTitle, onSave, onCancel }) => {
  const [title, setTitle] = useState(material?.title || (chapterTitle ? `${chapterTitle} - Material` : ''));
  const [content, setContent] = useState(material?.content || '');
  const [typeLabel, setTypeLabel] = useState(material?.typeLabel || 'Study Material');
  const [category, setCategory] = useState(material?.category || 'theory');
  const [priority, setPriority] = useState(material?.priority || 'medium');
  const [difficulty, setDifficulty] = useState(material?.difficulty || 'intermediate');
  const [tags, setTags] = useState((material?.tags || []).join(', '));
  const [attachments, setAttachments] = useState(material?.attachments || []);
  const [status, setStatus] = useState(material?.status || 'draft');
  const [scheduledFor, setScheduledFor] = useState(material?.scheduledFor?.split('T')[0] || '');
  const [scheduledTime, setScheduledTime] = useState(material?.scheduledFor?.split('T')[1]?.slice(0, 5) || '09:00');

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    if (!title.trim()) {
      newErrors.title = 'Title is required';
    }
    if (!classId || !sectionId) {
      newErrors.target = 'Class and section are required. Please select an allocated class/section.';
    }

    if (status === 'scheduled') {
      if (!scheduledFor) {
        newErrors.scheduledFor = 'Schedule date is required for scheduled materials';
      } else {
        const scheduledDate = new Date(`${scheduledFor}T${scheduledTime}`);
        if (scheduledDate <= new Date()) {
          newErrors.scheduledFor = 'Scheduled date must be in the future';
        }
      }
    }

    if (attachments.length > 0 && !attachments.every(a => a.url)) {
      newErrors.attachments = 'Some attachments are still uploading';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle file upload
  const handleFileUpload = async (files) => {
    if (attachments.length + files.length > 10) {
      toast.error('Maximum 10 attachments allowed');
      return;
    }

    setUploading(true);

    try {
      for (const file of files) {
        // Check file size (10MB max per file)
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name} exceeds 10MB limit`);
          continue;
        }

        // Add temporary attachment with loading state
        const tempAttachment = {
          name: file.name,
          size: file.size,
          type: file.type,
          url: null,
          isUploading: true
        };

        setAttachments(prev => [...prev, tempAttachment]);

        // Upload to Cloudinary
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', 'class_materials');
        formData.append('tags', 'study_material,smart_teaching,teaching_material');

        try {
          const response = await fetch(`${import.meta.env.VITE_API_URL}/api/uploads/cloudinary/single`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: formData
          });

          if (!response.ok) throw new Error('Upload failed');

          const data = await response.json();
          const uploadedFile = data.files[0];

          // Update attachment with URL
          setAttachments(prev =>
            prev.map(att =>
              att.name === file.name && !att.url
                ? {
                    name: uploadedFile.originalName || file.name,
                    url: uploadedFile.secure_url,
                    size: file.size,
                    type: file.type,
                    cloudinaryPublicId: uploadedFile.public_id,
                    isUploading: false
                  }
                : att
            )
          );

          toast.success(`${file.name} uploaded`);
        } catch (err) {
          console.error('Upload error:', err);
          setAttachments(prev => prev.filter(a => a.name !== file.name));
          toast.error(`Failed to upload ${file.name}`);
        }
      }
    } finally {
      setUploading(false);
    }
  };

  // Handle drag and drop
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.add('bg-blue-50', 'border-blue-400');
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('bg-blue-50', 'border-blue-400');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('bg-blue-50', 'border-blue-400');

    const files = Array.from(e.dataTransfer.files);
    handleFileUpload(files);
  };

  // Remove attachment
  const removeAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // Handle save
  const handleSave = async (saveStatus = 'draft') => {
    if (!validateForm()) {
      toast.error('Please fix the errors');
      return;
    }

    setSaving(true);

    try {
      const materialData = {
        title: title.trim(),
        content,
        typeLabel,
        category,
        priority,
        difficulty,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        attachments: attachments.filter(a => a.url), // Only include uploaded attachments
        status: saveStatus,
        classId,
        sectionId,
        subjectId: subjectId || undefined,
        chapterId: chapterId || undefined,
        chapterTitle: chapterTitle || undefined
      };

      // Add scheduling info if needed
      if (saveStatus === 'scheduled' && scheduledFor) {
        materialData.scheduledFor = `${scheduledFor}T${scheduledTime}:00`;
        materialData.status = 'scheduled';
      }

      const method = material?._id ? 'PATCH' : 'POST';
      const endpoint = material?._id
        ? `${import.meta.env.VITE_API_URL}/api/teaching-materials/${material._id}`
        : `${import.meta.env.VITE_API_URL}/api/teaching-materials`;

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(materialData)
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.message || 'Failed to save material');
      }

      toast.success(data.message || 'Material saved successfully');

      if (onSave) {
        onSave(data.material);
      }
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Failed to save material');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-6xl text-black">
      <h2 className="text-2xl font-bold mb-6">
        {material ? 'Edit Material' : 'Create New Study Material'}
      </h2>

      {errors.target && (
        <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errors.target}
        </p>
      )}

      {/* Title */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Title *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          placeholder="Enter material title"
        />
        {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title}</p>}
      </div>

      {/* Rich Text Editor */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Content</label>
        <div className="border rounded-lg overflow-hidden">
          <QuillEditor
            value={content}
            onChange={setContent}
            placeholder="Write your material content here..."
            idPrefix="material-editor"
          />
        </div>
      </div>

      {/* File Attachments */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Attachments</label>

        {/* Upload Area */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 transition"
        >
          <input
            type="file"
            multiple
            onChange={(e) => handleFileUpload(Array.from(e.target.files))}
            disabled={uploading}
            className="hidden"
            id="file-upload"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.webp,.txt"
          />
          <label htmlFor="file-upload" className="cursor-pointer block">
            <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm font-medium">Drag files or click to upload</p>
            <p className="text-xs text-gray-500 mt-1">PDF, images, Word, Excel, PowerPoint (max 10MB each)</p>
          </label>
        </div>

        {/* Attachments List */}
        {attachments.length > 0 && (
          <div className="mt-3 space-y-2">
            {attachments.map((att, idx) => (
              <div key={idx} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{att.name}</p>
                    <p className="text-xs text-gray-500">{(att.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  {att.isUploading && <Loader className="w-4 h-4 animate-spin text-blue-500 flex-shrink-0" />}
                  {att.url && !att.isUploading && <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />}
                </div>
                <button
                  onClick={() => removeAttachment(idx)}
                  disabled={att.isUploading}
                  className="ml-2 text-red-500 hover:text-red-700 disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Settings Row 1 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium mb-1">Type Label</label>
          <input
            type="text"
            value={typeLabel}
            onChange={(e) => setTypeLabel(e.target.value)}
            className="w-full px-3 py-2 border rounded text-sm"
            placeholder="e.g., Homework"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{ colorScheme: 'light' }}
            className="w-full rounded border px-3 py-2 text-sm text-slate-900 bg-white dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="theory" className="text-slate-900">Theory</option>
            <option value="practice" className="text-slate-900">Practice</option>
            <option value="revision" className="text-slate-900">Revision</option>
            <option value="assessment" className="text-slate-900">Assessment</option>
            <option value="reference" className="text-slate-900">Reference</option>
            <option value="general" className="text-slate-900">General</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Priority</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            style={{ colorScheme: 'light' }}
            className="w-full rounded border px-3 py-2 text-sm text-slate-900 bg-white dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="low" className="text-slate-900">Low</option>
            <option value="medium" className="text-slate-900">Medium</option>
            <option value="high" className="text-slate-900">High</option>
            <option value="urgent" className="text-slate-900">Urgent</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Difficulty</label>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            style={{ colorScheme: 'light' }}
            className="w-full rounded border px-3 py-2 text-sm text-slate-900 bg-white dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="beginner" className="text-slate-900">Beginner</option>
            <option value="intermediate" className="text-slate-900">Intermediate</option>
            <option value="advanced" className="text-slate-900">Advanced</option>
          </select>
        </div>
      </div>

      {/* Tags */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Tags (comma-separated)</label>
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          className="w-full px-3 py-2 border rounded text-sm"
          placeholder="e.g., algebra, chapter-1, important"
        />
      </div>

      {/* Publishing Options */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <h3 className="font-medium mb-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          Publishing Options
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              value="draft"
              checked={status === 'draft'}
              onChange={(e) => setStatus(e.target.value)}
              className="w-4 h-4"
            />
            <span className="text-sm">Draft (save for later)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              value="scheduled"
              checked={status === 'scheduled'}
              onChange={(e) => setStatus(e.target.value)}
              className="w-4 h-4"
            />
            <span className="text-sm">Schedule for later</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              value="published"
              checked={status === 'published'}
              onChange={(e) => setStatus(e.target.value)}
              className="w-4 h-4"
            />
            <span className="text-sm">Publish now</span>
          </label>
        </div>

        {status === 'scheduled' && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <input
                type="date"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                className="w-full px-3 py-2 border rounded text-sm"
              />
            </div>
            <div>
              <input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-full px-3 py-2 border rounded text-sm"
              />
            </div>
            {errors.scheduledFor && <p className="text-red-500 text-xs col-span-2">{errors.scheduledFor}</p>}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 justify-end pt-4 border-t">
        {onCancel && (
          <button
            onClick={onCancel}
            disabled={saving || uploading}
            className="px-6 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
        )}
        <button
          onClick={() => handleSave('draft')}
          disabled={saving || uploading}
          className="px-6 py-2 border border-blue-500 text-blue-600 rounded-lg hover:bg-blue-50 disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? <Loader className="w-4 h-4 animate-spin" /> : null}
          Save as Draft
        </button>
        <button
          onClick={() => handleSave(status === 'published' ? 'published' : status)}
          disabled={saving || uploading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? <Loader className="w-4 h-4 animate-spin" /> : null}
          {status === 'scheduled' ? 'Schedule' : 'Publish'}
        </button>
      </div>
    </div>
  );
};

export default RichTextMaterialEditor;
