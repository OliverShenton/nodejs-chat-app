const path = require("path");
const http = require("http");
const express = require("express");
const socketio = require("socket.io");
const { generateMessage, generateLocationMessages } = require("./utils/messages");
const { addUser, removeUser, getUser, getUsersInRoom } = require("./utils/users");

const app = express();
const server = http.createServer(app);
const io = socketio(server);

const port = process.env.PORT || 3000;
const publicDirectoryPath = path.join(__dirname, "../public");

app.use(express.static(publicDirectoryPath));

io.on("connection", (socket) => {
  console.log("New WebSocket connection");

  socket.on("join", (options, callback) => {
    const { error, user } = addUser({ id: socket.id, ...options });

    if (error) {
      return callback(error);
    }

    if (user && user.room) {
      socket.join(user.room);

      socket.emit("message", generateMessage("Admin", "Welcome"));
      socket.broadcast
        .to(user.room)
        .emit("message", generateMessage("Admin", `${user.username} has joined the chat!`));
      io.to(user.room).emit("roomData", {
        room: user.room,
        users: getUsersInRoom(user.room),
      });

      callback();
    } else {
      callback("User or room not found");
    }
  });

  socket.on("sendMessage", (message, callback) => {
    const user = getUser(socket.id);

    if (user && user.room) {
      io.to(user.room).emit("message", generateMessage(user.username, message));
      callback();
    } else {
      callback("Unable to send message, user not found.");
    }
  });

  socket.on("sendLocation", (coords, callback) => {
    const user = getUser(socket.id);

    if (user && user.room) {
      io.to(user.room).emit(
        "locationMessage",
        generateLocationMessages(
          user.username,
          `https://google.com/maps?q=${coords.latitude},${coords.longitude}`
        )
      );
      callback();
    } else {
      callback("Unable to share location, user not found.");
    }
  });

  socket.on("disconnect", () => {
    const user = removeUser(socket.id);

    if (user && user.room) {
      io.to(user.room).emit("message", generateMessage("Admin", `${user.username} has left!`));
      io.to(user.room).emit("roomData", {
        room: user.room,
        users: getUsersInRoom(user.room),
      });
    }
  });
});

server.listen(port, () => {
  console.log(`Server is on port ${port}!`);
});
