// awards.js

class AwardManager {
  constructor(guild) {
    this.guild = guild;
    this.queue = [];
    this.processing = false;
    this.idleResolvers = [];
  }

  /**
   * Enqueue an award update (positive for shoutout, negative for redeem)
   * and process updates serially.
   */
  updateAwards(userId, delta) {
    return new Promise((resolve, reject) => {
      this.queue.push({ userId, delta, resolve, reject });
      this._processQueue();
    });
  }

  /** Wait until the queue is fully drained */
  async whenIdle() {
    if (!this.processing && this.queue.length === 0) return;
    return new Promise((resolve) => this.idleResolvers.push(resolve));
  }

  async _processQueue() {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const { userId, delta, resolve, reject } = this.queue.shift();
      try {
        const result = await this._applyUpdate(userId, delta);
        resolve(result);
      } catch (err) {
        reject(err);
      }
      // small delay to yield and help avoid rate limits
      await new Promise((r) => setTimeout(r, 150));
    }

    this.processing = false;
    while (this.idleResolvers.length) this.idleResolvers.shift()();
  }

  async _applyUpdate(userId, delta) {
    if (typeof delta !== "number" || Number.isNaN(delta)) {
      throw new Error("Delta must be a number");
    }
    if (delta === 0) {
      throw new Error("Delta cannot be zero");
    }

    const me = this.guild.members.me;
    if (!me) throw new Error("Bot member not available");

    const member = await this.guild.members.fetch(userId).catch(() => null);
    if (!member) throw new Error("Member not found");

    // Skip/forbid modifying the guild owner
    if (member.id === member.guild.ownerId) {
      throw new Error("Cannot modify the guild owner");
    }

    // Role hierarchy check: bot must be higher than target member
    if (me.roles.highest.comparePositionTo(member.roles.highest) <= 0) {
      throw new Error("Insufficient role position to modify this member");
    }

    // Parse current count and base from nickname
    let base = member.nickname ?? member.user.username;
    let current = 0;

    // Match optional trophy suffix at end
    const match = base.match(/^(.*?)(?:\s*🏆x(\d+))$/);
    if (match) {
      base = (match[1] || "").trim() || member.user.username;
      current = parseInt(match[2], 10);
    }

    const next = current + delta;
    if (next < 0) {
      throw new Error("Cannot redeem more awards than available");
    }

    // Build new nickname
    let newNick = null;
    if (next > 0) {
      const suffix = ` 🏆x${next}`;
      // Ensure we do not exceed 32-char nickname limit
      const maxBaseLen = 32 - suffix.length;
      const trimmedBase = base.length > maxBaseLen ? base.slice(0, Math.max(0, maxBaseLen)).trim() : base;
      newNick = `${trimmedBase}${suffix}`;
    } else {
      // next === 0 → remove suffix, restore base; set null if equal to username
      newNick = base === member.user.username ? null : base;
    }

    await member.setNickname(newNick);
    return next;
  }
}

export { AwardManager };
