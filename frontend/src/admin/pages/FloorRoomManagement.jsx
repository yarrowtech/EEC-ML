import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2, DoorOpen, Layers, Plus, Trash2,
  ChevronRight, ChevronDown, Pencil, Check, X, Search,
} from 'lucide-react';
import { academicApi } from '../utils/timetableApi';
import Swal from 'sweetalert2';

/* ─── tiny accordion state helpers ─── */
function useSet(init = []) {
  const [set, setSet] = useState(() => new Set(init));
  const toggle = (id) =>
    setSet((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  return [set, toggle];
}

/* ─── badge ─── */
const Badge = ({ children, color = 'blue' }) => {
  const map = {
    blue:  'bg-indigo-50 text-indigo-700 ring-indigo-100',
    slate: 'bg-slate-100 text-slate-700 ring-slate-200',
    teal:  'bg-emerald-50 text-emerald-700 ring-emerald-100',
    rose:  'bg-rose-50 text-rose-600 ring-rose-200',
  };
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ${map[color]}`}>
      {children}
    </span>
  );
};

/* ─── input ─── */
const Field = ({ ...props }) => (
  <input
    {...props}
    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
  />
);

/* ─── select ─── */
const Select = ({ children, ...props }) => (
  <select
    {...props}
    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
  >
    {children}
  </select>
);

const labelCls = 'mb-1.5 block text-sm font-medium text-slate-800';
const addBtn = 'inline-flex h-[42px] items-center justify-center gap-2 rounded-xl bg-indigo-600 px-8 text-sm font-semibold text-white shadow-md shadow-indigo-200 transition hover:bg-indigo-700';

/* ════════════════════════════════════════════════════════════════════ */
const FloorRoomManagement = ({ setShowAdminHeader }) => {
  const [buildings, setBuildings] = useState([]);
  const [floors, setFloors]       = useState([]);
  const [rooms, setRooms]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState('');

  const [newBuildingName, setNewBuildingName] = useState('');
  const [newBuildingCode, setNewBuildingCode] = useState('');
  const [newFloorBuildingId, setNewFloorBuildingId] = useState('');
  const [newFloorName, setNewFloorName]       = useState('');
  const [newFloorCode, setNewFloorCode]       = useState('');
  const [newRoomFloorId, setNewRoomFloorId]   = useState('');
  const [newRoomNumber, setNewRoomNumber]     = useState('');
  const [newRoomCapacity, setNewRoomCapacity] = useState('');

  /* inline-edit state — one entity being edited at a time per type */
  const [editingBuildingId, setEditingBuildingId] = useState(null);
  const [editingBuildingForm, setEditingBuildingForm] = useState({ name: '', code: '' });
  const [editingFloorId, setEditingFloorId] = useState(null);
  const [editingFloorForm, setEditingFloorForm] = useState({ buildingId: '', name: '', floorCode: '' });
  const [editingRoomId, setEditingRoomId] = useState(null);
  const [editingRoomForm, setEditingRoomForm] = useState({ floorId: '', roomNumber: '', capacity: '' });

  /* add-card tab + structure search / filter */
  const [addTab, setAddTab] = useState('building');
  const [search, setSearch] = useState('');
  const [buildingFilter, setBuildingFilter] = useState('');

  /* accordion open state */
  const [openBuildings, toggleBuilding] = useSet([]);
  const [openFloors, toggleFloor]       = useSet([]);

  useEffect(() => { setShowAdminHeader?.(true); }, [setShowAdminHeader]);

  const loadData = async () => {
    setLoading(true); setError('');
    try {
      const [b, f, r] = await Promise.all([
        academicApi.getBuildings(),
        academicApi.getFloors(),
        academicApi.getRooms(),
      ]);
      setBuildings(Array.isArray(b) ? b : []);
      setFloors(Array.isArray(f) ? f : []);
      setRooms(Array.isArray(r) ? r : []);
    } catch (err) { setError(err.message || 'Failed to load data'); }
    finally { setLoading(false); }
  };
  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (!newFloorBuildingId && buildings.length > 0)
      setNewFloorBuildingId(String(buildings[0]._id));
  }, [buildings]);
  useEffect(() => {
    if (!newRoomFloorId && floors.length > 0)
      setNewRoomFloorId(String(floors[0]._id));
  }, [floors]);

  /* ── derived maps ── */
  const floorsByBuilding = useMemo(() => {
    const map = new Map();
    buildings.forEach((b) => map.set(String(b._id), []));
    floors.forEach((f) => {
      const bid = String(f.buildingId?._id || f.buildingId || '');
      if (!map.has(bid)) map.set(bid, []);
      map.get(bid).push(f);
    });
    map.forEach((arr) => arr.sort((a, b) => String(a.name).localeCompare(String(b.name))));
    return map;
  }, [buildings, floors]);

  const roomsByFloor = useMemo(() => {
    const map = new Map();
    floors.forEach((f) => map.set(String(f._id), []));
    rooms.forEach((r) => {
      const fid = String(r.floorId?._id || r.floorId || '');
      if (!map.has(fid)) map.set(fid, []);
      map.get(fid).push(r);
    });
    map.forEach((arr) => arr.sort((a, b) => String(a.roomNumber).localeCompare(String(b.roomNumber))));
    return map;
  }, [floors, rooms]);

  /* ── CRUD ── */
  const flash = (type, msg) => {
    if (type === 'error') { setError(msg); setSuccess(''); }
    else { setSuccess(msg); setError(''); }
  };

  const handleCreateBuilding = async () => {
    const name = newBuildingName.trim(), code = newBuildingCode.trim().toUpperCase();
    if (!name) return flash('error', 'Enter building name');
    if (!code) return flash('error', 'Enter building code');
    try {
      await academicApi.createBuilding({ name, code });
      setNewBuildingName(''); setNewBuildingCode('');
      flash('ok', 'Building created');
      await loadData();
    } catch (e) { flash('error', e.message || 'Failed'); }
  };

  const openEditBuilding = (building) => {
    setEditingBuildingId(building._id);
    setEditingBuildingForm({ name: building.name || '', code: building.code || '' });
  };

  const handleSaveBuilding = async (id) => {
    const name = editingBuildingForm.name.trim(), code = editingBuildingForm.code.trim().toUpperCase();
    if (!name) return flash('error', 'Enter building name');
    if (!code) return flash('error', 'Enter building code');
    try {
      await academicApi.updateBuilding(id, { name, code });
      setEditingBuildingId(null);
      flash('ok', 'Building updated');
      await loadData();
    } catch (e) { flash('error', e.message || 'Failed'); }
  };

  const handleDeleteBuilding = async (id) => {
    const confirm = await Swal.fire({
      icon: 'warning',
      title: 'Delete building?',
      text: 'All linked floors and rooms may also be affected.',
      showCancelButton: true,
      confirmButtonText: 'Yes, Delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#dc2626',
    });
    if (!confirm.isConfirmed) return;
    try { await academicApi.deleteBuilding(id); flash('ok', 'Building deleted'); await loadData(); }
    catch (e) { flash('error', e.message || 'Failed'); }
  };

  const handleCreateFloor = async () => {
    const bid = newFloorBuildingId.trim(), name = newFloorName.trim(), fc = newFloorCode.trim().toUpperCase();
    if (!bid) return flash('error', 'Select a building');
    if (!name) return flash('error', 'Enter floor name');
    if (!fc)   return flash('error', 'Enter floor code');
    try {
      await academicApi.createFloor({ buildingId: bid, name, floorCode: fc });
      setNewFloorName(''); setNewFloorCode('');
      flash('ok', 'Floor created');
      await loadData();
    } catch (e) { flash('error', e.message || 'Failed'); }
  };

  const openEditFloor = (floor) => {
    setEditingFloorId(floor._id);
    setEditingFloorForm({
      buildingId: String(floor.buildingId?._id || floor.buildingId || ''),
      name: floor.name || '',
      floorCode: floor.floorCode || '',
    });
  };

  const handleSaveFloor = async (id) => {
    const bid = editingFloorForm.buildingId.trim(), name = editingFloorForm.name.trim(), fc = editingFloorForm.floorCode.trim().toUpperCase();
    if (!bid) return flash('error', 'Select a building');
    if (!name) return flash('error', 'Enter floor name');
    if (!fc)   return flash('error', 'Enter floor code');
    try {
      await academicApi.updateFloor(id, { buildingId: bid, name, floorCode: fc });
      setEditingFloorId(null);
      flash('ok', 'Floor updated');
      await loadData();
    } catch (e) { flash('error', e.message || 'Failed'); }
  };

  const handleDeleteFloor = async (id) => {
    const confirm = await Swal.fire({
      icon: 'warning',
      title: 'Delete floor?',
      text: 'Rooms under this floor may also be affected.',
      showCancelButton: true,
      confirmButtonText: 'Yes, Delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#dc2626',
    });
    if (!confirm.isConfirmed) return;
    try { await academicApi.deleteFloor(id); flash('ok', 'Floor deleted'); await loadData(); }
    catch (e) { flash('error', e.message || 'Failed'); }
  };

  const handleCreateRoom = async () => {
    const fid = newRoomFloorId.trim(), rn = newRoomNumber.trim();
    if (!fid) return flash('error', 'Select a floor');
    if (!rn)  return flash('error', 'Enter room number');
    try {
      await academicApi.createRoom({ floorId: fid, roomNumber: rn, capacity: newRoomCapacity });
      setNewRoomNumber('');
      setNewRoomCapacity('');
      flash('ok', 'Room created');
      await loadData();
    } catch (e) { flash('error', e.message || 'Failed'); }
  };

  const openEditRoom = (room) => {
    setEditingRoomId(room._id);
    setEditingRoomForm({
      floorId: String(room.floorId?._id || room.floorId || ''),
      roomNumber: room.roomNumber || '',
      capacity: room.capacity ? String(room.capacity) : '',
    });
  };

  const handleSaveRoom = async (roomId) => {
    const fid = editingRoomForm.floorId.trim(), rn = editingRoomForm.roomNumber.trim();
    const capacityValue = editingRoomForm.capacity.trim();
    if (!fid) return flash('error', 'Select a floor');
    if (!rn)  return flash('error', 'Enter room number');
    if (capacityValue !== '' && (!Number.isFinite(Number(capacityValue)) || Number(capacityValue) < 0)) {
      return flash('error', 'Capacity must be a non-negative number');
    }
    try {
      await academicApi.updateRoom(roomId, { floorId: fid, roomNumber: rn, capacity: capacityValue === '' ? 0 : Number(capacityValue) });
      setEditingRoomId(null);
      flash('ok', 'Room updated');
      await loadData();
    } catch (e) { flash('error', e.message || 'Failed'); }
  };

  const handleDeleteRoom = async (id) => {
    const confirm = await Swal.fire({
      icon: 'warning',
      title: 'Delete room?',
      text: 'This room will be removed from the setup.',
      showCancelButton: true,
      confirmButtonText: 'Yes, Delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#dc2626',
    });
    if (!confirm.isConfirmed) return;
    try { await academicApi.deleteRoom(id); flash('ok', 'Room deleted'); await loadData(); }
    catch (e) { flash('error', e.message || 'Failed'); }
  };

  /* ── stats ── */
  const totalRooms   = rooms.length;
  const totalFloors  = floors.length;
  const totalBldgs   = buildings.length;

  /* ── search + building filter ── */
  const q = search.trim().toLowerCase();
  const matches = (...vals) => vals.some((v) => String(v || '').toLowerCase().includes(q));
  const visibleBuildings = buildings.filter((b) => {
    if (buildingFilter && String(b._id) !== buildingFilter) return false;
    if (!q) return true;
    if (matches(b.name, b.code)) return true;
    return (floorsByBuilding.get(String(b._id)) || []).some((f) => matches(f.name, f.floorCode)
      || (roomsByFloor.get(String(f._id)) || []).some((r) => matches(r.roomNumber)));
  });
  // While searching, show matching branches expanded.
  const isBuildingOpen = (bid) => openBuildings.has(bid) || Boolean(q);
  const isFloorOpen = (floor) => openFloors.has(String(floor._id))
    || Boolean(q && (roomsByFloor.get(String(floor._id)) || []).some((r) => matches(r.roomNumber)));

  const startAddRoom = (floorId) => {
    setAddTab('room');
    setNewRoomFloorId(String(floorId));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const editBtn = 'inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700';
  const deleteBtn = 'inline-flex items-center gap-1 rounded-lg border border-rose-100 bg-rose-50/60 px-2.5 py-1 text-xs font-medium text-rose-600 transition hover:bg-rose-100';
  const inlineInput = 'rounded-lg border border-indigo-200 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100';

  const ADD_TABS = [
    { key: 'building', label: 'Building', icon: Building2 },
    { key: 'floor', label: 'Floor', icon: Layers },
    { key: 'room', label: 'Room', icon: DoorOpen },
  ];

  /* ════════════ RENDER ════════════ */
  return (
    <div className="space-y-5 p-4 md:p-5">

      {/* ── Header: breadcrumb + title + stat cards ── */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <nav className="flex items-center gap-1.5 text-sm text-slate-500" aria-label="Breadcrumb">
            <span>Campus</span>
            <ChevronRight size={14} />
            <span className="text-slate-700">Building, Floor &amp; Room</span>
          </nav>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#14203B]">Building, Floor &amp; Room</h1>
          <p className="mt-1 text-sm text-slate-500">Manage your school campus structure by adding buildings, floors and rooms.</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Buildings', val: totalBldgs, icon: Building2, tone: 'bg-indigo-50 text-indigo-600' },
            { label: 'Floors', val: totalFloors, icon: Layers, tone: 'bg-violet-50 text-violet-600' },
            { label: 'Rooms', val: totalRooms, icon: DoorOpen, tone: 'bg-emerald-50 text-emerald-600' },
          ].map(({ label, val, icon: Icon, tone }) => (
            <div key={label} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm sm:min-w-36">
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${tone}`}>
                <Icon size={20} />
              </span>
              <div>
                <p className="text-xl font-bold leading-tight text-slate-900 tabular-nums">{val}</p>
                <p className="text-xs text-slate-500">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Alerts ── */}
      {error && <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">⚠ {error}</div>}
      {success && <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">✓ {success}</div>}

      {/* ── Add card with Building / Floor / Room tabs ── */}
      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4">
          {ADD_TABS.map(({ key, label, icon: Icon }) => {
            const on = addTab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setAddTab(key)}
                className={`-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-3.5 text-sm font-semibold transition ${on ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
              >
                <Icon size={17} /> {label}
              </button>
            );
          })}
        </div>
        <div className="p-4">
          {addTab === 'building' && (
            <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-[1fr_1fr_auto]">
              <div>
                <label className={labelCls}>Building Name <span className="text-red-500">*</span></label>
                <Field value={newBuildingName} onChange={(e) => setNewBuildingName(e.target.value)} placeholder="e.g. Main Block" />
              </div>
              <div>
                <label className={labelCls}>Code <span className="text-red-500">*</span></label>
                <Field value={newBuildingCode} onChange={(e) => setNewBuildingCode(e.target.value.toUpperCase())} placeholder="e.g. B1" />
              </div>
              <button type="button" onClick={handleCreateBuilding} className={addBtn}>
                <Plus size={16} /> Add Building
              </button>
            </div>
          )}
          {addTab === 'floor' && (
            <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
              <div>
                <label className={labelCls}>Building <span className="text-red-500">*</span></label>
                <Select value={newFloorBuildingId} onChange={(e) => setNewFloorBuildingId(e.target.value)}>
                  <option value="">Select building…</option>
                  {buildings.map((b) => <option key={b._id} value={b._id}>{b.name} ({b.code})</option>)}
                </Select>
              </div>
              <div>
                <label className={labelCls}>Floor Name <span className="text-red-500">*</span></label>
                <Field value={newFloorName} onChange={(e) => setNewFloorName(e.target.value)} placeholder="e.g. Ground Floor" />
              </div>
              <div>
                <label className={labelCls}>Floor Code <span className="text-red-500">*</span></label>
                <Field value={newFloorCode} onChange={(e) => setNewFloorCode(e.target.value.toUpperCase())} placeholder="e.g. GF, F1" />
              </div>
              <button type="button" onClick={handleCreateFloor} className={addBtn}>
                <Plus size={16} /> Add Floor
              </button>
            </div>
          )}
          {addTab === 'room' && (
            <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-[1.3fr_1fr_1fr_auto]">
              <div>
                <label className={labelCls}>Floor <span className="text-red-500">*</span></label>
                <Select value={newRoomFloorId} onChange={(e) => setNewRoomFloorId(e.target.value)}>
                  <option value="">Select floor…</option>
                  {floors.map((f) => (
                    <option key={f._id} value={f._id}>{f.buildingId?.name || 'Building'} / {f.name} ({f.floorCode || '-'})</option>
                  ))}
                </Select>
              </div>
              <div>
                <label className={labelCls}>Room Number <span className="text-red-500">*</span></label>
                <Field value={newRoomNumber} onChange={(e) => setNewRoomNumber(e.target.value)} placeholder="e.g. 101" />
              </div>
              <div>
                <label className={labelCls}>Seating Capacity</label>
                <Field type="number" min="0" value={newRoomCapacity} onChange={(e) => setNewRoomCapacity(e.target.value)} placeholder="e.g. 40" />
              </div>
              <button type="button" onClick={handleCreateRoom} className={addBtn}>
                <Plus size={16} /> Add Room
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Campus Structure ── */}
      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm md:p-5">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <Building2 size={24} className="shrink-0 text-indigo-600" />
            <div>
              <h2 className="text-base font-bold text-slate-900">Campus Structure</h2>
              <p className="text-sm text-slate-500">View and manage all buildings, floors and rooms.</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search buildings, floors or rooms..."
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 sm:w-72"
              />
            </label>
            <div className="relative">
              <select
                value={buildingFilter}
                onChange={(e) => setBuildingFilter(e.target.value)}
                className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-9 text-sm font-medium text-slate-800 outline-none focus:border-indigo-400 sm:w-44"
              >
                <option value="">All Buildings</option>
                {buildings.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-3 py-12 text-sm text-slate-400">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-300 border-t-transparent" />
            Loading data…
          </div>
        ) : buildings.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400">No buildings yet. Add one above ↑</div>
        ) : visibleBuildings.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400">No buildings, floors or rooms match your search.</div>
        ) : (
          <div className="space-y-2">
            {visibleBuildings.map((building) => {
              const bid = String(building._id);
              const bFloors = floorsByBuilding.get(bid) || [];
              const bOpen = isBuildingOpen(bid);
              const roomCount = bFloors.reduce((acc, f) => acc + (roomsByFloor.get(String(f._id))?.length || 0), 0);

              return (
                <div key={bid} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  {/* Building row */}
                  {editingBuildingId === bid ? (
                    <div className="flex flex-wrap items-center gap-2 bg-indigo-50/40 px-3 py-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600"><Building2 size={16} /></span>
                      <input value={editingBuildingForm.name} onChange={(e) => setEditingBuildingForm((p) => ({ ...p, name: e.target.value }))} className={`min-w-32 flex-1 ${inlineInput}`} />
                      <input value={editingBuildingForm.code} onChange={(e) => setEditingBuildingForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))} className={`w-24 ${inlineInput}`} />
                      <button type="button" onClick={() => handleSaveBuilding(building._id)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-white hover:bg-emerald-600" aria-label="Save"><Check size={15} /></button>
                      <button type="button" onClick={() => setEditingBuildingId(null)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50" aria-label="Cancel"><X size={15} /></button>
                    </div>
                  ) : (
                    <div className="grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 transition hover:bg-slate-50/70 md:grid-cols-[auto_minmax(0,1.4fr)_minmax(0,1fr)_auto]" onClick={() => toggleBuilding(bid)}>
                      <div className="flex items-center gap-3">
                        {bOpen ? <ChevronDown size={17} className="text-slate-600" /> : <ChevronRight size={17} className="text-slate-600" />}
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600"><Building2 size={16} /></span>
                      </div>
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm font-semibold text-slate-900">{building.name}</span>
                        <Badge color="blue">{building.code}</Badge>
                      </div>
                      <div className="hidden items-center gap-2 md:flex">
                        <Badge color="blue">{plural(bFloors.length, 'floor')}</Badge>
                        <span className="h-4 w-px bg-slate-200" />
                        <Badge color="teal">{plural(roomCount, 'room')}</Badge>
                      </div>
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button type="button" onClick={() => openEditBuilding(building)} className={editBtn}><Pencil size={12} /> Edit</button>
                        <button type="button" onClick={() => handleDeleteBuilding(building._id)} className={deleteBtn}><Trash2 size={12} /> Delete</button>
                      </div>
                    </div>
                  )}

                  {/* Floors */}
                  {bOpen && (
                    <div className="space-y-2 border-t border-slate-100 bg-slate-50/40 px-3 py-2.5 md:pl-8">
                      {bFloors.length === 0 ? (
                        <p className="py-2 pl-2 text-xs text-slate-400">No floors in this building yet.</p>
                      ) : bFloors.map((floor) => {
                        const fid = String(floor._id);
                        const fRooms = roomsByFloor.get(fid) || [];
                        const fOpen = isFloorOpen(floor);
                        const shownRooms = q && !matches(floor.name, floor.floorCode, building.name, building.code)
                          ? fRooms.filter((r) => matches(r.roomNumber))
                          : fRooms;

                        return (
                          <div key={fid} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                            {editingFloorId === fid ? (
                              <div className="flex flex-wrap items-center gap-2 bg-indigo-50/40 px-3 py-2.5">
                                <select value={editingFloorForm.buildingId} onChange={(e) => setEditingFloorForm((p) => ({ ...p, buildingId: e.target.value }))} className={inlineInput}>
                                  {buildings.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
                                </select>
                                <input value={editingFloorForm.name} onChange={(e) => setEditingFloorForm((p) => ({ ...p, name: e.target.value }))} className={`min-w-28 flex-1 ${inlineInput}`} />
                                <input value={editingFloorForm.floorCode} onChange={(e) => setEditingFloorForm((p) => ({ ...p, floorCode: e.target.value.toUpperCase() }))} className={`w-20 ${inlineInput}`} />
                                <button type="button" onClick={() => handleSaveFloor(floor._id)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-white hover:bg-emerald-600" aria-label="Save"><Check size={14} /></button>
                                <button type="button" onClick={() => setEditingFloorId(null)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50" aria-label="Cancel"><X size={14} /></button>
                              </div>
                            ) : (
                              <div className="grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2 transition hover:bg-slate-50/70 md:grid-cols-[auto_minmax(0,1.4fr)_minmax(0,1fr)_auto]" onClick={() => toggleFloor(fid)}>
                                <div className="flex items-center gap-3">
                                  {fOpen ? <ChevronDown size={16} className="text-slate-600" /> : <ChevronRight size={16} className="text-slate-600" />}
                                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600"><Layers size={14} /></span>
                                </div>
                                <div className="flex min-w-0 items-center gap-2">
                                  <span className="truncate text-sm font-medium text-slate-800">{floor.name}</span>
                                  <Badge color="slate">{floor.floorCode || '—'}</Badge>
                                </div>
                                <div className="hidden md:flex">
                                  <Badge color="teal">{plural(fRooms.length, 'room')}</Badge>
                                </div>
                                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                  <button type="button" onClick={() => openEditFloor(floor)} className={editBtn}><Pencil size={12} /> Edit</button>
                                  <button type="button" onClick={() => handleDeleteFloor(floor._id)} className={deleteBtn}><Trash2 size={12} /> Delete</button>
                                </div>
                              </div>
                            )}

                            {/* Rooms table */}
                            {fOpen && (
                              <div className="border-t border-slate-100 px-3 pb-3 pt-2 md:pl-16">
                                <div className="overflow-hidden rounded-lg border border-slate-200">
                                  <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
                                      <tr>
                                        <th className="px-3 py-2">Room No.</th>
                                        <th className="border-l border-slate-200 px-3 py-2">Seating Capacity</th>
                                        <th className="w-40 border-l border-slate-200 px-3 py-2 text-center">Actions</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {shownRooms.length === 0 ? (
                                        <tr><td colSpan={3} className="px-3 py-3 text-xs text-slate-400">No rooms on this floor yet.</td></tr>
                                      ) : shownRooms.map((room) => (
                                        editingRoomId === room._id ? (
                                          <tr key={room._id} className="border-t border-slate-100 bg-indigo-50/30">
                                            <td className="px-3 py-1.5">
                                              <div className="flex flex-wrap items-center gap-1.5">
                                                <select value={editingRoomForm.floorId} onChange={(e) => setEditingRoomForm((p) => ({ ...p, floorId: e.target.value }))} className={`max-w-44 py-1 text-xs ${inlineInput}`}>
                                                  {floors.map((f) => <option key={f._id} value={f._id}>{f.buildingId?.name || 'Building'} / {f.name}</option>)}
                                                </select>
                                                <input value={editingRoomForm.roomNumber} onChange={(e) => setEditingRoomForm((p) => ({ ...p, roomNumber: e.target.value }))} placeholder="Room #" className={`w-20 py-1 text-xs ${inlineInput}`} />
                                              </div>
                                            </td>
                                            <td className="border-l border-slate-100 px-3 py-1.5">
                                              <input type="number" min="0" value={editingRoomForm.capacity} onChange={(e) => setEditingRoomForm((p) => ({ ...p, capacity: e.target.value }))} placeholder="Seats" className={`w-24 py-1 text-xs ${inlineInput}`} />
                                            </td>
                                            <td className="border-l border-slate-100 px-3 py-1.5">
                                              <div className="flex items-center justify-center gap-1.5">
                                                <button type="button" onClick={() => handleSaveRoom(room._id)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500 text-white hover:bg-emerald-600" aria-label="Save"><Check size={13} /></button>
                                                <button type="button" onClick={() => setEditingRoomId(null)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50" aria-label="Cancel"><X size={13} /></button>
                                              </div>
                                            </td>
                                          </tr>
                                        ) : (
                                          <tr key={room._id} className="border-t border-slate-100 hover:bg-slate-50/60">
                                            <td className="px-3 py-1.5 text-slate-800">{room.roomNumber}</td>
                                            <td className="border-l border-slate-100 px-3 py-1.5 text-slate-700">{room.capacity || '—'}</td>
                                            <td className="border-l border-slate-100 px-3 py-1.5">
                                              <div className="flex items-center justify-center gap-1.5">
                                                <button type="button" onClick={() => openEditRoom(room)} className={editBtn}><Pencil size={12} /> Edit</button>
                                                <button type="button" onClick={() => handleDeleteRoom(room._id)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-rose-100 bg-rose-50/60 text-rose-600 transition hover:bg-rose-100" aria-label={`Delete room ${room.roomNumber}`}><Trash2 size={12} /></button>
                                              </div>
                                            </td>
                                          </tr>
                                        )
                                      ))}
                                      <tr className="border-t border-slate-100 bg-slate-50/50">
                                        <td colSpan={3} className="px-3 py-1.5">
                                          <button type="button" onClick={() => startAddRoom(floor._id)} className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-700 hover:text-indigo-900">
                                            <Plus size={15} /> Add Room
                                          </button>
                                        </td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default FloorRoomManagement;
