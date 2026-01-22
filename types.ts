
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
  category: ProviderCategory; // New field
  followersCount: number;
  imageUrl?: string;
}

export interface CatalogItem {
  id: string;
  providerId: string;
  name: string;
  description: string;
  priceDefault: number;
  category: string; // Free text defined by provider (e.g. "Main Course", "Shoes")
  imageUrl?: string;
  isActive: boolean;
}

export interface Offering {
  id: string;
  itemId: string;
  providerId: string;
  itemName: string; // Denormalized for easier display
  itemImageUrl?: string; // Denormalized
  price: number;
  quantityTotal: number;
  quantityRemaining: number;
  date: string; // ISO Date string YYYY-MM-DD
  isActive: boolean;
}

export type ReservationStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

export interface Reservation {
  id: string;
  offeringId: string;
  customerId: string;
  providerId: string;
  offeringName: string; // Denormalized
  customerName: string; // Denormalized
  quantity: number;
  totalPrice: number;
  paymentProofUrl?: string; // Legacy support
  paymentReference?: string; // New text based payment
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
  createdAt: number; // Timestamp
  link?: string;
}
