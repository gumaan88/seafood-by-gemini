
export type UserRole = 'customer' | 'provider' | 'admin';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  createdAt: number;
}

export type ProviderCategory = 'مطعم' | 'مقهى' | 'ملابس' | 'إلكترونيات' | 'خدمات' | 'أخرى';

export interface ProviderProfile {
  providerId: string; // Same as uid
  name: string;
  description: string;
  category: ProviderCategory;
  followersCount: number;
  imageUrl?: string;
  savedCategories?: string[]; // Custom categories created by provider
}

export type Currency = 'YER' | 'SAR' | 'USD';

export interface CatalogItem {
  id: string;
  providerId: string;
  name: string;
  description: string;
  priceDefault: number;
  currency: Currency; // Added currency
  category: string;
  imageUrl?: string;
  isActive: boolean;
  createdAt?: number;
  // Computed stats fields (optional/runtime)
  stats?: {
    totalSold: number;
    totalRevenue: number;
  };
}

export interface Offering {
  id: string;
  itemId: string;
  providerId: string;
  itemName: string;
  itemImageUrl?: string;
  price: number;
  quantityTotal: number;
  quantityRemaining: number;
  date: string;
  isActive: boolean;
}

export type ReservationStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

export interface Reservation {
  id: string;
  offeringId: string;
  customerId: string;
  providerId: string;
  offeringName: string;
  customerName: string;
  quantity: number;
  totalPrice: number;
  paymentProofUrl?: string;
  paymentReference?: string;
  status: ReservationStatus;
  createdAt: number;
}

export interface Follow {
  id: string;
  customerId: string;
  providerId: string;
}

export interface AppNotification {
  id: string;
  recipientId: string;
  title: string;
  body: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: number;
  link?: string;
}
