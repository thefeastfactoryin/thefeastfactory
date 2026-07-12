export type ApiHealth = {
  status: 'ok';
  service: string;
  timestamp: string;
};

export * from './options';
export * from './constants';

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
  boxPrice: string;
  generalPrice: string;
  isVeg: boolean;
  isActive: boolean;
  imageUrl?: string | null;
  category?: MenuCategory;
};

export type PackageType = 'MEAL_BOX' | 'FIXED_PACKAGE' | 'CUSTOM_PACKAGE';
export type OrderingOfferingCode = 'MEAL_BOX' | 'PACKAGES' | 'CUSTOM_MENU';
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
  centerLatitude: string;
  centerLongitude: string;
  serviceRadiusKm: string;
  deliveryFeePerKm: string;
  isActive: boolean;
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
    publishedAt?: string | null;
  } | null;
};

export type PublicCatalogSettings = {
  minBookingLeadHours: number;
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

export type PackageSelection = {
  selectedItems: Array<{
    categoryId: string;
    menuItemId: string;
    replacedMenuItemId?: string | null;
    role?: SelectedItemRole;
    quantity?: number;
  }>;
};

export type PackageSelectionPrice = {
  valid: boolean;
  errors: string[];
  packageName: string;
  guestCount: number;
  basePerPlatePrice: string;
  totalCustomizationCharges: string;
  finalPerPlatePrice: string;
  region?: OperatingRegion | null;
  distanceKm?: string | null;
  billableDistanceKm?: number | null;
  deliveryFeePerKm?: string | null;
  deliveryFee: string;
  subtotalAmount: string;
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
    totalAdjustmentAmount: string;
  }>;
};

export type CartSummary = {
  id: string;
  packageVersionId: string;
  pendingOrderId?: string | null;
  package: {
    id: string;
    name: string;
    type: PackageType;
    versionNo: number;
    basePricePerPlate: string;
    minGuestCount: number;
    maxGuestCount?: number | null;
  };
  event?: {
    eventName?: string | null;
    eventDate: string;
    eventTimeStart?: string | null;
    guestCount: number;
    address?: UserAddress;
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
    isVeg: boolean;
  }>;
};

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
export type RefundStatus = 'INITIATED' | 'PROCESSING' | 'SUCCESS' | 'FAILED';
export type OrderStatus =
  | 'DRAFT'
  | 'PENDING_PAYMENT'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'READY_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';

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
  orderId: string;
  amount: string;
  paymentStatus: PaymentStatus;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  paymentMethod?: string | null;
  failureReason?: string | null;
  paidAt?: string | null;
  createdAt: string;
  refunds?: RefundSummary[];
};

export type OrderSummary = {
  id: string;
  orderNumber: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  packageName: string;
  guestCount: number;
  regionId?: string | null;
  region?: OperatingRegion | null;
  distanceKm?: string | null;
  deliveryFee?: string;
  totalAmount: string;
  createdAt: string;
  event?: {
    eventName?: string | null;
    eventDate: string;
    eventTimeStart?: string | null;
    address?: UserAddress;
  };
  payments?: PaymentSummary[];
  user?: UserProfile;
};

export type OrderSelectedItem = {
  id: string;
  menuItemId: string;
  menuItemName: string;
  categoryName: string;
  role: SelectedItemRole;
  isVeg: boolean;
  itemPrice: string;
  includedValue: string;
  adjustmentAmount: string;
  quantity: number;
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
};

export type AdminPayment = Omit<PaymentSummary, 'refunds'> & {
  refunds: RefundSummary[];
  order: OrderSummary & { user: UserProfile };
};

export type OrderNote = {
  id: string;
  orderId: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string; role: 'ADMIN' | 'OPERATIONS' };
};

export type OrderDocument = {
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
