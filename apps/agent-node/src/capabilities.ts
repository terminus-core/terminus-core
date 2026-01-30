// =============================================================================
// TERMINUS AGENT NODE - Capability Discovery
// =============================================================================
// Auto-detects capabilities of the host machine.
// =============================================================================

import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';

const execAsync = promisify(exec);

export interface NodeSpecs {
    os: string;
    arch: string;
    cpuCores: number;
    totalMemoryGB: number;
    nodeVersion: string;
}

export interface DiscoveredCapabilities {
    capabilities: string[];
    specs: NodeSpecs;
}

// =============================================================================
// Capability Detection Functions
// =============================================================================

async function checkCommand(command: string): Promise<boolean> {
    try {
        await execAsync(`which ${command}`);
        return true;
    } catch {
        return false;
    }
}

async function getVersion(command: string): Promise<string | null> {
    try {
        const { stdout } = await execAsync(`${command} --version`);
        const match = stdout.match(/[\d.]+/);
        return match ? match[0] : null;
    } catch {
        return null;
    }
}

async function checkDocker(): Promise<boolean> {
    try {
        await execAsync('docker info', { timeout: 5000 });
        return true;
    } catch {
        return false;
    }
}

async function checkGPU(): Promise<string | null> {
    try {
        // Check for NVIDIA GPU
        const { stdout } = await execAsync('nvidia-smi --query-gpu=name --format=csv,noheader', { timeout: 5000 });
        return stdout.trim();
    } catch {
        return null;
    }
}

// =============================================================================
// Main Discovery Function
// =============================================================================

export async function discoverCapabilities(): Promise<DiscoveredCapabilities> {
    const capabilities: string[] = ['basic-compute', 'text-processing'];

    // Check Python
    const pythonVersion = await getVersion('python3') || await getVersion('python');
    if (pythonVersion) {
        capabilities.push(`python-${pythonVersion.split('.').slice(0, 2).join('.')}`);
    }

    // Check Node.js
    capabilities.push(`nodejs-${process.version.slice(1).split('.')[0]}`);

    // Check for common tools
    if (await checkCommand('ffmpeg')) capabilities.push('ffmpeg');
    if (await checkCommand('chromium') || await checkCommand('chromium-browser') || await checkCommand('google-chrome')) {
        capabilities.push('chromium-browser');
    }
    if (await checkCommand('curl')) capabilities.push('http-client');
    if (await checkCommand('git')) capabilities.push('git');

    // Check Docker
    if (await checkDocker()) capabilities.push('docker');

    // Check GPU
    const gpuName = await checkGPU();
    if (gpuName) {
        capabilities.push('nvidia-gpu');
        if (gpuName.toLowerCase().includes('rtx')) {
            capabilities.push('rtx-gpu');
        }
    }

    // Build specs
    const specs: NodeSpecs = {
        os: `${os.platform()}-${os.release()}`,
        arch: os.arch(),
        cpuCores: os.cpus().length,
        totalMemoryGB: Math.round(os.totalmem() / (1024 * 1024 * 1024)),
        nodeVersion: process.version,
    };

    return { capabilities, specs };
}
