import argon2 from 'argon2'

export const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 64 * 1024,
  timeCost: 3,
  parallelism: 1,
} as const

export const hashPassword = (password: string) => argon2.hash(password, ARGON2_OPTIONS)
export const verifyPassword = (hash: string, password: string) => argon2.verify(hash, password)
