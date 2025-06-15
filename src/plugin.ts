import {
    createBackendPlugin,
    coreServices,
    LoggerService,
} from '@backstage/backend-plugin-api';
import { Config } from '@backstage/config';
import {createRouter } from './router';
import { ListSubscriptionsService } from './services/ListSubscriptions/ListSubscriptions';

export interface PluginOptions {
    logger: LoggerService;
    config: Config;
}

export const azureSubscriptionsPlugin = createBackendPlugin({
    pluginId: 'azure-subscriptions',
    register(env) {
        env.registerInit({
            deps: {
                logger: coreServices.logger,
                config: coreServices.rootConfig,
                httpRouter: coreServices.httpRouter,
                httpAuth: coreServices.httpAuth,
            },
            async init({ logger, config, httpRouter }) {
                const listSubscriptionsService = new ListSubscriptionsService(
                    logger,
                    config,
                );
                const router = await createRouter({
                    logger,
                    listSubscriptionsService,
                });
                httpRouter.use(router);
                logger.info('Azure Subscriptions plugin initialized');
            },
        });
    },
});