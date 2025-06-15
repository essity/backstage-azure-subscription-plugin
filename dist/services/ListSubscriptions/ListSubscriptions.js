"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListSubscriptionsService = void 0;
const identity_1 = require("@azure/identity");
const arm_subscriptions_1 = require("@azure/arm-subscriptions");
const arm_managementgroups_1 = require("@azure/arm-managementgroups");
class ListSubscriptionsService {
    constructor(logger, config) {
        this.logger = logger;
        this.config = config;
        this.managementGroupsClient = null;
        this.subscriptionClient = null;
        this.credential = null;
        this.cache = new Map();
        this.CACHE_TTL_MS = 3600000;
        this.initializeService();
    }
    async getSubscriptions() {
        if (!this.managementGroupsClient || !this.subscriptionClient) {
            this.logger.warn('Azure clients not initialized. Cannot fetch subscriptions.');
            return [];
        }
        const cacheKey = 'azure-subscriptions';
        const cachedData = this.cache.get(cacheKey);
        const now = Date.now();
        // Check if we have valid cached data
        if (cachedData && now - cachedData.timestamp < this.CACHE_TTL_MS) {
            this.logger.info('Returning cached Azure subscriptions');
            return cachedData.data;
        }
        try {
            // Process subscriptions and update cache
            const subscriptions = await this.processSubscriptions();
            this.cache.set(cacheKey, { timestamp: now, data: subscriptions });
            return subscriptions;
        }
        catch (error) {
            this.logger.error('Failed to fetch Azure subscriptions', {
                error: error instanceof Error ? error.message : String(error),
            });
            // Return cached data even if expired, or empty array if no cache
            return cachedData?.data || [];
        }
    }
    async getSubscriptionsAsOptions() {
        const subscriptions = await this.getSubscriptions();
        return subscriptions.map(subscription => ({
            label: subscription.subscriptionName,
            value: subscription.subscriptionId
        }));
    }
    hasValidAzureConfig() {
        return (this.config.getOptionalString('auth.providers.microsoft.development.tenantId')?.trim() !== undefined &&
            this.config.getOptionalString('auth.providers.microsoft.development.clientId')?.trim() !== undefined &&
            this.config.getOptionalString('auth.providers.microsoft.development.clientSecret')?.trim() !== undefined &&
            this.config.getOptionalString('azureServices.managementGroup.managementGroupId')?.trim() !== undefined);
    }
    initializeService() {
        if (!this.hasValidAzureConfig()) {
            this.logger.warn('Azure clients not initialized: Missing configuration.');
            return;
        }
        try {
            this.credential = new identity_1.ClientSecretCredential(this.config.getString('auth.providers.microsoft.development.tenantId'), this.config.getString('auth.providers.microsoft.development.clientId'), this.config.getString('auth.providers.microsoft.development.clientSecret'));
            this.managementGroupsClient = new arm_managementgroups_1.ManagementGroupsAPI(this.credential);
            this.subscriptionClient = new arm_subscriptions_1.SubscriptionClient(this.credential);
            this.logger.info('Azure ARM clients initialized successfully.');
        }
        catch (error) {
            this.logger.error('Error initializing Azure ARM clients', {
                error: error instanceof Error ? error.message : String(error),
            });
            this.managementGroupsClient = null;
            this.subscriptionClient = null;
        }
    }
    async getSubscriptionsUnderManagementGroup() {
        if (!this.managementGroupsClient) {
            throw new Error('Azure Management Groups client is not initialized.');
        }
        const managementGroupId = this.config.getString('azureServices.managementGroup.managementGroupId').trim();
        const subscriptions = [];
        // Check if there are any management groups under the given management group
        const hasChildManagementGroups = [];
        for await (const group of this.managementGroupsClient.managementGroups.listDescendants(managementGroupId)) {
            if (group.type === 'Microsoft.Management/managementGroups' && group.name) {
                hasChildManagementGroups.push(group.name);
                this.logger.info(`Found child management group: ${group.name}`);
            }
        }
        if (hasChildManagementGroups.length === 0) {
            this.logger.info(`No child management groups found under: ${managementGroupId}`);
        }
        try {
            for await (const sub of this.managementGroupsClient.managementGroupSubscriptions.listSubscriptionsUnderManagementGroup(managementGroupId)) {
                if (sub.id) {
                    const subscriptionId = sub.id.split('/').pop();
                    if (subscriptionId) {
                        subscriptions.push(subscriptionId);
                    }
                }
            }
            if (subscriptions.length === 0) {
                this.logger.warn(`No subscriptions found under management group: ${managementGroupId}`);
            }
        }
        catch (error) {
            this.logger.error('Error fetching subscriptions under management group', {
                error: error instanceof Error ? error.message : String(error),
            });
        }
        return subscriptions;
    }
    async processSubscriptions() {
        const subscriptions = await this.getSubscriptionsUnderManagementGroup();
        const subscriptionDetails = [];
        for (const subscriptionId of subscriptions) {
            try {
                const subscription = await this.subscriptionClient?.subscriptions.get(subscriptionId);
                if (subscription) {
                    subscriptionDetails.push({
                        subscriptionName: subscription.displayName ?? '',
                        subscriptionId: subscription.subscriptionId ?? '',
                    });
                }
            }
            catch (error) {
                this.logger.error('Error fetching subscription details', {
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
        return subscriptionDetails;
    }
}
exports.ListSubscriptionsService = ListSubscriptionsService;
