export const eventTypeOptions = [
  'Birthday',
  'Wedding',
  'Engagement',
  'Housewarming',
  'Corporate Event',
  'Anniversary',
  'Baby Shower',
  'Naming Ceremony',
  'Religious Function',
  'Other',
] as const;

export type EventTypeOption = (typeof eventTypeOptions)[number];

export const servingTimePresets = [
  { label: 'Breakfast', time: '08:30' },
  { label: 'Lunch', time: '12:30' },
  { label: 'High Tea', time: '16:30' },
  { label: 'Dinner', time: '19:30' },
  { label: 'Late Night', time: '22:00' },
] as const;

export const indianStateOptions = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
] as const;

export const refundReasonOptions = [
  'Customer request',
  'Event cancelled',
  'Service adjustment',
  'Duplicate payment',
  'Other',
] as const;

export const orderStatusOptions = [
  'PENDING_PAYMENT',
  'CONFIRMED',
  'IN_PROGRESS',
  'READY_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
] as const;

export const adminTransitionOptions = [
  'IN_PROGRESS',
  'READY_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
] as const;

export const paymentStatusOptions = [
  'PENDING',
  'PAID',
  'FAILED',
  'REFUNDED',
] as const;
