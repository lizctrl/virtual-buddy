import { NextRequest } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@/app/types/types";
import { prisma } from "@/app/lib/db";
import { toTimeOfDay } from "@/app/lib/api/times";
import { getCurrentUser, hashPassword } from "@/app/lib/auth";
import * as appointments from "@/app/api/v1/appointment/route";
import * as appointmentById from "@/app/api/v1/appointment/[appointmentId]/route";
import * as login from "@/app/api/v1/auth/login/route";
import * as register from "@/app/api/v1/auth/register/route";
import * as businesses from "@/app/api/v1/business/route";
import * as businessById from "@/app/api/v1/business/[businessId]/route";
import * as notifications from "@/app/api/v1/notification/route";
import * as notificationById from "@/app/api/v1/notification/[notificationId]/route";
import * as catalogs from "@/app/api/v1/catalog/route";
import * as catalogById from "@/app/api/v1/catalog/[catalogId]/route";
import * as inventories from "@/app/api/v1/inventory/route";
import * as inventoryById from "@/app/api/v1/inventory/[inventoryId]/route";
import * as items from "@/app/api/v1/item/route";
import * as itemById from "@/app/api/v1/item/[itemId]/route";
import * as serviceById from "@/app/api/v1/service/[serviceId]/route";
import * as slots from "@/app/api/v1/service/[serviceId]/slots/route";
import * as users from "@/app/api/v1/user/route";
import * as userById from "@/app/api/v1/user/[userId]/route";

vi.mock("@/app/lib/auth", async original => ({ ...await original<object>(), getCurrentUser: vi.fn() }));
const signIn = (user: User | null) => vi.mocked(getCurrentUser).mockResolvedValue(user);

function req(path: string, method = "GET", body?: unknown) {
    return new NextRequest(`http://test${path}`, { method, ...(body !== undefined && { body: JSON.stringify(body) }) });
}
const ctx = <K extends string>(key: K, id: number) => ({ params: Promise.resolve({ [key]: String(id) } as Record<K, string>) });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const call = (handler: (...args: any[]) => Promise<Response>, ...args: unknown[]) => handler(...args);

let ownerA: User, ownerB: User, client: User;
let bizA: number, bizB: number, catalogB: number, serviceB: number, invA: number, invB: number, itemA: number, itemB: number, appointmentB: number;

async function user(email: string): Promise<User> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...rest } = await prisma.user.create({
        data: { name: email, last_name: "Test", email, phone: "8888-0000", password: "x", state: true }
    });
    return rest as User;
}

beforeAll(async () => {
    const tables = await prisma.$queryRaw<{ tablename: string }[]>`
        SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
    await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map(t => `"${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);

    [ownerA, ownerB, client] = await Promise.all([user("a@test"), user("b@test"), user("client@test")]);
    bizA = (await prisma.business.create({ data: { name: "A", description: "", ownerId: ownerA.id } })).id;
    bizB = (await prisma.business.create({ data: { name: "B", description: "", ownerId: ownerB.id } })).id;
    catalogB = (await prisma.catalog.create({ data: { name: "Cat B", businessId: bizB } })).id;
    serviceB = (await prisma.service.create({ data: { name: "Uñas", catalogId: catalogB, durationMinutes: 30 } })).id;
    await prisma.workingHours.createMany({
        data: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map(weekDay => ({
            weekDay, serviceId: serviceB, startTime: toTimeOfDay("08:00")!, endTime: toTimeOfDay("18:00")!
        }))
    });
    invA = (await prisma.inventory.create({ data: { businessId: bizA } })).id;
    invB = (await prisma.inventory.create({ data: { businessId: bizB } })).id;
    itemA = (await prisma.item.create({ data: { name: "Lima", description: "", cost: 1, quantity: 1, inventoryId: invA } })).id;
    itemB = (await prisma.item.create({ data: { name: "Esmalte", description: "", cost: 1, quantity: 1, inventoryId: invB } })).id;
    appointmentB = (await prisma.appointment.create({
        data: { userId: client.id, serviceId: serviceB, status: "confirmed", dueDate: new Date(Date.now() + 90 * 864e5) }
    })).id;
});

