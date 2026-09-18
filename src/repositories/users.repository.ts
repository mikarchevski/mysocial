// src/repositories/users.repository.ts
import { db } from '../db/index.js';
import { users, type NewUser } from '../db/schema.js';
import { eq, sql, and, ne } from 'drizzle-orm';

export default class UsersRepository {
  async findById(id: number) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return user || null;
  }

  async findByEmail(email: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return user || null;
  }

  async create(data: NewUser) {
    const [newUser] = await db
      .insert(users)
      .values(data)
      .returning();
    return newUser;
  }

  async update(id: number, data: Partial<Record<string, string | null>>) {
    const [updatedUser] = await db
      .update(users)
      .set(data)
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  async searchByName(query: string, excludeUserId: number, limit = 10) {
    return await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        publicKey: users.publicKey,
      })
      .from(users)
      .where(
        and(
          sql`${users.firstName} ILIKE ${`%${query}%`} OR ${users.lastName} ILIKE ${`%${query}%`}`,
          ne(users.id, excludeUserId)
        )
      )
      .limit(limit);
  }
}