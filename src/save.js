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
    // shape validation — corrupt saves must never crash menus
    if (!Array.isArray(this.data.completed)) this.data.completed = [];
    if (!Number.isFinite(this.data.unlockedChapter) || this.data.unlockedChapter < 1) this.data.unlockedChapter = 1;
    if (typeof this.data.settings !== 'object' || this.data.settings === null) this.data.settings = structuredClone(DEFAULTS.settings);
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
