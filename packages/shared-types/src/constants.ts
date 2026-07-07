export const appBrand = {
  name: 'The Feast Factory',
  tagline: 'Celebrations, served',
  logoInitial: 'F',
  color: '#7A1F2B',
  currencyCode: 'INR',
  currencySymbol: '₹',
  countryDialCode: '+91',
  defaultGuestRangeLabel: '10 to 500+',
  defaultMinGuestCount: 10,
  defaultMaxGuestCountLabel: '500+',
  defaultBookingLeadHours: 48,
} as const;

export const businessInfo = {
  legalName: 'The Feast Factory Foods Private Limited',
  tradeName: appBrand.name,
  address: 'Hyderabad, Telangana, India',
  gstin: 'GSTIN to be updated',
  registrationNumber: 'Business registration to be updated',
  supportEmail: 'support@thefeastfactory.in',
  supportPhone: '+91 90000 00000',
  supportHours: '10:00 AM to 8:00 PM IST',
  socials: [
    { label: 'Instagram', href: 'https://instagram.com/thefeastfactory' },
    { label: 'Facebook', href: 'https://facebook.com/thefeastfactory' },
  ],
} as const;

export const customerNavigation = [
  { href: '/', label: 'Home' },
  { href: '/menu', label: 'Menu' },
  { href: '/packages', label: 'Packages' },
  { href: '/orders', label: 'Orders' },
] as const;

export const footerNavigation = [
  { href: '/about', label: 'About' },
  { href: '/faq', label: 'FAQ' },
  { href: '/contact', label: 'Contact' },
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/cancellation-policy', label: 'Cancellation' },
] as const;

export const statusLabels = {
  order: {
    DRAFT: 'Draft',
    PENDING_PAYMENT: 'Awaiting Payment',
    CONFIRMED: 'Confirmed',
    IN_PROGRESS: 'In Preparation',
    READY_FOR_DELIVERY: 'Ready for Delivery',
    DELIVERED: 'Delivered',
    CANCELLED: 'Cancelled',
  },
  payment: {
    PENDING: 'Payment Pending',
    PAID: 'Paid',
    FAILED: 'Failed',
    REFUNDED: 'Refunded',
  },
  refund: {
    INITIATED: 'Refund Initiated',
    PROCESSING: 'Refund Processing',
    SUCCESS: 'Refund Complete',
    FAILED: 'Refund Failed',
  },
  document: {
    PAYMENT_RECEIPT: 'Payment Receipt',
    GST_INVOICE: 'GST Invoice',
    REFUND_CREDIT_NOTE: 'Refund Credit Note',
  },
} as const;

export const customerCopy = {
  common: {
    loadingOrder: 'Loading order...',
    documentUnavailable:
      'Documents become available after payment confirmation.',
    retryPayment:
      'Payment failed. You can retry without creating another order.',
    paymentWindowLoading:
      'Secure payment window is still loading. Please try again.',
    paymentWindowClosed:
      'Payment window closed. Your order is still saved and you can retry safely.',
  },
  checkout: {
    brandDescriptionFallback: 'Catering',
    secureCheckout: 'Secure checkout',
    reviewTitle: 'One final review.',
    customQuote:
      'Your quote is calculated from selected item prices and saved as an order snapshot.',
    packageQuote:
      'Your quote is calculated from the live package rules and saved as an order snapshot.',
    paySecurely: 'Pay securely',
    openingPayment: 'Opening payment...',
    paymentHandled: 'Payment details are handled securely by Razorpay.',
    orderConfirmed: 'Your order is confirmed only after payment verification.',
  },
  booking: {
    leadTimeHint: (hours: number) =>
      `Bookings need at least ${hours} hours of lead time.`,
    leadTimeShort: (hours: number) => `At least ${hours} hours advance booking`,
  },
  order: {
    trackingEyebrow: 'Order tracking',
    selectedMenu: 'Selected menu',
    progress: 'Progress',
    receipts: 'Receipts and invoices',
    refundStatus: 'Refund status',
    eventTiming: 'Event timing',
    cancelOrder: 'Cancel order',
    cancellationReason: 'Reason for cancellation',
    cancellationPlaceholder:
      'Tell us why you need to cancel this catering order',
    cancellationSubmit: 'Confirm cancellation',
    cancellationSubmitting: 'Cancelling...',
    cancellationUnavailable:
      'This order can no longer be cancelled from your account.',
    cancellationPolicyLink: 'Review cancellation policy',
    reorder: 'Re-order',
    reorderUnavailable:
      'This package or menu may have changed. Please choose a fresh package.',
    noRefunds: 'No refunds have been initiated for this order.',
  },
} as const;

