/* Love site interactions */
const ANNIVERSARY = new Date(2026, 8, 6);
const STORAGE_KEY = 'our-love-site-v1';

function getDaysTogether() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(ANNIVERSARY.getFullYear(), ANNIVERSARY.getMonth(), ANNIVERSARY.getDate());
  const diff = Math.floor((today - start) / 86400000);
  return Math.max(diff, 0);
}

function updateDaysTogether() {
  const el = document.getElementById('daysTogether');
  if (el) {
    el.textContent = getDaysTogether().toLocaleString('zh-CN');
  }
}

function getSweetNotes() {
  const node = document.getElementById('sweetNotes');
  if (node === null) return ['Thank you for being here.'];
  try {
    const notes = JSON.parse(node.textContent);
    return Array.isArray(notes) && notes.length > 0 ? notes : ['Thank you for being here.'];
  } catch (error) {
    return ['Thank you for being here.'];
  }
}

const sweetNotes = getSweetNotes();
let toastTimer = null;

function showToast(text) {
  const toast = document.getElementById('sweetToast');
  const toastText = document.getElementById('toastText');
  if (toast === null || toastText === null) return;
  const note = text || sweetNotes[Math.floor(Math.random() * sweetNotes.length)];
  toastText.textContent = note;
  toast.classList.add('is-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(function () {
    toast.classList.remove('is-visible');
  }, 2600);
}

function burstHearts(x, y, count) {
  const layer = document.getElementById('heartLayer');
  if (layer === null) return;
  const total = count || 12;
  const colors = ['#e88e91', '#e8c66e', '#9bb4a3', '#d98689'];
  for (let i = 0; i < total; i += 1) {
    const heart = document.createElement('span');
    heart.className = 'floating-heart';
    heart.textContent = String.fromCharCode(i % 5 === 0 ? 10022 : 9825);
    heart.style.left = x + 'px';
    heart.style.top = y + 'px';
    heart.style.fontSize = (10 + Math.random() * 18) + 'px';
    heart.style.color = colors[i % colors.length];
    heart.style.setProperty('--drift-x', ((Math.random() - 0.5) * 210) + 'px');
    heart.style.setProperty('--drift-y', (-80 - Math.random() * 210) + 'px');
    heart.style.setProperty('--rotate', ((Math.random() - 0.5) * 120) + 'deg');
    heart.style.animationDelay = (Math.random() * 0.14) + 's';
    layer.appendChild(heart);
    window.setTimeout(function () { heart.remove(); }, 1700);
  }
}

function burstFromElement(element, count) {
  if (element === null) return;
  const rect = element.getBoundingClientRect();
  burstHearts(rect.left + rect.width / 2, rect.top + rect.height / 2, count);
}

function bindHeartButtons() {
  const ids = ['sweetButton', 'headerHeart', 'endingHeart'];
  ids.forEach(function (id) {
    const button = document.getElementById(id);
    if (button === null) return;
    button.addEventListener('click', function () {
      burstFromElement(button, id === 'endingHeart' ? 18 : 10);
      showToast();
    });
  });
}

function readSavedState() {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY)) || {};
  } catch (error) {
    return {};
  }
}

function saveState(state) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    return;
  }
}

function updateCloudProgress(checks) {
  const done = checks.filter(function (item) { return item.checked; }).length;
  const text = document.getElementById('cloudProgress');
  const bar = document.getElementById('cloudProgressBar');
  if (text) text.textContent = String(done);
  if (bar) bar.style.width = ((done / checks.length) * 100) + '%';
}

function setChecklistLocked(locked) {
  const cloudChecks = Array.from(document.querySelectorAll('[data-cloud-check]'));
  const wishChecks = Array.from(document.querySelectorAll('[data-wish-check]'));
  cloudChecks.concat(wishChecks).forEach(function (input) {
    const label = input.closest('.check-item') || input.closest('.wish-card');
    if (label) {
      label.classList.toggle('is-locked', locked);
      label.title = locked ? '登录后才能一起打卡' : '';
    }
  });
}

