const moment = require("moment");
const momentTZ = require('moment-timezone');
const Sequelize = require("sequelize");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const bcrypt =  require("bcrypt");
const db = require("../models/index");
const Op = db.Sequelize.Op;
const { Arena,Player,Game } = require("../models");
const { genID,genGMID,randomInt, createToken, updateGuess, calculateTrials, formatUnix, timeElasped, validateFormData } = require("../helpers/functions");
const  { Server } = require("socket.io");
const Oracle = require("../classes/Oracle");


// (async () => {
//     const oracle = new Oracle("123", db);
//     let gameID = await oracle.chooseGame();
//     // let verify = await oracle.verifyGuess(1);
//     console.log({ gameID });
// })();


const timestamp = moment().unix()
const domain = "https://beaton.ng"

// Will be fetched from database
const games = [
    {
        "id": 1,
        "answer": "Cinema",
        "dir":"ILSVRC2012_val_00000086_scattered",
        "segments":49
    },    
    {
        "id": 2,
        "answer": "Castle",
        "dir":"ILSVRC2012_val_00000122_scattered",
        "segments":46
    },    
]



exports.reset_password = async (req,res)=>{
    const {email} = req.body
    Player.findOne({where:{email}})
    .then(async player=>{
        if(player){
            if(player.dataValues.access == "1"){
                let new_password = genID(8,"mix")
                let _new_password = new_password
                const salt = await bcrypt.genSalt();
                new_password = await bcrypt.hash(new_password,salt);
                await Player.update({password:new_password},{where:{email}})
                res.json({status:true,message:`Your password has been reset successfully. our new password is: ${_new_password}`})
            }
            else{
                res.json({status:false,message:"Failed to reset password. Your account has been denied from playing game. Contact the support for more enquires!"});
            }                
        }
        else{
            res.json({status:false,message:"Failed to reset password. Player does not exist!"});
        }
    })
    .catch(err =>{
        res.json({status:false,message:"Failed to reset password. Contact the support or try again later"});
        console.log(err)
    })
}

exports.login = async (req,res)=>{
    const {player,password} = req.body
    Player.findOne({
        where:{
            [Op.or]: [
                { email: player},
                { username: player}
            ]
        }
    })
    .then(async player=>{
        if(player){
            if(player.dataValues.access == "1"){
                const auth = await bcrypt.compare(password,player.password)
                if(auth){
                    let last_login = moment().tz('Europe/Oslo').unix();
                    await Player.update({last_login},{where:{id:player.id}})
                    const {id,username,fname,email,createdAt} = player.dataValues
                    const token = createToken("player",{username,createdAt})
                    res.json({status:true,message:"Player logged in successfully", token, data:{id,username,name:fname,email,token}})
                }
                else{
                    res.json({status:false,message:"Failed to login. Password does not match!"});
                }
            }
            else{
                // player.dataValues.access == "0"
                res.json({status:false,message:"Failed to login. Your account has been denied from playing game. Contact the support for more enquires!"});
            }                
        }
        else{
            res.json({status:false,message:"Failed to login. Player does not exist!"});
        }
    })
    .catch(err =>{
        res.json({status:false,message:"Failed to login. Contact the support or try again later"});
        console.log(err)
    })
}

exports.register = async (req,res)=>{
    let player = req.body
    // Validate the player input
    let playerInterface = {fname:"",lname:"",email:"",username:"",password:"",cpassword:"",remember:true}
    if (Object.keys(player).length !== Object.keys(playerInterface).length) {
        res.status(400).send({status:false,message:"Invalid form data"})
        return;
    }
    let errors = validateFormData(player);
    if (errors.length > 0) {
        res.status(400).send({status:false,message:errors[0], errors})
        return;
    }
    player.last_login = moment().tz('Europe/Oslo').unix();
    player.last_seen = moment().tz('Europe/Oslo').unix();
    // Check if player already exist
    Player.findOne({
        where:{
            [Op.or]: [
                { email: player.email},
                { username: player.username}
            ]
        }
    })
    .then(found => {
        if(found){
            res.status(409).send({status:false,message:"Email or username already exist"})
        }
        else{
            // Create Player
            Player.create(player)
            .then(data => {
                player = data.dataValues
                const {username,fname,email,createdAt} = player
                const token = createToken("player",{username,createdAt})
                res.json({status:true,message:"Player registered successfully", token,data:{username,name:fname,email,token}})
                
            })
            .catch(err => {
                console.log(err)
                res.status(500).send({status:false,message:"Internal Server Error"})
            });
        }
    })  
}

