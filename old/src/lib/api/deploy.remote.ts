import { command, getRequestEvent } from '$app/server';
import { error } from '@sveltejs/kit';
import { spawn } from 'child_process';
import { resolve } from 'path';

// Command to deploy using prod.sh
export const deployCommand = command(async () => {
	const { locals } = getRequestEvent();

	if (!locals.user) {
		error(401, 'Unauthorized');
	}

	try {
		// Get the absolute path to prod.sh
		const scriptPath = resolve(process.cwd(), 'prod.sh');

		// Spawn the prod.sh script as a detached process
		const child = spawn('bash', [scriptPath], {
			detached: true,
			stdio: 'ignore', // Ignore stdio to make it truly detached
			cwd: process.cwd()
		});

		// Unreference the child process so the parent can exit
		child.unref();

		return {
			success: true,
			message: 'Deployment started successfully',
			pid: child.pid
		};
	} catch (err) {
		console.error('Error starting deployment:', err);
		const errorMsg = err instanceof Error ? err.message : 'Unknown error';
		error(500, 'Failed to start deployment: ' + errorMsg);
	}
});
