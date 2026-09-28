const CART_CLEARED_EVENT = 'cart-cleared';
const CART_CLEARED_STORAGE_KEY = 'customer-cart-cleared-at';

export function isClearedCartError(reason: unknown) {
  if (!(reason instanceof Error) || reason.message !== 'Active cart not found')
    return false;
  if ('status' in reason) return reason.status === 404;
  return true;
}

export function notifyCartCleared() {
  window.localStorage.setItem(CART_CLEARED_STORAGE_KEY, String(Date.now()));
  window.dispatchEvent(new Event(CART_CLEARED_EVENT));
}

export function subscribeToCartCleared(
  listener: (source: 'local' | 'storage') => void,
) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === CART_CLEARED_STORAGE_KEY) listener('storage');
  };
  const onLocal = () => listener('local');
  window.addEventListener(CART_CLEARED_EVENT, onLocal);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(CART_CLEARED_EVENT, onLocal);
    window.removeEventListener('storage', onStorage);
  };
}
