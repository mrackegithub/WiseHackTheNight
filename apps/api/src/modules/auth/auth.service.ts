import { createHash, randomBytes } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type { JWT } from '@fastify/jwt';
import * as argon2 from 'argon2';
import { conflict, unauthorized } from '../../core/errors.js';
import type { LoginInput, RefreshInput, RegisterInput } from './auth.schemas.js';

export const ACCESS_TOKEN_EXPIRES_IN = 900; // 15 minutes in seconds
const REFRESH_TOKEN_DAYS = 7;

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateRefreshToken(): string {
  return randomBytes(32).toString('hex');
}

export async function register(
  prisma: PrismaClient,
  jwt: JWT,
  input: RegisterInput,
) {
  const normalizedEmail = input.email.trim().toLowerCase();

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existing) {
    throw conflict('Email is already registered', 'EMAIL_ALREADY_REGISTERED');
  }

  const passwordHash = await argon2.hash(input.password);
  const rawRefreshToken = generateRefreshToken();
  const tokenHash = hashRefreshToken(rawRefreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);

  const user = await prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        displayName: input.displayName.trim(),
        onboardingComplete: false,
        preferences: {
          create: {
            groupSizeMin: 2,
            groupSizeMax: 4,
            maxDistanceKm: 5,
            sessionLengthMinutes: 90,
            mode: 'EITHER',
            locationTypes: [],
          },
        },
      },
    });

    await tx.refreshToken.create({
      data: {
        userId: createdUser.id,
        tokenHash,
        expiresAt,
      },
    });

    return createdUser;
  });

  const accessToken = jwt.sign({
    sub: user.id,
    email: user.email,
  });

  return {
    accessToken,
    refreshToken: rawRefreshToken,
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  };
}

export async function login(
  prisma: PrismaClient,
  jwt: JWT,
  input: LoginInput,
) {
  const normalizedEmail = input.email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    throw unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  const validPassword = await argon2.verify(user.passwordHash, input.password);
  if (!validPassword) {
    throw unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  const rawRefreshToken = generateRefreshToken();
  const tokenHash = hashRefreshToken(rawRefreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  const accessToken = jwt.sign({
    sub: user.id,
    email: user.email,
  });

  return {
    accessToken,
    refreshToken: rawRefreshToken,
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  };
}

export async function refresh(
  prisma: PrismaClient,
  jwt: JWT,
  input: RefreshInput,
) {
  const tokenHash = hashRefreshToken(input.refreshToken);

  const storedToken = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!storedToken || storedToken.revokedAt !== null || storedToken.expiresAt < new Date()) {
    throw unauthorized('Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');
  }

  const newRawRefreshToken = generateRefreshToken();
  const newTokenHash = hashRefreshToken(newRawRefreshToken);
  const newExpiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);

  await prisma.$transaction(async (tx) => {
    // Revoke old token
    await tx.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    // Create rotated new token
    await tx.refreshToken.create({
      data: {
        userId: storedToken.userId,
        tokenHash: newTokenHash,
        expiresAt: newExpiresAt,
      },
    });
  });

  const accessToken = jwt.sign({
    sub: storedToken.user.id,
    email: storedToken.user.email,
  });

  return {
    accessToken,
    refreshToken: newRawRefreshToken,
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  };
}
