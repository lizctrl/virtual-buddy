export type User = {
    name: string,
    email: string,
    last_name: string,
    state: boolean,
    phone: string,
    password: string,
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