function initChecklists() {
  const sb = window.loveSupabase;
  const cloudChecks = Array.from(document.querySelectorAll('[data-cloud-check]'));
  const wishChecks = Array.from(document.querySelectorAll('[data-wish-check]'));
  const allChecks = cloudChecks.concat(wishChecks);
  let session = null;
  let loading = true;

  function applyRows(rows) {
    const map = Object.create(null);
    rows.forEach(function (row) {
      map[row.list_key + ':' + row.item_key] = row.done;
    });
    cloudChecks.forEach(function (input) {
      input.checked = Boolean(map['cloud:' + input.dataset.cloudCheck]);
    });
    wishChecks.forEach(function (input) {
      input.checked = Boolean(map['wish:' + input.dataset.wishCheck]);
    });
    updateCloudProgress(cloudChecks);
  }

  async function loadSharedRows() {
    if (session === null) return;
    const result = await sb.from('shared_todos').select('*');
    if (result.error) {
      console.error('shared_todos load failed', result.error.message);
      return;
    }
    applyRows(result.data || []);
  }

  async function saveCheck(input, listKey, itemKey) {
    if (session === null) {
      input.checked = input.checked === false;
      updateCloudProgress(cloudChecks);
      showSweetToast('登录后才能一起打卡哦');
      return;
    }
    const result = await sb.from('shared_todos').upsert({
      list_key: listKey,
      item_key: itemKey,
      done: input.checked,
      updated_by: session.user.id
    }, { onConflict: 'list_key,item_key' });
    if (result.error) {
      console.error('shared_todos save failed', result.error.message);
      input.checked = input.checked === false;
      updateCloudProgress(cloudChecks);
      showSweetToast('同步失败，请稍后再试');
      return;
    }
    if (listKey === 'wish' && input.checked) {
      burstFromElement(input.closest('.wish-card'), 8);
    }
  }

  allChecks.forEach(function (input) {
    input.addEventListener('change', function () {
      if (loading) {
        input.checked = input.checked === false;
        return;
      }
      if (input.dataset.cloudCheck) {
        updateCloudProgress(cloudChecks);
        saveCheck(input, 'cloud', input.dataset.cloudCheck);
      } else {
        saveCheck(input, 'wish', input.dataset.wishCheck);
      }
    });
  });

  setChecklistLocked(true);

  if (sb === undefined) {
    const state = readSavedState();
    cloudChecks.forEach(function (input) {
      input.checked = Boolean(state['cloud:' + input.dataset.cloudCheck]);
    });
    wishChecks.forEach(function (input) {
      input.checked = Boolean(state['wish:' + input.dataset.wishCheck]);
    });
    loading = false;
    setChecklistLocked(false);
    updateCloudProgress(cloudChecks);
    return;
  }

  sb.auth.getSession().then(function (result) {
    session = result.data.session;
    loading = false;
    if (session === null) {
      setChecklistLocked(true);
      updateCloudProgress(cloudChecks);
      return;
    }
    setChecklistLocked(false);
    loadSharedRows();
    sb.channel('shared-todos-home')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shared_todos' }, function () {
        loadSharedRows();
      })
      .subscribe();
  });

  sb.auth.onAuthStateChange(function (event, nextSession) {
    session = nextSession;
    if (session === null) {
      setChecklistLocked(true);
      return;
    }
    setChecklistLocked(false);
    loadSharedRows();
  });

  updateCloudProgress(cloudChecks);
}

function initEnvelope() {
  const envelope = document.getElementById('envelope');
  const tip = document.getElementById('envelopeTip');
  if (envelope === null) return;

  function toggleEnvelope() {
    const open = envelope.classList.toggle('is-open');
    envelope.setAttribute('aria-expanded', String(open));
    if (tip) {
      tip.textContent = open ? envelope.dataset.openTip : envelope.dataset.closeTip;
    }
    if (open) {
      window.setTimeout(function () {
        envelope.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 260);
    }
  }

  envelope.addEventListener('click', toggleEnvelope);
  envelope.addEventListener('keydown', function (event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleEnvelope();
    }
  });
}

