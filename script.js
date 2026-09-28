// Small helper to run after DOM ready
(function(){
  function $(sel){return document.querySelector(sel)}
  function $all(sel){return Array.from(document.querySelectorAll(sel))}

  // Reveal-on-scroll (simple)
  function onScrollReveal(){
    const items = document.querySelectorAll('.panel, .card');
    const trigger = window.innerHeight * 0.9;
    items.forEach(it=>{ const r = it.getBoundingClientRect(); if(r.top < trigger) it.classList.add('in-view'); });
  }
  window.addEventListener('scroll', onScrollReveal); onScrollReveal();

  // Elements
  const breathToggle = $('#breath-toggle');
  const breathPanel = $('#breath-panel');
  const breathStart = $('#breath-start');
  const breathStop = $('#breath-stop');
  const inhaleEl = $('#inhale');
  const holdEl = $('#hold');
  const exhaleEl = $('#exhale');
  const cyclesEl = $('#cycles');
  const breathLabel = $('#breath-label');
  const breathCircle = document.querySelector('.breath-circle');
  const faceSvg = document.querySelector('.kawaii-face');

  // Audio elements
  const audioToggle = $('#audio-toggle');
  const audioVol = $('#audio-vol');
  const audioPresetEl = $('#audio-preset');

  // Face controls
  const faceColorEl = $('#face-color');
  const faceEyesEl = $('#face-eyes');
  const faceMouthEl = $('#face-mouth');
  const faceResetBtn = $('#face-reset');

  // state
  let running = false; let breathTimer = null;
  let audioCtx = null, ambientGain = null, oscA = null, oscB = null, gainA = null, gainB = null, filter = null;
  let currentPreset = localStorage.getItem('calm_mood_preset') || 'calm-pad';
  let currentFaceColor = localStorage.getItem('calm_face_color') || '#fff6e8';
  let currentFaceEyes = localStorage.getItem('calm_face_eyes') || 'auto';
  let currentFaceMouth = localStorage.getItem('calm_face_mouth') || 'auto';

  // WebAudio: create nodes
  function ensureAudio(){
    if(audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    ambientGain = audioCtx.createGain(); ambientGain.gain.value = 0; ambientGain.connect(audioCtx.destination);

    oscA = audioCtx.createOscillator(); oscA.type = 'sine'; oscA.frequency.value = 110;
    gainA = audioCtx.createGain(); gainA.gain.value = 0.06; oscA.connect(gainA); gainA.connect(ambientGain);
    oscB = audioCtx.createOscillator(); oscB.type = 'sine'; oscB.frequency.value = 174.61; gainB = audioCtx.createGain(); gainB.gain.value = 0.04; oscB.connect(gainB); gainB.connect(ambientGain);

    filter = audioCtx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 1200; ambientGain.disconnect(); ambientGain.connect(filter); filter.connect(audioCtx.destination);
    oscA.start(); oscB.start(); applyAudioPreset(currentPreset);
  }

  function startAmbient(){ ensureAudio(); if(audioCtx.state==='suspended') audioCtx.resume(); ambientGain.gain.cancelScheduledValues(audioCtx.currentTime); ambientGain.gain.linearRampToValueAtTime(parseFloat(audioVol.value||0.15), audioCtx.currentTime+0.6); audioToggle.textContent='Stop Ambient'; localStorage.setItem('calm_mood_audio_on','1'); }
  function stopAmbient(){ if(!audioCtx) return; ambientGain.gain.cancelScheduledValues(audioCtx.currentTime); ambientGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime+0.6); audioToggle.textContent='Play Ambient'; localStorage.removeItem('calm_mood_audio_on'); }
  if(audioToggle) audioToggle.addEventListener('click', ()=>{ if(!audioCtx) ensureAudio(); if(audioToggle.textContent.includes('Play')) startAmbient(); else stopAmbient(); });
  if(audioVol) audioVol.addEventListener('input', ()=>{ if(ambientGain) ambientGain.gain.value = parseFloat(audioVol.value); localStorage.setItem('calm_mood_audio_vol', audioVol.value); });

  // presets
  function applyAudioPreset(name){ currentPreset = name||currentPreset; localStorage.setItem('calm_mood_preset', currentPreset); if(!audioCtx) return; if(!oscA||!oscB||!gainA||!gainB||!filter) return; switch(currentPreset){ case 'soft-bells': oscA.type='triangle'; oscA.frequency.value=220; gainA.gain.value=0.035; oscB.type='sine'; oscB.frequency.value=440; gainB.gain.value=0.02; filter.frequency.value=2400; break; case 'drone': oscA.type='sine'; oscA.frequency.value=65; gainA.gain.value=0.08; oscB.type='sawtooth'; oscB.frequency.value=82.41; gainB.gain.value=0.045; filter.frequency.value=900; break; case 'shimmer': oscA.type='sine'; oscA.frequency.value=110; gainA.gain.value=0.04; oscB.type='sawtooth'; oscB.frequency.value=220; gainB.gain.value=0.03; if(oscB.detune) oscB.detune.value=10; filter.frequency.value=1800; break; default: oscA.type='sine'; oscA.frequency.value=110; gainA.gain.value=0.06; oscB.type='sine'; oscB.frequency.value=174.61; gainB.gain.value=0.04; filter.frequency.value=1200; break; } }
  if(audioPresetEl){ audioPresetEl.value = currentPreset; audioPresetEl.addEventListener('change', ()=>{ const v = audioPresetEl.value; localStorage.setItem('calm_mood_preset', v); currentPreset=v; if(audioCtx) applyAudioPreset(v); }); }

  // breathing animation helpers
  function setBreathLabel(text){ if(breathLabel) breathLabel.textContent = text; }
  function animateCircle(scale,dur,phase){ if(!breathCircle) return; breathCircle.style.transition = `transform ${dur}s ease-in-out, background ${Math.max(0.22,dur/2)}s ease, box-shadow ${Math.max(0.22,dur/2)}s ease`; breathCircle.style.transform = `scale(${scale})`; breathCircle.classList.remove('breath-inhale','breath-hold','breath-exhale'); if(phase) breathCircle.classList.add('breath-'+phase); if(phase) breathCircle.classList.add('pulsing'); else breathCircle.classList.remove('pulsing'); }
  function triggerBlink(){ if(!breathCircle) return; breathCircle.classList.add('blinking'); setTimeout(()=>{ breathCircle.classList.remove('blinking'); },220); }

  function startBreathing(){ if(running) return; running=true; document.querySelector('.bottom-mood-card').classList.add('breathing'); const inhale = Math.max(1, parseFloat(inhaleEl?.value||4)); const hold = Math.max(0, parseFloat(holdEl?.value||4)); const exhale = Math.max(1, parseFloat(exhaleEl?.value||6)); const cycles = Math.max(1, parseInt(cyclesEl?.value||4,10)); let cycle=0; function runCycle(){ if(!running) return; cycle++; setBreathLabel(`Inhale (${cycle}/${cycles})`); animateCircle(1.9, inhale, 'inhale'); setTimeout(()=>{ if(!running) return; setBreathLabel('Hold'); animateCircle(1.6, hold||0.6, 'hold'); setTimeout(()=>{ if(!running) return; setBreathLabel('Exhale'); animateCircle(0.7, exhale, 'exhale'); setTimeout(()=>{ if(!running) return; if(cycle<cycles) runCycle(); else { stopBreathing(); setBreathLabel('Done'); } }, exhale*1000); }, (hold||0.6)*1000); }, inhale*1000); // blink cues
    setTimeout(()=> triggerBlink(), Math.min(420, (inhale*400)|0)); setTimeout(()=> triggerBlink(), Math.max(180, (hold*300)|0)); setTimeout(()=>{ triggerBlink(); }, Math.min(300, (exhale*200)|0)); }
  runCycle(); }
  function stopBreathing(){ running=false; clearTimeout(breathTimer); const card=document.querySelector('.bottom-mood-card'); if(card) card.classList.remove('breathing'); animateCircle(1,0.35); setBreathLabel('Stopped'); }

  if(breathToggle) breathToggle.addEventListener('click', ()=>{ if(!breathPanel) return; const shown = !breathPanel.hidden; breathPanel.hidden = shown; breathToggle.textContent = shown? 'Start Breathing' : 'Close Breathing'; });
  if(breathStart) breathStart.addEventListener('click', ()=>{ startBreathing(); if(audioToggle && audioToggle.textContent.includes('Play')){ /* don't auto-start audio */ } });
  if(breathStop) breathStop.addEventListener('click', ()=> stopBreathing());

  // face customization
  function setFaceColor(col){ currentFaceColor = col; localStorage.setItem('calm_face_color', col); if(!faceSvg) return; const faceCircle = faceSvg.querySelector('circle'); if(faceCircle) faceCircle.setAttribute('fill', col); }
  function setFaceEyes(style){ currentFaceEyes = style||'auto'; localStorage.setItem('calm_face_eyes', currentFaceEyes); if(!faceSvg) return; faceSvg.classList.remove('eyes-big','eyes-sparkle'); if(currentFaceEyes==='big') faceSvg.classList.add('eyes-big'); if(currentFaceEyes==='sparkle') faceSvg.classList.add('eyes-sparkle'); }
  function setFaceMouth(style){ currentFaceMouth = style||'auto'; localStorage.setItem('calm_face_mouth', currentFaceMouth); if(!faceSvg) return; faceSvg.classList.remove('mouth-smile','mouth-neutral','mouth-sad'); if(currentFaceMouth==='smile') faceSvg.classList.add('mouth-smile'); else if(currentFaceMouth==='neutral') faceSvg.classList.add('mouth-neutral'); else if(currentFaceMouth==='sad') faceSvg.classList.add('mouth-sad'); }
  function resetFace(){ setFaceColor('#fff6e8'); setFaceEyes('auto'); setFaceMouth('auto'); if(faceColorEl) faceColorEl.value='#fff6e8'; if(faceEyesEl) faceEyesEl.value='auto'; if(faceMouthEl) faceMouthEl.value='auto'; }

  const facePresets = { 'sunny': { color:'#fff6e8', eyes:'normal', mouth:'smile', blush:'#ffd6d8', sparkles:true }, 'sleepy': { color:'#eaf6ff', eyes:'normal', mouth:'neutral', blush:'#ffdfe6', sparkles:false }, 'cheery': { color:'#ffeef0', eyes:'big', mouth:'smile', blush:'#ffd1d8', sparkles:true }, 'mischief': { color:'#f6fff5', eyes:'sparkle', mouth:'mischief', blush:'#ffd7a6', sparkles:true }, 'calm': { color:'#f0fff8', eyes:'normal', mouth:'neutral', blush:'#ffeede', sparkles:false } };
  function applyFacePreset(name){ const p = facePresets[name]; if(!p) return; setFaceColor(p.color||currentFaceColor); setFaceEyes(p.eyes||'auto'); let mouth = p.mouth; if(mouth==='mischief') mouth='smile'; setFaceMouth(mouth||'auto'); const faceSvgRoot = document.querySelector('.kawaii-face'); if(faceSvgRoot && p.blush){ const blushEls = faceSvgRoot.querySelectorAll('.blushes circle'); blushEls.forEach(c=> c.setAttribute('fill', p.blush)); } if(faceSvgRoot){ const spark = faceSvgRoot.querySelector('.sparkles'); if(spark) spark.style.opacity = p.sparkles? '1':'0'; } localStorage.setItem('calm_face_preset', name); }
  document.querySelectorAll('.face-preset').forEach(btn=>{ btn.addEventListener('click', ()=>{ const name = btn.dataset.preset; applyFacePreset(name); if(faceColorEl) faceColorEl.value = facePresets[name].color || faceColorEl.value; if(faceEyesEl) faceEyesEl.value = facePresets[name].eyes || 'auto'; if(faceMouthEl) faceMouthEl.value = (facePresets[name].mouth==='mischief'?'smile':facePresets[name].mouth) || 'auto'; }); });

  if(faceColorEl){ faceColorEl.value = currentFaceColor; faceColorEl.addEventListener('input', ()=> setFaceColor(faceColorEl.value)); }
  if(faceEyesEl){ faceEyesEl.value = currentFaceEyes; faceEyesEl.addEventListener('change', ()=> setFaceEyes(faceEyesEl.value)); }
  if(faceMouthEl){ faceMouthEl.value = currentFaceMouth; faceMouthEl.addEventListener('change', ()=> setFaceMouth(faceMouthEl.value)); }
  if(faceResetBtn) faceResetBtn.addEventListener('click', ()=> resetFace());

  const savedFacePreset = localStorage.getItem('calm_face_preset'); if(savedFacePreset && facePresets[savedFacePreset]) setTimeout(()=> applyFacePreset(savedFacePreset), 80);
  setTimeout(()=>{ setFaceColor(currentFaceColor); setFaceEyes(currentFaceEyes); setFaceMouth(currentFaceMouth); }, 60);

})();

