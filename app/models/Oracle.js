module.exports = (con,Sequelize) =>{
  const {STRING,INTEGER,JSON} = Sequelize
  const Oracle = con.define("oracle",{
    ref_arena: {
      type: INTEGER,
      allowNull: true,
      comment: "This is the arena_id of the game that will be used as a reference for making suggestions, it can be current arena_id if no reference found"
    },
    arena_id: {
      type: INTEGER,
      allowNull: true,
      comment: "This is the arena_id of the current playing game"
    },
    proposal_segments: {
      type: JSON,
      allowNull: true,
      defaultValue: [],
      comment: "This is the list of segments that the oracle will suggest to the guesser"
    },
    proposal_type: {
      type: INTEGER,
      allowNull: true,
      comment: "This is how the proposal will be made; 0: random_generated, 1: guessers_suggestion, 2: displayed_segments"
    }  
  }, {
    freezeTableName: true, // set this option to true to use the singular model name as the table name
    charset: 'latin1',
    collate: 'latin1_swedish_ci'
  });

  return Oracle
}