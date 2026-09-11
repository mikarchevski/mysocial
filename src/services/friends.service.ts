// src/services/friends.service.ts
import { db } from '../db/index.js';
import { friendRequests, users } from '../db/schema.js';
import { eq, and, exists, not, or, sql} from 'drizzle-orm';

export default class FriendsService {
  // Отправить заявку в друзья
  async sendFriendRequest(fromUserId: number, toUserId: number) {
    // Проверяем, не являются ли пользователи уже друзьями
    const areFriends = await this.areFriends(fromUserId, toUserId);
    if (areFriends) {
      throw new Error('Пользователи уже являются друзьями');
    }

    // Проверяем, не отправлена ли уже заявка
    const existingRequest = await this.getFriendRequest(fromUserId, toUserId);
    if (existingRequest) {
      throw new Error('Заявка в друзья уже отправлена');
    }

    // Создаем новую заявку
    const [request] = await db
      .insert(friendRequests)
      .values({
        fromUserId,
        toUserId,
        status: 'pending',
      })
      .returning();

    return request;
  }

  // Принять заявку в друзья
  async acceptFriendRequest(requestId: number, currentUserId: number) {
    // Находим заявку
    const request = await db
      .select()
      .from(friendRequests)
      .where(and(eq(friendRequests.id, requestId), eq(friendRequests.toUserId, currentUserId)))
      .limit(1);

    if (!request || request.length === 0) {
      throw new Error('Заявка не найдена или доступ запрещен');
    }

    // Обновляем статус заявки
    await db
      .update(friendRequests)
      .set({ status: 'accepted' })
      .where(eq(friendRequests.id, requestId));

    // В будущем можно добавить запись в таблицу друзей
    // Сейчас просто возвращаем успешный результат
    return { message: 'Заявка принята!' };
  }

  // Отклонить заявку в друзья
  async declineFriendRequest(requestId: number, currentUserId: number) {
    // Находим заявку
    const request = await db
      .select()
      .from(friendRequests)
      .where(and(eq(friendRequests.id, requestId), eq(friendRequests.toUserId, currentUserId)))
      .limit(1);

    if (!request || request.length === 0) {
      throw new Error('Заявка не найдена или доступ запрещен');
    }

    // Удаляем заявку
    await db
      .delete(friendRequests)
      .where(eq(friendRequests.id, requestId));

    return { message: 'Заявка отклонена!' };
  }

  // Получить список заявок в друзья для текущего пользователя
  async getFriendRequests(userId: number) {
    const requests = await db
      .select({
        id: friendRequests.id,
        fromUserId: friendRequests.fromUserId,
        createdAt: friendRequests.createdAt,
      })
      .from(friendRequests)
      .where(and(eq(friendRequests.toUserId, userId), eq(friendRequests.status, 'pending')))
      .orderBy(friendRequests.createdAt);

    // Добавляем информацию о пользователях
    const requestsWithUserInfo = await Promise.all(
      requests.map(async (req) => {
        const user = await db
          .select({
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
          })
          .from(users)
          .where(eq(users.id, req.fromUserId))
          .limit(1);

        return {
          id: req.id,
          firstName: user[0]?.firstName || 'Неизвестный',
          lastName: user[0]?.lastName || 'Пользователь',
          createdAt: req.createdAt,
        };
      })
    );

    return requestsWithUserInfo;
  }

  // Получить список друзей
  async getFriends(userId: number) {
    // В будущем можно реализовать полноценный список друзей
    // Сейчас возвращаем пустой массив
    return [];
  }

  // Проверить, являются ли пользователи друзьями
  async areFriends(userId1: number, userId2: number) {
    // Пока возвращаем false, до реализации полноценной системы друзей
    return false;
  }

  // Получить заявку между пользователями
  async getFriendRequest(fromUserId: number, toUserId: number) {
    const requests = await db
      .select()
      .from(friendRequests)
      .where(
        and(
          eq(friendRequests.fromUserId, fromUserId),
          eq(friendRequests.toUserId, toUserId),
          eq(friendRequests.status, 'pending')
        )
      )
      .limit(1);

    return requests[0];
  }

  // Получить количество заявок в друзья
  async getFriendRequestsCount(userId: number) {
    const [result] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(friendRequests)
      .where(and(eq(friendRequests.toUserId, userId), eq(friendRequests.status, 'pending')));

    return result.count;
  }
}