exports.create_duo_player= async (req,res)=>{
    const {username} = req.body
    // console.log({username})
    var player = await Player.findOne({where:{username}})
    if(player){
        player = player.dataValues
        const games = await Game.findAll({where:{status:1}})
        // console.log("Games: ",games.length,randomInt(0,games.length))
        let game = games[randomInt(0,games.length)]
        game = game.dataValues
        const arena_token = genGMID()
        // console.log({game:game.dataValues,arena_token})
        // const game = games[randomInt(0,games.length)]
        // const arena_token = genGMID()
        const new_game = {proposer_id:player.id,game_id:game.id,answer:game.answer,dir:game.dir,segments:game.segments,arena_token,type:"duo-player"}
        // console.log({new_game})
        // // console.log(new_game)
        Arena.create(new_game)
        .then(data => {
            res.json({status:true,message:"Game created successfully", game:{id:arena_token,player_type:"proposer",answer:game.answer,game_type:"duo-player",dir:game.dir,segments:game.segments,players:[],time_started:false,connected:false}})
        })
        .catch(err => {
            console.log(err)
            res.status(500).send({status:false,message:"Internal Server Error"})
        });
    }
    else{
        res.status(404).send({status:false,message:"Player not found"})
    }
}
exports.join_duo_player = async (req,res)=>{
    const {username,arena_token} = req.body
    // console.log({username,arena_token})
    var player = await Player.findOne({where:{username}})
    if(player){
        player = player.dataValues
        Arena.findOne({where:{arena_token,status:0},include:[{ model: db.Game, as: 'game' },{ model: db.Player, as: 'proposer' }]})
        .then(arena => {
            console.log({arena})
            if(arena){
                var {arena_token,guessers_id,game,proposer} = arena.dataValues
                guessers_id = JSON.parse(guessers_id)
                guessers_id.push(player.id)
                Arena.update({guessers_id,status:1},{where:{arena_token}})
                .then(data => {
                    if (data[0] == 1) {
                        // If the arena is updated successfully then send the response to the guesser and a socket message to the proposer
                        let {dir,segments,insight} = game.dataValues
                        const io = res.locals.socket_io
                        let emitTo = `SCK_WAITING_${arena_token}`.toUpperCase()
                        game = {id:arena_token,player_type:"guesser",game_type:"duo-player",dir,segments,insight,time_started:false,connected:true,proposer:proposer.dataValues.username}
                        
                        io.emit(emitTo, {status:"player-joined",player:{id:player.id,username:player.username}});
                        res.json({status:true,message:"You have successfully joined the arena", game})
                    }
                    else{
                        res.status(404).send({status:false,message:"Failed to join the game, try again"})
                    }
                })
                .catch(err => {
                    console.log(err)
                    res.status(500).send({status:false,message:"Internal Server Error while joining game"})
                });
            }
            else{
                res.status(404).send({status:false,message:"Arena not found"})
            }
        })
        .catch(err => {
            console.log(err)
            res.status(500).send({status:false,message:"Internal Server Error While fetching game"})
        });
    }
    else{
        res.status(404).send({status:false,message:"Player not found"})
    }
}

exports.check_player_authentication= async (req,res)=>{
    // If it gets here, it means the player is authenticated
    let player = res.locals.player
    delete player.password
    // delete player.access
    delete player.jwtcode
    res.json({status:true,message:"Player is authenticated", player})
}

