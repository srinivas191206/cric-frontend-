// ============================================================================
// TRAJECTA COACH AI - CLIENT ENGINE (PROFESSIONAL LIGHT THEME)
// Complete Session Tracking, Delivery Trimming, Ball Vision & 3D Stadium DRS
// ============================================================================

// Core App State
let currentFile = null;
let currentSessionId = null;
let currentSession = null;
let activeDeliveryIndex = -1;
let pitchMarkerHitboxes = [];

// Delivery Timeline Trim State
let trimState = {
  duration: 0,
  startTime: 0,
  endTime: 0,
  isPlayingPreview: false,
  objectUrl: null
};

// 5-Ball Theme Palette
const SPELL_BALL_COLORS = [
  { name: "Crimson Red", hex: "#ef4444", intCol: 0xef4444 },
  { name: "Sapphire Blue", hex: "#2563eb", intCol: 0x2563eb },
  { name: "Amber Gold", hex: "#d97706", intCol: 0xd97706 },
  { name: "Emerald Green", hex: "#059669", intCol: 0x059669 },
  { name: "Ultra Violet", hex: "#7c3aed", intCol: 0x7c3aed },
  { name: "Cyan Teal", hex: "#0891b2", intCol: 0x0891b2 }
];

// ============================================================================
// SCREEN 01: THEME CONTROLLER (LIGHT / DARK MODES)
// ============================================================================
let currentTheme = 'light';

function initTheme() {
  const urlParams = new URLSearchParams(window.location.search);
  const themeParam = urlParams.get('theme');
  const savedTheme = themeParam || localStorage.getItem('trajecta_theme') || 'dark';
  applyTheme(savedTheme);
}

function toggleAppTheme() {
  const newTheme = (currentTheme === 'light') ? 'dark' : 'light';
  applyTheme(newTheme);
}

function applyTheme(theme) {
  currentTheme = theme;
  localStorage.setItem('trajecta_theme', theme);

  if (theme === 'dark') {
    document.body.classList.remove('light-theme');
    document.body.classList.add('dark-theme');
  } else {
    document.body.classList.remove('dark-theme');
    document.body.classList.add('light-theme');
  }

  // Redraw analytical 2D canvases to match active theme
  if (typeof currentSession !== 'undefined' && currentSession && currentSession.deliveries && currentSession.deliveries.length > 0) {
    if (typeof draw2DPitchDispersionCanvas === 'function') draw2DPitchDispersionCanvas(currentSession.deliveries);
    if (typeof drawSideViewTrajectoryCanvas === 'function') drawSideViewTrajectoryCanvas(currentSession.deliveries);
    if (typeof drawReleasePointsCanvas === 'function') drawReleasePointsCanvas(currentSession.deliveries);
    if (typeof renderPaceProgressionChart === 'function') renderPaceProgressionChart(currentSession.deliveries, currentSession.stats);
  }
}

// ============================================================================
// DASHBOARD NAVIGATION & VIEWPORT CONTROLLER
// ============================================================================
let currentDashboardView = 'overview';

const VIEW_TITLES = {
  'overview': 'Insights Command Center',
  'delivery-studio': 'Delivery Vision Studio',
  'spell-insights': 'Spell Analytics & Multi-Ball Map',
  'upload-trim': 'Delivery Vision Studio',
  'sessions': 'Sessions & Spells Manager'
};

function switchDashboardView(viewId) {
  let targetPanelId = 'view-' + viewId;
  let targetNavView = viewId;

  if (viewId === 'upload-trim') {
    targetPanelId = 'view-delivery-studio';
    targetNavView = 'upload-trim';
  }

  // Hide all view panels
  const panels = document.querySelectorAll('.dashboard-view-panel');
  panels.forEach(p => p.classList.add('hidden'));

  // Show active panel
  const activePanel = document.getElementById(targetPanelId);
  if (activePanel) {
    activePanel.classList.remove('hidden');
  }

  // Ensure workspace inside delivery studio is never hidden
  if (viewId === 'delivery-studio' || viewId === 'upload-trim') {
    const workspace = document.getElementById('active-session-workspace');
    if (workspace) workspace.classList.remove('hidden');
    if (currentSession) {
      updateSessionUI();
      if (currentSession.deliveries && currentSession.deliveries.length > 0) {
        const idx = (activeDeliveryIndex >= 0 && activeDeliveryIndex < currentSession.deliveries.length)
          ? activeDeliveryIndex
          : currentSession.deliveries.length - 1;
        selectSessionBall(idx, false);
      }
    }
  }

  // Update sidebar nav active items
  const navItems = document.querySelectorAll('.sidebar-nav-item');
  navItems.forEach(item => {
    if (item.getAttribute('data-view') === targetNavView) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Update breadcrumb title
  const breadcrumb = document.getElementById('topbar-breadcrumb-title');
  if (breadcrumb && VIEW_TITLES[viewId]) {
    breadcrumb.textContent = VIEW_TITLES[viewId];
  }

  currentDashboardView = viewId;
  try {
    if (history.replaceState) {
      history.replaceState(null, '', '#' + viewId);
    }
  } catch (e) {}

  // Specific panel triggers
  if (viewId === 'spell-insights') {
    setTimeout(() => {
      if (currentSession && currentSession.deliveries) {
        if (typeof draw2DPitchDispersionCanvas === 'function') draw2DPitchDispersionCanvas(currentSession.deliveries);
        if (typeof drawSideViewTrajectoryCanvas === 'function') drawSideViewTrajectoryCanvas(currentSession.deliveries);
        if (typeof drawReleasePointsCanvas === 'function') drawReleasePointsCanvas(currentSession.deliveries);
        if (typeof renderPaceProgressionChart === 'function') renderPaceProgressionChart(currentSession.deliveries, currentSession.stats);
      }
    }, 80);
  } else if (viewId === 'upload-trim') {
    setTimeout(() => {
      const dropZone = document.getElementById('drop-zone');
      if (dropZone) {
        dropZone.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 120);
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
  closeMobileSidebar();
}

function toggleMobileSidebar() {
  const sidebar = document.getElementById('dashboard-sidebar');
  const backdrop = document.getElementById('sidebar-mobile-backdrop');
  if (sidebar) {
    sidebar.classList.toggle('mobile-open');
  }
  if (backdrop) {
    backdrop.classList.toggle('hidden');
  }
}

function closeMobileSidebar() {
  const sidebar = document.getElementById('dashboard-sidebar');
  const backdrop = document.getElementById('sidebar-mobile-backdrop');
  if (sidebar) {
    sidebar.classList.remove('mobile-open');
  }
  if (backdrop) {
    backdrop.classList.add('hidden');
  }
}

// ============================================================================
// COMMAND CENTER: DIRECT VIDEO INGESTION & DEEP-DIVE INSIGHTS
// ============================================================================

function handleCommandDropClick() {
  const fileInput = document.getElementById('cmd-file-input');
  if (fileInput) fileInput.click();
}

function handleCommandFileSelect(event) {
  const file = event.target.files && event.target.files[0];
  if (file) {
    processUploadedBowlingVideo(file);
  }
}

async function processUploadedBowlingVideo(file) {
  if (!file) return;

  // Ensure an active session is loaded
  if (!currentSessionId) {
    try {
      const res = await fetch('/api/sessions');
      if (res.ok) {
        const sessions = await res.json();
        if (sessions && sessions.length > 0) {
          await switchActiveSession(sessions[0].id);
        } else {
          const createRes = await fetch('/api/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: "Pace Practice Spell",
              bowler_name: "Fast Bowler",
              bowling_type: "Right-arm Fast",
              bowling_arm: "Right-arm",
              target_balls: 6
            })
          });
          if (createRes.ok) {
            const newSess = await createRes.json();
            await switchActiveSession(newSess.id);
          }
        }
      }
    } catch (e) {
      console.warn("Auto-session check:", e);
    }
  }

  // Switch to Delivery Studio view and load video for trimming
  switchDashboardView('delivery-studio');
  handleFileSelected(file);

  setTimeout(() => {
    const trimCard = document.getElementById('video-trim-card');
    if (trimCard) {
      trimCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, 120);
}

function initCommandCenterDropZone() {
  const dropZone = document.getElementById('cmd-drop-zone');
  if (!dropZone) return;

  ['dragenter', 'dragover'].forEach(name => {
    dropZone.addEventListener(name, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('drag-over');
    }, false);
  });

  ['dragleave', 'drop'].forEach(name => {
    dropZone.addEventListener(name, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('drag-over');
    }, false);
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('drag-over');
    const dt = e.dataTransfer;
    const file = dt && dt.files && dt.files[0];
    if (file && file.type.startsWith('video/')) {
      processUploadedBowlingVideo(file);
    }
  }, false);
}

function updateCommandCenterLiveInsights(session, dels) {
  if (!session) return;
  const target = session.target_balls || 6;
  const count = dels ? dels.length : 0;
  const stats = session.stats || {};

  // Banner Update
  const bannerHeading = document.getElementById('banner-bowler-heading');
  const bannerSub = document.getElementById('banner-bowler-sub');
  const qsPeak = document.getElementById('qs-peak-speed');
  const qsCorridor = document.getElementById('qs-corridor-status');
  const qsThreat = document.getElementById('qs-threat-status');

  if (bannerHeading) bannerHeading.textContent = `${session.bowler_name || 'Bowler'} · ${session.name || session.bowling_type || 'Bowling Spell'}`;
  if (bannerSub) bannerSub.textContent = `${session.bowling_arm || 'Right-arm'} ${session.bowling_type || 'Fast'} · 20.12m MCC Pitch Calibrated · ${count} Delivered / ${target} Target Spell`;

  // Speeds
  const avgKph = stats.avg_speed_kph || (count ? dels.reduce((a, b) => a + (b.speed_kph || b.speed_mph * 1.60934 || 0), 0) / count : 142.4);
  const maxKph = stats.max_speed_kph || (count ? Math.max(...dels.map(d => d.speed_kph || d.speed_mph * 1.60934 || 0)) : 148.0);
  const minKph = stats.min_speed_kph || (count ? Math.min(...dels.map(d => d.speed_kph || d.speed_mph * 1.60934 || 0)) : 136.0);

  if (qsPeak) qsPeak.textContent = `${maxKph.toFixed(1)} km/h`;

  // KPIs
  const okpiAvg = document.getElementById('okpi-avg-speed');
  const okpiRange = document.getElementById('okpi-speed-range');
  if (okpiAvg) okpiAvg.textContent = avgKph.toFixed(1);
  if (okpiRange) okpiRange.textContent = `Peak: ${maxKph.toFixed(1)} km/h · Min: ${minKph.toFixed(1)} km/h (${(minKph / 1.60934).toFixed(1)} mph)`;

  // Length calculations
  let goodCount = 0, fullCount = 0, backCount = 0, yorkerCount = 0, shortCount = 0;
  dels.forEach(d => {
    const dist = d.distance_from_crease_m || 5.0;
    const zone = (d.length_zone || '').toLowerCase();
    if (zone.includes('good') || (dist >= 4.5 && dist < 6.0)) goodCount++;
    else if (zone.includes('full') || (dist >= 2.5 && dist < 4.5)) fullCount++;
    else if (zone.includes('back') || (dist >= 6.0 && dist <= 8.0)) backCount++;
    else if (zone.includes('yorker') || dist < 2.5) yorkerCount++;
    else shortCount++;
  });

  const goodPct = count > 0 ? Math.round((goodCount / count) * 100) : 80;
  const fullPct = count > 0 ? Math.round((fullCount / count) * 100) : 20;
  const backPct = count > 0 ? Math.round((backCount / count) * 100) : 0;
  const yorkerPct = count > 0 ? Math.round((yorkerCount / count) * 100) : 0;
  const shortPct = count > 0 ? Math.round((shortCount / count) * 100) : 0;

  const okpiLengthPct = document.getElementById('okpi-length-pct');
  if (okpiLengthPct) okpiLengthPct.textContent = `${goodPct}%`;
  if (qsCorridor) qsCorridor.textContent = `Good Length (${goodPct}%)`;

  // Swing & Release
  const avgSwing = count > 0 ? (dels.reduce((a, b) => a + (b.swing_sf || 0.42), 0) / count) : 0.42;
  const avgRel = count > 0 ? (dels.reduce((a, b) => a + (b.release_height_m || 2.14), 0) / count) : 2.14;
  const okpiSwing = document.getElementById('okpi-swing-val');
  const okpiRelease = document.getElementById('okpi-release-val');
  if (okpiSwing) okpiSwing.textContent = avgSwing.toFixed(2);
  if (okpiRelease) okpiRelease.textContent = avgRel.toFixed(2);

  // Wicket Threat
  const threatPct = Math.min(95, Math.max(60, Math.round(goodPct * 0.7 + (avgKph > 140 ? 20 : 10))));
  const okpiStumps = document.getElementById('okpi-stumps-val');
  if (okpiStumps) okpiStumps.textContent = `${threatPct}%`;
  if (qsThreat) qsThreat.textContent = `${threatPct}% Projected`;

  // Length Zone Distribution Bars
  const setBar = (statId, barId, pct, n) => {
    const statEl = document.getElementById(statId);
    const barEl = document.getElementById(barId);
    if (statEl) statEl.textContent = `${pct}% (${n} ball${n === 1 ? '' : 's'})`;
    if (barEl) barEl.style.width = `${pct}%`;
  };
  setBar('zdi-good-stat', 'zdi-good-bar', goodPct, count === 0 ? 4 : goodCount);
  setBar('zdi-full-stat', 'zdi-full-bar', fullPct, count === 0 ? 1 : fullCount);
  setBar('zdi-back-stat', 'zdi-back-bar', backPct, backCount);
  setBar('zdi-yorker-stat', 'zdi-yorker-bar', yorkerPct, yorkerCount);
  setBar('zdi-short-stat', 'zdi-short-bar', shortPct, shortCount);

  // Deliveries Table
  const tbody = document.getElementById('cmd-deliveries-tbody');
  if (tbody) {
    tbody.innerHTML = '';
    if (count === 0) {
      const emptyRow = document.createElement('tr');
      emptyRow.innerHTML = `
        <td colspan="7" style="text-align: center; padding: 28px 16px; color: var(--text-muted); font-size: 13px;">
          No deliveries recorded in this spell yet. Drop a bowling video in the studio above to analyze ball 1.
        </td>
      `;
      tbody.appendChild(emptyRow);
    } else {
      dels.forEach((d, idx) => {
        const col = SPELL_BALL_COLORS[idx % SPELL_BALL_COLORS.length];
        const tr = document.createElement('tr');
        const kph = d.speed_kph ? d.speed_kph.toFixed(1) : (d.speed_mph ? (d.speed_mph * 1.60934).toFixed(1) : '142.4');
        const mph = d.speed_mph ? Math.round(d.speed_mph) : Math.round(parseFloat(kph) / 1.60934);
        const dist = d.distance_from_crease_m ? d.distance_from_crease_m.toFixed(1) : '5.2';
        const zone = d.length_zone || 'Good Length';
        const line = d.lateral_line || 'Outside Off';
        const sw = d.swing_sf !== undefined ? d.swing_sf.toFixed(2) : '0.42';
        const sp = d.spin_deg !== undefined ? d.spin_deg.toFixed(1) : '4.8';

        tr.innerHTML = `
          <td>
            <div class="cmd-ball-num-badge" style="border: 2px solid ${col.hex}; color: ${col.hex}; font-weight: 800;">
              B${idx + 1}
            </div>
          </td>
          <td>
            <div class="table-speed-cell">
              <span class="speed-kph">${kph} km/h</span>
              <span class="speed-sub">(${mph} mph)</span>
            </div>
          </td>
          <td>
            <span class="table-zone-pill" style="border-left: 3px solid ${col.hex};">
              ${zone} · ${dist}m
            </span>
          </td>
          <td><span class="table-line-badge">${line}</span></td>
          <td><span class="table-metric-val text-blue">${sw} sf</span></td>
          <td><span class="table-metric-val text-amber">${sp}°</span></td>
          <td>
            <div class="cmd-table-actions">
              <button type="button" class="btn-table-sm" onclick="goToStudioDelivery(${idx})">Studio Replay</button>
              <button type="button" class="btn-table-sm btn-drs-sm" onclick="openBallIn3DStadium(${idx})">3D DRS</button>
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }
  }
}

function goToStudioDelivery(index) {
  switchDashboardView('delivery-studio');
  selectSessionBall(index, true);
}

// ============================================================================
// SCREEN 01: INTERACTIVE DELIVERY PREVIEW COMPONENT CONTROLLER
// ============================================================================
let heroSpeedUnit = 'km/h';
let heroCurrentKmh = 127;

function initHeroPreviewPlayer() {
  const video = document.getElementById('hero-preview-video');
  if (!video) return;

  video.addEventListener('loadedmetadata', () => {
    updateHeroPreviewTime();
  });

  video.addEventListener('ended', () => {
    onHeroPreviewPlayStateChange(false);
  });
}

function toggleHeroPreviewPlay() {
  const video = document.getElementById('hero-preview-video');
  if (!video) return;

  if (video.paused) {
    video.play().catch(e => console.log("Hero video play error:", e));
  } else {
    video.pause();
  }
}

function onHeroPreviewPlayStateChange(isPlaying) {
  const overlayBtn = document.getElementById('hero-preview-overlay-btn');
  const ctrlIcon = document.getElementById('hero-ctrl-play-icon');
  const overlayIcon = document.getElementById('hero-preview-play-icon');

  if (isPlaying) {
    if (overlayBtn) overlayBtn.style.opacity = '0';
    if (ctrlIcon) ctrlIcon.textContent = 'Pause';
    if (overlayIcon) overlayIcon.textContent = 'Pause';
  } else {
    if (overlayBtn) overlayBtn.style.opacity = '1';
    if (ctrlIcon) ctrlIcon.textContent = 'Play';
    if (overlayIcon) overlayIcon.textContent = 'Play';
  }
}

function updateHeroPreviewTime() {
  const video = document.getElementById('hero-preview-video');
  const timeDisplay = document.getElementById('hero-preview-time');
  const progressBar = document.getElementById('hero-scrubber-progress');
  const thumb = document.getElementById('hero-scrubber-thumb');
  if (!video) return;

  const cur = video.currentTime || 0;
  const dur = video.duration || 8;

  const curMin = Math.floor(cur / 60);
  const curSec = Math.floor(cur % 60).toString().padStart(2, '0');
  const durMin = Math.floor(dur / 60);
  const durSec = Math.floor(dur % 60).toString().padStart(2, '0');

  if (timeDisplay) {
    timeDisplay.textContent = `${curMin}:${curSec} / ${durMin}:${durSec}`;
  }

  const pct = dur > 0 ? (cur / dur) * 100 : 0;
  if (progressBar) progressBar.style.width = `${pct}%`;
  if (thumb) thumb.style.left = `${pct}%`;
}

function seekHeroPreviewVideo(e) {
  const video = document.getElementById('hero-preview-video');
  const track = document.getElementById('hero-scrubber-track');
  if (!video || !track) return;

  const rect = track.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const pct = Math.max(0, Math.min(1, clickX / rect.width));

  const dur = video.duration || 8;
  video.currentTime = pct * dur;
  updateHeroPreviewTime();
}

function toggleHeroPreviewFullscreen() {
  const previewCard = document.querySelector('.preview-video-viewport');
  if (!previewCard) return;

  if (!document.fullscreenElement) {
    previewCard.requestFullscreen().catch(err => {
      console.warn("Fullscreen request error:", err);
    });
  } else {
    document.exitFullscreen();
  }
}

function toggleHeroSpeedUnit() {
  const speedEl = document.getElementById('hero-telemetry-speed');
  const unitEl = document.getElementById('hero-telemetry-unit');
  const skySpeedEl = document.getElementById('sky-telemetry-speed');
  if (!speedEl || !unitEl) return;

  if (heroSpeedUnit === 'km/h') {
    heroSpeedUnit = 'mph';
    const mph = Math.round(heroCurrentKmh * 0.621371);
    speedEl.textContent = mph;
    unitEl.textContent = 'mph';
    if (skySpeedEl) skySpeedEl.textContent = `${mph} mph`;
  } else {
    heroSpeedUnit = 'km/h';
    speedEl.textContent = heroCurrentKmh;
    unitEl.textContent = 'km/h';
    if (skySpeedEl) skySpeedEl.textContent = `${heroCurrentKmh} km/h`;
  }
}

// ============================================================================
// SCREEN 01: GUIDED SAMPLE DEMO MODAL CONTROLLER
// ============================================================================
const SAMPLE_DELIVERIES_DATA = {
  1: {
    bowler: "Jasprit Bumrah",
    speedKmh: 142,
    length: "Good Length",
    distance: "4.5 m from crease",
    line: "Outside Off",
    video: "/static/outputs/sample_1_delivery_001.mp4",
    poster: "/static/samples/sample_ball_1_delivery.png"
  },
  2: {
    bowler: "Pat Cummins",
    speedKmh: 138,
    length: "Back of Length",
    distance: "6.1 m from crease",
    line: "4th Stump",
    video: "/static/outputs/sample_2_delivery_001.mp4",
    poster: "/static/samples/sample_ball_2_flight.png"
  },
  3: {
    bowler: "Mitchell Starc",
    speedKmh: 148,
    length: "Full Yorker",
    distance: "1.5 m from crease",
    line: "Middle & Leg",
    video: "/static/outputs/video_1_delivery_001.mp4",
    poster: "/static/samples/sample_ball_3_pitch.png"
  }
};

function openSampleDemoModal() {
  const modal = document.getElementById('sample-demo-modal');
  if (modal) {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
}

function closeSampleDemoModal() {
  const modal = document.getElementById('sample-demo-modal');
  if (modal) {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }
}

function handleSampleModalBackdrop(e) {
  if (e.target.id === 'sample-demo-modal') {
    closeSampleDemoModal();
  }
}

function selectSampleDelivery(sampleId) {
  const data = SAMPLE_DELIVERIES_DATA[sampleId];
  if (!data) return;

  closeSampleDemoModal();

  // Update Hero Preview Video
  const video = document.getElementById('hero-preview-video');
  if (video) {
    video.src = data.video;
    video.poster = data.poster;
    video.load();
    video.play().catch(e => console.log("Sample video autoplay:", e));
  }

  // Update Telemetry Displays
  heroCurrentKmh = data.speedKmh;
  const speedEl = document.getElementById('hero-telemetry-speed');
  const lengthEl = document.getElementById('hero-telemetry-length');
  const distEl = document.getElementById('hero-telemetry-distance');
  const lineEl = document.getElementById('hero-telemetry-line');

  const skySpeed = document.getElementById('sky-telemetry-speed');
  const skyLength = document.getElementById('sky-telemetry-length');
  const skyLine = document.getElementById('sky-telemetry-line');

  if (speedEl) speedEl.textContent = heroSpeedUnit === 'mph' ? Math.round(data.speedKmh * 0.621371) : data.speedKmh;
  if (lengthEl) lengthEl.textContent = data.length;
  if (distEl) distEl.textContent = data.distance;
  if (lineEl) lineEl.textContent = data.line;

  if (skySpeed) skySpeed.textContent = `${data.speedKmh} km/h`;
  if (skyLength) skyLength.textContent = data.length;
  if (skyLine) skyLine.textContent = data.line;

  // Pulse animation on preview card
  const card = document.getElementById('hero-delivery-preview');
  if (card) {
    card.style.transform = 'scale(1.02)';
    setTimeout(() => { card.style.transform = ''; }, 350);
  }
}

// ============================================================================
// SCREEN 01: HERO CTA & NAVIGATION FLOWS
// ============================================================================
function handleHeroUploadClick() {
  switchDashboardView('delivery-studio');
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');

  setTimeout(() => {
    if (dropZone) {
      dropZone.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (fileInput) fileInput.click();
    } else {
      showNewSessionScreen();
    }
  }, 200);
}

function handleGetStartedClick() {
  if (currentSessionId) {
    switchDashboardView('delivery-studio');
  } else {
    showNewSessionScreen();
  }
}

function initNavScrollSpy() {
  const sections = [
    { id: 'homepage-hero', nav: 'home' },
    { id: 'workflow-strip', nav: 'features' },
    { id: 'technical-credibility', nav: 'technology' },
    { id: 'about-section', nav: 'about' }
  ];

  window.addEventListener('scroll', () => {
    const scrollPos = window.scrollY + 120;
    for (let i = sections.length - 1; i >= 0; i--) {
      const el = document.getElementById(sections[i].id);
      if (el && el.offsetTop <= scrollPos) {
        document.querySelectorAll('.nav-link').forEach(link => {
          link.classList.toggle('active', link.getAttribute('data-nav') === sections[i].nav);
        });
        break;
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initHeroPreviewPlayer();
  initNavScrollSpy();

  initSessions();
  initDragAndDrop();
  initCommandCenterDropZone();
  initTrimControls();
  initDownloadButton();

  window.addEventListener('resize', () => {
    if (isStadiumModalOpen) onStadiumResize();
  });
});

// ============================================================================
// 1. SESSION MANAGEMENT & ONBOARDING VIEWS
// ============================================================================

/**
 * Initialize Sessions from Backend on Page Load
 */
async function initSessions() {
  try {
    const res = await fetch('/api/sessions');
    if (!res.ok) return;
    const sessions = await res.json();
    populateSessionDropdown(sessions);

    if (sessions && sessions.length > 0) {
      // Auto-select first session
      await switchActiveSession(sessions[0].id);

      // Restore view from URL hash if provided
      const hash = window.location.hash.replace('#', '');
      if (hash && VIEW_TITLES[hash]) {
        switchDashboardView(hash);
      }
    } else {
      // Show hero onboarding to create first session
      showNewSessionScreen();
    }
  } catch (err) {
    console.error("Failed to load cricket sessions:", err);
    showNewSessionScreen();
  }
}

/**
 * Populate Navbar Session Dropdown
 */
function populateSessionDropdown(sessions) {
  const sel = document.getElementById('session-select');
  if (!sel) return;

  sel.innerHTML = '<option value="">-- Switch Active Spell --</option>';
  sessions.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    const count = s.total_balls || (s.deliveries ? s.deliveries.length : 0);
    opt.textContent = `${s.bowler_name} - ${s.name} (${count}/${s.target_balls}b)`;
    if (currentSessionId === s.id) opt.selected = true;
    sel.appendChild(opt);
  });
}

// ============================================================================
// BOWLER PROFILE & SPELL EDIT MODAL
// ============================================================================

function onSidebarBowlerCardClick(event) {
  if (event.target.closest('.sidebar-bowler-edit-btn')) {
    return; // Handled by edit button
  }
  switchDashboardView('delivery-studio');
}

let pendingBowlerAvatarFile = null;

function onBowlerAvatarFileSelected(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    alert('Please select a valid image file (JPG, PNG, WEBP).');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    const avatarImg = document.getElementById('edit-avatar-img');
    const avatarInits = document.getElementById('edit-avatar-initials');
    const avatarVal = document.getElementById('edit-avatar-url-val');
    const removeBtn = document.getElementById('btn-avatar-remove');

    if (avatarImg) {
      avatarImg.src = dataUrl;
      avatarImg.classList.remove('hidden');
    }
    if (avatarInits) avatarInits.classList.add('hidden');
    if (avatarVal) avatarVal.value = dataUrl;
    if (removeBtn) removeBtn.classList.remove('hidden');

    pendingBowlerAvatarFile = file;
  };
  reader.readAsDataURL(file);
}

function removeBowlerAvatar() {
  const avatarImg = document.getElementById('edit-avatar-img');
  const avatarInits = document.getElementById('edit-avatar-initials');
  const avatarVal = document.getElementById('edit-avatar-url-val');
  const removeBtn = document.getElementById('btn-avatar-remove');
  const fileInput = document.getElementById('edit-avatar-file-input');

  if (avatarImg) {
    avatarImg.src = '';
    avatarImg.classList.add('hidden');
  }
  if (avatarInits) avatarInits.classList.remove('hidden');
  if (avatarVal) avatarVal.value = '';
  if (removeBtn) removeBtn.classList.add('hidden');
  if (fileInput) fileInput.value = '';

  pendingBowlerAvatarFile = 'REMOVE';
}

function openEditBowlerModal(event) {
  if (event && event.stopPropagation) {
    event.stopPropagation();
  }

  const modal = document.getElementById('edit-bowler-modal');
  if (!modal) return;

  pendingBowlerAvatarFile = null;

  const bowlerNameInput = document.getElementById('edit-bowler-name');
  const bowlerStyleSelect = document.getElementById('edit-bowling-style');
  const sessionNameInput = document.getElementById('edit-session-name');
  const avatarImg = document.getElementById('edit-avatar-img');
  const avatarInits = document.getElementById('edit-avatar-initials');
  const avatarVal = document.getElementById('edit-avatar-url-val');
  const removeBtn = document.getElementById('btn-avatar-remove');

  const curr = currentSession || {
    bowler_name: 'sandy',
    bowling_type: 'Right-arm Fast',
    name: 'Spell - Good Length Channel',
    target_balls: 3,
    avatar_url: ''
  };

  const parts = (curr.bowler_name || "Bowler").trim().split(/\s+/);
  const inits = parts.length > 1 
    ? (parts[0][0] + parts[1][0]).toUpperCase() 
    : parts[0].substring(0, 2).toUpperCase();

  if (bowlerNameInput) bowlerNameInput.value = curr.bowler_name || '';
  if (bowlerStyleSelect) bowlerStyleSelect.value = curr.bowling_type || 'Right-arm Fast';
  if (sessionNameInput) sessionNameInput.value = curr.name || '';
  setEditTargetBalls(curr.target_balls || 5);

  if (curr.avatar_url) {
    if (avatarImg) {
      avatarImg.src = curr.avatar_url;
      avatarImg.classList.remove('hidden');
    }
    if (avatarInits) avatarInits.classList.add('hidden');
    if (avatarVal) avatarVal.value = curr.avatar_url;
    if (removeBtn) removeBtn.classList.remove('hidden');
  } else {
    if (avatarImg) {
      avatarImg.src = '';
      avatarImg.classList.add('hidden');
    }
    if (avatarInits) {
      avatarInits.innerText = inits;
      avatarInits.classList.remove('hidden');
    }
    if (avatarVal) avatarVal.value = '';
    if (removeBtn) removeBtn.classList.add('hidden');
  }

  modal.classList.remove('hidden');
  if (bowlerNameInput) bowlerNameInput.focus();
}

function closeEditBowlerModal() {
  const modal = document.getElementById('edit-bowler-modal');
  if (modal) modal.classList.add('hidden');
  pendingBowlerAvatarFile = null;
}

function onEditBowlerBackdropClick(event) {
  if (event.target.id === 'edit-bowler-modal') {
    closeEditBowlerModal();
  }
}

function setEditTargetBalls(count) {
  const hiddenInput = document.getElementById('edit-target-balls-val');
  if (hiddenInput) hiddenInput.value = count;

  const pills = document.querySelectorAll('[data-edit-balls]');
  pills.forEach(pill => {
    const balls = parseInt(pill.getAttribute('data-edit-balls'), 10);
    pill.classList.toggle('active', balls === count);
  });
}

async function submitEditBowlerProfile() {
  const bowlerName = (document.getElementById('edit-bowler-name')?.value || '').trim();
  const bowlingStyle = document.getElementById('edit-bowling-style')?.value || 'Right-arm Fast';
  const sessionName = (document.getElementById('edit-session-name')?.value || '').trim();
  const targetBalls = parseInt(document.getElementById('edit-target-balls-val')?.value || '5', 10);

  if (!bowlerName) {
    alert('Please enter a bowler name.');
    return;
  }

  const saveBtn = document.getElementById('btn-save-bowler');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerText = 'Saving...';
  }

  try {
    let finalAvatarUrl = (currentSession && currentSession.avatar_url) ? currentSession.avatar_url : '';

    if (pendingBowlerAvatarFile === 'REMOVE') {
      finalAvatarUrl = '';
    } else if (pendingBowlerAvatarFile instanceof File && currentSessionId) {
      try {
        const fd = new FormData();
        fd.append('file', pendingBowlerAvatarFile);
        const avRes = await fetch(`/api/sessions/${currentSessionId}/avatar`, {
          method: 'POST',
          body: fd
        });
        if (avRes.ok) {
          const avData = await avRes.json();
          finalAvatarUrl = avData.avatar_url;
        }
      } catch (e) {
        console.warn("Avatar upload fallback to dataURL:", e);
        finalAvatarUrl = document.getElementById('edit-avatar-url-val')?.value || finalAvatarUrl;
      }
    } else if (document.getElementById('edit-avatar-url-val')?.value) {
      finalAvatarUrl = document.getElementById('edit-avatar-url-val').value;
    }

    if (currentSessionId) {
      const res = await fetch(`/api/sessions/${currentSessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bowler_name: bowlerName,
          bowling_type: bowlingStyle,
          name: sessionName,
          target_balls: targetBalls,
          avatar_url: finalAvatarUrl
        })
      });

      if (res.ok) {
        const updated = await res.json();
        currentSession = updated;
      } else {
        if (currentSession) {
          currentSession.bowler_name = bowlerName;
          currentSession.bowling_type = bowlingStyle;
          currentSession.name = sessionName;
          currentSession.target_balls = targetBalls;
          currentSession.avatar_url = finalAvatarUrl;
        }
      }
    } else if (currentSession) {
      currentSession.bowler_name = bowlerName;
      currentSession.bowling_type = bowlingStyle;
      currentSession.name = sessionName;
      currentSession.target_balls = targetBalls;
      currentSession.avatar_url = finalAvatarUrl;
    }

    // Refresh all UI elements
    updateSessionUI();

    // Refresh navbar dropdown
    try {
      const listRes = await fetch('/api/sessions');
      if (listRes.ok) {
        const sessions = await listRes.json();
        populateSessionDropdown(sessions);
      }
    } catch (e) {}

    closeEditBowlerModal();
  } catch (err) {
    console.error('Failed to update bowler profile:', err);
    if (currentSession) {
      currentSession.bowler_name = bowlerName;
      currentSession.bowling_type = bowlingStyle;
      currentSession.name = sessionName;
      currentSession.target_balls = targetBalls;
      updateSessionUI();
    }
    closeEditBowlerModal();
  } finally {
    pendingBowlerAvatarFile = null;
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerText = 'Save Profile';
    }
  }
}

