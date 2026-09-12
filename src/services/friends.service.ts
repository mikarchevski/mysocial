// src/services/friends.service.ts
// Заменим проблемную часть в методе getFriends

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
  async getFriendshipStatus(userId1: number, userId2: number) {
    // Проверяем, являются ли пользователи друзьями
    const areFriends = await this.areFriends(userId1, userId2);
    if (areFriends) {
      return { status: 'friends' as const };
    }

    // Проверяем исходящую заявку (текущий пользователь -> другой пользователь)
    const outgoingRequest = await this.getFriendRequest(userId1, userId2);
    if (outgoingRequest) {
      return { status: 'request_sent' as const, requestId: outgoingRequest.id };
    }

    // Проверяем входящую заявку (другой пользователь -> текущий пользователь)
    const incomingRequest = await this.getFriendRequest(userId2, userId1);
    if (incomingRequest) {
      return { status: 'request_received' as const, requestId: incomingRequest.id };
    }

    // Нет связей
    return { status: 'none' as const };
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

    // Обновляем статус заявки на 'accepted'
    await db
      .update(friendRequests)
      .set({ status: 'accepted' })
      .where(eq(friendRequests.id, requestId));

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
    // Получаем список принятых заявок, где пользователь является инициатором или получателем
    const acceptedRequests = await db
      .select({
        fromUserId: friendRequests.fromUserId,
        toUserId: friendRequests.toUserId,
      })
      .from(friendRequests)
      .where(and(
        or(
          eq(friendRequests.fromUserId, userId),
          eq(friendRequests.toUserId, userId)
        ),
        eq(friendRequests.status, 'accepted')
      ));

    // Получаем ID друзей (если пользователь был инициатором, то друг - получатель и наоборот)
    const friendIds = acceptedRequests.map(req => 
      req.fromUserId === userId ? req.toUserId : req.fromUserId
    );

    if (friendIds.length === 0) {
      return [];
    }

    // Получаем информацию о друзьях
    // Используем правильный способ проверки наличия в массиве с Drizzle ORM
    const friendDetails = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        city: users.city,
        phone: users.phone,
        website: users.website,
        familyStatus: users.familyStatus,
        about: users.about,
      })
      .from(users)
      .where(
        sql`${users.id} = ANY(ARRAY[${sql.join(friendIds.map(id => sql`${id}`), sql`, `)}]::integer[])`
      );

    return friendDetails;
  }

  // Проверить, являются ли пользователи друзьями
  async areFriends(userId1: number, userId2: number) {
    if (userId1 === userId2) return false;

    const request = await db
      .select()
      .from(friendRequests)
      .where(
        and(
          or(
            and(eq(friendRequests.fromUserId, userId1), eq(friendRequests.toUserId, userId2)),
            and(eq(friendRequests.fromUserId, userId2), eq(friendRequests.toUserId, userId1))
          ),
          eq(friendRequests.status, 'accepted')
        )
      )
      .limit(1);

    return request.length > 0;
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