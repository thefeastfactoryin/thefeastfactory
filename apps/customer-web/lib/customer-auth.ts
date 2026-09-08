import { useOrderBuilderStore } from '../store/order-builder.store';
import { useDeliveryLocationStore } from '../store/delivery-location.store';
import { useSessionStore } from '../store/session.store';

export function clearCustomerState() {
  useSessionStore.getState().clear();
  useOrderBuilderStore.getState().reset();
  useDeliveryLocationStore.getState().reset();
}
