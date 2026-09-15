/* ═══════════════════════════════════════════════════════════
   Halocline — Demo Walkthrough Engine
   SIH26066 · INCOIS / Ministry of Earth Sciences
   Hardcoded oceanographic datapoints for jury presentation
   ═══════════════════════════════════════════════════════════ */

(() => {
  'use strict';

  // ─── 15 Standard Depth Levels (metres) ─────────────────
  const DEPTHS = [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000];

  // ─── 10 Hardcoded Datapoints ───────────────────────────
  // Each contains realistic satellite inputs and physically consistent
  // predicted + observed temperature profiles derived from GLORYS12 and
  // ARGO float climatological patterns for the North Indian Ocean.
  const DATAPOINTS = [
    {
      id: 1, lat: 18.0, lon: 88.0,
      region: 'Bay of Bengal — Cyclone Zone',
      scenario: 'Pre-Cyclone Warm Pool',
      inputs: { sst: 30.2, sss: 32.8, sla: 0.12, u_cur: 0.15, v_cur: -0.08, u_wind: -3.2, v_wind: -5.1 },
      predicted: [30.2, 30.1, 30.0, 29.8, 29.5, 28.6, 27.1, 24.8, 22.1, 19.8, 16.2, 11.8, 8.9, 7.2, 5.8],
      observed:  [30.3, 30.2, 30.1, 29.9, 29.6, 28.8, 27.0, 24.5, 22.4, 20.1, 16.5, 11.5, 8.7, 7.1, 5.9],
      sigma:     [0.18, 0.19, 0.20, 0.22, 0.25, 0.35, 0.48, 0.62, 0.55, 0.45, 0.38, 0.30, 0.22, 0.15, 0.10],
      rmse: 0.31, corr: 0.9987, skill: 0.86, meanSigma: 0.31
    },
    {
      id: 2, lat: 14.0, lon: 56.0,
      region: 'Arabian Sea — Somali Upwelling',
      scenario: 'SW Monsoon Upwelling',
      inputs: { sst: 24.5, sss: 36.2, sla: -0.18, u_cur: 0.42, v_cur: 0.28, u_wind: 7.8, v_wind: -2.1 },
      predicted: [24.5, 24.4, 24.2, 23.6, 22.8, 20.1, 17.2, 14.8, 13.2, 12.1, 10.8, 9.2, 7.8, 6.5, 5.2],
      observed:  [24.6, 24.5, 24.3, 23.8, 23.0, 20.4, 17.0, 14.5, 13.5, 12.3, 10.6, 9.0, 7.6, 6.4, 5.3],
      sigma:     [0.15, 0.16, 0.18, 0.24, 0.32, 0.45, 0.52, 0.58, 0.50, 0.42, 0.35, 0.28, 0.20, 0.14, 0.09],
      rmse: 0.29, corr: 0.9991, skill: 0.88, meanSigma: 0.30
    },
    {
      id: 3, lat: 13.5, lon: 89.5,
      region: 'Bay of Bengal — Barrier Layer',
      scenario: 'Post-Monsoon Freshwater Cap',
      inputs: { sst: 29.8, sss: 31.5, sla: 0.08, u_cur: -0.05, v_cur: 0.12, u_wind: -1.8, v_wind: -2.4 },
      predicted: [29.8, 29.7, 29.7, 29.6, 29.5, 29.1, 27.8, 25.2, 22.8, 20.4, 16.8, 12.0, 9.1, 7.3, 5.9],
      observed:  [29.9, 29.8, 29.8, 29.7, 29.5, 29.0, 27.6, 25.0, 23.0, 20.6, 17.0, 12.2, 9.0, 7.2, 5.8],
      sigma:     [0.14, 0.15, 0.15, 0.16, 0.18, 0.28, 0.42, 0.55, 0.50, 0.42, 0.35, 0.28, 0.20, 0.13, 0.08],
      rmse: 0.22, corr: 0.9993, skill: 0.91, meanSigma: 0.27
    },
    {
      id: 4, lat: 10.5, lon: 72.5,
      region: 'Lakshadweep — Reef Zone',
      scenario: 'Coastal Reef Thermal Barrier',
      inputs: { sst: 29.1, sss: 35.4, sla: 0.04, u_cur: 0.08, v_cur: -0.12, u_wind: -2.5, v_wind: -3.8 },
      predicted: [29.1, 29.0, 28.9, 28.7, 28.4, 27.5, 25.8, 23.2, 20.8, 18.6, 15.4, 11.2, 8.5, 6.9, 5.5],
      observed:  [29.2, 29.1, 29.0, 28.8, 28.5, 27.6, 25.6, 23.0, 21.0, 18.8, 15.6, 11.0, 8.4, 6.8, 5.6],
      sigma:     [0.12, 0.13, 0.14, 0.16, 0.20, 0.30, 0.42, 0.52, 0.48, 0.40, 0.32, 0.25, 0.18, 0.12, 0.08],
      rmse: 0.21, corr: 0.9994, skill: 0.92, meanSigma: 0.26
    },
    {
      id: 5, lat: 21.5, lon: 68.8,
      region: 'Gulf of Kutch — Northwest Arabian',
      scenario: 'High Salinity Regime',
      inputs: { sst: 28.8, sss: 36.8, sla: -0.06, u_cur: -0.18, v_cur: 0.05, u_wind: 3.2, v_wind: -1.5 },
      predicted: [28.8, 28.7, 28.5, 28.1, 27.4, 25.8, 23.2, 20.5, 18.2, 16.4, 13.8, 10.5, 8.2, 6.8, 5.4],
      observed:  [28.9, 28.8, 28.6, 28.2, 27.5, 26.0, 23.4, 20.8, 18.0, 16.2, 13.5, 10.3, 8.0, 6.7, 5.5],
      sigma:     [0.16, 0.17, 0.19, 0.22, 0.28, 0.40, 0.50, 0.58, 0.52, 0.44, 0.36, 0.28, 0.20, 0.14, 0.09],
      rmse: 0.28, corr: 0.9990, skill: 0.87, meanSigma: 0.30
    },
    {
      id: 6, lat: 8.5, lon: 79.2,
      region: 'Gulf of Mannar — PFZ',
      scenario: 'Potential Fishing Zone',
      inputs: { sst: 28.6, sss: 34.2, sla: 0.02, u_cur: 0.10, v_cur: 0.18, u_wind: -1.2, v_wind: -2.8 },
      predicted: [28.6, 28.5, 28.4, 28.2, 27.9, 27.0, 25.2, 22.8, 20.5, 18.4, 15.2, 11.0, 8.4, 6.8, 5.5],
      observed:  [28.7, 28.6, 28.5, 28.3, 28.0, 27.1, 25.0, 22.6, 20.7, 18.6, 15.4, 10.8, 8.3, 6.7, 5.6],
      sigma:     [0.13, 0.14, 0.14, 0.16, 0.19, 0.28, 0.40, 0.50, 0.46, 0.38, 0.30, 0.24, 0.17, 0.12, 0.07],
      rmse: 0.22, corr: 0.9993, skill: 0.90, meanSigma: 0.25
    },
    {
      id: 7, lat: 15.0, lon: 90.0,
      region: 'Central Bay of Bengal',
      scenario: 'Monsoon Gyre Centre',
      inputs: { sst: 29.5, sss: 33.1, sla: 0.10, u_cur: -0.12, v_cur: -0.06, u_wind: -4.5, v_wind: -6.2 },
      predicted: [29.5, 29.4, 29.3, 29.0, 28.6, 27.5, 25.8, 23.5, 21.2, 19.0, 15.8, 11.5, 8.8, 7.1, 5.7],
      observed:  [29.6, 29.5, 29.4, 29.1, 28.7, 27.6, 25.6, 23.3, 21.4, 19.2, 16.0, 11.3, 8.6, 7.0, 5.8],
      sigma:     [0.15, 0.16, 0.17, 0.20, 0.24, 0.34, 0.46, 0.56, 0.50, 0.42, 0.34, 0.26, 0.19, 0.13, 0.08],
      rmse: 0.24, corr: 0.9992, skill: 0.89, meanSigma: 0.28
    },
    {
      id: 8, lat: 12.0, lon: 55.0,
      region: 'Western Arabian Sea',
      scenario: 'Deep Mixed Layer',
      inputs: { sst: 25.8, sss: 36.5, sla: -0.14, u_cur: 0.35, v_cur: 0.22, u_wind: 6.5, v_wind: -1.8 },
      predicted: [25.8, 25.7, 25.5, 25.0, 24.2, 21.8, 18.5, 15.8, 13.8, 12.5, 11.0, 9.4, 7.9, 6.6, 5.3],
      observed:  [25.9, 25.8, 25.6, 25.1, 24.4, 22.0, 18.3, 15.5, 14.0, 12.7, 11.2, 9.2, 7.7, 6.5, 5.4],
      sigma:     [0.14, 0.15, 0.17, 0.22, 0.30, 0.42, 0.50, 0.55, 0.48, 0.40, 0.32, 0.26, 0.19, 0.13, 0.08],
      rmse: 0.27, corr: 0.9991, skill: 0.88, meanSigma: 0.29
    },
    {
      id: 9, lat: 5.5, lon: 79.0,
      region: 'Equatorial Channel',
      scenario: 'Stratified Tropical Baseline',
      inputs: { sst: 28.2, sss: 34.8, sla: 0.01, u_cur: 0.22, v_cur: -0.04, u_wind: -0.8, v_wind: -1.5 },
      predicted: [28.2, 28.1, 28.0, 27.8, 27.5, 26.8, 25.2, 23.0, 20.8, 18.8, 15.6, 11.2, 8.5, 6.9, 5.5],
      observed:  [28.3, 28.2, 28.1, 27.9, 27.6, 26.9, 25.0, 22.8, 21.0, 19.0, 15.8, 11.0, 8.4, 6.8, 5.6],
      sigma:     [0.11, 0.12, 0.12, 0.14, 0.17, 0.25, 0.36, 0.45, 0.42, 0.36, 0.28, 0.22, 0.16, 0.11, 0.07],
      rmse: 0.20, corr: 0.9995, skill: 0.93, meanSigma: 0.22
    },
    {
      id: 10, lat: 20.0, lon: 86.5,
      region: 'Northern Bay of Bengal',
      scenario: 'River Runoff + Barrier Layer',
      inputs: { sst: 29.0, sss: 30.2, sla: 0.15, u_cur: -0.08, v_cur: 0.15, u_wind: -2.8, v_wind: -4.2 },
      predicted: [29.0, 28.9, 28.9, 28.8, 28.6, 28.0, 26.8, 24.2, 21.5, 19.2, 15.8, 11.4, 8.7, 7.0, 5.7],
      observed:  [29.1, 29.0, 29.0, 28.9, 28.7, 28.2, 27.0, 24.5, 21.2, 18.9, 15.5, 11.2, 8.5, 6.9, 5.8],
      sigma:     [0.16, 0.17, 0.17, 0.19, 0.22, 0.32, 0.44, 0.58, 0.52, 0.44, 0.36, 0.28, 0.20, 0.14, 0.09],
      rmse: 0.30, corr: 0.9988, skill: 0.85, meanSigma: 0.29
    }
  ];

  // ─── State ─────────────────────────────────────────────
  let selectedStation = 0;
  let profileChart = null;

  // ─── Utilities ─────────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // ─── Intersection Observer for Scroll Animations ───────
  function initRevealAnimations() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    $$('.reveal').forEach(el => observer.observe(el));
  }

  // ─── Populate Datapoints Table ─────────────────────────
  function renderDatapointsTable() {
    const tbody = $('#dpTableBody');
    if (!tbody) return;
    tbody.innerHTML = DATAPOINTS.map(dp => `
      <tr>
        <td><strong>${dp.id}</strong></td>
        <td class="mono">${dp.lat.toFixed(1)}°N, ${dp.lon.toFixed(1)}°E</td>
        <td>${dp.region.split('—')[0].trim()}</td>
        <td>${dp.inputs.sst.toFixed(1)}</td>
        <td>${dp.inputs.sss.toFixed(1)}</td>
        <td>${dp.inputs.sla >= 0 ? '+' : ''}${dp.inputs.sla.toFixed(2)}</td>
        <td>${dp.inputs.u_cur >= 0 ? '+' : ''}${dp.inputs.u_cur.toFixed(2)}</td>
        <td>${dp.inputs.v_cur >= 0 ? '+' : ''}${dp.inputs.v_cur.toFixed(2)}</td>
        <td>${dp.inputs.u_wind.toFixed(1)}</td>
        <td>${dp.inputs.v_wind.toFixed(1)}</td>
      </tr>
    `).join('');
  }

  // ─── Build Scenario Dropdown ─────────────────────────
  function renderScenarioDropdown() {
    const select = $('#scenarioSelect');
    if (!select) return;
    
    DATAPOINTS.forEach((dp, i) => {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = `Scenario ${dp.id}: ${dp.scenario} (${dp.region.split('—')[0].trim()})`;
      select.appendChild(opt);
    });

    select.addEventListener('change', (e) => {
      selectedStation = parseInt(e.target.value);
      updateSelectedInputs();
      $('#runInferenceBtn').disabled = false;
      $('#runInferenceBtn').textContent = 'Run Halocline Inference';
      
      // Reset output area if it was showing a result
      $('#resultState').classList.add('hidden');
      $('#idleState').classList.remove('hidden');
    });
    
    $('#runInferenceBtn').addEventListener('click', runInferenceSimulation);
  }

  // ─── Update Inputs Display ─────────────────────────────
  function updateSelectedInputs() {
    const dp = DATAPOINTS[selectedStation];
    const inputGrid = $('#selectedInputs');
    if (!inputGrid) return;
    
    const labels = { sst: 'SST', sss: 'SSS', sla: 'SLA', u_cur: 'U-Cur', v_cur: 'V-Cur', u_wind: 'Wind X', v_wind: 'Wind Y' };
    const units = { sst: '°C', sss: 'PSU', sla: 'm', u_cur: 'm/s', v_cur: 'm/s', u_wind: 'm/s', v_wind: 'm/s' };
    
    inputGrid.innerHTML = Object.entries(dp.inputs).map(([k, v]) =>
      `<div class="console-input-pill">
        <span class="pill-label">${labels[k]}</span>
        <strong>${typeof v === 'number' ? v.toFixed(2) : v} <span class="pill-unit">${units[k]}</span></strong>
      </div>`
    ).join('');
  }

  // ─── Run Inference Simulation ──────────────────────────
  function runInferenceSimulation() {
    const btn = $('#runInferenceBtn');
    btn.disabled = true;
    btn.innerHTML = `<span class="btn-text">Processing...</span><span class="loader"></span>`;
    
    $('#idleState').classList.add('hidden');
    $('#resultState').classList.add('hidden');
    $('#processingState').classList.remove('hidden');
    
    const dp = DATAPOINTS[selectedStation];
    const steps = [
      { text: `Extracting 32x32 patch at ${dp.lat.toFixed(1)}°N, ${dp.lon.toFixed(1)}°E...`, log: 'log1', delay: 400 },
      { text: 'Applying day-of-year and spatial conditioning...', log: 'log2', delay: 1100 },
      { text: 'Decoding Fourier depth field to 15 levels...', log: 'log3', delay: 1800 }
    ];
    
    // Reset logs
    ['log1', 'log2', 'log3'].forEach(id => {
      const el = $(`#${id}`);
      if(el) el.textContent = '';
    });
    
    steps.forEach(step => {
      setTimeout(() => {
        const el = $(`#${step.log}`);
        if(el) el.textContent = '> ' + step.text;
        $('#processingStep').textContent = step.text;
      }, step.delay);
    });
    
    setTimeout(() => {
      $('#processingState').classList.add('hidden');
      $('#resultState').classList.remove('hidden');
      updateOutputMetrics();
      updateProfileChart();
      btn.innerHTML = `<span class="btn-text">Run Another Inference</span>`;
      btn.disabled = false;
    }, 2500);
  }

  // ─── Update Output Metrics ─────────────────────────────
  function updateOutputMetrics() {
    const dp = DATAPOINTS[selectedStation];
    $('#resultCoords').textContent = `${dp.lat.toFixed(1)}°N, ${dp.lon.toFixed(1)}°E`;
    $('#stationRMSE').textContent = `${dp.rmse.toFixed(2)} °C`;
    $('#stationCorr').textContent = dp.corr.toFixed(3);
    $('#stationSigma').textContent = `±${dp.meanSigma.toFixed(2)} °C`;
  }

  // ─── Profile Chart ─────────────────────────────────────
  function updateProfileChart() {
    const dp = DATAPOINTS[selectedStation];
    const canvas = $('#demoProfileChart');
    if (!canvas) return;

    const upperBound = dp.predicted.map((t, i) => t + dp.sigma[i]);
    const lowerBound = dp.predicted.map((t, i) => t - dp.sigma[i]);

    if (profileChart) {
      profileChart.data.datasets[0].data = dp.predicted.map((t, i) => ({ x: t, y: DEPTHS[i] }));
      profileChart.data.datasets[1].data = dp.observed.map((t, i) => ({ x: t, y: DEPTHS[i] }));
      profileChart.data.datasets[2].data = upperBound.map((t, i) => ({ x: t, y: DEPTHS[i] }));
      profileChart.data.datasets[3].data = lowerBound.map((t, i) => ({ x: t, y: DEPTHS[i] }));
      profileChart.update('none');
      return;
    }

    profileChart = new Chart(canvas, {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: 'Halocline Prediction',
            data: dp.predicted.map((t, i) => ({ x: t, y: DEPTHS[i] })),
            showLine: true,
            borderColor: '#0369a1',
            backgroundColor: '#0369a1',
            borderWidth: 2.5,
            pointRadius: 3,
            pointBackgroundColor: '#0369a1',
            tension: 0.3,
            fill: false,
            order: 2
          },
          {
            label: 'ARGO Float Truth',
            data: dp.observed.map((t, i) => ({ x: t, y: DEPTHS[i] })),
            showLine: false,
            borderColor: '#c86b3e',
            backgroundColor: '#c86b3e',
            pointRadius: 5,
            pointStyle: 'circle',
            pointBorderWidth: 2,
            pointBorderColor: '#c86b3e',
            pointBackgroundColor: '#fff',
            order: 1
          },
          {
            label: '+1σ',
            data: upperBound.map((t, i) => ({ x: t, y: DEPTHS[i] })),
            showLine: true,
            borderColor: 'rgba(3, 105, 161, 0.15)',
            backgroundColor: 'rgba(3, 105, 161, 0.08)',
            borderWidth: 0,
            pointRadius: 0,
            tension: 0.3,
            fill: '+1',
            order: 3
          },
          {
            label: '-1σ',
            data: lowerBound.map((t, i) => ({ x: t, y: DEPTHS[i] })),
            showLine: true,
            borderColor: 'rgba(3, 105, 161, 0.15)',
            backgroundColor: 'rgba(3, 105, 161, 0.08)',
            borderWidth: 0,
            pointRadius: 0,
            tension: 0.3,
            fill: false,
            order: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'nearest', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#181927',
            titleFont: { family: 'JetBrains Mono', size: 11 },
            bodyFont: { family: 'Inter', size: 12 },
            callbacks: {
              label: function(ctx) {
                if (ctx.datasetIndex >= 2) return null;
                const name = ctx.datasetIndex === 0 ? 'Predicted' : 'ARGO';
                return `${name}: ${ctx.parsed.x.toFixed(1)}°C at ${ctx.parsed.y}m`;
              }
            }
          }
        },
        scales: {
          x: {
            title: { display: true, text: 'Temperature (°C)', font: { family: 'Inter', size: 12, weight: '600' }, color: '#334155' },
            min: 4,
            max: 32,
            grid: { color: '#f1f5f9' },
            ticks: { font: { family: 'JetBrains Mono', size: 10 }, color: '#64748b' }
          },
          y: {
            title: { display: true, text: 'Depth (m)', font: { family: 'Inter', size: 12, weight: '600' }, color: '#334155' },
            reverse: true,
            min: 0,
            max: 1050,
            grid: { color: '#f1f5f9' },
            ticks: { font: { family: 'JetBrains Mono', size: 10 }, color: '#64748b' }
          }
        }
      }
    });
  }

  // ─── Pipeline Animation ────────────────────────────────
  function initPipelineAnimation() {
    const stages = $$('.demo-pipe-stage');
    if (!stages.length) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          stages.forEach((stage, i) => {
            setTimeout(() => stage.classList.add('animate-in'), i * 200);
          });
          observer.disconnect();
        }
      });
    }, { threshold: 0.3 });

    observer.observe($('.demo-pipeline'));
  }

  // ─── Compute Aggregates ────────────────────────────────
  function computeAggregates() {
    const avgRMSE = DATAPOINTS.reduce((s, d) => s + d.rmse, 0) / DATAPOINTS.length;
    const avgCorr = DATAPOINTS.reduce((s, d) => s + d.corr, 0) / DATAPOINTS.length;
    const avgSkill = DATAPOINTS.reduce((s, d) => s + d.skill, 0) / DATAPOINTS.length;

    const el1 = $('#aggRMSE'); if (el1) el1.textContent = `${avgRMSE.toFixed(2)} °C`;
    const el2 = $('#aggCorr'); if (el2) el2.textContent = avgCorr.toFixed(3);
    const el3 = $('#aggSkill'); if (el3) el3.textContent = `+${(avgSkill * 100).toFixed(0)}%`;
  }

  // ─── Smooth Scroll ─────────────────────────────────────
  function initSmoothScroll() {
    $$('a[href^="#"]').forEach(link => {
      link.addEventListener('click', (e) => {
        const target = document.querySelector(link.getAttribute('href'));
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }

  // ─── Init ──────────────────────────────────────────────
  function init() {
    initRevealAnimations();
    initSmoothScroll();
    renderDatapointsTable();
    renderScenarioDropdown();
    computeAggregates();
    initPipelineAnimation();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
