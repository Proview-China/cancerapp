export type UserRole = 'admin' | 'pathologist' | 'researcher'

export type AuthUser = {
  id: string
  username: string
  role: UserRole
}

export type SessionContext = AuthUser & {
  sessionId: string
}
