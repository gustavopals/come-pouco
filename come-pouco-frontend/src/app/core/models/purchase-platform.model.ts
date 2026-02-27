export interface PurchasePlatform {
  id: number;
  name: string;
  description: string;
  isActive: boolean;
  apiLink: string;
  accessKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePurchasePlatformPayload {
  name: string;
  description: string;
  isActive: boolean;
  apiLink: string;
  accessKey: string;
}

export interface UpdatePurchasePlatformPayload {
  name?: string;
  description?: string;
  isActive?: boolean;
  apiLink?: string;
  accessKey?: string;
}
