"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ListSubscriptions_1 = require("./ListSubscriptions");
const config_1 = require("@backstage/config");
// Mock logger
const logger = {
    info: console.log,
    warn: console.warn,
    error: console.error,
    debug: (message, meta) => {
        console.debug('DEBUG:', message, meta);
    },
    child: () => logger,
};
// Mock config (update these values with your actual Azure credentials and management group ID)
const config = new config_1.ConfigReader({
    'auth': {
        'providers': {
            'microsoft': {
                'development': {
                    'tenantId': 'f101208c-39d3-4c8a-8cc7-ad896b25954f',
                    'clientId': '53f8a0bd-ff77-4776-a135-300ea13c505d',
                    'clientSecret': 'WSP8Q~j06VnkoPCwY6aBE_PWno.6JHwXMq7ENbPh',
                }
            }
        }
    },
    'azureServices': {
        'managementGroup': {
            'managementGroupId': 'essity-online',
        }
    }
});
async function main() {
    const service = new ListSubscriptions_1.ListSubscriptionsService(logger, config);
    try {
        const subscriptions = await service.getSubscriptions();
        console.log('Subscriptions:', subscriptions);
        const options = await service.getSubscriptionsAsOptions();
        console.log('Subscription Options:', options);
    }
    catch (err) {
        console.error('Error:', err);
    }
}
main();
