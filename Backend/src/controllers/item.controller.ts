import { Request, Response } from 'express';
import Item from '../models/item';

/**
 * Create a new item
 * Note: DONE
 */
export const createItem = async (req: Request, res: Response): Promise<void> => {
  console.log("NewItem -> received form submission new item");
  console.log(req.body);

  try {

    const { _id, description, currentbid, buynow, remainingtime, owner } = req.body;

    // Validate required fields 
    if (!description || !currentbid || !buynow || !remainingtime || !owner) {
      res.status(400).json({ message: 'Missing required fields' });
      return;
    }

    // Create item 
    const newItem = new Item({
      _id,
      description: description,
      currentbid: currentbid,
      buynow: buynow,
      remainingtime: remainingtime,
      wininguser: null,
      sold: false,
      owner: owner,
      bids: []

    });

    const savedItem = await newItem.save();

    // Return response
    res.status(201).json(savedItem);

  } catch (error) {
    console.error('Create item error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Remove an existing item
 * Note: DONE
 */
export const removeItem = async (req: Request, res: Response): Promise<void> => {
  console.log("RemoveItem -> received form submission remove item");
  console.log(req.body);
  try {
    // Verify item exists and belongs to user
    const itemId = req.body._id;
    console.log("Item ID to delete:", itemId);
    const deleted = await Item.findByIdAndDelete(itemId);
    if (!deleted) {
      if (!res.headersSent) {
        res.status(404).json({ message: 'Item not found or not owned by user' });
      }
      return;
    }
    console.log("RemoveItem -> received form submission remove item");
    console.log(req.body);
    if (!res.headersSent) {
      res.status(200).json({ message: 'Item deleted successfully' });
    }

  } catch (error) {
    console.error('Remove item error:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Failed to remove item' });
    }
  }

  res.status(200).end();
};

/**
 * Get all items
 * Note: DONE
 */

export const getItems = async (req: Request, res: Response): Promise<void> => {
  try {
    const items = await Item.find({});
    res.status(200).json(items);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch items' });
  }
};