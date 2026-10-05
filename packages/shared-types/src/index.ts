export type ApiHealth = {
  status: 'ok';
  service: string;
  timestamp: string;
};

export * from './options';
export * from './constants';
export * from './time';

export type Money = {
  amount: string;
  currency: 'INR';
};

export type PaginatedResponse<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type CustomerSession = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    mobileNumber: string;
    name?: string | null;
    email?: string | null;
  };
};

export type UserProfile = CustomerSession['user'];

export type AddressType = 'HOME' | 'OFFICE' | 'EVENT_VENUE' | 'OTHER';

export type UserAddress = {
  id: string;
  addressType: AddressType;
  label?: string | null;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  pincode: string;
  landmark?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminSession = {
  accessToken: string;
  refreshToken: string;
  admin: {
    id: string;
    email: string;
    name: string;
    role: 'ADMIN' | 'OPERATIONS';
    regionId?: string | null;
    region?: OperatingRegion | null;
  };
};

export type AdminProfile = AdminSession['admin'];

export type MenuCategory = {
  id: string;
  name: string;
  description?: string | null;
  displayOrder: number;
  isActive: boolean;
};

export type MenuItem = {
  id: string;
  categoryId: string;
  name: string;
  description?: string | null;
  orderByKgDetails?: string | null;
  boxPrice: string;
  generalPrice: string;
  pricePerKg?: string | null;
  isVeg: boolean;
  isActive: boolean;
  imageUrl?: string | null;
  category?: MenuCategory;
};

export type PackageType =
  | 'MEAL_BOX'
  | 'FIXED_PACKAGE'
  | 'CUSTOM_PACKAGE'
  | 'ORDER_BY_KG';
export type DeliveryServiceType = 'STANDARD' | 'DOORSTEP' | 'ASSISTED';
export type OrderingOfferingCode =
  | 'MEAL_BOX'
  | 'PACKAGES'
  | 'CUSTOM_MENU'
  | 'ORDER_BY_KG';
export type OrderingOffering = {
  id: string;
  code: OrderingOfferingCode;
  title: string;
  description: string;
  imageUrl?: string | null;
  ctaLabel?: string | null;
  displayOrder: number;
  isActive: boolean;
};
export type PackageMenuItemRole = 'INCLUDED' | 'EXTRA' | 'CUSTOM_SELECTABLE';
export type SelectedItemRole = 'INCLUDED' | 'SWAP' | 'EXTRA' | 'CUSTOM';

export type OperatingRegion = {
  id: string;
  code: string;
  name: string;
  kitchenAddress?: string | null;
  fssaiLicenseNo?: string | null;
  kitchenImageUrl?: string | null;
  mapUrl?: string | null;
  publicDisplayOrder: number;
  centerLatitude: string;
  centerLongitude: string;
  serviceRadiusKm: string;
  deliveryFeePerKm: string;
  minBookingLeadHours: number;
  isActive: boolean;
  isAcceptingOrders: boolean;
};

export type LocationResolution = {
  serviceable: boolean;
  reason: 'KITCHEN_CLOSED' | 'OUTSIDE_SERVICE_AREA' | null;
  region: OperatingRegion | null;
  distanceKm: string | null;
};

export type PackageSummary = {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  badgeLabel?: string | null;
  displayOrder: number;
  type: PackageType;
  isCustom: boolean;
  isFeatured: boolean;
  featuredOrder?: number | null;
  activeVersion?: {
    id: string;
    versionNo: number;
    basePricePerPlate: string;
    minGuestCount: number;
    maxGuestCount?: number | null;
    kgDefaultWeightGrams: number;
    kgWeightIncrementGrams: number;
    publishedAt?: string | null;
  } | null;
};

export type PublicCatalogSettings = {
  eventServiceStartTime: string;
  eventServiceEndTime: string;
  eventTimeIntervalMinutes: number;
  business: {
    legalName: string | null;
    tradeName: string | null;
    address: string | null;
    gstin: string | null;
    supportEmail: string | null;
    supportPhone: string | null;
  };
};

export type PackagePreviewQuoteRequest = PackageSelection & {
  guestCount: number;
};

export type PackageConfiguration = {
  id: string;
  packageId: string;
  packageName: string;
  packageType: PackageType;
  isCustom: boolean;
  versionNo: number;
  basePricePerPlate: string;
  minGuestCount: number;
  maxGuestCount?: number | null;
  kgDefaultWeightGrams: number;
  kgWeightIncrementGrams: number;
  categoryRules: Array<{
    id: string;
    category: MenuCategory;
    minSelections: number;
    maxSelections: number;
    isMandatory: boolean;
    items: Array<
      MenuItem & {
        isAvailable?: boolean;
        role?: PackageMenuItemRole;
        isSwappable?: boolean;
        swapForMenuItemId?: string | null;
        swapForMenuItemName?: string | null;
        itemPrice: string;
        includedValue: string;
        adjustmentAmount: string;
      }
    >;
  }>;
};

export type KgRegionAvailability = {
  region: OperatingRegion;
  isAvailable: boolean;
  items: Array<{
    packageMenuItemId: string;
    menuItemId: string;
    menuItemName: string;
    categoryName: string;
    pricePerKg?: string | null;
    isAvailable: boolean;
  }>;
};

export type PackageSelection = {
  selectedItems: Array<{
    categoryId: string;
    menuItemId: string;
    replacedMenuItemId?: string | null;
    role?: SelectedItemRole;
    quantity?: number;
    weightGrams?: number | null;
  }>;
};

export type CutleryItem = {
  id: string;
  name: string;
  extraLabel?: string | null;
  description?: string | null;
  unitLabel: string;
  unitPrice: string;
  includedQuantity: number;
  imageUrl?: string | null;
  displayOrder: number;
  isActive: boolean;
  quantity?: number;
  lineTotal?: string;
};

export type PackageSelectionPrice = {
  valid: boolean;
  errors: string[];
  packageName: string;
  packageType?: PackageType;
  guestCount: number | null;
  basePerPlatePrice: string | null;
  totalCustomizationCharges: string | null;
  finalPerPlatePrice: string | null;
  region?: OperatingRegion | null;
  distanceKm?: string | null;
  billableDistanceKm?: number | null;
  deliveryFeePerKm?: string | null;
  deliveryFee: string;
  deliveryServiceType: DeliveryServiceType;
  helperCount: number;
  baseDeliveryFee?: string;
  serviceAddon?: string;
  subtotalAmount: string;
  cutleryIncludedCount?: number;
  cutleryExtraCount?: number;
  cutleryUnitPrice?: string;
  cutleryTotal?: string;
  cutleryItems?: CutleryItem[];
  totalAmount: string;
  items: Array<{
    categoryId: string;
    categoryName: string;
    menuItemId: string;
    replacedMenuItemId?: string | null;
    replacedMenuItemName?: string | null;
    role?: SelectedItemRole;
    menuItemName: string;
    itemPrice: string;
    includedValue: string;
    adjustmentAmount: string;
    quantity: number;
    weightGrams?: number | null;
    pricePerKg?: string | null;
    lineTotal?: string | null;

    totalAdjustmentAmount: string;
  }>;
};

export type CartSummary = {
  id: string;
  packageVersionId: string;
  guestCount?: number | null;
  status?: string;
  expiresAt?: string | null;
  lastQuotedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  paymentTryCount?: number;
  specialNotes?: string | null;
  contactNumber: string;
  deliveryServiceType: DeliveryServiceType;
  helperCount: number;
  cutleryIncludedCount: number;
  cutleryExtraCount: number;
  cutleryUnitPrice: string;
  cutleryItems?: CutleryItem[];
  address?: UserAddress | null;
  package: {
    id: string;
    name: string;
    imageUrl?: string | null;
    type: PackageType;
    versionNo: number;
    basePricePerPlate: string;
    minGuestCount: number;
    maxGuestCount?: number | null;
  };
  region?: OperatingRegion | null;
  event?: {
    eventName?: string | null;
    eventDate: string;
    eventTimeStart?: string | null;
    guestCount: number | null;
    address?: UserAddress;
    region?: OperatingRegion | null;
    distanceKm?: string | null;
    deliveryFee?: string | null;
    cutleryIncludedCount?: number;
    cutleryExtraCount?: number;
    cutleryUnitPrice?: string;
  } | null;
  items: Array<{
    id: string;
    categoryId: string;
    categoryName: string;
    menuItemId: string;
    menuItemName: string;
    replacedMenuItemId?: string | null;
    replacedMenuItemName?: string | null;
    role: SelectedItemRole;
    quantity: number;
    weightGrams?: number | null;
    pricePerKg?: string | null;
    lineTotal?: string | null;

    isVeg: boolean;
  }>;
};

export type PaymentStatus =
  | 'UNPAID'
  | 'PENDING'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'FAILED'
  | 'REFUND_PENDING'
  | 'REFUND_FAILED'
  | 'REFUNDED'
  | 'VOIDED';
export type PaymentPlan = 'FULL' | 'HALF' | 'PAY_LATER';
export type PaymentSource = 'RAZORPAY' | 'MANUAL';
export type RefundStatus = 'INITIATED' | 'PROCESSING' | 'SUCCESS' | 'FAILED';
export type OrderStatus =
  | 'DRAFT'
  | 'PENDING_PAYMENT'
  | 'AWAITING_APPROVAL'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'READY_FOR_DELIVERY'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'DECLINED'
  | 'CANCELLED';
export type BookingStatus =
  | 'PENDING_PAYMENT'
  | 'AWAITING_APPROVAL'
  | 'CONFIRMED'
  | 'DECLINED'
  | 'CANCELLED'
  | 'COMPLETED'
  | 'NEEDS_REVIEW';
export type BookingFulfilmentStatus =
  | 'NOT_STARTED'
  | 'PREPARING'
  | 'READY_FOR_DELIVERY'
  | 'OUT_FOR_DELIVERY'
  | 'COMPLETED';

export type RefundSummary = {
  id: string;
  amount: string;
  refundStatus: RefundStatus;
  reason?: string | null;
  razorpayRefundId?: string | null;
  initiatedAt: string;
  processedAt?: string | null;
};

export type PaymentSummary = {
  id: string;
  bookingId: string;
  amount: string;
  paymentStatus: PaymentStatus;
  source?: PaymentSource;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  paymentMethod?: string | null;
  externalReference?: string | null;
  notes?: string | null;
  failureReason?: string | null;
  paidAt?: string | null;
  createdAt: string;
  refunds?: RefundSummary[];
};

export type OrderSummary = {
  id: string;
  bookingId?: string | null;
  orderNumber: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentPlan: PaymentPlan;
  declineReason?: string | null;
  packageName: string;
  packageImageUrl?: string | null;
  packageType?: PackageType | null;
  guestCount: number | null;
  contactNumber: string;
  regionId?: string | null;
  region?: OperatingRegion | null;
  distanceKm?: string | null;
  deliveryFee?: string;
  deliveryServiceType?: DeliveryServiceType;
  helperCount?: number;
  cutleryIncludedCount?: number;
  cutleryExtraCount?: number;
  cutleryUnitPrice?: string;
  cutleryTotal?: string;
  cutleryItems?: Array<{
    id: string;
    itemName: string;
    unitLabel: string;
    includedQuantity: number;
    extraQuantity: number;
    unitPrice: string;
    lineTotal: string;
    imageUrl?: string | null;
  }>;
  totalAmount: string;
  createdAt: string;
  specialNotes?: string | null;
  event?: {
    eventName?: string | null;
    eventDate: string;
    eventTimeStart?: string | null;
    address?: UserAddress;
  };
  user?: UserProfile;
};

export type OrderSelectedItem = {
  id: string;
  menuItemId: string;
  menuItemName: string;
  replacedMenuItemId?: string | null;
  replacedMenuItemName?: string | null;
  categoryName: string;
  role: SelectedItemRole;
  isVeg: boolean;
  itemPrice: string;
  includedValue: string;
  adjustmentAmount: string;
  quantity: number;
  weightGrams?: number | null;
  pricePerKg?: string | null;
  lineTotal?: string | null;
  totalAdjustmentAmount?: string;
};

export type OrderStatusEntry = {
  id: string;
  fromStatus?: OrderStatus | null;
  toStatus: OrderStatus;
  notes?: string | null;
  changedAt: string;
};

export type OrderDetails = OrderSummary & {
  selectedItems: OrderSelectedItem[];
  statusHistory: OrderStatusEntry[];
  user: UserProfile;
};

export type GatewayOrder = {
  paymentId: string;
  keyId: string;
  id: string;
  amount: number;
  currency: string;
  localMode: boolean;
  reused: boolean;
  bookingId?: string;
};

export type BookingStatusEntry = {
  id: string;
  fromStatus?: BookingStatus | null;
  toStatus: BookingStatus;
  notes?: string | null;
  changedAt: string;
};

export type BookingFulfilmentEntry = {
  id: string;
  fromStatus?: BookingFulfilmentStatus | null;
  toStatus: BookingFulfilmentStatus;
  notes?: string | null;
  changedAt: string;
};

export type BookingSummary = {
  id: string;
  bookingNumber: string;
  status: BookingStatus;
  fulfilmentStatus: BookingFulfilmentStatus;
  paymentStatus: PaymentStatus;
  paymentPlan: PaymentPlan;
  eventName?: string | null;
  eventDate: string;
  eventTimeStart?: string | null;
  contactNumber: string;
  regionId?: string | null;
  region?: OperatingRegion | null;
  distanceKm?: string | null;
  deliveryFee: string;
  deliveryServiceType: DeliveryServiceType;
  helperCount: number;
  itemsSubtotal: string;
  cutleryTotal: string;
  totalAmount: string;
  amountPaid: string;
  balanceDue: string;
  refundedAmount: string;
  declineReason?: string | null;
  specialNotes?: string | null;
  migrationNeedsReview?: boolean;
  createdAt: string;
  user?: UserProfile;
  addressSnapshot: {
    label?: string | null;
    addressLine1: string;
    addressLine2?: string | null;
    city: string;
    state: string;
    pincode: string;
    landmark?: string | null;
    latitude?: string | null;
    longitude?: string | null;
  };
  orders: OrderSummary[];
  payments?: PaymentSummary[];
  statusHistory?: BookingStatusEntry[];
  fulfilmentHistory?: BookingFulfilmentEntry[];
};

export type BookingDetails = BookingSummary;

export type AdminPayment = Omit<PaymentSummary, 'refunds'> & {
  refunds: RefundSummary[];
  booking: {
    id: string;
    bookingNumber: string;
    status: BookingStatus;
    user: UserProfile;
    region?: OperatingRegion | null;
  };
};

export type BookingNote = {
  id: string;
  bookingId: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string; role: 'ADMIN' | 'OPERATIONS' };
};

export type BookingDocument = {
  id: string;
  documentType: 'PAYMENT_RECEIPT' | 'GST_INVOICE' | 'REFUND_CREDIT_NOTE';
  documentNumber: string;
  generatedAt: string;
};

export type IntegrationReadiness = {
  razorpay: boolean;
  msg91: boolean;
  cloudflareR2: boolean;
  googleMaps: 'configured-client-side';
  resend: 'deferred';
  sentry: 'deferred';
};
export type { components, operations, paths } from './generated-api';
