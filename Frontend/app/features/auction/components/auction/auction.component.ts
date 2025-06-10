import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';

// Import services from the barrel file
import { AuctionService, SocketService, SigninService } from '../../../../core/services';

// Import models from the barrel file 
import { Item, User, Chat, Marker } from '../../../../core/models';
import { findIndex } from 'rxjs';

@Component({
  selector: 'app-auction',
  templateUrl: './auction.component.html',
  styleUrls: ['./auction.component.css'],
  standalone: false
})
export class AuctionComponent implements OnInit {
  items: Item[]; //array of items to store the items.
  users: User[];
  displayedColumns: string[] //Array of Strings with the table column names
  message: string; // message string
  destination: string; //string with the destination of the current message to send. 
  ChatMessage: string; // message string: string; // message string
  showBid: boolean;  //boolean to control if the show bid form is placed in the DOM
  showMessage: boolean; //boolean to control if the send message form is placed in the DOM
  selectedItem!: Item; //Selected Item can be Item or null
  bidForm!: FormGroup; //FormGroup for the biding
  userName!: string;
  errorMessage: string; //string to store error messages received in the interaction with the api
  mapOptions: google.maps.MapOptions;
  markers: Marker[]; //array to store the markers for the looged users posistions.
  centerLat: number;
  centerLong: number;
  showRemove: boolean;
  soldHistory: string[];
  chats: Chat[]; //array for storing chat messages
  counter: number;

  constructor(private formBuilder: FormBuilder, private router: Router, private socketservice: SocketService, private auctionservice: AuctionService,
    private signinservice: SigninService) {
    this.items = [];
    this.users = [];
    this.soldHistory = [];
    this.chats = [];
    this.counter = 0;
    this.message = "";
    this.destination = "";
    this.ChatMessage = "";
    this.showBid = false;
    this.showMessage = false;
    this.userName = this.signinservice.token.username;
    this.errorMessage = "";
    this.displayedColumns = ['description', 'currentbid', 'buynow', 'remainingtime', 'wininguser', 'owner'];
    this.centerLat = this.signinservice.latitude != null ? this.signinservice.latitude : 38.640026;
    this.centerLong = this.signinservice.longitude != null ? this.signinservice.longitude : -9.155379;
    this.markers = [];
    this.showRemove = false;
    this.mapOptions = {
      center: { lat: this.centerLat, lng: this.centerLong },
      zoom: 10
    };
  }
  ngOnInit(): void {
    this.message = "Hello " + this.userName + "! Welcome to the SAR auction site.";
    //create bid form
    this.bidForm = this.formBuilder.group({
      bid: ['', Validators.compose([Validators.required, Validators.pattern("^[0-9]*$")])]
    });


    // Get initial item data from the server api using http call in the auctionservice
    this.auctionservice.getItems()
      .subscribe({
        next: result => {
          let receiveddata = result as Item[]; // cast the received data as an array of items (must be sent like that from server)
          this.items = receiveddata;
          console.log("getItems Auction Component -> received the following items: ", receiveddata);
        },
        error: error => this.errorMessage = <any>error
      });

    // Get initial list of logged in users for googleMaps using http call in the auctionservice
    this.auctionservice.getUsers()
      .subscribe({
        next: result => {
          let receiveddata = result as User[]; // cast the received data as an array of users (must be sent like that from server)
          console.log("getUsers Auction Component -> received the following users: ", receiveddata);
          // do the rest of the needed processing here
        },
        error: error => this.errorMessage = <any>error
      });

    //subscribe to the incoming websocket events

    //example how to subscribe to the server side regularly (each second) items:update event
    const updateItemsSubscription = this.socketservice.getEvent("update:items")
      .subscribe(
        data => {
          let receiveddata = data as Item[];
          if (this.items) {
            this.items = receiveddata;
          }
        }
      );

    //subscribe to the new user logged in event that must be sent from the server when a client logs in
    this.socketservice.getEvent("new:user").subscribe((newUser: any) => {
      console.log("New user logged in: ", newUser);
      this.users.push(newUser); // Add the new user to the users array
    });
    //subscribe to the user logged out event that must be sent from the server when a client logs out 
    this.socketservice.getEvent("user:logout").subscribe((User: any) => {
      console.log("New user logged in: ", User);
      this.users.push(User);
    });

    //subscribe to a receive:message event to receive message events sent by the server
    this.socketservice.getEvent("receive:message").subscribe((chat: Chat) => {
      console.log("Received message: ", chat);
      this.chats.push(chat);
    });
    //subscribe to the item sold event sent by the server for each item that ends.
    this.socketservice.getEvent("item:sold").subscribe((soldItem: any) => {
      console.log("Item sold: ", soldItem);
      this.soldHistory.push(`Item ${soldItem.description} sold to ${soldItem.wininguser} for ${soldItem.finalPrice}`);
      //update local array
      const itemId = soldItem.itemId;
      const index = this.items.findIndex(item => item._id === itemId);
      if (index !== -1) {
        this.items[index].wininguser = soldItem.wininguser; // Update the winning user
        this.items[index].currentbid = soldItem.finalPrice; // Update the final price
        this.items[index].remainingtime = 0; // Set remaining time to 0 since it's sold
      }
      this.socketservice.sendEvent('items:update', this.items); // Notify other clients about the updated items
    });
    //subscription to any other events must be performed here inside the ngOnInit function
    this.socketservice.getEvent("items:update").subscribe((items: any) => {
      console.log("Items: ", items);
      this.items = items as Item[]; // Update the items array with the received data
    });

    this.socketservice.getEvent("bid:update").subscribe((data) => {
      console.log("Bid update received: ", data);
      const itemId = data.itemId;
      const currentBid = data.currentbid;
      const winningUser = data.wininguser;
      // Find the item in the local items array and update it
      const index = this.items.findIndex(item => item._id === itemId);
      if (index !== -1) {
        this.items[index].currentbid = currentBid; // Update the current bid
        this.items[index].wininguser = winningUser; // Update the winning user
        console.log(`Item ${itemId} updated with new bid: ${currentBid} by ${winningUser}`);
      }
      // Optionally, you can also update the UI or notify the user about the bid update
      // Emit an event to notify other clients about the updated items
      this.socketservice.sendEvent('items:update', this.items); // Notify other clients about the updated items
    });
  }

