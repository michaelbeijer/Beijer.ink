import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import {
  createBoardSchema,
  updateBoardSchema,
  createColumnSchema,
  updateColumnSchema,
  reorderColumnsSchema,
  createCardSchema,
  updateCardSchema,
  moveCardSchema,
} from '../validators/board.schema.js';
import * as boardsController from '../controllers/boards.controller.js';

const router = Router();

// Boards
router.get('/', asyncHandler(boardsController.getAll));
// NOTE: must precede '/:id' so 'calendar' isn't matched as a board id.
router.get('/calendar', asyncHandler(boardsController.getCalendar));
router.get('/:id', asyncHandler(boardsController.getOne));
router.post('/', validate(createBoardSchema), asyncHandler(boardsController.create));
router.patch('/:id', validate(updateBoardSchema), asyncHandler(boardsController.update));
router.delete('/:id', asyncHandler(boardsController.remove));

// Columns
router.post('/:id/columns', validate(createColumnSchema), asyncHandler(boardsController.createColumn));
router.patch('/:id/columns/reorder', validate(reorderColumnsSchema), asyncHandler(boardsController.reorderColumns));
router.patch('/columns/:columnId', validate(updateColumnSchema), asyncHandler(boardsController.updateColumn));
router.delete('/columns/:columnId', asyncHandler(boardsController.removeColumn));

// Cards
router.post('/columns/:columnId/cards', validate(createCardSchema), asyncHandler(boardsController.createCard));
router.patch('/cards/:cardId/move', validate(moveCardSchema), asyncHandler(boardsController.moveCard));
router.patch('/cards/:cardId', validate(updateCardSchema), asyncHandler(boardsController.updateCard));
router.delete('/cards/:cardId', asyncHandler(boardsController.removeCard));

export default router;
