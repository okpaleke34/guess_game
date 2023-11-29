module.exports = (con,Sequelize) =>{
    const {STRING,INTEGER,JSON} = Sequelize
    const Log = con.define("logs",{
        timestamp:{
            type:STRING(20),
            allowNull:false
        },
        player_id:{
            type:INTEGER(3),
            allowNull:false
        },
        action:{
            type:STRING(20),
            allowNull:false,
        },
        value:{
            type:JSON
        }
    }, {
        freezeTableName: true, // set this option to true to use the singular model name as the table name
        charset: 'latin1',
        collate: 'latin1_swedish_ci'
      }) 
    return Log
}