// Background ornaments spawner (leaves & bubbles)
(function(){
  if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let container = document.querySelector('.bg-ornaments');
  if(!container){ container = document.createElement('div'); container.className='bg-ornaments'; document.body.appendChild(container); }

  const leafEmojis = ['🍃','🍂','🌿'];
  function spawnLeaf(){
    const el = document.createElement('div'); el.className='leaf';
    const emoji = leafEmojis[Math.floor(Math.random()*leafEmojis.length)]; el.textContent = emoji;
    const sizeClass = Math.random() < 0.35 ? 'large' : (Math.random() < 0.5 ? 'small' : ''); if(sizeClass) el.classList.add(sizeClass);
    const startLeft = Math.random()*100; // percent
    el.style.left = startLeft + '%';
    el.style.top = (60 + Math.random()*10) + 'vh';
    const dur = 8000 + Math.random()*7000; // ms
    el.style.animationDuration = (dur/1000) + 's';
    if(Math.random() < 0.5) el.classList.add('left'); else el.classList.add('right');
    container.appendChild(el);
    setTimeout(()=> el.remove(), dur + 300);
  }

  function spawnBubble(){
    const b = document.createElement('div'); b.className='bubble';
    const left = Math.random()*100; b.style.left = left + '%';
    b.style.top = (60 + Math.random()*15) + 'vh';
    const size = 6 + Math.random()*18; b.style.width = size + 'px'; b.style.height = size + 'px';
    const dur = 5000 + Math.random()*6000; b.style.animationDuration = (dur/1000) + 's';
    container.appendChild(b);
    setTimeout(()=> b.remove(), dur + 300);
  }

  const leafTimer = setInterval(spawnLeaf, 1200);
  const bubbleTimer = setInterval(spawnBubble, 1600);
  for(let i=0;i<4;i++) setTimeout(spawnLeaf, i*300);
  for(let i=0;i<3;i++) setTimeout(spawnBubble, i*420);

  // control to stop ornaments if needed
  window.stopBgOrnaments = function(){ clearInterval(leafTimer); clearInterval(bubbleTimer); document.querySelectorAll('.bg-ornaments .leaf, .bg-ornaments .bubble').forEach(el=>el.remove()); };
})();

  // small hero mousemove parallax for forest layers
  (function(){
    const hero = document.querySelector('.hero');
    if(!hero) return;
    const layers = {
      back: document.querySelector('.forest-back'),
      mid: document.querySelector('.forest-mid'),
      front: document.querySelector('.forest-front')
    };
    let w = window.innerWidth, h = window.innerHeight;
    function onMove(e){
      const rect = hero.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) - 0.5; // -0.5 -> 0.5
      const y = ((e.clientY - rect.top) / rect.height) - 0.5;
      // apply small transforms
      if(layers.back) layers.back.style.transform = `translateX(${x * 6}%)`;
      if(layers.mid) layers.mid.style.transform = `translateX(${x * 10}%) translateY(${y * 2}px)`;
      if(layers.front) layers.front.style.transform = `translateX(${x * 14}%) translateY(${y * 4}px)`;
    }
    hero.addEventListener('mousemove', onMove);
    // reset on leave
    hero.addEventListener('mouseleave', ()=>{ if(layers.back) layers.back.style.transform=''; if(layers.mid) layers.mid.style.transform=''; if(layers.front) layers.front.style.transform=''; });
  })();