function initRevealAnimation() {
  const items = Array.from(document.querySelectorAll('.story-card, .checklist-paper, .cloud-note, .gallery-card, .wish-card'));
  const canObserve = 'IntersectionObserver' in window;

  if (canObserve === false) {
    items.forEach(function (item) { item.classList.add('is-revealed'); });
    return;
  }

  const observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-revealed');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -30px' });

  items.forEach(function (item, index) {
    item.style.setProperty('--reveal-delay', (Math.min(index % 4, 3) * 70) + 'ms');
    observer.observe(item);
  });
}

updateDaysTogether();
bindHeartButtons();
initChecklists();
initEnvelope();
initRevealAnimation();
initParticleHeart();
window.setInterval(updateDaysTogether, 60000);

/* Particle heart */
function initParticleHeart() {
  const canvas = document.getElementById('heartCanvas');
  const stage = document.getElementById('particleStage');
  const button = document.getElementById('particleButton');
  if (canvas === null || stage === null) return;

  const ctx = canvas.getContext('2d');
  if (ctx === null) return;

  const TAU = Math.PI * 2;
  const COLORS = ['#f191a1', '#ed7287', '#f7b6b8', '#d95b78', '#ffd5cf'];
  const AMBIENT_COLORS = ['#9edce6', '#f6c9c4', '#ffe8dc', '#f191a1'];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const staticMode = window.location.search.indexOf('heart=static') > -1;
  const pointer = { x: 0, y: 0, active: false };
  let width = 0;
  let height = 0;
  let dpr = 1;
  let particles = [];
  let ambient = [];
  let rafId = 0;
  let running = false;
  let visible = false;
  let lastTime = 0;
  let resizeTimer = 0;

  function insideHeart(x, y) {
    const x2 = x * x;
    const y2 = y * y;
    const base = x2 + y2 - 1;
    return base * base * base - x2 * y * y * y <= 0;
  }

  function randomHeartPoint() {
    let x = 0;
    let y = 0;
    for (let i = 0; i < 120; i += 1) {
      x = (Math.random() * 2 - 1) * 1.34;
      y = (Math.random() * 2 - 1) * 1.2;
      if (insideHeart(x, y)) break;
    }
    return { x: x, y: y };
  }

  function buildParticles() {
    const rect = stage.getBoundingClientRect();
    width = Math.max(rect.width, 1);
    height = Math.max(rect.height, 1);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = width / 2;
    const cy = height * 0.52;
    const scale = Math.min(width / 2.65, height / 2.55);
    const total = width < 560 ? 520 : 1000;
    particles = [];
    for (let i = 0; i < total; i += 1) {
      const point = randomHeartPoint();
      const rim = Math.random() < 0.18;
      const jitter = rim ? 2.2 : 1.35;
      const tx = cx + point.x * scale + (Math.random() - 0.5) * jitter * 2;
      const ty = cy - point.y * scale + (Math.random() - 0.5) * jitter * 2;
      particles.push({
        x: cx + (Math.random() - 0.5) * width * 0.9,
        y: cy + (Math.random() - 0.5) * height * 0.9,
        vx: 0,
        vy: 0,
        tx: tx,
        ty: ty,
        size: 0.55 + Math.random() * (rim ? 2.1 : 1.5),
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        alpha: rim ? 0.78 + Math.random() * 0.2 : 0.35 + Math.random() * 0.5,
        phase: Math.random() * TAU,
        drift: 0.8 + Math.random() * 1.4,
        rim: rim
      });
    }

    const ambientCount = width < 560 ? 42 : 76;
    ambient = [];
    for (let i = 0; i < ambientCount; i += 1) {
      ambient.push({
        x: Math.random() * width,
        y: height * (0.58 + Math.random() * 0.42),
        size: 0.5 + Math.random() * 1.8,
        alpha: 0.12 + Math.random() * 0.38,
        speed: 0.12 + Math.random() * 0.38,
        drift: 5 + Math.random() * 18,
        phase: Math.random() * TAU,
        color: AMBIENT_COLORS[Math.floor(Math.random() * AMBIENT_COLORS.length)]
      });
    }
  }

  function drawGlow(cx, cy) {
    const radius = Math.max(width, height) * 0.42;
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    glow.addColorStop(0, 'rgba(210, 83, 117, 0.16)');
    glow.addColorStop(0.44, 'rgba(153, 64, 96, 0.08)');
    glow.addColorStop(1, 'rgba(20, 16, 28, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
  }

  function drawAmbient(time) {
    for (let i = 0; i < ambient.length; i += 1) {
      const p = ambient[i];
      p.y -= p.speed;
      p.x += Math.sin(time * 0.0007 + p.phase) * 0.08;
      if (p.y < height * 0.48) {
        p.y = height * (0.96 + Math.random() * 0.08);
        p.x = Math.random() * width;
      }
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, TAU);
      ctx.fill();
    }
  }

  function drawParticles(time) {
    for (let i = 0; i < particles.length; i += 1) {
      const p = particles[i];
      const wobbleX = Math.sin(time * 0.001 + p.phase) * p.drift;
      const wobbleY = Math.cos(time * 0.0012 + p.phase) * p.drift;
      const dx = p.tx + wobbleX - p.x;
      const dy = p.ty + wobbleY - p.y;
      p.vx += dx * 0.012;
      p.vy += dy * 0.012;

      if (pointer.active) {
        const pdx = p.x - pointer.x;
        const pdy = p.y - pointer.y;
        const distSq = pdx * pdx + pdy * pdy;
        const radius = 135;
        if (distSq < radius * radius) {
          const dist = Math.sqrt(distSq) || 1;
          const force = (1 - dist / radius) * 0.75;
          p.vx += (pdx / dist) * force;
          p.vy += (pdy / dist) * force;
        }
      }

      p.vx *= 0.93;
      p.vy *= 0.93;
      p.x += p.vx;
      p.y += p.vy;

      if (p.rim) {
        ctx.globalAlpha = p.alpha * 0.13;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 2.8, 0, TAU);
        ctx.fill();
      }

      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, TAU);
      ctx.fill();
    }
  }

  function render(time) {
    const now = time || 0;
    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(width / 2, height * 0.45);
    drawAmbient(now);
    drawParticles(now);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function loop(time) {
    if (running === false) return;
    const elapsed = lastTime === 0 ? 16 : Math.min(time - lastTime, 34);
    lastTime = time;
    render(time + elapsed);
    rafId = window.requestAnimationFrame(loop);
  }

  function start() {
    if (reduceMotion || running) return;
    running = true;
    lastTime = 0;
    rafId = window.requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    window.cancelAnimationFrame(rafId);
  }

  function burst() {
    const cx = width / 2;
    const cy = height * 0.52;
    for (let i = 0; i < particles.length; i += 1) {
      const p = particles[i];
      const dx = p.x - cx;
      const dy = p.y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = 2.2 + Math.random() * 5.2;
      p.vx += (dx / dist) * force + (Math.random() - 0.5) * 2.4;
      p.vy += (dy / dist) * force + (Math.random() - 0.5) * 2.4 - 1.2;
      p.alpha = Math.min(1, p.alpha + 0.16);
    }
    if (reduceMotion) {
      window.setTimeout(function () { render(performance.now()); }, 80);
    }
  }

  function setPointerFromEvent(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = event.clientX - rect.left;
    pointer.y = event.clientY - rect.top;
    pointer.active = true;
  }

  canvas.addEventListener('pointermove', setPointerFromEvent);
  canvas.addEventListener('pointerleave', function () { pointer.active = false; });
  canvas.addEventListener('click', function (event) {
    setPointerFromEvent(event);
    burst();
    const message = button ? button.dataset.message : '';
    showToast(message);
  });

  if (button) {
    button.addEventListener('click', function () {
      burst();
      showToast(button.dataset.message || '');
    });
  }

  const observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      visible = entry.isIntersecting;
      if (visible) {
        start();
      } else {
        stop();
      }
    });
  }, { threshold: 0.08 });

  window.addEventListener('resize', function () {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(function () {
      const wasRunning = running;
      buildParticles();
      if (wasRunning === false) render(performance.now());
    }, 180);
  });

  buildParticles();
  if (reduceMotion || staticMode) {
    for (let i = 0; i < particles.length; i += 1) {
      const p = particles[i];
      p.x = p.tx;
      p.y = p.ty;
      p.vx = 0;
      p.vy = 0;
    }
    render(0);
  } else {
    render(0);
  }
  observer.observe(stage);
}
