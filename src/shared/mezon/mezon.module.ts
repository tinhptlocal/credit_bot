import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MezonClient } from 'mezon-sdk';
import { BotGateway } from '../bot/bot.gateway';
import { MezonService } from './mezon.service';
import { ENV } from 'src/config';
@Module({
  imports: [],
  providers: [
    Logger,
    BotGateway,
    {
      provide: 'MEZON',
      useFactory: async (
        configService: ConfigService,
        logger: Logger,
        botGateway: BotGateway,
      ) => {
        const client = new MezonClient(ENV.BOT.TOKEN);
        await client.login();
        await botGateway.initEvent(client);

        return client;
      },
      inject: [ConfigService, Logger, BotGateway],
    },
    MezonService,
  ],
  exports: ['MEZON', MezonService],
})
export class MezonModule {}
