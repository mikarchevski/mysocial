// src/db/schema.ts
import { pgTable, serial, integer, varchar, text, timestamp, boolean, date } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  firstName: varchar('first_name', { length: 50 }).notNull(),
  lastName: varchar('last_name', { length: 50 }).notNull(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  dateOfBirth: date('date_of_birth').notNull(),
  city: varchar('city', { length: 100 }),
  phone: varchar('phone', { length: 20 }),
  website: varchar('website', { length: 255 }),
  familyStatus: varchar('family_status', { length: 50 }),
  about: text('about'),
  publicKey: text('public_key'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  senderId: integer('sender_id').references(() => users.id).notNull(),
  recipientId: integer('recipient_id').references(() => users.id).notNull(),
  encryptedContent: text('encrypted_content').notNull(),
  encryptedKey: text('encrypted_key').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  isRead: boolean('is_read').default(false).notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;