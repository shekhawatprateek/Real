const path = require("path");
const http = require("http");
const socketio = require("socket.io");
const formatMessage = require("./utils/messages");
const mongoose = require("mongoose");
const userModel = require("./models/Users");
const express = require("express");
const {
  userJoin,
  getCurrentUser,
  userLeave,
  getRoomUsers,
} = require("./utils/users");

// Definitions
const app = express();
const cookieParser = require("cookie-parser");
const server = http.createServer(app);
const io = socketio(server);

// Google Auth
const { OAuth2Client } = require("google-auth-library");
const CLIENT_ID =
  "942010968885-63cl7shm7tnfnp8a27j5ruui2nnncilh.apps.googleusercontent.com";
const client = new OAuth2Client(CLIENT_ID);

const PORT = process.env.PORT || 5000;

// Middleware
app.set("view engine", "ejs");
app.use(express.json());
app.use(cookieParser());
app.use(express.static(__dirname + "/public"));

// Database Setup
mongoose
  .connect(
    "mongodb+srv://admin:admin@cluster0.mkwpk.mongodb.net/myFirstDatabase?retryWrites=true&w=majority",
    {
      useNewUrlParser: true,
    }
  )
  .then(console.log("Database Connected"));

const botName = "ChatCord Bot";

// Run when a client connects
io.on("connection", (socket) => {
  socket.on("joinRoom", ({ username, room }) => {
    const user = userJoin(socket.id, username, room);

    socket.join(user.room);

    socket.join();

    // Welcome Current User
    socket.emit("message", formatMessage(botName, "Welcome to ChatCord"));

    // Broadcat when a user connects
    socket.broadcast
      .to(user.room)
      .emit(
        "message",
        formatMessage(botName, `<b>${user.username}</b> has joined the chat`)
      );

    // Send users and room Info
    io.to(user.room).emit("roomUsers", {
      room: user.room,
      users: getRoomUsers(user.room),
    });
  });

  // console.log("new web socket connection...");

  // Listen for chatMessage
  socket.on("chatMessage", (msg) => {
    const user = getCurrentUser(socket.id);

    io.to(user.room).emit("message", formatMessage(`${user.username}`, msg));
  });
  // Run when a client disconnects
  socket.on("disconnect", () => {
    const user = userLeave(socket.id);

    if (user) {
      io.to(user.room).emit(
        "message",
        formatMessage(botName, `<b>${user.username}</b> has left the chat`)
      );

      // Send users and room Info
      io.to(user.room).emit("roomUsers", {
        room: user.room,
        users: getRoomUsers(user.room),
      });
    }
  });
});

// Insert Data
// app.post("/insert", async (req, res) => {
//   const foodName = req.body.foodName;
//   const days = req.body.days;

//   const food = new FoodModel({
//     foodName: foodName,
//     daysSinceIAte: days,
//   });

//   try {
//     await food.save();
//     res.send("Data Inserted");
//   } catch (err) {
//     console.log(err);
//   }
// });

app.get("/", (req, res) => {
  res.render("index");
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.post("/login", (req, res) => {
  let token = req.body.token;
  //   console.log(token);
  var payload;

  async function verify() {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: CLIENT_ID,
    });
    payload = ticket.getPayload();
    const userid = payload["sub"];

    // const email = payload.email;
    // const name = payload.name;

    // var user = new userModel({
    //       email: email,
    //       username: name,
    //     });

    // userModel.find({ email: payload.email }, (err, result) => {
    //   if (err) {
    //     console.log(err);
    //   }
    //   else if(result.length === 0) {
    //       userExist = false;
    //       // console.log("no email found")
    //     } else {
    //     userExist = true;
    //     // console.log('email Foundedddd')
    //     // console.log(result.length)
    //   }
    // });
  }

  verify()
    .then(() => {
      userModel.find({ email: payload.email }, (err, result) => {
        if (err) {
          console.log(err);
        } else if (result.length === 0) {
          const email = payload.email;
          const name = payload.name;

          var user = new userModel({
            email: email,
            username: name,
          });

          user.save();
          console.log("first time");
        }
      });

      res.cookie("session-token", token);
      res.send("success");
    })
    .catch(console.error);
});

app.get("/dashboard", checkAuthenticated, (req, res) => {
  let user = req.user;
  res.render("dashboard", { user });
});

app.get("/protectedroute", checkAuthenticated, (req, res) => {
  // let user = req.user;
  res.render("test");
});

app.get("/chat", checkAuthenticated, (req, res) => {
  // let user = req.user;
  res.render("chat");
});

app.get("/logout", (req, res) => {
  res.clearCookie("session-token");
  res.redirect("/login");
});

function checkAuthenticated(req, res, next) {
  let token = req.cookies["session-token"];

  let user = {};

  async function verify() {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: CLIENT_ID,
    });
    const payload = ticket.getPayload();
    user.name = payload.name;
    user.email = payload.email;
    user.picture = payload.picture;
  }
  verify()
    .then(() => {
      req.user = user;
      next();
    })
    .catch((err) => {
      res.redirect("/login");
    });
}

server.listen(PORT, () => {
  console.log(`Port running at ${PORT}`);
});