exports.update_profile = async (req,res)=>{
    let player = res.locals.player
    let {cpassword,...profile} = req.body

    // Check if email or username already exist and player id is not the same
    const count = await Player.count({where:{
        [Op.or]: [
            { email: player.email},
            { username: player.username}
        ],
        [Op.not]:{id:player.id}
    }})
    // If the count is greater than 0, then it means the email or username already exist
    if(count > 0){
        res.status(409).send({status:false,message:"Email or username already exist"})
        return
    }

    // Check if password input is filled and encrypt it, else delete password from profile
    if(profile.password != ""){
        const salt = await bcrypt.genSalt();
        profile.password = await bcrypt.hash(profile.password,salt);
    }
    else{
        delete profile.password
    }

    // Update player
    Player.update(profile,{where:{id:player.id}})
    .then(async data => {
        if (data[0] == 1) {
            // If the player is updated successfully then send the response to the player
            let this_player = await fetchPlayer("id",player.id)
            let {id,username,fname,email,createdAt} = this_player
            let token = createToken("player",{username,createdAt})
            res.json({status:true,message:"Profile updated successfully",data:{id,username,name:fname,email,token}})
        }
        else{
            res.status(404).send({status:false,message:"Failed to update profile, try again"})
        }
    })
    .catch(err => {
        console.log(err)
        res.status(500).send({status:false,message:"Internal Server Error while updating profile"})
    });
}


exports.update_settings = async (req,res)=>{
    let player = res.locals.player
    let data = req.body
    console.log({data})
    let defSettings = JSON.parse(player.settings)
    let settings = {...defSettings,...data}

    // Update player
    Player.update({settings},{where:{id:player.id}})
    .then(async data => {
        if (data[0] == 1) {
            res.json({status:true,message:"Settings updated successfully"})
        }
        else{
            res.status(404).send({status:false,message:"Failed to update settings, try again"})
        }
    })
    .catch(err => {
        console.log(err)
        res.status(500).send({status:false,message:"Internal Server Error while updating settings"})
    });
}

exports.fetch_game_progress_proposer = async (req,res)=>{
    const player = res.locals.player
    const {token} = req.params
    Arena.findOne({where:{arena_token:token,status:1},include:[{ model: db.Game, as: 'game' }]})
    .then(async arena => {
        if(arena){
            var {arena_token,guesses,time_started,displayed_segments,guessers_id} = arena.dataValues
            const {dir,segments} = arena.game.dataValues
            displayed_segments = JSON.parse(displayed_segments)
            displayed_segments = [...displayed_segments].map(segment => Number(segment))


            guessers_id = JSON.parse(guessers_id)
            let players = []
            for (let i = 0; i < guessers_id.length; i++) {
                const id = guessers_id[i];
                let player = await fetchPlayer("id",Number(id))
                if(player){
                    players.push({id,username:player["username"]})
                }
            }
            const game = {id:arena_token,player_type:"proposer",game_type:"duo-player",dir,segments,players,time_started,connected:true}

            guesses = JSON.parse(guesses)
            // Update the guesses to include the username
            guesses = guesses.map(guess => {
                var {segment,guessers} = guess
                guessers = guessers.map(guesser => {
                    var {guesser_id,guesses} = guesser
                    return {username:players.find(player => player.id == guesser_id).username,guesses}
                })
                return {segment,guessers}
            })
            res.json({status:true,message:"Game progress fetched successfully",game,displayed_segments,guesses})
        }
        else{
            res.status(404).send({status:false,message:"Game not found"})
        }
    })
    .catch(err => {
        console.log(err)
        res.status(500).send({status:false,message:"Internal Server Error While fetching game"})
    });
}

