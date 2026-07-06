// localStorage: campaign progress + settings.
const KEY = 'ruach-bagiva-save-v1';

const DEFAULTS = {
  unlockedChapter: 1,     // highest playable chapter (1-based)
  completed: [],          // chapter ids finished
  settings: { master: 0.9, music: 0.35, sfx: 0.8, edgePan: true, quality: 'high' },
};

export const Save = {
  data: null,
  load() {
    try {
      this.data = { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY)) ?? {}) };
      this.data.settings = { ...DEFAULTS.settings, ...(this.data.settings ?? {}) };
    } catch { this.data = structuredClone(DEFAULTS); }
    return this.data;
  },
  write() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* private mode */ }
  },
  completeChapter(id, index) {
    if (!this.data.completed.includes(id)) this.data.completed.push(id);
    this.data.unlockedChapter = Math.max(this.data.unlockedChapter, index + 2);
    this.write();
  },
  setSetting(k, v) { this.data.settings[k] = v; this.write(); },
};
