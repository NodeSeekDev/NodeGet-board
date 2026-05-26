
export const getCookie = (name: string): string | null => {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  if (match && match[2]) {
    try {
        return decodeURIComponent(match[2])
    } catch {
        return match[2]
    }
  }
  return null
}


export const setCookie = (name: string, value: string) => {
  const date = new Date()
  date.setTime(date.getTime() + (365 * 24 * 60 * 60 * 1000)) // 1 year
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; expires=${date.toUTCString()}; SameSite=Strict`
}