/**
 * Show Create New Session Screen
 */
function showNewSessionScreen() {
  switchDashboardView('sessions');
  const hero = document.getElementById('create-session-hero');
  if (hero) hero.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Pre-fill smart defaults
  const sessionNameInput = document.getElementById('hero-session-name');
  if (sessionNameInput && !sessionNameInput.value) {
    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    sessionNameInput.value = `Spell - Good Length Channel (${today})`;
  }

  setHeroWicketsChoice(true);
  loadSavedSessionsList();
}

/**
 * Load Existing Sessions List in Hero Screen
 */
async function loadSavedSessionsList() {
  const section = document.getElementById('saved-sessions-section');
  const container = document.getElementById('saved-sessions-container');
  if (!section || !container) return;

  try {
    const res = await fetch('/api/sessions');
    if (!res.ok) return;
    const sessions = await res.json();

    if (!sessions || sessions.length === 0) {
      section.classList.add('hidden');
      return;
    }

    section.classList.remove('hidden');
    container.innerHTML = '';

    sessions.forEach(s => {
      const card = document.createElement('div');
      card.className = 'saved-session-card';
      const count = s.total_balls || (s.deliveries ? s.deliveries.length : 0);
      card.innerHTML = `
        <div class="saved-card-bowler">${s.bowler_name}</div>
        <div class="saved-card-title">${s.name}</div>
        <div class="saved-card-meta">
          <span>${s.bowling_type}</span>
          <span class="saved-progress-tag">${count} / ${s.target_balls} Deliveries</span>
        </div>
      `;
      card.onclick = () => switchActiveSession(s.id);
      container.appendChild(card);
    });
  } catch (err) {
    console.warn("Could not load saved sessions list:", err);
  }
}

/**
 * Toggle Target Balls (3, 5, 6) in Hero Form
 */
function setHeroTargetBalls(n) {
  const input = document.getElementById('hero-target-balls-val');
  if (input) input.value = n;

  document.querySelectorAll('.target-pill').forEach(btn => {
    const val = parseInt(btn.getAttribute('data-balls'), 10);
    btn.classList.toggle('active', val === n);
  });
}

/**
 * Set Hero Wickets Choice (true = physical present, false = no wickets / manual batsman)
 */
function setHeroWicketsChoice(hasWickets) {
  const input = document.getElementById('hero-has-wickets-val');
  if (input) input.value = hasWickets ? 'true' : 'false';

  const cardPresent = document.getElementById('hero-wicket-choice-present');
  const cardNone = document.getElementById('hero-wicket-choice-none');

  if (cardPresent) cardPresent.classList.toggle('active', hasWickets);
  if (cardNone) cardNone.classList.toggle('active', !hasWickets);
}

/**
 * Submit Create Session Form from Hero Screen
 */
async function submitCreateSessionFromHero() {
  const bowlerName = document.getElementById('hero-bowler-name')?.value.trim();
  const bowlingStyle = document.getElementById('hero-bowling-style')?.value || 'Right-arm Fast';
  const sessionName = document.getElementById('hero-session-name')?.value.trim();
  const targetBalls = parseInt(document.getElementById('hero-target-balls-val')?.value || '5', 10);
  const hasWickets = document.getElementById('hero-has-wickets-val')?.value !== 'false';

  if (!bowlerName || !sessionName) {
    alert("Please enter both Bowler Name and Spell Title.");
    return;
  }

  try {
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: sessionName,
        bowler_name: bowlerName,
        bowling_type: bowlingStyle,
        target_balls: targetBalls,
        has_wickets: hasWickets
      })
    });

    if (!res.ok) throw new Error("Failed to create session on server");
    const newSession = await res.json();

    // Reload dropdown & saved list
    const listRes = await fetch('/api/sessions');
    const sessions = await listRes.json();
    populateSessionDropdown(sessions);

    // Switch to active session workspace
    await switchActiveSession(newSession.id);
    switchDashboardView('delivery-studio');
  } catch (err) {
    console.error("Session creation error:", err);
    alert("Could not create session: " + err.message);
  }
}

/**
 * Switch Active Session by ID
 */
async function switchActiveSession(sessionId) {
  if (!sessionId) {
    currentSessionId = null;
    currentSession = null;
    showNewSessionScreen();
    return;
  }

  try {
    const res = await fetch(`/api/sessions/${sessionId}`);
    if (!res.ok) return;
    const session = await res.json();
    currentSessionId = session.id;
    currentSession = session;
    activeDeliveryIndex = session.deliveries && session.deliveries.length > 0 
      ? session.deliveries.length - 1 
      : -1;

    updateSessionUI();

    // If deliveries exist, display the latest one
    if (session.deliveries && session.deliveries.length > 0) {
      selectSessionBall(session.deliveries.length - 1, false);
    } else {
      resetPlayerToEmpty();
    }
  } catch (err) {
    console.error("Failed to fetch session:", err);
  }
}

/**
 * Handle Session Update after Video Processing
 */
function handleSessionUpdate(session) {
  currentSessionId = session.id;
  currentSession = session;
  activeDeliveryIndex = session.deliveries.length - 1;
  updateSessionUI();

  // Redraw Overall Session Performance Visualizations
  draw2DPitchDispersionCanvas(session.deliveries);
  drawSideViewTrajectoryCanvas(session.deliveries);
  drawReleasePointsCanvas(session.deliveries);
  renderPaceProgressionChart(session.deliveries, session.stats);
  updateInsightsKPIs(session.stats, session.deliveries);
  renderInsightsZoneBars(session.stats, session.deliveries.length);
  renderInsightsTable(session.deliveries);
}

/**
 * Update Session Top Bar and Ball Timeline Strip
 */
