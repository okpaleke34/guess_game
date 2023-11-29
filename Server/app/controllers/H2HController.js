const moment = require("moment");
const Sequelize = require("sequelize");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const bcrypt =  require("bcrypt");
const db = require("../models/index");
const Op = db.Sequelize.Op;
const { Arena,Player,Game } = require("../models");
const { genID,genGMID,randomInt, updateGuess, calculateTrials, fetchPlayer, getLeaderBoardPosition } = require("../helpers/functions");
const Oracle = require("../classes/Oracle");




const timestamp = moment().unix()
const domain = "https://beaton.ng"
 

exports.create_duo_player = async (req,res)=>{
    var player = res.locals.player
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


exports.join_duo_player = async (req,res)=>{
    const {arena_token} = req.body
    var player = res.locals.player
    Arena.findOne({where:{arena_token,status:0},include:[{ model: db.Game, as: 'game' },{ model: db.Player, as: 'proposer' }]})
    .then(arena => {
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

exports.create_multi_player = async (req,res)=>{    
    var player = res.locals.player
    const games = await Game.findAll({where:{status:1}})
    let game = games[randomInt(0,games.length)]
    game = game.dataValues
    const arena_token = genGMID()
    const new_game = {proposer_id:player.id,game_id:game.id,answer:game.answer,dir:game.dir,segments:game.segments,arena_token,type:"friends-multi-player"}
    Arena.create(new_game)
    .then(data => {
        res.json({status:true,message:"Game created successfully", game:{id:arena_token,player_type:"proposer",answer:game.answer,game_type:"friends-multi-player",dir:game.dir,segments:game.segments,players:[],time_started:false,connected:false}})
    })
    .catch(err => {
        console.log(err)
        res.status(500).send({status:false,message:"Internal Server Error"})
    });
}

exports.join_multi_player = async (req,res)=>{
    const {arena_token} = req.body
    var player = res.locals.player
    Arena.findOne({where:{arena_token,status:0},include:[{ model: db.Game, as: 'game' },{ model: db.Player, as: 'proposer' }]})
    .then(arena => {
        if(arena){
            var {arena_token,guessers_id,game,proposer} = arena.dataValues
            guessers_id = JSON.parse(guessers_id)
            let players = [{id:player.id,username:player.username}]
            guessers_id.forEach(async guesser_id => {
                let p = await fetchPlayer("id",guesser_id)
                players.push({id:p.id,username:p.username})
            });
            guessers_id.push(player.id)
            Arena.update({guessers_id},{where:{arena_token}})
            .then(data => {
                if (data[0] == 1) {
                    // If the arena is updated successfully then send the response to the guesser and a socket message to the proposer
                    let {dir,segments,insight} = game.dataValues
                    const io = res.locals.socket_io
                    let emitTo = `SCK_WAITING_${arena_token}`.toUpperCase()
                    game = {id:arena_token,player_type:"guesser",players,game_type:"friends-multi-player",dir,segments,insight,time_started:false,connected:false,proposer:proposer.dataValues.username}
                    
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

exports.start_multi_player = async (req,res)=>{
    const {arena_token} = req.body
    Arena.update({status:1},{where:{arena_token}})
    .then(data => {
        if (data[0] == 1) {
            // If the arena is updated successfully then send the response to all the guessers in waiting room
            const io = res.locals.socket_io
            let emitTo = `SCK_WAITING_${arena_token}`.toUpperCase()
            io.emit(emitTo, {status:"start-game"});
            res.json({status:true,message:"Game started successfully"})
        }
        else{
            res.status(404).send({status:false,message:"Failed to start the game, try again"})
        }
    })
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


exports.submit_guess = async (req,res)=>{
    var {arena_token,segment,guess,status} = req.body;
    // console.log({arena_token,segment,guess,status})
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
                final_score = ((update.time_ended - time_started)/60) * JSON.parse(displayed_segments).length * JSON.parse(guessers_id).length * calculateTrials(update.guesses)
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

exports.request_segment = async (req,res)=>{
    // Send to the proposer
    const io = res.locals.socket_io
    const {arena_id,username} = req.body;
    io.emit(`SCK_ARENA_REQUEST_SEGMENT_PROPOSER_${arena_id}`.toUpperCase(), {info:`${username} is requesting for a segment`,timestamp:moment().tz('Europe/Oslo').unix()}); 
    res.json({status:true,message:"Request sent successfully"})
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



