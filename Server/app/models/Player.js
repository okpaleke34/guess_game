const bcrypt = require("bcrypt");
const moment = require("moment");

module.exports = (con,Sequelize) =>{
    const {STRING,INTEGER,JSON} = Sequelize
    const Player = con.define("player",{
        fname:{
            type:STRING(65),
            allowNull:false
        },
        lname:{
            type:STRING(65),
            allowNull:false
        },
        email:{
            type:STRING(65),
            allowNull:false
        },
        username:{
            type:STRING(65),
            allowNull:false
        },
        password:{
            type:STRING(128),
            allowNull:false
        },
        jwtcode:{
            type: STRING(512),
            allowNull:true
        },
        settings:{
            type: JSON,
            defaultValue: {sound:true,music:true,background:"bg-1"},
        },
        level:{
            type:INTEGER(1),
            allowNull:true,
            defaultValue:1,
            comment:"1:novice;2:master;"
        },
        access:{
            type:INTEGER(1),
            allowNull:true,
            defaultValue:1,
            comment:"0:denied;1:Full access"
        },
        last_login:{
            type:STRING(10),
        },
        last_seen:{
            type:STRING(10),
        }
    },
    {
        hooks:{
            beforeCreate:async function(player){
                // console.log("before creating")
                const salt = await bcrypt.genSalt();
                player.password = await bcrypt.hash(player.password,salt);
            }
        }
    })



    // Define the data you want to insert
    const oracle = {
        fname:"Oracle",
        lname:"Oracle",
        email:"oracle@guessgame.com",
        username:"Oracle",
        password:"oracle",
        level:2,
        access:1,
        last_login:moment().tz('Europe/Oslo').unix(),
        last_seen:moment().tz('Europe/Oslo').unix(),
    };


    // Define the afterSync hook to insert data after the table is created
    Player.addHook('afterSync', 'insertDefaultData', async () => {
        try {
            const existingOracle = await Player.findOne({ where: {username: oracle.username,email:oracle.email } });
            if (!existingOracle) {
            await Player.create(oracle);
            console.log('Oracle created successfully.');
            } 
        }
        catch (error) {
        console.error('Error inserting oracle profile:', error);
        }
    });

    return Player
}