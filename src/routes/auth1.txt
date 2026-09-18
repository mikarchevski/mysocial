import { z } from 'zod';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { hashPassword, verifyPassword } from '../utils/crypto.js';
import { eq } from 'drizzle-orm';
const registerSchema = z.object({
    username: z.string().min(3).max(50),
    email: z.string().email(),
    password: z.string().min(8),
    publicKey: z.string(),
});
const loginSchema = z.object({
    username: z.string(),
    password: z.string(),
});
export const authRoutes = async (app) => {
    app.post('/register', async (request, reply) => {
        const body = registerSchema.parse(request.body);
        const passwordHash = await hashPassword(body.password);
        const [user] = await db
            .insert(users)
            .values({
            username: body.username,
            email: body.email,
            passwordHash,
            publicKey: body.publicKey,
        })
            .returning({ id: users.id, username: users.username });
        return reply.status(201).send({ user });
    });
    app.post('/login', async (request, reply) => {
        const body = loginSchema.parse(request.body);
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.username, body.username))
            .limit(1);
        if (!user) {
            return reply.status(401).send({ error: 'Invalid credentials' });
        }
        const valid = await verifyPassword(user.passwordHash, body.password);
        if (!valid) {
            return reply.status(401).send({ error: 'Invalid credentials' });
        }
        const token = app.jwt.sign({ userId: user.id }, { expiresIn: app.config.JWT_EXPIRES_IN });
        reply.setCookie('token', token, {
            httpOnly: true,
            secure: true,
            sameSite: 'strict',
            path: '/',
        });
        return { user: { id: user.id, username: user.username } };
    });
};