exports.fetch_game_progress_guesser = async (req,res)=>{
    const player = res.locals.player
    const {token} = req.params
    Arena.findOne({where:{arena_token:token,status:1},include:[{ model: db.Game, as: 'game' },{ model: db.Player, as: 'proposer' }]})
    .then(arena => {
        if(arena){
            var {guesses,time_started,displayed_segments} = arena.dataValues
            const {dir,segments,insight} = arena.game.dataValues
            const {username} = arena.proposer.dataValues
            const game = {id:token,player_type:"guesser",game_type:"duo-player",dir,segments,insight,time_started,connected:true,proposer:username}
            displayed_segments = JSON.parse(displayed_segments)
            displayed_segments = [...displayed_segments].map(segment => Number(segment))
            
            // [ {segment:1,guessers:[{guesser_id, guesses:[time_stamp,status,guess]}]} ]
            // [ {segment:1,guesses:[{status:-1|0|1,guess:""}]}]
            console.log({guesses})
            guesses = JSON.parse(guesses)
            console.log({guesses})
            var trials = []
            guesses.forEach(guess => {
                var {segment,guessers} = guess
                // guessers = JSON.parse(guessers)
                // Loop through the guessers to find the guesser
                guessers.forEach(guesser => {
                    if(guesser.guesser_id == player.id){
                        // // Loop through the trials to check if the segment already exist
                        // for (let i = 0; i < trials.length; i++) {
                        //     if(trials[i].segment == segment){
                        //         trials[i].guesses.push({status:0,guess:guesser.guesses})
                        //         return
                        //     }
                        // }
                        // // If the segment does not exist, create a new one
                        trials.push({segment,guesses:guesser.guesses})
                    }
                });
            });
            res.json({status:true,message:"Game progress fetched successfully",game,displayed_segments,trials})
        }
        else{
            res.status(404).send({status:false,message:"Game not found"})
        }
    })
    .catch(err => {
        console.log(err)
        res.status(500).send({status:false,message:"Internal Server Error While fetching game"})
    });
}

exports.fetch_game_details = async (req,res)=>{
    const {arena_token} = req.params
    Arena.findOne({where:{arena_token},include:[{ model: db.Game, as: 'game' },{ model: db.Player, as: 'proposer' }]})
    .then(async arena => {
        if(arena){
            let data = {}
            var {time_started,displayed_segments,guesses,final_score,time_ended,status,guessers_id} = arena.dataValues
            data.trials = calculateTrials(JSON.parse(guesses))
            data.time_started = formatUnix(time_started)
            data.status = getStatus(status)
            data.proposer = arena.proposer.dataValues.username
            data.guessers = []
            data.time_completed = "___----___"
            data.time_taken = "___----___"
            data.final_score = "___----___"
            data.leader_board_position = "##"
            if(status > 1){
                data.time_completed = formatUnix(time_ended)
                data.time_taken = timeElasped(time_ended - time_started)
                data.final_score = final_score
                if(final_score != 0){
                    data.leader_board_position = await getLeaderBoardPosition(final_score)
                }
            }
            // Get the guessers
            guessers_id = JSON.parse(guessers_id)
            for (let i = 0; i < guessers_id.length; i++) {
                const id = guessers_id[i];
                let player = await fetchPlayer("id",Number(id))
                if(player){
                    data.guessers.push({id,username:player["username"]})
                }
            }
            // console.log({data})
            res.json({status:true,data})
        }
        else{
            res.status(404).send({status:false,message:"Game not found"})
        }
    })
    .catch(err => {
        console.log(err)
        res.status(500).send({status:false,message:"Internal Server Error While fetching game"})
    });

}