function updateSessionUI() {
  const hero = document.getElementById('create-session-hero');
  const workspace = document.getElementById('active-session-workspace');
  const bowlerNameEl = document.getElementById('session-display-bowler');
  const bowlerStyleEl = document.getElementById('session-display-style');
  const sessionTitleEl = document.getElementById('session-display-title');
  const initialsEl = document.getElementById('bowler-initials');
  const progressEl = document.getElementById('session-progress-fraction');
  const timelineBalls = document.getElementById('spell-timeline-balls');
  const uploadTitle = document.getElementById('upload-box-title');
  const ballBadge = document.getElementById('active-ball-badge');
  const dropdown = document.getElementById('session-select');

  if (!currentSession) {
    if (hero) hero.classList.remove('hidden');
    if (workspace) workspace.classList.remove('hidden');
    if (dropdown) dropdown.value = "";
    loadSavedSessionsList();
    return;
  }

  if (hero) hero.classList.add('hidden');
  if (workspace) workspace.classList.remove('hidden');

  const dels = currentSession.deliveries || [];
  const target = currentSession.target_balls || 5;

  if (dropdown) dropdown.value = currentSession.id;

  if (bowlerNameEl) bowlerNameEl.innerText = currentSession.bowler_name || "Bowler";
  if (bowlerStyleEl) bowlerStyleEl.innerText = currentSession.bowling_type || "Right-arm Fast";
  if (sessionTitleEl) sessionTitleEl.innerText = currentSession.name || "Training Spell";

  const wicketSetupEl = document.getElementById('session-display-wickets');
  if (wicketSetupEl) {
    const hasWickets = currentSession.has_wickets !== false;
    wicketSetupEl.innerText = hasWickets ? 'Physical Wickets' : 'No Wickets · Batsman Calibration';
    wicketSetupEl.classList.toggle('manual', !hasWickets);
  }

  // Initials & Profile Photos
  const parts = (currentSession.bowler_name || "Bowler").trim().split(/\s+/);
  const inits = parts.length > 1 
    ? (parts[0][0] + parts[1][0]).toUpperCase() 
    : parts[0].substring(0, 2).toUpperCase();
  if (initialsEl) initialsEl.innerText = inits;

  const studioImg = document.getElementById('studio-bowler-img');
  if (studioImg) {
    if (currentSession.avatar_url) {
      studioImg.src = currentSession.avatar_url;
      studioImg.classList.remove('hidden');
      if (initialsEl) initialsEl.classList.add('hidden');
    } else {
      studioImg.src = '';
      studioImg.classList.add('hidden');
      if (initialsEl) initialsEl.classList.remove('hidden');
    }
  }

  // Sidebar Bowler Status Card (Bottom of Sidebar)
  const sideInitials = document.getElementById('sidebar-bowler-initials');
  const sideImg = document.getElementById('sidebar-bowler-img');
  const sideName = document.getElementById('sidebar-bowler-name');
  const sideStyle = document.getElementById('sidebar-bowler-style');
  const sideProg = document.getElementById('sidebar-spell-progress');

  if (sideInitials) sideInitials.innerText = inits;
  if (sideImg) {
    if (currentSession.avatar_url) {
      sideImg.src = currentSession.avatar_url;
      sideImg.classList.remove('hidden');
      if (sideInitials) sideInitials.classList.add('hidden');
    } else {
      sideImg.src = '';
      sideImg.classList.add('hidden');
      if (sideInitials) sideInitials.classList.remove('hidden');
    }
  }

  if (sideName) sideName.innerText = currentSession.bowler_name || "Bowler";
  if (sideStyle) sideStyle.innerText = currentSession.bowling_type || "Right-arm Fast";
  if (sideProg) sideProg.innerText = `${dels.length}/${target} b`;

  // Overview Banner Card
  const bannerHeading = document.getElementById('banner-bowler-heading');
  const bannerSub = document.getElementById('banner-bowler-sub');
  if (bannerHeading) bannerHeading.innerText = `${currentSession.bowler_name || 'Bowler'} · ${currentSession.name || 'Training Spell'}`;
  if (bannerSub) bannerSub.innerText = `${currentSession.bowling_type || 'Right-arm Fast'} · ${target}-Ball Target Spell · Vision Calibrated`;

  // Overview KPI Cards
  const stats = currentSession.stats || {};
  const okpiAvg = document.getElementById('okpi-avg-speed');
  const okpiSpeedRange = document.getElementById('okpi-speed-range');
  const qsPeak = document.getElementById('qs-peak-speed');
  if (stats.avg_speed_kph) {
    if (okpiAvg) okpiAvg.innerText = stats.avg_speed_kph.toFixed(1);
    if (qsPeak && stats.max_speed_kph) qsPeak.innerText = `${stats.max_speed_kph.toFixed(0)} km/h`;
    if (okpiSpeedRange && stats.max_speed_kph) {
      okpiSpeedRange.innerText = `Peak: ${stats.max_speed_kph.toFixed(0)} km/h · Target corridor discipline`;
    }
  }

  if (progressEl) {
    progressEl.innerText = `${dels.length} / ${target}`;
  }

  const nextBallNum = Math.min(dels.length + 1, target);
  if (uploadTitle) {
    uploadTitle.innerText = dels.length >= target 
      ? `Spell Completed (${target} Deliveries Tracked)` 
      : `Upload Video for Ball ${nextBallNum}`;
  }
  if (ballBadge) {
    ballBadge.innerText = dels.length >= target 
      ? `Spell Complete` 
      : `Ready for Delivery ${nextBallNum}`;
  }

  // Render Ball Timeline List
  if (timelineBalls) {
    timelineBalls.innerHTML = '';

    const maxBalls = Math.max(target, dels.length);
    for (let b = 1; b <= maxBalls; b++) {
      const deliv = dels[b - 1];
      const isCompleted = !!deliv;
      const isNext = (b === dels.length + 1 && dels.length < target);
      const isActive = (activeDeliveryIndex === b - 1);
      const col = SPELL_BALL_COLORS[(b - 1) % SPELL_BALL_COLORS.length];

      if (isCompleted) {
        const pill = document.createElement('div');
        pill.className = `ball-timeline-pill ${isActive ? 'active' : ''}`;
        pill.innerHTML = `
          <div class="ball-num-badge" style="border: 2px solid ${col.hex}; color: ${col.hex};">${b}</div>
          <div class="ball-pill-meta">
            <span class="ball-pill-speed">${Math.round(deliv.speed_mph)} mph</span>
            <span class="ball-pill-zone">${deliv.length_zone}</span>
          </div>
        `;
        pill.onclick = () => selectSessionBall(b - 1, true);
        timelineBalls.appendChild(pill);
      } else if (isNext) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn-upload-next-ball';
        btn.innerHTML = `<span>+</span> Deliver Ball ${b}`;
        btn.onclick = () => {
          const fileInput = document.getElementById('file-input');
          if (fileInput) fileInput.click();
        };
        timelineBalls.appendChild(btn);
      } else {
        const pill = document.createElement('div');
        pill.className = 'ball-timeline-pill pending';
        pill.innerHTML = `
          <div class="ball-num-badge" style="opacity: 0.4;">${b}</div>
          <div class="ball-pill-meta">
            <span class="ball-pill-speed" style="color: #94a3b8;">Pending</span>
            <span class="ball-pill-zone">Ball ${b}</span>
          </div>
        `;
        timelineBalls.appendChild(pill);
      }
    }
  }

  // Render Overall Session Performance Visualizations
  draw2DPitchDispersionCanvas(dels);
  drawSideViewTrajectoryCanvas(dels);
  drawReleasePointsCanvas(dels);
  renderPaceProgressionChart(dels, currentSession.stats);
  updateInsightsKPIs(currentSession.stats, dels);
  renderInsightsZoneBars(currentSession.stats, dels.length);
  renderInsightsTable(dels);

  // Synchronize Command Center live insights and deliveries table
  if (typeof updateCommandCenterLiveInsights === 'function') {
    updateCommandCenterLiveInsights(currentSession, dels);
  }

  // Synchronize locked session wicket calibration
  updateLockedCalibrationUI();
}

/**
 * Select a specific ball from the active session to inspect
 */
function selectSessionBall(index, playVideo = true) {
  if (!currentSession || !currentSession.deliveries || !currentSession.deliveries[index]) return;
  activeDeliveryIndex = index;
  
  // Update timeline pill active states
  const timelineBalls = document.querySelectorAll('.ball-timeline-pill');
  timelineBalls.forEach((pill, i) => {
    pill.classList.toggle('active', i === index);
  });

  const d = currentSession.deliveries[index];
  const videoWrapper = document.getElementById('video-display-wrapper');
  const resultVideo = document.getElementById('result-video');
  const emptyState = document.getElementById('empty-state');

  if (emptyState) emptyState.classList.add('hidden');
  if (videoWrapper) videoWrapper.classList.remove('hidden');

  if (resultVideo && d.video_url) {
    resultVideo.src = d.video_url;
    if (playVideo) {
      resultVideo.play().catch(e => console.log('Autoplay:', e));
    }
  }

  // Update Live Telemetry Bar
  const speedMphEl = document.getElementById('stat-speed-mph');
  const speedKphEl = document.getElementById('stat-speed-kph');
  const lengthZoneEl = document.getElementById('stat-length-zone');
  const bounceDistEl = document.getElementById('stat-bounce-dist');
  const lateralLineEl = document.getElementById('stat-lateral-line');
  const swingValEl = document.getElementById('stat-swing-val');
  const spinSubEl = document.getElementById('stat-spin-sub');
  const statusBadge = document.getElementById('ball-status-badge');

  if (speedMphEl) speedMphEl.innerText = Math.round(d.speed_mph);
  if (speedKphEl) speedKphEl.innerText = `${Math.round(d.speed_kph)} km/h`;
  if (lengthZoneEl) lengthZoneEl.innerText = d.length_zone;
  if (bounceDistEl) bounceDistEl.innerText = `${d.distance_from_crease_m}m from crease`;
  if (lateralLineEl) lateralLineEl.innerText = d.lateral_line;
  if (swingValEl) swingValEl.innerText = d.swing_sf !== undefined ? d.swing_sf : "0.2";
  if (spinSubEl) spinSubEl.innerText = `Spin: ${d.spin_deg || 0}°`;
  if (statusBadge) {
    statusBadge.innerText = `BALL ${d.ball_number || index + 1} REPLAY`;
    statusBadge.className = "badge-ball-status badge-ball-active";
  }

  updateDownloadButton(d, 'video', `ball_${d.ball_number || index + 1}_`);

  // Store 3D Trajectory for Stadium DRS
  if (d.trajectory_3d) {
    window.currentTrajectory3D = d.trajectory_3d;
    window.currentTrajectoryStats = d;
    updateStadiumHUD(d);
    if (stadiumScene && isStadiumModalOpen && !isMultiBall3DMode) {
      build3DTrajectoryMesh(d.trajectory_3d);
    }
  }
}

function resetPlayerToEmpty() {
  const videoWrapper = document.getElementById('video-display-wrapper');
  const emptyState = document.getElementById('empty-state');
  if (videoWrapper) videoWrapper.classList.add('hidden');
  if (emptyState) emptyState.classList.remove('hidden');

  const elSpeedMph = document.getElementById('stat-speed-mph');
  const elSpeedKph = document.getElementById('stat-speed-kph');
  const elLength = document.getElementById('stat-length-zone');
  const elDist = document.getElementById('stat-bounce-dist');
  const elLine = document.getElementById('stat-lateral-line');
  const elSwing = document.getElementById('stat-swing-val');
  const elSpin = document.getElementById('stat-spin-sub');
  const elBadge = document.getElementById('ball-status-badge');

  if (elSpeedMph) elSpeedMph.innerText = "—";
  if (elSpeedKph) elSpeedKph.innerText = "— km/h";
  if (elLength) elLength.innerText = "—";
  if (elDist) elDist.innerText = "— from crease";
  if (elLine) elLine.innerText = "—";
  if (elSwing) elSwing.innerText = "—";
  if (elSpin) elSpin.innerText = "Spin: —°";
  if (elBadge) {
    elBadge.innerText = "AWAITING VIDEO";
    elBadge.className = "badge-ball-status";
  }
}

// ============================================================================
// 2. VIDEO UPLOAD & DELIVERY TRIMMER STUDIO
// ============================================================================

function initDragAndDrop() {
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  if (!dropZone || !fileInput) return;

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('dragover');
    }, false);
  });

  dropZone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelected(files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFileSelected(e.target.files[0]);
    }
  });
}

function triggerFileInput() {
  document.getElementById('file-input')?.click();
}

function handleFileSelected(file) {
  if (!currentSessionId) {
    alert("Please start or select a bowling session first.");
    showNewSessionScreen();
    return;
  }

  currentFile = file;

  // Reveal trimmer
  initVideoTrim(file);

  const uploadTitle = document.getElementById('upload-box-title');
  if (uploadTitle) {
    uploadTitle.innerText = `Selected: ${file.name}`;
  }
}

function initTrimControls() {
  const trimVideo = document.getElementById('trim-preview-video');
  const rangeStart = document.getElementById('trim-range-start');
  const rangeEnd = document.getElementById('trim-range-end');
  const numStart = document.getElementById('trim-start-num');
  const numEnd = document.getElementById('trim-end-num');
  const cursor = document.getElementById('timeline-cursor');
  const playheadBadge = document.getElementById('trim-playhead-time');
  const playBtn = document.getElementById('trim-play-btn');

  if (rangeStart) {
    rangeStart.addEventListener('input', (e) => {
      let val = parseFloat(e.target.value);
      if (val > trimState.endTime - 0.2) {
        val = Math.max(0, trimState.endTime - 0.2);
        e.target.value = val;
      }
      trimState.startTime = val;
      if (numStart) numStart.value = val.toFixed(1);
      if (trimVideo) trimVideo.currentTime = val;
      updateTimelineHighlight();
      updateTrimDurationBadge();
    });
  }

  if (rangeEnd) {
    rangeEnd.addEventListener('input', (e) => {
      let val = parseFloat(e.target.value);
      if (val < trimState.startTime + 0.2) {
        val = Math.min(trimState.duration, trimState.startTime + 0.2);
        e.target.value = val;
      }
      trimState.endTime = val;
      if (numEnd) numEnd.value = val.toFixed(1);
      if (trimVideo) trimVideo.currentTime = val;
      updateTimelineHighlight();
      updateTrimDurationBadge();
    });
  }

  if (trimVideo) {
    trimVideo.addEventListener('timeupdate', () => {
      if (playheadBadge) {
        playheadBadge.innerText = `${formatSec(trimVideo.currentTime)} / ${formatSec(trimState.duration)}`;
      }
      if (cursor && trimState.duration > 0) {
        const pct = (trimVideo.currentTime / trimState.duration) * 100;
        cursor.style.left = `${pct}%`;
      }
      if (trimState.isPlayingPreview && trimVideo.currentTime >= trimState.endTime) {
        trimVideo.pause();
        trimState.isPlayingPreview = false;
        if (playBtn) playBtn.innerText = "Play";
      }
    });

    trimVideo.addEventListener('pause', () => {
      if (playBtn) playBtn.innerText = "Play";
    });

    trimVideo.addEventListener('ended', () => {
      if (playBtn) playBtn.innerText = "Play";
      trimState.isPlayingPreview = false;
    });
  }
}

function initVideoTrim(file) {
  const trimCard = document.getElementById('video-trim-card');
  const trimVideo = document.getElementById('trim-preview-video');
  const rangeStart = document.getElementById('trim-range-start');
  const rangeEnd = document.getElementById('trim-range-end');
  const numStart = document.getElementById('trim-start-num');
  const numEnd = document.getElementById('trim-end-num');
  const playheadBadge = document.getElementById('trim-playhead-time');
  const playBtn = document.getElementById('trim-play-btn');

  if (!trimCard || !trimVideo) return;

  if (trimState.objectUrl) {
    URL.revokeObjectURL(trimState.objectUrl);
  }
  trimState.objectUrl = URL.createObjectURL(file);
  trimVideo.src = trimState.objectUrl;
  trimCard.classList.remove('hidden');

  trimVideo.onloadedmetadata = () => {
    trimState.duration = trimVideo.duration || 1.0;

    // Smart delivery window default:
    // If clip is longer than 6s, pre-select first 4.0s
    if (trimState.duration > 6.0) {
      trimState.startTime = 0.0;
      trimState.endTime = Math.min(trimState.duration, 4.0);
    } else {
      trimState.startTime = 0.0;
      trimState.endTime = trimState.duration;
    }

    if (rangeStart) {
      rangeStart.min = "0";
      rangeStart.max = trimState.duration.toString();
      rangeStart.step = "0.05";
      rangeStart.value = trimState.startTime.toString();
    }

    if (rangeEnd) {
      rangeEnd.min = "0";
      rangeEnd.max = trimState.duration.toString();
      rangeEnd.step = "0.05";
      rangeEnd.value = trimState.endTime.toString();
    }

    if (numStart) {
      numStart.min = "0";
      numStart.max = trimState.duration.toFixed(1);
      numStart.value = trimState.startTime.toFixed(1);
    }

    if (numEnd) {
      numEnd.min = "0";
      numEnd.max = trimState.duration.toFixed(1);
      numEnd.value = trimState.endTime.toFixed(1);
    }

    if (playheadBadge) {
      playheadBadge.innerText = `00:00.0 / ${formatSec(trimState.duration)}`;
    }
    if (playBtn) playBtn.innerText = "Play";

    updateTimelineHighlight();
    updateTrimDurationBadge();
    updateLockedCalibrationUI();
    if (currentWicketMode === 'manual') {
      setTimeout(updateWicketMarkerUI, 100);
    }
    trimVideo.currentTime = 0;
  };
}

function formatSec(seconds) {
  if (isNaN(seconds) || seconds < 0) return "00:00.0";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const minsStr = mins < 10 ? "0" + mins : mins;
  const secsStr = secs.toFixed(1).padStart(4, "0");
  return `${minsStr}:${secsStr}`;
}

function updateTimelineHighlight() {
  const highlight = document.getElementById('timeline-highlight');
  if (!highlight || trimState.duration <= 0) return;
  const leftPct = (trimState.startTime / trimState.duration) * 100;
  const widthPct = Math.max(0, ((trimState.endTime - trimState.startTime) / trimState.duration) * 100);
  highlight.style.left = `${leftPct}%`;
  highlight.style.width = `${widthPct}%`;
}

function updateTrimDurationBadge() {
  const badge = document.getElementById('trim-duration-badge');
  const btnText = document.getElementById('btn-analyze-text');
  const diff = Math.max(0, trimState.endTime - trimState.startTime);
  if (badge) {
    badge.innerText = `Selected: ${diff.toFixed(1)}s (${trimState.startTime.toFixed(1)}s - ${trimState.endTime.toFixed(1)}s)`;
  }
  if (btnText) {
    btnText.innerText = `Analyze Delivery Window (${diff.toFixed(1)}s)`;
  }
}

function syncTrimFromNumberInputs() {
  const numStart = document.getElementById('trim-start-num');
  const numEnd = document.getElementById('trim-end-num');
  const rangeStart = document.getElementById('trim-range-start');
  const rangeEnd = document.getElementById('trim-range-end');
  const trimVideo = document.getElementById('trim-preview-video');

  let s = parseFloat(numStart?.value || "0");
  let e = parseFloat(numEnd?.value || trimState.duration.toString());

  s = Math.max(0, Math.min(s, trimState.duration));
  e = Math.max(s + 0.1, Math.min(e, trimState.duration));

  trimState.startTime = s;
  trimState.endTime = e;

  if (rangeStart) rangeStart.value = s.toString();
  if (rangeEnd) rangeEnd.value = e.toString();
  if (numStart) numStart.value = s.toFixed(1);
  if (numEnd) numEnd.value = e.toFixed(1);

  if (trimVideo) trimVideo.currentTime = s;
  updateTimelineHighlight();
  updateTrimDurationBadge();
}

function setTrimStartToCurrentTime() {
  const trimVideo = document.getElementById('trim-preview-video');
  if (!trimVideo || trimState.duration <= 0) return;
  const cur = parseFloat(trimVideo.currentTime.toFixed(1));
  const newStart = Math.max(0, Math.min(cur, trimState.endTime - 0.2));
  trimState.startTime = newStart;

  const rangeStart = document.getElementById('trim-range-start');
  const numStart = document.getElementById('trim-start-num');
  if (rangeStart) rangeStart.value = newStart;
  if (numStart) numStart.value = newStart.toFixed(1);

  updateTimelineHighlight();
  updateTrimDurationBadge();
}

function setTrimEndToCurrentTime() {
  const trimVideo = document.getElementById('trim-preview-video');
  if (!trimVideo || trimState.duration <= 0) return;
  const cur = parseFloat(trimVideo.currentTime.toFixed(1));
  const newEnd = Math.min(trimState.duration, Math.max(cur, trimState.startTime + 0.2));
  trimState.endTime = newEnd;

  const rangeEnd = document.getElementById('trim-range-end');
  const numEnd = document.getElementById('trim-end-num');
  if (rangeEnd) rangeEnd.value = newEnd;
  if (numEnd) numEnd.value = newEnd.toFixed(1);

  updateTimelineHighlight();
  updateTrimDurationBadge();
}

function toggleTrimVideoPlay() {
  const trimVideo = document.getElementById('trim-preview-video');
  const playBtn = document.getElementById('trim-play-btn');
  if (!trimVideo) return;

  if (trimVideo.paused) {
    trimVideo.play();
    if (playBtn) playBtn.innerText = "Pause";
  } else {
    trimVideo.pause();
    if (playBtn) playBtn.innerText = "Play";
  }
}

function playTrimPreview() {
  const trimVideo = document.getElementById('trim-preview-video');
  const playBtn = document.getElementById('trim-play-btn');
  if (!trimVideo || trimState.duration <= 0) return;

  trimState.isPlayingPreview = true;
  trimVideo.currentTime = trimState.startTime;
  trimVideo.play();
  if (playBtn) playBtn.innerText = "Pause";
}

// ============================================================================
// 2B. BATSMAN WICKET CALIBRATION & SESSION CALIBRATION CONTROLLER
// ============================================================================

let manualWicketState = {
  x_pct: 0.50,
  y_pct: 0.465,
  scale: 1.0,
  w_pct: 0.022,
  h_pct: 0.055,
  isDragging: false
};
let sessionLockedCalib = null;
let isManuallyAdjustingLocked = false;

function updateWicketMarkerUI() {
  const marker = document.getElementById('wicket-marker');
  const coordsEl = document.getElementById('wicket-coords-readout');
  const scaleEl = document.getElementById('wicket-scale-val');
  const guidePoly = document.getElementById('guide-pitch-poly');
  const guideCenter = document.getElementById('guide-pitch-center');
  const guideCrease = document.getElementById('guide-pitch-crease');
  const guidePopping = document.getElementById('guide-popping-crease');
  const overlay = document.getElementById('manual-wicket-overlay');

  if (!marker || !overlay) return;

  const rect = overlay.getBoundingClientRect();
  const w = rect.width || 480;
  const h = rect.height || 270;

  const xPx = manualWicketState.x_pct * w;
  const yPx = manualWicketState.y_pct * h;

  marker.style.left = `${manualWicketState.x_pct * 100}%`;
  marker.style.top = `${manualWicketState.y_pct * 100}%`;
  marker.style.transform = `translate(-50%, -100%) scale(${manualWicketState.scale})`;

  if (coordsEl) {
    coordsEl.innerText = `X: ${(manualWicketState.x_pct * 100).toFixed(1)}% · Y: ${(manualWicketState.y_pct * 100).toFixed(1)}%`;
  }
  if (scaleEl) {
    scaleEl.innerText = `${manualWicketState.scale.toFixed(1)}x`;
  }

  // Draw Projected Pitch Guide in SVG
  const farHalfW = (w * 0.06) * manualWicketState.scale;
  const nearHalfW = farHalfW * 3.4;
  const poppingY = yPx + Math.min(h - yPx, (h - yPx) * 0.12);

  if (guidePoly) {
    const pts = [
      `${xPx - farHalfW},${yPx}`,
      `${xPx + farHalfW},${yPx}`,
      `${xPx + nearHalfW},${h}`,
      `${xPx - nearHalfW},${h}`
    ].join(' ');
    guidePoly.setAttribute('points', pts);
  }

  if (guideCenter) {
    guideCenter.setAttribute('x1', xPx);
    guideCenter.setAttribute('y1', yPx);
    guideCenter.setAttribute('x2', xPx);
    guideCenter.setAttribute('y2', h);
  }

  if (guideCrease) {
    guideCrease.setAttribute('x1', xPx - farHalfW * 1.5);
    guideCrease.setAttribute('y1', yPx);
    guideCrease.setAttribute('x2', xPx + farHalfW * 1.5);
    guideCrease.setAttribute('y2', yPx);
  }

  if (guidePopping) {
    const popHalfW = farHalfW + (nearHalfW - farHalfW) * 0.12;
    guidePopping.setAttribute('x1', xPx - popHalfW * 1.8);
    guidePopping.setAttribute('y1', poppingY);
    guidePopping.setAttribute('x2', xPx + popHalfW * 1.8);
    guidePopping.setAttribute('y2', poppingY);
  }
}

