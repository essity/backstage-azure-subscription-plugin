import express, { Router, Request, Response } from 'express';
import { LoggerService } from '@backstage/backend-plugin-api'; 
import { ListSubscriptionsService } from './services/ListSubscriptions/ListSubscriptions';


export interface RouterOptions {
  logger: LoggerService;
  listSubscriptionsService: ListSubscriptionsService;
}

export function createRouter(options: RouterOptions): Promise<Router> {
  const { logger, listSubscriptionsService } = options;
  const router = Router();
  router.use(express.json());

  router.get('/subscriptions', async (req: Request, res: Response) => {
    try {
      const subscriptions = await listSubscriptionsService.getSubscriptionsAsOptions();
      res.json(subscriptions);
    } catch (error) {
      res.status(500).send('Internal Server Error');
    }
  });

  return Promise.resolve(router);
}