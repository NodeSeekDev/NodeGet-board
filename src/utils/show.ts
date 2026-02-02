import { formatBytes } from '@/utils/format'

export const showHostname = (server: any) => {
  if (server.system && server.system_host_name) {
    return server.system.system_host_name
  }
  return 'Server'
}

export const showOS = (server: any) => {
    if (server.system && server.system.system_name) return server.system.system_name + ' ' + (server.system.system_os_version || '')
    return 'Unknown OS' 
}

export const showCpuPercent = (server: any): number => {
    if (server.cpu) {
        if (typeof server.cpu.total_cpu_usage === 'number') return server.cpu.total_cpu_usage
    }
    return 0
}

export const showRamPercent = (server: any): number => {
    if (server.ram) {
        const used = server.ram.used_memory || server.ram.used || 0
        const total = server.ram.total_memory || server.ram.total || 1
        return (used / total) * 100
    }
    return 0
}

export const showRamText = (server: any) => {
    if (server.ram) {
        const used = server.ram.used_memory || server.ram.used || 0
        const total = server.ram.total_memory || server.ram.total || 0
        return `${formatBytes(used)} / ${formatBytes(total)}`
    }
    return 'N/A'
}


export const showNetworkSpeed = (server: any, type: 'rx' | 'tx') => {
    if (!server.network) return '0 B/s'
    let totalSpeed = 0
    
    for (const iface of server.network.interfaces) {
        if (iface.interface_name === 'lo') continue;
        
        if (type === 'rx') totalSpeed += (iface.receive_speed || 0)
        if (type === 'tx') totalSpeed += (iface.transmit_speed || 0)
    }
    
    return formatBytes(totalSpeed) + '/s'
}

export const showDiskUsage = (server: any) => {
    if (server.disk && Array.isArray(server.disk) && server.disk.length > 0) {
        const root = server.disk.find((d: any) => d.mount_point === '/') || server.disk[0]
        if (root) {
            const total = root.total_space
            const available = root.available_space
            const used = total - available
            const percent = (used / total) * 100
            return `${root.mount_point}: ${Math.round(percent)}%`
        }
    }
    return 'N/A'
}

export const showDiskPercent = (server: any) => {
    const text = showDiskUsage(server)
    if (text === 'N/A') return 0
    const parts = text.split(': ')
    if (parts.length === 2) {
        return parseFloat(parts[1] as string)
    }
    return 0
}

export const showDiskDisplay = (server: any) => {
    const text = showDiskUsage(server)
    if (text === 'N/A') return 'N/A'
    const parts = text.split(': ')
    return parts.length === 2 ? parts[1] : 'N/A'
}