function onWicketMarkerPointerDown(e) {
  e.stopPropagation();
  manualWicketState.isDragging = true;
  document.addEventListener('pointermove', onWicketPointerMove);
  document.addEventListener('pointerup', onWicketPointerUp);
}

function onWicketOverlayPointerDown(e) {
  const overlay = document.getElementById('manual-wicket-overlay');
  if (!overlay) return;
  const rect = overlay.getBoundingClientRect();
  const xPct = Math.max(0.1, Math.min(0.9, (e.clientX - rect.left) / rect.width));
  const yPct = Math.max(0.2, Math.min(0.85, (e.clientY - rect.top) / rect.height));
  manualWicketState.x_pct = xPct;
  manualWicketState.y_pct = yPct;
  updateWicketMarkerUI();

  manualWicketState.isDragging = true;
  document.addEventListener('pointermove', onWicketPointerMove);
  document.addEventListener('pointerup', onWicketPointerUp);
}

function onWicketPointerMove(e) {
  if (!manualWicketState.isDragging) return;
  const overlay = document.getElementById('manual-wicket-overlay');
  if (!overlay) return;
  const rect = overlay.getBoundingClientRect();
  const xPct = Math.max(0.05, Math.min(0.95, (e.clientX - rect.left) / rect.width));
  const yPct = Math.max(0.15, Math.min(0.90, (e.clientY - rect.top) / rect.height));
  manualWicketState.x_pct = xPct;
  manualWicketState.y_pct = yPct;
  updateWicketMarkerUI();
}

function onWicketPointerUp() {
  manualWicketState.isDragging = false;
  document.removeEventListener('pointermove', onWicketPointerMove);
  document.removeEventListener('pointerup', onWicketPointerUp);
}

function nudgeWicket(dx, dy) {
  manualWicketState.x_pct = Math.max(0.05, Math.min(0.95, manualWicketState.x_pct + dx * 0.005));
  manualWicketState.y_pct = Math.max(0.10, Math.min(0.90, manualWicketState.y_pct + dy * 0.005));
  updateWicketMarkerUI();
}

function scaleWicket(dScale) {
  manualWicketState.scale = Math.max(0.5, Math.min(2.5, manualWicketState.scale + dScale));
  updateWicketMarkerUI();
}

function resetWicketToDefault() {
  manualWicketState.x_pct = 0.50;
  manualWicketState.y_pct = 0.465;
  manualWicketState.scale = 1.0;
  updateWicketMarkerUI();
}

function updateLockedCalibrationUI() {
  const banner = document.getElementById('locked-session-calib-banner');
  const manualPanel = document.getElementById('manual-calib-panel');
  const calibCard = document.getElementById('wicket-calib-card');
  const overlay = document.getElementById('manual-wicket-overlay');

  const isNoWicketsSession = currentSession && currentSession.has_wickets === false;

  if (!isNoWicketsSession) {
    if (calibCard) calibCard.classList.add('hidden');
    if (overlay) overlay.classList.add('hidden');
    if (banner) banner.classList.add('hidden');
    return;
  }

  // Session has no physical wickets -> reveal batsman wicket setup & overlay
  if (calibCard) calibCard.classList.remove('hidden');
  if (overlay) overlay.classList.remove('hidden');

  if (currentSession && currentSession.session_calibration && currentSession.session_calibration.locked_calib) {
    sessionLockedCalib = currentSession.session_calibration;

    // Load saved coordinates into manualWicketState
    const manualMeta = sessionLockedCalib.manual_stumps || (sessionLockedCalib.locked_calib && sessionLockedCalib.locked_calib.manual_meta);
    if (manualMeta) {
      try {
        const meta = typeof manualMeta === 'string' ? JSON.parse(manualMeta) : manualMeta;
        if (meta.x_pct !== undefined) manualWicketState.x_pct = meta.x_pct;
        if (meta.y_pct !== undefined) manualWicketState.y_pct = meta.y_pct;
        if (meta.scale !== undefined) manualWicketState.scale = meta.scale;
      } catch (e) {
        console.warn("Could not parse saved manual stump meta:", e);
      }
    }

    if (!isManuallyAdjustingLocked) {
      if (banner) banner.classList.remove('hidden');
      if (manualPanel) manualPanel.classList.add('hidden');
    } else {
      if (banner) banner.classList.add('hidden');
      if (manualPanel) manualPanel.classList.remove('hidden');
    }
  } else {
    sessionLockedCalib = null;
    isManuallyAdjustingLocked = false;
    if (banner) banner.classList.add('hidden');
    if (manualPanel) manualPanel.classList.remove('hidden');
  }

  updateWicketMarkerUI();
}

function editLockedCalibration() {
  isManuallyAdjustingLocked = true;
  const banner = document.getElementById('locked-session-calib-banner');
  const manualPanel = document.getElementById('manual-calib-panel');
  if (banner) banner.classList.add('hidden');
  if (manualPanel) manualPanel.classList.remove('hidden');
  updateWicketMarkerUI();
}

async function clearLockedCalibration() {
  if (!currentSessionId) return;
  try {
    const res = await fetch(`/api/sessions/${currentSessionId}/calibration`, { method: 'DELETE' });
    if (res.ok) {
      if (currentSession) delete currentSession.session_calibration;
      sessionLockedCalib = null;
      isManuallyAdjustingLocked = false;
      resetWicketToDefault();
      updateLockedCalibrationUI();
    }
  } catch (e) {
    console.error("Failed to clear locked calibration:", e);
  }
}

// ============================================================================
// 3. RUN INFERENCE & UNIFIED BALL TRACKING
// ============================================================================

async function runDetection() {
  const loading = document.getElementById('loading-overlay');
  const loadingText = document.getElementById('loading-text');

  if (!currentSessionId) {
    alert("Please start or select a bowling session first.");
    showNewSessionScreen();
    return;
  }

  if (!currentFile) {
    alert("Please upload a cricket delivery video clip.");
    return;
  }

  if (loading) loading.classList.remove('hidden');
  if (loadingText) loadingText.innerText = "Tracking ball trajectory & pitch impact...";

  const formData = new FormData();
  formData.append('file', currentFile);
  formData.append('session_id', currentSessionId);
  formData.append('detect_stumps', true);
  formData.append('pitch_calibration', true);
  formData.append('render_mode', 'both');
  formData.append('show_pitch_zones', true);
  formData.append('ball_conf', 0.15);
  formData.append('ball_color', 'auto');
  formData.append('trajectory_mode', 'pop_at_delivery');
  formData.append('ball_render_mode', 'both');
  formData.append('trail_length', 25);
  formData.append('show_trail', true);

  const isNoWicketsSession = currentSession && currentSession.has_wickets === false;
  const chkApply = document.getElementById('chk-apply-to-all');
  const applyToAll = chkApply ? chkApply.checked : true;

  if (isNoWicketsSession) {
    formData.append('no_wicket_mode', true);
    if (!sessionLockedCalib || isManuallyAdjustingLocked) {
      formData.append('manual_stump_data', JSON.stringify({
        x_pct: manualWicketState.x_pct,
        y_pct: manualWicketState.y_pct,
        scale: manualWicketState.scale,
        w_pct: manualWicketState.w_pct,
        h_pct: manualWicketState.h_pct
      }));
      formData.append('apply_to_all_videos', applyToAll);
      formData.append('use_session_calibration', false);
    } else {
      formData.append('use_session_calibration', true);
      formData.append('apply_to_all_videos', true);
    }
  } else {
    formData.append('no_wicket_mode', false);
    formData.append('use_session_calibration', true);
    formData.append('apply_to_all_videos', applyToAll);
  }

  if (trimState.duration > 0 && trimState.endTime > trimState.startTime) {
    formData.append('start_time', trimState.startTime);
    formData.append('end_time', trimState.endTime);
    if (loadingText) {
      loadingText.innerText = `Analyzing delivery (${trimState.startTime.toFixed(1)}s - ${trimState.endTime.toFixed(1)}s)...`;
    }
  }

  try {
    const res = await fetch('/api/detect-ball-video', {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      throw new Error(errJson && errJson.detail ? errJson.detail : `Server error: ${res.status}`);
    }

    const data = await res.json();
    if (data.success) {
      renderBallVideoResult(data);
    } else {
      alert(data.detail || "Delivery analysis failed");
    }
  } catch (err) {
    console.error("Analysis error:", err);
    alert("Error processing delivery: " + (err.message || err));
  } finally {
    if (loading) loading.classList.add('hidden');
  }
}

function renderBallVideoResult(data) {
  const loading = document.getElementById('loading-overlay');
  if (loading) loading.classList.add('hidden');

  const emptyState = document.getElementById('empty-state');
  if (emptyState) emptyState.classList.add('hidden');

  const videoWrapper = document.getElementById('video-display-wrapper');
  const resultVideo = document.getElementById('result-video');

  if (videoWrapper && resultVideo && data.video_url) {
    resultVideo.src = data.video_url;
    resultVideo.muted = true;
    resultVideo.loop = false;
    videoWrapper.classList.remove('hidden');
    resultVideo.play().catch(e => console.log('Autoplay deferred:', e));
  }

  // Update Live Telemetry HUD
  const speedMphEl = document.getElementById('stat-speed-mph');
  const speedKphEl = document.getElementById('stat-speed-kph');
  const lengthZoneEl = document.getElementById('stat-length-zone');
  const bounceDistEl = document.getElementById('stat-bounce-dist');
  const lateralLineEl = document.getElementById('stat-lateral-line');
  const swingValEl = document.getElementById('stat-swing-val');
  const spinSubEl = document.getElementById('stat-spin-sub');
  const statusBadge = document.getElementById('ball-status-badge');

  if (data.trajectory && data.trajectory.found) {
    const traj = data.trajectory;
    if (speedMphEl) speedMphEl.innerText = Math.round(traj.speed_mph);
    if (speedKphEl) speedKphEl.innerText = `${Math.round(traj.speed_kph)} km/h`;
    if (lengthZoneEl) lengthZoneEl.innerText = traj.length_zone;
    if (bounceDistEl) bounceDistEl.innerText = `${traj.distance_from_crease_m}m from crease`;
    if (lateralLineEl) lateralLineEl.innerText = traj.lateral_line;
    if (swingValEl) swingValEl.innerText = traj.swing_sf !== undefined ? traj.swing_sf : "0.2";
    if (spinSubEl) spinSubEl.innerText = `Spin: ${traj.spin_deg || 0}°`;
    if (statusBadge) {
      statusBadge.innerText = "TRAJECTORY LOCKED";
      statusBadge.className = "badge-ball-status badge-ball-active";
    }

    // Store trajectory for 3D Stadium DRS
    window.currentTrajectory3D = traj.trajectory_3d;
    window.currentTrajectoryStats = traj;
    updateStadiumHUD(traj);
    if (stadiumScene && isStadiumModalOpen && !isMultiBall3DMode) {
      build3DTrajectoryMesh(window.currentTrajectory3D);
    }
  }

  // Update Download Button
  updateDownloadButton(data, 'video', 'analyzed_delivery_');

  // Handle Session Update
  if (data.session) {
    handleSessionUpdate(data.session);
  }
}

// ============================================================================
// 4. OVERALL SESSION PERFORMANCE (PITCH MAP, SIDE VIEW, RELEASE, SPEEDS)
// ============================================================================

let showPitchTrajectories = true;
let currentPerfView = 'all';
let sideViewMarkerHitboxes = [];
let releasePointMarkerHitboxes = [];

function scrollToInsights() {
  switchDashboardView('spell-insights');
  setTimeout(() => {
    document.getElementById('spell-insights-section')?.scrollIntoView({ behavior: 'smooth' });
  }, 100);
}

function formatMetersToFtIn(meters) {
  const totalInches = (meters || 2.15) * 39.3701;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return `${feet}' ${inches}"`;
}

function setPerfView(viewType) {
  currentPerfView = viewType;
  document.querySelectorAll('.perf-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewType);
  });

  const boxPitch = document.getElementById('perf-box-pitch');
  const boxSide = document.getElementById('perf-box-side');
  const boxRelease = document.getElementById('perf-box-release');
  const boxPace = document.getElementById('perf-box-pace');

  if (viewType === 'all') {
    boxPitch?.classList.remove('hidden');
    boxSide?.classList.remove('hidden');
    boxRelease?.classList.remove('hidden');
    boxPace?.classList.remove('hidden');
  } else if (viewType === 'pitch') {
    boxPitch?.classList.remove('hidden');
    boxSide?.classList.add('hidden');
    boxRelease?.classList.add('hidden');
    boxPace?.classList.add('hidden');
  } else if (viewType === 'side') {
    boxPitch?.classList.add('hidden');
    boxSide?.classList.remove('hidden');
    boxRelease?.classList.add('hidden');
    boxPace?.classList.add('hidden');
  } else if (viewType === 'release') {
    boxPitch?.classList.add('hidden');
    boxSide?.classList.add('hidden');
    boxRelease?.classList.remove('hidden');
    boxPace?.classList.add('hidden');
  } else if (viewType === 'pace') {
    boxPitch?.classList.add('hidden');
    boxSide?.classList.add('hidden');
    boxRelease?.classList.add('hidden');
    boxPace?.classList.remove('hidden');
  }

  // Redraw canvases
  if (currentSession && currentSession.deliveries) {
    if (viewType === 'all' || viewType === 'pitch') draw2DPitchDispersionCanvas(currentSession.deliveries);
    if (viewType === 'all' || viewType === 'side') drawSideViewTrajectoryCanvas(currentSession.deliveries);
    if (viewType === 'all' || viewType === 'release') drawReleasePointsCanvas(currentSession.deliveries);
    if (viewType === 'all' || viewType === 'pace') renderPaceProgressionChart(currentSession.deliveries, currentSession.stats);
  }
}

function togglePitchTrajectories(checked) {
  showPitchTrajectories = !!checked;
  if (currentSession && currentSession.deliveries) {
    draw2DPitchDispersionCanvas(currentSession.deliveries);
  }
}

function updateInsightsKPIs(stats, deliveries) {
  stats = stats || {};
  deliveries = deliveries || [];
  const avgSpeed = document.getElementById('insights-avg-speed');
  const speedRange = document.getElementById('insights-speed-range');
  const avgRelease = document.getElementById('insights-avg-release');
  const releaseSpread = document.getElementById('insights-release-spread');
  const avgSwing = document.getElementById('insights-avg-swing');
  const avgSpin = document.getElementById('insights-avg-spin');
  const consistency = document.getElementById('insights-consistency');

  if (avgSpeed) avgSpeed.innerText = stats.avg_speed_mph ? stats.avg_speed_mph.toFixed(1) : "0.0";
  if (speedRange) {
    const maxS = stats.max_speed_mph ? stats.max_speed_mph.toFixed(1) : "0.0";
    const minS = stats.min_speed_mph ? stats.min_speed_mph.toFixed(1) : "0.0";
    const avgK = stats.avg_speed_kph ? stats.avg_speed_kph.toFixed(1) : "0.0";
    speedRange.innerText = `Max: ${maxS} · Min: ${minS} (${avgK} km/h)`;
  }

  // Release Height KPI
  if (avgRelease) {
    const relH = stats.avg_release_height_m || (deliveries.length > 0 ? (deliveries.reduce((a, b) => a + (b.release_height_m || 2.15), 0) / deliveries.length) : 2.15);
    avgRelease.innerText = relH.toFixed(2);
    if (releaseSpread) {
      releaseSpread.innerText = `${formatMetersToFtIn(relH)} · Over Wicket Corridor`;
    }
  }

  if (avgSwing) avgSwing.innerText = stats.avg_swing_sf !== undefined ? stats.avg_swing_sf.toFixed(2) : "0.0";
  if (avgSpin) avgSpin.innerText = stats.avg_spin_deg !== undefined ? stats.avg_spin_deg.toFixed(1) : "0.0";
  if (consistency) consistency.innerText = `${stats.consistency_score || 0}%`;
}

function renderInsightsZoneBars(stats, totalBalls) {
  const container = document.getElementById('insights-length-bars');
  if (!container) return;
  container.innerHTML = '';

  const dist = (stats && stats.length_distribution) ? stats.length_distribution : {};
  const standardZones = ["Good Length", "Full", "Back of a Length", "Short", "Yorker"];
  const zoneColors = {
    "Good Length": "#059669",
    "Full": "#0284c7",
    "Back of a Length": "#d97706",
    "Short": "#64748b",
    "Yorker": "#ef4444"
  };

  standardZones.forEach(z => {
    const count = dist[z] || 0;
    const pct = totalBalls > 0 ? Math.round((count / totalBalls) * 100) : 0;
    const color = zoneColors[z] || "#059669";

    const row = document.createElement('div');
    row.className = 'dist-bar-row';
    row.innerHTML = `
      <span class="dist-bar-lbl">${z}</span>
      <div class="dist-bar-track">
        <div class="dist-bar-fill" style="width: ${pct}%; background: ${color};"></div>
      </div>
      <span class="dist-bar-val">${count} (${pct}%)</span>
    `;
    container.appendChild(row);
  });
}

