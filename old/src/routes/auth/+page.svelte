<script lang="ts">
	import type { PageProps } from './$types';

	let { form, data }: PageProps = $props();

	// Only allow registration if this is the first user
	let isRegistering = $state(data.isFirstUser);
</script>

<div class="relative flex h-screen w-full items-center justify-center font-mono text-zinc-100">
	<!-- Background decoration -->
	<div class="pointer-events-none absolute inset-0 overflow-hidden"></div>

	<form
		class="glass-panel relative z-10 flex w-96 flex-col gap-6 p-8"
		autocomplete="off"
		method="post"
		action="?/{isRegistering ? 'register' : 'login'}"
	>
		<div class="text-center">
			<h1 class="mb-2 text-3xl font-bold text-zinc-100">HALP/CDN</h1>
			<p class="text-lg text-zinc-300">
				{isRegistering ? 'Create Account' : 'Welcome Back'}
			</p>
		</div>

		<div class="space-y-4">
			<input
				class="glass-input w-full focus:outline-none"
				placeholder="Username"
				name="username"
				autocomplete="off"
				value={form?.username || ''}
			/>
			<input
				class="glass-input w-full focus:outline-none"
				placeholder="Password"
				type="password"
				name="password"
				autocomplete="off"
				value={form?.password || ''}
			/>

			{#if isRegistering}
				<input
					class="glass-input w-full focus:outline-none"
					placeholder="Confirm Password"
					type="password"
					name="confirmPassword"
					autocomplete="off"
					value={form?.confirmPassword || ''}
				/>
			{/if}
		</div>

		{#if form && !form.success}
			<div class="glass-panel border-red-400/40 bg-red-500/10 p-3">
				<p class="text-sm text-red-300">{form.message}</p>
			</div>
		{/if}

		<button type="submit" class="btn w-full justify-center py-3 font-semibold">
			{isRegistering ? 'Create Account' : 'Sign In'}
		</button>
	</form>
</div>
