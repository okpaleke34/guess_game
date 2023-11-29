const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const morgan = require("morgan");
const moment = require("moment");
const cron = require("node-cron");
const fs = require("fs");
const fileUpload = require('express-fileupload');
const { Op } = require("sequelize");
const db = require("./app/models");
const http = require('http');
const { Server } = require('socket.io');
const https = require('https');
// const { Arena } = require("./app/models");
const app = express();
const server = http.createServer(app);

const origin = ["http://localhost:3412", "https://beaton.ng"];

var corsOptions = {
    origin
}

// enable files upload
app.use(fileUpload({
    createParentPath: true
}));

// Middlewares


  

app.use(cors(corsOptions));
// parser requests of content-type - application/json
app.use(bodyParser.json())
// parse requests of content-type - application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({extended:true}));

// default static files directory
app.use(express.static("app/public/"));
app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(cookieParser());
app.use(morgan('dev'));


// Socket Initialization
const io = new Server(server, {
    cors: {
      origin,
    },
});


// Socket.IO server logic
io.on('connection', (socket) => {
    // console.log("MADE A REQUEST")
//   console.log('A player connected');
//   console.log("Socket ID: ",socket.id);


    // socket.on('SCK_ARENA_REQUEST_SEGMENT', (data) => {
    //     const {arena_id,username} = data;
    //     console.log(`SCK_ARENA_REQUEST_SEGMENT_PROPOSER_${arena_id}`.toUpperCase())
    //     // Send to the proposer
    //     io.emit(`SCK_ARENA_REQUEST_SEGMENT_PROPOSER_${arena_id}`.toUpperCase(), {info:`${username} is requesting for a segment`}); 
    // });

//   socket.on('SCK_ARENA_SHOW_SEGMENT', (data) => {
//     const {id,segment} = data;
//     // Get the arena from the database
//     Arena.findOne({where:{arena_token:id}}).then(arena=>{
//         if(arena){
//             let displaySegments = JSON.parse(arena.dataValues.displayed_segments);
//             displaySegments.push(segment);
//             // Remove duplicates in case of multiple clicks
//             displaySegments = [...new Set(displaySegments)];
//             // Store it in arena table using the arena_token
//             Arena.update({displayed_segments:displaySegments},{where:{arena_token:id}})
//             .then(data => {
//                 // console.log({data})
//                 io.emit(`SCK_ARENA_SHOW_GUESSERS_${id}`.toUpperCase(), {segment}); // Send to the guesser
//             })
//             .catch(err => {
//                 // Send message to the proposer that there is an error
//                 console.log(err)
//             });
//         }
//     })
//     .catch(err => {
//         // Send message to the proposer that there is an error
//         console.log(err)
//     });
//   });

  socket.on('disconnect', () => {
    console.log('A player disconnected');
  });
});
app.use((req,res,next)=>{
    app.locals.url = req.url;
    // Store the io object in res.locals
    res.locals.socket_io = io
    next();
})


db.con.sync({
    logging:false
});

app.use((req,res,next)=>{
    app.locals.url = req.url;
    next();
})


// Update the weather api every 1 hr
cron.schedule("1 * * * * *",()=>{
    const now = moment().unix()    
})

require("./app/routes/gameRoutes")(app)
require("./app/routes/H2HRoutes")(app)
require("./app/routes/O2HRoutes")(app)
// 404 Error page
app.use((req,res)=>{
    res.status(404).json({status:false,message:"Page not found"});
})

// set port, listen for requests
const PORT = process.env.PORT || 4000;

server.listen(PORT,()=>{
    console.log(`Server is running on port ${PORT}`)
})

exports.app = app;
