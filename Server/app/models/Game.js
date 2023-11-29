module.exports = (con,Sequelize) =>{
  const {STRING,INTEGER,JSON,TEXT} = Sequelize
  const Game = con.define("game",{
    dir: {
      type: STRING(128),
      allowNull: false
    },
    answer: {
      type: STRING(32),
      allowNull: false
    },
    insight: {
      type: STRING(512),
      allowNull: true,
      comment: "Insight about the image"
    },
    segments: {
      type: INTEGER,
      allowNull: false,
    },
    status: {
      type: INTEGER,
      allowNull: false,
      defaultValue: 1,
      comment: "0: not available, 1: Available"
    }    
  }, {
    // freezeTableName: true, // set this option to true to use the singular model name as the table name
    charset: 'latin1',
    collate: 'latin1_swedish_ci'
  });




  // Define the data you want to insert
  const defaultData = [
    {
    answer: "Cinema",
    dir:"ILSVRC2012_val_00000086_scattered",
    segments:49,
    insight:"Somewhere to watch movies"
    },    
    {
      answer: "Castle",
      dir:"ILSVRC2012_val_00000122_scattered",
      segments:46,
      insight:"Somewhere to the king lives"
    }   
  ];


  // Define the afterSync hook to insert data after the table is created
  Game.addHook('afterSync', 'insertDefaultData', async () => {
    try {
      defaultData.forEach(async (data) => {
        // Check if a game with the same dir and answer already exists
        const existingGame = await Game.findOne({ where: {dir: data.dir,answer:data.answer } });
        if (!existingGame) {
          await Game.create(data);
          console.log('Default Game data inserted successfully.');
        } 
        // else {
        //     console.log('Game with the same dir and answer already exists. Skipping insertion.');
        // }
      })
    }
    catch (error) {
      console.error('Error inserting default Game data:', error);
    }
  });
  return Game
}