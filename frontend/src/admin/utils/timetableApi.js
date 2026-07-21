const API_HOST = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const API_BASE = API_HOST ? `${API_HOST}/api` : '/api';

// Helper to get token from localStorage
const getToken = () => {
  return typeof window !== 'undefined' ? window.localStorage?.getItem('token') : null;
};

// Helper to create headers
const createHeaders = (includeContentType = false) => {
  const headers = {
    'Authorization': `Bearer ${getToken()}`
  };
  if (includeContentType) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
};

// Helper to handle API responses
const handleResponse = async (response) => {
  const contentType = response.headers.get('content-type');

  // Check if response is HTML (likely a 404 or error page)
  if (contentType && contentType.includes('text/html')) {
    throw new Error(`API returned HTML instead of JSON. URL: ${response.url}, Status: ${response.status}`);
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: `Request failed with status ${response.status}`
    }));
    throw new Error(error.error || error.message || `Request failed: ${response.status}`);
  }

  return response.json().catch(err => {
    throw new Error(`Failed to parse JSON response from ${response.url}: ${err.message}`);
  });
};

// Timetable API
export const timetableApi = {
  // Fetch all timetables for school
  getAll: async () => {
    try {
      const res = await fetch(`${API_BASE}/timetable/all`, {
        headers: createHeaders()
      });
      return handleResponse(res);
    } catch (error) {
      console.error('Error fetching all timetables:', error);
      throw error;
    }
  },

  // Get single timetable by class and section
  get: async (classId, sectionId) => {
    try {
      const params = new URLSearchParams({ classId });
      if (sectionId) params.append('sectionId', sectionId);

      const res = await fetch(`${API_BASE}/timetable?${params.toString()}`, {
        headers: createHeaders()
      });
      return handleResponse(res);
    } catch (error) {
      console.error('Error fetching timetable:', error);
      throw error;
    }
  },

  // Create or update timetable
  save: async (data) => {
    try {
      const res = await fetch(`${API_BASE}/timetable`, {
        method: 'POST',
        headers: createHeaders(true),
        body: JSON.stringify(data)
      });
      return handleResponse(res);
    } catch (error) {
      console.error('Error saving timetable:', error);
      throw error;
    }
  },

  // Create or update timetable entries for a single day
  saveDay: async (data) => {
    try {
      const res = await fetch(`${API_BASE}/timetable/day`, {
        method: 'POST',
        headers: createHeaders(true),
        body: JSON.stringify(data)
      });
      return handleResponse(res);
    } catch (error) {
      console.error('Error saving timetable day:', error);
      throw error;
    }
  },

  // Delete timetable
  delete: async (id) => {
    try {
      const res = await fetch(`${API_BASE}/timetable/${id}`, {
        method: 'DELETE',
        headers: createHeaders()
      });
      return handleResponse(res);
    } catch (error) {
      console.error('Error deleting timetable:', error);
      throw error;
    }
  },

  // Delete timetable entries for a single day
  deleteDay: async (data) => {
    try {
      const params = new URLSearchParams();
      if (data?.classId) params.append('classId', String(data.classId));
      if (data?.sectionId) params.append('sectionId', String(data.sectionId));
      if (data?.dayOfWeek) params.append('dayOfWeek', String(data.dayOfWeek));
      const query = params.toString();
      const res = await fetch(`${API_BASE}/timetable/day${query ? `?${query}` : ''}`, {
        method: 'DELETE',
        headers: createHeaders()
      });
      return handleResponse(res);
    } catch (error) {
      console.error('Error deleting timetable day:', error);
      throw error;
    }
  },

  // Validate conflicts
  validateConflicts: async (data) => {
    try {
      const res = await fetch(`${API_BASE}/timetable/validate-conflicts`, {
        method: 'POST',
        headers: createHeaders(true),
        body: JSON.stringify(data)
      });
      return handleResponse(res);
    } catch (error) {
      console.error('Error validating conflicts:', error);
      throw error;
    }
  },

  // Auto-generate timetable
  autoGenerate: async (data) => {
    try {
      const res = await fetch(`${API_BASE}/timetable/auto-generate`, {
        method: 'POST',
        headers: createHeaders(true),
        body: JSON.stringify(data)
      });
      return handleResponse(res);
    } catch (error) {
      console.error('Error auto-generating timetable:', error);
      throw error;
    }
  },

  // Get teacher's schedule
  getTeacherSchedule: async (teacherId) => {
    try {
      const res = await fetch(`${API_BASE}/timetable/teacher/${teacherId}`, {
        headers: createHeaders()
      });
      return handleResponse(res);
    } catch (error) {
      console.error('Error fetching teacher schedule:', error);
      throw error;
    }
  },

  // Delete all timetables for the school
  deleteAll: async () => {
    try {
      const res = await fetch(`${API_BASE}/timetable/all`, {
        method: 'DELETE',
        headers: createHeaders()
      });
      return handleResponse(res);
    } catch (error) {
      console.error('Error deleting all timetables:', error);
      throw error;
    }
  }
};

