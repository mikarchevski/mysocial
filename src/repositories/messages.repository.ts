// src/repositories/messages.repository.ts
import { db } from '../db/index.js';
import { messages, type Message, type NewMessage } from '../db/schema.js';
import { eq, and, desc, asc, sql } from 'drizzle-orm';

export default class MessagesRepository {
  // Получить количество непрочитанных диалогов
  async getUnreadDialogsCount(userId: number) {
    const result = await db
      .select({
        count: sql<number>`COUNT(DISTINCT ${messages.senderId})`,
      })
      .from(messages)
      .where(
        and(
          eq(messages.recipientId, userId),
          eq(messages.isRead, false)
        )
      );
    return result[0].count || 0;
  }

  // Получить все сообщения пользователя
  async findByUserId(userId: number) {
    return await db
      .select({
        id: messages.id,
        senderId: messages.senderId,
        recipientId: messages.recipientId,
        encryptedContent: messages.encryptedContent,
        createdAt: messages.createdAt,
        isRead: messages.isRead,
      })
      .from(messages)
      .where(
        sql`${messages.senderId} = ${userId} OR ${messages.recipientId} = ${userId}`
      )
      .orderBy(desc(messages.createdAt));
  }

  // Получить сообщения между двумя пользователями
  async findBetweenUsers(userId1: number, userId2: number) {
    return await db
      .select({
        id: messages.id,
        senderId: messages.senderId,
        encryptedContent: messages.encryptedContent,
        createdAt: messages.createdAt,
        isRead: messages.isRead,
      })
      .from(messages)
      .where(
        sql`(${messages.senderId} = ${userId1} AND ${messages.recipientId} = ${userId2}) 
            OR (${messages.senderId} = ${userId2} AND ${messages.recipientId} = ${userId1})`
      )
      .orderBy(asc(messages.createdAt));
  }

  // Создать новое сообщение
  async create(data: NewMessage) {
    const [newMessage] = await db
      .insert(messages)
      .values(data)
      .returning();
    return newMessage;
  }

  // Пометить сообщения как прочитанные
  async markAsRead(senderId: number, recipientId: number) {
    await db
      .update(messages)
      .set({ isRead: true })
      .where(
        and(
          eq(messages.senderId, senderId),
          eq(messages.recipientId, recipientId),
          eq(messages.isRead, false)
        )
      );
  }
}