exports.fetch_player_history = async (req,res)=>{
    // Get the player from the res.locals
    const player = res.locals.player
    // Get the arenas where the player is the proposer or guesser
    // Order by final_score    
    Arena.findAll({
        where:{
            [Op.or]:[
                {proposer_id:player.id},
                // SELECT * FROM arena WHERE JSON_CONTAINS(guessers_id, '3', '$') = 1;
                Sequelize.where(Sequelize.fn('JSON_CONTAINS', Sequelize.col('guessers_id'), Sequelize.literal(player.id), Sequelize.literal("\'$\'")), 1)
            ]
        },
        order:[['final_score', 'ASC']]        
    })
    .then(async arenas => {
        if(arenas){
            let data = []
            let zero_score = []
            for (let i = 0; i < arenas.length; i++) {
                let arena_data = {}
                const arena = arenas[i];
                let {arena_token,final_score,time_started,time_ended,status,guesses} = arena.dataValues
                let trials = calculateTrials(JSON.parse(guesses))
                arena_data.trials = trials
                arena_data.arena_token = arena_token
                arena_data.status = getStatus(status)
                arena_data.time_taken = "__--__"
                arena_data.final_score = "__--__"
                arena_data.leader_board_position = "##"
                if(final_score != 0){
                    arena_data.time_taken = timeElasped(time_ended - time_started)
                    arena_data.final_score = final_score
                    arena_data.leader_board_position = await getLeaderBoardPosition(final_score)
                    data.push(arena_data)
                    continue;
                }
                // If the final_score is 0, then the game is still in progress
                zero_score.push(arena_data)
            }
            // Sort the data by leader_board_position
            data.sort((a,b)=>a.leader_board_position - b.leader_board_position)
            // Append the zero_score to the data
            data = [...data,...zero_score]
            res.json({status:true,data})
        }
        else{
            res.status(404).send({status:false,message:"Game not found"})
        }
    })
    .catch(err => {
        console.log(err)
        res.status(500).send({status:false,message:"Internal Server Error While fetching game"})
    });

}
exports.fetch_leader_board = async (req,res)=>{
    // Get the arenas where the player is the proposer or guesser
    // Order by final_score    
    Arena.findAll({
        where:{final_score:{[Op.ne]:0}},
        order:[['final_score', 'ASC']]      
    })
    .then(async arenas => {
        if(arenas){
            let data = []
            for (let i = 0; i < arenas.length; i++) {
                let arena_data = {}
                const arena = arenas[i];
                let {arena_token,final_score,time_started,time_ended,status,guesses} = arena.dataValues
                let trials = calculateTrials(JSON.parse(guesses))
                arena_data.trials = trials
                arena_data.time_started = formatUnix(time_started)
                arena_data.arena_token = arena_token
                // arena_data.status = getStatus(status)
                arena_data.time_taken = "__--__"
                arena_data.final_score = "__--__"
                // arena_data.leader_board_position = "##"
                if(final_score != 0){
                    arena_data.time_taken = timeElasped(time_ended - time_started)
                    arena_data.final_score = final_score
                    // arena_data.leader_board_position = await getLeaderBoardPosition(final_score)
                    data.push(arena_data)
                    continue;
                }
            }
            // Sort the data by leader_board_position
            // data.sort((a,b)=>a.leader_board_position - b.leader_board_position)
            res.json({status:true,data})
        }
        else{
            res.status(404).send({status:false,message:"Game not found"})
        }
    })
    .catch(err => {
        console.log(err)
        res.status(500).send({status:false,message:"Internal Server Error While fetching game"})
    });

}

exports.submit_guess = async (req,res)=>{
    var {arena_token,segment,guess,status} = req.body;
    console.log({arena_token,segment,guess,status})
    segment = Number(segment)
    const player = res.locals.player
    const timestamp = moment().tz('Europe/Oslo').unix()
    //  [ {segment:1,guessers:[{guesser_id, guesses:[time_stamp,status,guess]}]} ]
    // Get the arena from the database
    try{
        Arena.findOne({where:{arena_token}})
        .then(arena=>{
            // console.log("Found arena", {arena})
            if(arena){
                // Get the guesses from the arena
                let guesses = JSON.parse(arena.dataValues.guesses);
                guesses = updateGuess(guesses,player.id,segment,{guess,status,timestamp})
                // console.log({guesses}, guesses[0].guessers, guesses[0].guessers[0].guesses)
                // res.json({status:true,message:"Guess submitted successfully"})
                // Store it in arena table using the arena_token
                Arena.update({guesses},{where:{arena_token}})
                .then(data => {
                    console.log("Sending to proposer")
                    const io = res.locals.socket_io
                    io.emit(`SCK_ARENA_NEW_GUESS_${arena_token}`.toUpperCase(), {segment,guess,status,username:player.username,timestamp}); // Send to the proposer
                    res.json({status:true,message:"Guess submitted successfully"})
                })
                .catch(err => {
                    // Send message to the proposer that there is an error
                    res.status(500).send({status:false,message:"Internal Server Error while updating guess"})
                    console.log(err)
                });
            }
            else{
                res.status(404).send({status:false,message:"Arena not found"})
            }
        })
        .catch(err => {
            // Send message to the proposer that there is an error
            res.status(500).send({status:false,message:"Internal Server Error while submitting guess"})
            console.log(err)
        });
    }
    catch(err){
        console.log(err)
        res.status(500).send({status:false,message:"Internal Server Error while submitting guess"})
    }
}

