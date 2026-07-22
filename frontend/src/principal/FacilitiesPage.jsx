import React, { useEffect, useState } from 'react';
import { Building2, Layers, DoorOpen, Loader, AlertCircle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { CardShell, SectionHeader, StatCard, Badge, MotionDiv, EmptyState, pageVariants, itemVariants } from './principalUi';

const API_BASE = import.meta.env.VITE_API_URL;

const FacilitiesPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  useEffect(() => {
    const fetchFacilities = async () => {
      setLoading(true);
      setError('');
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE}/api/principal/facilities`, {
          headers: { authorization: `Bearer ${token}` },
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(payload?.error || 'Failed to load facilities');
        }
        setData(payload);
      } catch (err) {
        console.error('Facilities error:', err);
        setError(err.message || 'Unable to load facilities');
      } finally {
        setLoading(false);
      }
    };
    fetchFacilities();
  }, []);

  const summary = data?.summary || { totalBuildings: 0, totalFloors: 0, totalRooms: 0, occupiedRooms: 0, freeRooms: 0 };
  const buildings = data?.buildings || [];

  const occupancyChartData = [
    { name: 'Occupied', value: summary.occupiedRooms, color: '#0f172a' },
    { name: 'Free', value: summary.freeRooms, color: '#cbd5e1' },
  ];

  return (
    <MotionDiv variants={pageVariants} initial="hidden" animate="show" className="space-y-6">
      <MotionDiv variants={itemVariants} className="rounded-2xl border border-slate-200 bg-slate-950 p-6 text-white shadow-xl sm:p-7">
        <h1 className="text-2xl font-semibold">Facilities</h1>
        <p className="mt-1 text-sm text-slate-300">Buildings, floors, and rooms across your campus</p>
      </MotionDiv>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-16 text-slate-500">
          <Loader className="h-5 w-5 animate-spin" /> Loading facilities...
        </div>
      ) : (
        <>
          <MotionDiv variants={itemVariants} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={Building2} label="Buildings" value={summary.totalBuildings} />
            <StatCard icon={Layers} label="Floors" value={summary.totalFloors} />
            <StatCard icon={DoorOpen} label="Rooms" value={summary.totalRooms} />
            <StatCard icon={DoorOpen} label="Occupied Rooms" value={summary.occupiedRooms} tone="emerald" />
          </MotionDiv>

          <MotionDiv variants={itemVariants} className="grid gap-4 lg:grid-cols-3">
            <CardShell className="lg:col-span-1">
              <SectionHeader icon={DoorOpen} title="Room Utilization" subtitle="Occupied vs. free rooms" />
              <div className="p-5">
                {summary.totalRooms > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Tooltip />
                      <Legend />
                      <Pie data={occupancyChartData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85}>
                        {occupancyChartData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState icon={DoorOpen} title="No rooms configured" description="Add buildings, floors, and rooms from the Admin portal." />
                )}
              </div>
            </CardShell>

            <CardShell className="lg:col-span-2">
              <SectionHeader icon={Building2} title="Buildings" subtitle="Browse floors and rooms" />
              <div className="max-h-[420px] space-y-5 overflow-y-auto p-5">
                {buildings.length === 0 ? (
                  <EmptyState icon={Building2} title="No buildings found" description="Buildings configured in Admin will appear here." />
                ) : (
                  buildings.map((building) => (
                    <div key={building._id} className="rounded-xl border border-slate-100 p-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-900">{building.name}</h3>
                        <Badge tone="neutral">{building.code}</Badge>
                      </div>
                      <div className="mt-3 space-y-3">
                        {(building.floors || []).map((floor) => (
                          <div key={floor._id}>
                            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                              {floor.name} ({floor.floorCode})
                            </p>
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {(floor.rooms || []).length === 0 ? (
                                <span className="text-xs text-slate-400">No rooms</span>
                              ) : (
                                floor.rooms.map((room) => (
                                  <Badge key={room._id} tone={room.inUse ? 'slate' : 'neutral'}>
                                    {room.roomNumber}
                                  </Badge>
                                ))
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardShell>
          </MotionDiv>
        </>
      )}
    </MotionDiv>
  );
};

export default FacilitiesPage;