// Starfield spawner: creates falling and shooting stars inside `.starfield`
// (function(){
  // ensure there's a `.starfield` element attached to <body> as a global fixed overlay
  // let field = document.querySelector('.starfield');
  // if(!field){
  //   field = document.createElement('div');
  //   field.className = 'starfield global';
  //   document.body.appendChild(field);
  // } else {
    // if it exists somewhere else (e.g. inside hero), move it to body and make it global
  //   if(!field.classList.contains('global')){
  //     field.classList.add('global');
  //     document.body.appendChild(field);
  //   }
  // }

  // function spawnStar(){
  //   const star = document.createElement('div');
  //   star.className = 'star';
  //   const left = Math.random()*100; // percent
    // small random size; occasionally make a very bright larger star
    // let size = Math.random()*3 + 1; 
    // star.style.left = left + '%';
    // star.style.top = (Math.random()*30 - 10) + '%';
    // // bright chance
    // const isBright = Math.random() < 0.18;
//     if(isBright){ size = Math.max(size, 3 + Math.random()*3); star.classList.add('bright'); }
//     star.style.width = (size) + 'px';
//     star.style.height = (size) + 'px';
//     const dur = 4 + Math.random()*3;
//     star.style.animationDuration = dur + 's, ' + (1 + Math.random()*2) + 's';
//     field.appendChild(star);
//     setTimeout(()=>{ star.remove(); }, (dur*1000) + 300);
//   }

