import Link from 'next/link';

export default function Home() {
  return (
    <div className="relative min-h-[calc(100vh-70px)] flex flex-col items-center justify-center overflow-hidden">
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[20%] -left-[10%] w-[70vw] h-[70vw] rounded-full bg-gradient-to-br from-orange-100/60 to-amber-50/20 blur-[120px] mix-blend-multiply animate-[spin_60s_linear_infinite]"></div>
        <div className="absolute top-[30%] -right-[20%] w-[60vw] h-[60vw] rounded-full bg-gradient-to-tl from-yellow-100/50 to-orange-50/10 blur-[100px] mix-blend-multiply animate-[spin_40s_linear_infinite_reverse]"></div>
        <div className="absolute -bottom-[30%] left-[10%] w-[80vw] h-[80vw] rounded-full bg-gradient-to-tr from-amber-100/40 to-rose-50/20 blur-[150px] mix-blend-multiply animate-[spin_80s_linear_infinite]"></div>
        
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(250,250,249,0.5)_100%)]"></div>
      </div>

      <div className="relative z-10 text-center max-w-4xl mx-auto px-6 pt-20">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/60 border border-slate-200 shadow-sm text-sm font-semibold text-slate-600 mb-8 backdrop-blur-sm">
          <span>SIH26066</span>
          <span className="w-1 h-1 rounded-full bg-slate-300"></span>
          <span>Ministry of Earth Sciences</span>
          <span className="w-1 h-1 rounded-full bg-slate-300"></span>
          <span>INCOIS</span>
        </div>
        
        <h1 className="text-6xl md:text-8xl font-bold tracking-tight text-slate-900 mb-8 leading-[1.1]">
          Seeing <span className="text-cyan-600">beneath</span> <br/>
          <span className="text-slate-800">the surface.</span>
        </h1>
        
        <p className="text-xl md:text-2xl text-slate-600 mb-12 max-w-2xl mx-auto leading-relaxed">
          Physics-guided AI reconstruction of subsurface ocean temperature fields using 
          surface satellite observations and real-time AIS intelligence.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/dashboard" className="px-8 py-4 bg-slate-900 text-white rounded-xl font-semibold text-lg hover:bg-slate-800 transition-all hover:scale-105 hover:shadow-xl hover:shadow-slate-900/20 active:scale-95 w-full sm:w-auto">
            Launch Ocean Explorer
          </Link>
          <Link href="/fleet" className="px-8 py-4 bg-white text-slate-700 border border-slate-200 rounded-xl font-semibold text-lg hover:bg-slate-50 transition-all hover:shadow-lg w-full sm:w-auto">
            Live Fleet Radar
          </Link>
        </div>
      </div>
    </div>
  );
}
