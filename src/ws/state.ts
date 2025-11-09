// simple in-memory ring buffer per order (last 10 messages)
type Msg = Record<string, any>;
const store = new Map<string, Msg[]>();

export function pushStatus(orderId: string, msg: Msg) {
  const arr = store.get(orderId) ?? [];
  arr.push(msg);
  if (arr.length > 10) arr.shift();
  store.set(orderId, arr);
}

export function getStatuses(orderId: string): Msg[] {
  return store.get(orderId)?.slice() ?? [];
}

export function clearStatuses(orderId: string) {
  store.delete(orderId);
}
