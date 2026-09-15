'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { Layers, Activity, Map as MapIcon, Database, Wind, Navigation } from 'lucide-react';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('maps');

  const tabs = [
    { id: 'maps', label: 'Prediction Maps', sub: '0-1000m Water Column', icon: <MapIcon size={20} /> },
    { id: 'volume', label: '3D Volume', sub: 'Dual Slicer & Voxel Mesh', icon: <Layers size={20} /> },
    { id: 'profiles', label: 'T(z) Profiles', sub: 'Multi-Point Soundings', icon: <Activity size={20} /> },
    { id: 'timeseries', label: 'Time Series', sub: 'Subsurface Marine Heatwaves', icon: <Activity size={20} /> },
    { id: 'transect', label: 'Basin Transect', sub: 'Somali to Bay of Bengal', icon: <Navigation size={20} /> },
    { id: 'argo', label: 'ARGO Matchup', sub: 'Hold-out comparison', icon: <Database size={20} /> },
    { id: 'tchp', label: 'Cyclone TCHP', sub: 'Rapid Intensification Fuel', icon: <Wind size={20} /> },
  ];

  return (
    <div className="min-h-[calc(100vh-70px)] bg-slate-50 p-6">
      <div className="max-w-[1400px] mx-auto">
        
        {/* Tab Navigation */}
        <div className="bg-white border border-slate-200 rounded-2xl p-2 flex flex-wrap gap-2 mb-6 shadow-sm">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'flex items-center gap-3 px-4 py-3 rounded-xl transition-all border text-left flex-1 min-w-[200px]',
                activeTab === tab.id
                  ? 'bg-cyan-50 border-cyan-200 text-cyan-900 shadow-sm'
                  : 'bg-transparent border-transparent text-slate-600 hover:bg-slate-50 border-slate-100'
              )}
            >
              <div className={clsx(
                'p-2 rounded-lg',
                activeTab === tab.id ? 'bg-cyan-100 text-cyan-700' : 'bg-slate-100 text-slate-500'
              )}>
                {tab.icon}
              </div>
              <div>
                <div className="font-bold text-sm whitespace-nowrap">{tab.label}</div>
                <div className="text-[10px] uppercase tracking-wider font-semibold opacity-70 whitespace-nowrap">
                  {tab.sub}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm min-h-[600px] flex items-center justify-center p-8">
          
          {activeTab === 'transect' ? (
            <div className="w-full h-full flex flex-col">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-900 mb-1">2D Basin Zonal Transect · 45°E → 105°E (along 5.5°N)</h2>
                <p className="text-sm text-slate-500">Continuous depth-longitude vertical thermal slice from Somali Upwelling to the Andaman Sea.</p>
              </div>
              <div className="flex-1 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-center relative overflow-hidden">
                {/* Fake Mosaic Texture for placeholder */}
                <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay"></div>
                
                <div className="text-center">
                  <Navigation size={48} className="mx-auto text-cyan-500 mb-4 opacity-50" />
                  <p className="text-cyan-100 font-mono text-sm tracking-widest uppercase">Plotly WebGL Canvas Placeholder</p>
                  <p className="text-slate-400 text-xs mt-2">The Zonal Transect module is rendering...</p>
                </div>
              </div>
            </div>
          ) : activeTab === 'maps' ? (
            <div className="text-center">
              <MapIcon size={64} className="mx-auto text-slate-300 mb-4" />
              <h2 className="text-2xl font-bold text-slate-800">Prediction Maps</h2>
              <p className="text-slate-500 mt-2 max-w-md mx-auto">Interactive multi-depth 2D prediction maps overlaying CMEMS surface observations.</p>
            </div>
          ) : (
            <div className="text-center">
              <div className="text-slate-300 mb-4 flex justify-center">
                {tabs.find(t => t.id === activeTab)?.icon}
              </div>
              <h2 className="text-2xl font-bold text-slate-800">{tabs.find(t => t.id === activeTab)?.label}</h2>
              <p className="text-slate-500 mt-2">This visualization module is currently loaded via the legacy pipeline.</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
