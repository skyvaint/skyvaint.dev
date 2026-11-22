"use strict";
/* ==========================================================================
   Skyvaint FX — synthesized sound, aura particles, speed lines, cursor.
   All sound is generated live with the Web Audio API (no audio files).
   ========================================================================== */

(() => {
  const root = document.documentElement;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
  const motionOff = () => reduced.matches || root.classList.contains("motion-paused");

  /* ---------------------------------------------------------------- sound */
  const Sound = {
    ctx: null, master: null, noise: null, hum: null,
    enabled: false,
    last: {},

    init() {
      if (this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = .55;
      const comp = this.ctx.createDynamicsCompressor();
      this.master.connect(comp).connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 4;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      this.brown = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0), brown = this.brown.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        data[i] = Math.random() * 2 - 1;
        last = (last + .02 * data[i]) / 1.02; // brown noise: soft, wind-like
        brown[i] = last * 3.5;
      }
      // custom hover sample
      fetch("assets/sfx/hover.wav").then((r) => r.arrayBuffer()).then((b) => this.ctx.decodeAudioData(b)).then((buf) => { this.hoverBuf = buf; }).catch(() => {});
    },

    set(on) {
      this.enabled = on;
      localStorage.setItem("sky-sound", on ? "on" : "off");
      if (on) { this.init(); this.ctx?.resume(); this.startHum(); }
      else this.stopHum();
      document.dispatchEvent(new CustomEvent("sky:sound", { detail: on }));
    },

    ready(key, gap) {
      if (!this.enabled || !this.ctx) return false;
      const now = performance.now();
      if (key && this.last[key] && now - this.last[key] < gap) return false;
      if (key) this.last[key] = now;
      return true;
    },

    env(gain, t, a, peak, d) {
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(peak, t + a);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    },

    tone(type, f0, f1, dur, peak, delay = 0) {
      const c = this.ctx, t = c.currentTime + delay;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      this.env(g, t, .005, peak, dur);
      o.connect(g).connect(this.master);
      o.start(t); o.stop(t + dur + .05);
    },

    burst(dur, peak, filterType, f0, f1, q = 1, delay = 0) {
      const c = this.ctx, t = c.currentTime + delay;
      const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = this.noise;
      f.type = filterType; f.Q.value = q;
      f.frequency.setValueAtTime(f0, t);
      f.frequency.exponentialRampToValueAtTime(f1, t + dur);
      this.env(g, t, Math.min(.04, dur / 3), peak, dur);
      s.connect(f).connect(g).connect(this.master);
      s.start(t, Math.random()); s.stop(t + dur + .05);
    },

    /* --- the palette --- */
    hover() {
      if (!this.ready("hover", 70)) return;
      if (!this.hoverBuf) { this.tone("sine", 1800, 2600, .05, .03); return; }
      const src = this.ctx.createBufferSource(), g = this.ctx.createGain();
      src.buffer = this.hoverBuf;
      src.playbackRate.value = .97 + Math.random() * .06;
      g.gain.value = .3;
      src.connect(g).connect(this.master);
      src.start();
    },
    // distant rumble for the background lightning
    thunder() {
      if (!this.ready("thunder", 3000)) return;
      const c = this.ctx, t = c.currentTime + .25;
      const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = this.brown; f.type = "lowpass"; f.frequency.value = 260;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(.22, t + .08);
      g.gain.exponentialRampToValueAtTime(.07, t + .6);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
      s.connect(f).connect(g).connect(this.master);
      s.start(t, Math.random() * 1.5); s.stop(t + 2.8);
    },
    tick() { if (this.ready("tick", 28)) this.tone("square", 3200 + Math.random() * 900, 2400, .012, .008); },
    click() { if (this.ready("click", 40)) { this.tone("triangle", 600, 140, .09, .12); this.burst(.06, .08, "highpass", 4000, 9000); } },
    whoosh() { if (this.ready("whoosh", 500)) this.burst(.45, .09, "bandpass", 300, 3200, 2.2); },
    teleport() {
      if (!this.ready("tp", 120)) return;
      this.tone("sawtooth", 180, 2600, .16, .05);
      this.burst(.2, .08, "bandpass", 1200, 7000, 4);
      this.tone("sine", 2600, 2500, .5, .05, .12);
    },
    impact() {
      if (!this.ready("impact", 200)) return;
      this.tone("sine", 140, 32, .55, .55);
      this.burst(.35, .35, "lowpass", 3000, 200, .7);
      this.burst(.12, .2, "highpass", 6000, 12000, .5);
      this.tone("sine", 3800, 3600, 1.2, .025, .05);
      this.tone("sine", 5070, 4900, 1, .015, .08);
    },
    awaken() {
      if (!this.enabled || !this.ctx) return;
      this.burst(1.2, .12, "bandpass", 120, 4200, 3);
      this.tone("sawtooth", 55, 220, 1.1, .06);
      [523, 784, 1046, 1568].forEach((f, i) => this.tone("sine", f, f * 1.003, 1.6, .03, .5 + i * .07));
      setTimeout(() => this.impact(), 1050);
    },
    // gacha-style summon: rising charge, burst, then a bright major chord
    summon() {
      if (!this.enabled || !this.ctx) return;
      this.burst(1.1, .1, "bandpass", 200, 6000, 4);
      this.tone("sawtooth", 80, 640, 1, .05);
      [0, .12, .24, .36, .48, .6, .72].forEach((d, i) => this.tone("sine", 880 + i * 220, 900 + i * 220, .12, .03, d));
      setTimeout(() => this.impact(), 1050);
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => this.tone("triangle", f, f, 1.8, .045, 1.15 + i * .06));
    },
    error() { if (this.ready("err", 300)) { this.tone("square", 220, 150, .14, .05); this.tone("square", 180, 120, .18, .04, .12); } },

    /* Calm nature ambience (all generated): wind, rustling air, a slow pad and
       the odd bird. Starts when sound is switched on. */
    startHum() {
      if (!this.ctx || this.hum || !this.enabled) return;
      const c = this.ctx, nodes = [], timers = [];
      const out = c.createGain();
      out.gain.setValueAtTime(0.0001, c.currentTime);
      out.gain.exponentialRampToValueAtTime(1, c.currentTime + 3);
      out.connect(this.master);
      const lfo = (freq, depth, target) => {
        const o = c.createOscillator(), g = c.createGain();
        o.frequency.value = freq; g.gain.value = depth;
        o.connect(g).connect(target); o.start(); nodes.push(o);
      };

      // wind: brown noise, lowpassed, slowly swelling
      const wind = c.createBufferSource(); wind.buffer = this.brown; wind.loop = true;
      const wf = c.createBiquadFilter(); wf.type = "lowpass"; wf.frequency.value = 420; wf.Q.value = .6;
      const wg = c.createGain(); wg.gain.value = .14;
      wind.connect(wf).connect(wg).connect(out); wind.start(); nodes.push(wind);
      lfo(.06, .08, wg.gain); lfo(.045, 220, wf.frequency);

      // leaves / distant stream: airy high band, gently pulsing
      const air = c.createBufferSource(); air.buffer = this.noise; air.loop = true;
      const af = c.createBiquadFilter(); af.type = "bandpass"; af.frequency.value = 2600; af.Q.value = .7;
      const ag = c.createGain(); ag.gain.value = .018;
      const ap = c.createStereoPanner ? c.createStereoPanner() : null;
      air.connect(af).connect(ag);
      if (ap) { ag.connect(ap).connect(out); lfo(.03, .6, ap.pan); } else ag.connect(out);
      air.start(); nodes.push(air);
      lfo(.23, .01, ag.gain);

      // soft echo for the pad and birds
      const wet = c.createGain(); wet.gain.value = .35;
      const dl = c.createDelay(1); dl.delayTime.value = .38;
      const fb = c.createGain(); fb.gain.value = .42;
      const dlf = c.createBiquadFilter(); dlf.type = "lowpass"; dlf.frequency.value = 1800;
      dl.connect(dlf).connect(fb).connect(dl); dlf.connect(wet).connect(out);

      // pad: slow chords, very quiet
      const chords = [[220, 277.18, 329.63, 440], [196, 246.94, 329.63, 392], [174.61, 220, 261.63, 349.23], [164.81, 246.94, 329.63, 415.3]];
      let ci = 0;
      const playChord = () => {
        if (!this.hum) return;
        const t = c.currentTime;
        for (const f of chords[ci++ % chords.length]) {
          for (const [type, det] of [["sine", 0], ["triangle", 4]]) {
            const o = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
            o.type = type; o.frequency.value = f; o.detune.value = det;
            lp.type = "lowpass"; lp.frequency.value = 900;
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(type === "sine" ? .012 : .005, t + 3.5);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 11);
            o.connect(lp).connect(g); g.connect(out); g.connect(dl);
            o.start(t); o.stop(t + 11.2);
          }
        }
        timers.push(setTimeout(playChord, 8500));
      };

      // birds: short chirp phrases from random sides
      const bird = () => {
        if (!this.hum) return;
        if (!document.hidden) {
          const t0 = c.currentTime, base = 2600 + Math.random() * 1600, n = 2 + (Math.random() * 4 | 0);
          const pan = c.createStereoPanner ? c.createStereoPanner() : null;
          if (pan) { pan.pan.value = Math.random() * 1.6 - .8; pan.connect(out); pan.connect(dl); }
          for (let k = 0; k < n; k++) {
            const t = t0 + k * (.11 + Math.random() * .06), d = .05 + Math.random() * .07;
            const o = c.createOscillator(), g = c.createGain();
            o.type = "sine";
            o.frequency.setValueAtTime(base * (1 + Math.random() * .15), t);
            o.frequency.exponentialRampToValueAtTime(base * (1.25 + Math.random() * .4), t + d);
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(.012, t + .01);
            g.gain.exponentialRampToValueAtTime(0.0001, t + d);
            o.connect(g).connect(pan || out);
            o.start(t); o.stop(t + d + .02);
          }
        }
        timers.push(setTimeout(bird, 4000 + Math.random() * 9000));
      };

      this.hum = { out, nodes, timers };
      playChord();
      timers.push(setTimeout(bird, 2500));
    },
    stopHum() {
      if (!this.hum) return;
      const { out, nodes, timers } = this.hum, t = this.ctx.currentTime;
      this.hum = null;
      timers.forEach(clearTimeout);
      out.gain.cancelScheduledValues(t);
      out.gain.setValueAtTime(Math.max(out.gain.value, 0.0001), t);
      out.gain.exponentialRampToValueAtTime(0.0001, t + .8);
      nodes.forEach((n) => { try { n.stop(t + .9); } catch {} });
      setTimeout(() => out.disconnect(), 1000);
    },
  };

  document.addEventListener("visibilitychange", () => {
    if (!Sound.ctx) return;
    document.hidden ? Sound.ctx.suspend() : Sound.enabled && Sound.ctx.resume();
  });

  /* --------------------------------------------------------------- canvas */
  const canvas = document.querySelector(".fx-canvas");
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, DPR = 1;
  const mouse = { x: -999, y: -999, vx: 0, vy: 0 };
  const trail = [];
  const sparks = [];
  let lines = null; // speed-line burst
  let scrollV = 0, lastScroll = scrollY;

  function resize() {
    DPR = Math.min(devicePixelRatio || 1, 1.6);
    W = innerWidth; H = innerHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const want = Math.round(Math.min(160, (W * H) / 9000));
    while (sparks.length < want) sparks.push(spawn(true));
    sparks.length = want;
  }

  function spawn(anywhere) {
    const hot = Math.random() < .18;
    return {
      x: Math.random() * W,
      y: anywhere ? Math.random() * H : H + 20,
      r: hot ? 1.4 + Math.random() * 1.6 : .5 + Math.random() * 1.1,
      vy: -(.25 + Math.random() * (hot ? 1.6 : .7)),
      vx: (Math.random() - .5) * .25,
      wob: Math.random() * Math.PI * 2,
      hue: Math.random() < .14 ? 44 : Math.random() < .5 ? 228 : 255,
      life: 1,
      hot,
    };
  }

  function speedBurst(x = W / 2, y = H / 2, strength = 1) {
    if (motionOff()) return;
    const n = 70;
    lines = { x, y, t: 0, strength, rays: Array.from({ length: n }, () => ({ a: Math.random() * Math.PI * 2, w: .5 + Math.random() * 2.2, l: .3 + Math.random() * .6 })) };
  }

  function frame() {
    requestAnimationFrame(frame);
    if (document.hidden) return;
    ctx.clearRect(0, 0, W, H);
    if (motionOff()) return;

    // scroll velocity -> particles get swept, sparks streak
    const sv = scrollY - lastScroll; lastScroll = scrollY;
    scrollV += (Math.max(-30, Math.min(30, sv)) - scrollV) * .2;

    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < sparks.length; i++) {
      const p = sparks[i];
      p.wob += .03;
      p.x += p.vx + Math.sin(p.wob) * .25;
      p.y += p.vy - scrollV * .15 * p.r;
      // dodge the cursor: particles flick away from it (ultra instinct reflex)
      const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
      if (d2 < 14000) { const f = (14000 - d2) / 14000 * 2.2; const d = Math.sqrt(d2) || 1; p.x += dx / d * f; p.y += dy / d * f; }
      if (p.y < -20 || p.y > H + 40 || p.x < -20 || p.x > W + 20) { sparks[i] = spawn(false); if (scrollV < -2) sparks[i].y = -10; continue; }
      const flick = .55 + Math.sin(p.wob * 3) * .45;
      const stretch = Math.min(8, Math.max(1, Math.abs(p.vy - scrollV * .15 * p.r) * 3));
      ctx.fillStyle = `hsla(0, 0%, ${p.hot ? 100 : 80}%, ${(p.hot ? .9 : .45) * flick})`;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.r, p.r * stretch, 0, 0, Math.PI * 2);
      ctx.fill();
      if (p.hot) {
        ctx.fillStyle = `hsla(0, 0%, 100%, ${.07 * flick})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 7, 0, Math.PI * 2); ctx.fill();
      }
    }

    // afterimage cursor trail
    if (trail.length > 1) {
      for (let i = 1; i < trail.length; i++) {
        const a = i / trail.length;
        ctx.strokeStyle = `rgba(255, 255, 255, ${a * .45})`;
        ctx.lineWidth = a * 3;
        ctx.beginPath(); ctx.moveTo(trail[i - 1].x, trail[i - 1].y); ctx.lineTo(trail[i].x, trail[i].y); ctx.stroke();
      }
    }
    if (trail.length) trail.shift();

    // anime speed lines
    if (lines) {
      lines.t += 1;
      const life = 1 - lines.t / 26;
      if (life <= 0) lines = null;
      else {
        const R = Math.hypot(W, H);
        ctx.globalCompositeOperation = "source-over";
        for (const r of lines.rays) {
          const inner = R * (.12 + (1 - life) * .25), outer = inner + R * r.l;
          const cx = Math.cos(r.a), cy = Math.sin(r.a);
          ctx.strokeStyle = `rgba(255, 255, 255, ${life * .5 * lines.strength})`;
          ctx.lineWidth = r.w;
          ctx.beginPath();
          ctx.moveTo(lines.x + cx * inner, lines.y + cy * inner);
          ctx.lineTo(lines.x + cx * outer, lines.y + cy * outer);
          ctx.stroke();
        }
      }
    }
    ctx.globalCompositeOperation = "source-over";
  }

  /* --------------------------------------------------------------- cursor */
  const cursor = document.querySelector(".cursor");
  const dot = cursor.querySelector(".cursor-dot");
  const ring = cursor.querySelector(".cursor-ring");
  const label = cursor.querySelector(".cursor-label");
  const ringPos = { x: -100, y: -100 };
  const interactive = "a, button, summary, select, input, textarea, [data-cursor], [role=button]";

  function useCursor() { root.classList.toggle("has-cursor", finePointer.matches); }
  useCursor();
  finePointer.addEventListener?.("change", useCursor);

  addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return;
    mouse.vx = e.clientX - mouse.x; mouse.vy = e.clientY - mouse.y;
    mouse.x = e.clientX; mouse.y = e.clientY;
    dot.style.transform = `translate3d(${mouse.x}px, ${mouse.y}px, 0)`;
    trail.push({ x: mouse.x, y: mouse.y });
    if (trail.length > 16) trail.shift();
  }, { passive: true });
  (function follow() {
    ringPos.x += (mouse.x - ringPos.x) * .2;
    ringPos.y += (mouse.y - ringPos.y) * .2;
    ring.style.transform = `translate3d(${ringPos.x}px, ${ringPos.y}px, 0)`;
    requestAnimationFrame(follow);
  })();
  document.addEventListener("pointerover", (e) => {
    const el = e.target.closest(interactive);
    if (!el || el.contains(e.relatedTarget)) return;
    cursor.classList.add("is-hover");
    label.textContent = el.dataset.cursor || "";
    if (e.pointerType !== "touch") Sound.hover();
  });
  document.addEventListener("pointerout", (e) => {
    const el = e.target.closest(interactive);
    if (el && !el.contains(e.relatedTarget)) cursor.classList.remove("is-hover");
  });
  addEventListener("pointerdown", () => cursor.classList.add("is-down"));
  addEventListener("pointerup", () => cursor.classList.remove("is-down"));
  document.addEventListener("mouseleave", () => { mouse.x = mouse.y = -999; });

  /* ---------------------------------------------------------- impact frame */
  const frameEl = document.querySelector(".impact-frame");
  function impact(x, y) {
    Sound.impact();
    if (motionOff()) return;
    frameEl.classList.remove("hit"); void frameEl.offsetWidth; frameEl.classList.add("hit");
    speedBurst(x ?? W / 2, y ?? H / 2, 1);
    document.querySelector("main").animate(
      [{ transform: "translate(0,0)" }, { transform: "translate(-6px,3px)" }, { transform: "translate(5px,-4px)" }, { transform: "translate(-3px,2px)" }, { transform: "translate(0,0)" }],
      { duration: 260, easing: "steps(4)" },
    );
  }

  addEventListener("resize", resize);
  resize();
  requestAnimationFrame(frame);

  window.FX = { Sound, impact, speedBurst, motionOff };
})();
