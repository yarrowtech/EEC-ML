import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2, DoorOpen, Layers, Plus, RefreshCcw, Trash2,
  ChevronRight, ChevronDown, Home, Hash, Users, Pencil, Check, X,
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
    blue:  'bg-blue-50 text-blue-700 ring-blue-200',
    slate: 'bg-slate-100 text-slate-600 ring-slate-200',
    teal:  'bg-teal-50 text-teal-700 ring-teal-200',
    rose:  'bg-rose-50 text-rose-600 ring-rose-200',
  };
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ${map[color]}`}>
      {children}
    </span>
  );
};

/* ─── delete button ─── */
const DelBtn = ({ onClick, label }) => (
  <button
    type="button"
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-red-500 opacity-0 transition-all duration-150 group-hover:opacity-100 hover:bg-red-50 hover:text-red-700"
  >
    <Trash2 size={11} />{label}
  </button>
);

/* ─── input ─── */
const Field = ({ ...props }) => (
  <input
    {...props}
    className="w-full rounded-xl border border-gray-200 bg-gray-50/80 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition"
  />
);

/* ─── select ─── */
const Select = ({ children, ...props }) => (
  <select
    {...props}
    className="w-full rounded-xl border border-gray-200 bg-gray-50/80 px-3 py-2 text-sm text-gray-800 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition"
  >
    {children}
  </select>
);

/* ─── section card ─── */
const AddCard = ({ icon: Icon, title, iconColor, children }) => (
  <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
    <div className="mb-4 flex items-center gap-2">
      <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconColor}`}>
        <Icon size={15} className="text-white" />
      </span>
      <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
    </div>
    <div className="space-y-2.5">{children}</div>
  </div>
);

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
  const [editingCapacityId, setEditingCapacityId] = useState(null);
  const [editingCapacityValue, setEditingCapacityValue] = useState('');

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

  const handleSaveRoomCapacity = async (roomId) => {
    const value = editingCapacityValue.trim();
    if (value !== '' && (!Number.isFinite(Number(value)) || Number(value) < 0)) {
      return flash('error', 'Capacity must be a non-negative number');
    }
    try {
      await academicApi.updateRoom(roomId, { capacity: value === '' ? 0 : Number(value) });
      setEditingCapacityId(null);
      flash('ok', 'Seating capacity updated');
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

  /* ════════════ RENDER ════════════ */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 p-4 space-y-5">

      {/* ── Hero banner ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 p-6 text-white shadow-xl">
        <div className="absolute -top-10 -right-10 h-52 w-52 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-32 w-64 rounded-full bg-indigo-400/10 blur-2xl" />
        <div className="relative flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Building, Floor & Room</h1>
            <p className="mt-0.5 text-sm text-slate-400">Step 1 → Add Building &nbsp;·&nbsp; Step 2 → Add Floor &nbsp;·&nbsp; Step 3 → Add Room</p>
          </div>
          <div className="flex gap-3 mt-3 sm:mt-0">
            {[
              { label: 'Buildings', val: totalBldgs, icon: Building2 },
              { label: 'Floors',    val: totalFloors, icon: Layers },
              { label: 'Rooms',     val: totalRooms,  icon: DoorOpen },
            ].map(({ label, val, icon: Icon }) => (
              <div key={label} className="flex flex-col items-center rounded-xl bg-white/10 px-4 py-2.5 backdrop-blur-sm">
                <Icon size={14} className="mb-0.5 text-blue-300" />
                <span className="text-lg font-bold">{val}</span>
                <span className="text-[10px] text-slate-400">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Alerts ── */}
      {error   && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 flex items-center gap-2">⚠ {error}</div>}
      {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700 flex items-center gap-2">✓ {success}</div>}

      {/* ── Add Forms ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <AddCard icon={Building2} title="Add Building" iconColor="bg-blue-600">
          <Field value={newBuildingName} onChange={(e) => setNewBuildingName(e.target.value)} placeholder="Building Name (e.g. Main Block)" />
          <Field value={newBuildingCode} onChange={(e) => setNewBuildingCode(e.target.value.toUpperCase())} placeholder="Code (e.g. B1)" />
          <button type="button" onClick={handleCreateBuilding}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors shadow-sm">
            <Plus size={14} /> Add Building
          </button>
        </AddCard>

        <AddCard icon={Layers} title="Add Floor" iconColor="bg-indigo-500">
          <Select value={newFloorBuildingId} onChange={(e) => setNewFloorBuildingId(e.target.value)}>
            <option value="">Select building…</option>
            {buildings.map((b) => <option key={b._id} value={b._id}>{b.name} ({b.code})</option>)}
          </Select>
          <Field value={newFloorName} onChange={(e) => setNewFloorName(e.target.value)} placeholder="Floor Name (e.g. Ground Floor)" />
          <Field value={newFloorCode} onChange={(e) => setNewFloorCode(e.target.value.toUpperCase())} placeholder="Floor Code (e.g. GF, F1)" />
          <button type="button" onClick={handleCreateFloor}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 transition-colors shadow-sm">
            <Plus size={14} /> Add Floor
          </button>
        </AddCard>

        <AddCard icon={DoorOpen} title="Add Room" iconColor="bg-teal-500">
          <Select value={newRoomFloorId} onChange={(e) => setNewRoomFloorId(e.target.value)}>
            <option value="">Select floor…</option>
            {floors.map((f) => (
              <option key={f._id} value={f._id}>
                {f.buildingId?.name || 'Building'} / {f.name} ({f.floorCode || '-'})
              </option>
            ))}
          </Select>
          <Field value={newRoomNumber} onChange={(e) => setNewRoomNumber(e.target.value)} placeholder="Room Number (e.g. 101)" />
          <Field type="number" min="0" value={newRoomCapacity} onChange={(e) => setNewRoomCapacity(e.target.value)} placeholder="Seating Capacity (e.g. 40)" />
          <button type="button" onClick={handleCreateRoom}
            className="inline-flex items-center gap-1.5 rounded-xl bg-teal-500 px-4 py-2 text-sm font-medium text-white hover:bg-teal-600 transition-colors shadow-sm">
            <Plus size={14} /> Add Room
          </button>
        </AddCard>
      </div>

      {/* ── Accordion Tree ── */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        {/* header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Building2 size={15} className="text-blue-600" />
            <h2 className="text-sm font-semibold text-gray-800">Hierarchy Explorer</h2>
            <span className="text-xs text-gray-400">— click to expand</span>
          </div>
          <button type="button" onClick={loadData}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 transition-colors">
            <RefreshCcw size={12} /> Refresh
          </button>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center gap-3 py-12 text-sm text-gray-400">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-300 border-t-transparent" />
              Loading data…
            </div>
          ) : buildings.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">No buildings yet. Add one above ↑</div>
          ) : (
            <div className="space-y-2">
              {buildings.map((building) => {
                const bid         = String(building._id);
                const bFloors     = floorsByBuilding.get(bid) || [];
                const bOpen       = openBuildings.has(bid);
                const roomCount   = bFloors.reduce((acc, f) => acc + (roomsByFloor.get(String(f._id))?.length || 0), 0);

                return (
                  <div key={bid}
                    className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50/60 transition-all duration-200">

                    {/* ── Building row ── */}
                    <div
                      className="group flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-blue-50/60 transition-colors select-none"
                      onClick={() => toggleBuilding(bid)}
                    >
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors ${bOpen ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-600'}`}>
                        <Building2 size={14} />
                      </span>
                      <div className="flex flex-1 items-center gap-2 min-w-0">
                        <span className="truncate font-semibold text-sm text-gray-800">{building.name}</span>
                        <Badge color="blue">{building.code}</Badge>
                        <Badge color="slate">{bFloors.length} floor{bFloors.length !== 1 ? 's' : ''}</Badge>
                        <Badge color="teal">{roomCount} room{roomCount !== 1 ? 's' : ''}</Badge>
                      </div>
                      <div className="ml-auto flex items-center gap-2">
                        <DelBtn onClick={() => handleDeleteBuilding(building._id)} label="Delete" />
                        <span className={`transition-transform duration-200 text-gray-400 ${bOpen ? 'rotate-90' : ''}`}>
                          <ChevronRight size={16} />
                        </span>
                      </div>
                    </div>

                    {/* ── Floors (collapsible) ── */}
                    {bOpen && (
                      <div className="border-t border-gray-100 bg-white px-4 py-3 space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
                        {bFloors.length === 0 ? (
                          <p className="py-2 text-xs text-gray-400 pl-9">No floors in this building yet.</p>
                        ) : bFloors.map((floor) => {
                          const fid      = String(floor._id);
                          const fRooms   = roomsByFloor.get(fid) || [];
                          const fOpen    = openFloors.has(fid);

                          return (
                            <div key={fid}
                              className="overflow-hidden rounded-xl border border-gray-100 bg-slate-50/80">

                              {/* ── Floor row ── */}
                              <div
                                className="group flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-indigo-50/60 transition-colors select-none"
                                onClick={() => toggleFloor(fid)}
                              >
                                <span className="ml-4 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-indigo-100">
                                  <Layers size={12} className="text-indigo-600" />
                                </span>
                                <div className="flex flex-1 items-center gap-2 min-w-0">
                                  <span className="truncate text-sm font-medium text-gray-700">{floor.name}</span>
                                  <Badge color="slate">{floor.floorCode || '—'}</Badge>
                                  <Badge color="teal">{fRooms.length} room{fRooms.length !== 1 ? 's' : ''}</Badge>
                                </div>
                                <div className="ml-auto flex items-center gap-2">
                                  <DelBtn onClick={() => handleDeleteFloor(floor._id)} label="Delete" />
                                  <span className={`transition-transform duration-200 text-gray-400 ${fOpen ? 'rotate-90' : ''}`}>
                                    <ChevronRight size={14} />
                                  </span>
                                </div>
                              </div>

                              {/* ── Rooms (collapsible) ── */}
                              {fOpen && (
                                <div className="border-t border-gray-100 bg-white px-4 pt-2 pb-3 animate-in fade-in slide-in-from-top-1 duration-150">
                                  {fRooms.length === 0 ? (
                                    <p className="py-1.5 text-xs text-gray-400 pl-12">No rooms on this floor yet.</p>
                                  ) : (
                                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 pt-1.5 pl-10">
                                      {fRooms.map((room) => (
                                        <div key={room._id}
                                          className="group flex flex-col gap-1 rounded-lg border border-gray-100 bg-gray-50 px-2.5 py-2 hover:border-teal-200 hover:bg-teal-50/40 transition-colors">
                                          <div className="flex items-center justify-between gap-1">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                              <DoorOpen size={11} className="shrink-0 text-teal-500" />
                                              <span className="truncate text-xs font-medium text-gray-700">{room.roomNumber}</span>
                                            </div>
                                            <button
                                              type="button"
                                              onClick={() => handleDeleteRoom(room._id)}
                                              className="ml-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600"
                                            >
                                              <Trash2 size={11} />
                                            </button>
                                          </div>
                                          {editingCapacityId === room._id ? (
                                            <div className="flex items-center gap-1">
                                              <Users size={10} className="shrink-0 text-gray-400" />
                                              <input type="number" min="0" autoFocus value={editingCapacityValue}
                                                onChange={(e) => setEditingCapacityValue(e.target.value)}
                                                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveRoomCapacity(room._id); if (e.key === 'Escape') setEditingCapacityId(null); }}
                                                className="w-12 rounded border border-teal-200 bg-white px-1 py-0.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-teal-300" />
                                              <button type="button" onClick={() => handleSaveRoomCapacity(room._id)} className="text-emerald-500 hover:text-emerald-700"><Check size={11} /></button>
                                              <button type="button" onClick={() => setEditingCapacityId(null)} className="text-gray-400 hover:text-gray-600"><X size={11} /></button>
                                            </div>
                                          ) : (
                                            <button type="button"
                                              onClick={() => { setEditingCapacityId(room._id); setEditingCapacityValue(room.capacity ? String(room.capacity) : ''); }}
                                              className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-teal-600 transition-colors">
                                              <Users size={10} className="shrink-0" />
                                              {room.capacity ? `${room.capacity} seats` : 'Set capacity'}
                                              <Pencil size={9} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </button>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
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
    </div>
  );
};

export default FloorRoomManagement;