//   // more dramatic shooting stars
//   function spawnShootingStar(){
//     const s = document.createElement('div');
//     s.className = 'star shoot';
//     // start somewhere near the top-left to top-right
//     const startX = Math.random()*90 + 5; // percent
//     const startY = Math.random()*30 + 2; // percent
//     s.style.left = startX + '%';
//     s.style.top = startY + '%';
//     // length and angle
//     const angle = -20 - Math.random()*40; // degrees (shooting down-right)
//     const lengthX = (60 + Math.random()*100); // vw to travel
//     const lengthY = (30 + Math.random()*80); // vh to travel
//     s.style.setProperty('--tx', (lengthX) + 'vw');
//     s.style.setProperty('--ty', (lengthY) + 'vh');
//     // set rotation via CSS variable so the animation preserves tilt
//     s.style.setProperty('--rot', angle + 'deg');
//     const dur = 0.9 + Math.random()*1.2;
//     s.style.animationDuration = dur + 's';
//     // slightly vary fade/blur of trail
//     s.style.opacity = '' + (0.9 + Math.random()*0.15);
//     // occasional very bright shooting star
//     if(Math.random() < 0.22){ s.classList.add('bright'); s.style.opacity = '1'; }
//     field.appendChild(s);
//     setTimeout(()=> s.remove(), (dur*1000)+200);
//   }

