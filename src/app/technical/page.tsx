import { ShieldAlert, Crosshair, Droplets } from 'lucide-react';

export default function TechnicalDocs() {
  return (
    <div className="min-h-[calc(100vh-70px)] bg-slate-50 py-12 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-12">
          <span className="text-cyan-600 font-bold tracking-wider uppercase text-sm mb-2 block">Mission Intelligence</span>
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-6 tracking-tight">Operational Deployment</h1>
          <p className="text-lg text-slate-600 leading-relaxed">
            The Physics-Guided Neural Reconstruction pipeline directly supports critical national security, 
            disaster management, and blue economy operations in the Indian Ocean.
          </p>
        </div>

        <div className="space-y-8">
          
          {/* App 1 */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col md:flex-row">
            <div className="md:w-2/5 bg-slate-900 flex items-center justify-center p-8 relative min-h-[250px] bg-[url('https://www.transparenttextures.com/patterns/black-scales.png')]">
              <div className="absolute inset-0 bg-blue-900/20 mix-blend-overlay"></div>
              <div className="relative z-10 bg-black/50 backdrop-blur-sm border border-slate-700 rounded-lg px-4 py-2 text-cyan-400 font-mono text-sm">
                ASW CLOAKING BAND: 50m - 180m
              </div>
            </div>
            <div className="p-8 md:w-3/5">
              <span className="inline-block px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded text-xs font-bold mb-4 tracking-wider uppercase">
                Naval Defense & ASW
              </span>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">Submarine Acoustic Shadow Zone Calculator</h3>
              <p className="text-slate-600 mb-6 leading-relaxed">
                Underwater sound bends according to the Sound Velocity Profile (Mackenzie equation). 
                Beneath the Sonic Layer Depth (SLD), downward refraction creates an acoustic shadow zone 
                where submarines evade surface active sonar.
              </p>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-medium text-slate-700 space-y-2">
                <div>Mackenzie Equation: <span className="font-mono text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 ml-2">C(T,S,z) = 1448.96 + 4.59T - ...</span></div>
                <div>Sonic Layer Depth: <strong className="text-slate-900 ml-2">48 metres</strong></div>
              </div>
            </div>
          </div>

          {/* App 2 */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col md:flex-row-reverse">
            <div className="md:w-2/5 bg-slate-900 flex items-center justify-center p-8 relative min-h-[250px] bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
              <div className="absolute inset-0 bg-emerald-900/20 mix-blend-overlay"></div>
              <div className="relative z-10 bg-black/50 backdrop-blur-sm border border-slate-700 rounded-lg px-4 py-2 text-emerald-400 font-mono text-sm">
                max |dT/dz| = 0.34 °C/m
              </div>
            </div>
            <div className="p-8 md:w-3/5">
              <span className="inline-block px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-xs font-bold mb-4 tracking-wider uppercase">
                Commercial Fisheries
              </span>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">Potential Fishing Zone (PFZ) Targeting</h3>
              <p className="text-slate-600 mb-6 leading-relaxed">
                Pelagic fish schools congregate along the thermocline where nutrient-rich upwelling meets warm surface waters. 
                Real-time thermocline depth forecasting guides commercial fleets to optimal net depths, slashing searching fuel costs by ~30%.
              </p>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-medium text-slate-700 space-y-2">
                <div>Optimal Trawl Depth: <strong className="text-slate-900 ml-2">60 m – 75 m</strong></div>
                <div>Fuel Saving Advisory: <strong className="text-slate-900 ml-2">INCOIS PFZ Coastal Ready</strong></div>
              </div>
            </div>
          </div>

          {/* App 3 */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col md:flex-row">
            <div className="md:w-2/5 bg-slate-900 flex items-center justify-center p-8 relative min-h-[250px] bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')]">
              <div className="absolute inset-0 bg-orange-900/20 mix-blend-overlay"></div>
              <div className="relative z-10 bg-black/50 backdrop-blur-sm border border-slate-700 rounded-lg px-4 py-2 text-orange-400 font-mono text-sm">
                TCHP &gt; 75 kJ/cm² (Explosive Risk)
              </div>
            </div>
            <div className="p-8 md:w-3/5">
              <span className="inline-block px-3 py-1 bg-orange-50 text-orange-700 border border-orange-200 rounded text-xs font-bold mb-4 tracking-wider uppercase">
                Disaster & Autonomous Routing
              </span>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">Cyclone Heat Potential & Hazard Advisory</h3>
              <p className="text-slate-600 mb-6 leading-relaxed">
                Combines real-time AIS traffic with subsurface heat anomalies to detect rapid cyclone intensification pathways. 
                Autonomous surface vehicles and merchant vessels can alter course proactively before the storm explodes in intensity.
              </p>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-medium text-slate-700 space-y-2">
                <div>AIS Integration: <strong className="text-slate-900 ml-2">Real-Time WebSocket WSS v0</strong></div>
                <div>Routing Safety Margin: <strong className="text-slate-900 ml-2">+180 NM from Warm Core</strong></div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
