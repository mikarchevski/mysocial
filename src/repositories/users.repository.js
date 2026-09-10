// src/repositories/users.repository.ts
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq, sql, and, ne } from 'drizzle-orm';
export default class UsersRepository {
    async findById(id) {
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, id))
            .limit(1);
        return user || null;
    }
    async findByEmail(email) {
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1);
        return user || null;
    }
    async create(data) {
        const [newUser] = await db
            .insert(users)
            .values(data)
            .returning();
        return newUser;
    }
    async update(id, data) {
        const [updatedUser] = await db
            .update(users)
            .set(data)
            .where(eq(users.id, id))
            .returning();
        return updatedUser;
    }
    async searchByName(query, excludeUserId, limit = 10) {
        return await db
            .select({
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
        })
            .from(users)
            .where(and(sql `${users.firstName} ILIKE ${`%${query}%`} OR ${users.lastName} ILIKE ${`%${query}%`}`, ne(users.id, excludeUserId)))
            .limit(limit);
    }
}
