import { ListSubscriptionsService } from './ListSubscriptions';
import { LoggerService } from '@backstage/backend-plugin-api';
import { ConfigReader } from '@backstage/config';

// Mock logger
const logger: LoggerService = {
  info: console.log,
  warn: console.warn,
  error: console.error,
  debug: (message: string, meta?: Error | Record<string, unknown>) => {
    console.debug('DEBUG:', message, meta);
  },
  child: () => logger,
};

// Mock config (update these values with your actual Azure credentials and management group ID)
const config = new ConfigReader({
  'auth': {
    'providers': {
      'microsoft': {
        'development': {
          'tenantId': 'f101208c-39d3-4c8a-8cc7-ad896b25954f',
          'clientId': '53f8a0bd-ff77-4776-a135-300ea13c505d',
          'clientSecret': '',
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
  const service = new ListSubscriptionsService(logger, config);
  try {
    const subscriptions = await service.getSubscriptions();
    console.log('Subscriptions:', subscriptions);
    const options = await service.getSubscriptionsAsOptions();
    console.log('Subscription Options:', options);
  } catch (err) {
    console.error('Error:', err);
  }
}

main();