import { ApiRequestError } from '@aranyam/api-client';

const CART_CLEARED_EVENT = 'cart-cleared';
const CART_CLEARED_STORAGE_KEY = 'customer-cart-cleared-at';

export function isClearedCartError(reason: unknown) {
  return (
    reason instanceof ApiRequestError
      ? reason.status === 404
      : reason instanceof Error && reason.message === 'Active cart not found'
  );
}

export function notifyCartCleared() {
  window.localStorage.setItem(CART_CLEARED_STORAGE_KEY, String(Date.now()));
  window.dispatchEvent(new Event(CART_CLEARED_EVENT));
}

export function subscribeToCartCleared(listener: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === CART_CLEARED_STORAGE_KEY) listener();
  };
  window.addEventListener(CART_CLEARED_EVENT, listener);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(CART_CLEARED_EVENT, listener);
    window.removeEventListener('storage', onStorage);
  };
}
