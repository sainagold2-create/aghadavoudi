export type AccountCustomer = {
  id: string;
  phone: string;
  name: string | null;
};

export interface AccountService {
  findOrCreateByPhone(phone: string, name?: string | null): Promise<AccountCustomer>;
  getById(id: string): Promise<AccountCustomer | null>;
  getByPhone(phone: string): Promise<AccountCustomer | null>;
}
