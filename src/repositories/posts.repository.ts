import { db } from '../db/index.js';
import { posts, type NewPost } from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';

export default class PostsRepository {
  async findByTargetUserId(targetUserId: number, filter: string = 'all') {
    const query = db
      .select()
      .from(posts)
      .where(eq(posts.targetUserId, targetUserId))
      .orderBy(desc(posts.createdAt));

    const allPosts = await query;

    if (filter === 'owner') {
      return allPosts.filter(p => p.authorId === targetUserId);
    }

    return allPosts;
  }

  async create(data: NewPost) {
    const [newPost] = await db
      .insert(posts)
      .values(data)
      .returning();
    return newPost;
  }

  async delete(id: number, authorId: number) {
    await db
      .delete(posts)
      .where(and(eq(posts.id, id), eq(posts.authorId, authorId)));
  }
}