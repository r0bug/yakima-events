import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ error: 'Unauthorized' }, { status: 403 });
	}

	let pm2Status = 'Unable to check';
	try {
		const { stdout } = await execAsync('pm2 jlist 2>/dev/null');
		const processes = JSON.parse(stdout);
		const yakima = processes.find((p: { name: string }) => p.name === 'yakima-events');
		if (yakima) {
			pm2Status = [
				`Name: ${yakima.name}`,
				`Status: ${yakima.pm2_env?.status || 'unknown'}`,
				`PID: ${yakima.pid}`,
				`Uptime: ${yakima.pm2_env?.pm_uptime ? Math.round((Date.now() - yakima.pm2_env.pm_uptime) / 60000) + ' minutes' : 'unknown'}`,
				`Restarts: ${yakima.pm2_env?.restart_time || 0}`,
				`Memory: ${yakima.monit?.memory ? Math.round(yakima.monit.memory / 1024 / 1024) + ' MB' : 'unknown'}`,
				`CPU: ${yakima.monit?.cpu || 0}%`,
			].join('\n');
		} else {
			pm2Status = 'yakima-events process not found in PM2';
		}
	} catch {
		pm2Status = 'PM2 not available or not installed';
	}

	return json({ pm2Status });
};