describe("owner A cannot touch business B", () => {
    beforeEach(() => signIn(ownerA));

    it("catalog", async () => {
        expect((await call(catalogs.POST, req("/catalog", "POST", { name: "x", businessId: bizB }))).status).toBe(404);
        expect((await call(catalogById.PUT, req("/catalog", "PUT", { name: "x" }), ctx("catalogId", catalogB))).status).toBe(404);
        expect((await call(catalogById.DELETE, req("/catalog", "DELETE"), ctx("catalogId", catalogB))).status).toBe(404);
        expect(await prisma.catalog.findUnique({ where: { id: catalogB } })).toMatchObject({ name: "Cat B", state: true });
        expect((await call(catalogs.POST, req("/catalog", "POST", { name: "mine", businessId: bizA }))).status).toBe(200);
        expect((await call(catalogById.GET, req("/c?business=true"), ctx("catalogId", catalogB))).status).toBe(404);
        const list = await (await call(catalogs.GET, req(`/catalog?businessId=${bizB}&state=true`))).json();
        expect(list.data.catalogs).toEqual([]);
        signIn(null);
        expect((await call(catalogs.GET, req("/catalog?state=true"))).status).toBe(401);
    });

    it("business and service", async () => {
        expect((await call(businessById.PATCH, req("/b", "PATCH", { cantonCode: null }), ctx("businessId", bizB))).status).toBe(404);
        expect((await call(serviceById.PUT, req("/s", "PUT", { durationMinutes: 60 }), ctx("serviceId", serviceB))).status).toBe(404);
        expect((await prisma.service.findUnique({ where: { id: serviceB } }))?.durationMinutes).toBe(30);
    });

    it("appointment", async () => {
        expect((await call(appointmentById.DELETE, req("/a", "DELETE"), ctx("appointmentId", appointmentB))).status).toBe(404);
        expect((await call(appointmentById.GET, req("/a"), ctx("appointmentId", appointmentB))).status).toBe(404);
        expect((await prisma.appointment.findUnique({ where: { id: appointmentB } }))?.status).toBe("confirmed");
    });

    it("inventory", async () => {
        const list = await (await call(inventories.GET, req("/inventory?state=true"))).json();
        expect(list.data.inventories.map((i: { id: number }) => i.id)).toEqual([invA]);
        expect((await call(inventories.POST, req("/inventory", "POST", { businessId: bizB }))).status).toBe(404);
        expect((await call(inventoryById.GET, req("/i"), ctx("inventoryId", invB))).status).toBe(404);
        expect((await call(inventoryById.PUT, req("/i", "PUT", { businessId: bizA }), ctx("inventoryId", invB))).status).toBe(404);
        expect((await call(inventoryById.PUT, req("/i", "PUT", { businessId: bizB }), ctx("inventoryId", invA))).status).toBe(404);
        expect((await call(inventoryById.DELETE, req("/i", "DELETE"), ctx("inventoryId", invB))).status).toBe(404);
        expect(await prisma.inventory.findUnique({ where: { id: invB } })).toMatchObject({ businessId: bizB, state: true });
    });

    it("item", async () => {
        const list = await (await call(items.GET, req("/item?state=true"))).json();
        expect(list.data.items.map((i: { id: number }) => i.id)).toEqual([itemA]);
        expect((await call(items.POST, req("/item", "POST", { inventoryId: invB, name: "x", description: "", cost: 1, quantity: 1 }))).status).toBe(404);
        expect((await call(itemById.GET, req("/i"), ctx("itemId", itemB))).status).toBe(404);
        expect((await call(itemById.PUT, req("/i", "PUT", { inventoryId: invA }), ctx("itemId", itemB))).status).toBe(404);
        expect((await call(itemById.DELETE, req("/i", "DELETE"), ctx("itemId", itemB))).status).toBe(404);
        expect(await prisma.item.findUnique({ where: { id: itemB } })).toMatchObject({ inventoryId: invB, state: true });
        expect((await call(itemById.PUT, req("/i", "PUT", { inventoryId: invB }), ctx("itemId", itemA))).status).toBe(404);
        expect((await prisma.item.findUnique({ where: { id: itemA } }))?.inventoryId).toBe(invA);
    });

    it("user account", async () => {
        expect((await call(userById.DELETE, req("/u", "DELETE"), ctx("userId", ownerB.id))).status).toBe(403);
        expect((await call(userById.GET, req("/u"), ctx("userId", ownerB.id))).status).toBe(403);
        expect((await prisma.user.findUnique({ where: { id: ownerB.id } }))?.state).toBe(true);
        const list = await (await call(users.GET, req("/user"))).json();
        expect(list.data.users.map((u: { id: number }) => u.id)).toEqual([ownerA.id]);
    });
});

