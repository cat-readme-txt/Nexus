import { SIDES, wallsBySource } from "./board.js";
import { baseShieldActive, shieldSourceActive } from "./rules.js";

const STORAGE_KEY = "nexus-audio";
const DEFAULT_VOLUMES = { effects: 65, music: 30 };
const SILENCE = .0001;
const SHIELD_SOURCES = [...wallsBySource.keys()];
const CUES = {
  ui: { notes: [86], duration: .052, level: .035, wave: "sine" },
  select: { notes: [74, 81], duration: .073, spacing: .032, level: .055 },
  start: { notes: [50, 57, 65, 69], duration: .31, spacing: .095 },
  search: { notes: [60, 67, 64], duration: .21, spacing: .105, wave: "sine" },
  species: { notes: [64, 69], duration: .22, wave: "sine" },
  handoff: { notes: [65, 53], duration: .2, spacing: .11, wave: "sine" },
  turn: { notes: [57, 64, 69], duration: .25, spacing: .075, wave: "sine" },
  warning: { notes: [74, 74], duration: .085, spacing: .11, level: .078, wave: "sine" },
  tick: { notes: [77], duration: .085, level: .12, wave: "sine" },
  timeout: { notes: [56, 44, 38], duration: .19, spacing: .085 },
  place: { notes: [42, 66], duration: .115, noise: [1150, .10, .07] },
  deploy: { notes: [41, 53, 65], duration: .24, noise: [720, .15, .09] },
  move: { notes: [49, 55], duration: .105, spacing: .034, level: .10, noise: [760, .085, .07] },
  capture: { notes: [56, 43], duration: .19, spacing: .032, slide: -12, noise: [1100, .22, .26] },
  strike: { notes: [49, 35], duration: .26, spacing: .024, slide: -14, level: .16, noise: [1230, .28, .37] },
  fire: { notes: [80, 66, 37], duration: .26, spacing: .045, slide: -22, noise: [940, .25, .27] },
  blocked: { notes: [61, 72], duration: .17, spacing: .02, slide: -2, noise: [2200, .19, .13] },
  claim: { notes: [55, 62, 67, 74], duration: .27, spacing: .064 },
  "shields-up": { notes: [45, 57, 64], duration: .28, slide: 6, wave: "sine" },
  "shields-down": { notes: [56, 43], duration: .32, slide: -12, noise: [475, .24, .12] },
  cache: { notes: [69, 76, 72], duration: .24, spacing: .065, level: .09, wave: "sine" },
  salvage: { notes: [58, 70, 77], duration: .21, noise: [1550, .09, .12] },
  fabricate: { notes: [46, 46, 58, 70], duration: .16, spacing: .067, noise: [890, .22, .13] },
  fortify: { notes: [39, 51, 58], duration: .24, spacing: .055, noise: [540, .17, .18] },
  "phase-jump": { notes: [57, 77, 86], duration: .24, spacing: .054, slide: 8, wave: "sine" },
  hop: { notes: [52, 59, 64], duration: .17, spacing: .063, slide: 4 },
  purchase: { notes: [72, 79, 84], duration: .12, spacing: .045, level: .09, wave: "sine" },
  augment: { notes: [56, 68, 75], duration: .26, spacing: .08, slide: 3 },
  emp: { notes: [72, 49, 36], duration: .335, spacing: .037, slide: -17, noise: [610, .32, .36] },
  void: { notes: [40, 47, 55, 64], duration: .43, spacing: .11, slide: 2 },
  retaliation: { notes: [58, 46, 34], duration: .21, slide: -6, noise: [1280, .18, .12] },
  victory: { notes: [50, 57, 62, 66, 69, 74], duration: .48, spacing: .123 },
  defeat: { notes: [58, 53, 46, 41], duration: .44, spacing: .142, wave: "sine" },
  error: { notes: [56, 50], duration: .105, spacing: .067, level: .1 },
};

function frequency(note) {
  return 440 * 2 ** ((note - 69) / 12);
}

function voice(context, bus, at, length, level, attack, release = length - attack) {
  const envelope = context.createGain();
  envelope.gain.setValueAtTime(SILENCE, at);
  envelope.gain.linearRampToValueAtTime(level, at + attack);
  envelope.gain.setValueAtTime(level, at + length - release);
  envelope.gain.exponentialRampToValueAtTime(SILENCE, at + length);
  envelope.connect(bus);
  return envelope;
}

function tone(context, bus, at, note, length, level, { wave = "sine", slide = 0, attack = .009, release } = {}) {
  const oscillator = context.createOscillator();
  const envelope = voice(context, bus, at, length, level, attack, release);
  oscillator.type = wave;
  oscillator.frequency.setValueAtTime(frequency(note), at);
  if (slide) oscillator.frequency.exponentialRampToValueAtTime(frequency(note + slide), at + length);
  oscillator.connect(envelope);
  oscillator.onended = () => {
    oscillator.disconnect();
    envelope.disconnect();
  };
  oscillator.start(at);
  oscillator.stop(at + length);
}

function noiseBurst(context, bus, sample, at, cutoff, length, level) {
  const noise = context.createBufferSource();
  noise.buffer = sample;
  const filter = context.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = cutoff;
  filter.Q.value = .7;
  const envelope = voice(context, bus, at, length, level, .005);
  noise.connect(filter).connect(envelope);
  noise.onended = () => {
    noise.disconnect();
    filter.disconnect();
    envelope.disconnect();
  };
  noise.start(at);
  noise.stop(at + length);
}

