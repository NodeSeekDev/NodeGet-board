export const formatBytes = (bytes: number, decimals = 2) => {
  if (!+bytes) return '0 B'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

export const formatLoad = (load: any) => {
    if (!load) return '- / - / -'
    const one = load.one ?? load.load1 ?? '-'
    const five = load.five ?? load.load5 ?? '-'
    const fifteen = load.fifteen ?? load.load15 ?? '-'
    return `${one} / ${five} / ${fifteen}`
}

export const formatUptime = (uptime: number) => {
  if (!uptime) return '0m'
  const days = Math.floor(uptime / (3600 * 24))
  const hours = Math.floor((uptime % (3600 * 24)) / 3600)
  const minutes = Math.floor((uptime % 3600) / 60)
  
  const parts = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  
  return parts.join(' ') || '< 1m'
}


export const formatTimestamp = (ts: number) => {
    return new Date(ts).toLocaleTimeString()
}
