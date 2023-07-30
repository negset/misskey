import { IsNull } from 'typeorm';
import RE2 from 're2';
import { Inject, Injectable } from '@nestjs/common';
import type { UsedUsernamesRepository, UsersRepository } from '@/models/index.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { localUsernameSchema } from '@/models/entities/User.js';
import { DI } from '@/di-symbols.js';
import { MetaService } from '@/core/MetaService.js';

export const meta = {
	tags: ['users'],

	requireCredential: false,

	res: {
		type: 'object',
		optional: false, nullable: false,
		properties: {
			available: {
				type: 'boolean',
				optional: false, nullable: false,
			},
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		username: localUsernameSchema,
	},
	required: ['username'],
} as const;

// eslint-disable-next-line import/no-default-export
@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> {
	constructor(
		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		@Inject(DI.usedUsernamesRepository)
		private usedUsernamesRepository: UsedUsernamesRepository,

		private metaService: MetaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const exist = await this.usersRepository.countBy({
				host: IsNull(),
				usernameLower: ps.username.toLowerCase(),
			});

			const exist2 = await this.usedUsernamesRepository.countBy({ username: ps.username.toLowerCase() });

			const meta = await this.metaService.fetch();
			const isPreserved = meta.preservedUsernames.some(preserved => {
				// represents RegExp
				const regexp = preserved.match(/^\/(.+)\/(.*)$/);
				if (!regexp) {
					return preserved.toLowerCase() === ps.username.toLowerCase();
				}
				try {
					return new RE2(regexp[1], regexp[2]).test(ps.username);
				} catch (err) {
					// This should never happen due to input sanitisation.
					return false;
				}
			});

			return {
				available: exist === 0 && exist2 === 0 && !isPreserved,
			};
		});
	}
}