function renderInsightsTable(deliveries) {
  const tbody = document.getElementById('insights-deliveries-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!deliveries || deliveries.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 24px; color: var(--text-muted);">No deliveries analyzed yet in this spell.</td></tr>`;
    return;
  }

  deliveries.forEach((d, idx) => {
    const col = SPELL_BALL_COLORS[idx % SPELL_BALL_COLORS.length];
    const relH = d.release_height_m || (d.trajectory_3d && d.trajectory_3d.release && d.trajectory_3d.release.z) || 2.15;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <span class="table-ball-badge">
          <span class="table-ball-dot" style="background: ${col.hex};"></span>
          Ball ${d.ball_number || idx + 1}
        </span>
      </td>
      <td style="font-family: var(--font-mono); font-size: 0.74rem; color: var(--text-muted);">${d.filename || 'delivery.mp4'}</td>
      <td>
        <b style="color: var(--text-main);">${Math.round(d.speed_mph)} mph</b>
        <span style="color: var(--text-muted); font-size: 0.72rem;">(${Math.round(d.speed_kph)} km/h)</span>
      </td>
      <td>
        <span style="font-family: var(--font-mono); font-size: 0.76rem; font-weight: 700; color: #2563eb;">
          ${relH.toFixed(2)} m
        </span>
        <span style="color: var(--text-muted); font-size: 0.70rem;">(${formatMetersToFtIn(relH)})</span>
      </td>
      <td>
        <span class="legend-pill" style="border-left: 3px solid ${col.hex}; font-size: 0.74rem;">
          ${d.length_zone} (${d.distance_from_crease_m}m)
        </span>
      </td>
      <td><b>${d.lateral_line}</b></td>
      <td><span style="color: var(--accent-blue); font-weight: 700;">${d.swing_sf} sf</span></td>
      <td><span style="color: var(--accent-amber); font-weight: 700;">${d.spin_deg}°</span></td>
      <td>
        <div style="display: flex; gap: 6px;">
          <button type="button" class="table-replay-btn" onclick="replaySessionBallVideo('${d.video_url}')">
            Replay
          </button>
          <button type="button" class="table-replay-btn" style="background: rgba(37, 99, 235, 0.1); border-color: rgba(37, 99, 235, 0.3); color: #2563eb;" onclick="openBallIn3DStadium(${idx})">
            3D DRS
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function replaySessionBallVideo(videoUrl) {
  if (!currentSession || !currentSession.deliveries) return;
  const idx = currentSession.deliveries.findIndex(d => d.video_url === videoUrl);
  if (idx !== -1) {
    selectSessionBall(idx, true);
    document.getElementById('video-display-wrapper')?.scrollIntoView({ behavior: 'smooth' });
  }
}

function openBallIn3DStadium(idx) {
  selectSessionBall(idx, false);
  openStadiumDRSModal();
}

/**
 * Draw Multi-Ball 2D Pitch Dispersion Canvas with Continuous Flight Arcs
 */
function draw2DPitchDispersionCanvas(deliveries) {
  const canvas = document.getElementById('pitch-dispersion-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  pitchMarkerHitboxes = [];

  // Margins
  const marginX = 54;
  const marginYTop = 45;
  const marginYBottom = 55;
  const pitchW = W - 2 * marginX;
  const pitchH = H - marginYTop - marginYBottom;

  const isDark = document.body.classList.contains('dark-theme');

  // 1. Clear with Theme Background
  ctx.fillStyle = isDark ? '#171a22' : '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // 2. Pitch Turf Area (Theme-aware natural grass green gradient)
  const turfGrad = ctx.createLinearGradient(marginX, marginYTop, marginX, marginYTop + pitchH);
  if (isDark) {
    turfGrad.addColorStop(0, '#13281d');
    turfGrad.addColorStop(0.5, '#183424');
    turfGrad.addColorStop(1, '#102217');
  } else {
    turfGrad.addColorStop(0, '#e8f5e9');
    turfGrad.addColorStop(0.5, '#dcfce7');
    turfGrad.addColorStop(1, '#c8e6c9');
  }
  ctx.fillStyle = turfGrad;
  ctx.fillRect(marginX, marginYTop, pitchW, pitchH);
  ctx.strokeStyle = isDark ? '#1f4832' : '#a7f3d0';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(marginX, marginYTop, pitchW, pitchH);

  // Geometry:
  const yPopping = marginYTop + pitchH - 45;
  const yStumps = marginYTop + pitchH - 18;
  const yBowlerPopping = marginYTop + 45;
  const yBowlerStumps = marginYTop + 18;

  const usableHeight = yPopping - yBowlerPopping;
  const pxPerMeter = usableHeight / 16.0;

  function meterToCanvasY(distM) {
    return yPopping - distM * pxPerMeter;
  }

  // 3. Render 5 Length Zones with Theme-Aware Tints
  const zones = [
    { name: "YORKER", startM: 0.0, endM: 2.0, color: isDark ? "rgba(239, 68, 68, 0.22)" : "rgba(239, 68, 68, 0.12)", lineCol: isDark ? "#f87171" : "#ef4444" },
    { name: "FULL", startM: 2.0, endM: 4.0, color: isDark ? "rgba(2, 132, 199, 0.20)" : "rgba(2, 132, 199, 0.10)", lineCol: isDark ? "#38bdf8" : "#0284c7" },
    { name: "GOOD LENGTH", startM: 4.0, endM: 6.0, color: isDark ? "rgba(5, 150, 105, 0.28)" : "rgba(5, 150, 105, 0.18)", lineCol: isDark ? "#34d399" : "#059669" },
    { name: "BACK OF LENGTH", startM: 6.0, endM: 8.0, color: isDark ? "rgba(217, 119, 6, 0.22)" : "rgba(217, 119, 6, 0.12)", lineCol: isDark ? "#fbbf24" : "#d97706" },
    { name: "SHORT", startM: 8.0, endM: 14.0, color: isDark ? "rgba(100, 116, 139, 0.18)" : "rgba(100, 116, 139, 0.08)", lineCol: isDark ? "#94a3b8" : "#64748b" }
  ];

  zones.forEach(z => {
    const yBottom = meterToCanvasY(z.startM);
    const yTop = meterToCanvasY(z.endM);
    const bandH = yBottom - yTop;

    ctx.fillStyle = z.color;
    ctx.fillRect(marginX + 1, yTop, pitchW - 2, bandH);

    // Zone Boundary Line
    ctx.beginPath();
    ctx.strokeStyle = z.lineCol;
    ctx.lineWidth = z.name === "GOOD LENGTH" ? 1.8 : 1.0;
    ctx.setLineDash(z.name === "GOOD LENGTH" ? [4, 3] : [3, 4]);
    ctx.moveTo(marginX, yBottom);
    ctx.lineTo(marginX + pitchW, yBottom);
    ctx.stroke();
    ctx.setLineDash([]);

    // Zone Label on Margin
    ctx.fillStyle = z.lineCol;
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(z.name, marginX - 6, yBottom - bandH / 2 + 3);
  });

  // 4. Center Corridor Highlight Ribbon
  const centerX = marginX + pitchW / 2;
  ctx.fillStyle = isDark ? 'rgba(59, 130, 246, 0.18)' : 'rgba(37, 99, 235, 0.10)';
  ctx.fillRect(centerX - 16, marginYTop, 32, pitchH);
  ctx.strokeStyle = isDark ? 'rgba(96, 165, 250, 0.45)' : 'rgba(37, 99, 235, 0.35)';
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(centerX, marginYTop);
  ctx.lineTo(centerX, marginYTop + pitchH);
  ctx.stroke();
  ctx.setLineDash([]);

  // 5. Crease Markings
  ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.85)' : '#ffffff';
  ctx.lineWidth = 2.5;

  // Batting popping crease
  ctx.beginPath();
  ctx.moveTo(marginX - 20, yPopping);
  ctx.lineTo(marginX + pitchW + 20, yPopping);
  ctx.stroke();

  // Batting bowling crease
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(marginX, yStumps);
  ctx.lineTo(marginX + pitchW, yStumps);
  ctx.stroke();

  // Bowler popping crease
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  ctx.moveTo(marginX - 16, yBowlerPopping);
  ctx.lineTo(marginX + pitchW + 16, yBowlerPopping);
  ctx.stroke();

  // Bowler bowling crease
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(marginX, yBowlerStumps);
  ctx.lineTo(marginX + pitchW, yBowlerStumps);
  ctx.stroke();

  // 6. Draw 3 Wooden Cricket Stumps at Batting End
  ctx.fillStyle = isDark ? '#d97706' : '#92400e';
  [-12, 0, 12].forEach(offset => {
    ctx.beginPath();
    ctx.arc(centerX + offset, yStumps, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = isDark ? '#171a22' : '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
  });
  // Bails
  ctx.strokeStyle = isDark ? '#f59e0b' : '#92400e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(centerX - 15, yStumps);
  ctx.lineTo(centerX + 15, yStumps);
  ctx.stroke();

  // 7. Render Continuous Mixed Trajectories (Top-Down Flight Paths) if toggled
  if (showPitchTrajectories && deliveries && deliveries.length > 0) {
    deliveries.forEach((d, idx) => {
      const col = SPELL_BALL_COLORS[idx % SPELL_BALL_COLORS.length];
      const distM = Math.max(0.2, Math.min(12.0, d.distance_from_crease_m || 4.5));
      const cy = meterToCanvasY(distM);

      let latOffsetM = 0.0;
      if (d.trajectory_3d && d.trajectory_3d.bounce) {
        latOffsetM = -(d.trajectory_3d.bounce.x || 0);
      } else {
        const line = (d.lateral_line || "").toLowerCase();
        if (line.includes("wide off")) latOffsetM = -0.55;
        else if (line.includes("outside off") || line.includes("off stump")) latOffsetM = -0.28;
        else if (line.includes("leg")) latOffsetM = 0.28;
        else latOffsetM = 0.0;
      }
      const cx = centerX + latOffsetM * (pitchW / 2.6);

      // Bowler release lateral position
      let relLatM = -(d.release_lateral_m || (d.trajectory_3d && d.trajectory_3d.release && d.trajectory_3d.release.x) || 0.24);
      const relX = centerX + relLatM * (pitchW / 2.6);
      const relY = yBowlerPopping;

      // Batting arrival lateral position
      let arrLatM = -(d.trajectory_3d && d.trajectory_3d.arrival && d.trajectory_3d.arrival.x ? d.trajectory_3d.arrival.x : latOffsetM * 0.85);
      const arrX = centerX + arrLatM * (pitchW / 2.6);
      const arrY = yStumps;

      // Draw Pre-Bounce Flight Arc
      ctx.beginPath();
      ctx.strokeStyle = col.hex;
      ctx.lineWidth = 2.2;
      ctx.globalAlpha = 0.65;
      ctx.moveTo(relX, relY);
      // Smooth curve with aerodynamic swing bend
      const swingBend = (d.swing_sf || 0.2) * 12;
      ctx.quadraticCurveTo(relX * 0.4 + cx * 0.6 + swingBend, relY * 0.4 + cy * 0.6, cx, cy);
      ctx.stroke();

      // Draw Post-Bounce Deviation Path to Stumps
      ctx.beginPath();
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1.8;
      ctx.globalAlpha = 0.80;
      ctx.moveTo(cx, cy);
      ctx.lineTo(arrX, arrY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1.0;

      // Bowler release anchor dot
      ctx.beginPath();
      ctx.arc(relX, relY, 4, 0, Math.PI * 2);
      ctx.fillStyle = col.hex;
      ctx.fill();
    });
  }

  // 8. Plot All Deliveries Bounce Markers
  (deliveries || []).forEach((d, idx) => {
    const col = SPELL_BALL_COLORS[idx % SPELL_BALL_COLORS.length];
    const distM = Math.max(0.2, Math.min(12.0, d.distance_from_crease_m || 4.5));
    const cy = meterToCanvasY(distM);

    let latOffsetM = 0.0;
    if (d.trajectory_3d && d.trajectory_3d.bounce) {
      latOffsetM = -(d.trajectory_3d.bounce.x || 0);
    } else {
      const line = (d.lateral_line || "").toLowerCase();
      if (line.includes("wide off")) latOffsetM = -0.55;
      else if (line.includes("outside off") || line.includes("off stump")) latOffsetM = -0.28;
      else if (line.includes("leg")) latOffsetM = 0.28;
      else latOffsetM = 0.0;
    }

    const cx = centerX + latOffsetM * (pitchW / 2.6);

    // Save hitbox
    pitchMarkerHitboxes.push({
      x: cx,
      y: cy,
      radius: 14,
      delivery: d,
      color: col
    });

    // Outer Halo
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.fillStyle = `${col.hex}33`;
    ctx.fill();

    // Solid Disc
    ctx.beginPath();
    ctx.arc(cx, cy, 10, 0, Math.PI * 2);
    ctx.fillStyle = col.hex;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Ball Number Text inside marker
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${d.ball_number || idx + 1}`, cx, cy + 1);
  });

  // 9. Populate Ball Color Legend Chips
  const legendRow = document.getElementById('pitch-balls-legend');
  if (legendRow) {
    legendRow.innerHTML = '';
    (deliveries || []).forEach((d, idx) => {
      const col = SPELL_BALL_COLORS[idx % SPELL_BALL_COLORS.length];
      const chip = document.createElement('span');
      chip.className = 'ball-legend-chip';
      chip.innerHTML = `
        <span class="ball-legend-dot" style="background: ${col.hex};"></span>
        Ball ${d.ball_number || idx + 1} (${Math.round(d.speed_mph)} mph)
      `;
      chip.onclick = () => selectSessionBall(idx, true);
      legendRow.appendChild(chip);
    });
  }

  // Attach interactive tooltip listener once
  if (!canvas.dataset.tooltipAttached) {
    canvas.dataset.tooltipAttached = "true";
    const tooltip = document.getElementById('pitch-ball-tooltip');

    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const mouseX = (e.clientX - rect.left) * scaleX;
      const mouseY = (e.clientY - rect.top) * scaleY;

      let hovered = null;
      for (const hb of pitchMarkerHitboxes) {
        const dx = mouseX - hb.x;
        const dy = mouseY - hb.y;
        if (Math.hypot(dx, dy) <= hb.radius + 4) {
          hovered = hb;
          break;
        }
      }

      if (hovered && tooltip) {
        const d = hovered.delivery;
        tooltip.innerHTML = `
          <div style="font-weight: 800; color: ${hovered.color.hex}; margin-bottom: 2px;">
            Ball ${d.ball_number} · ${hovered.color.name}
          </div>
          <div>Speed: <b>${Math.round(d.speed_mph)} mph</b> (${Math.round(d.speed_kph)} km/h)</div>
          <div>Length: <b>${d.length_zone}</b> (${d.distance_from_crease_m}m)</div>
          <div>Line: <b>${d.lateral_line}</b></div>
          <div>Release Height: <b>${(d.release_height_m || 2.15).toFixed(2)}m</b> (${formatMetersToFtIn(d.release_height_m || 2.15)})</div>
          <div>Aero Swing: <b>${d.swing_sf} sf</b> · Spin: <b>${d.spin_deg}°</b></div>
        `;
        tooltip.style.left = `${(hovered.x / scaleX) + 14}px`;
        tooltip.style.top = `${(hovered.y / scaleY) - 20}px`;
        tooltip.classList.remove('hidden');
      } else if (tooltip) {
        tooltip.classList.add('hidden');
      }
    });

    canvas.addEventListener('mouseleave', () => {
      if (tooltip) tooltip.classList.add('hidden');
    });
  }
}

/**
 * Draw Pitch Side View (Elevation Flight Profile Canvas)
 * 22-Yard Pitch from Bowler Release (0m) to Batting Wickets (20.12m),
 * Showing 28-inch Stumps and Elevation Flight Curves of All Balls
 */
function drawSideViewTrajectoryCanvas(deliveries) {
  const canvas = document.getElementById('pitch-side-view-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  sideViewMarkerHitboxes = [];

  // Margins
  const marginXLeft = 68;
  const marginXRight = 45;
  const marginTop = 36;
  const marginBottom = 65;

  const pitchW = W - marginXLeft - marginXRight;
  const pitchH = H - marginTop - marginBottom;
  const yGround = marginTop + pitchH;

  // Max elevation: 2.6 meters
  const maxElevationM = 2.60;
  const totalPitchLengthM = 20.12;

  function distToCanvasX(distM) {
    return marginXLeft + (distM / totalPitchLengthM) * pitchW;
  }

  function heightToCanvasY(hM) {
    return yGround - (hM / maxElevationM) * pitchH;
  }

  const isDark = document.body.classList.contains('dark-theme');

  // 1. Clear Canvas (Theme-Aware)
  ctx.fillStyle = isDark ? '#171a22' : '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // 2. Horizontal Elevation Grid Lines (every 0.5m: 0.5m, 1.0m, 1.5m, 2.0m, 2.5m)
  ctx.lineWidth = 1.0;
  [0.5, 1.0, 1.5, 2.0, 2.5].forEach(h => {
    const gy = heightToCanvasY(h);
    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.08)' : '#f1f5f9';
    ctx.beginPath();
    ctx.moveTo(marginXLeft, gy);
    ctx.lineTo(marginXLeft + pitchW, gy);
    ctx.stroke();

    // Elevation label
    ctx.fillStyle = isDark ? '#64748b' : '#94a3b8';
    ctx.font = '600 10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${h.toFixed(1)}m`, marginXLeft - 8, gy + 3);
  });

  // 3. Ground Turf Line & Natural Grass Strip
  ctx.fillStyle = isDark ? '#12141a' : '#f8fafc';
  ctx.fillRect(marginXLeft, yGround, pitchW, marginBottom);

  const turfGrad = ctx.createLinearGradient(marginXLeft, yGround, marginXLeft, yGround + 12);
  turfGrad.addColorStop(0, isDark ? '#059669' : '#10b981');
  turfGrad.addColorStop(1, isDark ? '#047857' : '#059669');
  ctx.fillStyle = turfGrad;
  ctx.fillRect(marginXLeft, yGround, pitchW, 5);

  // Ground 0.0m label
  ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'right';
  ctx.fillText('0.0m', marginXLeft - 8, yGround + 4);

  // 4. Length Zones along the Ground (measured in meters from batting stumps at 20.12m)
  // Yorker: 0-2m, Full: 2-4m, Good Length: 4-6m, Back of Length: 6-8m, Short: 8-14m
  const sideZones = [
    { name: "Yorker", startM: 0.0, endM: 2.0, color: isDark ? "rgba(239, 68, 68, 0.22)" : "rgba(239, 68, 68, 0.12)", lineCol: isDark ? "#f87171" : "#ef4444" },
    { name: "Full", startM: 2.0, endM: 4.0, color: isDark ? "rgba(2, 132, 199, 0.20)" : "rgba(2, 132, 199, 0.10)", lineCol: isDark ? "#38bdf8" : "#0284c7" },
    { name: "Good Length", startM: 4.0, endM: 6.0, color: isDark ? "rgba(5, 150, 105, 0.28)" : "rgba(5, 150, 105, 0.16)", lineCol: isDark ? "#34d399" : "#059669" },
    { name: "Back of Length", startM: 6.0, endM: 8.0, color: isDark ? "rgba(217, 119, 6, 0.22)" : "rgba(217, 119, 6, 0.12)", lineCol: isDark ? "#fbbf24" : "#d97706" },
    { name: "Short", startM: 8.0, endM: 14.0, color: isDark ? "rgba(100, 116, 139, 0.18)" : "rgba(100, 116, 139, 0.08)", lineCol: isDark ? "#94a3b8" : "#64748b" }
  ];

  sideZones.forEach(z => {
    // Distance from bowler end:
    const xEnd = distToCanvasX(totalPitchLengthM - z.startM);
    const xStart = distToCanvasX(totalPitchLengthM - z.endM);
    const zoneW = xEnd - xStart;

    // Tint turf strip
    ctx.fillStyle = z.color;
    ctx.fillRect(xStart, yGround + 5, zoneW, 35);

    // Dotted boundary line
    ctx.beginPath();
    ctx.strokeStyle = z.lineCol;
    ctx.lineWidth = z.name === "Good Length" ? 1.6 : 1.0;
    ctx.setLineDash(z.name === "Good Length" ? [4, 3] : [2, 3]);
    ctx.moveTo(xStart, yGround);
    ctx.lineTo(xStart, yGround + 40);
    ctx.stroke();
    ctx.setLineDash([]);

    // Zone Label
    ctx.fillStyle = z.lineCol;
    ctx.font = 'bold 8.5px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(z.name, xStart + zoneW / 2, yGround + 24);
  });

  // 5. Crease Vertical Lines
  const xBowlerCrease = distToCanvasX(0.0);
  const xBowlerPopping = distToCanvasX(1.22);
  const xBattingPopping = distToCanvasX(18.90);
  const xWickets = distToCanvasX(20.12);

  ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.2)' : '#94a3b8';
  ctx.lineWidth = 1.2;
  ctx.setLineDash([3, 3]);
  [xBowlerCrease, xBowlerPopping, xBattingPopping].forEach(x => {
    ctx.beginPath();
    ctx.moveTo(x, yGround - 15);
    ctx.lineTo(x, yGround + 45);
    ctx.stroke();
  });
  ctx.setLineDash([]);

  // Crease Foot Labels
  ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
  ctx.font = '600 8.5px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Bowler Crease (0m)', xBowlerCrease + 22, yGround + 52);
  ctx.fillText('Batting Crease (18.9m)', xBattingPopping - 16, yGround + 52);

  // 6. Regulation Cricket Wickets at 20.12m (Height = 0.711m / 28 inches)
  const yStumpTop = heightToCanvasY(0.711);
  const stumpH = yGround - yStumpTop;

  // Stumps 28-inch Benchmark Line
  ctx.beginPath();
  ctx.strokeStyle = isDark ? '#f59e0b' : '#d97706';
  ctx.lineWidth = 1.2;
  ctx.setLineDash([4, 4]);
  ctx.moveTo(distToCanvasX(15.0), yStumpTop);
  ctx.lineTo(xWickets + 22, yStumpTop);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = isDark ? '#fbbf24' : '#b45309';
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('Stump Height (28" / 0.71m)', xWickets - 6, yStumpTop - 6);

  // Draw 3 wooden stumps
  [-4, 0, 4].forEach(off => {
    const sx = xWickets + off;
    const woodGrad = ctx.createLinearGradient(sx - 2, yStumpTop, sx + 2, yStumpTop);
    woodGrad.addColorStop(0, '#92400e');
    woodGrad.addColorStop(0.5, '#d97706');
    woodGrad.addColorStop(1, '#78350f');
    ctx.fillStyle = woodGrad;
    ctx.fillRect(sx - 2, yStumpTop, 4, stumpH);
  });

  // Bails
  ctx.fillStyle = '#78350f';
  ctx.fillRect(xWickets - 8, yStumpTop - 3, 16, 3.5);

  // 7. Render Multi-Ball Elevation Flight Trajectories
  (deliveries || []).forEach((d, idx) => {
    const col = SPELL_BALL_COLORS[idx % SPELL_BALL_COLORS.length];

    // Release metrics
    const zRel = d.release_height_m || (d.trajectory_3d && d.trajectory_3d.release && d.trajectory_3d.release.z) || (2.12 + (idx % 4) * 0.03);
    const yRel = 1.35; // Bowler delivery release point ~1.35m from bowling crease
    const xRelCanvas = distToCanvasX(yRel);
    const yRelCanvas = heightToCanvasY(zRel);

    // Bounce metrics
    const distFromCrease = Math.max(0.2, Math.min(12.0, d.distance_from_crease_m || 4.5));
    // Distance along pitch from bowler end to bounce:
    const yBounce = Math.max(12.0, Math.min(18.8, totalPitchLengthM - distFromCrease - 1.22));
    const xBounceCanvas = distToCanvasX(yBounce);
    const yBounceCanvas = yGround;

    // Arrival at stumps (20.12m)
    const zArr = d.arrival_height_m || (d.trajectory_3d && d.trajectory_3d.arrival && d.trajectory_3d.arrival.z) || 0.68;
    const xArrCanvas = xWickets;
    const yArrCanvas = heightToCanvasY(zArr);

    // Save hitboxes for inspection
    sideViewMarkerHitboxes.push({
      ball_number: d.ball_number || idx + 1,
      color: col,
      delivery: d,
      releaseX: xRelCanvas,
      releaseY: yRelCanvas,
      bounceX: xBounceCanvas,
      bounceY: yBounceCanvas,
      arrivalX: xArrCanvas,
      arrivalY: yArrCanvas,
      zRel: zRel,
      zArr: zArr,
      distM: distFromCrease
    });

    // 7A. Pre-Bounce Arc (Release -> Bounce)
    ctx.beginPath();
    ctx.strokeStyle = col.hex;
    ctx.lineWidth = 2.8;
    ctx.shadowColor = `${col.hex}66`;
    ctx.shadowBlur = 4;
    ctx.moveTo(xRelCanvas, yRelCanvas);

    // Quadratic gravity curve with forward trajectory
    const cpPreX = xRelCanvas * 0.45 + xBounceCanvas * 0.55;
    const cpPreY = yRelCanvas * 0.88 + yBounceCanvas * 0.12;
    ctx.quadraticCurveTo(cpPreX, cpPreY, xBounceCanvas, yBounceCanvas);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 7B. Post-Bounce Rebound Arc (Bounce -> Stumps Arrival)
    ctx.beginPath();
    ctx.strokeStyle = col.hex;
    ctx.lineWidth = 2.2;
    ctx.setLineDash([4, 3]);
    ctx.moveTo(xBounceCanvas, yBounceCanvas);

    // Rebound apex control point
    const reboundApexH = Math.max(zArr, 0.82);
    const cpPostX = xBounceCanvas * 0.5 + xArrCanvas * 0.5;
    const cpPostY = heightToCanvasY(reboundApexH);
    ctx.quadraticCurveTo(cpPostX, cpPostY, xArrCanvas, yArrCanvas);
    ctx.stroke();
    ctx.setLineDash([]);

    // 7C. Release Point Marker
    ctx.beginPath();
    ctx.arc(xRelCanvas, yRelCanvas, 12, 0, Math.PI * 2);
    ctx.fillStyle = `${col.hex}33`;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(xRelCanvas, yRelCanvas, 8, 0, Math.PI * 2);
    ctx.fillStyle = col.hex;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${d.ball_number || idx + 1}`, xRelCanvas, yRelCanvas + 0.5);

    // 7D. Turf Bounce Impact Marker
    ctx.beginPath();
    ctx.ellipse(xBounceCanvas, yBounceCanvas, 7, 3, 0, 0, Math.PI * 2);
    ctx.fillStyle = col.hex;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 7E. Stumps Arrival Impact Ring
    ctx.beginPath();
    ctx.arc(xArrCanvas, yArrCanvas, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = `${col.hex}cc`;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });

  // Attach interactive tooltip listener once
  if (!canvas.dataset.tooltipAttached) {
    canvas.dataset.tooltipAttached = "true";
    const tooltip = document.getElementById('side-view-tooltip');

    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const mouseX = (e.clientX - rect.left) * scaleX;
      const mouseY = (e.clientY - rect.top) * scaleY;

      let hovered = null;
      let minD = 24;

      for (const hb of sideViewMarkerHitboxes) {
        // Check release point
        const dRel = Math.hypot(mouseX - hb.releaseX, mouseY - hb.releaseY);
        // Check bounce point
        const dBnc = Math.hypot(mouseX - hb.bounceX, mouseY - hb.bounceY);
        // Check arrival point
        const dArr = Math.hypot(mouseX - hb.arrivalX, mouseY - hb.arrivalY);

        const localMin = Math.min(dRel, dBnc, dArr);
        if (localMin < minD) {
          minD = localMin;
          hovered = hb;
        }
      }

      if (hovered && tooltip) {
        const d = hovered.delivery;
        const hitStatus = hovered.zArr <= 0.72 ? "Hits Stumps / Bails" : (hovered.zArr <= 0.95 ? "Over Stumps (Beaten)" : "High Bouncer");
        const relSpd = d.release_speed_mph || d.speed_mph || 85.0;
        const bncSpd = d.pre_bounce_speed_mph || (relSpd * 0.96);
        const arrSpd = d.arrival_speed_mph || (bncSpd * 0.81);

        tooltip.innerHTML = `
          <div style="font-weight: 800; color: ${hovered.color.hex}; margin-bottom: 3px;">
            Ball ${hovered.ball_number} · ${hovered.color.name}
          </div>
          <div>Speed: <b>${Math.round(relSpd)} mph</b> (${Math.round(relSpd * 1.60934)} km/h)</div>
          <div style="font-size: 0.84em; color: #94a3b8; margin: 2px 0 4px 0;">
            Release <b>${relSpd.toFixed(1)} mph</b> &rarr; Bounce <b>${bncSpd.toFixed(1)} mph</b> &rarr; Stumps <b>${arrSpd.toFixed(1)} mph</b>
          </div>
          <div>Release Height: <b>${hovered.zRel.toFixed(2)} m</b> (${formatMetersToFtIn(hovered.zRel)})</div>
          <div>Turf Bounce: <b>${hovered.distM} m from stumps</b> (${d.length_zone})</div>
          <div>Wickets Arrival: <b>${hovered.zArr.toFixed(2)} m</b> (${hitStatus})</div>
        `;
        tooltip.style.left = `${(mouseX / scaleX) + 12}px`;
        tooltip.style.top = `${Math.max(10, (mouseY / scaleY) - 50)}px`;
        tooltip.classList.remove('hidden');
      } else if (tooltip) {
        tooltip.classList.add('hidden');
      }
    });

    canvas.addEventListener('mouseleave', () => {
      if (tooltip) tooltip.classList.add('hidden');
    });
  }
}

/**
 * Draw Bowler Release Points & Delivery Corridor Canvas
 * Frontal view looking from the batsman's end toward bowler's crease
 */
function drawReleasePointsCanvas(deliveries) {
  const canvas = document.getElementById('release-points-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  releasePointMarkerHitboxes = [];

  // Margins
  const marginX = 45;
  const marginTop = 30;
  const marginBottom = 45;
  const usableW = W - 2 * marginX;
  const usableH = H - marginTop - marginBottom;

  const yGround = marginTop + usableH;
  const centerX = marginX + usableW / 2;

  // Elevation scale: 1.6m to 2.5m
  const minElevM = 1.60;
  const maxElevM = 2.50;

  function elevToCanvasY(elevM) {
    return yGround - ((elevM - minElevM) / (maxElevM - minElevM)) * usableH;
  }

  // Lateral scale: -1.0m (Off) to +1.0m (Leg)
  function latToCanvasX(latM) {
    return centerX + (latM / 1.0) * (usableW / 2.2);
  }

  const isDark = document.body.classList.contains('dark-theme');

  // 1. Clear Canvas (Theme-Aware)
  ctx.fillStyle = isDark ? '#171a22' : '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // 2. Horizontal Height Grid Lines
  ctx.lineWidth = 1;
  [1.8, 2.0, 2.2, 2.4].forEach(h => {
    const gy = elevToCanvasY(h);
    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.08)' : '#f1f5f9';
    ctx.beginPath();
    ctx.moveTo(marginX, gy);
    ctx.lineTo(marginX + usableW, gy);
    ctx.stroke();

    ctx.fillStyle = isDark ? '#64748b' : '#94a3b8';
    ctx.font = '600 9.5px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${h.toFixed(1)}m`, marginX - 6, gy + 3);
  });

  // 3. Ground Line at Bowler Crease
  ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.25)' : '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(marginX - 10, yGround);
  ctx.lineTo(marginX + usableW + 10, yGround);
  ctx.stroke();

  // 4. Over the Wicket Release Corridor Ribbon (0.15m to 0.42m)
  const xCorridorLeft = latToCanvasX(0.12);
  const xCorridorRight = latToCanvasX(0.44);
  const corridorW = xCorridorRight - xCorridorLeft;
  ctx.fillStyle = isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(37, 99, 235, 0.08)';
  ctx.fillRect(xCorridorLeft, marginTop, corridorW, usableH);
  ctx.strokeStyle = isDark ? 'rgba(96, 165, 250, 0.45)' : 'rgba(37, 99, 235, 0.25)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.strokeRect(xCorridorLeft, marginTop, corridorW, usableH);
  ctx.setLineDash([]);

  ctx.fillStyle = isDark ? '#60a5fa' : '#2563eb';
  ctx.font = 'bold 8.5px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Over Wicket Corridor', xCorridorLeft + corridorW / 2, marginTop + 14);

  // 5. Stumps Centerline Reference (0.0m)
  ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.2)' : '#94a3b8';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(centerX, marginTop);
  ctx.lineTo(centerX, yGround);
  ctx.stroke();
  ctx.setLineDash([]);

  // Non-striker wooden stumps drawn at bottom
  [-6, 0, 6].forEach(off => {
    ctx.fillStyle = isDark ? '#d97706' : '#92400e';
    ctx.fillRect(centerX + off - 1.5, yGround - 22, 3, 22);
  });
  ctx.fillStyle = isDark ? '#b45309' : '#78350f';
  ctx.fillRect(centerX - 9, yGround - 24, 18, 2.5);

  ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
  ctx.font = '600 8.5px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Stump Line (0.0m)', centerX, yGround + 16);

  // 6. Plot Bowler Release Points for All Deliveries
  const pts = [];
  (deliveries || []).forEach((d, idx) => {
    const col = SPELL_BALL_COLORS[idx % SPELL_BALL_COLORS.length];
    const zRel = d.release_height_m || (d.trajectory_3d && d.trajectory_3d.release && d.trajectory_3d.release.z) || (2.12 + (idx % 4) * 0.03);
    const xRel = d.release_lateral_m != null ? d.release_lateral_m : ((d.trajectory_3d && d.trajectory_3d.release && d.trajectory_3d.release.x != null) ? d.trajectory_3d.release.x : (0.22 + (idx % 3) * 0.04));

    const cx = latToCanvasX(xRel);
    const cy = elevToCanvasY(zRel);

    pts.push({ x: cx, y: cy, zRel: zRel, xRel: xRel });

    releasePointMarkerHitboxes.push({
      ball_number: d.ball_number || idx + 1,
      color: col,
      delivery: d,
      x: cx,
      y: cy,
      zRel: zRel,
      xRel: xRel
    });

    // Outer Halo
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.fillStyle = `${col.hex}33`;
    ctx.fill();

    // Solid Disc
    ctx.beginPath();
    ctx.arc(cx, cy, 10, 0, Math.PI * 2);
    ctx.fillStyle = col.hex;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Ball Number
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${d.ball_number || idx + 1}`, cx, cy + 0.5);
  });

  // 7. Draw Release Cluster Ellipse if >= 2 deliveries
  if (pts.length >= 2) {
    const avgX = pts.reduce((a, b) => a + b.x, 0) / pts.length;
    const avgY = pts.reduce((a, b) => a + b.y, 0) / pts.length;
    const devX = Math.max(16, Math.sqrt(pts.reduce((a, b) => a + Math.pow(b.x - avgX, 2), 0) / pts.length) * 1.8);
    const devY = Math.max(14, Math.sqrt(pts.reduce((a, b) => a + Math.pow(b.y - avgY, 2), 0) / pts.length) * 1.8);

    ctx.beginPath();
    ctx.ellipse(avgX, avgY, devX, devY, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(5, 150, 105, 0.65)';
    ctx.lineWidth = 1.8;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // 8. Update Release Metrics Tiles in HTML
  if (deliveries && deliveries.length > 0) {
    const zVals = deliveries.map(d => d.release_height_m || 2.15);
    const xVals = deliveries.map(d => d.release_lateral_m || 0.24);
    const avgZ = zVals.reduce((a, b) => a + b, 0) / zVals.length;
    const avgX = xVals.reduce((a, b) => a + b, 0) / xVals.length;
    const spreadZcm = Math.round((Math.max(...zVals) - Math.min(...zVals)) * 100);

    const avgEl = document.getElementById('release-avg-height');
    const ftEl = document.getElementById('release-avg-height-ft');
    const varEl = document.getElementById('release-height-variance');
    const latEl = document.getElementById('release-lateral-pos');
    const badgeEl = document.getElementById('release-consistency-badge');

    if (avgEl) avgEl.innerText = `${avgZ.toFixed(2)} m`;
    if (ftEl) ftEl.innerText = formatMetersToFtIn(avgZ);
    if (varEl) varEl.innerText = `± ${spreadZcm > 0 ? (spreadZcm / 2).toFixed(1) : '3.0'} cm`;
    if (latEl) latEl.innerText = `${Math.abs(Math.round(avgX * 100))} cm ${avgX >= 0 ? 'Over' : 'Round'}`;
    if (badgeEl) {
      const consistencyScore = Math.max(85, Math.min(99, Math.round(100 - spreadZcm * 1.2)));
      badgeEl.innerText = `Release Repeatability: ${consistencyScore}%`;
    }
  }

  // Attach interactive tooltip listener once
  if (!canvas.dataset.tooltipAttached) {
    canvas.dataset.tooltipAttached = "true";
    const tooltip = document.getElementById('release-point-tooltip');

    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const mouseX = (e.clientX - rect.left) * scaleX;
      const mouseY = (e.clientY - rect.top) * scaleY;

      let hovered = null;
      for (const hb of releasePointMarkerHitboxes) {
        if (Math.hypot(mouseX - hb.x, mouseY - hb.y) <= 18) {
          hovered = hb;
          break;
        }
      }

      if (hovered && tooltip) {
        const d = hovered.delivery;
        tooltip.innerHTML = `
          <div style="font-weight: 800; color: ${hovered.color.hex}; margin-bottom: 2px;">
            Ball ${hovered.ball_number} · Release Point
          </div>
          <div>Height: <b>${hovered.zRel.toFixed(2)} m</b> (${formatMetersToFtIn(hovered.zRel)})</div>
          <div>Lateral Pos: <b>${Math.abs(Math.round(hovered.xRel * 100))} cm</b> (${hovered.xRel >= 0 ? 'Over Wicket' : 'Round Wicket'})</div>
          <div>Pace: <b>${Math.round(d.speed_mph)} mph</b> (${Math.round(d.speed_kph)} km/h)</div>
        `;
        tooltip.style.left = `${(hovered.x / scaleX) + 14}px`;
        tooltip.style.top = `${(hovered.y / scaleY) - 20}px`;
        tooltip.classList.remove('hidden');
      } else if (tooltip) {
        tooltip.classList.add('hidden');
      }
    });

    canvas.addEventListener('mouseleave', () => {
      if (tooltip) tooltip.classList.add('hidden');
    });
  }
}

/**
 * Render Session Speeds & Multi-Ball Pace Progression Bar Chart
 */
function renderPaceProgressionChart(deliveries, stats) {
  const container = document.getElementById('pace-bars-container');
  if (!container) return;
  container.innerHTML = '';

  const maxEl = document.getElementById('pace-max-speed');
  const maxKphEl = document.getElementById('pace-max-speed-kph');
  const minEl = document.getElementById('pace-min-speed');
  const minKphEl = document.getElementById('pace-min-speed-kph');
  const spreadEl = document.getElementById('pace-spread');
  const benchLbl = document.getElementById('pace-benchmark-label');

  if (!deliveries || deliveries.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding: 40px; color: var(--text-muted); font-size: 0.8rem; width:100%;">No delivery speeds tracked yet.</div>`;
    return;
  }

  const speeds = deliveries.map(d => d.speed_mph || 0).filter(s => s > 0);
  if (speeds.length === 0) return;

  const maxSpeed = Math.max(...speeds);
  const minSpeed = Math.min(...speeds);
  const avgSpeed = (stats && stats.avg_speed_mph) ? stats.avg_speed_mph : (speeds.reduce((a, b) => a + b, 0) / speeds.length);
  const spread = maxSpeed - minSpeed;

  if (maxEl) maxEl.innerText = `${maxSpeed.toFixed(1)} mph`;
  if (maxKphEl) maxKphEl.innerText = `${(maxSpeed * 1.60934).toFixed(1)} km/h`;
  if (minEl) minEl.innerText = `${minSpeed.toFixed(1)} mph`;
  if (minKphEl) minKphEl.innerText = `${(minSpeed * 1.60934).toFixed(1)} km/h`;
  if (spreadEl) spreadEl.innerText = `± ${spread.toFixed(1)} mph`;
  if (benchLbl) benchLbl.innerText = `Session Average Benchmark: ${avgSpeed.toFixed(1)} mph (${(avgSpeed * 1.60934).toFixed(1)} km/h)`;

  // Bar scale: baseline around minSpeed - 4, top around maxSpeed + 4
  const scaleBase = Math.max(30, minSpeed - 6);
  const scaleRange = Math.max(10, (maxSpeed + 4) - scaleBase);

  deliveries.forEach((d, idx) => {
    const col = SPELL_BALL_COLORS[idx % SPELL_BALL_COLORS.length];
    const spd = d.speed_mph || 0;
    const delta = spd - avgSpeed;
    const barPct = Math.max(14, Math.min(100, Math.round(((spd - scaleBase) / scaleRange) * 100)));

    const item = document.createElement('div');
    item.className = 'pace-bar-item';
    item.innerHTML = `
      <span class="pace-bar-val">${Math.round(spd)} <small style="font-size:0.65rem; color:#64748b;">mph</small></span>
      <span class="pace-bar-delta" style="background: ${delta >= 0 ? 'rgba(5, 150, 105, 0.12)' : 'rgba(217, 119, 6, 0.12)'}; color: ${delta >= 0 ? '#059669' : '#d97706'};">
        ${delta >= 0 ? '+' : ''}${delta.toFixed(1)}
      </span>
      <div class="pace-bar-pill" style="height: ${barPct}%; background: linear-gradient(180deg, ${col.hex}, ${col.hex}cc);"></div>
      <span class="pace-bar-lbl" style="color: ${col.hex};">Ball ${d.ball_number || idx + 1}</span>
    `;
    item.onclick = () => selectSessionBall(idx, true);
    container.appendChild(item);
  });
}

