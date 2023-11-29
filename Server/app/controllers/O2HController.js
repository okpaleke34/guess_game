const moment = require("moment");
const Sequelize = require("sequelize");
const fs = require("fs"); 
const jwt = require("jsonwebtoken");
const bcrypt =  require("bcrypt");
const db = require("../models/index");
const Op = db.Sequelize.Op;
const { Arena,Player,Game } = require("../models");
const { genID,genGMID,randomInt, createToken, updateGuess, calculateTrials, formatUnix, timeElasped, validateFormData, getLeaderBoardPosition, fetchPlayer } = require("../helpers/functions");
const Oracle = require("../classes/Oracle");



// const timestamp = moment().unix()
const domain = "https://beaton.ng"


// (async () => {
//     const oracle = new Oracle("123", db);
//     let gameID = await oracle.chooseGame();
//     // let verify = await oracle.verifyGuess(1);
//     console.log({ gameID });
// })();


exports.create_single_player= async (req,res)=>{
    var player = res.locals.player
    const games = await Game.findAll({where:{status:1}})
    let game = games[randomInt(0,games.length)]
    const arena_token = genGMID()
    // It will create a new Oracle object since the id is 0
    const oracle = new Oracle(0, db);
    let {id,dir,segments,insight} = game.dataValues
    let oracle_player = await Player.findOne({where:{email:"oracle@guessgame.com"}})
    // console.log("Oracle player",oracle_player)
    const new_game = {proposer_id:oracle_player.id,game_id:id,arena_token,type:"single-player",guessers_id:[player.id],status:1}
    Arena.create(new_game)
    .then(async data => {       
        let oracle_id = await oracle.chooseReferenceGame(id,data.id)
        if(oracle_id){     
            let g = {id:arena_token,oracle_id,player_type:"guesser",game_type:"single-player",dir,segments,insight,time_started:false,connected:true,proposer:oracle_player.username}
            res.json({status:true,message:"Game created successfully", game:g})
        }
    })
    .catch(err => {
        console.log(err)
        res.status(500).send({status:false,message:"Internal Server Error"})
    });
    
}


exports.create_multi_player = async (req,res)=>{
    var player = res.locals.player
    const games = await Game.findAll({where:{status:1}})
    let game = games[randomInt(0,games.length)]
    const arena_token = genGMID()
    // It will create a new Oracle object since the id is 0
    const oracle = new Oracle(0, db);
    let {id,dir,segments,insight} = game.dataValues
    let oracle_player = await Player.findOne({where:{email:"oracle@guessgame.com"}})
    const new_game = {proposer_id:oracle_player.id,game_id:id,arena_token,type:"oracle-multi-player",guessers_id:[player.id],status:0}
    Arena.create(new_game)
    .then(async data => {       
        let oracle_id = await oracle.chooseReferenceGame(id,data.id)
        if(oracle_id){     
            let g = {id:arena_token,oracle_id,player_type:"guesser",player_kind:"creator",game_type:"oracle-multi-player",dir,segments,insight,time_started:false,connected:false,proposer:oracle_player.username,players:[{id:player.id,username:player.username}]}
            res.json({status:true,message:"Game created successfully", game:g})
        }
        else{
            res.status(404).send({status:false,message:"Failed to create game, try again"})
        }
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
    .then(async arena => {
        if(arena){
            var {arena_token,guessers_id,game,proposer,id} = arena.dataValues
            const oracle = await db.Oracle.findOne({where:{arena_id:id}})
            const oracle_id = oracle.id
            guessers_id = JSON.parse(guessers_id)
            let players = [{id:player.id,username:player.username}]
            guessers_id.forEach(async guesser_id => {
                let p = await fetchPlayer("id",guesser_id)
                players.push({id:p.id,username:p.username})
            });
            guessers_id.push(player.id)
            Arena.update({guessers_id},{where:{arena_token}})
            .then(async data => {
                if (data[0] == 1) {
                    // If the arena is updated successfully then send the response to the guesser and a socket message to the proposer
                    let {dir,segments,insight} = game.dataValues
                    const io = res.locals.socket_io
                    let emitTo = `SCK_WAITING_${arena_token}`.toUpperCase()
                    game = {id:arena_token,oracle_id,player_type:"guesser",player_kind:"joiner",game_type:"oracle-multi-player",players,dir,segments,insight,time_started:false,connected:false,proposer:proposer.dataValues.username}
                    
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
// 
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

exports.request_segment = async (req,res)=>{
    // Send to the proposer

    const {arena_token,oracle_id} = req.body;
    const oracle = new Oracle(oracle_id, db);
    console.log({oracle_id})
    let nextSegment = await oracle.nextSegment()
    if(nextSegment){

        const io = res.locals.socket_io
        io.emit(`SCK_ARENA_SHOW_GUESSERS_${arena_token}`.toUpperCase(), nextSegment); // Send to the guesser
        res.json({status:true,message:"Segment retrieved successfully",...nextSegment})
    }
    else{
        res.json({status:false,message:"No more segment"})
    }
}

exports.submit_guess = async (req,res)=>{
    const player = res.locals.player
    var {arena_token,oracle_id,segment,guess,status} = req.body;
    segment = Number(segment)
    const oracle = new Oracle(oracle_id, db);
    let timestamp = moment().tz('Europe/Oslo').unix()
    try{
        let verify = await oracle.verifyGuess(segment,player.id,{guess,status,timestamp})
        if(verify.status){
            let final_score = verify.final_score
            let rank = await getLeaderBoardPosition(final_score)
            if(rank == 1){
                message = `guessed the correct answer and with the record breaking score of ${final_score}, you are now on the top of the leader board. You are the GUESSER KING!!!`
            }
            else{
                message = `guessed the correct answer and with the score of ${final_score}, you are now on the ${rank} on the leader board`
            }
            const io = res.locals.socket_io
            // Send message to everyone in the arena
            io.emit(`SCK_ARENA_GUESS_CORRECT_${arena_token}`.toUpperCase(), {answer:verify.answer,username:player.username,message:`${player.username} has ${message}`});
            // Send message to the guesser with the answer
            res.json({status:true,correct:true,answer:verify.answer,message:`You have ${message}`,data:verify.data})
        }
        else{
            res.json({status:true,correct:false,message:"Wrong guess",data:verify.data})
        }
    }
    catch(err){
        console.log(err)
        res.status(500).send({status:false,message:"Internal Server Error. Possibly could not find arena"})
    }    
}