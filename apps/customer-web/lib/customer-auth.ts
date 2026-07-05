import { useOrderBuilderStore } from '../store/order-builder.store';
import { useSessionStore } from '../store/session.store';

export function clearCustomerState() {
  useSessionStore.getState().clear();
  useOrderBuilderStore.getState().reset();
}