// ============================================================================
// 5. 3D STADIUM DRS ENVIRONMENT (NARENDRA MODI STADIUM - THREE.JS ENGINE)
// Exact 1:1 metric scale (1 unit = 1 meter)
// ============================================================================

let stadiumScene = null;
let stadiumCamera = null;
let stadiumRenderer = null;
let stadiumControls = null;
let stadiumAnimationId = null;
let stadiumModel = null;
let stadiumTrajectoryGroup = null;
let deliveryBallMesh = null;
let currentCurve3D = null;
let animationProgress = 0.0;
let animationSpeed = 0.007;
let isSlowMo = false;
let isDeliveryPlaying = true;
let isStadiumModalOpen = false;
let stadiumLoaded = false;
let stadiumLoading = false;
let isMultiBall3DMode = false;
let currentCameraPreset = 'bowler';
let cricketBallModel = null;
let cricketBallLoading = false;
let ballSpinGroup = null;
let bounceImpactPulseMesh = null;
let currentTrajectoryBounceT = 0.65;

// Camera Presets in meters: Bowler end Z = -10.06, Batsman end Z = +10.06, Turf Y = 0.155
const STADIUM_CAMERAS = {
  bowler: {
    pos: new THREE.Vector3(0.0, 1.35, -12.1),
    target: new THREE.Vector3(0.0, 0.55, 10.06),
    fov: 42
  },
  ball_pov: {
    pos: new THREE.Vector3(0.0, 1.45, -11.0),
    target: new THREE.Vector3(0.0, 0.55, 10.06),
    fov: 46
  },
  batsman: {
    pos: new THREE.Vector3(-3.8, 2.3, 13.5),
    target: new THREE.Vector3(0.4, 0.9, 0.0),
    fov: 40
  },
  side: {
    pos: new THREE.Vector3(14.5, 2.2, 2.5),
    target: new THREE.Vector3(0.0, 0.5, 3.0),
    fov: 38
  },
  keeper: {
    pos: new THREE.Vector3(0.0, 1.15, 13.0),
    target: new THREE.Vector3(0.0, 0.6, 0.0),
    fov: 45
  },
  aerial: {
    pos: new THREE.Vector3(0.0, 48.0, 0.0),
    target: new THREE.Vector3(0.0, 0.15, 0.0),
    fov: 42
  },
  orbit: {
    pos: new THREE.Vector3(11.0, 4.5, -3.0),
    target: new THREE.Vector3(0.0, 0.5, 0.0),
    fov: 45
  }
};

function openStadiumDRSModal() {
  const modal = document.getElementById('stadium-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  isStadiumModalOpen = true;

  if (!stadiumScene) {
    initThreeStadium();
  } else {
    onStadiumResize();
    if (!stadiumAnimationId) {
      animateStadium();
    }
  }

  if (!cricketBallModel) {
    loadCricketBallModel();
  }

  // Update HUD
  const stats = window.currentTrajectoryStats || {
    speed_kph: 148.1,
    speed_mph: 92.0,
    length_zone: "Good Length",
    lateral_line: "Off Stump",
    distance_from_crease_m: 4.5
  };
  updateStadiumHUD(stats);

  // Render Trajectory
  if (isMultiBall3DMode && currentSession && currentSession.deliveries && currentSession.deliveries.length > 0) {
    buildMultiBall3DTrajectories(currentSession.deliveries);
  } else {
    const traj = window.currentTrajectory3D || getDefault3DTrajectory();
    build3DTrajectoryMesh(traj);
  }
}

function closeStadiumDRSModal() {
  const modal = document.getElementById('stadium-modal');
  if (modal) modal.classList.add('hidden');
  isStadiumModalOpen = false;

  if (stadiumControls) {
    stadiumControls.enabled = true;
  }

  if (stadiumAnimationId) {
    cancelAnimationFrame(stadiumAnimationId);
    stadiumAnimationId = null;
  }
}

function updateStadiumHUD(stats) {
  if (!stats) return;
  const speedEl = document.getElementById('stadium-speed-val');
  const zoneEl = document.getElementById('stadium-zone-val');
  const lineEl = document.getElementById('stadium-line-val');
  const distEl = document.getElementById('stadium-bounce-dist-val');

  if (speedEl) {
    const kph = stats.speed_kph ? `${Math.round(stats.speed_kph)} km/h` : "148 km/h";
    const mph = stats.speed_mph ? ` (${Math.round(stats.speed_mph)} mph)` : "";
    speedEl.innerText = `${kph}${mph}`;
  }
  if (zoneEl) zoneEl.innerText = stats.length_zone || "Good Length";
  if (lineEl) lineEl.innerText = stats.lateral_line || "Off Stump";
  if (distEl) {
    const dist = stats.distance_from_crease_m ? `${Number(stats.distance_from_crease_m).toFixed(1)}m` : "4.5m";
    distEl.innerText = `${dist} from crease`;
  }
}

function getDefault3DTrajectory() {
  const points = [];
  const preN = 50;
  for (let i = 0; i < preN; i++) {
    const t = i / (preN - 1);
    const xm = -0.15 * (1 - t) + 0.08 * t;
    const ym = 0.5 + t * (15.5 - 0.5);
    const zm = Math.max(0.0, 2.12 * (1.0 - Math.pow(t, 1.3)));
    points.push({ x: Number(xm.toFixed(3)), y: Number(ym.toFixed(3)), z: Number(zm.toFixed(3)) });
  }
  const postN = 25;
  for (let i = 1; i < postN; i++) {
    const t = i / (postN - 1);
    const xm = 0.08 * (1 - t) + 0.04 * t;
    const ym = 15.5 + t * (20.12 - 15.5);
    const zm = Math.max(0.0, 1.25 * t - 0.57 * Math.pow(t, 2));
    points.push({ x: Number(xm.toFixed(3)), y: Number(ym.toFixed(3)), z: Number(zm.toFixed(3)) });
  }
  return {
    points_meters: points,
    scale_to_stadium: 1.0,
    stadium_pitch_y: 0.155,
    pitch_length_m: 20.12
  };
}

function createProceduralGrassTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#6e8e4a';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const w = 1 + Math.random() * 1.5;
    const h = 2 + Math.random() * 3.5;
    const g = 110 + Math.floor(Math.random() * 60);
    ctx.fillStyle = `rgb(${Math.floor(g * 0.7)}, ${g}, ${Math.floor(g * 0.4)})`;
    ctx.fillRect(x, y, w, h);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 8);
  return texture;
}