const CHORDS = [
  [38, 53, 57, 60, 64],
  [34, 53, 57, 60, 65],
  [41, 52, 57, 60, 67],
  [33, 52, 55, 60, 62],
];
const STEP_SECONDS = 60 / 78 / 2;
const STEPS_PER_CHORD = 16;

function soundtrack(context, bus) {
  let timer = null;
  let step = 0;
  let next = 0;
  function fill() {
    if (context.state !== "running" || document.hidden) return;
    const now = context.currentTime;
    if (next < now) next = now + .04;
    while (next < now + .18) {
      const chord = CHORDS[Math.floor(step / STEPS_PER_CHORD) % CHORDS.length];
      const beat = step % STEPS_PER_CHORD;
      const root = chord[0];
      if (beat === 0) {
        for (const note of chord.slice(1)) {
          tone(context, bus, next, note, 6.3, .062, { wave: "triangle", attack: 1.35, release: 2.4 });
        }
      }
      if (beat % 4 === 0) {
        tone(context, bus, next, root, .9, beat === 0 ? .21 : .11, { attack: .05, release: .75 });
      }
      if ([2, 5, 9, 12, 15].includes(beat)) {
        const note = chord[1 + ((beat + Math.floor(step / STEPS_PER_CHORD)) % 4)] + 12;
        tone(context, bus, next, note, 1.13, .088);
        tone(context, bus, next + .28, note, .8, .028);
      }
      step += 1;
      next += STEP_SECONDS;
    }
  }
  return function setPlaying(playing) {
    if (playing && timer === null) {
      next = context.currentTime + .09;
      step = 0;
      fill();
      timer = setInterval(fill, 95);
    } else if (!playing && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function getVolumes() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Object.fromEntries(Object.entries(DEFAULT_VOLUMES).map(([name, fallback]) => {
      const value = saved?.[name];
      return [name, Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : fallback];
    }));
  } catch {
    return { ...DEFAULT_VOLUMES };
  }
}

export function createGameAudio() {
  const volumes = getVolumes();
  let context, effects, music, noise, setPlaying;
  let previousRevision = null;
  let powered = null;
  let lastClock = null;

  function applyVolumes() {
    if (!context) return;
    const audible = !document.hidden;
    effects.gain.setTargetAtTime(audible ? volumes.effects / 100 : 0, context.currentTime, .025);
    music.gain.setTargetAtTime(audible ? volumes.music / 100 : 0, context.currentTime, .1);
    setPlaying(audible && volumes.music > 0 && context.state === "running");
  }

  function unlock() {
    const Audio = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!Audio || !(volumes.effects || volumes.music)) return;
    if (!context) {
      context = new Audio();
      const compressor = context.createDynamicsCompressor();
      compressor.connect(context.destination);
      effects = context.createGain();
      music = context.createGain();
      effects.connect(compressor);
      music.connect(compressor);
      noise = context.createBuffer(1, Math.ceil(.36 * context.sampleRate), context.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
      setPlaying = soundtrack(context, music);
      context.addEventListener("statechange", applyVolumes);
      applyVolumes();
    }
    if (context.state !== "running") void context.resume().then(applyVolumes).catch(() => {});
  }

  function play(cue, delay = 0) {
    if (!context || !volumes.effects || document.hidden) return;
    const tuning = CUES[cue];
    if (!tuning) return;
    const { notes, duration = .16, spacing = .053, level = .11, wave = "triangle", slide = 0 } = tuning;
    const start = context.currentTime + .012 + delay;
    for (const [index, note] of notes.entries()) {
      tone(context, effects, start + index * spacing, note, duration, level, { wave, slide });
    }
    if (tuning.noise) noiseBurst(context, effects, noise, start, ...tuning.noise);
  }

  function sync(game, seat) {
    if (!game) {
      previousRevision = null;
      powered = null;
      lastClock = null;
      return;
    }
    if (game.revision === previousRevision) return;
    const nextPower = SHIELD_SOURCES.map((id) => shieldSourceActive(game, id));
    for (const side of SIDES) nextPower.push(baseShieldActive(game, side));
    if (previousRevision !== null && game.revision > previousRevision) {
      const fresh = (game.soundEvents ?? []).filter(({ revision }) => revision > previousRevision).slice(-5);
      for (const [index, { cue }] of fresh.entries()) {
        const outcome = seat && seat !== game.winner ? "defeat" : "victory";
        play(cue === "finish" ? outcome : cue, .13 * index);
      }
      if (nextPower.some((active, i) => !active && powered[i])) play("shields-down", .095);
      if (nextPower.some((active, i) => active && !powered[i])) play("shields-up", .095);
    }
    previousRevision = game.revision;
    powered = nextPower;
  }

  function countdown(turn, deadline, seconds) {
    if (deadline !== null && lastClock?.turn === turn && lastClock.deadline === deadline && lastClock.seconds > seconds) {
      if (seconds === 10) play("warning");
      if (seconds >= 1 && seconds <= 3) play("tick");
    }
    lastClock = { turn, deadline, seconds };
  }

  function setVolume(name, percentage) {
    volumes[name] = percentage;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(volumes));
    } catch {
      // The current tab can still use the settings if storage is unavailable.
    }
    unlock();
    applyVolumes();
  }

  document.addEventListener("visibilitychange", applyVolumes);
  return { play, unlock, sync, countdown, setVolume, volumes };
}
