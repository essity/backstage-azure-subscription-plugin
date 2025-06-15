import { Config } from '@backstage/config';
import { LoggerService } from '@backstage/backend-plugin-api';
import { ClientSecretCredential } from '@azure/identity';
import { SubscriptionClient } from '@azure/arm-subscriptions';
import { ManagementGroupsAPI } from '@azure/arm-managementgroups';
import { IListSubscriptionsService } from './types';


export interface SubscriptionOption {
  label: string;
  value: string;
}

export class ListSubscriptionsService {
    private managementGroupsClient: ManagementGroupsAPI | null = null;
    private subscriptionClient: SubscriptionClient | null = null;
    private credential: ClientSecretCredential | null = null;
    private readonly cache = new Map<string, { timestamp: number, data: IListSubscriptionsService[] }>();
    private readonly CACHE_TTL_MS = 3600000;

    constructor(
        private readonly logger: LoggerService,
        private readonly config: Config
    ) {
        this.initializeService();
    }

    public async getSubscriptions(): Promise<IListSubscriptionsService[]> {
        if (!this.managementGroupsClient || !this.subscriptionClient) {
            this.logger.warn('Azure clients not initialized. Cannot fetch subscriptions.');
            return [];
        }

        // Get the management group ID from config
        const managementGroupId = this.config.getString('azureServices.managementGroup.managementGroupId').trim();
        const cacheKey = `azure-subscriptions-${managementGroupId}`;
        const cachedData = this.cache.get(cacheKey);
        const now = Date.now();

        // Check if we have valid cached data for this management group
        if (cachedData && now - cachedData.timestamp < this.CACHE_TTL_MS) {
            this.logger.info(`Returning cached Azure subscriptions for management group: ${managementGroupId}`);
            return cachedData.data;
        }

        try {
            // Process subscriptions and update cache
            const subscriptions = await this.processSubscriptions();
            this.cache.set(cacheKey, { timestamp: now, data: subscriptions });
            return subscriptions;
        } catch (error) {
            this.logger.error('Failed to fetch Azure subscriptions', {
                error: error instanceof Error ? error.message : String(error),
            });
            // Return cached data even if expired, or empty array if no cache
            return cachedData?.data || [];
        }
    }

    public async getSubscriptionsAsOptions(): Promise<SubscriptionOption[]> {
        const subscriptions = await this.getSubscriptions();
        return subscriptions.map(subscription => ({
            label: subscription.subscriptionName,
            value: subscription.subscriptionId
        }));
    }

    private hasValidAzureConfig(): boolean {
        return (
            this.config.getOptionalString('auth.providers.microsoft.development.tenantId')?.trim() !== undefined &&
            this.config.getOptionalString('auth.providers.microsoft.development.clientId')?.trim() !== undefined &&
            this.config.getOptionalString('auth.providers.microsoft.development.clientSecret')?.trim() !== undefined &&
            this.config.getOptionalString('azureServices.managementGroup.managementGroupId')?.trim() !== undefined
        );
    }

    private initializeService(): void {
        if (!this.hasValidAzureConfig()) {
            this.logger.warn('Azure clients not initialized: Missing configuration.');
            return;
        }

        try {
            this.credential = new ClientSecretCredential(
                this.config.getString('auth.providers.microsoft.development.tenantId'),
                this.config.getString('auth.providers.microsoft.development.clientId'),
                this.config.getString('auth.providers.microsoft.development.clientSecret')
            );

            this.managementGroupsClient = new ManagementGroupsAPI(this.credential);
            this.subscriptionClient = new SubscriptionClient(this.credential);

            this.logger.info('Azure ARM clients initialized successfully.');
        } catch (error) {
            this.logger.error('Error initializing Azure ARM clients', {
                error: error instanceof Error ? error.message : String(error),
            });
            this.managementGroupsClient = null;
            this.subscriptionClient = null;
        }
    }

    private async getSubscriptionsUnderManagementGroup(): Promise<string[]> {
        if (!this.managementGroupsClient) {
            throw new Error('Azure Management Groups client is not initialized.');
        }

        const managementGroupId = this.config.getString('azureServices.managementGroup.managementGroupId').trim();
        const subscriptions: string[] = [];

        // Check if there are any management groups under the given management group
        const hasChildManagementGroups: string[] = [];
        for await (const group of this.managementGroupsClient.managementGroups.listDescendants(managementGroupId)) {
            if (group.type === 'Microsoft.Management/managementGroups' && group.name) {
                hasChildManagementGroups.push(group.name);
            }
        }
        
        if (hasChildManagementGroups.length === 0) {
            this.logger.info(`No child management groups found under: ${managementGroupId}`);
            hasChildManagementGroups.push(managementGroupId);    
        }

        try {
            for (const childGroup of hasChildManagementGroups) {
                this.logger.info(`Fetching subscriptions for child management group: ${childGroup}`);
                for await (const sub of this.managementGroupsClient.managementGroupSubscriptions.listSubscriptionsUnderManagementGroup(childGroup)) {
                    if (sub.id) {
                        const subscriptionId = sub.id.split('/').pop();
                        if (subscriptionId) {
                            subscriptions.push(subscriptionId);
                        }
                    }
                }
            }
            if (subscriptions.length === 0) {
                this.logger.warn(`No subscriptions found under management group: ${managementGroupId}`);
            }
        } catch (error) {
            this.logger.error('Error fetching subscriptions under management group', {
                error: error instanceof Error ? error.message : String(error),
            });
        }

        return subscriptions;
    }

    private async processSubscriptions() : Promise<IListSubscriptionsService[]> {
        const subscriptions = await this.getSubscriptionsUnderManagementGroup();
        const subscriptionDetails: IListSubscriptionsService[] = [];

        for (const subscriptionId of subscriptions) {
            try {
                const subscription = await this.subscriptionClient?.subscriptions.get(subscriptionId);
                if (subscription) {
                    subscriptionDetails.push({
                        subscriptionName: subscription.displayName ?? '',
                        subscriptionId: subscription.subscriptionId ?? '',
                    });
                }
            } catch (error) {
                this.logger.error('Error fetching subscription details', {
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }

        return subscriptionDetails;
    }
}