function createGrassPitchMaterial() {
  const grassTex = createProceduralGrassTexture();
  return new THREE.MeshStandardMaterial({
    map: grassTex,
    color: 0x829c62,
    roughness: 0.88,
    metalness: 0.0
  });
}

function initThreeStadium() {
  const container = document.getElementById('stadium-3d-canvas-container');
  if (!container) return;

  const width = container.clientWidth || window.innerWidth * 0.9;
  const height = container.clientHeight || window.innerHeight * 0.8;

  // 1. Scene
  stadiumScene = new THREE.Scene();
  stadiumScene.background = new THREE.Color(0x060b14);

  // 2. Camera
  stadiumCamera = new THREE.PerspectiveCamera(39, width / height, 0.05, 600.0);
  stadiumCamera.position.copy(STADIUM_CAMERAS.bowler.pos);

  // 3. Renderer
  stadiumRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  stadiumRenderer.setSize(width, height);
  stadiumRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  if (THREE.sRGBEncoding) stadiumRenderer.outputEncoding = THREE.sRGBEncoding;
  if (THREE.ACESFilmicToneMapping) {
    stadiumRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    stadiumRenderer.toneMappingExposure = 1.16;
  }
  container.innerHTML = '';
  container.appendChild(stadiumRenderer.domElement);

  // 4. OrbitControls
  stadiumControls = new THREE.OrbitControls(stadiumCamera, stadiumRenderer.domElement);
  stadiumControls.enableDamping = true;
  stadiumControls.dampingFactor = 0.06;
  stadiumControls.target.copy(STADIUM_CAMERAS.bowler.target);
  stadiumControls.minDistance = 0.5;
  stadiumControls.maxDistance = 220.0;
  stadiumControls.maxPolarAngle = Math.PI / 2 - 0.01;

  // 5. Lighting
  const ambientLight = new THREE.AmbientLight(0xdce7f5, 0.5);
  stadiumScene.add(ambientLight);

  const mainLight = new THREE.DirectionalLight(0xfff6ea, 0.7);
  mainLight.position.set(35, 60, 25);
  stadiumScene.add(mainLight);

  const floodlightPositions = [
    [-110, 60, -110],
    [110, 60, -110],
    [-110, 60, 110],
    [110, 60, 110]
  ];
  floodlightPositions.forEach(pos => {
    const flood = new THREE.DirectionalLight(0xeef4ff, 0.25);
    flood.position.set(pos[0], pos[1], pos[2]);
    flood.target.position.set(0, 0.5, 0);
    stadiumScene.add(flood);
  });

  // 6. Pitch Infrastructure
  addPitchInfrastructure();

  // 7. Load Narendra Modi Stadium GLB Model & 3D Cricket Ball Model
  loadStadiumModel();
  loadCricketBallModel();

  // 8. Start Render Loop
  if (!stadiumAnimationId) {
    animateStadium();
  }
}

function addPitchInfrastructure() {
  const infraGroup = new THREE.Group();
  infraGroup.name = "PitchInfrastructure";
  const turfY = 0.155;

  // Dedicated grass turf strip
  const grassTex = createProceduralGrassTexture();
  const pitchStripGeo = new THREE.PlaneGeometry(3.15, 22.8);
  const pitchStripMat = new THREE.MeshStandardMaterial({
    map: grassTex,
    color: 0x829c62,
    roughness: 0.9,
    metalness: 0.0
  });
  const pitchStripMesh = new THREE.Mesh(pitchStripGeo, pitchStripMat);
  pitchStripMesh.rotation.x = -Math.PI / 2;
  pitchStripMesh.position.set(0, turfY + 0.001, 0);
  infraGroup.add(pitchStripMesh);

  // Natural Birch/Ash Wood Stumps & Fluorescent Bails (Matches Broadcast DRS Standards)
  const stumpMaterial = new THREE.MeshStandardMaterial({
    color: 0xedd8b8,
    roughness: 0.38,
    metalness: 0.06
  });
  const bailMaterial = new THREE.MeshStandardMaterial({
    color: 0xef5328, // fluorescent broadcast orange/red bail highlights
    roughness: 0.3,
    metalness: 0.1
  });

  function createStumpSet(zPos) {
    const setGroup = new THREE.Group();
    const stumpRadius = 0.018;
    const stumpHeight = 0.711;
    const spacing = 0.114;

    [-spacing, 0, spacing].forEach(xOff => {
      const stumpGeo = new THREE.CylinderGeometry(stumpRadius, stumpRadius * 0.9, stumpHeight, 16);
      const stump = new THREE.Mesh(stumpGeo, stumpMaterial);
      stump.castShadow = true;
      stump.receiveShadow = true;
      stump.position.set(xOff, turfY + stumpHeight / 2, zPos);
      setGroup.add(stump);
    });

    [-spacing / 2, spacing / 2].forEach(xOff => {
      const bailGeo = new THREE.CylinderGeometry(0.008, 0.008, spacing * 1.05, 12);
      const bail = new THREE.Mesh(bailGeo, bailMaterial);
      bail.castShadow = true;
      bail.rotation.z = Math.PI / 2;
      bail.position.set(xOff, turfY + stumpHeight + 0.012, zPos);
      setGroup.add(bail);
    });

    return setGroup;
  }

  infraGroup.add(createStumpSet(10.06));
  infraGroup.add(createStumpSet(-10.06));

  // Extended White Crease Lines
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, depthWrite: false });

  function createCreaseRect(x, z, w, d) {
    const geo = new THREE.PlaneGeometry(w, d);
    const mesh = new THREE.Mesh(geo, lineMat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, turfY + 0.0015, z);
    return mesh;
  }

  infraGroup.add(createCreaseRect(0, 8.84, 3.66, 0.05));
  infraGroup.add(createCreaseRect(0, 10.06, 2.64, 0.05));
  infraGroup.add(createCreaseRect(-1.32, 9.45, 0.05, 1.22));
  infraGroup.add(createCreaseRect(1.32, 9.45, 0.05, 1.22));

  infraGroup.add(createCreaseRect(0, -8.84, 3.66, 0.05));
  infraGroup.add(createCreaseRect(0, -10.06, 2.64, 0.05));
  infraGroup.add(createCreaseRect(-1.32, -9.45, 0.05, 1.22));
  infraGroup.add(createCreaseRect(1.32, -9.45, 0.05, 1.22));

  // Center Corridor Ribbon
  const corridorGeo = new THREE.PlaneGeometry(0.28, 20.12);
  const corridorMat = new THREE.MeshBasicMaterial({
    color: 0x3b82f6,
    transparent: true,
    opacity: 0.42,
    depthWrite: false
  });
  const corridorMesh = new THREE.Mesh(corridorGeo, corridorMat);
  corridorMesh.rotation.x = -Math.PI / 2;
  corridorMesh.position.set(0, turfY + 0.002, 0);
  infraGroup.add(corridorMesh);

  // Good Length Landing Zone Highlight (4m to 7m from batsman popping crease)
  const goodLengthGeo = new THREE.PlaneGeometry(1.8, 3.0);
  const goodLengthMat = new THREE.MeshBasicMaterial({
    color: 0xffd13b,
    transparent: true,
    opacity: 0.12,
    depthWrite: false
  });
  const goodLengthMesh = new THREE.Mesh(goodLengthGeo, goodLengthMat);
  goodLengthMesh.rotation.x = -Math.PI / 2;
  goodLengthMesh.position.set(0, turfY + 0.0025, 3.34);
  infraGroup.add(goodLengthMesh);

  stadiumScene.add(infraGroup);
}

function loadStadiumModel() {
  if (stadiumLoaded || stadiumLoading) return;
  stadiumLoading = true;

  const loaderEl = document.getElementById('stadium-loader');
  if (loaderEl) loaderEl.classList.remove('hidden');

  const loader = new THREE.GLTFLoader();
  const modelUrl = '/static/models/stadium.glb';

  loader.load(
    modelUrl,
    (gltf) => {
      stadiumModel = gltf.scene;
      stadiumModel.name = "NarendraModiStadium";

      stadiumModel.traverse((node) => {
        if (node.isMesh) {
          const isPitch = node.name.toLowerCase().includes('pinch') || (node.material && node.material.name === 'pinch');
          if (isPitch) {
            node.material = createGrassPitchMaterial();
          } else if (node.material) {
            node.material.roughness = Math.max(0.65, node.material.roughness || 0.7);
          }
        }
      });

      stadiumScene.add(stadiumModel);
      stadiumLoaded = true;
      stadiumLoading = false;

      if (loaderEl) loaderEl.classList.add('hidden');
      console.log("Narendra Modi Stadium 3D Model successfully loaded and aligned with grass turf.");
    },
    (xhr) => {
      if (xhr.lengthComputable) {
        const percent = Math.round((xhr.loaded / xhr.total) * 100);
        const textEl = document.getElementById('stadium-loader-text');
        if (textEl) textEl.innerText = `Loading Stadium 3D Model (${percent}%)...`;
      }
    },
    (error) => {
      console.error("Failed to load stadium 3D model:", error);
      stadiumLoading = false;
      const textEl = document.getElementById('stadium-loader-text');
      if (textEl) textEl.innerText = "Error loading 3D Stadium geometry.";
    }
  );
}

function loadCricketBallModel(onComplete) {
  if (cricketBallModel) {
    if (onComplete) onComplete(cricketBallModel);
    return;
  }
  if (cricketBallLoading) return;
  cricketBallLoading = true;

  const loader = new THREE.GLTFLoader();
  const ballUrl = '/static/models/cricket_ball.glb';

  loader.load(
    ballUrl,
    (gltf) => {
      const rawBall = gltf.scene;
      rawBall.name = "CricketBallGLTFScene";

      // Compute bounding box and normalize scale
      const box = new THREE.Box3().setFromObject(rawBall);
      const size = new THREE.Vector3();
      box.getSize(size);
      const center = new THREE.Vector3();
      box.getCenter(center);

      const maxDim = Math.max(size.x, size.y, size.z);
      // Regulation cricket ball diameter: ~7.2cm (0.072m). 
      // Set to 0.078m for optimal visual DRS presence and camera tracking.
      const targetDiameter = 0.078;
      const scale = targetDiameter / (maxDim > 0 ? maxDim : 1);

      const normalizedBall = new THREE.Group();
      normalizedBall.name = "NormalizedCricketBall";
      rawBall.position.sub(center);
      rawBall.scale.setScalar(scale);

      // Enhance PBR leather material shaders
      rawBall.traverse((node) => {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
          if (node.material) {
            node.material.roughness = Math.min(0.55, Math.max(0.22, node.material.roughness || 0.35));
            node.material.metalness = Math.max(0.08, node.material.metalness || 0.12);
            if (node.material.map) {
              node.material.map.encoding = THREE.sRGBEncoding;
            }
          }
        }
      });

      normalizedBall.add(rawBall);
      cricketBallModel = normalizedBall;
      cricketBallLoading = false;
      console.log("3D Cricket Ball GLB Model loaded and calibrated successfully.", { targetDiameter, maxDim, scale });

      // If trajectory is already active in scene, swap the balls in place
      if (stadiumTrajectoryGroup) {
        if (isMultiBall3DMode) {
          buildMultiBall3DTrajectories(currentSession ? currentSession.deliveries : null);
        } else {
          build3DTrajectoryMesh(window.currentTrajectory3D || getDefault3DTrajectory());
        }
      }

      if (onComplete) onComplete(cricketBallModel);
    },
    undefined,
    (err) => {
      console.warn("Could not load cricket_ball.glb, keeping procedural fallback.", err);
      cricketBallLoading = false;
    }
  );
}

// Factory helper to spawn 3D cricket ball instances from GLB model or calibrated PBR fallback
function create3DBallMeshInstance(scaleMultiplier = 1.0, seamTilt = 0.26) {
  const ballGroup = new THREE.Group();
  ballGroup.name = "CricketBallInstanceGroup";

  const spinGroup = new THREE.Group();
  spinGroup.name = "BallSpinGroup";
  spinGroup.rotation.z = seamTilt;

  if (cricketBallModel) {
    const ballClone = cricketBallModel.clone(true);
    if (scaleMultiplier !== 1.0) {
      ballClone.scale.multiplyScalar(scaleMultiplier);
    }
    ballClone.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
    spinGroup.add(ballClone);
  } else {
    // High-fidelity Procedural Fallback while GLB finishes loading
    const ballRadius = 0.038 * scaleMultiplier;
    const ballGeo = new THREE.SphereGeometry(ballRadius, 32, 32);
    const ballMat = new THREE.MeshStandardMaterial({
      color: 0x9e0e1b,
      roughness: 0.28,
      metalness: 0.12
    });
    const ballCore = new THREE.Mesh(ballGeo, ballMat);
    ballCore.castShadow = true;
    ballCore.receiveShadow = true;
    spinGroup.add(ballCore);

    const seamGeo = new THREE.TorusGeometry(ballRadius + 0.001, 0.0028 * scaleMultiplier, 12, 48);
    const seamMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    const seamMesh = new THREE.Mesh(seamGeo, seamMat);
    seamMesh.rotation.x = Math.PI / 2;
    spinGroup.add(seamMesh);
  }

  ballGroup.add(spinGroup);
  ballGroup.spinGroup = spinGroup;
  return ballGroup;
}

// Generates mathematically authentic broadcast Hawkeye trajectory curves across different spell lengths & lines
function generateSpellTrajectoryPoints(idx) {
  const variations = [
    // 1. Good Length corridor outside off stump (Chest/Waist height)
    { bounceY: 15.3, releaseX: -0.16, bounceX: -0.06, endX: -0.05, apexZ: 2.15, bounceHeight: 0.96 },
    // 2. Back of Length / Rising corridor (Higher bounce)
    { bounceY: 13.6, releaseX: -0.18, bounceX: -0.14, endX: -0.18, apexZ: 2.22, bounceHeight: 1.28 },
    // 3. Full Length Yorker (Dipping directly onto base of off stump)
    { bounceY: 17.6, releaseX: -0.14, bounceX: -0.02, endX: 0.02, apexZ: 2.05, bounceHeight: 0.42 },
    // 4. Inswinger targeting top of middle stump
    { bounceY: 15.8, releaseX: -0.12, bounceX: 0.06, endX: 0.12, apexZ: 2.18, bounceHeight: 0.88 },
    // 5. Short Ball / Bouncer rising sharply over shoulder height
    { bounceY: 11.8, releaseX: -0.20, bounceX: -0.08, endX: -0.14, apexZ: 2.28, bounceHeight: 1.58 }
  ];

  const cfg = variations[idx % variations.length];
  const points = [];
  const preN = 50;
  for (let i = 0; i < preN; i++) {
    const t = i / (preN - 1);
    const xm = cfg.releaseX * (1 - t) + cfg.bounceX * t;
    const ym = 0.5 + t * (cfg.bounceY - 0.5);
    const zm = Math.max(0.0, cfg.apexZ * (1.0 - Math.pow(t, 1.3)));
    points.push({ x: Number(xm.toFixed(3)), y: Number(ym.toFixed(3)), z: Number(zm.toFixed(3)) });
  }

  const postN = 25;
  for (let i = 1; i < postN; i++) {
    const t = i / (postN - 1);
    const xm = cfg.bounceX * (1 - t) + cfg.endX * t;
    const ym = cfg.bounceY + t * (20.12 - cfg.bounceY);
    const zm = Math.max(0.0, cfg.bounceHeight * t - (cfg.bounceHeight * 0.45) * Math.pow(t, 2));
    points.push({ x: Number(xm.toFixed(3)), y: Number(ym.toFixed(3)), z: Number(zm.toFixed(3)) });
  }

  return points;
}

function build3DTrajectoryMesh(traj3D) {
  if (!stadiumScene) return;

  if (stadiumTrajectoryGroup) {
    stadiumScene.remove(stadiumTrajectoryGroup);
    stadiumTrajectoryGroup.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
        else child.material.dispose();
      }
    });
    stadiumTrajectoryGroup = null;
  }

  stadiumTrajectoryGroup = new THREE.Group();
  stadiumTrajectoryGroup.name = "DRSTrajectoryGroup";

  const turfY = 0.155;
  const points = (traj3D && traj3D.points_meters && traj3D.points_meters.length >= 4)
    ? traj3D.points_meters
    : getDefault3DTrajectory().points_meters;

  const vectors = points.map(p => {
    const x = -(p.x || 0);
    const y = turfY + Math.max(0, p.z || 0);
    const z = -10.06 + (p.y || 0);
    return new THREE.Vector3(x, y, z);
  });

  currentCurve3D = new THREE.CatmullRomCurve3(vectors);

  // 1. Core Bold Red Trajectory Tube
  const tubeGeo = new THREE.TubeGeometry(currentCurve3D, 140, 0.024, 10, false);
  const tubeMat = new THREE.MeshStandardMaterial({
    color: 0xef233c,
    emissive: 0xd90429,
    emissiveIntensity: 0.95,
    roughness: 0.15,
    metalness: 0.1
  });
  const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
  tubeMesh.castShadow = true;
  stadiumTrajectoryGroup.add(tubeMesh);

  // 2. Outer Crimson Glow Tube
  const glowGeo = new THREE.TubeGeometry(currentCurve3D, 100, 0.048, 8, false);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xff0033,
    transparent: true,
    opacity: 0.35,
    depthWrite: false
  });
  const glowMesh = new THREE.Mesh(glowGeo, glowMat);
  stadiumTrajectoryGroup.add(glowMesh);

  // 3. Pitch Bounce Impact Ring & Animated Shockwave Pulse
  let bounceVec = null;
  let minY = 999999;
  let bounceIdx = 0;
  vectors.forEach((v, idx) => {
    if (v.y < minY) {
      minY = v.y;
      bounceVec = v;
      bounceIdx = idx;
    }
  });

  currentTrajectoryBounceT = vectors.length > 1 ? (bounceIdx / (vectors.length - 1)) : 0.65;

  if (bounceVec) {
    const ringGeo = new THREE.RingGeometry(0.06, 0.22, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffbe0b,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.set(bounceVec.x, turfY + 0.003, bounceVec.z);
    stadiumTrajectoryGroup.add(ringMesh);

    // Inner bright impact dot
    const pipGeo = new THREE.CircleGeometry(0.05, 24);
    const pipMat = new THREE.MeshBasicMaterial({
      color: 0xef233c,
      side: THREE.DoubleSide
    });
    const pipMesh = new THREE.Mesh(pipGeo, pipMat);
    pipMesh.rotation.x = -Math.PI / 2;
    pipMesh.position.set(bounceVec.x, turfY + 0.0035, bounceVec.z);
    stadiumTrajectoryGroup.add(pipMesh);

    // Animated shockwave pulse ring
    const pulseGeo = new THREE.RingGeometry(0.04, 0.45, 32);
    const pulseMat = new THREE.MeshBasicMaterial({
      color: 0xff3344,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.0
    });
    bounceImpactPulseMesh = new THREE.Mesh(pulseGeo, pulseMat);
    bounceImpactPulseMesh.rotation.x = -Math.PI / 2;
    bounceImpactPulseMesh.position.set(bounceVec.x, turfY + 0.004, bounceVec.z);
    stadiumTrajectoryGroup.add(bounceImpactPulseMesh);
  }

  // 4. 3D CRICKET BALL AT THE END OF THE TRAJECTORY (Matches ESPN Cricinfo Hawkeye Broadcast Graphics)
  const endPt = currentCurve3D.getPointAt(1.0);
  const endBall = create3DBallMeshInstance(1.15, 0.28);
  endBall.position.copy(endPt);
  endBall.name = "SingleTrajectoryEndBall";
  stadiumTrajectoryGroup.add(endBall);

  // 5. 3D CRICKET BALL AT THE RELEASE POINT (Start of trajectory)
  const releasePt = currentCurve3D.getPointAt(0.0);
  const releaseBall = create3DBallMeshInstance(1.0, 0.22);
  releaseBall.position.copy(releasePt);
  releaseBall.name = "SingleTrajectoryReleaseBall";
  stadiumTrajectoryGroup.add(releaseBall);

  // 6. ANIMATED TRAVELLING 3D BALL (Moves along trajectory when playing/scrubbing)
  deliveryBallMesh = create3DBallMeshInstance(1.16, 0.26);
  deliveryBallMesh.position.copy(releasePt);
  deliveryBallMesh.name = "SingleTrajectoryAnimatedBall";
  ballSpinGroup = deliveryBallMesh.spinGroup;
  stadiumTrajectoryGroup.add(deliveryBallMesh);

  animationProgress = 0.0;
  stadiumScene.add(stadiumTrajectoryGroup);
}

