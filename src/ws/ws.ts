type Listener = (data: any) => void;

// orderId -> Set<Listener>
const listeners = new Map<string, Set<Listener>>();

export function subscribe(orderId: string, fn: Listener) {
  if (!listeners.has(orderId)) listeners.set(orderId, new Set());
  listeners.get(orderId)!.add(fn);
  return () => {
    const set = listeners.get(orderId);
    if (!set) return;
    set.delete(fn);
    if (set.size === 0) listeners.delete(orderId);
  };
}

// IMPORTANT: never throw from publish (so worker doesn't fail)
export function publish(orderId: string, data: any) {
  const set = listeners.get(orderId);
  if (!set || set.size === 0) return;
  // copy to avoid mutation during iteration
  for (const fn of Array.from(set)) {
    try {
      fn(data);
    } catch {
      // swallow listener errors; this is a notification bus
      // you can log here if you want, but DO NOT throw
    }
  }
}
