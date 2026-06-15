import { Request, Response } from 'express';
import * as boardsService from '../services/boards.service.js';

// ── Boards ──

export async function getAll(_req: Request, res: Response) {
  const boards = await boardsService.getAllBoards();
  res.json(boards);
}

export async function getCalendar(req: Request, res: Response) {
  const { from, to } = req.query as { from?: string; to?: string };
  const cards = await boardsService.getCalendarCards(from, to);
  res.json(cards);
}

export async function getOne(req: Request, res: Response) {
  const board = await boardsService.getBoard(req.params.id);
  if (!board) {
    res.status(404).json({ error: 'Board not found' });
    return;
  }
  res.json(board);
}

export async function create(req: Request, res: Response) {
  const board = await boardsService.createBoard(req.body);
  res.status(201).json(board);
}

export async function update(req: Request, res: Response) {
  const board = await boardsService.updateBoard(req.params.id, req.body);
  res.json(board);
}

export async function remove(req: Request, res: Response) {
  await boardsService.deleteBoard(req.params.id);
  res.json({ success: true });
}

// ── Columns ──

export async function createColumn(req: Request, res: Response) {
  const column = await boardsService.createColumn(req.params.id, req.body);
  res.status(201).json(column);
}

export async function updateColumn(req: Request, res: Response) {
  const column = await boardsService.updateColumn(req.params.columnId, req.body);
  res.json(column);
}

export async function removeColumn(req: Request, res: Response) {
  await boardsService.deleteColumn(req.params.columnId);
  res.json({ success: true });
}

export async function reorderColumns(req: Request, res: Response) {
  const board = await boardsService.reorderColumns(req.params.id, req.body.columnIds);
  res.json(board);
}

// ── Cards ──

export async function createCard(req: Request, res: Response) {
  const card = await boardsService.createCard(req.params.columnId, req.body);
  res.status(201).json(card);
}

export async function updateCard(req: Request, res: Response) {
  const card = await boardsService.updateCard(req.params.cardId, req.body);
  res.json(card);
}

export async function removeCard(req: Request, res: Response) {
  await boardsService.deleteCard(req.params.cardId);
  res.json({ success: true });
}

export async function moveCard(req: Request, res: Response) {
  const card = await boardsService.moveCard(
    req.params.cardId,
    req.body.toColumnId,
    req.body.toIndex
  );
  res.json(card);
}