describe("account data", () => {
    it("business list needs a session and only returns the caller's businesses", async () => {
        signIn(null);
        expect((await call(businesses.GET, req("/business"))).status).toBe(401);
        signIn(ownerA);
        const ids = async (q: string) => (await (await call(businesses.GET, req(`/business?state=true&owner=true${q}`))).json())
            .data.businesses.map((b: { id: number }) => b.id);
        expect(await ids("")).toEqual([bizA]);
        expect(await ids(`&ownerId=${ownerB.id}`)).toEqual([]);
    });

    it("register returns neither the password hash nor the token, and rejects a recased duplicate", async () => {
        const body = { name: "N", last_name: "L", phone: "8888-1111", password: "password123" };
        const created = await call(register.POST, req("/register", "POST", { ...body, email: "new@test" }));
        expect(created.status).toBe(201);
        const json = await created.json();
        expect(json.user).not.toHaveProperty("password");
        expect(json).not.toHaveProperty("token");
        expect(created.headers.get("set-cookie")).toContain("token=");
        expect((await call(register.POST, req("/register", "POST", { ...body, email: "NEW@test" }))).status).toBe(400);
        expect((await call(login.POST, req("/login", "POST", { email: " NEW@Test ", password: body.password }))).status).toBe(200);
    });

    it("emails are stored lowercase, login ignores case and treats % and _ literally", async () => {
        const password = await hashPassword("password123");
        const make = (email: string) => prisma.user.create({ data: { name: "L", last_name: "L", phone: "1", email, password, state: true } });
        await expect(make("Old@Test.com")).rejects.toThrow();
        await make("old@test.com");
        await make("a_b@test.com");
        const signInAs = (email: string) => call(login.POST, req("/login", "POST", { email, password: "password123" })).then(r => r.status);
        const signUp = (email: string) => call(register.POST, req("/register", "POST",
            { name: "N", last_name: "L", phone: "1", password: "password123", email })).then(r => r.status);

        expect(await signInAs("OLD@TEST.COM")).toBe(200);
        expect(await signUp("Old@test.com")).toBe(400);
        expect(await signInAs("a%@test.com")).toBe(401);
        expect(await signInAs("aXb@test.com")).toBe(401);
        expect(await signUp("a%@test.com")).toBe(201);
    });

    it("notifications cannot be written through the API", () => {
        expect(["POST", "PUT", "DELETE"].filter(m => m in notifications || m in notificationById)).toEqual([]);
    });
});

describe("booking", () => {
    it("two simultaneous requests for one slot create a single appointment", async () => {
        signIn(client);
        const { data } = await (await call(slots.GET, req("/slots"), ctx("serviceId", serviceB))).json();
        const dueDate = data.starts[0];
        expect(dueDate).toBeTypeOf("string");

        const statuses = await Promise.all(Array.from({ length: 5 }, () =>
            call(appointments.POST, req("/appointment", "POST", { serviceId: serviceB, dueDate })).then(r => r.status)));
        expect(statuses.sort()).toEqual([201, 409, 409, 409, 409]);
        expect(await prisma.appointment.count({ where: { serviceId: serviceB, dueDate: new Date(dueDate), state: true } })).toBe(1);
    });
});
