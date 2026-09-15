'use client';

import { useEffect, useState, useMemo } from 'react';
import Map, { Marker, Popup } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Ship, Info } from 'lucide-react';
import clsx from 'clsx';

// Carto Positron Style for MapLibre
const mapStyle = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

interface Vessel {
  mmsi: number;
  name: string;
  type: string;
  lat: number;
  lon: number;
  sog: number;
  cog: number;
  timestamp: string;
}

export default function FleetRadar() {
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [selectedVessel, setSelectedVessel] = useState<Vessel | null>(null);
  const [filterType, setFilterType] = useState('all');

  // Polling for real-time AIS
  useEffect(() => {
    let mounted = true;
    const fetchVessels = async () => {
      try {
        const res = await fetch('/api/vessels');
        if (res.ok) {
          const data = await res.json();
          if (mounted && data.fleet && Array.isArray(data.fleet)) {
            // Keep existing vessels not updated in this poll? No, we just show the latest active ones for this demo.
            // But to avoid flickering, we merge by MMSI.
            setVessels(prev => {
              const map = new globalThis.Map(prev.map(v => [v.mmsi, v]));
              data.fleet.forEach((v: Vessel) => map.set(v.mmsi, v));
              return Array.from(map.values());
            });
          }
        }
      } catch (err) {
        console.error('Failed to fetch vessels', err);
      } finally {
        if (mounted) setTimeout(fetchVessels, 5000);
      }
    };
    fetchVessels();
    return () => { mounted = false; };
  }, []);

  const filteredVessels = useMemo(() => {
    if (filterType === 'all') return vessels;
    return vessels.filter(v => v.type === filterType);
  }, [vessels, filterType]);

  const getColor = (type: string) => {
    switch (type) {
      case 'cargo': return '#10b981';
      case 'tanker': return '#ef4444';
      case 'fishing': return '#3b82f6';
      case 'passenger': return '#f59e0b';
      case 'military': return '#8b5cf6';
      default: return '#64748b';
    }
  };

  return (
    <div className="flex h-[calc(100vh-70px)] bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <div className="w-[400px] flex-shrink-0 bg-white border-r border-slate-200 flex flex-col shadow-xl z-10">
        <div className="p-6 border-b border-slate-200 bg-slate-900 text-white">
          <h1 className="text-2xl font-bold mb-2 tracking-tight">Fleet Radar</h1>
          <p className="text-slate-400 text-sm">Real-time AIS tracking and subsurface ocean intelligence integration.</p>
        </div>

        {/* Filters */}
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <div className="text-xs font-bold text-slate-500 mb-3 tracking-widest uppercase">Filter by Type</div>
          <div className="flex flex-wrap gap-2">
            {['all', 'cargo', 'tanker', 'fishing', 'passenger', 'military'].map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={clsx(
                  'px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-all border',
                  filterType === type 
                    ? 'bg-cyan-600 border-cyan-600 text-white shadow-md' 
                    : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-100'
                )}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Inspector */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50">
          {selectedVessel ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-slate-900 text-white p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Ship size={18} className="text-cyan-400" />
                  <h3 className="font-bold text-lg">{selectedVessel.name}</h3>
                </div>
                <div className="text-xs text-slate-400 uppercase tracking-wide">MMSI: {selectedVessel.mmsi} · {selectedVessel.type}</div>
              </div>
              <div className="p-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-slate-500 text-xs font-semibold">Speed (SOG)</div>
                  <div className="font-mono">{selectedVessel.sog} kn</div>
                </div>
                <div>
                  <div className="text-slate-500 text-xs font-semibold">Course (COG)</div>
                  <div className="font-mono">{selectedVessel.cog}°</div>
                </div>
                <div className="col-span-2 pt-3 border-t border-slate-100 mt-2">
                  <div className="text-slate-500 text-xs font-semibold flex items-center gap-1 mb-2">
                    <Info size={14} /> Subsurface Context
                  </div>
                  <div className="grid grid-cols-2 gap-3 bg-cyan-50/50 rounded-lg p-3 border border-cyan-100">
                    <div>
                      <div className="text-[10px] uppercase text-slate-400 font-bold">Thermocline D20</div>
                      <div className="font-mono text-slate-800">105m</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-slate-400 font-bold">Sound Speed</div>
                      <div className="font-mono text-slate-800">1,523 m/s</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 p-8">
              <Ship size={48} className="mb-4 text-slate-200" />
              <p className="font-semibold">No Vessel Selected</p>
              <p className="text-sm mt-2">Click any vessel marker on the map to view real-time telemetry and subsurface oceanographic context.</p>
            </div>
          )}
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <Map
          initialViewState={{
            longitude: 72,
            latitude: 15,
            zoom: 4
          }}
          mapStyle={mapStyle}
          attributionControl={false}
        >
          {filteredVessels.map(v => (
            <Marker
              key={v.mmsi}
              longitude={v.lon}
              latitude={v.lat}
              anchor="center"
              onClick={e => {
                e.originalEvent.stopPropagation();
                setSelectedVessel(v);
              }}
            >
              <div 
                className={clsx(
                  "w-4 h-4 rounded-full border-2 border-white shadow-md cursor-pointer transition-transform hover:scale-125",
                  selectedVessel?.mmsi === v.mmsi && "ring-4 ring-cyan-400/50 scale-125"
                )}
                style={{ backgroundColor: getColor(v.type) }}
                title={v.name}
              />
            </Marker>
          ))}
        </Map>
        
        {/* Floating live badge over map */}
        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md px-4 py-2 rounded-full shadow-lg border border-slate-200 flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          <span className="text-sm font-bold text-slate-700 font-mono">{filteredVessels.length} Live Vessels</span>
        </div>
      </div>
    </div>
  );
}
