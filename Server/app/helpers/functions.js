const fs = require("fs");
const jwt = require("jsonwebtoken");
const moment = require("moment");
const momentTZ = require('moment-timezone');
const { Player, Arena } = require("../models");
const { Op } = require("sequelize");

const now = moment();
var folder = './app/public/uploads/'
const timezone = 'Europe/Oslo'; // Replace with your desired timezone

const maxAge = 30 * 24 * 60 *60;
exports.maxAge = maxAge
exports.createToken = (type,value,remember=true) =>{
    require('dotenv').config();
    return jwt.sign({[type]:value},process.env.JWT_SECRET,{
        expiresIn:remember?maxAge * 30:maxAge / 30
    })
}


const genid = (length,type="upper") => {
    var result = '';
    var characters = '';
    if(type == "mix"){
        characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789/.!@#$%^&*'
    }
    else if(type == "alpha"){
        characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    }
    else if(type == "digit"){
        characters = '0123456789'
    }
    else{
        characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    }
    // var characters       = 'abcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
       result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

exports.genID = genid
exports.genGMID = () => {
    let alpha = genid(2,"alpha")
    let digit = genid(4,"digit")
    return `GM${digit}${alpha}`
}

exports.updateGuess = (guesses,guesser_id,segment,new_guess) => {
    if(guesses.length == 0){
        guesses.unshift({segment,guessers:[{guesser_id,guesses:[new_guess]}]})
    }
    else{
        // Loop through the guesses to check if the segment already exist
        for (let i = 0; i < guesses.length; i++) {
            if(guesses[i].segment == segment){
                let found = false
                // Loop through the guessers to check if the guesser already exist
                for (let j = 0; j < guesses[i].guessers.length; j++) {
                    if(guesses[i].guessers[j].guesser_id == guesser_id){
                        // Check if the guess already exist
                        for (let k = 0; k < guesses[i].guessers[j].guesses.length; k++) {
                            let {guess,timestamp,status} = guesses[i].guessers[j].guesses[k]
                            if(guess == new_guess.guess && timestamp == new_guess.timestamp){
                                if(status == new_guess.status){
                                    // If the guess already exist and has the same status, return false
                                    return guesses
                                    // return false
                                }
                                else{
                                    // If the guess already exist and has a different status, update the status and return the guesses
                                    guesses[i].guessers[j].guesses[k].status = new_guess.status
                                    return guesses
                                }
                            }
                        }
                        // Append the guess to the guesser if the guesser already exist
                        guesses[i].guessers[j].guesses.unshift(new_guess)
                        found = true
                        break
                    }

                    if(j == guesses[i].guessers.length - 1){
                        // If at the end of the loop and the guesser does not exist, create a new one
                        guesses[i].guessers.unshift({guesser_id,guesses:[new_guess]})
                        found = true
                        break
                    }
                }
                if(found){
                    break
                }
            }
            if(i == guesses.length - 1){
                // If at the end of the loop and the segment does not exist, create a new one
                guesses.unshift({segment,guessers:[{guesser_id,guesses:[new_guess]}]})
                break
            } 
        }
    }
    return guesses
}

exports.calculateTrials = (guesses) => {
    let trials = 0
    if(guesses.length == 0){
        trials = 0
    }
    else{
        // Loop through the segments uncovered
        for (let i = 0; i < guesses.length; i++) {
            // Loop through the guessers guesses per segment
            for (let j = 0; j < guesses[i].guessers.length; j++) {
                // Add the the total number of guesses in a segment for a guesser
                trials += guesses[i].guessers[j].guesses.length
            }
        }
    }
    return trials
}

exports.randomInt = (min, max) =>  {
    return min + Math.floor((max - min) * Math.random());
}

exports.getStatus = (status)=>{
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

exports.fetchPlayer = async (type,value)=>{
    var player = await Player.findOne({where:{[type]:value}})
    if(player){
        player = player.dataValues
        return player
    }
    else{
        return false
    }
}



exports.getLeaderBoardPosition = async (score)=>{
    // Get the arena where final_score is not 0 and  less than score and count the number of rows
    const count = await Arena.count({where:{final_score:{[Op.ne]:0,[Op.lt]:score}}})
    return count + 1
}

exports.formatUnix = (timestamp) =>{
    timestamp = Number(timestamp)*1000
    let osloTime = momentTZ.tz(timestamp, timezone);
    // Format the timestamp
    // let formattedTime = moment.unix(timestamp).tz(timezone).format('MMM D, YYYY h:mm A');
    let formattedTime = osloTime.format('MMM D, YYYY h:mm A');
    return formattedTime
}


exports.timeElasped = (difference) => {
    difference = Number(difference)*1000
    if (difference < 0) {
        return "Expired";
    }
    else{
        var days = Math.floor(difference / (1000 * 60 * 60 * 24));
        var hours = Math.floor((difference  % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        var minutes = Math.floor((difference  % (1000 * 60 * 60)) / (1000 * 60));
        var seconds = Math.floor((difference  % (1000 * 60)) / 1000);
        let time_var = "";
        if (days>0) {
            time_var += `${days}d `;
        }
        if (hours>0) {
            time_var += `${hours}h `;
        }
        if (minutes>0) {
            time_var += `${minutes}m `;
        }
        if (seconds>0) {
            time_var += `${seconds}s `;
        }
        if(time_var == ""){
            time_var = "Now";
        }
        return time_var;
    }
}



exports.validateFormData = (data) =>{
    const errors = [];
  
    // Validation for first name
    if (!data.fname.trim()) {
      errors.push("First name is required");
    }
  
    // Validation for last name
    if (!data.lname.trim()) {
      errors.push("Last name is required");
    }
  
    // Validation for email
    if (!data.email.trim()) {
      errors.push("Email is required");
    } else if (!/\S+@\S+\.\S+/.test(data.email)) {
      errors.push("Invalid email format");
    }
  
    // Validation for username
    if (!data.username.trim()) {
      errors.push("Username is required");
    }
  
    // Validation for password
    if (!data.password.trim()) {
      errors.push("Password is required");
    } else if (data.password.length < 6) {
      errors.push("Password must be at least 6 characters");
    }
  
    // Validation for confirm password
    if (!data.cpassword.trim()) {
      errors.push("Confirm password is required");
    } else if (data.cpassword !== data.password) {
      errors.push("Passwords do not match");
    }
  
    return errors;
}