// Academic Data API (for dropdowns)
export const academicApi = {
  // Get all academic years
  getYears: async () => {
    try {
      const res = await fetch(`${API_BASE}/academic/years`, {
        headers: createHeaders()
      });
      return handleResponse(res);
    } catch (error) {
      console.error('Error fetching academic years:', error);
      throw error;
    }
  },

  // Get all buildings
  getBuildings: async () => {
    try {
      const res = await fetch(`${API_BASE}/academic/buildings`, {
        headers: createHeaders()
      });
      return handleResponse(res);
    } catch (error) {
      console.error('Error fetching buildings:', error);
      throw error;
    }
  },

  // Create building
  createBuilding: async (payload) => {
    try {
      const res = await fetch(`${API_BASE}/academic/buildings`, {
        method: 'POST',
        headers: createHeaders(true),
        body: JSON.stringify(payload || {})
      });
      return handleResponse(res);
    } catch (error) {
      console.error('Error creating building:', error);
      throw error;
    }
  },

  // Delete building
  deleteBuilding: async (buildingId) => {
    try {
      const res = await fetch(`${API_BASE}/academic/buildings/${buildingId}`, {
        method: 'DELETE',
        headers: createHeaders()
      });
      return handleResponse(res);
    } catch (error) {
      console.error('Error deleting building:', error);
      throw error;
    }
  },

  // Get all classes
  getClasses: async () => {
    try {
      const res = await fetch(`${API_BASE}/academic/classes`, {
        headers: createHeaders()
      });
      return handleResponse(res);
    } catch (error) {
      console.error('Error fetching classes:', error);
      throw error;
    }
  },

  // Get sections for a class
  getSections: async (classId) => {
    try {
      const params = classId ? `?classId=${classId}` : '';
      const res = await fetch(`${API_BASE}/academic/sections${params}`, {
        headers: createHeaders()
      });
      return handleResponse(res);
    } catch (error) {
      console.error('Error fetching sections:', error);
      throw error;
    }
  },

  // Get subjects for a class
  getSubjects: async (classId) => {
    try {
      const params = classId ? `?classId=${classId}` : '';
      const res = await fetch(`${API_BASE}/academic/subjects${params}`, {
        headers: createHeaders()
      });
      return handleResponse(res);
    } catch (error) {
      console.error('Error fetching subjects:', error);
      throw error;
    }
  },

  // Get all floors
  getFloors: async (buildingId) => {
    try {
      const params = buildingId ? `?buildingId=${encodeURIComponent(buildingId)}` : '';
      const res = await fetch(`${API_BASE}/academic/floors${params}`, {
        headers: createHeaders()
      });
      return handleResponse(res);
    } catch (error) {
      console.error('Error fetching floors:', error);
      throw error;
    }
  },

  // Get all rooms (optional floor filter)
  getRooms: async (floorId) => {
    try {
      const params = floorId ? `?floorId=${encodeURIComponent(floorId)}` : '';
      const res = await fetch(`${API_BASE}/academic/rooms${params}`, {
        headers: createHeaders()
      });
      return handleResponse(res);
    } catch (error) {
      console.error('Error fetching rooms:', error);
      throw error;
    }
  },

  // Create floor
  createFloor: async (payload) => {
    try {
      const res = await fetch(`${API_BASE}/academic/floors`, {
        method: 'POST',
        headers: createHeaders(true),
        body: JSON.stringify(payload || {})
      });
      return handleResponse(res);
    } catch (error) {
      console.error('Error creating floor:', error);
      throw error;
    }
  },

  // Delete floor
  deleteFloor: async (floorId) => {
    try {
      const res = await fetch(`${API_BASE}/academic/floors/${floorId}`, {
        method: 'DELETE',
        headers: createHeaders()
      });
      return handleResponse(res);
    } catch (error) {
      console.error('Error deleting floor:', error);
      throw error;
    }
  },

  // Create room
  createRoom: async (payload) => {
    try {
      const res = await fetch(`${API_BASE}/academic/rooms`, {
        method: 'POST',
        headers: createHeaders(true),
        body: JSON.stringify(payload || {})
      });
      return handleResponse(res);
    } catch (error) {
      console.error('Error creating room:', error);
      throw error;
    }
  },

  // Delete room
  deleteRoom: async (roomId) => {
    try {
      const res = await fetch(`${API_BASE}/academic/rooms/${roomId}`, {
        method: 'DELETE',
        headers: createHeaders()
      });
      return handleResponse(res);
    } catch (error) {
      console.error('Error deleting room:', error);
      throw error;
    }
  },

  // Get all teachers
  getTeachers: async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/users/get-teachers`, {
        headers: createHeaders()
      });
      return handleResponse(res);
    } catch (error) {
      console.error('Error fetching teachers:', error);
      throw error;
    }
  }
};

// Time conversion utilities
export const convertTo24Hour = (time12h) => {
  if (!time12h) return '';

  const [time, period] = time12h.trim().split(' ');
  let [hours, minutes] = time.split(':');

  hours = parseInt(hours);

  if (period === 'PM' && hours !== 12) {
    hours += 12;
  } else if (period === 'AM' && hours === 12) {
    hours = 0;
  }

  return `${hours.toString().padStart(2, '0')}:${minutes}`;
};

export const convertTo12Hour = (time24h) => {
  if (!time24h) return '';

  let [hours, minutes] = time24h.split(':');
  hours = parseInt(hours);

  const period = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;

  return `${hours}:${minutes} ${period}`;
};

// Data transformation utilities
export const transformTimetablesToRoutines = (timetables) => {
  if (!Array.isArray(timetables)) return [];

  const routines = [];

  timetables.forEach(tt => {
    if (!tt || !tt.entries) return;

    // Group entries by day
    const byDay = {};
    tt.entries.forEach(entry => {
      if (!entry.dayOfWeek) return;

      if (!byDay[entry.dayOfWeek]) {
        byDay[entry.dayOfWeek] = [];
      }

      byDay[entry.dayOfWeek].push({
        time: `${convertTo12Hour(entry.startTime)} - ${convertTo12Hour(entry.endTime)}`,
        isBreak: Boolean(entry.isBreak),
        subject: entry.isBreak ? 'Break' : (entry.subjectId?.name || 'Unknown'),
        subjectId: entry.subjectId?._id || entry.subjectId || null,
        teacher: entry.isBreak ? '-' : (entry.teacherId?.name || '-'),
        teacherId: entry.teacherId?._id || entry.teacherId || null,
        roomId: entry.roomId?._id || entry.roomId || null,
        room: entry.room || '',
        period: entry.period
      });
    });

    // Sort periods within each day
    Object.keys(byDay).forEach(day => {
      byDay[day].sort((a, b) => (a.period || 0) - (b.period || 0));
    });

    // Create routine entry for each day
    Object.keys(byDay).forEach(day => {
      routines.push({
        id: `${tt._id}_${day}`,
        timetableId: tt._id,
        class: tt.classId?.name || '',
        classId: tt.classId?._id || tt.classId,
        section: tt.sectionId?.name || '',
        sectionId: tt.sectionId?._id || tt.sectionId,
        day,
        schedule: byDay[day]
      });
    });
  });

  return routines;
};

export const transformRoutineToTimetable = (routine, classes, sections, subjects, teachers) => {
  // Find the corresponding IDs
  const classDoc = classes.find(c => c.name === routine.class || c._id === routine.classId);
  const sectionDoc = sections.find(s => s.name === routine.section || s._id === routine.sectionId);

  if (!classDoc) {
    throw new Error('Class not found');
  }

  // Transform schedule entries
  const entries = routine.schedule
    .filter(period => period.subject !== 'Break' || !period.subject) // You can include breaks if needed
    .map((period, index) => {
      const [startTime, endTime] = period.time.split(' - ').map(t => t.trim());
      const subject = subjects.find(s => s.name === period.subject);
      const teacher = teachers.find(t => t.name === period.teacher);

      return {
        dayOfWeek: routine.day,
        period: period.period || (index + 1),
        subjectId: subject?._id,
        teacherId: teacher?._id,
        roomId: period.roomId || null,
        startTime: convertTo24Hour(startTime),
        endTime: convertTo24Hour(endTime),
        room: period.room || ''
      };
    });

  return {
    classId: classDoc._id,
    sectionId: sectionDoc?._id || null,
    entries
  };
};
