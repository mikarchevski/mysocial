// src/services/auth.service.ts
import UsersRepository from "../repositories/users.repository.js";
// import { hashPassword, verifyPassword } from "../utils/password.js"; // или ваш путь
// import UsersRepository from "../repositories/users.repository.js";
import { hashPassword, verifyPassword } from "../utils/crypto.js";
import type { NewUser } from "../db/schema.js";

export default class AuthService {
  private usersRepo = new UsersRepository();

  async register(data: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    dateOfBirth: string;
    city?: string;
    publicKey?: string;
    encryptedPrivateKey?: string;
    salt?: string;
  }) {
    const existingUser = await this.usersRepo.findByEmail(data.email);
    if (existingUser) {
      throw new Error("Пользователь с таким email уже существует");
    }

    const passwordHash = await hashPassword(data.password);

    const newUser = await this.usersRepo.create({
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      passwordHash,
      dateOfBirth: data.dateOfBirth,
      city: data.city || null,
      publicKey: data.publicKey || null,
      encryptedPrivateKey: data.encryptedPrivateKey || null, // <-- ДОБАВИТЬ
      salt: data.salt || null, // <-- ДОБАВИТЬ
    });

    return {
      id: newUser.id,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      email: newUser.email,
    };
  }

  async login(email: string, password: string) {
    const user = await this.usersRepo.findByEmail(email);
    if (!user) {
      throw new Error("Неверный email или пароль");
    }

    const valid = await verifyPassword(user.passwordHash, password);
    if (!valid) {
      throw new Error("Неверный email или пароль");
    }

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      salt: user.salt,
      encryptedPrivateKey: user.encryptedPrivateKey,
    };
  }

  async getUserById(id: number) {
    const user = await this.usersRepo.findById(id);
    if (!user) {
      throw new Error("Пользователь не найден");
    }

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      city: user.city,
      dateOfBirth: user.dateOfBirth,
      phone: user.phone,
      website: user.website,
      familyStatus: user.familyStatus,
      about: user.about,
      gender: user.gender || null,
      publicKey: user.publicKey,
      createdAt: user.createdAt,
      salt: user.salt,
      encryptedPrivateKey: user.encryptedPrivateKey,
    };
  }

  async updateUser(
    id: number,
    data: Partial<{
      city: string;
      phone: string;
      website: string;
      familyStatus: string;
      about: string;
    }>,
  ) {
    const user = await this.usersRepo.findById(id);
    if (!user) {
      throw new Error("Пользователь не найден");
    }

    const updatedUser = await this.usersRepo.update(id, data);

    return {
      id: updatedUser.id,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      email: updatedUser.email,
      city: updatedUser.city,
      dateOfBirth: updatedUser.dateOfBirth,
      phone: updatedUser.phone,
      website: updatedUser.website,
      familyStatus: updatedUser.familyStatus,
      about: updatedUser.about,
      gender: updatedUser.gender || null,
    };
  }
}