export const adminCopy = {
  navigation: {
    dashboard: 'Dashboard',
    homePage: 'Home page',
    operations: 'Operations',
    orders: 'Orders',
    menu: 'Menu',
    packages: 'Packages',
    payments: 'Payments',
    reports: 'Reports',
    customers: 'Customers',
    adminUsers: 'Admin Users',
    settings: 'Settings',
  },
  reports: {
    title: 'Reports',
    dateFrom: 'From',
    dateTo: 'To',
    region: 'Region',
    applyFilters: 'Apply filters',
    exportOrders: 'Export orders CSV',
    exportPayments: 'Export payments CSV',
    exportReports: 'Export report CSV',
    popularDishes: 'Popular dishes',
  },
  customers: {
    title: 'Customer lookup',
    searchPlaceholder: 'Search by mobile number or name',
    empty: 'Search for a customer to view profile, addresses, and orders.',
  },
  adminUsers: {
    title: 'Admin user management',
    create: 'Create admin user',
    save: 'Save admin user',
    deactivate: 'Deactivate',
    activate: 'Activate',
  },
} as const;

export const legalPages = {
  about: {
    title: 'About Us',
    eyebrow: 'Our kitchen',
    summary:
      'The Feast Factory prepares event-ready catering for celebrations, family gatherings, and business occasions across our service regions.',
    sections: [
      {
        title: 'Food for important days',
        body: 'Our menus are planned for real events: dependable quantities, familiar flavours, flexible packages, and an operations team that understands serving timelines.',
      },
      {
        title: 'Prepared with accountability',
        body: 'Every confirmed order keeps a snapshot of menu, pricing, delivery details, and customer preferences so our kitchen and operations teams work from the same plan.',
      },
    ],
  },
  faq: {
    title: 'Help & FAQ',
    eyebrow: 'Support',
    summary:
      'Answers to common questions about booking, payment, delivery, changes, and support.',
    sections: [
      {
        title: 'How early should I book?',
        body: `Please book at least ${appBrand.defaultBookingLeadHours} hours before your event unless the platform shows a different lead time.`,
      },
      {
        title: 'Can I change my menu after booking?',
        body: 'Contact support as early as possible. Changes depend on kitchen readiness, ingredient availability, and the event date.',
      },
      {
        title: 'How do I get help with an order?',
        body: `Reach us at ${businessInfo.supportPhone} or ${businessInfo.supportEmail} during support hours.`,
      },
    ],
  },
  contact: {
    title: 'Contact Us',
    eyebrow: 'We are here to help',
    summary:
      'For booking questions, order changes, payment help, or event-day coordination, contact our support team.',
    sections: [
      {
        title: 'Phone',
        body: `${businessInfo.supportPhone} (${businessInfo.supportHours})`,
      },
      { title: 'Email', body: businessInfo.supportEmail },
      { title: 'Office', body: businessInfo.address },
    ],
  },
  terms: {
    title: 'Terms of Service',
    eyebrow: 'Legal',
    summary:
      'These terms explain the basic conditions for using the platform and placing catering orders.',
    sections: [
      {
        title: 'Orders and payment',
        body: 'Orders are confirmed only after successful payment verification. Prices, menus, delivery fees, and taxes are captured in the order snapshot at checkout.',
      },
      {
        title: 'Customer responsibility',
        body: 'Customers are responsible for accurate event details, venue address, contact information, guest count, and access instructions.',
      },
      {
        title: 'Service changes',
        body: 'We may contact you if an item, delivery detail, or operational constraint needs adjustment before the event.',
      },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    eyebrow: 'Legal',
    summary:
      'This policy explains the customer information we collect to operate catering orders and support.',
    sections: [
      {
        title: 'Information collected',
        body: 'We collect mobile number, OTP verification records, profile details, addresses, event information, order selections, payments, and support interactions.',
      },
      {
        title: 'How it is used',
        body: 'Information is used to authenticate customers, price orders, coordinate delivery, generate receipts, provide support, and meet legal or tax obligations.',
      },
      {
        title: 'Support',
        body: `For privacy questions, contact ${businessInfo.supportEmail}.`,
      },
    ],
  },
  cancellation: {
    title: 'Cancellation Policy',
    eyebrow: 'Policy',
    summary:
      'Cancellation eligibility depends on order status, event date, kitchen preparation, and payment/refund state.',
    sections: [
      {
        title: 'Customer cancellations',
        body: 'Eligible orders can be cancelled from the order detail page before the order reaches final preparation or delivery stages.',
      },
      {
        title: 'Refund handling',
        body: 'Refunds, when applicable, are processed back through the original payment method and shown on the order detail page.',
      },
      {
        title: 'Need help?',
        body: `Contact ${businessInfo.supportPhone} or ${businessInfo.supportEmail} for cancellation questions.`,
      },
    ],
  },
} as const;