exports.show_segment = async (req,res)=>{
    const {id,segment,isFirstSegment} = req.body;
    // Get the arena from the database
    Arena.findOne({where:{arena_token:id}}).then(arena=>{
        if(arena){
            let displaySegments = JSON.parse(arena.dataValues.displayed_segments);
            displaySegments.push(segment);
            // Remove duplicates in case of multiple clicks
            displaySegments = [...new Set(displaySegments)];
            // Store it in arena table using the arena_token
            let updatedArena = {displayed_segments:displaySegments}
            var response = {status:true,message:"Segment shown successfully"}
            var sck_msg = {segment}
            if(isFirstSegment){
                updatedArena.time_started = moment().tz('Europe/Oslo').unix()
                response.time_started = updatedArena.time_started
                sck_msg.time_started = updatedArena.time_started
            }
            Arena.update(updatedArena,{where:{arena_token:id}})
            .then(data => {
                // console.log({data})
                const io = res.locals.socket_io
                io.emit(`SCK_ARENA_SHOW_GUESSERS_${id}`.toUpperCase(), sck_msg); // Send to the guesser
                res.json(response)
            })
            .catch(err => {
                // Send message to the proposer that there is an error
                res.status(500).send({status:false,message:"Internal Server Error while showing segment"})
                console.log(err)
            });
        }
    })
    .catch(err => {
        // Send message to the proposer that there is an error
        res.status(500).send({status:false,message:"Internal Server Error while showing segment"})
        console.log(err)
    });
}

exports.react_to_guess = async (req,res)=>{
    var {id,segment,username,...new_guess} = req.body;
    // Get the arena from the database
    Arena.findOne({where:{arena_token:id},include:[{ model: db.Game, as: 'game' }]})
    .then(async arena=>{
        if(arena){
            var {guesses,time_started,displayed_segments,guessers_id} = arena.dataValues
            var {answer} = arena.game.dataValues
            guesses = JSON.parse(guesses);
            let guesser = await fetchPlayer("username",username)
            var update = {}
            update.guesses = updateGuess(guesses,guesser.id,segment,new_guess)
            var isCorrectGuess = false
            // If the guess is correct, then update the final_score
            final_score = 0
            if(new_guess.status == 1){
                update.status = 3
                update.time_ended = moment().tz('Europe/Oslo').unix()
                // This will be calculated by {number of elapsed time(time_ended - time_started)}/60 * {number of segments shown(displayed_segments)} * {Number of players(count(guessers_id))} * {trials} The lower the score the higher on leader board
                final_score = ((update.time_ended - time_started)/60) * displayed_segments.length * JSON.parse(guessers_id).length * calculateTrials(update.guesses)
                final_score = Math.round(final_score)
                update.final_score = final_score
                isCorrectGuess = true
            }
            // Store it in arena table using the arena_token
            Arena.update(update,{where:{arena_token:id}})
            .then(async data => {
                // Send to the guesser
                const io = res.locals.socket_io
                var message = "Reaction submitted successfully"
                if(isCorrectGuess){
                    // Get the rank in the leader board
                    let rank = await getLeaderBoardPosition(final_score)
                    if(rank == 1){
                        message = `${username} has guessed the correct answer and with the record breaking score of ${final_score}, you are now on the top of the leader board. You are the GUESSER KING!!!`
                    }
                    else{
                        message = `${username} has guessed the correct answer and with the score of ${final_score}, you are now on the ${rank} on the leader board`
                    }
                    // Send to all the guessers that the guess is correct
                    io.emit(`SCK_ARENA_GUESS_CORRECT_${id}`.toUpperCase(), {answer,message});
                }
                io.emit(`SCK_ARENA_RES_GUESS_${id}_${username}`.toUpperCase(), {segment,...new_guess});
                res.json({status:true,message})
            })
            .catch(err => {
                // Send message to the proposer that there is an error
                res.status(500).send({status:false,message:"Internal Server Error while updating guess"})
                console.log(err)
            });
        }
    })
    .catch(err => {
        // Send message to the proposer that there is an error
        res.status(500).send({status:false,message:"Internal Server Error while reacting to a guess"})
        console.log(err)
    });
}

