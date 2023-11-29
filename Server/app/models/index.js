const dbConfig = require("../config/db.config.js");
const Sequelize = require("sequelize")
const con = new Sequelize(dbConfig.DB,dbConfig.USER, dbConfig.PASSWORD,{
    host: dbConfig.HOST,
    dialect: dbConfig.dialect,
    operatorAliases:false,
    pool:{
        max:dbConfig.pool.max,
        min:dbConfig.pool.min,
        acquire:dbConfig.pool.acquire,
        idle:dbConfig.pool.idle
    },
    logging:false
})

const db = {};

db.Sequelize = Sequelize;
db.con = con;


db.Log = require("./Log.js")(con,Sequelize)
db.Player = require("./Player.js")(con,Sequelize)
db.Game = require("./Game.js")(con,Sequelize)
db.Oracle = require("./Oracle.js")(con,Sequelize)
db.Setting = require("./Setting.js")(con,Sequelize)

db.Arena = require("./Arena.js")(con,Sequelize)

// db.Game.belongsTo(db.Player,{foreignKey:"Player_id"})
db.Arena.belongsTo(db.Game,{as:'game',foreignKey:"game_id"})
db.Arena.belongsTo(db.Player,{as:'proposer',foreignKey:"proposer_id"})
db.Oracle.belongsTo(db.Arena,{as:'reference_arena',foreignKey:"ref_arena"})
db.Oracle.belongsTo(db.Arena,{as:'current_arena',foreignKey:"arena_id"})
// db.Player.hasMany(db.Arena,{as:'arenas',foreignKey:"proposer"})


//alter will make sure that the table is updated with the new changes
con.sync({ alter: true })
.then(() => {
    console.log('Database Synchronized Successfully');
})
.catch((error) => {
    console.error('Database Synchronized Table:', error);
});

module.exports = db;