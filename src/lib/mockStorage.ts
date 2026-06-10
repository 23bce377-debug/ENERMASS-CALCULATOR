if (typeof window === 'undefined') {
  try {
    Object.defineProperty(globalThis, 'localStorage', {
      get() {
        return undefined;
      },
      configurable: true,
    });
  } catch (e) {
    // Ignore configuration errors if any
  }
}
export {};
