// @flow

/*
 * A simple abstraction over 'localStorage' to provide transparent JSON
 * serialization and deserialization.
 *
 * The implementation is borrowed heavily from Khan Academy's LocalStore
 * module, and also KaVideoPlayer's SafeLocalStore module.
 */
export default {
  // Bump this to expire all old values.
  version: 1,
  keyPrefix: "artifact-editor",

  cacheKey(key: string): string {
    if (!key) {
      throw new Error("Falsy key provided to cacheKey: " + key);
    }
    return [this.keyPrefix, this.version, key].join(":");
  },

  get(key: string, whenUnavailable: any): any {
    if (!this.isEnabled()) {
      return whenUnavailable;
    }
    try {
      const data = window.localStorage[this.cacheKey(key)];
      if (data) {
        return JSON.parse(data);
      } else {
        return whenUnavailable;
      }
    } catch (e) {
      // If we had trouble retrieving, like FF's NS_FILE_CORRUPTED:
      // http://stackoverflow.com/q/18877643/
      return whenUnavailable;
    }
  },

  set(key: string, data: any): void {
    if (!this.isEnabled()) {
      return;
    }
    const stringified = JSON.stringify(data);

    try {
      window.localStorage[this.cacheKey(key)] = stringified;
    } catch (e) {
      // Probably went over the storage limit...that's not good.
      throw e;
    }
  },

  /*
     * Delete whatever data was associated with the given key.
     */
  del(key: string): void {
    if (!this.isEnabled()) {
      return;
    }
    const cacheKey = this.cacheKey(key);
    if (cacheKey in window.localStorage) {
      // (IE throws when deleting a non-existent entry.)
      delete window.localStorage[cacheKey];
    }
  },

  /*
     * Local storage might be disabled in old browsers
     * or in Safari's private browsing mode.
     * Don't die.
     */
  isEnabled(): boolean {
    const uid = String(+new Date());
    try {
      window.sessionStorage[uid] = uid;
      const enabled = window.sessionStorage[uid] === uid;
      window.sessionStorage.removeItem(uid);
      return enabled;
    } catch (e) {
      return false;
    }
  },
};
