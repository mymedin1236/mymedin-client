// Tiny pub/sub store tracking the number of in-flight API requests.
// axios interceptors update it; the GlobalLoader component subscribes to it.
let count = 0;
const listeners = new Set();

const emit = () => {
  const pending = count > 0;
  listeners.forEach((fn) => fn(pending));
};

export const loadingStore = {
  start() {
    count += 1;
    emit();
  },
  done() {
    count = Math.max(0, count - 1);
    emit();
  },
  subscribe(fn) {
    listeners.add(fn);
    fn(count > 0);
    return () => listeners.delete(fn);
  },
};
