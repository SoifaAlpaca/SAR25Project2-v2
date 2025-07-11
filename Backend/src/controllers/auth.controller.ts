import { Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';
import User from '../models/user';
import config from '../config/config';
import bcrypt from 'bcryptjs';

const saltRounds = 10;


/**
 * Handle user authentication
 * Note: DONE
 */
export const authenticate = async (req: Request, res: Response): Promise<void> => {
  console.log('Authenticate -> Received Authentication POST');

  try {
    const { username, password, latitude, longitude } = req.body;

    if (!username || !password) {
      res.status(400).json({ message: 'Username and password are required' });
      return;
    }

    // Find user and compare plain text passwords
    const user = await User.findOne({ username });
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    const passwordIsValid = await bcrypt.compare(password, user.password);
    if (!passwordIsValid) {
      res.status(401).json({ message: 'Invalid password' });
      return;
    }

    // Update login status
    user.islogged = true;
    await user.save();

    // Update latitude and longitude if provided
    if (latitude !== undefined && longitude !== undefined) {
      user.latitude = latitude;
      user.longitude = longitude;
      await user.save();
    }

    // Generate JWT token
    const token = jwt.sign(
      req.body,
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    // Return response without password
    res.json({
      name: user.name,
      email: user.email,
      username: user.username,
      latitude: user.latitude,
      longitude: user.longitude,
      token
    });

  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }

  console.log('Authenticate -> Received Authentication POST');
};

/**
 * Handle user registration
 * Note: DONE
 */
export const registerUser = async (req: Request, res: Response): Promise<void> => {
  console.log("NewUser -> received form submission new user");
  console.log(req.body);
  try {
    const name = req.body.name;
    const email = req.body.email;
    const username = req.body.username;
    const password = req.body.password;
    const latitude = req.body.latitude;
    const longitude = req.body.longitude;


    // Basic validation
    if (!name || !email || !username || !password) {
      res.status(400).json({ message: 'All fields are required' });
      return;
    }

    // Check if user exists
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      res.status(400).json({
        message: 'User already exists',
        field: existingUser.username === username ? 'username' : 'email'
      });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create new user 
    const newUser = new User({
      name,
      email,
      username,
      password: hashedPassword,
      latitude,
      longitude,
      islogged: false,
    });

    const savedUser = await newUser.save(); // Save to MongoDB

    // Generate JWT token
    const token = jwt.sign(
      { username: savedUser.username, id: savedUser._id },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    // Return response without password
    res.status(201).json({
      name: savedUser.name,
      email: savedUser.email,
      username: savedUser.username,
      latitude: savedUser.latitude,
      longitude: savedUser.longitude,
      token
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Get all users
 * Note: DONE
 */
export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    // Go to the database and get all users
    const users = await User.find({}).lean();

    // Send single response
    res.status(200).json(users);
  } catch (error) {
    console.error('Get users error:', error);

    // Only send error response if headers haven't been sent
    if (!res.headersSent) {
      res.status(500).json({ message: 'Internal server error' });
    }
  }
};

/**
 * Handle user logout
 * Note: DONE
 */
export const logout = async (req: Request, res: Response): Promise<void> => {
  const username = req.body.username;
  await User.findOneAndUpdate({ username }, { online: false });
  res.status(200).send({ message: 'Logged out' });
};