//   // spawn normal stars more often
//   const starTimer = setInterval(spawnStar, 700);
//   // spawn occasional shooting stars
//   let shootTimer = setInterval(()=>{ if(Math.random() < 0.25) spawnShootingStar(); }, 1600);
//   // control flag to enable/disable shooting star creation
//   let shootingEnabled = true;
//   // initial burst
//   for(let i=0;i<6;i++) setTimeout(spawnStar, i*220);

//   // control functions to start/stop shooting stars
//   window.startShootingStars = function(){ if(shootTimer) return; shootingEnabled = true; shootTimer = setInterval(()=>{ if(Math.random() < 0.25) spawnShootingStar(); }, 1600); };
//   window.stopShootingStars = function(){ shootingEnabled = false; if(shootTimer){ clearInterval(shootTimer); shootTimer = null; } // remove existing shooting elements
//     document.querySelectorAll('.star.shoot').forEach(el=>el.remove()); };

//   // Immediately stop shooting stars as requested
//   window.stopShootingStars();
// })();

// Affirmations: save/load notes and UI behavior
(function(){
  const KEY = 'calm_affirmations_v1';
  const panel = document.querySelector('.affirmation-panel');
  const toggle = panel && panel.querySelector('.affirm-toggle');
  const box = panel && panel.querySelector('#affirm-box');
  const input = panel && panel.querySelector('#affirm-input');
  const addBtn = panel && panel.querySelector('#affirm-add');
  const listEl = panel && panel.querySelector('#affirm-list');
  const clearBtn = panel && panel.querySelector('#affirm-clear');

  if(!panel) return;
  // show panel by default on larger screens
  function shouldShowDefault(){ return window.innerWidth > 720 }
  if(shouldShowDefault()){ panel.removeAttribute('hidden'); toggle.setAttribute('aria-expanded','true'); }

  function load(){ try{ const raw = localStorage.getItem(KEY); return raw? JSON.parse(raw): []; }catch(e){ return []; } }
  function save(arr){ localStorage.setItem(KEY, JSON.stringify(arr||[])); }

  function render(){ const items = load(); listEl.innerHTML=''; items.slice().reverse().forEach((it, idx)=>{
    const li = document.createElement('li');
    const txt = document.createElement('div'); txt.textContent = it.text; txt.style.whiteSpace='pre-wrap'; txt.style.flex='1';
    const meta = document.createElement('div'); meta.className='meta'; meta.textContent = new Date(it.ts).toLocaleString();
    const del = document.createElement('button'); del.className='del'; del.title='Delete'; del.innerHTML='✕'; del.addEventListener('click', ()=>{ removeAt(items.length - 1 - idx); });
    li.appendChild(txt); const mwrap = document.createElement('div'); mwrap.appendChild(meta); li.appendChild(mwrap); li.appendChild(del);
    listEl.appendChild(li);
  });
  }

  function addAff(){ const v = input.value && input.value.trim(); if(!v) return; const items = load(); items.push({ text:v, ts: Date.now() }); save(items); input.value=''; render(); }
  function removeAt(i){ const items = load(); if(i<0||i>=items.length) return; items.splice(i,1); save(items); render(); }
  function clearAll(){ if(!confirm('Clear all affirmations?')) return; save([]); render(); }

  toggle.addEventListener('click', ()=>{
    const open = toggle.getAttribute('aria-expanded') === 'true';
    if(open){ panel.setAttribute('hidden',''); toggle.setAttribute('aria-expanded','false'); }
    else { panel.removeAttribute('hidden'); toggle.setAttribute('aria-expanded','true'); }
  });
  addBtn.addEventListener('click', addAff);
  input.addEventListener('keydown', (e)=>{ if(e.key === 'Enter' && (e.ctrlKey||e.metaKey)){ e.preventDefault(); addAff(); } });
  clearBtn.addEventListener('click', clearAll);

  // initial render
  render();

  // expose for debug
  window.calmAff = { load, save, render };
})();