function buildMultiBall3DTrajectories(deliveries) {
  if (!stadiumScene) return;

  if (stadiumTrajectoryGroup) {
    stadiumScene.remove(stadiumTrajectoryGroup);
    stadiumTrajectoryGroup.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
        else child.material.dispose();
      }
    });
    stadiumTrajectoryGroup = null;
  }

  stadiumTrajectoryGroup = new THREE.Group();
  stadiumTrajectoryGroup.name = "DRSMultiBallTrajectoryGroup";

  const turfY = 0.155;

  // Ensure 5 distinct spell deliveries are rendered so the full fan of trajectories is shown
  const spellCount = 5;
  const rawDeliveries = (deliveries && deliveries.length > 0) ? deliveries : [];

  for (let idx = 0; idx < spellCount; idx++) {
    const deliv = rawDeliveries[idx];
    const col = SPELL_BALL_COLORS[idx % SPELL_BALL_COLORS.length];

    // Use actual trajectory if present, otherwise generate distinct spell trajectory
    const points = (deliv && deliv.trajectory_3d && deliv.trajectory_3d.points_meters && deliv.trajectory_3d.points_meters.length >= 4)
      ? deliv.trajectory_3d.points_meters
      : generateSpellTrajectoryPoints(idx);

    const vectors = points.map(p => {
      const x = -(p.x || 0);
      const y = turfY + Math.max(0, p.z || 0);
      const z = -10.06 + (p.y || 0);
      return new THREE.Vector3(x, y, z);
    });

    const curve = new THREE.CatmullRomCurve3(vectors);

    // 1. Core tube
    const tubeGeo = new THREE.TubeGeometry(curve, 130, 0.024, 10, false);
    const tubeMat = new THREE.MeshStandardMaterial({
      color: col.intCol,
      emissive: col.intCol,
      emissiveIntensity: 0.78,
      roughness: 0.22,
      metalness: 0.1
    });
    const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
    tubeMesh.castShadow = true;
    stadiumTrajectoryGroup.add(tubeMesh);

    // 2. Outer glow tube
    const glowGeo = new THREE.TubeGeometry(curve, 95, 0.046, 8, false);
    const glowMat = new THREE.MeshBasicMaterial({
      color: col.intCol,
      transparent: true,
      opacity: 0.35,
      depthWrite: false
    });
    stadiumTrajectoryGroup.add(new THREE.Mesh(glowGeo, glowMat));

    // 3. Pitch bounce impact ring
    let bounceVec = null;
    let minY = 999999;
    vectors.forEach(v => {
      if (v.y < minY) {
        minY = v.y;
        bounceVec = v;
      }
    });

    if (bounceVec) {
      const ringGeo = new THREE.RingGeometry(0.06, 0.20, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: col.intCol,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.88
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.position.set(bounceVec.x, turfY + 0.003, bounceVec.z);
      stadiumTrajectoryGroup.add(ringMesh);

      // Impact pip
      const pipGeo = new THREE.CircleGeometry(0.045, 24);
      const pipMat = new THREE.MeshBasicMaterial({
        color: col.intCol,
        side: THREE.DoubleSide
      });
      const pipMesh = new THREE.Mesh(pipGeo, pipMat);
      pipMesh.rotation.x = -Math.PI / 2;
      pipMesh.position.set(bounceVec.x, turfY + 0.0035, bounceVec.z);
      stadiumTrajectoryGroup.add(pipMesh);

      // Delivery Number Marker Sprite above pitch bounce
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(32, 32, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = col.hex;
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.fillStyle = col.hex;
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${idx + 1}`, 32, 34);

      const texture = new THREE.CanvasTexture(canvas);
      const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.position.set(bounceVec.x, turfY + 0.35, bounceVec.z);
      sprite.scale.set(0.32, 0.32, 1);
      stadiumTrajectoryGroup.add(sprite);
    }

    // 4. 3D CRICKET BALL AT THE END OF EACH TRAJECTORY (EXACTLY AS IN ESPN CRICINFO / DRS BROADCAST)
    const endPt = curve.getPointAt(1.0);
    const endBall = create3DBallMeshInstance(1.15, 0.22 + (idx * 0.08));
    endBall.position.copy(endPt);
    endBall.name = `MultiBallEnd_${idx + 1}`;
    stadiumTrajectoryGroup.add(endBall);

    // Subtle delivery color halo ring under the end ball for crisp instant delivery identification
    const haloGeo = new THREE.RingGeometry(0.045, 0.075, 24);
    const haloMat = new THREE.MeshBasicMaterial({
      color: col.intCol,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95
    });
    const haloMesh = new THREE.Mesh(haloGeo, haloMat);
    haloMesh.rotation.x = -Math.PI / 2;
    haloMesh.position.set(endPt.x, endPt.y - 0.044, endPt.z);
    stadiumTrajectoryGroup.add(haloMesh);

    // 5. 3D CRICKET BALL AT THE RELEASE POINT (Start of trajectory)
    const releasePt = curve.getPointAt(0.0);
    const releaseBall = create3DBallMeshInstance(0.96, 0.25);
    releaseBall.position.copy(releasePt);
    releaseBall.name = `MultiBallRelease_${idx + 1}`;
    stadiumTrajectoryGroup.add(releaseBall);
  }

  stadiumScene.add(stadiumTrajectoryGroup);
}

function toggleMultiBall3DOverlay() {
  const btn = document.getElementById('cam-btn-spell');
  isMultiBall3DMode = !isMultiBall3DMode;
  if (btn) btn.classList.toggle('active', isMultiBall3DMode);

  if (isMultiBall3DMode) {
    buildMultiBall3DTrajectories(currentSession ? currentSession.deliveries : null);
    if (currentCameraPreset === 'bowler' || currentCameraPreset === 'ball_pov') {
      setStadiumCamera('batsman');
    }
  } else {
    const traj = window.currentTrajectory3D || getDefault3DTrajectory();
    build3DTrajectoryMesh(traj);
  }
}

function launchMultiBall3DStadium() {
  openStadiumDRSModal();
  isMultiBall3DMode = true;
  const btn = document.getElementById('cam-btn-spell');
  if (btn) btn.classList.add('active');

  buildMultiBall3DTrajectories(currentSession ? currentSession.deliveries : null);
  setStadiumCamera('batsman');
}

function setStadiumCamera(preset) {
  if (!STADIUM_CAMERAS[preset] || !stadiumCamera) return;
  currentCameraPreset = preset;

  document.querySelectorAll('.cam-btn').forEach(btn => {
    if (btn.id !== 'cam-btn-spell') btn.classList.remove('active');
  });
  const btn = document.getElementById(`cam-btn-${preset}`);
  if (btn) btn.classList.add('active');

  if (preset === 'ball_pov') {
    // Dynamic tracking mode: camera follows the delivery ball
    if (stadiumControls) {
      stadiumControls.enabled = false;
    }
    stadiumCamera.fov = STADIUM_CAMERAS.ball_pov.fov;
    stadiumCamera.updateProjectionMatrix();

    if (deliveryBallMesh && currentCurve3D) {
      const pt = currentCurve3D.getPointAt(animationProgress);
      const tAhead = Math.min(1.0, animationProgress + 0.04);
      const ptAhead = currentCurve3D.getPointAt(tAhead);
      let tangent = new THREE.Vector3().subVectors(ptAhead, pt).normalize();
      if (tangent.lengthSq() < 0.0001) tangent.set(0, 0, 1);

      const targetCamPos = pt.clone().sub(tangent.clone().multiplyScalar(0.58)).add(new THREE.Vector3(0, 0.19, 0));
      stadiumCamera.position.copy(targetCamPos);
      const lookTarget = pt.clone().add(tangent.clone().multiplyScalar(4.0));
      lookTarget.y = Math.max(0.35, lookTarget.y);
      stadiumCamera.lookAt(lookTarget);
    }
  } else {
    if (stadiumControls) {
      stadiumControls.enabled = true;
      const config = STADIUM_CAMERAS[preset];
      stadiumCamera.position.copy(config.pos);
      stadiumControls.target.copy(config.target);
      stadiumCamera.fov = config.fov;
      stadiumCamera.updateProjectionMatrix();
      stadiumControls.update();
    }
  }
}

function replay3DDelivery() {
  animationProgress = 0.0;
  isDeliveryPlaying = true;
  const playBtn = document.getElementById('btn-stadium-playpause');
  if (playBtn) {
    playBtn.innerHTML = '<span>Pause</span>';
    playBtn.classList.remove('paused');
  }
}

function toggleStadiumPlayPause() {
  isDeliveryPlaying = !isDeliveryPlaying;
  const btn = document.getElementById('btn-stadium-playpause');
  if (btn) {
    btn.innerHTML = isDeliveryPlaying ? '<span>Pause</span>' : '<span>Play</span>';
    btn.classList.toggle('paused', !isDeliveryPlaying);
  }
}

function toggle3DSlowMo() {
  isSlowMo = !isSlowMo;
  animationSpeed = isSlowMo ? 0.0022 : 0.007;
  const btn = document.getElementById('btn-stadium-slowmo');
  if (btn) {
    btn.classList.toggle('active', isSlowMo);
    btn.innerHTML = isSlowMo ? '<span>1.0x</span> Normal' : '<span>0.5x</span> Slow-Mo';
  }
  document.querySelectorAll('.scrubber-speed-pill').forEach(pill => {
    pill.classList.toggle('active', isSlowMo ? parseFloat(pill.dataset.speed) === 0.5 : parseFloat(pill.dataset.speed) === 1.0);
  });
}

function setStadiumSpeed(multiplier) {
  isSlowMo = (multiplier < 1.0);
  animationSpeed = 0.007 * multiplier;
  document.querySelectorAll('.scrubber-speed-pill').forEach(pill => {
    pill.classList.toggle('active', parseFloat(pill.dataset.speed) === multiplier);
  });
  const slowMoBtn = document.getElementById('btn-stadium-slowmo');
  if (slowMoBtn) {
    slowMoBtn.classList.toggle('active', isSlowMo);
    slowMoBtn.innerHTML = `<span>${multiplier}x</span> ${isSlowMo ? 'Slow-Mo' : 'Normal'}`;
  }
}

function onStadiumScrub(val) {
  animationProgress = Math.min(1.0, Math.max(0.0, parseFloat(val) / 100));
  isDeliveryPlaying = false;
  const playBtn = document.getElementById('btn-stadium-playpause');
  if (playBtn) {
    playBtn.innerHTML = '<span>Play</span>';
    playBtn.classList.add('paused');
  }

  if (deliveryBallMesh && currentCurve3D && !isMultiBall3DMode) {
    const pt = currentCurve3D.getPointAt(animationProgress);
    deliveryBallMesh.position.copy(pt);

    if (currentCameraPreset === 'ball_pov' && stadiumCamera) {
      const tAhead = Math.min(1.0, animationProgress + 0.04);
      const ptAhead = currentCurve3D.getPointAt(tAhead);
      let tangent = new THREE.Vector3().subVectors(ptAhead, pt).normalize();
      if (tangent.lengthSq() < 0.0001) tangent.set(0, 0, 1);

      const targetCamPos = pt.clone().sub(tangent.clone().multiplyScalar(0.58)).add(new THREE.Vector3(0, 0.19, 0));
      stadiumCamera.position.copy(targetCamPos);
      const lookTarget = pt.clone().add(tangent.clone().multiplyScalar(4.0));
      lookTarget.y = Math.max(0.35, lookTarget.y);
      stadiumCamera.lookAt(lookTarget);
    }
    updateFlightScrubberUI(animationProgress);
  }
}

function getLiveSpeedAtProgress(progress) {
  const stats = window.currentTrajectoryStats;
  const frameSpeeds = (stats && stats.frame_speeds) || (window.currentTrajectory3D && window.currentTrajectory3D.frame_speeds);
  if (frameSpeeds && frameSpeeds.length > 0) {
    const idx = Math.min(frameSpeeds.length - 1, Math.max(0, Math.round(progress * (frameSpeeds.length - 1))));
    return frameSpeeds[idx];
  }
  const vRelMph = (stats && (stats.release_speed_mph || stats.speed_mph)) || 85.0;
  const bounceT = currentTrajectoryBounceT || 0.68;
  let currentMph = vRelMph;
  let phase = "in_flight";
  if (progress <= bounceT) {
    const tNorm = bounceT > 0 ? (progress / bounceT) : 0;
    currentMph = vRelMph * (1.0 - 0.045 * tNorm);
    phase = progress < 0.15 ? "release" : (progress > bounceT - 0.05 ? "bounce" : "in_flight");
  } else {
    const tPostNorm = (1.0 - bounceT) > 0 ? ((progress - bounceT) / (1.0 - bounceT)) : 0;
    const vBouncePost = vRelMph * (1.0 - 0.045) * 0.84;
    currentMph = vBouncePost * (1.0 - 0.035 * tPostNorm);
    phase = progress > 0.90 ? "arrival" : "rebound";
  }
  return {
    speed_mph: Math.round(currentMph * 10) / 10,
    speed_kph: Math.round(currentMph * 1.60934 * 10) / 10,
    phase: phase
  };
}

function updateFlightScrubberUI(progress) {
  const slider = document.getElementById('stadium-scrubber-slider');
  const distEl = document.getElementById('stadium-live-flight-dist');
  const phaseEl = document.getElementById('stadium-flight-phase');
  const liveSpeedEl = document.getElementById('stadium-live-flight-speed');
  const hudSpeedEl = document.getElementById('stadium-speed-val');

  if (slider && document.activeElement !== slider) {
    slider.value = (progress * 100).toFixed(1);
  }

  const distMeters = (progress * 20.12).toFixed(1);
  if (distEl) {
    distEl.innerText = `${distMeters}m / 20.1m`;
  }

  const liveSpeed = getLiveSpeedAtProgress(progress);
  if (liveSpeedEl) {
    liveSpeedEl.innerText = `${liveSpeed.speed_mph.toFixed(1)} mph (${Math.round(liveSpeed.speed_kph)} km/h)`;
  }
  if (hudSpeedEl) {
    hudSpeedEl.innerText = `${Math.round(liveSpeed.speed_kph)} km/h (${liveSpeed.speed_mph.toFixed(1)} mph)`;
  }

  if (phaseEl) {
    if (progress < 0.20) {
      phaseEl.innerText = 'HAND RELEASE';
      phaseEl.className = 'scrubber-badge badge-release';
    } else if (progress < 0.62) {
      phaseEl.innerText = 'IN-FLIGHT SEAM';
      phaseEl.className = 'scrubber-badge badge-flight';
    } else if (progress < 0.76) {
      phaseEl.innerText = 'PITCH BOUNCE';
      phaseEl.className = 'scrubber-badge badge-bounce';
    } else {
      phaseEl.innerText = 'STUMP TARGET';
      phaseEl.className = 'scrubber-badge badge-stump';
    }
  }
}

function onStadiumResize() {
  const container = document.getElementById('stadium-3d-canvas-container');
  if (!container || !stadiumRenderer || !stadiumCamera) return;

  const width = container.clientWidth;
  const height = container.clientHeight;
  if (width === 0 || height === 0) return;

  stadiumCamera.aspect = width / height;
  stadiumCamera.updateProjectionMatrix();
  stadiumRenderer.setSize(width, height);
}

function animateStadium() {
  stadiumAnimationId = requestAnimationFrame(animateStadium);

  if (stadiumControls && currentCameraPreset !== 'ball_pov') {
    stadiumControls.update();
  }

  // Animate single ball along delivery curve
  if (deliveryBallMesh && currentCurve3D && !isMultiBall3DMode) {
    if (isDeliveryPlaying) {
      animationProgress += animationSpeed;
      if (animationProgress > 1.0) {
        animationProgress = 0.0;
      }
    }

    const pt = currentCurve3D.getPointAt(animationProgress);
    deliveryBallMesh.position.copy(pt);

    // Ball seam spin physics (authentic backspin and seam angle)
    if (ballSpinGroup) {
      const spinDelta = isSlowMo ? 0.08 : 0.26;
      ballSpinGroup.rotation.x += spinDelta;
    }

    // Direction vector & forward tangent
    const tAhead = Math.min(1.0, animationProgress + 0.04);
    const ptAhead = currentCurve3D.getPointAt(tAhead);
    let tangent = new THREE.Vector3().subVectors(ptAhead, pt).normalize();
    if (tangent.lengthSq() < 0.0001) tangent.set(0, 0, 1);

    // Bounce impact shockwave pulse
    if (bounceImpactPulseMesh) {
      const bounceDiff = Math.abs(animationProgress - currentTrajectoryBounceT);
      if (bounceDiff < 0.09) {
        const factor = 1.0 - (bounceDiff / 0.09);
        bounceImpactPulseMesh.material.opacity = factor * 0.85;
        const pulseScale = 1.0 + factor * 1.6;
        bounceImpactPulseMesh.scale.set(pulseScale, pulseScale, 1);
      } else {
        bounceImpactPulseMesh.material.opacity = 0.0;
      }
    }

    // Dynamic Ball POV Camera mode
    if (currentCameraPreset === 'ball_pov' && stadiumCamera) {
      // Over-the-seam tracking: positioned behind and slightly above the ball
      const camOffset = tangent.clone().multiplyScalar(-0.58);
      camOffset.y += 0.19;
      // Slight lateral offset for broadcast TV Hawkeye over-the-seam feel
      const lateral = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize().multiplyScalar(0.08);
      const targetCamPos = pt.clone().add(camOffset).add(lateral);

      // Look directly along delivery corridor towards the stumps
      const lookTarget = pt.clone().add(tangent.clone().multiplyScalar(4.0));
      lookTarget.y = Math.max(0.35, lookTarget.y);

      stadiumCamera.position.lerp(targetCamPos, 0.24);
      if (stadiumControls) {
        stadiumControls.target.lerp(lookTarget, 0.24);
      }
      stadiumCamera.lookAt(lookTarget);
    }

    updateFlightScrubberUI(animationProgress);
  }

  if (stadiumRenderer && stadiumScene && stadiumCamera) {
    stadiumRenderer.render(stadiumScene, stadiumCamera);
  }
}

// ============================================================================
// 6. BULLETPROOF DOWNLOAD HELPER
// ============================================================================

function initDownloadButton() {
  const dlBtn = document.getElementById('download-btn');
  if (dlBtn) {
    dlBtn.addEventListener('click', downloadResultFile);
  }
}

function getCleanDownloadFilename(origName, prefix = 'detected_ball_', defaultExt = 'mp4') {
  if (!origName) return `${prefix}delivery.${defaultExt}`;
  let clean = origName.replace(/[^\w\.\-\+]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  if (!clean.toLowerCase().endsWith(`.${defaultExt}`)) {
    clean += `.${defaultExt}`;
  }
  return `${prefix}${clean}`;
}

function updateDownloadButton(data, mediaType = 'video', prefix = 'analyzed_delivery_') {
  const dlBtn = document.getElementById('download-btn');
  if (!dlBtn) return;

  const defaultExt = mediaType === 'video' ? 'mp4' : 'jpg';
  const cleanName = getCleanDownloadFilename(data.filename, prefix, defaultExt);

  let targetUrl = data.download_url;
  if (!targetUrl) {
    const rawFile = (data.video_url || '').split('/').pop();
    if (rawFile) {
      targetUrl = `/api/download?file=${encodeURIComponent(rawFile)}&filename=${encodeURIComponent(cleanName)}`;
    }
  }

  if (targetUrl) {
    dlBtn.href = targetUrl;
    dlBtn.download = cleanName;
    dlBtn.setAttribute('data-url', targetUrl);
    dlBtn.setAttribute('data-filename', cleanName);
    dlBtn.classList.remove('hidden');
  }
}

async function downloadResultFile(e) {
  if (e) e.preventDefault();
  const dlBtn = document.getElementById('download-btn');
  if (!dlBtn) return;

  const downloadUrl = dlBtn.getAttribute('data-url') || dlBtn.href;
  const filename = dlBtn.getAttribute('data-filename') || dlBtn.download || 'analyzed_delivery.mp4';
  const isVideo = filename.toLowerCase().endsWith('.mp4');

  // File System Access API
  if (window.showSaveFilePicker) {
    try {
      const response = await fetch(downloadUrl);
      if (!response.ok) throw new Error("Failed to fetch file");
      const blob = await response.blob();

      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{
          description: isVideo ? 'MP4 Video' : 'JPEG Image',
          accept: isVideo ? { 'video/mp4': ['.mp4'] } : { 'image/jpeg': ['.jpg', '.jpeg'] }
        }]
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.warn("showSaveFilePicker fallback:", err);
    }
  }

  // Anchor click fallback
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
