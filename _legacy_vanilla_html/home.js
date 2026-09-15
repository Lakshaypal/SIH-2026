const status = document.querySelector('#homeLiveStatus');
const live = document.querySelector('#liveVesselCount');
const demo = document.querySelector('#demoVesselCount');

async function updateTelemetry() {
  try {
    const response = await fetch('/api/status');
    if (!response.ok) throw new Error('status unavailable');
    const data = await response.json();
    live.textContent = data.liveVessels ?? 0;
    demo.textContent = data.demoVessels ?? 0;
    status.textContent = data.connected ? `● LIVE AIS · ${data.liveVessels ?? 0} reports` : `● DEMO MODE · ${data.demoVessels ?? 0} vessels`;
    status.classList.toggle('connected', Boolean(data.connected));
  } catch {
    status.textContent = '● LOCAL DEMO MODE';
    live.textContent = '—'; demo.textContent = '96';
  }
}
updateTelemetry();
setInterval(updateTelemetry, 10000);