  logout() {
    //call the logout function in the signInService to clear the token in the browser
    this.signinservice.logout();  // Tem que estar em primeiro para ser apagado o token e nao permitir mais reconnects pelo socket
    //perform any needed logout logic here
    this.socketservice.disconnect();
    //navigate back to the log in page
    this.router.navigate(['/signin']);
  }

  //function called when an item is selected in the view
  onRowClicked(item: Item) {
    console.log("Selected item = ", item);
    this.selectedItem = item;

    this.showBid = true; // makes the bid form appear

    if (!item.owner.localeCompare(this.userName)) {
      this.showRemove = true;
      this.showMessage = false;
    }
    else {
      this.showRemove = false;
      this.destination = this.selectedItem.owner;
      this.showMessage = true;
    }
  }

  //function called when a received message is selected. 
  onMessageSender(ClickedChat: Chat) {
    //destination is now the sender of the selected received message. 
    this.destination = ClickedChat.sender;
    this.showMessage = true; // makes the message form appear
    this.ChatMessage = ClickedChat.message; // sets the message field to the selected message
    console.log("Selected message = ", ClickedChat);
  }

  // function called when the submit bid button is pressed
  submit() {
    console.log("submitted bid = ", this.bidForm.value.bid);
    const itemId = this.selectedItem._id; // get the item id from the selected item
    console.log("Item ID = ", itemId);
    const bidAmount = this.bidForm.value.bid;
    console.log("Bid Amount = ", bidAmount);
    const winninguser = this.userName;
    console.log("winninguser = ", winninguser);
    const buynow = false;
    //send an event using the websocket for this use the socketservice
    // example :  this.socketservice.sendEvent('eventname',eventdata);
    this.socketservice.sendEvent('send:bid', { itemId, bidAmount, winninguser, buynow });
  }
  //function called when the user presses the send message button
  sendMessage() {
    console.log("Message  = ", this.ChatMessage);
    this.socketservice.sendEvent('send:message', this.ChatMessage);
  }

