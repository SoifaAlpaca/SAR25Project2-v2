import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import * as itemController from '../controllers/item.controller';
import { authenticate, handleJwtError } from '../middlewares/auth.middleware';

const router = Router();

// Auth routes
router.post('/authenticate', authController.authenticate);
router.post('/newuser', authController.registerUser);
router.get('/users', authenticate, authController.getUsers);

// Item routes
router.post('/newitem', authenticate, itemController.createItem);
router.post('/removeitem', authenticate, itemController.removeItem);
router.get('/items', authenticate, itemController.getItems);
router.delete('/items/:id', authenticate, itemController.removeItem);

// Handle JWT errors
router.use(handleJwtError);

export default router;