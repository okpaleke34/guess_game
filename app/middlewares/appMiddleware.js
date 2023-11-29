const jwt = require('jsonwebtoken');
const moment = require('moment');
const db = require("../models/index");
const Op = db.Sequelize.Op;
const { formatUnix } = require("../helpers/functions");
const { Arena,Player,Game } = require("../models");



module.exports.authPlayer = (req,res, next) =>{
    const playerToken = req.headers['x-authorization'];
    // Verify and extract the JWT token
    const jwtToken = playerToken ? playerToken.split(' ')[1] : null;
    if(!jwtToken){
        return res.status(401).json({status:false,message:"Unauthorized"})
    }
    else{
        require('dotenv').config();
        jwt.verify(jwtToken,process.env.JWT_SECRET,async(err,decodedToken)=>{
            if(err){
                console.log({err});
                return res.status(401).json({status:false,message:"Unauthorized"})
            }
            else{
                const {username} = decodedToken.player;
                const player = await Player.findOne({where:{username}})
                if(!player){
                    return res.status(401).json({status:false,message:"Unauthorized"})
                }
                else{
                    res.locals.player = player.dataValues;
                    next()
                }
            }
        })
    }
    
}

module.exports.settings = async (req,res, next) =>{
    next()
}


module.exports.helpers = async (req,res,next)=>{
    res.locals.formatUnix = formatUnix
    next()
}

