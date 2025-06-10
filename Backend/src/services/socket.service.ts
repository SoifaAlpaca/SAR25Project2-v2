import { Server, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import config from '../config/config';
import User from '../models/user';
import Item from '../models/item';

class SocketService {
  private io: Server | null = null;
  private socketIDbyUsername: Map<string, string> = new Map();
  private usernamebySocketID: Map<string, string> = new Map();
  private intervalId: NodeJS.Timeout | null = null;

  /**
   * Initialize Socket.IO server
   */
  public init(io: Server): void {
    this.io = io;


    // JWT authentication for socket.io
    io.use((socket: Socket, next) => {
      // Check for token in query or auth object (supporting both methods)
      const token =
        socket.handshake.query?.token as string ||
        (socket.handshake.auth as any)?.token;

      if (token) {
        jwt.verify(token, config.jwtSecret, (err: jwt.VerifyErrors | null, decoded: any) => {
          if (err) {
            console.error('Socket auth error:', err.message);
            return next(new Error('Authentication error'));
          }
          socket.data.decoded_token = decoded;
          next();
        });
      } else {
        console.error('Socket auth error: No token provided');
        next(new Error('Authentication error: No token provided'));
      }
    });

    console.log('Socket service initialized');
    this.setupSocketEvents();
    this.startAuctionTimer();
  }

  /**
   * Set up socket event handlers
   */
  private setupSocketEvents(): void {
    if (!this.io) return;

    this.io.on('connection', (socket: Socket) => {
      const username = socket.data.decoded_token.username;
      console.log(`${username} user connected`);

      // Store client in the maps
      this.socketIDbyUsername.set(username, socket.id);
      this.usernamebySocketID.set(socket.id, username);

      // Handle new user event
      socket.on('newUser:username', async (data) => {
        console.log("newUser:username -> New user event received: ", data);
        const username = data.username;
        await User.findOneAndUpdate({ username }, { online: true });
        this.io?.emit('new:user', { username });
      });

      // Handle bid event
      socket.on('send:bid', async (data) => {
        console.log("send:bid -> Received event send:bid with data = ", data);
        // Original dummy functionality 
        const { itemId, bidAmount, winninguser, buynow } = data;
        try {
          const item = await Item.findById(itemId);
          if (!item) {
            console.log(`Item not found: ${itemId}`);
            return;
          }

          if (item.remainingtime <= 0) {
            console.log(`Item ${item.description} has expired.`);
            return;
          }

          if (bidAmount <= item.currentbid && !buynow) {
            console.log(`Bid too low: ${bidAmount} <= ${item.currentbid}`);
            return;
          }

          item.currentbid = bidAmount;
          item.wininguser = winninguser;
          await item.save();

          console.log(`Bid accepted for item ${item.description}.`);
          this.io?.emit('bid:update', {
            itemId: item._id,
            currentbid: bidAmount,
            wininguser: winninguser
          });

          if (item.remainingtime <= 0 || buynow) {
            item.sold = true;
            item.remainingtime = 0; // Ensure remaining time is set to 0 when sold
            await item.save();
            console.log(`Item sold: ${item}`);
            this.io?.emit('item:sold', {
              description: item.description,
              wininguser: winninguser,
              finalPrice: bidAmount
            });
            //await Item.findByIdAndDelete(item.id);
          }
        } catch (err) {
          console.error("Error processing bid:", err);
        }
      });

      // Handle message event
      socket.on('send:message', (chat) => {
        console.log("send:message received:", chat);
        const recieverSocketId = this.socketIDbyUsername.get(chat.receiver);
        if (recieverSocketId) {
          this.io?.to(recieverSocketId).emit('receive:message', chat);
        }
      });

      // Handle disconnection
      socket.on('disconnect', async () => {
        console.log("User disconnected");
        const username = this.usernamebySocketID.get(socket.id);
        if (username) {
          this.socketIDbyUsername.delete(username);
          await User.findOneAndUpdate({ username }, { online: false });
          this.io?.emit('user:logout', username);
        }
        this.usernamebySocketID.delete(socket.id);
      });
    });
  }

  /**
   * Start auction timer for item remaining time updates
   */
  private startAuctionTimer(): void {
    // Timer function to decrement remaining time 
    this.intervalId = setInterval(async () => {
      //  update item times here
      try {
        const items = await Item.find({});
        const updatedItems: any[] = [];

        for (const item of items) {
          if (item.remainingtime > 0) {
            item.remainingtime -= 1;
            await item.save();
            //console.log(`${item.description} -> ${item.remainingtime}ms restantes.`);
            updatedItems.push(item);
          }
        }
        if (this.io) {
          this.io.emit('items:update', updatedItems);
        }
      } catch (err) {
        console.error('Error updating remainingtime:', err);
      }
    }, 1000);
  }

  /**
   * Broadcast new logged-in user to all clients
   */
  public newLoggedUserBroadcast(newUser: any): void {
    if (this.io) {
      for (const socketID of this.socketIDbyUsername.values()) {
        this.io.to(socketID).emit('new:user', newUser);
      }
    }
  }

  /**
   * Broadcast user logged-out event to all clients
   */
  public userLoggedOutBroadcast(loggedOutUser: any): void {
    console.log('RemoveItemBroadcast -> ', loggedOutUser);
    if (this.io) {
      for (const socketID of this.socketIDbyUsername.values()) {
        this.io.to(socketID).emit('remove:user', loggedOutUser);
      }
    }
  }

  /**
   * Clean up resources
   */
  public cleanup(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }
}

export default new SocketService();