// Spring flower spawner: gentle blooms that rise and sway
(function(){
  if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let container = document.querySelector('.spring-flowers');
  if(!container){ container = document.createElement('div'); container.className='spring-flowers'; document.body.appendChild(container); }

  function makeFlowerSVG(){
    // simple 5-petal flower using circles for portability
    return `
      <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <g transform="translate(32,32)">
          <g class="petals" fill="#F9C0D3" opacity="0.98">
            <circle class="petal" cx="0" cy="-18" r="10" />
            <circle class="petal" cx="14" cy="-6" r="10" />
            <circle class="petal" cx="9" cy="12" r="10" />
            <circle class="petal" cx="-9" cy="12" r="10" />
            <circle class="petal" cx="-14" cy="-6" r="10" />
          </g>
          <circle class="center" cx="0" cy="0" r="7" fill="#FFD966" />
        </g>
      </svg>`;
  }

  function spawnFlower(){
    const el = document.createElement('div'); el.className='flower';
    // size variation
    const sizeClassRand = Math.random(); if(sizeClassRand<0.28) el.classList.add('small'); else if(sizeClassRand<0.78) el.classList.add('medium'); else el.classList.add('large');
    // horizontal start position (percent)
    const startX = 5 + Math.random()*90; el.style.left = startX + '%';
    // start a little off bottom so it drifts up into view
    const startY = 78 + Math.random()*12; el.style.top = startY + 'vh';
    // duration and sway
    const dur = 5200 + Math.random()*5200; // ms
    const sway = 2800 + Math.random()*2600;
    el.style.setProperty('--dur', (dur/1000) + 's');
    el.style.setProperty('--sway', (sway/1000) + 's');
    // small rotation for variety
    const rot = -12 + Math.random()*24; el.style.setProperty('--rot', rot + 'deg');
    // seed size variable for svg
    const sizePx = 24 + Math.random()*56; el.style.setProperty('--size', sizePx + 'px');
    // optional horizontal offset variation via CSS var
    el.style.setProperty('--x', startX + '%');
    el.style.setProperty('--y', startY + 'vh');

    el.innerHTML = makeFlowerSVG();
    container.appendChild(el);
    // remove after animation finishes
    setTimeout(()=>{ try{ el.remove(); }catch(e){} }, dur + 400);
  }

  // spawn cadence tuned to be gentle; reduce on small viewports
  const baseInterval = window.innerWidth < 720 ? 1500 : 1000;
  let flowerTimer = setInterval(()=>{ if(Math.random() < 0.65) spawnFlower(); }, baseInterval);
  // initial scatter
  for(let i=0;i<6;i++) setTimeout(spawnFlower, i*260);

  window.stopSpringFlowers = function(){ clearInterval(flowerTimer); document.querySelectorAll('.spring-flowers .flower').forEach(el=>el.remove()); };

  // Backend integration for journal
  let token = localStorage.getItem('token');

  if (!token) {
    // Redirect to login if not authenticated, but since nav has login, perhaps not needed here
  }

  saveEntryBtn.addEventListener('click', async () => {
    const entryText = journalEntryEl.value;
    const bgColor = bgColorEl.value;
    const sticker = stickerSelectEl.value;
    const res = await fetch('http://localhost:5000/journal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token
      },
      body: JSON.stringify({ entryText, bgColor, sticker })
    });
    if (res.ok) {
      journalEntryEl.value = '';
      loadEntries();
    } else {
      alert('Failed to save entry');
    }
  });

})();

