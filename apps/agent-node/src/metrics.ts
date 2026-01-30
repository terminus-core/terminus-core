// =============================================================================
// TERMINUS AGENT NODE - Metrics
// =============================================================================

import os from 'os';

export function getCpuUsage(): number {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    for (const cpu of cpus) {
        for (const type in cpu.times) {
            totalTick += cpu.times[type as keyof typeof cpu.times];
        }
        totalIdle += cpu.times.idle;
    }

    return Math.round((1 - totalIdle / totalTick) * 100);
}

export function getMemoryUsage(): number {
    const total = os.totalmem();
    const free = os.freemem();
    return Math.round(((total - free) / total) * 100);
}
