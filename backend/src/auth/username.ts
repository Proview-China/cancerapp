export const normalizeUsername = (value: string): string => {
  const normalized = value.replace(/^[\x09-\x0d\x20]+|[\x09-\x0d\x20]+$/g, '').normalize('NFKC').toLowerCase().normalize('NFKC')
  if (!normalized || [...normalized].length > 64 || /[\p{Cc}\p{Cf}]/u.test(normalized)) {
    throw new Error('用户名无效')
  }
  return normalized
}