exports.submit_suggestion = async (req,res)=>{
    const {arena_token,segments} = req.body;
    const player = res.locals.player
    // Get the arena from the database
    Arena.findOne({where:{arena_token}})
    .then(async arena=>{
        if(arena){
            let guessers_suggestion = JSON.parse(arena.dataValues.guessers_suggestion);
            guessers_suggestion.push({guesser_id:player.id,segments})
            // Store it in arena table using the arena_token
            Arena.update({guessers_suggestion},{where:{arena_token}})
            .then(data => {
                // Send to the guesser
                res.json({status:true,message:"Suggestion submitted successfully"})
            })
            .catch(err => {
                // Send message to the guesser that there is an error
                res.status(500).send({status:false,message:"Internal Server Error while updating suggestion"})
                console.log(err)
            });
        }
    })
    .catch(err => {
        // Send message to the guesser that there is an error
        res.status(500).send({status:false,message:"Internal Server Error while submitting suggestion"})
        console.log(err)
    });
}

exports.give_up = async (req,res)=>{
    const player = res.locals.player
    const {arena_token} = req.body;
    // Get the arena from the database
    Arena.findOne({where:{arena_token},include:[{ model: db.Game, as: 'game' }]})
    .then(async arena=>{
        if(arena){
            var {guessers_id,quitters_id} = arena.dataValues
            var {answer} = arena.game.dataValues
            var update = {}
            var end_type = "partial"
            guessers_id = JSON.parse(guessers_id)
            quitters_id = JSON.parse(quitters_id)
            // Add the player to the quitters_id
            quitters_id.push(player.id)
            update.quitters_id = quitters_id
            // Check if there are more guessers left
            let leftPlayers = (guessers_id.length - quitters_id.length)
            var message = `${player.username} has left the game, ${leftPlayers} guesser(s) left`
            if(leftPlayers > 0){
                // // If there are more than one guesser, then the proposer can't give up
                // res.status(403).send({status:false,message:"You can't give up now. There are other guessers in the game"})
                // return
            }
            else{
                // If there are no more guessers left, then end the game
                update.status = 2
                update.time_ended = moment().tz('Europe/Oslo').unix()
                end_type = "full"
                message = `${player.username} has left the game so the game has ended`
            }
            // console.log(update)
            // Store it in arena table using the arena_token
            Arena.update(update,{where:{arena_token}})
            .then(data => {
                // Send to the guesser
                const io = res.locals.socket_io
                io.emit(`SCK_ARENA_GIVE_UP_${arena_token}`.toUpperCase(), {username:player.username,message,end_type});
                res.json({status:true,message:"You have left the game, propose 15 segments that you feel next guessers can recognize easily",answer})
            })
            .catch(err => {
                // Send message to the proposer that there is an error
                res.status(500).send({status:false,message:"Internal Server Error while updating arena"})
                console.log(err)
            });
        }
        else{
            res.status(404).send({status:false,message:"Arena not found"})
        }
    })
    .catch(err => {
        // Send message to the proposer that there is an error
        res.status(500).send({status:false,message:"Internal Server Error while giving up"})
        console.log(err)
    })

}


const fetchPlayer = async (type,value)=>{
    var player = await Player.findOne({where:{[type]:value}})
    if(player){
        player = player.dataValues
        return player
    }
    else{
        return false
    }
}

const getStatus = (status)=>{
    switch (status) {
        case 0:
            return "Not Started"
        case 1:
            return "In Progress"
        case 2:
            return "Quit"
        case 3:
            return "Won"
        default:
            return "Unknown"
    }
}

const getLeaderBoardPosition = async (score)=>{
    // Get the arena where final_score is not 0 and  less than score and count the number of rows
    const count = await Arena.count({where:{final_score:{[Op.ne]:0,[Op.lt]:score}}})
    return count + 1
}

