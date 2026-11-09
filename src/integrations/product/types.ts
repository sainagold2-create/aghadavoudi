export type CatalogProduct = {
  sku: string;
  title: string;
  activeStock: boolean;
};

export interface ProductService {
  getBySku(sku: string): Promise<CatalogProduct | null>;
  assertCartAddable(sku: string): Promise<CatalogProduct>;
}
