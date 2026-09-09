export type User = {
    email: string;
    password: string;
    id: number;
    name: string;
    last_name: string;
    state: boolean;
    phone: string;
}
export type Services = {
    id: string
    name: string
    catalog: number
}
export type Catalog = {
    id: string
    name: string
    business: number
}