  //function called when the cancel bid button is pressed.
  cancelBid() {
    console.log("Bid cancelled");
    this.bidForm.reset(); //clears bid value
  }

  //function called when the buy now button is pressed.

  buyNow() {
    console.log("Buy now pressed for item = ", this.selectedItem);
    this.bidForm.setValue({              /// sets the field value to the buy now value of the selected item
      bid: this.selectedItem.buynow
    });
    console.log("submitted bid = ", this.bidForm.value.bid);
    const itemId = this.selectedItem._id; // get the item id from the selected item
    console.log("Item ID = ", itemId);
    const bidAmount = this.bidForm.value.bid;
    console.log("Bid Amount = ", bidAmount);
    const winninguser = this.userName;
    console.log("Username = ", winninguser);
    const buynow = true;
    this.message = this.userName + " please press the Submit Bid button to procced with the Buy now order.";
    this.socketservice.sendEvent('send:bid', { itemId, bidAmount, winninguser, buynow });
  }
  //function called when the remove item button is pressed.
  removeItem() {
    console.log("Remove item pressed for item = ", this.selectedItem);
    //use an HTTP call to the API to remove an item using the auction service.
    if (!this.selectedItem) return;

    try {
      this.auctionservice.removeItem(this.selectedItem)
        .subscribe({
          next: result => {
            console.log("Item removed successfully: ", result);
            // Remove the item from the local items array
            const item = this.selectedItem;
            const index = this.items.findIndex(i => i._id === item._id);
            if (index !== -1) {
              this.items.splice(index, 1);
            }
            this.message = "Item removed successfully.";
            this.showBid = false; // Hide the bid form after removal
            this.showRemove = false; // Hide the remove button after removal
            this.socketservice.sendEvent('remove:item', item); // Notify other clients about the removal
            //delete all items in the local array
            this.items = this.items.filter(i => i._id !== item._id); // Remove the item from the local items array
          },
          error: error => {
            console.error("Error removing item: ", error);
            this.errorMessage = "Failed to remove item. Please try again.";
          }
        });
    } catch (error) {
      console.error("Error in removeItem: ", error);
      this.errorMessage = "An unexpected error occurred while removing the item.";
    }

  }

  /**
   * Calculate the time progress percentage for the auction item
   * @param item The auction item
   * @returns A number between 0-100 representing progress percentage
   */
  getTimeProgress(item: Item): number {
    if (!item || !item.remainingtime) {
      return 0;
    }

    const maxTime = 3600; // Assuming initial time is 1 hour (3600000 ms)
    const remainingTime = item.remainingtime;

    // Calculate elapsed time as a percentage
    const elapsedPercentage = ((maxTime - remainingTime) / maxTime) * 100;

    // Return a percentage value between 0-100
    return Math.min(Math.max(elapsedPercentage, 0), 100);
  }

  /**
   * Determine the color of the progress bar based on remaining time
   * @param item The auction item
   * @returns Material color for the progress bar
   */
  getTimeProgressColor(item: Item): string {
    if (!item || !item.remainingtime) {
      return 'warn'; // Red when no time or item data
    }

    // More than 50% time remaining - show green
    if (item.remainingtime > 1800) {
      return 'primary'; // Blue
    }
    // Between 25% and 50% time remaining - show accent (amber)
    else if (item.remainingtime > 900) {
      return 'accent';
    }
    // Less than 25% time remaining - show red
    else {
      return 'warn'; // Red
    }
  }

}
